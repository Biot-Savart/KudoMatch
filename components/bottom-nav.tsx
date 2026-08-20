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
		<nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-[#030712]/80 backdrop-blur-xl border-t border-white/10 px-6 flex items-center justify-around pb-safe">
			{navItems.map((item) => {
				const Icon = item.icon;
				const active = isActive(item.href);

				return (
					<Link
						key={item.href}
						href={item.href}
						className="relative flex flex-col items-center justify-center w-14 h-full text-slate-400 focus:outline-none"
					>
						<motion.div
							whileTap={{ scale: 0.9 }}
							className={`flex flex-col items-center gap-1 ${
								active ? 'text-indigo-400 font-bold' : 'text-slate-400'
							}`}
						>
							<Icon className="h-5.5 w-5.5" />
							<span className="text-[10px] tracking-wide font-semibold">
								{item.name}
							</span>
						</motion.div>

						{active && (
							<motion.div
								layoutId="bottom-nav-indicator"
								className="absolute top-0 w-8 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
								transition={{ type: 'spring', stiffness: 380, damping: 30 }}
							/>
						)}
					</Link>
				);
			})}
		</nav>
	);
}
