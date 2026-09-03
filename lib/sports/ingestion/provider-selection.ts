import { SupabaseClient } from '@supabase/supabase-js';
import { ProviderCapabilities, SportProviderAdapter } from './adapter';
import { createSportProviderAdapter, SupportedProviderSlug } from './provider-factory';

export type ProviderOperation =
	| 'current_fixtures'
	| 'current_results'
	| 'historical_fixtures'
	| 'historical_results'
	| 'standings';

export interface ProviderSelectionOptions {
	supabase: SupabaseClient;
	competitionId: number;
	operation: ProviderOperation;
	now?: string;
	excludedProviders?: string[];
	adapters?: Partial<Record<string, SportProviderAdapter>>;
}

export interface ProviderSelectionDecision {
	providerSlug: SupportedProviderSlug;
	priority: number;
	adapter: SportProviderAdapter;
	healthStatus: string;
	circuitState: string;
	reservation: Record<string, unknown>;
}

export interface ProviderSelectionSkip {
	providerSlug: string;
	reason: string;
}

export interface ProviderSelectionResult {
	decision: ProviderSelectionDecision | null;
	skipped: ProviderSelectionSkip[];
}

type ProviderSetting = {
	provider_slug: string;
	enabled: boolean;
	observe_only: boolean;
	fixture_priority: number | null;
	result_priority: number | null;
	history_priority: number | null;
	standings_priority: number | null;
	config?: Record<string, unknown>;
};

type RuntimeState = {
	provider_slug: string;
	health_status: string;
	circuit_state: string;
	circuit_open_until?: string | null;
	};

function capabilityFor(operation: ProviderOperation): keyof ProviderCapabilities {
	switch (operation) {
		case 'current_fixtures': return 'currentFixtures';
		case 'current_results': return 'results';
		case 'historical_fixtures': return 'historicalFixtures';
		case 'historical_results': return 'results';
		case 'standings': return 'standings';
	}
}

function priorityFor(setting: ProviderSetting, operation: ProviderOperation): number | null {
	if (operation === 'current_fixtures') return setting.fixture_priority;
	if (operation === 'current_results') return setting.result_priority;
	if (operation === 'historical_fixtures' || operation === 'historical_results') return setting.history_priority;
	return setting.standings_priority;
}

export function orderConfiguredProviders(
	settings: ProviderSetting[],
	runtime: RuntimeState[],
	operation: ProviderOperation,
	excludedProviders: string[] = [],
): Array<{ setting: ProviderSetting; priority: number; runtime: RuntimeState }> {
	const excluded = new Set(excludedProviders);
	const runtimeByProvider = new Map(runtime.map((item) => [item.provider_slug, item]));
	return settings
		.map((setting) => ({ setting, priority: priorityFor(setting, operation), runtime: runtimeByProvider.get(setting.provider_slug) }))
		.filter((item): item is { setting: ProviderSetting; priority: number; runtime: RuntimeState } =>
			item.setting.enabled && !item.setting.observe_only && item.priority !== null && Boolean(item.runtime) && !excluded.has(item.setting.provider_slug))
		.sort((a, b) => a.priority - b.priority || a.setting.provider_slug.localeCompare(b.setting.provider_slug));
}

export class ProviderSelectionService {
	constructor(private readonly supabase: SupabaseClient) {}

	async select(options: Omit<ProviderSelectionOptions, 'supabase'>): Promise<ProviderSelectionResult> {
		const skipped: ProviderSelectionSkip[] = [];
		const [{ data: settings, error: settingsError }, { data: runtime, error: runtimeError }] = await Promise.all([
			this.supabase.from('competition_provider_settings').select('provider_slug, enabled, observe_only, fixture_priority, result_priority, history_priority, standings_priority, config').eq('competition_id', options.competitionId),
			this.supabase.from('provider_runtime_state').select('provider_slug, health_status, circuit_state, circuit_open_until'),
		]);
		if (settingsError) throw new Error(`Failed to load provider settings: ${settingsError.message}`);
		if (runtimeError) throw new Error(`Failed to load provider runtime state: ${runtimeError.message}`);

		const candidates = orderConfiguredProviders(
			(settings ?? []) as ProviderSetting[],
			(runtime ?? []) as RuntimeState[],
			options.operation,
			options.excludedProviders,
		);
		const capability = capabilityFor(options.operation);
		for (const candidate of candidates) {
			const adapter = options.adapters?.[candidate.setting.provider_slug] ?? createSportProviderAdapter(
				candidate.setting.provider_slug as SupportedProviderSlug,
				{ sport: 'rugby-union' },
			);
			if (!adapter.capabilities?.[capability]) {
				skipped.push({ providerSlug: candidate.setting.provider_slug, reason: `capability_not_supported:${capability}` });
				continue;
			}
			const selectionNow = Date.parse(options.now ?? new Date().toISOString());
			const circuitStillOpen = candidate.runtime.circuit_state === 'open'
				&& (!candidate.runtime.circuit_open_until || Date.parse(candidate.runtime.circuit_open_until) > selectionNow);
			if (circuitStillOpen) {
				skipped.push({ providerSlug: candidate.setting.provider_slug, reason: 'provider_unavailable_or_circuit_open' });
				continue;
			}
			const { data, error } = await this.supabase.rpc('reserve_provider_request', {
				p_provider_slug: candidate.setting.provider_slug,
				p_now: options.now ?? new Date().toISOString(),
			});
			if (error) throw new Error(`Failed to reserve provider request: ${error.message}`);
			const reservation = (data ?? {}) as Record<string, unknown>;
			if (reservation.allowed === true) {
				return {
					decision: {
						providerSlug: candidate.setting.provider_slug as SupportedProviderSlug,
						priority: candidate.priority,
						adapter,
						healthStatus: candidate.runtime.health_status,
						circuitState: String(reservation.circuit_state ?? candidate.runtime.circuit_state),
						reservation,
					},
					skipped,
				};
			}
			skipped.push({ providerSlug: candidate.setting.provider_slug, reason: String(reservation.reason ?? 'request_not_reserved') });
		}
		return { decision: null, skipped };
	}

	async reportSuccess(providerSlug: string, latencyMs: number, now?: string): Promise<void> {
		const { error } = await this.supabase.rpc('record_provider_success', {
			p_provider_slug: providerSlug,
			p_latency_ms: Math.max(0, Math.round(latencyMs)),
			p_now: now ?? new Date().toISOString(),
		});
		if (error) throw new Error(`Failed to record provider success: ${error.message}`);
	}

	async reportFailure(providerSlug: string, error: unknown, latencyMs: number, now?: string): Promise<void> {
		const value = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown } : {};
		const code = typeof value.code === 'string' ? value.code : 'PROVIDER_ERROR';
		const status = typeof value.status === 'number' ? value.status : null;
		const qualifying = status === 429 || status === null || status >= 500 || code === 'SCHEMA_ERROR' || code === 'TIMEOUT' || code === 'NETWORK_ERROR';
		const { error: rpcError } = await this.supabase.rpc('record_provider_failure', {
			p_provider_slug: providerSlug,
			p_error_code: code,
			p_http_status: status,
			p_latency_ms: Math.max(0, Math.round(latencyMs)),
			p_qualifying_failure: qualifying,
			p_now: now ?? new Date().toISOString(),
		});
		if (rpcError) throw new Error(`Failed to record provider failure: ${rpcError.message}`);
	}
}
