
import { getChatbotSettings, getActiveGlobalApiKey, getProviderFromModel, ChatbotSettings } from './firebaseService';

export interface AIConfig {
    provider: 'gemini' | 'deepseek' | 'openai' | 'anthropic' | 'unknown';
    model: string;
    apiKey: string;
    systemPrompt: string;
}

/**
 * Centralized AI Configuration Manager
 * Responsible for resolving which AI Model, Provider, and API Key to use.
 */
export const aiManager = {
    /**
     * Resolves the full configuration needed to make an AI request.
     * @param botType 'intent' or 'helpdesk'
     */
    async resolveConfig(botType: 'intent' | 'helpdesk' = 'intent'): Promise<AIConfig> {
        // 1. Fetch Settings
        const settings = await getChatbotSettings();
        if (!settings) {
            throw new Error("AI Configuration not found in system.");
        }

        // 2. Determine Bot Config
        const botConfig = botType === 'helpdesk' ? settings.helpdeskBot : settings.intentBot;
        const modelName = botConfig?.model || '';

        if (!modelName) {
            throw new Error(`No AI model configured for ${botType} bot.`);
        }

        // 3. Resolve Provider
        const provider = getProviderFromModel(modelName) as AIConfig['provider'];
        if (!provider || provider === 'unknown') {
            throw new Error(`Unsupported AI provider for model: ${modelName}`);
        }

        // 4. Fetch API Key
        const apiKey = await getActiveGlobalApiKey(provider);
        if (!apiKey) {
            throw new Error(`No active API Key found for provider: ${provider}`);
        }

        return {
            provider,
            model: modelName,
            apiKey,
            systemPrompt: botConfig?.systemPrompt || ''
        };
    },

    /**
     * Resolves configuration specifically for Image Generation
     */
    async resolveImageConfig() {
        const settings = await getChatbotSettings();
        const config = settings?.imageSettings || { model: '', size: '1k' };

        if (!config.model) throw new Error("Image generation model not configured.");

        // Image generation currently implies Gemini in this system
        // But we should ideally check provider if we expand support
        const provider = 'gemini';
        const apiKey = await getActiveGlobalApiKey(provider);

        if (!apiKey) throw new Error("No API Key for Image Generation (Gemini).");

        return {
            provider,
            model: config.model,
            size: config.size,
            apiKey
        };
    },

    /**
     * Resolves configuration specifically for Voice/TTS
     */
    async resolveVoiceConfig() {
        const settings = await getChatbotSettings();
        const config = settings?.voiceSettings || { model: '', ttsVoice: 'Kore' };

        if (!config.model) throw new Error("Voice model not configured.");

        // Voice currently implies Gemini
        const provider = 'gemini';
        const apiKey = await getActiveGlobalApiKey(provider);

        if (!apiKey) throw new Error("No API Key for Voice Service (Gemini).");

        return {
            provider,
            model: config.model,
            ttsVoice: config.ttsVoice,
            sttModel: (config as any).sttModel || '', // Safe access or fix interface
            apiKey
        };
    }
};
