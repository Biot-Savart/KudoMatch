'use client';

import { ParticipantCrest } from '@/components/participant-crest';
import { Button } from '@/components/ui/button';
import { triggerConfetti } from '@/lib/utils/confetti';
import { getScoringExplanation, SCORING_RULES } from '@/lib/utils/scoring';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, Trophy, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface ScoreBreakdownModalProps {
	isOpen: boolean;
	onClose: () => void;
	event?: any | null;
	match?: any | null;
	prediction?: any | null;
	username?: string;
}

export function ScoreBreakdownModal({
	isOpen,
	onClose,
	event,
	match,
	prediction,
	username,
}: ScoreBreakdownModalProps) {
	const [showRulesAccordion, setShowRulesAccordion] = useState(false);

	const target = event || match;
	const homeComp =
		target?.competitors?.find((c: any) => c.slot === 1 || c.role === 'home')
			?.competitor ??
		target?.competitors?.[0]?.competitor ??
		target?.home_team;
	const awayComp =
		target?.competitors?.find((c: any) => c.slot === 2 || c.role === 'away')
			?.competitor ??
		target?.competitors?.[1]?.competitor ??
		target?.away_team;

	const currentMarket = target?.current_market ?? target?.markets?.[0];
	const rawRes = (currentMarket?.result?.result ??
		(target as any)?.result?.resultPayload) as any;
	const marketResult =
		rawRes && (rawRes.home !== undefined || rawRes.homeScore !== undefined)
			? {
					home: Number(rawRes.home ?? rawRes.homeScore),
					away: Number(rawRes.away ?? rawRes.awayScore),
				}
			: target?.home_score !== null && target?.home_score !== undefined
				? { home: Number(target.home_score), away: Number(target.away_score) }
				: undefined;

	const pred = prediction ?? currentMarket?.user_prediction;
	const predSelection =
		(pred?.selection as { home: number; away: number } | undefined) ??
		(pred?.predicted_home_score !== undefined
			? { home: pred.predicted_home_score, away: pred.predicted_away_score }
			: undefined);

	const predHome = predSelection?.home;
	const predAway = predSelection?.away;
	const actHome = marketResult?.home;
	const actAway = marketResult?.away;

	const explanation =
		target && marketResult
			? getScoringExplanation(
					predHome,
					predAway,
					actHome,
					actAway,
					(target.edition?.competition?.sport_slug as any) || 'football',
				)
			: null;

	useEffect(() => {
		if (
			isOpen &&
			(explanation?.tier === 'exact_score' ||
				explanation?.tier === 'exact' ||
				pred?.tier_code === 'exact_score' ||
				pred?.points_earned === 3)
		) {
			triggerConfetti({
				particleCount: 50,
				spread: 60,
				origin: { y: 0.6 },
				colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24'],
			});
		}
	}, [isOpen, explanation?.tier, pred?.tier_code, pred?.points_earned]);

	if (!isOpen || !target) return null;

	const isLive = target.status === 'live';
	const isFinished =
		target.status === 'completed' || target.status === 'finished';
	const isKickoffPassed =
		new Date(target.starts_at || target.kickoff_time || 0) <= new Date();
	const hasScores = marketResult !== undefined;

	const homeName = homeComp?.name || 'Home Team';
	const awayName = awayComp?.name || 'Away Team';
	const homeLogo = homeComp?.media_url || homeComp?.logo_url;
	const awayLogo = awayComp?.media_url || awayComp?.logo_url;

	const kickoffDate = new Date(
		target.starts_at || target.kickoff_time || Date.now(),
	);
	const formattedKickoff = kickoffDate.toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	const statusBadgeText = isFinished
		? 'Full Time'
		: isLive
			? 'Live In-Play'
			: isKickoffPassed && !hasScores
				? 'Awaiting Result'
				: 'Upcoming';

	const homeMatched =
		predHome !== undefined && actHome !== undefined && predHome === actHome;
	const awayMatched =
		predAway !== undefined && actAway !== undefined && predAway === actAway;
	const outcomeMatched = explanation?.outcomeMatched ?? false;

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
				<div className="flex items-center gap-3 mb-6">
					<div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
						<Trophy className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-xl font-extrabold tracking-tight">
							Scoring Breakdown
						</h3>
						<p className="text-xs text-slate-400">
							{username
								? `${username}'s prediction analysis`
								: 'Detailed score evaluation'}
						</p>
					</div>
				</div>

				{/* Event Header & Final Score Bar */}
				<div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 mb-5">
					<div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-3 border-b border-white/5 pb-2">
						<span>
							{target.round_label ??
								(target.matchday
									? `Matchweek ${target.matchday}`
									: 'Regular Season')}
						</span>
						<span className="flex items-center gap-1.5">
							{isLive && (
								<span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
							)}
							{statusBadgeText} • {formattedKickoff}
						</span>
					</div>

					<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
						{/* Home */}
						<div className="flex items-center gap-2.5">
							<div className="h-9 w-9 rounded-xl bg-white/5 p-1.5 flex items-center justify-center border border-white/10 shrink-0">
								{homeLogo ? (
									<ParticipantCrest
										src={homeLogo}
										alt={homeName}
									/>
								) : (
									<span className="text-xs font-bold text-slate-400">
										{homeComp?.short_name || 'H'}
									</span>
								)}
							</div>
							<span className="font-bold text-xs sm:text-sm text-slate-100 line-clamp-1">
								{homeName}
							</span>
						</div>

						{/* Score/Status */}
						<div className="flex flex-col items-center px-2">
							{hasScores && marketResult ? (
								<div className="px-3 py-1 rounded-xl bg-slate-900/90 border border-white/15 text-lg font-black tracking-wider">
									<span className={isLive ? 'text-rose-400' : 'text-white'}>
										{marketResult.home}
									</span>
									<span className="text-slate-500 mx-1.5">-</span>
									<span className={isLive ? 'text-rose-400' : 'text-white'}>
										{marketResult.away}
									</span>
								</div>
							) : (
								<span className="text-xs font-black text-slate-500 bg-white/5 px-2.5 py-1 rounded-full">
									VS
								</span>
							)}
						</div>

						{/* Away */}
						<div className="flex items-center justify-end gap-2.5">
							<span className="font-bold text-xs sm:text-sm text-slate-100 line-clamp-1 text-right">
								{awayName}
							</span>
							<div className="h-9 w-9 rounded-xl bg-white/5 p-1.5 flex items-center justify-center border border-white/10 shrink-0">
								{awayLogo ? (
									<ParticipantCrest
										src={awayLogo}
										alt={awayName}
									/>
								) : (
									<span className="text-xs font-bold text-slate-400">
										{awayComp?.short_name || 'A'}
									</span>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Primary Points Result Banner */}
				{explanation && (
					<div
						className={`p-4 rounded-xl border mb-5 ${explanation.badgeBg} ${explanation.badgeBorder} flex items-start gap-3`}
					>
						<div className="text-2xl mt-0.5">{explanation.icon}</div>
						<div className="flex-1">
							<div className="flex items-center justify-between">
								<h4 className={`text-sm font-black ${explanation.colorClass}`}>
									{explanation.tierLabel}
								</h4>
								<span
									className={`px-2.5 py-0.5 rounded-full text-xs font-black bg-black/40 border ${explanation.badgeBorder} ${explanation.colorClass}`}
								>
									+{explanation.points} PTS
								</span>
							</div>
							<p className="text-xs text-slate-200 mt-1 leading-relaxed">
								{predHome !== undefined &&
									predAway !== undefined &&
									actHome !== undefined &&
									actAway !== undefined && (
										<span>
											You correctly predicted {predHome} home goals and{' '}
											{predAway} away goals.
										</span>
									)}
							</p>
							<p className="text-[11px] text-slate-400 mt-1">
								{explanation.details}
							</p>
						</div>
					</div>
				)}

				{/* Match Factor Comparison Grid */}
				{hasScores && explanation && (
					<div className="space-y-2.5 mb-5">
						<h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
							Prediction Breakdown Steps
						</h5>

						{/* Step 1: Home Score */}
						<div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
							<div className="flex items-center gap-2.5">
								{homeMatched ? (
									<CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
								) : (
									<XCircle className="h-4 w-4 text-rose-500/80 shrink-0" />
								)}
								<div className="text-xs font-bold text-slate-200">
									Home Score Match
								</div>
							</div>
							<span
								className={`text-xs font-black px-2 py-0.5 rounded ${
									homeMatched
										? 'bg-emerald-500/20 text-emerald-300'
										: 'bg-slate-800 text-slate-500'
								}`}
							>
								{homeMatched ? 'HIT (+1)' : 'MISS'}
							</span>
						</div>

						{/* Step 2: Away Score */}
						<div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
							<div className="flex items-center gap-2.5">
								{awayMatched ? (
									<CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
								) : (
									<XCircle className="h-4 w-4 text-rose-500/80 shrink-0" />
								)}
								<div className="text-xs font-bold text-slate-200">
									Away Score Match
								</div>
							</div>
							<span
								className={`text-xs font-black px-2 py-0.5 rounded ${
									awayMatched
										? 'bg-emerald-500/20 text-emerald-300'
										: 'bg-slate-800 text-slate-500'
								}`}
							>
								{awayMatched ? 'HIT (+1)' : 'MISS'}
							</span>
						</div>

						{/* Step 3: Winner / Margin */}
						<div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
							<div className="flex items-center gap-2.5">
								{outcomeMatched ? (
									<CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
								) : (
									<XCircle className="h-4 w-4 text-rose-500/80 shrink-0" />
								)}
								<div className="text-xs font-bold text-slate-200">
									Outcome / Difference
								</div>
							</div>
							<span
								className={`text-xs font-black px-2 py-0.5 rounded ${
									outcomeMatched
										? 'bg-emerald-500/20 text-emerald-300'
										: 'bg-slate-800 text-slate-500'
								}`}
							>
								{outcomeMatched ? 'HIT (+1)' : 'MISS'}
							</span>
						</div>
					</div>
				)}

				{/* Universal Rules Accordion */}
				<div className="border border-white/10 rounded-xl overflow-hidden mb-5">
					<button
						onClick={() => setShowRulesAccordion(!showRulesAccordion)}
						className="w-full p-3 bg-white/[0.02] hover:bg-white/5 text-xs font-bold text-slate-300 flex items-center justify-between"
					>
						<span>How Are Prediction Points Calculated?</span>
						<ChevronDown
							className={`h-4 w-4 transition-transform ${showRulesAccordion ? 'rotate-180' : ''}`}
						/>
					</button>

					{showRulesAccordion && (
						<div className="p-3.5 space-y-3 bg-black/40 border-t border-white/5 text-xs">
							{SCORING_RULES.map((rule) => (
								<div
									key={rule.points}
									className="space-y-0.5"
								>
									<div className="flex items-center justify-between font-bold">
										<span className={rule.color}>{rule.title}</span>
										<span className="text-slate-400">+{rule.points} PTS</span>
									</div>
									<p className="text-[11px] text-slate-400">
										{rule.description}
									</p>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Close Action */}
				<div className="mt-6 flex justify-end">
					<Button
						variant="outline"
						onClick={onClose}
						className="border-white/10 hover:bg-white/5 text-slate-300 w-full sm:w-auto"
					>
						Close Breakdown
					</Button>
				</div>
			</motion.div>
		</div>
	);
}

export default ScoreBreakdownModal;
