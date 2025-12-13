import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

interface LogoProps {
  class?: string;
  showText?: boolean;
}

const Logo = (props: LogoProps): JSX.Element => {
  return (
    <div class="flex items-center gap-2.5 select-none">
      {/* Vision Chain Icon */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class={props.class ?? "w-8 h-8"}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="v-left-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#22d3ee" /> {/* Cyan-400 */}
            <stop offset="100%" stop-color="#2563eb" /> {/* Blue-600 */}
          </linearGradient>
          <linearGradient id="v-right-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stop-color="#1e1b4b" /> {/* Indigo-950 */}
            <stop offset="100%" stop-color="#60a5fa" /> {/* Blue-400 */}
          </linearGradient>
        </defs>

        {/* Right Arm (Darker) */}
        <path
          d="M45 80 L85 15 C88 10 95 10 98 15 C101 20 98 28 95 32 L55 95 C50 102 38 102 35 95 L30 85"
          stroke="url(#v-right-grad)"
          stroke-width="16"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        {/* Left Arm (Lighter) */}
        <path
          d="M15 15 L45 80"
          stroke="url(#v-left-grad)"
          stroke-width="16"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        {/* Center Dot */}
        <circle cx="45" cy="80" r="6" fill="#22d3ee" />
      </svg>

      {/* Text */}
      <Show when={props.showText !== false}>
        <span class="font-bold text-white text-base md:text-lg tracking-wider uppercase font-sans">
          Vision Chain
        </span>
      </Show>
    </div>
  );
};

export default Logo;