import { getChatbotSettings, getActiveGlobalApiKey, getProviderFromModel, saveConversation } from '../firebaseService';
import { AspectRatio } from '../../types';
import { AIProvider, AIProviderID, TextGenerationOptions } from './types';
import { GeminiProvider } from './providers/geminiProvider';
import { DeepSeekProvider } from './providers/deepseekProvider';
import { LLMRouter } from './router';
import { VisionInsightService } from '../visionInsightService';
import type { InsightSnapshot } from '../visionInsightService';

// --- Cached Vision Insight for Chatbot Context ---
let _cachedInsight: InsightSnapshot | null = null;
let _cachedInsightAt = 0;
const INSIGHT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getMarketIntelligenceBlock(): Promise<string> {
    try {
        // Use cached data if fresh
        if (_cachedInsight && Date.now() - _cachedInsightAt < INSIGHT_CACHE_TTL) {
            return formatInsightBlock(_cachedInsight);
        }

        const snapshot = await VisionInsightService.fetchSnapshot('all', 'en');
        _cachedInsight = snapshot;
        _cachedInsightAt = Date.now();
        return formatInsightBlock(snapshot);
    } catch (err) {
        console.error('[AIService] Failed to fetch Vision Insight for chatbot:', err);
        return ''; // Don't block chat if insight fails
    }
}

function formatInsightBlock(s: InsightSnapshot): string {
    if (!s || (!s.asi?.score && !s.marketBrief)) return '';

    const lines: string[] = [
        `[LIVE MARKET INTELLIGENCE - Vision Insight (Updated: ${s.lastUpdated || 'recently'})]`,
    ];

    // ASI (Adaptive Sentiment Index)
    if (s.asi) {
        lines.push(`ASI Score: ${s.asi.score}/100 (${s.asi.label}) | Trend: ${s.asi.trend}`);
        if (s.asi.summary) lines.push(`Summary: ${s.asi.summary}`);
    }

    // Market Brief
    if (s.marketBrief) {
        lines.push(`\nAI Market Analysis: ${s.marketBrief.analysis}`);
        lines.push(`Trading Bias: ${s.marketBrief.tradingBias} (Confidence: ${s.marketBrief.confidenceScore}/100)`);
        if (s.marketBrief.keyRisks?.length) {
            lines.push(`Key Risks: ${s.marketBrief.keyRisks.slice(0, 3).join('; ')}`);
        }
        if (s.marketBrief.opportunities?.length) {
            lines.push(`Opportunities: ${s.marketBrief.opportunities.slice(0, 3).join('; ')}`);
        }
        if (s.marketBrief.categoryHighlights?.length) {
            const highlights = s.marketBrief.categoryHighlights
                .slice(0, 4)
                .map(h => `${h.category}(${h.sentiment}): ${h.summary}`)
                .join(' | ');
            lines.push(`Sector Highlights: ${highlights}`);
        }
    }

    // Trending Keywords
    const trending = s.narratives?.trendingKeywords?.slice(0, 8);
    if (trending?.length) {
        lines.push(`Trending: ${trending.map(k => k.keyword).join(', ')}`);
    }

    // Alpha Alerts (top 3)
    const alerts = s.alphaAlerts?.slice(0, 3);
    if (alerts?.length) {
        lines.push(`\nAlpha Alerts:`);
        alerts.forEach(a => {
            lines.push(`  - [${a.severity.toUpperCase()}] ${a.headline} (${a.impactDirection}) - ${a.source}`);
        });
    }

    // Upcoming Events
    const events = s.narratives?.calendar?.slice(0, 3);
    if (events?.length) {
        lines.push(`\nUpcoming Events:`);
        events.forEach(e => {
            lines.push(`  - ${e.label} (${e.date}, ${e.daysUntil}d away, impact: ${e.impact})`);
        });
    }

    lines.push('');
    lines.push('INSTRUCTION: Use this live market data to provide informed, up-to-date answers about market conditions, sentiment, trends, and risks. Cite specific data points (ASI score, trading bias, alerts) when relevant. This data refreshes every few hours from real news analysis.');

    return lines.join('\n');
}

class ProviderFactory {
    private providers: Map<AIProviderID, AIProvider> = new Map();

    private router: LLMRouter;

    constructor() {
        this.providers.set('gemini', new GeminiProvider());
        this.providers.set('deepseek', new DeepSeekProvider());
        this.router = new LLMRouter(this);
    }

    getRouter(): LLMRouter {
        return this.router;
    }

    getProvider(id: AIProviderID): AIProvider {
        const provider = this.providers.get(id);
        if (!provider) throw new Error(`AI Provider ${id} not initialized.`);
        return provider;
    }

    async resolveConfig(botType: 'intent' | 'helpdesk' = 'intent') {
        const settings = await getChatbotSettings();
        if (!settings) throw new Error("AI Configuration not found.");

        const botConfig = botType === 'helpdesk' ? settings.helpdeskBot : settings.intentBot;
        const model = botConfig?.model || 'deepseek-chat';
        const visionModel = botConfig?.visionModel || 'gemini-2.5-flash';
        const providerId = getProviderFromModel(model) as AIProviderID;
        const apiKey = await getActiveGlobalApiKey(providerId);

        if (!apiKey) throw new Error(`API Key for ${providerId} not found.`);

        return {
            providerId,
            model,
            visionModel,
            apiKey,
            systemPrompt: botConfig?.systemPrompt || '',
            temperature: botConfig?.temperature || 0.7,
            maxTokens: botConfig?.maxTokens || 2048,
            promptTuning: settings.promptTuning
        };
    }
}

const factory = new ProviderFactory();

export const generateText = async (
    prompt: string,
    imageBase64?: string,
    botType: 'intent' | 'helpdesk' = 'intent',
    userId: string = 'anonymous',
    previousHistory: { role: string; content: string }[] = []
): Promise<string> => {
    try {
        const config = await factory.resolveConfig(botType);

        // Inject History Context
        const historyContext = previousHistory.length > 0
            ? `[Previous Conversation History]\n${previousHistory.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')}\n\n[Current User Input]\n`
            : '';

        let fullPrompt = historyContext + prompt;

        // --- Market Intelligence Auto-Injection (Vision Insight context) ---
        try {
            const { getMarketMemoryContext } = await import('./marketMemory');
            const marketContext = await getMarketMemoryContext(prompt);
            if (marketContext) {
                fullPrompt += marketContext;
                console.log('[AIService] Market memory context injected');
            }
        } catch (memErr) {
            console.debug('[AIService] Market memory injection skipped:', memErr);
        }

        // --- User Memory Auto-Injection (personalization) ---
        try {
            const { getUserMemory, generateUserMemoryContext } = await import('./userMemory');
            const memory = await getUserMemory(userId);
            const userContext = generateUserMemoryContext(memory);
            fullPrompt += userContext;
        } catch (umErr) {
            console.debug('[AIService] User memory injection skipped:', umErr);
        }

        // --- CEX Portfolio Auto-Injection (Provider-agnostic, works with DeepSeek) ---
        // Only inject CEX data when the user actually has connected exchanges.
        // If no exchanges connected, skip entirely -- do NOT mention CEX to the user.
        const actionKeywords = /브릿지|브릿징|전송|보내|송금|스왑|스테이킹|언스테이킹|bridge|bridging|transfer|send|swap|stake|unstake|mint/i;
        const cexKeywords = /포트폴리오|내 계좌|투자 현황|수익률|거래소 자산|리밸런싱|분석.*조언|투자 조언|내 투자|CEX|업비트|빗썸|portfolio|holdings|investment|P\&L|rebalance|advice|analyze.*portfolio|exchange.*asset|my assets/i;
        const shouldInjectCex = cexKeywords.test(prompt) && !actionKeywords.test(prompt);
        if (shouldInjectCex) {
            try {
                console.log('[AIService] CEX keyword detected, auto-fetching portfolio data...');
                const { getCexPortfolio } = await import('../cexService');
                const portfolioData = await getCexPortfolio();

                // Only inject if user actually has connected exchanges with data
                if (portfolioData.aggregated && portfolioData.portfolios.length > 0) {
                    const assets = portfolioData.aggregated.assets;
                    const assetDetails = assets.slice(0, 20).map(a =>
                        `  - ${a.currency}: ${a.balance.toLocaleString()} units | Avg Buy: ${a.avgBuyPrice.toLocaleString()}KRW | Current: ${a.currentPrice.toLocaleString()}KRW ($${a.currentPriceUsd.toFixed(2)}) | Value: ${a.valueKrw.toLocaleString()}KRW ($${a.valueUsd.toFixed(2)}) | P&L: ${a.profitLoss >= 0 ? '+' : ''}${a.profitLoss.toLocaleString()}KRW (${a.profitLossPercent >= 0 ? '+' : ''}${a.profitLossPercent.toFixed(2)}%) | Allocation: ${a.allocationPercent.toFixed(1)}%`
                    ).join('\n');

                    fullPrompt += `\n\n[CEX PORTFOLIO DATA - AUTO-FETCHED - THIS IS REAL DATA, ANALYZE IT]\nConnected Exchanges: ${portfolioData.portfolios.map(p => p.exchange).join(', ')}\nTotal Value: ${portfolioData.aggregated.totalValueKrw.toLocaleString()} KRW ($${portfolioData.aggregated.totalValueUsd.toFixed(2)})\nLast Updated: ${portfolioData.aggregated.lastUpdated || 'Unknown'}\nTotal Assets: ${assets.length}\n\nAsset Details:\n${assetDetails}\n\nIMPORTANT: Use this REAL data above to provide detailed portfolio analysis with charts (vision-chart). Include allocation donut chart, P&L bar chart, risk assessment, and actionable recommendations.`;
                    console.log('[AIService] CEX data injected into prompt successfully');
                }
                // If no connected exchanges, skip silently -- don't mention CEX
            } catch (cexErr: any) {
                console.debug('[AIService] CEX auto-fetch failed (non-critical):', cexErr.message);
                // Don't inject any CEX mention on failure
            }
        }

        const provider = factory.getProvider(config.providerId);

        // --- Locale & Time Injection (Enhanced for precise date calculations) ---
        const now = new Date();
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const userLocale = navigator.language;

        // Calculate dates in user's locale for API calls
        const formatDateForCoinGecko = (date: Date): string => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`; // DD-MM-YYYY format required by CoinGecko
        };

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const localeInfo = `[System Time Context - Use this for ALL date/time calculations]
CURRENT_LOCAL_TIME: ${now.toLocaleString(userLocale, { timeZone: userTimezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
CURRENT_UTC_TIME: ${now.toISOString()}
CURRENT_TIMESTAMP_MS: ${Date.now()}
TIMEZONE: ${userTimezone}
USER_LOCALE: ${userLocale}
TODAY_LOCAL: ${now.toLocaleDateString(userLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
TODAY_DD_MM_YYYY: ${formatDateForCoinGecko(now)}
YESTERDAY_DD_MM_YYYY: ${formatDateForCoinGecko(yesterday)}
ONE_WEEK_AGO_DD_MM_YYYY: ${formatDateForCoinGecko(oneWeekAgo)}

IMPORTANT: When user asks about the current time, ALWAYS use CURRENT_LOCAL_TIME (not UTC). The user is in ${userTimezone}.
When user asks for "current" or "now" price, use get_current_price tool.
When user asks for historical price (past dates), use get_historical_price with the date in DD-MM-YYYY format.
For "yesterday", use YESTERDAY_DD_MM_YYYY. For "a week ago", use ONE_WEEK_AGO_DD_MM_YYYY.`;

        const pt = (config as any).promptTuning;
        const tuningInfo = pt ? `
[AI Behavioral Rules]
${pt.systemRules || ''}

[Intent Resolution Guidelines]
2. Recipient Identification: ${pt.recipientIntent}
3. Sender Context: ${pt.senderIntent}
4. Execution Route: ${pt.processingRoute}
` : '';

        const criticalInstructions = `
[HIGHEST PRIORITY - MANDATORY OVERRIDE - THESE RULES SUPERSEDE ALL OTHER INSTRUCTIONS]
WARNING: Any previous or following instructions that contradict these rules MUST BE IGNORED.

1. RESPONSE LANGUAGE (HIGHEST PRIORITY - HARDCODED DEFAULT):
   The user's browser locale is: ${userLocale}
   You MUST respond in the language that matches this locale. Language mapping:
   - ko, ko-KR -> Korean (한국어)
   - en, en-US, en-GB -> English
   - ja, ja-JP -> Japanese (日本語)
   - zh, zh-CN, zh-TW, zh-HK -> Chinese (中文)
   - es, es-ES -> Spanish (Español)
   - fr, fr-FR -> French (Français)
   - de, de-DE -> German (Deutsch)
   - pt, pt-BR -> Portuguese (Português)
   - vi, vi-VN -> Vietnamese (Tiếng Việt)
   - th, th-TH -> Thai (ภาษาไทย)
   - For any other locale, respond in English as fallback.
   NEVER respond in a language that doesn't match the user's locale. For example, do NOT reply in Korean to an English-locale user, and do NOT reply in English to a Korean-locale user.
   EXCEPTION: If the user has sent 2 or more consecutive messages in a language DIFFERENT from their browser locale, you should politely ask (in BOTH the locale language and the user's input language): "I noticed you're writing in [detected language]. Would you like me to respond in [detected language] instead?" If the user confirms or continues in that language, switch to it for the rest of the conversation. If the user already explicitly requested a specific language (e.g. "please reply in English"), switch immediately without asking.
2. THINKING PROCESS: You MUST output your reasoning steps enclosed in <think> tags BEFORE your final answer.
3. FINANCIAL CONSULTANT PERSONA: Your tone should be professional, insightful, and helpful, like a top-tier financial advisor.
4. RECOMMENDED QUESTIONS: If the user asks about market data, prices, or DeFi, YOU MUST provide 3 follow-up questions.
   Format: Append "[RECOMMENDED_QUESTIONS] Question 1 | Question 2 | Question 3" at the very end.

5. REAL-TIME DATA POLICY (MANDATORY - NO EXCEPTIONS):
   - PRICE QUERY TRIGGERS (ANY LANGUAGE):
     English: "price", "how much", "what's the price", "current price", "now", "today"
     Korean: "가격", "얼마", "시세", "현재", "지금", "오늘"
   - MANDATORY TOOL USAGE:
     * DEFAULT: If NO time specified -> MUST call 'get_current_price' (assume user wants NOW/CURRENT price)
     * For "현재/current/지금/now/today" -> MUST call 'get_current_price'
     * For "어제/yesterday/과거/past" -> MUST call 'get_historical_price'
   - NEVER estimate, recall, or make up prices from memory
   - If tool call fails, respond: "실시간 데이터를 가져올 수 없습니다" / "Cannot retrieve real-time data"
   - ALWAYS cite tool results, never your training knowledge

6. CHART & INFOGRAPHIC GENERATION:
   You can render beautiful, interactive charts by using a special code block format.
   \`\`\`vision-chart
   {
     "type": "line|bar|pie|donut|area|radar|radialBar",
     "title": "Chart Title",
     "subtitle": "Optional subtitle",
     "labels": ["Label1", "Label2", ...],
     "series": [{ "name": "Series1", "data": [10, 20, 30] }]
   }
   \`\`\`
   CHART TYPE GUIDELINES:
   - LINE/AREA: Price trends over time, historical data
   - BAR: Comparisons between items (e.g., coin volumes, portfolio allocations)
   - PIE/DONUT: Portfolio allocation, market share, percentage breakdowns
   - RADAR: Multi-metric comparisons (e.g., risk vs reward vs liquidity)
   - RADIALBAR: Progress indicators, percentage metrics
   IMPORTANT: Always use actual data from tool calls. Do not hardcode fake numbers.

7. MARKET INTELLIGENCE (Vision Insight Integration):
   When [MARKET INTELLIGENCE CONTEXT] is provided in the prompt:
   - Use the provided news articles to explain WHY prices moved, not just what the price is.
   - ALWAYS cite sources: "Vision Insight에 따르면..." or "According to Vision Insight..."
   - Include article titles and sources in your explanation.
   - Combine market intelligence with real-time price data from tools.
   For HISTORICAL market questions ("why did X happen last month?"):
   - Use the search_market_news tool to find relevant past articles.
   - Specify appropriate date ranges (fromDate, toDate) based on the user's question.
   For CURRENT market questions ("why is X pumping today?"):
   - The [MARKET INTELLIGENCE CONTEXT] already contains recent relevant articles.
   - Combine this with get_current_price tool data for a comprehensive answer.

8. USER MEMORY & PERSONALIZATION:
   When [USER MEMORY] is provided in the prompt:
   - ALWAYS address the user by their preferred name (not email or ID).
   - Remember their investment style, interests, and past preferences.
   - Provide personalized recommendations based on their history.
   If the user tells you their name or preference, acknowledge it warmly and remember it.
   If no name is known, politely ask once: "어떻게 불러드릴까요?" / "What should I call you?"

9. CEX PORTFOLIO ANALYSIS (CONDITIONAL - only when user has connected exchanges):
   *** CRITICAL RULE: If there is NO [CEX PORTFOLIO DATA] section in the prompt, the user has NOT connected any exchange. ***
   *** In that case, do NOT mention CEX, exchange portfolio, Upbit, Bithumb, Binance, Bybit, or suggest connecting exchanges. ***
   *** Only discuss CEX portfolio when [CEX PORTFOLIO DATA] is explicitly present in the prompt. ***
   *** When you see [CEX PORTFOLIO DATA] in the prompt, analyze that data thoroughly. ***
   
   RESPONSE FORMAT - DUAL PORTFOLIO ANALYSIS (only when CEX data present):
   When [CEX PORTFOLIO DATA] IS provided, respond with:
   
   --- Section 1: Vision Chain (On-Chain Assets) ---
   - VCN balance, staked VCN, validator nodes
   - On-chain DeFi positions
   
   --- Section 2: CEX Portfolio (Exchange Assets) ---
   Using the provided [CEX PORTFOLIO DATA]:
   a) OVERVIEW: Total value (KRW/USD), connected exchanges, P&L
   b) ALLOCATION CHART (MANDATORY - use actual data):
      \`\`\`vision-chart
      {"type":"donut","title":"CEX Portfolio Allocation","labels":["BTC","ETH","XRP"],"series":[45,30,25]}
      \`\`\`
   c) TOP HOLDINGS: For each top asset - value, allocation %, P&L, avg buy price vs current price
   d) RISK ASSESSMENT:
      - Concentration Risk: Flag if single asset > 40%
      - Diversification Score: 1-10
      - Stablecoin Ratio
   e) ACTIONABLE RECOMMENDATIONS:
      - Rebalancing suggestions with specific % targets
      - DCA strategy if in loss
      - Profit-taking if gains > 20%
   f) P&L CHART (when relevant - use actual data):
      \`\`\`vision-chart
      {"type":"bar","title":"Asset P&L","labels":["BTC","ETH"],"series":[{"name":"P&L %","data":[12.5,-3.2]}]}
      \`\`\`
   
   --- Section 3: Combined Summary ---
   - Total wealth across Vision Chain + CEX
   - Overall diversification assessment
   - Cross-platform rebalancing opportunities

8. VISION CHAIN AGENT API KNOWLEDGE (Use this to answer agent/API/VCN related questions):
   - API Endpoint: POST https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway
   - Skill File (for AI agents to learn): https://visionchain.co/skill.md
   - Available Actions: register, balance, transfer, transactions, referral, leaderboard, profile, stake, unstake, claim_rewards, staking_info, network_info
   - REGISTER (No auth): {"action":"register","agent_name":"name","platform":"openai","owner_email":"email","referral_code":""}
     -> Returns: wallet_address, api_key, referral_code, initial_balance (100 VCN)
   - BALANCE: {"action":"balance","api_key":"vcn_..."}
   - TRANSFER: {"action":"transfer","api_key":"vcn_...","to":"0x... or agent_name","amount":"10"}
   - STAKE: {"action":"stake","api_key":"vcn_...","amount":"50"} -> +20 RP
   - UNSTAKE: {"action":"unstake","api_key":"vcn_...","amount":"25"} -> +5 RP
   - CLAIM_REWARDS: {"action":"claim_rewards","api_key":"vcn_..."} -> +10 RP
   - STAKING_INFO: {"action":"staking_info","api_key":"vcn_..."}
   - TRANSACTIONS: {"action":"transactions","api_key":"vcn_...","limit":20,"type":"transfer"}
   - REFERRAL: {"action":"referral","api_key":"vcn_..."} -> Sharing earns +50 RP
   - LEADERBOARD: {"action":"leaderboard","api_key":"vcn_...","type":"rp"} (types: rp, balance, referral)
   - PROFILE: {"action":"profile","api_key":"vcn_..."}
   - NETWORK_INFO: {"action":"network_info","api_key":"vcn_..."}
   - RP Rewards: Transfer +5, Unstake +5, Claim +10, Stake +20, New Agent +25, Referral +50
   - Token: VCN (18 decimals) | Chain: Vision Chain (Chain ID: 3151909)
   - RPC: https://api.visionchain.co/rpc-proxy | Explorer: https://visionchain.co/visionscan
   - All transactions are GASLESS (Paymaster covers fees)
   - Agent Dashboard: https://visionchain.co/agent/{agent_name}
   - Docs: https://visionchain.co/docs/agent-api
   When users ask about agents, API, VCN tokens, staking, or referrals, use this information to provide accurate answers with code examples.

10. VISION QUANT ENGINE KNOWLEDGE (Use this for quant/auto-trading/strategy questions):
    Vision Quant Engine is Vision Chain's automated CEX trading service (currently in Beta).
    - Users connect their existing CEX accounts (Upbit, Bithumb, Binance, Bybit, Bitget, OKX, KuCoin, MEXC, Bitkub) via API key, then select assets from their portfolio and apply verified strategy modules.
    - Global exchanges use USDT pairs, domestic (Upbit/Bithumb) use KRW pairs, Bitkub uses THB pairs.
    - Some exchanges (Bitget, OKX, KuCoin) require an additional Passphrase during API key registration.
    - Exchanges with Perpetual Futures support: Binance, Bybit, Bitget, OKX, KuCoin, MEXC (futures positions and balance are also synced).
    - Access: Wallet sidebar > "Quant Engine" menu, or URL /wallet/quant
    
    CORE PHILOSOPHY: "Risk control first, returns second."
    - Crypto volatility is 5-10x higher than major currencies. Loss limits, position sizing, and stop rules matter more than the strategy itself.
    - All strategies ship with a Volatility Target Overlay that automatically scales down position size (or halts trading entirely) when volatility spikes.
    
    AVAILABLE STRATEGIES (6 modules):
    1. Conservative Trend Core (보수적 추세추종) - Trend Following, Low Risk
       EMA crossover (20/50) + 200-EMA trend confirmation + volume filter. Best for strong trending markets.
    2. Bollinger Mean Reversion Guarded (볼린저 평균회귀 가드) - Mean Reversion, Medium Risk
       Lower Bollinger Band bounce + RSI recovery + downtrend filter. Best for range-bound markets.
    3. RSI Reversal Filtered (RSI 반전 필터형) - Mean Reversion, Medium Risk
       RSI oversold recovery + MACD histogram confirmation. Never enters on RSI alone. Includes scale-in logic.
    4. Donchian Breakout Swing (돈치안 돌파 스윙) - Breakout, Medium-High Risk
       N-period high breakout + volume surge + ATR-based dynamic stop. Best for consolidation-to-trend transitions.
    5. Multi-Factor Quant Guard (멀티팩터 퀀트가드) - Multi-Signal, Medium Risk
       Trend + Momentum + Volume + Volatility quad-confirmation. Vision Chain's flagship strategy.
    6. Volatility Target Overlay (변동성 타기팅 오버레이) - Risk Overlay, applied to ALL strategies
       Adjusts position size by realized volatility bucket: Low=100%, Mid=70%, High=40%, Extreme=0% (halt).
    
    TRIPLE SAFETY NET:
    - Layer 1: Daily Drawdown Kill — halts all trading if daily loss hits limit (default -3%)
    - Layer 2: Weekly Drawdown Kill — halts trading for the week if weekly loss hits limit (default -7%)
    - Layer 3: Volatility Overlay — auto-scales position or blocks trading at extreme volatility
    
    EXCEPTION RULES (things the engine NEVER does):
    - No chase-buying after spikes
    - No trading when spread is abnormally wide
    - No trading when exchange API latency is abnormal
    - Pause on extreme volatility
    - Pause after N consecutive losses (default 3) — waits for user confirmation
    - Reduce position in downtrend
    - Pause on news-driven crashes
    
    SETUP MODES:
    - Simple Mode: Choose risk profile (Conservative/Balanced/Aggressive) — params auto-set
    - Advanced Mode: Full parameter customization via sliders (EMA periods, RSI thresholds, ATR multiples, position %)
    
    SETUP FLOW: Connect Exchange → Select Assets (checkbox from CEX portfolio) → Choose Strategy → Configure → Legal Consent → Create Agent
    
    KEY DIFFERENTIATORS vs competitors:
    - Full parameter transparency (no black box)
    - Triple safety net (daily/weekly/volatility)
    - Exception rules (8 "never do" behaviors)
    - Uses existing CEX assets directly (no separate deposits)
    - Supports 9 exchanges: Upbit, Bithumb, Binance, Bybit, Bitget, OKX, KuCoin, MEXC, Bitkub
    - Global exchange support with multi-currency (KRW/USDT/THB) conversion
    
    IMPORTANT: This is a BETA service. Always include the disclaimer: "과거 성과는 미래 수익을 보장하지 않습니다. 자동매매로 인한 손실에 대해 비전체인은 책임지지 않습니다."
    When discussing Quant Engine, always emphasize risk management over profit potential.

11. REWARD POINTS (RP) SYSTEM - COMPREHENSIVE GUIDE:

    ╔══════════════════════════════════════════════════════════════════════════╗
    ║  CRITICAL: When users ask about RP, rewards, or how to earn points,    ║
    ║  you MUST provide an EXHAUSTIVE, WELL-STRUCTURED response.             ║
    ║  DO NOT give a brief summary. Provide ALL categories with full detail. ║
    ╚══════════════════════════════════════════════════════════════════════════╝

    RP (Reward Points) are Vision Chain's pre-listing participation points that measure and reward user engagement across the entire ecosystem. RP will be convertible to VCN tokens at a to-be-announced ratio upon VCN exchange listing. Until listing, RP is one pillar of Vision Chain's 3-Tier Reward System.

    ═══ VISION CHAIN 3-TIER REWARD SYSTEM (Context for RP) ═══
    Vision Chain operates three independent reward layers:
    1. RP (Reward Points) — Earned through platform engagement activities (this section). Pre-listing points convertible to VCN on listing day.
    2. VCN Mining Rewards — Earned passively by running Vision Node (desktop/mobile). Actual VCN tokens mined per epoch based on node uptime.
    3. USDT Revenue Share — Future revenue-sharing program distributing platform revenue to qualified participants.
    RP is the MOST accessible of the three and covers the widest range of activities. All three layers are independent: earning RP does NOT reduce VCN mining, and vice versa.

    ═══ 1. USER ACTIVITY RP REWARDS (16 categories) ═══
    These are earned by regular users through everyday platform interactions:
    | Activity                  | RP Amount | Trigger                                          | Where in App                  |
    |---------------------------|-----------|--------------------------------------------------|-------------------------------|
    | Daily Login               | 5 RP      | Automatic on first login each day (KST)          | Automatic                     |
    | Referral (invite a user)  | 10 RP     | When referred user completes registration         | Wallet > Referral             |
    | Level Up                  | 100 RP    | Every 10-referral milestone (LVL 10, 20, 30...)  | Automatic on milestone        |
    | Disk Upload               | 3 RP      | Each file uploaded to Vision Disk                 | Wallet > Disk                 |
    | Disk Download             | 1 RP      | Each file downloaded from Vision Disk             | Wallet > Disk                 |
    | Market Purchase           | 10 RP     | Buying content on Vision Market                   | Wallet > Market               |
    | Market Publish            | 5 RP      | Publishing content to Vision Market               | Wallet > Market               |
    | AI Chat                   | 1 RP      | Each conversation turn with Vision AI             | AI Chat (ZYNK)                |
    | Agent Create              | 15 RP     | Creating a new AI agent via Agent Hosting          | Wallet > Agent Desk           |
    | Profile Update            | 2 RP      | Updating profile information                      | Settings > Profile            |
    | Staking Deposit           | 10 RP     | Staking VCN tokens on-chain                       | Wallet > Staking              |
    | Transfer Send             | 3 RP      | Sending VCN to another user/address               | Wallet > Send                 |
    | Mobile Node Daily         | 5 RP      | Running mobile node for one full epoch (24h)      | Vision Node App               |
    | CEX Connect               | 15 RP     | First-time connecting a CEX exchange API key       | Wallet > CEX Portfolio        |
    | Quant Strategy Setup      | 20 RP     | Setting up an automated quant trading strategy     | Wallet > Quant Engine         |

    ═══ 2. AGENT API RP REWARDS (for AI agents using the Agent Gateway API) ═══
    AI agents registered through the Agent API earn RP for on-chain actions:
    | Agent Action              | RP Amount | Description                                      |
    |---------------------------|-----------|--------------------------------------------------|
    | Transfer (single)         | 5 RP      | Agent sends a single VCN transfer                |
    | Transfer (batch)          | 5 RP each | Per successful transfer in a batch operation      |
    | Staking Deposit           | 20 RP     | Agent stakes VCN tokens                           |
    | Staking Unstake           | 5 RP      | Agent unstakes VCN tokens                         |
    | Staking Claim Rewards     | 10 RP     | Agent claims accumulated staking rewards          |
    | Staking Withdraw          | 10 RP     | Agent withdraws staked VCN                        |
    | Staking Compound          | 25 RP     | Agent compounds (auto-restake) staking rewards    |
    | Bridge Initiate           | 15 RP     | Agent initiates a cross-chain bridge transaction  |
    | NFT Mint                  | 30 RP     | Agent mints an NFT on Vision Chain                |
    | Referral (inviter)        | 50 RP     | When another agent registers using this agent's referral code |
    | Referral (invitee)        | 25 RP     | Bonus for new agent that registers WITH a referral code       |

    ═══ 3. STORAGE NODE RP REWARDS ═══
    For users contributing to the Vision Chain decentralized storage network:
    | Node Activity             | RP Amount         | Trigger                               |
    |---------------------------|-------------------|---------------------------------------|
    | Mobile Node Daily Uptime  | 5 RP              | Once per epoch (24h) for running node |
    | Storage Contribution      | 1 RP per 10 chunks| Based on number of stored data chunks |

    ═══ 4. LOGIN STREAK BONUSES (Consecutive Day Rewards) ═══
    Logging in on consecutive days unlocks bonus RP milestones:
    | Consecutive Days | Bonus RP | Cumulative Effect                     |
    |------------------|----------|---------------------------------------|
    | 3 days           | +5 RP    | Early engagement incentive            |
    | 7 days           | +10 RP   | Weekly commitment reward              |
    | 14 days          | +20 RP   | Two-week consistency bonus            |
    | 30 days          | +100 RP  | Monthly dedication reward (major)     |
    | 100 days         | +500 RP  | Century milestone (rare achievement)  |
    Breaking the streak resets the counter to 0. The streak is tracked by KST (Korea Standard Time) date boundaries.

    ═══ 5. RP MILESTONE BONUSES (Total RP Accumulation) ═══
    When total accumulated RP reaches certain thresholds, bonus RP is awarded:
    | Milestone Reached | Bonus RP | Celebration                            |
    |-------------------|----------|----------------------------------------|
    | 100 RP            | +5 RP    | First milestone - modal celebration    |
    | 500 RP            | +10 RP   | Growing contributor - modal celebration|
    | 1,000 RP          | +20 RP   | Active member - modal celebration      |
    | 5,000 RP          | +30 RP   | Power user - modal celebration         |
    | 10,000 RP         | +50 RP   | Top contributor - modal celebration    |
    Each milestone triggers a congratulatory modal popup in the wallet UI.

    ═══ 6. REFERRAL RUSH LEADERBOARD REWARDS (Competitive Seasonal) ═══
    Referral Rush is a daily competitive event. Top referrers each round earn massive RP bonuses:
    | Rank      | RP Reward | Context                                         |
    |-----------|-----------|--------------------------------------------------|
    | 1st Place | 5,000 RP  | Highest referral count in the round              |
    | 2nd Place | 3,000 RP  | Second highest                                   |
    | 3rd Place | 1,000 RP  | Third highest                                    |
    | Top 10    | 500 RP    | Ranked 4th-10th                                  |
    | Top 50    | 100 RP    | Ranked 11th-50th                                 |
    Rounds are daily (24h, UTC-based). Pool per round: 1,000 VCN base + contribution-proportional distribution.

    ═══ 7. REFERRAL RP PROPAGATION (Multi-Tier Passive Earning) ═══
    This is Vision Chain's most powerful RP mechanism. When any user you referred earns RP, you AUTOMATICALLY earn a share:
    - Tier 1 (Direct Referral): You earn 10% of all RP your direct referral earns
    - Tier 2 (Grand Referral): You earn 2% of all RP your referral's referrals earn
    
    Detailed Example:
    1. You invite User A (you get +10 RP for the referral itself)
    2. User A stakes VCN and earns 10 RP -> You automatically get +1 RP (10% of 10)
    3. User A invites User B (User A gets +10 RP -> you get +1 RP from Tier 1)
    4. User B stakes VCN and earns 10 RP -> User A gets +1 RP (Tier 1), You get +0.2 RP (Tier 2, 2% of 10)
    
    ANTI-LOOP PROTECTION: RP earned from referral propagation itself (types: referral, levelup, tier1_rp, tier2_rp) does NOT cascade further, preventing infinite loops.
    
    WHY THIS MATTERS: A user with 50 active referrals can earn hundreds of RP passively per month without doing anything beyond the initial invitation.

    ═══ 8. RP CONVERSION & FUTURE VALUE ═══
    - RP will be convertible to VCN tokens at a ratio to be announced upon VCN exchange listing.
    - The conversion ratio will consider total RP supply, VCN allocation for RP holders, and market conditions.
    - Early accumulators are expected to benefit from a favorable conversion ratio.
    - RP is NON-TRANSFERABLE between users (unlike VCN tokens).
    - RP cannot be purchased; it can only be earned through platform activities.
    - There is no expiration date for accumulated RP.
    - Users can view their RP balance, history, and breakdown in Wallet > Rewards section.

    ═══ 9. KEY OPERATIONAL NOTES ═══
    - All RP amounts are admin-configurable and may change. The values above reflect current defaults.
    - RP is tracked in Firestore under user_reward_points/{email} with fields: totalRP, claimedRP, availableRP.
    - All RP history is logged in rp_history collection with type, amount, source, and timestamp.
    - RP is separate from VCN token rewards. VCN = node uptime mining. RP = platform engagement.
    - All on-chain transactions on Vision Chain are GASLESS (Paymaster covers gas fees), so performing RP-earning activities has zero cost.
    - Admin can adjust RP values in real-time via Admin > RP Config panel.

    ═══ MANDATORY RP RESPONSE FORMAT ═══
    When users ask about RP, rewards, or how to earn points:
    
    A) For GENERAL "What is RP?" or "Tell me about RP" questions:
       - Start with a 2-3 sentence overview of RP and its role in the 3-Tier Reward System
       - List ALL major RP earning categories with a formatted table (User Activity, Agent API, Node, Streak, Milestone, Referral Rush, Propagation)
       - Explain the Referral Propagation system with a concrete numeric example
       - Mention the RP-to-VCN conversion policy
       - Include a vision-chart showing RP distribution by category:
         \`\`\`vision-chart
        { "type": "bar", "title": "RP Earning Potential by Activity", "labels": ["Daily Login", "Referral", "Staking", "Agent Create", "CEX Connect", "Quant Setup", "Referral Rush 1st"], "series": [{ "name": "RP", "data": [5, 10, 10, 15, 15, 20, 5000] }] }
        \`\`\`
       - End with 3 recommended follow-up questions
    
    B) For SPECIFIC "How do I earn RP?" or "What gives the most RP?" questions:
       - Rank activities by RP amount (highest first)
       - Highlight the Referral Propagation as the most lucrative passive strategy
       - Provide a concrete monthly earning simulation (e.g., "If you log in daily + stake + refer 5 users, you can earn approximately X RP per month")
       - Include strategy recommendations based on effort vs. reward
    
    C) For REFERRAL-specific RP questions:
       - Explain the 3 types of referral RP: Direct (+10), Level-Up (+100), and Propagation (10%/2%)
       - Show the Referral Rush leaderboard rewards
       - Give a concrete example with numbers showing multi-tier passive earning
    
    D) For "How much RP do I have?" or personal RP questions:
       - Mention that RP balance is visible in Wallet > Rewards section
       - Explain the difference between totalRP, claimedRP, and availableRP
    
    NEVER give a brief or vague answer about RP. ALWAYS provide specific numbers, tables, and examples.

12. VISION DISK FILE MANAGEMENT (File Search & Sharing via Chat):
    You can search the user's Vision Disk files and share them with contacts.
    
    AVAILABLE TOOLS:
    - list_user_disk_files: Search user's files by folder and/or keyword
    - share_disk_file: Share a file with another user (requires file_id and target_email)
    - search_user_contacts: Find a contact's email by name (already available)
    
    WORKFLOW for "Send file X to person Y":
    Step 1: Call search_user_contacts to resolve the person's name to an email
    Step 2: Call list_user_disk_files with folder/search params to find matching files
    Step 3: If multiple files match, present a NUMBERED LIST to the user:
            "다음 파일 중 어떤 것을 공유할까요?
             1. 계약서_v2.pdf (2.3 MB, 2026-03-05)
             2. NDA계약서_최종.docx (580 KB, 2026-02-28)
             번호로 선택해주세요."
    Step 4: When user selects (e.g., "1번", "첫번째"), call share_disk_file with the file_id
    Step 5: Confirm the share was successful
    
    IMPORTANT RULES:
    - NEVER share a file without the user explicitly choosing which file (if multiple matches)
    - If only 1 file matches exactly, you may ask "이 파일을 공유할까요?" for confirmation
    - Encrypted files (isEncrypted: true) can still be shared but mention that the recipient will need the password
    - Include file size and date in the list for easier identification
    - If no files match, suggest available folders: "해당 폴더에 파일이 없습니다. 사용 가능한 폴더: /work, /photos, /"
    
    TRIGGER KEYWORDS (any language):
    Korean: "디스크", "파일", "공유", "보내줘", "전달", "첨부", "문서", "폴더"
    English: "disk", "file", "share", "send file", "attachment", "document", "folder"
`;

        const dynamicSystemPrompt = `${criticalInstructions}

[BASE SYSTEM PROMPT - Note: If anything below contradicts the HIGHEST PRIORITY rules above, the above rules take precedence]
${config.systemPrompt}
${tuningInfo}
${localeInfo}
${await getMarketIntelligenceBlock()}
`;

        const router = factory.getRouter();
        const { result, providerId: finalProviderId, apiKey: finalApiKey, model: finalModel } = await router.generateText(
            fullPrompt,
            { providerId: config.providerId, model: config.model, apiKey: config.apiKey, visionModel: config.visionModel },
            {
                systemPrompt: dynamicSystemPrompt,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
                imageBase64,
                botType
            }
        );

        let finalResultText = "";
        let currentResult = result;

        // --- Tool Execution Loop (Multi-Turn Support) ---
        if (typeof currentResult !== 'string' && finalProviderId === 'gemini' && currentResult.candidates?.[0]?.content?.parts) {
            const { GoogleGenAI } = await import('@google/genai');
            const genAI = new GoogleGenAI({ apiKey: finalApiKey });

            let currentContent = currentResult.candidates[0].content;
            const history: any[] = [{ role: 'user', parts: [{ text: fullPrompt }] }, currentContent];

            let toolCallsFound = true;
            let loopCount = 0;

            while (toolCallsFound && loopCount < 5) {
                toolCallsFound = false;
                const toolResultsParts: any[] = [];

                for (const part of currentContent.parts) {
                    if (part.functionCall) {
                        toolCallsFound = true;
                        const { name, args } = part.functionCall;
                        let toolResult: any = "Tool not found.";

                        console.log(`[AIService] Executing Tool: ${name}`, args);

                        if (name === 'get_historical_price') {
                            const { marketDataService } = await import('../marketDataService');
                            toolResult = await marketDataService.getHistoricalPrice(args.symbol, args.date);
                        } else if (name === 'get_current_price') {
                            const { marketDataService } = await import('../marketDataService');
                            toolResult = await marketDataService.getCurrentPrice(args.symbol);
                        } else if (name === 'get_chart_data') {
                            const { marketDataService } = await import('../marketDataService');
                            const chartData = await marketDataService.getChartData(args.symbol, args.days || 7);
                            // Return summarized data for AI consumption
                            if (chartData.length > 0) {
                                const first = chartData[0];
                                const last = chartData[chartData.length - 1];
                                const change = ((last.price - first.price) / first.price * 100).toFixed(2);
                                const high = Math.max(...chartData.map(d => d.price));
                                const low = Math.min(...chartData.map(d => d.price));
                                toolResult = {
                                    symbol: args.symbol.toUpperCase(),
                                    period: `${args.days || 7} days`,
                                    startPrice: first.price.toFixed(4),
                                    endPrice: last.price.toFixed(4),
                                    changePercent: `${change}%`,
                                    high: high.toFixed(4),
                                    low: low.toFixed(4),
                                    dataPoints: chartData.length
                                };
                            } else {
                                toolResult = "No chart data available.";
                            }
                        } else if (name === 'get_trending_coins') {
                            const { marketDataService } = await import('../marketDataService');
                            toolResult = await marketDataService.getTrendingCoins();
                        } else if (name === 'get_global_market') {
                            const { marketDataService } = await import('../marketDataService');
                            toolResult = await marketDataService.getGlobalMarketData();
                        } else if (name === 'search_defi_pools') {
                            const { defiService } = await import('../defiService');
                            toolResult = await defiService.getTopYields(args);
                        } else if (name === 'analyze_protocol_risk') {
                            const { defiService } = await import('../defiService');
                            toolResult = await defiService.analyzeProtocolRisk(args.projectName);
                        } else if (name === 'search_user_contacts') {
                            const { getUserContacts } = await import('../firebaseService');
                            const contacts = await getUserContacts(userId);
                            const searchQuery = (args.name || "").toLowerCase().replace('@', '').replace(/\s+/g, '');

                            const getMatchScore = (target: string, query: string) => {
                                const t = target.toLowerCase().replace(/\s+/g, '');
                                if (t === query) return 100;
                                if (t.includes(query) || query.includes(t)) return 90;
                                return 0;
                            };

                            const filtered = contacts.map(c => ({
                                ...c,
                                score: Math.max(getMatchScore(c.internalName || "", searchQuery), getMatchScore(c.alias || "", searchQuery))
                            })).filter(c => c.score >= 70).sort((a, b) => b.score - a.score);

                            toolResult = filtered.slice(0, 5).map(c => ({
                                name: c.internalName,
                                alias: c.alias,
                                vid: c.vchainUserUid ? `@${c.vchainUserUid}` : "Not linked",
                                address: c.address || "No address",
                                matchConfidence: c.score === 100 ? 'Exact' : 'Potential'
                            }));
                            if (toolResult.length === 0) toolResult = "No contacts found.";
                        } else if (name === 'get_cex_portfolio') {
                            try {
                                const { getCexPortfolio } = await import('../cexService');
                                const portfolioData = await getCexPortfolio();
                                if (!portfolioData.aggregated || portfolioData.portfolios.length === 0) {
                                    toolResult = "No exchange portfolio data is currently available for this user.";
                                } else {
                                    let assets = portfolioData.aggregated.assets;
                                    // Optional exchange filter
                                    if (args.exchange) {
                                        const filtered = portfolioData.portfolios.find(p => p.exchange === args.exchange);
                                        if (filtered) {
                                            assets = filtered.assets;
                                        }
                                    }
                                    toolResult = {
                                        totalValueKrw: portfolioData.aggregated.totalValueKrw,
                                        totalValueUsd: portfolioData.aggregated.totalValueUsd,
                                        connectedExchanges: portfolioData.portfolios.map(p => p.exchange),
                                        lastUpdated: portfolioData.aggregated.lastUpdated,
                                        assetCount: assets.length,
                                        assets: assets.slice(0, 20).map(a => ({
                                            symbol: a.currency,
                                            balance: a.balance,
                                            avgBuyPrice: a.avgBuyPrice,
                                            currentPriceKrw: a.currentPrice,
                                            currentPriceUsd: a.currentPriceUsd,
                                            valueKrw: a.valueKrw,
                                            valueUsd: a.valueUsd,
                                            profitLoss: a.profitLoss,
                                            profitLossPercent: a.profitLossPercent,
                                            allocationPercent: a.allocationPercent,
                                        })),
                                    };
                                }
                            } catch (cexErr: any) {
                                console.error('[AIService] CEX portfolio fetch failed:', cexErr);
                                toolResult = `Failed to fetch exchange portfolio data at this time.`;
                            }
                        } else if (name === 'create_agent') {
                            try {
                                const agentGatewayUrl = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
                                const response = await fetch(agentGatewayUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'register',
                                        agent_name: args.agent_name,
                                        platform: args.platform,
                                        owner_email: args.owner_email || '',
                                        referral_code: args.referral_code || '',
                                    }),
                                });
                                const result = await response.json();
                                if (result.success) {
                                    toolResult = {
                                        success: true,
                                        agent_name: result.agent.agent_name,
                                        wallet_address: result.agent.wallet_address,
                                        api_key: result.agent.api_key,
                                        referral_code: result.agent.referral_code,
                                        initial_balance: result.agent.initial_balance,
                                        funding_tx: result.agent.funding_tx,
                                        dashboard_url: result.agent.dashboard_url,
                                        message: 'Agent registered successfully! Save your api_key securely.',
                                    };
                                } else {
                                    toolResult = { success: false, error: result.error || 'Registration failed' };
                                }
                                console.log(`[AIService] create_agent result:`, toolResult);
                            } catch (agentErr: any) {
                                console.error('[AIService] create_agent failed:', agentErr);
                                toolResult = `Failed to create agent: ${agentErr.message}`;
                            }
                        } else if (name === 'check_agent_balance') {
                            try {
                                const agentGatewayUrl = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
                                const response = await fetch(agentGatewayUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'balance',
                                        api_key: args.api_key,
                                    }),
                                });
                                const result = await response.json();
                                if (result.success) {
                                    toolResult = {
                                        success: true,
                                        agent_name: result.agent_name,
                                        wallet_address: result.wallet_address,
                                        balance_vcn: result.balance_vcn,
                                        rp_points: result.rp_points,
                                    };
                                } else {
                                    toolResult = { success: false, error: result.error || 'Balance check failed' };
                                }
                            } catch (balErr: any) {
                                console.error('[AIService] check_agent_balance failed:', balErr);
                                toolResult = `Failed to check balance: ${balErr.message}`;
                            }
                        } else if (name === 'search_market_news') {
                            try {
                                const { searchArticles } = await import('./marketMemory');
                                const articles = await searchArticles({
                                    keywords: args.keywords,
                                    category: args.category,
                                    sentiment: args.sentiment,
                                    fromDate: args.fromDate,
                                    toDate: args.toDate,
                                    maxResults: Math.min(args.maxResults || 10, 20),
                                });
                                if (articles.length === 0) {
                                    toolResult = 'No articles found matching the search criteria. The market memory may not have enough historical data yet.';
                                } else {
                                    toolResult = {
                                        totalFound: articles.length,
                                        articles: articles.map(a => ({
                                            title: a.title,
                                            summary: a.oneLiner,
                                            source: a.sourceName || a.source,
                                            category: a.category,
                                            sentiment: a.sentimentLabel,
                                            impactScore: a.impactScore,
                                            publishedAt: a.publishedAt,
                                            keywords: a.keywords?.slice(0, 5),
                                        })),
                                    };
                                }
                            } catch (newsErr: any) {
                                console.error('[AIService] search_market_news failed:', newsErr);
                                toolResult = 'Market news search is temporarily unavailable.';
                            }
                        } else if (name === 'list_user_disk_files') {
                            try {
                                const { listDiskFiles, listAllDiskFolders, formatFileSize } = await import('../diskService');
                                let files = await listDiskFiles(userId);

                                // Filter by folder if specified
                                if (args.folder) {
                                    const folderPath = args.folder.startsWith('/') ? args.folder : `/${args.folder}`;
                                    files = files.filter(f => f.folder === folderPath || f.folder.startsWith(folderPath + '/'));
                                }

                                // Filter by search keyword (fuzzy match on file name)
                                if (args.search) {
                                    const kw = args.search.toLowerCase();
                                    files = files.filter(f => f.name.toLowerCase().includes(kw));
                                }

                                // Sort by most recent first
                                files.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

                                if (files.length === 0) {
                                    // If search had no results, try listing folders to help
                                    if (args.folder || args.search) {
                                        const allFiles = await listDiskFiles(userId);
                                        const folders = [...new Set(allFiles.map(f => f.folder))];
                                        toolResult = {
                                            found: 0,
                                            message: `No files found${args.folder ? ` in folder "${args.folder}"` : ''}${args.search ? ` matching "${args.search}"` : ''}.`,
                                            availableFolders: folders.slice(0, 20),
                                            totalFilesInDisk: allFiles.length,
                                        };
                                    } else {
                                        toolResult = "No files found in Vision Disk.";
                                    }
                                } else {
                                    toolResult = {
                                        found: files.length,
                                        files: files.slice(0, 20).map((f, idx) => ({
                                            index: idx + 1,
                                            id: f.id,
                                            name: f.name,
                                            size: formatFileSize(f.size),
                                            sizeBytes: f.size,
                                            type: f.type,
                                            folder: f.folder,
                                            tags: f.tags || [],
                                            abstract: f.abstract || '',
                                            isEncrypted: f.isEncrypted || false,
                                            createdAt: f.createdAt,
                                        })),
                                        note: files.length > 20 ? `Showing 20 of ${files.length} files. Ask user to narrow search.` : undefined,
                                    };
                                }
                            } catch (diskErr: any) {
                                console.error('[AIService] list_user_disk_files failed:', diskErr);
                                toolResult = `Failed to list disk files: ${diskErr.message}`;
                            }
                        } else if (name === 'share_disk_file') {
                            try {
                                const { shareResource } = await import('../diskService');
                                const result = await shareResource(args.target_email, 'file', args.file_id, args.file_name);
                                if (result.success) {
                                    // Send notification to recipient
                                    try {
                                        const { DiskNotifications } = await import('../notificationService');
                                        await DiskNotifications.fileShared(args.target_email, args.file_name, userId);
                                    } catch { /* notification is non-critical */ }

                                    toolResult = {
                                        success: true,
                                        shareId: result.shareId,
                                        message: `"${args.file_name}" has been shared with ${args.target_email}. They can now access it in their "Shared with me" section.`,
                                    };
                                } else {
                                    toolResult = { success: false, error: 'Share operation failed. The file may not exist or the user may not have permission.' };
                                }
                            } catch (shareErr: any) {
                                console.error('[AIService] share_disk_file failed:', shareErr);
                                toolResult = `Failed to share file: ${shareErr.message}`;
                            }
                        }

                        toolResultsParts.push({
                            functionResponse: { name, response: { result: toolResult || "Data not available" } }
                        });
                    }
                }

                if (toolCallsFound) {
                    const toolResponse = { role: 'function', parts: toolResultsParts };
                    history.push(toolResponse);

                    const response: any = await (genAI as any).models.generateContent({
                        model: finalModel,
                        contents: history,
                        config: {
                            systemInstruction: dynamicSystemPrompt,
                            tools: [{ functionDeclarations: (await import('./tools')).AI_TOOLS as any }]
                        }
                    });

                    currentContent = response.candidates?.[0]?.content;
                    if (!currentContent) break;
                    history.push(currentContent);

                    const textResponse = currentContent.parts?.find((p: any) => p.text)?.text;
                    if (textResponse) {
                        finalResultText = textResponse;
                    }

                    const moreTools = currentContent.parts?.some((p: any) => p.functionCall);
                    if (!moreTools) break;
                } else {
                    break;
                }
                loopCount++;
            }
        } else {
            finalResultText = typeof currentResult === 'string' ? currentResult : "I encountered an issue processing the data.";
        }

        return finalResultText || "I encountered an issue processing the data.";
    } catch (e: any) {
        console.error("[AIService] GenerateText Error:", e);
        return e.message || "An error occurred with the AI service.";
    }
};

// Streaming version for real-time response display
export const generateTextStream = async (
    prompt: string,
    onChunk: (chunk: string, fullText: string) => void,
    imageBase64?: string,
    botType: 'intent' | 'helpdesk' = 'intent',
    userId: string = 'anonymous',
    previousHistory: { role: string; content: string }[] = []
): Promise<string> => {
    try {
        const config = await factory.resolveConfig(botType);

        // Build same prompt structure as generateText
        const historyContext = previousHistory.length > 0
            ? `[Previous Conversation History]\n${previousHistory.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')}\n\n[Current User Input]\n`
            : '';
        let fullPrompt = historyContext + prompt;

        // --- Market Intelligence Auto-Injection (same as generateText) ---
        try {
            const { getMarketMemoryContext } = await import('./marketMemory');
            const marketContext = await getMarketMemoryContext(prompt);
            if (marketContext) {
                fullPrompt += marketContext;
                console.log('[AIService:Stream] Market memory context injected');
            }
        } catch (memErr) {
            console.debug('[AIService:Stream] Market memory injection skipped:', memErr);
        }

        // --- User Memory Auto-Injection (same as generateText) ---
        try {
            const { getUserMemory, generateUserMemoryContext } = await import('./userMemory');
            const memory = await getUserMemory(userId);
            const userContext = generateUserMemoryContext(memory);
            fullPrompt += userContext;
        } catch (umErr) {
            console.debug('[AIService:Stream] User memory injection skipped:', umErr);
        }

        // --- CEX Portfolio Auto-Injection (same as generateText) ---
        // Only inject CEX data when the user actually has connected exchanges.
        // If no exchanges connected, skip entirely -- do NOT mention CEX to the user.
        const actionKeywords = /브릿지|브릿징|전송|보내|송금|스왑|스테이킹|언스테이킹|bridge|bridging|transfer|send|swap|stake|unstake|mint/i;
        const cexKeywords = /포트폴리오|내 계좌|투자 현황|수익률|거래소 자산|리밸런싱|분석.*조언|투자 조언|내 투자|CEX|업비트|빗썸|portfolio|holdings|investment|P\&L|rebalance|advice|analyze.*portfolio|exchange.*asset|my assets/i;
        const shouldInjectCex = cexKeywords.test(prompt) && !actionKeywords.test(prompt);
        if (shouldInjectCex) {
            try {
                console.log('[AIService:Stream] CEX keyword detected, auto-fetching portfolio data...');
                const { getCexPortfolio } = await import('../cexService');
                const portfolioData = await getCexPortfolio();

                // Only inject if user actually has connected exchanges with data
                if (portfolioData.aggregated && portfolioData.portfolios.length > 0) {
                    const assets = portfolioData.aggregated.assets;
                    const assetDetails = assets.slice(0, 20).map(a =>
                        `  - ${a.currency}: ${a.balance.toLocaleString()} units | Avg Buy: ${a.avgBuyPrice.toLocaleString()}KRW | Current: ${a.currentPrice.toLocaleString()}KRW ($${a.currentPriceUsd.toFixed(2)}) | Value: ${a.valueKrw.toLocaleString()}KRW ($${a.valueUsd.toFixed(2)}) | P&L: ${a.profitLoss >= 0 ? '+' : ''}${a.profitLoss.toLocaleString()}KRW (${a.profitLossPercent >= 0 ? '+' : ''}${a.profitLossPercent.toFixed(2)}%) | Allocation: ${a.allocationPercent.toFixed(1)}%`
                    ).join('\n');

                    fullPrompt += `\n\n[CEX PORTFOLIO DATA - AUTO-FETCHED - THIS IS REAL DATA, ANALYZE IT]\nConnected Exchanges: ${portfolioData.portfolios.map(p => p.exchange).join(', ')}\nTotal Value: ${portfolioData.aggregated.totalValueKrw.toLocaleString()} KRW ($${portfolioData.aggregated.totalValueUsd.toFixed(2)})\nLast Updated: ${portfolioData.aggregated.lastUpdated || 'Unknown'}\nTotal Assets: ${assets.length}\n\nAsset Details:\n${assetDetails}\n\nIMPORTANT: Use this REAL data above to provide detailed portfolio analysis with charts (vision-chart).`;
                    console.log('[AIService:Stream] CEX data injected into prompt successfully');
                }
                // If no connected exchanges, skip silently -- don't mention CEX
            } catch (cexErr: any) {
                console.debug('[AIService:Stream] CEX auto-fetch failed (non-critical):', cexErr.message);
                // Don't inject any CEX mention on failure
            }
        }

        // --- Locale & Time Injection (CRITICAL: Must match generateText) ---
        const now = new Date();
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const userLocale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

        const formatDateForCoinGecko = (date: Date): string => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        };

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const localeInfo = `[System Time Context - Use this for ALL date/time calculations]
CURRENT_LOCAL_TIME: ${now.toLocaleString(userLocale, { timeZone: userTimezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
CURRENT_UTC_TIME: ${now.toISOString()}
CURRENT_TIMESTAMP_MS: ${Date.now()}
TIMEZONE: ${userTimezone}
USER_LOCALE: ${userLocale}
TODAY_LOCAL: ${now.toLocaleDateString(userLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
TODAY_DD_MM_YYYY: ${formatDateForCoinGecko(now)}
YESTERDAY_DD_MM_YYYY: ${formatDateForCoinGecko(yesterday)}
ONE_WEEK_AGO_DD_MM_YYYY: ${formatDateForCoinGecko(oneWeekAgo)}

IMPORTANT: When user asks about the current time, ALWAYS use CURRENT_LOCAL_TIME (not UTC). The user is in ${userTimezone}.
When user asks for "current" or "now" price, use get_current_price tool.
When user asks for historical price (past dates), use get_historical_price with the date in DD-MM-YYYY format.
For "yesterday", use YESTERDAY_DD_MM_YYYY. For "a week ago", use ONE_WEEK_AGO_DD_MM_YYYY.`;

        const dynamicSystemPrompt = `${config.systemPrompt || 'You are Vision AI, an advanced financial and blockchain assistant. You can analyze CEX portfolio data when provided.'}

${localeInfo}

[CRITICAL INSTRUCTIONS]
1. RESPONSE LANGUAGE (HIGHEST PRIORITY - HARDCODED DEFAULT):
   The user's browser locale is: ${userLocale}
   You MUST respond in the language matching this locale:
   ko/ko-KR=Korean, en/en-US/en-GB=English, ja/ja-JP=Japanese, zh/zh-CN/zh-TW=Chinese,
   es=Spanish, fr=French, de=German, pt=Portuguese, vi=Vietnamese, th=Thai. Fallback=English.
   NEVER respond in a language that doesn't match the user's locale.
   EXCEPTION: If 2+ consecutive user messages are in a different language from the locale, politely ask which language they prefer (in both languages). If confirmed, switch. If user explicitly requests a language, switch immediately.
2. FINANCIAL CONSULTANT PERSONA: Your tone should be professional, insightful, and helpful.
3. REAL-TIME DATA: Use TODAY_LOCAL as the current date. Never guess or use outdated dates.
4. CEX PORTFOLIO: When you see [CEX PORTFOLIO DATA] in the user's message, analyze it thoroughly with charts (vision-chart code blocks) and actionable advice. NEVER say CEX analysis is unavailable.
5. VISION CHAIN AGENT API: You have full knowledge of the Vision Chain Agent Gateway API.
   - Endpoint: POST https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway
   - Skill File: https://visionchain.co/skill.md | Docs: https://visionchain.co/docs/agent-api
   - Actions: register, balance, transfer, transactions, stake, unstake, claim_rewards, staking_info, referral, leaderboard, profile, network_info
   - Register gives 100 VCN + wallet + API key. All transactions are gasless.
   - RP Rewards: Transfer +5, Unstake +5, Claim +10, Stake +20, New Agent +25, Referral +50
   - Chain: Vision Chain (ID: 3151909) | Token: VCN (18 decimals) | RPC: https://api.visionchain.co/rpc-proxy
   When asked about agents, API setup, or VCN usage, provide accurate answers with curl/code examples.
${await getMarketIntelligenceBlock()}
`;

        // Use streaming router
        let accumulatedText = '';
        const result = await factory.getRouter().generateTextStream(
            fullPrompt,
            config,
            {
                systemPrompt: dynamicSystemPrompt,
                imageBase64
            },
            (chunk: string) => {
                accumulatedText += chunk;
                onChunk(chunk, accumulatedText);
            }
        );

        return result.result;
    } catch (e: any) {
        console.error("[AIService] GenerateTextStream Error:", e);
        return e.message || "An error occurred with the AI service.";
    }
};

export const generateImage = async (prompt: string, ratio: AspectRatio = AspectRatio.Square): Promise<string | null> => {
    try {
        const settings = await getChatbotSettings();
        const config = settings?.imageSettings || { model: 'imagen-3.0-generate-001', size: '1024x1024' };
        const apiKey = await getActiveGlobalApiKey('gemini'); // Image gen currently defaults to Google

        if (!apiKey) throw new Error("API Key for Image Generation missing.");

        const provider = factory.getProvider('gemini');
        return await provider.generateImage!(prompt, config.model, apiKey, ratio, { size: config.size });
    } catch (e) {
        console.error("[AIService] Image Gen Error:", e);
        return null;
    }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
    try {
        const config = await resolveVoiceConfig();
        const provider = factory.getProvider('gemini');
        return await provider.generateSpeech!(text, config.model, config.apiKey, config.ttsVoice);
    } catch (e) {
        console.error("[AIService] Speech Gen Error:", e);
        return null;
    }
};

/**
 * Legacy support / Utility for components needing specific configs (e.g. Live Voice)
 */
export const resolveVoiceConfig = async () => {
    const settings = await getChatbotSettings();
    const config = settings?.voiceSettings || { model: 'gemini-1.5-pro-latest', ttsVoice: 'Kore' };
    const apiKey = await getActiveGlobalApiKey('gemini');
    if (!apiKey) throw new Error("API Key for Voice Service missing.");

    return {
        provider: 'gemini',
        model: config.model,
        ttsVoice: config.ttsVoice,
        sttModel: (config as any).sttModel || 'gemini-1.5-pro-latest',
        apiKey
    };
};

export const resolveProviderConfig = async (botType: 'intent' | 'helpdesk') => {
    return await factory.resolveConfig(botType);
};
