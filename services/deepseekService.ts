import { VISION_CHAIN_KNOWLEDGE } from '../data/knowledge';
import { getChatbotSettings } from './firebaseService';

interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export const generateTextDeepSeek = async (
    prompt: string,
    apiKey: string,
    model: string = 'deepseek-chat',
    botType: 'intent' | 'helpdesk' = 'intent'
): Promise<string> => {
    try {
        if (!apiKey) throw new Error("API Key is missing for DeepSeek.");

        const settings = await getChatbotSettings();
        const botConfig = botType === 'helpdesk' ? settings?.helpdeskBot : settings?.intentBot;
        const systemInstruction = botConfig?.systemPrompt || VISION_CHAIN_KNOWLEDGE;

        const messages: DeepSeekMessage[] = [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
        ];

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: botConfig?.model || model,
                messages: messages,
                stream: false,
                temperature: botConfig?.temperature || 0.7,
                max_tokens: botConfig?.maxTokens || 2048
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

