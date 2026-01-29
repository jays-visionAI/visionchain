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
 * Uses CoinGecko API (Free tier, no API key required).
 */
export class MarketDataService {
    private readonly baseUrl = 'https://api.coingecko.com/api/v3';

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
     */
    async getCurrentPrice(symbol: string): Promise<MarketPrice | null> {
        try {
            const normalizedSymbol = symbol.toLowerCase();

            // Special handling for VCN (Vision Chain Native)
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

            const coinId = this.symbolToId[normalizedSymbol] || normalizedSymbol;
            const url = `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

            const response = await axios.get(url, { timeout: 8000 });
            const data = response.data;
            const md = data?.market_data;

            if (!md) return null;

            return {
                price: md.current_price?.usd,
                symbol: symbol.toUpperCase(),
                change24h: md.price_change_percentage_24h,
                volume24h: md.total_volume?.usd,
                high24h: md.high_24h?.usd,
                low24h: md.low_24h?.usd,
                marketCap: md.market_cap?.usd,
                rank: data.market_cap_rank,
                lastUpdated: md.last_updated
            };
        } catch (error) {
            console.error(`[MarketDataService] Error fetching current price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get prices for multiple coins at once (more efficient than individual calls).
     * @param symbols Array of symbols (e.g., ['btc', 'eth', 'sol'])
     */
    async getMultiplePrices(symbols: string[]): Promise<Record<string, MarketPrice>> {
        try {
            const coinIds = symbols.map(s => this.symbolToId[s.toLowerCase()] || s.toLowerCase());
            const url = `${this.baseUrl}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

            const response = await axios.get(url, { timeout: 8000 });
            const result: Record<string, MarketPrice> = {};

            for (const symbol of symbols) {
                const coinId = this.symbolToId[symbol.toLowerCase()] || symbol.toLowerCase();
                const data = response.data[coinId];
                if (data) {
                    result[symbol.toUpperCase()] = {
                        price: data.usd,
                        symbol: symbol.toUpperCase(),
                        change24h: data.usd_24h_change,
                        volume24h: data.usd_24h_vol,
                        marketCap: data.usd_market_cap
                    };
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
