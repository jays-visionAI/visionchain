import { JSX, Show } from 'solid-js';
import { FadeIn } from './FadeIn';

interface SectionHeaderProps {
    label: string;
    title: string | JSX.Element;
    description?: string;
    centered?: boolean;
    class?: string;
}

export const SectionHeader = (props: SectionHeaderProps): JSX.Element => (
    <div class={`${props.centered !== false ? 'text-center' : 'text-left'} mb-16 md:mb-20 ${props.class ?? ''}`}>
        <FadeIn>
            <span class="text-blue-500 font-semibold tracking-wide uppercase text-xs mb-3 block">
                {props.label}
            </span>
            <h2 class="text-3xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight mb-6 leading-[1.1]">
                {props.title}
            </h2>
            <Show when={props.description}>
                <p class={`text-lg md:text-xl text-gray-400 font-medium leading-relaxed max-w-2xl ${props.centered !== false ? 'mx-auto' : ''}`}>
                    {props.description}
                </p>
            </Show>
        </FadeIn>
    </div>
);
