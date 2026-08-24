'use client';

import { Button } from '@/components/ui/button';
import { triggerConfetti } from '@/lib/utils/confetti';
import { getScoringExplanation, SCORING_RULES } from '@/lib/utils/scoring';
import { Match, Prediction } from '@/types';
import { motion } from 'framer-motion';
import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	HelpCircle,
	Hourglass,
	Sparkles,
	Trophy,
	X,
	XCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface ScoreBreakdownModalProps {
	isOpen: boolean;
	onClose: () => void;
	match: Match | null;
	prediction?: Prediction | null;
	username?: string;
}

export function ScoreBreakdownModal({
	isOpen,
	onClose,
	match,
	prediction,
	username,
}: ScoreBreakdownModalProps) {
	const [showRulesAccordion, setShowRulesAccordion] = useState(false);

	const explanation = match
		? getScoringExplanation(
				prediction?.predicted_home_score,
				prediction?.predicted_away_score,
				match.home_score,
				match.away_score,
				match.status,
			)
		: null;

	useEffect(() => {
		if (isOpen && explanation?.tier === 'exact') {
			triggerConfetti({
				particleCount: 50,
				spread: 60,
				origin: { y: 0.6 },
				colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24'],
			});
		}
	}, [isOpen, explanation?.tier]);

	if (!isOpen || !match) return null;

	const isLive = match.status === 'live';
	const isFinished = match.status === 'finished';
	const isKickoffPassed = new Date(match.kickoff_time) <= new Date();
	const hasScores =
		match.home_score !== null &&
		match.home_score !== undefined &&
		match.away_score !== null &&
		match.away_score !== undefined;

	const homeName = match.home_team?.name || 'Home Team';
	const awayName = match.away_team?.name || 'Away Team';
	const homeLogo = match.home_team?.logo_url;
	const awayLogo = match.away_team?.logo_url;

	const kickoffDate = new Date(match.kickoff_time);
	const formattedKickoff = kickoffDate.toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	const getOutcomeText = (outcome: 'home' | 'draw' | 'away' | null) => {
		if (outcome === 'home') return `${homeName} Win`;
		if (outcome === 'away') return `${awayName} Win`;
		if (outcome === 'draw') return 'Draw';
		return 'Pending';
	};

	const statusBadgeText = isFinished
		? 'Full Time'
		: isLive
			? 'Live In-Play'
			: isKickoffPassed && !hasScores
				? 'Awaiting Result'
				: 'Upcoming';

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
				className="relative w-full max-w-lg overflow-hidden rounded-2xl glass-card border border-white/10 p-6 shadow-2xl z-10 text-white max-h-[90vh] overflow-y-auto"
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
						<Trophy className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-lg font-extrabold tracking-tight">
							Scoring Breakdown
						</h3>
						<p className="text-xs text-slate-400">
							Matchweek {match.matchday || 12} • {homeName} vs {awayName}
						</p>
					</div>
				</div>

				{/* MATCH VISUAL SCOREBOARD */}
				<div className="p-4 rounded-xl bg-black/40 border border-white/10 mb-5 relative overflow-hidden">
					<div className="flex items-center justify-between text-center relative z-10">
						{/* Home */}
						<div className="flex flex-col items-center gap-1.5 w-28">
							{homeLogo ? (
								<img
									src={homeLogo}
									alt={homeName}
									className="h-10 w-10 object-contain"
								/>
							) : (
								<span className="text-2xl">🔵</span>
							)}
							<span className="text-xs font-black text-white truncate max-w-full">
								{homeName}
							</span>
						</div>

						{/* Score Display */}
						<div className="flex flex-col items-center">
							<div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
								<span className="text-2xl font-black text-white">
									{match.home_score ?? '-'}
								</span>
								<span className="text-sm font-bold text-slate-500">:</span>
								<span className="text-2xl font-black text-white">
									{match.away_score ?? '-'}
								</span>
							</div>
							<span
								className={`text-[10px] font-black uppercase tracking-wider mt-1.5 px-2.5 py-0.5 rounded-full ${
									isFinished
										? 'bg-slate-500/20 text-slate-300'
										: isLive
											? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
											: isKickoffPassed && !hasScores
												? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
												: 'bg-indigo-500/20 text-indigo-300'
								}`}
							>
								{statusBadgeText}
							</span>
						</div>

						{/* Away */}
						<div className="flex flex-col items-center gap-1.5 w-28">
							{awayLogo ? (
								<img
									src={awayLogo}
									alt={awayName}
									className="h-10 w-10 object-contain"
								/>
							) : (
								<span className="text-2xl">🔴</span>
							)}
							<span className="text-xs font-black text-white truncate max-w-full">
								{awayName}
							</span>
						</div>
					</div>
				</div>

				{/* PREDICTION VS ACTUAL COMPARISON */}
				{prediction ? (
					<div className="space-y-4">
						{/* State A: Final or Live Scores Available */}
						{hasScores ? (
							<>
								{/* Point Result Banner */}
								<div
									className={`p-4 rounded-xl border ${explanation?.badgeBg} ${explanation?.badgeBorder} flex items-center justify-between`}
								>
									<div className="flex items-center gap-3">
										<span className="text-2xl">{explanation?.icon}</span>
										<div>
											<p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
												{isLive ? 'Estimated Current Points' : 'Awarded Points'}
											</p>
											<p
												className={`text-base font-extrabold ${explanation?.colorClass}`}
											>
												{explanation?.tierLabel}
											</p>
										</div>
									</div>
									<div
										className={`px-3 py-1.5 rounded-xl border font-black text-lg ${explanation?.colorClass} ${explanation?.badgeBorder} bg-black/40 shadow`}
									>
										+{explanation?.points} PTS
									</div>
								</div>

								{/* Step-by-Step Validation Checks */}
								<div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
									<h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
										<Sparkles className="h-3.5 w-3.5 text-indigo-400" />
										<span>Rule Verification Pipeline</span>
									</h4>

									{/* Step 1: Outcome */}
									<div className="flex items-start justify-between text-xs py-1 border-b border-white/5">
										<div className="space-y-0.5">
											<p className="font-bold text-white flex items-center gap-1.5">
												{explanation?.outcomeMatched ? (
													<CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
												) : (
													<XCircle className="h-4 w-4 text-red-400 shrink-0" />
												)}
												1. Match Outcome (Winner/Draw)
											</p>
											<p className="text-slate-400 pl-5.5">
												Predicted:{' '}
												<b className="text-slate-200">
													{getOutcomeText(
														explanation?.predictedOutcome || null,
													)}
												</b>{' '}
												• Actual:{' '}
												<b className="text-slate-200">
													{getOutcomeText(explanation?.actualOutcome || null)}
												</b>
											</p>
										</div>
										<span
											className={`font-bold ${explanation?.outcomeMatched ? 'text-emerald-400' : 'text-slate-500'}`}
										>
											{explanation?.outcomeMatched ? 'PASS (+1)' : 'FAIL'}
										</span>
									</div>

									{/* Step 2: Goal Difference */}
									<div className="flex items-start justify-between text-xs py-1 border-b border-white/5">
										<div className="space-y-0.5">
											<p className="font-bold text-white flex items-center gap-1.5">
												{explanation?.goalDiffMatched ? (
													<CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
												) : (
													<XCircle className="h-4 w-4 text-slate-600 shrink-0" />
												)}
												2. Goal Difference Margin
											</p>
											<p className="text-slate-400 pl-5.5">
												Predicted Diff:{' '}
												<b className="text-slate-200">
													{explanation?.predDiff !== null &&
													explanation?.predDiff !== undefined &&
													explanation.predDiff > 0
														? `+${explanation.predDiff}`
														: explanation?.predDiff}
												</b>{' '}
												• Actual Diff:{' '}
												<b className="text-slate-200">
													{explanation?.actualDiff !== null &&
													explanation?.actualDiff !== undefined &&
													explanation.actualDiff > 0
														? `+${explanation.actualDiff}`
														: explanation?.actualDiff}
												</b>
											</p>
										</div>
										<span
											className={`font-bold ${explanation?.goalDiffMatched ? 'text-emerald-400' : 'text-slate-500'}`}
										>
											{explanation?.goalDiffMatched ? 'PASS (+1)' : 'FAIL'}
										</span>
									</div>

									{/* Step 3: Exact Score */}
									<div className="flex items-start justify-between text-xs py-1">
										<div className="space-y-0.5">
											<p className="font-bold text-white flex items-center gap-1.5">
												{explanation?.exactScoreMatched ? (
													<CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
												) : (
													<XCircle className="h-4 w-4 text-slate-600 shrink-0" />
												)}
												3. Exact Scoreline Match
											</p>
											<p className="text-slate-400 pl-5.5">
												Predicted:{' '}
												<b className="text-slate-200">
													{prediction.predicted_home_score} -{' '}
													{prediction.predicted_away_score}
												</b>{' '}
												• Actual:{' '}
												<b className="text-slate-200">
													{match.home_score} - {match.away_score}
												</b>
											</p>
										</div>
										<span
											className={`font-bold ${explanation?.exactScoreMatched ? 'text-emerald-400' : 'text-slate-500'}`}
										>
											{explanation?.exactScoreMatched ? 'PASS (+1)' : 'FAIL'}
										</span>
									</div>
								</div>

								{/* Explanatory summary text */}
								<div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300">
									<p className="leading-relaxed">{explanation?.details}</p>
								</div>
							</>
						) : (
							/* State B: Match is pending resolution (no scores recorded yet) */
							<div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900/40 to-indigo-950/20 border border-amber-500/20 space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Hourglass className="h-5 w-5 text-amber-400 animate-spin" />
										<span className="text-sm font-extrabold text-amber-300">
											{isKickoffPassed
												? 'Match Result Pending'
												: 'Match Scheduled'}
										</span>
									</div>
									<span className="text-xs bg-amber-500/15 border border-amber-500/20 text-amber-300 font-black px-2.5 py-0.5 rounded-full">
										⏳ In Queue
									</span>
								</div>

								<div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1">
									<div className="flex items-center justify-between">
										<span className="text-slate-400 font-bold">
											Your Locked Pick:
										</span>
										<span className="text-white font-black text-sm bg-white/10 px-2 py-0.5 rounded-md">
											{prediction.predicted_home_score} -{' '}
											{prediction.predicted_away_score}
										</span>
									</div>
									<p className="text-[11px] text-slate-400">
										Selected Outcome:{' '}
										<b className="text-indigo-300">
											{getOutcomeText(explanation?.predictedOutcome || null)}
										</b>
									</p>
								</div>

								<p className="text-xs text-slate-300 leading-relaxed">
									{isKickoffPassed
										? `This fixture kicked off on ${formattedKickoff}. Points will be calculated automatically as soon as final scores are recorded.`
										: `Kickoff is scheduled for ${formattedKickoff}. Scoring calculations will trigger once the match is in play.`}
								</p>
							</div>
						)}
					</div>
				) : (
					<div className="p-6 rounded-xl bg-white/5 border border-white/5 text-center space-y-2">
						<AlertCircle className="h-6 w-6 text-slate-400 mx-auto" />
						<p className="text-sm font-bold text-slate-300">
							No Prediction Recorded
						</p>
						<p className="text-xs text-slate-500">
							{username
								? `@${username} did not submit a prediction for this fixture.`
								: 'You did not place a prediction on this match before kickoff.'}
						</p>
					</div>
				)}

				{/* Accordion to view universal scoring rules */}
				<div className="mt-5 border-t border-white/10 pt-4">
					<button
						onClick={() => setShowRulesAccordion(!showRulesAccordion)}
						className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-white transition py-1"
					>
						<span className="flex items-center gap-1.5">
							<HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
							<span>How Are Prediction Points Calculated?</span>
						</span>
						<ChevronDown
							className={`h-4 w-4 transition-transform duration-200 ${
								showRulesAccordion ? 'rotate-180 text-white' : ''
							}`}
						/>
					</button>

					{showRulesAccordion && (
						<div className="mt-3 space-y-2.5 pt-2">
							{SCORING_RULES.map((rule) => (
								<div
									key={rule.points}
									className={`p-3 rounded-xl border ${rule.borderColor} bg-gradient-to-r ${rule.bgGradient} text-left space-y-1`}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1.5">
											<span className="text-sm">{rule.icon}</span>
											<span className={`text-xs font-black ${rule.color}`}>
												{rule.title}
											</span>
										</div>
										<span className={`text-xs font-black ${rule.color}`}>
											+{rule.badge}
										</span>
									</div>
									<p className="text-[11px] text-slate-300 leading-normal">
										{rule.description}
									</p>
									<div className="text-[10px] text-slate-400 bg-black/30 p-1.5 rounded-lg">
										<span className="font-bold text-slate-300">Example:</span>{' '}
										Predicted {rule.example.predicted}, actual was{' '}
										{rule.example.actual}.
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="mt-5 pt-3 flex justify-end">
					<Button
						onClick={onClose}
						className="w-full py-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
					>
						Close Breakdown
					</Button>
				</div>
			</motion.div>
		</div>
	);
}
