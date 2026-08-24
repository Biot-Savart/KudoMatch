import { createClient } from '@/lib/supabase/client';
import { PoolMessage } from '@/types';

/**
 * Fetches the most recent pool messages (up to a limit)
 */
export async function fetchPoolMessages(
	poolId: string,
	limit: number = 50,
): Promise<PoolMessage[]> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('pool_messages')
			.select(
				`
				*,
				profile:profiles (*)
			`,
			)
			.eq('pool_id', poolId)
			.order('created_at', { ascending: true })
			.limit(limit);

		if (error) throw error;
		return (data || []) as unknown as PoolMessage[];
	} catch (err) {
		console.error(`⚠️ Failed to fetch messages for pool ${poolId}:`, err);
		throw err;
	}
}

/**
 * Sends a message in a specific pool
 */
export async function sendPoolMessage(
	poolId: string,
	userId: string,
	message: string,
): Promise<PoolMessage> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('pool_messages')
			.insert({
				pool_id: poolId,
				user_id: userId,
				message: message.trim(),
			})
			.select(
				`
				*,
				profile:profiles (*)
			`,
			)
			.single();

		if (error) throw error;
		return data as unknown as PoolMessage;
	} catch (err) {
		console.error(`⚠️ Failed to send message to pool ${poolId}:`, err);
		throw err;
	}
}

/**
 * Deletes a pool message by ID
 */
export async function deletePoolMessage(messageId: string): Promise<boolean> {
	const supabase = createClient();

	try {
		const { error } = await supabase
			.from('pool_messages')
			.delete()
			.eq('id', messageId);

		if (error) throw error;
		return true;
	} catch (err) {
		console.error(`⚠️ Failed to delete pool message ${messageId}:`, err);
		throw err;
	}
}
