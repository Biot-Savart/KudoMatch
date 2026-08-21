import { Card, CardContent } from '@/components/ui/card';

export function MatchCardSkeleton() {
	return (
		<Card className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl">
			{/* Top Details / Time-Lock Row skeleton */}
			<div className="px-4 py-2 bg-black/20 border-b border-white/5 flex justify-between items-center">
				<div className="h-3 w-20 bg-slate-800 rounded animate-pulse" />
				<div className="h-3 w-24 bg-slate-800 rounded animate-pulse" />
			</div>

			<CardContent className="p-5 flex flex-col space-y-5">
				{/* Teams Display Row skeleton */}
				<div className="flex items-center justify-between text-center relative">
					{/* Home team */}
					<div className="flex flex-col items-center gap-1.5 w-24">
						<div className="h-10 w-10 rounded-full bg-slate-800 animate-pulse" />
						<div className="h-3 w-16 bg-slate-800 rounded animate-pulse" />
					</div>

					{/* Center Prediction/Score box skeleton */}
					<div className="flex flex-col items-center justify-center gap-1">
						<div className="h-9 w-20 bg-slate-800 rounded-xl animate-pulse" />
						<div className="h-2 w-12 bg-slate-800/65 rounded animate-pulse mt-1" />
					</div>

					{/* Away team */}
					<div className="flex flex-col items-center gap-1.5 w-24">
						<div className="h-10 w-10 rounded-full bg-slate-800 animate-pulse" />
						<div className="h-3 w-16 bg-slate-800 rounded animate-pulse" />
					</div>
				</div>

				{/* Quick Selector buttons skeleton */}
				<div className="grid grid-cols-3 gap-2 pt-1">
					<div className="h-9 bg-slate-800/40 rounded-xl animate-pulse" />
					<div className="h-9 bg-slate-800/40 rounded-xl animate-pulse" />
					<div className="h-9 bg-slate-800/40 rounded-xl animate-pulse" />
				</div>
			</CardContent>
		</Card>
	);
}
