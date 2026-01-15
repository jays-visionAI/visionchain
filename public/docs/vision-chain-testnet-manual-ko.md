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
    -   **새 RPC URL**: `http://46.224.221.201:8545`
    -   **체인 ID**: `1001`
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

-   **RPC URL**: `http://46.224.221.201:8545`
-   **Chain ID**: `1001`
-   **Currency Symbol**: `VCN`

---

## Step 2: 테스트넷 VCN 획득 (Faucet)
가스비 지불을 위해 VCN이 필요합니다.
1.  **테스트넷 허브**: `https://www.visionchain.co/testnet`에 접속합니다.
2.  **Request Faucet**을 클릭하세요.
3.  공유 시퀀서를 통해 즉시 잔액이 업데이트됩니다.

---

## Step 3: 초고속 트랜잭션 제출 (v2 Sequencer API)
v2 아키텍처는 마이크로초 단위의 처리를 위해 전통적인 멤풀을 우회할 수 있습니다. 공유 시퀀서 API를 사용하여 회계 메타데이터와 함께 트랜잭션을 제출하세요.

### 1. 트랜잭션 빌드
`ethers.js` 또는 `web3.js`를 사용하여 표준 EVM 트랜잭션을 빌드하고 서명합니다.

### 2. RPC 게이트웨이로 제출
브로드캐스트 대신 비전체인 게이트웨이로 직접 전송하세요:
-   **엔드포인트**: `POST http://46.224.221.201:3000/rpc/submit`
-   **요청 바디**:
    ```json
    {
      "chainId": 1001,
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
          url: "http://46.224.221.201:8545",
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

## Step 6: 부하 테스트 및 커스텀 시나리오
정적인 시뮬레이터와 달리, 비전체인은 본인의 컨트랙트를 테스트하기 위한 **커스텀 트래픽** 주입이 가능합니다.

### 1. 대시보드 설정 (UI)
1.  **Simulator**: `https://www.visionchain.co/trafficsim` 접속.
2.  **Developer Override** 패널에 본인의 **컨트랙트 주소**와 **함수 이름**을 입력합니다.
3.  목표 **TPS**를 설정하세요. 시뮬레이터가 해당 컨트랙트와의 상호작용을 우선적으로 생성합니다.

### 2. 자체 환경 구축 (CLI)
로컬 테스트 수트(Hardhat/Foundry)를 시뮬레이터와 연결할 수 있습니다:
1.  시퀀서 API를 사용하여 스크립트에서 트래픽 루프를 초기화합니다.
2.  트랜잭션에 특정 `appId` 또는 `metadata.context`를 태깅하세요.
3.  TrafficSim의 **라이브 피드**가 메타데이터를 기반으로 해당 트래픽을 자동으로 감지하고 라벨링합니다.

---

**지원**: 개발자 Discord에 참여하거나 엔지니어링 팀에 문의하여 커스텀 API 훅을 요청하세요.
