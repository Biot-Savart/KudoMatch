'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error('Next.js route error boundary caught:', error);
	}, [error]);

	return (
		<main className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8 text-center">
			<div className="max-w-md w-full p-8 rounded-2xl glass-card border border-white/10 shadow-2xl bg-gradient-to-b from-red-500/5 to-slate-950/20">
				<div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
					<AlertTriangle className="h-6 w-6" />
				</div>
				<h2 className="text-2xl font-extrabold tracking-tight mb-2 text-white">
					Something went wrong!
				</h2>
				<p className="text-slate-400 text-sm mb-6 leading-relaxed">
					{error.message ||
						'We encountered an error while rendering this page.'}
				</p>
				<Button
					onClick={() => reset()}
					className="bg-indigo-600 hover:bg-indigo-700 font-bold py-6 rounded-xl w-full flex items-center justify-center gap-2"
				>
					<RotateCcw className="h-4 w-4" />
					Try Again
				</Button>
			</div>
		</main>
	);
}
