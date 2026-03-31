import { createSignal, Show, For, createMemo } from 'solid-js';
import * as XLSX from 'xlsx';

interface CompareRecord {
    date: string;
    buyer: string;
    email: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    paymentMethod: string;
    status: string;
    note: string;
}

interface FileData {
    name: string;
    records: CompareRecord[];
    size: number;
}

interface Issue {
    type: 'mismatch' | 'missing' | 'duplicate' | 'calc_error' | 'data_inconsistency';
    severity: 'high' | 'medium' | 'low';
    key: string;
    description: string;
    details: string[];
    files: string[];
}

const FILE_COLORS = ['text-blue-400', 'text-emerald-400', 'text-amber-400'];
const FILE_BG = ['bg-blue-500/10 border-blue-500/20', 'bg-emerald-500/10 border-emerald-500/20', 'bg-amber-500/10 border-amber-500/20'];
const FILE_DOT = ['bg-blue-400', 'bg-emerald-400', 'bg-amber-400'];

export const SalesCompare = () => {
    const [files, setFiles] = createSignal<(FileData | null)[]>([null, null, null]);
    const [issues, setIssues] = createSignal<Issue[]>([]);
    const [isAnalyzing, setIsAnalyzing] = createSignal(false);
    const [analyzed, setAnalyzed] = createSignal(false);
    const [filterSeverity, setFilterSeverity] = createSignal<'all' | 'high' | 'medium' | 'low'>('all');

    const parseExcel = async (file: File): Promise<CompareRecord[]> => {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!json.length) return [];

        const keys = Object.keys(json[0]);
        const find = (cs: string[]) => keys.find(k => cs.some(c => k.toLowerCase().includes(c.toLowerCase())));

        const dateCol = find(['date', '날짜', '일자']);
        const buyerCol = find(['buyer', '구매자', '이름', 'name', '성명']);
        const emailCol = find(['email', '이메일']);
        const productCol = find(['product', '상품', '제품', '품목', 'item']);
        const qtyCol = find(['quantity', '수량', 'qty']);
        const priceCol = find(['price', '단가', '가격']);
        const totalCol = find(['total', '합계', '총액', '금액', 'amount']);
        const paymentCol = find(['payment', '결제', '결제방법', '결제수단']);
        const statusCol = find(['status', '상태']);
        const noteCol = find(['note', '비고', '메모', 'remark']);

        return json.map(row => {
            const qty = Number(qtyCol ? row[qtyCol] : 0) || 0;
            const price = Number(priceCol ? row[priceCol] : 0) || 0;
            const total = Number(totalCol ? row[totalCol] : 0) || (qty * price);
            return {
                date: dateCol ? String(row[dateCol]) : '',
                buyer: buyerCol ? String(row[buyerCol]) : '',
                email: emailCol ? String(row[emailCol]) : '',
                productName: productCol ? String(row[productCol]) : '',
                quantity: qty, unitPrice: price, totalAmount: total,
                paymentMethod: paymentCol ? String(row[paymentCol]) : '',
                status: statusCol ? String(row[statusCol]) : '',
                note: noteCol ? String(row[noteCol]) : '',
            };
        });
    };

    const handleFileSelect = async (index: number, e: any) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext || '')) return;
        try {
            const records = await parseExcel(f);
            const updated = [...files()];
            updated[index] = { name: f.name, records, size: f.size };
            setFiles(updated);
            setAnalyzed(false);
            setIssues([]);
        } catch (err) {
            console.error('Parse failed:', err);
        }
    };

    const removeFile = (index: number) => {
        const updated = [...files()];
        updated[index] = null;
        setFiles(updated);
        setAnalyzed(false);
        setIssues([]);
    };

    const loadedCount = createMemo(() => files().filter(f => f !== null).length);

    const makeKey = (r: CompareRecord) => {
        return `${r.email || r.buyer}|${r.date}|${r.productName}`.toLowerCase().trim();
    };

    const runAnalysis = () => {
        setIsAnalyzing(true);
        const loaded = files().filter(f => f !== null) as FileData[];
        const foundIssues: Issue[] = [];

        // Build maps per file
        const fileMaps = loaded.map(f => {
            const map = new Map<string, CompareRecord[]>();
            f.records.forEach(r => {
                const key = makeKey(r);
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(r);
            });
            return map;
        });

        // 1. Duplicates within each file
        loaded.forEach((f, fi) => {
            fileMaps[fi].forEach((recs, key) => {
                if (recs.length > 1) {
                    foundIssues.push({
                        type: 'duplicate', severity: 'high', key,
                        description: `중복 레코드 ${recs.length}건 발견`,
                        details: [`파일 "${f.name}"에서 동일 키(${key})로 ${recs.length}건 존재`, ...recs.map((r, i) => `  #${i + 1}: 수량=${r.quantity}, 금액=${r.totalAmount.toLocaleString()}`)],
                        files: [f.name],
                    });
                }
            });
        });

        // 2. Calculation errors (qty * price != total)
        loaded.forEach(f => {
            f.records.forEach(r => {
                if (r.quantity > 0 && r.unitPrice > 0 && r.totalAmount > 0) {
                    const expected = r.quantity * r.unitPrice;
                    if (Math.abs(expected - r.totalAmount) > 1) {
                        foundIssues.push({
                            type: 'calc_error', severity: 'medium', key: makeKey(r),
                            description: `금액 계산 오류 (${r.buyer || r.email})`,
                            details: [`수량(${r.quantity}) x 단가(${r.unitPrice.toLocaleString()}) = ${expected.toLocaleString()}`, `실제 합계: ${r.totalAmount.toLocaleString()}`, `차이: ${Math.abs(expected - r.totalAmount).toLocaleString()}`],
                            files: [f.name],
                        });
                    }
                }
            });
        });

        // 3. Cross-file comparison (missing records & amount mismatches)
        if (loaded.length >= 2) {
            const allKeys = new Set<string>();
            fileMaps.forEach(m => m.forEach((_, k) => allKeys.add(k)));

            allKeys.forEach(key => {
                const present = loaded.map((f, i) => ({ file: f, has: fileMaps[i].has(key), recs: fileMaps[i].get(key) || [] }));
                const filesWithKey = present.filter(p => p.has);
                const filesWithoutKey = present.filter(p => !p.has);

                // Missing in some files
                if (filesWithoutKey.length > 0 && filesWithKey.length > 0) {
                    const sample = filesWithKey[0].recs[0];
                    foundIssues.push({
                        type: 'missing', severity: 'high', key,
                        description: `레코드 누락 (${sample?.buyer || sample?.email || key})`,
                        details: [
                            `존재: ${filesWithKey.map(p => p.file.name).join(', ')}`,
                            `누락: ${filesWithoutKey.map(p => p.file.name).join(', ')}`,
                            sample ? `상품: ${sample.productName}, 금액: ${sample.totalAmount.toLocaleString()}` : '',
                        ].filter(Boolean),
                        files: [...filesWithKey.map(p => p.file.name), ...filesWithoutKey.map(p => p.file.name)],
                    });
                }

                // Amount mismatch across files
                if (filesWithKey.length >= 2) {
                    const amounts = filesWithKey.map(p => p.recs[0]?.totalAmount || 0);
                    const allSame = amounts.every(a => Math.abs(a - amounts[0]) < 1);
                    if (!allSame) {
                        foundIssues.push({
                            type: 'mismatch', severity: 'high', key,
                            description: `금액 불일치 (${filesWithKey[0].recs[0]?.buyer || key})`,
                            details: filesWithKey.map(p => `${p.file.name}: ${p.recs[0]?.totalAmount.toLocaleString()}`),
                            files: filesWithKey.map(p => p.file.name),
                        });
                    }
                    // Status mismatch
                    const statuses = filesWithKey.map(p => (p.recs[0]?.status || '').toLowerCase());
                    const statusSame = statuses.every(s => s === statuses[0]);
                    if (!statusSame && statuses.some(s => s !== '')) {
                        foundIssues.push({
                            type: 'data_inconsistency', severity: 'medium', key,
                            description: `상태 불일치 (${filesWithKey[0].recs[0]?.buyer || key})`,
                            details: filesWithKey.map(p => `${p.file.name}: "${p.recs[0]?.status || '(없음)'}"`),
                            files: filesWithKey.map(p => p.file.name),
                        });
                    }
                    // Quantity mismatch
                    const qtys = filesWithKey.map(p => p.recs[0]?.quantity || 0);
                    const qtySame = qtys.every(q => q === qtys[0]);
                    if (!qtySame) {
                        foundIssues.push({
                            type: 'data_inconsistency', severity: 'medium', key,
                            description: `수량 불일치 (${filesWithKey[0].recs[0]?.buyer || key})`,
                            details: filesWithKey.map(p => `${p.file.name}: ${p.recs[0]?.quantity}`),
                            files: filesWithKey.map(p => p.file.name),
                        });
                    }
                }
            });
        }

        // Sort: high -> medium -> low
        const order = { high: 0, medium: 1, low: 2 };
        foundIssues.sort((a, b) => order[a.severity] - order[b.severity]);

        setIssues(foundIssues);
        setAnalyzed(true);
        setIsAnalyzing(false);
    };

    const filteredIssues = createMemo(() => {
        if (filterSeverity() === 'all') return issues();
        return issues().filter(i => i.severity === filterSeverity());
    });

    const severityBadge = (s: string) => {
        if (s === 'high') return 'bg-red-500/15 text-red-400 border-red-500/20';
        if (s === 'medium') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
        return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
    };
    const severityLabel = (s: string) => s === 'high' ? '심각' : s === 'medium' ? '주의' : '참고';
    const typeLabel = (t: string) => {
        const m: Record<string, string> = { mismatch: '금액 불일치', missing: '누락', duplicate: '중복', calc_error: '계산 오류', data_inconsistency: '데이터 불일치' };
        return m[t] || t;
    };
    const typeIcon = (t: string) => {
        if (t === 'mismatch') return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
        if (t === 'missing') return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
        if (t === 'duplicate') return 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z';
        return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    };

    const highCount = createMemo(() => issues().filter(i => i.severity === 'high').length);
    const medCount = createMemo(() => issues().filter(i => i.severity === 'medium').length);
    const lowCount = createMemo(() => issues().filter(i => i.severity === 'low').length);

    return (
        <div class="text-slate-300">
            <h2 class="text-xl font-bold text-white mb-2">파일 비교 분석</h2>
            <p class="text-slate-500 text-sm mb-6">최대 3개의 엑셀 파일을 업로드하여 판매내역 간 불일치, 누락, 중복 등의 이슈를 자동으로 탐지합니다.</p>

            {/* File Upload Slots */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <For each={[0, 1, 2]}>
                    {(idx) => (
                        <div class={`rounded-xl border p-4 transition-all ${files()[idx] ? FILE_BG[idx] : 'bg-[#0B0E14] border-slate-700/50'}`}>
                            <div class="flex items-center gap-2 mb-3">
                                <div class={`w-2 h-2 rounded-full ${files()[idx] ? FILE_DOT[idx] : 'bg-slate-600'}`} />
                                <span class="text-xs font-bold uppercase tracking-wider text-slate-500">파일 {idx + 1}</span>
                            </div>
                            <Show when={files()[idx]} fallback={
                                <label class="flex flex-col items-center justify-center h-24 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer hover:border-slate-500 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-slate-600 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <span class="text-xs text-slate-500">파일 선택</span>
                                    <input type="file" class="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileSelect(idx, e)} />
                                </label>
                            }>
                                <div class="flex items-start justify-between">
                                    <div class="min-w-0 flex-1">
                                        <p class={`text-sm font-bold truncate ${FILE_COLORS[idx]}`}>{files()[idx]!.name}</p>
                                        <p class="text-xs text-slate-500 mt-1">{files()[idx]!.records.length}건 / {(files()[idx]!.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button onClick={() => removeFile(idx)} class="text-red-500/50 hover:text-red-400 p-1 flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                </div>
                            </Show>
                        </div>
                    )}
                </For>
            </div>

            {/* Analyze Button */}
            <div class="flex justify-center mb-8">
                <button
                    onClick={runAnalysis}
                    disabled={loadedCount() < 2 || isAnalyzing()}
                    class={`px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${
                        loadedCount() < 2 || isAnalyzing()
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-900/20'
                    }`}
                >
                    {isAnalyzing() ? (
                        <span class="flex items-center gap-2">
                            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            분석 중...
                        </span>
                    ) : loadedCount() < 2 ? '2개 이상의 파일을 업로드하세요' : `${loadedCount()}개 파일 비교 분석 시작`}
                </button>
            </div>

            {/* Results */}
            <Show when={analyzed()}>
                {/* Summary Cards */}
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-[#0B0E14] border border-white/5 rounded-xl p-4 text-center">
                        <div class="text-2xl font-black text-white">{issues().length}</div>
                        <div class="text-[9px] font-bold uppercase tracking-widest text-slate-600 mt-1">총 이슈</div>
                    </div>
                    <div class="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-center cursor-pointer hover:border-red-500/30 transition-all" onClick={() => setFilterSeverity(filterSeverity() === 'high' ? 'all' : 'high')}>
                        <div class="text-2xl font-black text-red-400">{highCount()}</div>
                        <div class="text-[9px] font-bold uppercase tracking-widest text-red-600 mt-1">심각</div>
                    </div>
                    <div class="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 text-center cursor-pointer hover:border-amber-500/30 transition-all" onClick={() => setFilterSeverity(filterSeverity() === 'medium' ? 'all' : 'medium')}>
                        <div class="text-2xl font-black text-amber-400">{medCount()}</div>
                        <div class="text-[9px] font-bold uppercase tracking-widest text-amber-600 mt-1">주의</div>
                    </div>
                    <div class="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500/30 transition-all" onClick={() => setFilterSeverity(filterSeverity() === 'low' ? 'all' : 'low')}>
                        <div class="text-2xl font-black text-blue-400">{lowCount()}</div>
                        <div class="text-[9px] font-bold uppercase tracking-widest text-blue-600 mt-1">참고</div>
                    </div>
                </div>

                <Show when={issues().length === 0}>
                    <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-8 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-emerald-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p class="text-emerald-400 font-bold text-lg">이슈 없음</p>
                        <p class="text-emerald-500/70 text-sm mt-1">모든 파일의 데이터가 일치합니다.</p>
                    </div>
                </Show>

                {/* Issue List */}
                <Show when={filteredIssues().length > 0}>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-slate-500">{filterSeverity() !== 'all' ? `필터: ${severityLabel(filterSeverity())}` : `전체 ${filteredIssues().length}건`}</span>
                            <Show when={filterSeverity() !== 'all'}>
                                <button onClick={() => setFilterSeverity('all')} class="text-xs text-indigo-400 hover:text-indigo-300 underline">필터 해제</button>
                            </Show>
                        </div>
                        <For each={filteredIssues()}>
                            {(issue) => (
                                <div class="bg-[#0B0E14] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all">
                                    <div class="flex items-start gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" class={`w-5 h-5 flex-shrink-0 mt-0.5 ${issue.severity === 'high' ? 'text-red-400' : issue.severity === 'medium' ? 'text-amber-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d={typeIcon(issue.type)} />
                                        </svg>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 flex-wrap mb-1">
                                                <span class="text-white font-bold text-sm">{issue.description}</span>
                                                <span class={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${severityBadge(issue.severity)}`}>{severityLabel(issue.severity)}</span>
                                                <span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-400 border-slate-500/20">{typeLabel(issue.type)}</span>
                                            </div>
                                            <div class="space-y-0.5 mt-2">
                                                <For each={issue.details}>
                                                    {(detail) => <p class="text-xs text-slate-500">{detail}</p>}
                                                </For>
                                            </div>
                                            <div class="flex gap-2 mt-2">
                                                <For each={issue.files}>
                                                    {(fname) => {
                                                        const idx = files().findIndex(f => f?.name === fname);
                                                        return <span class={`text-[9px] font-mono px-1.5 py-0.5 rounded ${idx >= 0 ? FILE_BG[idx] : 'bg-slate-800 text-slate-500'} ${idx >= 0 ? FILE_COLORS[idx] : ''}`}>{fname}</span>;
                                                    }}
                                                </For>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </Show>
        </div>
    );
};
