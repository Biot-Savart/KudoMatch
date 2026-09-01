import { createClient } from '@/lib/supabase/client';
import {
	CompetitorRole,
	EventCompetitor,
	EventMarket,
	MarketPrediction,
	MarketResult,
	ScoringRuleset,
	SportEvent,
} from '@/types';

export interface EventFilterOptions {
	sportSlug?: string;
	competitionId?: string;
	editionId?: string;
	roundLabel?: string;
	status?: string;
	userId?: string;
	limit?: number;
}

export const eventsQueryKeys = {
	all: ['events'] as const,
	list: (filters: EventFilterOptions = {}) =>
		[
			...eventsQueryKeys.all,
			'list',
			{
				sportSlug: filters.sportSlug ?? 'all',
				competitionId: filters.competitionId ?? 'all',
				editionId: filters.editionId ?? 'all',
				roundLabel: filters.roundLabel ?? 'all',
				status: filters.status ?? 'all',
				userId: filters.userId ?? 'anon',
			},
		] as const,
	detail: (id: string, userId?: string) =>
		[...eventsQueryKeys.all, 'detail', id, userId ?? 'anon'] as const,
};

function mapEventRow(
	row: any,
	userPredictionMap?: Map<string, any>,
): SportEvent {
	const competitors: EventCompetitor[] = (row.event_competitors ?? [])
		.map((ec: any) => ({
			event_id: String(ec.event_id),
			competitor_id: String(ec.competitor_id),
			slot: ec.slot,
			role: ec.role as CompetitorRole,
			created_at: ec.created_at,
			competitor: ec.competitors
				? {
						id: String(ec.competitors.id),
						sport_slug: ec.competitors.sport_slug,
						kind: ec.competitors.kind,
						name: ec.competitors.name,
						short_name: ec.competitors.short_name,
						media_url: ec.competitors.media_url,
						country_code: ec.competitors.country_code,
						is_active: ec.competitors.is_active,
						created_at: ec.competitors.created_at,
						updated_at: ec.competitors.updated_at,
					}
				: undefined,
		}))
		.sort((a: EventCompetitor, b: EventCompetitor) => a.slot - b.slot);

	const markets: EventMarket[] = (row.event_markets ?? []).map((m: any) => {
		const marketId = String(m.id);
		const userPred = userPredictionMap?.get(marketId);

		let ruleset: ScoringRuleset | undefined;
		if (m.scoring_rulesets) {
			ruleset = {
				id: String(m.scoring_rulesets.id),
				sport_slug: m.scoring_rulesets.sport_slug,
				market_kind: m.scoring_rulesets.market_kind,
				evaluator_key: m.scoring_rulesets.evaluator_key,
				version: m.scoring_rulesets.version,
				max_raw_points: m.scoring_rulesets.max_raw_points,
				evaluator_config:
					(m.scoring_rulesets.evaluator_config as Record<string, any>) ?? {},
				ui_config: (m.scoring_rulesets.ui_config as Record<string, any>) ?? {},
				is_active: m.scoring_rulesets.is_active,
				created_at: m.scoring_rulesets.created_at,
				updated_at: m.scoring_rulesets.updated_at,
				tiers: (m.scoring_rulesets.scoring_rule_tiers ?? []).map((t: any) => ({
					ruleset_id: String(t.ruleset_id),
					tier_code: t.tier_code,
					raw_points: t.raw_points,
					rank_order: t.rank_order,
					label: t.label,
					description: t.description,
					example: t.example,
				})),
			};
		}

		let result: MarketResult | undefined;
		const resRow = Array.isArray(m.market_results)
			? m.market_results[0]
			: m.market_results;
		if (resRow) {
			result = {
				event_market_id: String(resRow.event_market_id),
				result: resRow.result,
				revision: resRow.revision,
				status: resRow.status,
				source_kind: resRow.source_kind,
				source_ref: resRow.source_ref,
				source_priority: resRow.source_priority,
				finalized_at: resRow.finalized_at,
				created_at: resRow.created_at,
				updated_at: resRow.updated_at,
			};
		}

		let userPrediction: MarketPrediction | undefined;
		if (userPred) {
			userPrediction = {
				id: String(userPred.id),
				user_id: userPred.user_id,
				event_market_id: String(userPred.event_market_id),
				selection: userPred.selection,
				settlement_status: userPred.settlement_status,
				ruleset_id: userPred.ruleset_id ? String(userPred.ruleset_id) : null,
				result_revision: userPred.result_revision,
				tier_code: userPred.tier_code,
				raw_points: userPred.raw_points,
				normalized_basis_points: userPred.normalized_basis_points,
				settled_at: userPred.settled_at,
				created_at: userPred.created_at,
				updated_at: userPred.updated_at,
			};
		}

		return {
			id: marketId,
			event_id: String(m.event_id),
			market_kind: m.market_kind,
			payload_schema_version: m.payload_schema_version,
			ruleset_id: String(m.ruleset_id),
			sequence_no: m.sequence_no,
			is_current: m.is_current,
			opens_at: m.opens_at,
			locks_at: m.locks_at,
			status: m.status,
			created_at: m.created_at,
			updated_at: m.updated_at,
			ruleset,
			result,
			user_prediction: userPrediction,
		};
	});

	const currentMarket = markets.find((m) => m.is_current) ?? markets[0];

	return {
		id: String(row.id),
		edition_id: String(row.edition_id),
		kind: row.kind,
		starts_at: row.starts_at,
		status: row.status,
		round_label: row.round_label,
		sequence_number: row.sequence_number,
		venue_name: row.venue_name,
		is_neutral_venue: row.is_neutral_venue,
		metadata: (row.metadata as Record<string, any>) ?? {},
		created_at: row.created_at,
		updated_at: row.updated_at,
		edition: row.competition_editions
			? {
					id: String(row.competition_editions.id),
					competition_id: String(row.competition_editions.competition_id),
					season_key: row.competition_editions.season_key,
					name: row.competition_editions.name,
					starts_at: row.competition_editions.starts_at,
					ends_at: row.competition_editions.ends_at,
					status: row.competition_editions.status,
					metadata:
						(row.competition_editions.metadata as Record<string, any>) ?? {},
					created_at: row.competition_editions.created_at,
					updated_at: row.competition_editions.updated_at,
					competition: row.competition_editions.competitions
						? {
								id: String(row.competition_editions.competitions.id),
								sport_slug: row.competition_editions.competitions.sport_slug,
								slug: row.competition_editions.competitions.slug,
								name: row.competition_editions.competitions.name,
								kind: row.competition_editions.competitions.kind,
								country: row.competition_editions.competitions.country,
								logo_url: row.competition_editions.competitions.logo_url,
								is_active: row.competition_editions.competitions.is_active,
								created_at: row.competition_editions.competitions.created_at,
								updated_at: row.competition_editions.competitions.updated_at,
							}
						: undefined,
				}
			: undefined,
		competitors,
		markets,
		current_market: currentMarket,
	};
}

export async function fetchEvents(
	filters: EventFilterOptions = {},
): Promise<SportEvent[]> {
	const supabase = createClient();

	let query = supabase
		.from('events')
		.select(
			`
			*,
			competition_editions:competition_editions!inner(
				*,
				competitions:competitions!inner(*)
			),
			event_competitors:event_competitors(
				*,
				competitors:competitors(*)
			),
			event_markets:event_markets(
				*,
				scoring_rulesets:scoring_rulesets(
					*,
					scoring_rule_tiers:scoring_rule_tiers(*)
				),
				market_results:market_results(*)
			)
		`,
		)
		.order('starts_at', { ascending: true })
		.order('id', { ascending: true });

	if (filters.editionId && filters.editionId !== 'all') {
		query = query.eq('edition_id', filters.editionId);
	}
	if (filters.competitionId && filters.competitionId !== 'all') {
		query = query.eq(
			'competition_editions.competition_id',
			filters.competitionId,
		);
	}
	if (filters.sportSlug && filters.sportSlug !== 'all') {
		query = query.eq(
			'competition_editions.competitions.sport_slug',
			filters.sportSlug,
		);
	}
	query = query.eq('competition_editions.competitions.is_active', true);

	if (filters.roundLabel && filters.roundLabel !== 'all') {
		query = query.eq('round_label', filters.roundLabel);
	}

	if (filters.status && filters.status !== 'all') {
		query = query.eq('status', filters.status);
	}

	if (filters.limit) {
		query = query.limit(filters.limit);
	}

	const { data, error } = await query;

	if (error) {
		console.error('Error fetching events:', error);
		throw error;
	}

	const rawEvents = data ?? [];

	// Fetch user predictions if userId is provided
	let userPredictionMap = new Map<string, any>();
	if (filters.userId && rawEvents.length > 0) {
		const marketIds: string[] = [];
		for (const ev of rawEvents) {
			for (const m of (ev as any).event_markets ?? []) {
				marketIds.push(String(m.id));
			}
		}

		if (marketIds.length > 0) {
			const { data: userPreds, error: predError } = await supabase
				.from('predictions')
				.select('*')
				.eq('user_id', filters.userId)
				.in('event_market_id', marketIds);

			if (!predError && userPreds) {
				for (const p of userPreds) {
					userPredictionMap.set(String(p.event_market_id), p);
				}
			}
		}
	}

	return rawEvents.map((row) => mapEventRow(row, userPredictionMap));
}

export async function fetchEventById(
	eventId: string,
	userId?: string,
): Promise<SportEvent | null> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('events')
		.select(
			`
			*,
			competition_editions:competition_editions(
				*,
				competitions:competitions(*)
			),
			event_competitors:event_competitors(
				*,
				competitors:competitors(*)
			),
			event_markets:event_markets(
				*,
				scoring_rulesets:scoring_rulesets(
					*,
					scoring_rule_tiers:scoring_rule_tiers(*)
				),
				market_results:market_results(*)
			)
		`,
		)
		.eq('id', eventId)
		.single();

	if (error || !data) {
		if (error && error.code !== 'PGRST116') {
			console.error(`Error fetching event ${eventId}:`, error);
		}
		return null;
	}

	let userPredictionMap = new Map<string, any>();
	if (userId) {
		const marketIds = ((data as any).event_markets ?? []).map((m: any) =>
			String(m.id),
		);
		if (marketIds.length > 0) {
			const { data: userPreds } = await supabase
				.from('predictions')
				.select('*')
				.eq('user_id', userId)
				.in('event_market_id', marketIds);

			if (userPreds) {
				for (const p of userPreds) {
					userPredictionMap.set(String(p.event_market_id), p);
				}
			}
		}
	}

	return mapEventRow(data, userPredictionMap);
}
