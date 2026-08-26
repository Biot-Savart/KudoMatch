import { SupabaseClient } from '@supabase/supabase-js';
import { IngestionBatchPayload } from './dto';

export interface BatchUpsertResult {
	success: boolean;
	providerSlug: string;
	sportSlug: string;
	insertedCompetitors: number;
	updatedCompetitors: number;
	insertedEvents: number;
	updatedEvents: number;
	unchangedEvents: number;
	settledResults: number;
	error?: string;
}

/**
 * Executes an atomic batch write transaction via the service-role-only apply_canonical_ingestion_batch RPC
 */
export async function applyCanonicalIngestionBatch(
	supabase: SupabaseClient,
	batch: IngestionBatchPayload,
): Promise<BatchUpsertResult> {
	// Call RPC with batch payload
	const { data, error } = await supabase.rpc(
		'apply_canonical_ingestion_batch',
		{
			p_batch: batch,
		},
	);

	if (error) {
		console.error('Failed to apply canonical ingestion batch RPC:', error);
		return {
			success: false,
			providerSlug: batch.provider_slug,
			sportSlug: batch.sport_slug,
			insertedCompetitors: 0,
			updatedCompetitors: 0,
			insertedEvents: 0,
			updatedEvents: 0,
			unchangedEvents: 0,
			settledResults: 0,
			error: error.message,
		};
	}

	const res = (data || {}) as Record<string, unknown>;

	return {
		success: Boolean(res.success ?? true),
		providerSlug: batch.provider_slug,
		sportSlug: batch.sport_slug,
		insertedCompetitors: Number(res.inserted_competitors ?? 0),
		updatedCompetitors: Number(res.updated_competitors ?? 0),
		insertedEvents: Number(res.inserted_events ?? 0),
		updatedEvents: Number(res.updated_events ?? 0),
		unchangedEvents: Number(res.unchanged_events ?? 0),
		settledResults: Number(res.settled_results ?? 0),
	};
}
