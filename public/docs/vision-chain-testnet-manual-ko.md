# Vision Chain 테스트넷: 단계별 가이드 (v2)

이 매뉴얼은 세계 최초의 AI 에이전틱 블록체인인 **Vision Chain Testnet v2**에서 애플리케이션을 구축, 배포 및 검증하는 방법을 안내합니다.

---

## 🏁 입문자 코스 (코드 없이 시작하기)
개발자가 아니더라도 비전체인 v2를 즉시 경험하고 싶다면 이 경로를 따라오세요.

### 1. 지갑 준비 및 개인키 확인 (MetaMask)
1.  브라우저용 [메타마스크(MetaMask)](https://metamask.io/)를 설치합니다.
2.  새 지갑을 생성하거나 기존 지갑을 로그인하세요.
3.  **개인키(Private Key) 확인 방법**:
    -   메타마스크 상단 계정 이름 클릭 -> **[계정 세부 정보]** 클릭.
    -   **[개인키 내보내기]** 클릭 후 비밀번호 입력.
    -   `0x`로 시작하는 긴 문자열을 안전하게 보관하세요 (개발 시 필요).

### 2. 비전체인 v2 네트워크(VCN) 등록하기
지갑에 VCN 네트워크를 수동으로 추가해야 잔액 확인 및 전송이 가능합니다.
1.  메타마스크 실행 -> 상단 네트워크 선택 클릭 -> **[네트워크 추가]** -> **[네트워크 수동 추가]** 클릭.
2.  아래 정보를 그대로 복사해서 넣으세요:
    -   **네트워크 이름**: Vision Testnet v2
    -   **새 RPC URL**: `https://rpc.visionchain.co`
    -   **체인 ID**: `1337`
    -   **통화 기호**: `VCN`
    -   **블록 탐색기 URL**: `https://www.visionchain.co/visionscan`
3.  **[저장]** 버튼을 누르면 메타마스크에 VCN 아이콘과 잔액이 표시됩니다.

### 3. 생태계 체험하기
1.  **VCN 받기**: [테스트넷 허브](https://www.visionchain.co/testnet)를 방문하여 첫 10,000 VCN을 요청하세요.
2.  **전송 및 검증**: 소량의 VCN을 친구나 다른 지갑으로 보내본 후, [VisionScan](https://www.visionchain.co/visionscan)에서 본인의 지갑 주소를 검색하여 **AI가 자동 생성한 회계 장부(Accounting)**를 확인해보세요.
3.  **실시간 트레픽 구경**: [Traffic Simulator](https://www.visionchain.co/trafficsim)에 접속하여 실제 AI 에이전트들이 소통하는 모습을 실시간으로 구경하세요.

---

## 🛠️ 개발자 코스 (기술 연동 가이드)
비전체인 위에서 서비스를 구축하려는 엔지니어는 아래 단계를 진행하세요.

---

## Step 1: 네트워크 설정
테스트넷과 상호작용하려면 지갑이나 개발 환경(Hardhat/Foundry)에 다음 설정을 추가하세요.

-   **RPC URL**: `https://rpc.visionchain.co` (Cluster Gateway)
-   **Chain ID**: `1337`
-   **Currency Symbol**: `VCN`
-   **Cluster Status**: 5 Nodes Active (1 RPC + 4 Validators)

---

## Step 2: 테스트넷 VCN 획득 (Faucet)
가스비 지불을 위해 VCN이 필요합니다.
1.  **테스트넷 허브**: `https://www.visionchain.co/testnet`에 접속합니다.
2.  **Request Faucet**을 클릭하세요.
3.  공유 시퀀서를 통해 즉시 잔액이 업데이트되며, 5개 노드 합의 레이어에 동기화됩니다.

---

## Step 3: 초고속 트랜잭션 제출 (v2 Sequencer API)
v2 아키텍처는 마이크로초 단위의 처리를 위해 전통적인 멤풀을 우회할 수 있습니다. 공유 시퀀서 API를 사용하여 회계 메타데이터와 함께 트랜잭션을 제출하세요.

### 1. 트랜잭션 빌드
`ethers.js` 또는 `web3.js`를 사용하여 표준 EVM 트랜잭션을 빌드하고 서명합니다.

### 2. RPC 게이트웨이로 제출
브로드캐스트 대신 비전체인 게이트웨이로 직접 전송하세요:
-   **엔드포인트**: `POST https://api.visionchain.co/rpc/submit`
-   **요청 바디**:
    ```json
    {
      "chainId": 1337,
      "signedTx": "0xSIGNED_DATA",
      "type": "A110",
      "metadata": {
        "method": "Transfer",
        "counterparty": "Merchant-A",
        "taxCategory": "VAT-Standard"
      }
    }
    ```

---

## Step 4: VisionScan에서 회계 데이터 확인
제출된 트랜잭션의 회계적 영향력을 즉시 확인할 수 있습니다:
1.  **VisionScan**: `https://www.visionchain.co/visionscan` 접속.
2.  트랜잭션 해시(Hash) 검색.
3.  **Accounting** 탭을 확장하여 확인:
    -   AI 엔진이 자동 생성한 **분개장(Dr/Cr)** 내역.
    -   적용된 **세금 카테고리(Tax Category)**.
    -   **AI 신뢰도 점수**.

---

## Step 5: 컨트랙트 배포 (Hardhat 예시)
비전체인은 EVM 호환 체인이므로 기존 방식과 동일하게 배포할 수 있습니다.

1.  **`hardhat.config.js` 설정**:
    ```javascript
    module.exports = {
      networks: {
        vision: {
          url: "https://rpc.visionchain.co",
          accounts: [YOUR_PRIVATE_KEY]
        }
      }
    };
    ```
2.  **배포 실행**:
    ```bash
    npx hardhat run scripts/deploy.js --network vision
    ```

---

## Step 6: 인터랙티브 트래픽 시뮬레이터 & 부하 테스트
**Vision Traffic Simulator v2**는 애플리케이션의 성능을 실시간으로 테스트할 수 있는 인터랙티브 환경을 제공합니다.

### 1. 시뮬레이션 세션 실행
1.  **시뮬레이터 접속**: `https://www.visionchain.co/trafficsim`
2.  **세션 초기화**: **[Initialize Session]** 버튼을 클릭하여 트래픽 생성을 시작합니다. **[Session Limit]**(예: 500 TX)을 설정하여 자동으로 멈추게 할 수 있습니다.
3.  **실시간 트랜잭션 주입**: 단순한 UI 모킹이 아니라, 시뮬레이터가 **일회용 지갑(Ephemeral Wallet)**을 생성하고 실제 서명된 트랜잭션을 시퀀서에 제출합니다.
4.  **TPS 조절**: 슬라이더나 프리셋(**Low, Medium, High, Max**)을 사용하여 주입 속도를 조절하세요 (최대 100+ TPS).

### 2. 고급 메타데이터 토글
AI 엔진이 복잡한 회계 데이터를 어떻게 처리하는지 확인하려면 다음 토글을 활성화하세요:
-   **Accounting Metadata**: 상세 분개장 및 세금 분류 데이터를 트랜잭션에 첨부합니다.
-   **Cross-Chain Route**: 체인 간 자산 이동 컨텍스트를 시뮬레이션합니다.
-   **ZK-SNARK Proof**: 프라이버시 보호 검증 테스트를 위한 합성 영지식 증명 데이터를 추가합니다.

### 3. 개발자 오버라이드 (Developer Overrides)
**Deployment Parameters** 패널을 사용하여 특정 컨트랙트에 트래픽을 집중시킬 수 있습니다:
-   **Target Contract**: 본인이 배포한 컨트랙트 주소를 입력하세요.
-   **Custom Method**: 시뮬레이터가 호출할 함수 시그니처를 정의하세요.
-   **Protocol Choice**: `A110`, `S200`, `B410`, `R500` 중 선택하여 다양한 트랜잭션 유형을 테스트하세요.

---

## Step 7: 검증 및 대시보드 모니터링
-   **Live Feed**: 시뮬레이터의 **Live Execution Feed**에서 즉각적인 피드백을 확인하세요.
-   **VisionScan**: 피드의 **External Link** 아이콘을 클릭하여 **VisionScan**에서 즉시 검증할 수 있습니다.
-   **Admin Dashboard**: `https://www.visionchain.co/adminsystem`에서 **Cluster Load Factor** 및 **Consensus Efficiency** 등 클러스터 성능을 확인하세요.

---

## 🛠️ 트러블슈팅 (Troubleshooting)

### Mixed Content Blocking (트랜잭션이 보이지 않을 때)
올바른 네트워크에 연결되어 있음에도 VisionScan에서 트랜잭션이 보이지 않거나 오프라인으로 표시되는 경우:
-   **원인**: 사이트는 HTTPS를 사용하지만, 현재 테스트넷 API는 HTTP를 사용하고 있어 브라우저가 보안상 연결을 차단(Mixed Content)하는 것입니다.
-   **해결 방법 (Chrome/Edge)**:
    1. 주소창 왼쪽의 **자물쇠(또는 설정) 아이콘**을 클릭합니다.
    2. **[사이트 설정]**을 클릭합니다.
    3. **"안전하지 않은 콘텐츠(Insecure content)"** 항목을 찾아 **"허용(Allow)"**으로 변경합니다.
    4. 페이지로 돌아와 **새로고침**합니다.

---

**지원**: 개발자 Discord에 참여하거나 엔지니어링 팀에 문의하여 커스텀 API 훅을 요청하세요.

---

## Step 8: 크로스체인 브릿지 (Bridge)
비전 체인 v2는 타 블록체인과의 자산 상호운용성을 지원합니다.

1.  **자산 입금 (L1 → L2)**: 메타마스크에서 이더리움 테스트넷(Sepolia 등)의 자산을 비전 체인 입금 주소로 전송합니다.
2.  **자산 출금 (L2 → L1)**: 비전 체인 내 브릿지 기능을 통해 자산을 다시 외부 체인으로 반환합니다. 
3.  **검증**: 모든 이동 내역은 **VisionScan**의 Bridge 탭에서 실시간으로 추적 및 증명됩니다.
