import { createClient } from '@/lib/supabase/client';
import { Sport } from '@/types';

export const sportsQueryKeys = {
	all: ['sports'] as const,
	active: () => [...sportsQueryKeys.all, 'active'] as const,
};

export async function fetchActiveSports(): Promise<Sport[]> {
	const supabase = createClient();
	const { data, error } = await supabase
		.from('sports')
		.select('*')
		.eq('is_active', true)
		.order('display_order', { ascending: true });

	if (error) {
		console.error('Error fetching active sports:', error);
		throw error;
	}

	return (data ?? []).map((row) => ({
		slug: row.slug,
		name: row.name,
		icon_key: row.icon_key,
		default_score_unit: row.default_score_unit,
		is_active: row.is_active,
		display_order: row.display_order,
		created_at: row.created_at,
		updated_at: row.updated_at,
	}));
}
