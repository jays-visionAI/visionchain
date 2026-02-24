# VisionDEX Market Maker Admin Control Panel -- 기획설계서

## 1. 리서치 요약: 업계 표준 Trading 소프트웨어 핵심 기능

### 1.1 가격 방향 제어 (Price Direction Control)

**업계 표준 기능:**
- **Trend Bias**: 시장의 방향성을 설정 (강세/중립/약세)
- **Drift Rate**: 시간당/라운드당 가격 변화 속도 제어
- **Price Ceiling / Floor**: 절대 가격 상한/하한선 설정
- **Moving Price Band**: 기준가를 점진적으로 이동하며 밴드 유지
- **Phase Control**: 축적(Accumulation) -> 상승(Markup) -> 분배(Distribution) -> 하락(Markdown) 페이즈 설정

**참고 소프트웨어:**
- Hummingbot: `price_ceiling`, `price_floor`, `moving_price_band_enabled`
- CryptoHopper: Market Trend 설정 (Neutral/Uptrend/Downtrend), 트렌드 변경 시 주문 취소
- DeltixLab: 추세 기반 기준가 자동 조정, 외부 가격 소스 연동
- HaasOnline: Inventory skew로 간접적 가격 방향 유도

### 1.2 스프레드 관리 (Spread Management)

**업계 표준 기능:**
- **Bid Spread / Ask Spread**: 매수/매도 스프레드 독립 설정
- **Dynamic Spread**: 변동성(ATR, NATR) 기반 자동 스프레드 조정
- **Minimum Spread**: 최소 수익 마진 보장
- **Asymmetric Spread**: 비대칭 스프레드로 방향성 유도
  - 매도 스프레드 > 매수 스프레드 = 강세 편향 (매수 더 쉬움)
  - 매수 스프레드 > 매도 스프레드 = 약세 편향 (매도 더 쉬움)

### 1.3 재고 관리 (Inventory Management)

**업계 표준 기능:**
- **Inventory Target**: Base/Quote 비율 목표 설정 (예: 50:50)
- **Inventory Skew**: 재고 불균형 시 자동 주문 크기 조정
- **Max Position Size**: 한쪽 자산 최대 보유량 제한
- **Ping-Pong Mode**: 매수-매도 교대 실행으로 재고 균형 유지
- **Delta Neutral**: 순 포지션을 0에 가깝게 유지

### 1.4 주문 레이어링 (Order Layering)

**업계 표준 기능:**
- **Layer Count**: 호가 단계 수 (3-20단계)
- **Layer Spacing**: 단계 간 가격 간격
- **Layer Amount Progression**: 단계별 수량 증감 (균등/증가/감소)
- **Order Refresh Time**: 주문 갱신 주기
- **Order Cancellation Rules**: 자동 취소 조건 (시간, 가격 변동, depth)

### 1.5 리스크 관리 (Risk Management)

**업계 표준 기능:**
- **Daily P&L Limit**: 일일 최대 손실 한도
- **Max Drawdown**: 최대 낙폭 자동 정지
- **Position Limit**: 포지션 크기 제한
- **Kill Switch**: 긴급 전체 정지 버튼
- **Circuit Breaker**: 급변동 시 자동 거래 중단
- **Emergency Liquidation**: 비상 시 전량 청산

---

## 2. VisionDEX Trading Admin Panel 설계

### 2.1 기능 구조

```
Admin > VisionDEX > Trading Control Panel
│
├── [1] Dashboard (전체 현황)
│   ├── MM1, MM2 실시간 상태
│   ├── 현재 가격, 목표 가격, 편차
│   ├── 재고 현황 (USDT/VCN 비율)
│   └── P&L 요약
│
├── [2] Price Direction (가격 방향 제어)  ← 핵심 기능
│   ├── 트렌드 모드: Bullish / Neutral / Bearish
│   ├── 목표 가격 설정
│   ├── 변화 속도 (느림/보통/빠름)
│   ├── 가격 상한/하한
│   └── 페이즈 제어 (Accumulation → Markup → Distribution → Markdown)
│
├── [3] Spread & Layers (스프레드 & 호가)
│   ├── 기본 스프레드 %
│   ├── 비대칭 스프레드 (Bid/Ask 독립)
│   ├── 레이어 수 / 간격
│   └── 레이어별 수량 패턴
│
├── [4] Inventory (재고 관리)
│   ├── 목표 비율
│   ├── 재고 skew 강도
│   ├── 자동 리밸런싱 ON/OFF
│   └── 포지션 한도
│
├── [5] Risk Controls (리스크)
│   ├── Kill Switch (긴급 정지)
│   ├── Circuit Breaker 임계값
│   ├── 일일 손실 한도
│   └── 최대 낙폭 한도
│
└── [6] Schedule (스케줄)
    ├── 라운드 간격 설정
    ├── 활성 시간대 설정
    └── 에이전트별 ON/OFF
```

### 2.2 Firestore 데이터 모델

```typescript
// ─── Trading Admin Config ───────────────────────────────────────────────────
// Location: dex/config/trading-settings
interface TradingAdminSettings {
    updatedAt: Timestamp;
    updatedBy: string; // admin UID

    // ─── 가격 방향 제어 (Price Direction) ─────────────────────────
    priceDirection: {
        mode: "bullish" | "neutral" | "bearish" | "custom";

        // 목표 가격: 이 가격을 향해 점진적으로 유도
        targetPrice: number;              // 예: 0.12 USDT

        // 현재 기준가 (엔진이 매 라운드 업데이트)
        currentBasePrice: number;         // 예: 0.1006

        // 트렌드 강도: -1.0 (강한 약세) ~ +1.0 (강한 강세)
        // mode에 따른 기본값:
        //   bullish  = +0.3 ~ +0.8
        //   neutral  = -0.1 ~ +0.1
        //   bearish  = -0.3 ~ -0.8
        //   custom   = 직접 입력
        trendBias: number;

        // 변화 속도: 라운드당 기준가 이동 비율
        //   slow   = 0.005% per round (~0.3% per hour)
        //   medium = 0.02%  per round (~1.2% per hour)
        //   fast   = 0.05%  per round (~3% per hour)
        trendSpeed: "slow" | "medium" | "fast" | number;

        // 가격 범위 제한
        priceFloor: number;              // 절대 하한 (예: 0.05)
        priceCeiling: number;            // 절대 상한 (예: 0.50)

        // 허용 변동 범위: 기준가 대비 +-N%
        priceRangePercent: number;        // 예: 20 (+-20%)

        // 페이즈 제어 (선택적)
        phase: "accumulation" | "markup" | "distribution" | "markdown" | "ranging";
        phaseAutoRotate: boolean;          // 자동 페이즈 전환
        phaseRotateInterval: number;       // 페이즈 전환 간격 (시간)
    };

    // ─── 스프레드 & 호가 레이어 (Spread & Layers) ─────────────────
    spreadConfig: {
        // 기본 스프레드 (%)
        baseSpread: number;               // 예: 0.5 (0.5%)

        // 비대칭 스프레드 (방향 편향 유도)
        // bidSpreadMultiplier > 1.0 = 매수호가가 더 멀어짐 (약세 편향)
        // askSpreadMultiplier > 1.0 = 매도호가가 더 멀어짐 (강세 편향)
        bidSpreadMultiplier: number;       // 기본: 1.0
        askSpreadMultiplier: number;       // 기본: 1.0

        // 동적 스프레드: 변동성 기반 자동 조정
        dynamicSpreadEnabled: boolean;
        dynamicSpreadRange: {              // 변동성에 따른 스프레드 범위
            min: number;                   // 최소 스프레드 (예: 0.2%)
            max: number;                   // 최대 스프레드 (예: 2.0%)
        };

        // 레이어 설정
        layerCount: number;                // 호가 단계 수 (기본: 5, 최대: 15)
        layerSpacing: number;              // 단계 간격 % (기본: 0.3%)
        layerAmountPattern: "flat" | "increasing" | "decreasing" | "bell";
        // flat       = 모든 레이어 동일 수량
        // increasing = 가격이 멀어질수록 수량 증가 (깊은 유동성)
        // decreasing = 가격이 멀어질수록 수량 감소 (가까운 유동성)
        // bell       = 중간 레이어에 집중

        // 레이어당 기본 주문 비율 (잔고 대비 %)
        layerAmountPercent: number;        // 기본: 2-5%
    };

    // ─── 재고 관리 (Inventory) ────────────────────────────────────
    inventoryConfig: {
        // 목표 재고 비율 (VCN 기준)
        // 0.5 = 50:50 (VCN과 USDT 동일 가치)
        // 0.7 = VCN 70%, USDT 30% (강세 포지션)
        // 0.3 = VCN 30%, USDT 70% (약세 포지션)
        targetRatio: number;               // 기본: 0.5

        // Skew 강도: 불균형 시 주문 조정 강도
        // 0 = 조정 안 함, 1.0 = 매우 공격적 조정
        skewIntensity: number;             // 기본: 0.5

        // 자동 리밸런싱
        autoRebalance: boolean;            // 기본: true
        rebalanceTrigger: number;          // 불균형 임계값 (%) 기본: 15

        // 포지션 한도
        maxVCNPercent: number;            // VCN 최대 비율 (기본: 80%)
        maxUSDTPercent: number;           // USDT 최대 비율 (기본: 80%)
    };

    // ─── 리스크 관리 (Risk Controls) ─────────────────────────────
    riskConfig: {
        // Kill Switch: 긴급 전체 정지
        killSwitchEnabled: boolean;        // 활성화 시 Trading 즉시 정지

        // 서킷 브레이커: 급변동 시 자동 정지
        circuitBreaker: {
            enabled: boolean;
            priceChangeThreshold: number;  // 5분 내 N% 변동 시 정지 (기본: 5%)
            pauseDurationMinutes: number;  // 정지 지속 시간 (기본: 10분)
        };

        // 일일 P&L 한도
        dailyLossLimit: number;            // USDT 기준 (예: 5000)
        dailyProfitTakeEnabled: boolean;
        dailyProfitTarget: number;         // 목표 수익 도달 시 속도 감소

        // 최대 낙폭
        maxDrawdownPercent: number;        // 시작 잔고 대비 (예: 10%)
        maxDrawdownAction: "pause" | "reduce" | "hedge";
    };

    // ─── 에이전트별 설정 오버라이드 ──────────────────────────────
    agentOverrides: {
        [agentId: string]: {
            enabled: boolean;
            trendBiasOverride?: number;     // 개별 트렌드 편향
            spreadOverride?: number;        // 개별 스프레드
            note?: string;                  // 관리자 메모
        };
    };
}
```

### 2.3 Admin UI 레이아웃 (와이어프레임)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Admin > VisionDEX > Trading Control Panel                     [Kill Switch] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌── Dashboard ─────────────────────────────────────────────────────────┐│
│  │                                                                      ││
│  │  Current Price        Target Price        Phase          Status      ││
│  │  $0.1006              $0.1200              Accumulation   Running    ││
│  │                                                                      ││
│  │  ┌── MM1 (Alpha) ────────┐  ┌── MM2 (Beta) ─────────┐              ││
│  │  │ Bias: +0.3 (Bullish)  │  │ Bias: -0.2 (Bearish)  │              ││
│  │  │ USDT: 487,234         │  │ USDT: 512,876         │              ││
│  │  │ VCN:  4,876,543       │  │ VCN:  5,123,789       │              ││
│  │  │ Ratio: 48%/52%        │  │ Ratio: 52%/48%        │              ││
│  │  │ Orders: 10 active     │  │ Orders: 10 active     │              ││
│  │  │ 24h PnL: +$234        │  │ 24h PnL: -$156        │              ││
│  │  └───────────────────────┘  └───────────────────────┘              ││
│  │                                                                      ││
│  │  Combined PnL: +$78   |   24h Vol: $474K   |   Trades: 731          ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════════  │
│                                                                          │
│  ┌── Price Direction ──────────────────────────────────────── [SAVE] ───┐│
│  │                                                                      ││
│  │  Trend Mode:  [ Bullish ]  [ Neutral ]  [ Bearish ]  [ Custom ]     ││
│  │                    ^active                                           ││
│  │                                                                      ││
│  │  Target Price:    [____0.1200____] USDT                              ││
│  │                                                                      ││
│  │  Trend Bias:      [─────────●──────────] +0.30                      ││
│  │                   -1.0              +1.0                             ││
│  │                                                                      ││
│  │  Trend Speed:     [ Slow ]  [ Medium ]  [ Fast ]     Custom: [__]   ││
│  │                                                                      ││
│  │  Price Range:                                                        ││
│  │    Floor:         [____0.0500____] USDT                              ││
│  │    Ceiling:       [____0.5000____] USDT                              ││
│  │    Band Width:    [____20____] %   (+-20% from base)                ││
│  │                                                                      ││
│  │  Phase:  [Accum]  [Markup]  [Distrib]  [Markdown]  [Ranging]        ││
│  │          ^active                                                     ││
│  │  Auto-Rotate: [x]    Interval: [ 24 ] hours                        ││
│  │                                                                      ││
│  │  ── Price Direction Preview ──────────────────────────────────       ││
│  │  │    현재가                목표가                              │    ││
│  │  │    $0.1006 ────────→ $0.1200                                │    ││
│  │  │    예상 도달 시간: ~16.2 hours                              │    ││
│  │  │    경로: Accumulation(4h) → Markup(8h) → 목표 도달          │    ││
│  │  └──────────────────────────────────────────────────────────────     ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌── Spread & Layers ──────────────────────────────────────── [SAVE] ───┐│
│  │                                                                      ││
│  │  Base Spread:     [____0.50____] %                                   ││
│  │                                                                      ││
│  │  Asymmetric Spread:                                                  ││
│  │    Bid Multiplier: [──●──────────] 1.0x   (매수쪽 스프레드)         ││
│  │    Ask Multiplier: [────────●────] 1.3x   (매도쪽 스프레드)         ││
│  │    → 매수가 더 쉽다 = 강세 편향                                      ││
│  │                                                                      ││
│  │  Dynamic Spread:  [x] ON    Range: [__0.2__]% ~ [__2.0__]%         ││
│  │                                                                      ││
│  │  Layers:                                                             ││
│  │    Count:         [──────●──] 5 layers                               ││
│  │    Spacing:       [____0.30____] %                                   ││
│  │    Amount/Layer:  [____3.0____] % of balance                        ││
│  │    Pattern:       [ Flat ]  [ Increasing ]  [ Decreasing ]  [ Bell ]││
│  │                                                                      ││
│  │  ── Order Book Preview ─────────────────────                        ││
│  │  │  SELL 0.1025 |████░░░░░░| 3.0%                              │   ││
│  │  │  SELL 0.1022 |█████░░░░░| 3.0%                              │   ││
│  │  │  SELL 0.1019 |██████░░░░| 3.0%   ← Layer 3                 │   ││
│  │  │  SELL 0.1016 |███████░░░| 3.0%   ← Layer 2                 │   ││
│  │  │  SELL 0.1013 |████████░░| 3.0%   ← Layer 1 (Closest)       │   ││
│  │  │  ─── 0.1006 ───────── Spread: 0.50% ──                     │   ││
│  │  │  BUY  0.1000 |████████░░| 3.0%   ← Layer 1 (Closest)       │   ││
│  │  │  BUY  0.0997 |███████░░░| 3.0%   ← Layer 2                 │   ││
│  │  │  BUY  0.0994 |██████░░░░| 3.0%   ← Layer 3                 │   ││
│  │  │  BUY  0.0991 |█████░░░░░| 3.0%                              │   ││
│  │  │  BUY  0.0988 |████░░░░░░| 3.0%                              │   ││
│  │  └──────────────────────────────────────────────────────────────     ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌── Inventory ────────────────────────────────────────────── [SAVE] ───┐│
│  │                                                                      ││
│  │  Target Ratio:    VCN [────●────────] 50%  /  USDT 50%              ││
│  │                                                                      ││
│  │  Current:  VCN: 48.3%  ████████████████████░░░░░░ USDT: 51.7%      ││
│  │                                                      ^balanced       ││
│  │                                                                      ││
│  │  Skew Intensity:  [──────●──────────] 0.50  (how aggressively       ││
│  │                                              to rebalance)           ││
│  │                                                                      ││
│  │  Auto-Rebalance:  [x] ON    Trigger: [__15__]% imbalance           ││
│  │                                                                      ││
│  │  Position Limits:                                                    ││
│  │    Max VCN:       [____80____] %                                     ││
│  │    Max USDT:      [____80____] %                                     ││
│  │                                                                      ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌── Risk Controls ────────────────────────────────────────── [SAVE] ───┐│
│  │                                                                      ││
│  │  [!] Kill Switch:        [ OFF ]  ← Click to STOP all Trading activity   ││
│  │                                                                      ││
│  │  Circuit Breaker:    [x] ON                                          ││
│  │    Price Threshold:  [____5____] % change in 5 min → auto-pause     ││
│  │    Pause Duration:   [____10____] minutes                            ││
│  │                                                                      ││
│  │  Daily Loss Limit:   [____5000____] USDT                             ││
│  │  Max Drawdown:       [____10____] %                                  ││
│  │    On trigger:       ( ) Pause  ( ) Reduce size  ( ) Hedge           ││
│  │                                                                      ││
│  │  24h Loss: -$156  |  Max Drawdown: -0.8%  |  Status: SAFE           ││
│  │                                                                      ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌── Activity Log ──────────────────────────────────────────────────────┐│
│  │  10:15  [Config] Price Direction changed: Neutral → Bullish         ││
│  │  10:15  [Config] Target Price set: $0.12                            ││
│  │  10:14  [Engine] Round #127: 4 trades, $467 volume                 ││
│  │  10:12  [Engine] Round #126: 2 trades, $234 volume                 ││
│  │  10:10  [Risk]   Circuit Breaker triggered: 4.2% drop in 3min      ││
│  │  10:05  [Config] Spread changed: 0.3% → 0.5%                      ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Price Direction 모드별 동작 상세

#### Bullish Mode (강세)
```
기본 동작:
- trendBias: +0.2 ~ +0.8 (기본: +0.3)
- 매 라운드 기준가를 상향 이동
- 매도 스프레드 > 매수 스프레드 (매수가 더 쉬움)
- 재고 목표: VCN 비중 증가 방향

효과:
- Trading이 매수호가를 더 공격적으로 제시
- 일반 에이전트들이 더 높은 가격에 매수
- 매도 시 더 넓은 스프레드로 이익 확보
- 결과: 점진적 가격 상승
```

#### Bearish Mode (약세)
```
기본 동작:
- trendBias: -0.2 ~ -0.8 (기본: -0.3)
- 매 라운드 기준가를 하향 이동
- 매수 스프레드 > 매도 스프레드 (매도가 더 쉬움)
- 재고 목표: USDT 비중 증가 방향

효과:
- Trading이 매도호가를 더 공격적으로 제시
- 일반 에이전트들이 더 낮은 가격에 매도
- 결과: 점진적 가격 하락
```

#### Neutral Mode (중립)
```
기본 동작:
- trendBias: 0 (랜덤 미세 변동 -0.05 ~ +0.05)
- 기준가 고정, 자연스러운 횡보
- 양쪽 대칭 스프레드
- 재고 50:50 목표

효과:
- 안정적인 유동성 제공
- 가격 변동 최소화
- 일반 에이전트들의 거래가 가격을 결정
```

#### Custom Mode (커스텀)
```
기본 동작:
- 모든 파라미터를 관리자가 직접 입력
- 슬라이더, 수치 입력 모두 활성화
- 복합 시나리오 설정 가능

사용 예시:
- "목표가 $0.12까지 천천히 올리되, $0.08 아래로는 절대 안 내려감"
- trendBias: +0.4, trendSpeed: slow, priceFloor: 0.08, targetPrice: 0.12
```

### 2.5 Phase Control (시장 싸이클 제어)

```
Accumulation (축적) → Markup (상승) → Distribution (분배) → Markdown (하락)

각 Phase 동작:

1. Accumulation (축적):
   - 가격 횡보, 좁은 범위
   - 높은 매수 레이어, 조용한 매집
   - trendBias: +0.05 (아주 약한 상승)
   - 스프레드: 좁음 (0.2%)
   → "바닥에서 천천히 모으는 단계"

2. Markup (상승):
   - 점진적 가격 상승
   - 강세 편향 스프레드
   - trendBias: +0.3 ~ +0.6
   - 매수 수량 > 매도 수량
   → "가격을 끌어올리는 단계"

3. Distribution (분배):
   - 고점 부근 횡보, 넓은 변동
   - 양쪽 균등 but 약간 매도 편향
   - trendBias: -0.05
   - 스프레드: 넓음 (0.5-1.0%)
   → "고점에서 물량을 넘기는 단계"

4. Markdown (하락):
   - 점진적 가격 하락
   - 약세 편향 스프레드
   - trendBias: -0.3 ~ -0.6
   - 매도 수량 > 매수 수량
   → "가격을 내리는 단계"

5. Ranging (횡보):
   - 가격 유지, 안정적 유동성
   - 완전 중립 (trendBias: 0)
   - 그리드형 레이어
   → "횡보하며 스프레드 수익"
```

### 2.6 Asymmetric Spread 예시

```
Bullish Spread Setup (강세):
  Ask Multiplier = 1.5x → 매도호가가 더 멀리

  Bid Spread = 0.5% * 1.0 = 0.5%  (매수는 가까이)
  Ask Spread = 0.5% * 1.5 = 0.75% (매도는 멀리)

  BUY  0.0995 ← 기준가 - 0.5%  (가까움 = 체결 쉬움)
  ─── 0.1000 ─── (기준가)
  SELL 0.1007 ← 기준가 + 0.75% (멀음 = 체결 어려움)

  효과: 매수자가 쉽게 살 수 있고, 매도는 더 높은 가격에만 가능
        = 가격 상승 압력


Bearish Spread Setup (약세):
  Bid Multiplier = 1.5x → 매수호가가 더 멀리

  Bid Spread = 0.5% * 1.5 = 0.75% (매수는 멀리)
  Ask Spread = 0.5% * 1.0 = 0.5%  (매도는 가까이)

  BUY  0.0993 ← 기준가 - 0.75% (멀음 = 체결 어려움)
  ─── 0.1000 ─── (기준가)
  SELL 0.1005 ← 기준가 + 0.5%  (가까움 = 체결 쉬움)

  효과: 매도자가 쉽게 팔 수 있고, 매수는 더 낮은 가격에만 가능
        = 가격 하락 압력
```

---

## 3. 구현 순서

### Phase 1: Core Settings (우선)
1. Firestore에 `dex/config/trading-settings` 문서 생성
2. Admin UI: Price Direction 패널 (모드 선택, Trend Bias 슬라이더, 목표 가격)
3. `tradingEngine.js`의 `generateTradingOrders()` 함수에서 `trading-settings` 읽기
4. Kill Switch 구현

### Phase 2: Spread & Layers
5. Admin UI: Spread & Layers 패널
6. Asymmetric spread 로직
7. Layer amount pattern 구현
8. Order Book preview 컴포넌트

### Phase 3: Inventory & Risk
9. Admin UI: Inventory 패널
10. Admin UI: Risk Controls 패널
11. Circuit Breaker 로직
12. Daily P&L tracking

### Phase 4: Advanced
13. Phase Control (자동 로테이션)
14. Activity Log (설정 변경 이력)
15. Price direction preview (예상 경로)
16. Dynamic spread (변동성 연동)

---

## 4. tradingEngine.js 수정 사항

### 4.1 Trading Settings 읽기

```javascript
// runMicroRoundEngine() 시작 시 Trading 설정 로드
const mmSettingsDoc = await db.doc('dex/config/trading-settings').get();
const tradingSettings = mmSettingsDoc.exists ? mmSettingsDoc.data() : null;

// Kill Switch 체크
if (tradingSettings?.riskConfig?.killSwitchEnabled) {
    console.log('[Engine] Kill Switch ACTIVE - skipping Trading orders');
    // Trading 주문 생성 건너뜀, 일반 에이전트만 실행
}
```

### 4.2 generateTradingOrders 개선

```javascript
function generateTradingOrders(agent, currentPrice, tradingSettings) {
    const cfg = agent.tradingConfig;
    if (!cfg) return [];

    // Admin 설정으로 오버라이드
    const direction = tradingSettings?.priceDirection || {};
    const spreadCfg = tradingSettings?.spreadConfig || {};
    const invCfg = tradingSettings?.inventoryConfig || {};

    // 1. 기준가 계산
    let basePrice = direction.currentBasePrice || cfg.basePrice;
    const bias = direction.trendBias ?? cfg.trendBias;
    const speedMap = { slow: 0.00005, medium: 0.0002, fast: 0.0005 };
    const speed = typeof direction.trendSpeed === 'number'
        ? direction.trendSpeed
        : speedMap[direction.trendSpeed] || cfg.trendSpeed;

    // 트렌드 적용
    basePrice *= (1 + bias * speed);

    // 가격 범위 제한
    basePrice = Math.max(
        direction.priceFloor || cfg.basePrice * 0.5,
        Math.min(direction.priceCeiling || cfg.basePrice * 5, basePrice)
    );

    // Admin 기준가 업데이트 (다음 라운드용)
    // → Firestore에 currentBasePrice 저장

    // 2. 스프레드 계산 (비대칭)
    const baseSpread = (spreadCfg.baseSpread || cfg.spreadPercent) / 100;
    const bidMult = spreadCfg.bidSpreadMultiplier || 1.0;
    const askMult = spreadCfg.askSpreadMultiplier || 1.0;
    const bidSpread = baseSpread * bidMult;
    const askSpread = baseSpread * askMult;

    // 3. 재고 리밸런싱
    const totalVal = agent.balances.USDT + agent.balances.VCN * currentPrice;
    const vcnRatio = (agent.balances.VCN * currentPrice) / totalVal;
    const targetRatio = invCfg.targetRatio || cfg.inventoryTarget;
    const skewIntensity = invCfg.skewIntensity || 0.5;
    const rebal = (vcnRatio - targetRatio) * skewIntensity * 2;

    // 4. 레이어 생성
    const layers = spreadCfg.layerCount || cfg.layerCount;
    const spacing = (spreadCfg.layerSpacing || cfg.layerSpacing) / 100;
    const amtPct = (spreadCfg.layerAmountPercent || 3) / 100;

    const orders = [];
    for (let i = 0; i < layers; i++) {
        const layerMult = getLayerMultiplier(i, layers,
            spreadCfg.layerAmountPattern || 'flat');

        // BUY orders
        const bp = basePrice * (1 - bidSpread / 2 - i * spacing);
        const ba = Math.round(
            agent.balances.USDT * amtPct * layerMult * (1 - rebal * 0.5) / bp
        );
        if (ba >= DEX_MIN_ORDER) {
            orders.push({ side: 'buy', price: r4(bp), amount: ba });
        }

        // SELL orders
        const sp = basePrice * (1 + askSpread / 2 + i * spacing);
        const sa = Math.round(
            agent.balances.VCN * amtPct * layerMult * (1 + rebal * 0.5)
        );
        if (sa >= DEX_MIN_ORDER) {
            orders.push({ side: 'sell', price: r4(sp), amount: sa });
        }
    }

    return orders;
}

function getLayerMultiplier(index, total, pattern) {
    switch (pattern) {
        case 'increasing': return 0.5 + (index / total) * 1.0;
        case 'decreasing': return 1.5 - (index / total) * 1.0;
        case 'bell': {
            const mid = (total - 1) / 2;
            return 1.0 + 0.5 * (1 - Math.abs(index - mid) / mid);
        }
        default: return 1.0; // flat
    }
}
```

---

## 5. 보안 고려사항

| 항목 | 조치 |
|------|------|
| Admin 전용 | Firestore Security Rules에서 `admin` role만 `dex/config/*` 쓰기 허용 |
| 변경 이력 | 모든 설정 변경을 `dex/config/trading-audit-log`에 기록 |
| 값 범위 검증 | trendBias는 -1.0~+1.0, spread는 0.1~5.0% 등 서버 측 검증 |
| Kill Switch | 최우선 순위, 다른 설정 무시하고 즉시 정지 |
| Rate Limit | 설정 변경은 5초에 1회로 제한 (오작동 방지) |
