import axios from 'axios';

export interface MarketPrice {
    price: number;
    date: string;
    symbol: string;
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
        'usdc': 'usd-coin',
        'usdt': 'tether',
        'vcn': 'vision-chain' // Placeholder if VCN is ever listed or mock data
    };

    /**
     * Get historical price for a given asset at a specific date.
     * @param symbol Asset symbol (e.g., 'btc')
     * @param date Date string in 'DD-MM-YYYY' format
     */
    async getHistoricalPrice(symbol: string, date: string): Promise<number | null> {
        try {
            const coinId = this.symbolToId[symbol.toLowerCase()] || symbol.toLowerCase();
            // CoinGecko historical API: /coins/{id}/history?date={dd-mm-yyyy}
            const url = `${this.baseUrl}/coins/${coinId}/history?date=${date}`;

            const response = await axios.get(url);
            const price = response.data?.market_data?.current_price?.usd;

            return price || null;
        } catch (error) {
            console.error(`[MarketDataService] Error fetching historical price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get current price for a given asset.
     */
    async getCurrentPrice(symbol: string): Promise<number | null> {
        try {
            const normalizedSymbol = symbol.toLowerCase();

            // Special handling for VCN (Not listed on CoinGecko yet)
            // Simulating "Admin Configured Price" as requested by user
            if (normalizedSymbol === 'vcn' || normalizedSymbol === 'vision-chain') {
                // In a real scenario, this might fetch from AdminService.getTokenPrice('VCN')
                // For now, we return the seed/presale price used across the app
                return 0.4007;
            }

            const coinId = this.symbolToId[normalizedSymbol] || normalizedSymbol;
            const url = `${this.baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`;

            const response = await axios.get(url);
            const price = response.data?.[coinId]?.usd;

            return price || null;
        } catch (error) {
            console.error(`[MarketDataService] Error fetching current price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Calculate percentage change between two prices.
     */
    calculateChange(oldPrice: number, newPrice: number): number {
        if (oldPrice === 0) return 0;
        return ((newPrice - oldPrice) / oldPrice) * 100;
    }
}

export const marketDataService = new MarketDataService();
