# PRD v1.1 — Vision Chain Grand Paymaster Mainnet Readiness

## 0. Mainnet 출시를 위한 추가 전제 (비기능 요구)
*   **SLO**: Paymaster Quote p95 < 800ms, Execute submission 성공률 > 99.5%, Rebalance Job 성공률 > 99%
*   **보안**: Vault 분리 + 멀티시그 + 타임락(프로덕션 강제), 키/서명은 TSS(HSM/MPC) 기반, 감사로그(append-only) 필수
*   **운영**: 24/7 모니터링, 자동 Safe-mode/Throttling, 장애 대응 런북, 변경관리(릴리즈/롤백)
*   **컴플라이언스 훅**: dApp/유저 단위 제재(denylist/freeze), 리텐션 정책, 고액/이상 패턴 플래그

---

## 1. 화면/대시보드 IA 및 각 화면 요구사항

### 1.1 IA (Information Architecture)

#### A. Admin Console (Vision Chain 운영자)
1.  Dashboard (Global Overview)
2.  Chains & Bridges
3.  Paymaster Pools (Chain Pools)
4.  Grand Paymaster Orchestrator
5.  dApp Sponsor Oversight
6.  Fees & Settlement (Revenue)
7.  Explorer Indexing Monitor
8.  TSS / KeyOps Health
9.  Alerts & Incidents
10. Policies & Compliance

#### B. Developer Console (dApp 오너)
1.  Overview
2.  Paymaster Instances (체인별)
3.  Sponsor Pool (Deposit/Spend)
4.  Sponsorship Policy (Caps/Rules)
5.  Transactions & Settlement
6.  API Keys / Webhooks
7.  Reports (Usage/Cost/ROI)
8.  Support / Incident Status

---

## 2. 체인별 Paymaster Agent Node 런타임 스펙

### 2.1 Agent Node 구성요소
*   **Inputs**: RPC health, gas price sources(≥3), pool balance, spend rate, pending tx, orchestrator directives.
*   **Outputs**: Quote 승인/거절(사유코드), Rebalance request, Mode 전환, Alerts.

### 2.2 상태머신 (State Machine)
*   **INIT**: 초기화 및 HealthCheck.
*   **NORMAL**: 표준 정책 적용 및 모든 요청 처리.
*   **SAFE_MODE**: 잔고 부족, 가스 급등, 실패율 증가 시 진입. (고액 차단, 버퍼 상향)
*   **THROTTLED**: 스팸/지출 급증 시 진입. (Rate limit 강화, 특정 dApp 격리)
*   **PAUSED**: 운영자 수동 중단 또는 치명적 에러. (모든 요청 거절)
*   **RECOVERY**: 정상화 확인 및 단계적 제한 완화.

---

## 3. Explorer 인덱싱을 위한 이벤트 스키마

### 3.1 주요 이벤트
*   `FeeQuoted(quoteId, routeId, dapp, user, tokenIn, totalMaxTokenIn, expiry)`
*   `FeeDeducted(quoteId, tokenIn, deductedAmount, payerType)`
*   `SponsoredExecutionSubmitted(quoteId, destChainId, relayer, destTxHash)`
*   `FeeSettled(quoteId, actualGasCost, actualSurcharge, refund, revenue)`
*   `PaymasterRebalanced(routeId, amount, fromVault, toGasAccount, reason)`
*   `ModeChanged(routeId, oldMode, newMode, reason)`

---

## 4. Testnet 시나리오 기반 통합 테스트 케이스

*   **S1**: 정상 플로우 (Sponsor ON + 차감 + 정산)
*   **S3**: 예산 소진 방어 (dApp Daily Cap 초과)
*   **S5**: 가격 급등 대응 (SAFE_MODE 전환)
*   **S7**: 체인 풀 잔고 부족 (자동 리밸런싱/Emergency TopUp)
*   **S9/S10**: TSS 서명 장애 대응 (부분/다수 Signer Down)
*   **S12**: 내부자 리스크 통제 (멀티시그/타임락 검증)
