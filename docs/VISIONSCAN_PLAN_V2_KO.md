# VisionScan Testnet v2: 개발 및 기획 가이드 (VisionScan Roadmap & Specification)

본 문서는 **Vision Chain Testnet v2**의 모든 트랜잭션과 블록 생성 히스토리를 추적하고, Etherscan 수준의 상세 내역 및 컨트랙트 확인 기능을 구현하기 위한 기획 자료입니다.

---

## 1. 개요 (Product Overview)
VisionScan은 일반적인 블록 탐색기를 넘어, **"회계 등급(Accounting-Grade)"**의 투명성을 제공하는 AI 에이전틱 블록체인 익스플로러입니다. 테스트넷 모드에서는 모든 테스트 활동(블록 생성, 트랜잭션, 컨트랙트 배포)을 실시간으로 기록하고 상세 분석할 수 있는 환경을 제공합니다.

---

## 2. 하부 페이지 구조 (Information Architecture - Etherscan-Style)

VisionScan은 다음과 같은 계층적 구조를 가집니다.

### 2.1 메인 대시보드 (Home/Stats)
- **실시간 네트워크 지표**: TPS, Block Height, Gas Price, VCN Index.
- **최신 목록**: 최근 생성된 10개의 블록 및 트랜잭션 요약.

### 2.2 블록 관련 페이지 (Blocks)
- **블록 목록 (/blocks)**: 모든 블록 번호, 생성 시간, 트랜잭션 수, 검증자 정보 리스트.
- **블록 상세 (/block/{number})**:
    - **Overview**: 타임스탬프, 가스 사용량, 베이스 가스 피, 해시값.
    - **Transactions**: 해당 블록에 포함된 모든 트랜잭션 리스트.

### 2.3 트랜잭션 관련 페이지 (Transactions)
- **트랜잭션 목록 (/txs)**: 전체 네트워크 트랜잭션 히스토리.
- **트랜잭션 상세 (/tx/{hash})**:
    - **Overview**: Status(성공/실패), Block, From, To, Value, Tx Fee.
    - **AI Journal (Special)**: 회계 기반 분개 내역 (Debit/Credit), 자산 분류, AI 신뢰도 점수.
    - **Logs**: 스마트 컨트랙트 이벤트 로그.

### 2.4 주소 및 컨트랙트 페이지 (Addresses & Contracts)
- **지갑 상세 (/address/{hash})**: 잔액, 트랜잭션 히스토리, 보유 토큰 목록.
- **컨트랙트 상세 (/address/{hash}#code)**:
    - **Code (Verification)**: 솔리디티 소스 코드(검증된 경우), ABI, 바이트코드.
    - **Read Contract**: 컨트랙트 상태 실시간 조회 (owner, balance, totalSupply 등).
    - **Write Contract**: 메타마스크 연결 후 직접 함수 실행 (transfer, mint, settlings 등).

---

## 3. 핵심 기능 요구사항 (Core Requirements)

### 3.1 블록 생성 히스토리 (Block History)
- **목적**: 테스트넷의 안정성과 블록 생성 주기(Block Time) 확인.
- **기능**:
    - 모든 블록의 시퀀싱 순서 기록.
    - 블록당 포함된 AI 에이전트 활동 수 집계.

### 3.2 트랜잭션 히스토리 (Transaction History)
- **목적**: 테스트 중 발생한 모든 액션(VCN 전송, 에이전트 통신)의 추적성 확보.
- **기능**:
    - **Full History**: 테스트 시작 시점부터 현재까지의 모든 TX 보존.
    - **Filter/Search**: 특정 주소나 메소드(e.g., `transfer`) 기반 필터링.

### 3.3 컨트랙트 분석 도구 (Contract Explorer)
- **목적**: 개발자가 배포한 스마트 컨트랙트의 논리 검증 및 상호작용.
- **기능**:
    - **ABI UI**: JSON ABI를 시각적인 서식(Form)으로 변환하여 기술 지식 없이도 함수 실행 가능하게 구현.
    - **Event Tracking**: 컨트랙트에서 발생한 `event`들을 실시간으로 감지하여 출력.

---

## 4. 기술 스택 및 데이터 흐름 (Technical Implementation)

- **Backend (Indexer/API)**:
    - Shared Sequencer v2에서 트랜잭션 Raw 데이터 수집.
    - Kafka 또는 PostgreSQL을 사용하여 모든 히스토리 영구 저장.
- **Frontend (Visualizer)**:
    - Solid.js 기반의 고성능 UI.
    - Ethers.js를 사용한 RPC 실시간 연결.
- **Data Flow**:
    `Testnet Node` -> `Sequencer v2` -> `Indexer Service` -> `VisionScan API` -> `User Dashboard`

---

## 5. 향후 로드맵 (Roadmap)

1.  **Phase 1 (History Alpha)**: 블록 및 트랜잭션 전체 리스트 조회 기능 완성. (진행 중)
2.  **Phase 2 (Address Mapping)**: 지갑별 자산 보유량 및 거래 내역 상세 페이지 구현.
3.  **Phase 3 (Contract Beta)**: 컨트랙트 코드 뷰어 및 Read/Write 상호작용 UI 도입.
4.  **Phase 4 (AI Integration)**: 트랜잭션별 AI 회계 감사 결과 상세 리포트 제공.

---
**기획자**: Vision Chain Dev Team
**마지막 업데이트**: 2026. 01. 15
