/**
 * VisionDEX Trading Arena - Initial Agent Setup Script
 *
 * Creates:
 * 1. Two MM agents (MM Alpha - bullish, MM Beta - bearish)
 * 2. Initial market state
 * 3. Engine settings
 *
 * Usage:
 *   node scripts/init-trading-agents.js [staging|production]
 */

const admin = require("firebase-admin");

// Choose environment
const env = process.argv[2] || "staging";
const projectId = env === "production" ? "visionchain-d19ed" : "visionchain-staging";

admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

const ADMIN_UID = "SYSTEM_ADMIN";
const INITIAL_PRICE = 0.10; // Initial VCN/USDT price

// ── Strategy Prompts ────────────────────────────────────────────────────────

const STRATEGY_PROMPTS = {
    momentum: `당신은 모멘텀/추세추종 전략을 사용하는 트레이더입니다.
핵심 원칙:
- 상승 추세에서 매수, 하락 추세에서 매도
- 현재가가 최근 평균보다 3% 이상 높으면 추세 상승 신호 -> 매수
- 현재가가 최근 평균보다 3% 이상 낮으면 추세 하락 신호 -> 매도
- 한 번에 잔고의 30-50%까지 투입 가능
주문 유형: 강한 추세 시 market, 불분명 시 limit`,

    value: `당신은 가치투자 전략을 사용하는 트레이더입니다.
핵심 원칙:
- 가격이 최근 고점 대비 15% 이상 하락 시에만 매수
- 최소 50% 이상 수익 시 매도
- 대부분 hold 결정 (인내심이 핵심)
주문 유형: 항상 limit (Maker)`,

    scalper: `당신은 스캘핑 전략을 사용하는 트레이더입니다.
핵심 원칙:
- 0.5-1% 변동에서 빠르게 수익 실현
- 잔고의 5-10%만 사용
- 0.3% 이상 손실이면 즉시 손절
주문 유형: 스프레드 넓으면 limit, 즉각 진입 시 market`,

    contrarian: `당신은 역발상/평균회귀 전략을 사용하는 트레이더입니다.
핵심 원칙:
- 가격 급등(5%+) 시 과매수 -> 매도
- 가격 급락(5%+) 시 과매도 -> 매수
- 잔고의 20-40% 투입
주문 유형: 주로 limit (Maker)`,

    grid: `당신은 그리드 트레이딩 전략을 사용하는 트레이더입니다.
핵심 원칙:
- 현재가 위아래 1% 간격 매수/매도 주문 배치
- 각 주문 잔고의 5-10%
주문 유형: 항상 limit (Maker) 전용`,

    breakout: `당신은 돌파 전략을 사용하는 트레이더입니다.
핵심 원칙:
- 최근 고점 돌파 시 강하게 매수 (40-60%)
- 최근 저점 하향 돌파 시 강하게 매도 (40-60%)
- 돌파가 아니면 hold
주문 유형: 항상 market (Taker)`,

    twap: `당신은 TWAP 전략을 사용하는 트레이더입니다.
핵심 원칙:
- 매 라운드마다 잔고의 3-5% 매수
- 가격에 관계없이 꾸준히 실행
주문 유형: 주로 market (Taker)`,

    sentiment: `당신은 감성분석 기반 트레이더입니다.
핵심 원칙:
- 프로젝트 진행 상황 분석하여 매매 결정
- 긍정적 뉴스 -> 매수, 부정적 뉴스 -> 매도
주문 유형: 확신 높으면 market, 애매하면 limit`,

    random: `당신은 완전히 무작위로 거래하는 벤치마크 에이전트입니다.
규칙:
- 매수(33%), 매도(33%), 홀드(33%) 랜덤
- 잔고의 5-15% 랜덤 금액
주문 유형: 랜덤하게 limit(50%) 또는 market(50%)`,

    dca: `당신은 DCA 전략을 사용하는 트레이더입니다.
핵심 원칙:
- 매 라운드마다 USDT의 1-2%로 VCN 매수
- 가격 무관 무조건 매수
- 총 수익 50% 이상일 때만 매도
주문 유형: 주로 market (Taker)`,
};

async function main() {
    console.log(`\n=== VisionDEX Trading Arena Initial Setup (${env}) ===\n`);

    // ── 1. Create MM Agents ──────────────────────────────────────────────

    const mmAlpha = {
        id: "mm-alpha",
        ownerUid: ADMIN_UID,
        name: "MM Alpha",
        role: "market_maker",
        strategy: {
            preset: "mm_bull",
            prompt: `당신은 VisionDEX의 공식 Market Maker "MM Alpha"입니다.
대규모 자본(500K USDT + 5M VCN) 운용. 장기 강세 시각.
매 라운드 기준가를 약간씩 상향 조정.
항상 양방향 5단계 호가 제공.`,
            riskLevel: 3,
            tradingFrequency: "high",
            maxPositionPercent: 5,
        },
        mmConfig: {
            basePrice: INITIAL_PRICE,
            spreadPercent: 0.5,
            priceRangePercent: 20,
            trendBias: 0.3,
            trendSpeed: 0.03,
            layerCount: 5,
            layerSpacing: 0.3,
            inventoryTarget: 0.5,
        },
        balances: { USDT: 500000, VCN: 5000000 },
        performance: {
            initialValueUSDT: 500000 + 5000000 * INITIAL_PRICE,
            currentValueUSDT: 500000 + 5000000 * INITIAL_PRICE,
            totalPnL: 0, totalPnLPercent: 0,
            winCount: 0, lossCount: 0, totalTrades: 0,
            bestTrade: 0, worstTrade: 0, maxDrawdown: 0,
        },
        recentTrades: [],
        status: "active",
        lastTradeAt: null,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
    };

    const mmBeta = {
        id: "mm-beta",
        ownerUid: ADMIN_UID,
        name: "MM Beta",
        role: "market_maker",
        strategy: {
            preset: "mm_bear",
            prompt: `당신은 VisionDEX의 공식 Market Maker "MM Beta"입니다.
대규모 자본(500K USDT + 5M VCN) 운용. 단기 보수적/약세 시각.
매 라운드 기준가를 약간씩 하향 조정.
항상 양방향 5단계 호가 제공.`,
            riskLevel: 3,
            tradingFrequency: "high",
            maxPositionPercent: 5,
        },
        mmConfig: {
            basePrice: INITIAL_PRICE,
            spreadPercent: 0.5,
            priceRangePercent: 20,
            trendBias: -0.2,
            trendSpeed: 0.03,
            layerCount: 5,
            layerSpacing: 0.3,
            inventoryTarget: 0.5,
        },
        balances: { USDT: 500000, VCN: 5000000 },
        performance: {
            initialValueUSDT: 500000 + 5000000 * INITIAL_PRICE,
            currentValueUSDT: 500000 + 5000000 * INITIAL_PRICE,
            totalPnL: 0, totalPnLPercent: 0,
            winCount: 0, lossCount: 0, totalTrades: 0,
            bestTrade: 0, worstTrade: 0, maxDrawdown: 0,
        },
        recentTrades: [],
        status: "active",
        lastTradeAt: null,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
    };

    await db.doc("dex/agents/list/mm-alpha").set(mmAlpha);
    console.log("[OK] MM Alpha created (bullish bias: +0.3)");

    await db.doc("dex/agents/list/mm-beta").set(mmBeta);
    console.log("[OK] MM Beta created (bearish bias: -0.2)");

    // ── 2. Create 10 Default Trading Agents ──────────────────────────────

    const presets = [
        { id: "momentum", name: "TrendFollower", riskLevel: 7, freq: "medium", maxPos: 50 },
        { id: "value", name: "ValueHunter", riskLevel: 3, freq: "low", maxPos: 30 },
        { id: "scalper", name: "QuickScalper", riskLevel: 5, freq: "high", maxPos: 10 },
        { id: "contrarian", name: "ContrarianBot", riskLevel: 6, freq: "medium", maxPos: 40 },
        { id: "grid", name: "GridMaster", riskLevel: 3, freq: "high", maxPos: 10 },
        { id: "breakout", name: "BreakoutKing", riskLevel: 8, freq: "low", maxPos: 60 },
        { id: "twap", name: "SteadyTWAP", riskLevel: 2, freq: "medium", maxPos: 5 },
        { id: "sentiment", name: "NewsSentinel", riskLevel: 5, freq: "low", maxPos: 30 },
        { id: "random", name: "RandomWalker", riskLevel: 5, freq: "medium", maxPos: 15 },
        { id: "dca", name: "DCABuilder", riskLevel: 2, freq: "medium", maxPos: 2 },
    ];

    const initialValue = 10000 + 100000 * INITIAL_PRICE;

    for (const p of presets) {
        const agentId = `default-${p.id}`;
        await db.doc(`dex/agents/list/${agentId}`).set({
            id: agentId,
            ownerUid: ADMIN_UID,
            name: p.name,
            role: "trader",
            strategy: {
                preset: p.id,
                prompt: STRATEGY_PROMPTS[p.id],
                riskLevel: p.riskLevel,
                tradingFrequency: p.freq,
                maxPositionPercent: p.maxPos,
            },
            balances: { USDT: 10000, VCN: 100000 },
            performance: {
                initialValueUSDT: initialValue,
                currentValueUSDT: initialValue,
                totalPnL: 0, totalPnLPercent: 0,
                winCount: 0, lossCount: 0, totalTrades: 0,
                bestTrade: 0, worstTrade: 0, maxDrawdown: 0,
            },
            recentTrades: [],
            status: "active",
            lastTradeAt: null,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        console.log(`[OK] Agent "${p.name}" (${p.id}) created`);
    }

    // ── 3. Initialize Market State ───────────────────────────────────────

    await db.doc("dex/market/VCN-USDT").set({
        pair: "VCN-USDT",
        lastPrice: INITIAL_PRICE,
        previousPrice: INITIAL_PRICE,
        change24h: 0,
        changePercent24h: 0,
        high24h: INITIAL_PRICE,
        low24h: INITIAL_PRICE,
        volume24h: 0,
        quoteVolume24h: 0,
        trades24h: 0,
        bestBid: 0,
        bestAsk: 0,
        spread: 0,
        spreadPercent: 0,
        makerVolume24h: 0,
        takerVolume24h: 0,
        totalFees24h: 0,
        openOrders: 0,
        activeAgents: 12,
        totalAgents: 12,
        updatedAt: admin.firestore.Timestamp.now(),
    });
    console.log(`[OK] Market state initialized (VCN/USDT = ${INITIAL_PRICE})`);

    // ── 4. Initialize Engine Settings ────────────────────────────────────

    await db.doc("dex/settings/config/main").set({
        paused: false,
        initialPrice: INITIAL_PRICE,
        maxPriceChangePerRound: 0.03,
        maxPriceChangePerDay: 0.15,
        roundIntervalMs: 120000,
        minOrderAmount: 100,
        createdAt: admin.firestore.Timestamp.now(),
    });
    console.log("[OK] Engine settings initialized");

    await db.doc("dex/settings/config/roundCounter").set({
        current: 0,
    });
    console.log("[OK] Round counter initialized");

    // ── Done ─────────────────────────────────────────────────────────────

    console.log(`
=== Setup Complete ===

Summary:
- 2 MM Agents (Alpha: bullish, Beta: bearish)
- 10 Trading Agents (one per strategy preset)
- Market initialized at $${INITIAL_PRICE} VCN/USDT
- Engine ready (paused: false)

Next steps:
1. Deploy Cloud Functions: firebase deploy --only functions
2. The tradingEngine scheduler will start running every 2 minutes
3. Users can create agents via tradingArenaAPI

Firestore paths:
- dex/agents/list/{agentId}
- dex/orders/list/{orderId}
- dex/trades/list/{tradeId}
- dex/market/VCN-USDT
- dex/candles/{interval}/{candleId}
- dex/rounds/log/{roundNumber}
- dex/settings/config/main
`);

    process.exit(0);
}

main().catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
});
