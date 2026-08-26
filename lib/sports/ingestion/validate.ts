import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
} from './dto';

export class IngestionValidationError extends Error {
	public readonly code: string;
	public readonly entityKey?: string;

	constructor(message: string, code = 'INVALID_PAYLOAD', entityKey?: string) {
		super(message);
		this.name = 'IngestionValidationError';
		this.code = code;
		this.entityKey = entityKey;
	}
}

/**
 * Validates ISO-8601 UTC timestamp format
 */
export function validateIsoTimestamp(
	timestampStr: unknown,
	fieldName = 'timestamp',
): string {
	if (typeof timestampStr !== 'string' || !timestampStr.trim()) {
		throw new IngestionValidationError(
			`${fieldName} must be a non-empty string`,
			'INVALID_TIMESTAMP',
		);
	}

	const date = new Date(timestampStr);
	if (isNaN(date.getTime())) {
		throw new IngestionValidationError(
			`${fieldName} is not a valid date: '${timestampStr}'`,
			'INVALID_TIMESTAMP',
		);
	}

	return date.toISOString();
}

/**
 * Validates canonical competitor DTO
 */
export function validateCompetitorDTO(
	dto: unknown,
): asserts dto is CanonicalCompetitorDTO {
	if (!dto || typeof dto !== 'object') {
		throw new IngestionValidationError(
			'Competitor payload must be an object',
			'INVALID_COMPETITOR',
		);
	}

	const comp = dto as Record<string, unknown>;
	if (!comp.externalKey || typeof comp.externalKey !== 'string') {
		throw new IngestionValidationError(
			'Competitor externalKey is missing or invalid',
			'MISSING_EXTERNAL_KEY',
		);
	}

	if (!comp.name || typeof comp.name !== 'string' || !comp.name.trim()) {
		throw new IngestionValidationError(
			`Competitor name is missing for key ${comp.externalKey}`,
			'MISSING_NAME',
			comp.externalKey,
		);
	}
}

/**
 * Validates canonical event DTO
 */
export function validateEventDTO(
	dto: unknown,
): asserts dto is CanonicalEventDTO {
	if (!dto || typeof dto !== 'object') {
		throw new IngestionValidationError(
			'Event payload must be an object',
			'INVALID_EVENT',
		);
	}

	const event = dto as Record<string, unknown>;
	if (!event.externalKey || typeof event.externalKey !== 'string') {
		throw new IngestionValidationError(
			'Event externalKey is missing or invalid',
			'MISSING_EXTERNAL_KEY',
		);
	}

	if (
		!event.editionExternalKey ||
		typeof event.editionExternalKey !== 'string'
	) {
		throw new IngestionValidationError(
			`Event editionExternalKey is missing for event ${event.externalKey}`,
			'MISSING_EDITION_KEY',
			event.externalKey,
		);
	}

	validateIsoTimestamp(event.scheduledStartTime, 'scheduledStartTime');

	if (!Array.isArray(event.participants) || event.participants.length === 0) {
		throw new IngestionValidationError(
			`Event ${event.externalKey} must have at least one participant`,
			'MISSING_PARTICIPANTS',
			event.externalKey,
		);
	}

	for (const p of event.participants) {
		if (
			!p.competitorExternalKey ||
			typeof p.competitorExternalKey !== 'string'
		) {
			throw new IngestionValidationError(
				`Participant missing competitorExternalKey in event ${event.externalKey}`,
				'INVALID_PARTICIPANT',
				event.externalKey,
			);
		}
	}
}

/**
 * Validates canonical edition DTO
 */
export function validateEditionDTO(
	dto: unknown,
): asserts dto is CanonicalEditionDTO {
	if (!dto || typeof dto !== 'object') {
		throw new IngestionValidationError(
			'Edition payload must be an object',
			'INVALID_EDITION',
		);
	}

	const ed = dto as Record<string, unknown>;
	if (!ed.externalKey || typeof ed.externalKey !== 'string') {
		throw new IngestionValidationError(
			'Edition externalKey is missing',
			'MISSING_EXTERNAL_KEY',
		);
	}
	if (
		!ed.competitionExternalKey ||
		typeof ed.competitionExternalKey !== 'string'
	) {
		throw new IngestionValidationError(
			'Edition competitionExternalKey is missing',
			'MISSING_COMPETITION_KEY',
			ed.externalKey,
		);
	}
	if (!ed.seasonKey || typeof ed.seasonKey !== 'string') {
		throw new IngestionValidationError(
			'Edition seasonKey is missing',
			'MISSING_SEASON_KEY',
			ed.externalKey,
		);
	}
}

/**
 * Validates canonical competition DTO
 */
export function validateCompetitionDTO(
	dto: unknown,
): asserts dto is CanonicalCompetitionDTO {
	if (!dto || typeof dto !== 'object') {
		throw new IngestionValidationError(
			'Competition payload must be an object',
			'INVALID_COMPETITION',
		);
	}

	const comp = dto as Record<string, unknown>;
	if (!comp.externalKey || typeof comp.externalKey !== 'string') {
		throw new IngestionValidationError(
			'Competition externalKey is missing',
			'MISSING_EXTERNAL_KEY',
		);
	}
	if (!comp.sportSlug || typeof comp.sportSlug !== 'string') {
		throw new IngestionValidationError(
			'Competition sportSlug is missing',
			'MISSING_SPORT_SLUG',
			comp.externalKey,
		);
	}
}
