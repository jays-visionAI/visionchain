# VisionDEX Trading Arena -- 개발 계획서 v2

## 1. 프로젝트 개요

### 1.1 비전
**모든 사용자**가 AI 트레이딩 에이전트를 생성하고, 자신만의 전략을 자유롭게 설정하여
USDT/VCN 모의 거래에 참여하는 **오픈 트레이딩 아레나**.

거래 결과는 **VCN의 실제 시세에 반영**되어, 다양한 전략을 가진 에이전트들의
집단적 가격 발견(Price Discovery)이 VCN 가격을 결정하는 **테스트 베드** 역할을 합니다.

### 1.2 핵심 콘셉트
```
  사용자가 에이전트 생성 + 전략 프롬프트 설정
              │
              ▼
  에이전트가 AI를 통해 시장 분석 & 자율 매매
              │
              ▼
  수백 개 에이전트들의 매수/매도 주문이 오더북에 집결
              │
              ▼
  오더북 매칭 → 체결 → 가격 형성
              │
              ▼
  체결 가격 = VCN의 실시간 시세 (vcnPriceService 반영)
              │
              ▼
  지갑, VisionScan, 차트에서 실시간 VCN 가격 확인
```

### 1.3 핵심 가치
| 가치 | 설명 |
|------|------|
| **가격 발견** | 에이전트들의 집단 거래가 VCN 시세를 자연스럽게 결정 |
| **사용자 참여** | 누구나 에이전트를 만들고 전략을 실험할 수 있음 |
| **테스트 베드** | 실제 자산이 아닌 모의 자산으로 리스크 없이 전략 검증 |
| **온체인 데이터** | DEX에 실제 호가, 체결, 차트 데이터 생성 |
| **경쟁 & 게임** | 리더보드를 통한 전략 경쟁, 수익률 순위 |

---

## 2. 사용자 경험 (User Flow)

### 2.1 에이전트 생성 (Wallet > Trading Arena)
```
┌────────────────────────────────────────────────────────────────────┐
│  Trading Arena                                          [내 에이전트]│
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌── 에이전트 만들기 ──────────────────────────────────────────┐  │
│  │                                                              │  │
│  │  이름: [________________]                                    │  │
│  │                                                              │  │
│  │  전략 유형: [추세추종 v]                                     │  │
│  │  ┌─ 빠른 선택 (10개 프리셋) ──────────────────────────────┐ │  │
│  │  │ [모멘텀] [가치투자] [스캘핑] [역발상] [그리드]          │ │  │
│  │  │ [돌파] [시간분할] [감성분석] [랜덤] [적립식]            │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  │                                                              │  │
│  │  전략 프롬프트 (자유 입력):                                  │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │ 가격이 20회 이동평균보다 3% 이상 상승하면 강하게 매수   │ │  │
│  │  │ 하고, 5% 하락 시 손절합니다. 트렌드가 명확하지 않으면  │ │  │
│  │  │ 소량만 탐색적으로 매매합니다. 연속 3회 손실이면 포지션  │ │  │
│  │  │ 크기를 절반으로 줄입니다.                               │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  │                                                              │  │
│  │  리스크 수준: [■■■■■■□□□□] 6/10                              │  │
│  │  거래 빈도: [중간 v]  (고/중/저)                              │  │
│  │                                                              │  │
│  │  초기 자산: 10,000 USDT + 100,000 VCN (모든 에이전트 동일)  │  │
│  │                                                              │  │
│  │  [에이전트 생성하기]                                          │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 내 에이전트 관리
```
┌────────────────────────────────────────────────────────────────────┐
│  내 에이전트                                                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌── Agent: "My Momentum Bot" ──────────────────────────────────┐ │
│  │  상태: 활성      |  전략: 추세추종  |  리스크: 6/10          │ │
│  │                                                              │ │
│  │  자산                                                        │ │
│  │  USDT: 12,345.67 (+23.5%)     VCN: 87,654 (-12.3%)         │ │
│  │                                                              │ │
│  │  총 평가액: $21,234.56 (+6.2%)                              │ │
│  │                                                              │ │
│  │  오늘 거래: 14건  |  승률: 64%  |  평균수익: +0.8%          │ │
│  │                                                              │ │
│  │  최근 거래:                                                  │ │
│  │  10:32  BUY   1,200 VCN @ 0.1015  "모멘텀 상승 감지"       │ │
│  │  10:28  SELL    800 VCN @ 0.1008  "단기 이익 실현"          │ │
│  │  10:24  BUY   2,000 VCN @ 0.0998  "지지선 반등 기대"       │ │
│  │                                                              │ │
│  │  [전략 수정]  [일시정지]  [삭제]                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  [+ 새 에이전트 만들기]  (최대 3개)                                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.3 리더보드 (전체 공개)
```
┌────────────────────────────────────────────────────────────────────┐
│  Trading Arena Leaderboard                                         │
├────────────────────────────────────────────────────────────────────┤
│  [일간]  [주간]  [월간]  [전체]                                    │
│                                                                    │
│  # │ 에이전트          │ 전략     │ 수익률   │ 승률  │ 거래수  │  │
│  ──┼───────────────────┼──────────┼──────────┼───────┼─────────┤  │
│  1 │ BreakoutKing      │ 돌파     │ +34.5%   │ 72%   │ 234     │  │
│  2 │ AlphaRunner       │ 모멘텀   │ +28.1%   │ 65%   │ 456     │  │
│  3 │ ValueHunter       │ 가치투자 │ +15.2%   │ 58%   │ 89      │  │
│  4 │ GridMaster        │ 그리드   │ +8.7%    │ 61%   │ 1,234   │  │
│  5 │ DCA_Bot           │ 적립식   │ +5.3%    │ -     │ 120     │  │
│    │ ...               │          │          │       │         │  │
│  48│ RandomWalker      │ 랜덤     │ -12.4%   │ 43%   │ 567     │  │
│                                                                    │
│  참가 에이전트: 127개  |  총 거래: 12,345건  |  24h 거래량: $54K  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. 시스템 아키텍처

```
┌────────────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (React)                           │
│  ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │에이전트 생성│  │에이전트 관리│  │리더보드   │  │DEX 트레이딩   │  │
│  │전략 프롬프트│  │잔고/PnL    │  │수익률순위 │  │호가/차트/체결 │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬────┘  └───────┬───────┘  │
│        │               │               │               │          │
└────────┼───────────────┼───────────────┼───────────────┼──────────┘
         │               │               │               │
         ▼               ▼               ▼               ▼
┌────────────────────────────────────────────────────────────────────┐
│                   FIRESTORE (데이터 레이어)                         │
│                                                                    │
│  users/{uid}/                                                      │
│    tradingAgents/{agentId}  -- 에이전트 프로필, 전략, 잔고          │
│                                                                    │
│  dex/                                                              │
│    orders/{orderId}         -- 오더북 주문                          │
│    trades/{tradeId}         -- 체결 기록                           │
│    orderbook/VCN-USDT       -- 현재 호가창 스냅샷                   │
│    market/VCN-USDT          -- 시장 통계 (가격, 24h vol 등)        │
│    candles/VCN-USDT/{interval}/{timestamp}                         │
│                              -- OHLCV 캔들 (1m, 5m, 1h, 1d)       │
│    leaderboard/             -- 에이전트 순위                        │
│                                                                    │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│              TRADING ENGINE (Cloud Function: tradingEngine)        │
│                           (매 2분 Cloud Scheduler 호출)            │
│                                                                    │
│  ┌─── Step 1: 시장 데이터 수집 ──────────────────────────────────┐│
│  │ 현재가, 오더북, 최근 체결, 24h 통계                            ││
│  └────────────────────────────────────────────────────────────────┘│
│                           │                                        │
│  ┌─── Step 2: AI 의사결정 (모든 활성 에이전트 병렬) ─────────────┐│
│  │ 에이전트별: 전략 프롬프트 + 시장 데이터 → Gemini API           ││
│  │ 결과: buy/sell/hold, 수량, 가격, 판단근거                      ││
│  └────────────────────────────────────────────────────────────────┘│
│                           │                                        │
│  ┌─── Step 3: 오더북 매칭 ───────────────────────────────────────┐│
│  │ 신규 주문 추가 → Price-Time Priority 매칭                      ││
│  │ 체결: 매수자 USDT↓ VCN↑ / 매도자 VCN↓ USDT↑                  ││
│  └────────────────────────────────────────────────────────────────┘│
│                           │                                        │
│  ┌─── Step 4: 가격 반영 ─────────────────────────────────────────┐│
│  │ 최종 체결가 → dex/market/VCN-USDT 업데이트                     ││
│  │ → vcnPriceService가 이 가격을 VCN 시세로 사용                  ││
│  │ → 지갑, VisionScan, 포트폴리오에 실시간 반영                   ││
│  └────────────────────────────────────────────────────────────────┘│
│                           │                                        │
│  ┌─── Step 5: 캔들 & 통계 갱신 ──────────────────────────────────┐│
│  │ OHLCV 업데이트, 에이전트 PnL 재계산, 리더보드 갱신             ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                   VCN PRICE FEED                                   │
│                                                                    │
│  dex/market/VCN-USDT.lastPrice                                    │
│        │                                                           │
│        ├──> vcnPriceService.ts (기존) → 지갑 잔고 표시             │
│        ├──> VisionScan → VCN 시세 차트                             │
│        ├──> Market Data → 포트폴리오 가치 계산                     │
│        └──> DEX UI → TradingView 차트                              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. 데이터 모델

### 4.1 Trading Agent (`users/{uid}/tradingAgents/{agentId}`)
```typescript
interface TradingAgent {
    id: string;                    // auto-generated
    ownerUid: string;              // 생성한 유저 UID
    name: string;                  // 에이전트 이름 (유저 설정)
    
    // ★ 에이전트 역할
    role: "trader" | "market_maker";
    // "trader"       = 일반 유저 에이전트 (기본)
    // "market_maker" = MM 에이전트 (어드민 전용, 대규모 자본, LP+MM 역할)
    
    // 전략 설정
    strategy: {
        preset: string;            // "momentum" | "value" | ... | "mm_bull" | "mm_bear" | "custom"
        prompt: string;            // 유저가 작성한 전략 프롬프트
        riskLevel: number;         // 1-10
        tradingFrequency: "high" | "medium" | "low";
        maxPositionPercent: number; // 1회 최대 주문 비율 (기본 30%)
    };
    
    // MM 전용 설정 (role === "market_maker" 일 때만)
    mmConfig?: {
        basePrice: number;           // 관리자 설정 기준가 (예: 0.10 USDT)
        spreadPercent: number;       // 스프레드 % (기본: 0.5%)
        priceRangePercent: number;   // 기준가 대비 허용 범위 (예: +-20%)
        trendBias: number;           // -1.0 ~ +1.0 (음수=약세, 양수=강세)
        trendSpeed: number;          // 추세 변화 속도 (0.01=느림 ~ 0.1=빠름)
        layerCount: number;          // 호가 레이어 수 (기본: 5)
        layerSpacing: number;        // 레이어 간격 % (기본: 0.3%)
        inventoryTarget: number;     // 목표 재고 비율 (0.5 = 50:50)
    };
    
    // 모의 잔고
    // 일반 에이전트: 10,000 USDT + 100,000 VCN
    // MM 에이전트:  500,000 USDT + 5,000,000 VCN
    balances: {
        USDT: number;
        VCN: number;
    };
    
    // 성과 통계
    performance: {
        initialValueUSDT: number;    // 시작 시 총 평가액
        currentValueUSDT: number;    // 현재 총 평가액
        totalPnL: number;            // 총 손익 (USDT)
        totalPnLPercent: number;     // 수익률 %
        winCount: number;
        lossCount: number;
        totalTrades: number;
        bestTrade: number;           // 최고 단일 수익
        worstTrade: number;          // 최악 단일 손실
        maxDrawdown: number;         // 최대 낙폭 %
    };
    
    // 최근 거래 캐시 (최신 10건)
    recentTrades: Array<{
        timestamp: number;
        side: "buy" | "sell";
        amount: number;
        price: number;
        reasoning: string;
    }>;
    
    status: "active" | "paused" | "stopped";
    lastTradeAt: Timestamp | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
```

### 4.2 DEX Order (`dex/orders/{orderId}`)
```typescript
interface DexOrder {
    id: string;
    agentId: string;
    ownerUid: string;
    pair: "VCN-USDT";
    side: "buy" | "sell";
    type: "limit" | "market";
    
    // ★ Maker/Taker 구분
    // - "maker": 호가창에 주문을 걸어놓고 체결 대기 (유동성 제공)
    // - "taker": 기존 호가에 즉시 체결 (유동성 소비)
    // - "pending": 아직 매칭되지 않음 (limit order가 book에 있는 상태)
    role: "maker" | "taker" | "pending";
    
    price: number;                 // USDT per VCN
    amount: number;                // VCN quantity
    filledAmount: number;
    remainingAmount: number;
    status: "open" | "partial" | "filled" | "cancelled" | "expired";
    
    // 수수료
    fee: number;                   // 체결 시 수수료 (USDT)
    feeRate: number;               // 적용된 수수료율
    
    reasoning: string;             // AI 판단 근거
    expiresAt: Timestamp;          // 최대 1시간 후 만료
    createdAt: Timestamp;
}
```

### 4.3 DEX Trade (`dex/trades/{tradeId}`)
```typescript
interface DexTrade {
    id: string;
    pair: "VCN-USDT";
    price: number;                 // 체결 가격 (maker의 지정가)
    amount: number;
    total: number;                 // price * amount
    takerSide: "buy" | "sell";     // taker의 방향
    
    // ★ Maker/Taker 구분
    makerAgentId: string;          // 호가를 걸어놓은 에이전트 (유동성 제공자)
    makerUid: string;
    makerOrderId: string;
    makerFee: number;              // maker 수수료 (더 낮음)
    
    takerAgentId: string;          // 호가를 소비한 에이전트
    takerUid: string;
    takerOrderId: string;
    takerFee: number;              // taker 수수료 (더 높음)
    
    timestamp: Timestamp;
}
```

### 4.4 Maker/Taker 수수료 구조
```typescript
interface FeeStructure {
    // 기본 수수료율
    makerFeeRate: 0.02;            // 0.02% (호가 제공자 = 낮은 수수료)
    takerFeeRate: 0.05;            // 0.05% (호가 소비자 = 높은 수수료)
    
    // MM Agent 수수료율
    mmMakerFeeRate: 0.00;          // 0% (MM은 maker 수수료 면제)
    mmTakerFeeRate: 0.01;          // 0.01% (MM이 taker가 되는 드문 경우)
}

// 수수료 계산 예시:
// Agent가 limit order 1,000 VCN @ 0.10 USDT 로 매수 주문 (maker)
// -> 체결 시 수수료 = 1,000 * 0.10 * 0.0002 = 0.02 USDT
//
// Agent가 market order로 즉시 매수 (taker)
// -> 체결 시 수수료 = 1,000 * 0.10 * 0.0005 = 0.05 USDT
```

### 4.5 Maker/Taker 주문 흐름
```
Maker 흐름 (limit order -> 호가창에 대기):

  Agent: "0.0980에 5,000 VCN 매수" (limit order)
       |
       v
  현재 최저 매도호가(best ask) = 0.1000
  0.0980 < 0.1000 이므로 즉시 체결 불가
       |
       v
  호가창 BUY에 등록 -> role = "pending" -> 누군가 매도가 올 때까지 대기
       |
       v
  다른 에이전트가 시장가 매도 또는 0.0980 이하 매도 주문 진입
       |
       v
  매칭 -> 체결! -> 원래 매수 주문 = "maker", 새 매도 주문 = "taker"


Taker 흐름 (market order -> 즉시 체결):

  Agent: "시장가로 3,000 VCN 매수" (market order)
       |
       v
  현재 호가창 SELL:
    0.1000 [10,000 VCN]  <- best ask
    0.1005 [5,000 VCN]
    0.1010 [8,000 VCN]
       |
       v
  0.1000에서 3,000 VCN 즉시 체결
  이 시장가 주문 = "taker", 0.1000 매도 주문 = "maker"


Limit Order가 Taker가 되는 경우:

  Agent: "0.1020에 2,000 VCN 매수" (limit order)
       |
       v
  현재 최저 매도호가(best ask) = 0.1000
  0.1020 >= 0.1000 이므로 즉시 체결 가능!
       |
       v
  0.1000에서 2,000 VCN 체결 (체결가 = maker의 가격 0.1000)
  이 매수 주문 = "taker" (기존 호가를 소비했으므로)
```

### 4.6 Market State (`dex/market/VCN-USDT`)
```typescript
interface MarketState {
    pair: "VCN-USDT";
    lastPrice: number;             // ★ VCN 시세로 사용됨
    previousPrice: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;             // VCN 거래량
    quoteVolume24h: number;        // USDT 거래량
    trades24h: number;
    
    // 오더북 요약
    bestBid: number;
    bestAsk: number;
    spread: number;
    spreadPercent: number;
    
    // Maker/Taker 통계
    makerVolume24h: number;        // maker 체결 거래량
    takerVolume24h: number;        // taker 체결 거래량
    totalFees24h: number;          // 총 수수료
    openOrders: number;            // 호가창 미체결 주문 수
    
    activeAgents: number;          // 활성 에이전트 수
    totalAgents: number;           // 전체 에이전트 수
    
    updatedAt: Timestamp;
}
```

### 4.5 OHLCV Candle (`dex/candles/VCN-USDT/{interval}`)
```typescript
// Document ID = interval (예: "1m", "5m", "1h", "1d")
// Sub-collection: candles/{timestamp}
interface OHLCVCandle {
    t: number;                     // Unix timestamp (interval 시작)
    o: number;                     // Open
    h: number;                     // High
    l: number;                     // Low
    c: number;                     // Close
    v: number;                     // Volume (VCN)
    qv: number;                    // Quote Volume (USDT)
    n: number;                     // Number of trades
}
```

---

## 5. Market Maker (MM) 에이전트

### 5.1 개요

**2개의 MM 에이전트**가 시스템의 핵심 유동성 제공자(LP + Market Maker)로 참여합니다.
일반 에이전트의 **50배 자본**을 보유하며, 항상 양방향(매수+매도) 호가를 제공합니다.

```
┌────────────────────────────────────────────────────────────────────┐
│                    시장 구조 (Market Microstructure)                │
│                                                                    │
│  MM Agent 1 (강세 편향)          MM Agent 2 (약세 편향)            │
│  ┌──────────────────────┐       ┌──────────────────────┐          │
│  │ 자본: 500K USDT      │       │ 자본: 500K USDT      │          │
│  │       5M VCN         │       │       5M VCN         │          │
│  │                      │       │                      │          │
│  │ 역할:                │       │ 역할:                │          │
│  │ - 매수호가 5단계     │       │ - 매수호가 5단계     │          │
│  │ - 매도호가 5단계     │       │ - 매도호가 5단계     │          │
│  │ - 스프레드 0.3-0.5%  │       │ - 스프레드 0.3-0.5%  │          │
│  │                      │       │                      │          │
│  │ 추세: 점진적 상승    │       │ 추세: 점진적 하락    │          │
│  │ trendBias: +0.3      │       │ trendBias: -0.2      │          │
│  └──────────┬───────────┘       └──────────┬───────────┘          │
│             │                               │                      │
│             └───────────┬───────────────────┘                      │
│                         │                                          │
│                         ▼                                          │
│              ┌─────────────────────┐                               │
│              │   호가창 (Order Book)│    ← 일반 에이전트들도 참여   │
│              │                     │                               │
│              │  SELL 0.1025 [5,000]│  ← MM2                        │
│              │  SELL 0.1020 [8,000]│  ← MM1 + 일반                 │
│              │  SELL 0.1015 [12K]  │  ← MM1                        │
│              │  ─── 0.1012 ───────│  현재가                        │
│              │  BUY  0.1010 [15K]  │  ← MM1                        │
│              │  BUY  0.1005 [10K]  │  ← MM1 + 일반                 │
│              │  BUY  0.1000 [7,000]│  ← MM2                        │
│              └─────────────────────┘                               │
│                                                                    │
│  ★ MM이 양방향 호가를 항상 제공하므로                              │
│    일반 에이전트가 언제든 즉시 체결 가능                            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 MM Agent 자본 규모

| 구분 | USDT | VCN | 비고 |
|------|------|-----|------|
| **MM Agent 1** (강세) | 500,000 | 5,000,000 | 일반의 50배 |
| **MM Agent 2** (약세) | 500,000 | 5,000,000 | 일반의 50배 |
| 일반 에이전트 | 10,000 | 100,000 | 기본 |

### 5.3 MM 동작 방식

매 라운드(2분)마다:

```
1. 현재 재고 비율 확인 (VCN vs USDT)
   → 재고 불균형 시 한쪽 호가를 더 공격적으로 조정

2. 개별 추세(trendBias)에 따라 기준가 미세 조정
   → MM1(강세): 기준가를 매 라운드 +0.01~0.05% 상향
   → MM2(약세): 기준가를 매 라운드 -0.01~0.03% 하향
   → 두 MM의 추세가 합쳐져 시장 가격이 자연스럽게 형성

3. 양방향 레이어 호가 배치
   BUY:  기준가 - spread/2 - (layer * spacing)
   SELL: 기준가 + spread/2 + (layer * spacing)

4. 이전 미체결 주문 취소 후 새 호가로 교체
```

### 5.4 추세 형성 메커니즘

```
시간 →

가격
  ^                                          MM1의 추세 (강세)
  |                                       ╱
  |                              ╱╲      ╱
  |                    ╱╲      ╱    ╲  ╱   ← 두 MM의 추세가 합쳐진
  |           ╱╲      ╱    ╲  ╱      ╲╱      실제 가격 궤적
  |  ╱╲      ╱    ╲  ╱      ╲╱
  | ╱    ╲  ╱      ╲╱
  |╱      ╲╱                        ╲
  |                                   ╲
  |                                     ╲  MM2의 추세 (약세)
  +──────────────────────────────────────→ 시간

MM1 trendBias: +0.3 (서서히 가격 올림)
MM2 trendBias: -0.2 (서서히 가격 내림)

결과: 두 MM의 힘이 합쳐져 약간 상승 편향의 변동성 있는 가격 형성
     (+0.3 + (-0.2) = +0.1 순강세)
```

### 5.5 MM 전략 프롬프트

#### MM Agent 1: "VisionDEX MM Alpha" (강세 편향)
```
당신은 VisionDEX의 공식 Market Maker "MM Alpha"입니다.
당신은 대규모 자본(500K USDT + 5M VCN)을 운용합니다.

역할:
1. 항상 매수호가와 매도호가를 동시에 제시 (양방향 유동성 제공)
2. 기준가 주변 0.3-0.5% 스프레드 유지
3. Vision Chain 프로젝트에 대해 장기적으로 강세적 시각
4. 매 라운드 기준가를 약간씩(0.01-0.05%) 상향 조정
5. 재고 균형 유지: VCN 비중이 60% 넘으면 매도호가를 공격적으로

호가 배치:
- BUY: 기준가 아래 5단계 (각 0.3% 간격)
- SELL: 기준가 위 5단계 (각 0.3% 간격)
- 각 레이어 수량: 잔고의 2-5%

JSON 응답: {"orders": [{"side": "buy"|"sell", "price": 숫자, "amount": 숫자}]}
```

#### MM Agent 2: "VisionDEX MM Beta" (약세 편향)
```
당신은 VisionDEX의 공식 Market Maker "MM Beta"입니다.
당신은 대규모 자본(500K USDT + 5M VCN)을 운용합니다.

역할:
1. 항상 매수호가와 매도호가를 동시에 제시 (양방향 유동성 제공)
2. 기준가 주변 0.3-0.5% 스프레드 유지
3. 단기적으로 보수적/약세적 시각 (리스크 관리 중시)
4. 매 라운드 기준가를 약간씩(0.01-0.03%) 하향 조정
5. 재고 균형 유지: USDT 비중이 60% 넘으면 매수호가를 공격적으로

호가 배치:
- BUY: 기준가 아래 5단계 (각 0.3% 간격)
- SELL: 기준가 위 5단계 (각 0.3% 간격)
- 각 레이어 수량: 잔고의 2-5%

JSON 응답: {"orders": [{"side": "buy"|"sell", "price": 숫자, "amount": 숫자}]}
```

### 5.6 MM과 일반 에이전트의 관계

| 특성 | MM Agent | 일반 에이전트 |
|------|----------|----------|
| 생성 권한 | 어드민만 | 모든 유저 |
| 자본 규모 | 50배 (500K USDT + 5M VCN) | 1배 (10K USDT + 100K VCN) |
| 호가 방식 | 항상 양방향 다중 레이어 | AI 판단에 따라 한 방향 |
| 역할 | 유동성 제공, 가격 安定 | 가격 발견, 전략 경쟁 |
| 리더보드 | 별도 표시 ("MM" 배지) | 순위 경쟁 |
| 자기거래 | MM1 <-> MM2 체결 허용 | 같은 유저 에이전트 간 차단 |
| 실행 순서 | 일반 에이전트보다 먼저 실행 | MM 호가 배치 후 실행 |

### 5.7 Trading Engine 실행 순서 (Maker-First 매칭)

```
매 라운드 (2분 간격):

Step 1: MM Agent 호가 갱신 (Maker)
  - 기존 미체결 주문 전량 취소
  - MM1, MM2 각각 5단계 BUY + 5단계 SELL 지정가 주문 배치
  - 이 주문들은 모두 role="pending" (Maker 대기)
  - 호가창에 즉시 반영

Step 2: 일반 에이전트 AI 의사결정 (병렬)
  - 시장 데이터 + 호가창 정보 + 전략 프롬프트 -> Gemini API
  - 응답: action, orderType(limit/market), amount, price

Step 3: 주문 처리 (Maker/Taker 분류)
  ┌─ limit order (Maker 지향)
  │   - 매수 지정가 < best ask -> 호가창 BUY에 등록 (Maker 대기)
  │   - 매수 지정가 >= best ask -> 즉시 체결 (실제로는 Taker)
  │   - 매도 지정가 > best bid -> 호가창 SELL에 등록 (Maker 대기)
  │   - 매도 지정가 <= best bid -> 즉시 체결 (실제로는 Taker)
  │
  └─ market order (Taker)
      - 매수 -> best ask부터 순서대로 체결
      - 매도 -> best bid부터 순서대로 체결

Step 4: 매칭 엔진 실행
  - Price-Time Priority 매칭
  - 체결가 = Maker의 지정가 (항상 Maker 유리)
  - 부분 체결 지원
  - Maker 수수료: 0.02% / Taker 수수료: 0.05%

Step 5: 체결 후 처리
  - 잔고 업데이트 (수수료 차감 포함)
  - DexTrade 기록 (makerAgentId, takerAgentId 구분)
  - OHLCV 캔들 갱신
  - dex/market/VCN-USDT.lastPrice 업데이트
  - 에이전트 PnL 재계산
```

---

## 6. 10개 기본 전략 프리셋 (일반 에이전트용)

### 6.1 전략 목록

| # | ID | 이름 | 핵심 로직 | 리스크 | 빈도 | Maker/Taker 성향 |
|---|-----|------|----------|--------|------|-----------------|
| 1 | momentum | 추세추종 | 이동평균 돌파 시 큰 포지션 | 7/10 | 중간 | Taker 위주 |
| 2 | value | 가치투자 | 급락 시만 매수, 장기 보유 | 3/10 | 낮음 | Maker 위주 |
| 3 | scalper | 스캘핑 | 작은 변동에서 빈번한 소량 매매 | 5/10 | 높음 | Maker+Taker |
| 4 | contrarian | 역발상 | 과매수 시 매도, 과매도 시 매수 | 6/10 | 중간 | Maker 위주 |
| 5 | grid | 그리드 | 일정 간격 매수/매도 주문 배치 | 3/10 | 높음 | Maker 전용 |
| 6 | breakout | 돌파 | 지지/저항 돌파 시 공격적 진입 | 8/10 | 낮음 | Taker 전용 |
| 7 | twap | 시간가중 | 큰 포지션 시간 분할 매매 | 2/10 | 중간 | Taker 위주 |
| 8 | sentiment | 감성분석 | 뉴스/업데이트 기반 판단 | 5/10 | 낮음 | 혼합 |
| 9 | random | 랜덤 | 완전 무작위 (벤치마크) | 5/10 | 중간 | 랜덤 |
| 10 | dca | 적립식 | 라운드마다 일정량 매수 | 2/10 | 중간 | Taker 위주 |

### 6.2 AI 응답 포맷 (Maker/Taker 선택 포함)

모든 에이전트의 AI 응답은 다음 JSON 형식을 따릅니다:

```typescript
// AI 응답 포맷
interface AITradeDecision {
    action: "buy" | "sell" | "hold";
    orderType: "limit" | "market";   // ★ Maker/Taker 선택
    // - "limit"  = Maker: 지정가로 호가창에 등록, 체결 대기 (수수료 0.02%)
    // - "market" = Taker: 시장가로 즉시 체결 (수수료 0.05%)
    amount: number;                  // VCN 수량
    price: number;                   // limit일 때 지정가, market일 때 0
    reasoning: string;               // 판단 근거
}

// 에이전트에게 전달하는 시장 데이터에 호가창 정보 포함
interface MarketDataForAgent {
    currentPrice: number;
    change24h: number;
    avgPrice20: number;              // 최근 20개 체결 평균가
    bestBid: number;                 // 최고 매수호가 (이 가격에 매도하면 Taker)
    bestAsk: number;                 // 최저 매도호가 (이 가격에 매수하면 Taker)
    spread: number;                  // 스프레드 %
    bidDepth: number;                // 매수 총 물량
    askDepth: number;                // 매도 총 물량
    recentTrades: Trade[];           // 최근 체결 내역
    myOpenOrders: Order[];           // 내 미체결 주문 (호가창에 걸어놓은 것)
    usdtBalance: number;
    vcnBalance: number;
    makerFee: string;                // "0.02%"
    takerFee: string;                // "0.05%"
}
```

AI 프롬프트 공통 접미사 (모든 전략에 추가):
```
주문 유형 선택:
- "limit" (Maker): 원하는 가격에 호가창에 등록. 체결 대기하지만 수수료 저렴 (0.02%)
  * 현재가보다 낮은 가격에 매수 주문 -> 매수 호가창에 등록
  * 현재가보다 높은 가격에 매도 주문 -> 매도 호가창에 등록
- "market" (Taker): 현재 호가에 즉시 체결. 빠르지만 수수료 비쌈 (0.05%)
  * 즉시 매수 = 최저 매도호가(best ask)에 체결
  * 즉시 매도 = 최고 매수호가(best bid)에 체결

현재 호가창:
- Best Bid (최고 매수호가): {bestBid} USDT
- Best Ask (최저 매도호가): {bestAsk} USDT
- Spread: {spread}%
- 내 미체결 주문: {myOpenOrders}

JSON 형식으로 응답하세요:
{
  "action": "buy" | "sell" | "hold",
  "orderType": "limit" | "market",
  "amount": 숫자 (VCN),
  "price": 숫자 (limit일 때 지정가, market일 때 0),
  "reasoning": "판단 근거"
}
```

### 6.3 전략 프롬프트 상세

#### Momentum (추세추종)
```
당신은 모멘텀/추세추종 전략을 사용하는 트레이더입니다.

핵심 원칙:
- 상승 추세에서 매수, 하락 추세에서 매도
- 현재가가 최근 평균보다 3% 이상 높으면 추세 상승 신호 -> 매수
- 현재가가 최근 평균보다 3% 이상 낮으면 추세 하락 신호 -> 매도
- 추세가 불분명하면 소량(5-10%)만 탐색적 매매
- 연속 3회 손실 시 포지션 크기를 절반으로 축소
- 한 번에 잔고의 30-50%까지 투입 가능

주문 유형 가이드:
- 강한 추세 확인 시: market order (Taker) -> 즉시 진입
- 추세 불분명 시: limit order (Maker) -> 유리한 가격에 대기
```

#### Value (가치투자)
```
당신은 가치투자 전략을 사용하는 트레이더입니다.

핵심 원칙:
- 가격이 충분히 저평가되었을 때만 매수 (최근 고점 대비 15% 이상 하락)
- 매수 후 장기 보유, 최소 50% 이상 수익 시 매도
- 급락장에서 잔고의 20-30%씩 분할 매수
- 대부분의 라운드에서 "hold" 결정 (인내심이 핵심)
- 패닉 매도는 절대 하지 않음
```

#### Scalper (스캘핑)
```
당신은 스캘핑 전략을 사용하는 트레이더입니다.

핵심 원칙:
- 아주 작은 가격 변동(0.5-1%)에서 빠르게 수익 실현
- 한 번에 잔고의 5-10%만 사용
- 매수 후 0.5% 이상 수익이면 즉시 매도
- 0.3% 이상 손실이면 즉시 손절
- 매 라운드마다 적극적으로 거래
- 양방향(매수+매도) 동시 주문 가능
```

#### Contrarian (역발상)
```
당신은 역발상/평균회귀 전략을 사용하는 트레이더입니다.

핵심 원칙:
- 다수가 매수할 때 매도, 다수가 매도할 때 매수
- 가격이 급등(5%+)했으면 과매수 → 매도
- 가격이 급락(5%+)했으면 과매도 → 매수
- "가격은 결국 평균으로 회귀한다"가 철학
- 잔고의 20-40% 투입
```

#### Grid (그리드)
```
당신은 그리드 트레이딩 전략을 사용하는 트레이더입니다.

핵심 원칙:
- 현재가 위아래로 1% 간격의 매수/매도 주문을 배치
- 현재가보다 1-3% 낮은 가격에 매수 주문 배치
- 현재가보다 1-3% 높은 가격에 매도 주문 배치
- 각 주문은 잔고의 5-10%
- 횡보장에서 가장 효과적
```

#### Breakout (돌파)
```
당신은 돌파 전략을 사용하는 트레이더입니다.

핵심 원칙:
- 최근 고점을 돌파하면 강하게 매수 (잔고의 40-60%)
- 최근 저점을 돌파(하향)하면 강하게 매도 (보유의 40-60%)
- 돌파가 아닌 경우 매매하지 않음 (hold)
- 돌파 판단: 최근 10개 체결의 최고/최저가 갱신
- 한번 진입하면 큰 수익을 노림
```

#### TWAP (시간가중)
```
당신은 TWAP(Time-Weighted Average Price) 전략을 사용하는 트레이더입니다.

핵심 원칙:
- 전체 목표 물량을 여러 라운드에 걸쳐 분할 매매
- 매 라운드마다 잔고의 3-5%를 시장가 매수
- 가격에 관계없이 꾸준히 실행
- 시장 충격을 최소화하는 것이 목표
- 대세 하락장이면 매수 비중 줄임
```

#### Sentiment (감성분석)
```
당신은 감성분석 기반 트레이더입니다.

핵심 원칙:
- 프로젝트 진행 상황을 분석하여 매매 결정
- 긍정적 뉴스/업데이트 → 매수 (20-30%)
- 부정적 뉴스/우려 → 매도 (20-30%)
- 뉴스가 없으면 보유 (hold)
- Vision Chain의 기술 발전, 파트너십, 커뮤니티 성장을 고려
```

#### Random (랜덤) -- 벤치마크용
```
당신은 완전히 무작위로 거래하는 벤치마크 에이전트입니다.

규칙:
- 매 라운드 랜덤하게: 매수(33%), 매도(33%), 홀드(33%)
- 매매 시 잔고의 5-15% 랜덤 금액
- 가격은 현재가 ±1% 사이 랜덤
- 어떠한 분석도 하지 않음
- 이 에이전트보다 성과가 나쁜 전략은 의미없음
```

#### DCA (적립식)
```
당신은 Dollar Cost Averaging 전략을 사용하는 트레이더입니다.

핵심 원칙:
- 매 라운드마다 USDT의 1-2%로 VCN을 매수
- 가격이 어떻든 무조건 매수 (시장 타이밍 무시)
- 매도는 총 평가 수익이 50% 이상일 때만
- 가격 하락은 오히려 저가 매수 기회
- 장기적으로 시장 평균을 추종하는 것이 목표
```

---

## 6. VCN 시세 반영 메커니즘

### 6.1 가격 파이프라인
```
Trading Engine 체결가
       │
       ▼
dex/market/VCN-USDT.lastPrice
       │
       ▼
vcnPriceService.ts 수정:
  기존: admin 설정 또는 외부 API 가격
  변경: dex/market/VCN-USDT.lastPrice 우선 사용
       │
       ├──> Wallet 화면: VCN 잔고 × lastPrice = USD 가치
       ├──> VisionScan: VCN 시세 차트
       ├──> Portfolio: 총 자산 가치 계산
       └──> Market Data: 가격 변동률 등
```

### 6.2 가격 안정화 규칙
- 초기 기준가: 관리자 설정 (예: 0.10 USDT)
- 라운드당 가격 변동 제한: 최대 +-3%
- 일일 가격 변동 제한: 최대 +-15%
- 최소 호가 단위: 0.0001 USDT
- 최소 주문 수량: 100 VCN

---

## 7. 제한 및 규칙

### 7.1 에이전트 유형별 제한
| 항목 | 일반 에이전트 | MM 에이전트 |
|------|-------------|-------------|
| 생성 권한 | 모든 유저 | 어드민만 |
| 에이전트 수 | 유저당 최대 3개 | 시스템 2개 (고정) |
| 초기 자산 | 10,000 USDT + 100,000 VCN | 500,000 USDT + 5,000,000 VCN |
| 1회 최대 주문 | 잔고의 50% | 잔고의 5% (레이어당) |
| 주문 유효시간 | 1시간 (이후 자동 취소) | 매 라운드 갱신 |
| 전략 프롬프트 길이 | 최대 2,000자 | 무제한 (어드민 관리) |
| AI 모델 | Gemini 2.0 Flash | Gemini 2.0 Flash |
| 라운드당 주문 | 최대 1건 | 최대 10건 (5 buy + 5 sell) |

### 7.2 어뷰징 방지
- 자기 거래(Wash Trading) 감지: 같은 유저의 에이전트 간 거래 차단
- MM 에이전트 간 거래: 허용 (유동성 순환)
- 비정상 프롬프트 필터: 시스템 manipulate 시도 차단
- 거래 빈도 제한: 일반 에이전트당 라운드 최대 1건

---

## 8. 개발 단계

### Phase 1: 코어 엔진 (2일)
```
services/trading/
  types.ts             -- TypeScript 인터페이스 정의
  strategies.ts        -- 10개 전략 프리셋 프롬프트
  aiDecision.ts        -- Gemini API → 매매 결정
  orderbook.ts         -- 오더북 매칭 엔진
  engine.ts            -- 메인 트레이딩 라운드 실행
  candles.ts           -- OHLCV 캔들 생성/업데이트
  priceFeed.ts         -- VCN 시세 업데이트 (vcnPriceService 연동)

functions/
  index.js             -- tradingEngine Cloud Function 추가
```

### Phase 2: 초기 에이전트 & 자동 실행 (1일)
- 기본 10개 에이전트 생성 스크립트
- Cloud Scheduler (매 2분)
- 잔고 추적 & PnL 계산
- vcnPriceService 연동

### Phase 3: 트레이딩 터미널 UI (2-3일)

Axiom Trade 스타일의 전문 트레이딩 인터페이스 구현.
```
components/
  trading/
    TradingTerminal.tsx        -- 메인 트레이딩 터미널 (3-Column Layout)
    CandlestickChart.tsx       -- VCN/USDT 캔들차트 (자체 구현 + SVG)
    OrderBookPanel.tsx         -- 실시간 호가창 (매수/매도 깊이)
    RecentTrades.tsx           -- 최근 체결 피드
    MarketHeader.tsx           -- 상단 시장 정보 바
    AgentWatchPanel.tsx        -- 내 에이전트 관전 패널 (실시간 거래 로그)
    CreateAgentModal.tsx       -- 에이전트 생성/전략 설정 모달
    AgentCard.tsx              -- 에이전트 상태 카드
    Leaderboard.tsx            -- 수익률 순위 리더보드
    StrategyEditor.tsx         -- 전략 프롬프트 편집기
    DepthChart.tsx             -- 시장 깊이 차트 (매수/매도 벽)
    TimeframeSelector.tsx      -- 캔들 주기 선택 (1m, 5m, 15m, 1h, 4h, 1d)
```

### Phase 4: 어드민 대시보드 (1-2일)
```
components/
  admin/
    AdminTradingArena.tsx      -- 어드민 트레이딩 아레나 메인
    AgentBalanceHistory.tsx    -- 에이전트별 밸런스 변경 내역 테이블
    MMConfigPanel.tsx          -- MM Agent 파라미터 실시간 조정
    MarketControlPanel.tsx     -- 시장 파라미터 (기준가, 변동제한)
    TradingEngineStatus.tsx    -- 엔진 상태, 라운드 로그
```

### Phase 5: 통합 및 배포 (1일)
- vcnPriceService 최종 연동
- VisionScan에 DEX 거래 표시
- 라우팅 (/wallet/trading-arena, /wallet/trading-arena/terminal)
- 스테이징 배포 및 테스트

---

## 9. 트레이딩 터미널 UI 설계 (Axiom Trade 참고)

### 9.1 전체 레이아웃 (3-Column, Axiom 스타일)
```
+===============================================================================+
|  MARKET HEADER BAR                                                            |
|  VCN/USDT  $0.1024  +2.34%  24h Vol: $54,230  H: $0.1065  L: $0.0985         |
|  Active Agents: 127  |  24h Trades: 3,456  |  Spread: 0.15%                  |
+===============================================================================+
|                          |               |                                    |
|   CANDLESTICK CHART      |  ORDER BOOK   |   MY AGENT WATCH                  |
|   (60% width)            |  (20% width)  |   (20% width)                     |
|                          |               |                                    |
|   [1m][5m][15m][1h][1d]  |  -- SELL --   |   "My Momentum Bot"               |
|                          |  0.1035 [2.1K]|   Status: Active                  |
|    Candlestick + Volume  |  0.1030 [5.4K]|                                   |
|                          |  0.1028 [8.2K]|   USDT: 12,345  +23.5%            |
|         /\               |  0.1025 [12K] |   VCN:  87,654  -12.3%            |
|        / \   /\          |  ---- 0.1024 -|   Total: $21,234  +6.2%           |
|   /\  /   \ / \          |  0.1023 [15K] |                                   |
|  /  \/     V   \         |  0.1020 [9.8K]|   -- Live Trading Log --          |
| /               \        |  0.1018 [6.3K]|   10:32 BUY  1,200 @ 0.1015      |
|                          |  0.1015 [3.1K]|    > "Momentum signal detected"   |
|  Vol: ||||||||||||||     |  -- BUY ---   |   10:28 SELL   800 @ 0.1008      |
|                          |               |    > "Short-term profit taking"   |
|                          |  [Depth Chart]|   10:24 BUY  2,000 @ 0.0998      |
|                          |               |    > "Support bounce expected"    |
+--------------------------+---------------+-----------------------------------+
|                                                                               |
|  RECENT TRADES (Full Width)                             [Agent Selector v]   |
|  +--------+----------+--------+--------+-----------------------------------+ |
|  | Time   | Price    | Amount | Side   | Agent (Buyer / Seller)            | |
|  +--------+----------+--------+--------+-----------------------------------+ |
|  | 10:32  | 0.1024   | 1,200  | BUY    | MyBot -> MM Alpha                 | |
|  | 10:31  | 0.1023   | 500    | SELL   | GridMaster -> MM Beta             | |
|  | 10:30  | 0.1025   | 3,400  | BUY    | AlphaRunner -> ValueHunter        | |
|  | 10:29  | 0.1022   | 800    | SELL   | RandomWalk -> MM Alpha            | |
|  +--------+----------+--------+--------+-----------------------------------+ |
|                                                                               |
+===============================================================================+
|  BOTTOM TABS: [My Agents] [Leaderboard] [Market Info]                        |
|                                                                               |
|  -- MY AGENTS TAB --                                                          |
|  +--Agent---------------+--Strategy--+--Balance---------+--PnL--------+--+   |
|  | My Momentum Bot      | Momentum   | 12,345 USDT      | +23.5%      |  |   |
|  |                      |            | 87,654 VCN       | $21,234     |  |   |
|  +----------------------+------------+------------------+-------------+--+   |
|  | My Grid Trader       | Grid       | 9,876 USDT       | -1.2%       |  |   |
|  |                      |            | 102,345 VCN      | $20,110     |  |   |
|  +----------------------+------------+------------------+-------------+--+   |
|  [+ Create New Agent]                                                        |
|                                                                               |
+===============================================================================+
```

### 9.2 캔들스틱 차트 (자체 SVG 구현)

외부 TradingView 라이브러리 대신 **자체 SVG 기반 캔들차트**를 구현합니다.
Firestore의 OHLCV 데이터를 실시간 구독하여 렌더링.

```typescript
// 차트 기능 목록
interface ChartFeatures {
    // 캔들스틱
    candlesticks: true;            // OHLCV 캔들
    volumeBars: true;              // 하단 거래량 막대

    // 타임프레임
    timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'];

    // 오버레이 인디케이터
    indicators: {
        ma: [7, 25, 99];           // 이동평균선
        bollingerBands: true;      // 볼린저 밴드
    };

    // 인터랙션
    crosshair: true;               // 십자선 (마우스 위치)
    tooltip: true;                 // OHLCV 값 표시
    zoom: true;                    // 마우스 휠 줌
    pan: true;                     // 드래그 이동

    // 스타일 (Axiom 다크 테마)
    theme: 'dark';
    colors: {
        bull: '#00C896';           // 상승 캔들 (초록)
        bear: '#FF4757';           // 하락 캔들 (빨강)
        background: '#0D1117';     // 배경
        grid: '#1C2333';           // 그리드
        text: '#8899AA';           // 텍스트
    };
}
```

### 9.3 호가창 (Order Book Panel)

```
+------ ORDER BOOK ------+
|  Price     Amount  Total|
|  ---- SELL (ASK) ----  |
|  [====================] |  <- 깊이 시각화 (빨간 바)
|  0.1035    2,100    $XX |
|  0.1030    5,400    $XX |
|  [================]     |
|  0.1028    8,200    $XX |
|  0.1025   12,000    $XX |
|  [============]         |
+--- SPREAD: 0.15% ------+
|  * 0.1024  Last Price   |
+-------------------------+
|  ---- BUY (BID) ----   |
|  0.1023   15,000    $XX |  <- 깊이 시각화 (초록 바)
|  [====================] |
|  0.1020    9,800    $XX |
|  0.1018    6,300    $XX |
|  [============]         |
|  0.1015    3,100    $XX |
+-------------------------+
|  [Chart]  [Grouped: 0.01]|
+-------------------------+
```

특징:
- **깊이 시각화**: 각 가격대의 물량을 색상 바로 표현
- **MM 주문 표시**: MM 에이전트의 주문은 별도 아이콘으로 구분
- **실시간 업데이트**: Firestore onSnapshot으로 호가 자동 갱신
- **가격 그룹핑**: 0.001 / 0.01 / 0.1 단위 그룹핑 선택
- **클릭 시 에이전트 정보**: 호가 클릭 시 누가 주문했는지 표시

### 9.4 내 에이전트 관전 패널 (Agent Watch)

유저는 자신의 에이전트가 실시간으로 거래하는 과정을 **관전**할 수 있습니다.

```
+-- MY AGENT WATCH ------+
|  Select: [My Bot v]    |
+------------------------+
|                        |
|  Status: Active        |
|  Strategy: Momentum    |
|  Risk: 6/10            |
|                        |
|  -- Balances --        |
|  USDT: 12,345.67       |
|   (+23.5% from init)   |
|  VCN:  87,654          |
|   (-12.3% from init)   |
|                        |
|  -- Total Value --     |
|  $21,234.56 (+6.2%)    |
|                        |
|  -- Today Stats --     |
|  Trades: 14            |
|  Win Rate: 64%         |
|  Best: +$45.20         |
|  Worst: -$12.10        |
|                        |
|  -- Live Log --        |
|  [10:32] BUY           |
|  1,200 VCN @ 0.1015    |
|  "Momentum signal      |
|   detected. Price      |
|   above 20-MA by       |
|   3.2%. Strong buy."   |
|                        |
|  [10:28] SELL          |
|  800 VCN @ 0.1008      |
|  "Short-term profit    |
|   taking. +0.8%        |
|   gain realized."      |
|                        |
|  [10:24] BUY           |
|  2,000 VCN @ 0.0998    |
|  "Support bounce       |
|   expected at 0.10."   |
|                        |
|  [Edit Strategy]       |
|  [Pause] [Delete]      |
+------------------------+
```

핵심 기능:
- **실시간 거래 로그**: AI가 판단한 이유를 실시간으로 보여줌
- **전략 드롭다운**: 여러 에이전트 중 선택 가능
- **밸런스 변화 미니 차트**: 시간별 자산 가치 변화
- **성과 통계**: 오늘/전체 승률, 총 PnL

### 9.5 시장 깊이 차트 (Depth Chart)

호가창 하단 또는 탭으로 전환 가능한 시장 깊이 시각화:

```
  누적 물량
     |
     |  /\
     | /  \          /\
     |/    \        /  \
     |      \      /    \
     |       \    /      \
     |        \  /        \
     |         \/          \
     +---BUY---|---SELL------> 가격
          0.1024 (현재가)

  초록 = 매수 누적 물량  |  빨강 = 매도 누적 물량
```

---

## 10. 어드민 대시보드 (Trading Arena)

### 10.1 에이전트 밸런스 변경 내역

```
+===========================================================================+
|  Admin > Trading Arena > Agent Balances                                    |
+===========================================================================+
|                                                                           |
|  Filter: [All Agents v]  [Role: All v]  Period: [24h v]   [Export CSV]   |
|                                                                           |
|  +-------+-------------------+--------+----------+----------+---------+  |
|  | #     | Agent             | Role   | USDT     | VCN      | PnL %   |  |
|  +-------+-------------------+--------+----------+----------+---------+  |
|  | 1     | MM Alpha          | MM     | 498,230  | 5,012K   | +0.2%   |  |
|  | 2     | MM Beta           | MM     | 501,450  | 4,988K   | +0.1%   |  |
|  | 3     | BreakoutKing      | Trader | 13,450   | 86,540   | +34.5%  |  |
|  | 4     | AlphaRunner       | Trader | 12,810   | 88,230   | +28.1%  |  |
|  | 5     | RandomWalker      | Trader | 8,760    | 105,230  | -12.4%  |  |
|  +-------+-------------------+--------+----------+----------+---------+  |
|                                                                           |
|  -- Balance Change History (Selected: BreakoutKing) --                   |
|  +----------+--------+---------+---------+--------+--------------------+ |
|  | Time     | Action | USDT    | VCN     | Price  | Reasoning          | |
|  +----------+--------+---------+---------+--------+--------------------+ |
|  | 10:32:01 | BUY    | -121.80 | +1,200  | 0.1015 | Momentum detected  | |
|  | 10:28:15 | SELL   | +80.64  | -800    | 0.1008 | Profit taking      | |
|  | 10:24:30 | BUY    | -199.60 | +2,000  | 0.0998 | Support bounce     | |
|  | 10:18:42 | SELL   | +152.40 | -1,500  | 0.1016 | Resistance reached | |
|  | 10:12:55 | BUY    | -305.10 | +3,000  | 0.1017 | Trend continuation | |
|  +----------+--------+---------+---------+--------+--------------------+ |
|                                                                           |
|  -- Balance Over Time Chart --                                           |
|  USDT: --- (blue)   VCN: --- (green)   Total Value: --- (gold)           |
|                                                                           |
|  $25K |                                                                  |
|       |                    ___/\___                                       |
|  $20K |          ___/\___/         \___/\___                             |
|       |    _____/                            \                            |
|  $15K |___/                                   \___                       |
|       |                                                                   |
|  $10K +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+                    |
|       00  02  04  06  08  10  12  14  16  18  20  22  (시간)              |
|                                                                           |
+===========================================================================+
```

### 10.2 MM Agent 컨트롤 패널

```
+===========================================================================+
|  Admin > Trading Arena > Market Maker Control                              |
+===========================================================================+
|                                                                           |
|  +-- MM Alpha (강세) ---------------------------------------------------+|
|  | Status: [Active v]                                                    ||
|  |                                                                       ||
|  | Base Price:      [0.1020] USDT   (현재 체결가: 0.1024)               ||
|  | Trend Bias:      [-1.0 ===|====== +1.0] = +0.3                       ||
|  | Trend Speed:     [0.01 ==|======= 0.10] = 0.03                       ||
|  | Spread %:        [0.50] %                                            ||
|  | Layer Count:     [5]                                                  ||
|  | Layer Spacing:   [0.30] %                                            ||
|  | Inventory Target:[0.50]  (현재 VCN 비율: 0.52)                       ||
|  |                                                                       ||
|  | Balances: 498,230 USDT | 5,012,340 VCN                              ||
|  | 24h Trades: 1,234  |  24h Volume: $12,345                           ||
|  |                                                                       ||
|  | [Save Changes]  [Reset to Default]                                   ||
|  +-----------------------------------------------------------------------+|
|                                                                           |
|  +-- MM Beta (약세) ----------------------------------------------------+|
|  | (동일 구조)                                                           ||
|  +-----------------------------------------------------------------------+|
|                                                                           |
+===========================================================================+
```

### 10.3 시장 상태 및 엔진 모니터링

```
+===========================================================================+
|  Admin > Trading Arena > Engine Status                                     |
+===========================================================================+
|                                                                           |
|  Engine Status: [Running]   Last Round: 10:32:01   Next: 10:34:01        |
|                                                                           |
|  +-- Quick Stats -------------------------------------------------------+|
|  | Current Price: $0.1024         24h Change:  +2.34%                   ||
|  | Best Bid:      $0.1023         24h High:    $0.1065                  ||
|  | Best Ask:      $0.1025         24h Low:     $0.0985                  ||
|  | Spread:        0.15%           24h Volume:  $54,230                  ||
|  | Active Agents: 127             Total Trades: 3,456                   ||
|  +-----------------------------------------------------------------------+|
|                                                                           |
|  +-- Last Round Log ----------------------------------------------------+|
|  | Round #1,234 at 10:32:01                                             ||
|  | - MM Alpha: 5 buy + 5 sell orders placed                            ||
|  | - MM Beta:  5 buy + 5 sell orders placed                            ||
|  | - 45 agents queried (82 active, 37 skipped/low-freq)                 ||
|  | - AI decisions: 18 buy, 12 sell, 15 hold                            ||
|  | - Matching: 8 trades executed                                        ||
|  | - Total volume: $1,234.56                                           ||
|  | - Price: 0.1022 -> 0.1024 (+0.2%)                                   ||
|  | - Duration: 3.2s (AI: 2.8s, Matching: 0.1s, DB: 0.3s)              ||
|  +-----------------------------------------------------------------------+|
|                                                                           |
|  [Pause Engine]  [Force Run Round]  [Reset All Agents]                   |
|                                                                           |
+===========================================================================+
```

---

## 11. 파일 구조 (최종)

```
services/
  trading/
    types.ts               -- 모든 인터페이스 정의
    strategies.ts          -- 10개 프리셋 + 2개 MM 전략 프롬프트
    aiDecision.ts          -- Gemini API -> 매매 결정 / MM 호가 결정
    orderbook.ts           -- 오더북 매칭 엔진
    engine.ts              -- 메인 트레이딩 라운드 실행
    marketMaker.ts         -- MM 에이전트 전용 로직 (호가 배치, 추세 조정)
    candles.ts             -- OHLCV 캔들 생성/업데이트
    priceFeed.ts           -- VCN 시세 업데이트 (vcnPriceService 연동)
    leaderboard.ts         -- 리더보드 계산

components/
  trading/
    TradingTerminal.tsx    -- 메인 3-Column 트레이딩 터미널
    CandlestickChart.tsx   -- SVG 기반 캔들차트 + 볼륨 + MA + 볼린저
    OrderBookPanel.tsx     -- 실시간 호가창 (깊이 시각화)
    RecentTrades.tsx       -- 최근 체결 피드
    MarketHeader.tsx       -- 상단 시장 정보 바
    AgentWatchPanel.tsx    -- 내 에이전트 관전 (실시간 거래 로그)
    CreateAgentModal.tsx   -- 에이전트 생성 모달
    AgentCard.tsx          -- 에이전트 상태 카드
    Leaderboard.tsx        -- 수익률 리더보드
    StrategyEditor.tsx     -- 전략 프롬프트 편집기
    DepthChart.tsx         -- 시장 깊이 차트
    TimeframeSelector.tsx  -- 타임프레임 선택
    BalanceMiniChart.tsx   -- 에이전트 밸런스 미니 차트

  admin/
    AdminTradingArena.tsx  -- 어드민 메인 (탭 구조)
    AgentBalanceHistory.tsx-- 에이전트별 밸런스 변경 내역
    MMConfigPanel.tsx      -- MM Agent 파라미터 조정
    MarketControlPanel.tsx -- 시장 파라미터 설정
    TradingEngineStatus.tsx-- 엔진 상태/로그

hooks/
  useTradingData.ts        -- 시장 데이터 실시간 구독
  useOrderBook.ts          -- 호가창 실시간 구독
  useMyAgents.ts           -- 내 에이전트 데이터
  useCandleData.ts         -- OHLCV 차트 데이터
  useLeaderboard.ts        -- 리더보드 데이터

functions/
  index.js                 -- tradingEngine Cloud Function 추가

scripts/
  init-trading-agents.ts   -- 초기 MM + 10개 기본 에이전트 셋업
```

---

## 12. 예상 결과

### 데이터 생성량 (100개 에이전트 기준)
| 지표 | 일일 예상 |
|------|----------|
| 라운드 | 720회 (2분 간격) |
| 주문 | ~15,000-25,000건 (MM 포함) |
| 체결 | ~5,000-10,000건 |
| 거래량 | ~$20,000-$50,000 |
| 캔들 데이터 | 1m: 1,440개, 1h: 24개 |

### Cloud Function 비용 (예상)
- 트레이딩 엔진: ~720회/일 x 100 에이전트 x Gemini API
- Gemini Flash: ~$0.001/건 x 72,000건/일 = ~$72/일
- Cloud Functions: ~$5/일
- **합계: ~$77/일 (~$2,310/월)**

### API 비용 최적화 방안
- MM 에이전트: AI 없이 수학적 호가 배치 (무비용)
- 비활성 에이전트 스킵 (최근 1시간 무거래)
- "hold" 결정 빈도 높은 전략은 2-3라운드에 1번만 AI 호출
- 배치 프롬프트: 여러 에이전트를 1회 API 호출로 처리
- **최적화 후 예상: ~$15-25/일**

---

## 13. 향후 확장

| 기능 | 설명 | 우선순위 |
|------|------|---------| 
| 실제 자산 연동 | 모의 자산 -> 실제 VCN/USDT 거래 | 높음 |
| 다중 페어 | VCN/ETH, VCN/BTC 등 | 중간 |
| 전략 마켓플레이스 | 고수익 전략 공유/판매 | 중간 |
| 토너먼트 | 기간 한정 트레이딩 대회 | 높음 |
| 소셜 트레이딩 | 상위 에이전트 전략 복사 | 중간 |
| 온체인 정산 | 실적 기반 VCN 보상 | 높음 |
| TradingView 연동 | 자체 차트 -> TradingView 라이브러리 교체 | 낮음 |
| WebSocket | Firestore polling -> WebSocket 실시간 스트리밍 | 중간 |

---

*문서 버전: 3.0*
*작성일: 2026-02-24*
*참고: Axiom Trade (Solana DEX Terminal)*
*다음 단계: Phase 1 코어 엔진 개발*
