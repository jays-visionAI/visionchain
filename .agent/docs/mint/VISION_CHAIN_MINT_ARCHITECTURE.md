# Vision Chain "Omni-Mint" Platform 기획 설계서

## 1. 플랫폼 개요 (Platform Overview)
Vision Chain **"Omni-Mint"** 플랫폼은 전문적인 개발 지식이 없는 일반 유저도 손쉽게, 그리고 **멀티체인(Multi-chain) 생태계**를 아우르는 스마트 컨트랙트를 발행 및 관리할 수 있게 해주는 No-code/AI-assisted 토큰 발행 스튜디오입니다.

* **초핵심 기능 (Killer Feature):** 유저가 단일(EVM) UI로 스펙을 선택하면, **AI가 타겟 체인(POL, BNB, SOL, APT)의 네이티브 언어(Solidity, Rust, Move)로 자동 컨버전(Conversion)** 합니다.
* **타겟 사용자:** 코딩을 모르는 크리에이터, 커뮤니티 리더, 중소기업, 밈 코인 기획자, RWA 발행자

---

## 2. 지원 토큰 스펙 (VRC Standards - 세분화)

트렌드를 반영하여 기존 3가지(FT, NFT, 멀티) 위에 최근 시장 수요가 높은 규격들을 추가했습니다. 이 모든 규격은 **비전체인 내부 명칭인 VRC**로 브랜딩됩니다.

### **① VRC-20 (일반 암호화폐 / Standard FT)**
* **용도:** 거버넌스, 유틸리티, 밈 코인, 플랫폼 포인트
* **특징:** 표준 ERC-20 호환.
* **핵심 옵션:** Mintable, Burnable, Pausable, Capped(최대 한도), Permit(가스리스)

### **② VRC-721 (단일 고유 자산 / Standard NFT)**
* **용도:** PFP, 멤버십, 아트, 1:1 고유 자산
* **특징:** 표준 ERC-721 호환.
* **핵심 옵션:** Auto-Increment ID, URI Storage, Enumerable(온체인 추적), Royalty(EIP-2981)

### **③ VRC-1155 (멀티 토큰 / FT+NFT Hybrid)**
* **용도:** 게임 아이템(동일한 칼 100개 + 고유한 갑옷 1개), 티켓팅
* **특징:** 배치(Batch) 트랜잭션으로 가스비 극강 절약.

### **✨ 최신 트렌드 규격 (New Additions) ✨**

### **④ VRC-404 (유동적 NFT / Semi-Fungible)**
* **기반:** ERC-404 (Pandora 등에서 유행한 최신 표준)
* **용도:** "NFT를 조각내서 팔고 싶다", "FT를 모으면 NFT가 자동 생성되게 하고 싶다"
* **특징:** 토큰 1개를 온전히 모으면 NFT가 자동 민팅되고, 토큰을 0.5개로 쪼개서 팔면 NFT가 소각되는 **하이브리드 유동성 토큰**. 유니스왑 같은 일반 DEX에서 NFT를 거래할 수 있게 만듭니다.

### **⑤ VRC-3643 (RWA / 규제 호환 증권형 토큰)**
* **기반:** ERC-3643 (T-REX Protocol)
* **용도:** 부동산 조각투자, 채권, 실물 연계 자산(RWA)
* **특징:** KYC/AML(신원 인증)을 통과한 지갑끼리만 거래가 가능한 토큰. 법적 규제를 준수해야 하는 기업형 프로젝트의 필수 규격입니다.

### **⑥ Omni-VRC (멀티체인 네이티브 토큰)**
* **기반:** LayerZero OFT (Omnichain Fungible Token) 또는 Chainlink CCIP
* **용도:** 처음부터 체인에 구애받지 않는 글로벌 프로젝트.
* **특징:** 비전체인에서 발행함과 동시에 BNB, POL 등에서도 똑같은 권한을 갖는 브릿지 네이티브 토큰 형태로 발행. 랩핑(Wrapped) 방식의 복잡성을 제거합니다.

---

## 3. 핵심 기능: AI Multi-Chain Conversion (멀티체인 컨버전)

유저가 "VRC-20"의 스펙 옵션을 선택한 후, 타겟 메인넷을 복수 선택하면 플랫폼 내부 AI 엔진이 해당 체인의 패러다임에 맞게 코드를 변환합니다.

| 분류 | 타겟 체인 (Target Chains) | 자동 변환 언어 및 프레임워크 | 변환 및 배포 특징 |
| :--- | :--- | :--- | :--- |
| **EVM 계열** | Vision Chain (기본), Polygon (POL), Base (BASE), BNB Chain (BNB), Avalanche (AVAX) | **Solidity** (OpenZeppelin 호환) | 체인별 가스 최적화 및 EIP 규격 브릿지 어댑터 추가 |
| **Non-EVM 계열** | **Solana (SOL)** | **Rust** (Anchor Framework) | Account Model -> UTXO/PDA(Program Derived Address) 구조로 AI가 데이터 구조 컨버전 |
| **Non-EVM 계열** | **Aptos (APT)**, **Sui (SUI)** | **Move** | Object/Resource 지향적 보안 모델로 소유권(Ownership) 로직 컨버전 |
| **Non-EVM 계열** | **TON (The Open Network)** | **Tact / FunC** | Actor Model 기반의 비동기 메시지 패싱 구조로 스마트 컨트랙트 로직 변환 및 Telegram 연동 지원 |
| **Non-EVM 계열** | **TRON (TRX)** | **Solidity (Tron-specific)** | TVM (Tron Virtual Machine) 환경에 맞춘 에너지(Energy)/대역폭(Bandwidth) 최적화 컴파일 |
| **Non-EVM 계열** | **Sei (SEI)** | **Rust** (CosmWasm 호환) | 오더북 및 트레이딩 최적화 병렬 처리(Parallel Execution)를 고려한 Rust 코드로 변환 |
| **크로스체인 프로토콜** | **Chainlink (CCIP)**, LayerZero | **Solidity** (Router Interfaces) | 체인 간 메시지 전송 및 Omni-Token 발행을 위한 표준 라우터 연동 코드 자동 삽입 |

---

## 4. 토큰 발행 워크플로우 (User Flow)

*일반 사용자가 이해할 수 있는 "쇼핑몰 주문" 같은 경험 제공*

* **Step 1: 토큰 종류 선택 (Choose Standard)**
  * 유저가 직관적인 아이콘으로 VRC-20, VRC-721, VRC-404(하이브리드), RWA 등 템플릿 중 하나를 선택.

* **Step 2: 기본 정보 및 옵션 토글 (Configure Specs)**
  * 토큰명, 심볼, 총 발행량 입력.
  * *기능 토글:* "누가 토큰을 더 찍어낼 수 있나요?", "토큰 전송을 막을 수 있는 비상정지 버튼이 필요한가요?", "매도 시 수수료를 때나요?" 등 **자연어 기반 질문**으로 토글 스위치 조작.

* **Step 3: 멀티체인 선택 (Omni-Chain Extension)**
  * 메인넷 선택: [Vision Chain(필수)] + [Polygon] + [Solana] 등 체크박스 다중 선택.
  * 체크 시, 우측 코드 뷰어에 탭이 생성됨 (Solidity 탭 | Rust 탭).

* **Step 4: AI Copilot 커스터마이징 (Prompt Engineering)**
  * 유저가 챗봇에 입력: *"개발팀 지갑에는 토큰 10%를 할당하고 1년 동안 락업(Lock-up) 시켜줘."*
  * AI가 즉시 Solidity와 Rust 양쪽 코드를 오버라이딩하여 락업 로직을 주입.

* **Step 5: 원클릭 배포 (One-Click Deploy)**
  * 플랫폼 백그라운드에서 선택된 각 체인의 RPC 노드와 통신하여 트랜잭션 전송.
  * Vision Wallet을 통해 각 네트워크의 가스비(혹은 비전체인이 가스 대납 후 VCN 청구)를 결제.

* **Step 6: 관리자 대시보드 (Token Admin Dashboard)**
  * 배포가 완료되면 유저만의 전용 대시보드 생성.
  * **기능:** 각 체인별 유통량 현황, 홀더 분표, "추가 발행(Mint)" 버튼, "에어드랍 툴" 연동 등 배포 이후의 Operation(운영) 기능 제공.

---

## 5. 아키텍처 및 시스템 요구사항 (Technical Requirements)

1. **AI Contract Generator (백엔드):**
   * 유저의 JSON 옵션을 입력받아 체인별 템플릿 엔진을 돌려 기초 코드를 생성하는 모듈. (예: `hbs`, `ejs` 기반의 언어별 뼈대 구축)
2. **AI Translation Layer (변환기):**
   * DeepSeek / Gemini 모델을 활용하여, Solidity 코드를 Anchor(Rust)나 Move 코드로 구문론적 의미를 유지한 채 변환하는 파이프라인. 프롬프트 체이닝을 통한 보안 검수 필수.
3. **Multi-Chain RPC & Provider:**
   * EVM (ethers.js / viem), Solana (@solana/web3.js), Aptos (aptos SDK) 등을 하나의 인터페이스로 묶어 프론트엔드에서 원클릭으로 트랜잭션을 쏠 수 있어야 함. (비전체인 월렛이 멀티체인 서명을 지원하거나 커스텀 서버사이드 지갑 활용)
4. **Code Viewer / Diff Checker (프론트엔드):**
   * Monaco Editor(VSCode 웹버전)를 통합하여, AI가 코드를 수정할 때 변경점(Diff)을 시각적으로 띄워주는 기능.
