# AI 인텐트(의도) 시나리오 & 기능 정의서

## 1. 핵심 철학: "수취인 중심의 정산 (Receiver-Centric Settlement)"
송금자는 오직 **"누구에게(Who)"**, **"얼마만큼의 가치(Value)"**를 보낼지만 알면 됩니다.
**"어떤 체인으로?"**, **"어떤 토큰으로?"**, **"어떻게 보낼지?"**는 AI가 수취인의 온체인 프로필(Vision ID)을 분석하여 자동으로 결정합니다.

---

## 2. 시나리오 분류 (Scenario Classification)

### 카테고리 A: 직접 정산 (기본 기능)
1.  **단순 송금 (Direct Send)**: "@jays에게 10 VCN 보내줘."
    - *AI 해결*: @jays의 지갑 주소(0x123...)를 조회 -> VCN 전송 트랜잭션 생성.
2.  **크로스체인 브릿지 (Bridge)**: "내 자산을 이더리움으로 옮겨줘."
    - *AI 해결*: 현재 Vision 체인의 VCN 보유량 확인 -> Ethereum 체인으로 브릿징 실행.

### 카테고리 B: 선호 기반 자동 스왑 (핵심 기능)
*사용자가 정의한 "킬러 기능"입니다.*

3.  **자동 정산 (Auto-Settlement)**: "@alice에게 100 USDC 보내줘."
    - *상황*: @alice는 자신의 수취 선호 자산을 **WBTC**로 설정해둠.
    - *AI 해결*:
        1. @alice 프로필 조회 -> 선호 자산: WBTC (Vision Chain).
        2. 경로 생성: 송금자(USDC) -> Uniswap(WBTC로 스왑) -> 수취인(@alice).
    - *사용자 경험*: "100 USDC를 보냅니다..." -> "Alice의 선호에 맞춰 0.00x WBTC로 자동 변환하여 전송했습니다."

4.  **크로스체인 자동 정산 (Cross-Chain Auto-Settlement)**: "내 폴리곤 자산으로 @bob에게 50달러 줘."
    - *상황*: @bob은 Vision 체인에 있고 VCN을 원함. 송금자는 Polygon에 USDC만 있음.
    - *AI 해결*:
        1.  송금자 (Polygon USDC) -> LayerZero/Stargate -> Vision (USDC).
        2.  Vision (USDC) -> 스왑 -> Vision (VCN).
        3.  @bob에게 입금.

### 카테고리 C: 복합 로직 (전문가 기능)
5.  **다중 전송 (Multi-Send)**: "@team_alpha 멤버들에게 100 VCN을 균등하게 나눠줘."
    - *AI 해결*: @team_alpha 그룹 조회 -> 멤버 리스트 확보 -> 배치 전송(Batch Transfer) 실행.
6.  **스트리밍 지불 (Stream Payment)**: "@worker에게 앞으로 30일 동안 1000 VCN을 줘."
    - *AI 해결*: Sablier 스타일의 베스팅(Vesting) 컨트랙트 배포 및 실행.
7.  **가스비 대납 (Gasless Delegation)**: "ETH가 없는데 이 USDC를 @charlie한테 보내고 싶어."
    - *AI 해결*: `VCNPaymaster`를 호출하여 USDC로 가스비를 대신 내고 전송(Permit 서명).

---

## 3. 필요 아키텍처 업그레이드 (Required Upgrades)

이 "모든 가능성"을 지원하기 위해 다음 요소들이 필요합니다:

1.  **Vision 프로필 레지스트리 (On-Chain DB)**
    - 맵핑: `VID` (@name) -> `지갑주소` + `선호체인` + `선호토큰`.
2.  **인텐트 솔버 (Intent Solver / AI Agent)**
    - 단순 경로가 아니므로, AI가 시뮬레이션(Pathfinding)을 통해 최적 경로(브릿지->스왑->전송)를 찾아야 함.
3.  **유니버셜 리졸버 (Universal Resolver Contract)**
    - [스왑 + 브릿지 + 전송]을 하나의 트랜잭션으로 원자적(Atomically)으로 실행하는 스마트 컨트랙트.
