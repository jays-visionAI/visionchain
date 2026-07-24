import { JSX } from 'solid-js';

export const VisionFullLogo = (props: { class?: string }) => {
    return (
        <div class={`flex items-center gap-[5px] select-none ${props.class}`}>
            {/* Node-network "V" mark */}
            <svg
                viewBox="0 0 100 100"
                class="h-[1.45em] w-auto overflow-visible"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id="vcMarkFull" x1="13" y1="14" x2="89" y2="83" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stop-color="#63b3f7" />
                        <stop offset="0.5" stop-color="#3f74ee" />
                        <stop offset="1" stop-color="#2b50d4" />
                    </linearGradient>
                </defs>
                <g stroke="url(#vcMarkFull)" stroke-width="6.4" stroke-linecap="round">
                    <line x1="49" y1="22.9" x2="34.4" y2="51.3" />
                    <line x1="81.3" y1="21" x2="73.3" y2="46" />
                    <line x1="73.3" y1="46" x2="61.6" y2="57.6" />
                    <line x1="61.6" y1="57.6" x2="51.7" y2="75.3" />
                </g>
                <g fill="url(#vcMarkFull)">
                    <circle cx="20.3" cy="25.1" r="7" />
                    <circle cx="49" cy="22.9" r="7" />
                    <circle cx="34.4" cy="51.3" r="7" />
                    <circle cx="81.3" cy="21" r="7.3" />
                    <circle cx="73.3" cy="46" r="7" />
                    <circle cx="61.6" cy="57.6" r="7" />
                    <circle cx="51.7" cy="75.3" r="7.6" />
                </g>
            </svg>
            {/* Wordmark */}
            <span class="font-black text-white tracking-tighter text-[1.2em]">
                VISION&nbsp;CHAIN
            </span>
        </div>
    );
};
