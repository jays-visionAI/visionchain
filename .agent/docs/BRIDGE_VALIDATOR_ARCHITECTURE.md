# Bridge Validator Architecture

## 목적
Ethereum ↔ Vision Chain (VCN) 크로스체인 브릿지의 보안과 분산화를 위한 Validator Staking 시스템

---

## 현재 상태 (v1)

### 구현된 것
| 항목 | 상태 |
|-----|------|
| BridgeStaking 컨트랙트 | O |
| Stake/Unstake/Claim UI | O |
| APY 보상 (12-20%) | O |
| 관리자 펀딩 | O |

### 구현되지 않은 것
| 항목 | 상태 |
|-----|------|
| Validator 노드 등록 | X |
| 스테이커 ↔ Validator 위임 | X |
| 검증 작업 연동 | X |
| 자동 수수료 분배 | X |
| Slashing 자동 트리거 | X |

---

## 핵심 개념

### 두 종류의 Validator
```
블록 Validator (합의)        Bridge Validator (브릿지)
├── 블록 생성               ├── 크로스체인 tx 검증
├── PoA/PoS 합의            ├── 다중 서명
└── Vision Chain 내부       └── Vision ↔ Ethereum
```

### 스테이킹이 보안을 강화하는 방식
1. **담보 제공**: 스테이킹 = 브릿지의 보험금
2. **공격 비용 증가**: 총 스테이킹 > 해킹 이익이면 공격 비합리적
3. **Slashing**: 부정 검증 시 스테이킹 50% 몰수

---

## 제안: 단계별 로드맵

### Phase 1: 중앙화 브릿지 (현재 가능)
```
[Ethereum] ←→ [팀 운영 Validator] ←→ [Vision Chain]
                    ↑
            스테이킹 풀 (담보)
```
- 팀이 단일 Validator 운영
- 스테이커는 담보 제공만
- 빠른 출시 가능

### Phase 2: 허가형 Validators
```
[Ethereum] ←→ [Validator 1, 2, 3...] ←→ [Vision Chain]
                    ↑
            스테이커가 Validator 선택/위임
```
- 검증된 파트너가 Validator 운영
- 다중 서명 (3/5)
- 스테이커가 Validator에 위임

### Phase 3: 완전 분산화
- 누구나 스테이킹 + 노드 운영
- 최고 수준 보안
- 개발 복잡도 높음

---

## 하드웨어 요구사항

### Bridge Validator 노드 (1개)
| 항목 | 최소 | 권장 |
|-----|-----|-----|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16-32 GB |
| SSD | 100 GB | 500 GB NVMe |
| 네트워크 | 100 Mbps | 1 Gbps |
| 월 비용 | ~$50 | ~$120 |

### 권장 구성
- 메인 블록체인 서버와 분리
- 최소 3개 Validator (다른 위치/운영자)

---

## 다음 단계 옵션

### A. Phase 1으로 빠른 출시
- 현재 코드 그대로 사용
- 팀이 Validator 운영
- 스테이킹은 TVL 마케팅용
- **소요: 1-2주**

### B. Phase 2 설계 후 출시
- Validator 등록/위임 컨트랙트 추가
- Bridge 노드 ↔ 컨트랙트 연동
- 다중 서명 구현
- **소요: 4-8주**

---

## 결론

**현재 스테이킹 시스템은 단순 풀이며, 실제 Bridge Validator와 연동되지 않음**

권장: Phase 1으로 먼저 출시하고, 검증된 후 Phase 2로 업그레이드
