import { AuthCard } from '@/components/auth-card';

export const metadata = {
	title: 'Sign Up | KudoMatch',
	description:
		'Create an account on KudoMatch and join private and global prediction pools.',
};

export default function SignupPage() {
	return (
		<main className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#030712] overflow-hidden">
			{/* Decorative background gradients */}
			<div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
			<div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

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

			<AuthCard mode="signup" />
		</main>
	);
}
