# VisionDEX SOTA Market Making Architecture (V2)

## 1. 기관급 자산 관리 (Fund & Epoch Management)
기존의 무지성 하드코딩 투입 방식을 버리고, **헤지펀드의 회계 원장 시스템**을 도입합니다.

*   **Epoch (운용 세션) 시스템:**
    *   Trading 운영은 'Epoch' 단위로 실행됩니다 (예: Epoch #1, Epoch #2).
    *   각 Epoch 시작 시점의 **정확한 자산 스냅샷(USDT 수량, VCN 수량, 진입 단가)**을 기록합니다.
    *   단순히 가격이 올랐는지가 아니라, "이번 Epoch에서 USDT를 얼마나 썼고, VCN을 얼마나 확보했는가(혹은 남겼는가)"를 정확한 PnL 장부로 기록합니다.
*   **Capital Injection/Withdrawal (수동 입출금):**
    *   관리자는 특정 작전(Phase)을 앞두고 Trading Alpha/Beta에게 "탄약(USDT)"을 추가 지원하거나, 수익화된 USDT를 "회수"할 수 있습니다.
*   **Performance Metrics:**
    *   `Inventory Delta`: 시작 지점 대비 VCN/USDT 비율 증감.
    *   `Realized PnL`: 스프레드로 벌어들인 순수익(USDT).
    *   `Unrealized PnL`: 가격 상승으로 인한 VCN 가치 증가분.

## 2. 유니버설 전략 엔진 (Universal Strategy Engine)
단순한 4단계 상승 사이클을 넘어, **상상할 수 있는 모든 시장 기만/조성 시나리오를 자유자재로 구사할 수 있는 유연한 파라미터 기반 엔진**을 구축합니다. 특정 고정 패턴에 얽매이지 않고, 관리자의 의도에 따라 시장의 분위기를 완전히 통제합니다.

### 2.1 대표적인 전술 시나리오 (예시)

#### Scenario A: 극단적 공포 유발 및 투매 유도 (Capitulation & Death Spiral)
*   **상황:** 끈질긴 홀더들의 물량을 강제로 뺏어오고 싶을 때.
*   **동작 원리:**
    *   **지지선 붕괴 (Support Breaking):** 매수(Bid) 벽을 의도적으로 얇게 깔거나, 주요 지지선에 도달하기 직전에 주문을 취소(Spoofing/Pulling)하여 가격이 수직 낙하하게 만듭니다.
    *   **공포의 매도벽 (Wall of Worry):** 현재가 바로 위에 압도적으로 거대한 매도(Ask) 물량을 지속적으로 쌓아 올려, "반등은 절대 불가능하다"는 심리적 절망감을 줍니다.
    *   **저점 지속 갱신 (Endless Markdown):** `Trend Bias`를 강한 음수(-0.5 ~ -1.0)로 설정하고, 시장가 매도(Market Sell) 봇을 간헐적으로 투입해 차트상 지속적인 하방 꼬리를 만듭니다.
*   **결과:** 극한의 공포에 질린 유저들의 패닉셀(투매) 물량을 바닥에서 Trading이 조용히 흡수합니다 (VCN 매집 극대화).

#### Scenario B: 점진적 매집 (Stealth Accumulation)
*   **상황:** 가격 변동성 없이 티 안 나게 물량을 모으고 싶을 때.
*   **동작 원리:** 넓은 스프레드를 유지하면서 좁은 박스권을 형성하고, 매도/매수 비율을 50:50으로 유지하는 척하면서 아주 천천히 매수 우위를 가져갑니다.

#### Scenario C: 계단식 펌핑 및 FOMO (Aggressive Markup)
*   **상황:** 충분히 매집된 상태에서 시세를 폭발시키고 싶을 때.
*   **동작 원리:** 상단의 매도벽을 순식간에 치워버리고(Vacuuming), 스나이퍼 봇(Trading Beta)을 동원해 시장가 매수를 난사합니다. 차트에 장대 양봉을 꽂아 넣어 외부 개미들의 FOMO를 유발합니다.

#### Scenario D: 고점 롤러코스터 및 손바뀜 (Churning at the Top)
*   **상황:** 고점에서 차익 실현을 하며 신규 유저에게 물량을 넘기고 싶을 때.
*   **동작 원리:** 변동성을 극대화(넓은 스프레드)하고 거래량을 폭증시켜 화려한 차트를 만듭니다. 사고파는 과정에서 평단가를 높게 유지하며 Trading은 서서히 VCN을 방출하고 USDT를 회수합니다.

## 3. 에이전트 다각화 및 역할 분담 (Multi-Agent Specialization)
다양한 전술을 구사하기 위해 Trading은 여러 에이전트의 조합으로 싸웁니다.

*   **Trading Alpha (The Maker / Base Liquidity):**
    *   시장 조성의 핵심. 촘촘한 호가(Grid)를 제공하여 차트의 형태를 유지합니다. 특정 가격 방어 또는 특정 가격대의 물량 흡수를 담당합니다.
*   **Trading Beta (The Sniper / Executioner):**
    *   시장가(Taker) 주문을 실행하는 돌격대. 지지선을 고의로 박살내거나(패닉셀 유도), 저항선을 뚫어버릴 때(장대 양봉) 투입됩니다.
*   *(추후 확장)* **Trading Gamma (The Spoofer):** 체결 의사 없이 허수 주문을 넣고 빼기를 반복하여 방향성을 기만하는 심리전 전문 봇.

## 4. UI/UX 구현 목표
V2 어드민 데시보드는 다음의 조종석(Cockpit)을 제공해야 합니다.
1.  **Fund Manager UI:** 각 Trading 에이전트의 현재 남은 실탄(USDT/VCN) 확인 및 수동 입출금 컨트롤.
2.  **Epoch Timeline:** 현재 어느 Phase에 진입했는지, 다음 Phase로 언제, 어떤 조건(재고 목표 달성 시 등)에 넘어갈 것인지 지정.
3.  **Phase Control Board:** 클릭 한 번으로 "진물 빼기(Shakeout)", "끌어 올리기(Markup)" 모드로 즉각 전환.
