# Vision Chain 리소스 기여형 노드 모델 (Resource-Contribution Hybrid Model) v2.0

dApp 파트너사의 컴퓨팅(GPU) 요구사항과 데이터 저장(Storage) 수요를 충당하기 위해, 기존 4단계 노드 체계를 리소스 기여형으로 확장한 최종 모델 제안서입니다.

---

## 1. 노드 매트릭스 (4 Types x 2 Resources)

| 노드 타입 | 기본 역할 (합의/운영) | **[NEW] 리소스 기여 (GPU/Storage)** | 인센티브 구조 |
|:---:|:---|:---|:---|
| **Authority** | 네트워크 가용성 보장 | **Core Indexer**: dApp 데이터 고속 아카이빙 및 안정적인 API 제공 | 운영비 보전 + 파트너사 구독료 쉐어 |
| **Consensus** | 블록 검증 및 생성 | **Validation Proofs**: 리소스 기여 상태(Proof of Resource) 검증 및 스테이킹 가중치 부여 | 블록 보상 + 소유 리소스 비례 가중치 |
| **Agent (GPU/Utility)** | **Computing Contributor**: dApp의 AI 추론, 렌더링 등 GPU 연산 수행 | **Surcharge**: dApp 파트너사가 지불하는 컴퓨팅 비용 직접 수취 (VCN/Stable) | 파트너사 지불 비용 80~90% 직접 배분 |
| **Edge (Storage/Data)** | **Storage Contributor**: 분산 스토리지(IPFS 등) 조각 파일 호스팅 및 데이터 가용성 보조 | **Micro-Rewards**: 데이터 조회(Retrieval) 성공 시 초소액 VCN 실시간 지급 | 데이터 조회 횟수 비례 보상 (PoR 기반) |

---

## 2. 리소스 기반 상세 분류

### 2.1 GPU Computing Node (Agent Node 확장형)
- **대상**: 고성능 GPU(RTX 3080급 이상)를 보유한 개인/기관.
- **매커니즘**:
    - dApp 파트너사가 AI 연산 요청을 네트워크에 투함.
    - 가장 가까운 위치나 최적의 성능을 가진 **GPU Agent Node**가 작업 수행.
    - 결과값이 Vision Chain에 기록되면 스마트 컨트랙트에 의해 보상 자동 정산.
- **특이사항**: 간헐적 운영 가능. 가동 중일 때만 작업을 할당받아 보상 수령.

### 2.2 Data Storage Node (Edge Node 확장형)
- **대상**: 대용량 저장공간(단위: TB)을 저렴하게 공급할 수 있는 유저.
- **매커니즘**:
    - Vision Chain dApp의 NFT 이미지, 메타데이터, 로그 등을 분산 저장.
    - **Proof of Space-Time**: 지속적으로 데이터를 보유하고 있음을 증명.
    - 데이터가 필요할 때 가장 빠르게 응답(Latency)하는 노드에 인센티브 가중.
- **특이사항**: 가급적 24/7 연동이 권장되나, 데이터 복제본이 여러 노드에 분산되어 있어 한두 개 노드가 꺼져도 시스템은 안전함.

---

## 3. dApp 파트너사 전용 지원 시스템 (Partner-Specific Support)

- **Dedicated Resource Pool**: dApp 파트너사는 자신의 서비스만을 위한 '전용 노드 그룹'을 화이트리스트 기반으로 설정 가능.
- **Service Level Agreement (SLA)**: 개개인이 간헐적으로 들어오더라도, 네트워크 전체적으로는 상시 최소 100TB / 1,000 TFLOPS 이상이 유지되도록 알고리즘이 노드 모집을 자동 조절.
- **Resource Staking**: 유저가 특정 dApp의 노드로 등록할 경우, 해당 dApp이 발행한 토큰이나 VCN을 추가 보상으로 주는 스테이킹 캠페인 지원.

---

## 4. 로드맵 및 실행 전략

1.  **Phase 1 (Proof-of-Concept)**: 현재의 테스트넷 서버 1대(5개 노드)에서 가상 GPU 연산 할당 시뮬레이션.
2.  **Phase 2 (Alpha Launch)**: 실제 개인 유저 대상 'Vision Node App' 배포 및 스토리지 기여 테스트.
3.  **Phase 3 (Mainnet)**: dApp 파트너사 결제 시스템(Paymaster)과 리소스 정산 시스템 연동.

---
이 모델은 개별 노드의 '간헐적 참여'를 인프라 차원에서 **풀(Pool) 구조**로 묶어 dApp 사에 **상시 가동성(Highest Availability)**을 보장하는 스마트한 구조입니다.

이 설계안에 대해 dApp 파트너사들과 공유할 수준의 **상세 기술 규격(Spec)** 작성을 시작할까요?
