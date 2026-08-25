'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { simulatePoolStandings } from '@/lib/utils/scoring';
import { PoolLeaderboardEntry, SportEvent } from '@/types';
import { motion } from 'framer-motion';
import {
	ArrowDown,
	ArrowUp,
	Calculator,
	Minus,
	RotateCcw,
	Sparkles,
	X,
} from 'lucide-react';
import { useState } from 'react';

export interface WhatIfSimulatorProps {
	isOpen: boolean;
	onClose: () => void;
	events?: SportEvent[];
	matches?: any[];
	leaderboard?: PoolLeaderboardEntry[];
	predictionsByMember?: Record<string, Record<string, any>>;
	currentUserId?: string | null;
	poolName?: string;
}

export function WhatIfScenarioSimulator({
	isOpen,
	onClose,
	events = [],
	matches = [],
	leaderboard = [],
	predictionsByMember = {},
	currentUserId,
	poolName,
}: WhatIfSimulatorProps) {
	const items = events.length > 0 ? events : matches;

	// Simulated scores state: eventId -> { home_score, away_score }
	const [simulatedScores, setSimulatedScores] = useState<
		Record<string, { home_score: number; away_score: number }>
	>(() => {
		const initial: Record<string, { home_score: number; away_score: number }> =
			{};
		items.forEach((ev) => {
			const res = ev.current_market?.result?.result as
				| { home: number; away: number }
				| undefined;
			initial[ev.id] = {
				home_score: res?.home ?? ev.home_score ?? 1,
				away_score: res?.away ?? ev.away_score ?? 1,
			};
		});
		return initial;
	});

	if (!isOpen) return null;

	const handleScoreChange = (
		eventId: string,
		team: 'home' | 'away',
		delta: number,
	) => {
		setSimulatedScores((prev) => {
			const current = prev[eventId] || { home_score: 1, away_score: 1 };
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
				[eventId]: { home_score: newHome, away_score: newAway },
			};
		});
	};

	const handleReset = () => {
		const initial: Record<string, { home_score: number; away_score: number }> =
			{};
		items.forEach((ev) => {
			const res = ev.current_market?.result?.result as
				| { home: number; away: number }
				| undefined;
			initial[ev.id] = {
				home_score: res?.home ?? ev.home_score ?? 1,
				away_score: res?.away ?? ev.away_score ?? 1,
			};
		});
		setSimulatedScores(initial);
	};

	// Calculate simulated standings in real time
	const { simulatedLeaderboard } = simulatePoolStandings(
		leaderboard,
		predictionsByMember,
		items,
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
				<div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4 shrink-0">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
							<Calculator className="h-5 w-5" />
						</div>
						<div>
							<h3 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
								<span>{`"What-If"`} Scenario Simulator</span>
								<span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
									Live Sandbox
								</span>
							</h3>
							<p className="text-xs text-slate-400">
								{poolName
									? `Simulate standings for ${poolName}`
									: 'Tweak upcoming/live match scorelines to see how pool ranks would shake out'}
							</p>
						</div>
					</div>

					<Button
						variant="outline"
						size="sm"
						onClick={handleReset}
						className="border-white/10 hover:bg-white/5 text-slate-300 gap-1.5 text-xs mr-8"
					>
						<RotateCcw className="h-3.5 w-3.5" />
						<span>Reset</span>
					</Button>
				</div>

				{/* Two-Column Layout: Controls on Left, Standings on Right */}
				<div className="grid md:grid-cols-12 gap-6 overflow-y-auto flex-1 pr-1">
					{/* LEFT: Match Scoreline Steppers (7 Cols) */}
					<div className="md:col-span-7 space-y-3">
						<div className="flex items-center justify-between px-1">
							<span className="text-xs font-bold uppercase tracking-wider text-slate-400">
								Hypothetical Match Outcomes
							</span>
							<span className="text-[11px] text-slate-500">
								{items.length} match{items.length !== 1 ? 'es' : ''} available
							</span>
						</div>

						{items.length === 0 ? (
							<div className="p-8 text-center glass-card rounded-xl border border-white/5 text-slate-400 text-xs">
								No matches available for simulation in this round.
							</div>
						) : (
							items.map((ev) => {
								const homeComp =
									ev.competitors?.find(
										(c: any) => c.slot === 1 || c.role === 'home',
									)?.competitor ??
									ev.competitors?.[0]?.competitor ??
									ev.home_team;
								const awayComp =
									ev.competitors?.find(
										(c: any) => c.slot === 2 || c.role === 'away',
									)?.competitor ??
									ev.competitors?.[1]?.competitor ??
									ev.away_team;

								const sim = simulatedScores[ev.id] || {
									home_score: 1,
									away_score: 1,
								};

								return (
									<div
										key={ev.id}
										className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition flex items-center justify-between gap-3"
									>
										{/* Home Team */}
										<div className="flex items-center gap-2 flex-1 min-w-0">
											<div className="h-7 w-7 rounded-lg bg-white/5 p-1 flex items-center justify-center shrink-0">
												{homeComp?.media_url || homeComp?.logo_url ? (
													<img
														src={homeComp.media_url || homeComp.logo_url}
														alt={homeComp.name}
														className="max-h-full max-w-full object-contain"
													/>
												) : (
													<span className="text-[10px] font-bold">
														{homeComp?.short_name || 'H'}
													</span>
												)}
											</div>
											<span className="text-xs font-bold text-slate-200 truncate">
												{homeComp?.name || 'Home Team'}
											</span>
										</div>

										{/* Stepper Controls */}
										<div className="flex items-center gap-1.5 shrink-0 bg-slate-900/80 px-2 py-1 rounded-xl border border-white/10">
											{/* Home Controls */}
											<div className="flex items-center gap-1">
												<button
													onClick={() => handleScoreChange(ev.id, 'home', -1)}
													className="h-6 w-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 text-xs transition"
												>
													-
												</button>
												<span className="text-sm font-black w-5 text-center text-white">
													{sim.home_score}
												</span>
												<button
													onClick={() => handleScoreChange(ev.id, 'home', 1)}
													className="h-6 w-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 text-xs transition"
												>
													+
												</button>
											</div>

											<span className="text-slate-500 font-bold px-0.5">-</span>

											{/* Away Controls */}
											<div className="flex items-center gap-1">
												<button
													onClick={() => handleScoreChange(ev.id, 'away', -1)}
													className="h-6 w-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 text-xs transition"
												>
													-
												</button>
												<span className="text-sm font-black w-5 text-center text-white">
													{sim.away_score}
												</span>
												<button
													onClick={() => handleScoreChange(ev.id, 'away', 1)}
													className="h-6 w-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 text-xs transition"
												>
													+
												</button>
											</div>
										</div>

										{/* Away Team */}
										<div className="flex items-center justify-end gap-2 flex-1 min-w-0">
											<span className="text-xs font-bold text-slate-200 truncate text-right">
												{awayComp?.name || 'Away Team'}
											</span>
											<div className="h-7 w-7 rounded-lg bg-white/5 p-1 flex items-center justify-center shrink-0">
												{awayComp?.media_url || awayComp?.logo_url ? (
													<img
														src={awayComp.media_url || awayComp.logo_url}
														alt={awayComp.name}
														className="max-h-full max-w-full object-contain"
													/>
												) : (
													<span className="text-[10px] font-bold">
														{awayComp?.short_name || 'A'}
													</span>
												)}
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>

					{/* RIGHT: Live Simulated Standings (5 Cols) */}
					<div className="md:col-span-5 space-y-3">
						<div className="flex items-center justify-between px-1">
							<span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
								<Sparkles className="h-3.5 w-3.5" />
								<span>Projected Standings</span>
							</span>
							<span className="text-[11px] font-bold text-slate-400">
								Projected Points
							</span>
						</div>

						<div className="glass-card rounded-2xl border border-white/10 p-3 space-y-2 max-h-[480px] overflow-y-auto">
							{simulatedLeaderboard.map((member) => {
								const isCurrent = member.user_id === currentUserId;
								const rankDelta = member.rank_delta;

								return (
									<div
										key={member.user_id}
										className={`p-2.5 rounded-xl transition flex items-center justify-between ${
											isCurrent
												? 'bg-purple-600/20 border border-purple-500/40 shadow-inner'
												: 'bg-white/[0.02] border border-white/5 hover:bg-white/5'
										}`}
									>
										{/* Left: Rank & User */}
										<div className="flex items-center gap-2.5 min-w-0">
											<div className="flex items-center justify-center w-6 font-black text-xs text-slate-400">
												#{member.simulated_rank}
											</div>

											<Avatar className="h-7 w-7 border border-white/10 shrink-0">
												<AvatarImage src={member.avatar_url ?? undefined} />
												<AvatarFallback className="text-[10px] bg-slate-800 text-slate-200">
													{member.full_name?.charAt(0) ?? 'U'}
												</AvatarFallback>
											</Avatar>

											<div className="min-w-0">
												<span
													className={`text-xs font-bold truncate block ${
														isCurrent ? 'text-purple-300' : 'text-slate-200'
													}`}
												>
													{member.full_name || 'Member'}{' '}
													{isCurrent && (
														<span className="text-[10px] opacity-80">
															(You)
														</span>
													)}
												</span>
												<span className="text-[10px] text-slate-400">
													{member.simulated_exact_count} exact
												</span>
											</div>
										</div>

										{/* Right: Projected Points & Delta */}
										<div className="flex items-center gap-2.5 shrink-0">
											<div className="text-right">
												<div className="text-xs font-black text-white">
													{member.simulated_points} PTS
												</div>
												<div className="text-[10px] text-slate-400">
													{member.simulated_points - member.total_points >= 0
														? `+${member.simulated_points - member.total_points}`
														: `${member.simulated_points - member.total_points}`}{' '}
													sim
												</div>
											</div>

											{/* Rank Shift Indicator */}
											<div className="w-5 flex justify-center">
												{rankDelta > 0 ? (
													<span
														className="text-emerald-400 flex items-center text-[10px] font-black"
														title={`Up ${rankDelta} spot${rankDelta > 1 ? 's' : ''}`}
													>
														<ArrowUp className="h-3 w-3" />
														{rankDelta}
													</span>
												) : rankDelta < 0 ? (
													<span
														className="text-rose-400 flex items-center text-[10px] font-black"
														title={`Down ${Math.abs(rankDelta)} spot${Math.abs(rankDelta) > 1 ? 's' : ''}`}
													>
														<ArrowDown className="h-3 w-3" />
														{Math.abs(rankDelta)}
													</span>
												) : (
													<Minus className="h-3 w-3 text-slate-600" />
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="pt-4 border-t border-white/10 flex justify-between items-center mt-4 shrink-0">
					<span className="text-[11px] text-slate-500">
						💡 Simulations do not alter official leaderboard scores.
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						className="border-white/10 hover:bg-white/5 text-slate-300 text-xs"
					>
						Done Simulating
					</Button>
				</div>
			</motion.div>
		</div>
	);
}

export default WhatIfScenarioSimulator;
