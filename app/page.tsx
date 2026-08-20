'use client';

import { MatchCard } from '@/components/match-card';
import { PredictionDrawer } from '@/components/prediction-drawer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchMatches } from '@/lib/queries/matches';
import {
	fetchUserPredictions,
	upsertPrediction,
} from '@/lib/queries/predictions';
import { createClient } from '@/lib/supabase/client';
import { Match, Prediction } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
	ArrowRight,
	Award,
	CheckCircle2,
	Loader2,
	ShieldAlert,
	Zap,
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
	const [activeMatch, setActiveMatch] = useState<Match | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);

	// Fetch active matches using TanStack Query
	const { data: matches, isLoading: matchesLoading } = useQuery<Match[]>({
		queryKey: ['matches', 12], // Matchweek 12
		queryFn: () => fetchMatches(12),
	});

	// Fetch active user predictions
	const { data: predictions, isLoading: predictionsLoading } = useQuery<
		Prediction[]
	>({
		queryKey: ['predictions', user?.id],
		queryFn: () => fetchUserPredictions(user?.id!),
		enabled: !!user?.id,
	});

	// Mutation for quick outcome predictions
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

	// Only show first 3 matches on dashboard for quick picks
	const quickPickMatches = matches?.slice(0, 3) || [];

	return (
		<main className="min-h-screen px-4 py-8 md:px-12 max-w-7xl mx-auto space-y-8">
			{/* HERO SECTION */}
			<motion.div
				initial={{ opacity: 0, y: 15 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
				className="relative rounded-2xl overflow-hidden glass-card p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6 border-white/10"
			>
				<div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
				<div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

				<div className="space-y-4 max-w-xl relative z-10">
					<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold text-xs">
						<span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
						MATCHWEEK 12 IS LIVE!
					</div>
					<h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent leading-tight">
						Make Your Picks. <br />
						Dominate the Pool.
					</h1>
					<p className="text-slate-400 text-sm md:text-base leading-relaxed">
						One-tap predictions, real-time leaderboard updates, and intense
						banter with your friends. Join or create a custom pool and show off
						your football IQ.
					</p>
					<div className="flex flex-wrap gap-3 pt-2">
						<Button
							className="bg-indigo-600 hover:bg-indigo-700 font-bold text-white tracking-wide gap-2 py-5 px-6 rounded-xl"
							asChild
						>
							<Link href="/predict">
								Predict Now <ArrowRight className="h-4 w-4" />
							</Link>
						</Button>
						{!user && (
							<Button
								variant="outline"
								className="font-bold border-white/10 hover:bg-white/5 py-5 px-6 rounded-xl"
								asChild
							>
								<Link href="/signup">Sign Up Free</Link>
							</Button>
						)}
					</div>
				</div>

				{/* QUICK STATS CONTAINER */}
				<div className="grid grid-cols-2 gap-4 w-full md:w-80 relative z-10">
					<Card className="bg-white/[0.02] border-white/5 p-4 rounded-xl flex flex-col justify-between">
						<div className="flex justify-between items-start text-indigo-400">
							<Zap className="h-5 w-5" />
							<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
								Streak
							</span>
						</div>
						<div className="mt-4">
							<p className="text-2xl font-black text-white">3</p>
							<p className="text-xs text-slate-400 font-semibold mt-1">
								Wins in a row
							</p>
						</div>
					</Card>

					<Card className="bg-white/[0.02] border-white/5 p-4 rounded-xl flex flex-col justify-between">
						<div className="flex justify-between items-start text-indigo-400">
							<Award className="h-5 w-5 text-yellow-500" />
							<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
								Global Rank
							</span>
						</div>
						<div className="mt-4">
							<p className="text-2xl font-black text-white">#142</p>
							<p className="text-xs text-slate-400 font-semibold mt-1">
								Top 4% overall
							</p>
						</div>
					</Card>
				</div>
			</motion.div>

			{/* QUICK PREDICTIONS GRID */}
			<div className="space-y-4">
				<div className="flex justify-between items-center">
					<div>
						<h2 className="text-2xl font-bold tracking-tight text-white">
							Quick Matchday Predictions
						</h2>
						<p className="text-xs text-slate-400">
							Tap 1 (Home Win), X (Draw), or 2 (Away Win) to predict instantly.
						</p>
					</div>
					<Button
						variant="link"
						className="text-indigo-400 hover:text-indigo-300 font-bold text-xs flex items-center gap-1.5"
						asChild
					>
						<Link href="/predict">
							All Matches <ArrowRight className="h-3.5 w-3.5" />
						</Link>
					</Button>
				</div>

				{isLoading ? (
					<div className="w-full flex items-center justify-center py-16">
						<Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
					</div>
				) : (
					<div className="grid md:grid-cols-3 gap-4">
						{quickPickMatches.map((match) => (
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
			</div>

			{/* FOOTER-STYLE INFO ON REAL-TIME LEAGUES */}
			<div className="grid md:grid-cols-2 gap-6 pt-4">
				<Card className="bg-gradient-to-br from-indigo-900/10 to-slate-900/50 border-white/5 p-6 rounded-2xl relative overflow-hidden">
					<div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
					<h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
						<CheckCircle2 className="h-5 w-5 text-emerald-400" />
						Social League Creation
					</h3>
					<p className="text-slate-400 text-sm leading-relaxed mb-4">
						Build custom private prediction pools with your close friends,
						co-workers, or family members. Get a native invite link with one-tap
						joining!
					</p>
					<Button
						variant="outline"
						className="border-indigo-500/20 text-indigo-300 font-bold text-xs hover:bg-indigo-500/10 hover:text-white"
						asChild
					>
						<Link href="/leagues">Explore Leagues</Link>
					</Button>
				</Card>

				<Card className="bg-gradient-to-br from-purple-900/10 to-slate-900/50 border-white/5 p-6 rounded-2xl relative overflow-hidden">
					<div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
					<h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
						<ShieldAlert className="h-5 w-5 text-indigo-400" />
						Secure Verification & Auth
					</h3>
					<p className="text-slate-400 text-sm leading-relaxed mb-4">
						Our platform uses enterprise-grade cryptographic verification with
						Supabase Auth to guarantee zero manipulation and fair predictions
						logic.
					</p>
					<div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
						Supabase Protected System
					</div>
				</Card>
			</div>

			{/* Slide-over prediction editor drawer */}
			<PredictionDrawer
				isOpen={isDrawerOpen}
				onClose={() => {
					setIsDrawerOpen(false);
					setActiveMatch(null);
				}}
				match={activeMatch}
				userId={user?.id || null}
				existingPrediction={
					activeMatch ? predictionMap.get(activeMatch.id) : null
				}
			/>
		</main>
	);
}
