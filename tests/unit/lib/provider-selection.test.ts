import { orderConfiguredProviders } from '@/lib/sports/ingestion/provider-selection';
import { ProviderSelectionService } from '@/lib/sports/ingestion/provider-selection';
import { EspnRugbyAdapter } from '@/lib/sports/ingestion/adapters/espn-rugby';
import scoreboard from '@/tests/fixtures/providers/espn/rugby-union/currie-cup-scoreboard.json';

describe('Provider selection policy (Phase 6)', () => {
	it('orders enabled providers by operation priority and excludes observe-only rows', () => {
		const ordered = orderConfiguredProviders(
			[
				{ provider_slug: 'api-sports', enabled: true, observe_only: false, fixture_priority: 3, result_priority: 3, history_priority: 1, standings_priority: null },
				{ provider_slug: 'espn', enabled: true, observe_only: false, fixture_priority: 2, result_priority: 2, history_priority: null, standings_priority: null },
				{ provider_slug: 'sofascore', enabled: true, observe_only: true, fixture_priority: 1, result_priority: 1, history_priority: null, standings_priority: null },
			],
			[
				{ provider_slug: 'api-sports', health_status: 'healthy', circuit_state: 'closed' },
				{ provider_slug: 'espn', health_status: 'healthy', circuit_state: 'closed' },
				{ provider_slug: 'sofascore', health_status: 'healthy', circuit_state: 'closed' },
			],
			'current_results',
		);
		expect(ordered.map((item) => item.setting.provider_slug)).toEqual(['espn', 'api-sports']);
	});

	it('does not invent a fallback when runtime state is absent', () => {
		const ordered = orderConfiguredProviders(
			[{ provider_slug: 'espn', enabled: true, observe_only: false, fixture_priority: 2, result_priority: 2, history_priority: null, standings_priority: null }],
			[],
			'current_fixtures',
		);
		expect(ordered).toHaveLength(0);
	});

	it('reserves the configured ESPN secondary provider when it is the eligible candidate', async () => {
		const settings = [{ provider_slug: 'espn', enabled: true, observe_only: false, fixture_priority: 2, result_priority: 2, history_priority: null, standings_priority: null }];
		const runtime = [{ provider_slug: 'espn', health_status: 'healthy', circuit_state: 'closed', circuit_open_until: null }];
		const query = (data: unknown) => {
			const builder: Record<string, unknown> = {};
			builder.select = () => builder;
			builder.eq = () => builder;
			builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
			return builder;
		};
		const supabase = {
			from: (table: string) => query(table === 'competition_provider_settings' ? settings : runtime),
			rpc: async () => ({ data: { allowed: true, circuit_state: 'closed' }, error: null }),
		} as never;
		const adapter = new EspnRugbyAdapter({ recordedResponses: { '/270555/scoreboard?dates=2026': scoreboard } });
		const result = await new ProviderSelectionService(supabase).select({ competitionId: 1, operation: 'current_results', adapters: { espn: adapter }, now: '2026-09-03T10:00:00Z' });
		expect(result.decision?.providerSlug).toBe('espn');
		expect(result.decision?.adapter).toBe(adapter);
	});
});
