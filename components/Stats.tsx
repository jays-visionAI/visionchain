import { createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import type { JSX } from 'solid-js';
import { Motion } from 'solid-motionone';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
}

const AnimatedCounter = (props: AnimatedCounterProps): JSX.Element => {
  let spanRef: HTMLSpanElement | undefined;
  const [isInView, setIsInView] = createSignal(false);
  const [currentValue, setCurrentValue] = createSignal(0);

  onMount(() => {
    if (!spanRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isInView()) {
          setIsInView(true);
        }
      },
      { threshold: 0.1, rootMargin: '-50px' }
    );

    observer.observe(spanRef);

    onCleanup(() => observer.disconnect());
  });

  // Animate value when in view
  createEffect(() => {
    if (isInView()) {
      const targetValue = props.value;
      const duration = 1500; // ms
      const startTime = Date.now();
      const startValue = 0;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);

        const newValue = Math.floor(startValue + (targetValue - startValue) * eased);
        setCurrentValue(newValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  });

  return (
    <span
      ref={spanRef}
      class="text-4xl md:text-6xl font-semibold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 tracking-tight mb-2 tabular-nums"
    >
      {currentValue().toLocaleString()}{props.suffix ?? ''}
    </span>
  );
};

interface StatItemProps {
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
}

const StatItem = (props: StatItemProps): JSX.Element => (
  <div class="flex flex-col items-center justify-center p-6 text-center group cursor-default relative z-10">
    <div class="transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1">
      <AnimatedCounter value={props.value} suffix={props.suffix} />
    </div>
    <span class="text-[#86868b] font-medium text-lg mt-2 group-hover:text-blue-400 transition-colors duration-300">{props.label}</span>
    {props.sub && <span class="text-[#86868b]/60 text-sm mt-1">{props.sub}</span>}
  </div>
);

const Stats = (): JSX.Element => {
  return (
    <section class="bg-black py-32 border-t border-white/10 relative overflow-hidden">
      {/* High-tech Grid Background */}
      <div class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Subtle Top Light Source */}
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

      <div class="max-w-[1200px] mx-auto px-6 relative z-10">
        <Motion.div
          initial={{ opacity: 0 }}
          inView={{ opacity: 1 }}
          inViewOptions={{ once: true }}
          transition={{ duration: 0.8 }}
          class="text-center mb-20"
        >
          <h3 class="text-4xl md:text-6xl font-semibold text-white tracking-tight drop-shadow-lg">Vision Scale.</h3>
          <p class="mt-6 text-xl text-[#86868b] max-w-2xl mx-auto leading-relaxed">
            Engineered to handle the immense throughput required by autonomous AI agent swarms.
          </p>
        </Motion.div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-y-16 gap-x-8">
          <StatItem value={100} suffix="K+" label="Transactions on Devnet" />
          <StatItem value={1000} suffix="+" label="Smart Accounts" />
          <StatItem value={100} suffix="+" label="Observer Nodes" />
          <StatItem value={100000} suffix="" label="TPS" />
        </div>
      </div>
    </section>
  );
};

export default Stats;