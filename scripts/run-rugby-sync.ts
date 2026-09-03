import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { createServiceRoleClient } from '../lib/supabase/server';
import { runRugbySyncDispatcher } from '../lib/sports/ingestion/dispatcher';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const maxTargetsArg = process.argv.find((arg) => arg.startsWith('--max-targets='));
const maxTargets = Math.min(Math.max(Number(maxTargetsArg?.split('=')[1] ?? 10) || 10, 1), 100);

async function main(): Promise<void> {
	const result = await runRugbySyncDispatcher({
		supabase: createServiceRoleClient(),
		maxTargets,
		invocationSource: 'cli',
	});
	console.log(JSON.stringify(result, null, 2));
	if (result.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : 'Rugby sync dispatcher failed');
	process.exitCode = 1;
});
