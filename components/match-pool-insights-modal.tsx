'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { fetchMatchCommunityInsights } from '@/lib/queries/matches';
import { Match, MatchCommunityInsights } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Loader2,
    Lock,
    Sparkles,
    Trophy,
    Users,
    X
} from 'lucide-react';
import { useState } from 'react';

interface MatchPoolInsightsModalProps {
	isOpen: boolean;
	onClose: () => void;
	match: Match | null;
	poolId?: string;
	poolName?: string;
}

export function MatchPoolInsightsModal({
	isOpen,
	onClose,
	match,
	poolId,
	poolName,
}: MatchPoolInsightsModalProps) {
	const [activeFilter, setActiveFilter] = useState<
		'all' | '3' | '2' | '1' | '0'
	>('all');

	const { data: insights, isLoading } = useQuery<MatchCommunityInsights | null>(
		{
			queryKey: ['match-insights', match?.id, poolId],
			queryFn: () =>
				match ? fetchMatchCommunityInsights(match.id, poolId) : null,
			enabled: isOpen && !!match?.id,
		},
	);

	if (!isOpen || !match) return null;

	const homeName =
		match.home_team?.short_name || match.home_team?.name || 'Home Team';
	const awayName =
		match.away_team?.short_name || match.away_team?.name || 'Away Team';
	const homeFullName = match.home_team?.name || 'Home Team';
	const awayFullName = match.away_team?.name || 'Away Team';

	const isLive = match.status === 'live';
	const isFinished = match.status === 'finished';

	const outDist = insights?.outcome_distribution || {
		home_win_pct: 0,
		draw_pct: 0,
		away_win_pct: 0,
		home_win_count: 0,
		draw_count: 0,
		away_win_count: 0,
	};

	const pointsDist = insights?.points_distribution || {
		exact_3pts: 0,
		diff_2pts: 0,
		winner_1pt: 0,
		miss_0pts: 0,
	};

	const filteredParticipants = (insights?.participants || []).filter((p) => {
		if (activeFilter === 'all') return true;
		return p.points_earned === parseInt(activeFilter, 10);
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Backdrop */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
				className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
			/>

			{/* Modal Container */}
			<motion.div
				initial={{ opacity: 0, scale: 0.95, y: 15 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: 15 }}
				className="relative w-full max-w-xl overflow-hidden rounded-2xl glass-card border border-white/10 p-6 shadow-2xl z-10 text-white max-h-[90vh] overflow-y-auto"
			>
				{/* Close Button */}
				<button
					onClick={onClose}
					className="absolute top-4 right-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
				>
					<X className="h-5 w-5" />
				</button>

				{/* Header */}
				<div className="flex items-center gap-3 mb-5">
					<div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
						<BarChart3 className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-lg font-extrabold tracking-tight">
							{poolName
								? `${poolName} Insights`
								: 'Community Prediction Insights'}
						</h3>
						<p className="text-xs text-slate-400">
							{homeFullName} vs {awayFullName} • Matchweek{' '}
							{match.matchday || 12}
						</p>
					</div>
				</div>

				{/* MATCH VISUAL BANNER */}
				<div className="p-4 rounded-xl bg-black/40 border border-white/10 mb-5 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						{match.home_team?.logo_url && (
							<img
								src={match.home_team.logo_url}
								alt={homeFullName}
								className="h-7 w-7 object-contain"
							/>
						)}
						<span className="text-sm font-extrabold text-white">
							{homeName}
						</span>
					</div>

					<div className="flex flex-col items-center">
						<div className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 font-black text-sm text-white">
							{match.home_score !== null && match.away_score !== null
								? `${match.home_score} - ${match.away_score}`
								: 'VS'}
						</div>
						<span
							className={`text-[9px] font-extrabold uppercase mt-1 ${
								isLive
									? 'text-red-400 animate-pulse'
									: isFinished
										? 'text-emerald-400'
										: 'text-slate-500'
							}`}
						>
							{isLive ? 'Live In-Play' : isFinished ? 'Full Time' : 'Upcoming'}
						</span>
					</div>

					<div className="flex items-center gap-2.5">
						<span className="text-sm font-extrabold text-white">
							{awayName}
						</span>
						{match.away_team?.logo_url && (
							<img
								src={match.away_team.logo_url}
								alt={awayFullName}
								className="h-7 w-7 object-contain"
							/>
						)}
					</div>
				</div>

				{isLoading ? (
					<div className="py-16 flex flex-col items-center justify-center space-y-3">
						<Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
						<p className="text-xs text-slate-400">
							Aggregating community picks...
						</p>
					</div>
				) : (
					<div className="space-y-5">
						{/* 1. OUTCOME DISTRIBUTION BAR */}
						<div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
							<div className="flex justify-between items-center text-xs font-bold">
								<span className="text-slate-400 uppercase tracking-wider text-[10px]">
									Predicted Outcome Split ({insights?.total_predictions || 0}{' '}
									picks)
								</span>
							</div>

							{/* Progress Bar Multi-Segment */}
							<div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex">
								<div
									style={{ width: `${outDist.home_win_pct || 0}%` }}
									className="bg-indigo-600 transition-all duration-500 h-full"
									title={`${homeName} Win: ${outDist.home_win_pct}%`}
								/>
								<div
									style={{ width: `${outDist.draw_pct || 0}%` }}
									className="bg-slate-500 transition-all duration-500 h-full border-x border-slate-950"
									title={`Draw: ${outDist.draw_pct}%`}
								/>
								<div
									style={{ width: `${outDist.away_win_pct || 0}%` }}
									className="bg-purple-600 transition-all duration-500 h-full"
									title={`${awayName} Win: ${outDist.away_win_pct}%`}
								/>
							</div>

							{/* Legend */}
							<div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
								<div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
									<p className="text-[10px] text-indigo-300 font-bold uppercase truncate">
										{homeName} Win
									</p>
									<p className="text-base font-black text-white">
										{outDist.home_win_pct}%
									</p>
									<p className="text-[9px] text-slate-400">
										{outDist.home_win_count} picks
									</p>
								</div>
								<div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
									<p className="text-[10px] text-slate-300 font-bold uppercase">
										Draw
									</p>
									<p className="text-base font-black text-white">
										{outDist.draw_pct}%
									</p>
									<p className="text-[9px] text-slate-400">
										{outDist.draw_count} picks
									</p>
								</div>
								<div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
									<p className="text-[10px] text-purple-300 font-bold uppercase truncate">
										{awayName} Win
									</p>
									<p className="text-base font-black text-white">
										{outDist.away_win_pct}%
									</p>
									<p className="text-[9px] text-slate-400">
										{outDist.away_win_count} picks
									</p>
								</div>
							</div>
						</div>

						{/* 2. TOP PREDICTED SCORELINES */}
						{insights?.top_scores && insights.top_scores.length > 0 && (
							<div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2.5">
								<h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
									<Sparkles className="h-3 w-3 text-yellow-400" />
									<span>Most Popular Predicted Scorelines</span>
								</h4>
								<div className="flex flex-wrap gap-2">
									{insights.top_scores.map((s, idx) => (
										<div
											key={s.scoreline}
											className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs"
										>
											<span className="text-slate-400 font-bold">
												#{idx + 1}
											</span>
											<span className="text-white font-black">
												{s.scoreline}
											</span>
											<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300">
												{s.percentage}% ({s.count})
											</span>
										</div>
									))}
								</div>
							</div>
						)}

						{/* 3. POINTS BREAKDOWN (IF MATCH IS RESOLVED) */}
						{isFinished && (
							<div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2.5">
								<h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
									<Trophy className="h-3 w-3 text-emerald-400" />
									<span>Scoring Breakdown Across Players</span>
								</h4>
								<div className="grid grid-cols-4 gap-2 text-center text-xs">
									<div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
										<span className="text-[9px] font-bold block uppercase">
											Exact (3pts)
										</span>
										<span className="text-base font-black">
											{pointsDist.exact_3pts}
										</span>
									</div>
									<div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
										<span className="text-[9px] font-bold block uppercase">
											Diff (2pts)
										</span>
										<span className="text-base font-black">
											{pointsDist.diff_2pts}
										</span>
									</div>
									<div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
										<span className="text-[9px] font-bold block uppercase">
											Winner (1pt)
										</span>
										<span className="text-base font-black">
											{pointsDist.winner_1pt}
										</span>
									</div>
									<div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-400">
										<span className="text-[9px] font-bold block uppercase">
											Miss (0pts)
										</span>
										<span className="text-base font-black">
											{pointsDist.miss_0pts}
										</span>
									</div>
								</div>
							</div>
						)}

						{/* 4. INDIVIDUAL PICKS TABLE */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
									<Users className="h-3.5 w-3.5 text-indigo-400" />
									<span>Individual Picks</span>
								</h4>

								{/* Filter pills */}
								{isFinished && (
									<div className="flex gap-1">
										<button
											onClick={() => setActiveFilter('all')}
											className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${activeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
										>
											All
										</button>
										<button
											onClick={() => setActiveFilter('3')}
											className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${activeFilter === '3' ? 'bg-emerald-600 text-white' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
										>
											3 pts
										</button>
										<button
											onClick={() => setActiveFilter('2')}
											className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${activeFilter === '2' ? 'bg-teal-600 text-white' : 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20'}`}
										>
											2 pts
										</button>
										<button
											onClick={() => setActiveFilter('1')}
											className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${activeFilter === '1' ? 'bg-blue-600 text-white' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
										>
											1 pt
										</button>
									</div>
								)}
							</div>

							{insights?.is_locked ? (
								filteredParticipants.length > 0 ? (
									<div className="rounded-xl border border-white/5 bg-slate-950/40 overflow-hidden divide-y divide-white/5 max-h-48 overflow-y-auto">
										{filteredParticipants.map((p) => (
											<div
												key={p.user_id}
												className="p-2.5 flex items-center justify-between text-xs hover:bg-white/5 transition"
											>
												<div className="flex items-center gap-2.5">
													<Avatar className="h-6 w-6 border border-white/10">
														<AvatarImage src={p.avatar_url || ''} />
														<AvatarFallback className="bg-indigo-600 text-[10px] text-white font-bold">
															{p.username?.substring(0, 2).toUpperCase() || 'U'}
														</AvatarFallback>
													</Avatar>
													<span className="font-bold text-white">
														@{p.username}
													</span>
												</div>

												<div className="flex items-center gap-3">
													<span className="font-extrabold text-slate-200 bg-white/5 px-2 py-0.5 rounded-md">
														{p.predicted_home_score} - {p.predicted_away_score}
													</span>
													{isFinished && (
														<span
															className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
																p.points_earned === 3
																	? 'bg-emerald-500/15 text-emerald-400'
																	: p.points_earned === 2
																		? 'bg-teal-500/15 text-teal-400'
																		: p.points_earned === 1
																			? 'bg-blue-500/15 text-blue-400'
																			: 'bg-slate-500/15 text-slate-400'
															}`}
														>
															+{p.points_earned} PTS
														</span>
													)}
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="p-4 text-center text-xs text-slate-500 bg-white/[0.01] rounded-xl border border-white/5">
										No picks found matching this criteria.
									</div>
								)
							) : (
								<div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-slate-400 space-y-1">
									<Lock className="h-4 w-4 text-indigo-400 mx-auto mb-1" />
									<p className="font-bold text-slate-300">
										Individual Picks Hidden
									</p>
									<p className="text-[11px] text-slate-500">
										Individual player predictions will be revealed right at
										kickoff.
									</p>
								</div>
							)}
						</div>
					</div>
				)}

				<div className="mt-6 flex justify-end">
					<Button
						onClick={onClose}
						className="w-full py-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
					>
						Close
					</Button>
				</div>
			</motion.div>
		</div>
	);
}
