import { generateText as generateTextGemini, generateImage as generateImageGemini, generateSpeech as generateSpeechGemini, getAiInstance as getAi } from './geminiService';
import { generateTextDeepSeek } from './deepseekService';
import { AspectRatio } from '../types';
import { getActiveGlobalApiKey, getChatbotSettings, saveConversation, getProviderFromModel } from './firebaseService';

// Unified Text Generation
export const generateText = async (
    prompt: string,
    imageBase64?: string,
    useFastModel: boolean = false,
    botType: 'intent' | 'helpdesk' = 'intent',
    userId: string = 'anonymous'
): Promise<string> => {
    let result = "";

    try {
        // 1. If Image is present, FORCE Gemini (DeepSeek is text-only for now)
        if (imageBase64) {
            result = await generateTextGemini(prompt, imageBase64, botType);
        } else {
            // 2. Fetch Active Provider from Firebase (Global)
            const settings = await getChatbotSettings();
            const botConfig = botType === 'helpdesk' ? settings?.helpdeskBot : settings?.intentBot;

            let provider = 'gemini';
            const modelName = botConfig?.model || 'gemini-1.5-flash';

            if (modelName) {
                provider = getProviderFromModel(modelName);
                if (!provider) provider = 'gemini'; // Fallback if unknown model string, but usually getProvider handles it.
                // Wait, getProviderFromModel returns '' if unknown.
                // Original logic defaulted to 'gemini' at line 25 then overrode it.
                // Let's match original safety: always have a provider?
                // Actually, step 1247 shows line 25: let provider = 'gemini'.
                // Then lines 28-30 override it.
            }

            // 3. Get Active Global Key
            const activeKey = await getActiveGlobalApiKey(provider);

            // 4. Execution based on provider
            if (provider === 'gemini') {
                // Pass the active key to Gemini if we have it, otherwise let it try its own resolution
                result = await generateTextGemini(prompt, imageBase64, botType, activeKey || undefined);
            } else if (provider === 'deepseek') {
                if (!activeKey) {
                    result = `Vision Chain AI requires an API Key for ${provider}. Please contact the administrator.`;
                } else {
                    result = await generateTextDeepSeek(prompt, activeKey, modelName, botType);
                }
            } else {
                if (!activeKey) {
                    result = `Vision Chain AI requires an API Key for ${provider}. Please contact the administrator.`;
                } else {
                    result = `Selected provider (${provider}) is configured but integration is pending.`;
                }
            }
        }

        // Log the interaction for Admin Monitoring
        saveConversation({
            userId,
            botType,
            messages: [
                { role: 'user', text: prompt, timestamp: new Date().toISOString() },
                { role: 'assistant', text: result, timestamp: new Date().toISOString() }
            ],
            lastMessage: result.substring(0, 100),
            createdAt: new Date().toISOString(),
            status: 'completed'
        }).catch(err => console.warn("[AI] Log failed:", err));

        return result;

    } catch (error) {
        console.error("Unified AI Error:", error);
        return "I encountered an error while processing your request. Please try again later.";
    }
};

// Pass-through for Image Generation (Gemini Only for now)
export const generateImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string | null> => {
    return generateImageGemini(prompt, aspectRatio);
};

// Pass-through for Speech (Gemini Only for now)
export const generateSpeech = async (text: string): Promise<string | null> => {
    return generateSpeechGemini(text);
};

// Export original Gemini Accessor for edge cases if needed
export { getAi };
