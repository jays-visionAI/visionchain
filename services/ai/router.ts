import { AIProviderID, TextGenerationOptions } from "./types";
import { getActiveGlobalApiKey } from "../firebaseService";

export interface RouterResult {
    result: string | any;
    providerId: AIProviderID;
    model: string;
    apiKey: string;
}

export class LLMRouter {
    constructor(private factory: any) { }

    async generateText(
        prompt: string,
        config: { providerId: AIProviderID; model: string; apiKey: string },
        options: TextGenerationOptions
    ): Promise<RouterResult> {
        const isDeepSeekPrimary = config.providerId === 'deepseek';
        const hasImage = !!options.imageBase64;

        // Requirement 1: If image is present, DeepSeek (current impl) can't handle it, use Gemini
        if (hasImage && isDeepSeekPrimary) {
            const geminiKey = await getActiveGlobalApiKey('gemini');
            if (geminiKey) {
                console.log("[LLMRouter] Image detected. Routing to Gemini.");
                const result = await this.factory.getProvider('gemini').generateText(
                    prompt,
                    'gemini-1.5-pro-latest',
                    geminiKey,
                    options
                );
                return { result, providerId: 'gemini', model: 'gemini-1.5-pro-latest', apiKey: geminiKey };
            }
        }

        // Requirement 2: Try primary provider
        try {
            const provider = this.factory.getProvider(config.providerId);
            const result = await provider.generateText(prompt, config.model, config.apiKey, options);

            // If result is empty or error-like (though provider should throw), we might want to fallback
            return { result, providerId: config.providerId, model: config.model, apiKey: config.apiKey };
        } catch (error) {
            console.error(`[LLMRouter] ${config.providerId} failed:`, error);

            // Fallback to Gemini if DeepSeek fails
            if (isDeepSeekPrimary) {
                const geminiKey = await getActiveGlobalApiKey('gemini');
                if (geminiKey) {
                    console.log("[LLMRouter] Falling back to Gemini...");
                    const result = await this.factory.getProvider('gemini').generateText(
                        prompt,
                        'gemini-1.5-pro-latest',
                        geminiKey,
                        options
                    );
                    return { result, providerId: 'gemini', model: 'gemini-1.5-pro-latest', apiKey: geminiKey };
                }
            }
            throw error;
        }
    }
}
