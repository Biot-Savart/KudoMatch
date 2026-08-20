'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Match, Prediction } from '@/types';
import { ChevronRight, Lock, Timer } from 'lucide-react';
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
}

export function MatchCard({
	match,
	userId,
	existingPrediction,
	onPredict,
	onQuickPredict,
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
							? 'LIVE'
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

	return (
		<Card
			className={`relative overflow-hidden transition-all duration-300 rounded-2xl border-white/5 bg-white/[0.02] shadow-xl ${
				isLocked ? 'opacity-65' : 'hover:border-white/10 hover:bg-white/[0.03]'
			}`}
		>
			{/* Top Details / Time-Lock Row */}
			<div className="px-4 py-2 bg-black/20 border-b border-white/5 flex justify-between items-center text-xs font-semibold">
				<span className="text-slate-400">Matchweek {match.matchday}</span>
				<div
					className={`flex items-center gap-1 ${isLocked ? 'text-red-400' : 'text-indigo-300'}`}
				>
					{isLocked ? (
						<Lock className="h-3 w-3" />
					) : (
						<Timer className="h-3 w-3 animate-pulse" />
					)}
					<span className="tracking-wide">{timeLeft}</span>
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
						{match.status === 'finished' ? (
							// Actual result if finished
							<div className="flex items-center gap-2 bg-black/45 px-3 py-1.5 rounded-xl border border-white/5">
								<span className="text-lg font-black text-white">
									{match.home_score}
								</span>
								<span className="text-xs font-bold text-slate-500">:</span>
								<span className="text-lg font-black text-white">
									{match.away_score}
								</span>
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

				{/* Quick outcome 1 / X / 2 pills selector */}
				<div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-4">
					<button
						onClick={() => handleQuickSelection('home')}
						disabled={isLocked || !userId}
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
						className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all duration-200 ${
							activeOption === 'away'
								? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
								: 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:text-white disabled:pointer-events-none'
						}`}
					>
						2
					</button>
				</div>
			</CardContent>
		</Card>
	);
}
