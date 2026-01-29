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
        const providerId = getProviderFromModel(model) as AIProviderID;
        const apiKey = await getActiveGlobalApiKey(providerId);

        if (!apiKey) throw new Error(`API Key for ${providerId} not found.`);

        return {
            providerId,
            model,
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

        // --- Locale & Time Injection ---
        const now = new Date();
        const localeInfo = `[System Time Context]
CURRENT_UTC_TIME: ${now.toISOString()}
CURRENT_TIMESTAMP_MS: ${Date.now()}
TIMEZONE: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
USER_LOCALE: ${navigator.language}
LOCALE_TODAY: ${now.toLocaleDateString(navigator.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

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

5. REAL-TIME DATA POLICY (STRICT):
   - **DO NOT HALLUCINATE PRICES.** If the user asks for a price, YOU MUST use 'get_current_price' or 'get_historical_price'.
   - NEVER provide a price from your internal knowledge base. 
`;

        const router = factory.getRouter();
        const { result, providerId: finalProviderId, apiKey: finalApiKey, model: finalModel } = await router.generateText(
            fullPrompt,
            { providerId: config.providerId, model: config.model, apiKey: config.apiKey },
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
