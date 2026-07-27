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
    <span class="text-[#e5e5ea] font-medium text-lg mt-2 group-hover:text-blue-400 transition-colors duration-300">{props.label}</span>
    {props.sub && <span class="text-[#e5e5ea]/60 text-sm mt-1">{props.sub}</span>}
  </div>
);

const RPC_URL = 'https://api.visionchain.co/rpc-proxy';

const rpc = async (method: string, params: any[]): Promise<any> => {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const json = await res.json();
  return json.result;
};

const Stats = (): JSX.Element => {
  // Live on-chain metrics with measured fallbacks (2026-07: 1.83M blocks, 5.0s, 106 days)
  const [blockHeight, setBlockHeight] = createSignal(1_830_000);
  const [blockTime, setBlockTime] = createSignal(5);
  const [daysLive, setDaysLive] = createSignal(106);

  onMount(async () => {
    try {
      const latest = await rpc('eth_getBlockByNumber', ['latest', false]);
      if (!latest) return;
      const height = parseInt(latest.number, 16);
      const latestTs = parseInt(latest.timestamp, 16);
      setBlockHeight(height);

      const [older, genesis] = await Promise.all([
        rpc('eth_getBlockByNumber', ['0x' + (height - 5000).toString(16), false]),
        rpc('eth_getBlockByNumber', ['0x1', false]),
      ]);
      if (older) {
        const bt = (latestTs - parseInt(older.timestamp, 16)) / 5000;
        if (bt > 0 && bt < 60) setBlockTime(Math.round(bt));
      }
      if (genesis) {
        const age = Math.floor((Date.now() / 1000 - parseInt(genesis.timestamp, 16)) / 86400);
        if (age > 0) setDaysLive(age);
      }
    } catch (e) {
      // keep fallbacks
      console.warn('[Stats] live chain fetch failed, using fallbacks', e);
    }
  });

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
          <p class="mt-6 text-xl text-[#e5e5ea] max-w-2xl mx-auto leading-relaxed">
            Engineered to handle the immense throughput required by autonomous AI agent swarms.
          </p>
        </Motion.div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-y-16 gap-x-8">
          <StatItem value={blockHeight()} suffix="+" label="Blocks Produced" sub="Mainnet · Live" />
          <StatItem value={blockTime()} suffix="s" label="Avg Block Time" sub="Measured On-Chain" />
          <StatItem value={daysLive()} suffix="" label="Days Live" sub="Since Genesis" />
          <StatItem value={97500} suffix="" label="Peak TPS" sub="Simulated High Stress" />
        </div>
      </div>
    </section>
  );
};

export default Stats;