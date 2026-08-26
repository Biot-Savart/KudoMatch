import { CanonicalEventStatus, CanonicalResultStatus } from './dto';

/**
 * Normalizes raw external status string to canonical event status.
 * Throws error or returns undefined if unrecognized so the payload can be quarantined.
 */
export function normalizeEventStatus(rawStatus: string): CanonicalEventStatus {
	const status = (rawStatus || '').trim().toUpperCase();

	switch (status) {
		case 'NS':
		case 'NOT_STARTED':
		case 'SCHEDULED':
		case 'TIMED':
		case 'TBD':
			return 'scheduled';

		case '1H':
		case '2H':
		case 'HT':
		case 'ET':
		case 'BT':
		case 'LIVE':
		case 'IN_PLAY':
		case 'PAUSED':
		case 'BREAK':
			return 'live';

		case 'FT':
		case 'AET':
		case 'PEN':
		case 'FINISHED':
		case 'AWARDED':
		case 'AWD':
		case 'FINAL':
			return 'finished';

		case 'POST':
		case 'PST':
		case 'POSTPONED':
			return 'postponed';

		case 'CANC':
		case 'CAN':
		case 'CANCELLED':
			return 'cancelled';

		case 'ABD':
		case 'ABANDONED':
		case 'INTR':
		case 'INT':
		case 'INTERRUPTED':
		case 'SUSPENDED':
			return 'abandoned';

		default:
			throw new Error(`Unrecognized provider status: '${rawStatus}'`);
	}
}

/**
 * Derives canonical result status based on event status and available scores.
 */
export function deriveResultStatus(
	eventStatus: CanonicalEventStatus,
	hasScores: boolean,
): CanonicalResultStatus {
	if (eventStatus === 'finished') {
		return 'final';
	}
	if (eventStatus === 'live' && hasScores) {
		return 'provisional';
	}
	if (eventStatus === 'cancelled' || eventStatus === 'abandoned') {
		return 'void';
	}
	return 'provisional';
}
