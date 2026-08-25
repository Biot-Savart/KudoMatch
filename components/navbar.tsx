'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { fetchUserScoreSummary, scoringQueryKeys } from '@/lib/queries/scoring';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
	Compass,
	LogOut,
	Menu,
	Trophy,
	User as UserIcon,
	Users,
	X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function Navbar() {
	const pathname = usePathname();
	const router = useRouter();
	const supabase = createClient();

	const [user, setUser] = useState<any>(null);
	const [profile, setProfile] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [dropdownOpen, setDropdownOpen] = useState(false);

	useEffect(() => {
		let profileChannel: any = null;

		const setupProfileSubscription = (userId: string) => {
			if (profileChannel) {
				supabase.removeChannel(profileChannel);
			}

			profileChannel = supabase
				.channel(`public:profiles:id=eq.${userId}`)
				.on(
					'postgres_changes',
					{
						event: 'UPDATE',
						schema: 'public',
						table: 'profiles',
						filter: `id=eq.${userId}`,
					},
					(payload) => {
						if (payload.new) {
							setProfile(payload.new);
						}
					},
				)
				.subscribe();
		};

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			const currentUser = session?.user || null;
			setUser(currentUser);

			if (currentUser) {
				const { data } = await supabase
					.from('profiles')
					.select('*')
					.eq('id', currentUser.id)
					.single();
				setProfile(data);
				setupProfileSubscription(currentUser.id);
			} else {
				setProfile(null);
				if (profileChannel) {
					supabase.removeChannel(profileChannel);
					profileChannel = null;
				}
			}
			setLoading(false);
		});

		return () => {
			subscription.unsubscribe();
			if (profileChannel) {
				supabase.removeChannel(profileChannel);
			}
		};
	}, [supabase]);

	// Fetch dynamic score summary
	const { data: scoreSummary } = useQuery({
		queryKey: user?.id
			? scoringQueryKeys.userSummary(user.id)
			: ['scoring', 'summary', 'anon'],
		queryFn: () => (user?.id ? fetchUserScoreSummary(user.id) : null),
		enabled: !!user?.id,
	});

	const handleSignOut = async () => {
		await supabase.auth.signOut();
		setDropdownOpen(false);
		setMobileMenuOpen(false);
		router.push('/login');
		router.refresh();
	};

	const isActive = (path: string) => pathname === path;

	const navLinks = [
		{ name: 'Dashboard', href: '/', icon: Compass },
		{ name: 'Predict', href: '/predict', icon: Trophy },
		{ name: 'Pools', href: '/leagues', icon: Users },
	];

	if (
		pathname === '/login' ||
		pathname === '/signup' ||
		pathname === '/reset-password'
	) {
		return null;
	}

	const displayPoints = scoreSummary?.total_raw_points ?? 0;

	return (
		<header className="glass-nav fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-4 md:px-8 justify-between border-b border-white/10 shadow-lg">
			{/* Brand Logo */}
			<Link
				href="/"
				className="flex items-center gap-2 relative z-50 group"
			>
				<div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
					K
				</div>
				<span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
					Kudo<span className="text-indigo-400">Match</span>
				</span>
			</Link>

			{/* Desktop Navigation Links */}
			<nav className="hidden md:flex items-center gap-1.5 p-1 rounded-full bg-black/20 border border-white/5 backdrop-blur-md">
				{navLinks.map((link) => {
					const Icon = link.icon;
					const active = isActive(link.href);
					return (
						<Link
							key={link.href}
							href={link.href}
							className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide transition-all duration-200 ${
								active
									? 'text-white font-bold bg-white/10 shadow-sm border border-white/10'
									: 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
							}`}
						>
							<Icon
								className={`h-4 w-4 ${active ? 'text-indigo-400' : 'text-slate-400'}`}
							/>
							{link.name}
						</Link>
					);
				})}
			</nav>

			{/* Desktop Right Panel (Points, Profile, Auth state) */}
			<div className="hidden md:flex items-center gap-3">
				{loading ? (
					<div className="h-8 w-24 bg-white/5 animate-pulse rounded-full" />
				) : user ? (
					<div className="flex items-center gap-3">
						{/* Global Points Badge */}
						<div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-xs shadow-sm hover:border-indigo-400/50 transition-colors tabular-numbers">
							<Trophy className="h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
							<span>{displayPoints} pts</span>
						</div>

						{/* Profile Dropdown */}
						<div className="relative">
							<button
								onClick={() => setDropdownOpen(!dropdownOpen)}
								className="flex items-center gap-2 p-1 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 transition duration-200 focus:outline-none"
							>
								<Avatar className="h-9 w-9 border border-indigo-500/30 shadow-md">
									<AvatarImage src={profile?.avatar_url || ''} />
									<AvatarFallback className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-sm">
										{(profile?.full_name || profile?.email || 'U')
											.substring(0, 2)
											.toUpperCase()}
									</AvatarFallback>
								</Avatar>
							</button>

							<AnimatePresence>
								{dropdownOpen && (
									<>
										{/* Backdrop to close dropdown */}
										<div
											className="fixed inset-0 z-30"
											onClick={() => setDropdownOpen(false)}
										/>
										<motion.div
											initial={{ opacity: 0, scale: 0.95, y: 10 }}
											animate={{ opacity: 1, scale: 1, y: 0 }}
											exit={{ opacity: 0, scale: 0.95, y: 10 }}
											transition={{ duration: 0.15 }}
											className="absolute right-0 mt-2 w-60 rounded-2xl glass-card border border-white/15 p-2.5 shadow-2xl z-40"
										>
											<div className="px-3 py-2 border-b border-white/5 mb-1.5">
												<p className="text-sm font-bold text-white truncate">
													{profile?.full_name || 'Kudo Predictor'}
												</p>
												<p className="text-xs text-slate-400 truncate">
													{user.email}
												</p>
											</div>

											<Link
												href="/profile"
												onClick={() => setDropdownOpen(false)}
												className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition"
											>
												<UserIcon className="h-4 w-4 text-indigo-400" />
												My Profile
											</Link>

											<button
												onClick={handleSignOut}
												className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
											>
												<LogOut className="h-4 w-4" />
												Sign Out
											</button>
										</motion.div>
									</>
								)}
							</AnimatePresence>
						</div>
					</div>
				) : (
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							className="text-slate-300 hover:text-white rounded-full text-xs font-semibold"
							asChild
						>
							<Link href="/login">Sign In</Link>
						</Button>
						<Button
							className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold tracking-wide rounded-full text-xs px-4 shadow-lg shadow-indigo-500/20"
							asChild
						>
							<Link href="/signup">Sign Up</Link>
						</Button>
					</div>
				)}
			</div>

			{/* Mobile Header Right */}
			<div className="md:hidden flex items-center gap-2">
				{user && (
					<div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-xs tabular-numbers">
						<Trophy className="h-3 w-3 text-amber-400" />
						<span>{displayPoints}</span>
					</div>
				)}
				<button
					onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
					className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 focus:outline-none"
					aria-label="Toggle navigation menu"
				>
					{mobileMenuOpen ? (
						<X className="h-6 w-6" />
					) : (
						<Menu className="h-6 w-6" />
					)}
				</button>
			</div>

			{/* Mobile Drawer */}
			<AnimatePresence>
				{mobileMenuOpen && (
					<motion.div
						initial={{ opacity: 0, x: '100%' }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: '100%' }}
						transition={{ type: 'tween', duration: 0.25 }}
						className="fixed inset-y-0 right-0 w-4/5 max-w-sm glass-drawer z-40 p-6 flex flex-col justify-between shadow-2xl"
					>
						<div className="space-y-6 pt-12">
							<nav className="flex flex-col gap-3">
								{navLinks.map((link) => {
									const Icon = link.icon;
									return (
										<Link
											key={link.href}
											href={link.href}
											onClick={() => setMobileMenuOpen(false)}
											className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all ${
												isActive(link.href)
													? 'bg-white/10 text-white shadow-inner'
													: 'text-slate-300 hover:bg-white/5 hover:text-white'
											}`}
										>
											<Icon className="h-5 w-5 text-indigo-400" />
											{link.name}
										</Link>
									);
								})}
							</nav>
						</div>

						<div className="border-t border-white/5 pt-6 space-y-4">
							{loading ? (
								<div className="h-10 bg-white/5 animate-pulse rounded-xl" />
							) : user ? (
								<div className="space-y-4">
									<Link
										href="/profile"
										onClick={() => setMobileMenuOpen(false)}
										className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5"
									>
										<Avatar className="h-10 w-10 border border-white/10">
											<AvatarImage src={profile?.avatar_url || ''} />
											<AvatarFallback className="bg-indigo-600 text-white font-bold">
												{(profile?.full_name || user.email || 'U')
													.substring(0, 2)
													.toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<div className="text-left">
											<p className="text-sm font-bold text-white">
												{profile?.full_name || 'Kudo Predictor'}
											</p>
											<p className="text-xs text-slate-400">{user.email}</p>
										</div>
									</Link>

									<Button
										variant="destructive"
										className="w-full flex items-center justify-center gap-2 py-5 font-bold rounded-xl"
										onClick={handleSignOut}
									>
										<LogOut className="h-4 w-4" />
										Sign Out
									</Button>
								</div>
							) : (
								<div className="flex flex-col gap-2">
									<Button
										className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold py-5 rounded-xl text-white"
										asChild
									>
										<Link
											href="/login"
											onClick={() => setMobileMenuOpen(false)}
										>
											Sign In
										</Link>
									</Button>
									<Button
										variant="outline"
										className="w-full border-white/10 hover:bg-white/5 font-bold py-5 rounded-xl text-slate-300"
										asChild
									>
										<Link
											href="/signup"
											onClick={() => setMobileMenuOpen(false)}
										>
											Create Account
										</Link>
									</Button>
								</div>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</header>
	);
}

export default Navbar;
