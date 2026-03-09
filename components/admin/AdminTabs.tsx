import { createSignal, For, JSX, Show } from 'solid-js';

export interface TabItem {
    id: string;
    label: string;
    icon?: () => JSX.Element;
}

interface AdminTabsProps {
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (id: string) => void;
}

/**
 * Shared tab bar for consolidated admin pages.
 * Inline SVG icons preferred per user rules (no emoji).
 */
export function AdminTabs(props: AdminTabsProps) {
    return (
        <div class="flex items-center gap-1 bg-[#0a0a0b] border border-white/5 rounded-xl p-1 mb-6">
            <For each={props.tabs}>
                {(tab) => {
                    const isActive = () => props.activeTab === tab.id;
                    return (
                        <button
                            onClick={() => props.onTabChange(tab.id)}
                            class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                            classList={{
                                'bg-white/[0.08] text-white border border-white/10': isActive(),
                                'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent': !isActive(),
                            }}
                        >
                            <Show when={tab.icon}>
                                <span class="w-4 h-4 flex-shrink-0">{tab.icon!()}</span>
                            </Show>
                            {tab.label}
                        </button>
                    );
                }}
            </For>
        </div>
    );
}
