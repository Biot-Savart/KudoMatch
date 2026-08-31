import { describe, expect, it } from 'vitest';
import { formatEditionLabel, formatMatchStart } from '@/lib/utils/display';

describe('display formatting', () => {
	it('formats canonical edition labels without provider IDs', () => {
		expect(formatEditionLabel()).toBe('Competition');
		expect(formatEditionLabel({ competition: { name: 'Rugby Championship' }, season_key: '2026' } as any)).toBe('Rugby Championship · 2026');
		expect(formatEditionLabel({ competition: { name: 'Rugby Championship' } } as any)).toBe('Rugby Championship');
		expect(formatEditionLabel({ season_key: '2026' } as any)).toBe('2026');
		expect(formatEditionLabel({} as any)).toBe('Competition');
	});

	it('formats valid dates and handles malformed values', () => {
		expect(formatMatchStart('not-a-date')).toBe('Date unavailable');
		const formatted = formatMatchStart('2026-09-25T16:45:00Z');
		expect(formatted).toContain('·');
		expect(formatted).not.toBe('Date unavailable');
	});
});
