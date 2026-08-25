import { createClient } from '@/lib/supabase/client';
import { PoolMessage } from '@/types';

export const chatQueryKeys = {
	all: ['chat'] as const,
	messages: (poolId: string) =>
		[...chatQueryKeys.all, 'messages', poolId] as const,
};

export async function fetchPoolMessages(
	poolId: string,
	limit: number = 50,
): Promise<PoolMessage[]> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('pool_messages')
		.select(
			`
			id,
			pool_id,
			user_id,
			message,
			created_at,
			profiles:profiles(
				id,
				full_name,
				avatar_url
			)
		`,
		)
		.eq('pool_id', poolId)
		.order('created_at', { ascending: false })
		.limit(limit);

	if (error) {
		console.error(`Error fetching chat messages for pool ${poolId}:`, error);
		throw error;
	}

	return (data ?? [])
		.map((row: any) => ({
			id: row.id,
			pool_id: row.pool_id,
			user_id: row.user_id,
			message: row.message,
			created_at: row.created_at,
			profile: row.profiles
				? {
						id: row.profiles.id,
						full_name: row.profiles.full_name,
						avatar_url: row.profiles.avatar_url,
						created_at: '',
						updated_at: '',
					}
				: undefined,
		}))
		.reverse(); // Return in chronological order
}

export async function sendPoolMessage(
	poolId: string,
	userId: string,
	message: string,
): Promise<PoolMessage> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('pool_messages')
		.insert({
			pool_id: poolId,
			user_id: userId,
			message: message.trim(),
		})
		.select(
			`
			id,
			pool_id,
			user_id,
			message,
			created_at,
			profiles:profiles(
				id,
				full_name,
				avatar_url
			)
		`,
		)
		.single();

	if (error) {
		console.error('Error sending pool message:', error);
		throw error;
	}

	return {
		id: (data as any).id,
		pool_id: (data as any).pool_id,
		user_id: (data as any).user_id,
		message: (data as any).message,
		created_at: (data as any).created_at,
		profile: (data as any).profiles
			? {
					id: (data as any).profiles.id,
					full_name: (data as any).profiles.full_name,
					avatar_url: (data as any).profiles.avatar_url,
					created_at: '',
					updated_at: '',
				}
			: undefined,
	};
}

export async function deletePoolMessage(
	messageId: string,
	userId?: string,
): Promise<boolean> {
	const supabase = createClient();

	let query = supabase.from('pool_messages').delete().eq('id', messageId);
	if (userId) {
		query = query.eq('user_id', userId);
	}

	const { error } = await query;

	if (error) {
		console.error(`Error deleting pool message ${messageId}:`, error);
		throw error;
	}

	return true;
}
