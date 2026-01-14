# VisionScan Beta 사이트맵 (Sitemap)

이 문서는 기업용 블록체인 탐색기인 **VisionScan Beta**의 구조와 주요 기능을 설명합니다.

---

## 🏗 전체 구조 (Global Structure)

VisionScan은 단일 페이지 애플리케이션(SPA)으로 구성되어 있으며, 사용자의 목적에 따라 크게 두 가지 뷰 모드(View Mode)와 상세 분석용 드로어(Drawer)로 나뉩니다.

### 1. 메인 대시보드 (Dashboard)
- **접속 URL**: `https://visionchain.co/visionscan`
- **주요 기능**:
  - **검색 바 (Search Hero)**: 주소, TX Hash, 블록, 토큰 검색.
  - **네트워크 상태 (Stats)**:
    - VCN 인덱스 가격
    - 네트워크 처리량 (TPS)
    - 최신 블록 높이
    - 가스 비용 (GWEI)
  - **뷰 모드 전환**: 블록체인 뷰 vs 회계 뷰.
  - **저널 내보내기 (Export Journal)**: 전체 거래 내역을 회계 감사용 파일로 추출.

---

## 🧩 뷰 모드 (View Modes)

### A. 블록체인 뷰 (Blockchain View)
*기존의 기술적 블록체인 탐색기 모드입니다.*
- **필터링**: 기본 (모두 보기)
- **표시 데이터**:
  - TX Hash
  - 유형 (Type)
  - 방향 (In/Out)
  - 상대방 (Counterparty)
  - 값 (Value)
  - 시간 (Age)

### B. 회계 뷰 (Accounting View) (🌟 Enterprise Beta)
*재무팀 및 감사인을 위한 특수 모드입니다.*
- **고급 필터링 패널**:
  - **기간**: 최근 24시간, 7일, 30일, 전체.
  - **상대방**: Binance, Uniswap 등 주요 엔티티.
  - **회계 기준**: 현금주의 (Cash) / 발생주의 (Accrual).
  - **신뢰도**: AI 신뢰 점수 (70%+, 90%+).
  - **세무 분류**: 과세 대상, 비과세, 면세.
- **표시 데이터**:
  - **분류 (Taxonomy)**: A110 (이전), S200 (스왑) 등 회계 코드.
  - **총계정원장 영향 (GL Impact)**: 차변(Dr) / 대변(Cr) 분개 미리보기.
  - **감사 상태 (Audit Status)**: 태그됨(Tagged), 입증됨(Attested).
  - **신뢰도 (Confidence)**: AI가 산출한 분류의 정확도.

---

## 🔍 상세 분석 드로어 (Transaction Drawer)

트랜잭션을 클릭하면 우측에서 슬라이드되어 나타나는 상세 분석 패널입니다.

### 1. 개요 (Overview)
- 트랜잭션 기본 정보 (Hash, Status, Timestamp).
- **분류 (Classification)**: 거래 유형 및 분류 근거.
- **AI 신뢰도 점수 그래프**.

### 2. 회계 (Accounting)
- **분개장 미리보기 (Journal Preview)**:
  - 차변 (Debit): 계정 과목 및 금액.
  - 대변 (Credit): 계정 과목 및 금액.
- **수수료 및 비용 (Fees & Costs)**: 가스비 및 프로토콜 수수료 분리.

### 3. 경로 (Path)
- **크로스체인 경로 시각화**: Origin Chain -> Relay -> Destination Chain의 자산 이동 경로 추적.

### 4. 증거 (Evidence)
- **암호학적 증명**: 영지식 증명(ZK Proof) 또는 서명 데이터.
- **증거 해시 (CID)**: 위변조 불가능한 감사 추적용 해시.

### 5. 감사 로그 (Audit Log)
- 해당 트랜잭션에 대한 시스템 및 사용자의 작업 이력 (분류, 태그 수정 등).

---

## 📤 내보내기 모달 (Export Modal)

- **형식 선택**:
  - CSV (일반 원장)
  - XBRL-GL (재무 보고용 표준)
  - JSON-LD (데이터 연동)
  - ERP Direct Sync (SAP/NetSuite 연동 - 예정)
- **보안**: 감사 증거 포함 여부 선택.
