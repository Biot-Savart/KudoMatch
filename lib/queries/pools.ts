import { createClient } from '@/lib/supabase/client';
import {
	HeadToHeadStats,
	PoolLeaderboardEntry,
	PoolScopeKind,
	PoolScoringMode,
	ScopedPool,
} from '@/types';

export const poolsQueryKeys = {
	all: ['pools'] as const,
	user: (userId: string) => [...poolsQueryKeys.all, 'user', userId] as const,
	detail: (poolId: string) =>
		[...poolsQueryKeys.all, 'detail', poolId] as const,
	leaderboard: (poolId: string) =>
		[...poolsQueryKeys.all, 'leaderboard', poolId] as const,
	h2h: (poolId: string, userA: string, userB: string) =>
		[...poolsQueryKeys.all, 'h2h', poolId, userA, userB] as const,
};

function generateInviteCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let result = '';
	for (let i = 0; i < 6; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

export async function fetchUserPools(userId: string): Promise<ScopedPool[]> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('pool_members')
		.select(
			`
			pool_id,
			role,
			joined_at,
			left_at,
			pools:pools(
				*,
				creator:profiles!created_by(id, full_name, avatar_url)
			)
		`,
		)
		.eq('user_id', userId)
		.is('left_at', null)
		.order('joined_at', { ascending: false });

	if (error) {
		console.error(`Error fetching pools for user ${userId}:`, error);
		throw error;
	}

	return (data ?? [])
		.filter((row: any) => row.pools)
		.map((row: any) => {
			const p = row.pools;
			return {
				id: p.id,
				name: p.name,
				created_by: p.created_by,
				invite_code: p.invite_code,
				scope_kind: p.scope_kind as PoolScopeKind,
				sport_slug: p.sport_slug,
				competition_id: p.competition_id ? String(p.competition_id) : null,
				edition_id: p.edition_id ? String(p.edition_id) : null,
				scoring_mode: p.scoring_mode as PoolScoringMode,
				scoring_starts_at: p.scoring_starts_at,
				is_private: p.is_private,
				created_at: p.created_at,
				updated_at: p.updated_at,
				creator: p.creator
					? {
							id: p.creator.id,
							full_name: p.creator.full_name,
							avatar_url: p.creator.avatar_url,
							created_at: '',
							updated_at: '',
						}
					: undefined,
			};
		});
}

export async function fetchPoolById(
	poolId: string,
): Promise<ScopedPool | null> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('pools')
		.select(
			`
			*,
			creator:profiles!created_by(id, full_name, avatar_url),
			competitions:competitions(*),
			competition_editions:competition_editions(*),
			sports:sports(*)
		`,
		)
		.eq('id', poolId)
		.single();

	if (error || !data) {
		return null;
	}

	// Count active members
	const { count } = await supabase
		.from('pool_members')
		.select('*', { count: 'exact', head: true })
		.eq('pool_id', poolId)
		.is('left_at', null);

	return {
		id: data.id,
		name: data.name,
		created_by: data.created_by,
		invite_code: data.invite_code,
		scope_kind: data.scope_kind as PoolScopeKind,
		sport_slug: data.sport_slug,
		competition_id: data.competition_id ? String(data.competition_id) : null,
		edition_id: data.edition_id ? String(data.edition_id) : null,
		scoring_mode: data.scoring_mode as PoolScoringMode,
		scoring_starts_at: data.scoring_starts_at,
		is_private: data.is_private,
		created_at: data.created_at,
		updated_at: data.updated_at,
		member_count: count ?? 1,
		creator: data.creator
			? {
					id: (data.creator as any).id,
					full_name: (data.creator as any).full_name,
					avatar_url: (data.creator as any).avatar_url,
					created_at: '',
					updated_at: '',
				}
			: undefined,
	};
}

export async function fetchPoolLeaderboard(
	poolId: string,
): Promise<PoolLeaderboardEntry[]> {
	const supabase = createClient();

	const { data, error } = await (supabase.rpc as any)('get_pool_leaderboard', {
		p_pool_id: poolId,
	});

	if (error) {
		console.error(`Error fetching leaderboard for pool ${poolId}:`, error);
		return [];
	}

	return (data ?? []).map((row: any) => ({
		rank: Number(row.rank ?? 1),
		user_id: row.user_id,
		full_name: row.full_name,
		avatar_url: row.avatar_url,
		total_points: Number(row.total_points ?? 0),
		exact_count: Number(row.exact_count ?? 0),
		margin_count: Number(row.margin_count ?? 0),
		outcome_count: Number(row.outcome_count ?? 0),
		predictions_count: Number(row.predictions_count ?? 0),
	}));
}

export interface CreatePoolInput {
	name: string;
	created_by: string;
	scope_kind: PoolScopeKind;
	sport_slug?: string | null;
	competition_id?: string | null;
	edition_id?: string | null;
	scoring_mode?: PoolScoringMode;
	is_private?: boolean;
}

export async function createPool(input: CreatePoolInput): Promise<ScopedPool> {
	const supabase = createClient();
	const inviteCode = generateInviteCode();

	// All-sport pools must use normalized scoring mode
	const scoringMode: PoolScoringMode =
		input.scope_kind === 'all_sports'
			? 'normalized'
			: (input.scoring_mode ?? 'raw');

	const { data, error } = await supabase
		.from('pools')
		.insert({
			name: input.name,
			created_by: input.created_by,
			invite_code: inviteCode,
			scope_kind: input.scope_kind,
			sport_slug: input.sport_slug || null,
			competition_id: input.competition_id
				? Number(input.competition_id)
				: null,
			edition_id: input.edition_id ? Number(input.edition_id) : null,
			scoring_mode: scoringMode,
			scoring_starts_at: new Date().toISOString(),
			is_private: input.is_private ?? false,
		})
		.select()
		.single();

	if (error) {
		console.error('Error creating pool:', error);
		throw error;
	}

	// Add creator as admin member
	await supabase.from('pool_members').insert({
		pool_id: data.id,
		user_id: input.created_by,
		role: 'admin',
		joined_at: new Date().toISOString(),
	});

	return {
		id: data.id,
		name: data.name,
		created_by: data.created_by,
		invite_code: data.invite_code,
		scope_kind: data.scope_kind as PoolScopeKind,
		sport_slug: data.sport_slug,
		competition_id: data.competition_id ? String(data.competition_id) : null,
		edition_id: data.edition_id ? String(data.edition_id) : null,
		scoring_mode: data.scoring_mode as PoolScoringMode,
		scoring_starts_at: data.scoring_starts_at,
		is_private: data.is_private,
		created_at: data.created_at,
		updated_at: data.updated_at,
		member_count: 1,
	};
}

export async function joinPoolByCode(
	inviteCode: string,
	userId: string,
): Promise<ScopedPool> {
	const supabase = createClient();

	const { data: pool, error: poolError } = await supabase
		.from('pools')
		.select('*')
		.eq('invite_code', inviteCode.trim().toUpperCase())
		.single();

	if (poolError || !pool) {
		throw new Error('Pool not found with this invite code');
	}

	// Check existing membership episode
	const { data: existingMember } = await supabase
		.from('pool_members')
		.select('*')
		.eq('pool_id', pool.id)
		.eq('user_id', userId)
		.is('left_at', null)
		.maybeSingle();

	if (existingMember) {
		return fetchPoolById(pool.id) as Promise<ScopedPool>;
	}

	// Insert new active membership episode
	const { error: joinError } = await supabase.from('pool_members').insert({
		pool_id: pool.id,
		user_id: userId,
		role: 'member',
		joined_at: new Date().toISOString(),
	});

	if (joinError) {
		console.error('Error joining pool:', joinError);
		throw joinError;
	}

	const updated = await fetchPoolById(pool.id);
	return updated!;
}

export async function leavePool(poolId: string, userId: string): Promise<void> {
	const supabase = createClient();

	const { error } = await supabase
		.from('pool_members')
		.update({ left_at: new Date().toISOString() })
		.eq('pool_id', poolId)
		.eq('user_id', userId)
		.is('left_at', null);

	if (error) {
		console.error(`Error leaving pool ${poolId}:`, error);
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
		console.error(`Error deleting pool ${poolId}:`, error);
		throw error;
	}
}

export async function fetchHeadToHead(
	poolId: string,
	userAId: string,
	userBId: string,
): Promise<HeadToHeadStats> {
	const supabase = createClient();

	// Fetch pool config
	const pool = await fetchPoolById(poolId);
	if (!pool) {
		return {
			events_compared: 0,
			wins_a: 0,
			wins_b: 0,
			draws: 0,
			exacts_a: 0,
			exacts_b: 0,
			points_a: 0,
			points_b: 0,
		};
	}

	const { data: predsA } = await supabase
		.from('predictions')
		.select('*')
		.eq('user_id', userAId)
		.eq('settlement_status', 'settled');

	const { data: predsB } = await supabase
		.from('predictions')
		.select('*')
		.eq('user_id', userBId)
		.eq('settlement_status', 'settled');

	const mapB = new Map(
		(predsB ?? []).map((p) => [String(p.event_market_id), p]),
	);

	let events_compared = 0;
	let wins_a = 0;
	let wins_b = 0;
	let draws = 0;
	let exacts_a = 0;
	let exacts_b = 0;
	let points_a = 0;
	let points_b = 0;

	for (const pA of predsA ?? []) {
		const pB = mapB.get(String(pA.event_market_id));
		if (!pB) continue;

		events_compared++;
		const ptsA =
			pool.scoring_mode === 'normalized'
				? Number(pA.normalized_basis_points ?? 0)
				: Number(pA.raw_points ?? 0);
		const ptsB =
			pool.scoring_mode === 'normalized'
				? Number(pB.normalized_basis_points ?? 0)
				: Number(pB.raw_points ?? 0);

		points_a += ptsA;
		points_b += ptsB;

		if (pA.tier_code === 'exact_score') exacts_a++;
		if (pB.tier_code === 'exact_score') exacts_b++;

		if (ptsA > ptsB) wins_a++;
		else if (ptsB > ptsA) wins_b++;
		else draws++;
	}

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
