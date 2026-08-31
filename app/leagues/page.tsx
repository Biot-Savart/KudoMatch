'use client';

import { CreatePoolModal } from '@/components/create-pool-modal';
import { JoinPoolModal } from '@/components/join-pool-modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchUserPools, poolsQueryKeys } from '@/lib/queries/pools';
import { createClient } from '@/lib/supabase/client';
import { ScopedPool } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
	Crown,
	Loader2,
	Plus,
	Trophy,
	UserPlus
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LeaguesPage() {
	const supabase = createClient();
	const router = useRouter();
	const [user, setUser] = useState<any>(null);
	const [userLoading, setUserLoading] = useState(true);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isJoinOpen, setIsJoinOpen] = useState(false);

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

	// Fetch user pools using TanStack Query
	const {
		data: userPools = [],
		isLoading: poolsLoading,
		refetch,
	} = useQuery<ScopedPool[]>({
		queryKey: user?.id
			? poolsQueryKeys.user(user.id)
			: ['pools', 'user', 'anon'],
		queryFn: () => (user?.id ? fetchUserPools(user.id) : Promise.resolve([])),
		enabled: !!user?.id,
	});

	const handlePoolSuccess = (poolId: string) => {
		setIsCreateOpen(false);
		setIsJoinOpen(false);
		refetch();
		router.push(`/leagues/${poolId}`);
	};

	const isLoading = userLoading || poolsLoading;

	if (userLoading) {
		return (
			<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center pt-16">
				<Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
				<p className="text-slate-400 text-xs mt-4">Loading your leagues...</p>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen bg-slate-950 text-white pt-24 px-4 flex flex-col items-center justify-center">
				<div className="max-w-md w-full text-center p-8 rounded-2xl glass-card border border-white/10 shadow-2xl">
					<div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-2xl shadow-lg mb-6">
						K
					</div>
					<h2 className="text-2xl font-extrabold tracking-tight mb-2">
						Leagues & Pools
					</h2>
					<p className="text-slate-400 text-sm mb-6">
						Join or create private prediction leagues to challenge your friends,
						family, or office colleagues and claim absolute bragging rights.
					</p>
					<div className="flex flex-col gap-2">
						<Button
							className="bg-indigo-600 hover:bg-indigo-700 font-bold py-6 rounded-xl"
							asChild
						>
							<Link href="/login">Sign In to Join</Link>
						</Button>
						<Button
							variant="ghost"
							className="text-slate-400 hover:text-white"
							asChild
						>
							<Link href="/signup">Create Account</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-950 text-white pt-24 pb-12 px-4 md:px-8">
			<div className="max-w-5xl mx-auto space-y-8">
				{/* Header banner */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 md:p-8 rounded-2xl glass-card border border-white/10 bg-gradient-to-r from-slate-950 via-slate-900/40 to-indigo-950/20 shadow-xl">
					<div className="space-y-2">
						<h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
							My Leagues & Pools
						</h1>
						<p className="text-sm md:text-base text-slate-400 max-w-lg">
							Create a custom pool, invite your squad via code, and dominate the
							private leaderboards.
						</p>
					</div>

					{/* Action Buttons */}
					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							onClick={() => setIsJoinOpen(true)}
							className="border-white/10 hover:bg-white/5 text-slate-200 font-semibold gap-2 py-5 rounded-xl text-xs"
						>
							<UserPlus className="h-4 w-4 text-indigo-400" />
							<span>Join with Code</span>
						</Button>
						<Button
							onClick={() => setIsCreateOpen(true)}
							className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold gap-2 py-5 rounded-xl text-xs shadow-lg shadow-indigo-500/20"
						>
							<Plus className="h-4 w-4" />
							<span>Create New Pool</span>
						</Button>
					</div>
				</div>

				{/* Pools Content */}
				{isLoading ? (
					<div className="flex flex-col items-center justify-center py-20">
						<Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
						<p className="text-xs text-slate-400 mt-3">
							Loading your standings...
						</p>
					</div>
				) : userPools && userPools.length > 0 ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
						{userPools.map((pool) => {
							const isCreator = pool.created_by === user?.id;

							return (
								<motion.div
									key={pool.id}
									whileHover={{ y: -4 }}
									transition={{ duration: 0.2 }}
								>
									<Card className="relative overflow-hidden glass-card border border-white/10 p-5 flex flex-col justify-between h-48 group hover:border-indigo-500/30 shadow-md">
										<div className="space-y-2">
											<div className="flex items-start justify-between gap-2">
												<h3 className="text-lg font-extrabold text-white group-hover:text-indigo-300 transition truncate max-w-[190px]">
													{pool.name}
												</h3>
												<div className="flex items-center gap-1">
													{isCreator ? (
														<span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-extrabold">
															<Crown className="h-3 w-3 text-yellow-500" />
															Owner
														</span>
													) : (
														<span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[10px] font-extrabold">
															Member
														</span>
													)}
												</div>
											</div>

											<div className="flex items-center gap-2 text-[10px] text-slate-400">
												<span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
													{pool.scope_kind === 'all_sports'
														? '🌐 All Sports'
														: pool.sport_slug === 'rugby-union'
															? '🏉 Rugby'
															: '⚽ Football'}
												</span>
												<span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
													{pool.scoring_mode === 'normalized'
														? 'Normalized'
														: 'Raw Pts'}
												</span>
											</div>
										</div>

										<div className="border-t border-white/5 pt-3 mt-4 flex items-center justify-between">
											<div className="text-[11px] text-slate-400 font-mono tracking-wider">
												CODE:{' '}
												<b className="text-indigo-300">{pool.invite_code}</b>
											</div>

											<Button
												size="sm"
												className="bg-white/5 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold py-1.5 px-3 rounded-lg border border-white/10 transition"
												asChild
											>
												<Link href={`/leagues/${pool.id}`}>Enter Arena</Link>
											</Button>
										</div>
									</Card>
								</motion.div>
							);
						})}
					</div>
				) : (
					<div className="text-center py-20 rounded-3xl glass-card border border-white/10 p-8 space-y-4">
						<Trophy className="h-12 w-12 text-slate-600 mx-auto" />
						<h3 className="text-xl font-bold text-white">
							No pools joined yet
						</h3>
						<p className="text-xs text-slate-400 max-w-sm mx-auto">
							You are not participating in any prediction pools yet. Create your
							own or enter an invite code to get started.
						</p>
					</div>
				)}
			</div>

			{/* Create Pool Modal */}
			<CreatePoolModal
				userId={user.id}
				isOpen={isCreateOpen}
				onClose={() => setIsCreateOpen(false)}
				onSuccess={handlePoolSuccess}
			/>

			{/* Join Pool Modal */}
			<JoinPoolModal
				userId={user.id}
				isOpen={isJoinOpen}
				onClose={() => setIsJoinOpen(false)}
				onSuccess={handlePoolSuccess}
			/>
		</div>
	);
}
