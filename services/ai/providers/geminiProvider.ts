import { GoogleGenAI, Modality } from "@google/genai";
import { AIProvider, TextGenerationOptions, ImageGenerationOptions } from "../types";
import { AspectRatio } from "../../../types";

export class GeminiProvider implements AIProvider {
    readonly id = 'gemini';

    private createClient(apiKey: string) {
        return new GoogleGenAI({ apiKey });
    }

    async generateText(prompt: string, model: string, apiKey: string, options?: TextGenerationOptions): Promise<string | any> {
        const ai = this.createClient(apiKey);
        const { AI_TOOLS } = await import('../tools');

        const parts: any[] = [{ text: prompt }];
        if (options?.imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: options.imageBase64
                }
            });
        }

        const executeRequest = async (targetModel: string) => {
            const response = await ai.models.generateContent({
                model: targetModel,
                contents: [{ role: 'user', parts }],
                config: {
                    systemInstruction: options?.systemPrompt || '',
                    tools: [{ functionDeclarations: AI_TOOLS as any }],
                    temperature: options?.temperature || 0.7,
                    maxOutputTokens: options?.maxTokens || 2048
                }
            });
            return response;
        };

        try {
            const response = await executeRequest(model);
            // If it's a simple text response, just return the text
            const firstPart = response.candidates?.[0]?.content?.parts?.[0];
            if (firstPart?.text && !firstPart?.functionCall) {
                return firstPart.text;
            }
            // Otherwise return the whole response object for tool handling in the service layer
            return response;
        } catch (e: any) {
            const errorMsg = JSON.stringify(e).toLowerCase();
            if ((errorMsg.includes('404') || errorMsg.includes('429') || errorMsg.includes('400')) && model !== 'gemini-1.5-pro-latest') {
                return await executeRequest('gemini-1.5-pro-latest');
            }
            throw e;
        }
    }

    async generateImage(prompt: string, model: string, apiKey: string, ratio: AspectRatio, options?: ImageGenerationOptions): Promise<string | null> {
        try {
            const ai = this.createClient(apiKey);
            const response = await ai.models.generateContent({
                model: model,
                contents: { parts: [{ text: prompt }] },
                config: {
                    imageConfig: {
                        aspectRatio: ratio,
                        imageSize: options?.size as any || '1024x1024'
                    },
                },
            });

            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
            return null;
        } catch (e) {
            console.error("[GeminiProvider] Image Error:", e);
            throw e;
        }
    }

    async generateSpeech(text: string, model: string, apiKey: string, voiceName: string): Promise<string | null> {
        try {
            const ai = this.createClient(apiKey);
            const response = await ai.models.generateContent({
                model: model,
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voiceName },
                        },
                    },
                },
            });

            return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
        } catch (e) {
            console.error("[GeminiProvider] TTS Error:", e);
            return null;
        }
    }
}
