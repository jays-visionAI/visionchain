import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio } from '../types';
import { VISION_CHAIN_KNOWLEDGE } from '../data/knowledge';
import { getActiveGlobalApiKey, getChatbotSettings } from './firebaseService';

// Get API key: priority 1: global admin key from Firebase, 2: environment variable, 3: localStorage
const getApiKey = async (): Promise<string> => {
  // 1. Check Global Admin API Key from Firebase (The source of truth)
  try {
    const globalKey = await getActiveGlobalApiKey('gemini');
    if (globalKey) {
      console.log('[Gemini] Using global admin API key from Firebase');
      return globalKey;
    }
  } catch (e) {
    console.error('[Gemini] Failed to get global API key from Firebase:', e);
  }

  // 2. Check environment variable (Safe check for browser)
  try {
    // @ts-ignore
    const envKey = (typeof process !== 'undefined' && process.env ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : null);
    if (envKey) return envKey as string;

    // Vite specific check
    // @ts-ignore
    if (import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {
    // Ignore environment variable errors in browser
  }

  // 3. Last fallback (legacy)
  try {
    const savedKeys = localStorage.getItem('visionchain_api_keys');
    if (savedKeys) {
      const keys = JSON.parse(savedKeys);
      const activeKey = keys.find((k: any) => k.isActive && k.isValid);
      if (activeKey) return activeKey.key;
    }
  } catch (e) { }

  console.warn('[Gemini] No API key found in any source');
  return '';
};

// Instance factory to ensure fresh key
export const getAiInstance = async () => {
  const apiKey = await getApiKey();
  // Ensure we pass the key as intended by the specific library version
  try {
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    console.error("[Gemini] Failed to initialize GoogleGenAI:", e);
    // Fallback if the constructor expects direct string
    return new (GoogleGenAI as any)(apiKey);
  }
};

// Helper to decode base64 audio (for the frontend to play)
export const getAudioContext = () => new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

export const generateText = async (
  prompt: string,
  imageBase64?: string,
  botType: 'intent' | 'helpdesk' = 'intent',
  overrideApiKey?: string
): Promise<string> => {
  try {
    const apiKey = overrideApiKey || await getApiKey();
    if (!apiKey) {
      console.warn('[Gemini] No API key available for generateText');
      return "API key is not configured. Please contact the administrator.";
    }

    // Refresh context if using override or ensuring fresh instance
    const ai = overrideApiKey
      ? new GoogleGenAI({ apiKey: overrideApiKey })
      : await getAiInstance();
    const settings = await getChatbotSettings();

    // Choose config based on bot type
    const botConfig = botType === 'helpdesk' ? settings?.helpdeskBot : settings?.intentBot;
    const systemInstruction = botConfig?.systemPrompt || VISION_CHAIN_KNOWLEDGE;
    const modelName = botConfig?.model || 'gemini-1.5-flash';

    let finalModel = modelName;
    if (imageBase64) {
      finalModel = 'gemini-1.5-flash'; // Optimized for vision
    }

    let contents: any = prompt;

    if (imageBase64) {
      contents = {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64
            }
          }
        ]
      };
    }

    const response = await ai.models.generateContent({
      model: finalModel,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: botConfig?.temperature || 0.7,
        maxOutputTokens: botConfig?.maxTokens || 2048,
      }
    });
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return "Error generating response. Please try again.";
  }
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string | null> => {
  try {
    const ai = await getAiInstance();
    const settings = await getChatbotSettings();
    const imageModel = settings?.imageSettings?.model || 'gemini-1.5-pro';
    const imageSize = settings?.imageSettings?.size || '1k';

    const response = await ai.models.generateContent({
      model: imageModel,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: imageSize as any
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const ai = await getAiInstance();
    const settings = await getChatbotSettings();
    const voiceModel = settings?.voiceSettings?.model || 'gemini-1.5-flash';
    const ttsVoice = settings?.voiceSettings?.ttsVoice || 'Kore';

    const response = await ai.models.generateContent({
      model: voiceModel,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: ttsVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

// --- Live API Helpers ---

export const base64ToArrayBuffer = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const arrayBufferToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const createPcmBlob = (data: Float32Array): { data: string, mimeType: string } => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: arrayBufferToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
};

export const decodeRawPcm = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};