# Grand Paymaster 시스템 구축 이행 계획서 (PRD v1.1 Mainnet Readiness 확장)

본 문서는 PRD v1.1의 **메인넷 출시 요건(Mainnet Readiness)**을 충족하기 위해, 기존 기능 명세에 **운영(Ops), 보안(Security), 컴플라이언스(Compliance)** 요구사항을 완벽하게 반영한 최종 실행 계획서입니다.

---

## 0. 비기능 요건 및 SLO 준수 전략
*   **Quote Latency (<800ms)**: Redis 캐싱 및 Region-local RPC 라우팅을 통해 쿼터 응답 속도 최적화.
*   **Availability (>99.5%)**: Agent Node의 Failover 로직 및 다중 Gas Source(3개 이상) 활용.
*   **Auditability**: 모든 상태 변경(Admin/Policy/Funds)은 `Append-only Log`로 영구 저장.

---

## Phase 1: 운영 관제 및 Admin Control Plane (Ops Ready)
**목표**: 단순 기능을 넘어 운영자가 24/7 시스템을 감시하고 장애에 즉각 대응할 수 있는 **관제 센터**를 구축합니다.

### 핵심 구현 과제 (PRD 1.2 등)
1.  **[Admin Dashboard] Ops 모니터링 강화** (SLO 추적 포함)
    *   **KPI & SLO**: 트랜잭션 성공률, Quote 응답 시간(p95), Rebalance 성공률 실시간 게이지.
    *   **Alerts Panel**: Safe-mode 진입, RPC 장애, TSS 서명 지연 등 치명적 경고 즉시 표시.
2.  **[Chain Ops] 변경 관리 통제**
    *   **Timelock**: 체인 활성화/비활성화 등 중요 변경 시 타임락(Timelock) 승인 대기 로직 적용(시뮬레이션).
    *   **Audit Logger**: "누가, 언제, 무엇을 변경했는지" 기록하는 감사 로그 시스템.
3.  **[Pool Ops] 장애 대응 도구**
    *   **Manual Circuit Breaker**: 운영자가 특정 체인 풀을 즉시 'PAUSE' 시킬 수 있는 비상 스위치.

---

## Phase 2: Paymaster Agent & Orchestrator (Autonomous & Resilient)
**목표**: 장애 상황에서도 스스로를 방어하고 복구하는 **회복 탄력성(Resilience)**이 확보된 엔진 구현.

### 핵심 구현 과제 (PRD 2.1 ~ 2.3 등)
1.  **[Agent Node] 방어적 상태머신 (Defensive State Machine)**
    *   **Inputs 다각화**: RPC Health 외 Mempool 혼잡도, 가스 가격 소스 3중화(Median 값 사용).
    *   **Mode Logic 확장**:
        *   `SAFE_MODE`: 가스 급등 시 Buffer 자동 상향 및 고액 Tx 거절.
        *   `THROTTLED`: 특정 dApp의 스팸성 요청 폭증 시 자동 격리(Rate Limiting).
2.  **[Orchestrator] 지능형 리밸런싱**
    *   **Priority Queue**: `Critical(잔고<Min)` > `Warning` > `Normal` 순으로 리밸런싱 작업 우선순위 처리.
    *   **Retry Logic**: TopUp 실패 시 지수 백오프(Exponential Backoff) 재시도 및 실패 시 운영자 호출(PagerDuty Hook).

---

## Phase 3: 개발자 생태계 및 컴플라이언스 (Dev & Compliance)
**목표**: 개발자 편의성을 제공하되, 부정 사용을 방지하는 **컴플라이언스 체계**를 내재화합니다.

### 핵심 구현 과제 (PRD 1.3 & Compliance)
1.  **[DevConsole] 투명성 및 제어권**
    *   **Policy Editor**: 일일 한도(Daily Cap) 외 유저당 한도(Per-User Cap) 설정 UI.
    *   **Real-time Reports**: Quote -> Execute -> Settle 단계별 비용 및 당사 수수료(Surcharge) 투명 공개.
2.  **[Compliance] 부정 사용 차단**
    *   **Denylist Hook**: 악성 dApp이나 지갑 주소, 또는 의심스러운 패턴(고빈도/고액) 자동 차단.
    *   **Fraud Detection**: 비정상적인 Quote 요청 패턴 감지 시 해당 dApp 인스턴스 자동 동결(Freeze).

---

## Phase 4: 비즈니스 로직 및 정산 투명성 (Business Core)
**목표**: 네이티브 토큰이 없는 환경에서도 '타겟 토큰'으로 수수료를 정확히 수취하고, 모든 내역을 투명하게 공개합니다.

### 핵심 구현 과제 (PRD 7.x & 3.1 등)
1.  **[Fee Engine] 정밀 Surcharge 모델**
    *   **Dynamic Pricing**: `BaseGas * (1 + Buffer) + Surcharge(20~50%)`. Market Volatility에 따라 Buffer 동적 조정.
    *   **Conversion Oracle**: 실시간 환율(USDT/VCN)을 적용한 정확한 토큰 차감.
2.  **[Settlement & Explorer] 온체인 가시성**
    *   **Reconciliation**: 실제 가스비 영수증(Receipt) 기반으로 정확한 수익/환급액 확정.
    *   **Event Indexing**: `FeeQuoted`, `FeeDeducted`, `FeeSettled` 이벤트를 Explorer가 인덱싱하여 증빙 제공.

---

## Phase 5: 보안 아키텍처 및 검증 (Security & TSS)
**목표**: 금융급 보안 수준을 달성하기 위해 **TSS(Threshold Signature Scheme)**와 다층 방어 체계를 구축합니다.

### 핵심 구현 과제 (PRD 9.x & 10.x & 4.x)
1.  **[Security] TSS & Key Ops**
    *   **TSS Manager**: 유저 키 분산 저장 및 MPC(Multi-Party Computation) 기반 서명 로직 시뮬레이션.
    *   **Operations**: 키 생성(KeyGen) 및 주기적 키 교체(Rotation) 프로세스 정의.
2.  **[System Hardening] Vault & Access**
    *   **Multi-sig**: 운영 금고에서의 대규모 자금 이동은 다중 승인 필수.
    *   **Isolation**: Paymaster Agent와 운영 Vault의 권한 완벽 분리.
3.  **[Final Validation] 12-Scenario Stress Test**
    *   **통합 테스트**: PRD에 정의된 12가지 시나리오(S1:정상 ~ S12:내부자위협) 전수 테스트.
    *   **Stress Test**: 초당 100 TPS 부하 주입 시에도 SLO(응답시간, 성공률) 준수 여부 검증.
