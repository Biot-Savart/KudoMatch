'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Loader2, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ResetPasswordPage() {
	const [email, setEmail] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const [isRecoveryMode, setIsRecoveryMode] = useState(false);

	const router = useRouter();
	const supabase = createClient();

	// Detect recovery mode if session has recovery code or if user is logged in
	useEffect(() => {
		const checkSession = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (session) {
				setIsRecoveryMode(true);
			}
		};
		checkSession();
	}, [supabase]);

	const handleRequestReset = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setErrorMsg(null);
		setSuccessMsg(null);

		try {
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
			});
			if (error) throw error;
			setSuccessMsg('Check your email for the password recovery link!');
		} catch (err: any) {
			setErrorMsg(err.message || 'Could not send reset password email.');
		} finally {
			setLoading(false);
		}
	};

	const handleUpdatePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setErrorMsg(null);
		setSuccessMsg(null);

		try {
			if (newPassword.length < 6) {
				throw new Error('Password must be at least 6 characters long');
			}

			const { error } = await supabase.auth.updateUser({
				password: newPassword,
			});
			if (error) throw error;

			setSuccessMsg('Password updated successfully! Redirecting you...');
			setTimeout(() => {
				router.push('/');
			}, 2000);
		} catch (err: any) {
			setErrorMsg(err.message || 'Could not update your password.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#030712] overflow-hidden">
			{/* Decorative background gradients */}
			<div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
			<div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

			{/* Mesh grid pattern */}
			<div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

			<div className="relative z-10 flex flex-col items-center gap-2 mb-2">
				<h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
					KudoMatch
				</h1>
				<p className="text-sm font-semibold tracking-wider text-indigo-400/80 uppercase">
					PredictorPro Platform
				</p>
			</div>

			<motion.div
				initial={{ opacity: 0, y: 15 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, ease: 'easeOut' }}
				className="w-full max-w-md p-4 relative z-10"
			>
				<Card className="glass-card shadow-2xl relative overflow-hidden border-white/10 text-card-foreground">
					<CardHeader className="space-y-1 text-center">
						<CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
							{isRecoveryMode ? 'New Password' : 'Reset Password'}
						</CardTitle>
						<CardDescription className="text-muted-foreground/80">
							{isRecoveryMode
								? 'Enter your new password below'
								: 'We will send you a recovery link to reset your password'}
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-4">
						<form
							onSubmit={
								isRecoveryMode ? handleUpdatePassword : handleRequestReset
							}
							className="space-y-3"
						>
							{errorMsg && (
								<motion.div
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: 'auto' }}
									className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium"
								>
									<AlertCircle className="h-4 w-4 shrink-0" />
									<span>{errorMsg}</span>
								</motion.div>
							)}

							{successMsg && (
								<motion.div
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: 'auto' }}
									className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20 font-medium"
								>
									<CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
									<span>{successMsg}</span>
								</motion.div>
							)}

							{!isRecoveryMode ? (
								<div className="space-y-1">
									<Label
										htmlFor="email"
										className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
									>
										Email Address
									</Label>
									<div className="relative">
										<Input
											id="email"
											type="email"
											required
											placeholder="name@example.com"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											className="pl-9 bg-white/[0.02] border-white/10 focus:border-white/30 text-white placeholder:text-muted-foreground/50"
											disabled={loading}
										/>
										<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground/50">
											<Mail className="h-4 w-4" />
										</div>
									</div>
								</div>
							) : (
								<div className="space-y-1">
									<Label
										htmlFor="password"
										className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
									>
										New Password
									</Label>
									<div className="relative">
										<Input
											id="password"
											type="password"
											required
											placeholder="••••••••"
											value={newPassword}
											onChange={(e) => setNewPassword(e.target.value)}
											className="pl-9 bg-white/[0.02] border-white/10 focus:border-white/30 text-white placeholder:text-muted-foreground/50"
											disabled={loading}
										/>
										<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground/50">
											<Lock className="h-4 w-4" />
										</div>
									</div>
								</div>
							)}

							<Button
								type="submit"
								className="w-full mt-4 py-5 font-semibold text-sm transition-all duration-200"
								disabled={loading}
							>
								{loading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : isRecoveryMode ? (
									'Update Password'
								) : (
									'Send Recovery Link'
								)}
							</Button>
						</form>
					</CardContent>

					<CardFooter className="flex justify-center text-sm border-t border-white/5 pt-4 bg-black/10">
						<span className="text-muted-foreground">
							Remembered your password?{' '}
							<Link
								href="/login"
								className="font-bold text-primary hover:underline"
							>
								Sign in
							</Link>
						</span>
					</CardFooter>
				</Card>
			</motion.div>
		</main>
	);
}
