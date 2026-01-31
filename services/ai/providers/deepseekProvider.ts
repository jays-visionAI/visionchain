import { AIProvider, TextGenerationOptions } from "../types";

export class DeepSeekProvider implements AIProvider {
    readonly id = 'deepseek';

    async generateText(prompt: string, model: string, apiKey: string, options?: TextGenerationOptions): Promise<string> {
        try {
            const systemContent = options?.systemPrompt || "You are a helpful assistant.";

            const messages = [
                { role: 'system', content: systemContent },
                { role: 'user', content: prompt }
            ];

            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'deepseek-chat',
                    messages: messages,
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.maxTokens || 8192,
                    stream: false
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`DeepSeek API Error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "No response content.";
        } catch (e) {
            console.error("[DeepSeekProvider] Error:", e);
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

            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'deepseek-chat',
                    messages: messages,
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.maxTokens || 8192,
                    stream: true
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`DeepSeek API Error: ${error.error?.message || response.statusText}`);
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
            console.error("[DeepSeekProvider] Stream Error:", e);
            throw e;
        }
    }
}
