import { JSX, Show } from 'solid-js';
import { SpotlightCard } from './SpotlightCard';
import { ArrowUpRight } from 'lucide-solid';

interface FeatureCardProps {
    title: string;
    description: string;
    icon?: JSX.Element;
    class?: string;
    delay?: number;
    highlightColor?: string;
    visual?: JSX.Element;
    showArrow?: boolean;
}

export const FeatureCard = (props: FeatureCardProps): JSX.Element => (
    <SpotlightCard
        class={props.class}
        delay={props.delay}
        highlightColor={props.highlightColor}
    >
        <div class="flex flex-col h-full justify-between">
            {/* Background/Backlayer Visuals */}
            <Show when={props.visual}>
                <div class="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[24px]">
                    {props.visual}
                </div>
            </Show>

            {/* Main Content */}
            <div class="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <div class="flex justify-between items-start mb-6">
                        <Show when={props.icon}>
                            <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/80 group-hover:text-white group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300 shadow-inner">
                                {props.icon}
                            </div>
                        </Show>
                        <Show when={props.showArrow !== false}>
                            <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
                                <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                    <ArrowUpRight class="w-4 h-4 text-white/50" />
                                </div>
                            </div>
                        </Show>
                    </div>

                    <h3 class="text-xl md:text-2xl font-semibold text-white tracking-tight mb-3 group-hover:text-blue-200 transition-colors">
                        {props.title}
                    </h3>
                    <p class="text-gray-400 text-sm md:text-base leading-relaxed font-medium group-hover:text-gray-300 transition-colors max-w-lg">
                        {props.description}
                    </p>
                </div>

                {/* Bottom Decoration */}
                <div class="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mt-6 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
    </SpotlightCard>
);
