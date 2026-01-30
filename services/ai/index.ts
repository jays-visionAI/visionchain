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

        const fullPrompt = historyContext + prompt;

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

        const dynamicSystemPrompt = `${config.systemPrompt}
${tuningInfo}
${localeInfo}

[CRITICAL INSTRUCTIONS - OVERRIDE]
1. RESPONSE LANGUAGE: You MUST respond in the SAME language as the user's input.
2. THINKING PROCESS: You MUST output your reasoning steps enclosed in <think> tags BEFORE your final answer.
3. FINANCIAL CONSULTANT PERSONA: Your tone should be professional, insightful, and helpful, like a top-tier financial advisor.
4. RECOMMENDED QUESTIONS: If the user asks about market data, prices, or DeFi, YOU MUST provide 3 follow-up questions.
   Format: Append "[RECOMMENDED_QUESTIONS] Question 1 | Question 2 | Question 3" at the very end.

5. REAL-TIME DATA POLICY (MANDATORY - NO EXCEPTIONS):
   ⚠️ CRITICAL: You have NO KNOWLEDGE of current cryptocurrency prices. Your training data is outdated.
   
   - PRICE QUERY TRIGGERS (ANY LANGUAGE):
     English: "price", "how much", "what's the price", "current price", "now", "today"
     Korean: "가격", "얼마", "시세", "현재", "지금", "오늘"
     
   - MANDATORY TOOL USAGE:
     * DEFAULT: If NO time specified → MUST call 'get_current_price' (assume user wants NOW/CURRENT price)
     * For "현재/current/지금/now/today" → MUST call 'get_current_price'
     * For "어제/yesterday/과거/past" → MUST call 'get_historical_price'
     * Example: "비트코인 가격 얼마야?" → MUST call get_current_price(symbol: "btc")
     * Example: "어제 비트코인 가격?" → MUST call get_historical_price(symbol: "btc", date: YESTERDAY_DD_MM_YYYY)
     
   - NEVER estimate, recall, or make up prices from memory
   - If tool call fails, respond: "실시간 데이터를 가져올 수 없습니다" / "Cannot retrieve real-time data"
   - ALWAYS cite tool results, never your training knowledge


6. CHART & INFOGRAPHIC GENERATION:
   You can render beautiful, interactive charts by using a special code block format.
   When the user asks for visual data (charts, graphs, trends, comparisons), include this:

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

   EXAMPLES:
   
   For portfolio pie chart:
   \`\`\`vision-chart
   {"type":"donut","title":"Your Portfolio","labels":["BTC","ETH","SOL","Other"],"series":[45,30,15,10]}
   \`\`\`

   For price trend:
   \`\`\`vision-chart
   {"type":"area","title":"BTC 7-Day Price","labels":["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],"series":[{"name":"BTC","data":[88000,87500,89000,87000,88500,90000,87925]}]}
   \`\`\`

   For comparison bars:
   \`\`\`vision-chart
   {"type":"bar","title":"24h Volume Comparison","labels":["BTC","ETH","SOL"],"series":[{"name":"Volume (B)","data":[25.5,12.3,4.8]}]}
   \`\`\`

   IMPORTANT: Always use actual data from tool calls. Do not hardcode fake numbers.
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
