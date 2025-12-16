import { createSignal, For, Show } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import {
    Book,
    Code,
    Webhook,
    Terminal,
    Copy,
    Check,
    ExternalLink,
    ChevronRight,
    Zap,
    Shield,
    Clock
} from 'lucide-solid';

// API Endpoint data
const apiEndpoints = [
    {
        method: 'GET',
        path: '/api/v1/users',
        description: 'Get all users',
        auth: true
    },
    {
        method: 'POST',
        path: '/api/v1/users',
        description: 'Create a new user',
        auth: true
    },
    {
        method: 'GET',
        path: '/api/v1/chat/completions',
        description: 'Generate AI chat completion',
        auth: true
    },
    {
        method: 'POST',
        path: '/api/v1/images/generate',
        description: 'Generate image from prompt',
        auth: true
    },
    {
        method: 'GET',
        path: '/api/v1/usage',
        description: 'Get API usage statistics',
        auth: true
    }
];

const codeExample = `// Example: Generate AI completion
const response = await fetch('https://api.visionchain.co/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gemini-3-pro',
    messages: [
      { role: 'user', content: 'What is Vision Chain?' }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);`;

const methodColors: Record<string, string> = {
    GET: 'bg-green-500/20 text-green-400',
    POST: 'bg-blue-500/20 text-blue-400',
    PUT: 'bg-yellow-500/20 text-yellow-400',
    DELETE: 'bg-red-500/20 text-red-400'
};

export default function AdminApiDocs() {
    const [copiedCode, setCopiedCode] = createSignal(false);
    const location = useLocation();

    const copyCode = () => {
        navigator.clipboard.writeText(codeExample);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    // Determine which sub-page we're on
    const currentTab = () => {
        if (location.pathname.includes('/rest')) return 'rest';
        if (location.pathname.includes('/webhooks')) return 'webhooks';
        if (location.pathname.includes('/sdk')) return 'sdk';
        return 'overview';
    };

    return (
        <div class="space-y-8">
            {/* Header */}
            <div>
                <div class="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <Book class="w-4 h-4" />
                    <span>Developer</span>
                    <ChevronRight class="w-3 h-3" />
                    <span class="text-cyan-400">API Documentation</span>
                </div>
                <h1 class="text-3xl font-bold text-white">API Documentation</h1>
                <p class="text-gray-400 mt-1">Integrate Vision Chain AI into your applications.</p>
            </div>

            {/* Quick Stats */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-5">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-xl bg-cyan-500/20">
                            <Zap class="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-white">v1.0</p>
                            <p class="text-gray-400 text-sm">API Version</p>
                        </div>
                    </div>
                </div>

                <div class="rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-5">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-xl bg-green-500/20">
                            <Clock class="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-white">99.9%</p>
                            <p class="text-gray-400 text-sm">Uptime SLA</p>
                        </div>
                    </div>
                </div>

                <div class="rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-5">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-xl bg-purple-500/20">
                            <Shield class="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-white">OAuth 2.0</p>
                            <p class="text-gray-400 text-sm">Authentication</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* API Endpoints */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <div class="p-6 border-b border-white/5">
                    <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                        <Code class="w-5 h-5 text-cyan-400" />
                        Available Endpoints
                    </h2>
                </div>

                <div class="divide-y divide-white/5">
                    <For each={apiEndpoints}>
                        {(endpoint) => (
                            <div class="p-4 hover:bg-white/[0.02] transition-colors flex items-center gap-4">
                                <span class={`px-2.5 py-1 rounded-md text-xs font-bold ${methodColors[endpoint.method]}`}>
                                    {endpoint.method}
                                </span>
                                <code class="text-cyan-400 font-mono text-sm flex-1">{endpoint.path}</code>
                                <span class="text-gray-400 text-sm hidden md:block">{endpoint.description}</span>
                                <Show when={endpoint.auth}>
                                    <span class="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                                        Auth Required
                                    </span>
                                </Show>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* Code Example */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <div class="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 class="text-white font-medium flex items-center gap-2">
                        <Terminal class="w-4 h-4 text-cyan-400" />
                        Quick Start Example
                    </h3>
                    <button
                        onClick={copyCode}
                        class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-sm"
                    >
                        <Show when={copiedCode()} fallback={<><Copy class="w-4 h-4" /> Copy</>}>
                            <><Check class="w-4 h-4 text-green-400" /> Copied!</>
                        </Show>
                    </button>
                </div>

                <pre class="p-4 overflow-x-auto text-sm">
                    <code class="text-gray-300 font-mono whitespace-pre">{codeExample}</code>
                </pre>
            </div>

            {/* Resources */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                    href="#"
                    class="rounded-2xl bg-white/[0.02] border border-white/5 p-6 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all group"
                >
                    <div class="flex items-center gap-4">
                        <div class="p-3 rounded-xl bg-cyan-500/20">
                            <Webhook class="w-6 h-6 text-cyan-400" />
                        </div>
                        <div class="flex-1">
                            <h3 class="text-white font-medium group-hover:text-cyan-400 transition-colors">Webhooks Guide</h3>
                            <p class="text-gray-400 text-sm mt-1">Set up real-time event notifications</p>
                        </div>
                        <ExternalLink class="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                    </div>
                </a>

                <a
                    href="#"
                    class="rounded-2xl bg-white/[0.02] border border-white/5 p-6 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all group"
                >
                    <div class="flex items-center gap-4">
                        <div class="p-3 rounded-xl bg-purple-500/20">
                            <Terminal class="w-6 h-6 text-purple-400" />
                        </div>
                        <div class="flex-1">
                            <h3 class="text-white font-medium group-hover:text-cyan-400 transition-colors">SDKs & Libraries</h3>
                            <p class="text-gray-400 text-sm mt-1">JavaScript, Python, Go, and more</p>
                        </div>
                        <ExternalLink class="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                    </div>
                </a>
            </div>
        </div>
    );
}
