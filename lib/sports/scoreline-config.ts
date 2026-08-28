import {
	ScoringRulesetUiConfig,
	TeamScorelineUiConfig,
} from '@/types';

const RENDERERS = new Set([
	'football-scoreline-v1',
	'rugby-union-scoreline-v1',
]);

export type ScorelineRendererKey = 'football-scoreline-v1' | 'rugby-union-scoreline-v1';
export interface ScorelineRenderer {
	key: ScorelineRendererKey;
	label: string;
	scoreUnit: string;
}

export const scorelineRendererRegistry: Record<ScorelineRendererKey, ScorelineRenderer> = {
	'football-scoreline-v1': { key: 'football-scoreline-v1', label: 'Football scoreline', scoreUnit: 'goals' },
	'rugby-union-scoreline-v1': { key: 'rugby-union-scoreline-v1', label: 'Rugby Union scoreline', scoreUnit: 'points' },
};

function isFiniteInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function isLimitPair(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		isFiniteInteger(value[0]) &&
		isFiniteInteger(value[1]) &&
		value[0] >= 0 &&
		value[1] >= value[0]
	);
}

/**
 * Validates the JSON UI contract stored on an immutable scoring ruleset.
 * Invalid configuration is deliberately rejected instead of defaulting to
 * football controls for another sport.
 */
export function parseTeamScorelineUiConfig(
	raw: unknown,
): TeamScorelineUiConfig | null {
	if (!raw || typeof raw !== 'object') return null;
	const config = raw as ScoringRulesetUiConfig;
	if (
		typeof config.renderer_key !== 'string' ||
		!RENDERERS.has(config.renderer_key) ||
		typeof config.score_unit !== 'string' ||
		!config.limits ||
		!isLimitPair(config.limits.home) ||
		!isLimitPair(config.limits.away) ||
		!Array.isArray(config.increments) ||
		config.increments.length === 0 ||
		!config.increments.every((step) => isFiniteInteger(step) && step > 0)
	) {
		return null;
	}

	return config as TeamScorelineUiConfig;
}

export function getScorelineRendererKey(
	config: TeamScorelineUiConfig,
): 'football-scoreline-v1' | 'rugby-union-scoreline-v1' {
	return config.renderer_key;
}

export function getScorelineRenderer(config: TeamScorelineUiConfig): ScorelineRenderer {
	return scorelineRendererRegistry[config.renderer_key];
}
