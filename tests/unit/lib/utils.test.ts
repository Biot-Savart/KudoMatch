import { cn, formatPoints } from '@/lib/utils';

describe('lib/utils', () => {
	describe('cn', () => {
		it('should merge tailwind classes correctly', () => {
			expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
			expect(
				cn('bg-red-500', { 'text-white': true, 'text-black': false }),
			).toBe('bg-red-500 text-white');
			expect(cn('p-4 p-8')).toBe('p-8'); // merges tailwind padding correctly via twMerge
		});
	});

	describe('formatPoints', () => {
		it('should format single point as pt', () => {
			expect(formatPoints(1)).toBe('1 pt');
		});

		it('should format multiple or zero points as pts', () => {
			expect(formatPoints(0)).toBe('0 pts');
			expect(formatPoints(5)).toBe('5 pts');
			expect(formatPoints(-2)).toBe('-2 pts');
		});
	});
});
