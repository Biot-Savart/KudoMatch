import { createClient } from '@/lib/supabase/client';
import {
	HeadToHeadStats,
	PoolLeaderboardEntry,
	PoolScopeKind,
	ScopedPool,
} from '@/types';

export const poolsQueryKeys = {
	all: ['pools'] as const,
	user: (userId?: string) => ['pools', 'user', userId] as const,
	detail: (poolId: string) => ['pools', 'detail', poolId] as const,
	leaderboard: (poolId: string) => ['pools', 'leaderboard', poolId] as const,
	picksMatrix: (poolId: string, matchday?: number | string) =>
		['pools', 'picksMatrix', poolId, matchday] as const,
};

function generateInviteCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

export async function fetchUserPools(userId: string): Promise<ScopedPool[]> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('pool_members')
		.select(
			`
      pool_id,
      joined_at,
      left_at,
      pool:pools (
        id,
        name,
        created_by,
        is_private,
        invite_code,
        scope_kind,
        sport_slug,
        competition_id,
        edition_id,
        scoring_mode,
        scoring_starts_at,
        created_at,
        updated_at,
        sport:sports (slug, name, icon_key),
        competition:competitions (id, name, slug, logo_url),
        edition:competition_editions (id, name, season_key)
      )
    `,
		)
		.eq('user_id', userId)
		.is('left_at', null);

	if (error) {
		console.error('Error fetching user pools:', error);
		throw error;
	}

	return (data ?? [])
		.map((row: any) => {
			const p = row.pool || row.pools;
			if (!p) return null;
			return {
				id: p.id,
				name: p.name,
				created_by: p.created_by,
				is_private: p.is_private,
				invite_code: p.invite_code,
				scope_kind: p.scope_kind,
				sport_slug: p.sport_slug,
				competition_id: p.competition_id,
				edition_id: p.edition_id,
				scoring_mode: p.scoring_mode,
				scoring_starts_at: p.scoring_starts_at,
				created_at: p.created_at,
				updated_at: p.updated_at,
				sport: p.sport,
				competition: p.competition,
				edition: p.edition,
			};
		})
		.filter(Boolean) as ScopedPool[];
}

export async function fetchPoolById(
	poolId: string,
): Promise<ScopedPool | null> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('pools')
		.select(
			`
			   id,
			   name,
			   created_by,
			   is_private,
			   invite_code,
			   scope_kind,
			   sport_slug,
			   competition_id,
			   edition_id,
			   scoring_mode,
			   scoring_starts_at,
			   created_at,
			   updated_at,
			   creator:profiles!pools_created_by_fkey (id, full_name, avatar_url),
			   sport:sports (slug, name, icon_key),
			   competition:competitions (id, name, slug, logo_url),
			   edition:competition_editions (id, name, season_key)
			 `,
		)
		.eq('id', poolId)
		.single();

	if (error) {
		console.error('Error fetching pool by ID:', error);
		return null;
	}

	if (!data) return null;

	const { count } = await supabase
		.from('pool_members')
		.select('*', { count: 'exact', head: true })
		.eq('pool_id', poolId)
		.is('left_at', null);

	const memberCount = count ?? 0;

	return {
		id: data.id,
		name: data.name,
		created_by: data.created_by,
		creator: (data as any).creator || (data as any).created_by_profile || null,
		is_private: data.is_private,
		invite_code: data.invite_code,
		scope_kind: data.scope_kind,
		sport_slug: data.sport_slug,
		competition_id: data.competition_id,
		edition_id: data.edition_id,
		scoring_mode: data.scoring_mode,
		scoring_starts_at: data.scoring_starts_at,
		created_at: data.created_at,
		updated_at: data.updated_at,
		members_count: memberCount,
		member_count: memberCount,
		sport: data.sport as any,
		competition: data.competition as any,
		edition: data.edition as any,
	} as any;
}

export async function fetchPoolLeaderboard(
	poolId: string,
): Promise<PoolLeaderboardEntry[]> {
	const supabase = createClient();

	const { data, error } = await supabase.rpc('get_pool_leaderboard', {
		p_pool_id: poolId,
	});

	if (error) {
		console.error('Error fetching pool leaderboard:', error);
		throw error;
	}

	return (data ?? []).map((row: any) => ({
		rank: Number(row.rank),
		user_id: row.user_id,
		full_name: row.full_name || 'Anonymous Player',
		avatar_url: row.avatar_url || null,
		total_points: Number(row.total_points),
		exact_count: Number(row.exact_count),
		margin_count: Number(row.margin_count),
		outcome_count: Number(row.outcome_count),
		predictions_count: Number(row.predictions_count),
	}));
}

export interface CreatePoolInput {
	name: string;
	description?: string;
	is_private?: boolean;
	scope_kind: PoolScopeKind;
	sport_slug?: string | null;
	competition_id?: number | null;
	edition_id?: number | null;
	scoring_mode?: 'raw' | 'normalized';
	user_id?: string;
	created_by?: string;
}

export async function createPool(input: CreatePoolInput): Promise<ScopedPool> {
	const supabase = createClient();
	const creatorId = input.user_id || input.created_by;

	if (!creatorId) {
		throw new Error('user_id or created_by is required to create a pool');
	}

	const inviteCode = generateInviteCode();

	const scoringMode =
		input.scope_kind === 'all_sports'
			? 'normalized'
			: input.scoring_mode || 'raw';

	const { data: poolId, error: poolError } = await supabase.rpc('create_pool', {
		p_name: input.name,
		p_invite_code: inviteCode,
		p_scope_kind: input.scope_kind,
		p_sport_slug: input.sport_slug || null,
		p_competition_id: input.competition_id
			? Number(input.competition_id)
			: null,
		p_edition_id: input.edition_id ? Number(input.edition_id) : null,
		p_scoring_mode: scoringMode,
		p_is_private: input.is_private ?? true,
	});

	if (poolError || !poolId) {
		console.error('Error creating pool via RPC:', poolError);
		throw poolError || new Error('Failed to create pool');
	}

	const created = await fetchPoolById(poolId);
	if (created) return created;

	return {
		id: poolId,
		name: input.name,
		created_by: creatorId,
		is_private: input.is_private ?? true,
		invite_code: inviteCode,
		scope_kind: input.scope_kind,
		sport_slug: input.sport_slug || null,
		competition_id: input.competition_id ? String(input.competition_id) : null,
		edition_id: input.edition_id ? String(input.edition_id) : null,
		scoring_mode: scoringMode,
		scoring_starts_at: new Date().toISOString(),
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
}

export async function joinPoolByCode(
	inviteCode: string,
	_userId?: string,
): Promise<ScopedPool> {
	const supabase = createClient();

	const { data: poolId, error } = await supabase.rpc(
		'join_pool_by_invite_code',
		{
			p_invite_code: inviteCode.trim().toUpperCase(),
		},
	);

	if (error || !poolId) {
		throw new Error(error?.message || 'Invalid invite code. Pool not found.');
	}

	const pool = await fetchPoolById(poolId);
	if (!pool) {
		throw new Error('Failed to retrieve pool after joining.');
	}
	return pool;
}

export async function leavePool(
	poolId: string,
	_userId?: string,
): Promise<void> {
	const supabase = createClient();

	const { error } = await supabase.rpc('leave_pool', {
		p_pool_id: poolId,
	});

	if (error) {
		console.error('Error leaving pool:', error);
		throw error;
	}
}

export async function deletePool(
	poolId: string,
	userId: string,
): Promise<void> {
	const supabase = createClient();

	const { error } = await supabase
		.from('pools')
		.delete()
		.eq('id', poolId)
		.eq('created_by', userId);

	if (error) {
		console.error('Error deleting pool:', error);
		throw error;
	}
}

export async function fetchHeadToHead(
	userAId: string,
	userBId: string,
	poolId?: string,
): Promise<HeadToHeadStats> {
	const supabase = createClient();

	let poolScoringMode = 'raw';
	let scoringStartsAt = '1970-01-01T00:00:00Z';

	if (poolId) {
		const { data: pool } = await supabase
			.from('pools')
			.select('scoring_mode, scoring_starts_at')
			.eq('id', poolId)
			.single();
		if (pool) {
			poolScoringMode = pool.scoring_mode || 'raw';
			scoringStartsAt = pool.scoring_starts_at || scoringStartsAt;
		}
	}

	const { data: predsA } = await supabase
		.from('predictions')
		.select(
			'id, event_market_id, raw_points, normalized_basis_points, tier_code, settlement_status',
		)
		.eq('user_id', userAId)
		.eq('settlement_status', 'settled');

	const { data: predsB } = await supabase
		.from('predictions')
		.select(
			'id, event_market_id, raw_points, normalized_basis_points, tier_code, settlement_status',
		)
		.eq('user_id', userBId)
		.eq('settlement_status', 'settled');

	const mapA = new Map((predsA || []).map((p) => [p.event_market_id, p]));
	const mapB = new Map((predsB || []).map((p) => [p.event_market_id, p]));

	let events_compared = 0;
	let wins_a = 0;
	let wins_b = 0;
	let draws = 0;
	let exacts_a = 0;
	let exacts_b = 0;
	let points_a = 0;
	let points_b = 0;

	Array.from(mapA.entries()).forEach(([marketId, pA]) => {
		const pB = mapB.get(marketId);
		if (!pB) return;

		events_compared++;

		const ptsA =
			poolScoringMode === 'normalized'
				? Number(pA.normalized_basis_points ?? 0)
				: Number(pA.raw_points ?? 0);
		const ptsB =
			poolScoringMode === 'normalized'
				? Number(pB.normalized_basis_points ?? 0)
				: Number(pB.raw_points ?? 0);

		points_a += ptsA;
		points_b += ptsB;

		if (pA.tier_code === 'exact_score') exacts_a++;
		if (pB.tier_code === 'exact_score') exacts_b++;

		if (ptsA > ptsB) wins_a++;
		else if (ptsB > ptsA) wins_b++;
		else draws++;
	});

	return {
		events_compared,
		wins_a,
		wins_b,
		draws,
		exacts_a,
		exacts_b,
		points_a,
		points_b,
	};
}

// Backward-compatibility aliases for legacy views & tests
export const fetchPoolDetails = fetchPoolById;

export async function fetchPoolMembers(poolId: string): Promise<any[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from('pool_members')
		.select('*, profile:profiles(*)')
		.eq('pool_id', poolId);
	return data || [];
}

export async function fetchPoolPicksMatrix(
	poolId: string,
	roundLabelOrMatchday?: string | number,
): Promise<{ matches: any[]; predictions: Record<string, any> }> {
	const supabase = createClient();

	const { data: pool } = await supabase
		.from('pools')
		.select('*')
		.eq('id', poolId)
		.maybeSingle();

	if (!pool) {
		return { matches: [], predictions: {} };
	}

	const { data: members } = await supabase
		.from('pool_members')
		.select('user_id')
		.eq('pool_id', poolId)
		.is('left_at', null);

	const memberIds = (members || []).map((m: any) => m.user_id);
	if (memberIds.length === 0) {
		return { matches: [], predictions: {} };
	}

	let eventsQuery = supabase
		.from('events')
		.select(
			`
			id,
			edition_id,
			round_label,
			starts_at,
			status,
			venue_name,
			competition_editions!inner (
				id,
				competition_id,
				competitions!inner (
					id,
					sport_slug
				)
			),
			event_competitors (
				slot,
				role,
				competitor:competitors (id, name, short_name, media_url)
			),
			event_markets (
				id,
				market_kind,
				status,
				locks_at,
				market_results (result, status)
			)
		`,
		)
		.order('starts_at', { ascending: true });

	if (pool.scope_kind === 'edition' && pool.edition_id) {
		eventsQuery = eventsQuery.eq('edition_id', pool.edition_id);
	} else if (pool.scope_kind === 'competition' && pool.competition_id) {
		eventsQuery = eventsQuery.eq(
			'competition_editions.competition_id',
			pool.competition_id,
		);
	} else if (pool.scope_kind === 'sport' && pool.sport_slug) {
		eventsQuery = eventsQuery.eq(
			'competition_editions.competitions.sport_slug',
			pool.sport_slug,
		);
	}

	if (roundLabelOrMatchday !== undefined) {
		const roundStr =
			typeof roundLabelOrMatchday === 'number'
				? `Gameweek ${roundLabelOrMatchday}`
				: String(roundLabelOrMatchday);
		eventsQuery = eventsQuery.or(
			`round_label.eq.${roundStr},round_label.eq.${roundLabelOrMatchday}`,
		);
	}

	const { data: rawEvents } = await eventsQuery;
	const eventsList = rawEvents || [];

	const marketIds: number[] = [];
	for (const evt of eventsList) {
		for (const mkt of evt.event_markets || []) {
			marketIds.push(Number(mkt.id));
		}
	}

	const predictionsMap: Record<string, any> = {};
	if (marketIds.length > 0) {
		const { data: preds } = await supabase
			.from('predictions')
			.select('*')
			.in('event_market_id', marketIds)
			.in('user_id', memberIds);

		for (const pred of preds || []) {
			const parentEvent = eventsList.find((e) =>
				(e.event_markets || []).some((m: any) => m.id === pred.event_market_id),
			);
			const eventId = parentEvent ? parentEvent.id : pred.event_market_id;
			const key = `${pred.user_id}_${eventId}`;
			predictionsMap[key] = pred;
		}
	}

	return {
		matches: eventsList,
		predictions: predictionsMap,
	};
}
