# Vision Bridge Security Upgrade Plan

> **Version**: 1.0  
> **Date**: 2026-01-30  
> **Status**: Draft for Review

---

## Executive Summary

Vision Chain의 크로스체인 브릿지를 **Optimistic + TSS 하이브리드** 모델로 업그레이드하여 보안성을 강화합니다. 기존 설계의 취약점(Firebase 의존, 즉시 Mint, TSS 최종권한)을 해결하고, 단계별 구현을 통해 리스크를 최소화합니다.

---

## 1. 현재 설계의 문제점

### 1.1 치명적 취약점

| 취약점 | 설명 | 심각도 |
|--------|------|--------|
| **Firebase = 합의 레이어** | 오프체인 DB가 진실의 원천(Source of Truth)처럼 작동 | Critical |
| **TSS = 최종 권한** | 3/5 노드 침해 시 즉시 대규모 손실 가능 | Critical |
| **즉시 Mint** | Challenge Period 없이 바로 토큰 발행 | High |
| **zkProof 부재** | 실제 검증 없이 Merkle Proof 수준 | Medium |

### 1.2 유지할 장점

- TSS 3/5 다중서명 (단일 키 유출 방지)
- Emergency Pause 기능 (이미 구현됨)
- Intent 기반 UX 설계 (소액 즉시/대액 지연)

---

## 2. 목표 보안 모델

```
Safety     : No Mint without on-chain Lock proof
Liveness   : Honest majority (3/5) ensures progress
Recovery   : Challenge can revert malicious Mints
Economics  : Slashing makes attacks unprofitable
```

---

## 3. 개선된 아키텍처

### 3.1 핵심 원칙

1. **Firebase는 캐시/인덱스만** - 합의/검증에서 완전 제거
2. **TSS는 조건부 실행자** - 최종 권한 아님, Pending 등록만
3. **Mint는 시간 + 챌린지 통과 후** - Optimistic Finality
4. **온체인 커밋이 진실** - Intent Commitment on-chain

### 3.2 상태 머신

```
User Intent → PENDING (TSS 등록) → Challenge Period
                                         │
              ┌──────────────────────────┴──────────────────────────┐
              ▼                                                     ▼
         CHALLENGED → REVERTED (Challenge 성공)          FINALIZED → Mint
```

---

## 4. Phase 1: Optimistic Bridge MVP (2-3주)

> **목표**: 즉시 Mint를 제거하고 Optimistic Finality 도입

### 4.1 새로 구현할 컨트랙트

#### IntentCommitment.sol
- `commitIntent(bytes32 intentHash, uint256 nonce, uint256 expiry)` - 사용자 Intent 온체인 커밋
- `verifyIntent(bytes32 intentHash, address user)` - Intent 검증

#### MessageInbox.sol
- 상태: `NONE → PENDING → CHALLENGED → FINALIZED/REVERTED`
- `submitPending()` - TSS가 Pending 상태로 등록
- `challenge()` - Challenger가 이의 제기
- `finalize()` - Challenge 기간 후 확정

#### ChallengeManager.sol
- `submitChallenge()` - 챌린지 제출
- `resolveChallenge()` - 챌린지 판정

### 4.2 VisionEqualizerV2 수정사항

| 함수 | 변경 전 | 변경 후 |
|------|---------|---------|
| `lzReceive()` | 즉시 Mint | Pending 등록 |
| `requestTSSMigration()` | 직접 이벤트 | IntentCommitment 확인 |
| 신규 | - | `finalizeMint()` |

### 4.3 시간 파라미터

| 금액 구간 | Challenge Period |
|-----------|------------------|
| < 1,000 VCN | 10분 |
| 1,000 ~ 10,000 VCN | 30분 |
| ≥ 10,000 VCN | 2시간 |

### 4.4 Challenge 조건

- Lock 미존재 (소스체인에 Lock 이벤트 없음)
- Intent 불일치 (intentHash 불일치)
- Nonce 재사용 (중복 Mint 시도)
- Expiry 초과 (만료된 메시지)
- 금액/수신자 변조

---

## 5. Phase 2: 경제적 보안 (4-6주)

> **목표**: Validator 스테이킹/슬래싱으로 경제적 보안 담보

### 5.1 새로 구현할 컨트랙트

#### ValidatorSet.sol
- Validator 최소 스테이크: **10,000 VCN**
- `stake()`, `unstake()`, `rotateValidator()`

#### SlashingVault.sol
- `slash()` - 슬래싱 실행
- `distributeReward()` - Challenger 보상

### 5.2 슬래싱 조건

| 조건 | 슬래싱 비율 |
|------|-------------|
| 허위 메시지 서명 | 100% |
| 이중 서명 | 50% |
| 정책 위반 | 20% |
| 비활성 | 5%/월 |

### 5.3 Challenger 인센티브
- 성공 시: 슬래싱 금액의 **30%**
- 실패 시: 예치금(0.1 ETH) 몰수

---

## 6. Phase 3: 고급 보안 (연기됨)

### 6.1 연기된 항목 및 사유

| 항목 | 연기 사유 | 예상 시기 |
|------|-----------|-----------|
| **zk-Light-Client** | 회로 개발 복잡도 극히 높음 (수백만 게이트). 개발 비용 $100K+. 증명 생성 분~시간 소요. | 6개월+ |
| **Validator 로테이션** | DKG/Reshare 프로토콜 구현 필요. 기존 서명 호환성 문제. | 3개월+ |
| **Key Resharing** | TSS 키 재생성 복잡. 운영 리스크 증가. | 3개월+ |
| **HSM/TEE** | 하드웨어 비용 노드당 $5K-$10K. 클라우드 HSM 월 $500+/노드. | 6개월+ |
| **퍼미션리스 Challenger** | 초기에는 스팸 공격 방지를 위해 화이트리스트 필요. | 2개월+ |

### 6.2 대안

| 연기 항목 | Phase 1 대안 |
|-----------|--------------|
| zk-Light-Client | Merkle Proof + TSS 다중서명 |
| Validator 로테이션 | 고정 5노드 + 수동 교체 Runbook |
| HSM/TEE | AWS KMS + 정책 엔진 |
| 퍼미션리스 Challenger | 화이트리스트 Challenger (운영팀 + 파트너) |

---

## 7. 구현 체크리스트

### Phase 1 (MVP) - 2-3주
- [ ] IntentCommitment.sol
- [ ] MessageInbox.sol (상태 머신)
- [ ] ChallengeManager.sol
- [ ] VisionEqualizerV2 수정
- [ ] EIP-712 메시지 스키마
- [ ] 테스트넷 배포
- [ ] Bridge UI 업데이트
- [ ] 화이트리스트 Challenger

### Phase 2 (경제적 보안) - 4-6주
- [ ] ValidatorSet.sol
- [ ] SlashingVault.sol
- [ ] Challenger 인센티브
- [ ] 슬래싱 모니터링

### Phase 3 (연기) - 장기
- [ ] zk-light-client 연구
- [ ] Validator 로테이션
- [ ] HSM 통합

---

## 8. 결론

Vision Bridge 보안 업그레이드는 **3단계**로 진행:

| Phase | 목표 | 기간 |
|-------|------|------|
| **Phase 1** | Optimistic Finality + Challenge | 2-3주 |
| **Phase 2** | 경제적 보안 (스테이킹/슬래싱) | 4-6주 |
| **Phase 3** | zk 검증 + 완전 탈중앙화 | 장기 |

Phase 1만으로도 현재 설계 대비 **보안 수준이 크게 향상**되며, 즉시 Mint 취약점을 제거합니다.
