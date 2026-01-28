import { createSignal, JSX, Show } from 'solid-js';
import { Motion } from 'solid-motionone';

interface SpotlightCardProps {
    children: JSX.Element;
    class?: string;
    innerClass?: string;
    delay?: number;
    highlightColor?: string; // e.g., "#2997ff"
    spotlightOpacity?: number; // e.g., 0.08
    showBorder?: boolean;
}

export const SpotlightCard = (props: SpotlightCardProps): JSX.Element => {
    let divRef: HTMLDivElement | undefined;
    const [position, setPosition] = createSignal({ x: 0, y: 0 });
    const [opacity, setOpacity] = createSignal(0);

    const handleMouseMove = (e: MouseEvent) => {
        if (!divRef) return;
        const rect = divRef.getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setOpacity(1);
    };

    const handleMouseLeave = () => {
        setOpacity(0);
    };

    const highlightColor = props.highlightColor ?? "#2997ff";
    const spotlightOpacity = props.spotlightOpacity ?? 0.08;

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            inView={{ opacity: 1, y: 0 }}
            inViewOptions={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: props.delay ?? 0 }}
            class={`
        relative overflow-hidden rounded-[24px] group 
        border border-white/5 
        hover:shadow-2xl transition-all duration-300 hover:-translate-y-1
        ${props.class ?? ''}
      `}
        >
            {/* Moving Light Border Effect */}
            <Show when={props.showBorder !== false}>
                <div class="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none">
                    <div
                        class="absolute inset-0 animate-[spin_4s_linear_infinite]"
                        style={{
                            background: `conic-gradient(from_0deg,transparent_0_200deg,${highlightColor}_360deg)`
                        }}
                    />
                </div>
            </Show>

            {/* Inner Content Container */}
            <div
                ref={divRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                class={`
            relative h-full m-[1px] rounded-[23px] bg-[#0c0c0c] 
            flex flex-col overflow-hidden z-10
            ${props.innerClass ?? 'p-8'}
        `}
            >
                {/* Spotlight Effect */}
                <div
                    class="pointer-events-none absolute -inset-px transition duration-300 z-0"
                    style={{
                        opacity: opacity(),
                        background: `radial-gradient(600px circle at ${position().x}px ${position().y}px, ${highlightColor}${Math.floor(spotlightOpacity * 255).toString(16).padStart(2, '0')}, transparent 40%)`
                    }}
                />

                {/* Hover Gradient Overlay */}
                <div
                    class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                        background: `linear-gradient(to bottom right, ${highlightColor}0d, transparent)`
                    }}
                />

                {/* Content Layer */}
                <div class="relative z-10 h-full">
                    {props.children}
                </div>
            </div>
        </Motion.div>
    );
};
