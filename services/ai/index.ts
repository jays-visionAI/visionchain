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
        const localeInfo = `[Current Context]
Date: ${now.toLocaleDateString()}
Time: ${now.toLocaleTimeString()}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
Locale: ${navigator.language}

[Language Rule]
Always respond in the same language used by the user in their most recent message. 
Unless explicitly requested otherwise by the user, you MUST match their language exactly (e.g., if the user asks in Korean, answer in Korean; if in English, answer in English).`;

        const pt = (config as any).promptTuning;
        const tuningInfo = pt ? `
[Intent Resolution Guidelines]
1. Recipient Identification: ${pt.recipientIntent}
2. Sender Context: ${pt.senderIntent}
3. Execution Route: ${pt.processingRoute}
` : '';

        const dynamicSystemPrompt = `${config.systemPrompt}\n${tuningInfo}\n${localeInfo}

[CRITICAL INSTRUCTIONS - OVERRIDE]
1. RESPONSE LANGUAGE: You MUST respond in the SAME language as the user's input.
2. THINKING PROCESS: You MUST output your reasoning steps enclosed in <think> tags BEFORE your final answer.
   Format: <think>Step Title: Brief detail</think>
   DO NOT output markdown for steps. Use ONLY the <think> tags.

3. TOOL USAGE POLICY (SPEED OPTIMIZATION):
   - **CHECK THE [ADDRESS BOOK] SECTION FIRST.**
   - IF the target name appears in the [ADDRESS BOOK] list provided in the context:
     - **DO NOT** USE THE 'search_user_contacts' TOOL.
     - **DO NOT** SEARCH AGAIN.
     - USE the address directly from the list and TRIGGER JSON IMMEDIATELY.
   - ONLY use the tool if the name is NOT in the context or requires external lookup.

4. EXECUTION POLICY (STRICT SAFETY):
   [CASE A: EXACT MATCH]
   - IF the contact search returns an 'Exact' match (Confidence 100%), DO NOT ASK "Is this correct?".
   - IMMEDIATELY Output the JSON for the action to trigger the UI.
   - Example: User says "To Alice", Found "Alice" -> TRIGGER JSON.

   [CASE B: PARTIAL / AMBIGUOUS MATCH]
   - IF the match is only 'Potential' (e.g. User says "Ryu", Found "Ryu CEO"), ask: "Did you mean [Full Name]?"
   - **CRITICAL**: When the user confirms (e.g. "Yes", "Right"), **DO NOT ASK for the amount again** if it was mentioned earlier.
   - RECALL the amount/symbol from the previous turn and IMMEDIATELY Output the JSON.
   - If amount was never mentioned, default to "0" (User can edit in UI).
   - Example: 
     User: "Send 100 VCN to Ryu" -> AI: "Did you mean Ryu CEO?" -> User: "Yes" 
     -> AI: "Understood. Preparing transfer to Ryu CEO." {"intent": "send", ... "amount": "100"}

   [JSON FORMAT]
   - When executing, append this JSON to the very end of your response:
   {"intent": "send", "recipient": "0x...", "amount": "...", "symbol": "..."}

5. TIME SENSITIVITY & SCHEDULING RULE:
   - **STRICT INDEPENDENCE**: IGNORE all time references in [Previous Conversation History]. THOSE ARE STALE.
   - **CALCULATION SOURCE**: Use ONLY the [Current User Input] and the [Current Time] provided at the top.
   - **MATHEMATICAL RULE**: If user says "X minutes later", the timestamp MUST be exactly (Current Time + X minutes). 
   - **PAST TIME FORBIDDEN**: Never return a timestamp that is equal to or earlier than the [Current Time].
   - Example (Current is 20:06): "10 mins later" -> MUST be exactly 20:16. Do NOT use 20:05 or 20:12 from any example or history.


`;

        let result = await provider.generateText(fullPrompt, config.model, config.apiKey, {
            systemPrompt: dynamicSystemPrompt,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            imageBase64,
            botType
        });

        // --- Tool Execution Loop ---
        if (typeof result !== 'string' && result.candidates?.[0]?.content?.parts) {
            const parts = result.candidates[0].content.parts;
            const history: any[] = [{ role: 'user', parts: [{ text: fullPrompt }] }, result.candidates[0].content];

            for (const part of parts) {
                if (part.functionCall) {
                    const { name, args } = part.functionCall;
                    let toolResult: any = "Tool not found.";

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
                        const searchQuery = rawQuery.replace(/\s+/g, ''); // Remove spaces

                        // Simple Fuzzy Match Helper
                        const getMatchScore = (target: string, query: string) => {
                            const t = target.toLowerCase().replace(/\s+/g, '');
                            if (t === query) return 100; // Exact match
                            if (t.includes(query) || query.includes(t)) return 90; // Partial match

                            // Check for character overlap
                            const targetChars = t.split('');
                            const queryChars = query.split('');
                            const intersection = queryChars.filter(c => targetChars.includes(c));
                            if (intersection.length >= 2 && intersection.length >= query.length - 1) return 80;

                            // Common phonetic swaps
                            const phoneticMap: Record<string, string> = { '우': '유', '유': '우', '오': '어', '어': '오', '국': '쿡', '쿡': '국', '루': '류', '류': '루' };
                            let fuzzyQuery = query;
                            for (const char of query) {
                                if (phoneticMap[char]) fuzzyQuery = fuzzyQuery.replace(char, phoneticMap[char]);
                            }
                            if (t.includes(fuzzyQuery)) return 70;

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

                        if (toolResult.length === 0) {
                            toolResult = `No contacts found matching '${args.name}'. Suggest confirming the exact name or address.`;
                        }
                    }

                    // Feed tool result back to AI
                    const toolResponse = {
                        role: 'user',
                        parts: [{
                            functionResponse: {
                                name,
                                response: { result: toolResult || "Data not available" }
                            }
                        }]
                    };
                    history.push(toolResponse);

                    // Final call with history
                    const ai = new (await import('@google/genai')).GoogleGenAI({ apiKey: config.apiKey });
                    const finalResponse = await ai.models.generateContent({
                        model: config.model,
                        contents: history,
                        config: {
                            systemInstruction: dynamicSystemPrompt
                        }
                    });

                    result = finalResponse.candidates?.[0]?.content?.parts?.[0]?.text || "I retrieved the data but failed to format the final answer.";
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
