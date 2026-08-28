'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPool } from '@/lib/queries/pools';
import { PoolScopeKind, PoolScoringMode } from '@/types';
import { motion } from 'framer-motion';
import { Globe, Lock, Trophy, X } from 'lucide-react';
import { useState } from 'react';

export interface CreatePoolModalProps {
	userId: string;
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (poolId: string) => void;
}

export function CreatePoolModal({
	userId,
	isOpen,
	onClose,
	onSuccess,
}: CreatePoolModalProps) {
	const [name, setName] = useState('');
	const [scopeKind, setScopeKind] = useState<PoolScopeKind>('sport');
	const [sportSlug, setSportSlug] = useState<string>('football');
	const [scoringMode, setScoringMode] = useState<PoolScoringMode>('raw');
	const [isPrivate, setIsPrivate] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!isOpen) return null;

	const handleScopeChange = (scope: PoolScopeKind) => {
		setScopeKind(scope);
		if (scope === 'all_sports') {
			setScoringMode('normalized');
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim().length < 3) {
			setError('Pool name must be at least 3 characters.');
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const pool = await createPool({
				name: name.trim(),
				created_by: userId,
				scope_kind: scopeKind,
				sport_slug: scopeKind === 'all_sports' ? null : sportSlug,
				scoring_mode: scopeKind === 'all_sports' ? 'normalized' : scoringMode,
				is_private: isPrivate,
			});

			if (pool?.id) {
				onSuccess(pool.id);
			} else {
				setError('Failed to create pool. Please try again.');
			}
		} catch (err: any) {
			setError(err.message || 'An unexpected error occurred.');
		} finally {
			setLoading(false);
		}
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
				initial={{ opacity: 0, scale: 0.95, y: 20 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: 20 }}
				className="relative w-full max-w-md overflow-hidden rounded-2xl glass-card border border-white/10 p-6 shadow-2xl z-10 text-white max-h-[90vh] overflow-y-auto"
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
					<div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md">
						<Trophy className="h-5 w-5 text-white animate-pulse" />
					</div>
					<div>
						<h3 className="text-lg font-bold tracking-tight">
							Create Prediction Pool
						</h3>
						<p className="text-xs text-slate-400">
							Compete with friends across sports or specific leagues
						</p>
					</div>
				</div>

				{/* Form */}
				<form
					onSubmit={handleSubmit}
					className="space-y-4"
				>
					{error && (
						<div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
							{error}
						</div>
					)}

					<div className="space-y-1.5">
						<Label
							htmlFor="pool-name"
							className="text-xs text-slate-300 font-semibold uppercase tracking-wider"
						>
							Pool Name
						</Label>
						<Input
							id="pool-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Champions League Lounge"
							required
							className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500"
						/>
					</div>

					{/* Scope Selector */}
					<div className="space-y-1.5">
						<Label className="text-xs text-slate-300 font-semibold uppercase tracking-wider">
							Pool Scope
						</Label>
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => handleScopeChange('sport')}
								className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
									scopeKind === 'sport'
										? 'bg-indigo-600/20 border-indigo-500 text-white'
										: 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
								}`}
							>
								<span className="text-xs font-bold">⚽ Single Sport</span>
								<span className="text-[10px] opacity-70">
									Target specific sport (e.g. Football)
								</span>
							</button>

							<button
								type="button"
								onClick={() => handleScopeChange('all_sports')}
								className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
									scopeKind === 'all_sports'
										? 'bg-indigo-600/20 border-indigo-500 text-white'
										: 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
								}`}
							>
								<span className="text-xs font-bold">🌐 All Sports</span>
								<span className="text-[10px] opacity-70">
									Multi-sport normalized leaderboard
								</span>
							</button>
						</div>
					</div>

					{/* Sport Selection if scope is sport */}
					{scopeKind === 'sport' && (
						<div className="space-y-1.5">
							<Label className="text-xs text-slate-300 font-semibold uppercase tracking-wider">
								Sport
							</Label>
							<select
								value={sportSlug}
								onChange={(e) => setSportSlug(e.target.value)}
								className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
							>
								<option value="football">Football (Soccer)</option>
								<option value="rugby_union">Rugby Union</option>
							</select>
						</div>
					)}

					{/* Scoring Mode if single sport */}
					{scopeKind !== 'all_sports' && (
						<div className="space-y-1.5">
							<Label className="text-xs text-slate-300 font-semibold uppercase tracking-wider">
								Scoring Format
							</Label>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setScoringMode('raw')}
									className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
										scoringMode === 'raw'
											? 'bg-indigo-600 border-indigo-500 text-white'
											: 'bg-white/5 border-white/10 text-slate-400'
									}`}
								>
									Standard Raw Points (0-3 pts)
								</button>
								<button
									type="button"
									onClick={() => setScoringMode('normalized')}
									className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
										scoringMode === 'normalized'
											? 'bg-indigo-600 border-indigo-500 text-white'
											: 'bg-white/5 border-white/10 text-slate-400'
									}`}
								>
									Normalized (10,000 basis pts)
								</button>
							</div>
						</div>
					)}

					{/* Privacy Setting */}
					<div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
						<div className="flex items-center gap-2.5">
							{isPrivate ? (
								<Lock className="h-4 w-4 text-amber-400" />
							) : (
								<Globe className="h-4 w-4 text-indigo-400" />
							)}
							<div>
								<div className="text-xs font-bold text-slate-200">
									{isPrivate ? 'Private Pool' : 'Public Pool'}
								</div>
								<div className="text-[10px] text-slate-400">
									{isPrivate
										? 'Invite code required to join'
										: 'Visible on discovery directory'}
								</div>
							</div>
						</div>

						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setIsPrivate(!isPrivate)}
							className="text-xs border-white/10 hover:bg-white/10 text-slate-300"
						>
							Switch to {isPrivate ? 'Public' : 'Private'}
						</Button>
					</div>

					{/* Actions */}
					<div className="pt-4 flex gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							className="w-1/2 border-white/10 hover:bg-white/5 text-slate-300"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={loading}
							className="w-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold"
						>
							{loading ? 'Creating...' : 'Create Pool'}
						</Button>
					</div>
				</form>
			</motion.div>
		</div>
	);
}

export default CreatePoolModal;
