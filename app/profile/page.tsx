'use client';

import { NotificationSettings } from '@/components/notification-settings';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchUserPredictions } from '@/lib/queries/predictions';
import { fetchUserScoreSummary, scoringQueryKeys } from '@/lib/queries/scoring';
import { createClient } from '@/lib/supabase/client';
import { MarketPrediction, UserScoreSummary } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
	AlertCircle,
	Award,
	Calendar,
	Check,
	Edit2,
	Flame,
	Loader2,
	Trophy,
	Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
	const supabase = createClient();
	const [user, setUser] = useState<any>(null);
	const [profile, setProfile] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [fullName, setFullName] = useState('');
	const [msg, setMsg] = useState<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);

	useEffect(() => {
		const fetchProfile = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setUser(user);
			if (user) {
				const { data } = await supabase
					.from('profiles')
					.select('*')
					.eq('id', user.id)
					.single();

				if (data) {
					setProfile(data);
					setFullName(data.full_name || '');
				}
			}
			setLoading(false);
		};

		fetchProfile();
	}, [supabase]);

	// Fetch dynamic score summary
	const { data: scoreSummary } = useQuery<UserScoreSummary>({
		queryKey: user?.id
			? scoringQueryKeys.userSummary(user.id)
			: ['scoring', 'summary', 'anon'],
		queryFn: () =>
			user?.id
				? fetchUserScoreSummary(user.id)
				: Promise.resolve({
						total_raw_points: 0,
						total_normalized_points: 0,
						total_predictions: 0,
						settled_predictions: 0,
						exact_count: 0,
						margin_count: 0,
						outcome_count: 0,
						miss_count: 0,
						win_rate: 0,
					}),
		enabled: !!user?.id,
	});

	// Fetch user predictions
	const { data: predictions = [] } = useQuery<MarketPrediction[]>({
		queryKey: ['predictions', 'user', user?.id],
		queryFn: () =>
			user?.id ? fetchUserPredictions(user.id) : Promise.resolve([]),
		enabled: !!user?.id,
	});

	const handleUpdateProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;

		setUpdating(true);
		setMsg(null);

		try {
			const { error } = await supabase
				.from('profiles')
				.update({
					full_name: fullName,
					updated_at: new Date().toISOString(),
				})
				.eq('id', user.id);

			if (error) throw error;

			setProfile((prev: any) => ({ ...prev, full_name: fullName }));
			setIsEditing(false);
			setMsg({ type: 'success', text: 'Profile updated successfully!' });
		} catch (err: any) {
			setMsg({ type: 'error', text: err.message || 'An error occurred.' });
		} finally {
			setUpdating(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-[80vh] w-full flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
				<Card className="glass-card max-w-md w-full text-center p-6 border-white/10">
					<CardHeader>
						<CardTitle className="text-xl font-bold text-white">
							Sign In Required
						</CardTitle>
						<CardDescription className="text-slate-400">
							Please sign in to view your profile and predictions.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
							asChild
						>
							<a href="/login">Go to Login</a>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const totalPoints = scoreSummary?.total_raw_points ?? 0;
	const exactHits = scoreSummary?.exact_count ?? 0;
	const marginHits = scoreSummary?.margin_count ?? 0;
	const outcomeHits = scoreSummary?.outcome_count ?? 0;
	const winRate = scoreSummary?.win_rate ?? 0;

	return (
		<div className="max-w-5xl mx-auto px-4 py-8 space-y-8 pt-20">
			{/* Profile Header Card */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 relative overflow-hidden bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/40 shadow-2xl"
			>
				<div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
					<Avatar className="h-24 w-24 border-2 border-indigo-500/40 shadow-2xl shadow-indigo-500/20">
						<AvatarImage src={profile?.avatar_url || ''} />
						<AvatarFallback className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-2xl font-black">
							{(profile?.full_name || user.email || 'U')
								.substring(0, 2)
								.toUpperCase()}
						</AvatarFallback>
					</Avatar>

					<div className="flex-1 text-center sm:text-left space-y-2">
						<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
							<h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
								{profile?.full_name || 'Kudo Predictor'}
							</h1>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-xs self-center sm:self-auto">
								<Trophy className="h-3.5 w-3.5 text-amber-400" />
								{totalPoints} Total Points
							</span>
						</div>
						<p className="text-xs text-slate-400 font-medium">{user.email}</p>
					</div>

					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsEditing(!isEditing)}
						className="border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold gap-1.5 rounded-xl self-center sm:self-start"
					>
						<Edit2 className="h-3.5 w-3.5" />
						{isEditing ? 'Cancel Edit' : 'Edit Profile'}
					</Button>
				</div>

				{/* Edit Form Drawer / Toggle */}
				{isEditing && (
					<motion.form
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						onSubmit={handleUpdateProfile}
						className="mt-6 pt-6 border-t border-white/10 space-y-4 max-w-md"
					>
						<div className="space-y-1.5">
							<Label
								htmlFor="fullName"
								className="text-xs text-slate-300 font-bold"
							>
								Display Name
							</Label>
							<Input
								id="fullName"
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								placeholder="Your Name"
								className="bg-slate-900/60 border-white/10 text-white placeholder:text-slate-500 text-xs"
							/>
						</div>

						<div className="flex gap-2">
							<Button
								type="submit"
								disabled={updating}
								size="sm"
								className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl"
							>
								{updating ? 'Saving...' : 'Save Profile'}
							</Button>
						</div>
					</motion.form>
				)}

				{msg && (
					<div
						className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
							msg.type === 'success'
								? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
								: 'bg-red-500/10 text-red-400 border border-red-500/20'
						}`}
					>
						{msg.type === 'success' ? (
							<Check className="h-4 w-4 shrink-0" />
						) : (
							<AlertCircle className="h-4 w-4 shrink-0" />
						)}
						<span>{msg.text}</span>
					</div>
				)}
			</motion.div>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
				<div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-slate-400">
							Total Points
						</span>
						<Trophy className="h-4 w-4 text-amber-400" />
					</div>
					<div className="mt-2 flex items-baseline gap-1">
						<span className="text-2xl sm:text-3xl font-black text-white">
							{totalPoints}
						</span>
						<span className="text-xs text-slate-500">pts</span>
					</div>
				</div>

				<div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-emerald-400">
							Exact Calls
						</span>
						<Zap className="h-4 w-4 text-emerald-400" />
					</div>
					<div className="mt-2 flex items-baseline gap-1">
						<span className="text-2xl sm:text-3xl font-black text-emerald-300">
							{exactHits}
						</span>
						<span className="text-xs text-emerald-400/60">exact (3pts)</span>
					</div>
				</div>

				<div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-teal-400">
							Margin / Outcome
						</span>
						<Award className="h-4 w-4 text-teal-400" />
					</div>
					<div className="mt-2 flex items-baseline gap-1">
						<span className="text-2xl sm:text-3xl font-black text-teal-300">
							{marginHits + outcomeHits}
						</span>
						<span className="text-xs text-teal-400/60">matches</span>
					</div>
				</div>

				<div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-indigo-400">Win Rate</span>
						<Flame className="h-4 w-4 text-indigo-400" />
					</div>
					<div className="mt-2 flex items-baseline gap-1">
						<span className="text-2xl sm:text-3xl font-black text-indigo-300">
							{winRate}%
						</span>
						<span className="text-xs text-indigo-400/60">accuracy</span>
					</div>
				</div>
			</div>

			{/* Notification Settings Panel */}
			<div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10">
				<NotificationSettings userId={user.id} />
			</div>

			{/* Prediction History */}
			<div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="font-extrabold text-lg text-white flex items-center gap-2">
						<Calendar className="h-5 w-5 text-indigo-400" />
						<span>Prediction History</span>
					</h3>
					<span className="text-xs text-slate-400">
						{predictions.length} Total Predictions
					</span>
				</div>

				{predictions.length === 0 ? (
					<div className="text-center py-12 text-slate-500 text-xs">
						No predictions submitted yet. Head to the Predict tab to make your
						first pick!
					</div>
				) : (
					<div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
						{predictions.map((p) => {
							const sel = p.selection as
								| { home: number; away: number }
								| undefined;
							return (
								<div
									key={p.id}
									className="py-3 flex items-center justify-between text-xs"
								>
									<div className="space-y-0.5">
										<span className="font-bold text-slate-200 block">
											Market #{p.event_market_id}
										</span>
										<span className="text-[10px] text-slate-500">
											{new Date(p.created_at || Date.now()).toLocaleDateString(
												undefined,
												{
													month: 'short',
													day: 'numeric',
													hour: '2-digit',
													minute: '2-digit',
												},
											)}
										</span>
									</div>

									<div className="flex items-center gap-3">
										<span className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
											{sel ? `${sel.home} - ${sel.away}` : '—'}
										</span>
										<span className="font-black text-amber-400 w-16 text-right">
											{p.raw_points !== null
												? `+${p.raw_points} PTS`
												: 'Pending'}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
