import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export type ProviderSlug = 'sofascore' | 'espn';

type JsonObject = { [key: string]: unknown };

export interface ProofProbeResult {
	provider: ProviderSlug;
	caseName: string;
	path: string;
	status: number | null;
	category:
		| 'success'
		| 'empty_success'
		| 'provider_error'
		| 'schema_error'
		| 'http_error'
		| 'network_error'
		| 'timeout';
	durationMs: number;
	responseBytes: number;
	contentType: string | null;
	retryAfter: string | null;
	shape: string[];
	expectedPaths: string[];
	eventCount: number | null;
	eventStates: string[];
	scoreFieldObserved: boolean;
	errorCode?: string;
}

export interface ProviderProofReport {
	schemaVersion: 1;
	capturedAt: string;
	mode: 'read-only' | 'write';
	runtime: 'local';
	userAgent: string;
	providers: Record<ProviderSlug, {
		baseUrl: string;
		probes: ProofProbeResult[];
		derivedSeasonIds: Record<string, string>;
	}>;
	coverage: Record<string, 'evidenced' | 'gap'>;
	policy: {
		maxRequestsPerProvider: number;
		maxRetries: number;
		timeoutMs: number;
		maxRetryAfterMs: number;
	};
}

interface ProbeSpec {
	provider: ProviderSlug;
	caseName: string;
	path: string;
	expectedPaths: string[];
	competitionSlug?: string;
}

interface ProbeResponse {
	status: number | null;
	body: unknown;
	contentType: string | null;
	retryAfter: string | null;
	responseBytes: number;
	durationMs: number;
	errorCode?: string;
}

const USER_AGENT = 'KudoMatch-provider-proof/1.0 (read-only evidence; contact project maintainers)';
const SOFASCORE_BASE_URL = 'https://www.sofascore.com/api/v1';
const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const MAX_RETRY_AFTER_MS = 10_000;
const MAX_REQUESTS_PER_PROVIDER = 12;

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getPath(value: unknown, pathExpression: string): unknown {
	return pathExpression.split('.').reduce<unknown>((current, key) => {
		if (!isObject(current)) return undefined;
		return current[key];
	}, value);
}

function hasPath(value: unknown, pathExpression: string): boolean {
	return getPath(value, pathExpression) !== undefined;
}

function shapeOf(value: unknown, prefix = ''): string[] {
	if (Array.isArray(value)) {
		const first = value[0];
		return first === undefined ? [`${prefix}[]`] : [`${prefix}[]`, ...shapeOf(first, `${prefix}[]`)].slice(0, 24);
	}
	if (!isObject(value)) return prefix ? [prefix] : [];
	return Object.keys(value).sort().slice(0, 24).flatMap((key) => {
		const next = prefix ? `${prefix}.${key}` : key;
		return [next];
	});
}

function eventSummary(value: unknown): { count: number | null; states: string[]; scoreFieldObserved: boolean } {
	if (!isObject(value) || !Array.isArray(value.events)) {
		return { count: null, states: [], scoreFieldObserved: false };
	}

	const states = new Set<string>();
	let scoreFieldObserved = false;
	for (const event of value.events) {
		if (!isObject(event)) continue;
		const status = getPath(event, 'status.type');
		if (isObject(status)) {
			for (const key of ['state', 'name', 'shortDetail']) {
				const state = status[key];
				if (typeof state === 'string' && state.length > 0) states.add(state);
			}
			if (status.completed === true) states.add('completed');
		}
		const competitions = event.competitions;
		if (Array.isArray(competitions) && competitions.some((competition) =>
			isObject(competition) && Array.isArray(competition.competitors) && competition.competitors.some((competitor) =>
				isObject(competitor) && competitor.score !== undefined,
		))) {
			scoreFieldObserved = true;
		}
	}
	return { count: value.events.length, states: Array.from(states).sort(), scoreFieldObserved };
}

function redactString(value: string): string {
	return value
		.replace(/(bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
		.replace(/(x-api-key\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
		.replace(/(api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

export function redactPayload(value: unknown, key = ''): unknown {
	const sensitiveKey = /(authorization|api[_-]?key|token|secret|password|cookie|subscription|account)/i.test(key);
	if (sensitiveKey) return '[REDACTED]';
	if (typeof value === 'string') return redactString(value);
	if (Array.isArray(value)) return value.map((item) => redactPayload(item));
	if (!isObject(value)) return value;

	return Object.fromEntries(
		Object.entries(value).map(([childKey, childValue]) => [childKey, redactPayload(childValue, childKey)]),
	);
}

function parseRetryAfter(value: string | null): number {
	if (!value) return 0;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, seconds * 1000));
	const date = Date.parse(value);
	return Number.isFinite(date)
		? Math.min(MAX_RETRY_AFTER_MS, Math.max(0, date - Date.now()))
		: 0;
}

function isRetryable(status: number | null, errorCode?: string): boolean {
	return status === 429 || (status !== null && status >= 500) || errorCode === 'timeout' || errorCode === 'network_error';
}

async function delay(ms: number): Promise<void> {
	if (ms <= 0) return;
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function requestJson(baseUrl: string, endpointPath: string): Promise<ProbeResponse> {
	let lastFailure: ProbeResponse | null = null;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
		const started = Date.now();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(`${baseUrl}${endpointPath}`, {
				headers: {
					accept: 'application/json',
					'user-agent': USER_AGENT,
				},
				signal: controller.signal,
			});
			const bodyText = await response.text();
			const contentType = response.headers.get('content-type');
			const retryAfter = response.headers.get('retry-after');
			let body: unknown = null;
			try {
				body = bodyText ? JSON.parse(bodyText) as unknown : null;
			} catch {
				body = bodyText.slice(0, 200);
			}
			const result: ProbeResponse = {
				status: response.status,
				body,
				contentType,
				retryAfter,
				responseBytes: Buffer.byteLength(bodyText, 'utf8'),
				durationMs: Date.now() - started,
			};
			if (!response.ok && isRetryable(response.status)) {
				lastFailure = { ...result, errorCode: response.status === 429 ? 'rate_limited' : `http_${response.status}` };
				await delay(parseRetryAfter(retryAfter));
				continue;
			}
			return result;
		} catch (error) {
			const errorCode = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error';
			lastFailure = {
				status: null,
				body: null,
				contentType: null,
				retryAfter: null,
				responseBytes: 0,
				durationMs: Date.now() - started,
				errorCode,
			};
			if (!isRetryable(null, errorCode)) return lastFailure;
			await delay(Math.min(MAX_RETRY_AFTER_MS, 250 * 2 ** attempt));
		} finally {
			clearTimeout(timer);
		}
	}

	return lastFailure ?? {
		status: null,
		body: null,
		contentType: null,
		retryAfter: null,
		responseBytes: 0,
		durationMs: 0,
		errorCode: 'network_error',
	};
}

function classify(body: unknown, response: ProbeResponse, expectedPaths: string[]): ProofProbeResult['category'] {
	if (response.errorCode === 'timeout') return 'timeout';
	if (response.errorCode === 'network_error') return 'network_error';
	if (response.status === null || response.status < 200 || response.status >= 300) return 'http_error';
	if (isObject(body) && (body.error !== undefined || body.errors !== undefined)) return 'provider_error';
	if (Array.isArray(body) && body.length === 0) return 'empty_success';
	if (isObject(body) && expectedPaths.length > 0 && !expectedPaths.some((expectedPath) => hasPath(body, expectedPath))) return 'schema_error';
	return 'success';
}

function currentSeasonId(body: unknown): string | null {
	if (!isObject(body) || !Array.isArray(body.seasons)) return null;
	const seasons = body.seasons.filter(isObject);
	const current = seasons.find((season) => season.isCurrent === true) ?? seasons[0];
	const id = current?.id;
	return typeof id === 'number' || typeof id === 'string' ? String(id) : null;
}

function buildSofaScoreSpecs(): ProbeSpec[] {
	const competitions = [
		{ slug: 'currie-cup', id: '796' },
		{ slug: 'urc', id: '419' },
	];
	return competitions.map(({ slug, id }) => ({
		provider: 'sofascore',
		caseName: `${slug}-seasons`,
		path: `/unique-tournament/${id}/seasons`,
		expectedPaths: ['seasons'],
		competitionSlug: slug,
	}));
}

function buildEspnSpecs(): ProbeSpec[] {
	const configured = process.env.ESPN_RUGBY_COMPETITIONS?.split(',').map((value) => value.trim()).filter(Boolean);
	const competitions = configured && configured.length > 0
		? configured.map((id) => ({ slug: id, id }))
		: [
			{ slug: 'currie-cup', id: '270555' },
			{ slug: 'urc', id: '270557' },
		];
	return competitions.flatMap(({ slug, id }) => [
		{
			provider: 'espn' as const,
			caseName: `${slug}-scoreboard`,
			path: `/sports/rugby/${encodeURIComponent(id)}/scoreboard`,
			expectedPaths: ['events'],
			competitionSlug: slug,
		},
		{
			provider: 'espn' as const,
			caseName: `${slug}-standings`,
			path: `/sports/rugby/${encodeURIComponent(id)}/standings`,
			expectedPaths: ['standings'],
			competitionSlug: slug,
		},
	]);
}

async function runProbes(provider: ProviderSlug, specs: ProbeSpec[], baseUrl: string): Promise<{
	probes: ProofProbeResult[];
	derivedSeasonIds: Record<string, string>;
	responses: Array<{ spec: ProbeSpec; body: unknown; result: ProofProbeResult }>;
}> {
	const responses: Array<{ spec: ProbeSpec; body: unknown; result: ProofProbeResult }> = [];
	const derivedSeasonIds: Record<string, string> = {};
	const selectedSpecs = specs.slice(0, MAX_REQUESTS_PER_PROVIDER);

	for (const spec of selectedSpecs) {
		const response = await requestJson(baseUrl, spec.path);
		const category = classify(response.body, response, spec.expectedPaths);
		const summary = eventSummary(response.body);
		const result: ProofProbeResult = {
			provider,
			caseName: spec.caseName,
			path: spec.path,
			status: response.status,
			category,
			durationMs: response.durationMs,
			responseBytes: response.responseBytes,
			contentType: response.contentType,
			retryAfter: response.retryAfter,
			shape: shapeOf(response.body),
			expectedPaths: spec.expectedPaths,
			eventCount: summary.count,
			eventStates: summary.states,
			scoreFieldObserved: summary.scoreFieldObserved,
			...(response.errorCode ? { errorCode: response.errorCode } : {}),
		};
		responses.push({ spec, body: response.body, result });
		if (provider === 'sofascore' && spec.competitionSlug) {
			const seasonId = currentSeasonId(response.body);
			if (seasonId) derivedSeasonIds[spec.competitionSlug] = seasonId;
		}
	}

	return { probes: responses.map(({ result }) => result), derivedSeasonIds, responses };
}

function buildCoverage(report: Omit<ProviderProofReport, 'coverage'>): Record<string, 'evidenced' | 'gap'> {
	const coverage: Record<string, 'evidenced' | 'gap'> = {};
	const allProbes = Object.values(report.providers).flatMap((provider) => provider.probes);
	const hasSuccess = (predicate: (probe: ProofProbeResult) => boolean) => allProbes.some(predicate) ? 'evidenced' : 'gap';

	coverage.catalog = hasSuccess((probe) => probe.caseName.includes('seasons') && probe.category === 'success');
	coverage.seasons = hasSuccess((probe) => probe.caseName.includes('seasons') && probe.category === 'success');
	coverage.teams = 'gap';
	coverage.events = hasSuccess((probe) => probe.caseName.includes('scoreboard') && probe.category === 'success');
	coverage.standings = 'gap';
	for (const status of ['scheduled', 'in_progress', 'completed', 'postponed', 'cancelled', 'missing_score', 'malformed']) {
		coverage[status] = hasSuccess((probe) => probe.eventStates.some((state) => state.toLowerCase().includes(status.replace('_', ' '))));
	}
	coverage.empty_success = hasSuccess((probe) => probe.category === 'empty_success');
	coverage.timeout_error = hasSuccess((probe) => probe.category === 'timeout');
	coverage.rate_limit = hasSuccess((probe) => probe.category === 'http_error' && probe.status === 429);
	coverage.event_detail = 'gap';
	return coverage;
}

async function writeEvidence(report: ProviderProofReport, responses: Array<{ spec: ProbeSpec; body: unknown; result: ProofProbeResult }>): Promise<void> {
	const root = path.resolve('tests/fixtures/providers');
	for (const { spec, body, result } of responses) {
		if (result.category !== 'success' && result.category !== 'empty_success') continue;
		const destination = path.join(root, spec.provider, 'rugby-union', `${spec.caseName}.json`);
		await fs.mkdir(path.dirname(destination), { recursive: true });
		await fs.writeFile(destination, `${JSON.stringify({
			evidence: {
				capturedAt: report.capturedAt,
				provider: spec.provider,
				path: spec.path,
				category: result.category,
			},
			payload: redactPayload(body),
		}, null, 2)}\n`, 'utf8');
	}

	const reportPath = path.join(root, 'phase-2-provider-proof.json');
	await fs.mkdir(path.dirname(reportPath), { recursive: true });
	await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export async function runProviderProof(write = false): Promise<ProviderProofReport> {
	const sofa = await runProbes('sofascore', buildSofaScoreSpecs(), SOFASCORE_BASE_URL);
	const espn = await runProbes('espn', buildEspnSpecs(), ESPN_BASE_URL);
	const baseReport = {
		schemaVersion: 1 as const,
		capturedAt: new Date().toISOString(),
		mode: write ? 'write' as const : 'read-only' as const,
		runtime: 'local' as const,
		userAgent: USER_AGENT,
		providers: {
			sofascore: { baseUrl: SOFASCORE_BASE_URL, probes: sofa.probes, derivedSeasonIds: sofa.derivedSeasonIds },
			espn: { baseUrl: ESPN_BASE_URL, probes: espn.probes, derivedSeasonIds: {} },
		},
		policy: {
			maxRequestsPerProvider: MAX_REQUESTS_PER_PROVIDER,
			maxRetries: MAX_RETRIES,
			timeoutMs: REQUEST_TIMEOUT_MS,
			maxRetryAfterMs: MAX_RETRY_AFTER_MS,
		},
	};
	const report: ProviderProofReport = { ...baseReport, coverage: buildCoverage(baseReport) };
	if (write) await writeEvidence(report, [...sofa.responses, ...espn.responses]);
	return report;
}

async function main(): Promise<void> {
	const write = process.argv.includes('--write');
	const report = await runProviderProof(write);
	console.log(JSON.stringify(report, null, 2));
}

if (path.basename(process.argv[1] ?? '') === 'prove-rugby-multi-provider.ts') {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : 'Provider proof failed');
		process.exitCode = 1;
	});
}
