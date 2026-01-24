import { For, Show } from 'solid-js';
import { MessageSquare, Search, Bot, Clock, Eye } from 'lucide-solid';
import { AiConversation } from '../../../services/firebaseService';

interface ConversationsTabProps {
    conversations: () => AiConversation[];
}

export function ConversationsTab(props: ConversationsTabProps) {
    return (
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <MessageSquare class="w-5 h-5 text-cyan-400" />
                    Recent Conversations
                </h2>
                <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        class="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 text-sm"
                    />
                </div>
            </div>

            <div class="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5">
                <For each={props.conversations()}>
                    {(conv) => (
                        <div class="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <div class={`w-10 h-10 rounded-full flex items-center justify-center ${conv.botType === 'intent' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                    <Bot class="w-5 h-5" />
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-white font-medium">{conv.userId}</span>
                                        <span class={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${conv.botType === 'intent' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                                            {conv.botType}
                                        </span>
                                        <span class="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{conv.messages.length} messages</span>
                                    </div>
                                    <p class="text-gray-400 text-sm truncate max-w-md">{conv.lastMessage}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4">
                                <span class="text-gray-500 text-[11px] font-mono flex items-center gap-1">
                                    <Clock class="w-3 h-3" />
                                    {new Date(conv.createdAt).toLocaleString()}
                                </span>
                                <button class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-cyan-400 transition-colors">
                                    <Eye class="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </For>

                <Show when={props.conversations().length === 0}>
                    <div class="p-10 text-center text-gray-500 italic">
                        No monitored conversations found yet.
                    </div>
                </Show>
            </div>
        </div>
    );
}
