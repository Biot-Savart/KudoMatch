'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { joinPoolByCode } from '@/lib/queries/pools';
import { motion } from 'framer-motion';
import { KeyRound, X } from 'lucide-react';
import { useState } from 'react';

interface JoinPoolModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (poolId: string) => void;
}

export function JoinPoolModal({
	isOpen,
	onClose,
	onSuccess,
}: JoinPoolModalProps) {
	const [code, setCode] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const cleanCode = code.trim().toUpperCase();

		if (cleanCode.length !== 6) {
			setError('Invite code must be exactly 6 characters.');
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const res = await joinPoolByCode(cleanCode);

			if (res.success && res.pool_id) {
				onSuccess(res.pool_id);
			} else {
				setError(res.error || 'Invalid invite code or joining failed.');
			}
		} catch (err: any) {
			setError(err.message || 'An unexpected error occurred.');
		} finally {
			setLoading(false);
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
		if (val.length <= 6) {
			setCode(val);
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
				className="relative w-full max-w-sm overflow-hidden rounded-2xl glass-card border border-white/10 p-6 shadow-2xl z-10 text-white text-center"
			>
				{/* Close Button */}
				<button
					onClick={onClose}
					className="absolute top-4 right-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
				>
					<X className="h-5 w-5" />
				</button>

				{/* Header */}
				<div className="flex flex-col items-center mb-6">
					<div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 shadow-md mb-3">
						<KeyRound className="h-6 w-6 text-white animate-pulse" />
					</div>
					<h3 className="text-lg font-bold tracking-tight">
						Join Prediction Pool
					</h3>
					<p className="text-xs text-slate-400 mt-1">
						Enter a 6-character private invite code
					</p>
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

					<div className="space-y-2">
						<Label
							htmlFor="pool-code"
							className="sr-only"
						>
							Invite Code
						</Label>
						<Input
							id="pool-code"
							placeholder="CODE12"
							value={code}
							onChange={handleInputChange}
							disabled={loading}
							className="text-center text-2xl font-black tracking-[0.4em] uppercase py-6 bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl"
							required
							maxLength={6}
							autoComplete="off"
						/>
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
							disabled={loading || code.length !== 6}
							className="flex-1 py-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading ? 'Joining...' : 'Join Pool'}
						</Button>
					</div>
				</form>
			</motion.div>
		</div>
	);
}
