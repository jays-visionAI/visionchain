import { createSignal, createEffect, onCleanup, Show, For, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import { Send, X, Volume2, Bolt, Sparkles, BookOpen, Mic, MicOff, Activity, Paperclip, Trash2, Palette, Bot, User, ChevronDown, FileText, FileSpreadsheet, Globe, Settings, GripHorizontal, Plus, Languages } from 'lucide-solid';
import { getAudioContext, getAiInstance, createPcmBlob, base64ToArrayBuffer, decodeRawPcm } from '../services/geminiService';
import { getChatbotSettings } from '../services/firebaseService';
import { generateText, generateImage, generateSpeech } from '../services/aiService';
import { Message, AspectRatio } from '../types';
import { Modality, LiveServerMessage } from "@google/genai";
import { VISION_CHAIN_KNOWLEDGE } from '../data/knowledge';
import { intentParser } from '../services/intentParserService';
import { actionResolver } from '../services/actionResolver';
import TransactionCard from './TransactionCard';
import { contractService } from '../services/contractService';

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
}

const VOICE_INSTRUCTION = `You are Vision Chain's voice assistant. 
Your goal is to have a natural, spoken conversation.
1. Listen carefully to the user's intent and wait for them to finish before responding.
2. Keep your answers concise, conversational, and to the point (1-3 sentences preferred for voice).
3. Do not use markdown formatting or code blocks in your speech unless explicitly asked to dictate code.
4. Use the following knowledge base for facts, but adapt the tone for voice (friendly, professional): ${VISION_CHAIN_KNOWLEDGE}`;

// --- Types & Constants ---
type FileType = 'image' | 'pdf' | 'excel' | 'unknown';

interface Attachment {
  file: File;
  preview: string; // Data URL
  type: FileType;
}

const LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'es-ES', label: 'Español' },
];

const TypingIndicator = (): JSX.Element => (
  <Motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    class="flex gap-3"
  >
    <div class="w-8 h-8 rounded-full bg-[#1d1d1f] border border-white/10 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
      <Bot class="w-4 h-4 text-emerald-400" />
    </div>
    <div class="bg-[#1d1d1f] px-4 py-3 rounded-2xl rounded-tl-sm border border-white/10 flex items-center gap-1.5 shadow-sm">
      <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ "animation-delay": "0s" }} />
      <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ "animation-delay": "0.2s" }} />
      <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ "animation-delay": "0.4s" }} />
    </div>
  </Motion.div>
);

const ImageSkeleton = (): JSX.Element => (
  <Motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    class="flex gap-3"
  >
    <div class="w-8 h-8 rounded-full bg-[#1d1d1f] border border-white/10 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
      <Bot class="w-4 h-4 text-emerald-400" />
    </div>
    <div class="space-y-2">
      <div class="bg-[#1d1d1f] border border-white/10 p-2 rounded-2xl rounded-tl-sm shadow-sm">
        <div class="w-48 h-48 bg-white/5 rounded-xl animate-pulse relative overflow-hidden flex items-center justify-center">
          <div class="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-20" />
          <Sparkles class="w-6 h-6 text-white/20 animate-pulse" />
        </div>
      </div>
      <div class="flex items-center gap-2 ml-1">
        <div class="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
        <span class="text-[10px] text-gray-500 font-medium animate-pulse">Generating visual...</span>
      </div>
    </div>
  </Motion.div>
);

const AIChat = (props: AIChatProps): JSX.Element => {
  const [messages, setMessages] = createSignal<Message[]>([
    { role: 'model', text: 'Hello. I am the Vision Chain AI Architect. I can help you transfer assets, bridge tokens, or optimize your portfolio.' }
  ]);
  const [input, setInput] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [loadingType, setLoadingType] = createSignal<'text' | 'image'>('text');
  const [useFastModel, setUseFastModel] = createSignal(false);
  const [aspectRatio, setAspectRatio] = createSignal<AspectRatio>(AspectRatio.Square);

  // --- Admin Configured Settings ---
  const [activeProvider, setActiveProvider] = createSignal<string>('gemini');
  const [modelLabel, setModelLabel] = createSignal<string>('Gemini 1.5 Flash');

  // --- New Features State ---
  const [dragActive, setDragActive] = createSignal(false);
  const [attachments, setAttachments] = createSignal<Attachment[]>([]);
  const [voiceLang, setVoiceLang] = createSignal('en-US');
  const [isRecording, setIsRecording] = createSignal(false); // For simple STT
  const [recognition, setRecognition] = createSignal<any>(null); // Web Speech API

  const [isImageGenMode, setIsImageGenMode] = createSignal(false);

  // --- Refs ---
  let scrollRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  // --- Live Voice Mode (Advanced) State - Keeping for backward compatibility if user wants full Live API ---
  const [isLiveMode, setIsLiveMode] = createSignal(false);
  const [isVoiceConnected, setIsVoiceConnected] = createSignal(false);
  const [voiceError, setVoiceError] = createSignal<string | null>(null);
  const [volumeLevel, setVolumeLevel] = createSignal(0);

  // Audio Refs for Live API
  let audioContexts: { input?: AudioContext, output?: AudioContext } = {};
  let session: any = null;
  let stream: MediaStream | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let nextStartTime = 0;
  let audioSources: Set<AudioBufferSourceNode> = new Set();


  // --- Initialization ---
  createEffect(async () => {
    // Check Firebase for active provider and model settings
    try {
      const settings = await getChatbotSettings();
      const botConfig = settings?.helpdeskBot;
      const modelName = botConfig?.model || 'gemini-1.5-flash';

      let provider = 'gemini';
      let label = 'Gemini 1.5 Flash';

      if (modelName.includes('deepseek')) {
        provider = 'deepseek';
        label = 'DeepSeek Chat';
      } else if (modelName.includes('gpt')) {
        provider = 'openai';
        label = 'GPT-4o';
      } else if (modelName.includes('claude')) {
        provider = 'anthropic';
        label = 'Claude 3.5 Sonnet';
      }

      setActiveProvider(provider);
      setModelLabel(label);
    } catch (e) {
      console.error("Error reading Firebase AI settings", e);
    }
  });

  // Scroll to bottom
  createEffect(() => {
    if (scrollRef && (messages() || isLoading())) {
      scrollRef.scrollTo({ top: scrollRef.scrollHeight, behavior: 'smooth' });
    }
  });

  // Cleanup
  onCleanup(() => {
    stopVoiceSession(); // Live API
    if (recognition()) {
      recognition().stop();
    }
  });

  // --- File Handling Functions ---
  const determineFileType = (file: File): FileType => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.type.includes('csv')) return 'excel';
    return 'unknown';
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const type = determineFileType(file);
      setAttachments(prev => [...prev, {
        file,
        preview: e.target?.result as string,
        type
      }]);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach(processFile);
    }
  };

  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      const files = Array.from(target.files);
      files.forEach(processFile);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    if (attachments().length === 0 && fileInputRef) {
      fileInputRef.value = '';
    }
  };


  // --- STT (Simple Voice Input) ---
  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }

    if (isRecording()) {
      recognition()?.stop();
      setIsRecording(false);
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = voiceLang();
    recognitionInstance.interimResults = true;
    recognitionInstance.maxAlternatives = 1;

    recognitionInstance.onstart = () => setIsRecording(true);

    recognitionInstance.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');

      // For interim results, we might want to just update the input temporarily or append
      // But for simplicity, let's just set input
      setInput(prev => {
        // If we want to append: return prev + ' ' + transcript;
        // But interim fires multiple times, so better to handle final
        return transcript;
      });
      // If we want to support long dictation, logic gets more complex.
      // Simple implementation replaces input for now or handles 'isFinal'.
      if (event.results[0].isFinal) {
        setInput(transcript);
      }
    };

    recognitionInstance.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognitionInstance.onend = () => {
      setIsRecording(false);
    };

    recognitionInstance.start();
    setRecognition(recognitionInstance);
  };


  // --- Chat Logic ---
  const handleSend = async () => {
    if ((!input().trim() && attachments().length === 0) || isLoading()) return;

    // Convert attachments to format message expects (taking first image if any for legacy compatibility)
    // Multimodal support in generating text needs updates if we send multiple images.
    // For now, let's grab the first image attachment if exists.
    const imageAttachment = attachments().find(a => a.type === 'image');

    const userMsg: Message = {
      role: 'user',
      text: input(),
      imageUrl: imageAttachment?.preview || undefined,
      type: imageAttachment ? 'image' : 'text'
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    // Clear attachments after send
    const currentAttachments = [...attachments()];
    setAttachments([]);
    if (fileInputRef) fileInputRef.value = '';

    setLoadingType(isImageGenMode() ? 'image' : 'text');
    setIsLoading(true);

    try {
      if (isImageGenMode()) {
        const imageUrl = await generateImage(userMsg.text, aspectRatio());
        if (imageUrl) {
          setMessages(prev => [...prev, { role: 'model', text: 'Visual generated successfully.', type: 'image', imageUrl }]);
        } else {
          setMessages(prev => [...prev, { role: 'model', text: 'Failed to generate visual. Please try again with a different prompt.' }]);
        }
      } else {
        // --- VISION CHAIN INTENT PARSER LOGIC ---
        // 1. Try to parse intent first (unless there is an image attachment, which usually implies question about image)
        if (!imageAttachment) {
          const intent = await intentParser.parseIntent(userMsg.text);

          // If we are confident (~80%+), we check if it requires a transaction
          if (intent.confidence > 0.6 && intent.action !== 'UNKNOWN') {
            try {
              // Resolve the action into concrete TX data
              // Use mock address for now or try to get real one
              const userAddress = localStorage.getItem('vcn_wallet_address') || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
              const action = await actionResolver.resolve(intent, userAddress);

              setMessages(prev => [...prev, {
                role: 'model',
                text: intent.explanation || action.summary,
                action: action // Pass the proposed action to UI
              }]);
              setIsLoading(false);
              return; // EXIT EARLY to skip Gemini for this turn
            } catch (err) {
              console.error("Action Resolution Failed:", err);
              // Fallthrough to Gemini if resolution fails
            }
          }
        }

        // 2. Fallback to General AI (Gemini)
        // Note: Currently generateText only supports one image. 
        // We might need to extend this service for PDFs if Gemini supports it via API, but for now assuming image only for vision.
        let rawBase64 = undefined;
        if (imageAttachment) {
          rawBase64 = imageAttachment.preview.split(',')[1];
        }

        // Strict Admin Control: Use the settings fetched in createEffect
        const text = await generateText(userMsg.text, rawBase64, useFastModel(), 'helpdesk');
        setMessages(prev => [...prev, { role: 'model', text }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'An error occurred during processing.' }]);
    }

    setIsLoading(false);
  };

  const playTTS = async (text: string) => {
    const audioData = await generateSpeech(text);
    if (audioData) {
      try {
        const ctx = getAudioContext();
        const binaryString = atob(audioData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        const srcNode = ctx.createBufferSource();
        srcNode.buffer = audioBuffer;
        srcNode.connect(ctx.destination);
        srcNode.start();
      } catch (err) { console.error("Audio playback failed", err); }
    }
  };

  const handleTxComplete = (hash: string) => {
    setMessages(prev => [...prev, {
      role: 'model',
      text: `Transaction Broadcasted Successfully!\nHash: ${hash.slice(0, 10)}...${hash.slice(-6)}`
    }]);
  };

  // --- Live API Logic (Legacy/Advanced Voice) ---
  const startVoiceSession = async () => {
    setVoiceError(null);
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputContext = new AudioContextClass({ sampleRate: 16000 });
      const outputContext = new AudioContextClass({ sampleRate: 24000 });

      if (inputContext.state === 'suspended') await inputContext.resume();
      if (outputContext.state === 'suspended') await outputContext.resume();

      audioContexts = { input: inputContext, output: outputContext };

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const ai = await getAiInstance();
      const sessionPromise = ai.live.connect({
        model: 'gemini-1.5-flash',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: VOICE_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            setIsVoiceConnected(true);
            source = inputContext.createMediaStreamSource(stream!);
            processor = inputContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolumeLevel(Math.min(rms * 5, 1));

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((s) => {
                s.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputContext) {
              const audioData = base64ToArrayBuffer(base64Audio);
              nextStartTime = Math.max(nextStartTime, outputContext.currentTime);
              const audioBuffer = await decodeRawPcm(audioData, outputContext);
              const srcNode = outputContext.createBufferSource();
              srcNode.buffer = audioBuffer;
              srcNode.connect(outputContext.destination);
              srcNode.start(nextStartTime);
              nextStartTime += audioBuffer.duration;
              audioSources.add(srcNode);
              srcNode.onended = () => { audioSources.delete(srcNode); };
            }
            if (message.serverContent?.interrupted) {
              audioSources.forEach(src => src.stop());
              audioSources.clear();
              nextStartTime = 0;
            }
          },
          onclose: () => {
            setIsVoiceConnected(false);
            stopVoiceSession();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setVoiceError("Connection Error. Please check permissions.");
            stopVoiceSession();
          }
        }
      });
      session = sessionPromise;

    } catch (err) {
      console.error("Failed to start voice session", err);
      setVoiceError("Failed to access microphone or connect.");
      setIsLiveMode(false);
    }
  };

  const stopVoiceSession = () => {
    if (processor) { processor.disconnect(); processor.onaudioprocess = null; processor = null; }
    if (source) { source.disconnect(); source = null; }
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    if (audioContexts.input) audioContexts.input.close();
    if (audioContexts.output) audioContexts.output.close();
    audioContexts = {};
    if (session) { session.then((s: any) => s.close()); session = null; }
    setIsVoiceConnected(false);
    setVolumeLevel(0);
    nextStartTime = 0;
    audioSources.clear();
  };

  const toggleLiveMode = () => {
    if (isLiveMode()) {
      setIsLiveMode(false);
      stopVoiceSession();
    } else {
      setIsLiveMode(true);
      startVoiceSession();
    }
  };


  return (
    <Presence>
      <Show when={props.isOpen}>
        <Motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }}
          class="fixed bottom-0 left-1/2 -translate-x-1/2 w-[95%] max-w-[1000px] h-[85vh] md:h-[80vh] bg-[#161618] border border-white/[0.08] rounded-t-[32px] md:rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] flex flex-col z-[100] overflow-hidden font-sans backdrop-blur-xl"
          style={{ "margin-bottom": "max(env(safe-area-inset-bottom), 16px)" }}
          onDragEnter={handleDrag}
        >
          {/* Drag Overlay */}
          <Presence>
            <Show when={dragActive()}>
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                class="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center pointer-events-none"
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div class="bg-blue-500 rounded-full p-4 mb-3 shadow-lg">
                  <GripHorizontal class="w-8 h-8 text-white" />
                </div>
                <p class="text-white font-bold text-lg">Drop files here</p>
                <p class="text-blue-200 text-sm">Images, PDFs, Spreadsheets</p>
              </Motion.div>
            </Show>
          </Presence>

          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 bg-[#242424] border-b border-white/5 z-20">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Bot class="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 class="text-sm font-semibold text-white">Vision AI</h2>
                <div class="flex items-center gap-1.5">
                  <span class={`w-1.5 h-1.5 rounded-full ${activeProvider() === 'gemini' ? 'bg-sky-500' : activeProvider() === 'deepseek' ? 'bg-blue-500' : 'bg-green-500'} animate-pulse`} />
                  <span class="text-[10px] text-gray-400">{modelLabel()}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button onClick={toggleLiveMode} class={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isLiveMode() ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`} title="Live Voice Mode">
                <Activity class="w-4 h-4" />
              </button>
              <button
                onClick={() => { props.onClose(); stopVoiceSession(); setIsLiveMode(false); }}
                class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Mode Overlay */}
          <Show when={isLiveMode()}>
            {/* ... reuse existing live mode display or simplified ... */}
            <div class="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-center text-center p-6">
              <Activity class="w-16 h-16 text-blue-500 mb-4 animate-pulse" />
              <h3 class="text-white text-xl font-bold mb-2">Live Voice Connected</h3>
              <p class="text-gray-400 text-sm mb-6">Speaking with {modelLabel()}</p>
              <div class="w-full max-w-xs h-1 rounded-full bg-gray-800 overflow-hidden">
                <div class="h-full bg-blue-500 transition-all duration-75" style={{ width: `${volumeLevel() * 100}%` }}></div>
              </div>
              <button onClick={toggleLiveMode} class="mt-8 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-medium">End Session</button>
            </div>
          </Show>


          {/* Messages Area (ChatGPT Style Bubble) */}
          <div class="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth bg-[#1a1a1a]" ref={scrollRef}>
            <For each={messages()}>
              {(msg, idx) => (
                <div class={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {/* Avatar for Model */}
                  <Show when={msg.role === 'model'}>
                    <div class="w-8 h-8 rounded-full bg-[#242424] border border-white/5 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot class="w-4 h-4 text-emerald-400" />
                    </div>
                  </Show>

                  <div class={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {/* Name */}
                    <span class="text-[10px] text-gray-500 mb-1 px-1">
                      {msg.role === 'user' ? 'You' : 'Vision Guide'}
                    </span>

                    {/* Bubble */}
                    <div class={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm backdrop-blur-sm ${msg.role === 'user'
                      ? 'bg-[#3b82f6] text-white rounded-tr-sm'
                      : 'bg-[#242424] text-gray-200 border border-white/5 rounded-tl-sm'
                      }`}>
                      <Show when={msg.imageUrl}>
                        <div class="mb-3 rounded-xl overflow-hidden border border-white/10 shadow-md">
                          <img src={msg.imageUrl} alt="Attached" class="w-full h-auto object-cover" />
                        </div>
                      </Show>
                      <div class="whitespace-pre-wrap">{msg.text}</div>

                      {/* RENDER TRANSACTION CARD IF ACTION EXISTS */}
                      <Show when={msg.action}>
                        <div class="mt-4">
                          <TransactionCard
                            action={msg.action}
                            onComplete={handleTxComplete}
                            onCancel={() => { }}
                          />
                        </div>
                      </Show>
                    </div>

                    {/* Actions */}
                    <Show when={msg.role === 'model' && !msg.action}>
                      <div class="flex items-center gap-2 mt-1 px-1">
                        <button onClick={() => playTTS(msg.text)} class="text-gray-500 hover:text-white transition-colors">
                          <Volume2 class="w-3 h-3" />
                        </button>
                      </div>
                    </Show>
                  </div>

                  {/* Avatar for User */}
                  <Show when={msg.role === 'user'}>
                    <div class="w-8 h-8 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0 mt-1">
                      <User class="w-4 h-4 text-white" />
                    </div>
                  </Show>
                </div>
              )}
            </For>

            {/* Loading Indicators */}
            <Show when={isLoading()}>
              <Show when={loadingType() === 'image'} fallback={<TypingIndicator />}>
                <ImageSkeleton />
              </Show>
            </Show>
          </div>

          {/* Footer Area (Modernized Input) */}
          <div class="p-4 md:p-6 bg-[#161618] border-t border-white/[0.04] relative z-30">

            {/* Attachments Preview Row */}
            <Presence>
              <Show when={attachments().length > 0}>
                <Motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  class="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
                >
                  <For each={attachments()}>
                    {(att, i) => (
                      <div class="relative w-20 h-20 rounded-2xl border border-white/10 bg-[#1d1d1f] flex-shrink-0 group overflow-hidden shadow-lg">
                        <Show when={att.type === 'image'} fallback={
                          <div class="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-500">
                            <Show when={att.type === 'pdf'} fallback={<FileSpreadsheet class="w-7 h-7 text-green-500" />}>
                              <FileText class="w-7 h-7 text-red-500" />
                            </Show>
                            <span class="text-[9px] font-bold uppercase tracking-wider">{att.type}</span>
                          </div>
                        }>
                          <img src={att.preview} class="w-full h-full object-cover" />
                        </Show>
                        <button
                          onClick={() => removeAttachment(i())}
                          class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          <Trash2 class="w-5 h-5 text-red-400" />
                        </button>
                      </div>
                    )}
                  </For>
                </Motion.div>
              </Show>
            </Presence>

            <div class="relative flex items-center gap-3 bg-[#1d1d1f] rounded-[24px] border border-white/[0.08] p-2 focus-within:border-blue-500/50 transition-all shadow-2xl group">
              {/* Plus Button */}
              <button
                onClick={() => fileInputRef?.click()}
                class="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
              >
                <Plus class="w-6 h-6" />
              </button>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                class="hidden"
                accept="image/*,application/pdf,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileSelect}
              />

              {/* Input TextField */}
              <textarea
                rows={1}
                class="flex-1 bg-transparent text-white text-[15px] py-3 outline-none resize-none placeholder:text-gray-500 max-h-32 font-medium"
                placeholder={isRecording() ? "Listening to your voice..." : "Ask Vision AI anything..."}
                value={input()}
                onInput={(e) => {
                  setInput(e.currentTarget.value);
                  e.currentTarget.style.height = 'auto';
                  e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              />

              {/* Right Tools */}
              <div class="flex items-center gap-1 px-1">
                {/* Language Dropdown */}
                <div class="relative group/lang">
                  <button class="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[#888] hover:text-white transition-all text-sm font-bold">
                    <span class="uppercase">{voiceLang().split('-')[0]} ({LANGUAGES.find(l => l.code === voiceLang())?.label.split(' ')[0]})</span>
                    <ChevronDown class="w-3.5 h-3.5" />
                  </button>
                  <div class="absolute bottom-full right-0 mb-3 w-40 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden hidden group-hover/lang:block z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <For each={LANGUAGES}>
                      {(lang) => (
                        <button
                          class={`w-full text-left px-4 py-3 text-[13px] font-medium hover:bg-white/5 transition-colors ${voiceLang() === lang.code ? 'text-blue-400' : 'text-gray-400'}`}
                          onClick={() => setVoiceLang(lang.code)}
                        >
                          {lang.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Mic Button */}
                <button
                  onClick={toggleRecording}
                  class={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isRecording() ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Mic class="w-5 h-5" />
                </button>

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={(!input().trim() && attachments().length === 0) || isLoading()}
                  class={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${(!input().trim() && attachments().length === 0)
                    ? 'bg-blue-600/20 text-blue-400/30 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 active:scale-90 font-black'}`}
                >
                  <Send class="w-5 h-5" />
                </button>
              </div>
            </div>

            <div class="flex items-center justify-center gap-4 mt-4">
              <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Vision Architect System</span>
              <div class="w-1 h-1 rounded-full bg-gray-700" />
              <button
                onClick={() => setIsImageGenMode(!isImageGenMode())}
                class={`text-[10px] font-black uppercase tracking-widest transition-colors ${isImageGenMode() ? 'text-purple-400' : 'text-gray-600 hover:text-gray-400'}`}
              >
                {isImageGenMode() ? 'Image Mode Active' : 'Standard Mode'}
              </button>
            </div>
          </div>

        </Motion.div>
      </Show>
    </Presence>
  );
};

export default AIChat;