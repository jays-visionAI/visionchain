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
            // Fallback to gemini-2.5-flash on errors
            if ((errorMsg.includes('404') || errorMsg.includes('429') || errorMsg.includes('400')) && model !== 'gemini-2.5-flash') {
                return await executeRequest('gemini-2.5-flash');
            }
            throw e;
        }
    }

    /**
     * Transcribe audio using Gemini 2.0 Flash.
     * Handles multilingual code-switching (e.g. Korean + English crypto terms).
     * This is the core improvement over Web Speech API — Gemini can handle:
     *   - "박지현에게 10 VCN 보내줘" (Korean with English token name)
     *   - "이더리움" → corrected to "Ethereum"
     *   - "비씨엔" → corrected to "VCN"
     *
     * @param audioBase64 - base64-encoded audio (WebM/WAV/OGG)
     * @param mimeType    - audio MIME type (default: 'audio/webm')
     * @param apiKey      - Gemini API key
     * @param langHint    - primary language hint: 'ko', 'en', 'ja', 'zh', etc.
     */
    async transcribeAudio(
        audioBase64: string,
        mimeType: string = 'audio/webm',
        apiKey: string,
        langHint: string = 'ko'
    ): Promise<string> {
        const ai = this.createClient(apiKey);

        const langName = langHint === 'ko' ? 'Korean'
            : langHint === 'ja' ? 'Japanese'
                : langHint === 'zh' ? 'Chinese'
                    : langHint === 'es' ? 'Spanish'
                        : langHint === 'fr' ? 'French'
                            : 'the user\'s native language';

        // Blockchain-domain-aware transcription prompt
        const transcriptionPrompt = `You are a blockchain transaction voice transcription assistant.
Transcribe the audio exactly as spoken. The user may mix ${langName} with English cryptocurrency terms.

IMPORTANT RULES:
1. Transcribe the audio verbatim — do NOT translate or summarise.
2. Preserve all cryptocurrency / blockchain proper nouns exactly as standard English:
   - Token names: VCN, ETH, BTC, USDT, SOL, BNB, XRP, MATIC, AVAX, LINK, DOT, ADA, etc.
   - Blockchain terms: Ethereum, Bitcoin, Solana, DeFi, NFT, staking, bridge, swap, wallet
   - Numbers: output as digits (e.g. '10', '100', '1,000', '10000')
3. Correct native-language pronunciations of crypto terms to their standard English form:
   Korean examples:
     '비씨엔' or '브이씨엔' → 'VCN'
     '이더리움' → 'Ethereum'
     '비트코인' → 'Bitcoin'
     '솔라나' → 'Solana'
     '테더' → 'USDT'
     '이더' → 'ETH'
     '스테이킹' → 'staking'  (keep Korean grammar around it)
     '브릿지' → 'bridge'
     '스왑' → 'swap'
   Japanese examples:
     'ビーティーシー' → 'BTC'
     'イーサリアム' → 'Ethereum'
     'ビットコイン' → 'Bitcoin'
4. Keep all non-crypto words in the original spoken language.
5. Output ONLY the transcription text. Do not add any explanation, punctuation beyond what was spoken, or formatting.

Audio:`;

        const executeTranscription = async (model: string) => {
            const response = await ai.models.generateContent({
                model,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: transcriptionPrompt },
                        {
                            inlineData: {
                                mimeType,
                                data: audioBase64
                            }
                        }
                    ]
                }],
                config: {
                    temperature: 0.1,       // Low temperature = deterministic transcription
                    maxOutputTokens: 256,
                }
            });
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return text.trim();
        };

        try {
            return await executeTranscription('gemini-2.5-flash');
        } catch (err: any) {
            console.error('[GeminiProvider] Audio transcription error (primary):', err.message);
            // Fallback to gemini-2.5-flash-lite if primary model fails
            try {
                return await executeTranscription('gemini-2.5-flash-lite');
            } catch (fallbackErr: any) {
                console.error('[GeminiProvider] Audio transcription error (fallback):', fallbackErr.message);
                throw fallbackErr;
            }
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
