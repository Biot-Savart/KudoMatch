import { z } from 'zod';

const isoTimestamp = z.string().datetime({ offset: true });

export const providerSourceMetadataSchema = z.object({
	fetchedAt: isoTimestamp,
	providerUpdatedAt: isoTimestamp.optional(),
	schemaVersion: z.number().int().positive(),
	rawPayload: z.unknown(),
});

export const canonicalCompetitionSchema = z.object({
	externalKey: z.string().min(1),
	sportSlug: z.string().min(1),
	slug: z.string().min(1),
	name: z.string().min(1),
	kind: z.enum(['league', 'cup', 'tournament', 'friendly']),
	country: z.string().optional(),
	logoUrl: z.string().url().optional(),
	isActive: z.boolean().optional(),
	sourceMetadata: providerSourceMetadataSchema.optional(),
});

export const canonicalEditionSchema = z.object({
	externalKey: z.string().min(1),
	competitionExternalKey: z.string().min(1),
	seasonKey: z.string().min(1),
	name: z.string().min(1),
	startsAt: isoTimestamp.optional(),
	endsAt: isoTimestamp.optional(),
	status: z.enum(['planned', 'active', 'completed', 'archived']),
	metadata: z.record(z.unknown()).optional(),
	sourceMetadata: providerSourceMetadataSchema.optional(),
});

export const canonicalCompetitorSchema = z.object({
	externalKey: z.string().min(1),
	name: z.string().min(1),
	shortName: z.string().optional(),
	countryCode: z.string().optional(),
	mediaUrl: z.string().url().optional(),
	kind: z.enum(['team', 'individual', 'pair']).optional(),
	isActive: z.boolean().optional(),
	sourceMetadata: providerSourceMetadataSchema.optional(),
});

export const canonicalEventSchema = z.object({
	externalKey: z.string().min(1),
	editionExternalKey: z.string().min(1),
	roundName: z.string().optional(),
	scheduledStartTime: isoTimestamp,
	status: z.enum(['scheduled', 'live', 'finished', 'postponed', 'cancelled', 'abandoned']),
	venue: z.string().optional(),
	participants: z.array(z.object({
		competitorExternalKey: z.string().min(1),
		role: z.enum(['home', 'away', 'competitor']),
		slotNumber: z.number().int().positive(),
	})).min(1),
	market: z.object({
		marketKey: z.string().min(1),
		rulesetVersion: z.number().int().positive().optional(),
		marketSchemaVersion: z.number().int().positive().optional(),
		lockAt: isoTimestamp.optional(),
		status: z.enum(['open', 'locked', 'settled', 'void']),
	}).optional(),
	result: z.object({
		status: z.enum(['provisional', 'final', 'void']),
		resultPayload: z.object({
			homeScore: z.number().int().nonnegative().nullable(),
			awayScore: z.number().int().nonnegative().nullable(),
			periodScores: z.record(z.number().int().nonnegative().nullable()).optional(),
			winnerRole: z.enum(['home', 'away', 'draw']).nullable().optional(),
		}).passthrough(),
		verifiedAt: isoTimestamp.nullable().optional(),
		revisionNumber: z.number().int().positive().optional(),
		payloadSchemaVersion: z.number().int().positive().optional(),
	}).optional(),
	metadata: z.record(z.unknown()).optional(),
	sourceMetadata: providerSourceMetadataSchema.optional(),
});

export type CanonicalProviderSchema =
	| typeof canonicalCompetitionSchema
	| typeof canonicalEditionSchema
	| typeof canonicalCompetitorSchema
	| typeof canonicalEventSchema;
