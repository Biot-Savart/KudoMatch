import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('❌ Missing Supabase environment variables. Check .env.local');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		persistSession: false,
	},
});

// Ordered tables for reference constraints during insert/restore
const TABLES_ORDER = [
	'profiles',
	'sports',
	'competitions',
	'competition_editions',
	'competitors',
	'events',
	'event_competitors',
	'scoring_rulesets',
	'scoring_rule_tiers',
	'event_markets',
	'predictions',
	'market_results',
	'pools',
	'pool_members',
	'pool_messages',
	'notification_preferences',
	'push_subscriptions',
];

export async function backupDatabase(
	outputPath?: string,
): Promise<{ success: boolean; path?: string; error?: string }> {
	console.log('📦 Commencing Database Backup Routine...');

	try {
		const backupData: Record<string, any[]> = {};

		for (const table of TABLES_ORDER) {
			console.log(`   Exporting: ${table}...`);
			const { data, error } = await supabase.from(table).select('*');
			if (error) {
				throw new Error(`Failed to export table ${table}: ${error.message}`);
			}
			backupData[table] = data || [];
		}

		const dir = path.resolve(process.cwd(), 'backups');
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
		const finalPath = outputPath
			? path.resolve(outputPath)
			: path.join(dir, filename);

		fs.writeFileSync(finalPath, JSON.stringify(backupData, null, 2), 'utf8');
		console.log(`✅ Database backup saved successfully to: ${finalPath}`);
		return { success: true, path: finalPath };
	} catch (err: any) {
		console.error('❌ Database Backup Routine failed:', err.message);
		return { success: false, error: err.message };
	}
}

export async function restoreDatabase(
	inputPath: string,
): Promise<{ success: boolean; error?: string }> {
	console.log(`📦 Commencing Database Restore Routine from: ${inputPath}...`);

	try {
		const filePath = path.resolve(inputPath);
		if (!fs.existsSync(filePath)) {
			throw new Error(`Backup file does not exist: ${filePath}`);
		}

		const backupRaw = fs.readFileSync(filePath, 'utf8');
		const backupData = JSON.parse(backupRaw) as Record<string, any[]>;

		// Restore in order of foreign key dependency hierarchy
		for (const table of TABLES_ORDER) {
			const rows = backupData[table];
			if (!rows || rows.length === 0) {
				console.log(`   Table ${table} has no data in backup, skipping.`);
				continue;
			}

			console.log(`   Restoring ${rows.length} rows to ${table}...`);
			// To keep it simple, we do bulk upserts on tables that support conflict resolution
			const { error } = await supabase.from(table).upsert(rows);
			if (error) {
				throw new Error(`Failed to restore table ${table}: ${error.message}`);
			}
		}

		console.log('🎉 Database restored successfully!');
		return { success: true };
	} catch (err: any) {
		console.error('❌ Database Restore Routine failed:', err.message);
		return { success: false, error: err.message };
	}
}

// Support executing from CLI direct call
if (require.main === module) {
	const args = process.argv.slice(2);
	const restoreArg = args.find((arg) => arg.startsWith('--restore='));

	if (restoreArg) {
		const restorePath = restoreArg.split('=')[1];
		if (!restorePath) {
			console.error(
				'❌ Missing path parameter. Example: --restore=backups/backup_xyz.json',
			);
			process.exit(1);
		}
		restoreDatabase(restorePath).then((res) => {
			process.exit(res.success ? 0 : 1);
		});
	} else {
		backupDatabase().then((res) => {
			process.exit(res.success ? 0 : 1);
		});
	}
}
