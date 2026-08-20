'use client';

import { MatchCard } from '@/components/match-card';
import { PredictionDrawer } from '@/components/prediction-drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchMatches } from '@/lib/queries/matches';
import {
    fetchUserPredictions,
    upsertPrediction,
} from '@/lib/queries/predictions';
import { createClient } from '@/lib/supabase/client';
import { Match, Prediction } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, Compass, Loader2, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function PredictPage() {
	const supabase = createClient();
	const queryClient = useQueryClient();
	const [user, setUser] = useState<any>(null);
	const [userLoading, setUserLoading] = useState(true);
	const [activeMatch, setActiveMatch] = useState<Match | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [matchday, setMatchday] = useState(12); // Matchweek 12 by default

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

	if (isLoading) {
		return (
			<div className="min-h-[85vh] w-full flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
			</div>
		);
	}

	const selectedExistingPrediction = activeMatch
		? predictionMap.get(activeMatch.id)
		: null;

	return (
		<main className="min-h-screen px-4 py-8 md:px-12 max-w-7xl mx-auto space-y-8">
			{/* Page Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
				<div className="space-y-1">
					<h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
						<Trophy className="h-7 w-7 text-yellow-500" />
						Detailed Predictions
					</h1>
					<p className="text-sm text-slate-400">
						Lock in your exact scorelines to win the maximum point weight!
					</p>
				</div>

				{/* Locking Countdown banner */}
				<div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs shadow-inner">
					<Clock className="h-4 w-4 animate-pulse" />
					<span>{getRoundLockText()}</span>
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
								You haven't placed any predictions yet. Get picking!
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
