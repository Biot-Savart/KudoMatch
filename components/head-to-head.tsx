'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	PoolLeaderboardEntry,
	SportEvent
} from '@/types';
import { Calendar, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface HeadToHeadProps {
	poolId: string;
	currentUserId: string;
	leaderboard: PoolLeaderboardEntry[];
	members: any[];
	matrixData: {
		events?: SportEvent[];
		matches?: any[];
		predictions: { [userId: string]: { [eventIdOrMarketId: string]: any } };
	} | null;
	defaultOpponentId?: string;
}

export default function HeadToHead({
	poolId,
	currentUserId,
	leaderboard,
	members,
	matrixData,
	defaultOpponentId,
}: HeadToHeadProps) {
	const [opponentId, setOpponentId] = useState<string>('');

	// Filter out current user from opponents list
	const opponents = leaderboard.filter(
		(entry) => entry.user_id !== currentUserId,
	);

	useEffect(() => {
		if (defaultOpponentId) {
			setOpponentId(defaultOpponentId);
		} else if (opponents.length > 0 && !opponentId) {
			setOpponentId(opponents[0].user_id);
		}
	}, [defaultOpponentId, opponents, opponentId]);

	const me = leaderboard.find((entry) => entry.user_id === currentUserId);
	const opponent = leaderboard.find((entry) => entry.user_id === opponentId);

	// Calculate Head-to-Head stats for current round if matrixData is present
	const compareEvents = () => {
		if (!matrixData || !opponentId) return [];
		const items = matrixData.events || matrixData.matches || [];

		return items.map((ev) => {
			const mId = ev.current_market?.id ?? ev.id;
			const predMe =
				matrixData.predictions[currentUserId]?.[ev.id] ||
				matrixData.predictions[currentUserId]?.[mId];
			const predOpp =
				matrixData.predictions[opponentId]?.[ev.id] ||
				matrixData.predictions[opponentId]?.[mId];
			const isEventLocked =
				new Date(ev.starts_at || ev.kickoff_time || 0) <= new Date() ||
				ev.status === 'completed' ||
				ev.status === 'finished';

			return {
				event: ev,
				predMe,
				predOpp,
				isLocked: isEventLocked,
			};
		});
	};

	const comparedEvents = compareEvents();

	// Calculate direct round H2H stats
	let roundWinsMe = 0;
	let roundWinsOpp = 0;
	let roundDraws = 0;

	comparedEvents.forEach(({ predMe, predOpp, event }) => {
		if (
			(event.status === 'completed' || event.status === 'finished') &&
			predMe &&
			predOpp
		) {
			const ptsMe = predMe.raw_points ?? predMe.points_earned ?? 0;
			const ptsOpp = predOpp.raw_points ?? predOpp.points_earned ?? 0;
			if (ptsMe > ptsOpp) roundWinsMe++;
			else if (ptsOpp > ptsMe) roundWinsOpp++;
			else roundDraws++;
		}
	});

	if (opponents.length === 0) {
		return (
			<div className="rounded-2xl glass-card border border-white/10 p-8 text-center text-slate-400">
				<p className="font-bold mb-1">⚔️ Alone on the battlefield!</p>
				<p className="text-xs max-w-sm mx-auto">
					You are the only member of this pool. Copy the invite code and share
					it with your friends to unlock Head-to-Head comparison!
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Opponent Selection & Matchup Card */}
			<div className="rounded-2xl glass-card border border-white/10 p-6 shadow-xl relative overflow-hidden bg-gradient-to-b from-slate-900/50 to-slate-950/20">
				<div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
					{/* Current User */}
					<div className="flex flex-col items-center text-center space-y-2 md:w-1/3">
						<Avatar className="h-16 w-16 border-2 border-indigo-500 shadow-lg">
							<AvatarImage src={me?.avatar_url || ''} />
							<AvatarFallback className="bg-indigo-600 text-white font-bold text-lg">
								{(me?.full_name || (me as any)?.username || 'ME')
									.substring(0, 2)
									.toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-black text-white">
								{(me as any)?.username
									? `@${(me as any).username}`
									: me?.full_name || 'You'}
							</p>
							<p className="text-xs text-indigo-400 font-bold">
								Rank #{me?.rank ?? 1}
							</p>
						</div>
					</div>

					{/* VS graphic / Selector */}
					<div className="flex flex-col items-center justify-center space-y-3 md:w-1/3">
						<div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black text-sm">
							VS
						</div>

						{/* Opponent dropdown selector */}
						<div className="w-full max-w-xs">
							<select
								value={opponentId}
								onChange={(e) => setOpponentId(e.target.value)}
								className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
							>
								{opponents.map((opp) => (
									<option
										key={opp.user_id}
										value={opp.user_id}
									>
										{(opp as any).username
											? `@${(opp as any).username}`
											: opp.full_name || 'Member'}{' '}
										(#{opp.rank} • {opp.total_points} pts)
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Opponent User */}
					<div className="flex flex-col items-center text-center space-y-2 md:w-1/3">
						<Avatar className="h-16 w-16 border-2 border-pink-500 shadow-lg">
							<AvatarImage src={opponent?.avatar_url || ''} />
							<AvatarFallback className="bg-pink-600 text-white font-bold text-lg">
								{(opponent?.full_name || (opponent as any)?.username || 'OP')
									.substring(0, 2)
									.toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-black text-white">
								{(opponent as any)?.username
									? `@${(opponent as any).username}`
									: opponent?.full_name || 'Opponent'}
							</p>
							<p className="text-xs text-pink-400 font-bold">
								Rank #{opponent?.rank ?? 1}
							</p>
						</div>
					</div>
				</div>

				{/* Overall Stats Bar */}
				{me && opponent && (
					<div className="mt-6 pt-6 border-t border-white/10">
						<h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center mb-3">
							Overall League Stats Comparison
						</h4>
						<div className="grid grid-cols-3 gap-2 text-center">
							<div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
								<p className="text-xl font-black text-indigo-400">
									{me.total_points} pts
								</p>
								<p className="text-[10px] text-slate-400 uppercase font-bold">
									Your Total Pts
								</p>
							</div>
							<div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
								<p className="text-xs font-bold text-slate-300">
									{me.total_points > opponent.total_points
										? `+${me.total_points - opponent.total_points} Ahead`
										: me.total_points < opponent.total_points
											? `-${opponent.total_points - me.total_points} Behind`
											: 'Tied Score'}
								</p>
								<p className="text-[10px] text-slate-500 font-medium">
									Difference
								</p>
							</div>
							<div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
								<p className="text-xl font-black text-pink-400">
									{opponent.total_points} pts
								</p>
								<p className="text-[10px] text-slate-400 uppercase font-bold">
									Opponent Pts
								</p>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Match-by-Match Breakdown */}
			<div className="space-y-3">
				<h3 className="text-sm font-bold text-slate-300 px-1 flex items-center gap-2">
					<Calendar className="h-4 w-4 text-indigo-400" />
					<span>Active Week Predictor Battles</span>
				</h3>

				<div className="space-y-2">
					{comparedEvents.map(({ event, predMe, predOpp, isLocked }) => {
						const homeComp =
							event.competitors?.find(
								(c: any) => c.slot === 1 || c.role === 'home',
							)?.competitor ??
							event.competitors?.[0]?.competitor ??
							event.home_team;
						const awayComp =
							event.competitors?.find(
								(c: any) => c.slot === 2 || c.role === 'away',
							)?.competitor ??
							event.competitors?.[1]?.competitor ??
							event.away_team;

						const homeName =
							homeComp?.short_name || homeComp?.name || 'Arsenal';
						const awayName =
							awayComp?.short_name || awayComp?.name || 'Chelsea';

						const marketResult =
							(event.current_market?.result?.result as
								| { home: number; away: number }
								| undefined) ??
							(event.home_score !== undefined && event.away_score !== undefined
								? { home: event.home_score, away: event.away_score }
								: undefined);

						const selMe =
							(predMe?.selection as
								| { home: number; away: number }
								| undefined) ??
							(predMe?.predicted_home_score !== undefined
								? {
										home: predMe.predicted_home_score,
										away: predMe.predicted_away_score,
									}
								: undefined);
						const selOpp =
							(predOpp?.selection as
								| { home: number; away: number }
								| undefined) ??
							(predOpp?.predicted_home_score !== undefined
								? {
										home: predOpp.predicted_home_score,
										away: predOpp.predicted_away_score,
									}
								: undefined);

						return (
							<div
								key={event.id}
								className="p-4 rounded-xl glass-card border border-white/5 hover:border-white/10 transition flex items-center justify-between gap-4"
							>
								{/* Left: Your Prediction */}
								<div className="w-24 text-left">
									<div className="text-[10px] text-slate-400 font-semibold mb-0.5">
										Your Pick
									</div>
									{selMe ? (
										<span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
											{selMe.home} - {selMe.away}
										</span>
									) : (
										<span className="text-[11px] text-slate-500 italic">
											None
										</span>
									)}
								</div>

								{/* Center: Match Details & Score */}
								<div className="flex-1 text-center min-w-0">
									<div className="text-xs font-bold text-white truncate">
										{homeComp?.name || homeName} vs {awayComp?.name || awayName}
									</div>
									{marketResult ? (
										<div className="text-xs font-black text-amber-400 mt-0.5">
											{marketResult.home} - {marketResult.away}
										</div>
									) : (
										<div className="text-[10px] text-slate-400 mt-0.5">
											{new Date(
												event.starts_at || event.kickoff_time || Date.now(),
											).toLocaleDateString(undefined, {
												weekday: 'short',
												hour: '2-digit',
												minute: '2-digit',
											})}
										</div>
									)}
								</div>

								{/* Right: Opponent Prediction */}
								<div className="w-24 text-right">
									<div className="text-[10px] text-slate-400 font-semibold mb-0.5">
										Opponent Pick
									</div>
									{!isLocked ? (
										<span className="text-[11px] text-slate-500 flex items-center justify-end gap-1">
											<Lock className="h-3 w-3" />
											Hidden
										</span>
									) : selOpp ? (
										<span className="font-mono text-xs font-bold text-pink-300 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
											{selOpp.home} - {selOpp.away}
										</span>
									) : (
										<span className="text-[11px] text-slate-500 italic">
											None
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
