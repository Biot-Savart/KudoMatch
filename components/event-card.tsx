'use client';

import { ParticipantCrest } from '@/components/participant-crest';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseTeamScorelineUiConfig } from '@/lib/sports/scoreline-config';
import { formatEditionLabel, formatMatchStart } from '@/lib/utils/display';
import {
	calculatePredictionPoints,
	getScoringExplanation,
} from '@/lib/utils/scoring';
import { MarketPrediction, SportEvent } from '@/types';
import { ChevronRight, Info, Lock, Timer, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface EventCardProps {
	event?: SportEvent;
	match?: any;
	userId: string | null;
	existingPrediction?: MarketPrediction | null;
	onPredict: (event: SportEvent) => void;
	onQuickPredict: (
		marketId: string,
		homeScore: number,
		awayScore: number,
	) => void;
	onBreakdownClick?: (
		event: SportEvent,
		prediction?: MarketPrediction | null,
	) => void;
	onInsightsClick?: (event: SportEvent) => void;
}

export function EventCard(props: EventCardProps) {
	const event = (props.event || props.match) as SportEvent;
	const {
		userId,
		existingPrediction,
		onPredict,
		onQuickPredict,
		onBreakdownClick,
		onInsightsClick,
	} = props;
	const [timeLeft, setTimeLeft] = useState<string>('');
	const [isLocked, setIsLocked] = useState<boolean>(false);

	const homeComp =
		event.competitors?.find((c) => c.slot === 1 || c.role === 'home')
			?.competitor ?? event.competitors?.[0]?.competitor;
	const awayComp =
		event.competitors?.find((c) => c.slot === 2 || c.role === 'away')
			?.competitor ?? event.competitors?.[1]?.competitor;

	const currentMarket = event.current_market ?? event.markets?.[0];
	const scorelineUi = parseTeamScorelineUiConfig(
		currentMarket?.ruleset?.ui_config,
	);
	const quickPicks = scorelineUi?.quick_picks ?? {
		home: { home: 2, away: 1 },
		draw: { home: 1, away: 1 },
		away: { home: 1, away: 2 },
	};
	const marketResultRaw = (currentMarket?.result?.result ??
		(event as any).result?.resultPayload) as any;
	const marketResult =
		marketResultRaw &&
		(marketResultRaw.home !== undefined ||
			marketResultRaw.homeScore !== undefined)
			? {
					home: Number(marketResultRaw.home ?? marketResultRaw.homeScore),
					away: Number(marketResultRaw.away ?? marketResultRaw.awayScore),
				}
			: undefined;

	const pred = existingPrediction ?? currentMarket?.user_prediction;
	const predSelection = pred?.selection as
		| { home: number; away: number }
		| undefined;

	const marketLocksAt = currentMarket?.locks_at ?? event.starts_at;

	// Real-time countdown and lock verification
	useEffect(() => {
		const calculateTimeLeft = () => {
			const now = new Date();
			const lockTime = new Date(marketLocksAt);
			const diff = lockTime.getTime() - now.getTime();

			if (
				diff <= 0 ||
				event.status !== 'scheduled' ||
				currentMarket?.status === 'locked' ||
				currentMarket?.status === 'settled'
			) {
				setIsLocked(true);
				setTimeLeft(
					event.status === 'completed'
						? 'FINISHED'
						: event.status === 'live'
							? 'LIVE IN-PLAY'
							: 'LOCKED',
				);
				return;
			}

			setIsLocked(false);

			const hours = Math.floor(diff / (1000 * 60 * 60));
			const minutes = Math.floor((diff / 1000 / 60) % 60);

			if (hours > 24) {
				setTimeLeft(formatMatchStart(event.starts_at));
			} else {
				setTimeLeft(`Starts in ${hours}h ${minutes}m`);
			}
		};

		calculateTimeLeft();
		const timer = setInterval(calculateTimeLeft, 60000);
		return () => clearInterval(timer);
	}, [event.starts_at, event.status, marketLocksAt, currentMarket?.status]);

	// Derive predicted result option
	const getPredictionOption = (): 'home' | 'draw' | 'away' | null => {
		if (!predSelection) return null;
		if (
			predSelection.home === quickPicks.home.home &&
			predSelection.away === quickPicks.home.away
		) {
			return 'home';
		}
		if (
			predSelection.home === quickPicks.draw.home &&
			predSelection.away === quickPicks.draw.away
		) {
			return 'draw';
		}
		if (
			predSelection.home === quickPicks.away.home &&
			predSelection.away === quickPicks.away.away
		) {
			return 'away';
		}
		return null;
	};

	const activeOption = getPredictionOption();

	const handleQuickSelection = (option: 'home' | 'draw' | 'away') => {
		if (isLocked || !userId || !currentMarket) return;
		const pick = quickPicks[option];
		onQuickPredict(currentMarket.id, pick.home, pick.away);
	};

	const isLive = event.status === 'live';
	const isFinished = event.status === 'completed';
	const isUnavailable = ['postponed', 'cancelled', 'abandoned'].includes(
		event.status,
	);
	const isResolvedOrLive = isLive || isFinished;

	const scoringExplanation =
		isResolvedOrLive && predSelection && marketResult
			? getScoringExplanation(
					predSelection.home,
					predSelection.away,
					marketResult.home,
					marketResult.away,
					(event.edition?.competition?.sport_slug as any) || 'football',
				)
			: null;

	const livePoints =
		isLive && predSelection && marketResult
			? calculatePredictionPoints(
					predSelection.home,
					predSelection.away,
					marketResult.home,
					marketResult.away,
					(event.edition?.competition?.sport_slug as any) || 'football',
				)
			: null;

	return (
		<Card className="glass-card overflow-hidden hover:border-white/20 transition group">
			{/* Top Bar: Gameweek/Round & Status Header */}
			<div className="flex justify-between items-center text-xs font-semibold px-4 py-2 border-b border-white/5 bg-white/[0.02]">
				<div className="flex items-center gap-2 text-slate-400">
					{event.round_label && (
						<span className="bg-white/5 px-2 py-0.5 rounded text-[11px] text-slate-300 font-medium">
							{event.round_label}
						</span>
					)}
					<span
						className="text-[11px] text-slate-400 font-medium flex items-center gap-1 cursor-help hover:text-slate-200 transition"
						title={`Kickoff Time: ${new Date(event.starts_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}`}
					>
						<span>•</span>
						<span>{formatMatchStart(event.starts_at)}</span>
					</span>
					<span className="hidden md:inline text-[11px] text-slate-500">
						({formatEditionLabel(event.edition)})
					</span>
				</div>

				<div className="flex items-center gap-1.5">
					{isFinished ? (
						<span
							title={`Full Time (Match Finished) · Kickoff: ${new Date(event.starts_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}`}
							className="flex items-center gap-1 text-slate-400 font-bold bg-slate-500/10 px-2 py-0.5 rounded-full border border-slate-500/20 text-[10px] tracking-wider cursor-help hover:bg-slate-500/20 transition"
						>
							FT
						</span>
					) : isLive ? (
						<span className="flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 text-[10px] tracking-wider animate-pulse">
							<span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
							LIVE
						</span>
					) : isUnavailable ? (
						<span className="flex items-center gap-1 text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-[10px] tracking-wider">
							{event.status.toUpperCase()}
						</span>
					) : isLocked ? (
						<span className="flex items-center gap-1 text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-[10px]">
							<Lock className="h-3 w-3" />
							LOCKED
						</span>
					) : (
						<span className="flex items-center gap-1 text-indigo-400 font-medium">
							<Timer className="h-3 w-3" />
							{timeLeft}
						</span>
					)}
				</div>
			</div>

			<CardContent className="p-4 sm:p-5">
				{/* Teams and Live Scores/VS Display */}
				<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 my-2">
					{/* Home Team */}
					<div className="flex flex-col items-center text-center gap-2">
						<div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white/5 p-2 flex items-center justify-center border border-white/10 group-hover:scale-105 transition">
							{homeComp?.media_url ? (
								<ParticipantCrest
									src={homeComp.media_url}
									alt={homeComp.name}
								/>
							) : (
								<span className="text-sm font-bold text-slate-400">
									{homeComp?.short_name || 'HOME'}
								</span>
							)}
						</div>
						<span className="font-bold text-xs sm:text-sm text-slate-100 line-clamp-1 max-w-[110px] sm:max-w-[140px]">
							{homeComp?.name || 'Home Team'}
						</span>
					</div>

					{/* Center Scoreline or VS Pill */}
					<div className="flex flex-col items-center justify-center px-2">
						{isResolvedOrLive && marketResult ? (
							<div className="flex flex-col items-center gap-1">
								<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/15 shadow-inner">
									<span
										className={`text-xl sm:text-2xl font-black ${isLive ? 'text-rose-400' : 'text-white'}`}
									>
										{marketResult.home}
									</span>
									<span className="text-slate-500 font-bold">-</span>
									<span
										className={`text-xl sm:text-2xl font-black ${isLive ? 'text-rose-400' : 'text-white'}`}
									>
										{marketResult.away}
									</span>
								</div>
								{isLive && livePoints !== null && (
									<span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
										+{livePoints} PTS LIVE
									</span>
								)}
							</div>
						) : (
							<div className="flex flex-col items-center gap-1">
								<span className="text-xs font-black tracking-widest text-slate-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
									VS
								</span>
							</div>
						)}
					</div>

					{/* Away Team */}
					<div className="flex flex-col items-center text-center gap-2">
						<div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white/5 p-2 flex items-center justify-center border border-white/10 group-hover:scale-105 transition">
							{awayComp?.media_url ? (
								<ParticipantCrest
									src={awayComp.media_url}
									alt={awayComp.name}
								/>
							) : (
								<span className="text-sm font-bold text-slate-400">
									{awayComp?.short_name || 'AWAY'}
								</span>
							)}
						</div>
						<span className="font-bold text-xs sm:text-sm text-slate-100 line-clamp-1 max-w-[110px] sm:max-w-[140px]">
							{awayComp?.name || 'Away Team'}
						</span>
					</div>
				</div>

				{/* Quick Prediction Selector (Outcome chips) */}
				{!isLocked && (
					<div className="grid grid-cols-3 gap-1.5 sm:gap-2 my-3 p-1 rounded-xl bg-white/[0.02] border border-white/5">
						<button
							onClick={() => handleQuickSelection('home')}
							disabled={!userId}
							className={`py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center gap-0.5 ${
								activeOption === 'home'
									? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
									: 'hover:bg-white/5 text-slate-400'
							}`}
						>
							<span>
								{quickPicks.home.home}-{quickPicks.home.away}
							</span>
							<span className="text-[10px] opacity-70 font-normal">
								{homeComp?.short_name || 'Home'}
							</span>
						</button>
						<button
							onClick={() => handleQuickSelection('draw')}
							disabled={!userId}
							className={`py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center gap-0.5 ${
								activeOption === 'draw'
									? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
									: 'hover:bg-white/5 text-slate-400'
							}`}
						>
							<span>
								{quickPicks.draw.home}-{quickPicks.draw.away}
							</span>
							<span className="text-[10px] opacity-70 font-normal">Draw</span>
						</button>
						<button
							onClick={() => handleQuickSelection('away')}
							disabled={!userId}
							className={`py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center gap-0.5 ${
								activeOption === 'away'
									? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
									: 'hover:bg-white/5 text-slate-400'
							}`}
						>
							<span>
								{quickPicks.away.home}-{quickPicks.away.away}
							</span>
							<span className="text-[10px] opacity-70 font-normal">
								{awayComp?.short_name || 'Away'}
							</span>
						</button>
					</div>
				)}

				{/* Saved Prediction Display / Breakdown trigger */}
				{predSelection && (
					<div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="text-xs text-slate-400 font-medium">
								Your Pick:
							</span>
							<span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-black text-xs border border-indigo-500/30 tracking-wider">
								{predSelection.home} - {predSelection.away}
							</span>
						</div>

						{/* Points Breakdown or Status Tag */}
						{isFinished && scoringExplanation ? (
							<button
								onClick={() => onBreakdownClick?.(event, pred)}
								className={`flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg border transition ${scoringExplanation.badgeBg} ${scoringExplanation.badgeBorder} ${scoringExplanation.colorClass} hover:brightness-125`}
							>
								<span>{scoringExplanation.icon}</span>
								<span>+{pred?.raw_points ?? 0} PTS</span>
								<Info className="h-3 w-3 ml-0.5 opacity-70" />
							</button>
						) : isLive && scoringExplanation ? (
							<button
								onClick={() => onBreakdownClick?.(event, pred)}
								className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition"
							>
								<span>Live: +{livePoints} PTS</span>
								<Info className="h-3 w-3 ml-0.5 opacity-70" />
							</button>
						) : null}
					</div>
				)}

				{/* Action Buttons: Community Insights & Full Score Dialer */}
				<div className="mt-4 flex gap-2">
					{onInsightsClick && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => onInsightsClick(event)}
							className="px-3 border-white/10 hover:bg-white/5 text-slate-300 gap-1.5"
							title="View Pool & Community Insights"
						>
							<Users className="h-4 w-4 text-indigo-400" />
							<span className="hidden sm:inline text-xs">Insights</span>
						</Button>
					)}

					<Button
						onClick={() => onPredict(event)}
						disabled={isLocked && !predSelection}
						className={`w-full text-xs font-bold gap-1.5 transition ${
							predSelection
								? 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-white/10'
								: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
						}`}
					>
						<span>
							{predSelection ? 'Edit Scoreline' : 'Predict Scoreline'}
						</span>
						<ChevronRight className="h-3.5 w-3.5" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// Backward-compatible alias
export const MatchCard = EventCard;
export default EventCard;
