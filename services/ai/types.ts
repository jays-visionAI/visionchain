import { AspectRatio } from '../../types';

export type AIProviderID = 'gemini' | 'deepseek' | 'openai' | 'anthropic';

export interface TextGenerationOptions {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    imageBase64?: string;
    botType?: 'intent' | 'helpdesk';
}

export interface ImageGenerationOptions {
    size?: string;
    quality?: 'standard' | 'hd';
}

export interface AIProvider {
    id: AIProviderID;
    generateText(prompt: string, model: string, apiKey: string, options?: TextGenerationOptions): Promise<string>;
    generateImage?(prompt: string, model: string, apiKey: string, ratio: AspectRatio, options?: ImageGenerationOptions): Promise<string | null>;
    generateSpeech?(text: string, model: string, apiKey: string, voiceName: string): Promise<string | null>;
}
