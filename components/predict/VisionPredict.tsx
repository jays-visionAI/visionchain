import { createSignal, createEffect, Show, For, onMount } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';
import MarketCard, { type PolymarketMarket } from './MarketCard';
import SimulatePanel from './SimulatePanel';
import DecisionTraceTable from './DecisionTraceTable';
import { useI18n } from '../../i18n/i18nContext';

// Environment-aware API base (mirrors AgentGateway.tsx)
const AGENT_API_URL = (() => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname.includes('staging')) {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
})();

type Step = 'gate' | 'rules' | 'strategy' | 'authority' | 'console';

interface RiskRules {
    max_bet_usdc: number;
    daily_loss_cap_usdc: number;
    daily_bet_count: number;
    allowed_categories: string[];
    forbidden_keywords: string[];
    time_window: { start_hour: number; end_hour: number; timezone: string };
}

interface EligibilityResp {
    eligible: boolean;
    blocked_reason?: string | null;
    blocked_countries?: string[];
    polymarket_tos_url?: string;
    disclaimer?: string;
}

interface ConfigResp {
    enrolled: boolean;
    status: 'none' | 'active' | 'paused';
    rules: RiskRules | null;
    authority: any;
    strategy?: string;
    wallet_address?: string | null;
    created_at?: string | null;
    paused_at?: string | null;
    pause_reason?: string | null;
}

const CATEGORIES = ['Crypto', 'Tech', 'Politics', 'Sports', 'Economics', 'Pop Culture'];

async function callApi(action: string, params: Record<string, any>) {
    const apiKey = localStorage.getItem('vcn_agent_api_key') || '';
    const resp = await fetch(AGENT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, api_key: apiKey, ...params }),
    });
    return { ok: resp.ok, status: resp.status, body: await resp.json() };
}

function browserCountry(): string {
    try {
        const lang = navigator.language || '';
        const parts = lang.split('-');
        return (parts[1] || parts[0] || '').toUpperCase().slice(0, 2);
    } catch { return ''; }
}

export default function VisionPredict() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useI18n();

    const [step, setStep] = createSignal<Step>('gate');
    const [apiKey, setApiKey] = createSignal('');
    const [config, setConfig] = createSignal<ConfigResp | null>(null);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [info, setInfo] = createSignal('');

    // Gate state
    const [countryCode, setCountryCode] = createSignal(browserCountry());
    const [age18, setAge18] = createSignal(false);
    const [notUs, setNotUs] = createSignal(false);
    const [acknowledged, setAcknowledged] = createSignal(false);
    const [eligibility, setEligibility] = createSignal<EligibilityResp | null>(null);

    // Rules state
    const [maxBet, setMaxBet] = createSignal(10);
    const [dailyLoss, setDailyLoss] = createSignal(50);
    const [dailyCount, setDailyCount] = createSignal(10);
    const [selectedCats, setSelectedCats] = createSignal<string[]>(['Crypto', 'Tech']);
    const [forbidden, setForbidden] = createSignal('election, war, death');
    const [startHour, setStartHour] = createSignal(0);
    const [endHour, setEndHour] = createSignal(24);

    // Strategy state
    const [strategy, setStrategy] = createSignal<'preset' | 'custom'>('preset');

    // Authority state
    const [walletAddress, setWalletAddress] = createSignal('');

    // Console sub-tab state (Phase 2)
    type ConsoleTab = 'config' | 'intel' | 'trace';
    const [consoleTab, setConsoleTab] = createSignal<ConsoleTab>('config');

    // Market Intelligence state (Phase 2)
    const [intelOrder, setIntelOrder] = createSignal<'volume24hr' | 'liquidity' | 'competitive'>('volume24hr');
    const [intelCats, setIntelCats] = createSignal<string[]>([]);
    const [intelLoading, setIntelLoading] = createSignal(false);
    const [intelError, setIntelError] = createSignal('');
    const [markets, setMarkets] = createSignal<PolymarketMarket[]>([]);
    const [simulateMarket, setSimulateMarket] = createSignal<PolymarketMarket | null>(null);
    const [refreshKey, setRefreshKey] = createSignal(0);

    function toggleIntelCat(c: string) {
        const cur = intelCats();
        setIntelCats(cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
    }

    function intelAvailableCategories(): string[] {
        const allowed = config()?.rules?.allowed_categories || [];
        if (allowed.length === 0) return CATEGORIES;
        return CATEGORIES.filter((c) => allowed.includes(c));
    }

    async function loadMarkets() {
        setIntelLoading(true);
        setIntelError('');
        const params: Record<string, any> = {
            order: intelOrder(),
            limit: 20,
            filter_by_rules: true,
        };
        const cats = intelCats();
        if (cats.length > 0) params.categories = cats;
        const { ok, body } = await callApi('polymarket.list_markets', params);
        setIntelLoading(false);
        if (!ok || !body.success) {
            setIntelError(body?.error || 'Failed to load markets.');
            setMarkets([]);
            return;
        }
        setMarkets((body.markets || []) as PolymarketMarket[]);
    }

    onMount(async () => {
        const savedKey = localStorage.getItem('vcn_agent_api_key') || '';
        setApiKey(savedKey);
        if (!savedKey) return;
        await refreshConfig();
    });

    async function refreshConfig() {
        setLoading(true);
        setError('');
        const { ok, body } = await callApi('polymarket.config', {});
        setLoading(false);
        if (!ok || !body.success) {
            setError(body.error || 'Failed to load Vision Predict config.');
            return;
        }
        const cfg = body as ConfigResp;
        setConfig(cfg);
        if (cfg.enrolled) {
            setStep('console');
            if (cfg.wallet_address) setWalletAddress(cfg.wallet_address);
            if (cfg.rules) {
                setMaxBet(cfg.rules.max_bet_usdc);
                setDailyLoss(cfg.rules.daily_loss_cap_usdc);
                setDailyCount(cfg.rules.daily_bet_count);
                setSelectedCats(cfg.rules.allowed_categories || []);
                setForbidden((cfg.rules.forbidden_keywords || []).join(', '));
                setStartHour(cfg.rules.time_window?.start_hour ?? 0);
                setEndHour(cfg.rules.time_window?.end_hour ?? 24);
            }
        }
    }

    async function checkEligibility() {
        if (!apiKey()) {
            setError('You must register an agent first at /agent. Vision Predict needs an api_key.');
            return;
        }
        if (!age18() || !notUs() || !acknowledged()) {
            setError('Please confirm all three statements before continuing.');
            return;
        }
        const cc = (countryCode() || '').trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(cc)) {
            setError('Country code must be exactly 2 letters (ISO-3166-1 alpha-2, e.g. KR).');
            return;
        }
        setLoading(true);
        setError('');
        const { ok, body } = await callApi('polymarket.eligibility', {
            country_code: cc,
            self_attest_age_18: age18(),
            self_attest_not_us: notUs(),
        });
        setLoading(false);
        if (!ok || !body.success) {
            setError(body.error || 'Eligibility check failed.');
            return;
        }
        setEligibility(body);
        if (body.eligible) {
            setStep('rules');
        } else {
            setError(body.blocked_reason || 'Not eligible for Vision Predict.');
        }
    }

    function toggleCategory(c: string) {
        const cur = selectedCats();
        setSelectedCats(cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
    }

    function buildRules(): RiskRules {
        return {
            max_bet_usdc: maxBet(),
            daily_loss_cap_usdc: dailyLoss(),
            daily_bet_count: dailyCount(),
            allowed_categories: selectedCats(),
            forbidden_keywords: forbidden().split(',').map((s) => s.trim()).filter(Boolean),
            time_window: { start_hour: startHour(), end_hour: endHour(), timezone: 'UTC' },
        };
    }

    function validateRules(): string | null {
        if (dailyLoss() < maxBet()) return 'Daily loss cap must be at least equal to single max bet.';
        if (selectedCats().length === 0) return 'Pick at least one allowed category.';
        if (endHour() <= startHour()) return 'Time window end hour must be later than start hour.';
        return null;
    }

    async function enroll() {
        const v = validateRules();
        if (v) { setError(v); return; }
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress())) {
            setError('Enter a valid Polygon wallet address (0x... 40 hex chars).');
            return;
        }
        setLoading(true);
        setError('');
        const { ok, body } = await callApi('polymarket.enroll', {
            wallet_address: walletAddress(),
            rules: buildRules(),
            strategy: strategy(),
            acknowledged_disclaimer: true,
        });
        setLoading(false);
        if (!ok || !body.success) {
            setError(body.error || 'Enrollment failed.');
            return;
        }
        setInfo('Enrolled. Live betting is not yet enabled (Phase 3).');
        await refreshConfig();
    }

    async function updateRules() {
        const v = validateRules();
        if (v) { setError(v); return; }
        setLoading(true);
        setError('');
        const { ok, body } = await callApi('polymarket.update_rules', { rules: buildRules() });
        setLoading(false);
        if (!ok || !body.success) {
            setError(body.error || 'Update failed.');
            return;
        }
        setInfo('Risk rules updated.');
        await refreshConfig();
    }

    async function pauseAgent() {
        setLoading(true);
        setError('');
        const { ok, body } = await callApi('polymarket.pause', { reason: 'manual' });
        setLoading(false);
        if (!ok || !body.success) { setError(body.error || 'Pause failed.'); return; }
        setInfo('Agent paused.');
        await refreshConfig();
    }

    async function resumeAgent() {
        setLoading(true);
        setError('');
        const { ok, body } = await callApi('polymarket.resume', {});
        setLoading(false);
        if (!ok || !body.success) { setError(body.error || 'Resume failed.'); return; }
        setInfo('Agent resumed.');
        await refreshConfig();
    }

    return (
        <div class="min-h-screen bg-[#050505] text-white pt-20 pb-20 px-4">
            <div class="max-w-3xl mx-auto">
                <div class="mb-8">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] mb-4">
                        EXPERIMENTAL · BETA · SANDBOX
                    </div>
                    <h1 class="text-3xl md:text-4xl font-semibold tracking-tight">Vision Predict</h1>
                    <p class="mt-2 text-[#9b9ba0] text-[15px] leading-relaxed">
                        Configurable autonomous AI agent for prediction markets. Your wallet, your rules, your risk.
                        Non-custodial. No guaranteed profit.
                    </p>
                </div>

                <Show when={error()}>
                    <div class="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error()}</div>
                </Show>
                <Show when={info()}>
                    <div class="mb-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">{info()}</div>
                </Show>

                {/* Progress dots (not on console) */}
                <Show when={step() !== 'console'}>
                    <div class="flex items-center gap-2 mb-6 text-[11px] text-[#9b9ba0]">
                        <For each={[
                            ['gate', '1. Eligibility'],
                            ['rules', '2. Risk Rules'],
                            ['strategy', '3. Strategy'],
                            ['authority', '4. Activate'],
                        ] as const}>
                            {([id, label]) => (
                                <div class={`px-2.5 py-1 rounded-full border ${step() === id ? 'border-white text-white' : 'border-white/10 text-[#6b6b70]'}`}>{label}</div>
                            )}
                        </For>
                    </div>
                </Show>

                {/* Step 1 — Eligibility Gate */}
                <Show when={step() === 'gate'}>
                    <div class="p-6 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
                        <h2 class="text-lg font-medium">Eligibility check</h2>
                        <p class="text-sm text-[#9b9ba0]">
                            Polymarket prohibits US persons and several other jurisdictions. Some countries
                            classify prediction markets as gambling. You must confirm you are not in a
                            restricted jurisdiction and you understand the legal and financial risks.
                        </p>

                        <Show when={!apiKey()}>
                            <div class="px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                                You need a VisionChain agent api_key.
                                <a href="/agent" class="underline ml-1">Register an agent first →</a>
                            </div>
                        </Show>

                        <div>
                            <label class="block text-xs text-[#9b9ba0] mb-1">Country (ISO-3166-1 alpha-2)</label>
                            <input
                                type="text"
                                maxLength={2}
                                class="w-32 px-3 py-2 rounded bg-black border border-white/10 text-white uppercase tracking-widest"
                                value={countryCode()}
                                onInput={(e) => setCountryCode(e.currentTarget.value.toUpperCase())}
                                placeholder="KR"
                            />
                            <Show when={eligibility() && eligibility()!.blocked_countries}>
                                <div class="mt-2 text-[11px] text-[#6b6b70]">
                                    Blocked: {eligibility()!.blocked_countries!.join(', ')}
                                </div>
                            </Show>
                        </div>

                        <label class="flex items-start gap-3 text-sm cursor-pointer">
                            <input type="checkbox" checked={age18()} onChange={(e) => setAge18(e.currentTarget.checked)} class="mt-1" />
                            <span>I am at least 18 years old (or the age of majority in my jurisdiction, whichever is higher).</span>
                        </label>
                        <label class="flex items-start gap-3 text-sm cursor-pointer">
                            <input type="checkbox" checked={notUs()} onChange={(e) => setNotUs(e.currentTarget.checked)} class="mt-1" />
                            <span>I am NOT a US person and I am NOT accessing this service from the United States.</span>
                        </label>
                        <label class="flex items-start gap-3 text-sm cursor-pointer">
                            <input type="checkbox" checked={acknowledged()} onChange={(e) => setAcknowledged(e.currentTarget.checked)} class="mt-1" />
                            <span>
                                I understand Vision Predict is an experimental sandbox, that prediction-market
                                positions can lose 100% of capital, and that past peak returns are not predictive.
                                I am solely responsible for legal compliance in my jurisdiction. I have reviewed{' '}
                                <a href="https://polymarket.com/tos" target="_blank" rel="noreferrer" class="underline">Polymarket Terms</a>.
                            </span>
                        </label>

                        <div class="pt-2">
                            <button
                                onClick={checkEligibility}
                                disabled={loading() || !apiKey() || !age18() || !notUs() || !acknowledged()}
                                class="px-5 py-2.5 rounded-lg bg-white text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {loading() ? 'Checking…' : 'Continue →'}
                            </button>
                        </div>
                    </div>
                </Show>

                {/* Step 2 — Risk Rules */}
                <Show when={step() === 'rules'}>
                    <div class="p-6 rounded-xl border border-white/10 bg-white/[0.02] space-y-5">
                        <h2 class="text-lg font-medium">Set your guardrails</h2>
                        <p class="text-xs text-[#9b9ba0]">All rules enforced server-side and (in Phase 3) on-chain via authority.grant.</p>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <NumField label="Max single bet (USDC)" value={maxBet()} setValue={setMaxBet} min={1} max={10000} />
                            <NumField label="Daily loss cap (USDC)" value={dailyLoss()} setValue={setDailyLoss} min={1} max={50000} />
                            <NumField label="Daily bet count" value={dailyCount()} setValue={setDailyCount} min={1} max={200} />
                        </div>

                        <div>
                            <div class="text-xs text-[#9b9ba0] mb-2">Allowed market categories</div>
                            <div class="flex flex-wrap gap-2">
                                <For each={CATEGORIES}>
                                    {(c) => {
                                        const active = () => selectedCats().includes(c);
                                        return (
                                            <button
                                                onClick={() => toggleCategory(c)}
                                                class={`px-3 py-1.5 rounded-full text-xs border ${active() ? 'border-white bg-white text-black' : 'border-white/15 text-[#9b9ba0] hover:text-white'}`}
                                            >{c}</button>
                                        );
                                    }}
                                </For>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs text-[#9b9ba0] mb-1">Forbidden keywords (comma-separated)</label>
                            <input
                                type="text"
                                class="w-full px-3 py-2 rounded bg-black border border-white/10 text-white text-sm"
                                value={forbidden()}
                                onInput={(e) => setForbidden(e.currentTarget.value)}
                                placeholder="election, war, death"
                            />
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <NumField label="Active from (hour, UTC)" value={startHour()} setValue={setStartHour} min={0} max={23} />
                            <NumField label="Active until (hour, UTC)" value={endHour()} setValue={setEndHour} min={1} max={24} />
                        </div>

                        <div class="flex justify-between pt-2">
                            <button onClick={() => setStep('gate')} class="px-4 py-2 rounded-lg border border-white/15 text-sm">← Back</button>
                            <button
                                onClick={() => {
                                    const v = validateRules();
                                    if (v) { setError(v); return; }
                                    setError('');
                                    setStep('strategy');
                                }}
                                class="px-5 py-2 rounded-lg bg-white text-black font-medium"
                            >Continue →</button>
                        </div>
                    </div>
                </Show>

                {/* Step 3 — Strategy */}
                <Show when={step() === 'strategy'}>
                    <div class="p-6 rounded-xl border border-white/10 bg-white/[0.02] space-y-5">
                        <h2 class="text-lg font-medium">Pick a strategy</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <StrategyCard
                                active={strategy() === 'preset'}
                                onClick={() => setStrategy('preset')}
                                title="News-Edge (preset)"
                                desc="LLM monitors news + market mispricing within your allowed categories. Conservative position sizing."
                            />
                            <StrategyCard
                                active={strategy() === 'custom'}
                                onClick={() => setStrategy('custom')}
                                title="Custom prompt (advanced)"
                                desc="Bring your own decision prompt. You define the edge. (Phase 3 will expose prompt editor.)"
                            />
                        </div>
                        <div class="flex justify-between pt-2">
                            <button onClick={() => setStep('rules')} class="px-4 py-2 rounded-lg border border-white/15 text-sm">← Back</button>
                            <button onClick={() => setStep('authority')} class="px-5 py-2 rounded-lg bg-white text-black font-medium">Continue →</button>
                        </div>
                    </div>
                </Show>

                {/* Step 4 — Authority / Activate */}
                <Show when={step() === 'authority'}>
                    <div class="p-6 rounded-xl border border-white/10 bg-white/[0.02] space-y-5">
                        <h2 class="text-lg font-medium">Activate enrollment</h2>
                        <p class="text-xs text-[#9b9ba0]">
                            Vision Predict is non-custodial. You keep your own wallet. Enrollment records your risk rules and
                            creates an authority.grant scoped to <span class="font-mono">polymarket.bet</span>. Live betting
                            will not start until Phase 3 ships — you can pause or update rules at any time.
                        </p>
                        <div>
                            <label class="block text-xs text-[#9b9ba0] mb-1">Your Polygon wallet address</label>
                            <input
                                type="text"
                                class="w-full px-3 py-2 rounded bg-black border border-white/10 text-white text-sm font-mono"
                                value={walletAddress()}
                                onInput={(e) => setWalletAddress(e.currentTarget.value.trim())}
                                placeholder="0x..."
                            />
                            <div class="mt-1 text-[11px] text-[#6b6b70]">USDC on Polygon (chainId 137). Vision Predict will never request your private key.</div>
                        </div>

                        <div class="p-3 rounded bg-black/40 border border-white/10 text-[12px] text-[#9b9ba0] leading-relaxed">
                            <div class="text-white text-xs mb-1">Summary</div>
                            <div>Max bet: <span class="text-white">${maxBet()} USDC</span></div>
                            <div>Daily loss cap: <span class="text-white">${dailyLoss()} USDC</span></div>
                            <div>Daily bet count: <span class="text-white">{dailyCount()}</span></div>
                            <div>Categories: <span class="text-white">{selectedCats().join(', ') || '—'}</span></div>
                            <div>Active hours (UTC): <span class="text-white">{startHour().toString().padStart(2, '0')}–{endHour().toString().padStart(2, '0')}</span></div>
                            <div>Strategy: <span class="text-white">{strategy()}</span></div>
                        </div>

                        <div class="flex justify-between pt-2">
                            <button onClick={() => setStep('strategy')} class="px-4 py-2 rounded-lg border border-white/15 text-sm">← Back</button>
                            <button
                                onClick={enroll}
                                disabled={loading()}
                                class="px-5 py-2 rounded-lg bg-emerald-500 text-black font-medium disabled:opacity-40"
                            >{loading() ? 'Enrolling…' : 'Enroll & Activate'}</button>
                        </div>
                    </div>
                </Show>

                {/* Console */}
                <Show when={step() === 'console' && config()}>
                    <div class="space-y-4">
                        <div class="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-xs text-[#9b9ba0] mb-1">Status</div>
                                    <div class="flex items-center gap-2">
                                        <span class={`w-2 h-2 rounded-full ${config()!.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                        <span class="text-lg font-medium capitalize">{config()!.status}</span>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <Show when={config()!.status === 'active'}>
                                        <button onClick={pauseAgent} class="px-3 py-1.5 rounded border border-white/15 text-xs">⏸ Pause</button>
                                    </Show>
                                    <Show when={config()!.status === 'paused'}>
                                        <button onClick={resumeAgent} class="px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-300 text-xs">▶ Resume</button>
                                    </Show>
                                </div>
                            </div>
                            <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <Stat label="Max bet" value={`$${config()!.rules?.max_bet_usdc ?? 0}`} />
                                <Stat label="Daily loss cap" value={`$${config()!.rules?.daily_loss_cap_usdc ?? 0}`} />
                                <Stat label="Daily bets" value={`${config()!.rules?.daily_bet_count ?? 0}`} />
                                <Stat label="Strategy" value={config()!.strategy || '—'} />
                            </div>
                            <div class="mt-3 text-[11px] text-[#6b6b70] font-mono break-all">
                                wallet: {config()!.wallet_address || '—'}
                            </div>
                        </div>

                        {/* Console sub-tabs */}
                        <div class="flex items-center gap-2 mb-6 text-[11px] text-[#9b9ba0]">
                            <For each={[
                                ['config', t('predict.console.tabs.config')],
                                ['intel', t('predict.console.tabs.intel')],
                                ['trace', t('predict.console.tabs.trace')],
                            ] as const}>
                                {([id, label]) => (
                                    <button
                                        onClick={() => setConsoleTab(id as ConsoleTab)}
                                        class={`px-2.5 py-1 rounded-full border ${consoleTab() === id ? 'border-white text-white' : 'border-white/10 text-[#6b6b70] hover:text-white'}`}
                                    >
                                        {label}
                                    </button>
                                )}
                            </For>
                        </div>

                        {/* Config tab */}
                        <Show when={consoleTab() === 'config'}>
                            <div class="space-y-4">
                                <div class="p-6 rounded-xl border border-white/10 bg-white/[0.02] space-y-5">
                                    <div class="flex items-center justify-between">
                                        <h3 class="text-base font-medium">Edit risk rules</h3>
                                        <button onClick={updateRules} disabled={loading()} class="px-4 py-1.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-40">{loading() ? 'Saving…' : 'Save'}</button>
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <NumField label="Max single bet (USDC)" value={maxBet()} setValue={setMaxBet} min={1} max={10000} />
                                        <NumField label="Daily loss cap (USDC)" value={dailyLoss()} setValue={setDailyLoss} min={1} max={50000} />
                                        <NumField label="Daily bet count" value={dailyCount()} setValue={setDailyCount} min={1} max={200} />
                                    </div>
                                    <div>
                                        <div class="text-xs text-[#9b9ba0] mb-2">Allowed categories</div>
                                        <div class="flex flex-wrap gap-2">
                                            <For each={CATEGORIES}>
                                                {(c) => {
                                                    const active = () => selectedCats().includes(c);
                                                    return (
                                                        <button onClick={() => toggleCategory(c)} class={`px-3 py-1.5 rounded-full text-xs border ${active() ? 'border-white bg-white text-black' : 'border-white/15 text-[#9b9ba0]'}`}>{c}</button>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-xs text-[#9b9ba0] mb-1">Forbidden keywords (comma-separated)</label>
                                        <input
                                            type="text"
                                            class="w-full px-3 py-2 rounded bg-black border border-white/10 text-white text-sm"
                                            value={forbidden()}
                                            onInput={(e) => setForbidden(e.currentTarget.value)}
                                        />
                                    </div>
                                </div>

                                <div class="p-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] text-xs text-amber-200/80 leading-relaxed">
                                    Live betting (polymarket.place_bet) is not yet enabled. Phase 3 will activate
                                    order placement against Polymarket's CLOB on Polygon. Phase 1 captures your
                                    risk rules and authority scope so you are ready when Phase 3 ships.
                                </div>
                            </div>
                        </Show>

                        {/* Market Intelligence tab */}
                        <Show when={consoleTab() === 'intel'}>
                            <div class="space-y-4">
                                <div class="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
                                    <div class="flex flex-col md:flex-row md:items-end gap-3">
                                        <div class="flex-1">
                                            <div class="text-xs text-[#9b9ba0] mb-2">{t('predict.intel.filter.categories')}</div>
                                            <div class="flex flex-wrap gap-2">
                                                <For each={intelAvailableCategories()}>
                                                    {(c) => {
                                                        const active = () => intelCats().includes(c);
                                                        return (
                                                            <button
                                                                onClick={() => toggleIntelCat(c)}
                                                                class={`px-3 py-1 rounded-full text-xs border ${active() ? 'border-white bg-white text-black' : 'border-white/15 text-[#9b9ba0] hover:text-white'}`}
                                                            >
                                                                {c}
                                                            </button>
                                                        );
                                                    }}
                                                </For>
                                            </div>
                                            <Show when={intelAvailableCategories().length === 0}>
                                                <div class="text-[11px] text-[#6b6b70]">{t('predict.intel.filter.no_allowed_categories')}</div>
                                            </Show>
                                        </div>
                                        <div>
                                            <div class="text-xs text-[#9b9ba0] mb-1">{t('predict.intel.filter.order_label')}</div>
                                            <select
                                                class="px-3 py-2 rounded bg-black border border-white/10 text-white text-sm"
                                                value={intelOrder()}
                                                onChange={(e) =>
                                                    setIntelOrder(e.currentTarget.value as 'volume24hr' | 'liquidity' | 'competitive')
                                                }
                                            >
                                                <option value="volume24hr">{t('predict.intel.filter.order_volume')}</option>
                                                <option value="liquidity">{t('predict.intel.filter.order_liquidity')}</option>
                                                <option value="competitive">{t('predict.intel.filter.order_competitive')}</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={loadMarkets}
                                            disabled={intelLoading()}
                                            class="px-5 py-2 rounded-lg bg-white text-black font-medium text-sm disabled:opacity-40"
                                        >
                                            {intelLoading() ? t('predict.intel.list.loading') : t('predict.intel.list.button')}
                                        </button>
                                    </div>
                                </div>

                                <Show when={intelError()}>
                                    <div class="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                                        {intelError()}
                                    </div>
                                </Show>

                                <Show
                                    when={markets().length > 0}
                                    fallback={
                                        <Show when={!intelLoading()}>
                                            {/* L.8: friendlier empty state with explicit CTA. */}
                                            <div class="p-8 rounded-xl border border-dashed border-white/15 bg-white/[0.01] text-center space-y-3">
                                                <div class="text-3xl opacity-60">🎯</div>
                                                <div class="text-sm font-medium text-white">{t('predict.intel.empty.title')}</div>
                                                <div class="text-xs text-[#9b9ba0] max-w-md mx-auto">
                                                    {t('predict.intel.empty.subtitle')}
                                                </div>
                                            </div>
                                        </Show>
                                    }
                                >
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <For each={markets()}>
                                            {(m) => (
                                                <MarketCard
                                                    market={m}
                                                    onSimulate={(mid) => {
                                                        const target = markets().find((x) => x.id === mid);
                                                        if (target) setSimulateMarket(target);
                                                    }}
                                                />
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                        </Show>

                        {/* Decision Trace tab */}
                        <Show when={consoleTab() === 'trace'}>
                            <DecisionTraceTable apiKey={apiKey()} refreshKey={refreshKey} />
                        </Show>
                    </div>
                </Show>

                {/* Simulate modal (mounted at root so it overlays any tab) */}
                <Show when={simulateMarket()}>
                    <SimulatePanel
                        market={simulateMarket()!}
                        onClose={() => setSimulateMarket(null)}
                        onSimulated={() => setRefreshKey(refreshKey() + 1)}
                    />
                </Show>
            </div>
        </div>
    );
}

function NumField(props: { label: string; value: number; setValue: (n: number) => void; min: number; max: number }) {
    return (
        <div>
            <label class="block text-xs text-[#9b9ba0] mb-1">{props.label}</label>
            <input
                type="number"
                min={props.min}
                max={props.max}
                class="w-full px-3 py-2 rounded bg-black border border-white/10 text-white"
                value={props.value}
                onInput={(e) => props.setValue(parseFloat(e.currentTarget.value) || 0)}
            />
        </div>
    );
}

function StrategyCard(props: { active: boolean; onClick: () => void; title: string; desc: string }) {
    return (
        <button
            onClick={props.onClick}
            class={`text-left p-4 rounded-lg border transition-colors ${props.active ? 'border-white bg-white/[0.06]' : 'border-white/10 hover:border-white/30'}`}
        >
            <div class="text-sm font-medium mb-1">{props.title}</div>
            <div class="text-xs text-[#9b9ba0] leading-relaxed">{props.desc}</div>
        </button>
    );
}

function Stat(props: { label: string; value: string }) {
    return (
        <div class="p-3 rounded-lg bg-black/40 border border-white/10">
            <div class="text-[10px] uppercase tracking-wide text-[#6b6b70] mb-1">{props.label}</div>
            <div class="text-base">{props.value}</div>
        </div>
    );
}
