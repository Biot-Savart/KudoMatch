import { describe, expect, it } from 'vitest';
import { parseTeamScorelineUiConfig } from '@/lib/sports/scoreline-config';

describe('team scoreline UI contract', () => {
	it('accepts rugby increments and limits', () => {
		const config = parseTeamScorelineUiConfig({
			renderer_key: 'rugby-union-scoreline-v1', score_unit: 'points',
			limits: { home: [0, 100], away: [0, 100] }, increments: [1, 3, 5, 7],
		});
		expect(config?.increments).toEqual([1, 3, 5, 7]);
	});

	it('fails closed for missing renderer configuration', () => {
		expect(parseTeamScorelineUiConfig({ score_min: 0, score_max: 99 })).toBeNull();
	});
});

