# Grand Paymaster 운영 매뉴얼 v1.1

> PRD v1.1 Mainnet Readiness 구현에 따른 Admin/Developer 콘솔 사용 가이드

---

## 목차

1. [Admin Console 사용법](#1-admin-console-사용법)
2. [Developer Console 사용법](#2-developer-console-사용법)  
3. [체인 등록 (8단계 Wizard)](#3-체인-등록-8단계-wizard)
4. [Core Adapters 개발 가이드](#4-core-adapters-개발-가이드)
5. [E2E 테스트 실행](#5-e2e-테스트-실행)

---

## 1. Admin Console 사용법

### 1.1 접근 경로
```
/admin/paymaster
```

### 1.2 화면 구성

| 화면 | 파일 | 설명 |
|------|------|------|
| **Dashboard** | `PaymasterAdmin.tsx` | KPI 카드, 체인/풀 상태 모니터링 |
| **dApp Oversight** | `AdminDappOversight.tsx` | dApp별 스폰서 사용량, 캡 현황 |
| **Fees & Settlement** | `AdminFeesSettlement.tsx` | 수수료/정산 내역, 수익 집계 |
| **Explorer Monitor** | `AdminExplorerMonitor.tsx` | 이벤트 인덱싱 상태 |
| **TSS Health** | `AdminTSSHealth.tsx` | TSS 노드 상태, 키 세트 관리 |
| **Alerts** | `AdminAlertsIncidents.tsx` | 실시간 알림/장애 관리 |
| **Policies** | `AdminPoliciesCompliance.tsx` | Denylist/Allowlist, 컴플라이언스 |

### 1.3 주요 액션

#### 체인 등록
1. Dashboard > `+ Register New Chain` 클릭
2. 8단계 Wizard 따라 진행
3. 각 단계 검증 통과 필수

#### 풀 관리
- **Pause Pool**: 해당 체인 스폰서링 즉시 중단
- **Resume Pool**: 스폰서링 재개
- **Simulate Drain**: 잔고 부족 상황 테스트

#### 상태 모니터링
- `NORMAL` → 정상 운영
- `SAFE_MODE` → 가스 급등/잔고 부족 시 자동 전환
- `THROTTLED` → 스팸 감지 시 rate limit 적용
- `PAUSED` → 수동 중단

---

## 2. Developer Console 사용법

### 2.1 화면 구성

| 화면 | 파일 | 설명 |
|------|------|------|
| **Overview** | `DevConsoleOverview.tsx` | 잔고, 7일 소진량, 런웨이 예측 |
| **Instances** | `DevPaymasterInstances.tsx` | 체인별 Paymaster 인스턴스 관리 |
| **Sponsor Pool** | `DevSponsorPool.tsx` | 예치금 입금/출금 |
| **Transactions** | `DevTransactions.tsx` | Quote→Deduct→Execute→Settle 타임라인 |

### 2.2 인스턴스 생성

```
1. Instances 화면 > "Create Instance" 클릭
2. 체인 선택 (Ethereum, Polygon, Vision 등)
3. 설정:
   - sponsorMode: ON/OFF
   - perTxCap: 트랜잭션당 최대 지출
   - perUserCap: 유저당 일일 최대
   - dailyCap: 전체 일일 한도
   - allowedTokens: 차감 허용 토큰
```

### 2.3 예치금 관리

```
1. Sponsor Pool 화면에서 Deposit Address 복사
2. 지원 토큰(VCN, USDT, USDC)만 전송
3. 64 confirmations 후 잔고 반영
```

---

## 3. 체인 등록 (8단계 Wizard)

> 파일: `components/admin/ChainRegistrationWizard.tsx`

### Step 1: Chain Metadata
- chainId, name, explorerUrl, nativeGasToken 입력
- 네트워크 타입 선택: `Testnet` (권장) / `Mainnet`

### Step 2: RPC Endpoints
- Primary/Secondary RPC URL 입력
- WebSocket URL (선택)
- 노드 타입: `Managed RPC` vs `Self-Hosted`
- **Verify 버튼**으로 연결 테스트

### Step 3: Health Check
- `Run Health Check` 버튼 클릭
- 자동 검증: blockNumber 증가, RPC latency, error rate
- 5분 내 통과 필수

### Step 4: Adapter Test (Execution)
- 테스트 계정으로 가스 추정/셀프전송 테스트
- estimateGas, sendRawTx, getReceipt 검증

### Step 5: Bridge Adapter Test
- Vision Chain ↔ Target Chain 소액 크로스체인 테스트
- 20회 연속 성공 필요

### Step 6: Paymaster Pool Setup
- minBalance, targetBalance 설정
- TSS KeyGen 초기화 (Mock ID 생성)

### Step 7: Restricted Launch
- 내부 dApp만 사용 가능한 `ACTIVE_RESTRICTED` 상태
- 충분한 검증 후 다음 단계로

### Step 8: Public Promotion
- `ACTIVE_PUBLIC`으로 승격
- 모든 dApp이 해당 체인에서 인스턴스 생성 가능

---

## 4. Core Adapters 개발 가이드

### 4.1 ChainAdapter 사용

```typescript
import { EVMChainAdapter } from '@/services/paymaster/ChainAdapter';

const adapter = new EVMChainAdapter({
    chainId: 1,
    rpcUrl: 'https://mainnet.infura.io/v3/...',
    rpcUrls: [  // 멀티소스 가스 오라클
        'https://mainnet.infura.io/v3/...',
        'https://eth-mainnet.alchemyapi.io/v2/...',
        'https://rpc.ankr.com/eth'
    ],
    confirmations: 12,
    feeModel: 'EIP1559'
});

// 멀티소스 가스 가격 조회 (Median 방어)
const { median, sources, variance } = await adapter.getMultiSourceGasPrice();

// Gas Quote 생성
const quote = await adapter.getGasQuote({
    to: '0x...',
    data: '0x...',
    value: BigInt(1e18)
});
console.log(`Sources: ${quote.sourceCount}, Variance: ${quote.variance}%`);
```

### 4.2 BridgeAdapter 사용

```typescript
import { MockBridgeAdapter } from '@/services/paymaster/BridgeAdapter';

const bridge = new MockBridgeAdapter();

// Quote 요청
const quote = await bridge.getQuote({
    sourceChainId: 1337,  // Vision
    destChainId: 1,          // Ethereum
    token: 'VCN',
    amount: BigInt(1000e18)
});

// 브릿지 실행
const transfer = await bridge.initiateBridge(quote);
// 상태: ROUTE_QUOTED → SOURCE_SENT → DEST_CONFIRMED
```

### 4.3 NonceManager 사용

```typescript
import { NonceManager } from '@/services/paymaster/NonceManager';

const nonceManager = new NonceManager(adapter, {
    relayAccountAddress: '0x...',
    maxPendingTxs: 10,
    confirmationTimeout: 60000,  // 60초
    maxRetries: 3,
    gasBumpPercent: 15  // 15% 가스 인상
});

await nonceManager.initialize();
const nonce = await nonceManager.getNextNonce();

// 트랜잭션 추적
nonceManager.trackTx(nonce, txHash, gasQuote);

// 스턱 트랜잭션 체크 (가스 범프 자동 실행)
await nonceManager.checkStuckTransactions();
```

---

## 5. E2E 테스트 실행

### 5.1 테스트 파일
```
tests/paymaster-e2e.test.ts
```

### 5.2 시나리오 목록

| ID | 시나리오 | 검증 내용 |
|----|----------|-----------|
| S1 | 정상 플로우 | Quote→Deduct→Execute→Settle |
| S2 | Sponsor OFF | 유저 가스 지불 |
| S3 | 캡 초과 | DECLINE(CAP_EXCEEDED) |
| S4 | 스팸 공격 | THROTTLED 모드 전환 |
| S5 | 가스 급등 | SAFE_MODE 전환 |
| S6 | 오라클 조작 | Median 방어 |
| S7 | 풀 잔고 부족 | EMERGENCY 리밸런싱 |
| S8 | 리밸런싱 실패 | Safe-mode 유지 |
| S9 | TSS 부분 장애 | 서명 계속 가능 |
| S10 | TSS 임계치 미달 | DECLINE(SIGNER_UNAVAILABLE) |
| S11 | 정산 오차 | 환급 정책 검증 |
| S12 | 내부자 공격 | Timelock 방어 |

### 5.3 실행 방법
```bash
# vitest 설치 (최초 1회)
npm install -D vitest

# 테스트 실행
npm run test

# 특정 시나리오만 실행
npx vitest run -t "S5: Gas Price Spike"
```

---

## 6. Explorer Event Schema

### 6.1 이벤트 타입

```typescript
// types.ts에 정의됨
FeeQuotedEvent       // Quote 발행
FeeDeductedEvent     // 차감 증빙
SponsoredExecutionSubmittedEvent  // 목적지 tx 제출
FeeSettledEvent      // 정산 완료
PaymasterRebalancedEvent  // 풀 보충
ModeChangedEvent     // 상태 전환
```

### 6.2 API 엔드포인트 (향후 구현)
```
GET /explorer/paymaster/quote/{quoteId}
GET /explorer/paymaster/dapp/{dappId}
GET /explorer/paymaster/chain/{chainId}/events
```

---

## 7. 문제 해결

### Q: Pool이 SAFE_MODE에서 복구되지 않음
→ 리밸런싱 성공 + 가스 정상화 후 10~30분 관찰 기간 필요

### Q: 체인 등록 Step 3 Health Check 실패
→ RPC URL 확인, 방화벽/CORS 설정 확인

### Q: TSS Degraded 경고
→ 임계치(3-of-5) 이상 signer 활성 상태면 정상 운영 가능

---

*Last Updated: 2026-01-15*
