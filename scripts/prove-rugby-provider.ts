import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Provider proof is a server-side CLI. Load the local project environment when
// present so Bash, PowerShell, and CI invoke the same command consistently.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const baseUrl = process.env.API_SPORTS_RUGBY_BASE_URL || 'https://v1.rugby.api-sports.io';
const key = process.env.API_SPORTS_KEY;

if (!key) throw new Error('API_SPORTS_KEY is required and must remain server-only');
const providerKey = key;

async function request(endpoint: string) {
	const response = await fetch(`${baseUrl}${endpoint}`, { headers: { 'x-apisports-key': providerKey } });
	if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
	const payload = await response.json() as { errors?: unknown; results?: number; response?: unknown[] };
	if (payload.errors && (Array.isArray(payload.errors) ? payload.errors.length : Object.keys(payload.errors as object).length)) {
		throw new Error(`${endpoint}: provider error`);
	}
	return { ...payload, response: Array.isArray(payload.response) ? payload.response.slice(0, 25) : payload.response };
}

async function main() {
	const ids = JSON.parse(process.env.RUGBY_COMPETITION_IDS || '{}') as Record<string, string>;
	const firstLeague = Object.values(ids)[0] || '11';
	const season = process.env.RUGBY_PROVIDER_SEASON || new Date().getUTCFullYear().toString();
	const proof = {
		capturedAt: new Date().toISOString(),
		provider: 'api-sports',
		endpoints: {
			status: await request('/status'),
			leagues: await request('/leagues'),
			teams: await request(`/teams?league=${encodeURIComponent(firstLeague)}&season=${encodeURIComponent(season)}`),
			games: await request(`/games?league=${encodeURIComponent(firstLeague)}&season=${encodeURIComponent(season)}`),
		},
	};
	if (process.argv.includes('--write')) {
		const destination = path.resolve('tests/fixtures/providers/api-sports-rugby-proof.json');
		await fs.mkdir(path.dirname(destination), { recursive: true });
		await fs.writeFile(destination, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
	}
	console.log(JSON.stringify({ provider: proof.provider, capturedAt: proof.capturedAt, endpoints: Object.keys(proof.endpoints) }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
