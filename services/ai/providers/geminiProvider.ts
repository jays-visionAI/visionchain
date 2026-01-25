import { GoogleGenAI, Modality } from "@google/genai";
import { AIProvider, TextGenerationOptions, ImageGenerationOptions } from "../types";
import { AspectRatio } from "../../../types";

export class GeminiProvider implements AIProvider {
    readonly id = 'gemini';

    private createClient(apiKey: string) {
        return new GoogleGenAI({ apiKey });
    }

    async generateText(prompt: string, model: string, apiKey: string, options?: TextGenerationOptions): Promise<string> {
        const ai = this.createClient(apiKey);
        let contents: any = prompt;

        if (options?.imageBase64) {
            contents = {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: options.imageBase64
                        }
                    }
                ]
            };
        }

        const executeRequest = async (targetModel: string) => {
            const runner = await ai.models.generateContent({
                model: targetModel,
                contents: contents,
                config: {
                    systemInstruction: options?.systemPrompt || '',
                    temperature: options?.temperature || 0.7,
                    maxOutputTokens: options?.maxTokens || 2048
                }
            });
            return runner.text || "No response generated.";
        };

        try {
            return await executeRequest(model);
        } catch (e: any) {
            const errorMsg = e.message || '';
            // Robust Fallback for 404 (Not Found) or 429 (Resource Exhausted)
            const isFailing = errorMsg.includes('404') || errorMsg.includes('NOT_FOUND') ||
                errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');

            if (isFailing && model !== 'gemini-1.5-pro') {
                console.warn(`[GeminiProvider] ${model} failed. Falling back to gemini-1.5-pro.`);
                return await executeRequest('gemini-1.5-pro');
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
