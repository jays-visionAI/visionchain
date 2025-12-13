import { createSignal, Show, For } from 'solid-js';
import type { JSX, Component } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import { BookOpen, Code, FileText, PieChart, Briefcase, Rocket, Brain, ChevronRight, X } from 'lucide-solid';

const courses = [
    {
        title: "Blockchain Development",
        description: "Master Smart Contracts, Consensus Algorithms, and dApp architecture on Vision Chain. Step-by-step guides from zero to mainnet deployment.",
        icon: Code,
        level: "Technical"
    },
    {
        title: "AI in Blockchain",
        description: "Learn how to integrate Autonomous Agents, Large Language Models, and Inference Swarms with on-chain logic.",
        icon: Brain,
        level: "Advanced"
    },
    {
        title: "Token Economy Design",
        description: "Design sustainable, incentive-aligned token models that drive network effects and long-term value capture.",
        icon: PieChart,
        level: "Strategic"
    },
    {
        title: "Whitepaper Writing",
        description: "Structure technical documentation to effectively communicate your protocol's innovation, architecture, and vision.",
        icon: FileText,
        level: "Strategic"
    },
    {
        title: "Business Planning for VCs",
        description: "Craft compelling narratives, pitch decks, and financial models to secure funding from top-tier venture capital firms.",
        icon: Briefcase,
        level: "Business"
    },
    {
        title: "Accelerator Program",
        description: "A 12-week intensive cohort-based program to launch your project from idea to TGE with mentorship and grant funding.",
        icon: Rocket,
        level: "Program"
    }
];

interface CourseCardProps {
    course: typeof courses[0];
    idx: number;
}

const CourseCard = (props: CourseCardProps): JSX.Element => {
    let divRef: HTMLDivElement | undefined;
    const [position, setPosition] = createSignal({ x: 0, y: 0 });
    const [opacity, setOpacity] = createSignal(0);
    const Icon = props.course.icon;

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
            inViewOptions={{ once: true }}
            transition={{ delay: props.idx * 0.1, duration: 0.5 }}
            class="group rounded-3xl relative overflow-hidden border border-white/5 hover:-translate-y-1 transition-transform"
        >
            {/* Moving Light Border Effect - Extra Long Tail */}
            <div class="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
                <div class="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_200deg,#2997ff_360deg)]" />
            </div>

            <div
                ref={divRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                class="relative m-[1px] h-full p-8 rounded-[23px] bg-[#0c0c0c] z-10 overflow-hidden"
            >
                {/* Spotlight Effect */}
                <div
                    class="pointer-events-none absolute -inset-px transition duration-300 z-0"
                    style={{
                        opacity: opacity(),
                        background: `radial-gradient(600px circle at ${position().x}px ${position().y}px, rgba(41, 151, 255, 0.08), transparent 40%)`
                    }}
                />

                <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div class="relative z-10">
                    <div class="flex justify-between items-start mb-6">
                        <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform duration-300">
                            <Icon class="w-6 h-6" />
                        </div>
                        <span class="text-[10px] font-mono uppercase tracking-wider text-gray-500 border border-white/10 px-2 py-1 rounded-md">
                            {props.course.level}
                        </span>
                    </div>

                    <h3 class="text-xl font-semibold text-white mb-3 group-hover:text-blue-200 transition-colors">
                        {props.course.title}
                    </h3>
                    <p class="text-gray-400 text-sm leading-relaxed mb-6">
                        {props.course.description}
                    </p>

                    <div class="flex items-center text-sm text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 cursor-pointer">
                        View Modules <ChevronRight class="w-4 h-4 ml-1" />
                    </div>
                </div>
            </div>
        </Motion.div>
    );
}

const Academy = (): JSX.Element => {
    const [showComingSoon, setShowComingSoon] = createSignal(false);

    return (
        <section class="bg-black min-h-screen pt-32 pb-24 px-6 relative overflow-hidden">
            {/* Background Gradients */}
            <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div class="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-900/10 blur-[120px] rounded-full" />
                <div class="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-900/10 blur-[120px] rounded-full" />
            </div>

            <div class="max-w-[1200px] mx-auto relative z-10">
                {/* Hero Section */}
                <div class="text-center mb-24 max-w-4xl mx-auto">
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider mb-6">
                            <BookOpen class="w-3 h-3" />
                            <span>Vision Chain Academy</span>
                        </div>
                        <h1 class="text-5xl md:text-7xl font-semibold text-white tracking-tight mb-8">
                            Build the Future.<br />
                            <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Master the Chain.</span>
                        </h1>
                        <p class="text-xl text-gray-400 leading-relaxed mb-10 max-w-2xl mx-auto">
                            A comprehensive educational platform for developers, founders, and visionaries.
                            From writing your first smart contract to structuring your tokenomics and raising capital.
                        </p>

                        <button
                            onClick={() => setShowComingSoon(true)}
                            class="px-8 py-4 bg-white text-black rounded-full font-medium hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
                        >
                            Start Learning <ChevronRight class="w-4 h-4" />
                        </button>
                    </Motion.div>
                </div>

                {/* Curriculum Grid */}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <For each={courses}>
                        {(course, idx) => <CourseCard course={course} idx={idx()} />}
                    </For>
                </div>

                {/* Newsletter / Waitlist Section */}
                <Motion.div
                    initial={{ opacity: 0 }}
                    inView={{ opacity: 1 }}
                    inViewOptions={{ once: true }}
                    class="mt-24 p-8 md:p-12 rounded-3xl bg-[#111] border border-white/5 text-center relative overflow-hidden"
                >
                    <div class="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
                    <div class="relative z-10">
                        <h3 class="text-3xl font-semibold text-white mb-4">Ready to launch your vision?</h3>
                        <p class="text-gray-400 max-w-2xl mx-auto mb-8">
                            Join the Vision Chain Academy waitlist to get early access to our curriculum and accelerator program updates.
                        </p>
                        <div class="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                            <button class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors">
                                Join Waitlist
                            </button>
                        </div>
                    </div>
                </Motion.div>
            </div>

            {/* Coming Soon Modal */}
            <Presence>
                <Show when={showComingSoon()}>
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setShowComingSoon(false)}
                    >
                        <Motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            class="bg-[#1d1d1f] border border-white/10 p-8 rounded-2xl max-w-md w-full text-center relative shadow-2xl"
                        >
                            <button
                                onClick={() => setShowComingSoon(false)}
                                class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                            >
                                <X class="w-5 h-5" />
                            </button>

                            <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Rocket class="w-8 h-8 text-blue-400" />
                            </div>

                            <h3 class="text-2xl font-semibold text-white mb-2">Coming Soon</h3>
                            <p class="text-gray-400 mb-6 leading-relaxed">
                                The Vision Chain Academy curriculum is currently being finalized. Join the waitlist below to get notified when enrollment opens.
                            </p>

                            <button
                                onClick={() => setShowComingSoon(false)}
                                class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
                            >
                                Got it
                            </button>
                        </Motion.div>
                    </Motion.div>
                </Show>
            </Presence>
        </section>
    );
};

export default Academy;