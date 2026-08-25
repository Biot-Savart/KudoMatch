'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	deletePoolMessage,
	fetchPoolMessages,
	sendPoolMessage,
} from '@/lib/queries/chat';
import { createClient } from '@/lib/supabase/client';
import { PoolMessage } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface PoolChatProps {
	poolId: string;
	userId: string;
	username: string;
	isCreator: boolean;
}

export default function PoolChat({
	poolId,
	userId,
	username,
	isCreator,
}: PoolChatProps) {
	const queryClient = useQueryClient();
	const supabase = createClient();
	const [messageText, setMessageText] = useState('');
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [isSubscribed, setIsSubscribed] = useState(false);

	// Fetch messages
	const { data: messages = [], isLoading } = useQuery<PoolMessage[]>({
		queryKey: ['pool-messages', poolId],
		queryFn: () => fetchPoolMessages(poolId),
		enabled: !!poolId,
	});

	// Auto-scroll to bottom of messages
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		if (messages.length > 0) {
			scrollToBottom();
		}
	}, [messages]);

	// Setup realtime subscription
	useEffect(() => {
		if (!poolId) return;

		const channel = supabase
			.channel(`pool_messages_chat:${poolId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'pool_messages',
					filter: `pool_id=eq.${poolId}`,
				},
				async (payload) => {
					// Invalidate to refresh with full profiles joined
					queryClient.invalidateQueries({
						queryKey: ['pool-messages', poolId],
					});
				},
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					setIsSubscribed(true);
				}
			});

		return () => {
			supabase.removeChannel(channel);
		};
	}, [poolId, supabase, queryClient]);

	// Send message mutation
	const sendMutation = useMutation({
		mutationFn: (text: string) => sendPoolMessage(poolId, userId, text),
		onMutate: async (newText) => {
			await queryClient.cancelQueries({ queryKey: ['pool-messages', poolId] });
			const previousMessages =
				queryClient.getQueryData<PoolMessage[]>(['pool-messages', poolId]) ||
				[];

			// Optimistic message
			const optimisticMsg: PoolMessage = {
				id: 'optimistic-' + Date.now(),
				pool_id: poolId,
				user_id: userId,
				message: newText,
				created_at: new Date().toISOString(),
				profile: {
					id: userId,
					username: username,
					full_name: '',
					avatar_url: null,
					total_points: 0,
					created_at: '',
					updated_at: '',
				},
			};

			queryClient.setQueryData<PoolMessage[]>(
				['pool-messages', poolId],
				[...previousMessages, optimisticMsg],
			);

			return { previousMessages };
		},
		onError: (err, newText, context) => {
			if (context?.previousMessages) {
				queryClient.setQueryData(
					['pool-messages', poolId],
					context.previousMessages,
				);
			}
			toast.error('Failed to send message.');
		},
		onSuccess: () => {
			setMessageText('');
			queryClient.invalidateQueries({ queryKey: ['pool-messages', poolId] });
		},
	});

	// Delete message mutation
	const deleteMutation = useMutation({
		mutationFn: (msgId: string) => deletePoolMessage(msgId),
		onSuccess: () => {
			toast.success('Message deleted.');
			queryClient.invalidateQueries({ queryKey: ['pool-messages', poolId] });
		},
		onError: () => {
			toast.error('Failed to delete message.');
		},
	});

	const handleSend = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = messageText.trim();
		if (!trimmed || sendMutation.isPending) return;

		sendMutation.mutate(trimmed);
	};

	const handleDelete = (msgId: string) => {
		if (window.confirm('Are you sure you want to delete this message?')) {
			deleteMutation.mutate(msgId);
		}
	};

	const formatTime = (isoString: string) => {
		try {
			const date = new Date(isoString);
			return date.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			});
		} catch (e) {
			return '';
		}
	};

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-slate-400">
				<Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
				<p className="text-xs">Loading banter chat...</p>
			</div>
		);
	}

	return (
		<div className="rounded-2xl glass-card border border-white/10 shadow-xl overflow-hidden flex flex-col h-[500px]">
			{/* Chat Header */}
			<div className="bg-white/5 px-5 py-3 border-b border-white/10 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="relative flex h-2 w-2">
						<span
							className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSubscribed ? 'bg-emerald-400' : 'bg-amber-400'}`}
						></span>
						<span
							className={`relative inline-flex rounded-full h-2 w-2 ${isSubscribed ? 'bg-emerald-500' : 'bg-amber-500'}`}
						></span>
					</span>
					<span className="text-xs font-black uppercase tracking-wider text-slate-300">
						Live Pool Banter Room
					</span>
				</div>
				<span className="text-[10px] text-slate-400 font-bold">
					{messages.length} messages
				</span>
			</div>

			{/* Chat Messages */}
			<div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-950/40">
				{messages.length === 0 ? (
					<div className="h-full flex flex-col items-center justify-center text-center px-4">
						<p className="text-slate-400 font-bold text-sm mb-1">
							📢 Silence is deafening!
						</p>
						<p className="text-slate-500 text-xs max-w-xs">
							No talk has been talked yet. Throw some banter or trash talk your
							peers about their prediction picks!
						</p>
					</div>
				) : (
					messages.map((msg) => {
						const isMe = msg.user_id === userId;
						const canDelete = isMe || isCreator;
						const fallbackChar = (msg.profile?.username || 'U')
							.substring(0, 2)
							.toUpperCase();

						return (
							<div
								key={msg.id}
								className={`flex items-start gap-2.5 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
							>
								<Avatar className="h-7 w-7 border border-white/10 shrink-0">
									<AvatarImage src={msg.profile?.avatar_url || ''} />
									<AvatarFallback className="bg-indigo-600 text-[10px] font-black text-white">
										{fallbackChar}
									</AvatarFallback>
								</Avatar>

								<div className="space-y-1">
									<div
										className={`flex items-center gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
									>
										<span className="text-[10px] font-black text-slate-400">
											@{msg.profile?.username || 'user'}
										</span>
										<span className="text-[9px] text-slate-500 font-semibold">
											{formatTime(msg.created_at)}
										</span>
										{canDelete && !msg.id.startsWith('optimistic-') && (
											<button
												onClick={() => handleDelete(msg.id)}
												className="text-slate-600 hover:text-red-400 transition"
												title="Delete message"
											>
												<Trash2 className="h-3 w-3" />
											</button>
										)}
									</div>

									<div
										className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
											isMe
												? 'bg-indigo-600 text-white rounded-tr-none'
												: 'bg-white/5 border border-white/5 text-slate-200 rounded-tl-none'
										}`}
									>
										{msg.message}
									</div>
								</div>
							</div>
						);
					})
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Quick Emoji Reactions Bar */}
			<div className="bg-black/30 px-4 py-1.5 border-t border-white/5 flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
				<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
					Quick Banter:
				</span>
				<div className="flex items-center gap-1">
					{['🔥', '💀', '🎯', '🤡', '⚽', '🍿', '👑'].map((emoji) => (
						<button
							key={emoji}
							type="button"
							onClick={() =>
								setMessageText((prev) => `${prev} ${emoji}`.trim())
							}
							className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-xs transition active:scale-90"
							title={`Add ${emoji}`}
						>
							{emoji}
						</button>
					))}
				</div>
			</div>

			{/* Chat Input */}
			<form
				onSubmit={handleSend}
				className="bg-white/5 p-3 border-t border-white/10 flex gap-2 items-center"
			>
				<Input
					value={messageText}
					onChange={(e) => setMessageText(e.target.value)}
					placeholder="Throw some banter..."
					maxLength={1000}
					className="bg-slate-900/90 border-white/10 focus-visible:ring-indigo-500 rounded-xl py-5 text-sm placeholder:text-slate-500 shadow-inner"
				/>
				<Button
					type="submit"
					disabled={!messageText.trim() || sendMutation.isPending}
					className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/20 h-10 w-10 p-0 rounded-xl shrink-0 active:scale-95 transition-transform"
				>
					<Send className="h-4 w-4" />
				</Button>
			</form>
		</div>
	);
}
