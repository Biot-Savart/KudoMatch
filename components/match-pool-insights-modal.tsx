'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	fetchMarketCommunityStats,
	fetchMarketParticipantPicks
} from '@/lib/queries/markets';
import {
	MarketCommunityStats,
	ParticipantPick
} from '@/types';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
	BarChart3,
	Loader2,
	Users,
	X
} from 'lucide-react';
import { useState } from 'react';

export interface MatchPoolInsightsModalProps {
	isOpen: boolean;
	onClose: () => void;
	event?: any | null;
	match?: any | null;
	poolId?: string;
	poolName?: string;
}

export function MatchPoolInsightsModal({
	isOpen,
	onClose,
	event,
	match,
	poolId,
	poolName,
}: MatchPoolInsightsModalProps) {
	const [activeFilter, setActiveFilter] = useState<string>('all');

	const targetItem = event || match;
	const currentMarket = targetItem?.current_market ?? targetItem?.markets?.[0];
	const marketId = currentMarket?.id ?? targetItem?.id;

	const { data: stats, isLoading: statsLoading } =
		useQuery<MarketCommunityStats | null>({
			queryKey: ['match-insights', targetItem?.id, poolId],
			queryFn: () => (marketId ? fetchMarketCommunityStats(marketId) : null),
			enabled: isOpen && !!targetItem?.id,
		});

	const { data: participants, isLoading: picksLoading } = useQuery<
		ParticipantPick[]
	>({
		queryKey: ['match-participants', targetItem?.id, poolId],
		queryFn: () =>
			marketId ? fetchMarketParticipantPicks(marketId, poolId) : [],
		enabled: isOpen && !!targetItem?.id,
	});

	if (!isOpen || !targetItem) return null;

	const homeComp =
		targetItem.competitors?.find((c: any) => c.slot === 1 || c.role === 'home')
			?.competitor ??
		targetItem.competitors?.[0]?.competitor ??
		targetItem.home_team;
	const awayComp =
		targetItem.competitors?.find((c: any) => c.slot === 2 || c.role === 'away')
			?.competitor ??
		targetItem.competitors?.[1]?.competitor ??
		targetItem.away_team;

	const homeName = homeComp?.name || 'Home Team';
	const awayName = awayComp?.name || 'Away Team';

	const outDist = stats || {
		total_predictions: 0,
		avg_home_score: 0,
		avg_away_score: 0,
		home_win_pct: 0,
		draw_pct: 0,
		away_win_pct: 0,
		top_exact_scores: [],
	};

	const filteredParticipants = (participants || []).filter((p) => {
		if (activeFilter === 'all') return true;
		if (activeFilter === 'exact') return p.tier_code === 'exact_score';
		if (activeFilter === 'margin')
			return p.tier_code === 'exact_margin' || p.tier_code === 'close_margin';
		if (activeFilter === 'outcome') return p.tier_code === 'outcome';
		if (activeFilter === 'miss') return p.tier_code === 'miss';
		return true;
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
							{homeName} vs {awayName} •{' '}
							{targetItem.round_label ??
								(targetItem.matchday
									? `Matchweek ${targetItem.matchday}`
									: 'Regular Season')}
						</p>
					</div>
				</div>

				{statsLoading || picksLoading ? (
					<div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
						<Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
						<span className="text-xs">
							Aggregating community predictions...
						</span>
					</div>
				) : (
					<div className="space-y-5">
						{/* 1. OUTCOME DISTRIBUTION BAR */}
						<div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
							<div className="flex items-center justify-between text-xs font-bold text-slate-300">
								<span>Projected Match Outcome</span>
								<span className="text-[10px] text-slate-500 font-normal">
									{outDist.total_predictions} Total Predictions
								</span>
							</div>

							{/* Progress Strip */}
							<div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden flex border border-white/10">
								<div
									style={{ width: `${outDist.home_win_pct}%` }}
									className="bg-indigo-500 hover:bg-indigo-400 transition"
									title={`${homeName} Win: ${outDist.home_win_pct}%`}
								/>
								<div
									style={{ width: `${outDist.draw_pct}%` }}
									className="bg-amber-500 hover:bg-amber-400 transition"
									title={`Draw: ${outDist.draw_pct}%`}
								/>
								<div
									style={{ width: `${outDist.away_win_pct}%` }}
									className="bg-purple-500 hover:bg-purple-400 transition"
									title={`${awayName} Win: ${outDist.away_win_pct}%`}
								/>
							</div>

							{/* Legend */}
							<div className="grid grid-cols-3 gap-2 text-center text-[11px]">
								<div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
									<div className="font-bold text-indigo-300">
										{outDist.home_win_pct}%
									</div>
									<div className="text-[10px] text-slate-400 truncate">
										{homeName} Win
									</div>
								</div>
								<div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
									<div className="font-bold text-amber-300">
										{outDist.draw_pct}%
									</div>
									<div className="text-[10px] text-slate-400">Draw</div>
								</div>
								<div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
									<div className="font-bold text-purple-300">
										{outDist.away_win_pct}%
									</div>
									<div className="text-[10px] text-slate-400 truncate">
										{awayName} Win
									</div>
								</div>
							</div>
						</div>

						{/* 2. TOP PREDICTED SCORELINES */}
						{outDist.top_exact_scores &&
							outDist.top_exact_scores.length > 0 && (
								<div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2.5">
									<h4 className="text-xs font-bold text-slate-300">
										Most Popular Exact Scorelines
									</h4>
									<div className="grid grid-cols-3 gap-2">
										{outDist.top_exact_scores.slice(0, 3).map((item, idx) => (
											<div
												key={idx}
												className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-center gap-1"
											>
												<span className="text-sm font-black text-white">
													{item.home} - {item.away}
												</span>
												<span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
													{item.pct}% ({item.count})
												</span>
											</div>
										))}
									</div>
								</div>
							)}

						{/* 3. PARTICIPANTS PICKS MATRIX */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
									<Users className="h-3.5 w-3.5 text-indigo-400" />
									<span>Member Picks</span>
								</h4>
							</div>

							{/* Picks List */}
							<div className="glass-card rounded-xl border border-white/10 divide-y divide-white/5 max-h-[220px] overflow-y-auto">
								{filteredParticipants.length === 0 ? (
									<div className="p-4 text-center text-xs text-slate-400">
										No picks recorded yet.
									</div>
								) : (
									filteredParticipants.map((p, idx) => (
										<div
											key={idx}
											className="p-2.5 flex items-center justify-between hover:bg-white/[0.02] transition text-xs"
										>
											<div className="flex items-center gap-2">
												<Avatar className="h-6 w-6 border border-white/10">
													<AvatarImage src={p.avatar_url ?? undefined} />
													<AvatarFallback className="text-[9px] bg-slate-800 text-slate-300">
														{p.full_name?.charAt(0) ?? 'U'}
													</AvatarFallback>
												</Avatar>
												<span className="font-medium text-slate-200 truncate max-w-[130px]">
													{p.full_name || 'Member'}
												</span>
											</div>

											<div className="flex items-center gap-3">
												<span className="font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded-lg border border-white/10 font-mono">
													{p.home} - {p.away}
												</span>
												{p.points !== null && (
													<span className="font-black text-indigo-300 text-[11px]">
														+{p.points} PTS
													</span>
												)}
											</div>
										</div>
									))
								)}
							</div>
						</div>
					</div>
				)}

				{/* Footer */}
				<div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						className="border-white/10 hover:bg-white/5 text-slate-300 text-xs"
					>
						Close Insights
					</Button>
				</div>
			</motion.div>
		</div>
	);
}

export default MatchPoolInsightsModal;
