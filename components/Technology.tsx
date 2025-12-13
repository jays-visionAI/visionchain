import { createSignal, Show, For } from 'solid-js';
import type { JSX } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Shield, Zap, Lock, Terminal, Cpu, Network, Hash, Eye, Share2, GitBranch, Binary } from 'lucide-solid';
import LightSpeedBackground from './LightSpeedBackground';

interface TechSpecProps {
  label: string;
  value: string;
}

const TechSpec = (props: TechSpecProps): JSX.Element => (
  <div class="flex justify-between items-center py-2 border-b border-white/5 font-mono text-[10px] md:text-xs">
    <span class="text-gray-500">{props.label}</span>
    <span class="text-blue-400/90">{props.value}</span>
  </div>
);

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock = (props: CodeBlockProps): JSX.Element => (
  <div class="bg-black/40 rounded-lg p-4 font-mono text-[10px] md:text-xs text-gray-400 overflow-hidden border border-white/5 relative group hover:border-blue-500/20 transition-colors">
    <div class="absolute top-0 right-0 px-2 py-1 bg-white/5 text-[9px] text-gray-500 rounded-bl-lg border-b border-l border-white/5 uppercase">
      {props.language ?? "rust"}
    </div>
    <pre class="opacity-70 group-hover:opacity-100 transition-opacity"><code>{props.code}</code></pre>
  </div>
);

interface TechCardProps {
  title: string;
  description: string;
  icon: JSX.Element;
  specs?: { label: string; value: string }[];
  codeSnippet?: string;
  class?: string;
  delay?: number;
  bgClass?: string;
}

const TechCard = (props: TechCardProps): JSX.Element => {
  let divRef: HTMLDivElement | undefined;
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [opacity, setOpacity] = createSignal(0);

  const handleMouseMove = (e: MouseEvent) => {
    if (!divRef) return;
    const div = divRef;
    const rect = div.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      inView={{ opacity: 1, y: 0 }}
      inViewOptions={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: props.delay ?? 0 }}
      class={`
        relative rounded-[32px] overflow-hidden group border border-white/5 
        ${props.class ?? ''}
      `}
    >
      {/* Moving Light Border Effect */}
      <div class="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
        <div class="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
      </div>

      {/* Inner Content Mask & Container */}
      <div
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        class={`relative h-full m-[1px] rounded-[31px] overflow-hidden ${props.bgClass ?? 'bg-[#0c0c0c]'} z-10 p-6 md:p-8 transition-colors duration-500`}
      >
        {/* Spotlight Effect */}
        <div
          class="pointer-events-none absolute -inset-px transition duration-300 z-0"
          style={{
            opacity: opacity(),
            background: `radial-gradient(600px circle at ${position().x}px ${position().y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
          }}
        />

        {/* Hover Gradient */}
        <div class="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        {/* Header */}
        <div class="relative z-10 mb-6">
          <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white mb-4 border border-white/5 group-hover:scale-110 transition-transform duration-500">
            {props.icon}
          </div>
          <h3 class="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">{props.title}</h3>
          <p class="text-gray-400 text-sm leading-relaxed max-w-md">{props.description}</p>
        </div>

        {/* Content Area */}
        <div class="relative z-10 space-y-4">
          <Show when={props.specs}>
            <div class="bg-white/[0.02] rounded-xl p-4 border border-white/5">
              <For each={props.specs}>
                {(spec) => <TechSpec label={spec.label} value={spec.value} />}
              </For>
            </div>
          </Show>

          <Show when={props.codeSnippet}>
            <CodeBlock code={props.codeSnippet!} />
          </Show>
        </div>
      </div>
    </Motion.div>
  );
};

const Technology = (): JSX.Element => {
  return (
    <section class="bg-black relative min-h-screen">

      {/* --- HERO SECTION --- */}
      <div class="relative pt-32 pb-24 px-6 border-b border-white/5 overflow-hidden">
        {/* Animated Background Mesh */}
        <div class="absolute inset-0 z-0">
          <div class="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-900/10 blur-[120px] rounded-full animate-pulse" />
          <div class="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-900/10 blur-[100px] rounded-full animate-pulse delay-1000" />
          <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
        </div>

        {/* Warp Speed Effect */}
        <div class="absolute inset-0 z-0">
          <LightSpeedBackground />
        </div>

        <div class="max-w-[1200px] mx-auto text-center relative z-10">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
              <Terminal class="w-3 h-3" />
              <span>Whitepaper v1.0</span>
            </div>
            <h1 class="text-5xl md:text-8xl font-semibold text-white tracking-tighter mb-8">
              Protocol <br class="hidden md:block" />
              <span class="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Specifications</span>
            </h1>
            <p class="text-[#86868b] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Deep dive into the cryptographic primitives, consensus mechanisms, and agentic infrastructure that powers Vision Chain.
            </p>
          </Motion.div>
        </div>
      </div>

      {/* --- CONTENT GRID --- */}
      <div class="max-w-[1200px] mx-auto px-6 py-24">

        {/* Section Heading */}
        <div class="text-left mb-16">
          <Motion.span
            initial={{ opacity: 0, y: 10 }}
            inView={{ opacity: 1, y: 0 }}
            inViewOptions={{ once: true }}
            class="text-blue-500 font-semibold tracking-wide uppercase text-xs mb-3 block"
          >
            Core Technology
          </Motion.span>
          <Motion.h2
            initial={{ opacity: 0, y: 10 }}
            inView={{ opacity: 1, y: 0 }}
            inViewOptions={{ once: true }}
            transition={{ delay: 0.1 }}
            class="text-3xl md:text-5xl font-semibold text-white tracking-tight mb-6 leading-[1.1]"
          >
            Cryptographic Foundations.
          </Motion.h2>
          <Motion.p
            initial={{ opacity: 0, y: 10 }}
            inView={{ opacity: 1, y: 0 }}
            inViewOptions={{ once: true }}
            transition={{ delay: 0.2 }}
            class="text-xl text-gray-400 max-w-2xl font-medium leading-relaxed"
          >
            Advanced consensus and privacy mechanisms powering the Vision Chain network.
          </Motion.p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-6 gap-6">

          {/* Main Card: Consensus (Span 4) */}
          <TechCard
            class="md:col-span-4 min-h-[400px]"
            title="Proof of Visibility (PoV)"
            description="A novel consensus algorithm combining Layered SNARKs (Proof of Range), Verifiable Delay Functions (Proof of Randomness), and Homomorphic Time Lock Puzzles to minimize overhead while maximizing security."
            icon={<Eye />}
            delay={0.1}
            specs={[
              { label: "Consensus Type", value: "PoV + PoS Hybrid" },
              { label: "Soft Finality", value: "< 800ms" },
              { label: "Hard Finality", value: "Accumulated State Proofs" },
              { label: "Cryptography", value: "Lattice-based (LWE)" }
            ]}
          />

          {/* Side Card: SSLE (Span 2) */}
          <TechCard
            class="md:col-span-2"
            bgClass="bg-[#111]"
            title="Secret Leader Election"
            description="SSLE uses Re-randomizable Commitments to hide the identity of the next block proposer until the exact moment of proposal, preventing DoS attacks."
            icon={<Lock />}
            delay={0.2}
            codeSnippet={`impl SSLE for Validator {
  fn elect_leader(&self) -> Result<Id> {
    let commitment = self.vrf_verify()?;
    // Leader hidden until block proposal
    Ok(commitment.reveal_if_leader())
  }
}`}
          />

          {/* Row 2: INN (Span 3) */}
          <TechCard
            class="md:col-span-3 min-h-[300px]"
            title="Intent Navigation Network (INN)"
            description="The specialized engine for intent execution. Uses Account Abstraction and Relayer Registries to enable atomic settlement across diverse L1s."
            icon={<Share2 />}
            delay={0.3}
            specs={[
              { label: "Architecture", value: "Intent-Centric" },
              { label: "Execution", value: "Dutch Auctions" },
              { label: "Relayers", value: "Permissionless" }
            ]}
          />

          {/* Row 2: Homomorphic Hashing (Span 3) */}
          <TechCard
            class="md:col-span-3"
            title="Homomorphic Hashing"
            description="Data Availability Sampling (DAS) powered by LatticeHash. Nodes verify data existence via homomorphic properties without full downloads."
            icon={<Hash />}
            delay={0.4}
            codeSnippet={`// LatticeHash Calculation
fn compute_digest(chunks: &[Vec<u8>]) -> Digest {
  chunks.par_iter()
    .map(|c| lattice_hash(c))
    .sum() // Homomorphic addition
}`}
          />

          {/* Row 3: ZK Sets (Span 2) */}
          <TechCard
            class="md:col-span-2"
            title="Zero-Knowledge Sets"
            description="Privacy-preserving set membership proofs (Append-Only ZKS) allowing chain identity verification without information leakage."
            icon={<Shield />}
            delay={0.5}
          />

          {/* Row 3: Sharding (Span 2) */}
          <TechCard
            class="md:col-span-2"
            title="Ephemeral Sharding"
            description="Uses Verkle Trees for time-transitive, compressed state summaries, enabling coherent data sharding across the network."
            icon={<GitBranch />}
            delay={0.6}
          />

          {/* Row 3: Mempool (Span 2) */}
          <TechCard
            class="md:col-span-2"
            title="Cuckoo DAG Mempool"
            description="Replaces traditional Gossip with a Cuckoo Hash-based Directed Acyclic Graph for O(1) transaction lookups."
            icon={<Network />}
            delay={0.7}
          />

          {/* Row 4: Execution (Span 6) */}
          <TechCard
            class="md:col-span-6"
            bgClass="bg-gradient-to-br from-[#0c0c0c] to-[#111]"
            title="zkVM & zkProver"
            description="The execution environment utilizes Dynamic Accumulators (DASM) for efficient state management and zkSTARKs for generating post-quantum secure proofs of consensus, range, and randomness."
            icon={<Binary />}
            delay={0.8}
            specs={[
              { label: "VM Architecture", value: "zk-EVM Compatible" },
              { label: "Proof System", value: "zkSTARKs (Post-Quantum)" },
              { label: "State Mgmt", value: "Dynamic Accumulators" }
            ]}
          />

        </div>
      </div>
    </section>
  );
};

export default Technology;