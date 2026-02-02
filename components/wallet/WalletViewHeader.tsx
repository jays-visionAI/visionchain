import { JSX, Show } from 'solid-js';
import { LucideIcon } from 'lucide-solid';

interface WalletViewHeaderProps {
    tag?: string;
    title: string;
    titleAccent?: string;
    description?: string;
    icon?: LucideIcon;
    rightElement?: JSX.Element;
    maxWidth?: string;
}

export const WalletViewHeader = (props: WalletViewHeaderProps) => {
    return (
        <div class={`flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 ${props.maxWidth || 'max-w-5xl'} mx-auto w-full`}>
            <div class="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
                <Show when={props.tag}>
                    <div class="flex items-center gap-2 mb-2">
                        <div class="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[9px] font-black text-blue-400 uppercase tracking-widest">
                            {props.tag}
                        </div>
                    </div>
                </Show>
                <h1 class="text-4xl font-black italic text-white tracking-tight uppercase">
                    {props.title} <Show when={props.titleAccent}><span class="text-blue-500">{props.titleAccent}</span></Show>
                </h1>
                <Show when={props.description}>
                    <p class="text-gray-500 font-medium max-w-md mt-2 leading-relaxed">
                        {props.description}
                    </p>
                </Show>
            </div>

            {/* Status indicator - hidden on mobile to save space */}
            <Show when={props.rightElement || props.icon}>
                <div class="hidden md:flex bg-[#111113]/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 items-center justify-center md:justify-start gap-4 transition-all hover:bg-[#111113]/80 group">
                    {props.rightElement || (
                        <>
                            <div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                                {props.icon && <props.icon class="w-6 h-6 text-blue-400" />}
                            </div>
                            <div>
                                <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Status</div>
                                <div class="text-lg font-black text-white italic">Active</div>
                            </div>
                        </>
                    )}
                </div>
            </Show>
        </div>
    );
};
