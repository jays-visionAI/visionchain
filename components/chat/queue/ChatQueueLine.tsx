import { createSignal, createMemo, For, Show } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import AgentChip, { AgentTask } from './AgentChip';
import { ChevronDown, List } from 'lucide-solid';

interface ChatQueueLineProps {
    tasks: AgentTask[];
    isCompact?: boolean;
    onTaskClick?: (taskId: string) => void;
    onOpenHistory?: () => void;
}

const ChatQueueLine = (props: ChatQueueLineProps) => {
    let scrollContainer: HTMLDivElement | undefined;

    // Only show Active tasks (WAITING, EXECUTING) + recently finished (SENT/FAILED within last few seconds - handled by parent logic ideally, but filtered here for visualization)
    // For this static chunk, we show WAITING, EXECUTING, and SENT/FAILED as "Active" in the queue line.
    // CANCELLED/EXPIRED are usually hidden or moved to history.

    const activeTasks = createMemo(() =>
        props.tasks.filter(t => ['WAITING', 'EXECUTING', 'FAILED'].includes(t.status))
    );

    const waitingCount = createMemo(() =>
        props.tasks.filter(t => t.status === 'WAITING').length
    );

    const handleWheel = (e: WheelEvent) => {
        if (scrollContainer) {
            // If deltaX is present (e.g. trackpad), let it handle itself naturally
            // If only deltaY (vertical mouse wheel), translate it to horizontal scroll
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                scrollContainer.scrollLeft += e.deltaY;
            }
        }
    };

    return (
        <Presence>
            <Show when={activeTasks().length > 0}>
                <Motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    class="sticky top-[48px] md:top-[60px] z-[40] w-full bg-[#0d0d0f]/90 backdrop-blur-xl border-b border-white/5 shadow-2xl overflow-hidden"
                >
                    <div class={`flex items-center px-4 gap-4 overflow-hidden transition-all ${props.isCompact ? 'py-1.5' : 'py-2'}`}>

                        {/* Left Label */}
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                <div class={`w-1.5 h-1.5 rounded-full ${waitingCount() > 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'}`} />
                                <Show when={!props.isCompact} fallback="">Queue</Show>
                                <Show when={!props.isCompact}>({activeTasks().length})</Show>
                            </span>
                        </div>

                        {/* Horizontal Scroll Area */}
                        <div
                            ref={scrollContainer}
                            onWheel={handleWheel}
                            class="flex-1 overflow-x-auto scrollbar-hide flex items-center gap-3 pr-4 mask-linear-fade"
                        >
                            <For each={activeTasks()}>
                                {(task) => (
                                    <AgentChip
                                        task={task}
                                        isCompact={props.isCompact}
                                        onClick={() => props.onTaskClick?.(task.id)}
                                    />
                                )}
                            </For>
                        </div>

                        {/* Right Toggle (History) */}
                        <button
                            onClick={props.onOpenHistory}
                            class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <List class="w-4 h-4" />
                        </button>
                    </div>

                    {/* Active Line Indicator */}
                    <div class="h-[1px] w-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                </Motion.div>
            </Show>
        </Presence>
    );
};

export default ChatQueueLine;
