# Vision Chain AI Market Making System
## VCN 자동 시세 형성 에이전트 기획서

**버전**: 1.0  
**작성일**: 2026-02-04  
**프로젝트 코드명**: Gravity Engine

---

## 1. Executive Summary

### 1.1 프로젝트 개요
VCN 토큰의 유동성과 합리적인 시세 형성을 위해, AI 에이전트 기반의 자동화된 마켓 메이킹 시스템을 구축합니다. 각 에이전트는 독립적인 온체인 지갑을 보유하고, 관리자가 설정한 가격 범위와 트렌드 방향 내에서 실제 스왑 거래를 수행하여 자연스러운 시장 가격을 형성합니다.

### 1.2 핵심 목표
| 목표 | 설명 |
|------|------|
| **유동성 확보** | DEX에 항상 충분한 매수/매도 주문 유지 |
| **가격 안정화** | 급격한 가격 변동 방지, 목표 범위 내 유지 |
| **자연스러운 거래량** | 실제 온체인 트랜잭션으로 거래량 생성 |
| **관리 가능성** | 어드민에서 가격 정책 실시간 조정 |

### 1.3 시스템 아키텍처 개요
```
┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN DASHBOARD                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Price Range │  │ Trend Setup │  │ Agent Wallet Management │  │
│  │ Min: $0.08  │  │ Direction:  │  │ Agent 1: 0x1a2b...      │  │
│  │ Max: $0.15  │  │   Bullish   │  │ Agent 2: 0x3c4d...      │  │
│  │ Target:$0.12│  │ Intensity:  │  │ Agent 3: 0x5e6f...      │  │
│  └─────────────┘  │   Medium    │  └─────────────────────────┘  │
│                   └─────────────┘                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Firebase/Firestore
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR SERVICE                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Market State Engine                                          ││
│  │ - Current Price Monitoring                                   ││
│  │ - Trend Calculation                                          ││
│  │ - Agent Task Distribution                                    ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Agent 1     │   │   Agent 2     │   │   Agent 3     │
│  "Stabilizer" │   │   "Buyer"     │   │   "Seller"    │
│ ┌───────────┐ │   │ ┌───────────┐ │   │ ┌───────────┐ │
│ │ Strategy  │ │   │ │ Strategy  │ │   │ │ Strategy  │ │
│ │ Mean      │ │   │ │ Bullish   │ │   │ │ Bearish   │ │
│ │ Reversion │ │   │ │ Momentum  │ │   │ │ Profit    │ │
│ └───────────┘ │   │ └───────────┘ │   │ └───────────┘ │
│ Balance:      │   │ Balance:      │   │ Balance:      │
│ 50K VCN       │   │ 50K VCN       │   │ 50K VCN       │
│ 5K USDC       │   │ 10K USDC      │   │ 2K USDC       │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │ On-chain Transactions
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VISION DEX (Smart Contract)                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ VCN/USDC Pool                                                ││
│  │ Liquidity: $500,000                                          ││
│  │ Current Price: $0.12                                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 시스템 컴포넌트 상세

### 2.1 Vision DEX (탈중앙화 거래소)

#### 2.1.1 스마트 컨트랙트 구조
```solidity
// VisionDEX.sol - Uniswap V2 스타일 AMM
contract VisionDEX {
    // 유동성 풀 (VCN/USDC)
    struct Pool {
        uint256 reserveVCN;
        uint256 reserveUSDC;
        uint256 totalLiquidity;
        uint256 fee; // 0.3% = 30
    }
    
    // 핵심 기능
    function swap(address tokenIn, uint256 amountIn) external returns (uint256 amountOut);
    function addLiquidity(uint256 vcnAmount, uint256 usdcAmount) external returns (uint256 liquidity);
    function removeLiquidity(uint256 liquidity) external returns (uint256 vcnAmount, uint256 usdcAmount);
    function getPrice() external view returns (uint256 vcnPriceInUSDC);
    
    // 관리 기능 (Admin Only)
    function setFee(uint256 newFee) external onlyAdmin;
    function emergencyPause() external onlyAdmin;
}
```

#### 2.1.2 가격 결정 메커니즘
```
AMM 공식: x * y = k (Constant Product)

예시:
- Pool: 1,000,000 VCN + 100,000 USDC
- k = 1,000,000 * 100,000 = 100,000,000,000
- VCN 가격 = 100,000 / 1,000,000 = $0.10

스왑 시 슬리피지:
- 10,000 VCN 매도 시:
- 새로운 VCN 양 = 1,010,000
- 새로운 USDC 양 = k / 1,010,000 = 99,009.90
- 받는 USDC = 100,000 - 99,009.90 = 990.10
- 실제 가격 = 990.10 / 10,000 = $0.099 (1% 슬리피지)
```

---

### 2.2 Admin Dashboard - 가격 정책 설정

#### 2.2.1 가격 범위 설정
| 파라미터 | 설명 | 기본값 | 범위 |
|----------|------|--------|------|
| `priceFloor` | 최저 허용 가격 | $0.08 | $0.01 - $10 |
| `priceCeiling` | 최고 허용 가격 | $0.15 | $0.01 - $10 |
| `targetPrice` | 목표 중심 가격 | $0.12 | Floor ~ Ceiling |
| `tolerance` | 목표가 허용 오차 | 5% | 1% - 20% |

#### 2.2.2 트렌드 설정
| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `trendDirection` | `bullish` / `neutral` / `bearish` | 가격 방향성 |
| `trendIntensity` | `low` / `medium` / `high` | 변화 강도 |
| `trendDuration` | 1-30일 | 트렌드 유지 기간 |
| `dailyChangeLimit` | 1-10% | 일일 최대 변동폭 |

#### 2.2.3 거래 파라미터
| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| `minTradeSize` | 최소 거래 금액 | $10 |
| `maxTradeSize` | 최대 거래 금액 | $1,000 |
| `tradeFrequency` | 거래 간격 (분) | 5-30분 |
| `dailyVolume Target` | 목표 일일 거래량 | $10,000 |
| `volumeVariance` | 거래량 변동성 | ±30% |

#### 2.2.4 Admin UI 구조
```
┌──────────────────────────────────────────────────────────────────┐
│ GRAVITY ENGINE - Market Making Control Panel                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─── PRICE SETTINGS ────────────────────────────────────────┐   │
│ │                                                            │   │
│ │  Current Price: $0.1234 ▲ +2.3%                           │   │
│ │                                                            │   │
│ │  [$0.08]━━━━━━━━●━━━━━━━━━━━━[$0.15]                       │   │
│ │  Floor      Target $0.12      Ceiling                     │   │
│ │                                                            │   │
│ │  Tolerance: [━━━●━━━━━━━] 5%                              │   │
│ │                                                            │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── TREND CONTROL ─────────────────────────────────────────┐   │
│ │                                                            │   │
│ │  Direction:  [🔻 Bearish] [⚖️ Neutral] [🔺 Bullish]        │   │
│ │                              ◉                             │   │
│ │                                                            │   │
│ │  Intensity:  [Low ━━━━●━━━━━━━━━ High]  Medium            │   │
│ │                                                            │   │
│ │  Duration:   [14 days] until 2026-02-18                   │   │
│ │                                                            │   │
│ │  Daily Limit: [━━━●━━━━━━━] 3% max change                 │   │
│ │                                                            │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── TRADING PARAMETERS ────────────────────────────────────┐   │
│ │                                                            │   │
│ │  Trade Size:    Min [$10] ━━━━━━━ Max [$1,000]            │   │
│ │                                                            │   │
│ │  Frequency:     Every [15] minutes (±5 min variance)      │   │
│ │                                                            │   │
│ │  Daily Target:  $10,000 volume (±30% variance)            │   │
│ │                                                            │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── AGENT STATUS ──────────────────────────────────────────┐   │
│ │                                                            │   │
│ │  Agent        Role        Status    Balance    24h Trades │   │
│ │  ─────────────────────────────────────────────────────────│   │
│ │  Stabilizer   Reversion   ● Active  52K VCN   12 trades   │   │
│ │  Alpha        Momentum    ● Active  48K VCN   8 trades    │   │
│ │  Beta         Contrarian  ○ Paused  50K VCN   0 trades    │   │
│ │                                                            │   │
│ │  [+ Add Agent]  [Rebalance All]  [Emergency Stop]         │   │
│ │                                                            │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─── 24H ACTIVITY ──────────────────────────────────────────┐   │
│ │  ▁▂▄▆█▇▅▃▂▁▂▃▅▇█▆▄▂▁▁▂▃▄▅                                 │   │
│ │  Trades: 47  |  Volume: $8,234  |  Avg Size: $175         │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│                     [Apply Changes]  [Reset to Defaults]         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### 2.3 AI Trading Agents

#### 2.3.1 에이전트 유형
| Agent Type | 전략 | 역할 | 매수/매도 비율 |
|------------|------|------|---------------|
| **Stabilizer** | Mean Reversion | 목표가 복귀 | 50/50 |
| **Momentum Buyer** | Trend Following | 상승 트렌드 지원 | 70/30 |
| **Profit Taker** | Contrarian | 하락 시 매수, 고점 매도 | 30/70 |
| **Volatility Dampener** | Range Bound | 급변동 완화 | 동적 조절 |
| **Volume Maker** | Random Walk | 거래량 생성 | 50/50 |

#### 2.3.2 에이전트 의사결정 로직
```typescript
interface AgentDecision {
    action: 'BUY' | 'SELL' | 'HOLD';
    amount: number;        // 거래 금액 (USDC)
    urgency: 'low' | 'medium' | 'high';
    reason: string;
}

class TradingAgent {
    // 핵심 의사결정 함수
    async makeDecision(marketState: MarketState): Promise<AgentDecision> {
        const currentPrice = marketState.currentPrice;
        const targetPrice = marketState.policy.targetPrice;
        const trend = marketState.policy.trendDirection;
        
        // 1. 가격 위치 분석
        const pricePosition = this.analyzePricePosition(currentPrice, marketState.policy);
        
        // 2. 트렌드 방향 확인
        const trendSignal = this.analyzeTradeSignal(trend, currentPrice, targetPrice);
        
        // 3. 포트폴리오 상태 확인
        const portfolioState = await this.getPortfolioState();
        
        // 4. 최종 결정
        if (pricePosition === 'below_floor') {
            return { action: 'BUY', amount: this.calculateBuyAmount('high'), urgency: 'high', reason: 'Price below floor' };
        }
        
        if (pricePosition === 'above_ceiling') {
            return { action: 'SELL', amount: this.calculateSellAmount('high'), urgency: 'high', reason: 'Price above ceiling' };
        }
        
        // 트렌드 기반 결정
        if (trend === 'bullish' && pricePosition === 'below_target') {
            return { action: 'BUY', amount: this.calculateBuyAmount('medium'), urgency: 'medium', reason: 'Supporting bullish trend' };
        }
        
        // ... 추가 로직
    }
    
    private analyzePricePosition(price: number, policy: PricePolicy): string {
        if (price <= policy.priceFloor) return 'below_floor';
        if (price >= policy.priceCeiling) return 'above_ceiling';
        if (price < policy.targetPrice * (1 - policy.tolerance)) return 'below_target';
        if (price > policy.targetPrice * (1 + policy.tolerance)) return 'above_target';
        return 'at_target';
    }
}
```

#### 2.3.3 에이전트 지갑 관리
```typescript
interface AgentWallet {
    id: string;
    name: string;
    address: string;           // 온체인 지갑 주소
    privateKeyEncrypted: string; // 암호화된 프라이빗 키
    
    // 잔액
    vcnBalance: bigint;
    usdcBalance: bigint;
    nativeBalance: bigint;     // 가스비용
    
    // 할당량
    maxVcnAllocation: bigint;
    maxUsdcAllocation: bigint;
    
    // 상태
    status: 'active' | 'paused' | 'rebalancing';
    lastTradeAt: Date;
    tradesToday: number;
}

class AgentWalletManager {
    // 에이전트 지갑 생성
    async createAgentWallet(agentName: string): Promise<AgentWallet> {
        // 새 지갑 생성 (ethers.js)
        const wallet = ethers.Wallet.createRandom();
        
        // 프라이빗 키 암호화 저장
        const encryptedKey = await this.encryptPrivateKey(wallet.privateKey);
        
        // Firestore에 저장
        await db.collection('agent_wallets').doc(wallet.address).set({
            id: generateId(),
            name: agentName,
            address: wallet.address,
            privateKeyEncrypted: encryptedKey,
            vcnBalance: 0n,
            usdcBalance: 0n,
            // ...
        });
        
        return { address: wallet.address, /* ... */ };
    }
    
    // 자산 배정
    async allocateAssets(agentAddress: string, vcn: bigint, usdc: bigint): Promise<void> {
        // Admin Treasury에서 에이전트 지갑으로 전송
        await this.transferFromTreasury(agentAddress, 'VCN', vcn);
        await this.transferFromTreasury(agentAddress, 'USDC', usdc);
    }
    
    // 리밸런싱 (에이전트 간 자산 재분배)
    async rebalanceAgents(): Promise<void> {
        const agents = await this.getAllAgents();
        const totalVCN = agents.reduce((sum, a) => sum + a.vcnBalance, 0n);
        const totalUSDC = agents.reduce((sum, a) => sum + a.usdcBalance, 0n);
        
        // 각 에이전트에게 균등 분배 또는 역할별 최적 비율로 재분배
        for (const agent of agents) {
            const targetVCN = this.calculateOptimalVCN(agent, totalVCN);
            const targetUSDC = this.calculateOptimalUSDC(agent, totalUSDC);
            await this.rebalanceAgent(agent, targetVCN, targetUSDC);
        }
    }
}
```

---

### 2.4 Orchestrator Service

#### 2.4.1 역할
1. **시장 상태 모니터링**: DEX의 현재 가격, 유동성, 거래량 수집
2. **정책 적용**: Admin 설정을 에이전트에게 전달
3. **작업 분배**: 어떤 에이전트가 언제 거래할지 조율
4. **충돌 방지**: 에이전트 간 동시 거래로 인한 슬리피지 방지
5. **보고서 생성**: 거래 기록, 성과 분석

#### 2.4.2 실행 사이클
```
┌────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR CYCLE (매 5분)                  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1️⃣ COLLECT                                                     │
│     └─ DEX에서 현재 가격, 풀 상태 조회                           │
│     └─ Firestore에서 Admin 정책 로드                            │
│     └─ 각 에이전트 지갑 잔액 조회                                │
│                                                                 │
│  2️⃣ ANALYZE                                                     │
│     └─ 현재가 vs 목표가 비교                                     │
│     └─ 트렌드 방향 확인                                          │
│     └─ 일일 거래량 달성률 계산                                   │
│                                                                 │
│  3️⃣ DECIDE                                                      │
│     └─ 이번 사이클에 거래할 에이전트 선정                        │
│     └─ 거래 방향 (BUY/SELL) 결정                                 │
│     └─ 거래 규모 결정                                            │
│                                                                 │
│  4️⃣ EXECUTE                                                     │
│     └─ 선정된 에이전트에게 거래 명령 전달                        │
│     └─ 온체인 트랜잭션 실행                                      │
│     └─ 결과 대기 및 확인                                         │
│                                                                 │
│  5️⃣ RECORD                                                      │
│     └─ 거래 기록 저장 (Firestore)                               │
│     └─ 에이전트 잔액 업데이트                                    │
│     └─ 성과 지표 업데이트                                        │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### 2.4.3 Cloud Function 구현
```typescript
// functions/gravityEngine.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const gravityEngineOrchestrator = onSchedule({
    schedule: 'every 5 minutes',
    timeZone: 'Asia/Seoul',
    memory: '512MiB',
}, async (event) => {
    const orchestrator = new GravityOrchestrator();
    
    try {
        // 1. 시장 상태 수집
        const marketState = await orchestrator.collectMarketState();
        
        // 2. 정책 로드
        const policy = await orchestrator.loadPolicy();
        
        // 3. 거래 결정
        const tradePlan = await orchestrator.decideTradePlan(marketState, policy);
        
        if (tradePlan.action !== 'HOLD') {
            // 4. 에이전트 선정 및 거래 실행
            const agent = await orchestrator.selectAgent(tradePlan);
            const result = await orchestrator.executeTrade(agent, tradePlan);
            
            // 5. 기록
            await orchestrator.recordTrade(result);
        }
        
        // 6. 상태 업데이트
        await orchestrator.updateDashboard(marketState);
        
    } catch (error) {
        console.error('[GravityEngine] Orchestration failed:', error);
        await orchestrator.handleError(error);
    }
});
```

---

## 3. 데이터 모델

### 3.1 Firestore Collections

```typescript
// gravity_policy - Admin 설정
interface GravityPolicy {
    id: 'current';
    priceFloor: number;
    priceCeiling: number;
    targetPrice: number;
    tolerance: number;
    
    trendDirection: 'bullish' | 'neutral' | 'bearish';
    trendIntensity: 'low' | 'medium' | 'high';
    trendStartDate: Timestamp;
    trendEndDate: Timestamp;
    dailyChangeLimit: number;
    
    minTradeSize: number;
    maxTradeSize: number;
    tradeFrequencyMinutes: number;
    dailyVolumeTarget: number;
    volumeVariance: number;
    
    isActive: boolean;
    updatedAt: Timestamp;
    updatedBy: string;
}

// gravity_agents - 에이전트 설정
interface GravityAgent {
    id: string;
    name: string;
    type: 'stabilizer' | 'momentum' | 'contrarian' | 'dampener' | 'volume';
    walletAddress: string;
    privateKeyEncrypted: string;
    
    status: 'active' | 'paused' | 'rebalancing';
    
    // 잔액 (캐시, 실시간 동기화)
    vcnBalance: string;  // bigint as string
    usdcBalance: string;
    nativeBalance: string;
    
    // 제한
    maxVcnAllocation: string;
    maxUsdcAllocation: string;
    maxTradePercentage: number;  // 잔액의 최대 %
    
    // 통계
    totalTrades: number;
    totalVolumeUSD: number;
    profitLossUSD: number;
    
    createdAt: Timestamp;
    lastTradeAt: Timestamp;
}

// gravity_trades - 거래 기록
interface GravityTrade {
    id: string;
    agentId: string;
    agentName: string;
    
    action: 'BUY' | 'SELL';
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    priceAtTrade: number;
    
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
    gasUsed: string;
    
    reason: string;  // 거래 이유
    
    createdAt: Timestamp;
    confirmedAt: Timestamp | null;
}

// gravity_stats - 일일 통계
interface GravityDailyStats {
    date: string;  // YYYY-Trading-DD
    
    openPrice: number;
    closePrice: number;
    highPrice: number;
    lowPrice: number;
    
    totalTrades: number;
    totalVolumeUSD: number;
    buyVolumeUSD: number;
    sellVolumeUSD: number;
    
    avgTradeSize: number;
    
    agentBreakdown: {
        [agentId: string]: {
            trades: number;
            volume: number;
        };
    };
}
```

---

## 4. 보안 고려사항

### 4.1 프라이빗 키 관리
```
┌─────────────────────────────────────────────────────────────┐
│                  KEY MANAGEMENT                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 키 생성 시:                                              │
│     └─ 서버에서 ethers.Wallet.createRandom() 실행           │
│     └─ 즉시 AES-256-GCM으로 암호화                          │
│     └─ 암호화된 키만 Firestore에 저장                       │
│     └─ 마스터 키는 Secret Manager에 보관                    │
│                                                              │
│  2. 거래 실행 시:                                            │
│     └─ Cloud Function 내에서만 복호화                       │
│     └─ 트랜잭션 서명 후 즉시 메모리에서 삭제                 │
│     └─ 절대 로그에 키 노출 금지                             │
│                                                              │
│  3. 접근 제어:                                               │
│     └─ Cloud Function에만 Secret 접근 권한                  │
│     └─ Firestore 규칙으로 직접 접근 차단                    │
│     └─ Admin API는 별도 인증 필요                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 거래 제한
| 제한 유형 | 값 | 목적 |
|-----------|-----|------|
| 단일 거래 최대 금액 | $1,000 | 시장 충격 방지 |
| 일일 최대 거래 횟수 | 100회/에이전트 | 가스비 관리 |
| 일일 최대 거래량 | $50,000 | 조작 의혹 방지 |
| 연속 거래 간격 | 최소 1분 | 프론트러닝 방지 |
| 가격 범위 이탈 시 | 즉시 정지 | 비정상 상황 대응 |

### 4.3 비상 정지
```typescript
// Emergency Stop 조건
const EMERGENCY_CONDITIONS = [
    'price_below_floor * 0.9',      // Floor보다 10% 이상 하락
    'price_above_ceiling * 1.1',    // Ceiling보다 10% 이상 상승
    'hourly_volume > daily_target', // 1시간에 일일 목표 초과
    'consecutive_failures >= 3',    // 연속 3회 거래 실패
    'gas_price > 100 gwei',         // 가스비 급등
];

async function checkEmergency(state: MarketState): Promise<boolean> {
    for (const condition of EMERGENCY_CONDITIONS) {
        if (evaluate(condition, state)) {
            await pauseAllAgents();
            await notifyAdmin('EMERGENCY', condition);
            return true;
        }
    }
    return false;
}
```

---

## 5. 구현 로드맵

### Phase 1: DEX 개발 (2주)
| 작업 | 소요 시간 | 산출물 |
|------|----------|--------|
| AMM 스마트 컨트랙트 개발 | 4일 | VisionDEX.sol |
| 테스트넷 배포 | 1일 | 테스트넷 컨트랙트 주소 |
| 기본 스왑 UI | 3일 | 프론트엔드 통합 |
| 유동성 추가 UI | 2일 | LP 토큰 관리 |
| 테스트 및 감사 | 4일 | 테스트 리포트 |

### Phase 2: Agent 시스템 (2주)
| 작업 | 소요 시간 | 산출물 |
|------|----------|--------|
| 에이전트 지갑 관리 시스템 | 3일 | AgentWalletManager |
| 트레이딩 전략 구현 | 4일 | 5가지 전략 클래스 |
| Orchestrator 서비스 | 3일 | Cloud Scheduler 연동 |
| 온체인 거래 실행 로직 | 2일 | DEX 연동 완료 |
| 에러 핸들링 및 복구 | 2일 | 안정성 확보 |

### Phase 3: Admin Dashboard (1주)
| 작업 | 소요 시간 | 산출물 |
|------|----------|--------|
| 가격 정책 UI | 2일 | Price Settings 컴포넌트 |
| 트렌드 설정 UI | 1일 | Trend Control 컴포넌트 |
| 에이전트 관리 UI | 2일 | Agent Status 컴포넌트 |
| 실시간 모니터링 | 2일 | 차트 및 로그 |

### Phase 4: 테스트 및 최적화 (1주)
| 작업 | 소요 시간 | 산출물 |
|------|----------|--------|
| 테스트넷 시뮬레이션 | 3일 | 시뮬레이션 리포트 |
| 파라미터 튜닝 | 2일 | 최적화된 설정 |
| 메인넷 배포 준비 | 2일 | 배포 체크리스트 |

---

## 6. 예상 비용

### 6.1 초기 자본
| 항목 | 금액 | 용도 |
|------|------|------|
| DEX 유동성 | $100,000 | 초기 풀 구성 |
| 에이전트 자금 | $50,000 | 5개 에이전트 각 $10,000 |
| 가스비 예치금 | $5,000 | VCN 네이티브 토큰 |
| **총계** | **$155,000** | |

### 6.2 운영 비용 (월간)
| 항목 | 금액 | 비고 |
|------|------|------|
| Cloud Functions | ~$50 | 5분 간격 실행 |
| Firestore | ~$30 | 거래 기록 저장 |
| 가스비 | ~$500 | 월 3,000건 거래 기준 |
| **총계** | **~$580/월** | |

---

## 7. 성공 지표 (KPIs)

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| 가격 범위 유지율 | > 95% | (범위 내 시간 / 전체 시간) |
| 일일 거래량 | > $5,000 | 에이전트 거래량 합계 |
| 스프레드 | < 2% | (매도가 - 매수가) / 중간가 |
| 에이전트 가동률 | > 99% | 정상 작동 시간 비율 |
| 트렌드 달성률 | > 80% | 목표 트렌드 방향 일치율 |

---

## 8. 리스크 및 대응

| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|-----------|
| 외부 대량 매도 | 중 | 높음 | Emergency Stop, 자동 매수 강화 |
| 스마트 컨트랙트 취약점 | 낮 | 높음 | 코드 감사, 업그레이드 패턴 |
| 프라이빗 키 유출 | 낮 | 치명 | HSM 도입, 다중 서명 |
| 가스비 급등 | 중 | 중 | 동적 가스 한도, 거래 일시 중지 |
| 규제 이슈 | 중 | 높음 | 법률 검토, 투명한 공개 |

---

## 9. 결론

이 시스템은 VCN 토큰의 건강한 시장 생태계를 구축하기 위한 핵심 인프라입니다. AI 에이전트 기반의 자동화된 마켓 메이킹을 통해:

1. **유동성 확보**: 사용자들이 언제든 합리적인 가격에 거래 가능
2. **가격 발견**: 자연스러운 수요/공급 기반 시세 형성
3. **신뢰 구축**: 투명한 온체인 거래 기록
4. **확장 가능**: 다른 토큰 페어로 확장 용이

다음 단계로, DEX 스마트 컨트랙트 개발부터 시작하시겠습니까?
