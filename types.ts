export interface Message {
  role: 'user' | 'model';
  text: string;
  type?: 'text' | 'image';
  imageUrl?: string;
  audioData?: string; // Base64 audio data
}

export enum AspectRatio {
  Square = "1:1",
  Portrait34 = "3:4",
  Portrait916 = "9:16",
  Landscape43 = "4:3",
  Landscape169 = "16:9",
  Wide219 = "21:9",
  Standard23 = "2:3",
  Standard32 = "3:2"
}

export enum AIModel {
  Reasoning = 'gemini-3-pro-preview',
  Fast = 'gemini-2.5-flash-lite',
  Image = 'gemini-3-pro-image-preview',
  TTS = 'gemini-2.5-flash-preview-tts'
}
