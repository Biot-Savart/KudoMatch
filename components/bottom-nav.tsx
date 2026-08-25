'use client';

import { motion } from 'framer-motion';
import { Compass, Trophy, User, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
	const pathname = usePathname();

	const navItems = [
		{ name: 'Dashboard', href: '/', icon: Compass },
		{ name: 'Predict', href: '/predict', icon: Trophy },
		{ name: 'Pools', href: '/leagues', icon: Users },
		{ name: 'Profile', href: '/profile', icon: User },
	];

	// Hide bottom nav completely on login/signup pages for full focus
	if (
		pathname === '/login' ||
		pathname === '/signup' ||
		pathname === '/reset-password'
	) {
		return null;
	}

	const isActive = (path: string) => {
		if (path === '/') {
			return pathname === '/';
		}
		return pathname.startsWith(path);
	};

	return (
		<nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 glass-dock px-6 flex items-center justify-around pb-safe">
			{navItems.map((item) => {
				const Icon = item.icon;
				const active = isActive(item.href);

				return (
					<Link
						key={item.href}
						href={item.href}
						className="relative flex flex-col items-center justify-center w-16 h-full text-slate-400 focus:outline-none"
					>
						<motion.div
							whileTap={{ scale: 0.88 }}
							transition={{ type: 'spring', stiffness: 400, damping: 17 }}
							className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
								active
									? 'text-white font-bold'
									: 'text-slate-400 hover:text-slate-200'
							}`}
						>
							{active && (
								<motion.div
									layoutId="active-nav-pill"
									className="absolute inset-0 bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 rounded-2xl border border-indigo-500/30 -z-10 shadow-sm"
									transition={{ type: 'spring', stiffness: 450, damping: 32 }}
								/>
							)}
							<Icon
								className={`h-5 w-5 transition-transform duration-200 ${
									active
										? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]'
										: 'text-slate-400'
								}`}
							/>
							<span
								className={`text-[10px] tracking-wide ${
									active
										? 'text-indigo-200 font-bold'
										: 'text-slate-400 font-medium'
								}`}
							>
								{item.name}
							</span>
						</motion.div>
					</Link>
				);
			})}
		</nav>
	);
}
