'use client';

import { Button } from '@/components/ui/button';
import { calculatePredictionPoints } from '@/lib/utils/scoring';
import { SportEvent } from '@/types';
import { motion } from 'framer-motion';
import { HelpCircle, Sparkles, Trophy, Zap } from 'lucide-react';

export interface GameweekPerformanceSummaryProps {
	events?: SportEvent[];
	matches?: any[];
	predictionsMap?: Map<string, any>;
	onOpenRulesModal: () => void;
	onOpenSimulator?: () => void;
	roundLabel?: string;
	matchday?: number;
}

export function GameweekPerformanceSummary({
	events = [],
	matches = [],
	predictionsMap = new Map(),
	onOpenRulesModal,
	onOpenSimulator,
	roundLabel,
	matchday,
}: GameweekPerformanceSummaryProps) {
	// Normalize items from events or matches
	const items: any[] = events.length > 0 ? events : matches;
	const displayRound =
		roundLabel ||
		(matchday !== undefined ? `Matchweek ${matchday}` : 'Round 12');

	const finishedItems = items.filter(
		(e) => e.status === 'completed' || e.status === 'finished',
	);
	const liveItems = items.filter((e) => e.status === 'live');

	// 1. Finished points
	const finishedPoints = finishedItems.reduce((sum, e) => {
		const mId = e.current_market?.id ?? e.id;
		const pred = predictionsMap.get(mId) ?? predictionsMap.get(e.id);
		return sum + (pred?.raw_points ?? pred?.points_earned ?? 0);
	}, 0);

	// 2. In-play live points
	const inPlayPoints = liveItems.reduce((sum, e) => {
		const mId = e.current_market?.id ?? e.id;
		const pred = predictionsMap.get(mId) ?? predictionsMap.get(e.id);
		const marketRes = e.current_market?.result?.result as
			| { home: number; away: number }
			| undefined;
		const actualHome = marketRes?.home ?? e.home_score;
		const actualAway = marketRes?.away ?? e.away_score;

		const sel = pred?.selection as { home: number; away: number } | undefined;
		const predHome = sel?.home ?? pred?.predicted_home_score;
		const predAway = sel?.away ?? pred?.predicted_away_score;

		if (
			predHome === undefined ||
			predAway === undefined ||
			actualHome === undefined ||
			actualAway === undefined
		) {
			return sum;
		}
		return (
			sum +
			calculatePredictionPoints(
				predHome,
				predAway,
				actualHome,
				actualAway,
				(e.edition?.competition?.sport_slug as any) || 'football',
			)
		);
	}, 0);

	const exactHitsCount = finishedItems.filter((e) => {
		const mId = e.current_market?.id ?? e.id;
		const pred = predictionsMap.get(mId) ?? predictionsMap.get(e.id);
		return pred?.tier_code === 'exact_score' || pred?.points_earned === 3;
	}).length;

	const outcomeDiffCount = finishedItems.filter((e) => {
		const mId = e.current_market?.id ?? e.id;
		const pred = predictionsMap.get(mId) ?? predictionsMap.get(e.id);
		return (
			pred?.tier_code === 'exact_margin' ||
			pred?.tier_code === 'close_margin' ||
			pred?.points_earned === 2
		);
	}).length;

	const winnerOnlyCount = finishedItems.filter((e) => {
		const mId = e.current_market?.id ?? e.id;
		const pred = predictionsMap.get(mId) ?? predictionsMap.get(e.id);
		return pred?.tier_code === 'outcome' || pred?.points_earned === 1;
	}).length;

	const missesCount = finishedItems.filter((e) => {
		const mId = e.current_market?.id ?? e.id;
		const pred = predictionsMap.get(mId) ?? predictionsMap.get(e.id);
		return pred && (pred.tier_code === 'miss' || pred.points_earned === 0);
	}).length;

	const totalPredictionsMade = items.filter((e) => {
		const mId = e.current_market?.id ?? e.id;
		return predictionsMap.has(mId) || predictionsMap.has(e.id);
	}).length;

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="rounded-3xl glass-card border border-white/10 p-6 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/40 relative overflow-hidden shadow-2xl space-y-5"
		>
			<div className="absolute -top-16 -right-16 w-44 h-44 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

			{/* Top Header Row */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
				<div className="flex items-center gap-3">
					<div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
						<Trophy className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
							<span>{displayRound} Performance</span>
							{liveItems.length > 0 && (
								<span className="px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black uppercase animate-pulse shadow-glow-live">
									{liveItems.length} Live In-Play
								</span>
							)}
						</h3>
						<p className="text-xs text-slate-400">
							{totalPredictionsMade} / {items.length} fixtures predicted
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
							<span>&ldquo;What-If&rdquo; Simulator</span>
						</Button>
					)}
				</div>
			</div>

			{/* Main Metrics 3-Col Bar */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				{/* 1. Total Points Accumulated */}
				<div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden flex flex-col justify-between">
					<span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
						Total Points
					</span>
					<div className="flex items-baseline gap-2 mt-1">
						<span className="text-2xl sm:text-3xl font-black text-white">
							{finishedPoints}
						</span>
						<span className="text-xs font-bold text-slate-400">PTS</span>
						{inPlayPoints > 0 && (
							<span className="text-xs font-black text-amber-400 animate-pulse ml-auto bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
								+{inPlayPoints} Live
							</span>
						)}
					</div>
				</div>

				{/* 2. Exact Score Hits */}
				<div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
					<div className="flex items-center justify-between">
						<span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
							Exact 3-Pointers
						</span>
						<Zap className="h-3.5 w-3.5 text-emerald-400" />
					</div>
					<div className="flex items-baseline gap-1 mt-1">
						<span className="text-2xl font-black text-emerald-300">
							{exactHitsCount}
						</span>
						<span className="text-[10px] text-emerald-400/70 font-semibold">
							hits
						</span>
					</div>
				</div>

				{/* 3. Margin & Winner Matches */}
				<div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex flex-col justify-between">
					<div className="flex items-center justify-between">
						<span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
							Outcome/Diff
						</span>
						<span className="text-[10px] font-bold text-teal-400 bg-teal-500/20 px-1.5 py-0.5 rounded">
							1-2 pts
						</span>
					</div>
					<div className="flex items-baseline gap-1 mt-1">
						<span className="text-2xl font-black text-teal-300">
							{outcomeDiffCount + winnerOnlyCount}
						</span>
						<span className="text-[10px] text-teal-400/70 font-semibold">
							matches
						</span>
					</div>
				</div>

				{/* 4. Misses */}
				<div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex flex-col justify-between">
					<span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
						Misses (0pts)
					</span>
					<div className="flex items-baseline gap-1 mt-1">
						<span className="text-2xl font-black text-slate-400">
							{missesCount}
						</span>
						<span className="text-[10px] text-slate-500 font-semibold">
							misses
						</span>
					</div>
				</div>
			</div>
		</motion.div>
	);
}

export default GameweekPerformanceSummary;
