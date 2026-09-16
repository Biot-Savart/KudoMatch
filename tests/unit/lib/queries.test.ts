vi.mock('@/lib/supabase/client', () => ({
	createClient: vi.fn(() => (globalThis as any).mockSupabaseClient),
}));

import {
	fetchActiveCompetitionEditions,
	fetchActiveCompetitions,
	fetchEditionRounds,
} from '@/lib/queries/competitions';
import { fetchEventById, fetchEvents } from '@/lib/queries/events';
import {
	fetchMarketCommunityStats,
	fetchMarketParticipantPicks,
} from '@/lib/queries/markets';
import {
	createPool,
	fetchPoolById,
	fetchPoolLeaderboard,
	fetchPoolPicksMatrix,
	fetchUserPools,
	leavePool,
} from '@/lib/queries/pools';
import {
	fetchUserPredictions,
	submitPrediction,
} from '@/lib/queries/predictions';
import { fetchUserScoreSummary } from '@/lib/queries/scoring';
import { fetchActiveSports } from '@/lib/queries/sports';

const { mockSupabaseClient, MockQueryBuilder } = globalThis as any;

describe('lib/queries modular unit tests', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	describe('lib/queries/sports', () => {
		it('should fetch active sports', async () => {
			const mockSports = [
				{
					slug: 'football',
					name: 'Football',
					icon_key: 'football',
					default_score_unit: 'goals',
					is_active: true,
					display_order: 1,
					created_at: '',
					updated_at: '',
				},
			];
			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockSports);
			});

			const sports = await fetchActiveSports();
			expect(sports).toHaveLength(1);
			expect(sports[0].slug).toBe('football');
		});
	});

	describe('lib/queries/competitions', () => {
		it('should fetch active competitions', async () => {
			const mockComps = [
				{
					id: 1,
					sport_slug: 'football',
					slug: 'premier-league',
					name: 'Premier League',
					kind: 'league',
					country: 'England',
					logo_url: null,
					is_active: true,
					created_at: '',
					updated_at: '',
				},
			];
			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockComps);
			});

			const comps = await fetchActiveCompetitions('football');
			expect(comps).toHaveLength(1);
			expect(comps[0].id).toBe('1');
			expect(comps[0].name).toBe('Premier League');
		});

		it('should fetch active competition editions', async () => {
			const mockEds = [
				{
					id: 10,
					competition_id: 1,
					season_key: '2025-2026',
					name: 'Premier League 2025/26',
					starts_at: '2026-08-01T00:00:00Z',
					ends_at: '2026-05-30T00:00:00Z',
					status: 'active',
					metadata: {},
					created_at: '',
					updated_at: '',
				},
			];
			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockEds);
			});

			const eds = await fetchActiveCompetitionEditions();
			expect(eds).toHaveLength(1);
			expect(eds[0].id).toBe('10');
			expect(eds[0].season_key).toBe('2025-2026');
		});

		it('should fetch distinct edition rounds', async () => {
			const mockEvents = [
				{ round_label: 'Round 12' },
				{ round_label: 'Round 13' },
				{ round_label: 'Round 12' },
				{ round_label: null },
			];
			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockEvents);
			});

			const rounds = await fetchEditionRounds('10');
			expect(rounds).toEqual(['Round 12', 'Round 13', 'Previous rounds']);
		});
	});

	describe('lib/queries/events', () => {
		it('should fetch events with competitors and markets', async () => {
			const mockRawEvents = [
				{
					id: 100,
					edition_id: 10,
					kind: 'match',
					starts_at: '2026-08-25T15:00:00Z',
					status: 'scheduled',
					round_label: 'Round 12',
					sequence_number: 1,
					event_competitors: [
						{
							slot: 1,
							role: 'home',
							competitors: { id: 1, name: 'Arsenal', short_name: 'ARS' },
						},
						{
							slot: 2,
							role: 'away',
							competitors: { id: 2, name: 'Chelsea', short_name: 'CHE' },
						},
					],
					event_markets: [
						{
							id: 500,
							market_kind: 'team_scoreline',
							is_current: true,
							status: 'open',
							locks_at: '2026-08-25T15:00:00Z',
						},
					],
				},
			];

			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockRawEvents);
			});

			const events = await fetchEvents({ editionId: '10' });
			expect(events).toHaveLength(1);
			expect(events[0].id).toBe('100');
			expect(events[0].competitors).toHaveLength(2);
			expect(events[0].current_market?.id).toBe('500');
		});

		it('should fetch event by ID', async () => {
			const mockEvent = {
				id: 100,
				edition_id: 10,
				kind: 'match',
				starts_at: '2026-08-25T15:00:00Z',
				status: 'scheduled',
				round_label: 'Round 12',
				event_competitors: [],
				event_markets: [],
			};

			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockEvent);
			});

			const ev = await fetchEventById('100');
			expect(ev).not.toBeNull();
			expect(ev?.id).toBe('100');
		});
	});

	describe('lib/queries/markets', () => {
		it('should fetch market community stats via RPC', async () => {
			const mockStats = [
				{
					total_predictions: 25,
					avg_home_score: 2.1,
					avg_away_score: 1.2,
					home_win_pct: 60,
					draw_pct: 20,
					away_win_pct: 20,
					top_exact_scores: [{ home: 2, away: 1, count: 10, pct: 40 }],
				},
			];

			vi.spyOn(mockSupabaseClient, 'rpc').mockResolvedValueOnce({
				data: mockStats,
				error: null,
			});

			const stats = await fetchMarketCommunityStats('500');
			expect(stats.total_predictions).toBe(25);
			expect(stats.home_win_pct).toBe(60);
			expect(stats.top_exact_scores).toHaveLength(1);
		});

		it('should fetch market participant picks', async () => {
			const mockPicks = [
				{
					user_id: 'u1',
					selection: { home: 2, away: 1 },
					tier_code: 'exact_score',
					raw_points: 3,
					profiles: { id: 'u1', full_name: 'Alice' },
				},
			];

			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockPicks);
			});

			const picks = await fetchMarketParticipantPicks('500');
			expect(picks).toHaveLength(1);
			expect(picks[0].full_name).toBe('Alice');
			expect(picks[0].home).toBe(2);
			expect(picks[0].tier_code).toBe('exact_score');
		});
	});

	describe('lib/queries/predictions', () => {
		it('should fetch user predictions', async () => {
			const mockPreds = [
				{
					id: 1,
					user_id: 'u1',
					event_market_id: 500,
					selection: { kind: 'team_scoreline', version: 1, home: 2, away: 1 },
					settlement_status: 'settled',
					raw_points: 3,
					tier_code: 'exact_score',
					created_at: '2026-08-25T12:00:00Z',
				},
			];

			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockPreds);
			});

			const preds = await fetchUserPredictions('u1');
			expect(preds).toHaveLength(1);
			expect(preds[0].id).toBe('1');
			expect(preds[0].raw_points).toBe(3);
		});

		it('should submit prediction successfully', async () => {
			const mockSaved = {
				id: 1,
				user_id: 'u1',
				event_market_id: 500,
				selection: { kind: 'team_scoreline', version: 1, home: 2, away: 1 },
				settlement_status: 'pending',
				created_at: '2026-08-25T12:00:00Z',
				updated_at: '2026-08-25T12:00:00Z',
			};

			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockSaved);
			});

			const result = await submitPrediction('u1', '500', {
				kind: 'team_scoreline',
				version: 1,
				home: 2,
				away: 1,
			});

			expect(result.id).toBe('1');
			expect(result.event_market_id).toBe('500');
		});
	});

	describe('lib/queries/scoring', () => {
		it('should fetch user score summary via RPC', async () => {
			const mockSummary = [
				{
					total_raw_points: 15,
					total_normalized_points: 50000,
					total_predictions: 10,
					settled_predictions: 8,
					exact_count: 3,
					margin_count: 2,
					outcome_count: 2,
					miss_count: 1,
					win_rate: 87.5,
				},
			];

			vi.spyOn(mockSupabaseClient, 'rpc').mockResolvedValueOnce({
				data: mockSummary,
				error: null,
			});

			const summary = await fetchUserScoreSummary('u1');
			expect(summary.total_raw_points).toBe(15);
			expect(summary.exact_count).toBe(3);
			expect(summary.win_rate).toBe(87.5);
		});
	});

	describe('lib/queries/pools', () => {
		it('should fetch user pools', async () => {
			const mockUserPools = [
				{
					pool_id: 'p1',
					role: 'admin',
					joined_at: '2026-08-20T00:00:00Z',
					pools: {
						id: 'p1',
						name: 'Champions Pool',
						invite_code: 'CHAMP1',
						scope_kind: 'sport',
						sport_slug: 'football',
						scoring_mode: 'raw',
						is_private: true,
					},
				},
			];

			vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
				return new MockQueryBuilder(mockUserPools);
			});

			const pools = await fetchUserPools('u1');
			expect(pools).toHaveLength(1);
			expect(pools[0].id).toBe('p1');
			expect(pools[0].name).toBe('Champions Pool');
		});

		it('should fetch pool by id preserving member_count, members_count, and creator', async () => {
			const mockPool = {
				id: 'p1',
				name: 'Premier League Legends',
				created_by: 'u1',
				scope_kind: 'sport',
				sport_slug: 'football',
				creator: {
					id: 'u1',
					full_name: 'Pool Admin',
					avatar_url: 'https://avatar.url',
				},
			};

			(mockSupabaseClient.from as any)
				.mockImplementationOnce(() => new MockQueryBuilder(mockPool))
				.mockImplementationOnce(
					() => new MockQueryBuilder([], null, { count: 8 }),
				);

			const pool = await fetchPoolById('p1');
			expect(pool).toBeDefined();
			expect(pool?.id).toBe('p1');
			expect(pool?.member_count).toBe(8);
			expect(pool?.members_count).toBe(8);
			expect(pool?.creator?.full_name).toBe('Pool Admin');
		});

		it('should create pool and assign admin membership via create_pool RPC', async () => {
			const mockPool = {
				id: 'p-new',
				name: 'Premier League Legends',
				created_by: 'u1',
				invite_code: 'PL2026',
				scope_kind: 'sport',
				sport_slug: 'football',
				scoring_mode: 'raw',
				is_private: true,
			};

			let rpcArgs: any = null;
			vi.spyOn(mockSupabaseClient, 'rpc').mockImplementationOnce(((
				fn: string,
				args: any,
			) => {
				rpcArgs = { fn, args };
				return Promise.resolve({ data: 'p-new', error: null });
			}) as any);

			(mockSupabaseClient.from as any).mockImplementationOnce(
				() => new MockQueryBuilder(mockPool),
			);

			const created = await createPool({
				name: 'Premier League Legends',
				user_id: 'u1',
				scope_kind: 'sport',
				sport_slug: 'football',
			});

			expect(created.id).toBe('p-new');
			expect(rpcArgs).toBeDefined();
			expect(rpcArgs.fn).toBe('create_pool');
			expect(rpcArgs.args.p_name).toBe('Premier League Legends');
			expect(rpcArgs.args.p_scope_kind).toBe('sport');
			expect(rpcArgs.args.p_sport_slug).toBe('football');
		});

		it('should force normalized scoring_mode for all_sports pools even if omitted', async () => {
			const mockPool = {
				id: 'p-all-sports',
				name: 'All Sports World Championship',
				created_by: 'u1',
				invite_code: 'AS2026',
				scope_kind: 'all_sports',
				scoring_mode: 'normalized',
				is_private: true,
			};

			let rpcArgs: any = null;
			vi.spyOn(mockSupabaseClient, 'rpc').mockImplementationOnce(((
				fn: string,
				args: any,
			) => {
				rpcArgs = { fn, args };
				return Promise.resolve({ data: 'p-all-sports', error: null });
			}) as any);

			(mockSupabaseClient.from as any).mockImplementationOnce(
				() => new MockQueryBuilder(mockPool),
			);

			const created = await createPool({
				name: 'All Sports World Championship',
				user_id: 'u1',
				scope_kind: 'all_sports',
			});

			expect(rpcArgs).toBeDefined();
			expect(rpcArgs.args.p_scoring_mode).toBe('normalized');
			expect(created.scoring_mode).toBe('normalized');
		});

		it('should throw error when create_pool RPC fails', async () => {
			vi.spyOn(mockSupabaseClient, 'rpc').mockResolvedValueOnce({
				data: null,
				error: { message: 'Database RPC failed' } as any,
			});

			await expect(
				createPool({
					name: 'Orphan Pool',
					user_id: 'u1',
					scope_kind: 'sport',
					sport_slug: 'football',
				}),
			).rejects.toThrow(/Database RPC failed/);
		});

		it('should leave pool via leave_pool RPC', async () => {
			let rpcArgs: any = null;
			vi.spyOn(mockSupabaseClient, 'rpc').mockImplementationOnce(((
				fn: string,
				args: any,
			) => {
				rpcArgs = { fn, args };
				return Promise.resolve({ data: true, error: null });
			}) as any);

			await leavePool('p1', 'u1');
			expect(rpcArgs).toBeDefined();
			expect(rpcArgs.fn).toBe('leave_pool');
			expect(rpcArgs.args.p_pool_id).toBe('p1');
		});

		it('should fetch pool leaderboard via RPC', async () => {
			const mockBoard = [
				{
					rank: 1,
					user_id: 'u1',
					full_name: 'Alice',
					total_points: 12,
					exact_count: 2,
					margin_count: 1,
					outcome_count: 2,
					predictions_count: 5,
				},
			];

			vi.spyOn(mockSupabaseClient, 'rpc').mockResolvedValueOnce({
				data: mockBoard,
				error: null,
			});

			const board = await fetchPoolLeaderboard('p1');
			expect(board).toHaveLength(1);
			expect(board[0].rank).toBe(1);
			expect(board[0].total_points).toBe(12);
		});

		it('should fetch pool picks matrix applying all pool scopes (edition, competition, sport, all_sports)', async () => {
			const scopes: Array<{
				scope_kind: any;
				sport_slug?: string;
				competition_id?: number;
				edition_id?: number;
			}> = [
				{ scope_kind: 'all_sports' },
				{ scope_kind: 'sport', sport_slug: 'rugby-union' },
				{ scope_kind: 'competition', competition_id: 2021 },
				{ scope_kind: 'edition', edition_id: 10 },
			];

			for (const scope of scopes) {
				const mockPool = {
					id: 'p1',
					name: 'Test Pool',
					...scope,
				};
				const mockMembers = [{ user_id: 'u1' }];
				const mockEvents = [
					{
						id: 101,
						round_label: 'Gameweek 1',
						event_markets: [{ id: 501, status: 'open' }],
					},
				];
				const mockPredictions = [
					{
						id: 1,
						user_id: 'u1',
						event_market_id: 501,
						selection: { home: '2', away: '1' },
					},
				];

				(mockSupabaseClient.from as any)
					.mockImplementationOnce(() => new MockQueryBuilder(mockPool))
					.mockImplementationOnce(() => new MockQueryBuilder(mockMembers))
					.mockImplementationOnce(() => new MockQueryBuilder(mockEvents))
					.mockImplementationOnce(() => new MockQueryBuilder(mockPredictions));

				const matrix = await fetchPoolPicksMatrix('p1', 1);
				expect(matrix.matches).toHaveLength(1);
				expect(matrix.predictions['u1_101']).toBeDefined();
			}
		});
	});
});
