import { JSX } from 'solid-js';

export const VisionFullLogo = (props: { class?: string }) => {
    return (
        <div class={`flex items-baseline gap-[2px] select-none ${props.class}`}>
            {/* Stylized V */}
            <div class="relative flex items-baseline h-[1em]">
                <svg
                    viewBox="0 0 32 32"
                    class="h-[1.2em] w-auto overflow-visible"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Left part of V - White */}
                    <path
                        d="M2 4L14 30"
                        stroke="white"
                        stroke-width="5"
                        stroke-linecap="butt"
                    />
                    {/* Right part of V - Cyan */}
                    <path
                        d="M11 30L26 2"
                        stroke="#22D3EE"
                        stroke-width="5"
                        stroke-linecap="butt"
                    />
                </svg>
            </div>
            {/* Text Part */}
            <span class="font-black text-white tracking-tighter text-[1.2em] relative -left-[4px]">
                ISION&nbsp;CHAIN
            </span>
        </div>
    );
};
