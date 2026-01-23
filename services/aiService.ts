import { generateText as generateTextGemini, generateImage as generateImageGemini, generateSpeech as generateSpeechGemini, getAiInstance as getAi } from './geminiService';
import { generateTextDeepSeek } from './deepseekService';
import { AspectRatio } from '../types';
import { getActiveGlobalApiKey, getChatbotSettings, saveConversation } from './firebaseService';

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

            if (modelName.includes('deepseek')) provider = 'deepseek';
            else if (modelName.includes('gpt')) provider = 'openai';
            else if (modelName.includes('claude')) provider = 'anthropic';

            // 3. Get Active Global Key
            const activeKey = await getActiveGlobalApiKey(provider);

            // 4. No Active Key - Prompt User
            if (!activeKey && provider !== 'gemini') {
                result = `Vision Chain AI requires an API Key for ${provider}. Please contact the administrator.`;
            } else if (provider === 'gemini') {
                result = await generateTextGemini(prompt, imageBase64, botType);
            } else if (provider === 'deepseek') {
                result = await generateTextDeepSeek(prompt, activeKey!, modelName, botType);
            } else {
                result = `Selected provider (${provider}) not fully integrated in this router yet.`;
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
