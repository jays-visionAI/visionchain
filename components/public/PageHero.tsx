import { JSX } from 'solid-js';
import { Motion } from 'solid-motionone';

interface PageHeroProps {
    label: string;
    title: string | JSX.Element;
    description: string | JSX.Element;
    icon?: JSX.Element;
    visual?: JSX.Element;
    background?: JSX.Element;
}

export const PageHero = (props: PageHeroProps): JSX.Element => (
    <div class="relative pt-32 pb-24 px-6 border-b border-white/5 overflow-hidden">
        {/* Background Layer */}
        <div class="absolute inset-0 z-0">
            {props.background}
        </div>

        {/* Content Layer */}
        <div class="max-w-[1200px] mx-auto text-center relative z-10">
            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, easing: "ease-out" }}
            >
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
                    {props.icon}
                    <span>{props.label}</span>
                </div>
                <h1 class="text-5xl md:text-8xl font-semibold text-white tracking-tighter mb-8 leading-tight">
                    {props.title}
                </h1>
                <p class="text-[#86868b] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                    {props.description}
                </p>
                {props.visual}
            </Motion.div>
        </div>
    </div>
);
