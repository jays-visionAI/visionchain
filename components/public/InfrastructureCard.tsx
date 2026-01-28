import { JSX, Component as SolidComponent } from 'solid-js';
import { SpotlightCard } from './SpotlightCard';

interface InfrastructureCardProps {
    title: string;
    description: string;
    icon: SolidComponent<{ class?: string }>;
    state: string;
    colorClass: string;
    delay?: number;
}

export const InfrastructureCard = (props: InfrastructureCardProps): JSX.Element => {
    const Icon = props.icon;

    return (
        <SpotlightCard class="h-full" delay={props.delay}>
            <div class="h-full flex flex-col justify-between">
                <div>
                    <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/5 group-hover:scale-105 transition-transform duration-300">
                        <Icon class={`w-7 h-7 ${props.colorClass}`} />
                    </div>
                    <h3 class="text-2xl font-semibold text-white mb-4 group-hover:text-blue-200 transition-colors">
                        {props.title}
                    </h3>
                    <p class="text-gray-400 leading-relaxed text-base">
                        {props.description}
                    </p>
                </div>

                <div class="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                    <span class={`text-sm font-mono ${props.colorClass} opacity-90 font-medium`}>
                        {props.state}
                    </span>
                    <div class={`w-2 h-2 rounded-full ${props.colorClass.replace('text-', 'bg-')} animate-pulse`} />
                </div>
            </div>
        </SpotlightCard>
    );
};
