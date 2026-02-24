# VisionDEX On-Chain Architecture

## Problem & Constraints

| 제약 | 설명 |
|------|------|
| **Latency** | 온체인 tx마다 블록 대기 -> 매 체결마다 tx 보내면 너무 느림 |
| **No Paymaster** | 속도 문제로 Paymaster 사용 불가 |
| **Gas Cost** | 에이전트당 매 micro-round마다 tx = 비현실적 |
| **Block Time** | Vision Chain ~2s 블록타임 |

## Solution: Hybrid Architecture (Off-chain Matching + On-chain Batch Settlement)

```
┌─────────────────────────────────────────────────────────┐
│               Cloud Function (tradingEngine)            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ CloudOrderBook│  │ Preset Algo  │  │ DeepSeek LLM  │  │
│  │ (in-memory)  │  │ (free/fast)  │  │ (custom only) │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │   Matching & Decision (off-chain, <2s)        │
│         └──────────────────┬────────────────────────────│
│                            │                            │
│  ┌─────────────────────────v────────────────────────┐   │
│  │          Batch Settlement (1 tx per cycle)       │   │
│  │  Engine Admin Wallet -> DEXSettlement.settleBatch│   │
│  └─────────────────────────┬────────────────────────┘   │
└────────────────────────────│────────────────────────────┘
                             │
                  ┌──────────v──────────┐
                  │   Vision Chain      │
                  │   (chainId 3151909) │
                  │                     │
                  │  DEXSettlement.sol  │
                  │  ├─ deposit()       │
                  │  ├─ withdraw()      │
                  │  ├─ settleBatch()   │  <-- Admin only, 1 tx per cycle
                  │  └─ balanceOf()     │
                  │                     │
                  │  VCNToken (ERC20)   │
                  │  MockUSDT (ERC20)   │  <-- Testnet용 USDT
                  └─────────────────────┘
```

## Design Decisions

### 1. Off-chain Matching, On-chain Settlement
- **Matching/Decision**: 기존처럼 CloudOrderBook + preset algorithms (off-chain)
- **Settlement**: 매 엔진 사이클 (~1분) 종료 시 **단 1개의 batch tx**로 온체인 정산
- **장점**: Matching 지연 없음, on-chain 투명성 확보, gas 비용 최소화

### 2. Agent Wallets
- 각 에이전트에 Vision Chain 지갑(주소) 할당
- Private key는 Cloud Function 내부에서 관리 (Firebase Secret Manager or env)
- 에이전트 지갑은 deposit/withdraw에만 사용
- 거래 정산은 **Engine Admin Wallet**이 대행

### 3. Gas Fee Strategy (No Paymaster)
- **Settlement tx**: Engine Admin가 gas 지불 (1 gwei * ~500K gas = ~0.0005 VCN per cycle)
- **Agent deposit/withdraw**: Agent 지갑에 소량 VCN pre-fund (one-time)
- Admin wallet에 충분한 VCN을 보유 (gas pool)

### 4. Token Design
- **VCN**: 기존 VCNToken (ERC20)
- **USDT**: MockUSDT (ERC20, testnet 전용, mint 가능) - 나중에 bridged USDT로 교체

## Smart Contract: DEXSettlement.sol

```solidity
// Core functions:

// 사용자/에이전트가 토큰을 DEX에 입금
deposit(address token, uint256 amount)

// 사용자/에이전트가 토큰을 DEX에서 출금
withdraw(address token, uint256 amount)

// Admin only: 배치 정산 (1 tx로 여러 거래 정산)
settleBatch(SettleTrade[] calldata trades)
// SettleTrade = { buyer, seller, baseToken, quoteToken, baseAmount, quoteAmount, buyerFee, sellerFee }

// 내부 잔고 조회
balanceOf(address user, address token) -> uint256
```

### settleBatch Flow
1. Engine에서 micro-round 완료 후 체결된 trades 수집
2. `settleBatch([trade1, trade2, ...])` 호출
3. 컨트랙트 내부에서 각 trade의 buyer/seller 잔고 업데이트
4. 수수료는 fee collector 주소로 이전
5. 모든 토큰은 DEX 컨트랙트 내부에서 이동 (external transfer 없음 = gas 절약)

### Gas Estimation
- settleBatch with 50 trades: ~800K gas
- 1 gwei * 800K = 0.0008 VCN per cycle
- 1440 cycles/day * 0.0008 = ~1.15 VCN/day (negligible)

## Implementation Steps

### Phase A: Contracts
1. `MockUSDT.sol` - Testnet USDT (mintable ERC20)
2. `DEXSettlement.sol` - Deposit/Withdraw/SettleBatch
3. Deploy to Vision Chain v2

### Phase B: Engine Update
1. Engine Admin wallet setup (private key in Firebase env)
2. After micro-round loop, convert fills -> settleBatch calldata
3. Send 1 tx to DEXSettlement.settleBatch()
4. Update Firestore with on-chain tx hash

### Phase C: Agent Wallet Setup
1. Generate wallets for each agent (ethers.Wallet.createRandom)
2. Store encrypted private keys in Firestore
3. Fund each agent wallet with VCN for gas + initial tokens
4. Agents deposit tokens into DEXSettlement

### Phase D: Frontend Integration
1. Show on-chain tx hash for each trade/settlement
2. Link to VisionScan for verification
3. Show agent on-chain balances (DEXSettlement.balanceOf)
