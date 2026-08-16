// Daily hub — the one screen that answers "what do I do today".
//
// Everything here already existed and none of it was reachable from one place:
// the login streak was tracked on every visit and displayed nowhere in the app,
// remaining game plays lived in the game centre, the daily tip only rendered on
// an empty chat screen, and the quests tab was five hardcoded cards of which
// three were "Quest Initializing" placeholders. The result was that the number
// of things a user did per visit could not grow, because nothing told them what
// was left.
//
// State is a single `daily.state` call. Slots are verified server-side, so this
// component only renders and claims — it never decides whether something is
// done.

import { createSignal, onMount, Show, For } from 'solid-js';
import { Flame, Check, Gamepad2, Send, Lightbulb, Share2, Gift, Loader2 } from 'lucide-solid';
import { gatewayCall } from '../../services/gatewayClient';

type SlotKey = 'checkin' | 'games' | 'mission' | 'tip' | 'share';

interface Slot {
    key: SlotKey;
    done: boolean;
    claimed: boolean;
    rp: number;
    progress?: number;
    target?: number;
    mission?: string;
}

interface DailyState {
    success?: boolean;
    day: string;
    slots: Slot[];
    combo: { rp: number; available: boolean; claimed: boolean };
    streak: {
        current: number;
        longest: number;
        multiplier: number;
        freezes: number;
        checkedInToday: boolean;
    };
    games: { remaining: Record<string, number>; playsToday: number };
    earnedToday: number;
}

// Copy is written from the user's side of the screen: what they do, not which
// collection it writes to.
const SLOT_META: Record<SlotKey, { icon: any; title: string; hint: string; nav?: string }> = {
    checkin: { icon: Flame, title: '출석 체크', hint: '탭 한 번으로 스트릭 유지' },
    games: { icon: Gamepad2, title: '게임 3판', hint: '미니게임 플레이', nav: 'game' },
    mission: { icon: Send, title: '오늘의 미션', hint: '매일 바뀝니다' },
    tip: { icon: Lightbulb, title: '오늘의 팁', hint: '읽고 받기' },
    share: { icon: Share2, title: '초대 공유', hint: '링크 한 번 공유' },
};

// The rotated mission names an action; say it the way a person would.
const MISSION_LABEL: Record<string, string> = {
    transfer_send: 'VCN 또는 토큰 전송하기',
    disk_upload: 'Vision Disk에 파일 올리기',
    staking_deposit: '스테이킹 예치하기',
    ai_chat: 'AI 에이전트와 대화하기',
    market_purchase: 'Vision Market 둘러보고 구매하기',
};

export const DailyHub = (props: { onNavigate?: (view: string) => void }) => {
    const [state, setState] = createSignal<DailyState | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [busy, setBusy] = createSignal<string | null>(null);
    const [flash, setFlash] = createSignal<string | null>(null);

    const load = async () => {
        try {
            const res = await gatewayCall<DailyState>('daily.state');
            if (res?.success) setState(res);
        } catch (e) {
            console.error('[DailyHub] state failed:', e);
        } finally {
            setLoading(false);
        }
    };
    onMount(load);

    const claim = async (slot: string) => {
        if (busy()) return;
        setBusy(slot);
        try {
            const res = await gatewayCall<{
                success?: boolean; awarded?: number; reason?: string;
                capped?: boolean; multiplier?: number; streak_bonus?: number;
            }>('daily.claim', { slot });

            if (res?.success && (res.awarded || 0) > 0) {
                const bonus = res.streak_bonus || 0;
                setFlash(bonus > 0 ? `+${res.awarded} RP (스트릭 보너스 +${bonus})` : `+${res.awarded} RP`);
            } else if (res?.reason === 'slot_incomplete') {
                setFlash('아직 완료되지 않았어요');
            } else if (res?.capped) {
                // Never show a silent zero: say why it was zero.
                setFlash('오늘 획득 상한에 도달했어요 — 내일 초기화됩니다');
            } else if (res?.reason === 'already_claimed') {
                setFlash('이미 받았어요');
            }
            setTimeout(() => setFlash(null), 3200);
            await load();
        } catch (e) {
            console.error('[DailyHub] claim failed:', e);
        } finally {
            setBusy(null);
        }
    };

    const doneCount = () => (state()?.slots || []).filter((s) => s.claimed).length;

    const share = async () => {
        // Completing the share IS opening the sheet / copying the link.
        const url = 'https://visionchain.co/signup';
        try {
            if (navigator.share) await navigator.share({ title: 'Vision Chain', url });
            else await navigator.clipboard.writeText(url);
        } catch { /* user dismissed the sheet — still counts as an attempt */ }
        await claim('share');
    };

    return (
        <div class="space-y-4">
            {/* Streak + progress header */}
            <div class="bg-gradient-to-br from-orange-600/10 via-[#111113] to-[#111113] border border-white/[0.06] rounded-[24px] p-5 lg:p-6">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                    <div class="flex items-center gap-4">
                        <div class="relative">
                            <div class="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                                <Flame class="w-7 h-7 text-orange-400" />
                            </div>
                        </div>
                        <div>
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">연속 출석</div>
                            <div class="flex items-baseline gap-2">
                                <span class="text-3xl font-black text-white italic tabular-nums">{state()?.streak.current ?? 0}</span>
                                <span class="text-sm font-bold text-gray-400">일</span>
                                <Show when={(state()?.streak.multiplier ?? 1) > 1}>
                                    <span class="ml-1 px-2 py-0.5 rounded-lg bg-orange-500/15 border border-orange-500/25 text-orange-300 text-xs font-black">
                                        x{state()!.streak.multiplier}
                                    </span>
                                </Show>
                            </div>
                        </div>
                    </div>

                    <div class="text-right">
                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">오늘 진행</div>
                        <div class="text-2xl font-black text-white italic tabular-nums">
                            {doneCount()}<span class="text-gray-600"> / 5</span>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div class="mt-4 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                        class="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                        style={`width: ${(doneCount() / 5) * 100}%`}
                    />
                </div>

                <Show when={(state()?.streak.multiplier ?? 1) > 1}>
                    <p class="mt-3 text-xs text-gray-500">
                        스트릭 배수가 오늘 받는 RP에 적용됩니다. 하루 건너뛰면 배수가 초기화됩니다.
                    </p>
                </Show>
            </div>

            {/* Flash message */}
            <Show when={flash()}>
                <div class="px-4 py-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-bold text-center">
                    {flash()}
                </div>
            </Show>

            {/* Slots */}
            <Show when={!loading()} fallback={
                <div class="flex items-center justify-center py-16 text-gray-600">
                    <Loader2 class="w-6 h-6 animate-spin" />
                </div>
            }>
                <div class="space-y-2">
                    <For each={state()?.slots || []}>{(slot) => {
                        const meta = SLOT_META[slot.key];
                        const Icon = meta.icon;
                        const isBusy = () => busy() === slot.key;
                        return (
                            <div class={`flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all ${
                                slot.claimed
                                    ? 'bg-emerald-500/[0.04] border-emerald-500/15'
                                    : 'bg-[#111113] border-white/[0.06] hover:border-white/[0.12]'
                            }`}>
                                <div class={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    slot.claimed ? 'bg-emerald-500/10' : 'bg-white/[0.04]'
                                }`}>
                                    <Show when={!slot.claimed} fallback={<Check class="w-5 h-5 text-emerald-400" />}>
                                        <Icon class="w-5 h-5 text-gray-400" />
                                    </Show>
                                </div>

                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class={`text-sm font-black ${slot.claimed ? 'text-gray-500 line-through' : 'text-white'}`}>
                                            {meta.title}
                                        </span>
                                        <span class="text-xs font-black text-cyan-400">+{slot.rp} RP</span>
                                    </div>
                                    <div class="text-xs text-gray-500 mt-0.5 truncate">
                                        {slot.key === 'mission' && slot.mission
                                            ? (MISSION_LABEL[slot.mission] || meta.hint)
                                            : slot.key === 'games'
                                                ? `${slot.progress ?? 0} / ${slot.target ?? 3} 판`
                                                : meta.hint}
                                    </div>
                                </div>

                                <Show when={!slot.claimed} fallback={
                                    <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex-shrink-0">완료</span>
                                }>
                                    <button
                                        disabled={isBusy()}
                                        onClick={() => {
                                            if (slot.key === 'share') return void share();
                                            // Not done yet and performed elsewhere → send them there.
                                            if (!slot.done && meta.nav && props.onNavigate) return props.onNavigate(meta.nav);
                                            void claim(slot.key);
                                        }}
                                        class={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all flex-shrink-0 disabled:opacity-50 ${
                                            slot.done || slot.key === 'checkin' || slot.key === 'tip' || slot.key === 'share'
                                                ? 'bg-cyan-500 text-black hover:bg-cyan-400'
                                                : 'bg-white/[0.06] text-gray-300 hover:bg-white/[0.1]'
                                        }`}
                                    >
                                        <Show when={!isBusy()} fallback={<Loader2 class="w-3.5 h-3.5 animate-spin" />}>
                                            {slot.done || slot.key === 'checkin' || slot.key === 'tip' || slot.key === 'share' ? '받기' : '하러가기'}
                                        </Show>
                                    </button>
                                </Show>
                            </div>
                        );
                    }}</For>
                </div>
            </Show>

            {/* Combo — expires at midnight, which is the point */}
            <Show when={state()?.combo && !state()!.combo.claimed}>
                <button
                    disabled={!state()!.combo.available || busy() === 'combo'}
                    onClick={() => void claim('combo')}
                    class={`w-full px-5 py-4 rounded-2xl font-black uppercase tracking-wide text-sm transition-all flex items-center justify-center gap-2 ${
                        state()!.combo.available
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110'
                            : 'bg-white/[0.03] border border-white/[0.06] text-gray-600 cursor-not-allowed'
                    }`}
                >
                    <Gift class="w-4 h-4" />
                    {state()!.combo.available
                        ? `콤보 보너스 +${state()!.combo.rp} RP 받기`
                        : `5칸 모두 완료 시 +${state()!.combo.rp} RP`}
                </button>
                <Show when={state()!.combo.available}>
                    <p class="text-center text-xs text-gray-600">자정이 지나면 사라집니다</p>
                </Show>
            </Show>
        </div>
    );
};
