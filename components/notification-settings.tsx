'use client';

import { usePushNotifications } from '@/lib/hooks/use-push-notifications';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    fetchNotificationPreferences,
    updateNotificationPreferences,
} from '@/lib/queries/notifications';
import { NotificationPreferences } from '@/types';
import {
    AlertCircle,
    Bell,
    BellOff,
    Check,
    Clock,
    FileText,
    Loader2,
    Mail,
    Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from './ui/card';

interface NotificationSettingsProps {
	userId: string;
}

export function NotificationSettings({ userId }: NotificationSettingsProps) {
	const [preferences, setPreferences] = useState<NotificationPreferences>({
		user_id: userId,
		...DEFAULT_NOTIFICATION_PREFERENCES,
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [statusMessage, setStatusMessage] = useState<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);

	const {
		isSupported: pushSupported,
		isSubscribed: pushSubscribed,
		loading: pushLoading,
		error: pushError,
		subscribe: subscribePush,
		unsubscribe: unsubscribePush,
	} = usePushNotifications(userId);

	useEffect(() => {
		let isMounted = true;
		const loadPreferences = async () => {
			try {
				const data = await fetchNotificationPreferences(userId);
				if (isMounted && data) {
					setPreferences(data);
				}
			} catch (err) {
				console.error('Error fetching notification preferences:', err);
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		loadPreferences();
		return () => {
			isMounted = false;
		};
	}, [userId]);

	const handleToggle = async (key: keyof NotificationPreferences) => {
		if (saving) return;
		const newValue = !preferences[key];
		const updated = { ...preferences, [key]: newValue };
		setPreferences(updated);
		setSaving(true);
		setStatusMessage(null);

		try {
			await updateNotificationPreferences(userId, { [key]: newValue });
			setStatusMessage({
				type: 'success',
				text: 'Preferences updated successfully.',
			});
			setTimeout(() => setStatusMessage(null), 3000);
		} catch (err: any) {
			setStatusMessage({
				type: 'error',
				text: err.message || 'Failed to update preferences.',
			});
		} finally {
			setSaving(false);
		}
	};

	const handleTogglePush = async () => {
		if (pushLoading) return;
		setStatusMessage(null);

		if (pushSubscribed) {
			const success = await unsubscribePush();
			if (success) {
				await updateNotificationPreferences(userId, {
					push_notifications: false,
				});
				setPreferences((prev) => ({ ...prev, push_notifications: false }));
				setStatusMessage({
					type: 'success',
					text: 'Web push notifications disabled.',
				});
			}
		} else {
			const success = await subscribePush();
			if (success) {
				await updateNotificationPreferences(userId, {
					push_notifications: true,
				});
				setPreferences((prev) => ({ ...prev, push_notifications: true }));
				setStatusMessage({
					type: 'success',
					text: 'Web push notifications enabled on this device!',
				});
			}
		}
	};

	if (loading) {
		return (
			<Card className="glass-card border-white/10 rounded-2xl p-6 flex justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
			</Card>
		);
	}

	return (
		<Card className="glass-card border-white/10 rounded-2xl">
			<CardHeader className="p-6 pb-4">
				<CardTitle className="text-lg font-bold text-white flex items-center gap-2">
					<Bell className="h-5 w-5 text-indigo-400" />
					<span>Notification Alerts</span>
				</CardTitle>
				<CardDescription>
					Choose when and how KudoMatch delivers match updates and reminders
				</CardDescription>
			</CardHeader>
			<CardContent className="p-6 pt-0 space-y-5">
				{statusMessage && (
					<div
						className={`p-3 rounded-lg flex items-center gap-2 text-xs font-semibold border ${
							statusMessage.type === 'success'
								? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
								: 'bg-destructive/10 text-destructive border-destructive/20'
						}`}
					>
						{statusMessage.type === 'success' ? (
							<Check className="h-4 w-4 shrink-0" />
						) : (
							<AlertCircle className="h-4 w-4 shrink-0" />
						)}
						<span>{statusMessage.text}</span>
					</div>
				)}

				{pushError && (
					<div className="p-3 rounded-lg flex items-center gap-2 text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
						<AlertCircle className="h-4 w-4 shrink-0" />
						<span>{pushError}</span>
					</div>
				)}

				{/* PUSH NOTIFICATIONS DEVICE ENROLLMENT */}
				<div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between gap-4">
					<div className="flex items-start gap-3">
						<div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mt-0.5">
							{pushSubscribed ? (
								<Bell className="h-5 w-5" />
							) : (
								<BellOff className="h-5 w-5 text-slate-400" />
							)}
						</div>
						<div>
							<p className="text-sm font-bold text-white">
								Browser Push Notifications
							</p>
							<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
								{pushSupported
									? pushSubscribed
										? 'This device is registered to receive instant push alerts.'
										: 'Enable instant lock warnings and result alerts in your browser.'
									: 'Push notifications are not supported by your current browser.'}
							</p>
						</div>
					</div>

					{pushSupported && (
						<Button
							type="button"
							size="sm"
							variant={pushSubscribed ? 'outline' : 'default'}
							className={`text-xs font-bold shrink-0 ${
								pushSubscribed
									? 'border-white/10 hover:bg-destructive/10 hover:text-destructive'
									: 'bg-indigo-600 hover:bg-indigo-500 text-white'
							}`}
							disabled={pushLoading}
							onClick={handleTogglePush}
						>
							{pushLoading ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : pushSubscribed ? (
								'Disable'
							) : (
								'Enable'
							)}
						</Button>
					)}
				</div>

				{/* PREFERENCE TOGGLES */}
				<div className="space-y-3 pt-2">
					<p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
						Notification Types
					</p>

					{/* 1. Kickoff Reminders */}
					<div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.01]">
						<div className="flex items-center gap-3">
							<Clock className="h-4 w-4 text-amber-400 shrink-0" />
							<div>
								<p className="text-xs font-bold text-white">
									Matchday Kickoff Reminders
								</p>
								<p className="text-[11px] text-slate-400">
									Alert 15–60 mins before kickoff for unpredicted fixtures
								</p>
							</div>
						</div>
						<button
							type="button"
							role="switch"
							aria-checked={preferences.kickoff_warnings}
							onClick={() => handleToggle('kickoff_warnings')}
							className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
								preferences.kickoff_warnings ? 'bg-indigo-600' : 'bg-slate-700'
							}`}
						>
							<span
								className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
									preferences.kickoff_warnings
										? 'translate-x-4'
										: 'translate-x-0'
								}`}
							/>
						</button>
					</div>

					{/* 2. Match Results */}
					<div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.01]">
						<div className="flex items-center gap-3">
							<Trophy className="h-4 w-4 text-emerald-400 shrink-0" />
							<div>
								<p className="text-xs font-bold text-white">
									Match Results & Points
								</p>
								<p className="text-[11px] text-slate-400">
									Get notified when final scores and your points are tallied
								</p>
							</div>
						</div>
						<button
							type="button"
							role="switch"
							aria-checked={preferences.match_results}
							onClick={() => handleToggle('match_results')}
							className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
								preferences.match_results ? 'bg-indigo-600' : 'bg-slate-700'
							}`}
						>
							<span
								className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
									preferences.match_results ? 'translate-x-4' : 'translate-x-0'
								}`}
							/>
						</button>
					</div>

					{/* 3. Weekly Digest */}
					<div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.01]">
						<div className="flex items-center gap-3">
							<FileText className="h-4 w-4 text-cyan-400 shrink-0" />
							<div>
								<p className="text-xs font-bold text-white">
									Weekly Gameweek Digest
								</p>
								<p className="text-[11px] text-slate-400">
									Email summary of your points, accuracy, and pool rankings
								</p>
							</div>
						</div>
						<button
							type="button"
							role="switch"
							aria-checked={preferences.weekly_digest}
							onClick={() => handleToggle('weekly_digest')}
							className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
								preferences.weekly_digest ? 'bg-indigo-600' : 'bg-slate-700'
							}`}
						>
							<span
								className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
									preferences.weekly_digest ? 'translate-x-4' : 'translate-x-0'
								}`}
							/>
						</button>
					</div>

					{/* 4. Global Email Notifications */}
					<div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.01]">
						<div className="flex items-center gap-3">
							<Mail className="h-4 w-4 text-purple-400 shrink-0" />
							<div>
								<p className="text-xs font-bold text-white">
									Email Channel Delivery
								</p>
								<p className="text-[11px] text-slate-400">
									Enable or disable all email-based notifications
								</p>
							</div>
						</div>
						<button
							type="button"
							role="switch"
							aria-checked={preferences.email_notifications}
							onClick={() => handleToggle('email_notifications')}
							className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
								preferences.email_notifications
									? 'bg-indigo-600'
									: 'bg-slate-700'
							}`}
						>
							<span
								className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
									preferences.email_notifications
										? 'translate-x-4'
										: 'translate-x-0'
								}`}
							/>
						</button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
