# Vision Quant Engine - 구현 상세 소개자료

> **문서 목적**: 투자자, 파트너, 내부 팀을 위한 Vision Quant Engine 기술 소개  
> **작성일**: 2026-03-10  
> **기준 버전**: Production Build (strategyRegistry v1, VisionQuantEngine.tsx)

---

## 1. 제품 개요

**Vision Quant Engine**은 Vision Chain 생태계에 탑재된 암호자산 자동매매 플랫폼입니다.

> **"CEX 자산을 연결하고, 검증된 전략을 고르고, 리스크 한도를 설정하면 -- AI Agent가 24/7 자동으로 매매합니다."**

### 핵심 철학

| 원칙 | 설명 |
|------|------|
| **손실 제한 우선** | 수익 극대화가 아닌, 리스크 통제 하의 체계적 매매를 목표 |
| **설명 가능한 전략** | 블랙박스 AI가 아닌, 모든 파라미터가 투명하게 공개되는 전략 |
| **접근성** | Simple Mode 3분 설정부터 Advanced Mode 완전 커스터마이징까지 |

---

## 2. 기술 아키텍처

### 코드 구조

```
services/quant/
  types.ts             ← 전체 타입 정의 (196 lines)
  strategyRegistry.ts  ← 10개 전략 모듈 레지스트리 (751 lines)

components/quant/
  VisionQuantEngine.tsx ← 메인 UI 컴포넌트 (917 lines)
```

### 타입 시스템

총 **15개 인터페이스/타입**이 정의되어 있으며, 전략 모듈의 모든 구성 요소를 정밀하게 제어합니다.

```
StrategyTemplate
  +-- EntryRule[]        진입 조건 (지표 + 조건 + 값)
  +-- ExitRule[]         청산 규칙 (손절/익절/추적매도)
  +-- RiskRules          리스크 한도 (포지션/일일/주간)
  +-- ExceptionRule[]    예외 규칙 (8가지 금지 행동)
  +-- VolatilityOverlay  변동성 오버레이 (4단계 버킷)
  +-- StrategyParameter[] 사용자 조정 가능 파라미터
  +-- StrategyBlogContent? 프리미엄 전략 설명 콘텐츠
```

### 에이전트 생명주기

```
draft --> pending_confirmation --> ready --> active --> paused / stopped / error
```

에이전트(`QuantAgent`)는 다음 성과 지표를 실시간 추적합니다:
- todayPnl / todayPnlPercent
- cumulativePnl / cumulativePnlPercent
- totalSignals / executedSignals / skippedSignals
- lastSignalAt / lastOrderAt

### 신호 체계

```
SignalType: entry_long | exit_long | scale_in | partial_exit
           | stop_loss | take_profit | trailing_stop

SignalAction: executed | skipped | pending
```

모든 신호에는 `reason`(발생 사유), `skipReason`(건너뜀 사유), `indicators`(당시 지표값)가 기록됩니다.

---

## 3. 탑재 전략 모듈 (10개)

### 시그널 생성 전략 (9개)

#### Module 1: Conservative Trend Core (보수적 추세추종)

| 항목 | 내용 |
|------|------|
| 카테고리 | Trend Following |
| 리스크 | Low |
| 타임프레임 | 4H |
| 추천 자산 | BTC, ETH |
| 사용자 | 1,842명 / 30일 평균 +3.2% |

**진입 조건** (4중 확인):
1. EMA 크로스오버: Fast(20) > Slow(50)
2. 장기 추세 확인: 가격 > 200 EMA
3. 거래량 필터: 거래량 >= MA x 1.1
4. ATR 스파이크 필터: 극단적 변동 아닐 것

**청산 규칙**: 손절 4% | 익절 8% | 추적매도 2.5%  
**리스크**: 최대 포지션 15% | 일일 한도 -3% | 주간 한도 -7%

**조정 가능 파라미터 (8개)**:
`fast_ema(5-50)`, `slow_ema(20-100)`, `trend_ema(100-300)`, `volume_ratio(1.0-3.0)`, `stop_loss(1-10%)`, `take_profit(3-20%)`, `trailing_stop(1-5%)`, `max_position(5-30%)`

---

#### Module 2: Bollinger Mean Reversion Guarded (볼린저 평균회귀 가드)

| 항목 | 내용 |
|------|------|
| 카테고리 | Mean Reversion |
| 리스크 | Medium |
| 타임프레임 | 4H |
| 추천 자산 | BTC, ETH, XRP |
| 사용자 | 1,156명 / 30일 평균 +2.1% |

**진입 조건** (3중 확인):
1. 볼린저 밴드 하단 반등 (20봉)
2. RSI 과매도 회복 (30 이하에서 반등)
3. 강한 하락추세 아닐 것 (100 EMA 필터)

**청산 규칙**: 손절 3% | 밴드 중앙 부분청산  
**예외 규칙**: 하락추세 포지션 축소, 뉴스 급락 시 일시중단

---

#### Module 3: RSI Reversal Filtered (RSI 반전 필터형)

| 항목 | 내용 |
|------|------|
| 카테고리 | Mean Reversion |
| 리스크 | Medium |
| 타임프레임 | 4H |
| 사용자 | 2,310명 / 30일 평균 +1.8% |

**핵심 원칙**: RSI 단독 사용 금지 -- 반드시 MACD 히스토그램 개선 확인 필요

**진입 조건** (3중 확인):
1. RSI 28 이하 진입 후 회복
2. RSI 32 상향 돌파
3. MACD 히스토그램 개선 중

**특수 기능**: 분할진입(최대 2회), 연속 3회 손실 시 자동 정지

---

#### Module 4: Donchian Breakout Swing (돈치안 돌파 스윙)

| 항목 | 내용 |
|------|------|
| 카테고리 | Breakout |
| 리스크 | Medium-High |
| 타임프레임 | 4H |
| 추천 자산 | BTC, ETH, SOL |
| 사용자 | 987명 / 30일 평균 +4.5% |

**진입 조건**: 20봉 최고가 돌파 + 거래량 >= MA x 1.3 + 가격 > 200 EMA  
**청산**: ATR x 1.8 손절 | ATR x 2.0 추적매도  
**특수**: 최대 3개 동시 포지션, 극단적 변동성 거래 일시중단

---

#### Module 5: Multi-Factor Quant Guard (멀티팩터 퀀트가드)

| 항목 | 내용 |
|------|------|
| 카테고리 | Multi-Signal |
| 리스크 | Medium |
| 타임프레임 | 4H |
| 사용자 | 1,248명 / 30일 평균 +3.8% |

**Vision Chain 대표 전략** -- 진입 전 **6중 확인**:

```
1. 장기 추세: 가격 > 200 EMA
2. EMA 크로스: 20 EMA > 50 EMA
3. 모멘텀:  RSI > 40 상향돌파
4. MACD:    히스토그램 개선 중
5. 거래량:  >= MA x 1.2
6. 변동성:  ATR 상한선 미만
```

**차별점**: 6개 조건이 모두 충족될 때만 진입하여 거짓 신호를 극적으로 감소시킴

---

#### Module 7: Turtle Trading Crypto (터틀 트레이딩)

| 항목 | 내용 |
|------|------|
| 카테고리 | Turtle Trading |
| 리스크 | Medium-High |
| 타임프레임 | 4H |
| 원형 | Richard Dennis (1983) |
| 사용자 | 756명 / 30일 평균 +5.1% |
| 등급 | **Premium** |

**원형**: Richard Dennis & William Eckhardt의 전설적인 터틀 트레이딩 시스템. 23명의 일반인을 2주간 교육하여 5년간 $175M 이상 수익.

**듀얼 시스템**:
- System 1: 20봉 돌파 (단기)
- System 2: 55봉 돌파 (추세 확인)

**N-Unit 포지션 사이징**: ATR 기반 변동성 정규화 포지션 크기 산정  
**크립토 적응**: 오리지널 1-2% 리스크 -> 0.5-1%로 조정 (높은 시장 변동성 반영)  
**피라미딩**: 0.5 ATR 간격으로 최대 3단위까지 추가 매수

---

#### Module 8: Williams Volatility Breakout (윌리엄스 변동성 돌파)

| 항목 | 내용 |
|------|------|
| 카테고리 | Williams System |
| 리스크 | Medium-High |
| 타임프레임 | 1D |
| 원형 | Larry Williams (1987 World Cup, +11,376%) |
| 사용자 | 634명 / 30일 평균 +4.8% |
| 등급 | **Premium** |

**핵심 공식**: `진입가 = 전일 종가 + (전일 변동폭 x K팩터)`

**K팩터 조정 범위**: 0.3 ~ 0.8 (기본 0.5)  
**확인 지표**: Williams %R (과매수 필터), Ultimate Oscillator (3중 모멘텀)  
**크립토 적응**: 롤링 24시간 기간 사용, 다중 크립토 사이클에서 테스트된 K팩터 범위

---

#### Module 9: Minervini VCP Momentum (미너비니 VCP 모멘텀)

| 항목 | 내용 |
|------|------|
| 카테고리 | Momentum Swing |
| 리스크 | Medium |
| 타임프레임 | 1D |
| 원형 | Mark Minervini (2x US Investing Champion) |
| 추천 자산 | BTC, ETH, SOL, AVAX |
| 사용자 | 892명 / 30일 평균 +4.2% |
| 등급 | **Premium** |

**Trend Template (7중 조건)**:
1. 가격 > 50 SMA
2. 가격 > 150 SMA
3. 가격 > 200 SMA
4. 50 SMA > 150 SMA > 200 SMA
5. 200 SMA 30일+ 상승 중
6. VCP (변동성 축소 패턴) 돌파
7. 돌파 거래량 >= MA x 1.5

**VCP 패턴**: 각 조정이 이전보다 얕아지는 축소 패턴 (예: 25% -> 15% -> 8%), 매도세 소진 확인

---

#### Module 10: Livermore Trend Pyramid (리버모어 추세 피라미드)

| 항목 | 내용 |
|------|------|
| 카테고리 | Stage Analysis |
| 리스크 | Medium-High |
| 타임프레임 | 1D |
| 원형 | Jesse Livermore ("The Great Bear of Wall Street") |
| 사용자 | 543명 / 30일 평균 +5.6% |
| 등급 | **Premium** |

**"최소 저항선의 방향"** -- Livermore의 핵심 원칙:
1. 기반 형성 기간(최소 30일) 완료 대기
2. 핵심 저항선 돌파 + 거래량 >= MA x 1.5
3. 200 EMA 위에서만 진입

**피라미딩 규칙**: 확인된 더 높은 저점에서 1/2 단위씩 추가, **손실 포지션 물타기 절대 금지**  
**크립토 적응**: 피봇 포인트 분석으로 알고리즘적 저항선 식별, 롤링 200봉 레짐 감지

---

### 리스크 제어 레이어 (1개)

#### Module 6: Volatility Target Overlay (변동성 타기팅 오버레이)

> **시그널 생성기가 아닌, 모든 전략 위에 기본 적용되는 리스크 제어 레이어**

| 변동성 수준 | 포지션 크기 | 동작 |
|-------------|-------------|------|
| Low | **100%** | 정상 거래 |
| Mid | **70%** | 포지션 축소 |
| High | **40%** | 대폭 축소 |
| Extreme | **0%** | **거래 완전 중단** |

**3중 안전장치**:

| Layer | 이름 | 기본값 | 작동 |
|-------|------|--------|------|
| Layer 1 | Daily Drawdown Kill | -3% | 하루 손실 한도 도달 시 당일 거래 중단 |
| Layer 2 | Weekly Drawdown Kill | -7% | 주간 손실 한도 도달 시 한 주간 거래 중단 |
| Layer 3 | Volatility Overlay | 4단계 | 실시간 변동성 기반 포지션 크기 자동 조절 |

---

## 4. "절대 하지 않는 것" 8가지 (Exception Rules)

모든 전략에 적용되는 방어적 예외 규칙 시스템:

| 규칙 | 코드 | 설명 |
|------|------|------|
| 급등 후 추격매수 금지 | `skip_chase_buy_after_spike` | 이미 급등한 자산에 뒤늦게 매수하지 않음 |
| 스프레드 과다 시 거래 금지 | `skip_if_spread_too_wide` | 호가 스프레드가 비정상적이면 주문 보류 |
| 거래소 지연 시 거래 금지 | `skip_if_exchange_latency_abnormal` | API 응답이 느리면 주문 보류 |
| 극단적 변동성 일시중단 | `pause_if_extreme_volatility` | 변동성 Extreme 버킷 진입 시 모든 거래 중단 |
| 일일 손실한도 도달 시 중단 | `skip_if_daily_loss_limit` | 오늘 더 이상 잃지 않음 |
| 연속 손실 후 자동 중단 | `pause_after_consecutive_losses` | 연속 3회 손실 시 전략 자동 정지 |
| 하락추세 포지션 축소 | `reduce_position_in_downtrend` | 하락추세에서 포지션 크기 자동 감소 |
| 뉴스 급락 감지 시 중단 | `pause_on_news_crash` | 비정상적 가격 급락 시 거래 중단 |

---

## 5. 사용자 플로우 (3-Step Setup)

### Step 1: 거래소 연결

CEX Portfolio에서 거래소 API Key 등록. 현재 지원:
- **Upbit** (업비트)
- **Bithumb** (빗썸)
- Binance, Bybit, Bitget, OKX, KuCoin, MEXC, Bitkub (확장 예정)

포트폴리오 자동 동기화 -> 보유 자산 목록 자동 로드

### Step 2: 전략 & 자산 선택

```
[카테고리 필터] All | Premium | Trend | Mean Reversion | Multi-Signal | Breakout | ...
                                          |
                                    [전략 카드 선택]
                                          |
                              +---[Detail] 상세 정보 확인
                              |           - 진입/청산 규칙
                              |           - 시장 적합성
                              |           - 파라미터 목록
                              |           - 예외 규칙
                              |           - Premium: 트레이더 스토리
                              |
                              +---[Setup] 설정 진행
                                          |
                                    [자산 체크박스 선택]
                                          |
                              +---[Simple Mode]
                              |       리스크 성향만 선택
                              |       안정형 / 균형형 / 적극형
                              |
                              +---[Advanced Mode]
                                      모든 파라미터 슬라이더 조정
                                      Entry / Exit / Risk / Filter 그룹별
```

### Step 3: 확인 & 실행

- 설정 요약 리뷰
- 리스크 한도 최종 확인 (25% 초과 시 경고 표시)
- 면책 동의 체크 (Beta 서비스 안내)
- Agent 생성 -> 자동매매 시작

---

## 6. UI 구현 상세

### 메인 컴포넌트 (VisionQuantEngine.tsx, 917 lines)

**3개 탭 구조**:

| 탭 | 내용 |
|-----|------|
| **Strategies** | 전략 카드 그리드, 카테고리 필터(10개), Premium 배지, 사용자 수/30일 수익 표시 |
| **Agents** | 활성 에이전트 목록, 실시간 P&L 추적 |
| **Signals** | 실시간 시그널 피드, 실행/건너뜀 상태 |

**Quick Stats 대시보드**: 전략 수 / Tradable 자산 수 / Active Agents / Today P&L

**모달 3단계**:
1. Strategy Detail Modal -- 전략 상세 정보 + Premium 트레이더 블로그
2. Strategy Setup Modal -- Simple/Advanced 모드 전환, 자산 선택, 파라미터 조정
3. Confirm Modal -- 최종 리뷰, 면책 동의, Agent 생성

### 디자인 시스템

| 요소 | 스펙 |
|------|------|
| 배경 | `#111113` Deep Black, 다크 모드 기반 |
| Primary | `#22D3EE` Cyan-400, CTA 및 강조 |
| Premium | `#F59E0B` Amber 계열, 프리미엄 전략 표시 |
| Risk Low | Green-400 |
| Risk Medium | Yellow-400 |
| Risk Medium-High | Orange-400 |
| 카드 | 글래스모피즘, `bg-white/[0.02]` 반투명 |
| 아이콘 | SVG 직접 구현 + Lucide Solid |
| 라운딩 | `rounded-2xl` ~ `rounded-3xl` |
| 폰트 | `font-black` 타이틀, `text-[10px]` 라벨 |

---

## 7. 전략 비교 매트릭스

| 전략 | 카테고리 | 리스크 | 진입 조건 수 | 타임프레임 | 30d 수익 | Premium |
|------|----------|--------|:----------:|:--------:|:------:|:-------:|
| Conservative Trend Core | 추세추종 | Low | 4 | 4H | +3.2% | -- |
| Bollinger Mean Rev. | 평균회귀 | Med | 3 | 4H | +2.1% | -- |
| RSI Reversal Filtered | 평균회귀 | Med | 3 | 4H | +1.8% | -- |
| Donchian Breakout | 돌파 | M-H | 3 | 4H | +4.5% | -- |
| Multi-Factor Guard | 멀티시그널 | Med | 6 | 4H | +3.8% | -- |
| Turtle Trading | 터틀 | M-H | 4 | 4H | +5.1% | Premium |
| Williams Breakout | 윌리엄스 | M-H | 4 | 1D | +4.8% | Premium |
| Minervini VCP | 모멘텀 스윙 | Med | 7 | 1D | +4.2% | Premium |
| Livermore Pyramid | 단계분석 | M-H | 4 | 1D | +5.6% | Premium |
| *Volatility Overlay* | *리스크 OL* | *Low* | *--* | *--* | *--* | *--* |

---

## 8. 기술 지표 체계

전략 모듈에서 사용하는 **14개 기술 지표**:

| 지표 | 약칭 | 사용 전략 | 용도 |
|------|------|-----------|------|
| Exponential MA | EMA | M1, M5 | 추세 확인, 크로스오버 |
| Simple MA | SMA | M9 | Trend Template (50/150/200) |
| RSI | RSI | M2, M3, M5 | 과매도/과매수, 모멘텀 |
| MACD | MACD | M3, M5 | 히스토그램 모멘텀 확인 |
| Bollinger Bands | BB | M2 | 밴드 반등 / 이탈 |
| Donchian Channel | DC | M4, M7 | N봉 돌파 |
| ATR | ATR | M1, M4, M5, M7 | 동적 손절, 포지션 사이징 |
| Volume MA | Vol | 전 전략 | 거래량 확인 필터 |
| Williams %R | %R | M8 | 과매수/과매도 |
| Ultimate Oscillator | UO | M8 | 3중 모멘텀 |
| VCP | VCP | M9 | 변동성 축소 패턴 |
| Price Structure | PS | M10 | 기반 형성 감지 |
| Resistance Level | RL | M10 | 핵심 저항선 돌파 |
| OBV | OBV | -- | 온밸런스 볼륨 (확장) |

---

## 9. Premium 전략 -- 전설적 트레이더의 시스템

4개 Premium 전략은 투자 역사상 가장 성공적인 트레이더들의 검증된 방법론을 크립토에 맞게 적응시킨 것입니다:

| 트레이더 | 전략 | 실적 | 핵심 기여 |
|----------|------|------|-----------|
| **Richard Dennis** | Turtle Trading | $175M+ (터틀 실험) | N-Unit 포지션 사이징, 듀얼 시스템 |
| **Larry Williams** | Volatility Breakout | +11,376% (1987 WC) | K팩터 변동성 돌파, Williams %R |
| **Mark Minervini** | VCP Momentum | +334.8% (2021 USIC) | SEPA, Trend Template, VCP 패턴 |
| **Jesse Livermore** | Trend Pyramid | $100M (1929) | "최소 저항선", 피라미딩, 물타기 금지 |

Early Access 기간 동안 Premium 전략은 **무료**로 제공됩니다. 향후 유료 구독 또는 Level 5+ 사용자에게 무료 접근 예정.

---

## 10. 핵심 수치 요약

| 수치 | 의미 |
|:----:|------|
| **10** | 탑재된 전략 모듈 수 (시그널 9 + 리스크 오버레이 1) |
| **14** | 사용 기술지표 수 |
| **3중** | 안전장치 레이어 (일일/주간/변동성) |
| **8가지** | Exception Rules (절대 하지 않는 행동) |
| **4단계** | 변동성 버킷 (Low / Mid / High / Extreme) |
| **7중** | 최대 진입 확인 조건 (Minervini VCP) |
| **3분** | Simple Mode 설정 소요 시간 |
| **24/7** | Agent 자동 모니터링 |
| **0%** | 극단적 변동성에서의 포지션 크기 (= 거래 완전 중단) |
| **9** | 지원 거래소 수 (국내 2 + 해외 7) |

---

## 11. 경쟁 비교

| Feature | 타사 자동매매 봇 | Vision Quant Engine |
|---------|:----------------:|:-------------------:|
| 전략 투명성 | 블랙박스 또는 제한적 | 모든 파라미터 투명 공개 |
| 탑재 전략 수 | 1-3개 | **10개** (Premium 4 포함) |
| 리스크 제어 | 단순 손절 | **3중 안전장치** |
| 커스터마이징 | 제한적 | Simple + Advanced 이중 모드 |
| 자산 연동 | 별도 입금 필요 | 기존 CEX 자산 그대로 사용 |
| 변동성 대응 | 수동 | 자동 포지션 크기 조절 |
| 진입 확인 | 단일-이중 조건 | 멀티팩터 확인 (최대 7중) |
| 추격매수 방지 | 없음 | Exception Rule 원천 차단 |
| 연속 손실 보호 | 없음 | N회 연속 손실 시 자동 정지 |
| 설정 난이도 | 복잡 | 3분 Simple 모드 |
| 전설적 전략가 모델 | 없음 | Dennis / Williams / Minervini / Livermore |

---

## 12. 태그라인

### 메인
> **"전략은 투명하게, 리스크는 단단하게."**

### 서브
- "변동성이 올라가면, 포지션은 내려갑니다."
- "AI가 매매하고, 리스크 엔진이 지킵니다."
- "수익은 전략의 몫, 손실 제한은 엔진의 몫."
- "블랙박스 없이, 모든 결정에 이유가 있습니다."
- "손실에는 천장이 있습니다."

---

> **면책**: Vision Quant Engine은 Beta 서비스로 제공됩니다. 과거 성과는 미래 수익을 보장하지 않습니다. 자동매매로 인해 발생하는 손실에 대해 비전체인은 책임지지 않습니다. 시장 상황, 거래소 상태, 유동성, 슬리피지, 시스템 지연 등에 따라 예상과 다르게 동작할 수 있습니다.
