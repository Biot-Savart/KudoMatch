import * as fs from 'node:fs';
import * as path from 'node:path';

const fixtureDirectory = path.resolve('tests/fixtures/providers/sofascore/rugby-union');

const expectedFixtures = [
	'curl-cffi-proof.json',
	'currie-cup-completed-event.json',
	'currie-cup-events-last.json',
	'currie-cup-events-next.json',
	'currie-cup-scheduled-event.json',
	'currie-cup-seasons.json',
	'currie-cup-standings.json',
	'currie-cup-teams.json',
	'urc-events-last.json',
	'urc-events-next.json',
	'urc-seasons.json',
];

const sensitiveKeyPattern = /(authorization|api[_-]?key|token|secret|password|cookie|subscription|account)/i;

function findSensitiveKeys(value: unknown, key = ''): string[] {
	if (sensitiveKeyPattern.test(key)) return [key];
	if (Array.isArray(value)) return value.flatMap((item) => findSensitiveKeys(item));
	if (typeof value !== 'object' || value === null) return [];

	return Object.entries(value).flatMap(([childKey, childValue]) => findSensitiveKeys(childValue, childKey));
}

describe('SofaScore Rugby Union evidence fixtures', () => {
	it('contains the expected sanitized fixture corpus', () => {
		expect(fs.readdirSync(fixtureDirectory).filter((file) => file.endsWith('.json')).sort()).toEqual([...expectedFixtures].sort());

		for (const filename of expectedFixtures) {
			const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, filename), 'utf8')) as unknown;
			expect(findSensitiveKeys(fixture), filename).toEqual([]);
		}
	});

	it('preserves the key Currie Cup and URC identities used by the proof', () => {
		const currieSeasons = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'currie-cup-seasons.json'), 'utf8')) as {
			uniqueTournamentId: number;
			seasons: Array<{ id: number }>;
		};
		const urcSeasons = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'urc-seasons.json'), 'utf8')) as {
			uniqueTournamentId: number;
			seasons: Array<{ id: number }>;
		};
		const completed = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'currie-cup-completed-event.json'), 'utf8')) as {
			eventId: number;
			seasonId: number;
			statusType: string;
			homeScoreCurrent: number;
			awayScoreCurrent: number;
		};

		expect(currieSeasons).toMatchObject({ uniqueTournamentId: 796 });
		expect(currieSeasons.seasons[0]?.id).toBe(97057);
		expect(urcSeasons).toMatchObject({ uniqueTournamentId: 419 });
		expect(urcSeasons.seasons[0]?.id).toBe(98406);
		expect(completed).toMatchObject({
			eventId: 16393687,
			seasonId: 97057,
			statusType: 'finished',
			homeScoreCurrent: 24,
			awayScoreCurrent: 26,
		});
	});
});
