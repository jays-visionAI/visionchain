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
            maxTokens: botConfig?.maxTokens || 2048
        };
    }
}

const factory = new ProviderFactory();

export const generateText = async (
    prompt: string,
    imageBase64?: string,
    botType: 'intent' | 'helpdesk' = 'intent',
    userId: string = 'anonymous'
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

        const provider = factory.getProvider(config.providerId);

        // --- Locale & Time Injection ---
        const now = new Date();
        const localeInfo = `[Current Context]
Date: ${now.toLocaleDateString()}
Time: ${now.toLocaleTimeString()}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
Locale: ${navigator.language}`;

        const dynamicSystemPrompt = config.systemPrompt
            ? `${config.systemPrompt}\n\n${localeInfo}`
            : localeInfo;

        let result = await provider.generateText(prompt, config.model, config.apiKey, {
            systemPrompt: dynamicSystemPrompt,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            imageBase64,
            botType
        });

        // --- Tool Execution Loop (Gemini specific for now) ---
        if (typeof result !== 'string' && result.candidates?.[0]?.content?.parts) {
            const parts = result.candidates[0].content.parts;
            const history: any[] = [{ role: 'user', parts: [{ text: prompt }] }, result.candidates[0].content];

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

