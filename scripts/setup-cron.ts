import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('❌ Missing Supabase environment variables. Check .env.local');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		persistSession: false,
	},
});

async function main() {
	const args = process.argv.slice(2);
	const cronExprArg = args.find((arg) => arg.startsWith('--cron='));
	const endpointUrlArg = args.find((arg) => arg.startsWith('--url='));

	const cronExpr = cronExprArg ? cronExprArg.split('=')[1] : '*/10 * * * *';
	const endpointUrl = endpointUrlArg
		? endpointUrlArg.split('=')[1]
		: `${SUPABASE_URL.replace('.supabase.co', '.vercel.app')}/api/cron/fetch-live-scores`;

	console.log('⏳ Setting up automated pg_cron score check in Supabase...');
	console.log(`   Endpoint: ${endpointUrl}`);
	console.log(`   Cron Expression: ${cronExpr}`);

	const { error } = await supabase.rpc('setup_automated_score_checks', {
		p_edge_function_url: endpointUrl,
		p_service_role_key: SUPABASE_SERVICE_ROLE_KEY,
		p_cron_expression: cronExpr,
	});

	if (error) {
		console.error('❌ Failed to configure pg_cron:', error.message);
		process.exit(1);
	}

	console.log(
		'✅ Successfully scheduled automated score checks in Supabase pg_cron!',
	);
}

main();
