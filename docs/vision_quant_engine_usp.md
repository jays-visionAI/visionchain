# Vision Quant Engine - USP & Selling Points

> **용도**: Notebook LM 인포그래픽 홍보자료 제작용 원본  
> **타깃 오디언스**: 암호자산 자동매매에 관심 있는 20~40대 투자자  
> **톤**: 신뢰감 + 기술력 + 접근성

---

## 1. 제품 한 줄 정의

**"CEX 자산을 연결하고, 검증된 전략을 고르고, 리스크 한도를 설정하면 — AI Agent가 24/7 자동으로 매매합니다."**

---

## 2. 핵심 USP (Unique Selling Propositions)

### USP 1: "전략은 검증, 리스크는 통제"

| 항목 | 내용 |
|------|------|
| 헤드라인 | 수익 극대화가 아니라 **손실 제한이 먼저** |
| 설명 | 암호자산 변동성은 주요 환율의 5~10배. Vision Quant Engine은 전략 자체보다 **손실 제한, 포지션 크기, 중단 규칙**을 우선합니다. |
| 차별점 | 모든 전략에 **Volatility Target Overlay가 기본 적용** — 변동성이 극단적이면 포지션 크기를 0%까지 자동 축소하거나 거래를 중단합니다. |
| 키 메시지 | "변동성이 올라가면, 포지션은 내려간다." |

---

### USP 2: "설명 가능한 전략만 탑재"

| 항목 | 내용 |
|------|------|
| 헤드라인 | 블랙박스 AI가 아닌, **파라미터가 보이는 전략** |
| 설명 | 6개 전략 모두 학술적으로 유효성이 관찰된 방법론(추세추종, 평균회귀, 돌파, 멀티팩터)에 기반합니다. 각 전략의 진입 조건, 청산 규칙, 예외 조건이 모두 투명하게 공개됩니다. |
| 차별점 | 사용자가 모든 파라미터를 직접 확인하고 조정 가능. "왜 매수했는지, 왜 매도했는지" 항상 설명 가능. |
| 키 메시지 | "전략의 모든 결정에는 이유가 있습니다." |

---

### USP 3: "내 CEX 자산에서 바로 시작"

| 항목 | 내용 |
|------|------|
| 헤드라인 | 별도 입금 없이, **기존 거래소 자산 그대로 사용** |
| 설명 | 업비트, 빗썸 등 이미 보유한 CEX 계정의 자산 목록을 불러와 체크박스로 선택하면 바로 전략 적용. 자산을 옮기거나 별도 지갑을 만들 필요가 없습니다. |
| 차별점 | CEX Portfolio 연동 → 자산 선택 → 전략 적용 — **3단계 완료**. |
| 키 메시지 | "이미 가지고 있는 자산에, 전략만 입히세요." |

---

### USP 4: "3중 안전장치 리스크 엔진"

| 항목 | 내용 |
|------|------|
| 헤드라인 | 일일 손실한도, 주간 손실한도, 변동성 킬 스위치 |
| 설명 | 모든 Agent에 3단계 방어선이 적용됩니다. |
| 안전장치 구조 | 아래 표 참고 |

**3중 안전장치 구조:**

| Layer | 이름 | 작동 방식 | 기본값 |
|-------|------|-----------|--------|
| Layer 1 | **Daily Drawdown Kill** | 하루 손실이 한도에 도달하면 당일 거래 전면 중단 | -3% |
| Layer 2 | **Weekly Drawdown Kill** | 주간 누적 손실이 한도에 도달하면 한 주간 거래 중단 | -7% |
| Layer 3 | **Volatility Overlay** | 실시간 변동성 버킷에 따라 포지션 크기 자동 조절. 극단적 변동성에서는 100% 차단. | Low=100%, Mid=70%, High=40%, Extreme=0% |

**키 메시지**: "손실에는 천장이 있습니다."

---

### USP 5: "Simple Mode에서 3분, Advanced Mode에서 완전 커스터마이징"

| 항목 | 내용 |
|------|------|
| 헤드라인 | 초보자는 3분, 전문가는 무한 커스터마이징 |
| 설명 | Simple Mode에서는 리스크 성향(안정/균형/적극)만 선택하면 나머지 파라미터가 자동 설정됩니다. Advanced Mode에서는 EMA 기간, RSI 임계값, ATR 배수, 포지션 비율까지 모든 파라미터를 슬라이더로 조정할 수 있습니다. |
| 키 메시지 | "누구나 시작할 수 있고, 전문가도 만족합니다." |

---

### USP 6: "운용 규모, 원하는 만큼만"

| 항목 | 내용 |
|------|------|
| 헤드라인 | 전체 자산의 일부만 **내가 정한 한도 안에서** 운용 |
| 설명 | 전체 운용 한도, 종목당 한도, 1회 주문 한도, 일일 거래 한도를 각각 설정할 수 있습니다. 예를 들어, 자산이 1,000만원이어도 200만원만 운용하도록 제한할 수 있습니다. |
| 차별점 | 타사 봇은 전체 자산을 투입하거나 금액 조절이 제한적. Vision Quant Engine은 **4단계 예산 한도**를 제공합니다. |
| 키 메시지 | "전체 자산이 아니라, 내가 허락한 금액만 움직입니다." |

**Budget Allocation 구성:**

| 설정 항목 | 설명 | 예시 |
|-----------|------|------|
| **전체 운용 한도** | Agent가 사용할 수 있는 최대 총 금액 | 2,000,000원 |
| **종목당 운용 한도** | 개별 자산에 배분할 최대 금액 | 500,000원 |
| **1회 주문 한도** | 단일 주문의 최대 크기 (Advanced Mode) | 200,000원 |
| **일일 거래 한도** | 하루 동안의 최대 거래 금액 (Advanced Mode) | 1,000,000원 |

> 모든 한도는 KRW / USD 통화 전환 지원. 프리셋(10%, 25%, 50%, 100%) 버튼으로 빠르게 설정 가능.

---

### USP 7: "실전 전에 모의 거래로 검증"

| 항목 | 내용 |
|------|------|
| 헤드라인 | 실제 자산 없이, **Paper Trading으로 전략 테스트** |
| 설명 | 에이전트 생성 시 Paper Trading(모의 거래) 모드와 Live Trading(실거래) 모드를 선택할 수 있습니다. Paper Trading 모드에서는 실제 주문을 실행하지 않고, 시장 가격 기반으로 시뮬레이션을 수행합니다. |
| 차별점 | 모의 거래 결과를 바탕으로 **전문 성과 리포트가 자동 생성**되므로, 실전 투입 전에 전략의 유효성을 객관적으로 평가할 수 있습니다. |
| 키 메시지 | "실전 전에 먼저 테스트하세요. 리스크 제로로." |

**Trading Mode 비교:**

| 구분 | Paper Trading (모의 거래) | Live Trading (실거래) |
|------|---------------------------|------------------------|
| 실제 주문 | 실행하지 않음 | 거래소에서 실행 |
| 자산 위험 | 없음 (제로 리스크) | 실제 자산 사용 |
| 시장 데이터 | 실시간 시장 가격 기반 | 실시간 시장 가격 기반 |
| 성과 리포트 | 생성됨 ("Paper Trading" 표기) | 생성됨 |
| 용도 | 전략 테스트 및 검증 | 실제 자동매매 운용 |
| 기본 선택 | **기본값** (안전) | 수동 전환 필요 |

---

### USP 8: "전문 자산운용사급 성과 리포트"

| 항목 | 내용 |
|------|------|
| 헤드라인 | 주간 / 월별 / 연간 **자동 리포트** |
| 설명 | 에이전트 운용 결과를 기반으로 전문 자산운용사 수준의 성과 리포트가 자동으로 생성됩니다. Equity Curve, Risk Analytics, Asset Attribution, Strategy Breakdown 등 기관 투자자 형식의 분석을 제공합니다. |
| 차별점 | 타사 봇은 거래 내역만 제공. Vision Quant Engine은 Sharpe Ratio, Sortino Ratio, VaR, Drawdown Analysis 등 **12개 리스크 지표**를 포함한 전문 리포트를 제공합니다. |
| 키 메시지 | "내 매매 성과를, 전문가처럼 분석합니다." |

**Performance Report 구성:**

| 리포트 섹션 | 내용 |
|-------------|------|
| Executive Summary | 순수익, 총수익률, 승률, 연환산 수익률, 수수료 총액 |
| Equity Curve | 포트폴리오 수익률 vs BTC 벤치마크 비교 차트 |
| Risk Analytics | Sharpe, Sortino, Calmar, VaR 95%/99%, Beta, Alpha 등 12개 지표 |
| Asset Attribution | 종목별 거래수, 승률, P&L, Return, Sharpe, 비중 |
| Strategy Breakdown | 전략별 승률, Profit Factor, Avg Win/Loss, 연속 손실 |
| Drawdown Analysis | 하락 기간, 깊이, 회복 소요일, Peak-to-Trough |
| Monthly Heatmap | 월별 수익률 히트맵 (연간 리포트) |
| Trade Log | 개별 거래 내역 (시간, 자산, 방향, 금액, P&L, 전략) |
| Benchmark Comparison | Portfolio vs BTC vs ETH vs Market Avg |

> Paper Trading 리포트에는 "Simulated Trading Report" 워터마크와 별도 면책 조항이 표시됩니다.

---

### USP 9: "Vision Quant Arena — Paper Trading Competition"

| Item | Details |
|------|------|
| Headline | **Equal Capital, Fair Competition — Compete on ROI** |
| Description | A seasonal paper trading competition based on Paper Trading mode. All participants start with the same seed capital (KRW 10,000,000 or USDT 10,000) and are ranked by return on investment (ROI) relative to initial capital. |
| Differentiator | Automatically enrolled in the current round when creating a Paper Trading agent. No separate registration required. Compare ROI, strategies, and win rates against other participants in real-time via the leaderboard. |
| Key Message | "Same capital, same market. Strategy is the only difference." |

**Quant Arena Structure:**

| Item | Details |
|------|------|
| **Seed Capital** | KRW 10,000,000 / USDT 10,000 (fixed, identical for all participants) |
| **Evaluation Metric** | Return on Investment (ROI %) relative to initial capital |
| **Format** | Seasonal rounds (10-day periods) |
| **Entry Method** | Auto-enrolled upon Paper Trading agent creation |
| **Ranking Updates** | Firestore real-time sync (onSnapshot) |

**Prize Structure (per round):**

| Rank | VCN | RP |
|------|-----|----|
| 1st Place | 500 VCN | 500 RP |
| 2nd Place | 300 VCN | 300 RP |
| 3rd Place | 100 VCN | 100 RP |
| Participation (4th+) | - | 20 RP |

**Bonus Awards:**

| Bonus | Criteria | Reward |
|-------|----------|--------|
| Best Strategy | Highest Sharpe Ratio | +100 VCN |
| Most Active | Highest number of trades | +50 VCN |

**Leaderboard UI (Arena Tab):**

| Component | Description |
|-----------|------|
| Round Header | Round title, progress bar, time remaining, participant count, seed capital, total prize pool |
| Rules Panel | Competition rules and prize structure (collapsible) |
| My Position | My rank, ROI, portfolio value, trade count (shown only when participating) |
| Leaderboard Table | Full ranking table — rank, trader, ROI, P&L, strategy, trade count, win rate |
| Join Guide | Participation guide for non-participants (Setup -> Paper Trading selection) |

**Competition Rules:**

1. All participants start with the same seed capital
2. Paper Trading (simulated) only — no real asset risk
3. Rankings determined by ROI relative to initial capital
4. Final rankings locked at round closing based on final ROI
5. Prizes (VCN, RP) distributed within 24 hours after round ends
6. Disqualification for cheating (API manipulation, multiple accounts)

---

## 3. 탑재 전략 모듈 (10개)

### 시그널 생성 전략 (9개)

| # | 전략명 | 카테고리 | 리스크 | 핵심 원리 | 유리한 시장 |
|---|--------|----------|--------|-----------|-------------|
| 1 | **Conservative Trend Core** (보수적 추세추종) | Trend Following | Low | EMA 크로스오버 + 200일 추세확인 + 거래량 필터 | 명확한 추세 시장 |
| 2 | **Bollinger Mean Reversion Guarded** (볼린저 평균회귀 가드) | Mean Reversion | Medium | 볼린저 밴드 하단 반등 + RSI 회복 + 하락추세 필터 | 횡보 시장 |
| 3 | **RSI Reversal Filtered** (RSI 반전 필터형) | Mean Reversion | Medium | RSI 과매도 회복 + MACD 히스토그램 확인 (RSI 단독 사용 금지) | 주기적 반등 시장 |
| 4 | **Donchian Breakout Swing** (돈치안 돌파 스윙) | Breakout | Med-High | N봉 최고가 돌파 + 거래량 급증 + ATR 동적 손절 | 횡보→추세 전환기 |
| 5 | **Multi-Factor Quant Guard** (멀티팩터 퀀트가드) | Multi-Signal | Medium | 추세+모멘텀+거래량+변동성 4중 확인 — 비전체인 대표 전략 | 조정 후 회복 시장 |
| 6 | **Turtle Trading** (터틀 트레이딩) | Trend Following | Med-High | 리처드 데니스의 전설적 추세추종 돌파 전략 | 강한 추세 시장 |
| 7 | **Williams Breakout** (윌리엄스 브레이크아웃) | Breakout | High | 래리 윌리엄스의 변동성 돌파 단기 전략 | 변동성 돌파 시장 |
| 8 | **Minervini VCP** (미너비니 VCP) | Breakout | Medium | 마크 미너비니의 Volatility Contraction Pattern | 조정 후 돌파 시장 |
| 9 | **Livermore Pyramid** (리버모어 피라미드) | Trend Following | High | 제시 리버모어의 수익 시 피라미딩 전략 | 강한 추세 시장 |

### 리스크 제어 레이어 (1개)

| # | 전략명 | 역할 |
|---|--------|------|
| 10 | **Volatility Target Overlay** (변동성 타기팅 오버레이) | 모든 전략 위에 기본 적용되는 포지션 크기 조절 + 손실한도 킬 스위치 |

---

## 4. 전략 설계 철학 — 인포그래픽용 핵심 포인트

### "절대 하지 않는 것" 리스트 (Exception Rules)

이 리스트는 전략이 "하지 않는 행동"을 명시하여 사용자에게 신뢰를 줍니다.

| 규칙 | 설명 |
|------|------|
| **급등 후 추격매수 금지** | 이미 급등한 자산에 뒤늦게 매수하지 않음 |
| **스프레드 과다 시 거래 금지** | 호가 스프레드가 비정상적으로 넓으면 주문 보류 |
| **거래소 지연 시 거래 금지** | API 응답이 비정상적으로 느리면 주문 보류 |
| **극단적 변동성 거래 일시중단** | 변동성이 극단적 버킷에 진입하면 모든 거래 중단 |
| **일일 손실한도 도달 시 당일 중단** | 오늘 더 이상 잃지 않음 |
| **연속 손실 후 자동 일시중단** | 연속 3회 손실 시 전략 자동 정지 후 사용자 확인 대기 |
| **하락추세 진입 시 포지션 축소** | 하락추세에서는 포지션 크기를 자동으로 줄임 |
| **뉴스 급락 감지 시 일시중단** | 비정상적 가격 급락 감지 시 거래 중단 |

**인포그래픽 제안**: "Vision Quant Engine이 절대 하지 않는 8가지" — 방패 아이콘과 함께 리스트로 배치

---

## 5. 사용자 플로우 — 인포그래픽용 단계별 흐름

### 5-Step Setup Flow

```
Step 1: 거래소 연결
   ┌─────────────────────┐
   │  업비트 / 빗썸      │
   │  API Key 등록       │
   │  자산 자동 불러오기  │
   └─────────┬───────────┘
             ▼
Step 2: 전략 & 자산 선택
   ┌─────────────────────┐
   │  10개 전략 카드 탐색 │
   │  상세 정보 확인      │
   │  보유 자산 체크박스   │
   │  Simple / Advanced   │
   └─────────┬───────────┘
             ▼
Step 3: Trading Mode 선택
   ┌─────────────────────┐
   │  Paper Trading      │
   │    (모의 거래)       │
   │  Live Trading       │
   │    (실거래)          │
   │  기본값: Paper       │
   └─────────┬───────────┘
             ▼
Step 4: Budget Allocation (운용 한도)
   ┌─────────────────────┐
   │  전체 운용 한도      │
   │  종목당 운용 한도    │
   │  1회 주문 한도       │
   │  일일 거래 한도      │
   │  KRW / USD 전환      │
   └─────────┬───────────┘
             ▼
Step 5: 확인 & 실행
   ┌─────────────────────┐
   │  설정 요약 리뷰      │
   │  Trading Mode 확인   │
   │  예산 한도 확인       │
   │  리스크 한도 확인     │
   │  면책 동의 체크       │
   │  Agent 생성 → 실행!  │
   └─────────────────────┘
             ▼
         실행 후 →
   ┌─────────────────────┐
   │  Reports 탭에서      │
   │  주간/월별/연간      │
   │  성과 리포트 확인    │
   └─────────────────────┘
```

---

## 6. 경쟁 비교 — 인포그래픽용 비교표

| Feature | 타사 자동매매 봇 | Vision Quant Engine |
|---------|------------------|---------------------|
| 전략 투명성 | 블랙박스 또는 제한적 | 모든 파라미터 투명 공개 |
| 리스크 제어 | 단순 손절 | 3중 안전장치 (일일/주간/변동성) |
| 커스터마이징 | 제한적 | Simple + Advanced 이중 모드 |
| 자산 연동 | 별도 입금 필요 | 기존 CEX 자산 그대로 사용 |
| 변동성 대응 | 수동 | 자동 포지션 크기 조절 |
| 진입 확인 | 단일 조건 | 멀티팩터 확인 (최대 6중) |
| 추격매수 방지 | 없음 | Exception Rule로 원천 차단 |
| 연속 손실 보호 | 없음 | N회 연속 손실 시 자동 정지 |
| 설정 난이도 | 복잡 | 3분 Simple 모드 |
| 지원 거래소 | 해외 중심 | 국내 거래소 (업비트, 빗썸) |
| **운용 한도 제어** | 없음 또는 단순 | 4단계 예산 한도 (전체/종목/주문/일일) |
| **모의 거래** | 없거나 별도 플랜 | Paper Trading 기본 내장 (무료) |
| **성과 리포트** | 거래 내역만 제공 | 전문 기관급 성과 리포트 (12개 리스크 지표) |

---

## 7. 핵심 수치 (인포그래픽용)

| 수치 | 의미 |
|------|------|
| **10** | 탑재된 전략 모듈 수 (9 시그널 + 1 리스크 레이어) |
| **8** | 기본 기술지표 (EMA, RSI, MACD, Bollinger, Donchian, ATR, Volume MA, OBV) |
| **3중** | 안전장치 레이어 (일일/주간/변동성) |
| **4단계** | 예산 한도 (전체/종목/주문/일일) |
| **8가지** | Exception Rules (절대 하지 않는 행동) |
| **4개** | 변동성 버킷 (Low → Mid → High → Extreme) |
| **12** | 리스크 분석 지표 (Sharpe, Sortino, Calmar, VaR, Alpha, Beta 등) |
| **3분** | Simple Mode 설정 소요 시간 |
| **24/7** | Agent 자동 모니터링 |
| **0%** | 극단적 변동성에서의 포지션 크기 (= 거래 완전 중단) |
| **2가지** | Trading Mode (Paper / Live) |
| **3종** | 성과 리포트 (주간 / 월별 / 연간) |
| **KRW 10M** | Quant Arena seed capital (identical for all participants) |
| **10 days** | Quant Arena round duration |
| **900 VCN** | Total prize pool per round (1st-3rd place) |

---

## 8. 태그라인 제안

### 메인 태그라인
> **"전략은 투명하게, 리스크는 단단하게."**

### 서브 태그라인 (택 1)
- "변동성이 올라가면, 포지션은 내려갑니다."
- "AI가 매매하고, 리스크 엔진이 지킵니다."
- "수익은 전략의 몫, 손실 제한은 엔진의 몫."
- "블랙박스 없이, 모든 결정에 이유가 있습니다."

---

## 9. 컬러 팔레트 & 비주얼 가이드 (인포그래픽 제작용)

| 요소 | 색상 | 용도 |
|------|------|------|
| Primary Accent | `#22D3EE` (Cyan-400) | 제품 브랜딩, CTA 버튼, 강조 |
| Background | `#0c0c0e` (Deep Black) | 배경, 다크 모드 베이스 |
| Risk Low | `#4ADE80` (Green-400) | 저위험, 안전, 수익 |
| Risk Medium | `#FACC15` (Yellow-400) | 중위험, 주의 |
| Risk High | `#F97316` (Orange-400) | 고위험 |
| Risk Extreme | `#EF4444` (Red-400) | 극단적 위험, 손실, 중단 |
| Text Primary | `#FFFFFF` | 제목, 핵심 수치 |
| Text Secondary | `#9CA3AF` (Gray-400) | 설명, 부제목 |

### 비주얼 스타일
- **다크 모드 기반**: 프리미엄 느낌, 금융 플랫폼 표준
- **글래스모피즘**: 카드 배경에 반투명 + backdrop-blur 적용
- **그라데이션**: Blue → Cyan 방향 그라데이션으로 기술력 표현
- **아이콘**: lucide-solid 아이콘 기반의 Line Icon 스타일

---

## 10. FAQ (인포그래픽 마지막 섹션용)

**Q: 자동매매로 반드시 수익이 나나요?**  
A: 아닙니다. 과거 성과는 미래 수익을 보장하지 않습니다. Vision Quant Engine은 "수익 극대화"가 아니라 "리스크 통제 하의 체계적 매매"를 목표로 합니다.

**Q: 내 거래소 비밀번호를 알려야 하나요?**  
A: 아닙니다. API Key만 등록하면 되며, 출금 권한이 없는 키 사용을 권장합니다.

**Q: 손실이 무한히 커질 수 있나요?**  
A: 3중 안전장치(일일/주간/변동성 한도)에 의해 손실에는 항상 천장이 있습니다. 극단적 변동성에서는 거래가 자동 중단됩니다.

**Q: Advanced Mode를 꼭 써야 하나요?**  
A: 아닙니다. Simple Mode에서 리스크 성향만 선택하면 파라미터가 자동으로 설정됩니다. 전문가만 Advanced Mode를 사용하면 됩니다.

**Q: 자산을 전부 투입해야 하나요?**  
A: 아닙니다. Budget Allocation(운용 한도 설정)에서 전체 운용 한도, 종목당 한도를 각각 설정할 수 있습니다. 예를 들어 보유 자산이 1,000만원이어도 200만원만 운용하도록 제한 가능합니다.

**Q: 실제 돈을 넣지 않고 테스트할 수 있나요?**  
A: 네. Paper Trading(모의 거래) 모드를 선택하면 실제 주문 없이 시장 가격 기반으로 시뮬레이션됩니다. 기본 설정이 Paper Trading이므로 실수로 실전 매매가 시작될 걱정이 없습니다.

**Q: 매매 결과를 어떻게 확인하나요?**  
A: Reports 탭에서 주간/월별/연간 성과 리포트를 자동으로 확인할 수 있습니다. Equity Curve, Risk Analytics, Drawdown Analysis 등 전문 자산운용사 수준의 분석이 제공됩니다.

**Q: How do I join the Quant Arena competition?**  
A: Simply create a Paper Trading agent and you will be automatically enrolled in the current active round. No separate registration is needed — just select Paper Trading mode during agent setup.

**Q: How are Quant Arena rankings determined?**  
A: All participants start with the same seed capital (KRW 10,000,000). Rankings are determined by ROI (return on investment) relative to initial capital at the round's closing time. You can check real-time rankings on the leaderboard.

**Q: How do I receive Quant Arena prizes?**  
A: VCN and RP are automatically distributed within 24 hours after each round ends. 1st place receives 500 VCN + 500 RP, 2nd place 300 VCN + 300 RP, 3rd place 100 VCN + 100 RP, and all other participants receive a 20 RP participation reward.

---

## 11. 인포그래픽 레이아웃 제안

### 페이지 1: 히어로
- 제품명: **Vision Quant Engine**
- 태그라인: "전략은 투명하게, 리스크는 단단하게."
- 5-Step 아이콘 (연결 → 전략선택 → 모드선택 → 한도설정 → 실행)

### 페이지 2: 8대 USP
- 아이콘 + 헤드라인 + 1줄 설명 형태로 8개 배치
- 핵심 3개 (리스크 통제, 모의 거래, 성과 리포트) 강조

### 페이지 3: 10개 전략 카드
- 카드 형태로 전략명 + 카테고리 + 리스크 등급
- 프리미엄 전략 4종 (Turtle, Williams, Minervini, Livermore) 별도 강조
- 색상으로 리스크 수준 시각화

### 페이지 4: 3중 안전장치 + 4단계 예산 한도
- Layer 1/2/3을 방패 아이콘으로 시각화
- Volatility Overlay의 버킷별 크기 조절을 막대그래프로 표현
- Budget Allocation 4단계를 금고 아이콘으로 시각화

### 페이지 5: Paper Trading & Performance Reports
- Paper vs Live Trading 비교표
- Performance Report 샘플 스크린샷/모형
- "리스크 제로로 테스트 → 전문 리포트로 검증 → 실전 투입" 플로우

### Page 6: Vision Quant Arena
- Competition structure: Seed Capital -> Free Strategy -> ROI Ranking
- Prize table (1st-3rd VCN + RP, participation RP)
- Leaderboard UI screenshot/mockup
- "Same capital, same market. Strategy is the only difference." tagline

### Page 7: "8 Things We Never Do"
- List with prohibition icons (X marks)
- Section that maximizes trustworthiness

### Page 8: Competitive Comparison
- Comparison table with check/X icons
- Highlight budget limits, paper trading, performance reports, and **Quant Arena**

### Page 9: Key Numbers + CTA
- Large numbers for key stats
- "Join the Quant Arena Now" CTA
