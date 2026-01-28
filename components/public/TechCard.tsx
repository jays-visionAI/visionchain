import { JSX, Show, For } from 'solid-js';
import { SpotlightCard } from './SpotlightCard';

interface TechSpecProps {
    label: string;
    value: string;
}

const TechSpec = (props: TechSpecProps): JSX.Element => (
    <div class="flex justify-between items-center py-2 border-b border-white/5 font-mono text-[10px] md:text-xs">
        <span class="text-gray-500">{props.label}</span>
        <span class="text-blue-400/90">{props.value}</span>
    </div>
);

interface CodeBlockProps {
    code: string;
    language?: string;
}

const CodeBlock = (props: CodeBlockProps): JSX.Element => (
    <div class="bg-black/40 rounded-lg p-4 font-mono text-[10px] md:text-xs text-gray-400 overflow-hidden border border-white/5 relative group hover:border-blue-500/20 transition-colors">
        <div class="absolute top-0 right-0 px-2 py-1 bg-white/5 text-[9px] text-gray-500 rounded-bl-lg border-b border-l border-white/5 uppercase">
            {props.language ?? "rust"}
        </div>
        <pre class="opacity-70 group-hover:opacity-100 transition-opacity"><code>{props.code}</code></pre>
    </div>
);

interface TechCardProps {
    title: string;
    description: string;
    icon: JSX.Element;
    specs?: { label: string; value: string }[];
    codeSnippet?: string;
    class?: string;
    delay?: number;
    bgClass?: string;
}

export const TechCard = (props: TechCardProps): JSX.Element => (
    <SpotlightCard
        class={props.class}
        innerClass={`p-6 md:p-8 ${props.bgClass ?? ''}`}
        delay={props.delay}
    >
        <div class="relative z-10 mb-6">
            <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white mb-4 border border-white/5 group-hover:scale-110 transition-transform duration-500">
                {props.icon}
            </div>
            <h3 class="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2 group-hover:text-blue-200 transition-colors">
                {props.title}
            </h3>
            <p class="text-gray-400 text-sm leading-relaxed max-w-md group-hover:text-gray-300 transition-colors">
                {props.description}
            </p>
        </div>

        <div class="relative z-10 space-y-4">
            <Show when={props.specs}>
                <div class="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                    <For each={props.specs}>
                        {(spec) => <TechSpec label={spec.label} value={spec.value} />}
                    </For>
                </div>
            </Show>

            <Show when={props.codeSnippet}>
                <CodeBlock code={props.codeSnippet!} />
            </Show>
        </div>
    </SpotlightCard>
);
