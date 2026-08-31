import { createServiceRoleClient } from '@/lib/supabase/server';
import { RUGBY_COMPETITION_SLUGS } from '@/lib/sports/launch-manifest';

type Operation = 'reconcile' | 'activate' | 'deactivate';

async function main() {
	const args = process.argv.slice(2);
	const operation = (args.find((arg) => arg.startsWith('--operation='))?.split('=')[1] || 'reconcile') as Operation;
	const slug = args.find((arg) => arg.startsWith('--competition='))?.split('=')[1];
	const dryRun = !args.includes('--apply');
	if (!slug || !RUGBY_COMPETITION_SLUGS.includes(slug)) throw new Error(`A canonical rugby competition is required: ${RUGBY_COMPETITION_SLUGS.join(', ')}`);
	if (!['reconcile', 'activate', 'deactivate'].includes(operation)) throw new Error('operation must be reconcile, activate, or deactivate');

	const supabase = createServiceRoleClient();
	const { data: competition, error } = await supabase.from('competitions').select('id, slug, is_active').eq('slug', slug).eq('sport_slug', 'rugby-union').maybeSingle();
	if (error) throw error;
	if (!competition) throw new Error(`Competition '${slug}' is not present in the canonical catalog`);
	const { count: editionCount } = await supabase.from('competition_editions').select('id', { count: 'exact', head: true }).eq('competition_id', competition.id);
	const { count: referenceCount } = await supabase.from('external_entity_refs').select('id', { count: 'exact', head: true }).eq('entity_kind', 'competition').eq('competition_id', competition.id).eq('provider_slug', 'api-sports');
	const summary = { slug, operation, dryRun, active: competition.is_active, editionCount: editionCount ?? 0, providerReferenceCount: referenceCount ?? 0 };
	if (operation === 'reconcile') {
		if (!summary.providerReferenceCount) throw new Error(JSON.stringify({ ...summary, failure: 'missing api-sports competition reference' }));
		console.log(JSON.stringify({ ...summary, reconciled: true }));
		return;
	}
	if (dryRun) { console.log(JSON.stringify({ ...summary, plannedState: operation === 'activate' })); return; }
	const { error: updateError } = await supabase.from('competitions').update({ is_active: operation === 'activate' }).eq('id', competition.id);
	if (updateError) throw updateError;
	console.log(JSON.stringify({ ...summary, changed: true, is_active: operation === 'activate' }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

