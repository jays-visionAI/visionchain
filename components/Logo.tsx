import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

interface LogoProps {
  class?: string;
  showText?: boolean;
}

const Logo = (props: LogoProps): JSX.Element => {
  return (
    <div class="flex items-center gap-2.5 select-none">
      {/* Vision Chain Icon — connected node chain */}
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class={props.class ?? "w-8 h-8"}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="vcNavGrad" x1="6" y1="8" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#63e5f7" /> {/* Cyan */}
            <stop offset="0.55" stop-color="#37b5ff" />
            <stop offset="1" stop-color="#2b6bff" /> {/* Blue */}
          </linearGradient>
        </defs>
        <line x1="13" y1="14" x2="30" y2="12" stroke="url(#vcNavGrad)" stroke-width="3.4" stroke-linecap="round" />
        <line x1="30" y1="12" x2="19" y2="27" stroke="url(#vcNavGrad)" stroke-width="3.4" stroke-linecap="round" />
        <line x1="19" y1="27" x2="36" y2="35" stroke="url(#vcNavGrad)" stroke-width="3.4" stroke-linecap="round" />
        <circle cx="13" cy="14" r="5" fill="url(#vcNavGrad)" />
        <circle cx="30" cy="12" r="4.4" fill="url(#vcNavGrad)" />
        <circle cx="19" cy="27" r="4.4" fill="url(#vcNavGrad)" />
        <circle cx="36" cy="35" r="5.4" fill="url(#vcNavGrad)" />
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
