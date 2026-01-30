import { AIProviderID, TextGenerationOptions } from "./types";
import { getActiveGlobalApiKey } from "../firebaseService";

export interface RouterResult {
    result: string | any;
    providerId: AIProviderID;
    model: string;
    apiKey: string;
}

export interface RouterConfig {
    providerId: AIProviderID;
    model: string;
    apiKey: string;
    visionModel?: string;  // Separate model for image analysis
}

export class LLMRouter {
    constructor(private factory: any) { }

    async generateText(
        prompt: string,
        config: RouterConfig,
        options: TextGenerationOptions
    ): Promise<RouterResult> {
        const isDeepSeekPrimary = config.providerId === 'deepseek';
        const hasImage = !!options.imageBase64;

        // Route 1: Image present - Use visionModel (Gemini Nano Banana variants)
        if (hasImage) {
            const visionModel = config.visionModel || 'gemini-2.0-flash-exp';
            const geminiKey = await getActiveGlobalApiKey('gemini');

            if (geminiKey) {
                console.log(`[LLMRouter] Image detected. Routing to vision model: ${visionModel}`);
                const result = await this.factory.getProvider('gemini').generateText(
                    prompt,
                    visionModel,
                    geminiKey,
                    options
                );
                return { result, providerId: 'gemini', model: visionModel, apiKey: geminiKey };
            }
        }

        // Route 2: Text only - Use primary model (DeepSeek variants)
        try {
            const provider = this.factory.getProvider(config.providerId);
            const result = await provider.generateText(prompt, config.model, config.apiKey, options);
            return { result, providerId: config.providerId, model: config.model, apiKey: config.apiKey };
        } catch (error) {
            console.error(`[LLMRouter] ${config.providerId} failed:`, error);

            // Fallback to Gemini if DeepSeek fails
            if (isDeepSeekPrimary) {
                const geminiKey = await getActiveGlobalApiKey('gemini');
                if (geminiKey) {
                    const fallbackModel = config.visionModel || 'gemini-2.0-flash-exp';
                    console.log(`[LLMRouter] Falling back to Gemini (${fallbackModel})...`);
                    const result = await this.factory.getProvider('gemini').generateText(
                        prompt,
                        fallbackModel,
                        geminiKey,
                        options
                    );
                    return { result, providerId: 'gemini', model: fallbackModel, apiKey: geminiKey };
                }
            }
            throw error;
        }
    }
}
