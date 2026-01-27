import axios from 'axios';

export interface MarketPrice {
    price: number;
    symbol: string;
    change24h?: number;
    volume24h?: number;
    high24h?: number;
    low24h?: number;
    lastUpdated?: string;
}

/**
 * Service to fetch historical and current market data for cryptocurrencies.
 * Uses CoinGecko API.
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
                    lastUpdated: new Date().toISOString()
                };
            }

            const coinId = this.symbolToId[normalizedSymbol] || normalizedSymbol;
            // Use /coins/{id} for more detailed data than /simple/price
            const url = `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

            const response = await axios.get(url, { timeout: 8000 });
            const md = response.data?.market_data;

            if (!md) return null;

            return {
                price: md.current_price?.usd,
                symbol: symbol.toUpperCase(),
                change24h: md.price_change_percentage_24h,
                volume24h: md.total_volume?.usd,
                high24h: md.high_24h?.usd,
                low24h: md.low_24h?.usd,
                lastUpdated: md.last_updated
            };
        } catch (error) {
            console.error(`[MarketDataService] Error fetching current price for ${symbol}:`, error);
            return null;
        }
    }
}

export const marketDataService = new MarketDataService();
