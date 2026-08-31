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
import { fetchEditionRounds } from '@/lib/queries/competitions';
import { fetchEvents } from '@/lib/queries/events';
import {
	fetchPoolById,
	fetchPoolLeaderboard,
	fetchPoolPicksMatrix,
	leavePool,
	poolsQueryKeys,
} from '@/lib/queries/pools';
import { createClient } from '@/lib/supabase/client';
import {
	MarketPrediction,
	PoolLeaderboardEntry,
	ScopedPool,
	SportEvent,
} from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ArrowLeft,
	BookOpen,
	Calculator,
	Copy,
	Globe,
	Info,
	Loader2,
	Lock,
	LogOut,
	Shield,
	Trophy
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function PoolDetailPage() {
	const params = useParams();
	const router = useRouter();
	const queryClient = useQueryClient();
	const supabase = createClient();
	const poolId = params.id as string;

	const [user, setUser] = useState<any>(null);
	const [userLoading, setUserLoading] = useState(true);
	const [copying, setCopying] = useState(false);
	const [activeTab, setActiveTab] = useState('standings');
	const [selectedOpponentId, setSelectedOpponentId] = useState<
		string | undefined
	>(undefined);
	const [selectedRound, setSelectedRound] = useState<string | undefined>(
		undefined,
	);

	// Modals State
	const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
	const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

	const [breakdownEvent, setBreakdownEvent] = useState<SportEvent | null>(null);
	const [breakdownPrediction, setBreakdownPrediction] =
		useState<MarketPrediction | null>(null);
	const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

	const [insightsEvent, setInsightsEvent] = useState<SportEvent | null>(null);
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

	// Fetch pool details
	const {
		data: pool,
		isLoading: poolLoading,
		error: poolError,
	} = useQuery<ScopedPool | null>({
		queryKey: poolsQueryKeys.detail(poolId),
		queryFn: () => fetchPoolById(poolId),
		enabled: !!poolId,
	});

	// Fetch pool leaderboard
	const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery<
		PoolLeaderboardEntry[]
	>({
		queryKey: poolsQueryKeys.leaderboard(poolId),
		queryFn: () => fetchPoolLeaderboard(poolId),
		enabled: !!poolId,
	});

	// Fetch events for matrix / simulator / H2H
	const { data: events = [], isLoading: eventsLoading } = useQuery<
		SportEvent[]
	>({
		queryKey: ['events', 'pool', poolId, selectedRound ?? 'all'],
		queryFn: () =>
			fetchEvents({
				editionId: pool?.edition_id || undefined,
				sportSlug: pool?.sport_slug || undefined,
				roundLabel: selectedRound,
			}),
		enabled: !!pool,
	});
	const { data: picksMatrix = { matches: [], predictions: {} } } = useQuery({
		queryKey: poolsQueryKeys.picksMatrix(poolId, selectedRound),
		queryFn: () => fetchPoolPicksMatrix(poolId, selectedRound),
		enabled: !!pool,
	});

	// Fetch available rounds
	const { data: rounds = [] } = useQuery<string[]>({
		queryKey: ['edition_rounds', pool?.edition_id ?? 'default'],
		queryFn: () =>
			pool?.edition_id
				? fetchEditionRounds(pool.edition_id)
				: Promise.resolve([]),
		enabled: !!pool?.edition_id,
	});

	// Setup Realtime Subscription
	useEffect(() => {
		if (!poolId) return;

		const channel = supabase
			.channel(`pool_realtime:${poolId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'pool_members',
					filter: `pool_id=eq.${poolId}`,
				},
				() => {
					queryClient.invalidateQueries({
						queryKey: poolsQueryKeys.leaderboard(poolId),
					});
					queryClient.invalidateQueries({
						queryKey: poolsQueryKeys.detail(poolId),
					});
				},
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'predictions',
				},
				() => {
					queryClient.invalidateQueries({
						queryKey: poolsQueryKeys.leaderboard(poolId),
					});
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [poolId, supabase, queryClient]);

	const leaveMutation = useMutation({
		mutationFn: async () => {
			if (!user?.id) throw new Error('Authentication required');
			return leavePool(poolId, user.id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: poolsQueryKeys.user(user?.id),
			});
			toast.success('You have left the pool.');
			router.push('/leagues');
		},
		onError: (err: any) => {
			toast.error(err.message || 'Failed to leave pool.');
		},
	});

	const copyInviteCode = () => {
		if (!pool?.invite_code) return;
		navigator.clipboard.writeText(pool.invite_code);
		setCopying(true);
		toast.success('Invite code copied to clipboard!');
		setTimeout(() => setCopying(false), 2000);
	};

	if (userLoading || poolLoading) {
		return (
			<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center pt-16">
				<Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
				<p className="text-slate-400 text-xs mt-4">Loading pool arena...</p>
			</div>
		);
	}

	if (poolError || !pool) {
		return (
			<div className="min-h-screen bg-slate-950 text-white pt-24 px-4 flex flex-col items-center justify-center">
				<div className="max-w-md w-full text-center p-8 rounded-2xl glass-card border border-white/10 shadow-2xl">
					<Shield className="h-12 w-12 text-slate-500 mx-auto mb-4" />
					<h2 className="text-2xl font-extrabold tracking-tight mb-2">
						Pool Not Found
					</h2>
					<p className="text-slate-400 text-xs mb-6">
						This prediction pool may be private or no longer exists.
					</p>
					<Button
						className="bg-indigo-600 hover:bg-indigo-700 w-full"
						asChild
					>
						<Link href="/leagues">Back to My Pools</Link>
					</Button>
				</div>
			</div>
		);
	}

	const isCreator = user?.id === pool.created_by;
	const userEntry = leaderboard.find((m) => m.user_id === user?.id);

	return (
		<div className="min-h-screen bg-slate-950 text-white pt-24 pb-16 px-4 md:px-8">
			<div className="max-w-6xl mx-auto space-y-8">
				{/* Top Nav Back Link */}
				<div>
					<Link
						href="/leagues"
						className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
					>
						<ArrowLeft className="h-4 w-4" />
						<span>Back to All Pools</span>
					</Link>
				</div>

				{/* Pool Header Banner */}
				<div className="p-6 md:p-8 rounded-3xl glass-card border border-white/10 relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900/60 to-indigo-950/30 shadow-2xl space-y-6">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
						<div className="space-y-2">
							<div className="flex items-center gap-2 flex-wrap">
								<span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
									{pool.scope_kind === 'all_sports'
										? '🌐 All Sports'
										: pool.sport_slug === 'rugby-union'
											? '🏉 Rugby Union'
											: '⚽ Football'}
								</span>
								<span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
									{pool.scoring_mode === 'normalized'
										? '10k Normalized Pts'
										: 'Standard Raw Pts'}
								</span>
								{pool.is_private ? (
									<span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-white/10 flex items-center gap-1">
										<Lock className="h-3 w-3" /> Private
									</span>
								) : (
									<span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
										<Globe className="h-3 w-3" /> Public
									</span>
								)}
							</div>

							<h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
								{pool.name}
							</h1>
							<p className="text-xs text-slate-400">
								Created by {pool.creator?.full_name || 'Admin'} •{' '}
								{pool.member_count ?? leaderboard.length} members
							</p>
							<p className="text-[11px] text-slate-500">
								{pool.competition?.name || pool.edition?.name || (pool.scope_kind === 'all_sports' ? 'All active sports' : 'All competitions in scope')} · scoring starts {pool.scoring_starts_at ? new Date(pool.scoring_starts_at).toLocaleString() : 'now'} · membership period applies from join time
							</p>
						</div>

						{/* Invite Code & Action Strip */}
						<div className="flex items-center gap-3 flex-wrap">
							<button
								onClick={copyInviteCode}
								className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition text-xs font-mono font-bold tracking-widest text-indigo-300 group"
								title="Click to copy invite code"
							>
								<span>CODE: {pool.invite_code}</span>
								<Copy className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition" />
							</button>

							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsRulesModalOpen(true)}
								className="border-white/10 hover:bg-white/5 text-slate-300 text-xs font-semibold rounded-xl h-10 gap-1.5"
							>
								<BookOpen className="h-4 w-4 text-indigo-400" />
								<span>Scoring Rules</span>
							</Button>

							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsSimulatorOpen(true)}
								className="border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-xs font-semibold rounded-xl h-10 gap-1.5"
							>
								<Calculator className="h-4 w-4 text-purple-400" />
								<span>Simulator</span>
							</Button>

							{!isCreator && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => leaveMutation.mutate()}
									disabled={leaveMutation.isPending}
									className="border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-xs rounded-xl h-10"
								>
									<LogOut className="h-4 w-4 mr-1" />
									Leave
								</Button>
							)}
						</div>
					</div>

					{/* Scoring Policy Info Strip */}
					<div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 flex items-center gap-2">
						<Info className="h-4 w-4 text-indigo-400 shrink-0" />
						<span>
							<b>Non-retroactive scoring rule:</b> Member standings include only
							predictions on markets that locked after joining.
						</span>
					</div>
				</div>

				{/* Primary Tabs */}
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="space-y-6"
				>
					<TabsList className="bg-slate-900/80 p-1 rounded-2xl border border-white/10 grid grid-cols-4 max-w-xl">
						<TabsTrigger
							value="standings"
							className="rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
						>
							Standings
						</TabsTrigger>
						<TabsTrigger
							value="picks"
							className="rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
						>
							Picks Matrix
						</TabsTrigger>
						<TabsTrigger
							value="h2h"
							className="rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
						>
							Head-to-Head
						</TabsTrigger>
						<TabsTrigger
							value="chat"
							className="rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
						>
							Banter
						</TabsTrigger>
					</TabsList>

					{/* TAB 1: STANDINGS */}
					<TabsContent
						value="standings"
						className="space-y-4"
					>
						<div className="glass-card rounded-3xl border border-white/10 overflow-hidden shadow-xl">
							<div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between">
								<h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
									<Trophy className="h-5 w-5 text-amber-400" />
									<span>Pool Standings Leaderboard</span>
								</h3>
								<span className="text-xs text-slate-400 font-semibold">
									{leaderboard.length} Ranked Members
								</span>
							</div>

							{leaderboardLoading ? (
								<div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
									<Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
									<span className="text-xs">Computing live standings...</span>
								</div>
							) : leaderboard.length === 0 ? (
								<div className="py-16 text-center text-slate-500 text-xs">
									No members have earned points yet. Share your invite code to
									get started!
								</div>
							) : (
								<div className="divide-y divide-white/5">
									{leaderboard.map((entry) => {
										const isMe = entry.user_id === user?.id;

										return (
											<div
												key={entry.user_id}
												className={`p-4 sm:p-5 flex items-center justify-between transition ${
													isMe
														? 'bg-indigo-600/10 border-l-4 border-indigo-500'
														: 'hover:bg-white/[0.02]'
												}`}
											>
												<div className="flex items-center gap-3 sm:gap-4 min-w-0">
													<div
														className={`w-7 text-center font-black text-sm ${
															entry.rank === 1
																? 'text-amber-400'
																: entry.rank === 2
																	? 'text-slate-300'
																	: entry.rank === 3
																		? 'text-amber-600'
																		: 'text-slate-500'
														}`}
													>
														#{entry.rank}
													</div>

													<Avatar className="h-9 w-9 sm:h-10 sm:w-10 border border-white/10 shrink-0">
														<AvatarImage src={entry.avatar_url ?? undefined} />
														<AvatarFallback className="bg-slate-800 text-xs font-bold text-slate-200">
															{entry.full_name?.charAt(0) ?? 'U'}
														</AvatarFallback>
													</Avatar>

													<div className="min-w-0">
														<div className="flex items-center gap-1.5">
															<span className="font-bold text-xs sm:text-sm text-slate-100 truncate">
																{entry.full_name || 'Anonymous User'}
															</span>
															{isMe && (
																<span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.2 rounded-full">
																	You
																</span>
															)}
														</div>
														<div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
															<span>{entry.exact_count} Exact</span>
															<span>•</span>
															<span>{entry.margin_count} Margin</span>
															<span>•</span>
															<span>{entry.predictions_count} Picks</span>
														</div>
													</div>
												</div>

												{/* Total Points */}
												<div className="text-right shrink-0">
													<span className="text-lg sm:text-xl font-black text-white">
														{entry.total_points}
													</span>
													<span className="text-xs text-slate-400 font-bold ml-1">
														PTS
													</span>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</TabsContent>

					{/* TAB 2: PICKS MATRIX */}
					<TabsContent
						value="picks"
						className="space-y-4"
					>
						<div className="glass-card rounded-3xl border border-white/10 p-5 space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="font-bold text-sm text-white">
									Round Predictions Matrix
								</h3>
								{rounds.length > 0 && (
									<select
										value={selectedRound || ''}
										onChange={(e) =>
											setSelectedRound(e.target.value || undefined)
										}
										className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1 text-xs text-white"
									>
										<option value="">All Rounds</option>
										{rounds.map((r) => (
											<option
												key={r}
												value={r}
											>
												{r}
											</option>
										))}
									</select>
								)}
							</div>

							<div className="overflow-x-auto">
								<table className="w-full text-xs text-left border-collapse">
									<thead>
										<tr className="border-b border-white/10 text-slate-400">
											<th className="py-2.5 px-3">Event</th>
											<th className="py-2.5 px-3">Result</th>
											<th className="py-2.5 px-3">Your Pick</th>
											<th className="py-2.5 px-3 text-right">Points</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-white/5">
										{events.map((ev) => {
											const homeComp =
												ev.competitors?.find(
													(c) => c.slot === 1 || c.role === 'home',
												)?.competitor ?? ev.competitors?.[0]?.competitor;
											const awayComp =
												ev.competitors?.find(
													(c) => c.slot === 2 || c.role === 'away',
												)?.competitor ?? ev.competitors?.[1]?.competitor;

											const currentM = ev.current_market ?? ev.markets?.[0];
											const marketRes = currentM?.result?.result as
												| { home: number; away: number }
												| undefined;
											const userPick = currentM?.user_prediction;
											const userSel = userPick?.selection as
												| { home: number; away: number }
												| undefined;

											return (
												<tr
													key={ev.id}
													className="hover:bg-white/[0.02]"
												>
													<td className="py-2.5 px-3 font-semibold text-slate-200">
														{homeComp?.short_name || homeComp?.name || 'Home'}{' '}
														vs{' '}
														{awayComp?.short_name || awayComp?.name || 'Away'}
													</td>
													<td className="py-2.5 px-3 font-mono font-bold text-white">
														{marketRes
															? `${marketRes.home} - ${marketRes.away}`
															: '—'}
													</td>
													<td className="py-2.5 px-3">
														{userSel ? (
															<span className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
																{userSel.home} - {userSel.away}
															</span>
														) : (
															<span className="text-slate-500 italic">
																None
															</span>
														)}
													</td>
													<td className="py-2.5 px-3 text-right font-black text-amber-400">
														{userPick?.raw_points !== null &&
														userPick?.raw_points !== undefined
															? `+${userPick.raw_points}`
															: '—'}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					</TabsContent>

					{/* TAB 3: HEAD TO HEAD */}
					<TabsContent
						value="h2h"
						className="space-y-4"
					>
						<HeadToHead
							poolId={poolId}
							currentUserId={user?.id || ''}
							leaderboard={leaderboard}
							members={[]}
							matrixData={picksMatrix}
						/>
					</TabsContent>

					{/* TAB 4: CHAT */}
					<TabsContent
						value="chat"
						className="space-y-4"
					>
						<PoolChat
							poolId={poolId}
							userId={user?.id || ''}
							username={user?.email?.split('@')[0] || 'User'}
							isCreator={isCreator}
						/>
					</TabsContent>
				</Tabs>
			</div>

			{/* MODALS */}
			<ScoringRulesModal
				isOpen={isRulesModalOpen}
				onClose={() => setIsRulesModalOpen(false)}
			/>

			<WhatIfScenarioSimulator
				isOpen={isSimulatorOpen}
				onClose={() => setIsSimulatorOpen(false)}
				events={events}
				leaderboard={leaderboard}
				predictionsByMember={Object.entries(picksMatrix.predictions).reduce((acc, [key, prediction]) => { const [memberId, eventId] = key.split('_'); (acc[memberId] ||= {})[eventId] = prediction; return acc; }, {} as Record<string, Record<string, any>>)}
				currentUserId={user?.id}
		poolName={pool.name}
		poolScoringMode={pool.scoring_mode}
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
				poolId={poolId}
				poolName={pool.name}
			/>
		</div>
	);
}
