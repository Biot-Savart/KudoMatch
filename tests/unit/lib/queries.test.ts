vi.mock('@/lib/supabase/client', () => ({
	createClient: vi.fn(() => (globalThis as any).mockSupabaseClient),
}));

import {
	fetchActiveMatchday,
	fetchAvailableMatchdays,
	fetchMatches,
} from '@/lib/queries/matches';
import {
	createPool,
	fetchPoolDetails,
	fetchPoolLeaderboard,
	fetchPoolMembers,
	fetchPoolPicksMatrix,
	fetchUserPools,
	joinPoolByCode,
	leavePool,
} from '@/lib/queries/pools';
import {
	fetchUserPredictions,
	fetchUserPredictionsWithMatches,
	upsertPrediction,
} from '@/lib/queries/predictions';

const { mockSupabaseClient, MockQueryBuilder } = globalThis as any;

describe('lib/queries/matches', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('should fetch matches successfully', async () => {
		const mockMatchList = [{ id: 'match-1', matchday: 12 }];
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockMatchList);
		});

		const matches = await fetchMatches(12);
		expect(matches).toEqual(mockMatchList);
	});

	it('should return fallback matches if no matches are found in db', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder([]);
		});

		const matches = await fetchMatches(12);
		expect(matches).toHaveLength(3); // returns fallback matches
	});

	it('should return fallback matches if fetch matches throws an error', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(
				null,
				new Error('Database connection failed'),
			);
		});

		const matches = await fetchMatches(12);
		expect(matches).toHaveLength(3); // returns fallback matches
	});

	it('should fetch available matchdays successfully', async () => {
		const mockData = [{ matchday: 12 }, { matchday: 13 }, { matchday: 12 }];
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockData);
		});

		const matchdays = await fetchAvailableMatchdays();
		expect(matchdays).toEqual([12, 13]);
	});

	it('should fetch active matchday successfully based on upcoming match', async () => {
		const mockUpcoming = [
			{ matchday: 13, kickoff_time: '2026-08-22T12:00:00Z' },
		];
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockUpcoming);
		});

		const active = await fetchActiveMatchday();
		expect(active).toBe(13);
	});
});

describe('lib/queries/pools', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('should fetch user pools successfully', async () => {
		const mockPools = [{ pool_id: 'pool-1', pool: { name: 'Pool One' } }];
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockPools);
		});

		const result = await fetchUserPools('user-1');
		expect(result).toEqual(mockPools);
	});

	it('should handle errors when fetching user pools', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Error fetching pools'));
		});

		const result = await fetchUserPools('user-1');
		expect(result).toEqual([]);
	});

	it('should fetch pool details and member count successfully', async () => {
		const mockPool = { id: 'pool-1', name: 'Pool One' };
		(mockSupabaseClient.from as any).mockImplementation((table: string) => {
			if (table === 'pools') {
				return new MockQueryBuilder(mockPool);
			}
			// pool_members count query
			return {
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnValue(Promise.resolve({ count: 5, error: null })),
			} as any;
		});

		const result = await fetchPoolDetails('pool-1');
		expect(result).toEqual({ ...mockPool, member_count: 5 });
	});

	it('should return null when fetch pool details errors out', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Pool not found'));
		});

		const result = await fetchPoolDetails('pool-1');
		expect(result).toBeNull();
	});

	it('should fetch pool leaderboard successfully', async () => {
		const mockLeaderboard = [{ username: 'User1', points: 10 }];
		(mockSupabaseClient.rpc as any).mockResolvedValueOnce({
			data: mockLeaderboard,
			error: null,
		});

		const result = await fetchPoolLeaderboard('pool-1');
		expect(result).toEqual(mockLeaderboard);
	});

	it('should return empty list when fetch pool leaderboard errors out', async () => {
		(mockSupabaseClient.rpc as any).mockResolvedValueOnce({
			data: null,
			error: new Error('RPC failed'),
		});

		const result = await fetchPoolLeaderboard('pool-1');
		expect(result).toEqual([]);
	});

	it('should fetch pool members successfully', async () => {
		const mockMembers = [{ user_id: 'user-1' }];
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockMembers);
		});

		const result = await fetchPoolMembers('pool-1');
		expect(result).toEqual(mockMembers);
	});

	it('should return empty list when fetch pool members errors out', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Error fetching members'));
		});

		const result = await fetchPoolMembers('pool-1');
		expect(result).toEqual([]);
	});

	it('should create pool successfully', async () => {
		const mockPool = { id: 'pool-1', name: 'My Pool' };
		// First RPC: invite code, then Insert
		(mockSupabaseClient.rpc as any).mockResolvedValueOnce({
			data: 'INV123',
			error: null,
		});
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockPool);
		});

		const result = await createPool('user-1', 'My Pool', 'Desc', true);
		expect(result).toEqual(mockPool);
	});

	it('should throw error when pool creation fails', async () => {
		(mockSupabaseClient.rpc as any).mockResolvedValueOnce({
			data: null,
			error: new Error('Code gen failed'),
		});

		await expect(createPool('user-1', 'My Pool', 'Desc', true)).rejects.toThrow(
			'Code gen failed',
		);
	});

	it('should join pool by code successfully', async () => {
		const mockResponse = { success: true, pool_id: 'pool-1' };
		(mockSupabaseClient.rpc as any).mockResolvedValueOnce({
			data: mockResponse,
			error: null,
		});

		const result = await joinPoolByCode('INV123');
		expect(result).toEqual(mockResponse);
	});

	it('should return error response when joining pool by code fails', async () => {
		(mockSupabaseClient.rpc as any).mockResolvedValueOnce({
			data: null,
			error: new Error('Invalid code'),
		});

		const result = await joinPoolByCode('INV123');
		expect(result).toEqual({ success: false, error: 'Invalid code' });
	});

	it('should leave pool successfully', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder([], null);
		});

		const result = await leavePool('pool-1', 'user-1');
		expect(result).toBe(true);
	});

	it('should return false when leaving pool fails', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Failed to delete member'));
		});

		const result = await leavePool('pool-1', 'user-1');
		expect(result).toBe(false);
	});

	it('should fetch pool picks matrix successfully', async () => {
		const mockMatches = [{ id: 'm-1', matchday: 12 }];
		const mockMembers = [{ user_id: 'u-1' }, { user_id: 'u-2' }];
		const mockPredictions = [
			{
				user_id: 'u-1',
				match_id: 'm-1',
				predicted_home_score: 2,
				predicted_away_score: 1,
			},
		];

		(mockSupabaseClient.from as any).mockImplementation((table: string) => {
			if (table === 'matches') {
				return new MockQueryBuilder(mockMatches);
			}
			if (table === 'pool_members') {
				return new MockQueryBuilder(mockMembers);
			}
			if (table === 'predictions') {
				return new MockQueryBuilder(mockPredictions);
			}
			return new MockQueryBuilder();
		});

		const result = await fetchPoolPicksMatrix('pool-1', 12);
		expect(result.matches).toEqual(mockMatches);
		expect(result.predictions['u-1']['m-1']).toBeDefined();
		expect(result.predictions['u-2']).toEqual({});
	});

	it('should handle errors in fetch pool picks matrix', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Database down'));
		});

		const result = await fetchPoolPicksMatrix('pool-1', 12);
		expect(result).toEqual({ matches: [], predictions: {} });
	});
});

describe('lib/queries/predictions', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('should fetch user predictions successfully', async () => {
		const mockPredictions = [{ id: 'pred-1', user_id: 'user-1' }];
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockPredictions);
		});

		const result = await fetchUserPredictions('user-1');
		expect(result).toEqual(mockPredictions);
	});

	it('should handle errors when fetching user predictions', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(
				null,
				new Error('Error fetching predictions'),
			);
		});

		const result = await fetchUserPredictions('user-1');
		expect(result).toEqual([]);
	});

	it('should fetch user predictions with matches successfully', async () => {
		const mockPredictions = [{ id: 'pred-1', match: { id: 'm-1' } }];
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockPredictions);
		});

		const result = await fetchUserPredictionsWithMatches('user-1');
		expect(result).toEqual(mockPredictions);
	});

	it('should handle errors when fetching user predictions with matches', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(
				null,
				new Error('Error fetching detailed predictions'),
			);
		});

		const result = await fetchUserPredictionsWithMatches('user-1');
		expect(result).toEqual([]);
	});

	it('should upsert prediction successfully', async () => {
		const mockPrediction = {
			id: 'pred-1',
			predicted_home_score: 2,
			predicted_away_score: 1,
		};
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockPrediction);
		});

		const result = await upsertPrediction('user-1', 'match-1', 2, 1);
		expect(result).toEqual(mockPrediction);
	});

	it('should throw error when upsert prediction fails', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Upsert failed'));
		});

		await expect(upsertPrediction('user-1', 'match-1', 2, 1)).rejects.toThrow(
			'Upsert failed',
		);
	});
});
