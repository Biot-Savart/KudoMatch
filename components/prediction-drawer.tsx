'use client';

import { Button } from '@/components/ui/button';
import { upsertPrediction } from '@/lib/queries/predictions';
import { Match, Prediction } from '@/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Minus, Plus, Save, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface PredictionDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	match: Match | null;
	userId: string | null;
	existingPrediction?: Prediction | null;
}

export function PredictionDrawer({
	isOpen,
	onClose,
	match,
	userId,
	existingPrediction,
}: PredictionDrawerProps) {
	const queryClient = useQueryClient();
	const [homeScore, setHomeScore] = useState<number>(0);
	const [awayScore, setAwayScore] = useState<number>(0);

	// Reset scores when a new match is loaded
	useEffect(() => {
		if (existingPrediction) {
			setHomeScore(existingPrediction.predicted_home_score);
			setAwayScore(existingPrediction.predicted_away_score);
		} else {
			setHomeScore(0);
			setAwayScore(0);
		}
	}, [match, existingPrediction]);

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
		mutationFn: () => {
			if (!userId || !match) throw new Error('Authentication required');
			return upsertPrediction(userId, match.id, homeScore, awayScore);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['predictions', userId] });
			toast.success('Prediction saved successfully!');
			onClose();
		},
		onError: (err: any) => {
			toast.error(err.message || 'Failed to save prediction.');
		},
	});

	if (!match) return null;

	// Compute live outcome text
	const getOutcomeText = () => {
		if (homeScore > awayScore) return `${match.home_team?.name} Win`;
		if (awayScore > homeScore) return `${match.away_team?.name} Win`;
		return 'Draw Match';
	};

	const handleSave = () => {
		if (!userId) {
			toast.error('Please sign in to save predictions!');
			return;
		}
		saveMutation.mutate();
	};

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

					{/* Responsive Sheet Panel (Bottom Sheet on mobile, side-over on desktop) */}
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
										Prediction Dialer
									</span>
								</div>
								<button
									onClick={onClose}
									className="text-slate-400 hover:text-white rounded-full p-2 hover:bg-white/10 transition"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							{/* Content Body */}
							<div className="py-6 flex flex-col items-center justify-center space-y-6">
								{/* Teams Display */}
								<div className="flex items-center justify-between w-full text-center px-2">
									<div className="flex flex-col items-center gap-2 w-28">
										<div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-center shadow-inner">
											{match.home_team?.logo_url ? (
												<img
													src={match.home_team.logo_url}
													alt={match.home_team.name}
													className="h-12 w-12 object-contain drop-shadow"
												/>
											) : (
												<span className="text-3xl">🔵</span>
											)}
										</div>
										<span className="font-extrabold text-xs text-white line-clamp-2 leading-tight">
											{match.home_team?.name}
										</span>
									</div>

									<div className="flex flex-col items-center gap-1">
										<span className="text-xs font-black text-slate-500 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full">
											VS
										</span>
										<span className="text-[10px] font-semibold text-slate-400">
											Matchweek {match.matchday}
										</span>
									</div>

									<div className="flex flex-col items-center gap-2 w-28">
										<div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-center shadow-inner">
											{match.away_team?.logo_url ? (
												<img
													src={match.away_team.logo_url}
													alt={match.away_team.name}
													className="h-12 w-12 object-contain drop-shadow"
												/>
											) : (
												<span className="text-3xl">🔴</span>
											)}
										</div>
										<span className="font-extrabold text-xs text-white line-clamp-2 leading-tight">
											{match.away_team?.name}
										</span>
									</div>
								</div>

								{/* Exact Score Steppers with High-Tactility Dials */}
								<div className="grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-sm pt-2">
									{/* Home goals dial */}
									<div className="flex flex-col items-center space-y-2 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
										<span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate w-full text-center">
											{match.home_team?.name || 'Home'}
										</span>
										<div className="flex items-center gap-2">
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Decrease ${match.home_team?.name || 'home team'} goals`}
												className="h-10 w-10 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl active:scale-90 transition-transform"
												onClick={() =>
													setHomeScore((prev) => Math.max(0, prev - 1))
												}
											>
												<Minus className="h-5 w-5" />
											</Button>
											<span
												className="text-4xl font-black text-white w-12 text-center tabular-numbers"
												aria-live="polite"
											>
												{homeScore}
											</span>
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Increase ${match.home_team?.name || 'home team'} goals`}
												className="h-10 w-10 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl active:scale-90 transition-transform"
												onClick={() => setHomeScore((prev) => prev + 1)}
											>
												<Plus className="h-5 w-5" />
											</Button>
										</div>
									</div>

									{/* Away goals dial */}
									<div className="flex flex-col items-center space-y-2 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
										<span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate w-full text-center">
											{match.away_team?.name || 'Away'}
										</span>
										<div className="flex items-center gap-2">
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Decrease ${match.away_team?.name || 'away team'} goals`}
												className="h-10 w-10 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl active:scale-90 transition-transform"
												onClick={() =>
													setAwayScore((prev) => Math.max(0, prev - 1))
												}
											>
												<Minus className="h-5 w-5" />
											</Button>
											<span
												className="text-4xl font-black text-white w-12 text-center tabular-numbers"
												aria-live="polite"
											>
												{awayScore}
											</span>
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Increase ${match.away_team?.name || 'away team'} goals`}
												className="h-10 w-10 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl active:scale-90 transition-transform"
												onClick={() => setAwayScore((prev) => prev + 1)}
											>
												<Plus className="h-5 w-5" />
											</Button>
										</div>
									</div>
								</div>

								{/* Quick Preset Scoreline Pills */}
								<div className="w-full">
									<p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
										Quick Score Presets
									</p>
									<div className="flex flex-wrap items-center justify-center gap-1.5">
										{[
											[1, 0],
											[2, 0],
											[2, 1],
											[1, 1],
											[0, 0],
											[1, 2],
											[0, 2],
											[3, 1],
										].map(([h, a]) => {
											const isSelected = homeScore === h && awayScore === a;
											return (
												<button
													key={`${h}-${a}`}
													type="button"
													onClick={() => {
														setHomeScore(h);
														setAwayScore(a);
													}}
													className={`px-3 py-1.5 rounded-xl text-xs font-black tabular-numbers border transition-all active:scale-95 ${
														isSelected
															? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
															: 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
													}`}
												>
													{h}-{a}
												</button>
											);
										})}
									</div>
								</div>

								{/* Calculated Live Pick Badge */}
								<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-xs shadow-sm">
									<Trophy className="h-4 w-4 text-amber-400" />
									<span>
										Prediction: {getOutcomeText()} ({homeScore} - {awayScore})
									</span>
								</div>
							</div>
						</div>

						{/* Bottom Actions */}
						<div className="border-t border-white/10 pt-4 pb-safe">
							<Button
								className="w-full py-6 font-bold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 text-sm"
								onClick={handleSave}
								disabled={saveMutation.isPending}
							>
								{saveMutation.isPending ? (
									<Loader2 className="h-5 w-5 animate-spin" />
								) : (
									<>
										<Save className="h-5 w-5" />
										Save Prediction
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
