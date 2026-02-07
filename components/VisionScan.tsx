import { createSignal, createMemo, onMount, Show } from 'solid-js';
import { ethers } from 'ethers';
import { initPriceService, getVcnPrice } from '../services/vcnPriceService';
import { getFirebaseDb } from '../services/firebaseService';
import { collection, query, where, orderBy, limit as fbLimit, getDocs, doc, getDoc, getCountFromServer } from 'firebase/firestore';

// Sub-Components (Phase 1 Refactor)
import VisionScanHome from './VisionScanHome';
import TxDetailView from './phases/TxDetailView';
import AddressDetailView from './phases/AddressDetailView';
import PacketDetailView from './phases/PacketDetailView';
import AccountingSettingsView from './phases/AccountingSettingsView';

export default function VisionScan() {
    // Global State
    const [viewMode, setViewMode] = createSignal<'blockchain' | 'accounting'>('accounting');
    const [currentScreen, setCurrentScreen] = createSignal<'home' | 'tx_detail' | 'address_detail' | 'packet_detail' | 'accounting_settings'>('home');

    // Data State
    const [searchTerm, setSearchTerm] = createSignal("");
    const [transactions, setTransactions] = createSignal<any[]>([]);
    const [selectedTx, setSelectedTx] = createSignal<any>(null);
    const [selectedPacketId, setSelectedPacketId] = createSignal<string>("");
    const [addressBalance, setAddressBalance] = createSignal<string | null>(null);
    const [currentAddress, setCurrentAddress] = createSignal<string>("");
    const [chainType, setChainType] = createSignal<'evm' | 'btc' | 'sol'>('evm');

    const [limit, setLimit] = createSignal(20);
    const [page, setPage] = createSignal(1);
    const [notFoundTerm, setNotFoundTerm] = createSignal<string | null>(null);
    const [totalTxCount, setTotalTxCount] = createSignal<number>(0);

    // Network Stats
    const [blockHeight, setBlockHeight] = createSignal<string>('0');
    const [gasPrice, setGasPrice] = createSignal<string>('0');

    // Constants
    const API_URL = "https://api.visionchain.co/api/transactions";
    const RPC_URL = "https://api.visionchain.co/rpc-proxy";
    const VCN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    // Fetch on-chain VCN balance for an address
    const fetchOnChainBalance = async (address: string): Promise<string> => {
        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const abi = ["function balanceOf(address account) view returns (uint256)"];
            const contract = new ethers.Contract(VCN_TOKEN_ADDRESS, abi, provider);
            const balance = await contract.balanceOf(address);
            return ethers.formatUnits(balance, 18);
        } catch (error) {
            console.warn("Failed to fetch on-chain balance:", error);
            return "0";
        }
    };

    // --- Actions ---

    const handleSearch = (term: string, overrides?: any) => {
        setSearchTerm(term);
        setNotFoundTerm(null); // Reset not found state
        setPage(1); // Reset to page 1 on search
        fetchTransactions(term, overrides);
    };

    const fetchTransactions = async (forceTerm?: string, overrides?: any) => {
        const termToSearch = forceTerm !== undefined && typeof forceTerm === 'string' ? forceTerm : searchTerm().trim();
        setAddressBalance(null);

        // Fetch on-chain balance if it's an EVM address
        if (termToSearch.length === 42 && termToSearch.startsWith('0x')) {
            console.log(`🌐 VisionScan: Fetching on-chain balance for ${termToSearch}`);
            const onChainBalance = await fetchOnChainBalance(termToSearch);
            console.log(`🌐 VisionScan: On-chain VCN balance: ${onChainBalance}`);
            setAddressBalance(onChainBalance);
        }

        console.log(`🌐 VisionScan: Fetching for "${termToSearch}" with limit ${limit()} and page ${page()}`);

        try {
            let data: any[] = [];
            let liveBalance: string | undefined;

            // Try Firestore first
            try {
                const db = getFirebaseDb();
                const txCollection = collection(db, 'transactions');
                let firestoreQuery;

                if (termToSearch) {
                    if (termToSearch.length > 50) {
                        // Hash lookup - direct document
                        const docSnap = await getDoc(doc(db, 'transactions', termToSearch));
                        if (docSnap.exists()) {
                            data = [docSnap.data()];
                        }
                    } else {
                        // Address lookup - query from_addr or to_addr
                        // Normalize to lowercase for consistent Firestore matching
                        const normalizedAddress = termToSearch.toLowerCase();
                        const fromQuery = query(txCollection, where('from_addr', '==', normalizedAddress), orderBy('timestamp', 'desc'), fbLimit(limit()));
                        const toQuery = query(txCollection, where('to_addr', '==', normalizedAddress), orderBy('timestamp', 'desc'), fbLimit(limit()));

                        // Also get total count (without limit)
                        const fromCountQuery = query(txCollection, where('from_addr', '==', normalizedAddress));
                        const toCountQuery = query(txCollection, where('to_addr', '==', normalizedAddress));

                        const [fromSnap, toSnap, fromCountSnap, toCountSnap] = await Promise.all([
                            getDocs(fromQuery),
                            getDocs(toQuery),
                            getCountFromServer(fromCountQuery),
                            getCountFromServer(toCountQuery)
                        ]);

                        // Calculate total unique transaction count
                        const totalFromCount = fromCountSnap.data().count;
                        const totalToCount = toCountSnap.data().count;
                        // Estimate unique count (some transactions may have same address as both from and to)
                        // For accurate count, we would need to fetch all and dedupe, but this is a reasonable estimate
                        const estimatedTotal = totalFromCount + totalToCount;
                        setTotalTxCount(estimatedTotal);

                        console.log(`🔥 VisionScan: Sent (from_addr match): ${fromSnap.docs.length}, Received (to_addr match): ${toSnap.docs.length}`);
                        console.log(`🔥 VisionScan: Total count - From: ${totalFromCount}, To: ${totalToCount}, Estimated: ${estimatedTotal}`);

                        const txMap = new Map();
                        fromSnap.docs.forEach(d => txMap.set(d.id, d.data()));
                        toSnap.docs.forEach(d => txMap.set(d.id, d.data()));
                        data = Array.from(txMap.values());
                    }
                } else {
                    // Latest transactions
                    firestoreQuery = query(txCollection, orderBy('timestamp', 'desc'), fbLimit(limit()));
                    const snap = await getDocs(firestoreQuery);
                    data = snap.docs.map(d => d.data());
                }

                console.log(`🔥 Firestore: Found ${data.length} transactions`);
            } catch (fsErr) {
                console.warn('Firestore query failed, falling back to API:', fsErr);
            }

            // Fallback to API if Firestore returned nothing
            if (data.length === 0) {
                const params = new URLSearchParams();
                if (termToSearch) {
                    if (termToSearch.length > 50) {
                        params.append('hash', termToSearch);
                    } else {
                        params.append('address', termToSearch);
                    }
                }
                params.append('limit', limit().toString());
                params.append('offset', ((page() - 1) * limit()).toString());

                const response = await fetch(`${API_URL}?${params.toString()}`);
                const rawData = await response.json();
                data = rawData.transactions || [];
                liveBalance = rawData.liveBalance;
            }

            if (liveBalance !== undefined) {
                setAddressBalance(liveBalance);
            }

            const formatted = data.map((tx: any) => {
                const isTargetTx = tx.hash === termToSearch;
                return {
                    hash: tx.hash,
                    type: tx.type || 'S200',
                    method: (isTargetTx && overrides?.method) ? overrides.method : (tx.metadata?.method || (tx.type === 'Transfer' ? 'Asset Transfer' : 'EVM Op')),
                    from: tx.from_addr,
                    to: (isTargetTx && overrides?.to) ? overrides.to : tx.to_addr,
                    value: (isTargetTx && overrides?.amount) ? overrides.amount : tx.value,
                    time: new Date(tx.timestamp).toLocaleTimeString(),
                    status: 'completed',
                    asset: 'VCN',
                    direction: tx.type === 'Transfer' ? (tx.from_addr?.toLowerCase() === termToSearch.toLowerCase() ? 'out' : 'in') : 'in',
                    counterparty: tx.metadata?.counterparty || (tx.to_addr?.slice(0, 10) + '...'),
                    timestamp: tx.timestamp,
                    confidence: tx.metadata?.confidence || 100,
                    trustStatus: tx.metadata?.trustStatus || 'verified',
                    netEffect: tx.metadata?.netEffect || [],
                    path: ['Vision Chain']
                };
            });

            // If no results from API but we have overrides for a TX search, create a dummy result
            if (formatted.length === 0 && termToSearch.length > 50 && overrides) {
                formatted.push({
                    hash: termToSearch,
                    type: 'Transfer',
                    method: overrides.method || 'Asset Transfer',
                    from: '0x... (Pending Index)',
                    to: overrides.to || 'Unknown',
                    value: overrides.amount || '0',
                    time: new Date().toLocaleTimeString(),
                    status: 'completed',
                    asset: 'VCN',
                    direction: 'in',
                    counterparty: (overrides.to?.slice(0, 10) + '...') || 'Unknown',
                    timestamp: Date.now(),
                    confidence: 100,
                    trustStatus: 'verified',
                    netEffect: [],
                    path: ['Vision Chain']
                });
            }

            setTransactions(formatted);

            // Routing Logic
            if (termToSearch.length > 50 && formatted.length === 1) {
                // It's a Tx Hash
                setSelectedTx(formatted[0]);
                setCurrentScreen('tx_detail');
                window.history.pushState({}, '', `?tx=${formatted[0].hash}`);
            } else if (termToSearch.length === 42 && termToSearch.startsWith('0x')) {
                // EVM Address - Always show address detail for valid format
                setChainType('evm');
                setCurrentAddress(termToSearch);
                setCurrentScreen('address_detail');
                window.history.pushState({}, '', `?address=${termToSearch}&chain=evm`);
            } else if (termToSearch.startsWith('bc1') || termToSearch.startsWith('1') || termToSearch.startsWith('3')) {
                // Bitcoin Address (Mock Detection)
                if (termToSearch.length > 25 && termToSearch.length < 60) {
                    setChainType('btc');
                    setCurrentAddress(termToSearch);
                    setCurrentScreen('address_detail');
                    window.history.pushState({}, '', `?address=${termToSearch}&chain=btc`);
                    setAddressBalance("0.542 BTC"); // Mock BTC Balance
                }
            } else if (termToSearch.length > 30 && termToSearch.length < 45 && !termToSearch.startsWith('0x')) {
                // Solana Address (Base58 Check - Rough Mock)
                setChainType('sol');
                setCurrentAddress(termToSearch);
                setCurrentScreen('address_detail');
                window.history.pushState({}, '', `?address=${termToSearch}&chain=sol`);
                setAddressBalance("145.20 SOL"); // Mock SOL Balance
            } else if (termToSearch.startsWith('0xpacket')) {
                // Mock Packet ID Detection (Phase 2)
                setSelectedPacketId(termToSearch);
                // Mock Packet ID Detection (Phase 2)
                setSelectedPacketId(termToSearch);
                setCurrentScreen('packet_detail');
                window.history.pushState({}, '', `?packet=${termToSearch}`);
            } else if (termToSearch === 'settings') {
                setCurrentScreen('accounting_settings');
                window.history.pushState({}, '', `?view=settings`);
            } else {
                // Partial search or clear
                setCurrentScreen('home');
            }

        } catch (error) {
            console.error("Failed to fetch transactions:", error);
        }
    };

    const fetchLiveStats = async () => {
        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const height = await provider.getBlockNumber();
            setBlockHeight(height.toLocaleString());
            const feeData = await provider.getFeeData();
            if (feeData.gasPrice) {
                setGasPrice((Number(ethers.formatUnits(feeData.gasPrice, 'gwei'))).toFixed(2));
            }
        } catch (error) {
            console.warn("RPC Connection Error (Stats):", error);
        }
    };

    onMount(() => {
        initPriceService();
        const urlParams = new URLSearchParams(window.location.search);
        const txHash = urlParams.get('tx');
        const addr = urlParams.get('address');
        const packetId = urlParams.get('packet');
        const overriddenTo = urlParams.get('to');
        const overriddenAmount = urlParams.get('amount');
        const overriddenMethod = urlParams.get('method');

        if (txHash) {
            handleSearch(txHash, {
                to: urlParams.get('to'),
                amount: urlParams.get('amount'),
                method: urlParams.get('method')
            });
        } else if (addr) {
            handleSearch(addr);
        } else if (packetId) {
            handleSearch(packetId);
        } else {
            // Fetch latest transactions for home feed
            fetchTransactions("");
        }

        fetchLiveStats();
        setInterval(fetchLiveStats, 10000); // Live stats every 10s
    });

    // --- Render ---

    return (
        <div class="bg-black min-h-screen text-white pt-20">
            <Show when={currentScreen() === 'home'}>
                <VisionScanHome
                    onSearch={handleSearch}
                    onViewChange={setViewMode}
                    currentView={viewMode()}
                    stats={{ blockHeight: blockHeight(), gasPrice: gasPrice() }}
                    addressBalance={addressBalance()}
                    latestTransactions={transactions()}
                    limit={limit()}
                    setLimit={(l) => { setLimit(l); setPage(1); fetchTransactions(); }}
                    page={page()}
                    setPage={(p) => { setPage(p); fetchTransactions(); }}
                    notFoundTerm={notFoundTerm()}
                    setNotFoundTerm={setNotFoundTerm}
                />
            </Show>

            <Show when={currentScreen() === 'tx_detail' && selectedTx()}>
                <div class="max-w-7xl mx-auto px-6 py-12">
                    <button
                        onClick={() => { setCurrentScreen('home'); window.history.pushState({}, '', window.location.pathname); }}
                        class="mb-4 text-xs font-bold text-gray-500 hover:text-white transition-colors"
                    >
                        ← Back to Search
                    </button>
                    <TxDetailView
                        tx={selectedTx()}
                        onClose={() => { setCurrentScreen('home'); window.history.pushState({}, '', window.location.pathname); }}
                        onViewPacket={(packetId) => {
                            setSelectedPacketId(packetId);
                            setCurrentScreen('packet_detail');
                            window.history.pushState({}, '', `?packet=${packetId}`);
                        }}
                        view={viewMode()}
                    />
                </div>
            </Show>

            <Show when={currentScreen() === 'packet_detail'}>
                <div class="pt-8">
                    <div class="max-w-7xl mx-auto px-6 mb-4">
                        <button
                            onClick={() => { setCurrentScreen('home'); window.history.pushState({}, '', window.location.pathname); }}
                            class="text-xs font-bold text-gray-500 hover:text-white transition-colors"
                        >
                            ← Back to Search
                        </button>
                    </div>
                    <PacketDetailView
                        packetId={selectedPacketId()}
                        onClose={() => { setCurrentScreen('home'); window.history.pushState({}, '', window.location.pathname); }}
                    />
                </div>
            </Show>

            <Show when={currentScreen() === 'accounting_settings'}>
                <div class="pt-8">
                    <AccountingSettingsView
                        onClose={() => { setCurrentScreen('home'); window.history.pushState({}, '', window.location.pathname); }}
                    />
                </div>
            </Show>

            <Show when={currentScreen() === 'address_detail'}>
                <div class="pt-8">
                    <div class="max-w-7xl mx-auto px-6 mb-4">
                        <button
                            onClick={() => { setCurrentScreen('home'); window.history.pushState({}, '', window.location.pathname); }}
                            class="text-xs font-bold text-gray-500 hover:text-white transition-colors"
                        >
                            ← Back to Search
                        </button>
                    </div>
                    <AddressDetailView
                        address={currentAddress()}
                        balance={addressBalance()}
                        transactions={transactions()}
                        totalTxCount={totalTxCount()}
                        chainType={chainType()}
                        onViewTx={(tx) => {
                            setSelectedTx(tx);
                            setCurrentScreen('tx_detail');
                            window.history.pushState({}, '', `?tx=${tx.hash}`);
                        }}
                        onClose={() => { setCurrentScreen('home'); window.history.pushState({}, '', window.location.pathname); }}
                    />
                </div>
            </Show>
        </div>
    );
}
