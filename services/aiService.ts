import { generateTextGemini, generateImageGemini, generateSpeechGemini, getAiInstance as getAi } from './geminiService';
import { generateTextDeepSeek } from './deepseekService';
import { AspectRatio } from '../types';
import { saveConversation } from './firebaseService';
import { aiManager } from './aiManager';

// Unified Text Generation
export const generateText = async (
    prompt: string,
    imageBase64?: string,
    useFastModel: boolean = false, // Deprecated argument kept for interface compat but ignored in favor of Admin Settings
    botType: 'intent' | 'helpdesk' = 'intent',
    userId: string = 'anonymous'
): Promise<string> => {
    let result = "";

    try {
        // 1. Resolve Configuration via Manager
        // If image present, currently defaulting to Gemini inside Manager logic or logic here?
        // Actually aiManager doesn't know about imageBase64 constraint yet.
        // Let's handle the "Image implies Gemini" constraint here for now until DeepSeek supports Vision.
        let config;

        if (imageBase64) {
            // Force Gemini Vision if image is present (Temporary Logic)
            // Ideally we should ask AI Manager for "Vision Capable Config"
            const allSettings = await import('./firebaseService').then(m => m.getChatbotSettings());
            // For now, if image, we unfortunately still need a specific flow or we trust the Admin set a vision model.
            // But deepseek is text only. 
            // Let's assume for this specific call, if image exists, we try to use the Intent Bot's model IF it supports vision, 
            // but safer to just route to Gemini Vision Model if we want to guarantee success?
            // OR: We follow the instruction: "Clean Code".
            // Let's rely on aiManager.resolveConfig, but if provider is deepseek and we have image, we fail or fallback?

            // BETTER: Ask Manager for intent config. If it's deepseek, we can't send image.
            // We will handle this by trying to find a Gemini Key and falling back to Gemini Vision.
            // But to keep it simple as requested: "Respect Admin Settings".
            // If Admin set DeepSeek and user sends Image -> It should probably fail or warn "Model doesn't support image".
            // BUT for UX, we might want to fallback.
            // Let's stick to: Resolve Config.
            config = await aiManager.resolveConfig(botType);

            if (config.provider === 'deepseek') {
                // DeepSeek doesn't support images yet.
                // Fallback to Gemini for Vision tasks if possible?
                console.warn("DeepSeek does not support images. Falling back to Gemini for this request.");
                // We need a separate way to get a Gemini Config then.
                // This implies we need a 'getProviderConfig('gemini')' method.
                // For now, let's keep it simple: If image, use Gemini Service directly if key exists.
                const geminiKey = await import('./firebaseService').then(m => m.getActiveGlobalApiKey('gemini'));
                if (!geminiKey) throw new Error("Image uploaded but DeepSeek is active and no Gemini Key found for fallback.");
                config = { provider: 'gemini', model: 'gemini-1.5-flash', apiKey: geminiKey, systemPrompt: config.systemPrompt } as any;
            }
        } else {
            config = await aiManager.resolveConfig(botType);
        }

        // 2. Execution based on provider
        if (config.provider === 'gemini') {
            result = await generateTextGemini(
                config.apiKey,
                config.model,
                config.systemPrompt,
                prompt,
                imageBase64
            );
        } else if (config.provider === 'deepseek') {
            result = await generateTextDeepSeek(
                prompt,
                config.apiKey,
                config.model,
                botType
            );
        } else if (config.provider === 'openai') {
            result = "OpenAI integration coming soon.";
        } else if (config.provider === 'anthropic') {
            result = "Anthropic integration coming soon.";
        } else {
            result = `Provider ${config.provider} not supported yet.`;
        }

        // Log the interaction
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

    } catch (error: any) {
        console.error("Unified AI Error:", error);
        if (error.message?.includes("API Key")) return error.message;
        return "I encountered an error. Please check the system configuration.";
    }
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string | null> => {
    try {
        const config = await aiManager.resolveImageConfig();
        return generateImageGemini(config.apiKey, config.model, aspectRatio, config.size, prompt);
    } catch (e) {
        console.error("Image Gen Error:", e);
        return null;
    }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
    try {
        const config = await aiManager.resolveVoiceConfig();
        return generateSpeechGemini(config.apiKey, config.model, config.ttsVoice, text);
    } catch (e) {
        console.error("Speech Gen Error:", e);
        return null; // AIChat handles null
    }
};

// Export original Gemini Accessor for edge cases (Live API) if needed, 
// but generally clients should go through Manager or Service.
export { getAi };
