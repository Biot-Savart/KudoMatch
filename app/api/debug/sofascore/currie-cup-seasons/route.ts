import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SOFASCORE_URL =
	'https://www.sofascore.com/api/v1/unique-tournament/796/seasons';
const REQUEST_TIMEOUT_MS = 20_000;

interface SofaScoreSeason {
	id: string | number;
	name: string;
	year: string;
	editor?: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSeasons(payload: unknown): SofaScoreSeason[] | null {
	if (!isObject(payload) || !Array.isArray(payload.seasons)) return null;

	const seasons: SofaScoreSeason[] = [];
	for (const value of payload.seasons) {
		if (!isObject(value)) return null;
		const { id, name, year, editor } = value;
		if (
			(typeof id !== 'string' && typeof id !== 'number') ||
			typeof name !== 'string' ||
			typeof year !== 'string'
		) {
			return null;
		}
		seasons.push({
			id,
			name,
			year,
			...(typeof editor === 'boolean' ? { editor } : {}),
		});
	}

	return seasons;
}

function isAuthorized(request: NextRequest): boolean {
	const expectedToken = process.env.SOFASCORE_DEBUG_TOKEN;
	if (!expectedToken && process.env.NODE_ENV !== 'production') return true;
	if (!expectedToken) return false;

	const authorization = request.headers.get('authorization');
	const debugToken = request.headers.get('x-sofascore-debug-token');
	return (
		authorization === `Bearer ${expectedToken}` ||
		debugToken === expectedToken
	);
}

function jsonResponse(body: unknown, status = 200): NextResponse {
	return NextResponse.json(body, {
		status,
		headers: { 'cache-control': 'no-store' },
	});
}

export async function GET(request: NextRequest): Promise<NextResponse> {
	if (!isAuthorized(request)) {
		return jsonResponse(
			{
				success: false,
				error: process.env.NODE_ENV === 'production'
					? 'Unauthorized.'
					: 'SOFASCORE_DEBUG_TOKEN is not configured.',
			},
			process.env.NODE_ENV === 'production' ? 401 : 503,
		);
	}

	const startedAt = Date.now();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const upstream = await fetch(SOFASCORE_URL, {
			headers: {
				accept: 'application/json',
				'user-agent':
					'KudoMatch-sofascore-debug/1.0 (read-only; contact project maintainers)',
			},
			signal: controller.signal,
		});
		const responseText = await upstream.text();
		let payload: unknown = null;
		try {
			payload = responseText ? (JSON.parse(responseText) as unknown) : null;
		} catch {
			payload = null;
		}

		const seasons = readSeasons(payload);
		return jsonResponse(
			{
				success: upstream.ok && seasons !== null,
				runtime: process.env.NODE_ENV,
				upstream: {
					status: upstream.status,
					ok: upstream.ok,
					durationMs: Date.now() - startedAt,
					contentType: upstream.headers.get('content-type'),
					retryAfter: upstream.headers.get('retry-after'),
					responseBytes: Buffer.byteLength(responseText, 'utf8'),
					topLevelKeys: isObject(payload) ? Object.keys(payload).sort() : [],
				},
				...(seasons
					? { seasonCount: seasons.length, seasons }
					: { error: 'Unexpected SofaScore seasons response shape.' }),
			},
			upstream.ok && seasons !== null ? 200 : 502,
		);
	} catch (error) {
		return jsonResponse(
			{
				success: false,
				runtime: process.env.NODE_ENV,
				error:
					error instanceof Error && error.name === 'AbortError'
						? 'SofaScore request timed out.'
						: 'SofaScore request failed from the application runtime.',
					durationMs: Date.now() - startedAt,
			},
			502,
		);
	} finally {
		clearTimeout(timeout);
	}
}
