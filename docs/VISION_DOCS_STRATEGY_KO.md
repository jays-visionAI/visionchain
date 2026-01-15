# Vision Chain 공식 문서화 전략 및 릴리스 로드맵 (Vision Docs Strategy)

본 문서는 비전체인(Vision Chain)의 기술적 정체성을 확립하고, 개발자 생태계 확장을 위한 공식 문서화(GitBook 스타일) 체계와 릴리스 계획을 정리한 마스터 플랜입니다.

---

## 1. 문서화 철학
*   **Developer-First**: 명확한 코드 예제와 즉시 실행 가능한 Quickstart 제공.
*   **AI-Native Identity**: 전통적인 L1과 차별화되는 'AI 회계 엔진'과 '공유 시퀀서'의 원리 강조.
*   **Trustless Transparency**: 비전스캔(VisionScan)을 통한 데이터 검증 방법론 제시.

---

## 2. 문서 카테고리 구조 (Information Architecture)

### 📂 [Phase 1] Core Concepts (기초 이론)
*   **Vision Chain Overview**: 프로젝트 철학 및 L1 Kafka Engine v2의 이점.
*   **AI Oracle & Accounting**: 실시간 점수 산출 및 분개장 생성 알고리즘.
*   **Tokenomics**: VCN 토큰 경제 구조 및 에이전트 보상 체계.

### 📂 [Phase 2] Developer Guide (실전 개발)
*   **Quickstart**: 5분 만에 첫 트랜잭션 전송하기.
*   **Sequencer API Reference**: 공유 시퀀서 연동 규격.
*   **Accounting Code Spec (A110~D600)**: 업종별 메타데이터 주입 표준.
*   **Smart Contract Deployment**: Hardhat/Foundry 설정 가이드.

### 📂 [Phase 3] Advanced Features (심화 기능)
*   **Paymaster & Account Abstraction (AA)**: 
    - *상태: 기획 중 (구현 후 상세 업데이트 예정)*
    - 가스비 대납 및 사용자 경험 혁신 방안.
    - AI 에이전트 전용 가스 추상화 모델.
*   **Cross-chain Bridge**: L1-L2 자산 전송 및 증명 메커니즘.
*   **Node Operation**: 검증인 노드 구축 및 운영 가이드.

---

## 3. 문서 릴리스 로드맵 (Release Roadmap)

| 단계 | 목표 릴리스 항목 | 일정 | 비고 |
| :--- | :--- | :--- | :--- |
| **Stage 1** | 테스트넷 v2 종합 매뉴얼 (KR/EN) | 2026.01.15 | 완료 및 배포 중 |
| **Stage 2** | 공유 시퀀서 API 상세 명세서 | 2026.01.20 | 기술 검토 중 |
| **Stage 3** | **Paymaster 구현 및 연동 가이드** | TBD | **페이마스터 작업 후 최우선 반영** |
| **Stage 4** | 공식 기술 백서 (V2 Update) | 2026.02월 초 | |

---

## 4. 관리 지침
*   모든 문서는 Markdown 기반으로 작성하여 관리.
*   `Admin System > Documents` 메뉴를 통해 내부 검토용으로 먼저 릴리스.
*   최종 승인된 문서는 GitBook으로 동기화하여 대외 공개.

---

**보고일**: 2026년 01월 15일
**작성자**: Antigravity AI (on behalf of Vision Chain Team)
