import { JSX } from 'solid-js';

export const VisionLogo = (props: { class?: string }) => {
    return (
        <svg
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class={props.class}
        >
            <defs>
                <radialGradient id="coinMark" cx="0.5" cy="0.42" r="0.62">
                    <stop offset="0" stop-color="#26344d" />
                    <stop offset="0.55" stop-color="#141b2b" />
                    <stop offset="1" stop-color="#0a0e18" />
                </radialGradient>
                <radialGradient id="coinMarkGlow" cx="0.32" cy="0.24" r="0.5">
                    <stop offset="0" stop-color="#4cc2ff" stop-opacity="0.16" />
                    <stop offset="1" stop-color="#4cc2ff" stop-opacity="0" />
                </radialGradient>
                <linearGradient id="vcMark" x1="13" y1="14" x2="89" y2="83" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stop-color="#5cb0f7" />
                    <stop offset="0.5" stop-color="#3f74ee" />
                    <stop offset="1" stop-color="#2b50d4" />
                </linearGradient>
            </defs>
            <circle cx="256" cy="256" r="256" fill="url(#coinMark)" />
            <circle cx="256" cy="256" r="256" fill="url(#coinMarkGlow)" />
            <g transform="translate(93 101) scale(3.2)">
                <g stroke="url(#vcMark)" stroke-width="8" stroke-linecap="round">
                    <line x1="49" y1="22.9" x2="34.4" y2="51.3" />
                    <line x1="81.3" y1="21" x2="73.3" y2="46" />
                    <line x1="73.3" y1="46" x2="61.6" y2="57.6" />
                    <line x1="61.6" y1="57.6" x2="51.7" y2="75.3" />
                </g>
                <g fill="url(#vcMark)">
                    <circle cx="20.3" cy="25.1" r="7.3" />
                    <circle cx="49" cy="22.9" r="7.3" />
                    <circle cx="34.4" cy="51.3" r="7.3" />
                    <circle cx="81.3" cy="21" r="7.6" />
                    <circle cx="73.3" cy="46" r="7.3" />
                    <circle cx="61.6" cy="57.6" r="7.3" />
                    <circle cx="51.7" cy="75.3" r="7.9" />
                </g>
            </g>
        </svg>
    );
};
