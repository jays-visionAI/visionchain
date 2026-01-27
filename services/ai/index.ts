import { getChatbotSettings, getActiveGlobalApiKey, getProviderFromModel, saveConversation } from '../firebaseService';
import { AspectRatio } from '../../types';
import { AIProvider, AIProviderID, TextGenerationOptions } from './types';
import { GeminiProvider } from './providers/geminiProvider';
import { DeepSeekProvider } from './providers/deepseekProvider';

class ProviderFactory {
    private providers: Map<AIProviderID, AIProvider> = new Map();

    constructor() {
        this.providers.set('gemini', new GeminiProvider());
        this.providers.set('deepseek', new DeepSeekProvider());
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
        let config = await factory.resolveConfig(botType);

        // Capability check: DeepSeek doesn't support images yet
        if (imageBase64 && config.providerId === 'deepseek') {
            const geminiKey = await getActiveGlobalApiKey('gemini');
            if (geminiKey) {
                console.warn("[AIService] DeepSeek doesn't support images. Falling back to Gemini.");
                config = { ...config, providerId: 'gemini', model: 'gemini-1.5-pro-latest', apiKey: geminiKey };
            }
        }

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
[Intent Resolution Guidelines]
1. Recipient Identification: ${pt.recipientIntent}
2. Sender Context: ${pt.senderIntent}
3. Execution Route: ${pt.processingRoute}
` : '';

        const dynamicSystemPrompt = `${config.systemPrompt}
${tuningInfo}
${localeInfo}

[CRITICAL INSTRUCTIONS - OVERRIDE]
1. RESPONSE LANGUAGE: You MUST respond in the SAME language as the user's input.
2. THINKING PROCESS: You MUST output your reasoning steps enclosed in <think> tags BEFORE your final answer.
   Format: <think>Step Title: Brief detail</think>
   DO NOT output markdown for steps. Use ONLY the <think> tags.

3. REAL-TIME DATA POLICY (STRICT):
   - **DO NOT HALLUCINATE PRICES.** If the user asks for a price, YOU MUST use 'get_current_price' or 'get_historical_price'.
   - NEVER provide a price from your internal knowledge base. 
   - ALWAYS verify the CURRENT_TIMESTAMP_MS before deciding if a request is for "now" or "future".

4. TOOL USAGE POLICY (SPEED OPTIMIZATION):
   - **CHECK THE [ADDRESS BOOK] SECTION FIRST.**
   - IF the target name appears in the [ADDRESS BOOK] list provided in the context:
     - **DO NOT** USE THE 'search_user_contacts' TOOL.
     - USE the address directly from the list and TRIGGER JSON IMMEDIATELY.

5. EXECUTION POLICY (STRICT SAFETY):
   [CASE A: EXACT MATCH]
   - IF the contact search returns an 'Exact' match (Confidence 100%), DO NOT ASK "Is this correct?".
   - IMMEDIATELY Output the JSON for the action to trigger the UI.

   [CASE B: PARTIAL / AMBIGUOUS MATCH]
   - IF the match is only 'Potential', ask: "Did you mean [Full Name]?"
   - **CRITICAL**: When the user confirms, **DO NOT ASK for the amount again** if it was mentioned earlier.

   [JSON FORMAT]
   - When executing, append this JSON to the very end of your response:
   - For immediate: {"intent": "send", "recipient": "0x...", "amount": "...", "symbol": "..."}
   - For scheduled: {"intent": "schedule", "recipient": "0x...", "amount": "...", "symbol": "...", "executeAt": 1731234567890}

6. LOCALE AWARENESS:
   - Format all date/time and currency displays according to the USER_LOCALE provided.
   - For KR locale, use "만 원", "원" etc. for fiat if requested, but keep crypto symbols as is.
`;

        let result = await provider.generateText(fullPrompt, config.model, config.apiKey, {
            systemPrompt: dynamicSystemPrompt,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            imageBase64,
            botType
        });

        // --- Tool Execution Loop (Multi-Turn Support) ---
        if (typeof result !== 'string' && result.candidates?.[0]?.content?.parts) {
            let currentContent = result.candidates[0].content;
            const history: any[] = [{ role: 'user', parts: [{ text: fullPrompt }] }, currentContent];

            let toolCallsFound = true;
            let loopCount = 0;

            while (toolCallsFound && loopCount < 3) { // Limit loops to prevent infinite recursion
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
                            const rawQuery = (args.name || "").toLowerCase().replace('@', '');
                            const searchQuery = rawQuery.replace(/\s+/g, '');

                            // Simple Fuzzy Match Helper
                            const getMatchScore = (target: string, query: string) => {
                                const t = target.toLowerCase().replace(/\s+/g, '');
                                if (t === query) return 100;
                                if (t.includes(query) || query.includes(t)) return 90;
                                const targetChars = t.split('');
                                const queryChars = query.split('');
                                const intersection = queryChars.filter(c => targetChars.includes(c));
                                if (intersection.length >= 2 && intersection.length >= query.length - 1) return 80;
                                return 0;
                            };

                            const scoredContacts = contacts.map(c => ({
                                ...c,
                                score: Math.max(
                                    getMatchScore(c.internalName || "", searchQuery),
                                    getMatchScore(c.alias || "", searchQuery),
                                    getMatchScore(c.vchainUserUid || "", searchQuery)
                                )
                            }));

                            const filtered = scoredContacts.filter(c => c.score >= 70).sort((a, b) => b.score - a.score);
                            toolResult = filtered.map(c => ({
                                name: c.internalName,
                                alias: c.alias,
                                vid: c.vchainUserUid ? `@${c.vchainUserUid}` : "Not linked",
                                address: c.address || "No address",
                                email: c.email,
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
                    const toolResponse = { role: 'user', parts: toolResultsParts };
                    history.push(toolResponse);

                    const ai = new (await import('@google/genai')).GoogleGenAI({ apiKey: config.apiKey });
                    const finalResponse = await ai.models.generateContent({
                        model: config.model,
                        contents: history,
                        config: { systemInstruction: dynamicSystemPrompt }
                    });

                    currentContent = finalResponse.candidates?.[0]?.content;
                    if (!currentContent) break;
                    history.push(currentContent);
                    result = currentContent.parts?.[0]?.text || "I retrieved the data but failed to format the final answer.";
                    loopCount++;
                }
            }
        }

        const finalResult = typeof result === 'string' ? result : "I encountered an issue processing the data.";

        // Async log
        saveConversation({
            userId,
            botType,
            messages: [
                { role: 'user', text: prompt, timestamp: new Date().toISOString() },
                { role: 'assistant', text: finalResult, timestamp: new Date().toISOString() }
            ],
            lastMessage: finalResult.substring(0, 100),
            status: 'completed'
        }).catch(e => console.warn("[AIService] Log failed:", e));

        return finalResult;
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
