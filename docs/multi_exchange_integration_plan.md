# Multi-Exchange Full API Integration Plan

Binance, Bybit, Bitget, OKX, KuCoin, MEXC, Bitkub 7개 거래소의 **Spot + Perpetual Futures + Margin** 전체 API 연동

---

## 현재 아키텍처

- **Backend**: `functions/index.js` — `UpbitClient`, `BithumbClient` (JWT, KRW 기반)
- **Frontend**: `cexService.ts` — exchange union `'upbit' | 'bithumb'`
- **Sync**: `performCexSync()` — `getAccounts()` + `getTickers()` → 자산 정규화

---

## 거래소별 전체 API 스펙

### 1. Binance

| 항목 | Spot | USDT-M Futures | COIN-M Futures | Margin |
|------|------|----------------|----------------|--------|
| Base URL | `api.binance.com` | `fapi.binance.com` | `dapi.binance.com` | `api.binance.com` |
| Balance | `GET /api/v3/account` | `GET /fapi/v3/balance` | `GET /dapi/v1/balance` | `GET /sapi/v1/margin/account` |
| Position | - | `GET /fapi/v3/positionRisk` | `GET /dapi/v1/positionRisk` | - |
| Ticker | `GET /api/v3/ticker/price` | `GET /fapi/v1/ticker/price` | `GET /dapi/v1/ticker/price` | (same as spot) |
| Order | `POST /api/v3/order` | `POST /fapi/v1/order` | `POST /dapi/v1/order` | `POST /sapi/v1/margin/order` |
| Open Orders | `GET /api/v3/openOrders` | `GET /fapi/v1/openOrders` | `GET /dapi/v1/openOrders` | `GET /sapi/v1/margin/openOrders` |
| Leverage | - | `POST /fapi/v1/leverage` | `POST /dapi/v1/leverage` | - |
| Margin Mode | - | `POST /fapi/v1/marginType` | `POST /dapi/v1/marginType` | - |
| Kline | `GET /api/v3/klines` | `GET /fapi/v1/klines` | `GET /dapi/v1/klines` | (same as spot) |
| Auth | HMAC-SHA256 → hex | 동일 | 동일 | 동일 |
| Headers | `X-MBX-APIKEY` | 동일 | 동일 | 동일 |

---

### 2. Bybit (Unified Account v5)

| 항목 | Endpoint | 비고 |
|------|----------|------|
| Base URL | `api.bybit.com` | |
| Balance | `GET /v5/account/wallet-balance?accountType=UNIFIED` | Spot+Futures 통합 |
| Position | `GET /v5/position/list?category=linear` | linear=USDT perp |
| Position (Inverse) | `GET /v5/position/list?category=inverse` | |
| Ticker | `GET /v5/market/tickers?category=spot` | category: spot/linear/inverse |
| Order | `POST /v5/order/create` | category로 상품 구분 |
| Open Orders | `GET /v5/order/realtime` | |
| Leverage | `POST /v5/position/set-leverage` | |
| Margin Mode | `POST /v5/account/set-margin-mode` | |
| Kline | `GET /v5/market/kline` | |
| Auth | HMAC-SHA256 → hex | |
| Headers | `X-BAPI-API-KEY`, `X-BAPI-TIMESTAMP`, `X-BAPI-SIGN`, `X-BAPI-RECV-WINDOW` | |

> Bybit Unified Account: Spot, USDT Perp, USDC Perp, Inverse 모두 하나의 API 구조

---

### 3. Bitget (v2)

| 항목 | Spot | Futures (Mix) |
|------|------|---------------|
| Base URL | `api.bitget.com` | `api.bitget.com` |
| Balance | `GET /api/v2/spot/account/assets` | `GET /api/v2/mix/account/accounts?productType=USDT-FUTURES` |
| Position | - | `GET /api/v2/mix/position/all-position?productType=USDT-FUTURES` |
| Ticker | `GET /api/v2/spot/market/tickers` | `GET /api/v2/mix/market/tickers?productType=USDT-FUTURES` |
| Order | `POST /api/v2/spot/trade/place-order` | `POST /api/v2/mix/order/place-order` |
| Open Orders | `GET /api/v2/spot/trade/unfilled-orders` | `GET /api/v2/mix/order/orders-pending` |
| Leverage | - | `POST /api/v2/mix/account/set-leverage` |
| Margin Mode | - | `POST /api/v2/mix/account/set-margin-mode` |
| Kline | `GET /api/v2/spot/market/candles` | `GET /api/v2/mix/market/candles` |
| Auth | HMAC-SHA256 → **base64** | 동일 |
| Headers | `ACCESS-KEY`, `ACCESS-TIMESTAMP`, `ACCESS-PASSPHRASE`, `ACCESS-SIGN` | **Passphrase 필요** |

---

### 4. OKX (Unified Account v5)

| 항목 | Endpoint | 비고 |
|------|----------|------|
| Base URL | `www.okx.com` | |
| Balance | `GET /api/v5/account/balance` | 통합 계좌 |
| Position | `GET /api/v5/account/positions` | instType: SWAP/FUTURES/MARGIN |
| Ticker | `GET /api/v5/market/tickers?instType=SPOT` | SPOT/SWAP/FUTURES |
| Order | `POST /api/v5/trade/order` | |
| Open Orders | `GET /api/v5/trade/orders-pending` | |
| Leverage | `POST /api/v5/account/set-leverage` | |
| Margin Mode | `POST /api/v5/account/set-position-mode` | |
| Kline | `GET /api/v5/market/candles` | |
| Auth | HMAC-SHA256 → **base64** | timestamp=ISO 8601 |
| Headers | `OK-ACCESS-KEY`, `OK-ACCESS-SIGN`, `OK-ACCESS-TIMESTAMP`, `OK-ACCESS-PASSPHRASE` | **Passphrase 필요** |

> OKX Unified: Spot, Margin, Perpetual Swap, Futures, Options 모두 통합

---

### 5. KuCoin

| 항목 | Spot | Futures |
|------|------|---------|
| Base URL | `api.kucoin.com` | `api-futures.kucoin.com` |
| Balance | `GET /api/v1/accounts?type=trade` | `GET /api/v1/account-overview` |
| Position | - | `GET /api/v1/positions` |
| Ticker | `GET /api/v1/market/allTickers` | `GET /api/v1/contracts/active` + ticker |
| Order | `POST /api/v1/orders` | `POST /api/v1/orders` (futures) |
| Open Orders | `GET /api/v1/orders?status=active` | `GET /api/v1/orders?status=active` |
| Leverage | - | `POST /api/v1/position/risk-limit-level/change` |
| Margin Mode | - | via position endpoint |
| Kline | `GET /api/v1/market/candles` | `GET /api/v1/kline/query` |
| Auth | HMAC-SHA256 → **base64** | 동일 |
| Headers | `KC-API-KEY`, `KC-API-SIGN`, `KC-API-TIMESTAMP`, `KC-API-PASSPHRASE`, `KC-API-KEY-VERSION=2` | **Passphrase 필요** (v2 서명) |

> KuCoin: Spot과 Futures가 **별도 Base URL** (주의)

---

### 6. MEXC

| 항목 | Spot | Futures |
|------|------|---------|
| Base URL | `api.mexc.com` | `contract.mexc.com` |
| Balance | `GET /api/v3/account` | `GET /api/v1/private/account/assets` |
| Position | - | `GET /api/v1/private/position/open_positions` |
| Ticker | `GET /api/v3/ticker/price` | `GET /api/v1/contract/ticker` |
| Order | `POST /api/v3/order` | `POST /api/v1/private/order/submit` |
| Open Orders | `GET /api/v3/openOrders` | `GET /api/v1/private/order/list/open_orders` |
| Auth | HMAC-SHA256 → hex | 동일 |
| Headers | `ApiKey`, `Request-Time`, `Signature` | 동일 |

> MEXC Futures API: **기관 사용자 제한** — 일반 사용자는 Spot만 가능할 수 있음. 향후 해제 대비 연결.

---

### 7. Bitkub

| 항목 | Spot Only |
|------|-----------|
| Base URL | `api.bitkub.com` |
| Balance | `POST /api/v3/market/wallet` |
| Ticker | `GET /api/v3/market/ticker` |
| Order | `POST /api/v3/market/place-bid` / `place-ask` |
| Open Orders | `POST /api/v3/market/my-open-orders` |
| Kline | `GET /tradingview/history` |
| Auth | HMAC-SHA256 → hex |
| Headers | `X-BTK-APIKEY`, `X-BTK-TIMESTAMP`, `X-BTK-SIGN` |

> Bitkub: **Futures/Margin 없음** — Spot 전용. THB 기반.

---

## 전체 API 메서드 매핑 (Exchange Client Interface)

```typescript
interface ExchangeClient {
  // === Spot ===
  getSpotBalance(): Promise<SpotAsset[]>
  getSpotTickers(symbols?: string[]): Promise<Ticker[]>
  placeSpotOrder(params: OrderParams): Promise<OrderResult>
  getSpotOpenOrders(symbol?: string): Promise<Order[]>
  cancelSpotOrder(orderId: string, symbol: string): Promise<void>
  getSpotKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>
  
  // === Futures (Perpetual) ===
  getFuturesBalance(): Promise<FuturesAsset[]>
  getFuturesPositions(symbol?: string): Promise<Position[]>
  getFuturesTickers(symbols?: string[]): Promise<Ticker[]>
  placeFuturesOrder(params: FuturesOrderParams): Promise<OrderResult>
  getFuturesOpenOrders(symbol?: string): Promise<Order[]>
  cancelFuturesOrder(orderId: string, symbol: string): Promise<void>
  setLeverage(symbol: string, leverage: number): Promise<void>
  setMarginMode(symbol: string, mode: 'cross' | 'isolated'): Promise<void>
  getFuturesKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>
  
  // === Margin (해당 거래소만) ===
  getMarginBalance?(): Promise<MarginAsset[]>
  placeMarginOrder?(params: OrderParams): Promise<OrderResult>
  
  // === 공통 ===
  validateKeys(): Promise<{ success: boolean; error?: string }>
  getExchangeInfo(): Promise<ExchangeInfo>
}
```

---

## Capability Matrix (거래소별 지원 기능)

| 거래소 | Spot | USDT-M Perp | COIN-M Perp | Margin | Passphrase | Base Currency |
|--------|------|-------------|-------------|--------|------------|---------------|
| Binance | O | O | O | O | X | USDT |
| Bybit | O | O | O (Inverse) | O (Unified) | X | USDT |
| Bitget | O | O | O (COIN-M) | X | **O** | USDT |
| OKX | O | O (SWAP) | O (FUTURES) | O (Unified) | **O** | USDT |
| KuCoin | O | O | O | X | **O** | USDT |
| MEXC | O | O* | X | X | X | USDT |
| Bitkub | O | X | X | X | X | THB |
| Upbit | O | X | X | X | X | KRW |
| Bithumb | O | X | X | X | X | KRW |

> `*` MEXC Futures: 기관 한정, 일반 사용자 API 미지원 가능

---

## Proposed Changes

### Phase 1: Backend — `functions/index.js`

**1-A. Exchange Client 클래스 7개 추가** (각 클래스에 Spot + Futures 메서드 포함)

각 클라이언트는 위 인터페이스를 구현하되, 지원하지 않는 기능은 `null` 또는 `throw 'Not supported'` 반환.

**1-B. Factory Function**

```javascript
function createExchangeClient(exchange, accessKey, secretKey, passphrase) {
  switch(exchange) {
    case 'binance':  return new BinanceClient(accessKey, secretKey);
    case 'bybit':    return new BybitClient(accessKey, secretKey);
    case 'bitget':   return new BitgetClient(accessKey, secretKey, passphrase);
    case 'okx':      return new OkxClient(accessKey, secretKey, passphrase);
    case 'kucoin':   return new KucoinClient(accessKey, secretKey, passphrase);
    case 'mexc':     return new MexcClient(accessKey, secretKey);
    case 'bitkub':   return new BitkubClient(accessKey, secretKey);
    case 'upbit':    return new UpbitClient(accessKey, secretKey);
    case 'bithumb':  return new BithumbClient(accessKey, secretKey);
  }
}
```

**1-C. `performCexSync()` 확장**

- Spot 자산 + Futures 포지션 + Margin 포지션 모두 sync
- Firestore 스냅샷 구조 확장:

```javascript
snapshotData = {
  // 기존
  exchange, assets, totalValueKrw, totalValueUsd, ...
  // 신규
  futuresPositions: [{ symbol, side, size, entryPrice, markPrice, unrealizedPnl, leverage, marginMode }],
  futuresBalance: { totalWalletBalance, availableBalance, unrealizedPnl, totalMarginBalance },
  marginBalance: { totalAssetOfBtc, totalLiabilityOfBtc, totalNetAssetOfBtc },
  capabilities: { spot: true, futures: true, margin: false }, // 거래소별 지원 현황
}
```

**1-D. Passphrase 지원**

- `registerCexApiKey` params에 `passphrase` 추가
- AES-256-GCM으로 암호화 후 Firestore 저장 (기존 패턴 재사용)
- `performCexSync`에서 복호화 후 클라이언트 전달

**1-E. 다중 통화 환율 변환**

```javascript
async function getExchangeRates() {
  try {
    // CoinGecko API
    const resp = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=krw,thb');
    return { USDT_KRW: resp.data.tether.krw, THB_KRW: resp.data.tether.krw / resp.data.tether.thb };
  } catch {
    return { USDT_KRW: 1400, THB_KRW: 40 }; // fallback
  }
}
```

---

### Phase 2: Frontend

#### [MODIFY] [cexService.ts](file:///Users/sangjaeseo/Antigravity/Vision-Chain/services/cexService.ts)

- Exchange union: 9개로 확장
- `passphrase?: string` 파라미터 추가
- `CexPortfolioSnapshot`에 `futuresPositions`, `futuresBalance`, `capabilities` 추가

#### [MODIFY] [WalletCexPortfolio.tsx](file:///Users/sangjaeseo/Antigravity/Vision-Chain/components/wallet/WalletCexPortfolio.tsx)

- 거래소 드롭다운 9개 (SVG 로고 포함)
- Passphrase 조건부 필드
- Futures 포지션 표시 섹션 (unrealized PnL, leverage, margin mode)
- Spot/Futures/Margin 탭 분리

#### [MODIFY] [types.ts](file:///Users/sangjaeseo/Antigravity/Vision-Chain/services/quant/types.ts)

- Exchange union 확장
- `FuturesPosition`, `FuturesBalance`, `MarginBalance` 타입 추가

#### [MODIFY] [index.ts](file:///Users/sangjaeseo/Antigravity/Vision-Chain/services/ai/index.ts)

- 시스템 프롬프트에 지원 거래소 9개 업데이트
- CEX 키워드 정규식에 7개 거래소명(한/영) 추가

---

## 롤아웃

| Phase | 거래소 | 이유 |
|-------|--------|------|
| **1** | Binance + MEXC | Binance 호환 API, 가장 큰 시장 |
| **2** | Bybit + OKX + KuCoin + Bitget | Passphrase 거래소, Unified Account |
| **3** | Bitkub + UI 마무리 | THB 환율, Spot 전용 |

---

## Verification Plan

### 각 Phase 완료 시

1. TypeScript 빌드 통과 확인
2. 각 거래소 API Key 등록 → 밸리데이션 → Spot Balance 표시
3. Futures 지원 거래소: Futures Balance + Position 표시
4. Aggregated Portfolio에서 다중 거래소 합산 정확성
5. Quant Engine에서 글로벌 자산 선택 가능 여부
6. Vision Chat에서 "바이낸스 포트폴리오" 질문 응답 확인
