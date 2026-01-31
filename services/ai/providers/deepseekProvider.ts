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
}
