'use client';

import { Button } from '@/components/ui/button';
import { calculatePredictionPoints, SCORING_RULES } from '@/lib/utils/scoring';
import { motion } from 'framer-motion';
import { BookOpen, Calculator, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

interface ScoringRulesModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function ScoringRulesModal({ isOpen, onClose }: ScoringRulesModalProps) {
	// Interactive Sandbox State
	const [sandboxPredHome, setSandboxPredHome] = useState<number>(2);
	const [sandboxPredAway, setSandboxPredAway] = useState<number>(1);
	const [sandboxActualHome, setSandboxActualHome] = useState<number>(2);
	const [sandboxActualAway, setSandboxActualAway] = useState<number>(1);

	if (!isOpen) return null;

	const testPoints = calculatePredictionPoints(
		sandboxPredHome,
		sandboxPredAway,
		sandboxActualHome,
		sandboxActualAway,
	);

	const getOutcomeTag = (home: number, away: number) => {
		if (home > away) return 'Home Win';
		if (away > home) return 'Away Win';
		return 'Draw';
	};

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
				className="relative w-full max-w-xl overflow-hidden rounded-2xl glass-card border border-white/10 p-6 shadow-2xl z-10 text-white max-h-[90vh] overflow-y-auto"
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
						<BookOpen className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-xl font-extrabold tracking-tight">
							Official Scoring Rules
						</h3>
						<p className="text-xs text-slate-400">
							How points are calculated in all KudoMatch prediction pools
						</p>
					</div>
				</div>

				{/* 4 SCORING RULE CARDS */}
				<div className="grid sm:grid-cols-2 gap-3 mb-6">
					{SCORING_RULES.map((rule) => (
						<div
							key={rule.points}
							className={`p-4 rounded-xl border ${rule.borderColor} bg-gradient-to-br ${rule.bgGradient} flex flex-col justify-between space-y-2`}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<span className="text-xl">{rule.icon}</span>
									<span className={`text-sm font-black ${rule.color}`}>
										{rule.title}
									</span>
								</div>
								<span
									className={`px-2 py-0.5 rounded-full text-xs font-black bg-black/40 border ${rule.borderColor} ${rule.color}`}
								>
									+{rule.badge}
								</span>
							</div>
							<p className="text-xs text-slate-300 leading-relaxed">
								{rule.description}
							</p>
							<div className="text-[10px] text-slate-400 bg-black/30 p-2 rounded-lg border border-white/5">
								<span className="font-bold text-slate-300">Ex:</span> Pick:{' '}
								<b className="text-white">{rule.example.predicted}</b> | Final:{' '}
								<b className="text-white">{rule.example.actual}</b>
							</div>
						</div>
					))}
				</div>

				{/* INTERACTIVE TEST CALCULATOR SANDBOX */}
				<div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
					<div className="flex items-center justify-between">
						<h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
							<Calculator className="h-4 w-4" />
							<span>Interactive Scoring Sandbox</span>
						</h4>
						<span className="text-[10px] text-slate-500 font-bold">
							Try adjusting scores below
						</span>
					</div>

					<div className="grid sm:grid-cols-2 gap-4">
						{/* Your Prediction Stepper */}
						<div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-2 text-center">
							<p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
								Predicted Score (
								{getOutcomeTag(sandboxPredHome, sandboxPredAway)})
							</p>
							<div className="flex items-center justify-center gap-3">
								<div className="flex items-center gap-1">
									<button
										onClick={() =>
											setSandboxPredHome(Math.max(0, sandboxPredHome - 1))
										}
										className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold"
									>
										-
									</button>
									<span className="text-lg font-black w-6">
										{sandboxPredHome}
									</span>
									<button
										onClick={() => setSandboxPredHome(sandboxPredHome + 1)}
										className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold"
									>
										+
									</button>
								</div>
								<span className="text-slate-500 font-bold">:</span>
								<div className="flex items-center gap-1">
									<button
										onClick={() =>
											setSandboxPredAway(Math.max(0, sandboxPredAway - 1))
										}
										className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold"
									>
										-
									</button>
									<span className="text-lg font-black w-6">
										{sandboxPredAway}
									</span>
									<button
										onClick={() => setSandboxPredAway(sandboxPredAway + 1)}
										className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold"
									>
										+
									</button>
								</div>
							</div>
						</div>

						{/* Actual Score Stepper */}
						<div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-2 text-center">
							<p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
								Actual Result (
								{getOutcomeTag(sandboxActualHome, sandboxActualAway)})
							</p>
							<div className="flex items-center justify-center gap-3">
								<div className="flex items-center gap-1">
									<button
										onClick={() =>
											setSandboxActualHome(Math.max(0, sandboxActualHome - 1))
										}
										className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold"
									>
										-
									</button>
									<span className="text-lg font-black w-6">
										{sandboxActualHome}
									</span>
									<button
										onClick={() => setSandboxActualHome(sandboxActualHome + 1)}
										className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold"
									>
										+
									</button>
								</div>
								<span className="text-slate-500 font-bold">:</span>
								<div className="flex items-center gap-1">
									<button
										onClick={() =>
											setSandboxActualAway(Math.max(0, sandboxActualAway - 1))
										}
										className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold"
									>
										-
									</button>
									<span className="text-lg font-black w-6">
										{sandboxActualAway}
									</span>
									<button
										onClick={() => setSandboxActualAway(sandboxActualAway + 1)}
										className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold"
									>
										+
									</button>
								</div>
							</div>
						</div>
					</div>

					{/* Result calculation indicator */}
					<div
						className={`p-3 rounded-xl border flex items-center justify-between ${
							testPoints === 3
								? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
								: testPoints === 2
									? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
									: testPoints === 1
										? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
										: 'bg-slate-500/10 border-slate-500/20 text-slate-400'
						}`}
					>
						<div className="flex items-center gap-2">
							<Sparkles className="h-4 w-4" />
							<span className="text-xs font-extrabold">
								{testPoints === 3
									? 'Exact Score Hit!'
									: testPoints === 2
										? 'Outcome & Goal Difference Match'
										: testPoints === 1
											? 'Correct Match Winner Only'
											: 'Incorrect Outcome'}
							</span>
						</div>
						<div className="px-3 py-1 rounded-lg bg-black/40 font-black text-sm">
							+{testPoints} PTS
						</div>
					</div>
				</div>

				<div className="mt-6 flex justify-end">
					<Button
						onClick={onClose}
						className="w-full py-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
					>
						Got It
					</Button>
				</div>
			</motion.div>
		</div>
	);
}
