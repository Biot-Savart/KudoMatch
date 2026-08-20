'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    fetchPoolDetails,
    fetchPoolLeaderboard,
    fetchPoolMembers,
    leavePool,
} from '@/lib/queries/pools';
import { createClient } from '@/lib/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    Copy,
    Crown,
    Loader2,
    LogOut,
    MessageCircle,
    Users
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

	const isCreator = pool?.creator_id === user?.id;
	const isMember = members?.some((m) => m.user_id === user?.id);

	const isLoading =
		userLoading || poolLoading || leaderboardLoading || membersLoading;

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
	const rest = leaderboard ? leaderboard.slice(3) : [];

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
					defaultValue="standings"
					className="w-full space-y-4"
				>
					<TabsList className="bg-slate-900 border border-white/5 p-1 rounded-xl w-full sm:w-auto flex">
						<TabsTrigger
							value="standings"
							className="flex-1 sm:flex-none py-2.5 font-bold rounded-lg text-xs uppercase tracking-wider"
						>
							🏆 Standings
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
						{/* Podium for Top 3 */}
						{podium.length > 0 && (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-4 pb-2">
								{/* 2nd place (renders left on desktop) */}
								{podium[1] && (
									<div className="order-2 md:order-1 flex flex-col items-center">
										<div className="relative mb-3 flex flex-col items-center">
											<Avatar className="h-14 w-14 border-2 border-slate-300 shadow-lg">
												<AvatarImage src={podium[1].avatar_url || ''} />
												<AvatarFallback className="bg-slate-700 text-white font-bold text-sm">
													{podium[1].username?.substring(0, 2).toUpperCase() ||
														'U'}
												</AvatarFallback>
											</Avatar>
											<div className="absolute -bottom-1 bg-slate-300 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow">
												2nd
											</div>
										</div>
										<p className="text-sm font-bold truncate max-w-[150px]">
											{podium[1].username}
										</p>
										<p className="text-xs text-indigo-400 font-extrabold">
											{podium[1].total_points} pts
										</p>
									</div>
								)}

								{/* 1st place (center, larger) */}
								{podium[0] && (
									<div className="order-1 md:order-2 flex flex-col items-center bg-gradient-to-b from-indigo-500/10 to-indigo-500/0 border border-indigo-500/20 rounded-2xl p-4 shadow-xl">
										<div className="relative mb-3 flex flex-col items-center">
											<Crown className="h-5 w-5 text-yellow-500 absolute -top-4 animate-bounce" />
											<Avatar className="h-18 w-18 border-2 border-yellow-500 shadow-lg shadow-yellow-500/20">
												<AvatarImage src={podium[0].avatar_url || ''} />
												<AvatarFallback className="bg-yellow-600 text-white font-bold text-lg">
													{podium[0].username?.substring(0, 2).toUpperCase() ||
														'U'}
												</AvatarFallback>
											</Avatar>
											<div className="absolute -bottom-1 bg-yellow-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow">
												1st
											</div>
										</div>
										<p className="text-base font-extrabold truncate max-w-[160px]">
											{podium[0].username}
										</p>
										<p className="text-sm text-yellow-500 font-extrabold">
											{podium[0].total_points} pts
										</p>
									</div>
								)}

								{/* 3rd place (renders right on desktop) */}
								{podium[2] && (
									<div className="order-3 flex flex-col items-center">
										<div className="relative mb-3 flex flex-col items-center">
											<Avatar className="h-14 w-14 border-2 border-amber-600 shadow-lg">
												<AvatarImage src={podium[2].avatar_url || ''} />
												<AvatarFallback className="bg-slate-700 text-white font-bold text-sm">
													{podium[2].username?.substring(0, 2).toUpperCase() ||
														'U'}
												</AvatarFallback>
											</Avatar>
											<div className="absolute -bottom-1 bg-amber-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow">
												3rd
											</div>
										</div>
										<p className="text-sm font-bold truncate max-w-[150px]">
											{podium[2].username}
										</p>
										<p className="text-xs text-indigo-400 font-extrabold">
											{podium[2].total_points} pts
										</p>
									</div>
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
											<th className="py-4 px-4 text-center">Picks Made</th>
											<th className="py-4 px-4 text-center">
												3-Pointers (Exact)
											</th>
											<th className="py-4 px-5 text-right w-32">
												Total Points
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-white/5">
										{leaderboard &&
											leaderboard.map((row) => {
												const isCurrentUser = row.user_id === user?.id;

												return (
													<tr
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
														<td className="py-4 px-4 text-center text-sm text-slate-300">
															{row.predictions_count}
														</td>
														<td className="py-4 px-4 text-center">
															<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
																🎯 {row.exact_count}
															</span>
														</td>
														<td className="py-4 px-5 text-right">
															<span className="text-sm font-black text-white">
																{row.total_points} pts
															</span>
														</td>
													</tr>
												);
											})}

										{(!leaderboard || leaderboard.length === 0) && (
											<tr>
												<td
													colSpan={5}
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
				</Tabs>
			</div>
		</div>
	);
}
