'use client';

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
import { createClient } from '@/lib/supabase/client';
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

// Mock Badges for visual completeness
const mockBadges = [
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
		name: '5-match win streak',
		description: 'Got 5 correct outcomes in a row',
		icon: '🔥',
		color:
			'from-orange-500/10 to-orange-500/20 text-orange-400 border-orange-500/20',
	},
	{
		id: 'b3',
		name: 'First Grand Slam',
		description: 'Guessed all outcomes in Matchweek 12',
		icon: '👑',
		color:
			'from-yellow-500/10 to-yellow-500/20 text-yellow-400 border-yellow-500/20',
	},
	{
		id: 'b4',
		name: 'Exact Score Whisperer',
		description: 'Predicted exact scores 3 times',
		icon: '🎯',
		color:
			'from-indigo-500/10 to-indigo-500/20 text-indigo-400 border-indigo-500/20',
	},
];

export default function ProfilePage() {
	const supabase = createClient();
	const [user, setUser] = useState<any>(null);
	const [profile, setProfile] = useState<any>(null);
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
								{mockBadges.map((badge, idx) => (
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
						<CardContent className="p-6 pt-0 text-center">
							<div className="py-8 text-slate-500 font-medium text-sm flex flex-col items-center gap-3">
								<Zap className="h-8 w-8 text-indigo-500/40 animate-bounce" />
								<p>No processed predictions found in this round.</p>
								<p className="text-xs text-slate-600 max-w-xs">
									Once match predictions open, your active scores and
									calculations will display here.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</main>
	);
}
