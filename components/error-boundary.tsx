'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';

interface Props {
	children?: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
		error: null,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error('ErrorBoundary caught an error:', error, errorInfo);
	}

	private handleReset = () => {
		this.setState({ hasError: false, error: null });
		if (typeof window !== 'undefined') {
			window.location.reload();
		}
	};

	public render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="flex flex-col items-center justify-center min-h-[400px] w-full p-6 text-center">
					<div className="max-w-md w-full p-8 rounded-2xl glass-card border border-white/10 shadow-2xl bg-gradient-to-b from-red-500/5 to-slate-950/20">
						<div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
							<AlertTriangle className="h-6 w-6" />
						</div>
						<h2 className="text-xl font-extrabold tracking-tight mb-2 text-white">
							Something went wrong
						</h2>
						<p className="text-slate-400 text-xs mb-6 leading-relaxed">
							{this.state.error?.message ||
								'An unexpected error occurred. Please try again or refresh the page.'}
						</p>
						<Button
							onClick={this.handleReset}
							className="bg-indigo-600 hover:bg-indigo-700 font-bold py-5 rounded-xl w-full flex items-center justify-center gap-2"
						>
							<RotateCcw className="h-4 w-4" />
							Reload Page
						</Button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
