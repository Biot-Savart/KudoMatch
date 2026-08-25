import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
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

const teams = [
	{
		name: 'Arsenal',
		short_name: 'ARS',
		logo_url: 'https://media.api-sports.io/football/teams/42.png',
	},
	{
		name: 'Aston Villa',
		short_name: 'AVL',
		logo_url: 'https://media.api-sports.io/football/teams/66.png',
	},
	{
		name: 'Chelsea',
		short_name: 'CHE',
		logo_url: 'https://media.api-sports.io/football/teams/49.png',
	},
	{
		name: 'Liverpool',
		short_name: 'LIV',
		logo_url: 'https://media.api-sports.io/football/teams/40.png',
	},
	{
		name: 'Manchester City',
		short_name: 'MCI',
		logo_url: 'https://media.api-sports.io/football/teams/50.png',
	},
	{
		name: 'Manchester United',
		short_name: 'MUN',
		logo_url: 'https://media.api-sports.io/football/teams/33.png',
	},
	{
		name: 'Newcastle',
		short_name: 'NEW',
		logo_url: 'https://media.api-sports.io/football/teams/34.png',
	},
	{
		name: 'Tottenham Hotspur',
		short_name: 'TOT',
		logo_url: 'https://media.api-sports.io/football/teams/47.png',
	},
	{
		name: 'West Ham United',
		short_name: 'WHU',
		logo_url: 'https://media.api-sports.io/football/teams/48.png',
	},
	{
		name: 'Brighton',
		short_name: 'BHA',
		logo_url: 'https://media.api-sports.io/football/teams/51.png',
	},
];

export async function seedDeterministicFixtures() {
	console.log('🌱 Starting deterministic fixture seeding for Phase 13...');

	// 1. Ensure Sport
	await supabase.from('sports').upsert({
		slug: 'football',
		name: 'Football',
		icon_key: 'football',
		default_score_unit: 'goals',
		is_active: true,
		display_order: 1,
	});

	// 2. Ensure Competition
	let compId: string | number;
	const { data: compData } = await supabase
		.from('competitions')
		.select('id')
		.eq('slug', 'premier-league')
		.maybeSingle();

	if (compData) {
		compId = compData.id;
	} else {
		const { data: createdComp, error: cErr } = await supabase
			.from('competitions')
			.insert({
				sport_slug: 'football',
				slug: 'premier-league',
				name: 'Premier League',
				kind: 'league',
				country: 'England',
				logo_url: 'https://media.api-sports.io/football/leagues/39.png',
				is_active: true,
			})
			.select()
			.single();
		if (cErr) throw cErr;
		compId = createdComp.id;
	}

	// 3. Ensure Competition Edition
	let editionId: string | number;
	const { data: edData } = await supabase
		.from('competition_editions')
		.select('id')
		.eq('competition_id', compId)
		.eq('season_key', '2025-2026')
		.maybeSingle();

	if (edData) {
		editionId = edData.id;
	} else {
		const { data: createdEd, error: edErr } = await supabase
			.from('competition_editions')
			.insert({
				competition_id: compId,
				season_key: '2025-2026',
				name: 'Premier League 2025/26',
				starts_at: new Date(Date.now() - 30 * 86400000).toISOString(),
				ends_at: new Date(Date.now() + 200 * 86400000).toISOString(),
				status: 'active',
			})
			.select()
			.single();
		if (edErr) throw edErr;
		editionId = createdEd.id;
	}

	// 4. Ensure Competitors
	const competitorMap = new Map<string, string | number>();
	for (const t of teams) {
		let cId: string | number;
		const { data: existingComp } = await supabase
			.from('competitors')
			.select('id')
			.eq('name', t.name)
			.eq('sport_slug', 'football')
			.maybeSingle();

		if (existingComp) {
			cId = existingComp.id;
		} else {
			const { data: createdComp } = await supabase
				.from('competitors')
				.insert({
					sport_slug: 'football',
					kind: 'team',
					name: t.name,
					short_name: t.short_name,
					media_url: t.logo_url,
					is_active: true,
				})
				.select()
				.single();
			cId = createdComp.id;
		}
		competitorMap.set(t.name, cId);
	}

	// 5. Fetch active football ruleset
	const { data: ruleset } = await supabase
		.from('scoring_rulesets')
		.select('id')
		.eq('sport_slug', 'football')
		.eq('market_kind', 'team_scoreline')
		.eq('is_active', true)
		.single();

	if (!ruleset) {
		console.warn('⚠️ No active scoring ruleset found for football.');
		return;
	}

	// 6. Create fixtures for Round 12 and Round 13
	const fixtures = [
		{
			home: 'Chelsea',
			away: 'Arsenal',
			round: 'Round 12',
			seq: 1,
			starts_at: new Date(Date.now() + 1 * 86400000).toISOString(),
		},
		{
			home: 'Manchester City',
			away: 'Tottenham Hotspur',
			round: 'Round 12',
			seq: 2,
			starts_at: new Date(Date.now() + 2 * 86400000).toISOString(),
		},
		{
			home: 'Liverpool',
			away: 'Aston Villa',
			round: 'Round 12',
			seq: 3,
			starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
		},
		{
			home: 'Manchester United',
			away: 'Newcastle',
			round: 'Round 12',
			seq: 4,
			starts_at: new Date(Date.now() + 4 * 86400000).toISOString(),
		},
		{
			home: 'Brighton',
			away: 'West Ham United',
			round: 'Round 12',
			seq: 5,
			starts_at: new Date(Date.now() + 5 * 86400000).toISOString(),
		},
		// Round 13
		{
			home: 'Arsenal',
			away: 'Manchester City',
			round: 'Round 13',
			seq: 6,
			starts_at: new Date(Date.now() + 8 * 86400000).toISOString(),
		},
		{
			home: 'Tottenham Hotspur',
			away: 'Chelsea',
			round: 'Round 13',
			seq: 7,
			starts_at: new Date(Date.now() + 9 * 86400000).toISOString(),
		},
	];

	for (const f of fixtures) {
		const homeId = competitorMap.get(f.home);
		const awayId = competitorMap.get(f.away);
		if (!homeId || !awayId) continue;

		// Insert event
		const { data: event, error: evErr } = await supabase
			.from('events')
			.insert({
				edition_id: editionId,
				kind: 'match',
				starts_at: f.starts_at,
				status: 'scheduled',
				round_label: f.round,
				sequence_number: f.seq,
			})
			.select()
			.single();

		if (evErr) {
			console.error('Error inserting event:', evErr);
			continue;
		}

		// Insert event competitors
		await supabase.from('event_competitors').insert([
			{ event_id: event.id, competitor_id: homeId, slot: 1, role: 'home' },
			{ event_id: event.id, competitor_id: awayId, slot: 2, role: 'away' },
		]);

		// Insert event market
		await supabase.from('event_markets').insert({
			event_id: event.id,
			market_kind: 'team_scoreline',
			payload_schema_version: 1,
			ruleset_id: ruleset.id,
			sequence_no: 1,
			is_current: true,
			opens_at: new Date(Date.now() - 7 * 86400000).toISOString(),
			locks_at: f.starts_at,
			status: 'open',
		});
	}

	console.log(
		`✅ Seeded ${fixtures.length} events with markets and competitors.`,
	);
}

if (require.main === module) {
	seedDeterministicFixtures()
		.then(() => {
			console.log('Done!');
			process.exit(0);
		})
		.catch((err) => {
			console.error('Error:', err);
			process.exit(1);
		});
}
