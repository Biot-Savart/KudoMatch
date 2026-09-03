import { SportProviderAdapter } from './adapter';
import { FootballDataAdapter } from './adapters/football-data';
import { MockSportProviderAdapter } from './adapters/mock';
import { RugbyApiSportsAdapter } from './adapters/rugby-api-sports';
import { SofaScoreProvider } from './adapters/sofascore';
import { TheSportsDbRugbyAdapter } from './adapters/thesportsdb-rugby';

export type SupportedProviderSlug =
	| 'football-data'
	| 'api-sports'
	| 'thesportsdb'
	| 'sofascore'
	| 'mock-provider';

export interface ProviderFactoryOptions {
	sport: 'football' | 'rugby-union';
	recordedPayload?: unknown;
}

function assertSport(provider: string, expected: string, actual: string): void {
	if (actual !== expected) {
		throw new Error(`Provider '${provider}' is incompatible with sport '${actual}'`);
	}
}

function recordedResponses(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const payload = value as Record<string, unknown>;
	if (payload.responses && typeof payload.responses === 'object' && !Array.isArray(payload.responses)) {
		return payload.responses as Record<string, unknown>;
	}
	return payload as Record<string, unknown>;
}

export function createSportProviderAdapter(
	provider: SupportedProviderSlug | undefined,
	options: ProviderFactoryOptions,
): SportProviderAdapter {
	if (provider === 'mock-provider') return new MockSportProviderAdapter(options.sport);
	if (!provider) {
		return options.sport === 'rugby-union'
			? new RugbyApiSportsAdapter({ recordedGames: options.recordedPayload })
			: new FootballDataAdapter({ recordedMatches: options.recordedPayload });
	}
	if (provider === 'football-data') {
		assertSport(provider, 'football', options.sport);
		return new FootballDataAdapter({ recordedMatches: options.recordedPayload });
	}
	if (provider === 'api-sports') {
		assertSport(provider, 'rugby-union', options.sport);
		return new RugbyApiSportsAdapter({ recordedGames: options.recordedPayload });
	}
	if (provider === 'thesportsdb') {
		assertSport(provider, 'rugby-union', options.sport);
		return new TheSportsDbRugbyAdapter();
	}
	assertSport(provider, 'rugby-union', options.sport);
	return new SofaScoreProvider({ recordedResponses: recordedResponses(options.recordedPayload) });
}
