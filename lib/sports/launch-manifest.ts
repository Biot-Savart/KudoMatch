import { SportSlug } from '@/types';

export interface RugbyLaunchCompetition {
	slug: string;
	name: string;
	kind: 'league' | 'cup';
	country: string;
	/** Verified API-Sports league id; omitted until provider proof supplies it. */
	providerExternalKey?: string;
	seasonPolicy: 'current-and-upcoming' | 'history-and-current';
	displayOrder: number;
	isEnabled: boolean;
}

/** Versioned, reviewable launch contract. IDs are intentionally not guessed. */
export const RUGBY_LAUNCH_MANIFEST = {
	version: 1,
	sportSlug: 'rugby-union' as SportSlug,
	providerSlug: 'api-sports',
	competitions: [
		{
			slug: 'six-nations',
			name: 'Six Nations Championship',
			kind: 'cup',
			country: 'Europe',
			providerExternalKey: '11',
			seasonPolicy: 'history-and-current',
			displayOrder: 1,
			isEnabled: true,
		},
		{
			slug: 'united-rugby-championship',
			name: 'United Rugby Championship',
			kind: 'league',
			country: 'Europe',
			seasonPolicy: 'current-and-upcoming',
			displayOrder: 2,
			isEnabled: true,
		},
		{
			slug: 'rugby-championship',
			name: 'Rugby Championship',
			kind: 'cup',
			country: 'Southern Hemisphere',
			seasonPolicy: 'current-and-upcoming',
			displayOrder: 3,
			isEnabled: true,
		},
		{
			slug: 'premiership-rugby',
			name: 'Premiership Rugby',
			kind: 'league',
			country: 'England',
			seasonPolicy: 'current-and-upcoming',
			displayOrder: 4,
			isEnabled: true,
		},
		{
			slug: 'champions-cup',
			name: 'European Rugby Champions Cup',
			kind: 'cup',
			country: 'Europe',
			seasonPolicy: 'current-and-upcoming',
			displayOrder: 5,
			isEnabled: true,
		},
		{
			slug: 'top-14',
			name: 'French Top 14',
			kind: 'league',
			country: 'France',
			seasonPolicy: 'current-and-upcoming',
			displayOrder: 6,
			isEnabled: true,
		},
		{
			slug: 'super-rugby-pacific',
			name: 'Super Rugby Pacific',
			kind: 'league',
			country: 'Southern Hemisphere',
			seasonPolicy: 'current-and-upcoming',
			displayOrder: 7,
			isEnabled: true,
		},
		{
			slug: 'rugby-world-cup',
			name: 'Rugby World Cup',
			kind: 'cup',
			country: 'World',
			seasonPolicy: 'current-and-upcoming',
			displayOrder: 8,
			isEnabled: true,
		},
		{
			slug: 'currie-cup',
			name: 'Currie Cup',
			kind: 'league',
			country: 'South Africa',
			seasonPolicy: 'current-and-upcoming',
			displayOrder: 9,
			isEnabled: true,
		},
	] satisfies RugbyLaunchCompetition[],
} as const;

export const RUGBY_COMPETITION_SLUGS = RUGBY_LAUNCH_MANIFEST.competitions.map(
	(competition) => competition.slug,
);
