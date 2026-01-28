import { createSignal, Show, For } from 'solid-js';
import type { JSX } from 'solid-js';
import { Shield, Zap, Lock, Terminal, Cpu, Network, Hash, Eye, Share2, GitBranch, Binary } from 'lucide-solid';
import LightSpeedBackground from './LightSpeedBackground';
import { PageHero } from './public/PageHero';
import { SectionHeader } from './public/SectionHeader';
import { TechCard } from './public/TechCard';

const Technology = (): JSX.Element => {
  return (
    <section class="bg-black relative min-h-screen">
      {/* --- HERO SECTION --- */}
      <PageHero
        label="Whitepaper v1.0"
        icon={<Terminal class="w-3 h-3" />}
        title={
          <>
            Protocol <br class="hidden md:block" />
            <span class="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Specifications</span>
          </>
        }
        description="Deep dive into the cryptographic primitives, consensus mechanisms, and agentic infrastructure that powers Vision Chain."
        background={
          <>
            <div class="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-900/10 blur-[120px] rounded-full animate-pulse" />
            <div class="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-900/10 blur-[100px] rounded-full animate-pulse delay-1000" />
            <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
            <LightSpeedBackground />
          </>
        }
      />

      {/* --- CONTENT GRID --- */}
      <div class="max-w-[1200px] mx-auto px-6 py-24">
        <SectionHeader
          centered={false}
          label="Core Technology"
          title="Cryptographic Foundations."
          description="Advanced consensus and privacy mechanisms powering the Vision Chain network."
        />

        <div class="grid grid-cols-1 md:grid-cols-6 gap-6">
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

          <TechCard
            class="md:col-span-2"
            bgClass="!bg-[#111]"
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

          <TechCard
            class="md:col-span-2"
            title="Zero-Knowledge Sets"
            description="Privacy-preserving set membership proofs (Append-Only ZKS) allowing chain identity verification without information leakage."
            icon={<Shield />}
            delay={0.5}
          />

          <TechCard
            class="md:col-span-2"
            title="Ephemeral Sharding"
            description="Uses Verkle Trees for time-transitive, compressed state summaries, enabling coherent data sharding across the network."
            icon={<GitBranch />}
            delay={0.6}
          />

          <TechCard
            class="md:col-span-2"
            title="Cuckoo DAG Mempool"
            description="Replaces traditional Gossip with a Cuckoo Hash-based Directed Acyclic Graph for O(1) transaction lookups."
            icon={<Network />}
            delay={0.7}
          />

          <TechCard
            class="md:col-span-6"
            bgClass="!bg-gradient-to-br from-[#0c0c0c] to-[#111]"
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