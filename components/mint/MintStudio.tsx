import { createSignal, For, Show } from "solid-js";
import "./mint-studio.css";

// Icons 
const IconEthereum = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="mint-icon"><path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.37 4.35zm.056-1.579l7.362-4.34L12 0 4.63 12.05l7.37 4.34zM12 11.234l-5.636-3.32L12 4.145l5.636 3.77L12 11.234z" fill="currentColor" /></svg>;
const IconSolana = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="mint-icon"><path d="M4.09 17.41h13.91l1.83-3.11H5.92l-1.83 3.11zm0-9.87h13.91l1.83-3.11H5.92L4.09 7.54zm13.91 1.77H4.09l1.83 3.11h13.91l-1.83-3.11z" fill="currentColor" /></svg>;
const IconBase = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="mint-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" /><circle cx="12" cy="12" r="4" fill="currentColor" /></svg>;
const IconTon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="mint-icon"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#0098EA" /><path d="M11.5303 6.96967L6.46967 15.0303L9.5 13L11.5303 6.96967Z" fill="white" /><path d="M11.5303 6.96967L17.5303 15.0303L13.5 13L11.5303 6.96967Z" fill="white" fill-opacity="0.8" /></svg>;
const IconSend = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;

export default function MintStudio() {
    const [tokenType, setTokenType] = createSignal("VRC-20");
    const [tokenName, setTokenName] = createSignal("My Token");
    const [tokenSymbol, setTokenSymbol] = createSignal("MTK");
    const [initialSupply, setInitialSupply] = createSignal("1000000");

    // Toggles
    const [isMintable, setIsMintable] = createSignal(false);
    const [isBurnable, setIsBurnable] = createSignal(true);
    const [isPausable, setIsPausable] = createSignal(false);

    // Multi-chain selection
    const [selectedChains, setSelectedChains] = createSignal<string[]>(["vision", "base"]);

    const toggleChain = (id: string) => {
        if (id === "vision") return; // Vision is immutable base
        setSelectedChains(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const standards = [
        { id: "VRC-20", label: "VRC-20", desc: "FT / Meme" },
        { id: "VRC-721", label: "VRC-721", desc: "NFT" },
        { id: "VRC-404", label: "VRC-404", desc: "Hybrid" }
    ];

    const chainOptions = [
        { id: "vision", label: "Vision", icon: IconEthereum, disabled: true }, // EVM Default
        { id: "base", label: "Base", icon: IconBase }, // EVM
        { id: "solana", label: "Solana", icon: IconSolana }, // Rust
        { id: "ton", label: "TON", icon: IconTon }, // Tact
    ];

    return (
        <div class="mint-studio-root">
            <header class="mint-header">
                <div>
                    <h1 class="mint-header-title">Vision Omni-Mint Studio</h1>
                    <p class="mint-header-subtitle">Build Cross-Chain Smart Contracts with AI</p>
                </div>
            </header>

            <div class="mint-main-layout">
                {/* ── Left Panel: Form ── */}
                <div class="mint-left-panel">

                    {/* Standard Selection */}
                    <div class="mint-card" style={{ padding: "16px" }}>
                        <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.2)", padding: "4px", "border-radius": "10px" }}>
                            <For each={standards}>{(std) => (
                                <button
                                    onClick={() => setTokenType(std.id)}
                                    style={{
                                        flex: 1,
                                        background: tokenType() === std.id ? "rgba(255,255,255,0.1)" : "transparent",
                                        border: "1px solid",
                                        "border-color": tokenType() === std.id ? "rgba(255,255,255,0.2)" : "transparent",
                                        "border-radius": "8px",
                                        padding: "10px",
                                        color: tokenType() === std.id ? "#fff" : "#94a3b8",
                                        cursor: "pointer",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    <div style={{ "font-weight": 700, "font-size": "13px" }}>{std.label}</div>
                                    <div style={{ "font-size": "11px", "opacity": 0.7, "margin-top": "2px" }}>{std.desc}</div>
                                </button>
                            )}</For>
                        </div>
                    </div>

                    {/* Token Info */}
                    <div class="mint-card">
                        <h2 class="mint-card-title">Token Information</h2>
                        <div class="mint-form-group">
                            <label class="mint-label">Token Name</label>
                            <input class="mint-input" value={tokenName()} onInput={e => setTokenName(e.currentTarget.value)} placeholder="e.g. Vision Gold" />
                        </div>
                        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "16px" }}>
                            <div class="mint-form-group">
                                <label class="mint-label">Symbol</label>
                                <input class="mint-input" value={tokenSymbol()} onInput={e => setTokenSymbol(e.currentTarget.value)} placeholder="VGLD" />
                            </div>
                            <div class="mint-form-group">
                                <label class="mint-label">Initial Supply</label>
                                <input class="mint-input" value={initialSupply()} onInput={e => setInitialSupply(e.currentTarget.value)} type="number" />
                            </div>
                        </div>
                    </div>

                    {/* Features Toggle */}
                    <div class="mint-card">
                        <h2 class="mint-card-title">Features</h2>

                        <div class="mint-toggle-row">
                            <div class="mint-toggle-label-wrap">
                                <span class="mint-toggle-title">Mintable</span>
                                <span class="mint-toggle-desc">Allow authorized accounts to mint more tokens</span>
                            </div>
                            <input type="checkbox" checked={isMintable()} onChange={(e) => setIsMintable(e.currentTarget.checked)} style={{ transform: "scale(1.2)" }} />
                        </div>

                        <div class="mint-toggle-row">
                            <div class="mint-toggle-label-wrap">
                                <span class="mint-toggle-title">Burnable</span>
                                <span class="mint-toggle-desc">Token holders can destroy their tokens</span>
                            </div>
                            <input type="checkbox" checked={isBurnable()} onChange={(e) => setIsBurnable(e.currentTarget.checked)} style={{ transform: "scale(1.2)" }} />
                        </div>

                        <div class="mint-toggle-row">
                            <div class="mint-toggle-label-wrap">
                                <span class="mint-toggle-title">Pausable</span>
                                <span class="mint-toggle-desc">Useful for emergency stops during hacks</span>
                            </div>
                            <input type="checkbox" checked={isPausable()} onChange={(e) => setIsPausable(e.currentTarget.checked)} style={{ transform: "scale(1.2)" }} />
                        </div>
                    </div>

                    {/* Chain Selection */}
                    <div class="mint-card">
                        <h2 class="mint-card-title">Omnichain Targets</h2>
                        <div class="mint-chain-grid">
                            <For each={chainOptions}>{(chain) => {
                                const active = selectedChains().includes(chain.id);
                                return (
                                    <div
                                        class={`mint-chain-btn ${active ? "active" : ""}`}
                                        onClick={() => toggleChain(chain.id)}
                                        style={{ cursor: chain.disabled ? "not-allowed" : "pointer", opacity: chain.disabled ? 0.7 : 1 }}
                                    >
                                        <chain.icon />
                                        <span class="mint-chain-name">{chain.label}</span>
                                    </div>
                                );
                            }}</For>
                        </div>
                    </div>

                </div>

                {/* ── Right Panel: AI & Code ── */}
                <div class="mint-right-panel">

                    {/* Live Code Viewer */}
                    <div class="mint-code-container">
                        <div class="mint-code-header">
                            <div class="mint-code-tab active">Solidity (Vision/Base)</div>
                            <div class="mint-code-tab">Rust (Solana)</div>
                            <div class="mint-code-tab">Tact (TON)</div>
                        </div>
                        <pre class="mint-code-content">
                            <span style="color: #64748b;">// SPDX-License-Identifier: MIT</span>
                            <span style="color: #c678dd;">pragma solidity</span> <span style="color: #d19a66;">^0.8.20</span>;

                            <span style="color: #c678dd;">import</span> <span style="color: #98c379;">"@openzeppelin/contracts/token/ERC20/ERC20.sol"</span>;
                            <span style="color: #c678dd;">import</span> <span style="color: #98c379;">"@openzeppelin/contracts/access/Ownable.sol"</span>;

                            <span style="color: #c678dd;">contract</span> <span style="color: #e5c07b;">{tokenName().replace(/\s/g, '')}</span> <span style="color: #c678dd;">is</span> <span style="color: #e5c07b;">ERC20</span>, <span style="color: #e5c07b;">Ownable</span> {'{'}
                            <span style="color: #c678dd;">constructor</span>() <span style="color: #e5c07b;">ERC20</span>(<span style="color: #98c379;">"{tokenName()}"</span>, <span style="color: #98c379;">"{tokenSymbol()}"</span>) <span style="color: #e5c07b;">Ownable</span>(msg.sender) {'{'}
                            _mint(msg.sender, <span style="color: #d19a66;">{initialSupply()}</span> * 10 ** decimals());
                            {'}'}

                            <Show when={isMintable()}>
                                <span style="color: #c678dd;">function</span> <span style="color: #61afef;">mint</span>(<span style="color: #e5c07b;">address</span> to, <span style="color: #e5c07b;">uint256</span> amount) <span style="color: #c678dd;">public</span> <span style="color: #e5c07b;">onlyOwner</span> {'{'}
                                _mint(to, amount);
                                {'}'}
                            </Show>

                            <span style="color: #64748b;">// ... UI updates code in real-time as you type or ask AI.</span>
                            {'}'}
                        </pre>

                        <div class="mint-deploy-row" style={{ padding: "16px 20px" }}>
                            <div style={{ flex: 1, "font-size": "13px", color: "#94a3b8" }}>
                                Total estimated deploy fee: <strong style={{ color: "#fff" }}>50 VCN</strong> (Cross-chain included)
                            </div>
                            <button class="mint-btn-primary">
                                Deploy Omni-Contract
                            </button>
                        </div>
                    </div>

                    {/* AI Prompt Input */}
                    <div class="mint-ai-panel">
                        <div class="mint-ai-header">
                            <span style="font-size: 16px;">✨</span> AI Copilot
                        </div>
                        <div class="mint-ai-input-wrapper">
                            <input
                                class="mint-ai-input"
                                placeholder="Describe custom logics: 'Add a 3% tax on transfers sent to marketing wallet'"
                            />
                            <button class="mint-ai-submit">
                                <IconSend />
                            </button>
                        </div>
                        <div style={{ display: "flex", gap: "8px", "flex-wrap": "wrap" }}>
                            <span style={{ "font-size": "11px", background: "rgba(139, 92, 246, 0.2)", padding: "4px 8px", "border-radius": "4px", color: "#d8b4fe", cursor: "pointer" }}>+ Add buy/sell tax</span>
                            <span style={{ "font-size": "11px", background: "rgba(139, 92, 246, 0.2)", padding: "4px 8px", "border-radius": "4px", color: "#d8b4fe", cursor: "pointer" }}>+ Anti-whale limit</span>
                            <span style={{ "font-size": "11px", background: "rgba(139, 92, 246, 0.2)", padding: "4px 8px", "border-radius": "4px", color: "#d8b4fe", cursor: "pointer" }}>+ Blacklist wallets</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
