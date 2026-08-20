import { createClient } from '@/lib/supabase/client';
import { Pool, PoolLeaderboardEntry, PoolMember } from '@/types';

export async function fetchUserPools(
	userId: string,
): Promise<(PoolMember & { pool: Pool })[]> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('pool_members')
			.select(
				`
				pool_id,
				user_id,
				role,
				joined_at,
				pool:pools (
					*,
					creator:profiles!pools_creator_id_fkey (
						id,
						username,
						full_name,
						avatar_url
					)
				)
			`,
			)
			.eq('user_id', userId);

		if (error) throw error;
		return (data || []) as unknown as (PoolMember & { pool: Pool })[];
	} catch (err) {
		console.error('⚠️ Failed to fetch user pools from Supabase:', err);
		return [];
	}
}

export async function fetchPoolDetails(poolId: string): Promise<Pool | null> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('pools')
			.select(
				`
				*,
				creator:profiles!pools_creator_id_fkey (
					id,
					username,
					full_name,
					avatar_url
				)
			`,
			)
			.eq('id', poolId)
			.single();

		if (error) throw error;

		// Fetch member count separately for accuracy and performance
		const { count, error: countError } = await supabase
			.from('pool_members')
			.select('*', { count: 'exact', head: true })
			.eq('pool_id', poolId);

		if (!countError && count !== null) {
			data.member_count = count;
		}

		return data as Pool;
	} catch (err) {
		console.error(`⚠️ Failed to fetch pool detail for ${poolId}:`, err);
		return null;
	}
}

export async function fetchPoolLeaderboard(
	poolId: string,
): Promise<PoolLeaderboardEntry[]> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase.rpc('get_pool_leaderboard', {
			p_pool_id: poolId,
		});

		if (error) throw error;
		return (data || []) as PoolLeaderboardEntry[];
	} catch (err) {
		console.error(`⚠️ Failed to fetch leaderboard for pool ${poolId}:`, err);
		return [];
	}
}

export async function fetchPoolMembers(poolId: string): Promise<PoolMember[]> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('pool_members')
			.select(
				`
				pool_id,
				user_id,
				role,
				joined_at,
				profile:profiles (*)
			`,
			)
			.eq('pool_id', poolId)
			.order('joined_at', { ascending: true });

		if (error) throw error;
		return (data || []) as unknown as PoolMember[];
	} catch (err) {
		console.error(`⚠️ Failed to fetch members for pool ${poolId}:`, err);
		return [];
	}
}

export async function createPool(
	userId: string,
	name: string,
	description: string | null,
	isPublic: boolean,
): Promise<Pool | null> {
	const supabase = createClient();

	try {
		// 1. Generate unique 6-character invite code via database RPC
		const { data: inviteCode, error: codeError } = await supabase.rpc(
			'generate_pool_invite_code',
		);

		if (codeError) throw codeError;

		// 2. Insert the pool (the db trigger will automatically join the creator)
		const { data, error } = await supabase
			.from('pools')
			.insert({
				name,
				description,
				invite_code: inviteCode,
				creator_id: userId,
				is_public: isPublic,
			})
			.select()
			.single();

		if (error) throw error;
		return data as Pool;
	} catch (err: any) {
		console.error('⚠️ Failed to create pool in Supabase:', err);
		throw new Error(err.message || 'Failed to create pool.');
	}
}

interface JoinResponse {
	success: boolean;
	pool_id?: string;
	name?: string;
	error?: string;
	message?: string;
}

export async function joinPoolByCode(
	inviteCode: string,
): Promise<JoinResponse> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase.rpc('join_pool_by_code', {
			p_invite_code: inviteCode,
		});

		if (error) throw error;
		return data as JoinResponse;
	} catch (err: any) {
		console.error('⚠️ Failed to join pool by code in Supabase:', err);
		return {
			success: false,
			error: err.message || 'Failed to join pool.',
		};
	}
}

export async function leavePool(
	poolId: string,
	userId: string,
): Promise<boolean> {
	const supabase = createClient();

	try {
		const { error } = await supabase
			.from('pool_members')
			.delete()
			.eq('pool_id', poolId)
			.eq('user_id', userId);

		if (error) throw error;
		return true;
	} catch (err) {
		console.error(`⚠️ Failed to leave pool ${poolId}:`, err);
		return false;
	}
}
