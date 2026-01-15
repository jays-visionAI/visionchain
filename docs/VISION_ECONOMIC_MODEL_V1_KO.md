# Vision Chain Economic Model V1 (Incentive & Slashing)

본 문서는 Vision Chain v2.0의 노드 생태계를 활성화하기 위한 초기 경제 모델(V1)을 정의합니다. 본 모델은 네트워크 보안성, 리소스 기여도, 그리고 지속 가능한 수수료 구조를 최적화하는 데 중점을 둡니다.

## 1. 노드별 보상 곡선 (VCN Reward Curves)

네트워크 인플레이션 보상($R_{inf}$)과 서비스 수수료 보상($R_{fee}$)을 합산하여 총 보상을 계산합니다.

### 1.1 Authority Node (재단/파트너)
- **목적**: 네트워크 최종성 가용성 보장 (24/7)
- **보상 구조**: 고정 연이율(Fixed APR) + 거버넌스 보상
- **수식**: $R_{auth} = S_{auth} \times APR_{fixed}$ (단, 가동률 99.9% 미만 시 보상 중단)

### 1.2 Consensus Node (PoS 검증인)
- **목적**: 블록 생성 및 네트워크 보안
- **보상 구조**: 스테이킹 수량 비례 보상 및 블록 보상
- **수식**: $R_{cons} = \frac{S_{node}}{\sum S} \times R_{block}$
- **인센티브**: 스테이킹 수량이 많을수록, 가동 시간이 길수록 지수적으로 유리 (Performance Multiplier 적용)

### 1.3 Agent Node (GPU/Paymaster 서비스)
- **목적**: AI 추론 및 dApp 가스 지원 (리소스 기여)
- **보상 구조**: **기본 가용성 보상 + 사용량 기반 수수료(Usage Fee)**
- **수식**: $R_{agent} = B_{base} + \sum (Fee_{service} \times 0.8)$
- **특징**: 서비스 매출의 80%를 노드 운영자에게 배분, 20%는 네트워크 프로토콜 수익으로 귀속.

### 1.4 Edge Node (스토리지/일반 유저)
- **목적**: 분산 스토리지 및 로컬 검증
- **보상 구조**: 증명 기반 마이크로 보상 (Proof of Contribution)
- **수식**: $R_{edge} = \frac{Data_{stored} \times Traffic_{in/out}}{Total_{resource}} \times R_{pool}$
- **특징**: 가동 시간이 불규칙하더라도 실제 기여한 리소스 양에 따라 실시간 정산.

---

## 2. 슬래싱 파라미터 (Slashing Parameters)

네트워크 안정성을 해치는 행위에 대한 패널티 구조입니다.

| 구분 | 대상 노드 | 위반 사례 | 패널티 (Slashing) |
| :--- | :--- | :--- | :--- |
| **Liveness Break** | Authority/Consensus | 24시간 이상 오프라인 | 스테이킹 원금의 1% 삭감 |
| **Double Signing** | Consensus | 동일 블록 중복 서명 | 스테이킹 원금의 5% 삭감 및 영구 퇴출 |
| **SLA Default** | Agent | GPU 서비스 요청 거부율 > 10% | 당월 서비스 보상 전액 몰수 |
| **Data Loss** | Edge | 복제본 손실 미복구 | 해당 데이터 관련 보상 계수 0으로 조정 |

---

## 3. Agent 노드 수수료 공유 모델 (Paymaster)

Grand Paymaster와 연결된 Agent 노드의 수익 구조입니다.

### 3.1 수수료 구성
- **L1 Gas Cost**: 실제 Vision Chain 트랜잭션 비용.
- **Service Surcharge**: dApp 파트너에게 부과하는 추가 서비스 요금 (예: 15-20%).
- **Protocol Take-rate**: 네트워크 유지 보수를 위한 재단 귀속분 (5%).

### 3.2 배분 로직 (Settlement)
1. User/dApp이 $TotalFee$ 지불.
2. $L1 Gas$ 실비 정산 (Validator에게 지급).
3. 남은 $Surcharge$ 중:
   - **75%**: 서비스를 실제 수행한 Agent 노드에게 지급.
   - **25%**: VCN 소각(Burn) 또는 에코시스템 펀드로 적립.

---

## 4. 로드맵 (V2.1 연결)
- **Dynamic Pricing**: 네트워크 부하에 따른 리소스 가격 자동 조절 알고리즘 탑재.
- **Grand Paymaster 통합**: Admin Dashboard에서 실제 수익금 출금 및 정산 현황 확인 기능 추가.
