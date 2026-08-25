import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('❌ Missing Supabase environment variables in .env.local');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		persistSession: false,
		autoRefreshToken: false,
	},
});

// Mock users config
const mockUsers = [
	{
		id: '00000000-0000-0000-0000-000000000001',
		email: 'marcus@kudomatch.test',
		full_name: 'Marcus Striker',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Marcus',
	},
	{
		id: '00000000-0000-0000-0000-000000000002',
		email: 'sarah@kudomatch.test',
		full_name: 'Sarah Tactician',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah',
	},
	{
		id: '00000000-0000-0000-0000-000000000003',
		email: 'alex@kudomatch.test',
		full_name: 'Alex GK',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex',
	},
	{
		id: '00000000-0000-0000-0000-000000000004',
		email: 'sam@kudomatch.test',
		full_name: 'Sam Analytics',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sam',
	},
	{
		id: '00000000-0000-0000-0000-000000000005',
		email: 'elena@kudomatch.test',
		full_name: 'Elena Scout',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Elena',
	},
];

export async function seedHistoricTestingData() {
	console.log('🚀 Starting deterministic test data seeding...');

	// 1. Ensure mock profiles exist
	for (const u of mockUsers) {
		await supabase.from('profiles').upsert({
			id: u.id,
			email: u.email,
			full_name: u.full_name,
			avatar_url: u.avatar_url,
		});
	}

	// 2. Fetch active football scoring ruleset
	const { data: ruleset } = await supabase
		.from('scoring_rulesets')
		.select('id')
		.eq('sport_slug', 'football')
		.eq('market_kind', 'team_scoreline')
		.eq('is_active', true)
		.single();

	if (!ruleset) {
		console.error('❌ Scoring ruleset not found.');
		return;
	}

	// 3. Create a Demo Pool
	const poolId = '00000000-0000-0000-0000-000000000100';
	await supabase.from('pools').upsert({
		id: poolId,
		name: 'Premier League Legends',
		created_by: mockUsers[0].id,
		invite_code: 'PL2026',
		scope_kind: 'sport',
		sport_slug: 'football',
		scoring_mode: 'raw',
		scoring_starts_at: new Date(Date.now() - 30 * 86400000).toISOString(),
		is_private: false,
	});

	// 4. Add mock members to pool
	for (const u of mockUsers) {
		await supabase.from('pool_members').upsert(
			{
				pool_id: poolId,
				user_id: u.id,
				role: u.id === mockUsers[0].id ? 'admin' : 'member',
				joined_at: new Date(Date.now() - 30 * 86400000).toISOString(),
			},
			{ onConflict: 'pool_id,user_id' },
		);
	}

	// 5. Add sample banter messages
	const messages = [
		{
			user: mockUsers[0],
			text: 'Welcome to the Premier League Legends pool! 🔥',
		},
		{ user: mockUsers[1], text: 'Ready to claim top spot this week!' },
		{ user: mockUsers[2], text: 'Chelsea vs Arsenal is going to be spicy 🌶️' },
		{
			user: mockUsers[3],
			text: 'My model predicts a 2-1 home win for Man City.',
		},
	];

	for (const m of messages) {
		await supabase.from('pool_messages').insert({
			pool_id: poolId,
			user_id: m.user.id,
			message: m.text,
		});
	}

	console.log('✅ Demo pool, members, and chat seeded successfully.');
}

if (require.main === module) {
	seedHistoricTestingData()
		.then(() => {
			console.log('Done!');
			process.exit(0);
		})
		.catch((err) => {
			console.error('Error:', err);
			process.exit(1);
		});
}
