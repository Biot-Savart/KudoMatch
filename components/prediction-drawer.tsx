'use client';

import { Button } from '@/components/ui/button';
import { ParticipantCrest } from '@/components/participant-crest';
import { deletePrediction, submitPrediction } from '@/lib/queries/predictions';
import { parseTeamScorelineUiConfig } from '@/lib/sports/scoreline-config';
import { TeamScorelineSelection } from '@/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Minus, Plus, Save, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export interface PredictionDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	event?: any | null;
	match?: any | null;
	userId: string | null;
	existingPrediction?: any | null;
}

export function PredictionDrawer({
	isOpen,
	onClose,
	event,
	match,
	userId,
	existingPrediction,
}: PredictionDrawerProps) {
	const queryClient = useQueryClient();
	const [homeScore, setHomeScore] = useState<number>(0);
	const [awayScore, setAwayScore] = useState<number>(0);

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
	const targetSport = target?.edition?.competition?.sport_slug;
	const marketId = currentMarket?.id ?? target?.id;
	const parsedUiConfig = parseTeamScorelineUiConfig(
		currentMarket?.ruleset?.ui_config,
	);
	// Legacy records are kept readable during migration; newly-ingested markets
	// must provide a valid renderer contract and never silently fall back to a
	// different sport's controls.
	const uiConfig = parsedUiConfig ?? currentMarket?.ruleset?.ui_config ?? {};
	const scoreMin = parsedUiConfig?.limits.home[0] ?? uiConfig.score_min ?? 0;
	const scoreMax = parsedUiConfig?.limits.home[1] ?? uiConfig.score_max ?? 99;
	const awayScoreMin = parsedUiConfig?.limits.away[0] ?? scoreMin;
	const awayScoreMax = parsedUiConfig?.limits.away[1] ?? scoreMax;
	const increments = parsedUiConfig?.increments ?? [uiConfig.step ?? 1];
	const isLocked = Boolean(
		currentMarket?.status && currentMarket.status !== 'open',
	) || Boolean(
		currentMarket?.locks_at && new Date(currentMarket.locks_at).getTime() <= Date.now(),
	);

	// Reset scores when a new event/prediction is loaded
	useEffect(() => {
		const sel = (existingPrediction?.selection ??
			currentMarket?.user_prediction?.selection) as
			| TeamScorelineSelection
			| undefined;

		if (sel && typeof sel.home === 'number' && typeof sel.away === 'number') {
			setHomeScore(sel.home);
			setAwayScore(sel.away);
		} else if (
			existingPrediction &&
			typeof existingPrediction.predicted_home_score === 'number'
		) {
			setHomeScore(existingPrediction.predicted_home_score);
			setAwayScore(existingPrediction.predicted_away_score);
		} else {
			setHomeScore(0);
			setAwayScore(0);
		}
	}, [target, existingPrediction, currentMarket]);

	// Close drawer on Escape key down
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isOpen) {
				onClose();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, onClose]);

	const saveMutation = useMutation({
		mutationFn: async () => {
			if (!userId || !target || !marketId) {
				throw new Error('Authentication and active market required');
			}
			const selection: TeamScorelineSelection = {
				kind: 'team_scoreline',
				version: currentMarket?.payload_schema_version || 1,
				home: homeScore,
				away: awayScore,
			};
			return submitPrediction(userId, marketId, selection);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['predictions'] });
			queryClient.invalidateQueries({ queryKey: ['events'] });
			queryClient.invalidateQueries({ queryKey: ['matches'] });
			toast.success('Prediction saved successfully!');
			onClose();
		},
		onError: (err: any) => {
			toast.error(err.message || 'Failed to save prediction.');
		},
	});
	const clearMutation = useMutation({
		mutationFn: async () => {
			if (!userId || !marketId) throw new Error('Authentication and active market required');
			return deletePrediction(userId, String(marketId));
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['predictions'] });
			queryClient.invalidateQueries({ queryKey: ['events'] });
			toast.success('Prediction cleared.');
			onClose();
		},
		onError: (err: any) => toast.error(err.message || 'Failed to clear prediction.'),
	});

	if (!target) return null;
	if (targetSport === 'rugby-union' && !parsedUiConfig) {
		return isOpen ? (
			<div role="alert" className="fixed inset-x-4 bottom-6 z-[60] rounded-2xl border border-amber-400/30 bg-slate-900 p-5 text-sm text-amber-200 shadow-2xl">
				This Rugby market is temporarily unavailable because its scoreline configuration is invalid. The operations team has been notified.
			</div>
		) : null;
	}

	const getOutcomeText = () => {
		if (homeScore > awayScore) return `${homeComp?.name || 'Home'} Win`;
		if (awayScore > homeScore) return `${awayComp?.name || 'Away'} Win`;
		return 'Draw Match';
	};

	const handleSave = () => {
		if (isLocked) {
			toast.error('This market is locked; predictions can no longer be changed.');
			return;
		}
		if (!userId) {
			toast.error('Please sign in to save predictions!');
			return;
		}
		saveMutation.mutate();
	};

	const presets = uiConfig.presets ?? [
		{ home: 1, away: 0, label: '1 - 0' },
		{ home: 2, away: 0, label: '2 - 0' },
		{ home: 2, away: 1, label: '2 - 1' },
		{ home: 1, away: 1, label: '1 - 1' },
		{ home: 0, away: 0, label: '0 - 0' },
		{ home: 0, away: 1, label: '0 - 1' },
		{ home: 1, away: 2, label: '1 - 2' },
		{ home: 0, away: 2, label: '0 - 2' },
	];

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Slide-over Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 0.5 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black z-40"
					/>

					{/* Responsive Sheet Panel */}
					<motion.div
						initial={{ y: '100%', opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: '100%', opacity: 0 }}
						transition={{ type: 'spring', damping: 28, stiffness: 240 }}
						className="fixed inset-x-0 bottom-0 max-h-[92vh] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[480px] sm:max-h-full glass-sheet z-50 p-6 flex flex-col justify-between shadow-2xl rounded-t-3xl sm:rounded-l-3xl sm:rounded-tr-none overflow-y-auto"
					>
						<div>
							{/* Mobile Drag Indicator Handle */}
							<div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

							{/* Header */}
							<div className="flex justify-between items-center border-b border-white/10 pb-4">
								<div className="flex items-center gap-2 text-indigo-400">
									<Trophy className="h-5 w-5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
									<span className="font-black text-sm tracking-wider uppercase">
										Scoreline Predictor
									</span>
								</div>
								<button
									onClick={onClose}
									className="text-slate-400 hover:text-white rounded-full p-2 hover:bg-white/10 transition"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							{/* Event Context Meta */}
							<div className="mt-4 text-center">
								<span className="text-xs font-semibold px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-indigo-300">
									{target.edition?.name ?? 'Match'} •{' '}
									{target.round_label ??
										(target.matchday
											? `Matchday ${target.matchday}`
											: 'Regular Season')}
								</span>
								<div className="text-xs text-slate-400 mt-2 font-medium">
									Kickoff:{' '}
									{new Date(
										target.starts_at || target.kickoff_time || Date.now(),
									).toLocaleDateString(undefined, {
										weekday: 'short',
										month: 'short',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit',
									})}
								</div>
								{isLocked && (
									<div role="status" className="mt-2 text-xs font-semibold text-amber-300">
										Market locked — your pick is read-only.
									</div>
								)}
							</div>

							{/* Interactive Score Steppers */}
							<div className="my-6 grid grid-cols-2 gap-4">
								{/* Home Team Stepper */}
								<div className="glass-card p-4 rounded-2xl flex flex-col items-center border border-white/10">
									<div className="h-12 w-12 rounded-xl bg-white/5 p-2 flex items-center justify-center mb-2">
										{homeComp?.media_url || homeComp?.logo_url ? (
																			<ParticipantCrest src={homeComp.media_url || homeComp.logo_url} alt={homeComp.name} />
										) : (
											<span className="font-bold text-xs">
												{homeComp?.short_name || 'HOME'}
											</span>
										)}
									</div>
									<span className="font-bold text-xs text-slate-200 text-center line-clamp-1 mb-4">
										{homeComp?.name || 'Home Team'}
									</span>

									{/* Stepper Controls */}
									<div className="flex items-center gap-3">
										<button
											aria-label={`Decrease ${homeComp?.name || 'home'} score by 1`}
											onClick={() =>
												setHomeScore((prev) => Math.max(scoreMin, prev - 1))
											}
											disabled={homeScore <= scoreMin}
											className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition active:scale-95"
										>
											<Minus className="h-4 w-4" />
										</button>
										<input
											aria-label="Home score"
											type="number"
											min={scoreMin}
											max={scoreMax}
											value={homeScore}
											onChange={(e) => setHomeScore(Math.max(scoreMin, Math.min(scoreMax, Number(e.target.value) || 0)))}
											className="text-3xl font-black text-white w-16 text-center bg-transparent border-b border-white/20 focus:border-indigo-400 outline-none"
										/>
										<button
											aria-label={`Increase ${homeComp?.name || 'home'} score by ${increments[0]}`}
											onClick={() =>
												setHomeScore((prev) => Math.min(scoreMax, prev + increments[0]))
											}
											disabled={homeScore >= scoreMax}
											className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition active:scale-95"
										>
											<Plus className="h-4 w-4" />
										</button>
									</div>
									{increments.length > 1 && (
										<div className="flex gap-1 mt-2" aria-label="Home score increments">
											{increments.slice(1).map((step) => (
												<button key={step} type="button" aria-label={`Increase home score by ${step}`} onClick={() => setHomeScore((prev) => Math.min(scoreMax, prev + step))} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 hover:text-white">+{step}</button>
											))}
										</div>
									)}
								</div>

								{/* Away Team Stepper */}
								<div className="glass-card p-4 rounded-2xl flex flex-col items-center border border-white/10">
									<div className="h-12 w-12 rounded-xl bg-white/5 p-2 flex items-center justify-center mb-2">
										{awayComp?.media_url || awayComp?.logo_url ? (
																			<ParticipantCrest src={awayComp.media_url || awayComp.logo_url} alt={awayComp.name} />
										) : (
											<span className="font-bold text-xs">
												{awayComp?.short_name || 'AWAY'}
											</span>
										)}
									</div>
									<span className="font-bold text-xs text-slate-200 text-center line-clamp-1 mb-4">
										{awayComp?.name || 'Away Team'}
									</span>

									{/* Stepper Controls */}
									<div className="flex items-center gap-3">
										<button
											aria-label={`Decrease ${awayComp?.name || 'away'} score by 1`}
											onClick={() =>
												setAwayScore((prev) => Math.max(awayScoreMin, prev - 1))
											}
											disabled={awayScore <= awayScoreMin}
											className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition active:scale-95"
										>
											<Minus className="h-4 w-4" />
										</button>
										<input
											aria-label="Away score"
											type="number"
											min={awayScoreMin}
											max={awayScoreMax}
											value={awayScore}
											onChange={(e) => setAwayScore(Math.max(awayScoreMin, Math.min(awayScoreMax, Number(e.target.value) || 0)))}
											className="text-3xl font-black text-white w-16 text-center bg-transparent border-b border-white/20 focus:border-indigo-400 outline-none"
										/>
										<button
											aria-label={`Increase ${awayComp?.name || 'away'} score by ${increments[0]}`}
											onClick={() =>
												setAwayScore((prev) => Math.min(awayScoreMax, prev + increments[0]))
											}
											disabled={awayScore >= awayScoreMax}
											className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition active:scale-95"
										>
											<Plus className="h-4 w-4" />
										</button>
									</div>
									{increments.length > 1 && (
										<div className="flex gap-1 mt-2" aria-label="Away score increments">
											{increments.slice(1).map((step) => (
												<button key={step} type="button" aria-label={`Increase away score by ${step}`} onClick={() => setAwayScore((prev) => Math.min(awayScoreMax, prev + step))} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 hover:text-white">+{step}</button>
											))}
										</div>
									)}
								</div>
							</div>

							{/* Dynamic Outcome Banner */}
							<div className="text-center p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold text-sm tracking-wide shadow-inner">
								Outcome: {getOutcomeText()} ({homeScore} - {awayScore})
							</div>

							{/* Quick Score Presets */}
							<div className="mt-5">
								<span className="text-xs font-semibold text-slate-400 block mb-2">
									Common Presets:
								</span>
										<div className="grid grid-cols-4 gap-2">
									{presets.map((preset: any, idx: number) => (
										<button
											key={idx}
											onClick={() => {
												setHomeScore(preset.home);
												setAwayScore(preset.away);
											}}
											className={`py-1.5 rounded-lg border text-xs font-semibold transition ${
												homeScore === preset.home && awayScore === preset.away
													? 'bg-indigo-600 border-indigo-500 text-white'
													: 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
											}`}
										>
											{preset.label ?? `${preset.home} - ${preset.away}`}
										</button>
									))}
								</div>
							</div>
						</div>

						{/* Footer Actions */}
						<div className="pt-6 border-t border-white/10 flex gap-3 mt-6">
							<Button
								variant="outline"
								onClick={onClose}
								className="w-1/3 border-white/10 hover:bg-white/5 text-slate-300"
							>
								Cancel
							</Button>
							{existingPrediction && !isLocked && (
								<Button
									variant="outline"
									onClick={() => clearMutation.mutate()}
									disabled={clearMutation.isPending}
									className="border-rose-400/30 text-rose-300 hover:bg-rose-500/10"
								>
									{clearMutation.isPending ? 'Clearing…' : 'Clear prediction'}
								</Button>
							)}
							<Button
								onClick={handleSave}
								disabled={saveMutation.isPending || isLocked}
								className="w-2/3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 shadow-lg shadow-indigo-600/30"
							>
								{saveMutation.isPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										<span>Saving...</span>
									</>
								) : (
									<>
										<Save className="h-4 w-4" />
									<span>Confirm Pick</span>
									</>
								)}
							</Button>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

export default PredictionDrawer;
