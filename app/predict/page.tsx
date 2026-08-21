'use client';

import { ErrorBoundary } from '@/components/error-boundary';
import { MatchCard } from '@/components/match-card';
import { PredictionDrawer } from '@/components/prediction-drawer';
import { MatchCardSkeleton } from '@/components/ui/match-card-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	fetchActiveMatchday,
	fetchAvailableMatchdays,
	fetchMatches,
} from '@/lib/queries/matches';
import {
	fetchUserPredictions,
	upsertPrediction,
} from '@/lib/queries/predictions';
import { createClient } from '@/lib/supabase/client';
import { Match, Prediction } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, Compass, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

function PredictContent() {
	const supabase = createClient();
	const queryClient = useQueryClient();
	const router = useRouter();
	const searchParams = useSearchParams();

	const [user, setUser] = useState<any>(null);
	const [userLoading, setUserLoading] = useState(true);
	const [activeMatch, setActiveMatch] = useState<Match | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [matchday, setMatchday] = useState<number>(12);

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

	// Fetch available and active matchday
	const { data: availableMatchdays = [12] } = useQuery({
		queryKey: ['available-matchdays'],
		queryFn: fetchAvailableMatchdays,
	});

	const { data: activeMatchday } = useQuery({
		queryKey: ['active-matchday'],
		queryFn: fetchActiveMatchday,
	});

	// Sync matchday state from query parameter or activeMatchday query
	useEffect(() => {
		const paramMatchday =
			searchParams.get('matchday') || searchParams.get('round');
		if (paramMatchday) {
			const parsed = parseInt(paramMatchday, 10);
			if (!isNaN(parsed)) {
				setMatchday(parsed);
				return;
			}
		}
		if (activeMatchday !== undefined) {
			setMatchday(activeMatchday);
		}
	}, [searchParams, activeMatchday]);

	// Setup Realtime Subscriptions for Matches and Predictions
	useEffect(() => {
		const matchesChannel = supabase
			.channel('public:matches')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'matches',
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ['matches'] });
				},
			)
			.subscribe();

		let predictionsChannel: any = null;
		if (user?.id) {
			predictionsChannel = supabase
				.channel(`public:predictions:user_id=eq.${user.id}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'predictions',
						filter: `user_id=eq.${user.id}`,
					},
					() => {
						queryClient.invalidateQueries({
							queryKey: ['predictions', user.id],
						});
					},
				)
				.subscribe();
		}

		return () => {
			supabase.removeChannel(matchesChannel);
			if (predictionsChannel) {
				supabase.removeChannel(predictionsChannel);
			}
		};
	}, [supabase, queryClient, user?.id]);

	// Query Matches
	const { data: matches, isLoading: matchesLoading } = useQuery<Match[]>({
		queryKey: ['matches', matchday],
		queryFn: () => fetchMatches(matchday),
	});

	// Query User Predictions
	const { data: predictions, isLoading: predictionsLoading } = useQuery<
		Prediction[]
	>({
		queryKey: ['predictions', user?.id],
		queryFn: () => fetchUserPredictions(user?.id!),
		enabled: !!user?.id,
	});

	const saveMutation = useMutation({
		mutationFn: ({
			matchId,
			homeScore,
			awayScore,
		}: {
			matchId: string;
			homeScore: number;
			awayScore: number;
		}) => {
			if (!user?.id) throw new Error('Auth required');
			return upsertPrediction(user.id, matchId, homeScore, awayScore);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['predictions', user?.id] });
			toast.success('Quick pick saved!');
		},
		onError: (err: any) => {
			toast.error(err.message || 'Failed to save quick pick.');
		},
	});

	const handlePredictClick = (match: Match) => {
		if (!user) {
			toast.error('Please sign in to make predictions!');
			return;
		}
		setActiveMatch(match);
		setIsDrawerOpen(true);
	};

	const handleQuickPredictSave = (
		matchId: string,
		homeScore: number,
		awayScore: number,
	) => {
		saveMutation.mutate({ matchId, homeScore, awayScore });
	};

	const isLoading =
		userLoading || matchesLoading || (user?.id && predictionsLoading);

	if (isLoading) {
		return (
			<main className="min-h-screen px-4 py-8 md:px-12 max-w-7xl mx-auto space-y-8">
				{/* Page Header Skeleton */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
					<div className="space-y-2">
						<div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
						<div className="h-4 w-72 bg-slate-800/65 rounded animate-pulse" />
					</div>
					<div className="h-10 w-36 bg-slate-800/40 rounded-xl animate-pulse" />
				</div>

				{/* Match Cards Skeleton Array */}
				<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{[...Array(6)].map((_, i) => (
						<MatchCardSkeleton key={i} />
					))}
				</div>
			</main>
		);
	}

	// Map predictions to matches for easy lookup
	const predictionMap = new Map<string, Prediction>();
	predictions?.forEach((p) => {
		predictionMap.set(p.match_id, p);
	});

	// Grouping predictions status
	const predictedMatches =
		matches?.filter((m) => predictionMap.has(m.id)) || [];
	const unpredictedMatches =
		matches?.filter((m) => !predictionMap.has(m.id)) || [];
	const finishedMatches = matches?.filter((m) => m.status === 'finished') || [];

	// Calculate Matchweek Performance Summary statistics
	const totalMwPoints = finishedMatches.reduce((sum, m) => {
		const pred = predictionMap.get(m.id);
		return sum + (pred?.points_earned || 0);
	}, 0);

	const exactHitsCount = finishedMatches.filter((m) => {
		const pred = predictionMap.get(m.id);
		return pred?.points_earned === 3;
	}).length;

	const outcomeDiffCount = finishedMatches.filter((m) => {
		const pred = predictionMap.get(m.id);
		return pred?.points_earned === 2;
	}).length;

	const winnerOnlyCount = finishedMatches.filter((m) => {
		const pred = predictionMap.get(m.id);
		return pred?.points_earned === 1;
	}).length;

	// Calculate overall locking countdown (earliest match kickoff time)
	const getRoundLockText = () => {
		if (!matches || matches.length === 0) return '';
		const earliest = [...matches].sort(
			(a, b) =>
				new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime(),
		)[0];
		const diff = new Date(earliest.kickoff_time).getTime() - Date.now();

		if (diff <= 0) return 'Predictions Locked';

		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(hours / 24);

		if (days > 0) return `Round locks in ${days} days`;
		return `Round locks in ${hours} hours`;
	};

	const selectedExistingPrediction = activeMatch
		? predictionMap.get(activeMatch.id)
		: null;

	const handleMatchdayChange = (newDay: number) => {
		setMatchday(newDay);
		const params = new URLSearchParams(window.location.search);
		params.set('matchday', newDay.toString());
		router.push(`${window.location.pathname}?${params.toString()}`);
	};

	return (
		<main className="min-h-screen px-4 py-8 md:px-12 max-w-7xl mx-auto space-y-8">
			{/* Page Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
				<div className="space-y-1">
					<h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
						<Trophy className="h-7 w-7 text-yellow-500" />
						Detailed Predictions
					</h1>
					<p className="text-sm text-slate-400">
						Lock in your exact scorelines to win the maximum point weight!
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					{/* Matchday Selector */}
					<div className="flex items-center gap-2">
						<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
							Round:
						</span>
						<select
							value={matchday}
							onChange={(e) =>
								handleMatchdayChange(parseInt(e.target.value, 10))
							}
							className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-white/[0.08] transition"
						>
							{availableMatchdays.map((day) => (
								<option
									key={day}
									value={day}
									className="bg-slate-950 text-white font-bold"
								>
									Matchweek {day} {day === activeMatchday ? '(Current)' : ''}
								</option>
							))}
						</select>
					</div>

					{/* Locking Countdown banner */}
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs shadow-inner">
						<Clock className="h-4 w-4 animate-pulse" />
						<span>{getRoundLockText()}</span>
					</div>
				</div>
			</div>

			{!user && (
				<div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3 max-w-md mx-auto text-indigo-300 font-semibold text-xs">
					<AlertCircle className="h-5 w-5 shrink-0" />
					<p>
						You are viewing matches in spectator mode. Please{' '}
						<Link
							href="/login"
							className="underline font-bold text-white"
						>
							Sign In
						</Link>{' '}
						to save scoreline picks.
					</p>
				</div>
			)}

			{/* MATCHWEEK PERFORMANCE SUMMARY */}
			{user && finishedMatches.length > 0 && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl glass-card border-white/10 bg-indigo-500/5 relative overflow-hidden">
					<div className="absolute -top-12 -left-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

					{/* Stat 1: Total Points */}
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
							<Trophy className="h-5 w-5" />
						</div>
						<div className="text-left">
							<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
								Round Points
							</span>
							<span className="text-xl font-black text-white">
								{totalMwPoints} PTS
							</span>
						</div>
					</div>

					{/* Stat 2: Exact Scores */}
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
							<span className="font-bold text-sm">🎯</span>
						</div>
						<div className="text-left">
							<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
								Exact Scores
							</span>
							<span className="text-xl font-black text-white">
								{exactHitsCount}
							</span>
						</div>
					</div>

					{/* Stat 3: Goal Difference Matches */}
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
							<span className="font-bold text-sm">↔️</span>
						</div>
						<div className="text-left">
							<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
								Outcome & Diff
							</span>
							<span className="text-xl font-black text-white">
								{outcomeDiffCount}
							</span>
						</div>
					</div>

					{/* Stat 4: Winner Only */}
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
							<span className="font-bold text-sm">👍</span>
						</div>
						<div className="text-left">
							<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
								Winner Only
							</span>
							<span className="text-xl font-black text-white">
								{winnerOnlyCount}
							</span>
						</div>
					</div>
				</div>
			)}

			{/* FILTER TABS */}
			<Tabs
				defaultValue="all"
				className="space-y-6"
			>
				<div className="flex justify-center sm:justify-start">
					<TabsList className="bg-white/[0.02] border border-white/5 p-1 rounded-xl">
						<TabsTrigger
							value="all"
							className="rounded-lg font-bold text-xs tracking-wide"
						>
							All Matches ({matches?.length || 0})
						</TabsTrigger>
						<TabsTrigger
							value="unpredicted"
							className="rounded-lg font-bold text-xs tracking-wide"
						>
							Unpredicted ({unpredictedMatches.length})
						</TabsTrigger>
						<TabsTrigger
							value="predicted"
							className="rounded-lg font-bold text-xs tracking-wide"
						>
							Predicted ({predictedMatches.length})
						</TabsTrigger>
						<TabsTrigger
							value="finished"
							className="rounded-lg font-bold text-xs tracking-wide"
						>
							Finished ({finishedMatches.length})
						</TabsTrigger>
					</TabsList>
				</div>

				{/* Tab contents */}
				<TabsContent
					value="all"
					className="mt-0"
				>
					<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{matches?.map((match) => (
							<MatchCard
								key={match.id}
								match={match}
								userId={user?.id || null}
								existingPrediction={predictionMap.get(match.id)}
								onPredict={handlePredictClick}
								onQuickPredict={handleQuickPredictSave}
							/>
						))}
					</div>
				</TabsContent>

				<TabsContent
					value="unpredicted"
					className="mt-0"
				>
					{unpredictedMatches.length === 0 ? (
						<div className="py-16 text-center text-slate-500 flex flex-col items-center gap-3">
							<Compass className="h-8 w-8 text-indigo-500/30" />
							<p className="font-semibold text-sm">
								Perfect Score! All matches have been predicted.
							</p>
						</div>
					) : (
						<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{unpredictedMatches.map((match) => (
								<MatchCard
									key={match.id}
									match={match}
									userId={user?.id || null}
									existingPrediction={undefined}
									onPredict={handlePredictClick}
									onQuickPredict={handleQuickPredictSave}
								/>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent
					value="predicted"
					className="mt-0"
				>
					{predictedMatches.length === 0 ? (
						<div className="py-16 text-center text-slate-500 flex flex-col items-center gap-3">
							<Trophy className="h-8 w-8 text-indigo-500/30" />
							<p className="font-semibold text-sm">
								You haven&apos;t placed any predictions yet. Get picking!
							</p>
						</div>
					) : (
						<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{predictedMatches.map((match) => (
								<MatchCard
									key={match.id}
									match={match}
									userId={user?.id || null}
									existingPrediction={predictionMap.get(match.id)}
									onPredict={handlePredictClick}
									onQuickPredict={handleQuickPredictSave}
								/>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent
					value="finished"
					className="mt-0"
				>
					{finishedMatches.length === 0 ? (
						<div className="py-16 text-center text-slate-500 flex flex-col items-center gap-3">
							<Clock className="h-8 w-8 text-indigo-500/30" />
							<p className="font-semibold text-sm">
								No matches are finished yet in this round.
							</p>
						</div>
					) : (
						<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{finishedMatches.map((match) => (
								<MatchCard
									key={match.id}
									match={match}
									userId={user?.id || null}
									existingPrediction={predictionMap.get(match.id)}
									onPredict={handlePredictClick}
									onQuickPredict={handleQuickPredictSave}
								/>
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* Slide-over prediction editor drawer */}
			<PredictionDrawer
				isOpen={isDrawerOpen}
				onClose={() => {
					setIsDrawerOpen(false);
					setActiveMatch(null);
				}}
				match={activeMatch}
				userId={user?.id || null}
				existingPrediction={selectedExistingPrediction}
			/>
		</main>
	);
}

export default function PredictPage() {
	return (
		<ErrorBoundary>
			<Suspense
				fallback={
					<main className="min-h-screen px-4 py-8 md:px-12 max-w-7xl mx-auto space-y-8 animate-pulse">
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
							<div className="space-y-2">
								<div className="h-8 w-48 bg-slate-800 rounded" />
								<div className="h-4 w-72 bg-slate-800/65 rounded" />
							</div>
							<div className="h-10 w-36 bg-slate-800/40 rounded-xl" />
						</div>
						<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{[...Array(6)].map((_, i) => (
								<MatchCardSkeleton key={i} />
							))}
						</div>
					</main>
				}
			>
				<PredictContent />
			</Suspense>
		</ErrorBoundary>
	);
}
