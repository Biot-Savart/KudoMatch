'use client';

import { Button } from '@/components/ui/button';
import { calculatePredictionPoints } from '@/lib/utils/scoring';
import { Match, Prediction } from '@/types';
import { motion } from 'framer-motion';
import { HelpCircle, Sparkles, Trophy, Zap } from 'lucide-react';

interface GameweekPerformanceSummaryProps {
	matches: Match[];
	predictionsMap: Map<string, Prediction>;
	onOpenRulesModal: () => void;
	onOpenSimulator?: () => void;
	matchday?: number;
}

export function GameweekPerformanceSummary({
	matches,
	predictionsMap,
	onOpenRulesModal,
	onOpenSimulator,
	matchday = 12,
}: GameweekPerformanceSummaryProps) {
	const finishedMatches = matches.filter((m) => m.status === 'finished');
	const liveMatches = matches.filter((m) => m.status === 'live');

	// 1. Finished points
	const finishedPoints = finishedMatches.reduce((sum, m) => {
		const pred = predictionsMap.get(m.id);
		return sum + (pred?.points_earned || 0);
	}, 0);

	// 2. In-play live points
	const inPlayPoints = liveMatches.reduce((sum, m) => {
		const pred = predictionsMap.get(m.id);
		if (!pred) return sum;
		return (
			sum +
			calculatePredictionPoints(
				pred.predicted_home_score,
				pred.predicted_away_score,
				m.home_score,
				m.away_score,
			)
		);
	}, 0);

	const exactHitsCount = finishedMatches.filter((m) => {
		const pred = predictionsMap.get(m.id);
		return pred?.points_earned === 3;
	}).length;

	const outcomeDiffCount = finishedMatches.filter((m) => {
		const pred = predictionsMap.get(m.id);
		return pred?.points_earned === 2;
	}).length;

	const winnerOnlyCount = finishedMatches.filter((m) => {
		const pred = predictionsMap.get(m.id);
		return pred?.points_earned === 1;
	}).length;

	const missesCount = finishedMatches.filter((m) => {
		const pred = predictionsMap.get(m.id);
		return pred && pred.points_earned === 0;
	}).length;

	const totalPredictionsMade = matches.filter((m) =>
		predictionsMap.has(m.id),
	).length;

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="rounded-2xl glass-card border border-white/10 p-6 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/30 relative overflow-hidden shadow-xl space-y-5"
		>
			<div className="absolute -top-16 -right-16 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

			{/* Top Header Row */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
				<div className="flex items-center gap-3">
					<div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 shadow-sm">
						<Trophy className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
							<span>Matchweek {matchday} Performance</span>
							{liveMatches.length > 0 && (
								<span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black uppercase animate-pulse">
									{liveMatches.length} Live In-Play
								</span>
							)}
						</h3>
						<p className="text-xs text-slate-400">
							{totalPredictionsMade} / {matches.length} fixtures predicted
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onOpenRulesModal}
						className="border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold gap-1.5 rounded-xl h-9"
					>
						<HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
						<span>Scoring Rules</span>
					</Button>

					{onOpenSimulator && (
						<Button
							variant="outline"
							size="sm"
							onClick={onOpenSimulator}
							className="border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-xs font-bold gap-1.5 rounded-xl h-9"
						>
							<Sparkles className="h-3.5 w-3.5 text-purple-400" />
							<span>&quot;What-If&quot; Simulator</span>
						</Button>
					)}
				</div>
			</div>

			{/* Main Metrics Grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{/* 1. Final Points & In-Play */}
				<div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
					<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
						Total Round Points
					</span>
					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-black text-white">
							{finishedPoints + inPlayPoints}
						</span>
						<span className="text-xs text-slate-400 font-bold">PTS</span>
					</div>
					{liveMatches.length > 0 && inPlayPoints > 0 && (
						<p className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
							<Zap className="h-3 w-3 animate-bounce" />
							<span>+{inPlayPoints} pts currently in-play</span>
						</p>
					)}
				</div>

				{/* 2. Exact Hits */}
				<div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
					<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
						Exact 3-Pointers
					</span>
					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-black text-emerald-400">
							{exactHitsCount}
						</span>
						<span className="text-xs text-slate-400 font-bold">🎯</span>
					</div>
					<p className="text-[10px] text-slate-400">
						{exactHitsCount > 0
							? `${exactHitsCount * 3} pts earned from exacts`
							: 'Nailed scores award 3 pts'}
					</p>
				</div>

				{/* 3. Outcome & Margin */}
				<div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
					<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
						Outcome & Diff
					</span>
					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-black text-teal-400">
							{outcomeDiffCount}
						</span>
						<span className="text-xs text-slate-400 font-bold">↔️</span>
					</div>
					<p className="text-[10px] text-slate-400">
						{outcomeDiffCount * 2} pts from correct margins
					</p>
				</div>

				{/* 4. Winner Only & Misses */}
				<div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
					<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
						Winner / Miss
					</span>
					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-black text-blue-400">
							{winnerOnlyCount}
						</span>
						<span className="text-xs text-slate-400 font-bold">/</span>
						<span className="text-lg font-black text-slate-500">
							{missesCount}
						</span>
					</div>
					<p className="text-[10px] text-slate-400">
						{winnerOnlyCount} single pts • {missesCount} misses
					</p>
				</div>
			</div>
		</motion.div>
	);
}
