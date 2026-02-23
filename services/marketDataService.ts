import axios from 'axios';

export interface MarketPrice {
    price: number;
    symbol: string;
    change24h?: number;
    volume24h?: number;
    high24h?: number;
    low24h?: number;
    marketCap?: number;
    rank?: number;
    lastUpdated?: string;
}

export interface ChartDataPoint {
    timestamp: number;
    price: number;
}

export interface TrendingCoin {
    id: string;
    name: string;
    symbol: string;
    rank: number;
    priceUsd?: number;
    change24h?: number;
}

/**
 * Service to fetch historical and current market data for cryptocurrencies.
 * Primary: Cloud Function proxy (Binance + CoinGecko, server-side, no CORS)
 * Fallback: Direct CoinGecko for chart data / trending (lower frequency)
 */
export class MarketDataService {
    private readonly baseUrl = 'https://api.coingecko.com/api/v3';

    private getCloudFunctionUrl(): string {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const projectId = hostname.includes('staging') ? 'visionchain-staging' : 'visionchain-d19ed';
        return `https://us-central1-${projectId}.cloudfunctions.net/getMarketPrices`;
    }

    // Coin ID mapping for common symbols
    private readonly symbolToId: Record<string, string> = {
        'btc': 'bitcoin',
        'eth': 'ethereum',
        'sol': 'solana',
        'bnb': 'binancecoin',
        'xrp': 'ripple',
        'ada': 'cardano',
        'doge': 'dogecoin',
        'dot': 'polkadot',
        'matic': 'polygon',
        'link': 'chainlink',
        'usdc': 'usd-coin',
        'usdt': 'tether',
        'avax': 'avalanche-2',
        'atom': 'cosmos',
        'near': 'near',
        'apt': 'aptos',
        'sui': 'sui',
        'arb': 'arbitrum',
        'op': 'optimism',
        'vcn': 'vision-chain'
    };

    /**
     * Get historical price for a given asset at a specific date.
     * @param symbol Asset symbol (e.g., 'btc')
     * @param date Date string in 'DD-MM-YYYY' format
     */
    async getHistoricalPrice(symbol: string, date: string): Promise<number | null> {
        try {
            const coinId = this.symbolToId[symbol.toLowerCase()] || symbol.toLowerCase();
            const url = `${this.baseUrl}/coins/${coinId}/history?date=${date}&localization=false`;

            const response = await axios.get(url, { timeout: 5000 });
            const price = response.data?.market_data?.current_price?.usd;

            return price || null;
        } catch (error) {
            console.error(`[MarketDataService] Error fetching historical price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get current price and market stats for a given asset.
     * Routes through Cloud Function proxy (Binance primary, CoinGecko fallback).
     */
    async getCurrentPrice(symbol: string): Promise<MarketPrice | null> {
        try {
            const normalizedSymbol = symbol.toLowerCase();

            // Special handling for VCN (Vision Chain Native)
            // TODO: Replace with DEX price when available
            if (normalizedSymbol === 'vcn' || normalizedSymbol === 'vision-chain') {
                return {
                    price: 0.4007,
                    symbol: 'VCN',
                    change24h: 1.25,
                    volume24h: 1250000,
                    marketCap: 40070000,
                    rank: 999,
                    lastUpdated: new Date().toISOString()
                };
            }

            // Use Cloud Function proxy (no CORS, cached, Binance primary)
            const upperSym = symbol.toUpperCase();
            const url = `${this.getCloudFunctionUrl()}?coins=${upperSym}`;
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();

            if (result.success && result.prices?.[upperSym]) {
                const data = result.prices[upperSym];
                return {
                    price: data.usd,
                    symbol: upperSym,
                    change24h: data.change24h,
                    volume24h: data.volume24h,
                    high24h: data.high24h,
                    low24h: data.low24h,
                    lastUpdated: new Date().toISOString()
                };
            }

            return null;
        } catch (error) {
            console.error(`[MarketDataService] Error fetching current price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get prices for multiple coins at once (more efficient than individual calls).
     * Routes through Cloud Function proxy (single request, Binance batch API).
     * @param symbols Array of symbols (e.g., ['btc', 'eth', 'sol'])
     */
    async getMultiplePrices(symbols: string[]): Promise<Record<string, MarketPrice>> {
        try {
            const upperSymbols = symbols.map(s => s.toUpperCase());
            const url = `${this.getCloudFunctionUrl()}?coins=${upperSymbols.join(',')}`;

            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const result: Record<string, MarketPrice> = {};

            if (data.success && data.prices) {
                for (const sym of upperSymbols) {
                    const coinData = data.prices[sym];
                    if (coinData) {
                        result[sym] = {
                            price: coinData.usd,
                            symbol: sym,
                            change24h: coinData.change24h,
                            volume24h: coinData.volume24h,
                            high24h: coinData.high24h,
                            low24h: coinData.low24h
                        };
                    }
                }
            }

            return result;
        } catch (error) {
            console.error(`[MarketDataService] Error fetching multiple prices:`, error);
            return {};
        }
    }

    /**
     * Get chart data for a coin (for line graphs).
     * @param symbol Asset symbol
     * @param days Number of days (1, 7, 14, 30, 90, 180, 365, 'max')
     */
    async getChartData(symbol: string, days: number | string = 7): Promise<ChartDataPoint[]> {
        try {
            const normalizedSymbol = symbol.toLowerCase();

            // VCN: Return mock chart data
            if (normalizedSymbol === 'vcn' || normalizedSymbol === 'vision-chain') {
                const now = Date.now();
                const points: ChartDataPoint[] = [];
                const basePrice = 0.4007;
                const numDays = typeof days === 'number' ? days : 30;

                for (let i = numDays; i >= 0; i--) {
                    const variance = (Math.random() - 0.5) * 0.02; // ±1% variance
                    points.push({
                        timestamp: now - (i * 24 * 60 * 60 * 1000),
                        price: basePrice * (1 + variance)
                    });
                }
                return points;
            }

            const coinId = this.symbolToId[normalizedSymbol] || normalizedSymbol;
            const url = `${this.baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;

            const response = await axios.get(url, { timeout: 10000 });
            const prices = response.data?.prices || [];

            return prices.map((p: [number, number]) => ({
                timestamp: p[0],
                price: p[1]
            }));
        } catch (error) {
            console.error(`[MarketDataService] Error fetching chart data for ${symbol}:`, error);
            return [];
        }
    }

    /**
     * Get trending coins on CoinGecko.
     */
    async getTrendingCoins(): Promise<TrendingCoin[]> {
        try {
            const url = `${this.baseUrl}/search/trending`;
            const response = await axios.get(url, { timeout: 5000 });
            const coins = response.data?.coins || [];

            return coins.slice(0, 10).map((item: any, index: number) => ({
                id: item.item.id,
                name: item.item.name,
                symbol: item.item.symbol.toUpperCase(),
                rank: index + 1,
                priceUsd: item.item.data?.price,
                change24h: item.item.data?.price_change_percentage_24h?.usd
            }));
        } catch (error) {
            console.error(`[MarketDataService] Error fetching trending coins:`, error);
            return [];
        }
    }

    /**
     * Search for coins by name or symbol.
     * @param query Search query
     */
    async searchCoins(query: string): Promise<{ id: string; name: string; symbol: string }[]> {
        try {
            const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
            const response = await axios.get(url, { timeout: 5000 });

            return (response.data?.coins || []).slice(0, 10).map((c: any) => ({
                id: c.id,
                name: c.name,
                symbol: c.symbol.toUpperCase()
            }));
        } catch (error) {
            console.error(`[MarketDataService] Error searching coins:`, error);
            return [];
        }
    }

    /**
     * Get global market data (total market cap, BTC dominance, etc.)
     */
    async getGlobalMarketData(): Promise<{
        totalMarketCap: number;
        totalVolume24h: number;
        btcDominance: number;
        ethDominance: number;
        activeCryptocurrencies: number;
    } | null> {
        try {
            const url = `${this.baseUrl}/global`;
            const response = await axios.get(url, { timeout: 5000 });
            const data = response.data?.data;

            if (!data) return null;

            return {
                totalMarketCap: data.total_market_cap?.usd || 0,
                totalVolume24h: data.total_volume?.usd || 0,
                btcDominance: data.market_cap_percentage?.btc || 0,
                ethDominance: data.market_cap_percentage?.eth || 0,
                activeCryptocurrencies: data.active_cryptocurrencies || 0
            };
        } catch (error) {
            console.error(`[MarketDataService] Error fetching global market data:`, error);
            return null;
        }
    }
}

export const marketDataService = new MarketDataService();
