import { BottomNav } from '@/components/bottom-nav';
import { Navbar } from '@/components/navbar';
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'KudoMatch | Modern Sports Predictions',
	description: 'The fast, social, and beautiful sports predictor platform.',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
		>
			<body
				className={`${inter.className} min-h-screen bg-[#030712] text-slate-100 antialiased`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem={false}
					disableTransitionOnChange
				>
					<QueryProvider>
						<div className="flex flex-col min-h-screen relative">
							<Navbar />
							{/* Padding top is 16 to account for the fixed header of height 16 (h-16) */}
							<div className="flex-grow pt-16 pb-20 md:pb-0">{children}</div>
							<BottomNav />
						</div>
						<Toaster
							richColors
							theme="dark"
							position="top-right"
							closeButton
						/>
					</QueryProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
