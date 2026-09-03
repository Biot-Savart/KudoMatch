import * as dotenv from 'dotenv';
import * as path from 'path';
import { createServiceRoleClient } from '@/lib/supabase/server';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const OPERATIONS = ['list', 'map', 'create-and-map', 'ignore', 'remap', 'restore', 'resolve-conflict'] as const;
type Operation = (typeof OPERATIONS)[number];

function value(args: string[], name: string): string | undefined {
	return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

function usage(): never {
	throw new Error(
		'Usage: tsx scripts/manage-provider-mapping.ts <list|map|create-and-map|ignore|remap|restore> --source-id=<id> [--canonical-id=<id>] [--reason=<text>] [--apply] [--force] | resolve-conflict --event-id=<id> --provider=<slug> --reason=<text> --apply',
	);
}

async function main() {
	const args = process.argv.slice(2);
	const operation = ((args[0]?.startsWith('--') ? value(args, '--operation') : args[0]) || 'list') as Operation;
	if (!OPERATIONS.includes(operation)) usage();

	const db = createServiceRoleClient();
	if (operation === 'resolve-conflict') {
		const eventId = Number(value(args, '--event-id'));
		const providerSlug = value(args, '--provider');
		const reason = value(args, '--reason') || '';
		if (!Number.isSafeInteger(eventId) || eventId <= 0 || !providerSlug || !reason.trim() || !args.includes('--apply')) usage();
		const { data, error } = await db.rpc('resolve_provider_result_conflict', {
			p_event_id: eventId,
			p_chosen_provider_slug: providerSlug,
			p_reason: reason,
			p_actor_identity: value(args, '--actor') || 'conflict-cli',
			p_apply: true,
		});
		if (error) throw error;
		console.log(JSON.stringify({ operation, eventId, providerSlug, reason, applied: true, result: data }, null, 2));
		return;
	}
	if (operation === 'list') {
		let query = db
			.from('provider_catalog_sources')
			.select('id, provider_slug, sport_slug, entity_kind, external_key, display_name, mapping_status, competition_id, edition_id, competitor_id, last_fetched_at')
			.order('provider_slug')
			.order('entity_kind')
			.order('external_key');
		const provider = value(args, '--provider');
		const entityKind = value(args, '--entity-kind');
		const status = value(args, '--status');
		if (provider) query = query.eq('provider_slug', provider);
		if (entityKind) query = query.eq('entity_kind', entityKind);
		if (status) query = query.eq('mapping_status', status);
		const { data, error } = await query;
		if (error) throw error;
		console.log(JSON.stringify({ operation, dryRun: true, sources: data ?? [] }, null, 2));
		return;
	}

	const sourceId = Number(value(args, '--source-id'));
	if (!Number.isSafeInteger(sourceId) || sourceId <= 0) usage();
	const canonicalIdValue = value(args, '--canonical-id');
	const canonicalId = canonicalIdValue ? Number(canonicalIdValue) : undefined;
	if (canonicalIdValue && (!Number.isSafeInteger(canonicalId) || canonicalId! <= 0)) usage();
	const reason = value(args, '--reason') || '';
	if (operation === 'remap' && (!args.includes('--force') || !reason.trim())) {
		throw new Error('remap requires --force and a non-empty --reason');
	}
	if (operation === 'ignore' && !reason.trim()) {
		throw new Error('ignore requires a non-empty --reason');
	}

	const { data: source, error: sourceError } = await db
		.from('provider_catalog_sources')
		.select('id, provider_slug, entity_kind, external_key, display_name, mapping_status, competition_id, edition_id, competitor_id')
		.eq('id', sourceId)
		.single();
	if (sourceError) throw sourceError;

	const dryRun = !args.includes('--apply');
	const plan = { operation, source, canonicalId: canonicalId ?? null, reason, dryRun };
	if (dryRun) {
		console.log(JSON.stringify(plan, null, 2));
		return;
	}

	const { data, error } = await db.rpc('manage_provider_catalog_mapping', {
		p_source_id: sourceId,
		p_operation: operation,
		p_canonical_id: canonicalId ?? null,
		p_actor_identity: value(args, '--actor') || 'provider-mapping-cli',
		p_reason: reason,
	});
	if (error) throw error;
	console.log(JSON.stringify({ ...plan, result: data }, null, 2));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
