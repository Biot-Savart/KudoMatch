'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { fetchMatches } from '@/lib/queries/matches';
import { createClient } from '@/lib/supabase/client';
import { Match } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
	ArrowRight,
	Award,
	CheckCircle2,
	Loader2,
	ShieldAlert,
	Zap
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Dashboard() {
	const supabase = createClient();
	const [user, setUser] = useState<any>(null);
	const [profile, setProfile] = useState<any>(null);
	const [userLoading, setUserLoading] = useState(true);

	// Fetch active matches using TanStack Query
	const { data: matches, isLoading: matchesLoading } = useQuery<Match[]>({
		queryKey: ['matches', 12], // Matchweek 12
		queryFn: () => fetchMatches(12),
	});

	// State to track quick selections on the client
	const [quickPicks, setQuickPicks] = useState<
		Record<string, 'home' | 'draw' | 'away'>
	>({});

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

	const handleQuickPredict = (
		matchId: string,
		option: 'home' | 'draw' | 'away',
	) => {
		setQuickPicks((prev) => ({
			...prev,
			[matchId]: prev[matchId] === option ? (null as any) : option,
		}));
	};

	const isLoading = userLoading || matchesLoading;

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
						{matches?.map((match, idx) => {
							const selectedOption = quickPicks[match.id];
							const kickoffDate = new Date(match.kickoff_time);
							const formattedTime = kickoffDate.toLocaleDateString(undefined, {
								weekday: 'short',
								hour: '2-digit',
								minute: '2-digit',
							});

							return (
								<motion.div
									key={match.id}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: idx * 0.05, duration: 0.3 }}
								>
									<Card className="bg-white/[0.02] border-white/5 hover:border-white/10 transition-all duration-300 rounded-2xl overflow-hidden shadow-lg">
										<CardHeader className="p-4 pb-2 border-b border-white/5 bg-black/20 flex flex-row justify-between items-center">
											<span className="text-xs text-slate-400 font-semibold tracking-wide">
												English Premier League
											</span>
											<span className="text-[10px] text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">
												{formattedTime}
											</span>
										</CardHeader>
										<CardContent className="p-5 space-y-6">
											{/* Team vs Team Display */}
											<div className="flex items-center justify-between text-center">
												<div className="flex flex-col items-center gap-1.5 w-24">
													{match.home_team?.logo_url ? (
														<img
															src={match.home_team.logo_url}
															alt={match.home_team.name}
															className="h-10 w-10 object-contain"
														/>
													) : (
														<span className="text-3xl">🔵</span>
													)}
													<span className="font-extrabold text-sm text-white truncate w-full">
														{match.home_team?.name}
													</span>
												</div>

												<span className="text-xs font-black text-slate-500 bg-white/5 px-2.5 py-1 rounded-md">
													VS
												</span>

												<div className="flex flex-col items-center gap-1.5 w-24">
													{match.away_team?.logo_url ? (
														<img
															src={match.away_team.logo_url}
															alt={match.away_team.name}
															className="h-10 w-10 object-contain"
														/>
													) : (
														<span className="text-3xl">🔴</span>
													)}
													<span className="font-extrabold text-sm text-white truncate w-full">
														{match.away_team?.name}
													</span>
												</div>
											</div>

											{/* 1 / X / 2 Toggles */}
											<div className="grid grid-cols-3 gap-2">
												<button
													onClick={() => handleQuickPredict(match.id, 'home')}
													className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all duration-200 ${
														selectedOption === 'home'
															? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
															: 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
													}`}
												>
													1
												</button>
												<button
													onClick={() => handleQuickPredict(match.id, 'draw')}
													className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all duration-200 ${
														selectedOption === 'draw'
															? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
															: 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
													}`}
												>
													X
												</button>
												<button
													onClick={() => handleQuickPredict(match.id, 'away')}
													className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all duration-200 ${
														selectedOption === 'away'
															? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
															: 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
													}`}
												>
													2
												</button>
											</div>
										</CardContent>
									</Card>
								</motion.div>
							);
						})}
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
		</main>
	);
}
