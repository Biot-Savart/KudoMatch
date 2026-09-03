/**
 * Proves that application event reads come from canonical Supabase data while
 * the provider gateway is unavailable. This is intentionally read-only.
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fetchActiveCompetitions, fetchCompetitionEditions } from '../lib/queries/competitions';
import { fetchEventById, fetchEvents } from '../lib/queries/events';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const gatewayUrl = process.argv.find((value) => value.startsWith('--gateway-url='))?.split('=').slice(1).join('=');

interface ReadEvidence {
	competition: string;
	competitionId: string;
	editionId: string;
	events: number;
	markets: number;
	finalResults: number;
	completedEvents: number;
	readEventId: string | null;
}

async function assertGatewayUnavailable(): Promise<void> {
	if (!gatewayUrl) throw new Error('Simulated outage proof requires --gateway-url=<stopped gateway URL>');
	try {
		await fetch(`${gatewayUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(2_000) });
		throw new Error('Gateway is still reachable; stop the provider gateway before running the outage proof');
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('Gateway is still reachable')) throw error;
	}
}

async function main(): Promise<void> {
	await assertGatewayUnavailable();
	const appRequestUrls: string[] = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input, init) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		appRequestUrls.push(url);
		return originalFetch(input, init);
	};

	try {
		const competitions = await fetchActiveCompetitions('rugby-union');
		const pilotSlugs = ['currie-cup', 'united-rugby-championship'];
		const evidence: ReadEvidence[] = [];

		for (const slug of pilotSlugs) {
			const competition = competitions.find((item) => item.slug === slug);
			if (!competition) throw new Error(`Canonical application query did not return ${slug}`);
			const editions = await fetchCompetitionEditions({
				sportSlug: 'rugby-union',
				competitionId: competition.id,
				statuses: ['active', 'planned', 'completed'],
			});
			const edition = editions.find((item) => item.status === 'active') ?? editions[0];
			if (!edition) throw new Error(`Canonical application query did not return an edition for ${slug}`);

			const events = await fetchEvents({
				sportSlug: 'rugby-union',
				competitionId: competition.id,
				editionId: edition.id,
			});
			const markets = events.flatMap((event) => event.markets ?? []);
			const finalResults = markets.filter((market) => market.result?.status === 'final');
			const completedEvents = events.filter((event) => event.status === 'completed');
			const completedEvent = completedEvents[0];
			const detail = completedEvent ? await fetchEventById(completedEvent.id) : null;
			if (completedEvent && (!detail || detail.id !== completedEvent.id || detail.current_market?.result?.status !== 'final')) {
				throw new Error(`Canonical event detail read failed for ${slug} event ${completedEvent.id}`);
			}

			evidence.push({
				competition: slug,
				competitionId: competition.id,
				editionId: edition.id,
				events: events.length,
				markets: markets.length,
				finalResults: finalResults.length,
				completedEvents: completedEvents.length,
				readEventId: completedEvent?.id ?? null,
			});
		}

		const expected = new Map(evidence.map((item) => [item.competition, item]));
		if (expected.get('currie-cup')?.events !== 30 || expected.get('currie-cup')?.finalResults !== 28) {
			throw new Error('Currie Cup canonical read evidence did not match the activated pilot snapshot');
		}
		if (expected.get('united-rugby-championship')?.events !== 30 || expected.get('united-rugby-championship')?.finalResults !== 0) {
			throw new Error('URC canonical read evidence did not match the activated pilot snapshot');
		}
		if (appRequestUrls.length === 0 || appRequestUrls.some((url) => url.includes('18080') || url.toLowerCase().includes('sofascore'))) {
			throw new Error('Application read path made an unexpected provider/gateway request');
		}

		console.log(JSON.stringify({
			phase: 4,
			simulatedOutage: true,
			providerGateway: 'unreachable',
			readSource: 'Supabase canonical application query path',
			databaseRequestCount: appRequestUrls.length,
			evidence,
		}, null, 2));
	} finally {
		globalThis.fetch = originalFetch;
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : 'Application read outage proof failed');
	process.exitCode = 1;
});
