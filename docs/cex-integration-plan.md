# Vision Chain - CEX (업비트/빗썸) 통합 기획서

> 작성일: 2026-02-10
> 목적: 유저가 CEX 포트폴리오를 Vision Chain 월렛에 연동하여, (1) AI 포트폴리오 조언, (2) 자동 트레이딩봇을 활용할 수 있도록 하는 기능의 구현 가능성 및 방법론 분석

---

## 1. 거래소 API 비교 분석

### 1.1 업비트 (Upbit) API

| 항목 | 세부 내용 |
|------|-----------|
| **Base URL** | `https://api.upbit.com/v1` |
| **프로토콜** | REST API + WebSocket |
| **인증 방식** | JWT (JSON Web Token) - Access Key + Secret Key |
| **TLS** | TLS 1.2 이상 |
| **Content-Type** | `application/json` |

#### 주요 API 엔드포인트

**Quotation API (시세 조회 - 인증 불필요)**
- `GET /market/all` - 페어 목록 조회
- `GET /candles/seconds` - 초봉 캔들 조회
- `GET /candles/minutes/{unit}` - 분봉 캔들 조회
- `GET /candles/days` - 일봉 캔들 조회
- `GET /candles/weeks` - 주봉 캔들 조회
- `GET /candles/months` - 월봉 캔들 조회
- `GET /trades/ticks` - 최근 체결 내역 조회
- `GET /ticker` - 현재가 정보 조회
- `GET /orderbook` - 호가 정보 조회

**Exchange API (거래/자산 관리 - 인증 필요)**
- `GET /accounts` - **계정 잔고 조회**
- `POST /orders` - **주문 생성** (지정가/시장가)
- `DELETE /order` - 주문 취소
- `GET /order` - 개별 주문 조회
- `GET /orders/open` - 체결 대기 주문 조회
- `GET /orders/closed` - 종료 주문 조회
- `POST /withdraws/coin` - 디지털 자산 출금
- `GET /withdraws` - 출금 내역 조회
- `GET /deposits` - 입금 내역 조회

**WebSocket**
- 실시간 현재가 구독
- 실시간 체결 정보 구독
- 실시간 호가 정보 구독
- 실시간 계정 잔고 변동 구독 (인증 필요)
- 실시간 주문 생성/체결/취소 구독 (인증 필요)

#### Rate Limit

| API 유형 | 제한 | 단위 |
|----------|------|------|
| 주문 REST API | 초당 8회 | 계정 단위 |
| 주문 외 REST API | 초당 30회 | 계정 단위 |
| 시세 REST API | 초당 10회 | IP 단위 |
| WebSocket 연결 (인증) | 초당 5회 | 계정 단위 |
| WebSocket 데이터 (인증) | 초당 5회, 분당 100회 | 계정 단위 |
| WebSocket (비인증) | 초당 5회, 분당 100회 | IP 단위 |

#### 보안 제약사항
- API 키당 **최대 10개 IP 화이트리스트** 등록 가능
- API 키 발급은 **PC 웹에서만** 가능 (KYC + 2FA 필수)
- API 키별 권한 설정: 자산조회, 주문, 출금 (개별 선택)
- 출금 시 **트래블룰** 적용 (100만원 이상)
- 원화 입금 후 **24~72시간 출금 지연제**

---

### 1.2 빗썸 (Bithumb) API

| 항목 | 세부 내용 |
|------|-----------|
| **Base URL (API 2.0)** | `https://api.bithumb.com/v2` |
| **프로토콜** | REST API + WebSocket |
| **인증 방식** | JWT (Access Key + Secret Key) |
| **Content-Type** | JSON (POST/PUT/DELETE) |

#### 주요 API 엔드포인트

**Public API (인증 불필요)**
- 마켓 코드 조회
- 캔들 조회 (분/일/주/월)
- 최근 체결 내역 조회
- 현재가 (Ticker) 조회
- 호가 (Orderbook) 조회

**Private API (인증 필요)**
- `GET /accounts` - **전체 계좌 조회**
- `GET /orders/chance` - 주문 가능 정보
- `GET /order` - 개별 주문 조회
- `GET /orders` - 주문 리스트 조회
- `POST /orders` - **주문하기** [BETA]
- `DELETE /order` - 주문 취소 접수 [BETA]
- **알고리즘 주문 (TWAP)** - 주문/조회/취소
- 코인/원화 출금 관련 API
- 코인/원화 입금 관련 API

**WebSocket**
- 실시간 시세 데이터 구독

#### Rate Limit

| API 유형 | 제한 |
|----------|------|
| Public API | 초당 150회 |
| Private API | 초당 140회 |
| WebSocket 데이터 요청 | 초당 5회, 분당 100회 |

> 빗썸의 Rate Limit이 업비트보다 상당히 관대함 (Private API 기준 약 17배)

#### 보안 제약사항
- API 키당 **최대 5개 고정 IP** 등록
- 조회/거래/출금 권한 개별 설정
- 화이트리스트 출금 방식 (사전 주소 등록 필수)
- 트래블룰 미연동 거래소의 경우 **본인 명의 지갑만** 출금 가능

---

### 1.3 두 거래소 비교 요약

| 비교 항목 | 업비트 | 빗썸 |
|-----------|--------|------|
| API 버전 | v1 (성숙) | v2 (일부 BETA) |
| 인증 | JWT | JWT |
| 주문 Rate Limit | 초당 8회 | 초당 140회 |
| 시세 Rate Limit | 초당 10회 | 초당 150회 |
| IP 화이트리스트 | 최대 10개 | 최대 5개 |
| WebSocket | 시세 + 자산/주문 | 시세 위주 |
| 알고리즘 주문 | 미지원 | TWAP 지원 |
| API 안정성 | 높음 (레퍼런스 풍부) | 보통 (주문 API BETA) |
| 시장 점유율 | 약 75-80% | 약 10-15% |

---

## 2. Feature 1: AI 포트폴리오 어드바이저

### 2.1 개요

유저가 업비트/빗썸 계정의 API Key를 Vision Chain 월렛에 등록하면, AI가 유저의 포트폴리오를 분석하고 조언을 제공하는 기능.

### 2.2 구현 가능성: **매우 높음**

이 기능은 **읽기 전용(자산조회)** 권한만으로 구현 가능하므로 보안 리스크가 낮고, 기술적 난이도도 비교적 낮습니다.

### 2.3 아키텍처

```
[유저 월렛 앱]
      |
      v
[API Key 등록] ----> [Firebase: 암호화 저장]
      |
      v
[CEX API Proxy (Cloud Functions)]
      |
      +---> Upbit API  (GET /accounts, GET /ticker)
      +---> Bithumb API (GET /accounts, GET /ticker)
      |
      v
[Portfolio Aggregator Service]
      |
      v
[Vision AI Agent (GPT/Gemini)]
      |
      v
[포트폴리오 분석 리포트]
      |
      v
[유저에게 조언 전달 (채팅 인터페이스)]
```

### 2.4 핵심 데이터 플로우

#### Step 1: API Key 등록 및 저장
```typescript
// API Key는 AES-256-GCM으로 암호화하여 Firestore에 저장
interface CexApiCredential {
  exchange: 'upbit' | 'bithumb';
  accessKey: string;        // 암호화 저장
  secretKey: string;        // 암호화 저장
  permissions: string[];    // ['balance_read'] - 최소 권한만
  registeredAt: string;
  lastSyncAt: string;
  status: 'active' | 'expired' | 'error';
}
```

#### Step 2: 포트폴리오 데이터 수집
```typescript
// 업비트 잔고 조회 예시
interface UpbitAccount {
  currency: string;          // "BTC"
  balance: string;           // "1.0"
  locked: string;            // "0.0" (주문 잠금)
  avg_buy_price: string;     // "50000000"
  avg_buy_price_modified: boolean;
  unit_currency: string;     // "KRW"
}

// 빗썸 잔고 조회 예시
interface BithumbAccount {
  currency: string;
  balance: string;
  locked: string;
  avg_buy_price: string;
  unit_currency: string;
}
```

#### Step 3: AI 분석 프롬프트 구성
```typescript
interface PortfolioAnalysisInput {
  // 보유 자산 정보
  holdings: {
    asset: string;
    amount: number;
    avgBuyPrice: number;
    currentPrice: number;
    profitLoss: number;
    profitLossPercent: number;
    allocationPercent: number;
  }[];
  
  // 시장 컨텍스트
  marketContext: {
    btcDominance: number;
    totalMarketCap: number;
    fearGreedIndex: number;
    majorTrends: string[];
  };
  
  // 유저 프로필
  userProfile: {
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    investmentGoal: 'short_term' | 'medium_term' | 'long_term';
    totalInvestment: number;
  };
}
```

#### Step 4: AI 조언 출력 유형
```typescript
interface PortfolioAdvice {
  summary: string;                    // 전체 포트폴리오 평가
  riskScore: number;                  // 1-100 리스크 점수
  diversificationScore: number;       // 분산 투자 점수
  
  recommendations: {
    type: 'rebalance' | 'buy' | 'sell' | 'hold' | 'warning';
    asset: string;
    reason: string;
    suggestedAction: string;
    confidence: number;               // 0-1
  }[];
  
  alerts: {
    type: 'risk' | 'opportunity' | 'info';
    message: string;
  }[];
  
  marketOutlook: string;
}
```

### 2.5 UI/UX 설계

기존 Vision Chain의 **WalletDashboard** AI 채팅 인터페이스에 자연스럽게 통합:

1. **포트폴리오 연동 카드**: Wallet 사이드바에 "CEX 연동" 섹션 추가
2. **포트폴리오 대시보드**: 파이 차트 + 자산별 수익률 테이블
3. **AI 분석 리포트**: 주기적 자동 분석 + 사용자 질문 기반 분석
4. **Quick Actions**: "포트폴리오 분석해줘", "리밸런싱 제안해줘" 등

### 2.6 구현 단계

| Phase | 내용 | 예상 기간 |
|-------|------|-----------|
| Phase 1 | API Key 등록 UI + 암호화 저장 | 1주 |
| Phase 2 | CEX API Proxy (Cloud Functions) | 1주 |
| Phase 3 | Portfolio Aggregator + 현재가 매핑 | 1주 |
| Phase 4 | AI 분석 프롬프트 엔지니어링 | 1주 |
| Phase 5 | 대시보드 UI + 차트 | 1~2주 |
| Phase 6 | 알림 + 주기적 분석 | 1주 |
| **합계** | | **6~7주** |

### 2.7 주의 사항

- **API Key 보안**: 절대 클라이언트에 노출하지 않음. Cloud Functions에서만 복호화/사용
- **면책 조항**: AI 조언은 투자 권유가 아님을 명확히 고지 (법적 필수)
- **데이터 최신성**: 잔고는 캐시 + 주기적 갱신 (5분 간격 권장)
- **자산조회 전용**: 거래/출금 권한 요구하지 않음

---

## 3. Feature 2: AI 트레이딩봇

### 3.1 개요

AI가 시장 분석을 기반으로 자동으로 매수/매도 주문을 실행하는 트레이딩봇.

### 3.2 구현 가능성: **높음 (단, 법적/보안 고려사항 중대)**

기술적으로는 두 거래소 모두 주문 API를 제공하므로 구현 가능. 그러나 법적 규제와 보안 문제에 대한 철저한 대비가 필요합니다.

### 3.3 법적 환경

#### 가상자산이용자보호법 (2024.07.18 시행)
- **자동매매 봇 자체는 합법**: 증권 시장에서도 활용되는 일반적인 거래 방식
- **불법의 핵심은 '불공정 행위'**: 시세조종, 허위 거래량 부풀리기 등은 **형사처벌** 대상
- **처벌 수준**: 최고 무기징역 가능 (2026년 2월 첫 실형 선고 사례 발생)

#### Vision Chain 서비스로서의 주의사항
1. 유저 개별 자산에 대한 **개인 투자 보조 도구**로 포지셔닝 (정당)
2. 시세조종 의도가 없는 **정상적인 거래 패턴** 보장
3. **투자 자문업 등록** 검토 필요 (자본시장법 관련)
4. 서비스 이용약관에 **면책 조항** 필수

### 3.4 아키텍처

```
[유저 설정]
    |
    v
[Trading Strategy Configuration]
    |   - 전략 선택 (DCA, Grid, Momentum 등)
    |   - 리스크 파라미터 설정
    |   - 투자 금액 한도 설정
    |
    v
[Trading Engine (Cloud Functions / Dedicated Server)]
    |
    +---> [Market Data Collector]
    |         |
    |         +---> Upbit WebSocket (실시간 시세)
    |         +---> Bithumb WebSocket (실시간 시세)
    |         +---> 외부 지표 (Fear & Greed, BTC Dominance 등)
    |
    +---> [AI Strategy Engine (Gemini/GPT)]
    |         |
    |         +---> 기술적 분석 (RSI, MACD, BB 등)
    |         +---> 시장 센티먼트 분석
    |         +---> 포지션 사이징
    |
    +---> [Order Executor]
    |         |
    |         +---> [Risk Manager] (손절/익절/일일한도)
    |         |
    |         +---> Upbit POST /orders
    |         +---> Bithumb POST /orders
    |
    +---> [Trade Logger (Firestore)]
    |
    +---> [Notification Service]
              |
              +---> Push / Email / In-App
```

### 3.5 트레이딩 전략 유형

#### 3.5.1 DCA (Dollar Cost Averaging) - 난이도: 낮음
```typescript
interface DCAConfig {
  asset: string;                    // "KRW-BTC"
  exchange: 'upbit' | 'bithumb';
  intervalHours: number;            // 매수 주기 (예: 24시간)
  amountPerOrder: number;           // 회당 매수 금액 (KRW)
  maxTotalInvestment: number;       // 총 투자 한도
  daysToRun: number;                // 실행 일수
  pauseOnHighVolatility: boolean;   // 변동성 높을 때 일시정지
}
```

#### 3.5.2 Grid Trading - 난이도: 중간
```typescript
interface GridConfig {
  asset: string;
  exchange: 'upbit' | 'bithumb';
  upperPrice: number;               // 상단 가격
  lowerPrice: number;               // 하단 가격
  gridCount: number;                // 그리드 수
  totalInvestment: number;          // 총 투자금
  profitPerGrid: number;            // 그리드당 수익률 목표
}
```

#### 3.5.3 AI 모멘텀 - 난이도: 높음
```typescript
interface MomentumConfig {
  assets: string[];                 // 모니터링 대상 자산 목록
  exchange: 'upbit' | 'bithumb';
  aiModel: 'conservative' | 'balanced' | 'aggressive';
  maxPositionSize: number;          // 최대 포지션 크기
  stopLossPercent: number;          // 손절 비율
  takeProfitPercent: number;        // 익절 비율
  dailyTradeLimit: number;          // 일일 거래 횟수 제한
  maxDrawdown: number;              // 최대 허용 손실
}
```

### 3.6 핵심 컴포넌트 설계

#### Risk Manager (가장 중요)
```typescript
interface RiskParameters {
  // 주문 제한
  maxSingleOrderAmount: number;     // 단일 주문 최대 금액
  maxDailyOrderCount: number;       // 일일 최대 주문 수
  maxDailyVolume: number;           // 일일 최대 거래량 (KRW)
  
  // 손실 제한
  maxDrawdownPercent: number;       // 최대 허용 누적 손실 (%)
  stopLossPerTrade: number;         // 거래당 손절 (%)
  dailyLossLimit: number;           // 일일 최대 손실 (KRW)
  
  // 비상 정지
  emergencyStopEnabled: boolean;
  emergencyStopConditions: {
    priceDropPercent: number;        // 급락 감지 (%)
    volumeSpikeMultiplier: number;   // 거래량 급증 감지
    consecutiveLosses: number;       // 연속 손실 횟수
  };
  
  // 알림
  alertOnEveryTrade: boolean;
  alertOnLoss: boolean;
  alertThresholdPercent: number;
}
```

#### Order Executor - 업비트 예시
```typescript
// JWT 생성
function generateUpbitJWT(accessKey: string, secretKey: string, query?: string): string {
  const payload: any = {
    access_key: accessKey,
    nonce: uuidv4(),
    timestamp: Date.now()
  };
  
  if (query) {
    const queryHash = crypto.createHash('sha512').update(query).digest('hex');
    payload.query_hash = queryHash;
    payload.query_hash_alg = 'SHA512';
  }
  
  return jwt.sign(payload, secretKey);
}

// 주문 실행
async function executeOrder(params: {
  exchange: 'upbit' | 'bithumb';
  market: string;       // "KRW-BTC"
  side: 'bid' | 'ask';  // bid=매수, ask=매도
  volume?: string;       // 주문 수량
  price?: string;        // 주문 단가
  ordType: 'limit' | 'price' | 'market';  // 지정가/시장가매수/시장가매도
}): Promise<OrderResult> {
  // Rate limit 체크
  // Risk Manager 검증
  // 주문 실행
  // 결과 로깅
}
```

### 3.7 인프라 고려사항

#### Cloud Functions vs Dedicated Server

| 항목 | Cloud Functions | Dedicated Server |
|------|----------------|-----------------|
| WebSocket 지원 | 불가 (HTTP 트리거 기반) | 가능 |
| 상시 실행 | Cold Start 문제 | 상시 가동 |
| 비용 | 사용량 비례 | 고정비 |
| 지연시간 | 높음 (100~500ms) | 낮음 (10~50ms) |
| 확장성 | 자동 확장 | 수동 확장 |
| **권장** | DCA, 저빈도 전략 | Grid, 모멘텀 전략 |

**권장 아키텍처**: 
- **Phase 1 (DCA)**: Cloud Scheduler + Cloud Functions (비용 효율적)
- **Phase 2 (Grid/AI)**: Google Cloud Run (컨테이너 기반, WebSocket 지원)
- **Phase 3 (고빈도)**: GCE or Dedicated VPS (한국 리전, 최소 지연시간)

### 3.8 구현 단계

| Phase | 내용 | 예상 기간 |
|-------|------|-----------|
| Phase 1 | API Key 등록 + 암호화 (Feature 1과 공유) | 공유 |
| Phase 2 | Risk Manager 구현 | 2주 |
| Phase 3 | DCA 봇 (가장 단순) | 2주 |
| Phase 4 | Grid Trading 봇 | 3주 |
| Phase 5 | AI 모멘텀 봇 | 4주 |
| Phase 6 | 백테스팅 엔진 | 2주 |
| Phase 7 | 모니터링 대시보드 | 2주 |
| Phase 8 | 알림 시스템 | 1주 |
| **합계** | | **약 16주** |

---

## 4. 공통 인프라

### 4.1 API Key 보안 설계

```
[유저 입력: Access Key + Secret Key]
      |
      v
[Client-Side] --- HTTPS (TLS 1.3) ---> [Cloud Functions]
                                              |
                                              v
                                    [AES-256-GCM 암호화]
                                              |
                                              v
                                    [Firestore: 암호화된 Key 저장]
                                    [Cloud KMS: 마스터 키 관리]
```

- **절대 원칙**: API Key는 클라이언트에서 절대 복호화하지 않음
- **Cloud KMS**: Google Cloud Key Management Service로 마스터 키 관리
- **접근 제어**: Cloud Functions의 서비스 계정만 복호화 가능
- **감사 로그**: 모든 API Key 접근은 Cloud Audit Logs에 기록

### 4.2 데이터 모델 (Firestore)

```
/users/{userId}/
  /cex_credentials/{credentialId}     // 암호화된 API Key
    - exchange: 'upbit' | 'bithumb'
    - encryptedAccessKey: string
    - encryptedSecretKey: string
    - permissions: string[]
    - status: 'active' | 'expired' | 'revoked'
    - createdAt: Timestamp
    - lastUsedAt: Timestamp
  
  /portfolio_snapshots/{snapshotId}   // 포트폴리오 스냅샷
    - exchange: string
    - assets: Array<AssetSnapshot>
    - totalValueKRW: number
    - snapshotAt: Timestamp
  
  /trading_bots/{botId}               // 트레이딩봇 설정
    - strategy: 'dca' | 'grid' | 'momentum'
    - exchange: string
    - config: StrategyConfig
    - status: 'running' | 'paused' | 'stopped'
    - performance: BotPerformance
    - createdAt: Timestamp
  
  /trade_logs/{logId}                 // 거래 로그
    - botId: string
    - exchange: string
    - market: string
    - side: 'buy' | 'sell'
    - price: number
    - volume: number
    - total: number
    - orderId: string
    - status: 'pending' | 'filled' | 'cancelled'
    - pnl: number
    - executedAt: Timestamp
```

### 4.3 모니터링 및 알림

```typescript
// 알림 유형
type TradingNotification = 
  | { type: 'order_executed'; details: OrderDetails }
  | { type: 'stop_loss_triggered'; details: StopLossDetails }
  | { type: 'daily_report'; details: DailyReport }
  | { type: 'emergency_stop'; reason: string }
  | { type: 'api_key_error'; exchange: string }
  | { type: 'rate_limit_warning'; exchange: string }
  | { type: 'portfolio_alert'; message: string };
```

---

## 5. 로드맵 및 추천 우선순위

### Phase 1: 포트폴리오 조회 + AI 조언 (MVP)
> 예상 기간: 6~7주 | 리스크: 낮음

1. API Key 등록/관리 UI
2. CEX 잔고 조회 Cloud Function
3. 포트폴리오 대시보드 (차트 + 테이블)
4. AI 분석 통합 (기존 Vision AI Agent 활용)
5. 기본 알림

**이 Phase만으로도 유저에게 상당한 가치를 제공할 수 있음**

### Phase 2: DCA 자동매수 봇
> 예상 기간: 4주 | 리스크: 중간

1. Risk Manager 기본 구현
2. DCA 전략 엔진
3. Cloud Scheduler 기반 자동 실행
4. 거래 로그 + 수익률 대시보드

### Phase 3: Grid Trading 봇
> 예상 기간: 5주 | 리스크: 중~높

1. Grid 전략 엔진
2. WebSocket 기반 실시간 가격 모니터링
3. Cloud Run 마이그레이션
4. 백테스팅 엔진

### Phase 4: AI 모멘텀 봇
> 예상 기간: 6주 | 리스크: 높음

1. AI 기반 시장 분석 엔진
2. 기술적 지표 계산기
3. 고급 Risk Manager
4. 성과 분석 대시보드

---

## 6. 리스크 및 대응 방안

| 리스크 | 심각도 | 대응 방안 |
|--------|--------|-----------|
| API Key 유출 | **Critical** | Cloud KMS + 암호화 + 최소 권한 원칙 |
| 법적 규제 (투자자문업) | **High** | 법률 자문 + 면책 조항 + "정보 제공" 포지셔닝 |
| 시세조종 오해 | **High** | 거래 패턴 모니터링 + 거래량 제한 + 행동 로깅 |
| 거래소 API 장애 | **Medium** | 재시도 로직 + 폴백 + 비상 정지 |
| Rate Limit 초과 | **Medium** | Rate Limiter 구현 + 요청 큐 |
| 사용자 자산 손실 | **High** | 면책 조항 + 손실 한도 설정 필수 + 교육 |
| 거래소 정책 변경 | **Medium** | API 추상화 레이어로 거래소 교체 용이하게 |

---

## 7. 기술 스택 요약

| 영역 | 기술 |
|------|------|
| Frontend | React + TypeScript (기존 Vision Chain) |
| Backend | Firebase Cloud Functions (Phase 1-2) / Cloud Run (Phase 3+) |
| Database | Firestore |
| 암호화 | AES-256-GCM + Google Cloud KMS |
| AI | Gemini API / OpenAI GPT (기존 통합) |
| 차트 | lightweight-charts (TradingView) / recharts |
| 스케줄링 | Cloud Scheduler |
| 모니터링 | Cloud Logging + Cloud Monitoring |
| 알림 | FCM + Resend Email (기존 인프라 활용) |

---

## 8. 결론

### 구현 가능성 요약

| 기능 | 가능성 | 난이도 | 시급성 |
|------|--------|--------|--------|
| AI 포트폴리오 조언 | **매우 높음** | 중간 | 높음 (MVP) |
| DCA 자동매수 | **높음** | 중간 | 중간 |
| Grid Trading | **높음** | 높음 | 낮음 |
| AI 모멘텀 트레이딩 | **가능** | 매우 높음 | 낮음 |

### 핵심 권장사항

1. **Phase 1 (AI 조언)부터 시작** - 낮은 리스크로 높은 가치 제공, 읽기 전용이므로 보안 부담 적음
2. **법률 자문 선행** - 트레이딩봇(Phase 2+) 진행 전 투자자문업 등록 여부 확인 필수
3. **보안 최우선** - API Key 관리는 Cloud KMS 기반의 엔터프라이즈급 보안 적용
4. **면책 조항 철저** - "정보 제공 서비스"로 명확히 포지셔닝, 투자 권유 아님을 고지
5. **점진적 확장** - DCA(단순) -> Grid(중간) -> AI 모멘텀(복잡) 순서로 확장
