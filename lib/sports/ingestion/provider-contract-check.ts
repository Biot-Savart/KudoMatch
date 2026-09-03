import { CanonicalEventDTO, CanonicalEditionDTO, CanonicalCompetitionDTO, CanonicalCompetitorDTO } from './dto';
import { SportProviderAdapter } from './adapter';

export interface ProviderContractCheckOptions {
	competitionExternalKey: string;
	editionExternalKey: string;
	expectedCompetitionSlug: string;
	expectedSeasonKey: string;
	probeEventExternalKey: string;
	expectedProbeScore: { home: number; away: number };
}

export interface ProviderContractCheckItem {
	name: string;
	passed: boolean;
	details?: Record<string, unknown>;
}

export interface ProviderContractCheckReport {
	providerSlug: string;
	sportSlug: string;
	checkedAt: string;
	durationMs: number;
	passed: boolean;
	checks: ProviderContractCheckItem[];
}

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasEventContract(event: CanonicalEventDTO, options: ProviderContractCheckOptions): ProviderContractCheckItem[] {
	const result = event.result?.resultPayload;
	const participants = event.participants;
	return [
		{
			name: 'probe event identity',
			passed: event.externalKey === options.probeEventExternalKey
				&& event.editionExternalKey.endsWith(`-${options.expectedSeasonKey}`),
			details: { externalKey: event.externalKey, editionExternalKey: event.editionExternalKey },
		},
		{
			name: 'probe event final status',
			passed: event.status === 'finished' && event.result?.status === 'final',
			details: { eventStatus: event.status, resultStatus: event.result?.status },
		},
		{
			name: 'probe event score payload',
			passed: result?.homeScore === options.expectedProbeScore.home && result.awayScore === options.expectedProbeScore.away,
			details: { homeScore: result?.homeScore, awayScore: result?.awayScore },
		},
		{
			name: 'probe event participant contract',
			passed: participants.length === 2
				&& participants.some((participant) => participant.role === 'home' && participant.slotNumber === 1)
				&& participants.some((participant) => participant.role === 'away' && participant.slotNumber === 2),
			details: { participants },
		},
		{
			name: 'probe event market contract',
			passed: event.market?.marketKey === 'team_scoreline'
				&& event.market.status === 'settled'
				&& event.market.lockAt === event.scheduledStartTime,
			details: { market: event.market },
		},
	];
}

export async function runProviderContractCheck(
	adapter: SportProviderAdapter,
	options: ProviderContractCheckOptions,
): Promise<ProviderContractCheckReport> {
	const startedAt = Date.now();
	const checkedAt = new Date().toISOString();
	const checks: ProviderContractCheckItem[] = [];
	const capabilities = adapter.capabilities;
	checks.push({
		name: 'provider capability contract',
		passed: capabilities?.competitions === true
			&& capabilities.editions === true
			&& capabilities.teams === true
			&& capabilities.currentFixtures === true
			&& capabilities.liveUpdates === true
			&& capabilities.results === true,
		details: { capabilities },
	});

	let competitions: CanonicalCompetitionDTO[] = [];
	try {
		competitions = await adapter.fetchCompetitions();
		const competition = competitions.find((item) => item.externalKey === options.competitionExternalKey);
		checks.push({
			name: 'competition contract',
			passed: competition?.sportSlug === adapter.sportSlug && competition.slug === options.expectedCompetitionSlug,
			details: { competition },
		});
	} catch (error) {
		checks.push({ name: 'competition contract', passed: false, details: { error: error instanceof Error ? error.message : String(error) } });
	}

	try {
		const editions = await adapter.fetchEditions(options.competitionExternalKey);
		const edition = editions.find((item: CanonicalEditionDTO) => item.externalKey === options.editionExternalKey);
		checks.push({
			name: 'edition contract',
			passed: edition?.competitionExternalKey === options.competitionExternalKey && edition.seasonKey === options.expectedSeasonKey,
			details: { edition },
		});
	} catch (error) {
		checks.push({ name: 'edition contract', passed: false, details: { error: error instanceof Error ? error.message : String(error) } });
	}

	try {
		const teams = await adapter.fetchCompetitors(options.editionExternalKey, options.competitionExternalKey);
		checks.push({
			name: 'competitor contract',
			passed: teams.length >= 2 && teams.every((team: CanonicalCompetitorDTO) => Boolean(team.externalKey && team.name)),
			details: { count: teams.length },
		});
	} catch (error) {
		checks.push({ name: 'competitor contract', passed: false, details: { error: error instanceof Error ? error.message : String(error) } });
	}

	let probeEvent: CanonicalEventDTO | null = null;
	try {
		probeEvent = adapter.fetchEvent
			? await adapter.fetchEvent(options.probeEventExternalKey)
			: null;
		checks.push({
			name: 'single-event route contract',
			passed: isObject(probeEvent) && probeEvent !== null,
			details: { fetched: Boolean(probeEvent) },
		});
		if (probeEvent) checks.push(...hasEventContract(probeEvent, options));
	} catch (error) {
		checks.push({ name: 'single-event route contract', passed: false, details: { error: error instanceof Error ? error.message : String(error) } });
	}

	return {
		providerSlug: adapter.providerSlug,
		sportSlug: adapter.sportSlug,
		checkedAt,
		durationMs: Date.now() - startedAt,
		passed: checks.every((check) => check.passed),
		checks,
	};
}
