import { FootballDataAdapter } from '@/lib/sports/ingestion/adapters/football-data';
import { MockSportProviderAdapter } from '@/lib/sports/ingestion/adapters/mock';
import { RugbyApiSportsAdapter } from '@/lib/sports/ingestion/adapters/rugby-api-sports';
import {
	deriveResultStatus,
	normalizeEventStatus,
} from '@/lib/sports/ingestion/normalize-status';
import { orchestrateIngestion } from '@/lib/sports/ingestion/orchestrate';
import {
	ensureCanonicalCompetition,
	ensureCanonicalCompetitors,
	ensureCanonicalEdition,
	resolveSportRulesetId,
	resolveExternalRef,
} from '@/lib/sports/ingestion/resolve-canonical';
import { withRetry, withTimeout } from '@/lib/sports/ingestion/retry';
import {
	IngestionValidationError,
	validateCompetitorDTO,
	validateEventDTO,
	validateIsoTimestamp,
} from '@/lib/sports/ingestion/validate';
import { fetchLiveScores } from '@/scripts/fetch-live-scores';

import rugbyCancelled from '@/tests/fixtures/providers/api-sports/rugby-union/cancelled-game.json';
import rugbyFinished from '@/tests/fixtures/providers/api-sports/rugby-union/finished-game.json';
import rugbyLive from '@/tests/fixtures/providers/api-sports/rugby-union/live-game.json';
import rugbyMalformed from '@/tests/fixtures/providers/api-sports/rugby-union/malformed-game.json';
import rugbyPostponed from '@/tests/fixtures/providers/api-sports/rugby-union/postponed-game.json';
import rugbyScheduled from '@/tests/fixtures/providers/api-sports/rugby-union/scheduled-game.json';
import plFixture from '@/tests/fixtures/providers/football-data/football/premier-league-matches.json';

describe('Sports Ingestion Engine (Phase 14 Review Findings)', () => {
	describe('DTO Validation and Formatting', () => {
		it('validates ISO-8601 UTC timestamp', () => {
			const valid = '2025-02-01T15:00:00.000Z';
			expect(validateIsoTimestamp(valid)).toBe(valid);
		});

		it('throws on malformed timestamp', () => {
			expect(() => validateIsoTimestamp('invalid-date')).toThrow(
				IngestionValidationError,
			);
			expect(() => validateIsoTimestamp('')).toThrow(IngestionValidationError);
		});

		it('validates valid competitor DTO', () => {
			expect(() =>
				validateCompetitorDTO({
					externalKey: '16',
					name: 'England',
				}),
			).not.toThrow();
		});

		it('throws on missing competitor name or key', () => {
			expect(() =>
				validateCompetitorDTO({ externalKey: '16', name: '' }),
			).toThrow(IngestionValidationError);
			expect(() => validateCompetitorDTO({ name: 'England' })).toThrow(
				IngestionValidationError,
			);
		});

		it('validates event DTO structure', () => {
			expect(() =>
				validateEventDTO({
					externalKey: '101',
					editionExternalKey: '11-2025',
					scheduledStartTime: '2025-02-01T15:00:00Z',
					status: 'scheduled',
					participants: [
						{ competitorExternalKey: '16', role: 'home', slotNumber: 1 },
						{ competitorExternalKey: '17', role: 'away', slotNumber: 2 },
					],
				}),
			).not.toThrow();
		});

		it('throws if event has no participants', () => {
			expect(() =>
				validateEventDTO({
					externalKey: '101',
					editionExternalKey: '11-2025',
					scheduledStartTime: '2025-02-01T15:00:00Z',
					status: 'scheduled',
					participants: [],
				}),
			).toThrow(IngestionValidationError);
		});
	});

	describe('Status Normalization', () => {
		it('maps standard provider statuses correctly', () => {
			expect(normalizeEventStatus('NS')).toBe('scheduled');
			expect(normalizeEventStatus('SCHEDULED')).toBe('scheduled');
			expect(normalizeEventStatus('1H')).toBe('live');
			expect(normalizeEventStatus('IN_PLAY')).toBe('live');
			expect(normalizeEventStatus('FT')).toBe('finished');
			expect(normalizeEventStatus('FINISHED')).toBe('finished');
			expect(normalizeEventStatus('POST')).toBe('postponed');
			expect(normalizeEventStatus('POSTPONED')).toBe('postponed');
			expect(normalizeEventStatus('CANC')).toBe('cancelled');
			expect(normalizeEventStatus('CANCELLED')).toBe('cancelled');
			expect(normalizeEventStatus('ABD')).toBe('abandoned');
			expect(normalizeEventStatus('SUSPENDED')).toBe('abandoned');
		});

		it('throws on unrecognized status for quarantine', () => {
			expect(() => normalizeEventStatus('UNKNOWN_STATUS_XYZ')).toThrow();
		});

		it('derives result status accurately (provisional vs final vs void)', () => {
			expect(deriveResultStatus('finished', true)).toBe('final');
			expect(deriveResultStatus('live', true)).toBe('provisional');
			expect(deriveResultStatus('cancelled', false)).toBe('void');
		});
	});

	describe('Retry, Backoff, and Timeout Utility', () => {
		it('resolves immediately when operation succeeds', async () => {
			const op = vi.fn().mockResolvedValue('success');
			const result = await withRetry(op);
			expect(result).toBe('success');
			expect(op).toHaveBeenCalledTimes(1);
		});

		it('retries on transient failure up to maxRetries', async () => {
			let attempts = 0;
			const op = vi.fn().mockImplementation(async () => {
				attempts++;
				if (attempts < 3) throw new Error('Transient 500 error');
				return 'recovered';
			});

			const result = await withRetry(op, {
				maxRetries: 3,
				initialDelayMs: 10,
				maxDelayMs: 50,
			});
			expect(result).toBe('recovered');
			expect(attempts).toBe(3);
		});

		it('does not retry 4xx client errors other than 429', async () => {
			const error: any = new Error('Bad Request');
			error.status = 400;
			const op = vi.fn().mockRejectedValue(error);

			await expect(withRetry(op, { maxRetries: 3 })).rejects.toThrow(
				'Bad Request',
			);
			expect(op).toHaveBeenCalledTimes(1);
		});

		it('times out if operation hangs', async () => {
			const slowOp = new Promise((resolve) => setTimeout(resolve, 500));
			await expect(withTimeout(slowOp, 50)).rejects.toThrow(
				'Operation timed out',
			);
		});
	});

	describe('Provider Adapters & Authentication Headers (Finding 1 & 2)', () => {
		it('FootballDataAdapter transforms Premier League match fixture', () => {
			const adapter = new FootballDataAdapter({
				recordedMatches: plFixture,
			});
			const events = adapter.transformMatches(plFixture.matches, '2021-2024');

			expect(events.length).toBe(3);
			expect(events[0].externalKey).toBe('497519');
			expect(events[0].status).toBe('finished');
			expect(events[0].result?.status).toBe('final');
			expect(events[0].result?.resultPayload.homeScore).toBe(1);
			expect(events[0].result?.resultPayload.awayScore).toBe(0);
			expect(events[0].result?.resultPayload.winnerRole).toBe('home');

			expect(events[1].externalKey).toBe('497520');
			expect(events[1].status).toBe('live');
			expect(events[1].result?.status).toBe('provisional');

			expect(events[2].externalKey).toBe('497521');
			expect(events[2].status).toBe('scheduled');
		});

		it('FootballDataAdapter sends requested season parameter in fetchEvents and fetchLiveUpdates', async () => {
			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ matches: [] }),
			});
			global.fetch = fetchSpy;

			const adapter = new FootballDataAdapter({
				footballDataApiKey: 'test-football-key',
			});

			await adapter.fetchEvents({
				editionExternalKey: '2021-2025',
				seasonKey: '2025',
			});

			expect(fetchSpy).toHaveBeenCalledWith(
				expect.stringContaining('/competitions/2021/matches?season=2025'),
				expect.objectContaining({
					headers: { 'X-Auth-Token': 'test-football-key' },
				}),
			);

			await adapter.fetchLiveUpdates({
				editionExternalKey: '2021-2025',
				seasonKey: '2025',
			});

			expect(fetchSpy).toHaveBeenCalledWith(
				expect.stringContaining('season=2025&status=IN_PLAY,PAUSED,FINISHED'),
				expect.anything(),
			);
		});

		it('FootballDataAdapter parses season=2025 for 2021-2025 when no explicit seasonKey is supplied', async () => {
			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ matches: [] }),
			});
			global.fetch = fetchSpy;

			const adapter = new FootballDataAdapter({
				footballDataApiKey: 'test-key',
			});

			await adapter.fetchEvents({
				editionExternalKey: '2021-2025',
			});

			expect(fetchSpy).toHaveBeenCalledWith(
				expect.stringContaining('/competitions/2021/matches?season=2025'),
				expect.anything(),
			);
		});

		it('FootballDataAdapter supports RapidAPI gateway with separate headers and host', async () => {
			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ matches: [] }),
			});
			global.fetch = fetchSpy;

			const rapidAdapter = new FootballDataAdapter({
				rapidApiKey: 'rapid-football-key-789',
				rapidApiHost: 'football-data.p.rapidapi.com',
			});

			await rapidAdapter.fetchEvents({
				editionExternalKey: '2021-2025',
				seasonKey: '2025-2026',
			});

			expect(fetchSpy).toHaveBeenCalledWith(
				'https://football-data.p.rapidapi.com/v4/competitions/2021/matches?season=2025',
				{
					headers: {
						'x-rapidapi-key': 'rapid-football-key-789',
						'x-rapidapi-host': 'football-data.p.rapidapi.com',
					},
				},
			);
		});

		it('FootballDataAdapter throws when no API key is configured', async () => {
			const unauthAdapter = new FootballDataAdapter();
			await expect(
				unauthAdapter.fetchEvents({ editionExternalKey: '2021-2025' }),
			).rejects.toThrow(/Football-Data authentication error/);
		});

		it('FootballDataAdapter throws when competitor discovery fails', async () => {
			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ teams: [] }),
			});
			global.fetch = fetchSpy;

			const adapter = new FootballDataAdapter({
				footballDataApiKey: 'test-key',
			});

			await expect(adapter.fetchCompetitors('2021-2025')).rejects.toThrow(
				/Failed to discover competitors/,
			);
		});

		it('FootballDataAdapter and RugbyApiSportsAdapter do not mark market as settled when finished match has null scores', () => {
			const footballAdapter = new FootballDataAdapter();
			const nullScoreFootballMatches = [
				{
					id: 9991,
					status: 'FINISHED',
					utcDate: '2025-08-15T19:00:00Z',
					homeTeam: { id: 1, name: 'Arsenal' },
					awayTeam: { id: 2, name: 'Chelsea' },
					score: { fullTime: { home: null, away: null } },
				},
			];
			const footballEvents = footballAdapter.transformMatches(
				nullScoreFootballMatches,
				'2021-2025',
			);
			expect(footballEvents[0].status).toBe('finished');
			expect(footballEvents[0].market?.status).toBe('open');
			expect(footballEvents[0].result).toBeUndefined();

			const rugbyAdapter = new RugbyApiSportsAdapter();
			const nullScoreRugbyGames = [
				{
					id: 8881,
					date: '2025-02-01T15:00:00Z',
					status: { short: 'FT', long: 'Finished' },
					teams: {
						home: { id: 16, name: 'England' },
						away: { id: 17, name: 'France' },
					},
					scores: { home: null, away: null },
				},
			];
			const rugbyEvents = rugbyAdapter.transformGames(
				nullScoreRugbyGames,
				'11-2025',
			);
			expect(rugbyEvents[0].status).toBe('finished');
			expect(rugbyEvents[0].market?.status).toBe('open');
			expect(rugbyEvents[0].result).toBeUndefined();
		});

		it('RugbyApiSportsAdapter supports Direct API-Sports authentication', async () => {
			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ response: [] }),
			});
			global.fetch = fetchSpy;

			const directAdapter = new RugbyApiSportsAdapter({
				apiSportsKey: 'direct-api-sports-key-123',
			});

			await directAdapter.fetchEvents({
				editionExternalKey: '11-2026',
				seasonKey: '2026',
			});

			expect(fetchSpy).toHaveBeenCalledWith(
				'https://v1.rugby.api-sports.io/games?league=11&season=2026',
				{
					headers: { 'x-apisports-key': 'direct-api-sports-key-123' },
				},
			);
		});

		it('RugbyApiSportsAdapter supports RapidAPI authentication', async () => {
			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ response: [] }),
			});
			global.fetch = fetchSpy;

			const rapidAdapter = new RugbyApiSportsAdapter({
				rapidApiKey: 'rapidapi-key-456',
				rapidApiHost: 'rugby-union.p.rapidapi.com',
			});

			await rapidAdapter.fetchEvents({
				editionExternalKey: '11-2026',
				seasonKey: '2026',
			});

			expect(fetchSpy).toHaveBeenCalledWith(
				'https://rugby-union.p.rapidapi.com/games?league=11&season=2026',
				{
					headers: {
						'x-rapidapi-key': 'rapidapi-key-456',
						'x-rapidapi-host': 'rugby-union.p.rapidapi.com',
					},
				},
			);
		});

		it('rejects provider-level errors even when the API returns HTTP 200', async () => {
			const adapter = new RugbyApiSportsAdapter({
				recordedGames: rugbyMalformed,
			});

			await expect(
				adapter.fetchEvents({ editionExternalKey: '11-2025' }),
			).rejects.toThrow(/provider error/);
		});

		it('RugbyApiSportsAdapter transforms Six Nations games fixture', () => {
			const adapter = new RugbyApiSportsAdapter();
			const finishedEvents = adapter.transformGames(
				rugbyFinished.response,
				'11-2025',
			);
			expect(finishedEvents.length).toBe(1);
			expect(finishedEvents[0].status).toBe('finished');
			expect(finishedEvents[0].result?.status).toBe('final');
			expect(finishedEvents[0].result?.resultPayload.homeScore).toBe(27);
			expect(finishedEvents[0].result?.resultPayload.awayScore).toBe(22);
			expect(finishedEvents[0].result?.resultPayload.winnerRole).toBe('home');

			const liveEvents = adapter.transformGames(rugbyLive.response, '11-2025');
			expect(liveEvents[0].status).toBe('live');
			expect(liveEvents[0].result?.status).toBe('provisional');

			const scheduledEvents = adapter.transformGames(
				rugbyScheduled.response,
				'11-2025',
			);
			expect(scheduledEvents[0].status).toBe('scheduled');

			const postponedEvents = adapter.transformGames(
				rugbyPostponed.response,
				'11-2025',
			);
			expect(postponedEvents[0].status).toBe('postponed');

			const cancelledEvents = adapter.transformGames(
				rugbyCancelled.response,
				'11-2025',
			);
			expect(cancelledEvents[0].status).toBe('cancelled');
			expect(cancelledEvents[0].market?.status).toBe('void');
		});

		it('MockSportProviderAdapter rejects execution in production', () => {
			vi.stubEnv('NODE_ENV', 'production');
			try {
				expect(() => new MockSportProviderAdapter('football')).toThrow(
					/forbidden in production/,
				);
			} finally {
				vi.unstubAllEnvs();
			}
		});
	});

	describe('Active Edition & Provider Resolution in fetchLiveScores (Finding 2 & 4)', () => {
		it('resolves active edition from database for rugby and football', async () => {
			const mockSupabase: any = {
				rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
				from: vi.fn().mockImplementation((table: string) => ({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					order: vi.fn().mockReturnThis(),
					limit: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockImplementation(async () => {
						if (table === 'external_entity_refs') {
							return { data: { external_key: '11-2026' } };
						}
						return { data: null };
					}),
					insert: vi.fn().mockReturnValue({
						select: vi.fn().mockReturnValue({
							maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1 } }),
							single: vi.fn().mockResolvedValue({ data: { id: 1 } }),
						}),
					}),
					update: vi.fn().mockReturnValue({
						eq: vi.fn().mockResolvedValue({ data: null }),
					}),
				})),
			};

			const rugbyResult = await fetchLiveScores(
				{
					sport: 'rugby-union',
					dryRun: true,
					recordedPayload: rugbyLive,
				},
				mockSupabase,
			);

			expect(rugbyResult.success).toBe(true);
			expect(rugbyResult.summary?.editionKey).toBe('11-2026');
		});

		it('honors explicit options.provider and rejects incompatible sport/provider combinations', async () => {
			const mockSupabase: any = {
				rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					order: vi.fn().mockReturnThis(),
					limit: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockResolvedValue({ data: null }),
				}),
			};

			// Incompatible sport/provider combination
			await expect(
				fetchLiveScores(
					{
						sport: 'rugby-union',
						provider: 'football-data',
						dryRun: true,
					},
					mockSupabase,
				),
			).rejects.toThrow(
				/Provider 'football-data' is incompatible with sport 'rugby-union'/,
			);

			// Valid provider option
			const mockResult = await fetchLiveScores(
				{
					sport: 'football',
					provider: 'mock-provider',
					dryRun: true,
				},
				mockSupabase,
			);
			expect(mockResult.success).toBe(true);
			expect(mockResult.summary?.providerSlug).toBe('mock-provider');
		});
	});

	describe('Quarantined Ingestion Status & Failure Handling (Review Findings)', () => {
		it('forwards seasonKey to live update adapters', async () => {
			const fetchLiveUpdates = vi.fn().mockResolvedValue([]);
			const adapter = {
				providerSlug: 'mock-provider',
				sportSlug: 'rugby-union',
				fetchCompetitions: vi.fn(),
				fetchEditions: vi.fn(),
				fetchCompetitors: vi.fn(),
				fetchEvents: vi.fn(),
				fetchLiveUpdates,
			};

			await orchestrateIngestion({
				adapter,
				supabase: {} as any,
				editionExternalKey: '11',
				seasonKey: '2025',
				dryRun: true,
			});

			expect(fetchLiveUpdates).toHaveBeenCalledWith({
				editionExternalKey: '11',
				competitionExternalKey: undefined,
				seasonKey: '2025',
			});
		});

		it('returns failed status when all events are quarantined', async () => {
			const mockSupabase: any = {
				rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
				from: vi.fn().mockImplementation((table: string) => {
					const builder: any = {
						select: vi.fn(),
						eq: vi.fn(),
						order: vi.fn(),
						limit: vi.fn(),
						maybeSingle: vi.fn().mockImplementation(async () => {
							if (table === 'external_entity_refs')
								return {
									data: {
										competition_id: 10,
										edition_id: 20,
										competitor_id: 30,
									},
								};
							if (table === 'scoring_rulesets') return { data: { id: 5 } };
							return { data: null };
						}),
						insert: vi.fn().mockReturnValue({
							select: vi.fn().mockReturnValue({
								maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1 } }),
								single: vi.fn().mockResolvedValue({ data: { id: 1 } }),
							}),
						}),
						update: vi.fn().mockReturnValue({
							eq: vi.fn().mockResolvedValue({ data: null }),
						}),
						upsert: vi.fn().mockResolvedValue({ data: null }),
					};
					builder.select.mockReturnValue(builder);
					builder.eq.mockReturnValue(builder);
					builder.order.mockReturnValue(builder);
					builder.limit.mockReturnValue(builder);
					return builder;
				}),
			};

			const malformedEventAdapter: any = {
				providerSlug: 'mock-provider',
				sportSlug: 'football',
				fetchCompetitions: vi.fn().mockResolvedValue([
					{
						externalKey: 'mock-c1',
						sportSlug: 'football',
						slug: 'mock-league',
						name: 'Mock League',
					},
				]),
				fetchEditions: vi.fn().mockResolvedValue([
					{
						externalKey: 'mock-2025',
						competitionExternalKey: 'mock-c1',
						seasonKey: '2025',
						name: 'Mock Season 2025',
					},
				]),
				fetchCompetitors: vi.fn().mockResolvedValue([
					{ externalKey: 't1', name: 'Team 1' },
					{ externalKey: 't2', name: 'Team 2' },
				]),
				fetchLiveUpdates: vi.fn().mockResolvedValue([
					{
						externalKey: 'malformed-1',
						editionExternalKey: 'mock-2025',
						scheduledStartTime: 'invalid-date',
						status: 'scheduled',
						participants: [],
					},
				]),
			};

			const res = await orchestrateIngestion({
				adapter: malformedEventAdapter,
				supabase: mockSupabase,
				editionExternalKey: 'mock-2025',
			});

			if (res.summary.errors.length > 0) {
				console.log(
					'TEST DEBUG ERRORS:',
					JSON.stringify(res.summary.errors, null, 2),
				);
			}
			expect(res.status).toBe('failed');
			expect(res.summary.quarantinedCount).toBe(1);
			expect(res.summary.insertedCount).toBe(0);
		});

		it('returns partial_failure when there is a mixture of valid and quarantined events', async () => {
			const mockSupabase: any = {
				rpc: vi.fn().mockImplementation((fnName) => {
					if (fnName === 'apply_canonical_ingestion_batch') {
						return Promise.resolve({
							data: {
								success: true,
								inserted_events: 1,
								updated_events: 0,
								unchanged_events: 0,
								settled_results: 0,
							},
							error: null,
						});
					}
					return Promise.resolve({ data: true, error: null });
				}),
				from: vi.fn().mockImplementation((table: string) => {
					const builder: any = {
						select: vi.fn(),
						eq: vi.fn(),
						order: vi.fn(),
						limit: vi.fn(),
						maybeSingle: vi.fn().mockImplementation(async () => {
							if (table === 'external_entity_refs')
								return {
									data: {
										competition_id: 10,
										edition_id: 20,
										competitor_id: 30,
									},
								};
							if (table === 'scoring_rulesets') return { data: { id: 5 } };
							return { data: null };
						}),
						insert: vi.fn().mockReturnValue({
							select: vi.fn().mockReturnValue({
								maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1 } }),
								single: vi.fn().mockResolvedValue({ data: { id: 1 } }),
							}),
						}),
						update: vi.fn().mockReturnValue({
							eq: vi.fn().mockResolvedValue({ data: null }),
						}),
						upsert: vi.fn().mockResolvedValue({ data: null }),
					};
					builder.select.mockReturnValue(builder);
					builder.eq.mockReturnValue(builder);
					builder.order.mockReturnValue(builder);
					builder.limit.mockReturnValue(builder);
					return builder;
				}),
			};

			const mixedAdapter: any = {
				providerSlug: 'mock-provider',
				sportSlug: 'football',
				fetchCompetitions: vi.fn().mockResolvedValue([
					{
						externalKey: 'mock-c1',
						sportSlug: 'football',
						slug: 'mock-league',
						name: 'Mock League',
					},
				]),
				fetchEditions: vi.fn().mockResolvedValue([
					{
						externalKey: 'mock-2025',
						competitionExternalKey: 'mock-c1',
						seasonKey: '2025',
						name: 'Mock Season 2025',
					},
				]),
				fetchCompetitors: vi.fn().mockResolvedValue([
					{ externalKey: 't1', name: 'Team 1' },
					{ externalKey: 't2', name: 'Team 2' },
				]),
				fetchLiveUpdates: vi.fn().mockResolvedValue([
					// 1 Valid event
					{
						externalKey: 'valid-1',
						editionExternalKey: 'mock-2025',
						scheduledStartTime: '2025-08-15T15:00:00Z',
						status: 'scheduled',
						participants: [
							{ competitorExternalKey: 't1', role: 'home', slotNumber: 1 },
							{ competitorExternalKey: 't2', role: 'away', slotNumber: 2 },
						],
					},
					// 1 Malformed event (missing participants)
					{
						externalKey: 'malformed-2',
						editionExternalKey: 'mock-2025',
						scheduledStartTime: '2025-08-15T15:00:00Z',
						status: 'scheduled',
						participants: [],
					},
				]),
			};

			const res = await orchestrateIngestion({
				adapter: mixedAdapter,
				supabase: mockSupabase,
				editionExternalKey: 'mock-2025',
			});

			expect(res.status).toBe('partial_failure');
			expect(res.summary.insertedCount).toBe(1);
			expect(res.summary.quarantinedCount).toBe(1);
		});

		it('throws error when competitor external_entity_refs upsert fails', async () => {
			const mockSupabase: any = {
				from: vi.fn().mockImplementation((table: string) => ({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockResolvedValue({ data: null }),
					insert: vi.fn().mockReturnValue({
						select: vi.fn().mockReturnValue({
							single: vi
								.fn()
								.mockResolvedValue({ data: { id: 101 }, error: null }),
						}),
					}),
					upsert: vi.fn().mockImplementation(() => {
						if (table === 'external_entity_refs') {
							return Promise.resolve({
								data: null,
								error: { message: 'Database disk full' },
							});
						}
						return Promise.resolve({ data: null, error: null });
					}),
				})),
			};

			const adapter = new RugbyApiSportsAdapter();
			await expect(
				ensureCanonicalCompetitors(mockSupabase, adapter, 11, '11-2025', '11'),
			).rejects.toThrow(/Failed to persist external reference for competitor/);
		});

		it('fails external reference resolution on database errors', async () => {
			const query = {
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnThis(),
				maybeSingle: vi.fn().mockResolvedValue({
					data: null,
					error: { message: 'connection refused' },
				}),
			};
			const supabase: any = { from: vi.fn().mockReturnValue(query) };

			await expect(
				resolveExternalRef(supabase, 'api-sports', 'competitor', '16'),
			).rejects.toThrow(/Failed to resolve external ref/);
		});
	});

	describe('Lease Management & Error Differentiation (Finding 1)', () => {
		it('returns already_running when active lease exists (data = false, error = null)', async () => {
			const mockSupabase: any = {
				rpc: vi.fn().mockImplementation((fnName) => {
					if (fnName === 'acquire_ingestion_lease') {
						return Promise.resolve({ data: false, error: null });
					}
					return Promise.resolve({ data: true, error: null });
				}),
				from: vi.fn().mockReturnValue({
					insert: vi.fn().mockReturnThis(),
					select: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockResolvedValue({ data: null }),
				}),
			};

			const adapter = new MockSportProviderAdapter('football');
			const res = await orchestrateIngestion({
				adapter,
				supabase: mockSupabase,
				editionExternalKey: 'mock-2025',
			});

			expect(res.status).toBe('already_running');
		});

		it('throws error on database/RPC error instead of returning already_running', async () => {
			const mockSupabase: any = {
				rpc: vi.fn().mockImplementation((fnName) => {
					if (fnName === 'acquire_ingestion_lease') {
						return Promise.resolve({
							data: null,
							error: {
								message: 'relation ingestion_run_leases does not exist',
							},
						});
					}
					return Promise.resolve({ data: true, error: null });
				}),
			};

			const adapter = new MockSportProviderAdapter('football');
			await expect(
				orchestrateIngestion({
					adapter,
					supabase: mockSupabase,
					editionExternalKey: 'mock-2025',
				}),
			).rejects.toThrow(/Database error acquiring ingestion lease/);
		});
	});

	describe('Catalog Resolution, Seed Alignment & Key Validation (Finding 1 & 3)', () => {
		it('proves the seeded active football edition (2025-2026) is reused without creating a duplicate', async () => {
			let insertedCount = 0;
			const mockSupabase: any = {
				from: vi.fn().mockImplementation((table: string) => ({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					order: vi.fn().mockReturnThis(),
					limit: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockImplementation(async () => {
						if (table === 'external_entity_refs') return { data: null };
						if (table === 'competition_editions') {
							// Seeded active edition exists with id 99
							return { data: { id: 99, season_key: '2025-2026' } };
						}
						return { data: null };
					}),
					insert: vi.fn().mockImplementation(() => {
						insertedCount++;
						return {
							select: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue({ data: { id: 100 } }),
							}),
						};
					}),
					upsert: vi.fn().mockResolvedValue({ data: null }),
				})),
			};

			const adapter = new FootballDataAdapter({ recordedMatches: plFixture });

			const editionId = await ensureCanonicalEdition(
				mockSupabase,
				adapter,
				1, // Premier League competition ID
				'2021-2025',
			);

			// Expect the seeded edition id (99) to be reused
			expect(editionId).toBe(99);
			// Expect insert on competition_editions not to have been called
			expect(insertedCount).toBe(0);
		});

		it('throws error when explicit invalid competition key is supplied', async () => {
			const mockSupabase: any = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockResolvedValue({ data: null }),
				}),
			};

			const adapter = new RugbyApiSportsAdapter();
			await expect(
				ensureCanonicalCompetition(
					mockSupabase,
					adapter,
					'non-existent-competition-99999',
				),
			).rejects.toThrow(/Invalid competition external key/);
		});

		it('throws error when explicit invalid edition key is supplied and rejects fuzzy matches like 999-2025', async () => {
			const mockSupabase: any = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockResolvedValue({ data: null }),
				}),
			};

			const adapter = new RugbyApiSportsAdapter();
			// Explicit key that does not match provider editions (11-2025, 11-2026)
			await expect(
				ensureCanonicalEdition(mockSupabase, adapter, 11, '999-2025', '11'),
			).rejects.toThrow(/Invalid edition external key/);
		});

		it('throws error when explicit unknown season key is supplied', async () => {
			const mockSupabase: any = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockResolvedValue({ data: null }),
				}),
			};

			const adapter = new RugbyApiSportsAdapter();
			await expect(
				ensureCanonicalEdition(
					mockSupabase,
					adapter,
					11,
					undefined,
					'11',
					'unknown-season-9999',
				),
			).rejects.toThrow(/Invalid season key/);
		});

		it('throws error and halts ingestion when competitor insertion fails', async () => {
			const mockSupabase: any = {
				from: vi.fn().mockImplementation((table: string) => ({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockResolvedValue({ data: null }),
					insert: vi.fn().mockReturnValue({
						select: vi.fn().mockReturnValue({
							single: vi.fn().mockResolvedValue({
								data: null,
								error: { message: 'Unique violation on competitor' },
							}),
						}),
					}),
				})),
			};

			const adapter = new RugbyApiSportsAdapter();
			await expect(
				ensureCanonicalCompetitors(mockSupabase, adapter, 11, '11-2025', '11'),
			).rejects.toThrow(/Failed to resolve or insert competitor/);
		});

		it('fetches or creates competition, edition, competitors, and links them on fresh ingestion', async () => {
			const storedData: {
				competitions: any[];
				editions: any[];
				competitors: any[];
				editionCompetitors: any[];
				externalRefs: any[];
			} = {
				competitions: [],
				editions: [],
				competitors: [],
				editionCompetitors: [],
				externalRefs: [],
			};

			let idCounter = 100;
			const mockSupabase: any = {
				from: vi.fn().mockImplementation((table: string) => ({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					order: vi.fn().mockReturnThis(),
					limit: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockImplementation(async () => {
						if (table === 'external_entity_refs') return { data: null };
						if (table === 'competitions') return { data: null };
						if (table === 'competition_editions') return { data: null };
						if (table === 'scoring_rulesets') return { data: { id: 42 } };
						return { data: null };
					}),
					insert: vi.fn().mockImplementation((payload: any) => ({
						select: vi.fn().mockReturnValue({
							single: vi.fn().mockImplementation(async () => {
								idCounter++;
								const id = idCounter;
								if (table === 'competitions') {
									storedData.competitions.push({ id, ...payload });
								} else if (table === 'competition_editions') {
									storedData.editions.push({ id, ...payload });
								} else if (table === 'competitors') {
									storedData.competitors.push({ id, ...payload });
								}
								return { data: { id }, error: null };
							}),
						}),
					})),
					upsert: vi.fn().mockImplementation((payload: any) => {
						if (table === 'external_entity_refs') {
							storedData.externalRefs.push(payload);
						} else if (table === 'edition_competitors') {
							storedData.editionCompetitors.push(payload);
						}
						return Promise.resolve({ data: payload, error: null });
					}),
				})),
			};

			const adapter = new RugbyApiSportsAdapter();

			// 1. Competition creation
			const compId = await ensureCanonicalCompetition(
				mockSupabase,
				adapter,
				'11',
			);
			expect(compId).toBeGreaterThan(0);

			// 2. Edition creation
			const editionId = await ensureCanonicalEdition(
				mockSupabase,
				adapter,
				compId,
				'11-2025',
				'11',
				'2025',
			);
			expect(editionId).toBeGreaterThan(0);

			// 3. Competitor creation and linking
			const compMap = await ensureCanonicalCompetitors(
				mockSupabase,
				adapter,
				editionId,
				'11-2025',
				'11',
			);
			expect(compMap.size).toBe(6);
			expect(compMap.get('16')).toBeDefined(); // England
			expect(compMap.get('17')).toBeDefined(); // France

			// Check edition_competitors linking
			expect(storedData.editionCompetitors.length).toBe(6);
			expect(
				storedData.editionCompetitors.every(
					(ec) => ec.edition_id === editionId,
				),
			).toBe(true);
		});

		it('throws when scoring ruleset cannot be found', async () => {
			const mockSupabase: any = {
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					order: vi.fn().mockReturnThis(),
					limit: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockResolvedValue({ data: null }),
				}),
			};

			await expect(
				resolveSportRulesetId(mockSupabase, 'cricket'),
			).rejects.toThrow(/Active scoring ruleset not found/);
		});
	});

	describe('Canonical Schema Alignment & Batch RPC (Finding 2 & 4)', () => {
		it('executes batch RPC with canonical schema fields (round_label, starts_at, venue_name, slot, locks_at)', async () => {
			let capturedBatch: any = null;

			const mockSupabase: any = {
				rpc: vi.fn().mockImplementation((fnName, params) => {
					if (fnName === 'acquire_ingestion_lease') {
						return Promise.resolve({ data: true, error: null });
					}
					if (fnName === 'release_ingestion_lease') {
						return Promise.resolve({ data: true, error: null });
					}
					if (fnName === 'apply_canonical_ingestion_batch') {
						capturedBatch = params.p_batch;
						return Promise.resolve({
							data: {
								success: true,
								inserted_events: 1,
								updated_events: 0,
								unchanged_events: 0,
								settled_results: 1,
							},
							error: null,
						});
					}
					return Promise.resolve({ data: null, error: null });
				}),
				from: vi.fn().mockImplementation((table: string) => ({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					order: vi.fn().mockReturnThis(),
					limit: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockImplementation(async () => {
						if (table === 'external_entity_refs')
							return {
								data: { competition_id: 10, edition_id: 20, competitor_id: 30 },
							};
						if (table === 'competitions') return { data: { id: 10 } };
						if (table === 'competition_editions') return { data: { id: 20 } };
						if (table === 'scoring_rulesets') return { data: { id: 5 } };
						return { data: null };
					}),
					insert: vi.fn().mockReturnValue({
						select: vi.fn().mockReturnValue({
							maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1 } }),
							single: vi.fn().mockResolvedValue({ data: { id: 1 } }),
						}),
					}),
					update: vi.fn().mockReturnValue({
						eq: vi.fn().mockResolvedValue({ data: null }),
					}),
					upsert: vi.fn().mockResolvedValue({ data: null }),
				})),
			};

			const adapter = new RugbyApiSportsAdapter({
				recordedGames: rugbyFinished,
			});

			const result = await orchestrateIngestion({
				adapter,
				supabase: mockSupabase,
				editionExternalKey: '11-2025',
				competitionExternalKey: '11',
				operation: 'sync_live',
			});

			expect(result.status).toBe('success');
			expect(capturedBatch).toBeDefined();
			expect(capturedBatch.events.length).toBe(1);

			const event = capturedBatch.events[0];
			// Check canonical schema fields
			expect(event.round_label).toBe('Round 1');
			expect(event.starts_at).toBeDefined();
			expect(event.edition_id).toBe(20); // Real resolved edition ID!

			// Check participants slot
			expect(event.participants[0].slot).toBe(1);
			expect(event.participants[1].slot).toBe(2);

			// Check market & final result
			expect(event.market.market_kind).toBe('team_scoreline');
			expect(event.market.locks_at).toBeDefined();
			expect(event.result.status).toBe('final');
			expect(event.result.result_payload.homeScore).toBe(27);
			expect(event.result.result_payload.awayScore).toBe(22);
		});
	});
});
