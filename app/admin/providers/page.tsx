import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type ProviderDiagnostic = {
	provider_slug: string;
	provider_name: string;
	health_status: string | null;
	circuit_state: string | null;
	last_success_at: string | null;
	last_failure_at: string | null;
	last_error_code: string | null;
	mapping_gaps: number;
	quarantine_count: number;
	minute_request_count: number | null;
	minute_request_limit: number | null;
	day_request_count: number | null;
	day_request_limit: number | null;
	};

type EventDiagnostic = {
	provider_slug: string;
	provider_event_key: string;
	mapping_state: string;
	provider_status: string;
	canonical_status: string | null;
	quality_status: string | null;
	provider_home_score: number | null;
	provider_away_score: number | null;
	};

type StandingDiagnostic = {
	provider_slug: string;
	edition_id: number;
	provider_competitor_key: string;
	mapping_status: string;
	provider_position: number | null;
	canonical_position: number | null;
	provider_table_points: number | null;
	canonical_table_points: number | null;
	quality_status: string | null;
};

function formatDate(value: string | null | undefined): string {
	return value ? new Date(value).toLocaleString() : '—';
}

function isProviderAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
	const roles = user.app_metadata?.roles;
	return Array.isArray(roles) && roles.some((role) => role === 'provider_admin');
}

export default async function ProviderDiagnosticsPage() {
	const authClient = createClient();
	const { data: authData } = await authClient.auth.getUser();
	if (!authData.user || !isProviderAdmin(authData.user)) notFound();

	const adminClient = createServiceRoleClient();
	const [providerResult, eventResult, standingResult] = await Promise.all([
		adminClient.schema('private').from('provider_diagnostics').select('*').order('provider_slug'),
		adminClient.schema('private').from('provider_event_diagnostics').select('*').order('last_fetched_at', { ascending: false }).limit(50),
		adminClient.schema('private').from('provider_standing_diagnostics').select('*').order('fetched_at', { ascending: false }).limit(50),
	]);
	if (providerResult.error) throw providerResult.error;
	if (eventResult.error) throw eventResult.error;
	if (standingResult.error) throw standingResult.error;

	const providers = (providerResult.data ?? []) as ProviderDiagnostic[];
	const events = (eventResult.data ?? []) as EventDiagnostic[];
	const standings = (standingResult.data ?? []) as StandingDiagnostic[];

	return (
		<main className="min-h-screen px-4 py-8 sm:px-8">
			<div className="mx-auto max-w-7xl space-y-8">
				<header>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Operations</p>
					<h1 className="mt-2 text-3xl font-bold text-white">Provider diagnostics</h1>
					<p className="mt-2 text-sm text-slate-400">Read-only health, mapping, conflict, and standings comparisons.</p>
				</header>

				<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{providers.map((provider) => (
						<article key={provider.provider_slug} className="glass-card rounded-2xl border border-white/10 p-5">
							<div className="flex items-center justify-between gap-3">
								<h2 className="font-semibold text-white">{provider.provider_name}</h2>
								<span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase text-slate-300">{provider.health_status ?? 'unknown'}</span>
							</div>
							<p className="mt-1 text-xs text-slate-500">{provider.provider_slug} · circuit {provider.circuit_state ?? '—'}</p>
							<dl className="mt-4 space-y-2 text-xs text-slate-300">
								<div className="flex justify-between"><dt>Mapping gaps</dt><dd>{provider.mapping_gaps}</dd></div>
								<div className="flex justify-between"><dt>Quarantine</dt><dd>{provider.quarantine_count}</dd></div>
								<div className="flex justify-between"><dt>Minute budget</dt><dd>{provider.minute_request_count ?? 0}/{provider.minute_request_limit ?? '—'}</dd></div>
								<div className="flex justify-between"><dt>Day budget</dt><dd>{provider.day_request_count ?? 0}/{provider.day_request_limit ?? '—'}</dd></div>
								<div className="flex justify-between"><dt>Last success</dt><dd>{formatDate(provider.last_success_at)}</dd></div>
							</dl>
						</article>
					))}
				</section>

				<section className="glass-card overflow-hidden rounded-2xl border border-white/10">
					<div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold text-white">Recent event comparisons</h2></div>
					<div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-5 py-3">Provider</th><th className="px-5 py-3">Event</th><th className="px-5 py-3">Provider</th><th className="px-5 py-3">Canonical</th><th className="px-5 py-3">Quality</th></tr></thead><tbody className="divide-y divide-white/5 text-slate-300">{events.map((event) => <tr key={`${event.provider_slug}:${event.provider_event_key}`}><td className="px-5 py-3">{event.provider_slug}</td><td className="px-5 py-3">{event.provider_event_key}</td><td className="px-5 py-3">{event.provider_status} {event.provider_home_score !== null ? `${event.provider_home_score}–${event.provider_away_score}` : ''}</td><td className="px-5 py-3">{event.canonical_status ?? '—'}</td><td className="px-5 py-3">{event.quality_status ?? '—'}</td></tr>)}</tbody></table></div>
				</section>

				<section className="glass-card overflow-hidden rounded-2xl border border-white/10">
					<div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold text-white">Recent standings comparisons</h2></div>
					<div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-5 py-3">Provider</th><th className="px-5 py-3">Edition</th><th className="px-5 py-3">Competitor key</th><th className="px-5 py-3">Positions</th><th className="px-5 py-3">Table points</th><th className="px-5 py-3">Quality</th></tr></thead><tbody className="divide-y divide-white/5 text-slate-300">{standings.map((standing) => <tr key={`${standing.provider_slug}:${standing.edition_id}:${standing.provider_competitor_key}`}><td className="px-5 py-3">{standing.provider_slug}</td><td className="px-5 py-3">{standing.edition_id}</td><td className="px-5 py-3">{standing.provider_competitor_key}</td><td className="px-5 py-3">{standing.provider_position ?? '—'} / {standing.canonical_position ?? '—'}</td><td className="px-5 py-3">{standing.provider_table_points ?? '—'} / {standing.canonical_table_points ?? '—'}</td><td className="px-5 py-3">{standing.mapping_status} · {standing.quality_status ?? '—'}</td></tr>)}</tbody></table></div>
				</section>
			</div>
		</main>
	);
}
