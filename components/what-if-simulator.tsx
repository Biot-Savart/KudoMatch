'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { simulatePoolStandings } from '@/lib/utils/scoring';
import { Match, PoolLeaderboardEntry, Prediction } from '@/types';
import { motion } from 'framer-motion';
import {
	ArrowDown,
	ArrowUp,
	Calculator,
	Minus,
	RotateCcw,
	Sparkles,
	Trophy,
	X,
} from 'lucide-react';
import { useState } from 'react';

interface WhatIfSimulatorProps {
	isOpen: boolean;
	onClose: () => void;
	matches: Match[];
	leaderboard: PoolLeaderboardEntry[];
	predictionsByMember: Record<string, Record<string, Prediction>>;
	currentUserId?: string | null;
	poolName?: string;
}

export function WhatIfScenarioSimulator({
	isOpen,
	onClose,
	matches,
	leaderboard,
	predictionsByMember,
	currentUserId,
	poolName,
}: WhatIfSimulatorProps) {
	// Simulated scores state: matchId -> { home_score, away_score }
	const [simulatedScores, setSimulatedScores] = useState<
		Record<string, { home_score: number; away_score: number }>
	>(() => {
		const initial: Record<string, { home_score: number; away_score: number }> =
			{};
		matches.forEach((m) => {
			initial[m.id] = {
				home_score: m.home_score ?? 1,
				away_score: m.away_score ?? 1,
			};
		});
		return initial;
	});

	if (!isOpen) return null;

	const handleScoreChange = (
		matchId: string,
		team: 'home' | 'away',
		delta: number,
	) => {
		setSimulatedScores((prev) => {
			const current = prev[matchId] || { home_score: 1, away_score: 1 };
			const newHome =
				team === 'home'
					? Math.max(0, current.home_score + delta)
					: current.home_score;
			const newAway =
				team === 'away'
					? Math.max(0, current.away_score + delta)
					: current.away_score;
			return {
				...prev,
				[matchId]: { home_score: newHome, away_score: newAway },
			};
		});
	};

	const handleReset = () => {
		const initial: Record<string, { home_score: number; away_score: number }> =
			{};
		matches.forEach((m) => {
			initial[m.id] = {
				home_score: m.home_score ?? 1,
				away_score: m.away_score ?? 1,
			};
		});
		setSimulatedScores(initial);
	};

	// Calculate simulated standings in real time
	const { simulatedLeaderboard } = simulatePoolStandings(
		leaderboard,
		predictionsByMember,
		matches,
		simulatedScores,
	);

	const currentUserSim = simulatedLeaderboard.find(
		(m) => m.user_id === currentUserId,
	);

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
				className="relative w-full max-w-4xl overflow-hidden rounded-2xl glass-card border border-white/10 p-6 shadow-2xl z-10 text-white max-h-[92vh] flex flex-col"
			>
				{/* Close Button */}
				<button
					onClick={onClose}
					className="absolute top-4 right-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
				>
					<X className="h-5 w-5" />
				</button>

				{/* Header */}
				<div className="flex items-center justify-between gap-4 mb-5 border-b border-white/5 pb-4 shrink-0">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
							<Calculator className="h-5 w-5" />
						</div>
						<div>
							<h3 className="text-lg font-extrabold tracking-tight">
								&quot;What-If&quot; Scenario Simulator
							</h3>
							<p className="text-xs text-slate-400">
								{poolName
									? `Simulate standings for ${poolName}`
									: 'Test hypothetical match results'}
							</p>
						</div>
					</div>

					<Button
						variant="outline"
						size="sm"
						onClick={handleReset}
						className="border-white/10 hover:bg-white/5 text-slate-300 font-bold text-xs gap-1.5"
					>
						<RotateCcw className="h-3.5 w-3.5" />
						<span>Reset Scores</span>
					</Button>
				</div>

				{/* CURRENT USER SIMULATION HIGHLIGHT BANNER */}
				{currentUserSim && (
					<div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-slate-900/40 border border-purple-500/30 mb-5 shrink-0 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300">
								<Sparkles className="h-5 w-5 animate-pulse" />
							</div>
							<div>
								<p className="text-xs text-purple-200 font-bold uppercase tracking-wider">
									Simulated Projection For You
								</p>
								<p className="text-sm text-white font-extrabold flex items-center gap-2">
									<span>
										Rank #{currentUserSim.rank}{' '}
										<span className="text-xs text-slate-400 font-normal">
											(was #{currentUserSim.originalRank})
										</span>
									</span>
									{currentUserSim.rankDelta > 0 ? (
										<span className="inline-flex items-center gap-0.5 text-xs text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
											<ArrowUp className="h-3 w-3" /> +
											{currentUserSim.rankDelta} spots
										</span>
									) : currentUserSim.rankDelta < 0 ? (
										<span className="inline-flex items-center gap-0.5 text-xs text-red-400 font-black bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
											<ArrowDown className="h-3 w-3" />{' '}
											{currentUserSim.rankDelta} spots
										</span>
									) : (
										<span className="inline-flex items-center gap-0.5 text-xs text-slate-400 font-black bg-white/5 px-2 py-0.5 rounded-full">
											<Minus className="h-3 w-3" /> No Change
										</span>
									)}
								</p>
							</div>
						</div>

						<div className="text-right">
							<span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
								Projected Points
							</span>
							<span className="text-xl font-black text-white">
								{currentUserSim.simulatedPoints} pts
							</span>
							{currentUserSim.pointsDelta !== 0 && (
								<span
									className={`text-xs font-bold block ${currentUserSim.pointsDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}
								>
									{currentUserSim.pointsDelta > 0 ? '+' : ''}
									{currentUserSim.pointsDelta} pts vs current
								</span>
							)}
						</div>
					</div>
				)}

				{/* TWO COLUMN GRID: MATCH SCORE ADJUSTERS ON LEFT, SIMULATED LEADERBOARD ON RIGHT */}
				<div className="grid md:grid-cols-2 gap-5 overflow-y-auto flex-grow pr-1">
					{/* LEFT: MATCH ADJUSTERS */}
					<div className="space-y-3">
						<h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 sticky top-0 bg-slate-950/80 backdrop-blur-sm py-1 z-10">
							<span>1. Tweak Match Scores</span>
						</h4>

						<div className="space-y-2.5">
							{matches.map((match) => {
								const sim = simulatedScores[match.id] || {
									home_score: 0,
									away_score: 0,
								};
								const homeShort =
									match.home_team?.short_name ||
									match.home_team?.name.substring(0, 3).toUpperCase() ||
									'HOM';
								const awayShort =
									match.away_team?.short_name ||
									match.away_team?.name.substring(0, 3).toUpperCase() ||
									'AWY';

								return (
									<div
										key={match.id}
										className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between hover:bg-white/[0.04] transition"
									>
										{/* Home Team */}
										<div className="flex items-center gap-2 w-28">
											{match.home_team?.logo_url && (
												<img
													src={match.home_team.logo_url}
													alt={match.home_team.name}
													className="h-5 w-5 object-contain shrink-0"
												/>
											)}
											<span className="text-xs font-black text-white truncate">
												{homeShort}
											</span>
										</div>

										{/* Stepper Controls */}
										<div className="flex items-center gap-2">
											{/* Home score buttons */}
											<div className="flex items-center gap-1">
												<button
													onClick={() =>
														handleScoreChange(match.id, 'home', -1)
													}
													className="h-6 w-6 rounded bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
												>
													-
												</button>
												<span className="w-5 text-center font-black text-sm text-white">
													{sim.home_score}
												</span>
												<button
													onClick={() => handleScoreChange(match.id, 'home', 1)}
													className="h-6 w-6 rounded bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
												>
													+
												</button>
											</div>

											<span className="text-slate-500 font-bold text-xs">
												:
											</span>

											{/* Away score buttons */}
											<div className="flex items-center gap-1">
												<button
													onClick={() =>
														handleScoreChange(match.id, 'away', -1)
													}
													className="h-6 w-6 rounded bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
												>
													-
												</button>
												<span className="w-5 text-center font-black text-sm text-white">
													{sim.away_score}
												</span>
												<button
													onClick={() => handleScoreChange(match.id, 'away', 1)}
													className="h-6 w-6 rounded bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
												>
													+
												</button>
											</div>
										</div>

										{/* Away Team */}
										<div className="flex items-center justify-end gap-2 w-28 text-right">
											<span className="text-xs font-black text-white truncate">
												{awayShort}
											</span>
											{match.away_team?.logo_url && (
												<img
													src={match.away_team.logo_url}
													alt={match.away_team.name}
													className="h-5 w-5 object-contain shrink-0"
												/>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{/* RIGHT: SIMULATED STANDINGS */}
					<div className="space-y-3">
						<h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 sticky top-0 bg-slate-950/80 backdrop-blur-sm py-1 z-10">
							<Trophy className="h-3.5 w-3.5 text-yellow-500" />
							<span>2. Simulated Standings</span>
						</h4>

						<div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5 bg-slate-950/40">
							{simulatedLeaderboard.map((item) => {
								const isUser = item.user_id === currentUserId;

								return (
									<div
										key={item.user_id}
										className={`p-2.5 flex items-center justify-between text-xs transition ${
											isUser ? 'bg-indigo-500/15 font-bold' : 'hover:bg-white/5'
										}`}
									>
										<div className="flex items-center gap-2.5">
											{/* Rank badge */}
											<span
												className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black ${
													item.rank === 1
														? 'bg-yellow-500 text-slate-950'
														: item.rank === 2
															? 'bg-slate-300 text-slate-950'
															: item.rank === 3
																? 'bg-amber-600 text-white'
																: 'bg-white/5 text-slate-400'
												}`}
											>
												{item.rank}
											</span>

											<Avatar className="h-6 w-6 border border-white/10">
												<AvatarImage src={item.avatar_url || ''} />
												<AvatarFallback className="bg-indigo-600 text-[10px] text-white font-bold">
													{item.username?.substring(0, 2).toUpperCase() || 'U'}
												</AvatarFallback>
											</Avatar>

											<span className="text-white truncate max-w-[110px]">
												@{item.username} {isUser && '(You)'}
											</span>
										</div>

										<div className="flex items-center gap-3">
											{/* Rank Shift pill */}
											{item.rankDelta > 0 ? (
												<span className="text-[10px] font-black text-emerald-400 flex items-center">
													<ArrowUp className="h-3 w-3" /> +{item.rankDelta}
												</span>
											) : item.rankDelta < 0 ? (
												<span className="text-[10px] font-black text-red-400 flex items-center">
													<ArrowDown className="h-3 w-3" /> {item.rankDelta}
												</span>
											) : (
												<span className="text-[10px] text-slate-600 font-bold">
													-
												</span>
											)}

											{/* Simulated Points */}
											<span className="font-black text-white w-14 text-right">
												{item.simulatedPoints} pts
											</span>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>

				<div className="mt-5 pt-3 border-t border-white/5 flex justify-end shrink-0">
					<Button
						onClick={onClose}
						className="w-full py-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
					>
						Done Simulating
					</Button>
				</div>
			</motion.div>
		</div>
	);
}
