/**
 * Investor lookup — the part that needs no database.
 *
 * An investor's VCN purchase is recorded in up to three places, all keyed by the
 * lowercased email:
 *
 *   token_sales    written by the CSV upload (admin → VCN Distribution → Upload)
 *   vcn_purchases  written by saveVcnPurchases, alongside token_sales
 *   users          the account itself; getAllUsers copies the sale amount onto it
 *
 * They can disagree, and when they do it matters: the figure an operator reads
 * is the figure an investor is paid on. So this module does not pick a winner
 * and hide the rest — it reports every source it found, says which ones differ,
 * and leaves the judgement to the person reading the screen.
 *
 * Why this is separate from firebaseService: classification and reconciliation
 * are pure functions over plain records, and keeping them out of the module that
 * imports the Firebase SDK is what makes them testable without a network, an
 * emulator or a browser.
 */

export type LookupKind = 'email' | 'wallet' | 'other';

export interface InvestorSaleRecord {
    /** Which collection this came from. */
    source: 'token_sales' | 'vcn_purchases' | 'users';
    email: string;
    /** Purchased VCN, as recorded. Null when the source holds no amount at all. */
    amount: number | null;
    partnerCode?: string;
    status?: string;
    walletAddress?: string;
    /** Initial unlock, as a ratio or a percentage exactly as stored. */
    initialUnlockRatio?: number;
    cliffMonths?: number;
    vestingMonths?: number;
    vestingTx?: string;
    vestingContractAddress?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface InvestorDiscrepancy {
    field: string;
    /** Source → value, for every source that carried the field. */
    values: Array<{ source: string; value: string }>;
    note: string;
}

export interface InvestorLookupResult {
    term: string;
    kind: LookupKind;
    /** The email the records were found under, once resolved. */
    email: string | null;
    records: InvestorSaleRecord[];
    /** The amount to read, and where it came from. Null when no source has one. */
    amount: number | null;
    amountSource: string | null;
    discrepancies: InvestorDiscrepancy[];
    /** Sources searched but holding nothing for this investor. */
    missingSources: string[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * What kind of thing was typed. The caller needs this because an email is a
 * document key — one read, no scan, no result cap — while anything else has to
 * be queried by field.
 */
export function classifyLookupTerm(raw: string): { kind: LookupKind; value: string } {
    const value = (raw || '').trim();
    if (EMAIL.test(value)) return { kind: 'email', value: value.toLowerCase() };
    if (ADDRESS.test(value)) return { kind: 'wallet', value: value.toLowerCase() };
    return { kind: 'other', value };
}

/** Amount fields differ by collection; token_sales has used both names. */
export function readAmount(data: Record<string, any> | null | undefined): number | null {
    if (!data) return null;
    const raw = data.amountToken ?? data.amount;
    if (raw === undefined || raw === null || raw === '') return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
}

const ALL_SOURCES: Array<InvestorSaleRecord['source']> = ['token_sales', 'vcn_purchases', 'users'];

/**
 * The amount an operator should read, in order of authority: the CSV upload is
 * the record of what was sold, `vcn_purchases` mirrors it, and the copy on the
 * user account is derived. A disagreement is reported, never silently resolved.
 */
const AMOUNT_PRIORITY: Array<InvestorSaleRecord['source']> = ['token_sales', 'vcn_purchases', 'users'];

function differing(records: InvestorSaleRecord[], field: keyof InvestorSaleRecord, format: (v: any) => string) {
    const present = records.filter((r) => r[field] !== undefined && r[field] !== null && r[field] !== '');
    const distinct = new Set(present.map((r) => format(r[field])));
    if (present.length < 2 || distinct.size < 2) return null;
    return present.map((r) => ({ source: r.source, value: format(r[field]) }));
}

/**
 * Turn the records found into one answer, with every disagreement spelled out.
 */
export function reconcileInvestorRecords(
    term: string,
    kind: LookupKind,
    records: InvestorSaleRecord[]
): InvestorLookupResult {
    const found = records.filter(Boolean);
    const email = found.find((r) => r.email)?.email ?? null;

    let amount: number | null = null;
    let amountSource: string | null = null;
    for (const source of AMOUNT_PRIORITY) {
        const hit = found.find((r) => r.source === source && r.amount !== null);
        if (hit) {
            amount = hit.amount;
            amountSource = hit.source;
            break;
        }
    }

    const discrepancies: InvestorDiscrepancy[] = [];

    const amounts = differing(found, 'amount', (v) => String(v));
    if (amounts) {
        discrepancies.push({
            field: 'amount',
            values: amounts,
            note:
                'The purchase quantity differs between sources. The CSV upload replaces the stored amount rather than adding to it, ' +
                'so a per-round figure uploaded over a previous one leaves the older value behind elsewhere. Settle which figure is ' +
                'correct before paying anything on it.',
        });
    }

    const wallets = differing(found, 'walletAddress', (v) => String(v).toLowerCase());
    if (wallets) {
        discrepancies.push({
            field: 'walletAddress',
            values: wallets,
            note: 'The investor is recorded against more than one wallet. A distribution would go to whichever one the paying code reads.',
        });
    }

    const partners = differing(found, 'partnerCode', (v) => String(v));
    if (partners) {
        discrepancies.push({
            field: 'partnerCode',
            values: partners,
            note: 'Partner attribution differs between sources.',
        });
    }

    for (const field of ['initialUnlockRatio', 'cliffMonths', 'vestingMonths'] as const) {
        const diff = differing(found, field, (v) => String(v));
        if (diff) {
            discrepancies.push({
                field,
                values: diff,
                note: 'Vesting terms differ between sources; the deployed contract follows whichever the deploy screen reads.',
            });
        }
    }

    return {
        term,
        kind,
        email,
        records: found,
        amount,
        amountSource,
        discrepancies,
        missingSources: ALL_SOURCES.filter((s) => !found.some((r) => r.source === s)),
    };
}

/**
 * Initial unlock is stored as a ratio in one place and as a percentage in
 * another, so render it without claiming to know which: 0.1 and 10 both mean
 * ten percent, and 0 means none.
 */
export function formatUnlockRatio(value: number | undefined | null): string {
    if (value === undefined || value === null) return '—';
    if (value === 0) return '0%';
    return value <= 1 ? `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 2)}%` : `${value}%`;
}
