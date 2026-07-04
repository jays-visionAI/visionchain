import { AIProvider, TextGenerationOptions } from "../types";

/**
 * MiniMax (International platform — api.minimax.io).
 * Uses the OpenAI-compatible chat completions endpoint, so the request/response
 * shape mirrors the DeepSeek provider. Auth is HTTP Bearer only (no GroupId
 * required for the v2 / OpenAI-compatible chat endpoint).
 *
 * Default flagship model: MiniMax-M3 (recommended). Other valid ids include
 * MiniMax-M2.5, MiniMax-M2.1, MiniMax-M2.
 */
export class MinimaxProvider implements AIProvider {
    readonly id = 'minimax';

    private static readonly ENDPOINT = 'https://api.minimax.io/v1/chat/completions';

    async generateText(prompt: string, model: string, apiKey: string, options?: TextGenerationOptions): Promise<string> {
        try {
            const systemContent = options?.systemPrompt || "You are a helpful assistant.";

            const messages = [
                { role: 'system', content: systemContent },
                { role: 'user', content: prompt }
            ];

            const response = await fetch(MinimaxProvider.ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'MiniMax-M3',
                    messages: messages,
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.maxTokens || 8192,
                    stream: false
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`MiniMax API Error: ${error.error?.message || error.base_resp?.status_msg || response.statusText}`);
            }

            const data = await response.json();
            // MiniMax native responses also carry base_resp.status_code (0 = success)
            if (data.base_resp && data.base_resp.status_code !== 0 && data.base_resp.status_code !== undefined) {
                throw new Error(`MiniMax API Error: ${data.base_resp.status_msg || 'Unknown error'}`);
            }
            return data.choices?.[0]?.message?.content || "No response content.";
        } catch (e) {
            console.error("[MinimaxProvider] Error:", e);
            throw e;
        }
    }

    async generateTextStream(
        prompt: string,
        model: string,
        apiKey: string,
        options?: TextGenerationOptions,
        onChunk?: (chunk: string) => void
    ): Promise<string> {
        try {
            const systemContent = options?.systemPrompt || "You are a helpful assistant.";

            const messages = [
                { role: 'system', content: systemContent },
                { role: 'user', content: prompt }
            ];

            const response = await fetch(MinimaxProvider.ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'MiniMax-M3',
                    messages: messages,
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.maxTokens || 8192,
                    stream: true
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`MiniMax API Error: ${error.error?.message || error.base_resp?.status_msg || response.statusText}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            if (!reader) {
                throw new Error('No response body');
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

                for (const line of lines) {
                    const data = line.replace('data:', '').trim();
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullContent += content;
                            onChunk?.(content);
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }

            return fullContent || "No response content.";
        } catch (e) {
            console.error("[MinimaxProvider] Stream Error:", e);
            throw e;
        }
    }
}
