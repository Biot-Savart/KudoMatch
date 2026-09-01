import * as dotenv from 'dotenv';
import * as path from 'path';
import { createServiceRoleClient } from '../lib/supabase/server';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

interface TournamentConfig {
	slug: string;
	seasonKey: string;
	editionName: string;
	startDate: string; // ISO string
	roundsCount: number;
}

const TOURNAMENTS: TournamentConfig[] = [
	{
		slug: 'six-nations',
		seasonKey: '2026',
		editionName: 'Six Nations 2026',
		startDate: '2026-02-06T20:00:00Z',
		roundsCount: 5,
	},
	{
		slug: 'united-rugby-championship',
		seasonKey: '2025-2026',
		editionName: 'United Rugby Championship · 2025/2026',
		startDate: '2025-09-26T18:30:00Z',
		roundsCount: 18,
	},
	{
		slug: 'rugby-championship',
		seasonKey: '2026',
		editionName: 'The Rugby Championship · 2026',
		startDate: '2026-08-08T15:00:00Z',
		roundsCount: 6,
	},
	{
		slug: 'premiership-rugby',
		seasonKey: '2025-2026',
		editionName: 'Premiership Rugby · 2025/2026',
		startDate: '2025-09-19T18:45:00Z',
		roundsCount: 18,
	},
	{
		slug: 'champions-cup',
		seasonKey: '2025-2026',
		editionName: 'Investec Champions Cup · 2025/2026',
		startDate: '2025-12-05T19:00:00Z',
		roundsCount: 8,
	},
	{
		slug: 'top-14',
		seasonKey: '2025-2026',
		editionName: 'French Top 14 · 2025/2026',
		startDate: '2025-09-06T15:00:00Z',
		roundsCount: 26,
	},
	{
		slug: 'super-rugby-pacific',
		seasonKey: '2026',
		editionName: 'Super Rugby Pacific · 2026',
		startDate: '2026-02-13T08:35:00Z',
		roundsCount: 15,
	},
	{
		slug: 'currie-cup',
		seasonKey: '2026',
		editionName: 'Currie Cup Premier Division · 2026',
		startDate: '2026-07-03T17:00:00Z',
		roundsCount: 10,
	},
];

async function seed2026Rugby() {
	console.log('🏉 Generating and seeding 2026 Rugby Union Fixtures...');
	const supabase = createServiceRoleClient();

	// 1. Get ruleset
	const { data: ruleset, error: rulesetErr } = await supabase
		.from('scoring_rulesets')
		.select('id')
		.eq('sport_slug', 'rugby-union')
		.eq('market_kind', 'team_scoreline')
		.eq('version', 1)
		.single();

	if (rulesetErr || !ruleset) {
		throw new Error(
			`Failed to find rugby scoreline ruleset: ${rulesetErr?.message}`,
		);
	}

	for (const tourney of TOURNAMENTS) {
		console.log(`\n--- Seeding ${tourney.editionName} (${tourney.slug}) ---`);

		// Find competition
		const { data: comp, error: compErr } = await supabase
			.from('competitions')
			.select('id, name')
			.eq('sport_slug', 'rugby-union')
			.eq('slug', tourney.slug)
			.single();

		if (compErr || !comp) {
			console.warn(
				`⚠️ Competition ${tourney.slug} not found in database, skipping.`,
			);
			continue;
		}

		// Find genuine teams associated with this competition
		const { data: prevEvents } = await supabase
			.from('events')
			.select(
				'event_competitors(competitor_id, competitor:competitors(id, name, media_url, short_name))',
			)
			.in(
				'edition_id',
				(
					await supabase
						.from('competition_editions')
						.select('id')
						.eq('competition_id', comp.id)
				).data?.map((e: any) => e.id) || [],
			);

		const teamMap = new Map<string, { id: string; name: string }>();
		for (const ev of prevEvents || []) {
			for (const ec of (ev as any).event_competitors || []) {
				const competitor = Array.isArray(ec.competitor)
					? ec.competitor[0]
					: ec.competitor;
				if (competitor) {
					teamMap.set(String(competitor.id), {
						id: String(competitor.id),
						name: competitor.name,
					});
				}
			}
		}

		let teams = Array.from(teamMap.values());
		if (teams.length < 2) {
			// Fallback to all rugby competitors if none found
			const { data: allTeams } = await supabase
				.from('competitors')
				.select('id, name')
				.eq('sport_slug', 'rugby-union')
				.limit(16);
			teams = (allTeams || []).map((t) => ({ id: String(t.id), name: t.name }));
		}

		console.log(`Found ${teams.length} teams for ${comp.name}`);

		// Create or upsert edition
		const { data: edition, error: edErr } = await supabase
			.from('competition_editions')
			.upsert(
				{
					competition_id: comp.id,
					season_key: tourney.seasonKey,
					name: tourney.editionName,
					starts_at: tourney.startDate,
					ends_at: new Date(
						new Date(tourney.startDate).getTime() + 180 * 24 * 3600 * 1000,
					).toISOString(),
					status: 'active',
					metadata: {
						format: 'round_robin',
						total_rounds: tourney.roundsCount,
					},
				},
				{ onConflict: 'competition_id,season_key' },
			)
			.select('id')
			.single();

		if (edErr || !edition) {
			console.error(`Failed to upsert edition for ${comp.name}:`, edErr);
			continue;
		}

		// Delete existing placeholder events for this edition before repopulating
		await supabase.from('events').delete().eq('edition_id', edition.id);

		// Generate round robin matches
		let totalInserted = 0;
		const n = teams.length;
		const baseTime = new Date(tourney.startDate).getTime();

		for (let round = 1; round <= tourney.roundsCount; round++) {
			const roundLabel = `Round ${round}`;
			const roundTime = new Date(baseTime + (round - 1) * 7 * 24 * 3600 * 1000);
			const matchesInRound = Math.floor(n / 2);

			for (let m = 0; m < matchesInRound; m++) {
				const homeIdx = (round - 1 + m) % n;
				let awayIdx = (n - 1 - m + round - 1) % n;
				if (homeIdx === awayIdx) awayIdx = (awayIdx + 1) % n;

				const homeTeam = teams[homeIdx];
				const awayTeam = teams[awayIdx];
				if (!homeTeam || !awayTeam || homeTeam.id === awayTeam.id) continue;

				// Kickoff time staggered across the weekend
				const matchKickoff = new Date(
					roundTime.getTime() + m * 2.5 * 3600 * 1000,
				);
				const isPast = matchKickoff.getTime() < Date.now();
				const status = isPast ? 'completed' : 'scheduled';

				// Insert event
				const { data: event, error: eventErr } = await supabase
					.from('events')
					.insert({
						edition_id: edition.id,
						round_label: roundLabel,
						starts_at: matchKickoff.toISOString(),
						status,
						venue_name: `${homeTeam.name} Stadium`,
					})
					.select('id')
					.single();

				if (eventErr || !event) {
					console.error('Error inserting event:', eventErr);
					continue;
				}

				// Insert competitors (home slot 1, away slot 2)
				await supabase.from('event_competitors').insert([
					{
						event_id: event.id,
						competitor_id: Number(homeTeam.id),
						slot: 1,
						role: 'home',
					},
					{
						event_id: event.id,
						competitor_id: Number(awayTeam.id),
						slot: 2,
						role: 'away',
					},
				]);

				// Insert scoreline market
				const { data: market } = await supabase
					.from('event_markets')
					.insert({
						event_id: event.id,
						ruleset_id: ruleset.id,
						market_kind: 'team_scoreline',
						sequence_no: 1,
						status: isPast ? 'settled' : 'open',
						lock_at: matchKickoff.toISOString(),
					})
					.select('id')
					.single();

				// If match is past, insert a realistic final rugby result
				if (isPast && market) {
					const homeScore = Math.floor(Math.random() * 25) + 15;
					const awayScore = Math.floor(Math.random() * 25) + 12;
					const winnerRole =
						homeScore > awayScore
							? 'home'
							: awayScore > homeScore
								? 'away'
								: 'draw';

					await supabase.from('market_results').insert({
						event_market_id: market.id,
						status: 'final',
						result_payload: { homeScore, awayScore, winnerRole },
						settled_at: new Date(
							matchKickoff.getTime() + 2 * 3600 * 1000,
						).toISOString(),
						revision: 1,
					});
				}

				totalInserted++;
			}
		}

		console.log(
			`✅ Seeded ${totalInserted} matches for ${tourney.editionName}`,
		);
	}

	console.log('\n🎉 All 2026 Rugby competitions seeded successfully!');
}

seed2026Rugby().catch((e) => {
	console.error('Fatal seed error:', e);
	process.exit(1);
});
