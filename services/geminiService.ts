
import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio } from '../types';

// --- Pure Execution Layer for Gemini ---
// This service NO LONGER handles keys or settings. It only executes what it is told.

const createClient = (apiKey: string) => {
  try {
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    // Fallback for older SDK versions or strict environments
    return new (GoogleGenAI as any)(apiKey);
  }
};

export const generateTextGemini = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  prompt: string,
  imageBase64?: string
): Promise<string> => {
  try {
    const ai = createClient(apiKey);
    let contents: any = prompt;

    // TODO: Handle Image Model switch if needed, but caller should pass correct model
    // Current assumption: caller passes a vision-capable model if imageBase64 is present

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

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        }
      });
      return response.text || "No response generated.";

    } catch (e: any) {
      // Fallback Logic for Quota Exceeded (429) OR Model Not Found (404)
      if (e.message && (e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('404') || e.message.includes('NOT_FOUND')) && model !== 'gemini-1.5-flash-latest') {
        console.warn(`[Gemini] ${model} failed (404/429). Falling back to gemini-1.5-flash-latest.`);
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-1.5-flash-latest',
          contents: contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
          }
        });
        return fallbackResponse.text || "No response generated (Fallback).";
      }
      throw e;
    }

  } catch (error) {
    console.error("Gemini Execution Error:", error);
    throw error; // Re-throw to be handled by the caller (aiService)
  }
};

export const generateImageGemini = async (
  apiKey: string,
  model: string,
  widthHeightRatio: AspectRatio,
  size: string,
  prompt: string
): Promise<string | null> => {
  try {
    const ai = createClient(apiKey);

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: widthHeightRatio,
          imageSize: size as any
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

export const generateSpeechGemini = async (
  apiKey: string,
  model: string,
  voiceName: string,
  text: string
): Promise<string | null> => {
  try {
    const ai = createClient(apiKey);

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

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

// Start helpers for Live API (Client-side use mostly)
export const getAudioContext = () => new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
export const getAiInstance = async (apiKey: string) => createClient(apiKey); // Now requires explicit key

// --- Live API Helpers (Keeping existing logic but removing dependencies on global keys) ---

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