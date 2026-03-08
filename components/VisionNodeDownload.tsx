/**
 * VisionNodeDownload.tsx
 * 
 * Public-facing page for users to download the Vision Node desktop application.
 * Displays OS-specific download buttons, feature overview, and installation guide.
 */

import { createSignal, onMount, Show } from 'solid-js';

// Detect user's OS
function detectOS(): 'mac' | 'windows' | 'linux' {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('win')) return 'windows';
    return 'linux';
}

// Download URLs – pinned to node-v1.1.1-beta release
const DOWNLOAD_URLS = {
    mac_arm64: 'https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.1-beta/VisionNode-1.1.1-beta-arm64.dmg',
    mac_x64: 'https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.1-beta/VisionNode-1.1.1-beta-x64.dmg',
    windows: 'https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.1-beta/VisionNode-Setup-1.1.1-beta.exe',
    linux: 'https://github.com/jays-visionAI/visionchain/releases/download/node-v1.1.1-beta/VisionNode-Setup-1.1.1-beta.exe', // CLI recommended for Linux
};

const CLI_INSTALL_CMD = 'curl -fsSL https://raw.githubusercontent.com/jays-visionAI/visionchain/main/vision-node/installers/install-macos.sh | bash';

export default function VisionNodeDownload() {
    const [userOS, setUserOS] = createSignal<'mac' | 'windows' | 'linux'>('mac');
    const [showCLI, setShowCLI] = createSignal(false);
    const [copied, setCopied] = createSignal(false);

    onMount(() => {
        setUserOS(detectOS());
    });

    function copyCommand() {
        navigator.clipboard.writeText(CLI_INSTALL_CMD);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    // SVG icons (no emoji per user rule)
    const macIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2C8.5 2 6 5 6 8c0 1.5.5 3 1.5 4L6 22h12l-1.5-10c1-1 1.5-2.5 1.5-4 0-3-2.5-6-6-6z" />
            <path d="M10 2c0 0 1-1 2-1s2 1 2 1" />
        </svg>
    );

    const windowsIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 12h9V3L3 5.25V12z" /><path d="M12 12h9V2l-9 1.25V12z" />
            <path d="M3 12h9v9L3 18.75V12z" /><path d="M12 12h9v10l-9-1.25V12z" />
        </svg>
    );

    const linuxIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="12" cy="8" r="5" /><path d="M7 13l-2 8h14l-2-8" /><circle cx="10" cy="7" r="0.8" fill="currentColor" /><circle cx="14" cy="7" r="0.8" fill="currentColor" /><path d="M10 9.5c0 0 1 1 2 1s2-1 2-1" />
        </svg>
    );

    const downloadIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );

    const terminalIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
        </svg>
    );

    const shieldIcon = () => (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
        </svg>
    );

    const storageIcon = () => (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
    );

    const coinIcon = () => (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 100 4h4a2 2 0 010 4H8" /><line x1="12" y1="6" x2="12" y2="8" /><line x1="12" y1="16" x2="12" y2="18" />
        </svg>
    );

    const chartIcon = () => (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    );

    const checkIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );

    const copyIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
    );

    return (
        <div class="min-h-screen bg-[#050505] text-white" style="font-family: 'Inter', -apple-system, sans-serif">
            {/* Hero Section */}
            <section class="relative overflow-hidden" style="padding: 120px 24px 80px">
                {/* Background glow */}
                <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:800px;height:600px;background:radial-gradient(ellipse,rgba(99,102,241,0.08) 0%,transparent 70%);pointer-events:none" />

                <div style="max-width:960px;margin:0 auto;text-align:center;position:relative">
                    {/* Logo */}
                    <div style="margin-bottom:32px">
                        <svg width="64" height="64" viewBox="0 0 48 48" fill="none" style="margin:0 auto">
                            <rect width="48" height="48" rx="14" fill="url(#hero-grad)" />
                            <path d="M14 24L20 18L26 24L32 18L38 24" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M14 30L20 24L26 30L32 24L38 30" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5" />
                            <defs><linearGradient id="hero-grad" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#6366f1" /><stop offset="1" stop-color="#06b6d4" /></linearGradient></defs>
                        </svg>
                    </div>

                    <h1 style="font-size:clamp(32px,5vw,56px);font-weight:900;letter-spacing:-1.5px;line-height:1.1;margin-bottom:16px">
                        Run a Vision Node
                    </h1>
                    <p style="font-size:18px;color:#94a3b8;max-width:560px;margin:0 auto 40px;line-height:1.6">
                        Join the Vision Chain distributed storage network.
                        Share your storage, earn VCN rewards, and power the next generation of decentralized AI.
                    </p>

                    {/* Primary Download Button (OS-specific) */}
                    <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
                        <Show when={userOS() === 'mac'}>
                            <a href={DOWNLOAD_URLS.mac_arm64}
                                style="display:inline-flex;align-items:center;gap:10px;padding:14px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:16px;font-weight:700;border-radius:12px;text-decoration:none;transition:all 0.2s;box-shadow:0 4px 24px rgba(99,102,241,0.3)"
                                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.4)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.3)'; }}>
                                {downloadIcon()}
                                Download for macOS (Apple Silicon)
                            </a>
                            <a href={DOWNLOAD_URLS.mac_x64}
                                style="font-size:13px;color:#6366f1;text-decoration:none">
                                Intel Mac? Download x64 version
                            </a>
                        </Show>

                        <Show when={userOS() === 'windows'}>
                            <a href={DOWNLOAD_URLS.windows}
                                style="display:inline-flex;align-items:center;gap:10px;padding:14px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:16px;font-weight:700;border-radius:12px;text-decoration:none;transition:all 0.2s;box-shadow:0 4px 24px rgba(99,102,241,0.3)"
                                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.4)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.3)'; }}>
                                {downloadIcon()}
                                Download for Windows
                            </a>
                        </Show>

                        <Show when={userOS() === 'linux'}>
                            <a href={DOWNLOAD_URLS.linux}
                                style="display:inline-flex;align-items:center;gap:10px;padding:14px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:16px;font-weight:700;border-radius:12px;text-decoration:none;transition:all 0.2s;box-shadow:0 4px 24px rgba(99,102,241,0.3)"
                                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.4)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.3)'; }}>
                                {downloadIcon()}
                                Download for Linux
                            </a>
                        </Show>
                    </div>

                    {/* Other OS links */}
                    <div style="display:flex;justify-content:center;gap:24px;margin-top:24px">
                        <Show when={userOS() !== 'mac'}>
                            <a href={DOWNLOAD_URLS.mac_arm64} style="font-size:13px;color:#64748b;text-decoration:none;display:flex;align-items:center;gap:6px">
                                {macIcon()} macOS
                            </a>
                        </Show>
                        <Show when={userOS() !== 'windows'}>
                            <a href={DOWNLOAD_URLS.windows} style="font-size:13px;color:#64748b;text-decoration:none;display:flex;align-items:center;gap:6px">
                                {windowsIcon()} Windows
                            </a>
                        </Show>
                        <Show when={userOS() !== 'linux'}>
                            <a href={DOWNLOAD_URLS.linux} style="font-size:13px;color:#64748b;text-decoration:none;display:flex;align-items:center;gap:6px">
                                {linuxIcon()} Linux
                            </a>
                        </Show>
                    </div>

                    {/* Version & Requirements */}
                    <p style="margin-top:20px;font-size:12px;color:#475569">
                        v1.1.0  --  Requires macOS 12+ / Windows 10+ / Ubuntu 20+
                    </p>
                </div>
            </section>

            {/* Features Grid */}
            <section style="padding:40px 24px 80px;max-width:960px;margin:0 auto">
                <h2 style="font-size:28px;font-weight:800;text-align:center;letter-spacing:-0.5px;margin-bottom:48px">
                    Why Run a Vision Node?
                </h2>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px">
                    {/* Feature 1 */}
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px">
                        <div style="color:#6366f1;margin-bottom:16px">{coinIcon()}</div>
                        <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Earn VCN Rewards</h3>
                        <p style="font-size:13px;color:#94a3b8;line-height:1.6">
                            Earn VCN tokens automatically by keeping your node online. Rewards scale with uptime and storage allocation.
                        </p>
                    </div>

                    {/* Feature 2 */}
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px">
                        <div style="color:#06b6d4;margin-bottom:16px">{storageIcon()}</div>
                        <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Distributed Storage</h3>
                        <p style="font-size:13px;color:#94a3b8;line-height:1.6">
                            Contribute spare disk space to store encrypted data chunks for the Vision Chain network.
                        </p>
                    </div>

                    {/* Feature 3 */}
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px">
                        <div style="color:#22c55e;margin-bottom:16px">{shieldIcon()}</div>
                        <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Secure & Private</h3>
                        <p style="font-size:13px;color:#94a3b8;line-height:1.6">
                            All stored data is end-to-end encrypted. Your node only holds encrypted chunks -- no raw data.
                        </p>
                    </div>

                    {/* Feature 4 */}
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px">
                        <div style="color:#f59e0b;margin-bottom:16px">{chartIcon()}</div>
                        <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Real-time Dashboard</h3>
                        <p style="font-size:13px;color:#94a3b8;line-height:1.6">
                            Monitor uptime, heartbeats, rewards, and storage usage in a beautiful built-in dashboard.
                        </p>
                    </div>
                </div>
            </section>

            {/* Node Classes */}
            <section style="padding:40px 24px 80px;max-width:960px;margin:0 auto">
                <h2 style="font-size:28px;font-weight:800;text-align:center;letter-spacing:-0.5px;margin-bottom:16px">
                    Choose Your Node Class
                </h2>
                <p style="text-align:center;color:#64748b;font-size:14px;margin-bottom:40px">
                    Select based on how much storage you want to contribute
                </p>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
                    {/* Lite */}
                    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;text-align:center">
                        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px">Lite</div>
                        <div style="font-size:28px;font-weight:900;letter-spacing:-0.5px;margin-bottom:4px">100MB - 1GB</div>
                        <div style="font-size:12px;color:#64748b;margin-bottom:20px">Minimal participation</div>
                        <div style="font-size:13px;color:#94a3b8;text-align:left;display:flex;flex-direction:column;gap:8px">
                            <div style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">{checkIcon()}</span> Earn base rewards</div>
                            <div style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">{checkIcon()}</span> 0.01x weight multiplier</div>
                            <div style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">{checkIcon()}</span> Low resource usage</div>
                        </div>
                    </div>

                    {/* Standard */}
                    <div style="background:linear-gradient(180deg,rgba(99,102,241,0.08) 0%,rgba(99,102,241,0.02) 100%);border:1px solid rgba(99,102,241,0.25);border-radius:16px;padding:32px;text-align:center;position:relative">
                        <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:4px 14px;border-radius:20px">Recommended</div>
                        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a5b4fc;margin-bottom:8px">Standard</div>
                        <div style="font-size:28px;font-weight:900;letter-spacing:-0.5px;margin-bottom:4px">1GB - 100GB</div>
                        <div style="font-size:12px;color:#64748b;margin-bottom:20px">Balanced rewards</div>
                        <div style="font-size:13px;color:#94a3b8;text-align:left;display:flex;flex-direction:column;gap:8px">
                            <div style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">{checkIcon()}</span> Higher VCN rewards</div>
                            <div style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">{checkIcon()}</span> 0.02x weight multiplier</div>
                            <div style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">{checkIcon()}</span> Priority chunk assignment</div>
                        </div>
                    </div>

                    {/* Full */}
                    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;text-align:center">
                        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px">Full</div>
                        <div style="font-size:28px;font-weight:900;letter-spacing:-0.5px;margin-bottom:4px">100GB - 1TB</div>
                        <div style="font-size:12px;color:#64748b;margin-bottom:20px">Maximum rewards</div>
                        <div style="font-size:13px;color:#94a3b8;text-align:left;display:flex;flex-direction:column;gap:8px">
                            <div style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">{checkIcon()}</span> Maximum VCN rewards</div>
                            <div style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">{checkIcon()}</span> 0.05x weight multiplier</div>
                            <div style="display:flex;align-items:center;gap:8px"><span style="color:#22c55e">{checkIcon()}</span> Full archival privileges</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section style="padding:40px 24px 80px;max-width:960px;margin:0 auto">
                <h2 style="font-size:28px;font-weight:800;text-align:center;letter-spacing:-0.5px;margin-bottom:48px">
                    Get Started in 3 Steps
                </h2>

                <div style="display:flex;flex-direction:column;gap:24px;max-width:600px;margin:0 auto">
                    {/* Step 1 */}
                    <div style="display:flex;gap:20px;align-items:flex-start">
                        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0">1</div>
                        <div>
                            <h3 style="font-size:16px;font-weight:700;margin-bottom:4px">Download & Install</h3>
                            <p style="font-size:13px;color:#94a3b8;line-height:1.5">Download the installer for your OS. Open the app -- it installs in seconds.</p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div style="display:flex;gap:20px;align-items:flex-start">
                        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0">2</div>
                        <div>
                            <h3 style="font-size:16px;font-weight:700;margin-bottom:4px">Enter Your Email</h3>
                            <p style="font-size:13px;color:#94a3b8;line-height:1.5">Enter your email and choose a node class. Your wallet and API key are generated automatically.</p>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div style="display:flex;gap:20px;align-items:flex-start">
                        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0">3</div>
                        <div>
                            <h3 style="font-size:16px;font-weight:700;margin-bottom:4px">Start Earning</h3>
                            <p style="font-size:13px;color:#94a3b8;line-height:1.5">Your node starts automatically. Monitor rewards and status in the built-in dashboard.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CLI Install (collapsible) */}
            <section style="padding:0 24px 80px;max-width:960px;margin:0 auto">
                <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px 28px">
                    <button
                        onClick={() => setShowCLI(!showCLI())}
                        style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;color:white;font-size:15px;font-weight:600;cursor:pointer;background:none;border:none;padding:0">
                        {terminalIcon()}
                        Prefer the Command Line?
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style={`margin-left:auto;transition:transform 0.2s;transform:rotate(${showCLI() ? '180' : '0'}deg)`}>
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    <Show when={showCLI()}>
                        <div style="margin-top:20px">
                            <p style="font-size:13px;color:#94a3b8;margin-bottom:12px">
                                Install using a single command (macOS / Linux):
                            </p>
                            <div style="display:flex;align-items:center;gap:8px;background:#0f0f1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 16px;overflow-x:auto">
                                <code style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#a5b4fc;white-space:nowrap;flex:1">
                                    {CLI_INSTALL_CMD}
                                </code>
                                <button
                                    onClick={copyCommand}
                                    style="flex-shrink:0;color:#64748b;cursor:pointer;padding:4px;border:none;background:none;transition:color 0.2s"
                                    title="Copy">
                                    {copied() ? <span style="color:#22c55e">{checkIcon()}</span> : copyIcon()}
                                </button>
                            </div>

                            <div style="margin-top:16px;font-size:13px;color:#64748b">
                                <p>Then run:</p>
                                <code style="display:block;font-family:'JetBrains Mono',monospace;font-size:12px;color:#94a3b8;background:#0f0f1a;border-radius:8px;padding:12px 16px;margin-top:8px;line-height:1.8">
                                    vision-node init --email you@example.com --class standard<br />
                                    vision-node start
                                </code>
                            </div>
                        </div>
                    </Show>
                </div>
            </section>

            {/* FAQ */}
            <section style="padding:0 24px 100px;max-width:960px;margin:0 auto">
                <h2 style="font-size:24px;font-weight:800;text-align:center;letter-spacing:-0.5px;margin-bottom:32px">
                    Frequently Asked Questions
                </h2>

                <div style="display:flex;flex-direction:column;gap:12px">
                    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px 24px">
                        <h4 style="font-size:14px;font-weight:700;margin-bottom:8px">How much storage do I need?</h4>
                        <p style="font-size:13px;color:#94a3b8;line-height:1.5">It depends on your chosen node class. Lite nodes need as little as 100MB, Standard uses 1-100GB, and Full nodes can allocate up to 1TB. You choose the exact amount during setup.</p>
                    </div>
                    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px 24px">
                        <h4 style="font-size:14px;font-weight:700;margin-bottom:8px">Can I run multiple nodes on one machine?</h4>
                        <p style="font-size:13px;color:#94a3b8;line-height:1.5">No. Only one Vision Node instance is allowed per machine. The app automatically prevents duplicate nodes to ensure network integrity.</p>
                    </div>
                    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px 24px">
                        <h4 style="font-size:14px;font-weight:700;margin-bottom:8px">What happens when I close the app?</h4>
                        <p style="font-size:13px;color:#94a3b8;line-height:1.5">On macOS the node continues running in the system tray. On Windows, closing the window stops the node. You can explicitly quit from the tray menu.</p>
                    </div>
                    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px 24px">
                        <h4 style="font-size:14px;font-weight:700;margin-bottom:8px">How are rewards calculated?</h4>
                        <p style="font-size:13px;color:#94a3b8;line-height:1.5">Rewards are based on your node weight (determined by class and connection mode) multiplied by uptime. Standard desktop nodes earn 0.02x weight per heartbeat interval.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
