import axios from 'axios';

export interface DeFiPool {
    pool: string;
    project: string;
    chain: string;
    symbol: string;
    tvlUsd: number;
    apy: number;
    apyBase?: number;
    apyReward?: number;
    rewardTokens?: string[];
    riskScore?: number; // Calculated or mock for now
}

/**
 * Service to fetch real-time DeFi yield data.
 * Powered by DeFi Llama Yields API.
 */
export class DeFiService {
    private readonly baseUrl = 'https://yields.llama.fi';

    /**
     * Get top yields for a specific asset and/or category.
     */
    async getTopYields(params: { symbol?: string; chain?: string; minTvl?: number }): Promise<DeFiPool[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/pools`);
            let pools: DeFiPool[] = response.data.data;

            // Filter
            if (params.symbol) {
                pools = pools.filter(p => p.symbol.toLowerCase().includes(params.symbol!.toLowerCase()));
            }
            if (params.chain) {
                pools = pools.filter(p => p.chain.toLowerCase() === params.chain!.toLowerCase());
            }
            if (params.minTvl) {
                pools = pools.filter(p => p.tvlUsd >= params.minTvl!);
            }

            // Sort by APY descending
            pools.sort((a, b) => b.apy - a.apy);

            return pools.slice(0, 10); // Return top 10
        } catch (error) {
            console.error('[DeFiService] Error fetching pools:', error);
            return [];
        }
    }

    /**
     * Analyze protocol risk based on TVL and other heuristic metrics.
     */
    async analyzeProtocolRisk(projectName: string): Promise<{ score: number; label: string; summary: string }> {
        try {
            const pools = await this.getTopYields({});
            const projectPools = pools.filter(p => p.project.toLowerCase() === projectName.toLowerCase());

            if (projectPools.length === 0) {
                return { score: 50, label: 'Unknown', summary: 'Protocol not found in major registry.' };
            }

            const totalTvl = projectPools.reduce((sum, p) => sum + p.tvlUsd, 0);

            let score = 0;
            if (totalTvl > 1000000000) score = 90; // Over $1B
            else if (totalTvl > 100000000) score = 75; // Over $100M
            else if (totalTvl > 10000000) score = 60; // Over $10M
            else score = 40;

            let label = 'Medium-Risk';
            if (score >= 85) label = 'Blue-Chip (Low-Risk)';
            else if (score >= 70) label = 'Stable';
            else if (score < 50) label = 'High-Risk/Emerging';

            return {
                score,
                label,
                summary: `${projectName} has a aggregate TVL of $${(totalTvl / 1000000).toFixed(2)}M. ${label === 'Blue-Chip (Low-Risk)' ? 'Highly reputable and audit-vetted.' : 'Exercise caution with large capital.'}`
            };
        } catch (error) {
            return { score: 0, label: 'Error', summary: 'Failed to retrieve risk data.' };
        }
    }
}

export const defiService = new DeFiService();
