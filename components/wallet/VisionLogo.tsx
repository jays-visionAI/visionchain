import { JSX } from 'solid-js';

export const VisionLogo = (props: { class?: string }) => {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class={props.class}
        >
            {/* Left Thick Column */}
            <path
                d="M32 28L46 68"
                stroke="currentColor"
                stroke-width="14"
                stroke-linecap="round"
            />
            {/* Right Thinner Column */}
            <path
                d="M68 28L54 54"
                stroke="currentColor"
                stroke-width="10"
                stroke-linecap="round"
            />
            {/* Base Dot */}
            <circle
                cx="50"
                cy="74"
                r="7"
                fill="currentColor"
            />
        </svg>
    );
};
