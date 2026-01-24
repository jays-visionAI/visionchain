# Vision Chain Testnet v2 사용자 매뉴얼

**버전:** 2.0 (Public Beta)  
**날짜:** 2026-01-15  
**상태:** 라이브 (Live)

---

## 1. 소개 (Introduction)

**Vision Chain Testnet v2**에 오신 것을 환영합니다. 이 환경은 개발자와 사용자가 **AI-Native Layer 1**의 기능을 탐색할 수 있도록 설계되었습니다. 여기에는 높은 처리량을 자랑하는 Kafka 기반의 Shared Sequencer와 독자적인 "Equalizer" 상호운용성 모델이 포함됩니다.

**v2의 새로운 기능:**
*   **퍼블릭 액세스:** 누구나 공개 RPC(`46.224.221.201`)를 통해 접속 가능합니다.
*   **Shared Sequencer:** Redpanda를 통한 1초 미만의 트랜잭션 정렬(Ordering).
*   **AI Oracle:** 네트워크 사용량과 노드 상태에 따른 동적 토크노믹스.

---

## 2. 네트워크 설정 (MetaMask)

테스트넷을 사용하려면, 지갑(예: MetaMask)에 아래의 사용자 정의 네트워크를 추가하세요.

| 항목 | 값 |
| :--- | :--- |
| **네트워크 이름** | `Vision Testnet v2` |
| **RPC URL** | `https://rpc.visionchain.co` |
| **체인 ID** | `1337` |
| **통화 기호** | `VCN` |
| **블록 탐색기** | *(준비 중)* |

> **참고:** 사용자 정의 테스트넷이므로, MetaMask에서 체인 ID가 알려진 네트워크와 일치하지 않는다는 경고가 뜰 수 있습니다. 이는 정상입니다.

---

## 3. 테스트넷 자금 받기 (Faucet)

현재 스팸 방지를 위해 VCN Faucet은 **CLI(명령줄 인터페이스)**를 통해서만 운영됩니다.

### 필수 조건
*   Node.js & NPM 설치
*   Git

### 단계
1.  **저장소 복제** (이미 받았다면 생략):
    ```bash
    git clone https://github.com/VisionChainNetwork/vision-chain.git
    cd vision-chain/blockchain
    ```

2.  **Faucet 스크립트 실행**:
    `YOUR_WALLET_ADDRESS`를 본인의 실제 이더리움 주소(0x...)로 변경하세요.
    ```bash
    USER_ADDRESS=YOUR_WALLET_ADDRESS npx hardhat run scripts/faucet.js --network vision_v1
    ```

3.  **확인**:
    **100,000 VCN**과 가스비용 **10 ETH**가 주소로 전송되었다는 성공 메시지를 확인할 수 있습니다.

---

## 4. 개발자 가이드: 컨트랙트 배포

Vision Chain은 **EVM과 완벽하게 호환**되므로, **Hardhat**, **Foundry**, **Remix**와 같은 표준 도구를 그대로 사용할 수 있습니다.

### Hardhat 설정
`hardhat.config.js` 파일에 Vision Testnet을 추가하세요:

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.28",
  networks: {
    vision_v1: {
      url: "https://rpc.visionchain.co",
      chainId: 1337,
      accounts: ["YOUR_PRIVATE_KEY"] // 이 키를 절대 공유하지 마세요!
    }
  }
};
```

### 배포 예시
표준 ERC-20 또는 기타 Solidity 컨트랙트를 배포합니다:

```bash
npx hardhat run scripts/deploy.js --network vision_v1
```

---

## 5. 고급 기능 (Advanced Features)

### The Equalizer (크로스체인 싱크)
Vision Chain은 자산을 래핑(Wrapping)하거나 소각(Burning)하지 않고 다른 체인에서 "텔레포트"할 수 있게 합니다.
*   **개념:** Chain A에서 자산 잠금 -> Agent가 이벤트 감지 -> Sequencer가 Chain B에 크레딧 지급.
*   **테스트 컨트랙트:** `VisionEqualizer` (주소: `0x5FbDB2315678afecb367f032d93F642f64180aa3`)

### 고속 시퀀서 (High-Speed Sequencer)
1초 미만의 지연 시간이 필요한 자동화된 에이전트의 경우, 표준 RPC 대신 Sequencer API로 서명된 트랜잭션을 직접 전송하세요.
*   **엔드포인트:** `POST https://api.visionchain.co/rpc/submit`
*   **페이로드:** `{ "verified": true, "signedTx": "0x...", "chainId": 1337 }`

---

## 6. 지원 (Support)

문제가 발생하면 다음을 확인하세요:
1.  **서버 상태:** RPC URL에 접속이 가능한지 확인하세요.
2.  **Discord:** #dev-testnet 채널에 참여하세요.
3.  **로그:** 터미널 출력에서 에러 원인(revert reason)을 확인하세요.

*즐거운 개발 되세요!*
