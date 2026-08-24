'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	calculatePredictionPoints,
	getScoringExplanation,
} from '@/lib/utils/scoring';
import { Match, Prediction } from '@/types';
import { ChevronRight, Info, Lock, Timer, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MatchCardProps {
	match: Match;
	userId: string | null;
	existingPrediction?: Prediction | null;
	onPredict: (match: Match) => void;
	onQuickPredict: (
		matchId: string,
		homeScore: number,
		awayScore: number,
	) => void;
	onBreakdownClick?: (match: Match, prediction?: Prediction | null) => void;
	onInsightsClick?: (match: Match) => void;
}

export function MatchCard({
	match,
	userId,
	existingPrediction,
	onPredict,
	onQuickPredict,
	onBreakdownClick,
	onInsightsClick,
}: MatchCardProps) {
	const [timeLeft, setTimeLeft] = useState<string>('');
	const [isLocked, setIsLocked] = useState<boolean>(false);

	// Real-time countdown and lock verification
	useEffect(() => {
		const calculateTimeLeft = () => {
			const now = new Date();
			const kickoff = new Date(match.kickoff_time);
			const diff = kickoff.getTime() - now.getTime();

			if (diff <= 0 || match.status !== 'scheduled') {
				setIsLocked(true);
				setTimeLeft(
					match.status === 'finished'
						? 'FINISHED'
						: match.status === 'live'
							? 'LIVE IN-PLAY'
							: 'LOCKED',
				);
				return;
			}

			setIsLocked(false);

			const hours = Math.floor(diff / (1000 * 60 * 60));
			const minutes = Math.floor((diff / 1000 / 60) % 60);

			if (hours > 24) {
				setTimeLeft(
					kickoff.toLocaleDateString(undefined, {
						weekday: 'short',
						hour: '2-digit',
						minute: '2-digit',
					}),
				);
			} else {
				setTimeLeft(`Starts in ${hours}h ${minutes}m`);
			}
		};

		calculateTimeLeft();
		const timer = setInterval(calculateTimeLeft, 60000); // check every minute

		return () => clearInterval(timer);
	}, [match]);

	// Derive predicted result option
	const getPredictionOption = (): 'home' | 'draw' | 'away' | null => {
		if (!existingPrediction) return null;
		const { predicted_home_score, predicted_away_score } = existingPrediction;
		if (predicted_home_score > predicted_away_score) return 'home';
		if (predicted_away_score > predicted_home_score) return 'away';
		return 'draw';
	};

	const activeOption = getPredictionOption();

	const handleQuickSelection = (option: 'home' | 'draw' | 'away') => {
		if (isLocked || !userId) return;
		if (option === 'home')
			onQuickPredict(match.id, 2, 1); // default exact outcome fallback scores
		else if (option === 'away') onQuickPredict(match.id, 1, 2);
		else onQuickPredict(match.id, 1, 1);
	};

	const isLive = match.status === 'live';
	const isFinished = match.status === 'finished';
	const isResolvedOrLive = isLive || isFinished;

	// Compute live in-play or final scoring explanation
	const scoringExplanation =
		isResolvedOrLive && existingPrediction
			? getScoringExplanation(
					existingPrediction.predicted_home_score,
					existingPrediction.predicted_away_score,
					match.home_score,
					match.away_score,
					match.status,
				)
			: null;

	const livePoints =
		isLive && existingPrediction
			? calculatePredictionPoints(
					existingPrediction.predicted_home_score,
					existingPrediction.predicted_away_score,
					match.home_score,
					match.away_score,
				)
			: (existingPrediction?.points_earned ?? 0);

	const kickoffFormatted = new Date(match.kickoff_time).toLocaleDateString(
		undefined,
		{
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		},
	);

	return (
		<Card
			className={`relative overflow-hidden transition-all duration-300 rounded-2xl border-white/5 bg-white/[0.02] shadow-xl ${
				isLive
					? 'ring-1 ring-red-500/30 bg-red-500/[0.02]'
					: isLocked
						? 'opacity-85'
						: 'hover:border-white/10 hover:bg-white/[0.03]'
			}`}
		>
			{/* Top Details / Time-Lock Row */}
			<div className="px-4 py-2 bg-black/20 border-b border-white/5 flex justify-between items-center text-xs font-semibold">
				<span className="text-slate-400">Matchweek {match.matchday}</span>
				<div
					className={`flex items-center gap-1.5 ${
						isLive
							? 'text-red-400 font-extrabold'
							: isLocked
								? 'text-slate-400'
								: 'text-indigo-300'
					}`}
				>
					{isLive ? (
						<>
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
								<span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
							</span>
							<span className="tracking-wide">LIVE</span>
						</>
					) : isLocked ? (
						<div
							className="relative flex items-center gap-1 group/lock cursor-help"
							title={`Match ${isFinished ? 'Finished' : 'Locked'} • ${kickoffFormatted}`}
						>
							<Lock className="h-3 w-3" />
							<span className="tracking-wide group-hover/lock:text-slate-200 transition">
								{timeLeft}
							</span>

							{/* Hover Tooltip displaying exact date and time */}
							<div className="absolute right-0 top-full mt-1.5 hidden group-hover/lock:flex flex-col z-30 px-3 py-2 rounded-xl bg-slate-900/95 border border-white/10 text-[10px] text-slate-200 shadow-2xl backdrop-blur-md whitespace-nowrap pointer-events-none transition-all">
								<span className="font-bold text-white flex items-center gap-1">
									<span>
										{isFinished ? '🏁 Final Result' : '🔒 Predictions Locked'}
									</span>
								</span>
								<span className="text-slate-400 text-[9px] mt-0.5">
									Kickoff: {kickoffFormatted}
								</span>
							</div>
						</div>
					) : (
						<>
							<Timer className="h-3 w-3 animate-pulse" />
							<span className="tracking-wide">{timeLeft}</span>
						</>
					)}
				</div>
			</div>

			<CardContent className="p-5 flex flex-col space-y-5">
				{/* Teams Display Row */}
				<div className="flex items-center justify-between text-center relative">
					{/* Home team */}
					<div className="flex flex-col items-center gap-1.5 w-24">
						{match.home_team?.logo_url ? (
							<img
								src={match.home_team.logo_url}
								alt={match.home_team.name}
								className="h-10 w-10 object-contain"
							/>
						) : (
							<span className="text-3xl">🔵</span>
						)}
						<span className="font-extrabold text-xs text-white truncate w-full">
							{match.home_team?.name}
						</span>
					</div>

					{/* Scores or Prediction Middle Selector */}
					<div className="flex flex-col items-center justify-center gap-1">
						{isResolvedOrLive ? (
							// Actual result if finished or in-play
							<div className="flex flex-col items-center gap-1.5">
								<div
									className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border ${
										isLive
											? 'bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20'
											: 'bg-black/45 border-white/5'
									}`}
								>
									<span className="text-xl font-black text-white">
										{match.home_score ?? 0}
									</span>
									<span className="text-xs font-bold text-slate-500">:</span>
									<span className="text-xl font-black text-white">
										{match.away_score ?? 0}
									</span>
								</div>

								{existingPrediction && scoringExplanation && (
									<button
										onClick={() =>
											onBreakdownClick?.(match, existingPrediction)
										}
										title="Click to view full scoring breakdown"
										className="flex flex-col items-center mt-1 group cursor-pointer"
									>
										<div
											className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border flex items-center gap-1 transition group-hover:scale-105 ${scoringExplanation.badgeBg} ${scoringExplanation.badgeBorder} ${scoringExplanation.colorClass}`}
										>
											{isLive && (
												<span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
											)}
											<span>
												{isLive ? 'In-Play: ' : '+'}
												{livePoints} PTS
											</span>
											<Info className="h-2.5 w-2.5 opacity-70" />
										</div>
										<span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 flex items-center gap-0.5">
											<span>{scoringExplanation.tierLabel}</span>
										</span>
									</button>
								)}
							</div>
						) : (
							// Prediction score or Prediction Edit Trigger
							<Button
								variant={existingPrediction ? 'glass' : 'outline'}
								disabled={isLocked && !existingPrediction}
								onClick={() => onPredict(match)}
								className={`flex items-center gap-1 rounded-xl py-1.5 px-3 h-auto text-xs font-bold transition duration-200 border-white/5 ${
									existingPrediction
										? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200 shadow-md shadow-indigo-500/5 hover:bg-indigo-500/20'
										: 'hover:bg-white/5 text-slate-400 hover:text-white'
								}`}
							>
								{existingPrediction ? (
									<span className="text-base font-black">
										{existingPrediction.predicted_home_score} -{' '}
										{existingPrediction.predicted_away_score}
									</span>
								) : (
									<>
										<span>{isLocked ? 'No Pick' : 'Predict'}</span>
										{!isLocked && <ChevronRight className="h-3 w-3 ml-0.5" />}
									</>
								)}
							</Button>
						)}
					</div>

					{/* Away team */}
					<div className="flex flex-col items-center gap-1.5 w-24">
						{match.away_team?.logo_url ? (
							<img
								src={match.away_team.logo_url}
								alt={match.away_team.name}
								className="h-10 w-10 object-contain"
							/>
						) : (
							<span className="text-3xl">🔴</span>
						)}
						<span className="font-extrabold text-xs text-white truncate w-full">
							{match.away_team?.name}
						</span>
					</div>
				</div>

				{/* Bottom Section */}
				{isResolvedOrLive ? (
					<div className="border-t border-white/5 pt-3 flex items-center justify-between text-xs">
						{existingPrediction ? (
							<button
								onClick={() => onBreakdownClick?.(match, existingPrediction)}
								className="flex items-center gap-1.5 text-slate-400 hover:text-white transition group text-[11px]"
							>
								<span className="font-bold">Your Pick:</span>
								<span className="text-white font-black bg-white/5 px-2 py-0.5 rounded-md border border-white/5 group-hover:border-indigo-500/30">
									{existingPrediction.predicted_home_score} -{' '}
									{existingPrediction.predicted_away_score}
								</span>
							</button>
						) : (
							<span className="text-slate-500 text-[11px] font-medium">
								No pick submitted
							</span>
						)}

						{onInsightsClick && (
							<button
								onClick={() => onInsightsClick(match)}
								className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition"
							>
								<Users className="h-3 w-3" />
								<span>Pool Picks</span>
							</button>
						)}
					</div>
				) : (
					/* Quick outcome 1 / X / 2 pills selector */
					<div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-4">
						<button
							onClick={() => handleQuickSelection('home')}
							disabled={isLocked || !userId}
							aria-label={`Predict Home Win: ${match.home_team?.name || 'Home team'}`}
							className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all duration-200 ${
								activeOption === 'home'
									? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
									: 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:text-white disabled:pointer-events-none'
							}`}
						>
							1
						</button>
						<button
							onClick={() => handleQuickSelection('draw')}
							disabled={isLocked || !userId}
							aria-label="Predict Draw Match"
							className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all duration-200 ${
								activeOption === 'draw'
									? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
									: 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:text-white disabled:pointer-events-none'
							}`}
						>
							X
						</button>
						<button
							onClick={() => handleQuickSelection('away')}
							disabled={isLocked || !userId}
							aria-label={`Predict Away Win: ${match.away_team?.name || 'Away team'}`}
							className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all duration-200 ${
								activeOption === 'away'
									? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
									: 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:text-white disabled:pointer-events-none'
							}`}
						>
							2
						</button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
