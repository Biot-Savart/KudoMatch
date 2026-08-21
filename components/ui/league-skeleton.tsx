import { Card } from '@/components/ui/card';

export function UserPoolsSkeleton() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			{[...Array(4)].map((_, i) => (
				<Card
					key={i}
					className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-xl p-6"
				>
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-2 flex-grow">
							<div className="h-4 w-1/3 bg-slate-800 rounded animate-pulse" />
							<div className="h-3 w-3/4 bg-slate-800/65 rounded animate-pulse" />
						</div>
						<div className="h-8 w-8 rounded-full bg-slate-800 animate-pulse" />
					</div>
					<div className="mt-6 flex justify-between items-center border-t border-white/5 pt-4">
						<div className="h-3 w-20 bg-slate-800 rounded animate-pulse" />
						<div className="h-3 w-16 bg-slate-800 rounded animate-pulse" />
					</div>
				</Card>
			))}
		</div>
	);
}

export function LeaderboardSkeleton() {
	return (
		<div className="space-y-4">
			{/* Podium / Top 3 skeleton */}
			<div className="grid grid-cols-3 gap-3 items-end max-w-lg mx-auto py-6">
				{/* 2nd place skeleton */}
				<div className="flex flex-col items-center gap-2">
					<div className="h-10 w-10 rounded-full bg-slate-800 animate-pulse" />
					<div className="h-3 w-14 bg-slate-800 rounded animate-pulse" />
					<div className="h-16 w-full bg-slate-800/40 rounded-t-xl animate-pulse" />
				</div>
				{/* 1st place skeleton */}
				<div className="flex flex-col items-center gap-2">
					<div className="h-12 w-12 rounded-full bg-slate-800 animate-pulse" />
					<div className="h-3 w-16 bg-slate-800 rounded animate-pulse" />
					<div className="h-24 w-full bg-indigo-500/15 rounded-t-xl animate-pulse" />
				</div>
				{/* 3rd place skeleton */}
				<div className="flex flex-col items-center gap-2">
					<div className="h-10 w-10 rounded-full bg-slate-800 animate-pulse" />
					<div className="h-3 w-12 bg-slate-800 rounded animate-pulse" />
					<div className="h-12 w-full bg-slate-800/40 rounded-t-xl animate-pulse" />
				</div>
			</div>

			{/* Rest of standings skeleton */}
			<div className="space-y-2">
				{[...Array(5)].map((_, i) => (
					<div
						key={i}
						className="flex items-center justify-between p-4 bg-white/[0.01] border border-white/5 rounded-xl"
					>
						<div className="flex items-center gap-3">
							<div className="h-4 w-4 bg-slate-800 rounded animate-pulse" />
							<div className="h-8 w-8 rounded-full bg-slate-800 animate-pulse" />
							<div className="h-3 w-24 bg-slate-800 rounded animate-pulse" />
						</div>
						<div className="h-4 w-12 bg-slate-800 rounded animate-pulse" />
					</div>
				))}
			</div>
		</div>
	);
}
