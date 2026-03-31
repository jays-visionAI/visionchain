import { createSignal, Show, For, lazy, Suspense } from 'solid-js';
import * as XLSX from 'xlsx';
import { getFirebaseDb } from '../../services/firebaseService';
import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';

const SalesCompare = lazy(() => import('./SalesCompare').then(m => ({ default: m.SalesCompare })));

export interface SalesRecord {
    id?: string;
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
    uploadedAt?: string;
}

export const SalesHistory = () => {
    const [dragActive, setDragActive] = createSignal(false);
    const [file, setFile] = createSignal<File | null>(null);
    const [parsedData, setParsedData] = createSignal<SalesRecord[]>([]);
    const [savedRecords, setSavedRecords] = createSignal<SalesRecord[]>([]);
    const [isUploading, setIsUploading] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(false);
    const [uploadStatus, setUploadStatus] = createSignal<{ success: boolean; message: string } | null>(null);
    const [parseError, setParseError] = createSignal<string | null>(null);
    const [activeView, setActiveView] = createSignal<'upload' | 'history' | 'compare'>('upload');

    // Fetch existing records on load
    const fetchSavedRecords = async () => {
        setIsLoading(true);
        try {
            const db = getFirebaseDb();
            const salesRef = collection(db, 'sales_history');
            const q = query(salesRef, orderBy('uploadedAt', 'desc'), limit(500));
            const snap = await getDocs(q);
            const records: SalesRecord[] = [];
            snap.forEach((d) => {
                records.push({ id: d.id, ...d.data() } as SalesRecord);
            });
            setSavedRecords(records);
        } catch (e) {
            console.error('[SalesHistory] Failed to fetch records:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // Load on first render
    fetchSavedRecords();

    const handleDrag = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            await processFile(droppedFile);
        }
    };

    const handleChange = async (e: any) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            await processFile(e.target.files[0]);
        }
    };

    const processFile = async (f: File) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
            setParseError('지원되지 않는 파일 형식입니다. .xlsx, .xls, .csv 파일만 업로드 가능합니다.');
            return;
        }
        setFile(f);
        setUploadStatus(null);
        setParseError(null);
        try {
            console.log(`[SalesHistory] Processing file: ${f.name} (${f.size} bytes, type: ${f.type})`);
            const data = ext === 'csv' ? await parseCSVFile(f) : await parseExcel(f);
            console.log(`[SalesHistory] Successfully parsed ${data.length} records`);
            if (data.length === 0) {
                setParseError('파일에서 유효한 데이터를 찾을 수 없습니다. 파일 형식을 확인해 주세요.');
            }
            setParsedData(data);
        } catch (err: any) {
            console.error('[SalesHistory] Parse error:', err);
            setParseError(`파일 파싱 실패: ${err.message || err}`);
            setParsedData([]);
        }
    };

    // CSV-specific parser: handles EUC-KR and UTF-8 encoding
    const parseCSVFile = async (file: File): Promise<SalesRecord[]> => {
        const buffer = await file.arrayBuffer();
        let text = '';

        // Try UTF-8 first, check for replacement characters
        const utf8Text = new TextDecoder('utf-8').decode(buffer);
        const hasBadChars = utf8Text.includes('\uFFFD') || /[\x80-\xff]{2,}/.test(utf8Text.split('\n')[0] || '');

        if (hasBadChars) {
            // Likely EUC-KR encoded (common for Korean Excel CSV exports)
            try {
                text = new TextDecoder('euc-kr').decode(buffer);
                console.log('[SalesHistory] CSV decoded as EUC-KR');
            } catch {
                text = utf8Text;
                console.log('[SalesHistory] CSV fallback to UTF-8');
            }
        } else {
            text = utf8Text;
            // Strip BOM if present
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            console.log('[SalesHistory] CSV decoded as UTF-8');
        }

        return parseCSVText(text);
    };

    const parseCSVText = (text: string): SalesRecord[] => {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('CSV 파일에 데이터가 부족합니다 (헤더 + 최소 1행 필요).');

        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        console.log('[SalesHistory] CSV headers:', headers);

        return mapRowsToRecords(headers, lines.slice(1).map(line => {
            // Handle quoted CSV values
            const values: string[] = [];
            let current = '';
            let inQuotes = false;
            for (const ch of line) {
                if (ch === '"') { inQuotes = !inQuotes; }
                else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
                else { current += ch; }
            }
            values.push(current.trim());
            return values;
        }));
    };

    const mapRowsToRecords = (headers: string[], rows: string[][]): SalesRecord[] => {
        const findIdx = (candidates: string[]): number => {
            return headers.findIndex(h => candidates.some(c => h.toLowerCase().includes(c.toLowerCase())));
        };

        const dateIdx = findIdx(['date', '날짜', '일자']);
        const buyerIdx = findIdx(['buyer', '구매자', '이름', 'name', '성명', '구매']);
        const emailIdx = findIdx(['email', '이메일']);
        const productIdx = findIdx(['product', '상품', '제품', '품목', 'item']);
        const qtyIdx = findIdx(['quantity', '수량', 'qty']);
        const priceIdx = findIdx(['price', '단가', '가격', 'unitprice']);
        const totalIdx = findIdx(['total', '합계', '총액', '금액', 'amount', '매출']);
        const paymentIdx = findIdx(['payment', '결제', '결제방법', '결제수단']);
        const statusIdx = findIdx(['status', '상태']);
        const noteIdx = findIdx(['note', '비고', '메모', 'remark']);

        console.log('[SalesHistory] Column mapping:', { dateIdx, buyerIdx, emailIdx, productIdx, qtyIdx, priceIdx, totalIdx, paymentIdx, statusIdx, noteIdx });

        // If no columns matched at all, try using raw column indices
        const noMatch = [dateIdx, buyerIdx, emailIdx, productIdx, qtyIdx, priceIdx, totalIdx].every(i => i === -1);

        const records: SalesRecord[] = [];
        for (const vals of rows) {
            if (vals.every(v => !v)) continue; // skip empty rows

            const get = (idx: number) => idx >= 0 && idx < vals.length ? vals[idx].replace(/^["']|["']$/g, '') : '';
            const getNum = (idx: number) => {
                const raw = get(idx).replace(/,/g, '').replace(/원/g, '').replace(/\$/g, '').trim();
                return Number(raw) || 0;
            };

            let qty: number, price: number, total: number;
            if (noMatch) {
                // Fallback: use all columns as-is, put everything in note
                records.push({
                    date: vals[0] || '', buyer: vals[1] || '', email: '',
                    productName: vals[2] || '', quantity: 0, unitPrice: 0,
                    totalAmount: 0, paymentMethod: '', status: '',
                    note: vals.join(' | '),
                });
                continue;
            }

            qty = getNum(qtyIdx);
            price = getNum(priceIdx);
            total = getNum(totalIdx) || (qty * price);

            records.push({
                date: get(dateIdx), buyer: get(buyerIdx), email: get(emailIdx),
                productName: get(productIdx), quantity: qty, unitPrice: price,
                totalAmount: total, paymentMethod: get(paymentIdx),
                status: get(statusIdx) || 'Completed', note: get(noteIdx),
            });
        }
        return records;
    };

    const parseExcel = async (file: File): Promise<SalesRecord[]> => {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', codepage: 949 });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
            throw new Error('엑셀 파일에 데이터가 없습니다.');
        }

        const records: SalesRecord[] = [];
        const keys = Object.keys(jsonData[0]);
        console.log('[SalesHistory] Excel columns:', keys);

        const findCol = (candidates: string[]): string | undefined => {
            return keys.find(k => candidates.some(c => k.toLowerCase().includes(c.toLowerCase())));
        };

        const dateCol = findCol(['date', '날짜', '일자', 'Date']);
        const buyerCol = findCol(['buyer', '구매자', '이름', 'name', 'Name', '성명', '구매']);
        const emailCol = findCol(['email', '이메일', 'Email', 'E-mail']);
        const productCol = findCol(['product', '상품', '제품', '품목', 'Product', 'item', 'Item']);
        const qtyCol = findCol(['quantity', '수량', 'qty', 'Qty', 'Quantity']);
        const priceCol = findCol(['price', '단가', '가격', 'unitPrice', 'Price', 'UnitPrice']);
        const totalCol = findCol(['total', '합계', '총액', '금액', 'amount', 'Total', 'Amount', '매출']);
        const paymentCol = findCol(['payment', '결제', '결제방법', '결제수단', 'Payment', 'method']);
        const statusCol = findCol(['status', '상태', 'Status']);
        const noteCol = findCol(['note', '비고', '메모', 'Note', 'remark', 'Remark']);

        console.log('[SalesHistory] Column mapping:', { dateCol, buyerCol, emailCol, productCol, qtyCol, priceCol, totalCol, paymentCol, statusCol, noteCol });

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const qty = Number(qtyCol ? row[qtyCol] : 0) || 0;
            const price = Number(priceCol ? row[priceCol] : 0) || 0;
            const total = Number(totalCol ? row[totalCol] : 0) || (qty * price);

            records.push({
                date: dateCol ? String(row[dateCol]) : '',
                buyer: buyerCol ? String(row[buyerCol]) : '',
                email: emailCol ? String(row[emailCol]) : '',
                productName: productCol ? String(row[productCol]) : '',
                quantity: qty,
                unitPrice: price,
                totalAmount: total,
                paymentMethod: paymentCol ? String(row[paymentCol]) : '',
                status: statusCol ? String(row[statusCol]) : 'Completed',
                note: noteCol ? String(row[noteCol]) : '',
            });
        }

        console.log(`[SalesHistory] Parsed ${records.length} records from Excel`);
        return records;
    };

    const handleUpload = async () => {
        if (!file() || parsedData().length === 0) return;
        setIsUploading(true);
        try {
            const db = getFirebaseDb();
            const salesRef = collection(db, 'sales_history');
            const now = new Date().toISOString();
            let count = 0;

            for (const record of parsedData()) {
                await addDoc(salesRef, {
                    ...record,
                    uploadedAt: now,
                });
                count++;
            }

            setUploadStatus({
                success: true,
                message: `${count}건의 판매내역이 성공적으로 업로드되었습니다.`,
            });

            // Refresh history
            await fetchSavedRecords();

            // Clear form
            setFile(null);
            setParsedData([]);
        } catch (error: any) {
            console.error('[SalesHistory] Upload failed:', error);
            setUploadStatus({
                success: false,
                message: `업로드 실패: ${error.message || '알 수 없는 오류'}`,
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteRecord = async (recordId: string) => {
        if (!confirm('이 판매내역을 삭제하시겠습니까?')) return;
        try {
            const db = getFirebaseDb();
            await deleteDoc(doc(db, 'sales_history', recordId));
            setSavedRecords(prev => prev.filter(r => r.id !== recordId));
        } catch (e) {
            console.error('[SalesHistory] Delete failed:', e);
            alert('삭제에 실패했습니다.');
        }
    };

    const handleReset = () => {
        setFile(null);
        setParsedData([]);
        setUploadStatus(null);
        setParseError(null);
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString('ko-KR');
    };

    const statusBadge = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'completed' || s === '완료' || s === 'paid' || s === '결제완료') {
            return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
        }
        if (s === 'pending' || s === '대기' || s === '미결제') {
            return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
        }
        if (s === 'cancelled' || s === '취소' || s === 'refunded' || s === '환불') {
            return 'bg-red-500/15 text-red-400 border-red-500/20';
        }
        return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
    };

    return (
        <div class="text-slate-300">
            {/* Sub-navigation */}
            <div class="flex items-center gap-3 mb-6">
                <button
                    onClick={() => setActiveView('upload')}
                    class={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeView() === 'upload'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-white/[0.03] text-slate-500 border border-white/5 hover:border-white/10 hover:text-slate-400'
                    }`}
                >
                    <span class="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        엑셀 업로드
                    </span>
                </button>
                <button
                    onClick={() => { setActiveView('history'); fetchSavedRecords(); }}
                    class={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeView() === 'history'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-white/[0.03] text-slate-500 border border-white/5 hover:border-white/10 hover:text-slate-400'
                    }`}
                >
                    <span class="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                        내역 조회 ({savedRecords().length})
                    </span>
                </button>
                <button
                    onClick={() => setActiveView('compare')}
                    class={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeView() === 'compare'
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'bg-white/[0.03] text-slate-500 border border-white/5 hover:border-white/10 hover:text-slate-400'
                    }`}
                >
                    <span class="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 3h5v5" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <path d="M8 21H3v-5" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                        비교 분석
                    </span>
                </button>
            </div>

            {/* ========== UPLOAD VIEW ========== */}
            <Show when={activeView() === 'upload'}>
                <h2 class="text-xl font-bold text-white mb-6">판매내역 업로드 (Excel)</h2>

                {/* Format Info */}
                <div class="bg-indigo-900/15 border border-indigo-700/30 rounded-lg p-4 mb-6 text-indigo-300 text-sm flex items-start gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>
                    <div>
                        <p class="font-bold mb-1">지원 형식: .xlsx, .xls, .csv</p>
                        <p class="text-indigo-400/80 text-xs">
                            엑셀 파일의 첫 번째 행은 헤더로 인식됩니다. 아래 열 이름을 참고하여 파일을 구성하세요.
                        </p>
                    </div>
                </div>

                {/* Column reference */}
                <div class="mb-6">
                    <label class="block text-sm font-medium mb-2 text-slate-400">엑셀 열 구성 (자동 매핑)</label>
                    <div class="bg-[#0B0E14] border border-slate-700 rounded-lg p-3 text-slate-500 text-xs font-mono grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <span class="bg-slate-800/50 rounded px-2 py-1">날짜 / date</span>
                        <span class="bg-slate-800/50 rounded px-2 py-1">구매자 / buyer</span>
                        <span class="bg-slate-800/50 rounded px-2 py-1">이메일 / email</span>
                        <span class="bg-slate-800/50 rounded px-2 py-1">상품 / product</span>
                        <span class="bg-slate-800/50 rounded px-2 py-1">수량 / quantity</span>
                        <span class="bg-slate-800/50 rounded px-2 py-1">단가 / price</span>
                        <span class="bg-slate-800/50 rounded px-2 py-1">합계 / total</span>
                        <span class="bg-slate-800/50 rounded px-2 py-1">결제방법 / payment</span>
                        <span class="bg-slate-800/50 rounded px-2 py-1">상태 / status</span>
                        <span class="bg-slate-800/50 rounded px-2 py-1">비고 / note</span>
                    </div>
                </div>

                {/* Parse Error */}
                <Show when={parseError()}>
                    <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-sm flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                        {parseError()}
                    </div>
                </Show>

                {/* Drag & Drop Area */}
                <Show when={!uploadStatus()?.success}>
                    <div
                        class={`border-2 border-dashed rounded-2xl h-56 flex flex-col items-center justify-center transition-all duration-300 mb-8 cursor-pointer ${
                            dragActive()
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-slate-700 bg-[#0B0E14]/50 hover:border-slate-600'
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <div class="text-center">
                            <Show when={!file()} fallback={
                                <div class="flex flex-col items-center">
                                    <div class="bg-emerald-500/20 p-3 rounded-full mb-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                        </svg>
                                    </div>
                                    <span class="text-white font-medium">{file()?.name}</span>
                                    <span class="text-slate-500 text-sm mt-1">{(file()!.size / 1024).toFixed(1)} KB</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                        class="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                                    >
                                        파일 제거
                                    </button>
                                </div>
                            }>
                                <div class="bg-slate-800/50 p-4 rounded-full mb-4 inline-block">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-emerald-500/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                </div>
                                <p class="text-slate-400 mb-4">클릭하여 업로드하거나 파일을 드래그 앤 드롭하세요</p>
                                <label class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-2.5 rounded-lg cursor-pointer transition-all inline-block font-bold text-sm shadow-lg shadow-emerald-900/20">
                                    엑셀 파일 선택
                                    <input type="file" class="hidden" accept=".xlsx,.xls,.csv" onChange={handleChange} />
                                </label>
                                <p class="text-slate-600 text-xs mt-3">.xlsx, .xls, .csv</p>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* Preview Table */}
                <Show when={parsedData().length > 0}>
                    <div class="mb-8 overflow-hidden rounded-xl border border-slate-700">
                        <div class="bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                            <h3 class="font-bold text-white text-sm flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                                미리보기 ({parsedData().length}건)
                            </h3>
                            <div class="text-xs text-slate-500">
                                합계: <span class="text-white font-mono">{formatCurrency(parsedData().reduce((s, r) => s + r.totalAmount, 0))}</span>원
                            </div>
                        </div>
                        <div class="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                            <table class="w-full text-sm text-left text-slate-400">
                                <thead class="text-xs text-slate-300 uppercase bg-slate-800/50 sticky top-0">
                                    <tr>
                                        <th class="px-4 py-3">#</th>
                                        <th class="px-4 py-3">날짜</th>
                                        <th class="px-4 py-3">구매자</th>
                                        <th class="px-4 py-3">이메일</th>
                                        <th class="px-4 py-3">상품</th>
                                        <th class="px-4 py-3 text-right">수량</th>
                                        <th class="px-4 py-3 text-right">단가</th>
                                        <th class="px-4 py-3 text-right">합계</th>
                                        <th class="px-4 py-3">결제방법</th>
                                        <th class="px-4 py-3">상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={parsedData().slice(0, 200)}>
                                        {(record, index) => (
                                            <tr class="border-b border-slate-700/50 hover:bg-slate-800/20 transition-colors">
                                                <td class="px-4 py-2.5 text-slate-500 text-xs">{index() + 1}</td>
                                                <td class="px-4 py-2.5 text-xs">{record.date}</td>
                                                <td class="px-4 py-2.5 text-white text-xs font-medium">{record.buyer}</td>
                                                <td class="px-4 py-2.5 text-xs font-mono">{record.email}</td>
                                                <td class="px-4 py-2.5 text-xs">{record.productName}</td>
                                                <td class="px-4 py-2.5 text-right text-xs">{record.quantity}</td>
                                                <td class="px-4 py-2.5 text-right text-xs">{formatCurrency(record.unitPrice)}</td>
                                                <td class="px-4 py-2.5 text-right text-xs text-white font-bold">{formatCurrency(record.totalAmount)}</td>
                                                <td class="px-4 py-2.5 text-xs">{record.paymentMethod}</td>
                                                <td class="px-4 py-2.5">
                                                    <span class={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(record.status)}`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                    <Show when={parsedData().length > 200}>
                                        <tr>
                                            <td colspan="10" class="px-4 py-3 text-center text-xs text-slate-500 italic">
                                                ... 외 {parsedData().length - 200}건 (처음 200건만 표시)
                                            </td>
                                        </tr>
                                    </Show>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3 mb-8">
                        <button
                            onClick={handleReset}
                            class="px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-all"
                        >
                            초기화
                        </button>
                        <button
                            class={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                                isUploading()
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/20'
                            }`}
                            onClick={handleUpload}
                            disabled={isUploading()}
                        >
                            {isUploading() ? (
                                <span class="flex items-center gap-2">
                                    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    처리 중...
                                </span>
                            ) : `${parsedData().length}건 업로드`}
                        </button>
                    </div>
                </Show>

                {/* Upload Status */}
                <Show when={uploadStatus()}>
                    <div class={`mt-6 p-6 rounded-xl border ${
                        uploadStatus()?.success
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                        <div class="flex items-center gap-3 mb-2">
                            {uploadStatus()?.success ? (
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            <div class="font-bold text-lg">
                                {uploadStatus()?.success ? '업로드 완료' : '업로드 실패'}
                            </div>
                        </div>
                        <div class="ml-9 opacity-90">{uploadStatus()?.message}</div>
                        <Show when={uploadStatus()?.success}>
                            <button
                                onClick={() => { setUploadStatus(null); setActiveView('history'); }}
                                class="ml-9 mt-3 text-sm underline hover:no-underline transition-all"
                            >
                                내역 조회로 이동
                            </button>
                        </Show>
                    </div>
                </Show>
            </Show>

            {/* ========== HISTORY VIEW ========== */}
            <Show when={activeView() === 'history'}>
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-bold text-white">판매내역 조회</h2>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-slate-500">총 {savedRecords().length}건</span>
                        <button
                            onClick={fetchSavedRecords}
                            class="p-2 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all"
                            title="새로고침"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                        </button>
                    </div>
                </div>

                <Show when={isLoading()}>
                    <div class="flex items-center justify-center h-64">
                        <div class="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                </Show>

                <Show when={!isLoading() && savedRecords().length === 0}>
                    <div class="flex flex-col items-center justify-center h-64 text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <p class="text-sm">등록된 판매내역이 없습니다.</p>
                        <button
                            onClick={() => setActiveView('upload')}
                            class="mt-3 text-xs text-emerald-500 hover:text-emerald-400 underline"
                        >
                            엑셀 파일 업로드하기
                        </button>
                    </div>
                </Show>

                <Show when={!isLoading() && savedRecords().length > 0}>
                    <div class="overflow-hidden rounded-xl border border-slate-700">
                        <div class="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                            <table class="w-full text-sm text-left text-slate-400">
                                <thead class="text-xs text-slate-300 uppercase bg-slate-800/50 sticky top-0">
                                    <tr>
                                        <th class="px-4 py-3">#</th>
                                        <th class="px-4 py-3">날짜</th>
                                        <th class="px-4 py-3">구매자</th>
                                        <th class="px-4 py-3">이메일</th>
                                        <th class="px-4 py-3">상품</th>
                                        <th class="px-4 py-3 text-right">수량</th>
                                        <th class="px-4 py-3 text-right">단가</th>
                                        <th class="px-4 py-3 text-right">합계</th>
                                        <th class="px-4 py-3">결제방법</th>
                                        <th class="px-4 py-3">상태</th>
                                        <th class="px-4 py-3 text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={savedRecords()}>
                                        {(record, index) => (
                                            <tr class="border-b border-slate-700/50 hover:bg-slate-800/20 transition-colors">
                                                <td class="px-4 py-2.5 text-slate-500 text-xs">{index() + 1}</td>
                                                <td class="px-4 py-2.5 text-xs">{record.date}</td>
                                                <td class="px-4 py-2.5 text-white text-xs font-medium">{record.buyer}</td>
                                                <td class="px-4 py-2.5 text-xs font-mono">{record.email}</td>
                                                <td class="px-4 py-2.5 text-xs">{record.productName}</td>
                                                <td class="px-4 py-2.5 text-right text-xs">{record.quantity}</td>
                                                <td class="px-4 py-2.5 text-right text-xs">{formatCurrency(record.unitPrice)}</td>
                                                <td class="px-4 py-2.5 text-right text-xs text-white font-bold">{formatCurrency(record.totalAmount)}</td>
                                                <td class="px-4 py-2.5 text-xs">{record.paymentMethod}</td>
                                                <td class="px-4 py-2.5">
                                                    <span class={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(record.status)}`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td class="px-4 py-2.5 text-center">
                                                    <button
                                                        onClick={() => handleDeleteRecord(record.id!)}
                                                        class="text-red-500/50 hover:text-red-400 transition-colors p-1"
                                                        title="삭제"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                        {/* Summary Footer */}
                        <div class="bg-slate-800/30 px-4 py-3 border-t border-slate-700 flex flex-wrap gap-6 text-xs">
                            <div>
                                <span class="text-slate-500">총 건수:</span>{' '}
                                <span class="text-white font-bold font-mono">{savedRecords().length}</span>
                            </div>
                            <div>
                                <span class="text-slate-500">총 금액:</span>{' '}
                                <span class="text-emerald-400 font-bold font-mono">
                                    {formatCurrency(savedRecords().reduce((s, r) => s + (r.totalAmount || 0), 0))}원
                                </span>
                            </div>
                            <div>
                                <span class="text-slate-500">총 수량:</span>{' '}
                                <span class="text-white font-bold font-mono">
                                    {formatCurrency(savedRecords().reduce((s, r) => s + (r.quantity || 0), 0))}
                                </span>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>

            {/* ========== COMPARE VIEW ========== */}
            <Show when={activeView() === 'compare'}>
                <Suspense fallback={
                    <div class="flex items-center justify-center h-64">
                        <div class="w-8 h-8 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                    </div>
                }>
                    <SalesCompare />
                </Suspense>
            </Show>
        </div>
    );
};
