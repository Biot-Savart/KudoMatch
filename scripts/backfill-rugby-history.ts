/**
 * Phase 5 bounded API-Sports Rugby Union historical backfill.
 *
 * One invocation processes at most --max-pages (one by default). Re-running
 * resumes from the persisted provider-native checkpoint. Use --restart to
 * replay from page one without deleting source or canonical rows.
 */
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createServiceRoleClient } from '../lib/supabase/server';
import { RugbyApiSportsAdapter } from '../lib/sports/ingestion/adapters/rugby-api-sports';
import { runHistoricalBackfill } from '../lib/sports/ingestion/backfill';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function argument(name: string): string | undefined {
	return process.argv
		.find((value) => value.startsWith(`--${name}=`))
		?.split('=').slice(1).join('=');
}

function hasFlag(name: string): boolean {
	return process.argv.includes(`--${name}`) || argument(name) !== undefined;
}

function loadRecordedPayload(): unknown | undefined {
	if (!hasFlag('recorded')) return undefined;
	const requested = argument('recorded');
	const filePath = requested
		? path.resolve(process.cwd(), requested)
		: path.resolve(process.cwd(), 'tests/fixtures/providers/api-sports/rugby-union/finished-game.json');
	const payload = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
	const endpoints = payload.endpoints as Record<string, unknown> | undefined;
	const games = endpoints?.games as Record<string, unknown> | undefined;
	return games ?? payload;
}

async function resolveEditionId(
	supabase: ReturnType<typeof createServiceRoleClient>,
	editionExternalKey: string,
	editionIdArgument?: string,
): Promise<number> {
	if (editionIdArgument) {
		const editionId = Number(editionIdArgument);
		if (Number.isInteger(editionId) && editionId > 0) return editionId;
		throw new Error('--edition-id must be a positive integer');
	}
	const { data, error } = await supabase
		.from('external_entity_refs')
		.select('edition_id')
		.eq('provider_slug', 'api-sports')
		.eq('entity_kind', 'edition')
		.eq('external_key', editionExternalKey)
		.maybeSingle();
	if (error) throw new Error(`Failed to resolve canonical edition: ${error.message}`);
	if (!data?.edition_id) {
		throw new Error(
			`No audited canonical edition mapping exists for '${editionExternalKey}'. Supply --edition-id after reviewing the provider edition mapping.`,
		);
	}
	return Number(data.edition_id);
}

async function main(): Promise<void> {
	const competitionExternalKey = argument('competition');
	const seasonKey = argument('season');
	if (!competitionExternalKey || !seasonKey) {
		throw new Error('Use --competition=<API-Sports league id> and --season=<provider season>');
	}
	const editionExternalKey = argument('edition') ?? `${competitionExternalKey}-${seasonKey}`;
	const recordedPayload = loadRecordedPayload();
	const adapter = new RugbyApiSportsAdapter({
		recordedGames: recordedPayload,
		providerSeason: seasonKey,
	});
	const supabase = createServiceRoleClient();
	const editionId = await resolveEditionId(supabase, editionExternalKey, argument('edition-id'));
	const result = await runHistoricalBackfill({
		supabase,
		adapter,
		competitionExternalKey,
		editionExternalKey,
		seasonKey,
		editionId,
		fromDate: argument('from'),
		toDate: argument('to'),
		maxPages: argument('max-pages') ? Number(argument('max-pages')) : undefined,
		resume: !process.argv.includes('--no-resume'),
		restart: hasFlag('restart'),
		dryRun: hasFlag('dry-run'),
		mapCatalog: hasFlag('map-catalog'),
		correlationId: `phase5_${competitionExternalKey}_${seasonKey}_${Date.now()}`,
	});
	console.log(JSON.stringify({ phase: 5, provider: adapter.providerSlug, result }, null, 2));
	if (result.status === 'failed') process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : 'Rugby history backfill failed');
	process.exitCode = 1;
});
