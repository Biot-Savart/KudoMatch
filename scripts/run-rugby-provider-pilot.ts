/**
 * Explicit Phase 4 current-provider pilot runner.
 *
 * The default mode is source-ledger observe-only. Canonical writes require
 * --canonical and are still rejected by the database until the reviewed
 * competition/provider settings are activated independently.
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { createServiceRoleClient } from '../lib/supabase/server';
import { orchestrateProviderSourceIngestion } from '../lib/sports/ingestion/source-orchestrate';
import { SofaScoreProvider } from '../lib/sports/ingestion/adapters/sofascore';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const PILOT_COMPETITIONS = {
	'currie-cup': { providerKey: '796', season: '97057' },
	urc: { providerKey: '419', season: '98406' },
} as const;

function argument(name: string): string | undefined {
	return process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

async function main(): Promise<void> {
	const competition = argument('competition') as keyof typeof PILOT_COMPETITIONS | undefined;
	if (!competition || !(competition in PILOT_COMPETITIONS)) {
		throw new Error('Use --competition=currie-cup or --competition=urc');
	}
	const configured = PILOT_COMPETITIONS[competition];
	const season = argument('season') ?? configured.season;
	const providerKey = configured.providerKey;
	const observeOnly = !process.argv.includes('--canonical');
	const dryRun = process.argv.includes('--dry-run');
	const operation = (argument('operation') ?? 'sync_fixtures') as 'sync_fixtures' | 'sync_live' | 'full_reconcile';
	if (!['sync_fixtures', 'sync_live', 'full_reconcile'].includes(operation)) {
		throw new Error('Invalid --operation');
	}

	const provider = new SofaScoreProvider();
	const result = await orchestrateProviderSourceIngestion({
		adapter: provider,
		supabase: createServiceRoleClient(),
		competitionExternalKey: providerKey,
		editionExternalKey: `${providerKey}-${season}`,
		seasonKey: season,
		operation,
		observeOnly,
		dryRun,
		correlationId: `phase4_${competition}_${Date.now()}`,
	});

	console.log(JSON.stringify({
		phase: 4,
		provider: provider.providerSlug,
		competition,
		season,
		mode: dryRun ? 'dry-run' : observeOnly ? 'observe-only' : 'canonical-write-requested',
		result,
	}, null, 2));
	if (result.status === 'failed') process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : 'Rugby provider pilot failed');
	process.exitCode = 1;
});
