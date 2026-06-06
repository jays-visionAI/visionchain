import { createSignal, createEffect, Show, For, onCleanup } from 'solid-js';
import type { PolymarketMarket } from './MarketCard';
import { useI18n } from '../../i18n/i18nContext';

const AGENT_API_URL = (() => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname.includes('staging')) {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
})();

async function callApi(action: string, params: Record<string, any>) {
    const apiKey = localStorage.getItem('vcn_agent_api_key') || '';
    const resp = await fetch(AGENT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, api_key: apiKey, ...params }),
    });
    return { ok: resp.ok, status: resp.status, body: await resp.json() };
}

interface LlmDecision {
    rationale?: string;
    evidence?: string[];
    confidence_0_1?: number;
    fair_price_yes?: number;
    decision?: 'bet_yes' | 'bet_no' | 'skip' | string;
    decision_reason?: string;
    suggested_size_usdc?: number;
    skip_reasons?: string[];
}

interface RuleCheck {
    passes?: boolean;
    failures?: string[];
    final_decision?: 'bet_yes' | 'bet_no' | 'skip' | string;
    final_size_usdc?: number;
}

interface SimulateResult {
    success?: boolean;
    decision_id?: string;
    llm_decision?: LlmDecision;
    rule_check?: RuleCheck;
    market_snapshot?: any;
    llm?: { raw_response?: string; latency_ms?: number; model?: string };
}

interface SimulatePanelProps {
    market: PolymarketMarket;
    onClose: () => void;
    onSimulated: (decision: SimulateResult) => void;
}

const NOTE_MAX = 500;
const COOLDOWN_SECS = 3;

// M.8: humanize machine codes for rule-check failures.
function humanizeFailReason(
    code: string,
    t: (key: string, params?: Record<string, string | number>) => string,
): string {
    if (!code) return t('predict.intel.card.outside_rules');
    if (code === 'allowed_categories_no_overlap') return t('predict.intel.fail.allowed_categories_no_overlap');
    if (code === 'categories_filter_no_overlap') return t('predict.intel.fail.categories_filter_no_overlap');
    if (code.startsWith('forbidden_keyword:')) {
        return t('predict.intel.fail.forbidden_keyword', { keyword: code.slice('forbidden_keyword:'.length) });
    }
    if (code === 'outside_time_window') return t('predict.intel.fail.outside_time_window');
    if (code === 'daily_loss_cap_exceeded') return t('predict.intel.fail.daily_loss_cap_exceeded');
    if (code === 'market_resolves_within_1h') return t('predict.intel.fail.market_resolves_within_1h');
    if (code === 'market_end_date_missing_or_invalid') return t('predict.intel.fail.market_end_date_missing_or_invalid');
    if (code === 'edge_below_5_cents') return t('predict.intel.fail.edge_below_5_cents');
    if (code === 'near_resolution_size_cap_exceeded_1usdc') return t('predict.intel.fail.near_resolution_size_cap_exceeded');
    if (code === 'suggested_size_exceeds_max_bet_usdc') return t('predict.intel.fail.suggested_size_exceeds_max_bet');
    if (code === 'llm_parse_error') return t('predict.intel.fail.llm_parse_error');
    return code;
}

function fmtPrice(p: number | null | undefined): string {
    if (p === null || p === undefined || typeof p !== 'number' || !isFinite(p)) return '—';
    return `$${p.toFixed(2)}`;
}

function decisionChip(
    d: string | undefined,
    t: (key: string, params?: Record<string, string | number>) => string,
) {
    if (d === 'bet_yes') return { label: t('predict.intel.simulate.chip_bet_yes'), cls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' };
    if (d === 'bet_no') return { label: t('predict.intel.simulate.chip_bet_no'), cls: 'bg-red-500/15 border-red-500/40 text-red-300' };
    return { label: t('predict.intel.simulate.chip_skip'), cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300' };
}

export default function SimulatePanel(props: SimulatePanelProps) {
    const { t } = useI18n();
    const [model, setModel] = createSignal<'gemini-2.0-flash' | 'gemini-3-flash-preview'>('gemini-2.0-flash');
    const [maxSizeHint, setMaxSizeHint] = createSignal<number>(5);
    const [note, setNote] = createSignal<string>('');
    const [loading, setLoading] = createSignal<boolean>(false);
    const [error, setError] = createSignal<string>('');
    const [result, setResult] = createSignal<SimulateResult | null>(null);
    const [cooldown, setCooldown] = createSignal<number>(0); // seconds remaining
    const [showRaw, setShowRaw] = createSignal<boolean>(false);

    let cooldownTimer: ReturnType<typeof setInterval> | null = null;

    function startCooldown() {
        setCooldown(COOLDOWN_SECS);
        if (cooldownTimer) clearInterval(cooldownTimer);
        cooldownTimer = setInterval(() => {
            const v = cooldown();
            if (v <= 1) {
                setCooldown(0);
                if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
            } else {
                setCooldown(v - 1);
            }
        }, 1000);
    }

    onCleanup(() => {
        if (cooldownTimer) clearInterval(cooldownTimer);
    });

    // close on Escape
    createEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') props.onClose();
        };
        window.addEventListener('keydown', onKey);
        onCleanup(() => window.removeEventListener('keydown', onKey));
    });

    // Audit H5: when an error response includes `charged_vcn` (non-"0"), the
    // user was actually billed despite the failure. We render that fact
    // prominently so the user doesn't assume "it just failed".
    const [errorChargedVcn, setErrorChargedVcn] = createSignal<string>('0');
    const [errorNote, setErrorNote] = createSignal<string>('');

    async function runSimulate() {
        if (loading() || cooldown() > 0) return;
        setError('');
        setErrorChargedVcn('0');
        setErrorNote('');
        setLoading(true);
        try {
            const params: Record<string, any> = {
                market_id: props.market.id,
                model: model(),
                max_size_usdc_hint: Number(maxSizeHint()) || 0,
            };
            const n = note().trim();
            if (n) params.note = n.slice(0, NOTE_MAX);
            const { ok, body } = await callApi('polymarket.simulate', params);
            if (!ok || !body.success) {
                setError(body?.error || 'Simulate failed.');
                if (body && body.charged_vcn !== undefined) {
                    setErrorChargedVcn(String(body.charged_vcn));
                }
                if (body && typeof body.note === 'string') {
                    setErrorNote(body.note);
                }
                return;
            }
            setResult(body as SimulateResult);
            // L.9: delay the onSimulated callback so Firestore write replicates
            //      before DecisionTraceTable reloads. 500ms is enough in practice;
            //      the visible result is rendered immediately so UX feels instant.
            setTimeout(() => props.onSimulated(body as SimulateResult), 500);
        } catch (e: any) {
            setError(e?.message || 'Network error.');
        } finally {
            setLoading(false);
            startCooldown();
        }
    }

    const buttonLabel = () => {
        if (loading()) return t('predict.intel.simulate.running');
        if (cooldown() > 0) return t('predict.intel.simulate.cooldown_short', { seconds: cooldown() });
        return t('predict.intel.simulate.button');
    };

    const buttonDisabled = () => loading() || cooldown() > 0;

    return (
        <div
            class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) props.onClose();
            }}
        >
            <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-[#050505] text-white">
                {/* Header */}
                <div class="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-4 sticky top-0 bg-[#050505] z-10">
                    <div>
                        <div class="text-[11px] uppercase tracking-wide text-[#6b6b70] mb-1">{t('predict.intel.simulate.title')}</div>
                        <div class="text-sm font-medium leading-snug">{props.market.question}</div>
                        <div class="mt-2 flex items-center gap-2 text-[11px] text-[#9b9ba0]">
                            <span class="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                YES <span class="text-white font-mono">{fmtPrice(props.market.yes_price)}</span>
                            </span>
                            <span class="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-300">
                                NO <span class="text-white font-mono">{fmtPrice(props.market.no_price)}</span>
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => props.onClose()}
                        class="text-[#9b9ba0] hover:text-white text-xl leading-none px-2"
                        aria-label={t('predict.intel.simulate.close')}
                    >
                        ×
                    </button>
                </div>

                {/* Form */}
                <div class="px-5 py-4 space-y-4 border-b border-white/10">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs text-[#9b9ba0] mb-1">{t('predict.intel.simulate.model')}</label>
                            <select
                                class="w-full px-3 py-2 rounded bg-black border border-white/10 text-white text-sm"
                                value={model()}
                                onChange={(e) =>
                                    setModel(e.currentTarget.value as 'gemini-2.0-flash' | 'gemini-3-flash-preview')
                                }
                            >
                                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-[#9b9ba0] mb-1">{t('predict.intel.simulate.max_size')}</label>
                            <input
                                type="number"
                                min={0}
                                max={10000}
                                class="w-full px-3 py-2 rounded bg-black border border-white/10 text-white text-sm"
                                value={maxSizeHint()}
                                onInput={(e) =>
                                    setMaxSizeHint(parseFloat(e.currentTarget.value) || 0)
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs text-[#9b9ba0] mb-1">{t('predict.intel.simulate.note')}</label>
                        <textarea
                            rows={3}
                            maxLength={NOTE_MAX}
                            class="w-full px-3 py-2 rounded bg-black border border-white/10 text-white text-sm"
                            value={note()}
                            onInput={(e) => setNote(e.currentTarget.value.slice(0, NOTE_MAX))}
                            placeholder={t('predict.intel.simulate.note_placeholder')}
                        />
                        <div class="mt-1 flex items-center justify-between text-[10px] text-[#6b6b70]">
                            <span>{t('predict.intel.simulate.note_warning')}</span>
                            <span>{note().length}/{NOTE_MAX}</span>
                        </div>
                    </div>

                    <Show when={error()}>
                        <div class="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-1.5">
                            <div>{error()}</div>
                            <Show when={parseFloat(errorChargedVcn()) > 0}>
                                <div class="px-2 py-1.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px] font-medium">
                                    ⚠ {t('predict.intel.simulate.charged_warning', { amount: errorChargedVcn() })}{errorNote() ? ` ${errorNote()}` : ''}
                                </div>
                            </Show>
                            <Show when={parseFloat(errorChargedVcn()) === 0 && errorNote()}>
                                <div class="text-[11px] text-emerald-300/80">
                                    ✓ {t('predict.intel.simulate.not_charged', { note: errorNote() })}
                                </div>
                            </Show>
                        </div>
                    </Show>

                    <div>
                        <button
                            onClick={runSimulate}
                            disabled={buttonDisabled()}
                            class="px-5 py-2 rounded-lg bg-white text-black font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {buttonLabel()}
                        </button>
                    </div>
                </div>

                {/* Result */}
                <Show when={result()}>
                    {(() => {
                        const r = result()!;
                        const llm = r.llm_decision || {};
                        const rc = r.rule_check || {};
                        const finalChip = decisionChip(rc.final_decision, t);
                        const llmChip = decisionChip(llm.decision, t);
                        const fair = llm.fair_price_yes;
                        const yp = props.market.yes_price;
                        let edge = '';
                        if (typeof fair === 'number' && typeof yp === 'number') {
                            const diff = fair - yp;
                            const sign = diff >= 0 ? '+' : '';
                            edge = `${sign}${diff.toFixed(2)}`;
                        }
                        return (
                            <div class="px-5 py-4 space-y-4">
                                {/* Final decision chip */}
                                <div class="flex items-center gap-2">
                                    <div class={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-medium ${finalChip.cls}`}>
                                        {finalChip.label}
                                    </div>
                                    <Show when={llm.decision && llm.decision !== rc.final_decision}>
                                        <div class="text-[11px] text-[#9b9ba0]">
                                            {t('predict.intel.simulate.llm_said_rules_overrode', { label: llmChip.label })}
                                        </div>
                                    </Show>
                                </div>

                                {/* Rationale */}
                                <Show when={llm.rationale}>
                                    <div class="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                                        <div class="text-[10px] uppercase tracking-wide text-[#6b6b70] mb-1">{t('predict.intel.simulate.rationale')}</div>
                                        <div class="text-sm leading-relaxed text-[#d8d8dc]">{llm.rationale}</div>
                                    </div>
                                </Show>

                                {/* Evidence */}
                                <Show when={llm.evidence && llm.evidence.length > 0}>
                                    <div>
                                        <div class="text-[10px] uppercase tracking-wide text-[#6b6b70] mb-2">{t('predict.intel.simulate.evidence')}</div>
                                        <ul class="space-y-1 text-sm text-[#d8d8dc] list-disc list-inside">
                                            <For each={llm.evidence || []}>
                                                {(item) => <li>{item}</li>}
                                            </For>
                                        </ul>
                                    </div>
                                </Show>

                                {/* Confidence + Fair price */}
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    <div class="p-3 rounded-lg bg-black/40 border border-white/10">
                                        <div class="text-[10px] uppercase tracking-wide text-[#6b6b70] mb-1">{t('predict.intel.simulate.confidence')}</div>
                                        <div class="text-base font-mono">
                                            {typeof llm.confidence_0_1 === 'number' ? llm.confidence_0_1.toFixed(2) : '—'}
                                        </div>
                                    </div>
                                    <div class="p-3 rounded-lg bg-black/40 border border-white/10">
                                        <div class="text-[10px] uppercase tracking-wide text-[#6b6b70] mb-1">{t('predict.intel.simulate.fair_price')}</div>
                                        <div class="text-base font-mono">{fmtPrice(fair)}</div>
                                    </div>
                                    <div class="p-3 rounded-lg bg-black/40 border border-white/10">
                                        <div class="text-[10px] uppercase tracking-wide text-[#6b6b70] mb-1">{t('predict.intel.simulate.market_vs_fair')}</div>
                                        <Show
                                            when={typeof yp === 'number' && isFinite(yp as number)}
                                            fallback={
                                                <div class="text-[11px] text-[#9b9ba0]">
                                                    {t('predict.intel.simulate.market_price_unavail')}
                                                </div>
                                            }
                                        >
                                            <div class="text-base font-mono">
                                                {fmtPrice(yp)} → {fmtPrice(fair)} <span class="text-[#9b9ba0] text-xs">({edge || '—'})</span>
                                            </div>
                                        </Show>
                                    </div>
                                </div>

                                {/* Rule check failures */}
                                <Show when={rc.failures && rc.failures.length > 0}>
                                    <div class="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/30">
                                        <div class="text-[10px] uppercase tracking-wide text-amber-300 mb-1">{t('predict.intel.simulate.rule_check_overrides')}</div>
                                        <ul class="space-y-0.5 text-xs text-amber-200 list-disc list-inside">
                                            <For each={rc.failures || []}>
                                                {(f) => <li>{humanizeFailReason(f, t)}</li>}
                                            </For>
                                        </ul>
                                    </div>
                                </Show>

                                {/* LLM skip reasons */}
                                <Show when={llm.skip_reasons && llm.skip_reasons.length > 0}>
                                    <div class="text-[11px] text-[#9b9ba0]">
                                        {t('predict.intel.simulate.skip_reasons_inline', { list: (llm.skip_reasons || []).join(', ') })}
                                    </div>
                                </Show>

                                {/* Raw LLM output (collapsible) */}
                                <div>
                                    <button
                                        onClick={() => setShowRaw(!showRaw())}
                                        class="text-[11px] text-[#9b9ba0] hover:text-white underline"
                                    >
                                        {showRaw() ? t('predict.intel.simulate.hide_raw') : t('predict.intel.simulate.show_raw')}
                                    </button>
                                    <Show when={showRaw()}>
                                        <pre class="mt-2 p-3 rounded bg-black/60 border border-white/10 text-[11px] text-[#9b9ba0] overflow-auto max-h-64 whitespace-pre-wrap break-words">
                                            {r.llm?.raw_response || t('predict.intel.simulate.raw_empty')}
                                        </pre>
                                    </Show>
                                </div>

                                {/* Disclaimer */}
                                <div class="px-3 py-2 rounded bg-white/[0.02] border border-white/10 text-[11px] text-[#9b9ba0] leading-relaxed">
                                    {t('predict.intel.simulate.disclaimer')}
                                </div>
                            </div>
                        );
                    })()}
                </Show>
            </div>
        </div>
    );
}
