# Vision Chain Testnet v2 (IP-based) vs simplyFi 환경 비교 및 고도화 항목

본 문서는 simplyFi가 제공한 테스트넷(`3151908`)과 비교하여, 우리가 자체 구축한 테스트넷(`3151909`)의 부족한 점을 분석하고 즉각적인 고도화가 필요한 항목을 정의합니다.

---

## 1. 정밀 기술 격차 분석 (Gap Analysis)

| 분석 항목 | simplyFi (`3151908`) | **Vision v2 (`3151909`)** | **상태/보완 필요 사항** |
| :--- | :--- | :--- | :--- |
| **보안 프로토콜** | **HTTPS (SSL)** 적용 | HTTP (비보안) | **[개선중]** `setup_rpc_secure.sh` 스크립트 구축 완료 |
| **접속 주소** | 도메인 (`bk.simplyfi.tech`) | IP (`46.224.221.201`) | **[고도화]** `rpc.visionchain.co` 도메인 연동 대기 |
| **EVM 호환성** | 표준 EVM (Geth 기반) | Kafka-Engine v2 | **[우위]** 가용성 모니터링 및 Failover 로직 적용 완료 |
| **지갑 편의성** | 수동 등록 중심 | **MetaMask 원클릭** | **[완료]** 사용자 온보딩 UX 대폭 강화 |
| **추상화/계정** | 미지원 (일반 EOA) | **Paymaster (AA)** | **[우위]** Gasless Hub 대시보드 개발 완료 |
| **브릿지(L1-L2)** | 표준 Bridge 제공 | **Bridge UI** 제공 | **[완료]** 시각적 전송 도구 및 상태 추적 기능 탑재 |

---

### **Task 1: 'Add to MetaMask' 원클릭 연동 (완료)**
*   `Testnet.tsx`에 메타마스크 자동 등록 완료.

### **Task 2: 크로스체인 브릿지(Bridge) 대시보드 구축 (완료)**
*   `/bridge` 페이지 신설 및 사용자 전송 인터페이스 구현 완료.

### **Task 3: 페이마스터(Paymaster) 프로토콜 통합 (완료)**
*   `/paymaster` 대시보드 및 가스 대납 시각화 기능 구현 완료.

### **Task 4: RPC 가용성 및 성능 고도화 (완료/진행)**
*   **실시간 헬스 체크**: 프론트엔드에서 RPC 상태 상시 모니터링.
*   **클라이언트 Failover**: `ContractService`에서 장애 발생 시 예비 노드 자동 전환.
*   **보안 자동화**: SSL/HTTPS 적용을 위한 `setup_rpc_secure.sh` 스크립트 작성 완료.

---

## 3. 실행 계획
1.  **즉시 실행**: `Testnet.tsx`에 MetaMask 원클릭 추가 버튼 구현.
2.  **이어서 실행**: VisionScan 내에 'Bridge' 및 'Paymaster' 상태 확인 페이지 및 기능 추가.
