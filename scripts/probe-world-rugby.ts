import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Phase 8 evidence tooling only. This is not a production adapter.
 *
 * The official World Rugby terms prohibit spidering/automated collection, so
 * the probe refuses to contact the provider until the operator confirms that
 * the specific access method is permitted. Requests are fixed, bounded GETs;
 * payloads are never stored.
 */

export const BASE_URL = 'https://api.wr-rims-prod.pulselive.com';
export const USER_AGENT = 'KudoMatch-Phase8-ReadOnly-Probe/1.0';
const REQUEST_TIMEOUT_MS = 20_000;

export const PROBES = [
	{
		name: 'current-international-catalog',
		path: '/rugby/v3/event?page=0&pageSize=10&sort=asc&sport=mru&startDate=2026-07-01&endDate=2026-11-30',
		expected: ['pageInfo', 'content'],
	},
	{
		name: 'rwc-2023-schedule',
		path: '/rugby/v3/event/1893/schedule?pageSize=100',
		expected: ['event', 'matches'],
	},
	{
		name: 'rwc-2023-standings',
		path: '/rugby/v3/event/1893/standings?pageSize=100',
		expected: ['event', 'tables'],
	},
	{
		name: 'rwc-2023-final',
		path: '/rugby/v3/match/28813',
		expected: ['matchId', 'teams', 'scores', 'status'],
	},
	{
		name: 'nations-2026-schedule',
		path: '/rugby/v3/event/46294cf5-dee3-4234-957a-dbe1f08049f2/schedule?pageSize=100',
		expected: ['event', 'matches'],
	},
	{
		name: 'world-rankings-men',
		path: '/rugby/v3/rankings/mru?page=0&pageSize=25&sort=asc',
		expected: ['label', 'entries', 'effective'],
	},
] as const;

type JsonObject = Record<string, unknown>;

export interface ProbeResult {
	name: string;
	path: string;
	status: number | null;
	category: 'success' | 'empty_success' | 'schema_error' | 'http_error' | 'timeout' | 'network_error';
	durationMs: number;
	responseBytes: number;
	contentType: string | null;
	rateLimit: string | null;
	rateRemaining: string | null;
	rateReset: string | null;
	shape: string[];
	observed: Record<string, unknown>;
	error?: string;
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasPath(value: unknown, expression: string): boolean {
	return expression.split('.').reduce<unknown>((current, key) => {
		if (!isObject(current)) return undefined;
		return current[key];
	}, value) !== undefined;
}

export function shapeOf(value: unknown, prefix = ''): string[] {
	if (Array.isArray(value)) {
		return value.length === 0 ? [`${prefix}[]`] : [`${prefix}[]`, ...shapeOf(value[0], `${prefix}[]`)].slice(0, 24);
	}
	if (!isObject(value)) return prefix ? [prefix] : [];
	return Object.keys(value).sort().slice(0, 24).map((key) => prefix ? `${prefix}.${key}` : key);
}

function classify(status: number | null, body: unknown, expected: readonly string[], error?: string): ProbeResult['category'] {
	if (error === 'timeout') return 'timeout';
	if (error === 'network_error') return 'network_error';
	if (status === null || status < 200 || status >= 300) return 'http_error';
	if (isObject(body) && Array.isArray(body.content) && body.content.length === 0) return 'empty_success';
	if (isObject(body) && Array.isArray(body.matches) && body.matches.length === 0) return 'empty_success';
	if (isObject(body) && expected.some((field) => !hasPath(body, field))) return 'schema_error';
	return 'success';
}

function observedFields(body: unknown): Record<string, unknown> {
	if (!isObject(body)) return {};
	const content = Array.isArray(body.content) ? body.content : [];
	const matches = Array.isArray(body.matches) ? body.matches : [];
	const entries = Array.isArray(body.entries) ? body.entries : [];
	const tables = Array.isArray(body.tables) ? body.tables : [];
	return {
		pageEntries: isObject(body.pageInfo) && typeof body.pageInfo.numEntries === 'number' ? body.pageInfo.numEntries : undefined,
		contentCount: content.length || undefined,
		matchCount: matches.length || undefined,
		entryCount: entries.length || undefined,
		tableCount: tables.length || undefined,
		matchId: typeof body.matchId === 'string' ? body.matchId : undefined,
		eventId: isObject(body.event) && (typeof body.event.id === 'string' || typeof body.event.id === 'number') ? String(body.event.id) : undefined,
		label: typeof body.label === 'string' ? body.label : isObject(body.event) && typeof body.event.label === 'string' ? body.event.label : undefined,
	};
}

async function request(pathname: string): Promise<{
	status: number | null;
	body: unknown;
	contentType: string | null;
	rateLimit: string | null;
	rateRemaining: string | null;
	rateReset: string | null;
	responseBytes: number;
	durationMs: number;
	error?: string;
}> {
	const started = Date.now();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(`${BASE_URL}${pathname}`, {
			headers: { accept: 'application/json', 'user-agent': USER_AGENT },
			signal: controller.signal,
		});
		const text = await response.text();
		let body: unknown = null;
		try {
			body = text ? JSON.parse(text) as unknown : null;
		} catch {
			body = null;
		}
		return {
			status: response.status,
			body,
			contentType: response.headers.get('content-type'),
			rateLimit: response.headers.get('x-ratelimit-limit'),
			rateRemaining: response.headers.get('x-ratelimit-remaining'),
			rateReset: response.headers.get('x-ratelimit-reset'),
			responseBytes: Buffer.byteLength(text, 'utf8'),
			durationMs: Date.now() - started,
		};
	} catch (error) {
		return {
			status: null,
			body: null,
			contentType: null,
			rateLimit: null,
			rateRemaining: null,
			rateReset: null,
			responseBytes: 0,
			durationMs: Date.now() - started,
			error: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
		};
	} finally {
		clearTimeout(timer);
	}
}

export async function runProof(): Promise<{ schemaVersion: 1; capturedAt: string; provider: 'world-rugby'; mode: 'read-only'; runtime: 'local'; baseUrl: string; userAgent: string; probes: ProbeResult[] }> {
	const probes: ProbeResult[] = [];
	for (const spec of PROBES) {
		const response = await request(spec.path);
		const category = classify(response.status, response.body, spec.expected, response.error);
		probes.push({
			name: spec.name,
			path: spec.path,
			status: response.status,
			category,
			durationMs: response.durationMs,
			responseBytes: response.responseBytes,
			contentType: response.contentType,
			rateLimit: response.rateLimit,
			rateRemaining: response.rateRemaining,
			rateReset: response.rateReset,
			shape: shapeOf(response.body),
			observed: observedFields(response.body),
			...(response.error ? { error: response.error } : {}),
		});
	}
	return {
		schemaVersion: 1,
		capturedAt: new Date().toISOString(),
		provider: 'world-rugby',
		mode: 'read-only',
		runtime: 'local',
		baseUrl: BASE_URL,
		userAgent: USER_AGENT,
		probes,
	};
}

async function main(): Promise<void> {
	if (!process.argv.includes('--confirm-permitted-access')) {
		console.error('Refusing to contact World Rugby without --confirm-permitted-access. Verify provider permission first.');
		process.exitCode = 2;
		return;
	}

	const report = await runProof();
	if (process.argv.includes('--write')) {
		const destination = path.resolve('tests/fixtures/providers/world-rugby/phase-8-probe.json');
		await fs.mkdir(path.dirname(destination), { recursive: true });
		await fs.writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
	}
	console.log(JSON.stringify(report, null, 2));
}

if (path.basename(process.argv[1] ?? '') === 'probe-world-rugby.ts') {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : 'World Rugby proof failed');
		process.exitCode = 1;
	});
}
