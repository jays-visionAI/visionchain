import { Component, Show, createSignal } from 'solid-js';
import { X, RefreshCw } from 'lucide-solid';

interface ManualInviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInvite: (data: { email: string; partnerCode: string; tier: number; amountToken: number }) => Promise<void>;
    isInviting: boolean;
}

export const ManualInviteModal: Component<ManualInviteModalProps> = (props) => {
    const [email, setEmail] = createSignal('');
    const [partnerCode, setPartnerCode] = createSignal('');
    const [tier, setTier] = createSignal(1);
    const [amount, setAmount] = createSignal(1000);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        await props.onInvite({
            email: email(),
            partnerCode: partnerCode() || 'DIRECT',
            tier: tier(),
            amountToken: amount()
        });
    };

    return (
        <Show when={props.isOpen}>
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div class="w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-3xl p-8">
                    <div class="flex items-center justify-between mb-8">
                        <h2 class="text-2xl font-black italic">INVITE USER</h2>
                        <button onClick={props.onClose} class="text-gray-500 hover:text-white">
                            <X class="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} class="space-y-6">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email()}
                                onInput={(e) => setEmail(e.currentTarget.value)}
                                class="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                            />
                        </div>

                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Partner Code</label>
                            <input
                                type="text"
                                placeholder="DIRECT"
                                value={partnerCode()}
                                onInput={(e) => setPartnerCode(e.currentTarget.value)}
                                class="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                            />
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tier</label>
                                <select
                                    value={tier()}
                                    onChange={(e) => setTier(Number(e.currentTarget.value))}
                                    class="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                                >
                                    <option value={1}>Tier 1</option>
                                    <option value={2}>Tier 2</option>
                                    <option value={3}>Tier 3</option>
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">VCN Amount</label>
                                <input
                                    type="number"
                                    value={amount()}
                                    onInput={(e) => setAmount(Number(e.currentTarget.value))}
                                    class="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={props.isInviting}
                            class="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                        >
                            <Show when={props.isInviting}>
                                <RefreshCw class="w-4 h-4 animate-spin mx-auto" />
                            </Show>
                            <Show when={!props.isInviting}>Send Invitation</Show>
                        </button>
                    </form>
                </div>
            </div>
        </Show>
    );
};
