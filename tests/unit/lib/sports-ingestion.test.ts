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
				apiKey: 'test-football-key',
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

	describe('Active Edition Resolution in fetchLiveScores (Finding 2)', () => {
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

	describe('Catalog Resolution & Dependency Order (Finding 3)', () => {
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
