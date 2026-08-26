import { FootballDataAdapter } from '@/lib/sports/ingestion/adapters/football-data';
import { MockSportProviderAdapter } from '@/lib/sports/ingestion/adapters/mock';
import { RugbyApiSportsAdapter } from '@/lib/sports/ingestion/adapters/rugby-api-sports';
import {
	deriveResultStatus,
	normalizeEventStatus,
} from '@/lib/sports/ingestion/normalize-status';
import { orchestrateIngestion } from '@/lib/sports/ingestion/orchestrate';
import { withRetry, withTimeout } from '@/lib/sports/ingestion/retry';
import {
	IngestionValidationError,
	validateCompetitorDTO,
	validateEventDTO,
	validateIsoTimestamp,
} from '@/lib/sports/ingestion/validate';

import rugbyCancelled from '@/tests/fixtures/providers/api-sports/rugby-union/cancelled-game.json';
import rugbyFinished from '@/tests/fixtures/providers/api-sports/rugby-union/finished-game.json';
import rugbyLive from '@/tests/fixtures/providers/api-sports/rugby-union/live-game.json';
import rugbyPostponed from '@/tests/fixtures/providers/api-sports/rugby-union/postponed-game.json';
import rugbyScheduled from '@/tests/fixtures/providers/api-sports/rugby-union/scheduled-game.json';
import plFixture from '@/tests/fixtures/providers/football-data/football/premier-league-matches.json';

describe('Sports Ingestion Engine (Phase 14)', () => {
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

		it('derives result status accurately', () => {
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

	describe('Provider Adapters Contract', () => {
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

	describe('Orchestrator Execution and Lease Management', () => {
		it('returns already_running if lease cannot be acquired', async () => {
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

		it('executes dry-run without database mutations', async () => {
			const mockSupabase: any = {
				rpc: vi.fn(),
				from: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					order: vi.fn().mockReturnThis(),
					limit: vi.fn().mockReturnThis(),
					maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1 } }),
				}),
			};

			const adapter = new MockSportProviderAdapter('football');
			const res = await orchestrateIngestion({
				adapter,
				supabase: mockSupabase,
				editionExternalKey: 'mock-2025',
				dryRun: true,
			});

			expect(res.status).toBe('success');
			expect(res.summary.fetchedCount).toBeGreaterThan(0);
			expect(mockSupabase.rpc).not.toHaveBeenCalledWith(
				'apply_canonical_ingestion_batch',
				expect.anything(),
			);
		});
	});
});
