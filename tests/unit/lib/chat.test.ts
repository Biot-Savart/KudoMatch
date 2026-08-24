vi.mock('@/lib/supabase/client', () => ({
	createClient: vi.fn(() => (globalThis as any).mockSupabaseClient),
}));

import {
	deletePoolMessage,
	fetchPoolMessages,
	sendPoolMessage,
} from '@/lib/queries/chat';

const { mockSupabaseClient, MockQueryBuilder } = globalThis as any;

describe('lib/queries/chat', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('should fetch pool messages successfully', async () => {
		const mockMessagesList = [
			{
				id: 'msg-1',
				pool_id: 'pool-123',
				user_id: 'user-456',
				message: 'Banter banter!',
				created_at: '2026-08-21T12:00:00Z',
			},
		];

		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockMessagesList);
		});

		const result = await fetchPoolMessages('pool-123');
		expect(result).toEqual(mockMessagesList);
	});

	it('should send a pool message successfully', async () => {
		const mockInsertedMessage = {
			id: 'msg-1',
			pool_id: 'pool-123',
			user_id: 'user-456',
			message: 'New banter text!',
			created_at: '2026-08-21T12:05:00Z',
		};

		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder([mockInsertedMessage]);
		});

		const result = await sendPoolMessage(
			'pool-123',
			'user-456',
			'New banter text!',
		);
		expect(result).toEqual(mockInsertedMessage);
	});

	it('should delete a pool message successfully', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder({ id: 'msg-1' });
		});

		const result = await deletePoolMessage('msg-1');
		expect(result).toBe(true);
	});
});
