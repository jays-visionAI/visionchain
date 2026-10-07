import { createSignal, For, Show } from 'solid-js';
import { Search, X, AlertTriangle, Wallet, FileText, Users as UsersIcon } from 'lucide-solid';
import { lookupInvestor } from '../../services/firebaseService';
import { formatUnlockRatio, type InvestorLookupResult } from '../../services/investorLookup';

/**
 * Investor lookup — "how much VCN did this person buy?", answered exactly.
 *
 * The vesting screen next door has a search box, but it filters the first 500
 * merged users in the browser: an investor past that cap reads as "not found"
 * with nothing on screen saying so. Here an email is the document key in all
 * three collections, so the answer is three direct reads and does not depend on
 * how many investors exist.
 *
 * Read-only on purpose. The deploy buttons live on the vesting screen; someone
 * checking a number should not be one mis-click from deploying a contract.
 */

const SOURCE_LABEL: Record<string, string> = {
    token_sales: 'token_sales (CSV upload)',
    vcn_purchases: 'vcn_purchases',
    users: 'users (account)',
};

const SOURCE_ICON: Record<string, any> = {
    token_sales: FileText,
    vcn_purchases: Wallet,
    users: UsersIcon,
};

const fmtAmount = (n: number | null) =>
    n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 8 });

const fmtDate = (s?: string) => {
    if (!s) return '—';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
};

export function InvestorLookup() {
    const [term, setTerm] = createSignal('');
    const [results, setResults] = createSignal<InvestorLookupResult[] | null>(null);
    const [searching, setSearching] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    /** The term the results on screen actually belong to. */
    const [searched, setSearched] = createSignal('');

    const run = async (e?: Event) => {
        e?.preventDefault();
        const q = term().trim();
        if (!q) return;
        setSearching(true);
        setError(null);
        try {
            const found = await lookupInvestor(q);
            setResults(found);
            setSearched(q);
        } catch (err: any) {
            console.error('[InvestorLookup] failed:', err);
            setError(err?.message || 'Lookup failed');
            setResults(null);
        } finally {
            setSearching(false);
        }
    };

    const clear = () => {
        setTerm('');
        setResults(null);
        setError(null);
        setSearched('');
    };

    const withRecords = () => (results() || []).filter((r) => r.records.length > 0);

    return (
        <div class="space-y-6">
            <div>
                <h2 class="text-xl font-black text-white tracking-tight">Investor Lookup</h2>
                <p class="text-xs text-slate-500 mt-1 leading-relaxed">
                    Look up a purchase by email, wallet address or partner code. An email is read directly by key, so the
                    result does not depend on how many investors exist. Read-only.
                </p>
            </div>

            <form onSubmit={run} class="flex gap-2">
                <div class="relative flex-1">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={term()}
                        onInput={(ev) => setTerm(ev.currentTarget.value)}
                        placeholder="investor@example.com · 0x… · PARTNER01"
                        spellcheck={false}
                        autocapitalize="none"
                        class="w-full bg-[#0B0E14] border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                    />
                    <Show when={term()}>
                        <button
                            type="button"
                            onClick={clear}
                            aria-label="Clear"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                            <X class="w-4 h-4" />
                        </button>
                    </Show>
                </div>
                <button
                    type="submit"
                    disabled={searching() || !term().trim()}
                    class="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-sm font-bold transition-colors"
                >
                    {searching() ? 'Searching…' : 'Search'}
                </button>
            </form>

            <Show when={error()}>
                <div class="flex items-start gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertTriangle class="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p class="text-xs text-red-300">{error()}</p>
                </div>
            </Show>

            <Show when={results() && withRecords().length === 0 && !searching()}>
                <div class="p-6 rounded-xl bg-[#0B0E14] border border-white/5 text-center">
                    <p class="text-sm text-slate-400 font-medium">No purchase recorded for “{searched()}”</p>
                    <p class="text-[11px] text-slate-600 mt-2 leading-relaxed">
                        All three sources were read and none holds a record. This is a definite answer for an email —
                        it is the document key. For a wallet address or partner code it means no record carries that
                        exact value; addresses are stored in mixed casing, so try the other form.
                    </p>
                </div>
            </Show>

            <Show when={withRecords().length > 1}>
                <p class="text-[11px] text-amber-400/80">
                    {withRecords().length} investors match this term.
                </p>
            </Show>

            <For each={withRecords()}>
                {(r) => (
                    <div class="rounded-2xl bg-[#0B0E14] border border-white/5 overflow-hidden">
                        <div class="p-5 border-b border-white/5">
                            <div class="flex flex-wrap items-end justify-between gap-4">
                                <div>
                                    <div class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                        Purchased
                                    </div>
                                    <div class="text-3xl font-black text-white tracking-tight">
                                        {fmtAmount(r.amount)} <span class="text-base text-slate-500">VCN</span>
                                    </div>
                                    <Show when={r.amountSource}>
                                        <div class="text-[10px] text-slate-600 mt-1">
                                            from {SOURCE_LABEL[r.amountSource!] || r.amountSource}
                                        </div>
                                    </Show>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm font-bold text-white break-all">{r.email}</div>
                                    <Show when={r.records.find((x) => x.walletAddress)}>
                                        <div class="text-[10px] font-mono text-slate-500 break-all mt-1">
                                            {r.records.find((x) => x.walletAddress)!.walletAddress}
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        </div>

                        <Show when={r.discrepancies.length > 0}>
                            <div class="p-5 border-b border-white/5 bg-amber-500/[0.04] space-y-3">
                                <For each={r.discrepancies}>
                                    {(d) => (
                                        <div class="flex items-start gap-2">
                                            <AlertTriangle class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                            <div>
                                                <div class="text-xs font-bold text-amber-300">
                                                    {d.field} disagrees between sources
                                                </div>
                                                <div class="text-[11px] text-slate-300 mt-1 space-y-0.5">
                                                    <For each={d.values}>
                                                        {(v) => (
                                                            <div class="font-mono">
                                                                {SOURCE_LABEL[v.source] || v.source}: {v.value}
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                                <p class="text-[11px] text-slate-500 mt-1 leading-relaxed">{d.note}</p>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>

                        <div class="divide-y divide-white/5">
                            <For each={r.records}>
                                {(rec) => {
                                    const Icon = SOURCE_ICON[rec.source] || FileText;
                                    return (
                                        <div class="p-5">
                                            <div class="flex items-center gap-2 mb-3">
                                                <Icon class="w-3.5 h-3.5 text-slate-500" />
                                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    {SOURCE_LABEL[rec.source] || rec.source}
                                                </span>
                                            </div>
                                            <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-xs">
                                                <div>
                                                    <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Amount</dt>
                                                    <dd class="text-white font-bold mt-0.5">{fmtAmount(rec.amount)}</dd>
                                                </div>
                                                <div>
                                                    <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Status</dt>
                                                    <dd class="text-slate-300 mt-0.5">{rec.status || '—'}</dd>
                                                </div>
                                                <div>
                                                    <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Partner</dt>
                                                    <dd class="text-slate-300 mt-0.5">{rec.partnerCode || '—'}</dd>
                                                </div>
                                                <div>
                                                    <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Initial unlock</dt>
                                                    <dd class="text-slate-300 mt-0.5">{formatUnlockRatio(rec.initialUnlockRatio)}</dd>
                                                </div>
                                                <div>
                                                    <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Cliff</dt>
                                                    <dd class="text-slate-300 mt-0.5">
                                                        {rec.cliffMonths === undefined || rec.cliffMonths === null ? '—' : `${rec.cliffMonths} mo`}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Vesting</dt>
                                                    <dd class="text-slate-300 mt-0.5">
                                                        {rec.vestingMonths === undefined || rec.vestingMonths === null ? '—' : `${rec.vestingMonths} mo`}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Created</dt>
                                                    <dd class="text-slate-300 mt-0.5">{fmtDate(rec.createdAt)}</dd>
                                                </div>
                                                <div>
                                                    <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Updated</dt>
                                                    <dd class="text-slate-300 mt-0.5">{fmtDate(rec.updatedAt)}</dd>
                                                </div>
                                                <Show when={rec.walletAddress}>
                                                    <div class="col-span-2 md:col-span-4">
                                                        <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Wallet</dt>
                                                        <dd class="text-slate-300 font-mono break-all mt-0.5">{rec.walletAddress}</dd>
                                                    </div>
                                                </Show>
                                                <Show when={rec.vestingContractAddress}>
                                                    <div class="col-span-2 md:col-span-4">
                                                        <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Vesting contract</dt>
                                                        <dd class="text-slate-300 font-mono break-all mt-0.5">{rec.vestingContractAddress}</dd>
                                                    </div>
                                                </Show>
                                                <Show when={rec.vestingTx}>
                                                    <div class="col-span-2 md:col-span-4">
                                                        <dt class="text-slate-600 text-[10px] uppercase tracking-wider">Vesting tx</dt>
                                                        <dd class="text-slate-300 font-mono break-all mt-0.5">{rec.vestingTx}</dd>
                                                    </div>
                                                </Show>
                                            </dl>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>

                        <Show when={r.missingSources.length > 0}>
                            <div class="px-5 py-3 bg-white/[0.02] text-[11px] text-slate-500">
                                No record in: {r.missingSources.map((m) => SOURCE_LABEL[m] || m).join(', ')}
                            </div>
                        </Show>
                    </div>
                )}
            </For>
        </div>
    );
}

export default InvestorLookup;
