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
import { fetchUserPredictionsWithMatches } from '@/lib/queries/predictions';
import { createClient } from '@/lib/supabase/client';
import { PredictionWithMatch } from '@/types';
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
	const [predictionsWithMatches, setPredictionsWithMatches] = useState<
		PredictionWithMatch[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [fullName, setFullName] = useState('');
	const [username, setUsername] = useState('');
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
					setUsername(data.username || '');
				}

				const preds = await fetchUserPredictionsWithMatches(user.id);
				setPredictionsWithMatches(preds);
			}
			setLoading(false);
		};

		fetchProfile();
	}, [supabase]);

	const handleUpdateProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;

		setUpdating(true);
		setMsg(null);

		try {
			if (username.length < 3) {
				throw new Error('Username must be at least 3 characters long');
			}

			const { error } = await supabase
				.from('profiles')
				.update({
					full_name: fullName,
					username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
					updated_at: new Date().toISOString(),
				})
				.eq('id', user.id);

			if (error) {
				if (error.code === '23505') {
					throw new Error('Username is already taken');
				}
				throw error;
			}

			setProfile((prev: any) => ({ ...prev, full_name: fullName, username }));
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

	const exactCount = predictionsWithMatches.filter(
		(p) => p.points_earned === 3,
	).length;
	const correctCount = predictionsWithMatches.filter(
		(p) => p.points_earned >= 1,
	).length;

	const badges = [
		{
			id: 'b1',
			name: 'Genesis Predictor',
			description: 'Joined during Phase 1 launch',
			icon: '🌱',
			color:
				'from-emerald-500/10 to-emerald-500/20 text-emerald-400 border-emerald-500/20',
		},
		{
			id: 'b2',
			name: 'Exact Score Whisperer',
			description: `Predicted exact scores ${exactCount} times`,
			icon: '🎯',
			color:
				exactCount > 0
					? 'from-indigo-500/10 to-indigo-500/20 text-indigo-400 border-indigo-500/20'
					: 'from-slate-500/5 to-slate-500/10 text-slate-500 border-slate-500/10 opacity-50',
		},
		{
			id: 'b3',
			name: 'Outcome Wizard',
			description: `Guessed correct winner/draw ${correctCount} times`,
			icon: '🧙‍♂️',
			color:
				correctCount > 0
					? 'from-purple-500/10 to-purple-500/20 text-purple-400 border-purple-500/20'
					: 'from-slate-500/5 to-slate-500/10 text-slate-500 border-slate-500/10 opacity-50',
		},
		{
			id: 'b4',
			name: 'Points Champion',
			description: `Accumulated ${profile?.total_points || 0} global points`,
			icon: '👑',
			color:
				(profile?.total_points || 0) > 0
					? 'from-yellow-500/10 to-yellow-500/20 text-yellow-400 border-yellow-500/20'
					: 'from-slate-500/5 to-slate-500/10 text-slate-500 border-slate-500/10 opacity-50',
		},
	];

	const finishedPredictions = predictionsWithMatches
		.filter((p) => p.match?.status === 'finished')
		.slice(0, 5);

	const initials = (profile?.full_name || profile?.username || 'U')
		.substring(0, 2)
		.toUpperCase();

	return (
		<main className="min-h-screen px-4 py-8 md:px-12 max-w-5xl mx-auto space-y-8">
			{/* Decorative background effects */}
			<div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

			{/* HEADER ROW */}
			<div className="flex flex-col md:flex-row gap-6 items-center p-6 rounded-2xl glass-card border-white/10 relative overflow-hidden">
				<div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

				{/* Avatar block */}
				<Avatar className="h-24 w-24 border-2 border-white/10 shadow-2xl relative z-10">
					<AvatarImage src={profile?.avatar_url || ''} />
					<AvatarFallback className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-3xl">
						{initials}
					</AvatarFallback>
				</Avatar>

				{/* Name details */}
				<div className="flex-grow text-center md:text-left space-y-1.5 relative z-10">
					<h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
						{profile?.full_name || 'Kudo Predictor'}
					</h1>
					<p className="text-slate-400 font-medium text-sm">
						@{profile?.username || 'username'}
					</p>
					<div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-400 font-semibold pt-1">
						<span className="flex items-center gap-1">
							<Calendar className="h-3.5 w-3.5 text-indigo-400" />
							Member since {new Date(profile?.created_at).toLocaleDateString()}
						</span>
					</div>
				</div>

				{/* Global points counter block */}
				<div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 p-4 rounded-xl shadow-inner relative z-10">
					<Trophy className="h-8 w-8 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.2)]" />
					<div className="text-left">
						<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
							Total Points
						</span>
						<span className="text-3xl font-black text-white leading-none">
							{profile?.total_points ?? 0}
						</span>
					</div>
				</div>
			</div>

			{/* TWO COLUMN GRID DETAILS */}
			<div className="grid md:grid-cols-3 gap-8">
				{/* LEFT COLUMN: EDIT PROFILE */}
				<div className="md:col-span-1 space-y-6">
					<Card className="glass-card border-white/10 rounded-2xl">
						<CardHeader className="p-5 pb-3">
							<CardTitle className="text-lg font-bold text-white flex items-center justify-between">
								<span>Account Settings</span>
								{!isEditing && (
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 hover:bg-white/5"
										onClick={() => setIsEditing(true)}
									>
										<Edit2 className="h-4 w-4 text-slate-400" />
									</Button>
								)}
							</CardTitle>
							<CardDescription>
								Configure your predictor credentials
							</CardDescription>
						</CardHeader>
						<CardContent className="p-5 pt-0">
							{msg && (
								<div
									className={`p-3 rounded-lg flex items-start gap-2 text-xs font-semibold mb-4 border ${
										msg.type === 'success'
											? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
											: 'bg-destructive/10 text-destructive border-destructive/20'
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

							<form
								onSubmit={handleUpdateProfile}
								className="space-y-4"
							>
								<div className="space-y-1">
									<Label
										htmlFor="fullName"
										className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
									>
										Full Name
									</Label>
									<Input
										id="fullName"
										value={fullName}
										onChange={(e) => setFullName(e.target.value)}
										disabled={!isEditing || updating}
										className="bg-white/[0.02] border-white/10 text-white placeholder:text-muted-foreground/50 focus:border-white/30"
									/>
								</div>

								<div className="space-y-1">
									<Label
										htmlFor="username"
										className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
									>
										Username
									</Label>
									<Input
										id="username"
										value={username}
										onChange={(e) => setUsername(e.target.value)}
										disabled={!isEditing || updating}
										className="bg-white/[0.02] border-white/10 text-white placeholder:text-muted-foreground/50 focus:border-white/30"
									/>
								</div>

								{isEditing && (
									<div className="flex gap-2 pt-2">
										<Button
											type="submit"
											size="sm"
											className="flex-grow font-bold"
											disabled={updating}
										>
											{updating ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												'Save Changes'
											)}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="border-white/10"
											onClick={() => {
												setIsEditing(false);
												setFullName(profile?.full_name || '');
												setUsername(profile?.username || '');
												setMsg(null);
											}}
											disabled={updating}
										>
											Cancel
										</Button>
									</div>
								)}
							</form>
						</CardContent>
					</Card>

					{user && <NotificationSettings userId={user.id} />}
				</div>

				{/* RIGHT COLUMN: BADGES & ACCOMPLISHMENTS */}
				<div className="md:col-span-2 space-y-6">
					<Card className="glass-card border-white/10 rounded-2xl">
						<CardHeader className="p-6">
							<CardTitle className="text-lg font-bold text-white flex items-center gap-2">
								<Award className="h-5 w-5 text-indigo-400" />
								<span>My Earned Badges</span>
							</CardTitle>
							<CardDescription>
								Badges represent your milestones on the platform
							</CardDescription>
						</CardHeader>
						<CardContent className="p-6 pt-0">
							<div className="grid sm:grid-cols-2 gap-4">
								{badges.map((badge, idx) => (
									<motion.div
										key={badge.id}
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ delay: idx * 0.05 }}
										className={`p-4 rounded-xl border bg-gradient-to-br flex items-start gap-3.5 transition-all duration-300 hover:scale-[1.02] ${badge.color}`}
									>
										<span className="text-3xl">{badge.icon}</span>
										<div className="text-left space-y-1">
											<p className="font-extrabold text-sm text-white">
												{badge.name}
											</p>
											<p className="text-xs text-slate-300 font-medium leading-relaxed">
												{badge.description}
											</p>
										</div>
									</motion.div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* RECENT PREDICTIONS GRAPHIC SUMMARY */}
					<Card className="glass-card border-white/10 rounded-2xl">
						<CardHeader className="p-6">
							<CardTitle className="text-lg font-bold text-white flex items-center gap-2">
								<Flame className="h-5 w-5 text-indigo-400" />
								<span>Recent Activity</span>
							</CardTitle>
							<CardDescription>
								Your latest match prediction history
							</CardDescription>
						</CardHeader>
						<CardContent className="p-6 pt-0">
							{finishedPredictions.length === 0 ? (
								<div className="py-8 text-slate-500 font-medium text-sm flex flex-col items-center gap-3 text-center">
									<Zap className="h-8 w-8 text-indigo-500/40 animate-bounce" />
									<p>No processed predictions found in this round.</p>
									<p className="text-xs text-slate-600 max-w-xs">
										Once match predictions open, your active scores and
										calculations will display here.
									</p>
								</div>
							) : (
								<div className="space-y-4">
									{finishedPredictions.map((p) => {
										const match = p.match!;
										const homeTeam = match.home_team;
										const awayTeam = match.away_team;
										return (
											<div
												key={p.id}
												className="p-4 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between text-left gap-3 sm:gap-0"
											>
												<div className="flex items-center gap-3">
													<div className="flex items-center gap-1.5 min-w-[200px]">
														{homeTeam?.logo_url && (
															<img
																src={homeTeam.logo_url}
																alt={homeTeam.name}
																className="h-5 w-5 object-contain"
															/>
														)}
														<span className="text-xs font-black text-white truncate max-w-[80px]">
															{homeTeam?.short_name || homeTeam?.name}
														</span>
														<span className="text-[10px] font-bold text-slate-500">
															vs
														</span>
														<span className="text-xs font-black text-white truncate max-w-[80px]">
															{awayTeam?.short_name || awayTeam?.name}
														</span>
														{awayTeam?.logo_url && (
															<img
																src={awayTeam.logo_url}
																alt={awayTeam.name}
																className="h-5 w-5 object-contain"
															/>
														)}
													</div>
												</div>

												<div className="flex items-center justify-between sm:justify-end gap-6">
													<div className="text-xs">
														<span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">
															Final Score
														</span>
														<span className="font-extrabold text-white text-right block">
															{match.home_score} - {match.away_score}
														</span>
													</div>

													<div className="text-xs">
														<span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">
															Your Pick
														</span>
														<span className="font-extrabold text-slate-300 text-right block">
															{p.predicted_home_score} -{' '}
															{p.predicted_away_score}
														</span>
													</div>

													<div
														className={`px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-wider ${
															p.points_earned === 3
																? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
																: p.points_earned === 2
																	? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
																	: p.points_earned === 1
																		? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
																		: 'bg-slate-500/10 border-slate-500/20 text-slate-400'
														}`}
													>
														+{p.points_earned} PTS
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</main>
	);
}
