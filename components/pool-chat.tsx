'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as chatQueries from '@/lib/queries/chat';
import { createClient } from '@/lib/supabase/client';
import { PoolMessage } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface PoolChatProps {
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
		queryFn: () => chatQueries.fetchPoolMessages(poolId),
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
				async () => {
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
		mutationFn: (text: string) =>
			chatQueries.sendPoolMessage(poolId, userId, text),
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
					full_name: username,
					avatar_url: null,
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
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['pool-messages', poolId] });
		},
	});

	// Delete message mutation
	const deleteMutation = useMutation({
		mutationFn: (msgId: string) => chatQueries.deletePoolMessage(msgId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['pool-messages', poolId] });
			toast.success('Message removed');
		},
		onError: () => {
			toast.error('Could not delete message.');
		},
	});

	const handleSendMessage = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = messageText.trim();
		if (!trimmed) return;

		setMessageText('');
		sendMutation.mutate(trimmed);
	};

	const formatMessageTime = (dateStr: string) => {
		try {
			const d = new Date(dateStr);
			return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			return '';
		}
	};

	return (
		<div className="flex flex-col h-[520px] rounded-2xl glass-card border border-white/10 overflow-hidden shadow-xl">
			{/* Chat Header */}
			<div className="px-5 py-3.5 bg-slate-900/60 border-b border-white/10 flex items-center justify-between">
				<div className="flex items-center gap-2">
					{!isLoading && (
						<span className="text-sm font-bold text-white tracking-wide">
							Live Pool Banter Room
						</span>
					)}
					{isSubscribed ? (
						<span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
							Live
						</span>
					) : (
						<span className="text-[10px] text-slate-500">Connecting...</span>
					)}
				</div>
				<span className="text-xs text-slate-400">
					{messages.length} message{messages.length === 1 ? '' : 's'}
				</span>
			</div>

			{/* Messages Stream */}
			<div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-gradient-to-b from-transparent to-black/20">
				{isLoading ? (
					<div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
						<Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
						<span className="text-xs">Loading chatter...</span>
					</div>
				) : messages.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 space-y-1">
						<span className="text-2xl mb-1">🤫</span>
						<p className="text-sm font-bold text-slate-400">Quiet in here!</p>
						<p className="text-xs">
							Drop the first message to kick off the banter with your pool
							members.
						</p>
					</div>
				) : (
					messages.map((msg) => {
						const isMe = msg.user_id === userId;
						const senderName = msg.profile?.username
							? `@${msg.profile.username}`
							: msg.profile?.full_name || (isMe ? `@${username}` : 'Anonymous');

						return (
							<div
								key={msg.id}
								className={`flex items-start gap-2.5 group ${
									isMe ? 'flex-row-reverse' : 'flex-row'
								}`}
							>
								<Avatar className="h-7 w-7 border border-white/10 shrink-0 mt-0.5">
									<AvatarImage src={msg.profile?.avatar_url || ''} />
									<AvatarFallback className="bg-indigo-600 text-white text-[10px] font-bold">
										{(msg.profile?.full_name || msg.profile?.username || 'U')
											.substring(0, 2)
											.toUpperCase()}
									</AvatarFallback>
								</Avatar>

								<div
									className={`max-w-[75%] rounded-2xl px-3.5 py-2 relative text-xs shadow-md ${
										isMe
											? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-tr-none'
											: 'glass-card border border-white/10 text-slate-200 rounded-tl-none bg-slate-900/60'
									}`}
								>
									{/* Sender + Timestamp */}
									<div
										className={`flex items-center gap-2 mb-1 text-[10px] font-semibold ${
											isMe ? 'text-indigo-200' : 'text-indigo-400'
										}`}
									>
										<span>{senderName}</span>
										<span className="opacity-60 font-normal">
											{formatMessageTime(msg.created_at)}
										</span>
									</div>

									{/* Message Body */}
									<p className="break-words leading-relaxed whitespace-pre-wrap">
										{msg.message}
									</p>

									{/* Message Delete Trigger */}
									{(isMe || isCreator) && (
										<button
											onClick={() => deleteMutation.mutate(msg.id)}
											className="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-full bg-slate-800 border border-white/20 text-slate-400 hover:text-rose-400 hover:border-rose-500 transition shadow"
											title="Delete message"
										>
											<Trash2 className="h-2.5 w-2.5" />
										</button>
									)}
								</div>
							</div>
						);
					})
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Message Input Box */}
			<form
				onSubmit={handleSendMessage}
				className="p-3 bg-slate-900/80 border-t border-white/10 flex items-center gap-2"
			>
				<Input
					value={messageText}
					onChange={(e) => setMessageText(e.target.value)}
					placeholder="Throw some banter..."
					maxLength={300}
					className="bg-white/5 border-white/10 text-white text-xs placeholder:text-slate-500 focus:border-indigo-500 h-10 rounded-xl"
				/>
				<Button
					type="submit"
					disabled={!messageText.trim() || sendMutation.isPending}
					size="sm"
					className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl h-10 px-3.5 shadow-lg shadow-indigo-600/30 shrink-0"
				>
					{sendMutation.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Send className="h-4 w-4" />
					)}
				</Button>
			</form>
		</div>
	);
}
