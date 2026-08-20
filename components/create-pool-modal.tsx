'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPool } from '@/lib/queries/pools';
import { motion } from 'framer-motion';
import { Lock, Trophy, Unlock, X } from 'lucide-react';
import { useState } from 'react';

interface CreatePoolModalProps {
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
	const [description, setDescription] = useState('');
	const [isPublic, setIsPublic] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim().length < 3) {
			setError('Pool name must be at least 3 characters.');
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const pool = await createPool(
				userId,
				name.trim(),
				description.trim() || null,
				isPublic,
			);

			if (pool) {
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
				className="relative w-full max-w-md overflow-hidden rounded-2xl glass-card border border-white/10 p-6 shadow-2xl z-10 text-white"
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
							Compete with friends or co-workers
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
							placeholder="e.g., Office Derby Rivals"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={loading}
							className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 rounded-xl"
							required
							maxLength={60}
						/>
					</div>

					<div className="space-y-1.5">
						<Label
							htmlFor="pool-desc"
							className="text-xs text-slate-300 font-semibold uppercase tracking-wider"
						>
							Description (Optional)
						</Label>
						<Input
							id="pool-desc"
							placeholder="e.g., Premier League 2026 Season Bragging Rights"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={loading}
							className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 rounded-xl"
						/>
					</div>

					{/* Visibility toggle */}
					<div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
						<div className="flex items-center gap-3">
							{isPublic ? (
								<Unlock className="h-5 w-5 text-emerald-400" />
							) : (
								<Lock className="h-5 w-5 text-indigo-400" />
							)}
							<div className="text-left">
								<p className="text-sm font-bold">
									{isPublic ? 'Public Pool' : 'Private Pool'}
								</p>
								<p className="text-[10px] text-slate-400">
									{isPublic
										? 'Anyone can find and join this pool'
										: 'Requires unique 6-character code to join'}
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setIsPublic(!isPublic)}
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition duration-300 focus:outline-none ${
								isPublic ? 'bg-emerald-500' : 'bg-slate-700'
							}`}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-300 ${
									isPublic ? 'translate-x-6' : 'translate-x-1'
								}`}
							/>
						</button>
					</div>

					<div className="flex gap-2 pt-2">
						<Button
							type="button"
							variant="ghost"
							onClick={onClose}
							disabled={loading}
							className="flex-1 py-5 rounded-xl text-slate-300 hover:bg-white/5"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={loading}
							className="flex-1 py-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
						>
							{loading ? 'Creating...' : 'Create Pool'}
						</Button>
					</div>
				</form>
			</motion.div>
		</div>
	);
}
