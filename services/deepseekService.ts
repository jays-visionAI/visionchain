import { VISION_CHAIN_KNOWLEDGE } from '../data/knowledge';

interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export const generateTextDeepSeek = async (prompt: string, apiKey: string, model: string = 'deepseek-chat'): Promise<string> => {
    try {
        if (!apiKey) throw new Error("API Key is missing for DeepSeek.");

        const messages: DeepSeekMessage[] = [
            { role: 'system', content: VISION_CHAIN_KNOWLEDGE },
            { role: 'user', content: prompt }
        ];

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: false,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`DeepSeek API Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "No response content.";
    } catch (error) {
        console.error("DeepSeek Service Error:", error);
        throw error;
    }
};
