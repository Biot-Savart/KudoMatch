import { describe, expect, it } from 'vitest';
import { RugbyApiSportsAdapter } from '@/lib/sports/ingestion/adapters/rugby-api-sports';
import { computeAdaptiveNextSyncAt } from '@/lib/sports/ingestion/dispatcher';

describe('Phase 7 standings and adaptive scheduling', () => {
	it('normalizes recorded API-Sports standings rows', async () => {
		const adapter = new RugbyApiSportsAdapter({
			recordedStandings: {
				response: [{
					league: {
						name: 'Currie Cup',
						standings: [[{
							rank: 1,
							team: { id: 101, name: 'Kudo RFC' },
							points: 31,
							games: { played: 8, win: 7, draw: 0, lose: 1 },
							goals: { for: 240, against: 120, diff: 120 },
							bonus: 3,
						}], [
							{ rank: 2, team: { id: 102, name: 'Another RFC' }, points: 24, games: { played: 8 } },
						]],
					},
				}],
			},
		});
		const rows = await adapter.fetchStandings({ editionExternalKey: '796-2026', competitionExternalKey: '796' });
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ externalCompetitorKey: '101', position: 1, tablePoints: 31, pointsDifference: 120, stageKey: 'Currie Cup' });
	});

	it('uses every adaptive kickoff boundary and completed verification cadence', () => {
		const now = new Date('2026-09-03T12:00:00Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-15T12:01:00Z'), status: 'scheduled' }).toISOString()).toBe('2026-09-04T12:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-10T12:00:00Z'), status: 'scheduled' }).toISOString()).toBe('2026-09-03T18:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-03T15:00:00Z'), status: 'scheduled' }).toISOString()).toBe('2026-09-03T13:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-03T11:00:00Z'), status: 'scheduled' }).toISOString()).toBe('2026-09-03T12:20:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-03T10:00:00Z'), status: 'completed', completedAt: new Date('2026-09-03T10:00:00Z'), verificationStage: 'after_1h' }).toISOString()).toBe('2026-09-03T16:00:00.000Z');
	});
});
