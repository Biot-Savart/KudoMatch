'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Match, PoolLeaderboardEntry, PoolMember, Prediction } from '@/types';
import { Award, Calendar, Lock, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HeadToHeadProps {
	poolId: string;
	currentUserId: string;
	leaderboard: PoolLeaderboardEntry[];
	members: PoolMember[];
	matrixData: {
		matches: Match[];
		predictions: { [userId: string]: { [matchId: string]: Prediction } };
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

	// Calculate Head-to-Head stats for current matchday if matrixData is present
	const compareMatches = () => {
		if (!matrixData || !opponentId) return [];

		return matrixData.matches.map((match) => {
			const predMe = matrixData.predictions[currentUserId]?.[match.id];
			const predOpp = matrixData.predictions[opponentId]?.[match.id];
			const isMatchLocked =
				new Date(match.kickoff_time) <= new Date() ||
				match.status === 'finished';

			return {
				match,
				predMe,
				predOpp,
				isLocked: isMatchLocked,
			};
		});
	};

	const comparedMatches = compareMatches();

	// Calculate direct matchday H2H stats
	let matchdayWinsMe = 0;
	let matchdayWinsOpp = 0;
	let matchdayDraws = 0;

	comparedMatches.forEach(({ predMe, predOpp, match }) => {
		if (match.status === 'finished' && predMe && predOpp) {
			const ptsMe = predMe.points_earned || 0;
			const ptsOpp = predOpp.points_earned || 0;
			if (ptsMe > ptsOpp) matchdayWinsMe++;
			else if (ptsOpp > ptsMe) matchdayWinsOpp++;
			else matchdayDraws++;
		}
	});

	if (opponents.length === 0) {
		return (
			<div className="rounded-2xl glass-card border border-white/10 p-8 text-center text-slate-400">
				<p className="font-bold mb-1">⚔️ Alone on the battlefield!</p>
				<p className="text-xs max-w-sm mx-auto">
					You are the only member of this league. Copy the invite code and share
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
								{me?.username?.substring(0, 2).toUpperCase() || 'U'}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-black text-white">@{me?.username || 'you'}</p>
							<p className="text-xs text-indigo-400 font-bold">
								Rank #{me?.rank}
							</p>
						</div>
					</div>

					{/* VS graphic / Selector */}
					<div className="flex flex-col items-center justify-center space-y-3 md:w-1/3">
						<div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black text-sm">
							VS
						</div>
						<div className="w-full max-w-[200px]">
							<label className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold text-center mb-1">
								Select Opponent
							</label>
							<select
								value={opponentId}
								onChange={(e) => setOpponentId(e.target.value)}
								className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
							>
								{opponents.map((opp) => (
									<option
										key={opp.user_id}
										value={opp.user_id}
									>
										@{opp.username}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Opponent */}
					<div className="flex flex-col items-center text-center space-y-2 md:w-1/3">
						<Avatar className="h-16 w-16 border-2 border-rose-500 shadow-lg">
							<AvatarImage src={opponent?.avatar_url || ''} />
							<AvatarFallback className="bg-rose-600 text-white font-bold text-lg">
								{opponent?.username?.substring(0, 2).toUpperCase() || 'U'}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-black text-white">
								@{opponent?.username || 'opponent'}
							</p>
							<p className="text-xs text-rose-400 font-bold">
								Rank #{opponent?.rank}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Comparison Stats Dashboard */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Lifetime / Global Standings Stats */}
				<div className="rounded-2xl glass-card border border-white/10 p-5 space-y-4">
					<div className="flex items-center gap-2 border-b border-white/5 pb-2">
						<Award className="h-4 w-4 text-indigo-400" />
						<h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
							Overall League Stats Comparison
						</h3>
					</div>
					<div className="space-y-4">
						{/* Points comparison */}
						<div className="space-y-1.5">
							<div className="flex justify-between text-xs font-bold">
								<span>{me?.total_points} pts</span>
								<span className="text-slate-400 font-medium">Total Points</span>
								<span>{opponent?.total_points} pts</span>
							</div>
							<div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
								<div
									className="bg-indigo-500"
									style={{
										width: `${me && opponent ? (me.total_points / (me.total_points + opponent.total_points || 1)) * 100 : 50}%`,
									}}
								/>
								<div
									className="bg-rose-500"
									style={{
										width: `${me && opponent ? (opponent.total_points / (me.total_points + opponent.total_points || 1)) * 100 : 50}%`,
									}}
								/>
							</div>
						</div>

						{/* Exact Picks Comparison */}
						<div className="space-y-1.5">
							<div className="flex justify-between text-xs font-bold">
								<span>{me?.exact_count}</span>
								<span className="text-slate-400 font-medium">
									🎯 Exact Scores
								</span>
								<span>{opponent?.exact_count}</span>
							</div>
							<div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
								<div
									className="bg-indigo-500"
									style={{
										width: `${me && opponent ? (me.exact_count / (me.exact_count + opponent.exact_count || 1)) * 100 : 50}%`,
									}}
								/>
								<div
									className="bg-rose-500"
									style={{
										width: `${me && opponent ? (opponent.exact_count / (me.exact_count + opponent.exact_count || 1)) * 100 : 50}%`,
									}}
								/>
							</div>
						</div>

						{/* Total Picks Made */}
						<div className="space-y-1.5">
							<div className="flex justify-between text-xs font-bold">
								<span>{me?.predictions_count}</span>
								<span className="text-slate-400 font-medium">Picks Made</span>
								<span>{opponent?.predictions_count}</span>
							</div>
							<div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
								<div
									className="bg-indigo-500"
									style={{
										width: `${me && opponent ? (me.predictions_count / (me.predictions_count + opponent.predictions_count || 1)) * 100 : 50}%`,
									}}
								/>
								<div
									className="bg-rose-500"
									style={{
										width: `${me && opponent ? (opponent.predictions_count / (me.predictions_count + opponent.predictions_count || 1)) * 100 : 50}%`,
									}}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Direct Matchday Stats */}
				<div className="rounded-2xl glass-card border border-white/10 p-5 space-y-4">
					<div className="flex items-center gap-2 border-b border-white/5 pb-2">
						<Shield className="h-4 w-4 text-indigo-400" />
						<h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
							Active Week Predictor Battles
						</h3>
					</div>
					<div className="flex items-center justify-around h-full py-2">
						<div className="text-center">
							<p className="text-3xl font-black text-indigo-400">
								{matchdayWinsMe}
							</p>
							<p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
								Wins
							</p>
						</div>

						<div className="text-center">
							<p className="text-3xl font-black text-slate-400">
								{matchdayDraws}
							</p>
							<p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
								Draws
							</p>
						</div>

						<div className="text-center">
							<p className="text-3xl font-black text-rose-400">
								{matchdayWinsOpp}
							</p>
							<p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
								Losses
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Fixture-by-Fixture Breakdown */}
			<div className="rounded-2xl glass-card border border-white/10 p-5 space-y-4">
				<div className="flex items-center gap-2 border-b border-white/5 pb-2">
					<Calendar className="h-4 w-4 text-indigo-400" />
					<h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
						Side-by-Side Predictions Grid
					</h3>
				</div>

				<div className="space-y-3">
					{comparedMatches.map(({ match, predMe, predOpp, isLocked }) => {
						const hasPredMe = !!predMe;
						const hasPredOpp = !!predOpp;

						// Determine styling based on match resolution points
						const ptsMe = predMe?.points_earned || 0;
						const ptsOpp = predOpp?.points_earned || 0;

						return (
							<div
								key={match.id}
								className="p-4 rounded-xl border border-white/5 bg-slate-950/25 flex flex-col md:flex-row items-center justify-between gap-4"
							>
								{/* Team Names and Match Status */}
								<div className="flex flex-col items-center md:items-start text-center md:text-left space-y-1 md:w-1/3">
									<span className="text-xs font-black text-slate-200">
										{match.home_team?.name} vs {match.away_team?.name}
									</span>
									{match.status === 'finished' ? (
										<span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-black">
											Finished ({match.home_score} - {match.away_score})
										</span>
									) : (
										<span className="text-[9px] text-slate-400 font-bold">
											{new Date(match.kickoff_time).toLocaleDateString(
												undefined,
												{
													month: 'short',
													day: 'numeric',
													hour: '2-digit',
													minute: '2-digit',
												},
											)}
										</span>
									)}
								</div>

								{/* Side-by-side Predictions visualizer */}
								<div className="flex items-center gap-6 justify-center w-full md:w-2/3">
									{/* My Prediction */}
									<div className="flex-1 flex flex-col items-center p-2 rounded-lg bg-white/[0.02] border border-white/5">
										<span className="text-[8px] text-indigo-400 font-black uppercase tracking-wider">
											You
										</span>
										{hasPredMe ? (
											<div className="text-center mt-1">
												<p className="text-sm font-black text-white">
													{predMe.predicted_home_score} -{' '}
													{predMe.predicted_away_score}
												</p>
												{match.status === 'finished' && (
													<span
														className={`text-[9px] font-black mt-0.5 block ${
															ptsMe === 3
																? 'text-emerald-400'
																: ptsMe > 0
																	? 'text-teal-400'
																	: 'text-slate-500'
														}`}
													>
														+{ptsMe} pts
													</span>
												)}
											</div>
										) : (
											<span className="text-[10px] text-slate-500 font-bold mt-1.5">
												No prediction
											</span>
										)}
									</div>

									<div className="text-slate-600 font-black text-xs shrink-0">
										⚔️
									</div>

									{/* Opponent Prediction */}
									<div className="flex-1 flex flex-col items-center p-2 rounded-lg bg-white/[0.02] border border-white/5">
										<span className="text-[8px] text-rose-400 font-black uppercase tracking-wider">
											@{opponent?.username || 'Opp'}
										</span>
										{hasPredOpp ? (
											isLocked ? (
												<div className="text-center mt-1">
													<p className="text-sm font-black text-white">
														{predOpp.predicted_home_score} -{' '}
														{predOpp.predicted_away_score}
													</p>
													{match.status === 'finished' && (
														<span
															className={`text-[9px] font-black mt-0.5 block ${
																ptsOpp === 3
																	? 'text-emerald-400'
																	: ptsOpp > 0
																		? 'text-teal-400'
																		: 'text-slate-500'
															}`}
														>
															+{ptsOpp} pts
														</span>
													)}
												</div>
											) : (
												<div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold mt-2">
													<Lock className="h-3 w-3 text-slate-500" />
													<span>Hidden</span>
												</div>
											)
										) : (
											<span className="text-[10px] text-slate-500 font-bold mt-1.5">
												No prediction
											</span>
										)}
									</div>
								</div>
							</div>
						);
					})}

					{comparedMatches.length === 0 && (
						<p className="text-center text-slate-400 py-6 text-xs font-semibold">
							No match comparative details for active week.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
