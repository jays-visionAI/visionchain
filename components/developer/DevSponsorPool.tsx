import { Component, createSignal, onMount, For } from 'solid-js';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Copy, CheckCircle, Clock, AlertTriangle } from 'lucide-solid';

interface DepositRecord {
    id: string;
    token: string;
    amount: string;
    status: 'PENDING' | 'CONFIRMED' | 'FAILED';
    confirmations: string;
    txHash: string;
    timestamp: string;
}

const DevSponsorPool: Component = () => {
    const [balances, setBalances] = createSignal<Record<string, { available: string; reserved: string }>>({});
    const [deposits, setDeposits] = createSignal<DepositRecord[]>([]);
    const [depositAddress, setDepositAddress] = createSignal('0x1234...abcd');
    const [copied, setCopied] = createSignal(false);

    onMount(async () => {
        setBalances({
            'VCN': { available: '10,000.00', reserved: '2,450.00' },
            'USDT': { available: '5,000.00', reserved: '200.00' },
            'USDC': { available: '3,500.00', reserved: '0.00' }
        });
        setDeposits([
            { id: 'd_001', token: 'VCN', amount: '5,000', status: 'CONFIRMED', confirmations: '64/64', txHash: '0xabc...123', timestamp: '2026-01-15 18:30' },
            { id: 'd_002', token: 'USDT', amount: '2,000', status: 'PENDING', confirmations: '12/64', txHash: '0xdef...456', timestamp: '2026-01-15 19:45' },
        ]);
    });

    const copyAddress = () => {
        navigator.clipboard.writeText(depositAddress());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header>
                <h1 class="text-3xl font-bold">Sponsor Pool</h1>
                <p class="text-gray-400 mt-2">Manage your sponsorship funds</p>
            </header>

            {/* Deposit Address */}
            <div class="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6 rounded-2xl border border-blue-500/20">
                <div class="text-sm text-blue-400 mb-2">Deposit Address (EVM Compatible)</div>
                <div class="flex items-center gap-4">
                    <code class="text-xl font-mono bg-black/30 px-4 py-2 rounded-lg flex-1">{depositAddress()}</code>
                    <button onClick={copyAddress} class="p-3 bg-white/5 hover:bg-white/10 rounded-lg transition">
                        {copied() ? <CheckCircle class="w-5 h-5 text-green-400" /> : <Copy class="w-5 h-5" />}
                    </button>
                </div>
                <p class="text-xs text-gray-400 mt-3">
                    <AlertTriangle class="w-3 h-3 inline mr-1" />
                    Only send VCN, USDT, or USDC to this address. Other tokens will not be credited.
                </p>
            </div>

            {/* Balances */}
            <div class="grid grid-cols-3 gap-6">
                <For each={Object.entries(balances())}>
                    {([token, { available, reserved }]) => (
                        <div class="p-6 bg-white/5 rounded-2xl border border-white/10">
                            <div class="text-sm text-gray-400 mb-2">{token}</div>
                            <div class="text-3xl font-bold mb-2">{available}</div>
                            <div class="text-xs text-yellow-400">Reserved: {reserved}</div>
                        </div>
                    )}
                </For>
            </div>

            {/* Actions */}
            <div class="flex gap-4">
                <button class="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold flex items-center gap-2">
                    <ArrowDownCircle class="w-5 h-5" /> Deposit
                </button>
                <button class="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex items-center gap-2">
                    <ArrowUpCircle class="w-5 h-5" /> Withdraw
                </button>
            </div>

            {/* Recent Deposits */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="p-4 border-b border-white/5">
                    <h2 class="text-lg font-bold">Recent Deposits</h2>
                </div>
                <table class="w-full text-sm">
                    <thead class="bg-white/5 text-left text-xs text-gray-400 uppercase">
                        <tr>
                            <th class="p-4">Token</th>
                            <th class="p-4">Amount</th>
                            <th class="p-4">Status</th>
                            <th class="p-4">Confirmations</th>
                            <th class="p-4">Tx Hash</th>
                            <th class="p-4">Time</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <For each={deposits()}>
                            {(d) => (
                                <tr class="hover:bg-white/[0.02]">
                                    <td class="p-4 font-bold">{d.token}</td>
                                    <td class="p-4 font-mono">{d.amount}</td>
                                    <td class="p-4">
                                        <span class={`px-2 py-1 text-xs font-bold rounded ${d.status === 'CONFIRMED' ? 'bg-green-500/20 text-green-400' : d.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {d.status === 'PENDING' && <Clock class="w-3 h-3 inline mr-1" />}
                                            {d.status === 'CONFIRMED' && <CheckCircle class="w-3 h-3 inline mr-1" />}
                                            {d.status}
                                        </span>
                                    </td>
                                    <td class="p-4 text-gray-400">{d.confirmations}</td>
                                    <td class="p-4 font-mono text-xs text-gray-400">{d.txHash}</td>
                                    <td class="p-4 text-gray-500">{d.timestamp}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DevSponsorPool;
