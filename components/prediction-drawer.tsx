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

					{/* Slide-over Drawer Panel */}
					<motion.div
						initial={{ x: '100%' }}
						animate={{ x: 0 }}
						exit={{ x: '100%' }}
						transition={{ type: 'spring', damping: 25, stiffness: 180 }}
						className="fixed inset-y-0 right-0 w-full sm:w-[450px] glass-drawer z-50 p-6 flex flex-col justify-between shadow-2xl"
					>
						{/* Header */}
						<div className="flex justify-between items-center border-b border-white/5 pb-4">
							<div className="flex items-center gap-2 text-indigo-400">
								<Trophy className="h-5 w-5 text-yellow-500" />
								<span className="font-extrabold text-sm tracking-wider uppercase">
									Prediction Scoreline
								</span>
							</div>
							<button
								onClick={onClose}
								className="text-slate-400 hover:text-white rounded-lg p-1.5 hover:bg-white/5 transition"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						{/* Content Body */}
						<div className="flex-grow py-8 flex flex-col items-center justify-center space-y-8">
							{/* Teams Display */}
							<div className="flex items-center justify-between w-full text-center px-4">
								<div className="flex flex-col items-center gap-2 w-28">
									{match.home_team?.logo_url ? (
										<img
											src={match.home_team.logo_url}
											alt={match.home_team.name}
											className="h-16 w-16 object-contain"
										/>
									) : (
										<span className="text-4xl">🔵</span>
									)}
									<span className="font-extrabold text-base text-white line-clamp-2 leading-tight">
										{match.home_team?.name}
									</span>
								</div>

								<span className="text-sm font-black text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg">
									VS
								</span>

								<div className="flex flex-col items-center gap-2 w-28">
									{match.away_team?.logo_url ? (
										<img
											src={match.away_team.logo_url}
											alt={match.away_team.name}
											className="h-16 w-16 object-contain"
										/>
									) : (
										<span className="text-4xl">🔴</span>
									)}
									<span className="font-extrabold text-base text-white line-clamp-2 leading-tight">
										{match.away_team?.name}
									</span>
								</div>
							</div>

							{/* Exact Score inputs */}
							<div className="grid grid-cols-2 gap-8 w-full max-w-sm pt-4">
								{/* Home goals */}
								<div className="flex flex-col items-center space-y-3">
									<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
										Home Goals
									</span>
									<div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 p-2 rounded-2xl">
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Decrease ${match.home_team?.name || 'home team'} goals`}
											className="h-10 w-10 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl"
											onClick={() =>
												setHomeScore((prev) => Math.max(0, prev - 1))
											}
										>
											<Minus className="h-4 w-4" />
										</Button>
										<span
											className="text-3xl font-black text-white w-12 text-center"
											aria-live="polite"
										>
											{homeScore}
										</span>
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Increase ${match.home_team?.name || 'home team'} goals`}
											className="h-10 w-10 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl"
											onClick={() => setHomeScore((prev) => prev + 1)}
										>
											<Plus className="h-4 w-4" />
										</Button>
									</div>
								</div>

								{/* Away goals */}
								<div className="flex flex-col items-center space-y-3">
									<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
										Away Goals
									</span>
									<div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 p-2 rounded-2xl">
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Decrease ${match.away_team?.name || 'away team'} goals`}
											className="h-10 w-10 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl"
											onClick={() =>
												setAwayScore((prev) => Math.max(0, prev - 1))
											}
										>
											<Minus className="h-4 w-4" />
										</Button>
										<span
											className="text-3xl font-black text-white w-12 text-center"
											aria-live="polite"
										>
											{awayScore}
										</span>
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Increase ${match.away_team?.name || 'away team'} goals`}
											className="h-10 w-10 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl"
											onClick={() => setAwayScore((prev) => prev + 1)}
										>
											<Plus className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>

							{/* Calculated Live Pick Badge */}
							<div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold text-sm shadow-md">
								<Trophy className="h-4 w-4 text-yellow-500" />
								<span>Prediction: {getOutcomeText()}</span>
							</div>
						</div>

						{/* Bottom Actions */}
						<div className="border-t border-white/5 pt-4">
							<Button
								className="w-full py-6 font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2 text-sm"
								onClick={handleSave}
								disabled={saveMutation.isPending}
							>
								{saveMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<>
										<Save className="h-4 w-4" />
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
