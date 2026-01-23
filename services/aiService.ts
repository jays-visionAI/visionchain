import { generateText as generateTextGemini, generateImage as generateImageGemini, generateSpeech as generateSpeechGemini, getAi } from './geminiService';
import { generateTextDeepSeek } from './deepseekService';
import { AspectRatio } from '../types';

// Admin settings keys
const STORAGE_KEYS = {
    apiKeys: 'visionchain_api_keys',
    model: 'visionchain_ai_model',
    voice: 'visionchain_ai_voice'
};

interface ApiKey {
    key: string;
    provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
    isActive: boolean;
}

const getActiveKey = (): ApiKey | null => {
    try {
        const savedKeys = localStorage.getItem(STORAGE_KEYS.apiKeys);
        if (!savedKeys) return null;

        const keys: ApiKey[] = JSON.parse(savedKeys);
        return keys.find(k => k.isActive) || null;
    } catch {
        return null;
    }
};

const getSelectedModel = (): string => {
    return localStorage.getItem(STORAGE_KEYS.model) || 'deepseek-chat';
};

// Unified Text Generation
export const generateText = async (prompt: string, imageBase64?: string, useFastModel: boolean = false): Promise<string> => {
    const activeKey = getActiveKey();
    let model = getSelectedModel();

    // Override model if useFastModel is true (mostly for Gemini)
    if (useFastModel && activeKey?.provider === 'gemini') {
        model = 'gemini-1.5-flash';
    }

    // 1. If Image is present, FORCE Gemini (DeepSeek is text-only for now in this context)
    // Or if active provider is Gemini
    if (imageBase64 || !activeKey || activeKey.provider === 'gemini') {
        return generateTextGemini(prompt, imageBase64, useFastModel);
    }

    // 2. DeepSeek Handler
    if (activeKey.provider === 'deepseek') {
        const deepSeekModel = model.startsWith('deepseek') ? model : 'deepseek-chat';
        return generateTextDeepSeek(prompt, activeKey.key, deepSeekModel);
    }

    // Fallback
    return "Selected provider not supported yet.";
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
