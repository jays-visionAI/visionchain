# Vision AI Chat - 업그레이드 계획서

> 가상화폐 전문 AI 어시스턴트로서의 서비스 품질을 근본적으로 향상시키기 위한 종합 계획

---

## 1. 현재 문제 분석

### 1.1 시세 답변 정확도 문제

| 증상 | 원인 | 심각도 |
|------|------|--------|
| BTC 가격을 묻는데 오래된 데이터 또는 추정가를 답변 | Streaming 모드(`generateTextStream`)에서 Tool Use 미지원 | **Critical** |
| "비트코인 얼마야?"에 학습 데이터 기반 답지 가격을 답변 | Tool 호출 실패 시 fallback이 없고, 학습 데이터로 대체 | **Critical** |
| 여러 코인 가격을 한번에 물어보면 일부만 정확 | `get_current_price` 툴이 단일 코인만 지원 | **High** |
| 시세 차트 데이터가 부정확한 수치로 렌더링 | 차트 데이터를 Tool 결과 없이 모델이 생성 | **High** |

### 1.2 시간/로케일 문제

| 증상 | 원인 | 심각도 |
|------|------|--------|
| 시간을 물으면 UTC로 답하거나 엉뚱한 시간대 | 시간 컨텍스트가 system prompt에는 있으나 모델이 무시할 때 있음 | **Medium** |
| "어제 BTC 가격" → 잘못된 날짜로 API 호출 | 날짜 계산 로직이 모델 의존적 | **Medium** |

### 1.3 아키텍처 문제

| 문제 | 상세 |
|------|------|
| **Streaming vs Non-Streaming 이중 경로** | `generateText`(non-streaming)만 Tool Use 가능, `generateTextStream`(streaming)은 Tool 미지원 → 현재 챗은 streaming 사용 중이므로 **시세 조회 Tool이 전혀 작동하지 않음** |
| **시스템 프롬프트 비대화** | 단일 시스템 프롬프트에 Bridge 규칙, 언어 규칙, CEX 규칙, Agent API 문서 등 모든 것이 포함 → 토큰 낭비 + 정확도 저하 |
| **대화 히스토리 처리** | 히스토리를 텍스트로 직렬화하여 주입 → 구조화된 multi-turn이 아님 |

---

## 2. 업그레이드 항목

### Phase 1: 핵심 시세 정확도 (즉시 적용)

#### 2.1 Streaming + Tool Use 통합 [P0]

**현재**: `generateTextStream` → Tool 미지원 → 시세 질문에 학습 데이터로 대답
**개선**: Streaming 모드에서도 Tool Call을 처리하는 하이브리드 방식 구현

```
[유저 입력] → [시세 키워드 감지?]
  ├─ YES → generateText (non-streaming, Tool Use ON) → 타이핑 애니메이션으로 표시
  └─ NO  → generateTextStream (streaming) → 기존 방식
```

**구현 방안**:

```typescript
// services/ai/index.ts - handleSend 라우팅 로직
const PRICE_PATTERNS = /가격|얼마|시세|현재|지금|price|how much|current|now|today|시장|market/i;
const COIN_PATTERNS = /비트코인|이더리움|솔라나|리플|도지|btc|eth|sol|xrp|doge|bnb|ada|dot|matic|pol|avax/i;

const needsToolUse = PRICE_PATTERNS.test(userMessage) || COIN_PATTERNS.test(userMessage);

if (needsToolUse) {
    // Non-streaming with Tool Use for accurate data
    const response = await generateText(fullPrompt, imageBase64, 'intent', userId, history);
    // Simulate typing animation on the final response
    simulateTyping(response);
} else {
    // Pure streaming for conversational responses
    const response = await generateTextStream(fullPrompt, onChunk, ...);
}
```

**작업 범위**:
- [ ] `Wallet.tsx` > `handleSend`에 라우팅 분기 추가
- [ ] `generateText`의 Tool Call 응답도 타이핑 애니메이션으로 표시하는 어댑터 구현
- [ ] Thinking Process 표시를 Tool Call 진행상황과 정합하도록 수정

---

#### 2.2 멀티 코인 가격 조회 Tool 추가 [P0]

**현재**: `get_current_price` → 단일 코인만 → "BTC, ETH, SOL 가격" 요청 시 3번 순차 호출
**개선**: `get_multiple_prices` 툴 추가 (배치 API 활용)

```typescript
// services/ai/tools.ts - 새 Tool 정의
{
    name: "get_multiple_prices",
    description: "Get real-time prices for multiple cryptocurrencies at once. More efficient than calling get_current_price multiple times. Use when user asks about 2+ coins.",
    parameters: {
        type: "object",
        properties: {
            symbols: {
                type: "array",
                items: { type: "string" },
                description: "Array of cryptocurrency symbols (e.g., ['btc', 'eth', 'sol'])"
            }
        },
        required: ["symbols"]
    }
}
```

```typescript
// services/ai/index.ts - Tool 핸들러 추가
} else if (name === 'get_multiple_prices') {
    const { marketDataService } = await import('../marketDataService');
    toolResult = await marketDataService.getMultiplePrices(args.symbols);
}
```

**작업 범위**:
- [ ] `tools.ts`에 `get_multiple_prices` 정의 추가
- [ ] `index.ts` (generateText)에 핸들러 추가
- [ ] 시스템 프롬프트에 "2개 이상 코인 가격 요청 시 get_multiple_prices 사용" 규칙 추가

---

#### 2.3 시세 hallucination 방지 강화 [P0]

**현재**: 모델이 Tool 호출 실패 시 학습 데이터 기반 가격을 답변
**개선**: 명시적 NEVER 규칙 + 답변 후처리 검증

```
시스템 프롬프트 추가 규칙:
ABSOLUTE RULE - PRICE DATA INTEGRITY:
- You MUST NEVER state a cryptocurrency price from memory or training data.
- If get_current_price or get_multiple_prices tool call fails or returns null, 
  you MUST say: "실시간 가격을 조회할 수 없습니다. 잠시 후 다시 시도해주세요."
- NEVER say "approximately", "around", "roughly" for prices - use exact tool data only.
- If the user asks "비트코인 얼마야?" and you cannot call a tool, DO NOT guess.
```

**작업 범위**:
- [ ] `criticalInstructions`에 가격 무결성 규칙 강화
- [ ] 응답 후처리: 가격 패턴 감지 후 Tool 결과 없이 가격이 포함된 경우 경고 추가
- [ ] Admin Dashboard의 Prompt Tuning에 이 규칙이 우선하도록 OVERRIDE 주석 추가

---

### Phase 2: 시간/컨텍스트 정확도 (1주 이내)

#### 2.4 시간 컨텍스트 Pre-Injection 강화 [P1]

**현재**: 시간 정보가 시스템 프롬프트에 포함되지만 모델이 무시할 수 있음
**개선**: 유저 메시지 앞에 시간 컨텍스트를 직접 주입

```typescript
// 유저 메시지 전처리
const enrichedPrompt = `
[REALTIME CONTEXT - ${new Date().toISOString()}]
Current Time (${userTimezone}): ${now.toLocaleString(userLocale, { ... })}
Today: ${todayStr}
Yesterday: ${yesterdayStr}

[User Message]
${userMessage}
`;
```

**작업 범위**:
- [ ] `handleSend`에서 유저 메시지 앞에 시간 컨텍스트 prefix 추가
- [ ] 시간 관련 질문 감지 시 명시적 타임존 안내 추가
- [ ] "어제", "지난주", "한달 전" 같은 상대 날짜를 절대 날짜로 변환하여 주입

---

#### 2.5 시장 데이터 Pre-Fetch + Context Enrichment [P1]

**현재**: 시세를 물어보면 Tool Call → API 호출 → 응답 지연
**개선**: 인기 코인 가격을 주기적으로 캐시하여 시스템 프롬프트에 미리 주입

```typescript
// services/ai/marketCache.ts - 새 파일
const POPULAR_COINS = ['btc', 'eth', 'sol', 'xrp', 'bnb', 'ada', 'doge', 'dot'];
let cachedPrices: Record<string, MarketPrice> = {};
let lastCacheTime = 0;
const CACHE_TTL = 60_000; // 1분

export async function getMarketContext(): Promise<string> {
    if (Date.now() - lastCacheTime > CACHE_TTL) {
        cachedPrices = await marketDataService.getMultiplePrices(POPULAR_COINS);
        lastCacheTime = Date.now();
    }
    
    return `[CACHED MARKET SNAPSHOT - Updated ${new Date(lastCacheTime).toLocaleTimeString()}]
${Object.entries(cachedPrices).map(([sym, p]) => 
    `${sym.toUpperCase()}: $${p.price.toLocaleString()} (${p.change24h > 0 ? '+' : ''}${p.change24h?.toFixed(2)}%)`
).join('\n')}
NOTE: For exact prices, still use get_current_price tool. This snapshot is for quick reference.`;
}
```

**장점**: 
- Tool Call 없이도 대략적인 가격 정보 제공 가능
- Tool Call 실패 시 fallback 역할
- 응답 속도 향상

**작업 범위**:
- [ ] `services/ai/marketCache.ts` 생성
- [ ] `generateText`와 `generateTextStream`의 시스템 프롬프트에 캐시 데이터 주입
- [ ] 캐시 갱신 주기를 Admin에서 설정 가능하도록 (선택)

---

#### 2.6 KRW 가격 지원 [P1]

**현재**: 모든 가격이 USD 기준 → 한국어 사용자에게 불편
**개선**: CoinGecko의 `vs_currencies=usd,krw` 활용

```typescript
// marketDataService.ts - getCurrentPrice 수정
const response = await axios.get(url, {
    params: { coins: symbol, currencies: 'usd,krw' }
});

// 응답 형태
{
    price: 64371.55,     // USD
    priceKrw: 88500000,  // KRW
    ...
}
```

**작업 범위**:
- [ ] Cloud Function `getMarketPrices` 수정 - KRW 환율 병행 조회
- [ ] `marketDataService.ts` - `getCurrentPrice` 응답에 KRW 추가
- [ ] Tool 결과에 KRW 포함 → AI가 한국어 유저에게 원화 가격 제공

---

### Phase 3: UX 및 구조 개선 (2주 이내)

#### 2.7 시스템 프롬프트 모듈화 [P2]

**현재**: 단일 `criticalInstructions` 문자열에 모든 규칙 포함 (~400줄)
**개선**: 유저 의도에 따라 필요한 모듈만 로딩

```
[Base Module]     - 언어/로케일, 페르소나, 응답 형식
[Price Module]    - 시세 조회 규칙, Tool 사용 규칙
[Transfer Module] - 송금/브릿지/스케줄 JSON 형식
[CEX Module]      - CEX 포트폴리오 분석 규칙
[Agent Module]    - Vision Chain Agent API 문서
[DeFi Module]     - DeFi Yield 검색 규칙
```

```typescript
const moduleSelector = (userMessage: string) => {
    const modules = ['base']; // 항상 포함
    
    if (PRICE_PATTERNS.test(userMessage)) modules.push('price');
    if (TRANSFER_PATTERNS.test(userMessage)) modules.push('transfer');
    if (CEX_PATTERNS.test(userMessage)) modules.push('cex');
    if (AGENT_PATTERNS.test(userMessage)) modules.push('agent');
    if (DEFI_PATTERNS.test(userMessage)) modules.push('defi');
    
    return modules;
};
```

**장점**:
- 토큰 사용량 40-60% 절감
- 모듈별 정확도 향상 (관련 없는 규칙이 혼란을 주지 않음)
- 유지보수 용이

**작업 범위**:
- [ ] `services/ai/prompts/` 디렉토리 생성
- [ ] 각 모듈을 별도 파일로 분리 (`base.ts`, `price.ts`, `transfer.ts`, ...)
- [ ] `moduleSelector` 구현 및 `generateText`/`generateTextStream`에 통합

---

#### 2.8 Structured Multi-Turn (대화 히스토리) [P2]

**현재**: 대화 히스토리를 텍스트로 직렬화 → `"User: ... AI: ..."`
**개선**: Gemini/DeepSeek의 native multi-turn 형식 활용

```typescript
// 현재 (비효율적)
const historyContext = previousHistory.map(m => 
    `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`
).join('\n');

// 개선 (native multi-turn)
const contents = previousHistory.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
}));
// 직접 Gemini API의 contents 배열에 주입
```

**작업 범위**:
- [ ] `geminiProvider.ts` - multi-turn contents 직접 지원
- [ ] `deepseekProvider.ts` - OpenAI 호환 messages 배열 지원
- [ ] 히스토리 최대 길이 제한 (최근 10턴 또는 토큰 한도)

---

#### 2.9 답변 품질 모니터링 시스템 [P2]

**현재**: 유저 피드백 버튼(좋아요/싫어요)이 있으나 Firebase에 저장되지 않음
**개선**: 피드백 수집 + 자동 품질 분석

```typescript
// 피드백 저장
saveFeedback({
    conversationId: sessionId,
    messageIndex: idx,
    feedback: 'positive' | 'negative',
    userQuery: originalQuery,
    aiResponse: response,
    toolsUsed: [...],
    timestamp: Date.now()
});

// Admin Dashboard - AI 품질 대시보드
// - 일별 긍정/부정 비율
// - 가장 많이 부정 받은 질문 유형
// - Tool 호출 성공/실패율
```

**작업 범위**:
- [ ] Firebase에 `ai_feedback` 컬렉션 생성
- [ ] 피드백 버튼 onClick 핸들러 구현
- [ ] Admin Dashboard에 AI Quality 탭 추가 (선택)

---

#### 2.10 에러 핸들링 & Graceful Degradation [P1]

**현재**: API 실패 시 "처리 중 오류가 발생했습니다" 일반 메시지
**개선**: 구체적인 실패 원인별 맞춤 안내

```typescript
const ERROR_RESPONSES = {
    RATE_LIMIT: {
        ko: '현재 요청이 많아 잠시 후 다시 시도해주세요. (약 30초 후)',
        en: 'Rate limit reached. Please try again in about 30 seconds.'
    },
    PRICE_API_FAIL: {
        ko: '시세 데이터를 가져오는 데 실패했습니다. CoinGecko 서비스를 확인 중입니다.',
        en: 'Failed to fetch price data. Checking CoinGecko service.'
    },
    TOOL_TIMEOUT: {
        ko: '데이터 조회 시간이 초과되었습니다. 다시 시도해주세요.',
        en: 'Data query timed out. Please try again.'
    },
    MODEL_ERROR: {
        ko: 'AI 모델 응답 오류입니다. 다른 모델로 전환을 시도합니다.',
        en: 'AI model response error. Trying to switch to another model.'
    }
};
```

**작업 범위**:
- [ ] 에러 타입 분류 체계 구현
- [ ] Tool 호출 타임아웃 설정 (5초)
- [ ] 모델 fallback 체인: Primary(DeepSeek) → Fallback(Gemini)

---

### Phase 4: 고급 기능 (1개월 이내)

#### 2.11 Streaming Tool Call 지원 (Gemini) [P3]

Gemini의 Server-Sent Events 기반 streaming에서 function call을 감지하여 중간에 처리:

```
[Stream Start] → 텍스트 청크 수신...
→ [Function Call 감지] → streaming 일시 중단
→ [Tool 실행] → 결과 주입
→ [Stream Resume] → 나머지 텍스트 수신
```

이렇게 하면 streaming UX를 유지하면서 정확한 시세 데이터 제공 가능.

#### 2.12 가격 알림 및 모니터링 [P3]

유저가 "BTC 7만 달러 넘으면 알려줘" 같은 요청 시 알림 설정:

```typescript
{
    intent: "price_alert",
    symbol: "btc",
    condition: "above",
    targetPrice: 70000,
    notifyMethod: "push"
}
```

#### 2.13 포트폴리오 기반 맞춤 인사이트 [P3]

유저의 보유 자산을 기반으로 proactive 시장 인사이트 제공:

```
"보유하신 ETH가 24시간 동안 5.2% 상승했습니다. 
현재 ASI 지수는 72/100(Bullish)이며, 
관련 뉴스로 ETH ETF 승인이 논의되고 있습니다."
```

---

## 3. 우선순위 로드맵

```
Week 1 [Phase 1 - Critical]:
├─ 2.1 Streaming + Tool Use 하이브리드 라우팅
├─ 2.2 멀티 코인 가격 조회 Tool
└─ 2.3 시세 hallucination 방지 규칙 강화

Week 2 [Phase 2 - Important]:
├─ 2.4 시간 컨텍스트 Pre-Injection
├─ 2.5 시장 데이터 캐시 & Context Enrichment
├─ 2.6 KRW 가격 지원
└─ 2.10 에러 핸들링 강화

Week 3-4 [Phase 3 - Enhancement]:
├─ 2.7 시스템 프롬프트 모듈화
├─ 2.8 Structured Multi-Turn
└─ 2.9 답변 품질 모니터링

Month 2+ [Phase 4 - Advanced]:
├─ 2.11 Streaming Tool Call
├─ 2.12 가격 알림
└─ 2.13 포트폴리오 인사이트
```

---

## 4. 예상 효과

| 지표 | 현재 | Phase 1 후 | Phase 2 후 |
|------|------|-----------|-----------|
| 시세 질문 정확도 | ~30% | ~90% | ~98% |
| 평균 응답 시간 | 3-5초 | 3-5초 | 2-4초 (캐시) |
| 시간 관련 질문 정확도 | ~60% | ~80% | ~95% |
| 토큰 사용량/요청 | ~3000 | ~3000 | ~1800 (모듈화) |
| KRW 가격 지원 | 미지원 | 미지원 | 지원 |

---

## 5. 기술 상세: 현재 아키텍처 진단

### 5.1 핵심 파일 구조

```
services/ai/
├── index.ts          # generateText (Tool O) + generateTextStream (Tool X) ← 핵심 문제
├── router.ts         # LLM 라우터 (Gemini/DeepSeek 전환)
├── tools.ts          # Tool 정의 (get_current_price, get_historical_price, ...)
├── types.ts          # 타입 정의
├── providers/
│   ├── geminiProvider.ts    # Gemini API (Tool Use 지원)
│   └── deepseekProvider.ts  # DeepSeek API (streaming만 지원)
└── utils.ts

services/
├── marketDataService.ts     # CoinGecko/Binance 시세 조회
└── vcnPriceService.ts       # VCN 자체 가격 (피보나치 엔진)

components/
├── Wallet.tsx               # handleSend() - AI 챗 메인 로직 (L.2973-3665)
└── wallet/
    └── WalletDashboard.tsx  # 챗 UI 렌더링
```

### 5.2 데이터 흐름 (현재)

```
[유저 입력] 
  → Wallet.tsx handleSend()
  → generateTextStream() (services/ai/index.ts L.624)
    → DeepSeek/Gemini streaming
    → Tool Call 불가 ← 여기가 문제
    → 학습 데이터 기반 가격 답변 (부정확)
  → 타이핑 애니메이션
  → 최종 메시지 표시
```

### 5.3 데이터 흐름 (개선 후)

```
[유저 입력]
  → Wallet.tsx handleSend()
  → [시세 키워드 감지?]
    ├─ YES → generateText() (Tool Use ON)
    │        → Gemini Function Calling
    │        → get_current_price / get_multiple_prices
    │        → Cloud Function → Binance/CoinGecko
    │        → Tool 결과 + AI 분석
    │        → 타이핑 애니메이션으로 표시
    └─ NO  → generateTextStream() (기존 streaming)
             → 일반 대화 응답
  → 최종 메시지 표시
```

---

## 6. 관련 버그 수정 (이번 세션)

### 6.1 모바일 챗 히스토리 버튼 (수정 완료)

**문제**: 모바일에서 챗 세션 히스토리 버튼 터치 시 드로어가 열리지 않음

**원인**:
- `z-index: 40` → Bottom Sheet 입력 영역(z-40)과 충돌
- 터치 타겟 크기 40px → 모바일 권장 최소치(48px) 미달
- `onClick`만 사용 → iOS Safari에서 300ms 터치 지연

**수정 내용** (`WalletDashboard.tsx` L.1182-1201):
- z-index를 `z-[52]`로 상향 (Bottom Sheet 위)
- 버튼 크기 `w-10 h-10` → `w-12 h-12` (48px)
- `onTouchEnd` 핸들러 추가 + `e.stopPropagation()`
- `touch-action: manipulation` 추가 (300ms 지연 제거)
- `-webkit-tap-highlight-color: transparent` 추가
