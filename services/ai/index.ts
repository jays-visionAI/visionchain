import { getChatbotSettings, getActiveGlobalApiKey, getProviderFromModel, saveConversation } from '../firebaseService';
import { AspectRatio } from '../../types';
import { AIProvider, AIProviderID, TextGenerationOptions } from './types';
import { GeminiProvider } from './providers/geminiProvider';
import { DeepSeekProvider } from './providers/deepseekProvider';
import { LLMRouter } from './router';

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
        const visionModel = botConfig?.visionModel || 'gemini-2.0-flash-exp';
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

        // --- CEX Portfolio Auto-Injection (Provider-agnostic, works with DeepSeek) ---
        // Skip CEX injection if user intent is clearly bridge/transfer/swap/stake (not asset management)
        const actionKeywords = /브릿지|브릿징|전송|보내|송금|스왑|스테이킹|언스테이킹|bridge|bridging|transfer|send|swap|stake|unstake|mint/i;
        const cexKeywords = /포트폴리오|내 계좌|투자 현황|수익률|거래소 자산|리밸런싱|분석.*조언|투자 조언|내 투자|CEX|업비트|빗썸|portfolio|holdings|investment|P\&L|rebalance|advice|analyze.*portfolio|exchange.*asset|my assets/i;
        const shouldInjectCex = cexKeywords.test(prompt) && !actionKeywords.test(prompt);
        if (shouldInjectCex) {
            try {
                console.log('[AIService] CEX keyword detected, auto-fetching portfolio data...');
                const { getCexPortfolio } = await import('../cexService');
                const portfolioData = await getCexPortfolio();

                let cexDataBlock = '';
                if (!portfolioData.aggregated || portfolioData.portfolios.length === 0) {
                    cexDataBlock = `\n\n[CEX PORTFOLIO DATA - AUTO-FETCHED]\nNo CEX portfolio data found. The user has not connected any exchange API keys yet.\nSuggest them to go to CEX Portfolio page to connect their Upbit or Bithumb account.\nNavigation: \`\`\`json\n{"intent":"navigate","page":"cex"}\n\`\`\``;
                } else {
                    const assets = portfolioData.aggregated.assets;
                    const assetDetails = assets.slice(0, 20).map(a =>
                        `  - ${a.currency}: ${a.balance.toLocaleString()} units | Avg Buy: ${a.avgBuyPrice.toLocaleString()}KRW | Current: ${a.currentPrice.toLocaleString()}KRW ($${a.currentPriceUsd.toFixed(2)}) | Value: ${a.valueKrw.toLocaleString()}KRW ($${a.valueUsd.toFixed(2)}) | P&L: ${a.profitLoss >= 0 ? '+' : ''}${a.profitLoss.toLocaleString()}KRW (${a.profitLossPercent >= 0 ? '+' : ''}${a.profitLossPercent.toFixed(2)}%) | Allocation: ${a.allocationPercent.toFixed(1)}%`
                    ).join('\n');

                    cexDataBlock = `\n\n[CEX PORTFOLIO DATA - AUTO-FETCHED - THIS IS REAL DATA, ANALYZE IT]\nConnected Exchanges: ${portfolioData.portfolios.map(p => p.exchange).join(', ')}\nTotal Value: ${portfolioData.aggregated.totalValueKrw.toLocaleString()} KRW ($${portfolioData.aggregated.totalValueUsd.toFixed(2)})\nLast Updated: ${portfolioData.aggregated.lastUpdated || 'Unknown'}\nTotal Assets: ${assets.length}\n\nAsset Details:\n${assetDetails}\n\nIMPORTANT: Use this REAL data above to provide detailed portfolio analysis with charts (vision-chart). Include allocation donut chart, P&L bar chart, risk assessment, and actionable recommendations.`;
                }
                fullPrompt += cexDataBlock;
                console.log('[AIService] CEX data injected into prompt successfully');
            } catch (cexErr: any) {
                console.error('[AIService] CEX auto-fetch failed:', cexErr);
                fullPrompt += `\n\n[CEX PORTFOLIO DATA]\nFailed to fetch: ${cexErr.message}. The user may not have connected their exchange accounts yet.`;
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
CURRENT_UTC_TIME: ${now.toISOString()}
CURRENT_TIMESTAMP_MS: ${Date.now()}
TIMEZONE: ${userTimezone}
USER_LOCALE: ${userLocale}
TODAY_LOCAL: ${now.toLocaleDateString(userLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
TODAY_DD_MM_YYYY: ${formatDateForCoinGecko(now)}
YESTERDAY_DD_MM_YYYY: ${formatDateForCoinGecko(yesterday)}
ONE_WEEK_AGO_DD_MM_YYYY: ${formatDateForCoinGecko(oneWeekAgo)}

IMPORTANT: When user asks for "current" or "now" price, use get_current_price tool.
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

1. RESPONSE LANGUAGE: You MUST respond in the SAME language as the user's input.
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

7. CEX PORTFOLIO ANALYSIS - THIS FEATURE IS LIVE AND FULLY OPERATIONAL:
   *** CEX portfolio data is automatically fetched and provided to you when the user asks about it. ***
   *** Look for [CEX PORTFOLIO DATA] section in the user's message - that contains REAL exchange data. ***
   *** NEVER say CEX analysis is unavailable, not supported, or coming soon. ***
   *** When you see [CEX PORTFOLIO DATA] in the prompt, analyze that data thoroughly. ***
   
   RESPONSE FORMAT - DUAL PORTFOLIO ANALYSIS:
   When CEX portfolio data is provided, ALWAYS respond with:
   
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
   
   If no CEX data: "거래소 API를 연결하시면 AI가 실시간으로 포트폴리오를 분석하고 맞춤 투자 조언을 제공합니다. CEX Portfolio 페이지에서 연결해 보세요."

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
`;

        const dynamicSystemPrompt = `${criticalInstructions}

[BASE SYSTEM PROMPT - Note: If anything below contradicts the HIGHEST PRIORITY rules above, the above rules take precedence]
${config.systemPrompt}
${tuningInfo}
${localeInfo}
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
                                    toolResult = "No CEX portfolio data found. The user has not connected any exchange API keys yet. Suggest them to go to CEX Portfolio page to connect their Upbit or Bithumb account.";
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
                                toolResult = `Failed to fetch CEX portfolio: ${cexErr.message}. The user may not have connected their exchange accounts yet.`;
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

        // --- CEX Portfolio Auto-Injection (same as generateText) ---
        // Skip CEX injection if user intent is clearly bridge/transfer/swap/stake
        const actionKeywords = /브릿지|브릿징|전송|보내|송금|스왑|스테이킹|언스테이킹|bridge|bridging|transfer|send|swap|stake|unstake|mint/i;
        const cexKeywords = /포트폴리오|내 계좌|투자 현황|수익률|거래소 자산|리밸런싱|분석.*조언|투자 조언|내 투자|CEX|업비트|빗썸|portfolio|holdings|investment|P\&L|rebalance|advice|analyze.*portfolio|exchange.*asset|my assets/i;
        const shouldInjectCex = cexKeywords.test(prompt) && !actionKeywords.test(prompt);
        if (shouldInjectCex) {
            try {
                console.log('[AIService:Stream] CEX keyword detected, auto-fetching portfolio data...');
                const { getCexPortfolio } = await import('../cexService');
                const portfolioData = await getCexPortfolio();

                let cexDataBlock = '';
                if (!portfolioData.aggregated || portfolioData.portfolios.length === 0) {
                    cexDataBlock = `\n\n[CEX PORTFOLIO DATA - AUTO-FETCHED]\nNo CEX portfolio data found. The user has not connected any exchange API keys yet.\nSuggest them to go to CEX Portfolio page to connect their Upbit or Bithumb account.`;
                } else {
                    const assets = portfolioData.aggregated.assets;
                    const assetDetails = assets.slice(0, 20).map(a =>
                        `  - ${a.currency}: ${a.balance.toLocaleString()} units | Avg Buy: ${a.avgBuyPrice.toLocaleString()}KRW | Current: ${a.currentPrice.toLocaleString()}KRW ($${a.currentPriceUsd.toFixed(2)}) | Value: ${a.valueKrw.toLocaleString()}KRW ($${a.valueUsd.toFixed(2)}) | P&L: ${a.profitLoss >= 0 ? '+' : ''}${a.profitLoss.toLocaleString()}KRW (${a.profitLossPercent >= 0 ? '+' : ''}${a.profitLossPercent.toFixed(2)}%) | Allocation: ${a.allocationPercent.toFixed(1)}%`
                    ).join('\n');

                    cexDataBlock = `\n\n[CEX PORTFOLIO DATA - AUTO-FETCHED - THIS IS REAL DATA, ANALYZE IT]\nConnected Exchanges: ${portfolioData.portfolios.map(p => p.exchange).join(', ')}\nTotal Value: ${portfolioData.aggregated.totalValueKrw.toLocaleString()} KRW ($${portfolioData.aggregated.totalValueUsd.toFixed(2)})\nLast Updated: ${portfolioData.aggregated.lastUpdated || 'Unknown'}\nTotal Assets: ${assets.length}\n\nAsset Details:\n${assetDetails}\n\nIMPORTANT: Use this REAL data above to provide detailed portfolio analysis with charts (vision-chart).`;
                }
                fullPrompt += cexDataBlock;
                console.log('[AIService:Stream] CEX data injected into prompt successfully');
            } catch (cexErr: any) {
                console.error('[AIService:Stream] CEX auto-fetch failed:', cexErr);
                fullPrompt += `\n\n[CEX PORTFOLIO DATA]\nFailed to fetch: ${cexErr.message}. The user may not have connected their exchange accounts yet.`;
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
CURRENT_UTC_TIME: ${now.toISOString()}
CURRENT_TIMESTAMP_MS: ${Date.now()}
TIMEZONE: ${userTimezone}
USER_LOCALE: ${userLocale}
TODAY_LOCAL: ${now.toLocaleDateString(userLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
TODAY_DD_MM_YYYY: ${formatDateForCoinGecko(now)}
YESTERDAY_DD_MM_YYYY: ${formatDateForCoinGecko(yesterday)}
ONE_WEEK_AGO_DD_MM_YYYY: ${formatDateForCoinGecko(oneWeekAgo)}

IMPORTANT: When user asks for "current" or "now" price, use get_current_price tool.
When user asks for historical price (past dates), use get_historical_price with the date in DD-MM-YYYY format.
For "yesterday", use YESTERDAY_DD_MM_YYYY. For "a week ago", use ONE_WEEK_AGO_DD_MM_YYYY.`;

        const dynamicSystemPrompt = `${config.systemPrompt || 'You are Vision AI, an advanced financial and blockchain assistant. You can analyze CEX portfolio data when provided.'}

${localeInfo}

[CRITICAL INSTRUCTIONS]
1. RESPONSE LANGUAGE: You MUST respond in the SAME language as the user's input.
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
   When asked about agents, API setup, or VCN usage, provide accurate answers with curl/code examples.`;

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
