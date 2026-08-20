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
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface AuthCardProps {
	mode: 'login' | 'signup';
}

export function AuthCard({ mode }: AuthCardProps) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [fullName, setFullName] = useState('');
	const [loading, setLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const router = useRouter();
	const supabase = createClient();

	const handleOAuthLogin = async () => {
		try {
			setLoading(true);
			setErrorMsg(null);
			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: `${window.location.origin}/auth/callback`,
				},
			});
			if (error) throw error;
		} catch (err: any) {
			setErrorMsg(err.message || 'An error occurred during Google sign-in.');
			setLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setErrorMsg(null);
		setSuccessMsg(null);

		try {
			if (mode === 'signup') {
				if (!fullName.trim()) {
					throw new Error('Full name is required');
				}

				const { error, data } = await supabase.auth.signUp({
					email,
					password,
					options: {
						data: {
							full_name: fullName,
						},
						emailRedirectTo: `${window.location.origin}/auth/callback`,
					},
				});

				if (error) throw error;

				if (data.session) {
					router.push('/');
					router.refresh();
				} else {
					setSuccessMsg(
						'Check your email for the confirmation link to complete registration!',
					);
				}
			} else {
				const { error } = await supabase.auth.signInWithPassword({
					email,
					password,
				});

				if (error) throw error;

				router.push('/');
				router.refresh();
			}
		} catch (err: any) {
			setErrorMsg(err.message || 'An authentication error occurred.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 15 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: 'easeOut' }}
			className="w-full max-w-md p-4"
		>
			<Card className="glass-card shadow-2xl relative overflow-hidden border-white/10 text-card-foreground">
				<div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
				<div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

				<CardHeader className="space-y-1 text-center relative z-10">
					<CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
						{mode === 'login' ? 'Welcome Back' : 'Create Account'}
					</CardTitle>
					<CardDescription className="text-muted-foreground/80">
						{mode === 'login'
							? 'Enter your credentials to access your predictions'
							: 'Sign up to start predicting matches and dominate your pools'}
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4 relative z-10">
					<Button
						variant="glass"
						className="w-full justify-center gap-2 py-5 font-semibold text-sm border-white/10 hover:border-white/20 hover:bg-white/5 active:bg-white/10 transition-all duration-200"
						onClick={handleOAuthLogin}
						disabled={loading}
					>
						<svg
							className="h-4 w-4 mr-1"
							viewBox="0 0 24 24"
						>
							<path
								fill="#EA4335"
								d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.125C18.29 1.15 15.445 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.89 11.57-11.79 0-.79-.085-1.4-.19-1.925H12.24z"
							/>
						</svg>
						Continue with Google
					</Button>

					<div className="relative flex py-2 items-center">
						<div className="flex-grow border-t border-white/10"></div>
						<span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase font-bold tracking-widest">
							Or with email
						</span>
						<div className="flex-grow border-t border-white/10"></div>
					</div>

					<form
						onSubmit={handleSubmit}
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
								<AlertCircle className="h-4 w-4 shrink-0" />
								<span>{successMsg}</span>
							</motion.div>
						)}

						{mode === 'signup' && (
							<div className="space-y-1">
								<Label
									htmlFor="fullName"
									className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
								>
									Full Name
								</Label>
								<div className="relative">
									<Input
										id="fullName"
										type="text"
										required
										placeholder="John Doe"
										value={fullName}
										onChange={(e) => setFullName(e.target.value)}
										className="pl-9 bg-white/[0.02] border-white/10 focus:border-white/30 text-white placeholder:text-muted-foreground/50"
										disabled={loading}
									/>
									<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground/50">
										<span className="text-xs font-bold font-sans">#</span>
									</div>
								</div>
							</div>
						)}

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

						<div className="space-y-1">
							<div className="flex items-center justify-between">
								<Label
									htmlFor="password"
									className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
								>
									Password
								</Label>
								{mode === 'login' && (
									<Link
										href="/reset-password"
										className="text-xs font-semibold text-primary/80 hover:text-primary hover:underline"
									>
										Forgot password?
									</Link>
								)}
							</div>
							<div className="relative">
								<Input
									id="password"
									type="password"
									required
									placeholder="••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="pl-9 bg-white/[0.02] border-white/10 focus:border-white/30 text-white placeholder:text-muted-foreground/50"
									disabled={loading}
								/>
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground/50">
									<Lock className="h-4 w-4" />
								</div>
							</div>
						</div>

						<Button
							type="submit"
							className="w-full mt-4 py-5 font-semibold text-sm transition-all duration-200"
							disabled={loading}
						>
							{loading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : mode === 'login' ? (
								'Sign In'
							) : (
								'Create Account'
							)}
						</Button>
					</form>
				</CardContent>

				<CardFooter className="flex justify-center text-sm border-t border-white/5 pt-4 bg-black/10 relative z-10">
					<span className="text-muted-foreground">
						{mode === 'login'
							? "Don't have an account?"
							: 'Already have an account?'}{' '}
						<Link
							href={mode === 'login' ? '/signup' : '/login'}
							className="font-bold text-primary hover:underline"
						>
							{mode === 'login' ? 'Sign up free' : 'Sign in'}
						</Link>
					</span>
				</CardFooter>
			</Card>
		</motion.div>
	);
}
