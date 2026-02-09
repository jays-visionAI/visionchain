# Vision Chain 지갑 전수 교체 작업 - 진행 현황

## 새 지갑 매핑
| 역할 | 새 주소 |
|------|---------|
| **Vision Chain Admin** | `0xd4FeD8Fe5946aDA714bb664D6B5F2C954acf6B15` |
| **Executor (Paymaster)** | `0x08A1B183a53a0f8f1D875945D504272738E3AF34` (유지) |
| **Sepolia VCN Admin** | `0x4037246AD58327CDf52660b0b199dC8E83d06D82` |
| **Sepolia Relayer** | `0xc6176B597d40f9Db62ED60149FB7625CCa56990b` |

---

## Phase 1: 하드코딩 공용 키 제거 [DONE]
- [x] contractService.ts - adminSendVCN (Paymaster API로 이관)
- [x] contractService.ts - vesting (connected signer 사용)
- [x] contractService.ts - gas estimation (PAYMASTER_ADMIN 사용)
- [x] hardhat.config.js (환경변수)
- [x] 17개 스크립트 파일 (process.env.VISION_ADMIN_PK)
- [x] scripts/fund-executor.cjs (환경변수)

## Phase 2: Vision Chain 컨트랙트 admin 이전 [PENDING]
- [ ] transfer-admin.js 실행 (Vision Chain RPC 접근 필요)
- 11개 컨트랙트의 admin을 0xd4FeD8Fe...로 이전

## Phase 3: Sepolia VCN Token 재배포 [PENDING]
- [x] deploy-sepolia.js 스크립트 수정 완료
- [ ] 유저가 Sepolia VCN Admin PK 제공 → 배포 실행
- [ ] Firebase Secret `VCN_SEPOLIA_ADDRESS` 업데이트
- [ ] Firebase Secret `SEPOLIA_RELAYER_PK` 업데이트 (새 relayer 키)

## Phase 4: Firebase Functions 재배포 [PENDING]
- [ ] Firebase Secrets 업데이트
- [ ] firebase deploy --only functions
