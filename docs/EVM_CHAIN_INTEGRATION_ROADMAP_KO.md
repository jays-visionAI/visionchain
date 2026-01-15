# Grand Paymaster EVM 체인 통합 로드맵 v1.0

> CoinMarketCap Top 100 프로젝트 분석 기반의 단계별 통합 계획서

---

## 1. 개요 및 전략

Grand Paymaster의 시장 점유율 확대를 위해 CMC 상위권 체인들을 단계별로 통합합니다. 현재 구축된 **IChainAdapter(JSON-RPC)** 아키텍처를 기반으로 기술적 호환성이 높은 프로젝트부터 우선순위를 부여합니다.

### 핵심 통합 원칙
1.  **Standardized EVM First**: 별도의 코드 수정 없이 `chainId`와 `RPC` 설정만으로 연동되는 체인 우선 기용
2.  **Stablecoin Liquidity**: USDT, USDC 유동성이 높아 스폰서링 예치금 관리가 용이한 체인 선정
3.  **Growth Synergy**: 게이밍, DeFi 등 트랜잭션 빈도가 높아 스폰서링 니즈가 큰 생태계 집중

---

## 2. [Phase 1] 시장 지배력 확보 (CMC Top 50)

가장 표준적인 인프라와 높은 사용자 기반을 가진 Tier 1 체인들을 통합합니다.

| 단계 | 체인명 | 마켓 랭킹 | 기술적 근거 | 통합 목표 |
|:---:|:---|:---:|:---|:---|
| **1-1** | **Ethereum** | #2 | 원조 EVM, EIP-1559 기준점 | 신뢰도 확보 및 메인넷 레퍼런스 |
| **1-2** | **Polygon** | #20 | 저렴한 수수료, 완벽한 호환성 | 스폰서 비용 효율화 테스트 |
| **1-3** | **BNB Chain** | #4 | 높은 유동성, Legacy 모델 지원 | 실사용자 유입 및 대규모 처리 검증 |
| **1-4** | **Arbitrum** | #30 | L2 선두주자, 시퀀서 연동 최적화 | 고성능 dApp 스폰서링 선점 |
| **1-5** | **Optimism** | #35 | OP Stack의 표준, 생태계 확장성 | 슈퍼체인 하이웨이 구축 |

---

## 3. [Phase 2] 생태계 니즈 확장 (CMC 51-100위)

특정 산업 분야에 강점을 가진 특화 체인 및 신흥 L2를 통합하여 서비스 버티컬을 확장합니다.

| 단계 | 체인명 | 주요 분야 | 기술적 특징 | 통합 목표 |
|:---:|:---|:---:|:---|:---|
| **2-1** | **Mantle** | DeFi / L2 | 고유 리밸런싱 메커니즘 호환 | 대규모 유동성 dApp 스폰서링 |
| **2-2** | **Immutable** | Gaming | zkEVM 기반, 매끄러운 UX 필수 | 게이머 대상 가스리스 경험 제공 |
| **2-3** | **Fantom** | DeFi | 고속 파이널리티, Legacy 모델 | 초단위 정산 및 가스 추정 검증 |
| **2-4** | **Celo** | Mobile / UX | L2 전환 완료, 낮은 지연 시간 | 모바일 지갑 중심 스폰서링 활성화 |
| **2-5** | **Gnosis** | Infra | 검증된 안정성, EIP-1559 지원 | 인프라 안정성 중심 운영 |

---

## 4. 기술적 체크리스트 (Technical Checklist)

각 체인 통합 시 **Chain Registration Wizard**에서 다음 항목을 검수합니다.

### 4.1 가스 파라미터 (Gas Parameters)
- [ ] **EIP-1559 지원 여부**: 지원 시 `MaxFeePerGas` 사용, 미지원 시 `Legacy GasPrice` 적용
- [ ] **Oracle Variance**: 멀티소스 가스 오라클을 통해 소스 간 편차 10% 이내 유지 확인

### 4.2 인프라 신뢰성 (Infrastructure)
- [ ] **RPC Availability**: 최소 3개 이상의 Public/Private RPC 엔드포인트 확보
- [ ] **Finality Threshold**: 체인별 특성(L1 vs L2)에 맞는 `confirmations` 값 설정 (예: ETH 12, Polygon 64)

### 4.3 브릿지 연동 (Bridge Interop)
- [ ] **Native Bridge**: Vision Chain과의 원활한 자산 이동 경로 확보
- [ ] **LayerZero/Axelar**: 어댑터 기반의 메시징 테스트 완료

---

## 5. 단계별 실행 일정

1.  **준비 (Week 1)**: `EVMChainAdapter` 기반의 Top 5(Phase 1) RPC 벤치마킹
2.  **실행 (Week 2-4)**: 위저드를 통한 실제 체인 등록 및 E2E 테스트(S1~S12) 수행
3.  **확장 (Month 2)**: Phase 2 프로젝트 대상 파트너십 및 전용 인스턴스 개설

---

*작성일: 2026-01-15*
*작성자: Antigravity AI Engine*
