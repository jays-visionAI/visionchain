import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio } from '../types';
import { VISION_CHAIN_KNOWLEDGE } from '../data/knowledge';

// Get API key from localStorage (active key) or fall back to environment variable
const getApiKey = (): string => {
  try {
    const savedKeys = localStorage.getItem('visionchain_api_keys');
    if (savedKeys) {
      const keys = JSON.parse(savedKeys);
      const activeKey = keys.find((k: any) => k.isActive && k.isValid);
      if (activeKey) {
        return activeKey.key;
      }
    }
  } catch (e) {
    console.error('Failed to get API key from localStorage:', e);
  }
  return process.env.API_KEY || '';
};

// Create AI instance with dynamic API key
const createAiInstance = () => new GoogleGenAI({ apiKey: getApiKey() });

// Export ai instance getter for components
export const getAi = () => createAiInstance();
export const ai = createAiInstance();

// Helper to decode base64 audio (for the frontend to play)
export const getAudioContext = () => new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

export const generateText = async (prompt: string, imageBase64?: string, useFastModel: boolean = false): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return "⚠️ API key is not configured. Please go to Admin > AI Management > API Keys to add your Gemini API key.";
    }

    let modelName = useFastModel ? 'gemini-2.5-flash-lite' : 'gemini-3-pro-preview';

    // Switch to Flash for multimodal vision tasks as it has excellent vision capabilities
    if (imageBase64) {
      modelName = 'gemini-2.5-flash';
    }

    let contents: any = prompt;

    if (imageBase64) {
      contents = {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg", // Assuming JPEG/PNG conversion on frontend
              data: imageBase64
            }
          }
        ]
      };
    }

    const response = await getAi().models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: VISION_CHAIN_KNOWLEDGE,
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
    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K"
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
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
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