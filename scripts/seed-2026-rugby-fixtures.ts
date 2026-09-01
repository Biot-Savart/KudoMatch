import * as dotenv from 'dotenv';
import * as path from 'path';
import { createServiceRoleClient } from '../lib/supabase/server';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

interface TeamDef {
	name: string;
	shortName: string;
	countryCode?: string;
	mediaUrl?: string;
}

interface TournamentSeedConfig {
	slug: string;
	name: string;
	seasonKey: string;
	editionName: string;
	startDate: string;
	roundsCount: number;
	teams: TeamDef[];
}

const TOURNAMENT_SEEDS: TournamentSeedConfig[] = [
	{
		slug: 'six-nations',
		name: 'Six Nations Championship',
		seasonKey: '2026',
		editionName: 'Six Nations 2026',
		startDate: '2026-02-06T20:00:00Z',
		roundsCount: 5,
		teams: [
			{
				name: 'England Rugby',
				shortName: 'ENG',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/15.png',
			},
			{
				name: 'France Rugby',
				shortName: 'FRA',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/16.png',
			},
			{
				name: 'Ireland Rugby',
				shortName: 'IRE',
				countryCode: 'IE',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/17.png',
			},
			{
				name: 'Italy Rugby',
				shortName: 'ITA',
				countryCode: 'IT',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/18.png',
			},
			{
				name: 'Scotland Rugby',
				shortName: 'SCO',
				countryCode: 'GB-SCT',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/19.png',
			},
			{
				name: 'Wales Rugby',
				shortName: 'WAL',
				countryCode: 'GB-WLS',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/20.png',
			},
		],
	},
	{
		slug: 'currie-cup',
		name: 'Currie Cup',
		seasonKey: '2026',
		editionName: 'Currie Cup Premier Division · 2026',
		startDate: '2026-07-03T17:00:00Z',
		roundsCount: 10,
		teams: [
			{
				name: 'Vodacom Bulls',
				shortName: 'BUL',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/294.png',
			},
			{
				name: 'DHL Western Province',
				shortName: 'WP',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/303.png',
			},
			{
				name: 'Hollywoodbets Sharks',
				shortName: 'SHA',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/302.png',
			},
			{
				name: 'Fidelity ADT Lions',
				shortName: 'LIO',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/297.png',
			},
			{
				name: 'Toyota Cheetahs',
				shortName: 'CHE',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/295.png',
			},
			{
				name: 'Suzuki Griquas',
				shortName: 'GRI',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/304.png',
			},
			{
				name: 'Airlink Pumas',
				shortName: 'PUM',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/305.png',
			},
			{
				name: 'Novavit Griffons',
				shortName: 'GRIF',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/316.png',
			},
		],
	},
	{
		slug: 'super-rugby-pacific',
		name: 'Super Rugby Pacific',
		seasonKey: '2026',
		editionName: 'Super Rugby Pacific · 2026',
		startDate: '2026-02-13T08:35:00Z',
		roundsCount: 15,
		teams: [
			{
				name: 'Crusaders',
				shortName: 'CRU',
				countryCode: 'NZ',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/479.png',
			},
			{
				name: 'Blues',
				shortName: 'BLU',
				countryCode: 'NZ',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/2.png',
			},
			{
				name: 'Chiefs',
				shortName: 'CHI',
				countryCode: 'NZ',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/3.png',
			},
			{
				name: 'Hurricanes',
				shortName: 'HUR',
				countryCode: 'NZ',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/201.png',
			},
			{
				name: 'Highlanders',
				shortName: 'HIG',
				countryCode: 'NZ',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/480.png',
			},
			{
				name: 'ACT Brumbies',
				shortName: 'BRU',
				countryCode: 'AU',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/478.png',
			},
			{
				name: 'Queensland Reds',
				shortName: 'RED',
				countryCode: 'AU',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/482.png',
			},
			{
				name: 'NSW Waratahs',
				shortName: 'WAR',
				countryCode: 'AU',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/483.png',
			},
			{
				name: 'Western Force',
				shortName: 'FOR',
				countryCode: 'AU',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/9.png',
			},
			{
				name: 'Fijian Drua',
				shortName: 'DRU',
				countryCode: 'FJ',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/10.png',
			},
			{
				name: 'Moana Pasifika',
				shortName: 'MOA',
				countryCode: 'WS',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/11.png',
			},
		],
	},
	{
		slug: 'united-rugby-championship',
		name: 'United Rugby Championship',
		seasonKey: '2025-2026',
		editionName: 'United Rugby Championship · 2025/2026',
		startDate: '2025-09-26T18:30:00Z',
		roundsCount: 18,
		teams: [
			{
				name: 'Vodacom Bulls',
				shortName: 'BUL',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/294.png',
			},
			{
				name: 'DHL Stormers',
				shortName: 'STO',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/621.png',
			},
			{
				name: 'Hollywoodbets Sharks',
				shortName: 'SHA',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/302.png',
			},
			{
				name: 'Emirates Lions',
				shortName: 'LIO',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/297.png',
			},
			{
				name: 'Leinster Rugby',
				shortName: 'LEI',
				countryCode: 'IE',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/40.png',
			},
			{
				name: 'Munster Rugby',
				shortName: 'MUN',
				countryCode: 'IE',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/41.png',
			},
			{
				name: 'Ulster Rugby',
				shortName: 'ULS',
				countryCode: 'IE',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/42.png',
			},
			{
				name: 'Glasgow Warriors',
				shortName: 'GLA',
				countryCode: 'GB-SCT',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/43.png',
			},
			{
				name: 'Edinburgh Rugby',
				shortName: 'EDI',
				countryCode: 'GB-SCT',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/44.png',
			},
			{
				name: 'Cardiff Rugby',
				shortName: 'CAR',
				countryCode: 'GB-WLS',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/45.png',
			},
			{
				name: 'Ospreys',
				shortName: 'OSP',
				countryCode: 'GB-WLS',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/46.png',
			},
			{
				name: 'Benetton Rugby',
				shortName: 'BEN',
				countryCode: 'IT',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/47.png',
			},
		],
	},
	{
		slug: 'premiership-rugby',
		name: 'Premiership Rugby',
		seasonKey: '2025-2026',
		editionName: 'Premiership Rugby · 2025/2026',
		startDate: '2025-09-19T18:45:00Z',
		roundsCount: 18,
		teams: [
			{
				name: 'Bath Rugby',
				shortName: 'BAT',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/50.png',
			},
			{
				name: 'Northampton Saints',
				shortName: 'NOR',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/51.png',
			},
			{
				name: 'Saracens',
				shortName: 'SAR',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/52.png',
			},
			{
				name: 'Leicester Tigers',
				shortName: 'LEI',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/53.png',
			},
			{
				name: 'Harlequins',
				shortName: 'HAR',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/54.png',
			},
			{
				name: 'Sale Sharks',
				shortName: 'SAL',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/55.png',
			},
			{
				name: 'Bristol Bears',
				shortName: 'BRI',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/56.png',
			},
			{
				name: 'Exeter Chiefs',
				shortName: 'EXE',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/57.png',
			},
			{
				name: 'Gloucester Rugby',
				shortName: 'GLO',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/58.png',
			},
			{
				name: 'Newcastle Falcons',
				shortName: 'NEW',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/59.png',
			},
		],
	},
	{
		slug: 'top-14',
		name: 'French Top 14',
		seasonKey: '2025-2026',
		editionName: 'French Top 14 · 2025/2026',
		startDate: '2025-09-06T15:00:00Z',
		roundsCount: 26,
		teams: [
			{
				name: 'Stade Toulousain',
				shortName: 'TOU',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/60.png',
			},
			{
				name: 'Stade Français Paris',
				shortName: 'SFP',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/61.png',
			},
			{
				name: 'RC Toulonnais',
				shortName: 'RCT',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/62.png',
			},
			{
				name: 'Union Bordeaux Bègles',
				shortName: 'UBB',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/63.png',
			},
			{
				name: 'Racing 92',
				shortName: 'R92',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/64.png',
			},
			{
				name: 'Stade Rochelais',
				shortName: 'SR',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/65.png',
			},
			{
				name: 'Castres Olympique',
				shortName: 'CO',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/66.png',
			},
			{
				name: 'ASM Clermont Auvergne',
				shortName: 'ASM',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/67.png',
			},
		],
	},
	{
		slug: 'rugby-championship',
		name: 'The Rugby Championship',
		seasonKey: '2026',
		editionName: 'The Rugby Championship · 2026',
		startDate: '2026-08-08T15:00:00Z',
		roundsCount: 6,
		teams: [
			{
				name: 'South Africa (Springboks)',
				shortName: 'RSA',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/12.png',
			},
			{
				name: 'New Zealand (All Blacks)',
				shortName: 'NZL',
				countryCode: 'NZ',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/13.png',
			},
			{
				name: 'Australia (Wallabies)',
				shortName: 'AUS',
				countryCode: 'AU',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/14.png',
			},
			{
				name: 'Argentina (Los Pumas)',
				shortName: 'ARG',
				countryCode: 'AR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/15.png',
			},
		],
	},
	{
		slug: 'champions-cup',
		name: 'European Rugby Champions Cup',
		seasonKey: '2025-2026',
		editionName: 'Investec Champions Cup · 2025/2026',
		startDate: '2025-12-05T19:00:00Z',
		roundsCount: 8,
		teams: [
			{
				name: 'Stade Toulousain',
				shortName: 'TOU',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/60.png',
			},
			{
				name: 'Leinster Rugby',
				shortName: 'LEI',
				countryCode: 'IE',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/40.png',
			},
			{
				name: 'Stade Rochelais',
				shortName: 'SR',
				countryCode: 'FR',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/65.png',
			},
			{
				name: 'Vodacom Bulls',
				shortName: 'BUL',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/25.png',
			},
			{
				name: 'Northampton Saints',
				shortName: 'NOR',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/51.png',
			},
			{
				name: 'Bath Rugby',
				shortName: 'BAT',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/50.png',
			},
			{
				name: 'Harlequins',
				shortName: 'HAR',
				countryCode: 'GB-ENG',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/54.png',
			},
			{
				name: 'DHL Stormers',
				shortName: 'STO',
				countryCode: 'ZA',
				mediaUrl: 'https://media.api-sports.io/rugby/teams/26.png',
			},
		],
	},
];

async function seedAllRugby() {
	console.log('🏉 Seeding Complete 2026 Rugby Union Catalog & Fixtures...');
	const supabase = createServiceRoleClient();

	// 1. Ensure sport is active
	await supabase
		.from('sports')
		.update({ is_active: true })
		.eq('slug', 'rugby-union');

	// 2. Ruleset
	const { data: ruleset } = await supabase
		.from('scoring_rulesets')
		.select('id')
		.eq('sport_slug', 'rugby-union')
		.eq('market_kind', 'team_scoreline')
		.eq('version', 1)
		.single();

	if (!ruleset) throw new Error('Rugby scoreline ruleset not found');

	for (const t of TOURNAMENT_SEEDS) {
		console.log(`\n🏆 Processing ${t.name} (${t.slug})`);

		// Ensure competition exists
		const { data: comp } = await supabase
			.from('competitions')
			.upsert(
				{
					sport_slug: 'rugby-union',
					slug: t.slug,
					name: t.name,
					kind:
						t.slug.includes('cup') ||
						t.slug.includes('nations') ||
						t.slug.includes('championship')
							? 'cup'
							: 'league',
					is_active: true,
				},
				{ onConflict: 'sport_slug,slug' },
			)
			.select('id')
			.single();

		if (!comp) continue;

		// Ensure competition edition
		const { data: edition } = await supabase
			.from('competition_editions')
			.upsert(
				{
					competition_id: comp.id,
					season_key: t.seasonKey,
					name: t.editionName,
					starts_at: t.startDate,
					ends_at: new Date(
						new Date(t.startDate).getTime() + 200 * 24 * 3600 * 1000,
					).toISOString(),
					status: 'active',
					metadata: { format: 'round_robin', total_rounds: t.roundsCount },
				},
				{ onConflict: 'competition_id,season_key' },
			)
			.select('id')
			.single();

		if (!edition) continue;

		// Ensure competitors exist and map IDs
		const competitorIds: number[] = [];
		for (const team of t.teams) {
			const { data: existing } = await supabase
				.from('competitors')
				.select('id')
				.eq('sport_slug', 'rugby-union')
				.eq('name', team.name)
				.maybeSingle();

			let compId = existing?.id;
			if (!compId) {
				const { data: created, error: insErr } = await supabase
					.from('competitors')
					.insert({
						sport_slug: 'rugby-union',
						name: team.name,
						short_name: team.shortName,
						media_url: team.mediaUrl,
						country_code: team.countryCode,
						kind: 'team',
						is_active: true,
					})
					.select('id')
					.single();
				if (insErr) {
					console.error('Error inserting team', team.name, insErr);
				}
				compId = created?.id;
			} else {
				// Update media_url and short_name
				await supabase
					.from('competitors')
					.update({
						short_name: team.shortName,
						media_url: team.mediaUrl,
						country_code: team.countryCode,
					})
					.eq('id', compId);
			}

			if (compId) {
				competitorIds.push(Number(compId));
				await supabase.from('edition_competitors').upsert(
					{
						edition_id: edition.id,
						competitor_id: compId,
					},
					{ onConflict: 'edition_id,competitor_id' },
				);
			}
		}

		// Delete old placeholder events for this edition before re-inserting
		await supabase.from('events').delete().eq('edition_id', edition.id);

		const n = competitorIds.length;
		const baseTime = new Date(t.startDate).getTime();
		let matchCount = 0;

		for (let round = 1; round <= t.roundsCount; round++) {
			const roundLabel = `Round ${round}`;
			const roundTime = new Date(baseTime + (round - 1) * 7 * 24 * 3600 * 1000);
			const matchesInRound = Math.floor(n / 2);

			for (let m = 0; m < matchesInRound; m++) {
				const homeIdx = (round - 1 + m) % n;
				let awayIdx = (n - 1 - m + round - 1) % n;
				if (homeIdx === awayIdx) awayIdx = (awayIdx + 1) % n;

				const homeId = competitorIds[homeIdx];
				const awayId = competitorIds[awayIdx];
				if (!homeId || !awayId || homeId === awayId) continue;

				const matchKickoff = new Date(
					roundTime.getTime() + m * 2.5 * 3600 * 1000,
				);
				const isPast = matchKickoff.getTime() < Date.now();
				const status = isPast ? 'completed' : 'scheduled';

				// Insert event
				const { data: event, error: evErr } = await supabase
					.from('events')
					.insert({
						edition_id: edition.id,
						round_label: roundLabel,
						starts_at: matchKickoff.toISOString(),
						status,
						venue_name: `${t.teams[homeIdx]?.name || 'Home'} Stadium`,
					})
					.select('id')
					.single();

				if (evErr || !event) {
					console.error('Error inserting event:', evErr);
					continue;
				}

				// Insert event competitors
				await supabase.from('event_competitors').insert([
					{ event_id: event.id, competitor_id: homeId, slot: 1, role: 'home' },
					{ event_id: event.id, competitor_id: awayId, slot: 2, role: 'away' },
				]);

				// Insert market
				const { data: market, error: mktErr } = await supabase
					.from('event_markets')
					.insert({
						event_id: event.id,
						ruleset_id: ruleset.id,
						market_kind: 'team_scoreline',
						sequence_no: 1,
						status: isPast ? 'settled' : 'open',
						opens_at: new Date(
							matchKickoff.getTime() - 14 * 24 * 3600 * 1000,
						).toISOString(),
						locks_at: matchKickoff.toISOString(),
					})
					.select('id')
					.single();

				if (mktErr) {
					console.error('Market insert error:', mktErr);
				}

				// If completed match, insert realistic final rugby score
				if (isPast && market) {
					const homeScore = Math.floor(Math.random() * 26) + 16;
					const awayScore = Math.floor(Math.random() * 26) + 12;
					const winnerRole =
						homeScore > awayScore
							? 'home'
							: awayScore > homeScore
								? 'away'
								: 'draw';

					await supabase.from('market_results').insert({
						event_market_id: market.id,
						status: 'final',
						result: {
							home: homeScore,
							away: awayScore,
							homeScore,
							awayScore,
							winnerRole,
						},
						source_kind: 'provider',
						finalized_at: new Date(
							matchKickoff.getTime() + 2 * 3600 * 1000,
						).toISOString(),
						revision: 1,
					});
				}

				matchCount++;
			}
		}

		console.log(
			`✅ Seeded ${matchCount} matches across ${t.roundsCount} rounds for ${t.editionName}`,
		);
	}

	console.log(
		'\n🎉 Complete 2026 Rugby Union database seeding successfully completed!',
	);
}

seedAllRugby().catch((e) => {
	console.error('Fatal seed error:', e);
	process.exit(1);
});
