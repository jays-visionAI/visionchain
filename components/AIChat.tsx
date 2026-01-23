import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import type { JSX } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import { Send, X, Volume2, Bolt, Sparkles, BookOpen, Mic, MicOff, Activity, Paperclip, Trash2, Palette, Bot, User, ChevronDown } from 'lucide-solid';
import { getAudioContext, ai, createPcmBlob, base64ToArrayBuffer, decodeRawPcm } from '../services/geminiService';
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

const TypingIndicator = (): JSX.Element => (
  <Motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    class="flex gap-3"
  >
    <div class="w-8 h-8 rounded-full bg-[#1d1d1f] border border-white/10 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
      <Bot class="w-4 h-4 text-blue-400" />
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
      <Bot class="w-4 h-4 text-blue-400" />
    </div>
    <div class="space-y-2">
      <div class="bg-[#1d1d1f] border border-white/10 p-2 rounded-2xl rounded-tl-sm shadow-sm">
        <div class="w-48 h-48 bg-white/5 rounded-xl animate-pulse relative overflow-hidden flex items-center justify-center">
          <div class="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-20" />
          <Sparkles class="w-6 h-6 text-white/20 animate-pulse" />
        </div>
      </div>
      <div class="flex items-center gap-2 ml-1">
        <div class="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
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
  const [activeProvider, setActiveProvider] = createSignal<string>('gemini');
  const [modelLabel, setModelLabel] = createSignal<string>('Pro 1.5');

  createEffect(() => {
    // Check local storage for active provider
    try {
      const savedKeys = localStorage.getItem('visionchain_api_keys');
      if (savedKeys) {
        const keys = JSON.parse(savedKeys);
        const active = keys.find((k: any) => k.isActive);
        if (active) {
          setActiveProvider(active.provider);
          if (active.provider === 'deepseek') {
            setModelLabel('DeepSeek Chat');
          } else if (active.provider === 'openai') {
            setModelLabel('GPT-4o');
          }
        }
      }
    } catch (e) {
      console.error("Error reading provider settings", e);
    }
  });

  // Unified Chat Mode States
  const [isImageGenMode, setIsImageGenMode] = createSignal(false);
  const [attachment, setAttachment] = createSignal<string | null>(null);

  let scrollRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  // Live Voice Mode State
  const [isVoiceMode, setIsVoiceMode] = createSignal(false);
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

  createEffect(() => {
    if (scrollRef && (messages() || isLoading())) {
      scrollRef.scrollTo({ top: scrollRef.scrollHeight, behavior: 'smooth' });
    }
  });

  onCleanup(() => {
    stopVoiceSession();
  });

  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
        setIsImageGenMode(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
    if (fileInputRef) fileInputRef.value = '';
  };

  const handleSend = async () => {
    if ((!input().trim() && !attachment()) || isLoading()) return;

    const userMsg: Message = {
      role: 'user',
      text: input(),
      imageUrl: attachment() || undefined,
      type: attachment() ? 'image' : 'text'
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentAttachment = attachment();
    clearAttachment();

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
        if (!currentAttachment) {
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
        let rawBase64 = undefined;
        if (currentAttachment) {
          rawBase64 = currentAttachment.split(',')[1];
        }
        const text = await generateText(userMsg.text, rawBase64, useFastModel());
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
      text: `✅ Transaction Broadcasted! \nHash: ${hash.slice(0, 10)}...${hash.slice(-6)}`
    }]);
  };

  // --- Live API Logic ---
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
      setIsVoiceMode(false);
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

  const toggleVoiceMode = () => {
    if (isVoiceMode()) {
      setIsVoiceMode(false);
      stopVoiceSession();
    } else {
      setIsVoiceMode(true);
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
          class="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[650px] bg-[#161617]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden font-sans"
        >
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5 z-20">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Sparkles class="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 class="text-sm font-semibold text-white">Vision AI</h2>
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span class="text-[10px] text-gray-400">Online</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                onClick={() => { props.onClose(); stopVoiceSession(); setIsVoiceMode(false); }}
                class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Control Bar */}
          <div class="bg-[#0a0a0a]/50 px-4 py-2 flex items-center justify-between border-b border-white/5 z-20 text-[11px]">
            <div class="flex items-center gap-2 text-gray-400">
              <BookOpen class="w-3 h-3 text-blue-400" />
              <span>Knowledge Base Active</span>
            </div>
            {/* Dynamic Model Badge */}
            <div class={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-all ${activeProvider() === 'deepseek' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' :
                activeProvider() === 'openai' ? 'bg-green-600/20 text-green-400 border border-green-500/20' :
                  !useFastModel() ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20' :
                    'bg-amber-600/20 text-amber-400 border border-amber-500/20'
              }`}>
              <Show when={activeProvider() === 'deepseek'} fallback={
                <Show when={!useFastModel()} fallback={<Bolt class="w-3 h-3" />}>
                  <Sparkles class="w-3 h-3" />
                </Show>
              }>
                <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </Show>
              {modelLabel()}
            </div>
          </div>

          {/* VOICE MODE OVERLAY */}
          <Show when={isVoiceMode()}>
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              class="absolute inset-0 z-30 bg-[#050505]/95 backdrop-blur-md flex flex-col items-center justify-center top-[105px] bottom-0"
            >
              <div class="flex-1 flex flex-col items-center justify-center w-full relative">
                <Show when={voiceError()} fallback={
                  <>
                    {/* Dynamic Voice Visualizer */}
                    <div class="relative w-32 h-32 flex items-center justify-center">
                      {/* Outer Ripple */}
                      <div
                        class="absolute inset-0 bg-blue-500 rounded-full blur-2xl transition-all duration-100"
                        style={{
                          transform: `scale(${isVoiceConnected() ? 1.2 + (volumeLevel() * 1) : 1})`,
                          opacity: isVoiceConnected() ? 0.2 + (volumeLevel() * 0.3) : 0
                        }}
                      />
                      {/* Inner Ring */}
                      <div
                        class={`w-24 h-24 rounded-full flex items-center justify-center border transition-all duration-300 relative z-10 ${isVoiceConnected() ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.3)]' : 'border-white/10 bg-white/5'}`}
                        style={{ transform: `scale(${isVoiceConnected() ? 1 + (volumeLevel() * 0.4) : 1})` }}
                      >
                        <Show when={isVoiceConnected()} fallback={
                          <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        }>
                          <Activity class="w-8 h-8 text-blue-400" />
                        </Show>
                      </div>
                    </div>

                    <div class="mt-8 text-center space-y-2">
                      <h3 class="text-white font-medium text-lg tracking-tight">
                        {isVoiceConnected() ? "Vision AI Live" : "Connecting..."}
                      </h3>
                      <p class="text-gray-500 text-sm font-medium">
                        {isVoiceConnected()
                          ? (volumeLevel() > 0.05 ? "Listening..." : "Speak now")
                          : "Establishing secure link"}
                      </p>
                    </div>
                  </>
                }>
                  <div class="text-red-400 text-center px-8">
                    <p class="mb-4 bg-red-500/10 p-4 rounded-xl border border-red-500/20">{voiceError()}</p>
                    <button onClick={toggleVoiceMode} class="text-sm text-gray-400 hover:text-white transition-colors">Return to Chat</button>
                  </div>
                </Show>
              </div>
              <div class="w-full p-8 flex justify-center pb-12">
                <button
                  onClick={toggleVoiceMode}
                  class="p-4 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                >
                  <MicOff class="w-6 h-6" />
                </button>
              </div>
            </Motion.div>
          </Show>

          {/* Messages Area */}
          <div class="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth" ref={scrollRef}>
            <For each={messages()}>
              {(msg, idx) => (
                <Motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, easing: "ease-out" }}
                  class={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div class={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${msg.role === 'user' ? 'bg-blue-600' : 'bg-[#1d1d1f] border border-white/10'}`}>
                    <Show when={msg.role === 'user'} fallback={<Bot class="w-4 h-4 text-blue-400" />}>
                      <User class="w-4 h-4 text-white" />
                    </Show>
                  </div>

                  <div class="max-w-[80%] space-y-1">
                    <div class={`p-3.5 rounded-2xl text-[13.5px] leading-relaxed shadow-sm backdrop-blur-sm ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-[#1d1d1f] text-gray-200 border border-white/10 rounded-tl-sm'
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

                    {/* Message Actions (Model Only) */}
                    <Show when={msg.role === 'model' && msg.type !== 'image' && !msg.action}>
                      <div class="flex items-center gap-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => playTTS(msg.text)} class="text-gray-500 hover:text-blue-400 flex items-center gap-1 text-[10px] transition-colors">
                          <Volume2 class="w-3 h-3" /> Read Aloud
                        </button>
                      </div>
                    </Show>
                  </div>
                </Motion.div>
              )}
            </For>

            {/* Loading Indicators */}
            <Show when={isLoading()}>
              <Show when={loadingType() === 'image'} fallback={<TypingIndicator />}>
                <ImageSkeleton />
              </Show>
            </Show>
          </div>

          {/* Input Area - Sticky Bottom */}
          <div class="p-4 bg-[#0a0a0a]/80 backdrop-blur-xl border-t border-white/10">
            {/* Attachment Preview */}
            <Presence>
              <Show when={attachment()}>
                <Motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  class="mb-3 flex items-center gap-2 overflow-hidden"
                >
                  <div class="relative w-14 h-14 rounded-xl overflow-hidden border border-white/10 group shadow-lg">
                    <img src={attachment()!} alt="Preview" class="w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={clearAttachment} class="text-white p-1 hover:text-red-400 transition-colors">
                        <Trash2 class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <span class="text-xs text-blue-400 font-medium bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">Image attached</span>
                </Motion.div>
              </Show>
            </Presence>

            {/* Input Bar */}
            <div class="relative flex gap-2 items-end">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileSelect}
                class="hidden"
              />

              {/* Tools Group */}
              <div class="flex gap-1 pb-1.5">
                <button
                  onClick={() => fileInputRef?.click()}
                  disabled={isImageGenMode()}
                  class={`p-2 rounded-xl transition-all ${isImageGenMode() ? 'opacity-30 cursor-not-allowed text-gray-600' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title="Attach Image"
                >
                  <Paperclip class="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => {
                    setIsImageGenMode(!isImageGenMode());
                    if (!isImageGenMode()) clearAttachment();
                  }}
                  class={`p-2 rounded-xl transition-all ${isImageGenMode() ? 'bg-purple-500 text-white shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title="Image Generation Mode"
                >
                  <Palette class="w-4.5 h-4.5" />
                </button>
              </div>

              <div class="relative flex-1">
                <input
                  class={`w-full bg-[#1c1c1e] text-white text-sm rounded-xl py-3 pl-4 pr-10 outline-none border transition-all placeholder:text-gray-600 ${isImageGenMode() ? 'border-purple-500/50 focus:border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-white/10 focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}
                  placeholder={isImageGenMode() ? "Describe the image to generate..." : "Ask anything..."}
                  value={input()}
                  onInput={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !(e as any).isComposing && handleSend()}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading() || (!input().trim() && !attachment())}
                  class={`absolute right-1.5 top-1.5 p-1.5 rounded-lg text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isImageGenMode() ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                >
                  <Send class="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Voice Button */}
              <button
                onClick={toggleVoiceMode}
                class="p-3 bg-[#1c1c1e] hover:bg-[#2c2c2e] rounded-xl text-gray-400 hover:text-white transition-all border border-white/10 hover:border-white/20 hover:shadow-lg mb-[1px]"
                title="Voice Chat"
              >
                <Mic class="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Mode Indicator */}
            <Presence>
              <Show when={isImageGenMode()}>
                <Motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  class="mt-2 text-[10px] text-purple-400 flex items-center gap-1.5 px-1 font-medium"
                >
                  <Sparkles class="w-3 h-3" />
                  <span>Image Generation Mode Active</span>
                </Motion.div>
              </Show>
            </Presence>
          </div>

        </Motion.div>
      </Show>
    </Presence>
  );
};

export default AIChat;