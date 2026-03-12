/**
 * Multi-Exchange Adapter
 *
 * Unified interface for all 15 exchanges.
 * - WebSocket: Real-time ticker data
 * - REST: Candles, order placement, order status
 *
 * Each exchange has different API protocols;
 * this adapter normalizes them to a common interface.
 */

const WebSocket = require("ws");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

// Common headers to avoid cloud IP blocking
const COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json",
};

// ─── Exchange WebSocket URLs ────────────────────────────────────────────────

const WS_URLS = {
    upbit: "wss://api.upbit.com/websocket/v1",
    binance: "wss://stream.binance.com:9443/ws",
    bybit: "wss://stream.bybit.com/v5/public/spot",
    bithumb: null,   // Bithumb WS is limited; use polling
    okx: "wss://ws.okx.com:8443/ws/v5/public",
    bitget: "wss://ws.bitget.com/v2/ws/public",
    kucoin: null,     // KuCoin requires token first
    mexc: "wss://wbs.mexc.com/ws",
    bitkub: "wss://api.bitkub.com/websocket-api/",
    coinbase: "wss://ws-feed.exchange.coinbase.com",
    bitflyer: "wss://ws.lightstream.bitflyer.com/json-rpc",
    gmo: "wss://api.coin.z.com/ws/public/v1",
    coincheck: null,  // No public WS
    coinone: null,    // Limited WS
    cryptocom: "wss://stream.crypto.com/exchange/v1/market",
};

// ─── REST API Base URLs ─────────────────────────────────────────────────────

const REST_URLS = {
    upbit: "https://api.upbit.com/v1",
    binance: "https://api.binance.com/api/v3",
    bybit: "https://api.bybit.com/v5",
    bithumb: "https://api.bithumb.com",
    okx: "https://www.okx.com/api/v5",
    bitget: "https://api.bitget.com/api/v2",
    kucoin: "https://api.kucoin.com/api/v1",
    mexc: "https://api.mexc.com/api/v3",
    bitkub: "https://api.bitkub.com/api",
    coinbase: "https://api.exchange.coinbase.com",
    bitflyer: "https://api.bitflyer.com/v1",
    gmo: "https://api.coin.z.com",
    coincheck: "https://coincheck.com/api",
    coinone: "https://api.coinone.co.kr",
    cryptocom: "https://api.crypto.com/exchange/v1",
};

// ─── Market Code Normalizer ─────────────────────────────────────────────────

const EXCHANGE_MARKET_FORMATS = {
    upbit: (base, quote) => `${quote}-${base}`,       // KRW-BTC
    bithumb: (base, quote) => `${base}_${quote}`,      // BTC_KRW
    coinone: (base, quote) => base.toLowerCase(),       // btc
    binance: (base, quote) => `${base}${quote}`,        // BTCUSDT
    bybit: (base, quote) => `${base}${quote}`,          // BTCUSDT
    bitget: (base, quote) => `${base}${quote}`,          // BTCUSDT
    okx: (base, quote) => `${base}-${quote}`,            // BTC-USDT
    kucoin: (base, quote) => `${base}-${quote}`,         // BTC-USDT
    mexc: (base, quote) => `${base}${quote}`,            // BTCUSDT
    bitkub: (base, quote) => `${quote}_${base}`,         // THB_BTC
    coinbase: (base, quote) => `${base}-${quote}`,       // BTC-USD
    bitflyer: (base, quote) => `${base}_${quote}`,       // BTC_JPY
    gmo: (base, quote) => base,                          // BTC
    coincheck: (base, quote) => `${base.toLowerCase()}_${quote.toLowerCase()}`, // btc_jpy
    cryptocom: (base, quote) => `${base}_${quote}`,      // BTC_USDT
};

/**
 * Convert a universal market code (e.g. "KRW-BTC") to exchange-specific format
 */
function toExchangeMarket(exchange, universalCode) {
    // universalCode format: "QUOTE-BASE" (Upbit style) or "BASEUSDT" (Binance style)
    let base, quote;

    if (universalCode.includes("-")) {
        const parts = universalCode.split("-");
        quote = parts[0]; // KRW, USDT
        base = parts[1];  // BTC
    } else {
        // BTCUSDT style
        const stables = ["USDT", "USDC", "KRW", "USD", "THB", "JPY"];
        for (const s of stables) {
            if (universalCode.endsWith(s)) {
                base = universalCode.slice(0, -s.length);
                quote = s;
                break;
            }
        }
        if (!base) {
            base = universalCode;
            quote = "USDT";
        }
    }

    const formatter = EXCHANGE_MARKET_FORMATS[exchange];
    return formatter ? formatter(base, quote) : universalCode;
}

// ─── Candle Fetcher (per exchange) ──────────────────────────────────────────

async function fetchCandles(exchange, market, count = 100) {
    try {
        let closes = [], volumes = [];

        switch (exchange) {
            case "upbit": {
                const resp = await axios.get(
                    `${REST_URLS.upbit}/candles/minutes/60?market=${market}&count=${count}`,
                    { timeout: 10000, headers: COMMON_HEADERS }
                );
                const candles = resp.data.reverse();
                closes = candles.map(c => c.trade_price);
                volumes = candles.map(c => c.candle_acc_trade_volume || 0);
                break;
            }

            case "binance": {
                const resp = await axios.get(
                    `${REST_URLS.binance}/klines?symbol=${market}&interval=1h&limit=${count}`,
                    { timeout: 10000 }
                );
                closes = resp.data.map(c => parseFloat(c[4]));
                volumes = resp.data.map(c => parseFloat(c[5]));
                break;
            }

            case "bybit": {
                const resp = await axios.get(
                    `${REST_URLS.bybit}/market/kline?category=spot&symbol=${market}&interval=60&limit=${count}`,
                    { timeout: 10000 }
                );
                const list = (resp.data?.result?.list || []).reverse();
                closes = list.map(c => parseFloat(c[4]));
                volumes = list.map(c => parseFloat(c[5]));
                break;
            }

            case "okx": {
                const resp = await axios.get(
                    `${REST_URLS.okx}/market/candles?instId=${market}&bar=1H&limit=${count}`,
                    { timeout: 10000 }
                );
                const list = (resp.data?.data || []).reverse();
                closes = list.map(c => parseFloat(c[4]));
                volumes = list.map(c => parseFloat(c[5]));
                break;
            }

            case "bithumb": {
                const resp = await axios.get(
                    `${REST_URLS.bithumb}/public/candlestick/${market}/1h`,
                    { timeout: 10000 }
                );
                const list = resp.data?.data?.slice(-count) || [];
                closes = list.map(c => parseFloat(c[2]));   // close price
                volumes = list.map(c => parseFloat(c[5]));   // volume
                break;
            }

            case "bitget": {
                const resp = await axios.get(
                    `${REST_URLS.bitget}/spot/market/candles?symbol=${market}&granularity=1h&limit=${count}`,
                    { timeout: 10000 }
                );
                const list = (resp.data?.data || []).reverse();
                closes = list.map(c => parseFloat(c[4]));
                volumes = list.map(c => parseFloat(c[5]));
                break;
            }

            case "kucoin": {
                const endAt = Math.floor(Date.now() / 1000);
                const startAt = endAt - (count * 3600);
                const resp = await axios.get(
                    `${REST_URLS.kucoin}/market/candles?type=1hour&symbol=${market}&startAt=${startAt}&endAt=${endAt}`,
                    { timeout: 10000 }
                );
                const list = (resp.data?.data || []).reverse();
                closes = list.map(c => parseFloat(c[2]));   // close
                volumes = list.map(c => parseFloat(c[5]));   // volume
                break;
            }

            case "mexc": {
                const resp = await axios.get(
                    `${REST_URLS.mexc}/klines?symbol=${market}&interval=1h&limit=${count}`,
                    { timeout: 10000 }
                );
                closes = resp.data.map(c => parseFloat(c[4]));
                volumes = resp.data.map(c => parseFloat(c[5]));
                break;
            }

            case "bitkub": {
                const now = Math.floor(Date.now() / 1000);
                const from = now - (count * 3600);
                const sym = market.includes("_") ? market.split("_")[1] : market;
                const resp = await axios.get(
                    `https://api.bitkub.com/tradingview/history?symbol=${sym}_THB&resolution=60&from=${from}&to=${now}`,
                    { timeout: 10000, headers: COMMON_HEADERS }
                );
                if (resp.data?.c) {
                    closes = resp.data.c.slice(-count);
                    volumes = (resp.data.v || []).slice(-count);
                }
                break;
            }

            case "coinbase": {
                const end = Math.floor(Date.now() / 1000);
                const start = end - (count * 3600);
                const resp = await axios.get(
                    `${REST_URLS.coinbase}/products/${market}/candles?granularity=3600&start=${start}&end=${end}`,
                    { timeout: 10000, headers: COMMON_HEADERS }
                );
                const candles = (resp.data || []).reverse();
                closes = candles.map(c => parseFloat(c[4]));
                volumes = candles.map(c => parseFloat(c[5]));
                break;
            }

            case "gmo": {
                const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
                const resp = await axios.get(
                    `${REST_URLS.gmo}/public/v1/klines?symbol=${market}&interval=1hour&date=${today}`,
                    { timeout: 10000 }
                );
                const list = resp.data?.data || [];
                closes = list.map(c => parseFloat(c.close)).slice(-count);
                volumes = list.map(c => parseFloat(c.volume)).slice(-count);
                break;
            }

            case "coinone": {
                const resp = await axios.get(
                    `${REST_URLS.coinone}/public/v2/chart/KRW/${market.toUpperCase()}?interval=1h`,
                    { timeout: 10000, headers: COMMON_HEADERS }
                );
                const list = resp.data?.chart || [];
                closes = list.map(c => parseFloat(c.close)).slice(-count);
                volumes = list.map(c => parseFloat(c.target_volume || c.volume || 0)).slice(-count);
                break;
            }

            case "cryptocom": {
                const resp = await axios.get(
                    `${REST_URLS.cryptocom}/public/get-candlestick?instrument_name=${market}&timeframe=1h`,
                    { timeout: 10000 }
                );
                const list = resp.data?.result?.data || [];
                closes = list.map(c => parseFloat(c.c)).slice(-count);
                volumes = list.map(c => parseFloat(c.v)).slice(-count);
                break;
            }

            default: {
                // For exchanges without candle API support (bitflyer, coincheck)
                console.warn(`[ExchangeAdapter] No candle support for ${exchange}, using fallback`);
                return { closes: [], volumes: [] };
            }
        }

        return { closes, volumes };
    } catch (err) {
        console.error(`[ExchangeAdapter] fetchCandles ${exchange}/${market} error:`, err.message);
        return { closes: [], volumes: [] };
    }
}

// ─── Price Fetcher ──────────────────────────────────────────────────────────

async function fetchPrices(exchange, markets) {
    const prices = {};
    try {
        switch (exchange) {
            case "upbit": {
                const marketStr = markets.join(",");
                console.log(`[ExchangeAdapter] Upbit fetchPrices: ${marketStr}`);
                try {
                    const resp = await axios.get(
                        `${REST_URLS.upbit}/ticker?markets=${marketStr}`,
                        { timeout: 10000, headers: COMMON_HEADERS }
                    );
                    for (const t of resp.data) {
                        prices[t.market] = t.trade_price;
                    }
                } catch (upbitErr) {
                    const status = upbitErr.response?.status;
                    console.warn(`[ExchangeAdapter] Upbit ${status} error - falling back to Binance`);

                    // Fallback: Fetch prices from Binance and convert to KRW
                    try {
                        // 1. Get USDT/KRW rate from Upbit (may also fail)
                        let usdtKrw = 1420; // Default fallback
                        try {
                            const rateResp = await axios.get(
                                `${REST_URLS.upbit}/ticker?markets=KRW-USDT`,
                                { timeout: 5000, headers: COMMON_HEADERS }
                            );
                            if (rateResp.data?.[0]) {
                                usdtKrw = rateResp.data[0].trade_price;
                            }
                        } catch {
                            console.warn(`[ExchangeAdapter] Using default USDT/KRW rate: ${usdtKrw}`);
                        }

                        // 2. Extract base symbols from KRW-XXX format
                        const baseSymbols = markets
                            .filter(m => m.startsWith("KRW-"))
                            .map(m => m.replace("KRW-", ""));

                        if (baseSymbols.length > 0) {
                            // 3. Fetch from Binance in USDT
                            const binanceResp = await axios.get(
                                `${REST_URLS.binance}/ticker/price`,
                                { timeout: 10000 }
                            );
                            const binancePrices = {};
                            for (const t of binanceResp.data) {
                                binancePrices[t.symbol] = parseFloat(t.price);
                            }

                            // 4. Convert to KRW and map to Upbit market format
                            for (const sym of baseSymbols) {
                                const binanceSymbol = `${sym}USDT`;
                                if (binancePrices[binanceSymbol]) {
                                    const krwPrice = binancePrices[binanceSymbol] * usdtKrw;
                                    prices[`KRW-${sym}`] = Math.round(krwPrice);
                                }
                            }

                            if (Object.keys(prices).length > 0) {
                                console.log(`[ExchangeAdapter] Binance fallback: got ${Object.keys(prices).length} prices (USDT/KRW=${usdtKrw})`);
                            }
                        }
                    } catch (fallbackErr) {
                        console.error(`[ExchangeAdapter] Binance fallback also failed:`, fallbackErr.message);
                    }
                }
                break;
            }

            case "binance": {
                const resp = await axios.get(
                    `${REST_URLS.binance}/ticker/price`,
                    { timeout: 10000 }
                );
                for (const t of resp.data) {
                    if (markets.includes(t.symbol)) {
                        prices[t.symbol] = parseFloat(t.price);
                    }
                }
                break;
            }

            case "bybit": {
                const resp = await axios.get(
                    `${REST_URLS.bybit}/market/tickers?category=spot`,
                    { timeout: 10000 }
                );
                for (const t of (resp.data?.result?.list || [])) {
                    if (markets.includes(t.symbol)) {
                        prices[t.symbol] = parseFloat(t.lastPrice);
                    }
                }
                break;
            }

            case "okx": {
                const resp = await axios.get(
                    `${REST_URLS.okx}/market/tickers?instType=SPOT`,
                    { timeout: 10000 }
                );
                for (const t of (resp.data?.data || [])) {
                    if (markets.includes(t.instId)) {
                        prices[t.instId] = parseFloat(t.last);
                    }
                }
                break;
            }

            case "bithumb": {
                const resp = await axios.get(
                    `${REST_URLS.bithumb}/public/ticker/ALL_KRW`,
                    { timeout: 10000, headers: COMMON_HEADERS }
                );
                if (resp.data?.status === "0000" && resp.data?.data) {
                    for (const [symbol, info] of Object.entries(resp.data.data)) {
                        if (symbol === "date" || typeof info !== "object") continue;
                        const market = `${symbol}_KRW`;
                        if (markets.includes(market)) {
                            prices[market] = parseFloat(info.closing_price);
                        }
                    }
                }
                break;
            }

            case "bitget": {
                const resp = await axios.get(
                    `${REST_URLS.bitget}/spot/market/tickers`,
                    { timeout: 10000 }
                );
                for (const t of (resp.data?.data || [])) {
                    if (markets.includes(t.symbol)) {
                        prices[t.symbol] = parseFloat(t.lastPr);
                    }
                }
                break;
            }

            case "kucoin": {
                const resp = await axios.get(
                    `${REST_URLS.kucoin}/market/allTickers`,
                    { timeout: 10000 }
                );
                for (const t of (resp.data?.data?.ticker || [])) {
                    if (markets.includes(t.symbol)) {
                        prices[t.symbol] = parseFloat(t.last);
                    }
                }
                break;
            }

            case "mexc": {
                const resp = await axios.get(
                    `${REST_URLS.mexc}/ticker/price`,
                    { timeout: 10000 }
                );
                for (const t of resp.data) {
                    if (markets.includes(t.symbol)) {
                        prices[t.symbol] = parseFloat(t.price);
                    }
                }
                break;
            }

            case "bitkub": {
                const resp = await axios.get(
                    `${REST_URLS.bitkub}/v3/market/ticker`,
                    { timeout: 10000, headers: COMMON_HEADERS }
                );
                const data = resp.data;
                if (Array.isArray(data)) {
                    for (const t of data) {
                        if (markets.includes(t.symbol)) prices[t.symbol] = parseFloat(t.last);
                    }
                } else if (typeof data === "object") {
                    for (const [sym, info] of Object.entries(data)) {
                        if (markets.includes(sym) && info?.last) prices[sym] = parseFloat(info.last);
                    }
                }
                break;
            }

            case "coinbase": {
                for (const m of markets) {
                    try {
                        const resp = await axios.get(
                            `${REST_URLS.coinbase}/products/${m}/ticker`,
                            { timeout: 8000, headers: COMMON_HEADERS }
                        );
                        if (resp.data?.price) prices[m] = parseFloat(resp.data.price);
                    } catch { /* skip */ }
                }
                break;
            }

            case "bitflyer": {
                for (const m of markets) {
                    try {
                        const resp = await axios.get(
                            `${REST_URLS.bitflyer}/ticker?product_code=${m}`,
                            { timeout: 8000, headers: COMMON_HEADERS }
                        );
                        if (resp.data?.ltp) prices[m] = resp.data.ltp;
                    } catch { /* skip */ }
                }
                break;
            }

            case "gmo": {
                const resp = await axios.get(
                    `${REST_URLS.gmo}/public/v1/ticker`,
                    { timeout: 10000 }
                );
                for (const t of (resp.data?.data || [])) {
                    if (markets.includes(t.symbol)) prices[t.symbol] = parseFloat(t.last);
                }
                break;
            }

            case "coincheck": {
                for (const m of markets) {
                    try {
                        const resp = await axios.get(
                            `${REST_URLS.coincheck}/rate/${m}`,
                            { timeout: 8000, headers: COMMON_HEADERS }
                        );
                        if (resp.data?.rate) prices[m] = parseFloat(resp.data.rate);
                    } catch { /* skip */ }
                }
                break;
            }

            case "coinone": {
                try {
                    const resp = await axios.get(
                        `${REST_URLS.coinone}/ticker?currency=all`,
                        { timeout: 10000, headers: COMMON_HEADERS }
                    );
                    if (resp.data) {
                        for (const m of markets) {
                            if (resp.data[m]?.last) prices[m] = parseFloat(resp.data[m].last);
                        }
                    }
                } catch { /* skip */ }
                break;
            }

            case "cryptocom": {
                const resp = await axios.get(
                    `${REST_URLS.cryptocom}/public/get-tickers`,
                    { timeout: 10000 }
                );
                for (const t of (resp.data?.result?.data || [])) {
                    if (markets.includes(t.i)) prices[t.i] = parseFloat(t.a);
                }
                break;
            }

            default: {
                // Generic fallback: fetch one by one from candle
                for (const m of markets) {
                    try {
                        const candle = await fetchCandles(exchange, m, 1);
                        if (candle.closes.length > 0) {
                            prices[m] = candle.closes[candle.closes.length - 1];
                        }
                    } catch { /* skip */ }
                }
            }
        }
    } catch (err) {
        console.error(`[ExchangeAdapter] fetchPrices ${exchange} error:`, err.message);
    }
    return prices;
}

// ─── Order Placement ────────────────────────────────────────────────────────

/**
 * Place a LIMIT order. ALWAYS limit - Layer 5 enforcement.
 */
async function placeOrder(exchange, accessKey, secretKey, passphrase, market, side, volume, price) {
    try {
        switch (exchange) {
            case "upbit": {
                const payload = {
                    access_key: accessKey,
                    nonce: uuidv4(),
                };
                const params = {
                    market, side: side === "buy" ? "bid" : "ask",
                    volume: String(volume), price: String(Math.round(price)),
                    ord_type: "limit",
                };
                const qs = new URLSearchParams(params).toString();
                const queryHash = crypto.createHash("sha512").update(qs, "utf-8").digest("hex");
                payload.query_hash = queryHash;
                payload.query_hash_alg = "SHA512";
                const token = jwt.sign(payload, secretKey);

                const resp = await axios.post(`${REST_URLS.upbit}/orders`, params, {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000,
                });
                return { success: true, orderId: resp.data.uuid };
            }

            case "binance": {
                const timestamp = Date.now();
                const params = {
                    symbol: market,
                    side: side.toUpperCase(),
                    type: "LIMIT",
                    timeInForce: "GTC",
                    quantity: String(volume),
                    price: String(price),
                    timestamp,
                };
                const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&");
                const signature = crypto.createHmac("sha256", secretKey).update(qs).digest("hex");

                const resp = await axios.post(
                    `${REST_URLS.binance}/order?${qs}&signature=${signature}`,
                    null,
                    { headers: { "X-MBX-APIKEY": accessKey }, timeout: 10000 }
                );
                return { success: true, orderId: String(resp.data.orderId) };
            }

            case "bybit": {
                const timestamp = Date.now();
                const recvWindow = 5000;
                const params = {
                    category: "spot",
                    symbol: market,
                    side: side === "buy" ? "Buy" : "Sell",
                    orderType: "Limit",
                    qty: String(volume),
                    price: String(price),
                    timeInForce: "GTC",
                };
                const body = JSON.stringify(params);
                const preSign = `${timestamp}${accessKey}${recvWindow}${body}`;
                const signature = crypto.createHmac("sha256", secretKey).update(preSign).digest("hex");

                const resp = await axios.post(
                    `${REST_URLS.bybit}/order/create`, params,
                    {
                        headers: {
                            "X-BAPI-API-KEY": accessKey,
                            "X-BAPI-SIGN": signature,
                            "X-BAPI-TIMESTAMP": String(timestamp),
                            "X-BAPI-RECV-WINDOW": String(recvWindow),
                            "Content-Type": "application/json",
                        },
                        timeout: 10000,
                    }
                );
                return { success: true, orderId: resp.data?.result?.orderId };
            }

            case "okx": {
                const timestamp = new Date().toISOString();
                const body = JSON.stringify({
                    instId: market,
                    tdMode: "cash",
                    side: side,
                    ordType: "limit",
                    sz: String(volume),
                    px: String(price),
                });
                const preSign = `${timestamp}POST/api/v5/trade/order${body}`;
                const signature = crypto.createHmac("sha256", secretKey)
                    .update(preSign).digest("base64");

                const resp = await axios.post(`${REST_URLS.okx}/trade/order`, body, {
                    headers: {
                        "OK-ACCESS-KEY": accessKey,
                        "OK-ACCESS-SIGN": signature,
                        "OK-ACCESS-TIMESTAMP": timestamp,
                        "OK-ACCESS-PASSPHRASE": passphrase || "",
                        "Content-Type": "application/json",
                    },
                    timeout: 10000,
                });
                return { success: true, orderId: resp.data?.data?.[0]?.ordId };
            }

            case "bithumb": {
                const [base, quote] = market.split("_");
                const endpoint = "/info/orders";
                const nonce = Date.now();
                const paramObj = { order_currency: base, payment_currency: quote, units: String(volume), price: String(Math.round(price)), type: side === "buy" ? "bid" : "ask" };
                const paramStr = new URLSearchParams(paramObj).toString();
                const hmacData = `${endpoint}\x00${paramStr}\x00${nonce}`;
                const sig = crypto.createHmac("sha512", secretKey).update(hmacData).digest("hex");
                const resp = await axios.post(`${REST_URLS.bithumb}${endpoint}`, paramStr, {
                    headers: { "Api-Key": accessKey, "Api-Sign": sig, "Api-Nonce": String(nonce), "Content-Type": "application/x-www-form-urlencoded" },
                    timeout: 10000,
                });
                return { success: resp.data?.status === "0000", orderId: resp.data?.order_id || `bithumb_${nonce}` };
            }

            case "bitget": {
                const ts = Date.now();
                const body = JSON.stringify({ symbol: market, side, orderType: "limit", price: String(price), size: String(volume), force: "gtc" });
                const preSign = `${ts}POST/api/v2/spot/trade/place-order${body}`;
                const sig = crypto.createHmac("sha256", secretKey).update(preSign).digest("base64");
                const resp = await axios.post(`${REST_URLS.bitget}/spot/trade/place-order`, JSON.parse(body), {
                    headers: { "ACCESS-KEY": accessKey, "ACCESS-SIGN": sig, "ACCESS-TIMESTAMP": String(ts), "ACCESS-PASSPHRASE": passphrase || "", "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: true, orderId: resp.data?.data?.orderId };
            }

            case "kucoin": {
                const ts = Date.now();
                const oid = uuidv4();
                const body = JSON.stringify({ clientOid: oid, side, symbol: market, type: "limit", price: String(price), size: String(volume) });
                const sig = crypto.createHmac("sha256", secretKey).update(`${ts}POST/api/v1/orders${body}`).digest("base64");
                const ppSign = crypto.createHmac("sha256", secretKey).update(passphrase || "").digest("base64");
                const resp = await axios.post(`${REST_URLS.kucoin}/orders`, JSON.parse(body), {
                    headers: { "KC-API-KEY": accessKey, "KC-API-SIGN": sig, "KC-API-TIMESTAMP": String(ts), "KC-API-PASSPHRASE": ppSign, "KC-API-KEY-VERSION": "2", "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: true, orderId: resp.data?.data?.orderId };
            }

            case "mexc": {
                const ts = Date.now();
                const params = { symbol: market, side: side.toUpperCase(), type: "LIMIT", quantity: String(volume), price: String(price), timestamp: ts };
                const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&");
                const sig = crypto.createHmac("sha256", secretKey).update(qs).digest("hex");
                const resp = await axios.post(`${REST_URLS.mexc}/order?${qs}&signature=${sig}`, null, {
                    headers: { "X-MEXC-APIKEY": accessKey }, timeout: 10000,
                });
                return { success: true, orderId: String(resp.data?.orderId || `mexc_${ts}`) };
            }

            case "bitkub": {
                const ts = Date.now();
                const body = JSON.stringify({ sym: market, amt: volume, rat: price, typ: "limit" });
                const ep = side === "buy" ? "/api/v3/market/place-bid" : "/api/v3/market/place-ask";
                const sig = crypto.createHmac("sha256", secretKey).update(`${ts}POST${ep}${body}`).digest("hex");
                const resp = await axios.post(`https://api.bitkub.com${ep}`, JSON.parse(body), {
                    headers: { "X-BTK-APIKEY": accessKey, "X-BTK-TIMESTAMP": String(ts), "X-BTK-SIGN": sig, "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: resp.data?.error === 0, orderId: String(resp.data?.result?.id || `bitkub_${ts}`) };
            }

            case "coinbase": {
                const ts = Math.floor(Date.now() / 1000);
                const body = JSON.stringify({ product_id: market, side, type: "limit", price: String(price), size: String(volume) });
                const sig = crypto.createHmac("sha256", secretKey).update(`${ts}POST/orders${body}`).digest("base64");
                const resp = await axios.post(`${REST_URLS.coinbase}/orders`, JSON.parse(body), {
                    headers: { "CB-ACCESS-KEY": accessKey, "CB-ACCESS-SIGN": sig, "CB-ACCESS-TIMESTAMP": String(ts), "CB-ACCESS-PASSPHRASE": passphrase || "", "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: true, orderId: resp.data?.id };
            }

            case "bitflyer": {
                const ts = Date.now();
                const body = JSON.stringify({ product_code: market, child_order_type: "LIMIT", side: side.toUpperCase(), price: Math.round(price), size: volume });
                const sig = crypto.createHmac("sha256", secretKey).update(`${ts}POST/v1/me/sendchildorder${body}`).digest("hex");
                const resp = await axios.post(`${REST_URLS.bitflyer}/me/sendchildorder`, JSON.parse(body), {
                    headers: { "ACCESS-KEY": accessKey, "ACCESS-TIMESTAMP": String(ts), "ACCESS-SIGN": sig, "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: true, orderId: resp.data?.child_order_acceptance_id };
            }

            case "gmo": {
                const ts = Date.now();
                const body = JSON.stringify({ symbol: market, side: side.toUpperCase(), executionType: "LIMIT", price: String(price), size: String(volume) });
                const sig = crypto.createHmac("sha256", secretKey).update(`${ts}POST/private/v1/order${body}`).digest("hex");
                const resp = await axios.post(`${REST_URLS.gmo}/private/v1/order`, JSON.parse(body), {
                    headers: { "API-KEY": accessKey, "API-TIMESTAMP": String(ts), "API-SIGN": sig, "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: resp.data?.status === 0, orderId: resp.data?.data || `gmo_${ts}` };
            }

            case "coincheck": {
                const nonce = Date.now();
                const url = `${REST_URLS.coincheck}/exchange/orders`;
                const body = JSON.stringify({ pair: market, order_type: side, rate: price, amount: volume });
                const sig = crypto.createHmac("sha256", secretKey).update(`${nonce}${url}${body}`).digest("hex");
                const resp = await axios.post(url, JSON.parse(body), {
                    headers: { "ACCESS-KEY": accessKey, "ACCESS-NONCE": String(nonce), "ACCESS-SIGNATURE": sig, "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: !!resp.data?.success, orderId: String(resp.data?.id || `coincheck_${nonce}`) };
            }

            case "coinone": {
                const nonce = Date.now();
                const payload = { access_token: accessKey, nonce, price: String(Math.round(price)), qty: String(volume), target_currency: market, quote_currency: "krw" };
                const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
                const sig = crypto.createHmac("sha512", secretKey.toUpperCase()).update(payloadB64).digest("hex");
                const ep = side === "buy" ? "/v2/order/limit_buy/" : "/v2/order/limit_sell/";
                const resp = await axios.post(`${REST_URLS.coinone}${ep}`, payload, {
                    headers: { "X-COINONE-PAYLOAD": payloadB64, "X-COINONE-SIGNATURE": sig, "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: resp.data?.result === "success", orderId: resp.data?.orderId || `coinone_${nonce}` };
            }

            case "cryptocom": {
                const nonce = Date.now();
                const method = "private/create-order";
                const reqParams = { instrument_name: market, side: side.toUpperCase(), type: "LIMIT", price: String(price), quantity: String(volume), time_in_force: "GOOD_TILL_CANCEL" };
                const paramStr = Object.keys(reqParams).sort().map(k => `${k}${reqParams[k]}`).join("");
                const sig = crypto.createHmac("sha256", secretKey).update(`${method}${nonce}${accessKey}${paramStr}${nonce}`).digest("hex");
                const resp = await axios.post(`${REST_URLS.cryptocom}/${method}`, {
                    id: nonce, method, nonce, api_key: accessKey, sig, params: reqParams,
                }, { headers: { "Content-Type": "application/json" }, timeout: 10000 });
                return { success: !!resp.data?.result?.order_id, orderId: resp.data?.result?.order_id || `cryptocom_${nonce}` };
            }

            default:
                return { success: false, error: `Order placement not yet implemented for ${exchange}` };
        }
    } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.response?.data?.msg || err.message;
        console.error(`[ExchangeAdapter] placeOrder ${exchange}/${market} FAILED:`, errMsg);
        return { success: false, error: errMsg };
    }
}

// ─── Futures Order Placement ────────────────────────────────────────────────

/**
 * Place a LIMIT futures order with leverage and direction support.
 * Only for exchanges with futures capability: binance, bybit, bitget, okx, kucoin, mexc
 */
async function placeFuturesOrder(exchange, accessKey, secretKey, passphrase, market, side, volume, price, leverage, marginType) {
    try {
        switch (exchange) {
            case "binance": {
                // Set leverage first
                const timestamp = Date.now();
                const levParams = { symbol: market, leverage, timestamp };
                const levQs = Object.entries(levParams).map(([k, v]) => `${k}=${v}`).join("&");
                const levSig = crypto.createHmac("sha256", secretKey).update(levQs).digest("hex");
                await axios.post(
                    `https://fapi.binance.com/fapi/v1/leverage?${levQs}&signature=${levSig}`,
                    null,
                    { headers: { "X-MBX-APIKEY": accessKey }, timeout: 10000 }
                ).catch(() => { });

                // Set margin type
                if (marginType) {
                    const mtParams = { symbol: market, marginType: marginType === "isolated" ? "ISOLATED" : "CROSSED", timestamp };
                    const mtQs = Object.entries(mtParams).map(([k, v]) => `${k}=${v}`).join("&");
                    const mtSig = crypto.createHmac("sha256", secretKey).update(mtQs).digest("hex");
                    await axios.post(
                        `https://fapi.binance.com/fapi/v1/marginType?${mtQs}&signature=${mtSig}`,
                        null,
                        { headers: { "X-MBX-APIKEY": accessKey }, timeout: 10000 }
                    ).catch(() => { });
                }

                // Place futures order
                const params = {
                    symbol: market,
                    side: side.toUpperCase(),
                    type: "LIMIT",
                    timeInForce: "GTC",
                    quantity: String(volume),
                    price: String(price),
                    timestamp: Date.now(),
                };
                const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&");
                const signature = crypto.createHmac("sha256", secretKey).update(qs).digest("hex");

                const resp = await axios.post(
                    `https://fapi.binance.com/fapi/v1/order?${qs}&signature=${signature}`,
                    null,
                    { headers: { "X-MBX-APIKEY": accessKey }, timeout: 10000 }
                );
                return { success: true, orderId: String(resp.data.orderId) };
            }

            case "bybit": {
                const timestamp = Date.now();
                const recvWindow = 5000;
                const params = {
                    category: "linear",  // USDT perpetual
                    symbol: market,
                    side: side === "buy" ? "Buy" : "Sell",
                    orderType: "Limit",
                    qty: String(volume),
                    price: String(price),
                    timeInForce: "GTC",
                    leverage: String(leverage),
                    positionIdx: 0, // one-way mode
                };
                const body = JSON.stringify(params);
                const preSign = `${timestamp}${accessKey}${recvWindow}${body}`;
                const signature = crypto.createHmac("sha256", secretKey).update(preSign).digest("hex");

                const resp = await axios.post(
                    `${REST_URLS.bybit}/order/create`, params,
                    {
                        headers: {
                            "X-BAPI-API-KEY": accessKey,
                            "X-BAPI-SIGN": signature,
                            "X-BAPI-TIMESTAMP": String(timestamp),
                            "X-BAPI-RECV-WINDOW": String(recvWindow),
                            "Content-Type": "application/json",
                        },
                        timeout: 10000,
                    }
                );
                return { success: true, orderId: resp.data?.result?.orderId };
            }

            case "okx": {
                const timestamp = new Date().toISOString();
                const body = JSON.stringify({
                    instId: market.replace("USDT", "-USDT-SWAP"),  // BTC-USDT-SWAP
                    tdMode: marginType === "isolated" ? "isolated" : "cross",
                    side: side,
                    ordType: "limit",
                    sz: String(volume),
                    px: String(price),
                    lever: String(leverage),
                });
                const preSign = `${timestamp}POST/api/v5/trade/order${body}`;
                const signature = crypto.createHmac("sha256", secretKey).update(preSign).digest("base64");

                const resp = await axios.post(`${REST_URLS.okx}/trade/order`, body, {
                    headers: {
                        "OK-ACCESS-KEY": accessKey,
                        "OK-ACCESS-SIGN": signature,
                        "OK-ACCESS-TIMESTAMP": timestamp,
                        "OK-ACCESS-PASSPHRASE": passphrase || "",
                        "Content-Type": "application/json",
                    },
                    timeout: 10000,
                });
                return { success: true, orderId: resp.data?.data?.[0]?.ordId };
            }

            case "bitget": {
                const ts = Date.now();
                const body = JSON.stringify({
                    symbol: market, productType: "USDT-FUTURES", marginMode: marginType === "isolated" ? "isolated" : "crossed",
                    side: side === "buy" ? "open_long" : "open_short", orderType: "limit",
                    price: String(price), size: String(volume), leverage: String(leverage), force: "gtc",
                });
                const preSign = `${ts}POST/api/v2/mix/order/place-order${body}`;
                const sig = crypto.createHmac("sha256", secretKey).update(preSign).digest("base64");
                const resp = await axios.post(`https://api.bitget.com/api/v2/mix/order/place-order`, JSON.parse(body), {
                    headers: { "ACCESS-KEY": accessKey, "ACCESS-SIGN": sig, "ACCESS-TIMESTAMP": String(ts), "ACCESS-PASSPHRASE": passphrase || "", "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: true, orderId: resp.data?.data?.orderId };
            }

            case "kucoin": {
                const ts = Date.now();
                const oid = uuidv4();
                const futSymbol = market.includes("-") ? market.replace("-", "") + "M" : market + "M";
                const body = JSON.stringify({ clientOid: oid, symbol: futSymbol, leverage: String(leverage), side, type: "limit", price: String(price), size: parseInt(volume) });
                const ep = "/api/v1/orders";
                const sig = crypto.createHmac("sha256", secretKey).update(`${ts}POST${ep}${body}`).digest("base64");
                const ppSign = crypto.createHmac("sha256", secretKey).update(passphrase || "").digest("base64");
                const resp = await axios.post(`https://api-futures.kucoin.com${ep}`, JSON.parse(body), {
                    headers: { "KC-API-KEY": accessKey, "KC-API-SIGN": sig, "KC-API-TIMESTAMP": String(ts), "KC-API-PASSPHRASE": ppSign, "KC-API-KEY-VERSION": "2", "Content-Type": "application/json" },
                    timeout: 10000,
                });
                return { success: true, orderId: resp.data?.data?.orderId };
            }

            case "cryptocom": {
                const nonce = Date.now();
                const method = "private/create-order";
                const derivInst = market.replace("_USDT", "USD-PERP");
                const reqParams = { instrument_name: derivInst, side: side.toUpperCase(), type: "LIMIT", price: String(price), quantity: String(volume), time_in_force: "GOOD_TILL_CANCEL" };
                const paramStr = Object.keys(reqParams).sort().map(k => `${k}${reqParams[k]}`).join("");
                const sig = crypto.createHmac("sha256", secretKey).update(`${method}${nonce}${accessKey}${paramStr}${nonce}`).digest("hex");
                const resp = await axios.post(`${REST_URLS.cryptocom}/${method}`, {
                    id: nonce, method, nonce, api_key: accessKey, sig, params: reqParams,
                }, { headers: { "Content-Type": "application/json" }, timeout: 10000 });
                return { success: !!resp.data?.result?.order_id, orderId: resp.data?.result?.order_id };
            }

            default:
                return { success: false, error: `Futures orders not supported for ${exchange}` };
        }
    } catch (err) {
        const errMsg = err.response?.data?.msg || err.response?.data?.error?.message || err.message;
        console.error(`[ExchangeAdapter] placeFuturesOrder ${exchange}/${market} FAILED:`, errMsg);
        return { success: false, error: errMsg };
    }
}

// ─── Funding Rate Fetcher (futures only) ────────────────────────────────────

async function fetchFundingRate(exchange, market) {
    try {
        switch (exchange) {
            case "binance": {
                const resp = await axios.get(
                    `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${market}&limit=1`,
                    { timeout: 10000 }
                );
                return resp.data?.[0] ? parseFloat(resp.data[0].fundingRate) : null;
            }
            case "bybit": {
                const resp = await axios.get(
                    `${REST_URLS.bybit}/market/tickers?category=linear&symbol=${market}`,
                    { timeout: 10000 }
                );
                return resp.data?.result?.list?.[0] ? parseFloat(resp.data.result.list[0].fundingRate) : null;
            }
            case "okx": {
                const instId = market.replace("USDT", "-USDT-SWAP");
                const resp = await axios.get(
                    `${REST_URLS.okx}/public/funding-rate?instId=${instId}`,
                    { timeout: 10000 }
                );
                return resp.data?.data?.[0] ? parseFloat(resp.data.data[0].fundingRate) : null;
            }
            default:
                return null;
        }
    } catch {
        return null;
    }
}

// ─── Futures Candle Fetcher ─────────────────────────────────────────────────

async function fetchFuturesCandles(exchange, market, count = 100) {
    try {
        switch (exchange) {
            case "binance": {
                const resp = await axios.get(
                    `https://fapi.binance.com/fapi/v1/klines?symbol=${market}&interval=1h&limit=${count}`,
                    { timeout: 10000 }
                );
                return {
                    closes: resp.data.map(c => parseFloat(c[4])),
                    volumes: resp.data.map(c => parseFloat(c[5])),
                };
            }
            case "bybit": {
                const resp = await axios.get(
                    `${REST_URLS.bybit}/market/kline?category=linear&symbol=${market}&interval=60&limit=${count}`,
                    { timeout: 10000 }
                );
                const list = (resp.data?.result?.list || []).reverse();
                return {
                    closes: list.map(c => parseFloat(c[4])),
                    volumes: list.map(c => parseFloat(c[5])),
                };
            }
            default:
                return fetchCandles(exchange, market, count);
        }
    } catch (err) {
        console.error(`[ExchangeAdapter] fetchFuturesCandles ${exchange}/${market} error:`, err.message);
        return { closes: [], volumes: [] };
    }
}

module.exports = {
    WS_URLS,
    REST_URLS,
    EXCHANGE_MARKET_FORMATS,
    toExchangeMarket,
    fetchCandles,
    fetchPrices,
    placeOrder,
    placeFuturesOrder,
    fetchFundingRate,
    fetchFuturesCandles,
};
