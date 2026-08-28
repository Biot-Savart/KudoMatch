'use client';

import { EventCard } from '@/components/event-card';
import { PredictionDrawer } from '@/components/prediction-drawer';
import { Button } from '@/components/ui/button';
import { eventsQueryKeys, fetchEvents } from '@/lib/queries/events';
import { submitPrediction } from '@/lib/queries/predictions';
import { fetchUserScoreSummary, scoringQueryKeys } from '@/lib/queries/scoring';
import { createClient } from '@/lib/supabase/client';
import {
	SportEvent,
	TeamScorelineSelection,
	UserScoreSummary
} from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ArrowRight,
	Clock,
	Loader2,
	Trophy,
	Zap
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function Dashboard() {
	const supabase = createClient();
	const queryClient = useQueryClient();
	const [user, setUser] = useState<any>(null);
	const [profile, setProfile] = useState<any>(null);
	const [userLoading, setUserLoading] = useState(true);
	const [activeEvent, setActiveEvent] = useState<SportEvent | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);

	useEffect(() => {
		const getSession = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setUser(user);
			if (user) {
				const { data } = await supabase
					.from('profiles')
					.select('*')
					.eq('id', user.id)
					.single();
				setProfile(data);
			}
			setUserLoading(false);
		};
		getSession();
	}, [supabase]);

	// Fetch active events
	const { data: events = [], isLoading: eventsLoading } = useQuery<
		SportEvent[]
	>({
		queryKey: eventsQueryKeys.list({
			userId: user?.id,
			limit: 6,
		}),
		queryFn: () =>
			fetchEvents({
				userId: user?.id,
				limit: 6,
			}),
	});

	// Fetch score summary
	const { data: scoreSummary } = useQuery<UserScoreSummary>({
		queryKey: user?.id
			? scoringQueryKeys.userSummary(user.id)
			: ['scoring', 'summary', 'anon'],
		queryFn: () =>
			user?.id
				? fetchUserScoreSummary(user.id)
				: Promise.resolve({
						total_raw_points: 0,
						total_normalized_points: 0,
						total_predictions: 0,
						settled_predictions: 0,
						exact_count: 0,
						margin_count: 0,
						outcome_count: 0,
						miss_count: 0,
						win_rate: 0,
					}),
		enabled: !!user?.id,
	});

	// Mutation for quick outcome predictions
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
			if (!user?.id) throw new Error('Auth required');
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
			toast.success('Quick pick saved!');
		},
		onError: (err: any) => {
			toast.error(err.message || 'Failed to save quick pick.');
		},
	});

	// Realtime Subscriptions
	useEffect(() => {
		const channel = supabase
			.channel('public:dashboard_events')
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
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [supabase, queryClient]);

	const handleOpenPredictDrawer = (event: SportEvent) => {
		setActiveEvent(event);
		setIsDrawerOpen(true);
	};

	const handleQuickPredict = (marketId: string, home: number, away: number) => {
		if (!user) {
			toast.error('Please sign in to make predictions!');
			return;
		}
		quickPredictMutation.mutate({ marketId, home, away });
	};

	const totalPoints = scoreSummary?.total_raw_points ?? 0;
	const exactHits = scoreSummary?.exact_count ?? 0;
	const marginHits = scoreSummary?.margin_count ?? 0;
	const outcomeHits = scoreSummary?.outcome_count ?? 0;
	const winRate = scoreSummary?.win_rate ?? 0;

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center pt-20 pb-20 px-4 sm:px-6">
			{/* Top Hero Section */}
			<section className="w-full max-w-5xl py-8 md:py-12 flex flex-col md:flex-row items-center justify-between gap-8">
				<div className="space-y-4 text-center md:text-left max-w-xl">
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
						<Zap className="h-3.5 w-3.5" />
						<span>Mobile-First Multi-Sport Predictions</span>
					</div>
					<h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
						Predict Scores. Challenge Friends. Claim Bragging Rights.
					</h1>
					<p className="text-sm sm:text-base text-slate-400">
						Lock in football and rugby scorelines before kickoff. Compete across
						private pools, test what-if scenarios, and rise up the
						leaderboards.
					</p>
					<div className="flex items-center justify-center md:justify-start gap-3 pt-2">
						<Button
							className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-6 rounded-2xl shadow-xl shadow-indigo-600/25"
							asChild
						>
							<Link href="/predict">
								<span>Enter Arena</span>
								<ArrowRight className="h-4 w-4 ml-2" />
							</Link>
						</Button>
						<Button
							variant="outline"
							className="border-white/10 hover:bg-white/5 font-semibold px-6 py-6 rounded-2xl text-slate-300"
							asChild
						>
							<Link href="/leagues">Private Pools</Link>
						</Button>
					</div>
				</div>

				{/* User Status Card */}
				<div className="w-full md:w-80 glass-card p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
							Your Overview
						</span>
						<Trophy className="h-4 w-4 text-amber-400" />
					</div>

					<div className="space-y-1">
						<div className="text-3xl font-black text-white">
							{totalPoints}{' '}
							<span className="text-xs text-slate-400 font-bold">PTS</span>
						</div>
						<p className="text-xs text-slate-400">
							{user ? user.email : 'Sign in to start scoring'}
						</p>
					</div>

					<div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
						<div className="p-2 rounded-xl bg-white/[0.02]">
							<div className="text-sm font-black text-emerald-400">
								{exactHits}
							</div>
							<div className="text-[10px] text-slate-500 font-bold">Exact</div>
						</div>
						<div className="p-2 rounded-xl bg-white/[0.02]">
							<div className="text-sm font-black text-teal-400">
								{marginHits + outcomeHits}
							</div>
							<div className="text-[10px] text-slate-500 font-bold">
								Outcome
							</div>
						</div>
						<div className="p-2 rounded-xl bg-white/[0.02]">
							<div className="text-sm font-black text-indigo-400">
								{winRate}%
							</div>
							<div className="text-[10px] text-slate-500 font-bold">
								Accuracy
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Upcoming Fixtures Showcase */}
			<section className="w-full max-w-5xl space-y-6 mt-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
							<Clock className="h-5 w-5 text-indigo-400" />
							<span>Featured Fixtures</span>
						</h2>
						<p className="text-xs text-slate-400">
							Make your scoreline call before kickoff locks write access
						</p>
					</div>
					<Button
						variant="ghost"
						className="text-xs text-indigo-400 hover:text-indigo-300 gap-1 font-bold"
						asChild
					>
						<Link href="/predict">
							<span>View All</span>
							<ArrowRight className="h-3.5 w-3.5" />
						</Link>
					</Button>
				</div>

				{eventsLoading ? (
					<div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
						<Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
						<span className="text-xs">Loading fixtures...</span>
					</div>
				) : events.length === 0 ? (
					<div className="text-center py-12 glass-card rounded-2xl border border-white/5 text-slate-400 text-xs">
						No featured fixtures currently available.
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
							/>
						))}
					</div>
				)}
			</section>

			{/* Prediction Drawer */}
			<PredictionDrawer
				isOpen={isDrawerOpen}
				onClose={() => setIsDrawerOpen(false)}
				event={activeEvent}
				userId={user?.id ?? null}
				existingPrediction={activeEvent?.current_market?.user_prediction}
			/>
		</div>
	);
}
