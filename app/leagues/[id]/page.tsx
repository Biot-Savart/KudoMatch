'use client';

import HeadToHead from '@/components/head-to-head';
import { MatchPoolInsightsModal } from '@/components/match-pool-insights-modal';
import PoolChat from '@/components/pool-chat';
import { ScoreBreakdownModal } from '@/components/score-breakdown-modal';
import { ScoringRulesModal } from '@/components/scoring-rules-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WhatIfScenarioSimulator } from '@/components/what-if-simulator';
import {
	fetchActiveMatchday,
	fetchAvailableMatchdays,
} from '@/lib/queries/matches';
import {
	fetchPoolDetails,
	fetchPoolLeaderboard,
	fetchPoolMembers,
	fetchPoolPicksMatrix,
	leavePool,
} from '@/lib/queries/pools';
import { createClient } from '@/lib/supabase/client';
import { Match, Prediction } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
	ArrowLeft,
	BookOpen,
	Calculator,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Copy,
	Crown,
	Info,
	Loader2,
	LogOut,
	MessageCircle,
	Sword,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function PoolDetailPage() {
	const params = useParams();
	const router = useRouter();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const supabase = createClient();
	const poolId = params.id as string;

	const pillRailRef = useRef<HTMLDivElement>(null);
	const matrixScrollRef = useRef<HTMLDivElement>(null);

	const [user, setUser] = useState<any>(null);
	const [userLoading, setUserLoading] = useState(true);
	const [copying, setCopying] = useState(false);
	const [activeTab, setActiveTab] = useState('standings');
	const [selectedOpponentId, setSelectedOpponentId] = useState<
		string | undefined
	>(undefined);
	const [matchday, setMatchday] = useState<number>(12);

	const scrollPills = (direction: 'left' | 'right') => {
		if (pillRailRef.current) {
			pillRailRef.current.scrollBy({
				left: direction === 'left' ? -260 : 260,
				behavior: 'smooth',
			});
		}
	};

	const scrollMatrix = (direction: 'left' | 'right') => {
		if (matrixScrollRef.current) {
			matrixScrollRef.current.scrollBy({
				left: direction === 'left' ? -360 : 360,
				behavior: 'smooth',
			});
		}
	};

	// Phase 9 Modals State
	const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
	const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

	const [breakdownMatch, setBreakdownMatch] = useState<Match | null>(null);
	const [breakdownPrediction, setBreakdownPrediction] =
		useState<Prediction | null>(null);
	const [breakdownUsername, setBreakdownUsername] = useState<
		string | undefined
	>(undefined);
	const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

	const [insightsMatch, setInsightsMatch] = useState<Match | null>(null);
	const [isInsightsOpen, setIsInsightsOpen] = useState(false);

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

	// Setup Realtime Subscriptions for Pool changes, Member changes and Prediction updates
	useEffect(() => {
		if (!poolId) return;

		// Subscribe to changes in pool_members to refresh members list and details
		const membersChannel = supabase
			.channel(`public:pool_members:pool_id=eq.${poolId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'pool_members',
					filter: `pool_id=eq.${poolId}`,
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ['pool-members', poolId] });
					queryClient.invalidateQueries({ queryKey: ['pool-details', poolId] });
					queryClient.invalidateQueries({
						queryKey: ['pool-leaderboard', poolId],
					});
				},
			)
			.subscribe();

		// Subscribe to changes in pools table for updates to name/description
		const poolDetailsChannel = supabase
			.channel(`public:pools:id=eq.${poolId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'pools',
					filter: `id=eq.${poolId}`,
				},
				() => {
					queryClient.invalidateQueries({ queryKey: ['pool-details', poolId] });
				},
			)
			.subscribe();

		// Subscribe to predictions changes to refresh the leaderboard
		const predictionsChannel = supabase
			.channel('public:predictions')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'predictions',
				},
				() => {
					queryClient.invalidateQueries({
						queryKey: ['pool-leaderboard', poolId],
					});
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(membersChannel);
			supabase.removeChannel(poolDetailsChannel);
			supabase.removeChannel(predictionsChannel);
		};
	}, [supabase, queryClient, poolId]);

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
		if (activeMatchday !== undefined && activeMatchday !== null) {
			setMatchday(activeMatchday);
		}
	}, [searchParams, activeMatchday]);

	const handleMatchdayChange = (newDay: number) => {
		setMatchday(newDay);
		const params = new URLSearchParams(window.location.search);
		params.set('matchday', newDay.toString());
		router.push(`${window.location.pathname}?${params.toString()}`);
	};

	// Queries
	const { data: pool, isLoading: poolLoading } = useQuery({
		queryKey: ['pool-details', poolId],
		queryFn: () => fetchPoolDetails(poolId),
		enabled: !!poolId,
	});

	const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
		queryKey: ['pool-leaderboard', poolId],
		queryFn: () => fetchPoolLeaderboard(poolId),
		enabled: !!poolId,
	});

	const { data: members, isLoading: membersLoading } = useQuery({
		queryKey: ['pool-members', poolId],
		queryFn: () => fetchPoolMembers(poolId),
		enabled: !!poolId,
	});

	const { data: matrixData, isLoading: matrixLoading } = useQuery({
		queryKey: ['pool-matrix', poolId, matchday],
		queryFn: () => fetchPoolPicksMatrix(poolId, matchday),
		enabled: !!poolId,
	});

	// Leave Pool mutation
	const leaveMutation = useMutation({
		mutationFn: () => leavePool(poolId, user?.id),
		onSuccess: () => {
			toast.success('Successfully left the pool.');
			queryClient.invalidateQueries({ queryKey: ['user-pools', user?.id] });
			router.push('/leagues');
		},
		onError: (err: any) => {
			toast.error(err.message || 'Failed to leave pool.');
		},
	});

	const handleCopyCode = async () => {
		if (!pool) return;
		try {
			await navigator.clipboard.writeText(pool.invite_code);
			setCopying(true);
			toast.success('Invite code copied to clipboard!');
			setTimeout(() => setCopying(false), 2000);
		} catch (err) {
			toast.error('Failed to copy code.');
		}
	};

	const handleShareWhatsApp = () => {
		if (!pool) return;
		const origin =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://kudomatch.com';
		const message = `Join my KudoMatch prediction pool *${pool.name}* using invite code *${pool.invite_code}* and see if you can beat my scores! 🏆⚽\n\nJoin here: ${origin}/leagues`;
		const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
		window.open(whatsappUrl, '_blank');
	};

	const handleLeavePool = () => {
		if (
			window.confirm('Are you absolutely sure you want to leave this pool?')
		) {
			leaveMutation.mutate();
		}
	};

	const handleOpenCellBreakdown = (
		match: Match,
		pred?: Prediction | null,
		username?: string,
	) => {
		setBreakdownMatch(match);
		setBreakdownPrediction(pred || null);
		setBreakdownUsername(username);
		setIsBreakdownOpen(true);
	};

	const handleOpenMatchInsights = (match: Match) => {
		setInsightsMatch(match);
		setIsInsightsOpen(true);
	};

	const isCreator = pool?.creator_id === user?.id;
	const isMember = members?.some((m) => m.user_id === user?.id);

	const isLoading =
		userLoading ||
		poolLoading ||
		leaderboardLoading ||
		membersLoading ||
		matrixLoading;

	if (isLoading) {
		return (
			<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center pt-16">
				<Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
				<p className="text-slate-400 text-xs mt-4">Loading league details...</p>
			</div>
		);
	}

	if (!pool) {
		return (
			<div className="min-h-screen bg-slate-950 text-white pt-24 px-4 flex flex-col items-center justify-center">
				<div className="max-w-md w-full text-center p-8 rounded-2xl glass-card border border-white/10 shadow-2xl">
					<h2 className="text-2xl font-extrabold tracking-tight mb-2 text-red-400">
						League Not Found
					</h2>
					<p className="text-slate-400 text-sm mb-6">
						The prediction pool you are trying to access does not exist, or you
						do not have permission to view it.
					</p>
					<Button
						className="bg-indigo-600 hover:bg-indigo-700 font-bold py-6 rounded-xl w-full"
						asChild
					>
						<Link href="/leagues">Back to My Leagues</Link>
					</Button>
				</div>
			</div>
		);
	}

	// Separate podium vs others
	const podium = leaderboard ? leaderboard.slice(0, 3) : [];

	return (
		<div className="min-h-screen bg-slate-950 text-white pt-24 pb-12 px-4 md:px-8">
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Back navigation */}
				<Link
					href="/leagues"
					className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-semibold transition"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Leagues
				</Link>

				{/* Hero Header */}
				<div className="p-6 md:p-8 rounded-2xl glass-card border border-white/10 bg-gradient-to-r from-slate-950 via-slate-900/40 to-indigo-950/20 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
					<div className="space-y-3 max-w-xl">
						<div className="flex items-center gap-2">
							<span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
								Prediction Pool
							</span>
							{pool.is_public && (
								<span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
									Public
								</span>
							)}
						</div>
						<h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
							{pool.name}
						</h1>
						<p className="text-sm text-slate-400 leading-relaxed">
							{pool.description ||
								'Bragging rights match! Lock in predictions and climb the standings.'}
						</p>

						<div className="flex items-center gap-2.5 text-xs text-slate-400 pt-1">
							<Avatar className="h-5 w-5 border border-white/10">
								<AvatarImage src={pool.creator?.avatar_url || ''} />
								<AvatarFallback className="bg-indigo-600 text-[9px] font-bold text-white">
									{(pool.creator?.username || 'U')
										.substring(0, 2)
										.toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span>
								Created by{' '}
								<b className="text-white">
									@{pool.creator?.username || 'user'}
								</b>
							</span>
							<span>•</span>
							<span className="flex items-center gap-1">
								<Users className="h-3 w-3 text-indigo-400" />
								<b className="text-white">{pool.member_count ?? 1}</b> members
							</span>
						</div>
					</div>

					{/* Invite / Action tools */}
					<div className="flex flex-col sm:flex-row md:flex-col gap-3 md:items-end">
						<div className="flex flex-wrap gap-2">
							{/* Phase 9: What-If Simulator trigger */}
							{matrixData && leaderboard && (
								<Button
									variant="outline"
									onClick={() => setIsSimulatorOpen(true)}
									className="border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-xs font-bold gap-1.5 rounded-xl h-10"
								>
									<Calculator className="h-4 w-4 text-purple-400" />
									<span>&quot;What-If&quot; Simulator</span>
								</Button>
							)}

							{/* Phase 9: Point Rules trigger */}
							<Button
								variant="outline"
								onClick={() => setIsRulesModalOpen(true)}
								className="border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold gap-1.5 rounded-xl h-10"
							>
								<BookOpen className="h-4 w-4 text-indigo-400" />
								<span>Point Rules</span>
							</Button>
						</div>

						{isMember && (
							<div className="flex items-center gap-2 bg-white/5 border border-white/5 p-2 rounded-xl">
								<div className="text-left px-2">
									<p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
										Invite Code
									</p>
									<p className="text-lg font-black tracking-widest text-indigo-300">
										{pool.invite_code}
									</p>
								</div>
								<Button
									onClick={handleCopyCode}
									variant="ghost"
									className="h-10 w-10 p-0 rounded-lg hover:bg-white/10"
								>
									<Copy className="h-4 w-4 text-slate-300" />
								</Button>
								<Button
									onClick={handleShareWhatsApp}
									variant="ghost"
									className="h-10 w-10 p-0 rounded-lg hover:bg-green-500/10 text-emerald-400 hover:text-emerald-300"
								>
									<MessageCircle className="h-4 w-4" />
								</Button>
							</div>
						)}

						{isMember && !isCreator && (
							<Button
								onClick={handleLeavePool}
								variant="ghost"
								className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 py-5 rounded-xl font-bold flex items-center justify-center gap-1.5"
							>
								<LogOut className="h-3.5 w-3.5" />
								Leave Pool
							</Button>
						)}
					</div>
				</div>

				{/* Detail Tabs */}
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="w-full space-y-4"
				>
					<TabsList className="bg-slate-900 border border-white/5 p-1 rounded-xl w-full sm:w-auto flex flex-wrap gap-1">
						<TabsTrigger
							value="standings"
							className="flex-1 sm:flex-none py-2.5 font-bold rounded-lg text-xs uppercase tracking-wider"
						>
							🏆 Standings
						</TabsTrigger>
						<TabsTrigger
							value="matrix"
							className="flex-1 sm:flex-none py-2.5 font-bold rounded-lg text-xs uppercase tracking-wider"
						>
							🔍 Picks Matrix
						</TabsTrigger>
						<TabsTrigger
							value="chat"
							className="flex-1 sm:flex-none py-2.5 font-bold rounded-lg text-xs uppercase tracking-wider"
						>
							💬 Banter Chat
						</TabsTrigger>
						<TabsTrigger
							value="h2h"
							className="flex-1 sm:flex-none py-2.5 font-bold rounded-lg text-xs uppercase tracking-wider"
						>
							⚔️ Head-to-Head
						</TabsTrigger>
						<TabsTrigger
							value="members"
							className="flex-1 sm:flex-none py-2.5 font-bold rounded-lg text-xs uppercase tracking-wider"
						>
							👥 Members
						</TabsTrigger>
					</TabsList>

					{/* 🏆 STANDINGS TAB */}
					<TabsContent
						value="standings"
						className="space-y-6 outline-none"
					>
						{/* Olympic 3D Pedestal Podium for Top 3 */}
						{podium.length > 0 && (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-6 pb-4 max-w-2xl mx-auto">
								{/* 2nd place (Silver pedestal, renders left on desktop) */}
								{podium[1] && (
									<motion.div
										initial={{ opacity: 0, scale: 0.9, y: 15 }}
										animate={{ opacity: 1, scale: 1, y: 0 }}
										transition={{ type: 'spring', delay: 0.1, duration: 0.4 }}
										className="order-2 md:order-1 flex flex-col items-center"
									>
										<div className="relative mb-3 flex flex-col items-center">
											<Avatar className="h-16 w-16 border-2 border-slate-300 shadow-xl ring-4 ring-slate-400/20">
												<AvatarImage src={podium[1].avatar_url || ''} />
												<AvatarFallback className="bg-slate-700 text-white font-black text-sm">
													{podium[1].username?.substring(0, 2).toUpperCase() ||
														'U'}
												</AvatarFallback>
											</Avatar>
											<div className="absolute -bottom-1.5 bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-md">
												🥈 2nd
											</div>
										</div>
										<div className="w-full flex flex-col items-center pt-3 pb-4 px-4 rounded-t-2xl bg-gradient-to-b from-slate-400/15 via-slate-800/40 to-slate-900/60 border-t border-x border-slate-400/20 h-28 justify-center shadow-lg">
											<p className="text-sm font-bold truncate max-w-[140px] text-white">
												{podium[1].username}
											</p>
											<p className="text-xs text-slate-300 font-black tabular-numbers mt-0.5">
												{podium[1].total_points} pts
											</p>
										</div>
									</motion.div>
								)}

								{/* 1st place (Gold pedestal, center, tallest) */}
								{podium[0] && (
									<motion.div
										initial={{ opacity: 0, scale: 0.9, y: 25 }}
										animate={{ opacity: 1, scale: 1, y: 0 }}
										transition={{ type: 'spring', delay: 0, duration: 0.5 }}
										className="order-1 md:order-2 flex flex-col items-center"
									>
										<div className="relative mb-3 flex flex-col items-center">
											<Crown className="h-6 w-6 text-amber-400 absolute -top-5 animate-bounce drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
											<Avatar className="h-20 w-20 border-2 border-amber-400 shadow-2xl ring-4 ring-amber-400/30">
												<AvatarImage src={podium[0].avatar_url || ''} />
												<AvatarFallback className="bg-gradient-to-tr from-amber-600 to-yellow-500 text-slate-950 font-black text-xl">
													{podium[0].username?.substring(0, 2).toUpperCase() ||
														'U'}
												</AvatarFallback>
											</Avatar>
											<div className="absolute -bottom-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs px-3 py-0.5 rounded-full shadow-lg">
												👑 1st
											</div>
										</div>
										<div className="w-full flex flex-col items-center pt-4 pb-5 px-5 rounded-t-3xl bg-gradient-to-b from-amber-500/20 via-amber-900/20 to-slate-900/80 border-t border-x border-amber-500/30 h-36 justify-center shadow-xl">
											<p className="text-base font-black truncate max-w-[150px] text-white">
												{podium[0].username}
											</p>
											<p className="text-sm text-amber-400 font-black tabular-numbers mt-0.5 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]">
												{podium[0].total_points} pts
											</p>
										</div>
									</motion.div>
								)}

								{/* 3rd place (Bronze pedestal, renders right on desktop) */}
								{podium[2] && (
									<motion.div
										initial={{ opacity: 0, scale: 0.9, y: 15 }}
										animate={{ opacity: 1, scale: 1, y: 0 }}
										transition={{ type: 'spring', delay: 0.2, duration: 0.4 }}
										className="order-3 flex flex-col items-center"
									>
										<div className="relative mb-3 flex flex-col items-center">
											<Avatar className="h-16 w-16 border-2 border-amber-700 shadow-xl ring-4 ring-amber-700/20">
												<AvatarImage src={podium[2].avatar_url || ''} />
												<AvatarFallback className="bg-slate-700 text-white font-black text-sm">
													{podium[2].username?.substring(0, 2).toUpperCase() ||
														'U'}
												</AvatarFallback>
											</Avatar>
											<div className="absolute -bottom-1.5 bg-gradient-to-r from-amber-600 to-amber-800 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-md">
												🥉 3rd
											</div>
										</div>
										<div className="w-full flex flex-col items-center pt-3 pb-4 px-4 rounded-t-2xl bg-gradient-to-b from-amber-800/15 via-slate-800/40 to-slate-900/60 border-t border-x border-amber-800/20 h-24 justify-center shadow-lg">
											<p className="text-sm font-bold truncate max-w-[140px] text-white">
												{podium[2].username}
											</p>
											<p className="text-xs text-amber-500 font-black tabular-numbers mt-0.5">
												{podium[2].total_points} pts
											</p>
										</div>
									</motion.div>
								)}
							</div>
						)}

						{/* Full Leaderboard Table */}
						<div className="overflow-hidden rounded-2xl glass-card border border-white/10 shadow-xl">
							<div className="overflow-x-auto">
								<table className="w-full text-left border-collapse">
									<thead>
										<tr className="border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400">
											<th className="py-4 px-5 text-center w-16">Rank</th>
											<th className="py-4 px-4">Predictor</th>
											<th className="py-4 px-4 text-center">Recent Form</th>
											<th className="py-4 px-4 text-center">Picks Made</th>
											<th className="py-4 px-4 text-center">
												3-Pointers (Exact)
											</th>
											<th className="py-4 px-4 text-right w-32">
												Total Points
											</th>
											<th className="py-4 px-5 text-center w-24">
												H2H Compare
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-white/5">
										{leaderboard &&
											leaderboard.map((row, idx) => {
												const isCurrentUser = row.user_id === user?.id;

												// Derive recent form pills from matrixData if available
												const memberRecentPicks =
													matrixData?.matches
														?.filter((m) => m.status === 'finished')
														.slice(-4)
														.map((m) => {
															const p =
																matrixData.predictions[row.user_id]?.[m.id];
															return {
																match: m,
																prediction: p || null,
																points: p?.points_earned ?? null,
															};
														}) || [];

												return (
													<motion.tr
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														transition={{
															delay: Math.min(idx * 0.04, 0.4),
															duration: 0.2,
														}}
														key={row.user_id}
														className={`transition duration-150 ${
															isCurrentUser
																? 'bg-indigo-500/10 hover:bg-indigo-500/15 font-bold'
																: 'hover:bg-white/5'
														}`}
													>
														<td className="py-4 px-5 text-center">
															<span
																className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-black ${
																	row.rank === 1
																		? 'bg-yellow-500 text-slate-950 shadow'
																		: row.rank === 2
																			? 'bg-slate-300 text-slate-950'
																			: row.rank === 3
																				? 'bg-amber-600 text-white'
																				: 'text-slate-400'
																}`}
															>
																{row.rank}
															</span>
														</td>
														<td className="py-4 px-4">
															<div className="flex items-center gap-3">
																<Avatar className="h-8 w-8 border border-white/5">
																	<AvatarImage src={row.avatar_url || ''} />
																	<AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
																		{row.username
																			?.substring(0, 2)
																			.toUpperCase() || 'U'}
																	</AvatarFallback>
																</Avatar>
																<div>
																	<p className="text-sm text-white flex items-center gap-1 truncate max-w-[180px]">
																		@{row.username || 'user'}
																		{isCurrentUser && (
																			<span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-md border border-indigo-500/30">
																				You
																			</span>
																		)}
																	</p>
																	{row.full_name && (
																		<p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
																			{row.full_name}
																		</p>
																	)}
																</div>
															</div>
														</td>

														{/* Phase 9: Recent Form Mini Badges */}
														<td className="py-4 px-4 text-center">
															<div className="inline-flex items-center justify-center gap-1.5 p-1 rounded-xl bg-black/30 border border-white/5">
																{memberRecentPicks.length > 0 ? (
																	memberRecentPicks.map((item, i) => {
																		const homeName =
																			item.match.home_team?.short_name ||
																			item.match.home_team?.name ||
																			'Home';
																		const awayName =
																			item.match.away_team?.short_name ||
																			item.match.away_team?.name ||
																			'Away';
																		const pts = item.points;

																		const getPillStyle = () => {
																			if (pts === 3) {
																				return 'bg-emerald-500 text-slate-950 ring-1 ring-emerald-400/50 shadow-sm shadow-emerald-500/20';
																			}
																			if (pts === 2) {
																				return 'bg-teal-500 text-slate-950 ring-1 ring-teal-400/50 shadow-sm shadow-teal-500/20';
																			}
																			if (pts === 1) {
																				return 'bg-indigo-500 text-white ring-1 ring-indigo-400/50 shadow-sm shadow-indigo-500/20';
																			}
																			if (pts === 0) {
																				return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
																			}
																			return 'bg-white/[0.04] text-slate-500 border border-dashed border-white/10';
																		};

																		const getPillTooltip = () => {
																			const teamsStr = `${homeName} vs ${awayName}`;
																			const scoreStr = `Final: ${item.match.home_score ?? 0} - ${item.match.away_score ?? 0}`;
																			const pickStr = item.prediction
																				? `Pick: ${item.prediction.predicted_home_score} - ${item.prediction.predicted_away_score}`
																				: 'Pick: None';
																			const ptsStr =
																				pts === 3
																					? '+3 PTS (Exact Score)'
																					: pts === 2
																						? '+2 PTS (Goal Diff Margin)'
																						: pts === 1
																							? '+1 PT (Match Winner)'
																							: pts === 0
																								? '0 PTS (Missed)'
																								: 'No Pick Placed';
																			return `${teamsStr}\n${scoreStr}\n${pickStr} • ${ptsStr}\n(Click to view full breakdown)`;
																		};

																		return (
																			<button
																				key={i}
																				type="button"
																				onClick={() =>
																					handleOpenCellBreakdown(
																						item.match,
																						item.prediction,
																						row.username || undefined,
																					)
																				}
																				title={getPillTooltip()}
																				aria-label={`${homeName} vs ${awayName}: ${getPillTooltip()}`}
																				className={`h-5 w-5 rounded-full inline-flex items-center justify-center text-[10px] font-black transition-all duration-150 hover:scale-125 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer ${getPillStyle()}`}
																			>
																				{pts !== null ? pts : '—'}
																			</button>
																		);
																	})
																) : (
																	<span className="text-slate-600 text-xs px-2 py-0.5">
																		—
																	</span>
																)}
															</div>
														</td>

														<td className="py-4 px-4 text-center text-sm text-slate-300">
															{row.predictions_count}
														</td>
														<td className="py-4 px-4 text-center">
															<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
																🎯 {row.exact_count}
															</span>
														</td>
														<td className="py-4 px-4 text-right">
															<span className="text-sm font-black text-white">
																{row.total_points} pts
															</span>
														</td>
														<td className="py-4 px-5 text-center">
															{!isCurrentUser ? (
																<Button
																	variant="ghost"
																	className="h-8 w-8 p-0 text-indigo-400 hover:text-indigo-300 hover:bg-white/5 rounded-lg"
																	onClick={() => {
																		setSelectedOpponentId(row.user_id);
																		setActiveTab('h2h');
																	}}
																	title={`Compare H2H with @${row.username}`}
																>
																	<Sword className="h-4 w-4" />
																</Button>
															) : (
																<span className="text-slate-600 font-bold text-xs">
																	-
																</span>
															)}
														</td>
													</motion.tr>
												);
											})}

										{(!leaderboard || leaderboard.length === 0) && (
											<tr>
												<td
													colSpan={7}
													className="py-12 text-center text-slate-400 text-sm"
												>
													No standings available. Join and get predicted!
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>
					</TabsContent>

					{/* 👥 MEMBERS TAB */}
					<TabsContent
						value="members"
						className="outline-none"
					>
						<div className="overflow-hidden rounded-2xl glass-card border border-white/10 shadow-xl">
							<div className="overflow-x-auto">
								<table className="w-full text-left border-collapse">
									<thead>
										<tr className="border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400">
											<th className="py-4 px-5">Predictor</th>
											<th className="py-4 px-4">Role</th>
											<th className="py-4 px-5 text-right">Joined Date</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-white/5">
										{members &&
											members.map((member) => {
												const profile = member.profile;
												const isOwner = member.role === 'creator';

												return (
													<tr
														key={member.user_id}
														className="hover:bg-white/5"
													>
														<td className="py-4 px-5">
															<div className="flex items-center gap-3">
																<Avatar className="h-9 w-9 border border-white/15">
																	<AvatarImage
																		src={profile?.avatar_url || ''}
																	/>
																	<AvatarFallback className="bg-indigo-600 text-white font-bold text-sm">
																		{profile?.username
																			?.substring(0, 2)
																			.toUpperCase() || 'U'}
																	</AvatarFallback>
																</Avatar>
																<div>
																	<p className="text-sm font-bold text-white">
																		@{profile?.username || 'user'}
																	</p>
																	<p className="text-xs text-slate-400">
																		{profile?.full_name || 'Kudo Predictor'}
																	</p>
																</div>
															</div>
														</td>
														<td className="py-4 px-4">
															{isOwner ? (
																<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
																	<Crown className="h-3 w-3 text-yellow-500" />
																	Creator
																</span>
															) : (
																<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
																	Member
																</span>
															)}
														</td>
														<td className="py-4 px-5 text-right text-xs text-slate-400">
															{new Date(member.joined_at).toLocaleDateString(
																'en-US',
																{
																	month: 'short',
																	day: 'numeric',
																	year: 'numeric',
																},
															)}
														</td>
													</tr>
												);
											})}
									</tbody>
								</table>
							</div>
						</div>
					</TabsContent>

					{/* 🔍 PICKS MATRIX TAB */}
					<TabsContent
						value="matrix"
						className="outline-none"
					>
						<div className="overflow-hidden rounded-2xl glass-card border border-white/10 shadow-xl p-6 space-y-4">
							{/* Matchweek Selection Header & Rail */}
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
								<div>
									<h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
										<Calendar className="h-4 w-4 text-indigo-400" />
										<span>Matchweek {matchday} Picks Matrix</span>
									</h2>
									<p className="text-xs text-slate-400">
										View how pool members predicted every fixture across
										matchweeks.
									</p>
								</div>

								{/* Matchweek Select Dropdown for quick navigation */}
								<div className="flex items-center gap-2 self-start sm:self-auto">
									<span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
										Round:
									</span>
									<select
										value={matchday}
										aria-label="Select Matchweek"
										onChange={(e) =>
											handleMatchdayChange(parseInt(e.target.value, 10))
										}
										className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-white/[0.08] transition"
									>
										{availableMatchdays.map((day) => (
											<option
												key={day}
												value={day}
												className="bg-slate-950 text-white font-bold"
											>
												Matchweek {day}{' '}
												{day === activeMatchday ? '(Current)' : ''}
											</option>
										))}
									</select>
								</div>
							</div>

							{/* Horizontal Gameweek Pill Rail with Quick Scroll Arrows */}
							<div className="relative flex items-center gap-1.5">
								<button
									type="button"
									onClick={() => scrollPills('left')}
									aria-label="Scroll matchweeks left"
									title="Scroll matchweeks left"
									className="h-8 w-8 shrink-0 rounded-xl glass-card border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-90 shadow-md"
								>
									<ChevronLeft className="h-4 w-4" />
								</button>

								<div
									ref={pillRailRef}
									className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar flex-1 scroll-smooth"
								>
									{availableMatchdays.map((day) => {
										const isSelected = day === matchday;
										const isCurrent = day === activeMatchday;
										return (
											<button
												key={day}
												type="button"
												onClick={() => handleMatchdayChange(day)}
												className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all duration-200 active:scale-95 ${
													isSelected
														? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40'
														: 'glass-pill text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20'
												}`}
											>
												<span>MW {day}</span>
												{isCurrent && (
													<span
														className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
															isSelected
																? 'bg-white/20 text-white'
																: 'bg-indigo-500/20 text-indigo-300'
														}`}
													>
														Live
													</span>
												)}
											</button>
										);
									})}
								</div>

								<button
									type="button"
									onClick={() => scrollPills('right')}
									aria-label="Scroll matchweeks right"
									title="Scroll matchweeks right"
									className="h-8 w-8 shrink-0 rounded-xl glass-card border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-90 shadow-md"
								>
									<ChevronRight className="h-4 w-4" />
								</button>
							</div>

							<div className="flex items-center justify-between gap-3 text-sm text-slate-400 bg-white/5 p-3 rounded-xl border border-white/5 flex-wrap">
								<div className="flex items-center gap-2">
									<Info className="h-4 w-4 text-indigo-400 shrink-0" />
									<span>
										Predictions are hidden (🔒) until kickoff. Tap any cell to
										view scoring breakdown.
									</span>
								</div>

								<div className="flex items-center gap-3">
									<span className="text-xs text-indigo-300 font-bold hidden sm:inline">
										Tap headers for Community Stats 📊
									</span>

									{/* Quick Scroll Fixtures Controls */}
									<div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2 py-1">
										<span className="text-[11px] font-bold text-slate-300">
											Scroll:
										</span>
										<button
											type="button"
											onClick={() => scrollMatrix('left')}
											aria-label="Scroll matrix left"
											title="Scroll matrix left"
											className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition active:scale-90"
										>
											<ChevronLeft className="h-4 w-4" />
										</button>
										<button
											type="button"
											onClick={() => scrollMatrix('right')}
											aria-label="Scroll matrix right"
											title="Scroll matrix right"
											className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition active:scale-90"
										>
											<ChevronRight className="h-4 w-4" />
										</button>
									</div>
								</div>
							</div>

							<div className="relative group">
								<div
									ref={matrixScrollRef}
									className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/40 scroll-smooth"
								>
									<table className="w-full text-left border-collapse min-w-[800px]">
										<thead>
											<tr className="border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400">
												<th className="py-4 px-5 min-w-[200px] sticky left-0 z-20 bg-slate-950/95 backdrop-blur-md">
													Predictor
												</th>
												{matrixData?.matches.map((match) => {
													const homeName =
														match.home_team?.short_name ||
														match.home_team?.name.substring(0, 3).toUpperCase();
													const awayName =
														match.away_team?.short_name ||
														match.away_team?.name.substring(0, 3).toUpperCase();
													return (
														<th
															key={match.id}
															onClick={() => handleOpenMatchInsights(match)}
															className="py-4 px-3 text-center min-w-[105px] border-l border-white/5 cursor-pointer hover:bg-white/5 transition group"
															title="Click to view match prediction insights"
														>
															<div className="flex flex-col items-center justify-center space-y-1">
																<span className="text-white text-xs font-black group-hover:text-indigo-300 transition">
																	{homeName} vs {awayName}
																</span>
																{match.status === 'finished' ? (
																	<span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
																		{match.home_score} - {match.away_score}
																	</span>
																) : match.status === 'live' ? (
																	<span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
																		{match.home_score ?? 0} -{' '}
																		{match.away_score ?? 0} Live
																	</span>
																) : (
																	<span className="text-[9px] text-slate-500 font-bold">
																		{new Date(
																			match.kickoff_time,
																		).toLocaleDateString(undefined, {
																			month: 'short',
																			day: 'numeric',
																		})}
																	</span>
																)}
															</div>
														</th>
													);
												})}
											</tr>
										</thead>
										<tbody className="divide-y divide-white/5">
											{leaderboard &&
												leaderboard.map((row) => {
													const isCurrentUser = row.user_id === user?.id;
													return (
														<tr
															key={row.user_id}
															className={`transition duration-150 ${isCurrentUser ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}
														>
															<td className="py-4 px-5 sticky left-0 z-10 bg-slate-950/95 backdrop-blur-md">
																<div className="flex items-center gap-3">
																	<Avatar className="h-8 w-8 border border-white/5">
																		<AvatarImage src={row.avatar_url || ''} />
																		<AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
																			{row.username
																				?.substring(0, 2)
																				.toUpperCase() || 'U'}
																		</AvatarFallback>
																	</Avatar>
																	<div>
																		<p className="text-sm font-bold text-white flex items-center gap-1.5">
																			@{row.username}
																			{isCurrentUser && (
																				<span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-md border border-indigo-500/30">
																					You
																				</span>
																			)}
																		</p>
																		<p className="text-[10px] text-slate-400">
																			Rank {row.rank} • {row.total_points} pts
																		</p>
																	</div>
																</div>
															</td>

															{matrixData?.matches.map((match) => {
																const pred =
																	matrixData.predictions[row.user_id]?.[
																		match.id
																	];
																const isMatchLocked =
																	new Date(match.kickoff_time) <= new Date() ||
																	match.status === 'finished' ||
																	match.status === 'live';
																const isCurrentUserCell =
																	row.user_id === user?.id;

																// Decides whether cell content should be masked
																const canReveal =
																	isMatchLocked || isCurrentUserCell;

																let cellBg = '';
																let cellText = 'text-slate-400';
																let contentStr = '-';

																if (pred) {
																	if (canReveal) {
																		contentStr = `${pred.predicted_home_score} - ${pred.predicted_away_score}`;
																		if (match.status === 'finished') {
																			if (pred.points_earned === 3) {
																				cellBg =
																					'bg-emerald-500/10 border border-emerald-500/20';
																				cellText =
																					'text-emerald-400 font-extrabold';
																			} else if (pred.points_earned === 2) {
																				cellBg =
																					'bg-teal-500/10 border border-teal-500/20';
																				cellText =
																					'text-teal-400 font-extrabold';
																			} else if (pred.points_earned === 1) {
																				cellBg =
																					'bg-blue-500/10 border border-blue-500/20';
																				cellText =
																					'text-blue-400 font-extrabold';
																			} else {
																				cellBg = 'bg-slate-500/5';
																				cellText = 'text-slate-400';
																			}
																		} else {
																			cellText = 'text-slate-200 font-bold';
																		}
																	} else {
																		// Match is in future, and it's someone else's pick
																		contentStr = '🔒 Hidden';
																		cellBg = 'bg-white/[0.01]';
																		cellText =
																			'text-slate-500 text-xs font-semibold';
																	}
																}

																return (
																	<td
																		key={match.id}
																		onClick={() => {
																			if (pred && canReveal) {
																				handleOpenCellBreakdown(
																					match,
																					pred,
																					row.username || undefined,
																				);
																			}
																		}}
																		className={`py-4 px-3 text-center border-l border-white/5 transition duration-150 ${cellBg} ${pred && canReveal ? 'cursor-pointer hover:opacity-80' : ''}`}
																	>
																		<div className="flex flex-col items-center justify-center">
																			<span className={`text-xs ${cellText}`}>
																				{contentStr}
																			</span>
																			{pred &&
																				match.status === 'finished' &&
																				canReveal && (
																					<span className="text-[8px] opacity-80 block mt-0.5">
																						+{pred.points_earned} pts
																					</span>
																				)}
																		</div>
																	</td>
																);
															})}
														</tr>
													);
												})}

											{(!matrixData?.matches ||
												matrixData.matches.length === 0) && (
												<tr>
													<td
														colSpan={2}
														className="py-12 text-center text-slate-400 text-sm"
													>
														No fixtures scheduled for Matchweek {matchday}.
													</td>
												</tr>
											)}
											{leaderboard &&
												leaderboard.length === 0 &&
												matrixData?.matches &&
												matrixData.matches.length > 0 && (
													<tr>
														<td
															colSpan={matrixData.matches.length + 1}
															className="py-12 text-center text-slate-400 text-sm"
														>
															No members in this league yet.
														</td>
													</tr>
												)}
										</tbody>
									</table>
								</div>

								{/* Floating Scroll Arrows on Edge of Table */}
								<button
									type="button"
									onClick={() => scrollMatrix('left')}
									aria-label="Scroll fixtures left"
									title="Scroll fixtures left"
									className="absolute left-[208px] top-1/2 -translate-y-1/2 z-30 p-2 rounded-xl bg-slate-900/90 hover:bg-indigo-600 text-white border border-white/15 shadow-2xl backdrop-blur-md transition-all duration-200 active:scale-90 opacity-75 hover:opacity-100 hover:scale-105 hidden sm:flex items-center justify-center"
								>
									<ChevronLeft className="h-5 w-5" />
								</button>
								<button
									type="button"
									onClick={() => scrollMatrix('right')}
									aria-label="Scroll fixtures right"
									title="Scroll fixtures right"
									className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-xl bg-slate-900/90 hover:bg-indigo-600 text-white border border-white/15 shadow-2xl backdrop-blur-md transition-all duration-200 active:scale-90 opacity-75 hover:opacity-100 hover:scale-105 hidden sm:flex items-center justify-center"
								>
									<ChevronRight className="h-5 w-5" />
								</button>
							</div>
						</div>
					</TabsContent>

					{/* 💬 BANTER CHAT TAB */}
					<TabsContent
						value="chat"
						className="outline-none"
					>
						{user && (
							<PoolChat
								poolId={poolId}
								userId={user.id}
								username={
									user.user_metadata?.username ||
									user.email?.split('@')[0] ||
									'user'
								}
								isCreator={isCreator}
							/>
						)}
					</TabsContent>

					{/* ⚔️ HEAD-TO-HEAD TAB */}
					<TabsContent
						value="h2h"
						className="outline-none"
					>
						{leaderboard && members && (
							<HeadToHead
								poolId={poolId}
								currentUserId={user?.id}
								leaderboard={leaderboard}
								members={members}
								matrixData={matrixData || null}
								defaultOpponentId={selectedOpponentId}
							/>
						)}
					</TabsContent>
				</Tabs>
			</div>

			{/* Phase 9: Scoring Breakdown Modal */}
			<ScoreBreakdownModal
				isOpen={isBreakdownOpen}
				onClose={() => setIsBreakdownOpen(false)}
				match={breakdownMatch}
				prediction={breakdownPrediction}
				username={breakdownUsername}
			/>

			{/* Phase 9: Match Pool Insights Modal */}
			<MatchPoolInsightsModal
				isOpen={isInsightsOpen}
				onClose={() => setIsInsightsOpen(false)}
				match={insightsMatch}
				poolId={poolId}
				poolName={pool.name}
			/>

			{/* Phase 9: Universal Scoring Rules Modal */}
			<ScoringRulesModal
				isOpen={isRulesModalOpen}
				onClose={() => setIsRulesModalOpen(false)}
			/>

			{/* Phase 9: What-If Simulator */}
			{matrixData && leaderboard && (
				<WhatIfScenarioSimulator
					isOpen={isSimulatorOpen}
					onClose={() => setIsSimulatorOpen(false)}
					matches={matrixData.matches}
					leaderboard={leaderboard}
					predictionsByMember={matrixData.predictions}
					currentUserId={user?.id}
					poolName={pool.name}
				/>
			)}
		</div>
	);
}
