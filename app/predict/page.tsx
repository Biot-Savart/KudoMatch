'use client';

import { ErrorBoundary } from '@/components/error-boundary';
import { EventCard } from '@/components/event-card';
import { GameweekPerformanceSummary } from '@/components/gameweek-performance-summary';
import { MatchPoolInsightsModal } from '@/components/match-pool-insights-modal';
import { ParticipantCrest } from '@/components/participant-crest';
import { PredictionDrawer } from '@/components/prediction-drawer';
import { ScoreBreakdownModal } from '@/components/score-breakdown-modal';
import { ScoringRulesModal } from '@/components/scoring-rules-modal';
import { Button } from '@/components/ui/button';
import { MatchCardSkeleton } from '@/components/ui/match-card-skeleton';
import {
	fetchActiveCompetitions,
	fetchCompetitionEditions,
	fetchEditionRounds,
} from '@/lib/queries/competitions';
import { eventsQueryKeys, fetchEvents } from '@/lib/queries/events';
import { submitPrediction } from '@/lib/queries/predictions';
import { fetchActiveSports } from '@/lib/queries/sports';
import { createClient } from '@/lib/supabase/client';
import { formatEditionLabel } from '@/lib/utils/display';
import {
	Competition,
	MarketPrediction,
	Sport,
	SportEvent,
	TeamScorelineSelection,
} from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	BookOpen,
	ChevronLeft,
	ChevronRight,
	Clock,
	Trophy,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

function PredictContent() {
	const supabase = createClient();
	const queryClient = useQueryClient();
	const router = useRouter();
	const searchParams = useSearchParams();
	const railRef = useRef<HTMLDivElement>(null);

	const [user, setUser] = useState<any>(null);
	const [userLoading, setUserLoading] = useState(true);
	const [activeEvent, setActiveEvent] = useState<SportEvent | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);

	// URL-backed Filter Dimensions
	const sportParam = searchParams.get('sport') || 'football';
	const competitionParam = searchParams.get('competition') || '';
	const editionParam = searchParams.get('edition') || '';
	const roundParam = searchParams.get('round') || '';

	const scrollRail = (direction: 'left' | 'right') => {
		if (railRef.current) {
			railRef.current.scrollBy({
				left: direction === 'left' ? -260 : 260,
				behavior: 'smooth',
			});
		}
	};

	// Modals State
	const [breakdownEvent, setBreakdownEvent] = useState<SportEvent | null>(null);
	const [breakdownPrediction, setBreakdownPrediction] =
		useState<MarketPrediction | null>(null);
	const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

	const [insightsEvent, setInsightsEvent] = useState<SportEvent | null>(null);
	const [isInsightsOpen, setIsInsightsOpen] = useState(false);

	const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

	// Get active session
	useEffect(() => {
		const getSession = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setUser(user);
			setUserLoading(false);
		};
		getSession();
	}, [supabase]);

	// Fetch active sports
	const { data: sports = [] } = useQuery<Sport[]>({
		queryKey: ['sports', 'active'],
		queryFn: fetchActiveSports,
	});

	// Fetch active competitions for selected sport
	const { data: competitions = [] } = useQuery<Competition[]>({
		queryKey: ['competitions', sportParam],
		queryFn: () => fetchActiveCompetitions(sportParam),
	});

	// Fetch active editions for selected sport
	const { data: editions = [] } = useQuery({
		queryKey: ['competition_editions', sportParam, competitionParam],
		queryFn: () =>
			fetchCompetitionEditions({
				sportSlug: sportParam,
				competitionId: competitionParam || undefined,
				statuses: ['active', 'planned', 'completed'],
			}),
	});

	const now = Date.now();
	const activeEdition =
		editions.find((ed) => ed.id === editionParam) ??
		editions.find(
			(ed) =>
				ed.status === 'active' &&
				new Date(ed.starts_at).getTime() <= now &&
				(!ed.ends_at || new Date(ed.ends_at).getTime() >= now),
		) ??
		editions
			.filter((ed) => ed.status === 'active')
			.sort(
				(a, b) =>
					new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
			)[0] ??
		editions
			.filter(
				(ed) =>
					ed.status === 'planned' && new Date(ed.starts_at).getTime() >= now,
			)
			.sort(
				(a, b) =>
					new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
			)[0] ??
		editions
			.filter((ed) => ed.status === 'completed')
			.sort(
				(a, b) =>
					new Date(b.ends_at || b.starts_at).getTime() -
					new Date(a.ends_at || a.starts_at).getTime(),
			)[0] ??
		editions[0];

	const activeEditionId = activeEdition?.id;
	const activeCompetitionId = competitionParam || activeEdition?.competition_id;

	// Fetch rounds for active edition
	const { data: availableRounds = [] } = useQuery<string[]>({
		queryKey: ['edition_rounds', activeEditionId ?? 'none'],
		queryFn: () =>
			activeEditionId
				? fetchEditionRounds(activeEditionId)
				: Promise.resolve([]),
		enabled: !!activeEditionId,
	});

	const activeRound =
		roundParam && availableRounds.includes(roundParam)
			? roundParam
			: availableRounds[0] || 'Round 1';

	// Update URL when dimension changes
	const updateFilters = (
		sport: string,
		editionId?: string,
		round?: string,
		competitionId?: string,
	) => {
		const params = new URLSearchParams();
		params.set('sport', sport);
		if (competitionId) params.set('competition', competitionId);
		if (editionId) params.set('edition', editionId);
		if (round) params.set('round', round);
		router.push(`/predict?${params.toString()}`);
	};

	// Setup Realtime Subscriptions
	useEffect(() => {
		const channel = supabase
			.channel('public:events_realtime')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'events',
				},
				() => {
					queryClient.invalidateQueries({ queryKey: eventsQueryKeys.all });
				},
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'market_results',
				},
				() => {
					queryClient.invalidateQueries({ queryKey: eventsQueryKeys.all });
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [supabase, queryClient]);

	// Fetch Events
	const {
		data: events = [],
		isLoading: eventsLoading,
		error: eventsError,
	} = useQuery({
		queryKey: eventsQueryKeys.list({
			sportSlug: sportParam,
			competitionId: competitionParam || undefined,
			editionId: activeEditionId,
			roundLabel: activeRound,
			userId: user?.id,
		}),
		queryFn: () =>
			fetchEvents({
				sportSlug: sportParam,
				competitionId: competitionParam || undefined,
				editionId: activeEditionId,
				roundLabel: activeRound,
				userId: user?.id,
			}),
		enabled: !userLoading,
	});

	// Quick predict mutation
	const quickPredictMutation = useMutation({
		mutationFn: async ({
			marketId,
			home,
			away,
		}: {
			marketId: string;
			home: number;
			away: number;
		}) => {
			if (!user?.id) throw new Error('Authentication required');
			const selection: TeamScorelineSelection = {
				kind: 'team_scoreline',
				version: 1,
				home,
				away,
			};
			return submitPrediction(user.id, marketId, selection);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: eventsQueryKeys.all });
			toast.success('Quick pick submitted!');
		},
		onError: (err: any) => {
			toast.error(err.message || 'Failed to submit quick prediction.');
		},
	});

	const handleOpenPredictDrawer = (event: SportEvent) => {
		setActiveEvent(event);
		setIsDrawerOpen(true);
	};

	const handleQuickPredict = (marketId: string, home: number, away: number) => {
		if (!user) {
			toast.error('Please sign in to make predictions!');
			router.push('/login');
			return;
		}
		quickPredictMutation.mutate({ marketId, home, away });
	};

	const handleOpenBreakdown = (
		event: SportEvent,
		prediction?: MarketPrediction | null,
	) => {
		setBreakdownEvent(event);
		setBreakdownPrediction(prediction ?? null);
		setIsBreakdownOpen(true);
	};

	const handleOpenInsights = (event: SportEvent) => {
		setInsightsEvent(event);
		setIsInsightsOpen(true);
	};

	// Map of predictions for summary calculations
	const predictionsMap = new Map<string, MarketPrediction>();
	for (const ev of events) {
		const pred = ev.current_market?.user_prediction;
		if (pred) {
			predictionsMap.set(ev.id, pred);
			if (ev.current_market) {
				predictionsMap.set(ev.current_market.id, pred);
			}
		}
	}

	const scheduledEvents = events.filter((e) => e.status === 'scheduled');
	const inPlayEvents = events.filter((e) => e.status === 'live');
	const completedEvents = events.filter((e) => e.status === 'completed');

	return (
		<div className="min-h-screen bg-slate-950 text-white pt-20 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
			{/* Top Hero Banner */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl glass-card border border-white/10 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/40 shadow-2xl">
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<span className="px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
							{formatEditionLabel(activeEdition)}
						</span>
						<span className="text-xs text-slate-400 font-medium">
							{activeRound}
						</span>
					</div>
					<h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
						Prediction Arena
					</h1>
					<p className="text-xs sm:text-sm text-slate-400 max-w-xl">
						Dial in exact scorelines before kickoff locks to climb private pool
						leaderboards and global ranks.
					</p>
				</div>

				{/* Sport & Edition Selectors */}
				<div className="flex items-center gap-2 flex-wrap">
					{sports.map((sp) => (
						<button
							key={sp.slug}
							onClick={() =>
								updateFilters(sp.slug, undefined, undefined, undefined)
							}
							className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
								sportParam === sp.slug
									? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
									: 'bg-white/5 text-slate-400 hover:bg-white/10'
							}`}
						>
							<span>{sp.slug === 'rugby-union' ? '🏉' : '⚽'}</span>
							<span>{sp.name}</span>
						</button>
					))}

					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsRulesModalOpen(true)}
						className="border-white/10 hover:bg-white/5 text-slate-300 text-xs font-semibold rounded-xl h-10 gap-1.5 ml-2"
					>
						<BookOpen className="h-4 w-4 text-indigo-400" />
						<span>Scoring Rules</span>
					</Button>
				</div>
			</div>

			{/* Tournament / Competition Switcher Rail */}
			{competitions.length > 1 && (
				<div className="space-y-3 p-4 rounded-3xl glass-card border border-white/10 bg-slate-900/40">
					<div className="flex items-center justify-between px-1">
						<span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
							<Trophy className="h-3.5 w-3.5 text-amber-400" />
							<span>Tournaments</span>
						</span>
						{competitionParam && editions.length > 1 && (
							<div className="flex items-center gap-1.5">
								<span className="text-[11px] text-slate-500 font-medium">
									Edition:
								</span>
								<div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
									{editions.map((ed) => (
										<button
											key={ed.id}
											onClick={() =>
												updateFilters(
													sportParam,
													ed.id,
													undefined,
													ed.competition_id,
												)
											}
											className={`px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
												activeEditionId === ed.id
													? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/60 shadow-sm'
													: 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5'
											}`}
										>
											{ed.season_key || ed.name}
										</button>
									))}
								</div>
							</div>
						)}
					</div>
					<div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
						<button
							onClick={() =>
								updateFilters(sportParam, undefined, undefined, undefined)
							}
							className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
								!competitionParam
									? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40'
									: 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
							}`}
						>
							<span>🌐</span>
							<span>All Tournaments</span>
						</button>
						{competitions.map((comp) => (
							<button
								key={comp.id}
								onClick={() =>
									updateFilters(sportParam, undefined, undefined, comp.id)
								}
								className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
									activeCompetitionId === comp.id &&
									competitionParam === comp.id
										? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40'
										: 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
								}`}
							>
								{comp.logo_url ? (
									<ParticipantCrest
										src={comp.logo_url}
										alt={comp.name}
										className="h-4 w-4 object-contain"
									/>
								) : (
									<span>🏆</span>
								)}
								<span>{comp.name}</span>
								{comp.country && (
									<span className="text-[10px] text-slate-300/80 font-normal px-1.5 py-0.5 rounded bg-white/10">
										{comp.country}
									</span>
								)}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Round Navigation Pill Rail */}
			{availableRounds.length > 1 && (
				<div className="relative flex items-center">
					<button
						onClick={() => scrollRail('left')}
						className="hidden sm:flex absolute -left-4 z-10 h-8 w-8 rounded-full bg-slate-900/90 border border-white/10 items-center justify-center text-slate-300 hover:text-white shadow-lg"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>

					<div
						ref={railRef}
						className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-1 w-full"
					>
						{availableRounds.map((r) => (
							<button
								key={r}
								onClick={() =>
									updateFilters(
										sportParam,
										activeEditionId,
										r,
										competitionParam ||
											(activeCompetitionId
												? String(activeCompetitionId)
												: undefined),
									)
								}
								className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
									activeRound === r
										? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500'
										: 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'
								}`}
							>
								{r}
							</button>
						))}
					</div>

					<button
						onClick={() => scrollRail('right')}
						className="hidden sm:flex absolute -right-4 z-10 h-8 w-8 rounded-full bg-slate-900/90 border border-white/10 items-center justify-center text-slate-300 hover:text-white shadow-lg"
					>
						<ChevronRight className="h-4 w-4" />
					</button>
				</div>
			)}

			{/* Gameweek Performance Summary */}
			<GameweekPerformanceSummary
				events={events}
				predictionsMap={predictionsMap}
				onOpenRulesModal={() => setIsRulesModalOpen(true)}
				roundLabel={activeRound}
			/>

			{/* Event Cards Grid */}
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
						<Clock className="h-5 w-5 text-indigo-400" />
						<span>Fixtures & Predictions</span>
					</h2>
					<span className="text-xs text-slate-400">
						{events.length} Match{events.length !== 1 ? 'es' : ''} Listed
					</span>
				</div>

				{eventsLoading ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{Array.from({ length: 6 }).map((_, idx) => (
							<MatchCardSkeleton key={idx} />
						))}
					</div>
				) : events.length === 0 ? (
					<div className="text-center py-16 rounded-3xl glass-card border border-white/10 p-8 text-slate-400 space-y-3">
						<p className="text-sm font-semibold">
							No fixtures available for {activeRound}.
						</p>
						<p className="text-xs text-slate-500">
							Check other rounds or sports above.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
						{events.map((event) => (
							<EventCard
								key={event.id}
								event={event}
								userId={user?.id ?? null}
								existingPrediction={event.current_market?.user_prediction}
								onPredict={handleOpenPredictDrawer}
								onQuickPredict={handleQuickPredict}
								onBreakdownClick={handleOpenBreakdown}
								onInsightsClick={handleOpenInsights}
							/>
						))}
					</div>
				)}
			</div>

			{/* DRAWER & MODALS */}
			<PredictionDrawer
				isOpen={isDrawerOpen}
				onClose={() => setIsDrawerOpen(false)}
				event={activeEvent}
				userId={user?.id ?? null}
				existingPrediction={activeEvent?.current_market?.user_prediction}
			/>

			<ScoringRulesModal
				isOpen={isRulesModalOpen}
				onClose={() => setIsRulesModalOpen(false)}
			/>

			<ScoreBreakdownModal
				isOpen={isBreakdownOpen}
				onClose={() => setIsBreakdownOpen(false)}
				event={breakdownEvent}
				prediction={breakdownPrediction}
			/>

			<MatchPoolInsightsModal
				isOpen={isInsightsOpen}
				onClose={() => setIsInsightsOpen(false)}
				event={insightsEvent}
			/>
		</div>
	);
}

export default function PredictPage() {
	return (
		<ErrorBoundary>
			<Suspense
				fallback={
					<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center pt-20">
						<div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
						<p className="text-slate-400 text-xs mt-4">
							Loading Prediction Arena...
						</p>
					</div>
				}
			>
				<PredictContent />
			</Suspense>
		</ErrorBoundary>
	);
}
