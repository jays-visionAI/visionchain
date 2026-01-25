import { createSignal, createMemo, onMount, Show } from 'solid-js';
import { ethers } from 'ethers';

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

    // Network Stats
    const [blockHeight, setBlockHeight] = createSignal<string>('0');
    const [gasPrice, setGasPrice] = createSignal<string>('0');

    // Constants
    const API_URL = "https://api.visionchain.co/api/transactions";
    const RPC_URL = "https://api.visionchain.co/rpc-proxy";

    // --- Actions ---

    const handleSearch = (term: string) => {
        setSearchTerm(term);
        fetchTransactions(term);
    };

    const fetchTransactions = async (forceTerm?: string) => {
        const termToSearch = forceTerm && typeof forceTerm === 'string' ? forceTerm : searchTerm().trim();
        setAddressBalance(null);

        console.log(`🌐 VisionScan: Fetching for "${termToSearch}"`);

        try {
            const params = new URLSearchParams();
            // Basic filters (Phase 1: minimal)

            if (termToSearch) {
                if (termToSearch.length > 50) {
                    params.append('hash', termToSearch);
                } else {
                    params.append('address', termToSearch);
                }
            }

            const response = await fetch(`${API_URL}?${params.toString()}&limit=50`);
            const rawData = await response.json();
            const data = rawData.transactions || [];

            if (rawData.liveBalance !== undefined) {
                setAddressBalance(rawData.liveBalance);
            }

            // Map Data (Phase 1 Mapping)
            const formatted = data.map((tx: any) => ({
                hash: tx.hash,
                type: tx.type || 'S200',
                method: tx.metadata?.method || (tx.type === 'Transfer' ? 'Asset Transfer' : 'EVM Op'),
                from: tx.from_addr,
                to: tx.to_addr,
                value: tx.value,
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
            }));

            setTransactions(formatted);

            // Routing Logic
            if (termToSearch.length > 50 && formatted.length === 1) {
                // It's a Tx Hash
                setSelectedTx(formatted[0]);
                setCurrentScreen('tx_detail');
                window.history.pushState({}, '', `?tx=${formatted[0].hash}`);
            } else if (termToSearch.length === 42 && termToSearch.startsWith('0x')) {
                // EVM Address
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

    // Deep Link Handling
    onMount(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const txHash = urlParams.get('tx');
        const addr = urlParams.get('address');
        const packetId = urlParams.get('packet');

        if (txHash) {
            handleSearch(txHash);
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
