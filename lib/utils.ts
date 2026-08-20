import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatPoints(points: number): string {
	return points === 1 ? '1 pt' : `${points} pts`;
}
