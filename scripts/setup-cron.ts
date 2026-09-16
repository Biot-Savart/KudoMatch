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
	const isUnschedule = args.includes('--unschedule');

	if (isUnschedule) {
		console.log('⏳ Removing automated pg_cron score check in Supabase...');
		const { data, error } = await supabase.rpc(
			'unschedule_automated_score_checks',
		);
		if (error) {
			console.error('❌ Failed to unschedule pg_cron:', error.message);
			process.exit(1);
		}
		console.log(`✅ ${data || 'Successfully unscheduled cron job.'}`);
		return;
	}

	const cronExprArg = args.find(
		(arg) => arg.startsWith('--cron=') || arg.startsWith('--schedule='),
	);
	const endpointUrlArg = args.find(
		(arg) => arg.startsWith('--url=') || arg.startsWith('--endpoint='),
	);
	const secretArg = args.find((arg) => arg.startsWith('--secret='));

	const cronExpr = cronExprArg ? cronExprArg.split('=')[1] : '*/10 * * * *';
	const secretToken = secretArg
		? secretArg.split('=')[1]
		: process.env.CRON_SECRET || SUPABASE_SERVICE_ROLE_KEY;

	const defaultUrl = process.env.NEXT_PUBLIC_APP_URL
		? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/cron/fetch-live-scores`
		: `${SUPABASE_URL.replace('.supabase.co', '.vercel.app')}/api/cron/fetch-live-scores`;

	const endpointUrl = endpointUrlArg
		? endpointUrlArg.split('=')[1]
		: defaultUrl;

	console.log('⏳ Setting up automated pg_cron score check in Supabase...');
	console.log(`   Endpoint: ${endpointUrl}`);
	console.log(`   Cron Expression: ${cronExpr}`);

	const { data, error } = await supabase.rpc('setup_automated_score_checks', {
		p_edge_function_url: endpointUrl,
		p_service_role_key: secretToken,
		p_cron_expression: cronExpr,
	});

	if (error) {
		console.error('❌ Failed to configure pg_cron:', error.message);
		console.error(
			'👉 Ensure you have pushed the pg_cron migration using `npm run db:push` or executed the SQL in Supabase SQL editor.',
		);
		process.exit(1);
	}

	console.log(
		`✅ ${data || 'Successfully scheduled automated score checks in Supabase pg_cron!'}`,
	);
}

main();
