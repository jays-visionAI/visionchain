import { createSignal, onCleanup, For, Show } from 'solid-js';
import { Play, RotateCcw, Activity, FileText } from 'lucide-solid';
import { TPSGauge } from './DashboardCharts';
import { contractService } from '../../../services/contractService';

export const MaxTPSSection = () => {
    const [isTesting, setIsTesting] = createSignal(false);
    const [currentTps, setCurrentTps] = createSignal(0);
    const [peakTps, setPeakTps] = createSignal(0);
    const [avgTps, setAvgTps] = createSignal(0);
    const [testHistory, setTestHistory] = createSignal<any[]>(
        JSON.parse(localStorage.getItem('max_tps_history') || '[]')
    );
    const [progress, setProgress] = createSignal(0);

    const runMaxTest = async () => {
        if (isTesting()) return;

        setIsTesting(true);
        setCurrentTps(0);
        setPeakTps(0);
        setAvgTps(0);
        setProgress(0);

        const TEST_DURATION = 10000; // 10 seconds
        const startTime = Date.now();
        let txCount = 0;

        try {
            // Create an ephemeral wallet for the test
            const wallet = await contractService.createSimulatorWallet();
            let currentNonce = await wallet.getNonce();

            let lastTxCount = 0;
            let lastUpdate = startTime;

            const testInterval = setInterval(async () => {
                const now = Date.now();
                const totalElapsed = now - startTime;

                if (totalElapsed >= TEST_DURATION) {
                    clearInterval(testInterval);
                    finishTest(txCount, TEST_DURATION);
                    return;
                }

                setProgress((totalElapsed / TEST_DURATION) * 100);

                // Max burst injection
                const burstSize = 25;

                for (let i = 0; i < burstSize; i++) {
                    contractService.injectSimulatorTransaction(wallet, {
                        type: 'STRESS_TEST',
                        to: '0x0000000000000000000000000000000000000000',
                        value: '0',
                        nonce: currentNonce++
                    }).catch(() => { });
                    txCount++;
                }

                const deltaT = now - lastUpdate;
                if (deltaT >= 500) {
                    const instantTps = Math.floor((txCount - lastTxCount) / (deltaT / 1000));
                    setCurrentTps(instantTps);
                    if (instantTps > peakTps()) setPeakTps(instantTps);

                    lastTxCount = txCount;
                    lastUpdate = now;
                }

            }, 100);

            onCleanup(() => clearInterval(testInterval));
        } catch (error) {
            console.error("Max TPS Test initialization failed:", error);
            setIsTesting(false);
        }
    };

    const finishTest = (totalTx: number, duration: number) => {
        const finalAvgTps = Math.floor(totalTx / (duration / 1000));
        setAvgTps(finalAvgTps);
        setIsTesting(false);
        setProgress(100);

        const newRecord = {
            timestamp: new Date().toLocaleString(),
            avgTps: finalAvgTps,
            peakTps: peakTps()
        };

        const updatedHistory = [newRecord, ...testHistory()].slice(0, 10);
        setTestHistory(updatedHistory);
        localStorage.setItem('max_tps_history', JSON.stringify(updatedHistory));
    };

    return (
        <div class="bg-[#13161F] border border-white/5 rounded-2xl p-6 relative overflow-hidden flex flex-col items-center">
            <div class="w-full flex justify-between items-center mb-6">
                <div>
                    <h3 class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Max Performance</h3>
                    <h2 class="text-sm font-black italic">Test Max TPS</h2>
                </div>
                <button
                    onClick={runMaxTest}
                    disabled={isTesting()}
                    class={`px-5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 ${isTesting()
                        ? 'bg-blue-500/20 text-blue-400 cursor-not-allowed border border-blue-500/20'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                        }`}
                >
                    {isTesting() ? (
                        <>
                            <Activity class="w-3 h-3 animate-spin" />
                            {Math.floor(progress())}%
                        </>
                    ) : (
                        <>
                            <Play class="w-3 h-3 fill-current" />
                            Activate
                        </>
                    )}
                </button>
            </div>

            <div class="w-full relative py-6">
                <TPSGauge value={currentTps()} max={500} label="Peak Check" />
                <Show when={!isTesting() && avgTps() > 0}>
                    <div class="absolute inset-0 flex flex-col items-center justify-center pt-10">
                        <span class="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Result Avg</span>
                        <span class="text-xl font-mono text-white">{avgTps()}</span>
                    </div>
                </Show>
            </div>

            <div class="w-full grid grid-cols-2 gap-3 mt-4">
                <div class="bg-white/5 border border-white/5 p-3 rounded-xl text-center">
                    <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Peak</span>
                    <span class="text-xs font-mono font-bold text-white">{peakTps()} <span class="text-[8px] text-blue-400 italic">TPS</span></span>
                </div>
                <div class="bg-white/5 border border-white/5 p-3 rounded-xl text-center">
                    <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Average</span>
                    <span class="text-xs font-mono font-bold text-white">{avgTps()} <span class="text-[8px] text-green-400 italic">TPS</span></span>
                </div>
            </div>

            <div class="w-full mt-6 space-y-3">
                <div class="flex items-center justify-between px-1">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">TPS Audit Logs</span>
                    <RotateCcw
                        class="w-3 h-3 text-slate-500 hover:text-white cursor-pointer transition-colors"
                        onClick={() => {
                            setTestHistory([]);
                            localStorage.removeItem('max_tps_history');
                        }}
                    />
                </div>
                <div class="space-y-2 max-h-32 overflow-y-auto pr-1">
                    <For each={testHistory()} fallback={
                        <div class="py-6 text-center text-[9px] text-slate-600 italic">No stress tests performed</div>
                    }>
                        {(log) => (
                            <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-lg group hover:border-blue-500/30 transition-all">
                                <div class="flex flex-col">
                                    <span class="text-[8px] font-bold text-slate-400">{log.timestamp}</span>
                                    <span class="text-[9px] font-black text-white uppercase tracking-tight">Avg TPS: {log.avgTps}</span>
                                </div>
                                <div class="flex flex-col items-end">
                                    <span class="text-[10px] font-black text-blue-500 italic">{log.peakTps} Peak</span>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
};
