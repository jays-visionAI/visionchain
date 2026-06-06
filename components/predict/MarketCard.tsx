import { Show, For, createSignal, onMount, onCleanup, createMemo } from 'solid-js';
import { useI18n } from '../../i18n/i18nContext';

export interface PolymarketMarket {
    id: string;
    question: string;
    yes_price: number | null;
    no_price: number | null;
    volume_24h: number;
    has_volume_data?: boolean;
    liquidity: number;
    end_date: string;
    tags: string[];
    passes_rules?: boolean;
    fail_reasons?: string[];
    // Phase 2 backlog fixes (M.5):
    outcome_count?: number;
    is_binary?: boolean;
    outcomes_with_prices?: Array<{ outcome: string; price: number | null }>;
    normalize_warnings?: string[];
}

interface MarketCardProps {
    market: PolymarketMarket;
    onSimulate: (market_id: string) => void;
}

function fmtMoneyAbbrev(n: number, hasData: boolean | undefined, naLabel: string): string {
    // L.6: distinguish 'API field missing' (n/a) from 0.
    if (hasData === false) return naLabel;
    if (!isFinite(n) || n <= 0) return '$0';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return `$${n.toFixed(0)}`;
}

function fmtPrice(p: number | null | undefined): string {
    // M.12: null prices surfaced gracefully as '—' instead of '$NaN' or '— → —'.
    if (p === null || p === undefined || typeof p !== 'number' || !isFinite(p)) return '—';
    return `$${p.toFixed(2)}`;
}

// M.11: countdown is now a derived signal — recomputes on each tick (every 30s).
function computeCountdown(
    endIso: string,
    nowMs: number,
    t: (key: string, params?: Record<string, string | number>) => string,
): string {
    try {
        const end = new Date(endIso).getTime();
        if (!isFinite(end)) return '—';
        const diff = end - nowMs;
        if (diff <= 0) return t('predict.intel.card.ended');
        const days = Math.floor(diff / 86_400_000);
        const hours = Math.floor((diff % 86_400_000) / 3_600_000);
        const mins = Math.floor((diff % 3_600_000) / 60_000);
        if (days >= 1) return t('predict.intel.card.ends_in_dh', { d: days, h: hours });
        if (hours >= 1) return t('predict.intel.card.ends_in_hm', { h: hours, m: mins });
        return t('predict.intel.card.ends_in_m', { m: mins });
    } catch {
        return '—';
    }
}

// M.8: machine-code → human-readable mapping for rule-check failure reasons.
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

function truncate(s: string, n: number): string {
    if (!s) return '';
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + '…';
}

export default function MarketCard(props: MarketCardProps) {
    const { t } = useI18n();

    const passes = () => props.market.passes_rules !== false;
    const failReasonHuman = () => {
        const reasons = props.market.fail_reasons || [];
        return reasons.length > 0 ? humanizeFailReason(reasons[0], t) : t('predict.intel.card.outside_rules');
    };
    const allFailReasonsHuman = () =>
        (props.market.fail_reasons || []).map((code) => humanizeFailReason(code, t)).join(', ');
    const fullQuestion = () => props.market.question || '';
    const shortQuestion = () => truncate(fullQuestion(), 120);

    // M.11: live tick. Re-render every 30s so countdown actually advances. The
    // clock API is read at signal-set time, not at module load, keeping the
    // workflow deterministic-script constraint satisfied (not relevant here at
    // runtime but kept clean).
    const [tick, setTick] = createSignal(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    onMount(() => {
        timer = setInterval(() => setTick((t) => t + 1), 30_000);
    });
    onCleanup(() => { if (timer) clearInterval(timer); });
    const countdown = createMemo(() => {
        tick(); // subscribe
        return computeCountdown(props.market.end_date, new Date().getTime(), t);
    });

    const isBinary = () => props.market.is_binary !== false;
    const outcomeCount = () => props.market.outcome_count || 0;

    return (
        <div class="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
                <div title={fullQuestion()} class="text-sm font-medium leading-snug">
                    {shortQuestion()}
                </div>
            </div>

            <Show when={isBinary()} fallback={
                // M.5: multi-outcome market — show a small badge instead of fake yes/no prices.
                <div class="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                    {t('predict.intel.card.multi_outcome', { count: outcomeCount() })}
                </div>
            }>
                <div class="flex items-center gap-2">
                    <div class="flex-1 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                        YES <span class="text-white font-mono">{fmtPrice(props.market.yes_price)}</span>
                    </div>
                    <div class="flex-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                        NO <span class="text-white font-mono">{fmtPrice(props.market.no_price)}</span>
                    </div>
                </div>
            </Show>

            <div class="flex items-center justify-between text-[11px] text-[#9b9ba0]">
                <span>{t('predict.intel.card.vol_24h')} <span class="text-white">{fmtMoneyAbbrev(props.market.volume_24h, props.market.has_volume_data, t('predict.intel.card.na'))}</span></span>
                <span>{countdown()}</span>
            </div>

            <Show when={props.market.tags && props.market.tags.length > 0}>
                <div class="flex flex-wrap gap-1">
                    <For each={(props.market.tags || []).slice(0, 4)}>
                        {(tag) => (
                            <span class="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-[#9b9ba0]">{tag}</span>
                        )}
                    </For>
                </div>
            </Show>

            <div class="flex items-center justify-between pt-1 border-t border-white/5">
                <div class="flex items-center gap-2 text-[11px]">
                    <Show
                        when={passes()}
                        fallback={
                            <>
                                <span class="w-2 h-2 rounded-full bg-amber-400" />
                                <span class="text-amber-300" title={allFailReasonsHuman() || t('predict.intel.card.outside_rules')}>
                                    {/* M.8: humanized first reason, full list in title. */}
                                    {t('predict.intel.card.rules_filtered', { reason: failReasonHuman() })}
                                </span>
                            </>
                        }
                    >
                        <span class="w-2 h-2 rounded-full bg-emerald-400" />
                        <span class="text-emerald-300">{t('predict.intel.card.rules_ok')}</span>
                    </Show>
                </div>
                <button
                    onClick={() => props.onSimulate(props.market.id)}
                    disabled={!passes()}
                    title={passes() ? t('predict.intel.card.simulate_tooltip_ok') : failReasonHuman()}
                    class="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    {t('predict.intel.card.simulate')}
                </button>
            </div>
        </div>
    );
}
