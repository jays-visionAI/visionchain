import { createSignal, createEffect, onCleanup, Show, For, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import { Send, X, Volume2, Bolt, Sparkles, BookOpen, Mic, MicOff, Activity, Paperclip, Trash2, Palette, Bot, User, ChevronDown, FileText, FileSpreadsheet, Globe, Settings, GripHorizontal, Plus, Languages, Search, Lightbulb } from 'lucide-solid';
import { getAudioContext, getAiInstance, createPcmBlob, base64ToArrayBuffer, decodeRawPcm } from '../services/ai/utils';
import { getChatbotSettings, getProviderFromModel, getUserConversations, getConversationById, saveConversation, AiConversation, subscribeToQueue } from '../services/firebaseService';
import { generateText, generateImage, generateSpeech } from '../services/ai';
import { Message, AspectRatio } from '../types';
import { Modality, LiveServerMessage } from "@google/genai";
import { VISION_CHAIN_KNOWLEDGE } from '../data/knowledge';
import { intentParser } from '../services/intentParserService';
import { actionResolver } from '../services/actionResolver';
import TransactionCard from './TransactionCard';
import { contractService } from '../services/contractService';
import { useAuth } from './auth/authContext';
import { AgentTask } from './chat/queue/AgentChip';
import ChatQueueLine from './chat/queue/ChatQueueLine';
import QueueDrawer from './chat/queue/QueueDrawer';

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
    <div class="w-8 h-8 rounded-full bg-[#111113] border border-white/5 flex items-center justify-center flex-shrink-0 mt-1 shadow-2xl">
      <Bot class="w-4 h-4 text-emerald-400" />
    </div>
    <div class="bg-[#111113] px-4 py-3 rounded-2xl rounded-tl-sm border border-white/5 flex items-center gap-1.5 shadow-2xl">
      <span class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ "animation-delay": "0s" }} />
      <span class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ "animation-delay": "0.1s" }} />
      <span class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ "animation-delay": "0.2s" }} />
    </div>
  </Motion.div>
);

const ImageSkeleton = (): JSX.Element => (
  <Motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    class="flex gap-3"
  >
    <div class="w-8 h-8 rounded-full bg-[#111113] border border-white/5 flex items-center justify-center flex-shrink-0 mt-1 shadow-2xl">
      <Bot class="w-4 h-4 text-emerald-400" />
    </div>
    <div class="space-y-2">
      <div class="bg-[#111113] border border-white/5 p-2 rounded-2xl rounded-tl-sm shadow-2xl">
        <div class="w-48 h-48 bg-white/5 rounded-xl animate-pulse relative overflow-hidden flex items-center justify-center">
          <div class="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-20" />
          <Sparkles class="w-6 h-6 text-white/20 animate-pulse" />
        </div>
      </div>
      <div class="flex items-center gap-2 ml-1">
        <div class="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        <span class="text-[10px] text-gray-500 font-medium animate-pulse">Generating visual...</span>
      </div>
    </div>
  </Motion.div>
);

const ThinkingDisplay = (props: { steps: { id: string, label: string, status: 'pending' | 'loading' | 'completed' | 'success' }[] }): JSX.Element => (
  <Motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    class="flex gap-3 mb-6 px-4"
  >
    <div class="w-8 h-8 rounded-full bg-[#0d0d0f] border border-white/5 flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_20px_rgba(0,0,0,0.4)]">
      <div class="w-4 h-4 text-purple-400 animate-pulse shadow-purple-500/50">
        <Bot class="w-full h-full" />
      </div>
    </div>
    <div class="flex-1 max-w-[400px] bg-[#0d0d0f]/90 backdrop-blur-3xl border border-white/10 rounded-2xl p-5 space-y-4 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6),0_0_15px_rgba(168,85,247,0.1)]">
      <div class="flex items-center justify-between pb-3 border-b border-white/5">
        <div class="flex items-center gap-2">
          <span class="text-[13px] font-bold text-gray-100">생각 중...</span>
          <div class="flex gap-1">
            <span class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce shadow-[0_0_8px_rgba(168,85,247,0.8)]" style={{ "animation-delay": "0s" }} />
            <span class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce shadow-[0_0_8px_rgba(168,85,247,0.8)]" style={{ "animation-delay": "0.1s" }} />
            <span class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce shadow-[0_0_8px_rgba(168,85,247,0.8)]" style={{ "animation-delay": "0.2s" }} />
          </div>
        </div>
        <div class="w-4 h-4 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin shadow-[0_0_10px_rgba(168,85,247,0.4)]" />
      </div>

      <div class="space-y-3 pt-1">
        <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.1em] mb-2">생각 과정 (THINKING PROCESS)</div>
        <For each={props.steps}>
          {(step) => (
            <div class={`flex items-center gap-3 transition-all duration-500 ${step.status === 'pending' ? 'opacity-20 grayscale' : 'opacity-100'}`}>
              <div class="relative flex items-center justify-center">
                <Show when={step.status === 'loading'} fallback={
                  <div class={`w-2 h-2 rounded-full ${step.status === 'completed' || step.status === 'success' ? 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]' : 'bg-gray-800'}`} />
                }>
                  <div class="w-2 h-2 bg-blue-400 rounded-full animate-ping" />
                </Show>
              </div>
              <span class={`text-[12px] font-medium flex items-center gap-2 ${(step.status === 'completed' || step.status === 'success') ? 'text-gray-100' : 'text-gray-400'}`}>
                {step.id === 'intent' && <Search class="w-3.5 h-3.5 text-gray-400" />}
                {step.id === 'scan' && <FileSpreadsheet class="w-3.5 h-3.5 text-gray-400" />}
                {step.id === 'insight' && <Lightbulb class="w-3.5 h-3.5 text-gray-400" />}
                {step.id === 'success' && <div class="text-purple-400 font-bold flex items-center gap-1.5"><Sparkles class="w-4 h-4" /> {step.label}</div>}
                {step.id !== 'success' && step.label}
              </span>
            </div>
          )}
        </For>
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

  // --- History & Session State ---
  const { user } = useAuth();
  const [history, setHistory] = createSignal<AiConversation[]>([]);
  const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = createSignal(true);

  // -- Real-time Queue Data --
  const [queueTasks, setQueueTasks] = createSignal<AgentTask[]>([]);

  // Real-time Subscription
  createEffect(() => {
    if (!user()) {
      setQueueTasks([]);
      return;
    }

    const unsubscribe = subscribeToQueue(user()!.email, (tasks) => {
      setQueueTasks(tasks);
    });

    onCleanup(() => unsubscribe());
  });

  // --- Admin Configured Settings ---
  const [activeProvider, setActiveProvider] = createSignal<string>('');
  const [modelLabel, setModelLabel] = createSignal<string>('');

  // --- New Features State ---
  const [dragActive, setDragActive] = createSignal(false);
  const [attachments, setAttachments] = createSignal<Attachment[]>([]);
  const [voiceLang, setVoiceLang] = createSignal('en-US');
  const [isRecording, setIsRecording] = createSignal(false); // For simple STT
  const [recognition, setRecognition] = createSignal<any>(null); // Web Speech API

  const [isImageGenMode, setIsImageGenMode] = createSignal(false);
  const [isComposing, setIsComposing] = createSignal(false);

  // -- Queue Drawer State --
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = createSignal(false);
  const [selectedTaskId, setSelectedTaskId] = createSignal<string | null>(null);
  const [isQueueCompact, setIsQueueCompact] = createSignal(false); // Compact Mode State

  // -- Scroll Listener for Compact Mode --
  createEffect(() => {
    const el = scrollRef;
    if (!el) return;

    const handleScroll = () => {
      setIsQueueCompact(el.scrollTop > 20); // Switch to compact early
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    onCleanup(() => el.removeEventListener('scroll', handleScroll));
  });

  // --- Thinking Steps (Progress) ---
  const [thinkingSteps, setThinkingSteps] = createSignal<{ id: string, label: string, status: 'pending' | 'loading' | 'completed' | 'success' }[]>([]);

  // --- History & Session State ---
  // --- History & Session State (Duplicate declarations removed here) ---
  // The state variables 'user', 'history', 'currentSessionId', 'isHistoryOpen' 
  // are already declared above around line 150.
  // We keep the Refs here.

  // --- Refs ---
  let scrollRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;

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
      const modelName = botConfig?.model || '';

      let provider = '';
      let label = '';

      if (modelName) {
        provider = getProviderFromModel(modelName);

        switch (provider) {
          case 'deepseek': label = 'DeepSeek Chat'; break;
          case 'openai': label = 'GPT-4o'; break;
          case 'anthropic': label = 'Claude 3.5 Sonnet'; break;
          case 'gemini': label = 'Gemini 1.5 Flash'; break;
          default: label = modelName;
        }
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

  // Load History on Mount or User Change
  createEffect(async () => {
    if (user()) {
      const hist = await getUserConversations(user()!.email);
      setHistory(hist);
    }
  });

  const loadHistory = async () => {
    if (!user()) return;
    const hist = await getUserConversations(user()!.email);
    setHistory(hist);
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([
      { role: 'model', text: 'Hello. I am the Vision Chain AI Architect. I can help you transfer assets, bridge tokens, or optimize your portfolio.' }
    ]);
    if (window.innerWidth < 768) setIsHistoryOpen(false);
  };

  const selectConversation = async (conv: AiConversation) => {
    setCurrentSessionId(conv.id);
    const formatted = conv.messages.map(m => ({
      role: m.role,
      text: m.text
    } as Message));
    setMessages(formatted);
    if (window.innerWidth < 768) setIsHistoryOpen(false);
  };

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
    setAttachments([]);
    if (fileInputRef) fileInputRef.value = '';
    if (textareaRef) {
      textareaRef.value = '';
      textareaRef.style.height = 'auto';
    }

    setLoadingType(isImageGenMode() ? 'image' : 'text');
    setThinkingSteps([
      { id: 'analyze', label: '요청을 분석하고 있습니다...', status: 'loading' },
      { id: 'intent', label: '의도 및 검색 키워드 분석...', status: 'pending' },
      { id: 'scan', label: '관련 데이터 및 온체인 기록 스캔...', status: 'pending' },
      { id: 'insight', label: '최적의 인사이트 도출 및 요약...', status: 'pending' }
    ]);

    try {
      if (isImageGenMode()) {
        const url = await generateImage(userMsg.text, aspectRatio());
        if (url) {
          const assistantMsg: Message = { role: 'model', text: 'I have generated your visual request.', imageUrl: url, type: 'image' };
          const updatedMsgs = [...messages(), assistantMsg];
          setMessages(updatedMsgs);
          // ... rest of logging ...
        }
        setThinkingSteps([]);
      } else {
        // AI Logic
        setThinkingSteps(prev => prev.map(s => s.id === 'analyze' ? { ...s, status: 'completed' as const } : s.id === 'intent' ? { ...s, status: 'loading' as const } : s));
        await new Promise(r => setTimeout(r, 600)); // Visual feel

        const intent = await intentParser.parseIntent(userMsg.text);
        setThinkingSteps(prev => prev.map(s => s.id === 'intent' ? { ...s, status: 'completed' as const } : s.id === 'scan' ? { ...s, status: 'loading' as const } : s));
        await new Promise(r => setTimeout(r, 800));

        if (intent && user()) {
          const userAddress = (user() as any).walletAddress || '0x6872E5cda7a24Fa38d8B61Efe961fdF5E801d31d'; // Demo fallback
          try {
            // If we are confident (~80%+), we check if it requires a transaction
            if (intent.confidence > 0.6 && intent.action !== 'UNKNOWN') {
              try {
                // Resolve the action into concrete TX data
                // Use mock address for now or try to get real one
                // const userAddress = localStorage.getItem('vcn_wallet_address') || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

                let finalAction = null;
                let explanationText = intent.explanation;

                // NEW: Optimization Step (Step 3)
                // If it's a transfer/payment, run it through the Optimizer first
                if (intent.action === 'TRANSFER' || intent.action === 'SWAP_AND_SEND') {
                  try {
                    const { transactionOptimizer } = await import('../services/transactionOptimizer');
                    const plan = await transactionOptimizer.optimizeTransaction(
                      userAddress,
                      intent.params.to || 'unknown_recipient',
                      intent.params.amount || '0',
                      intent.params.token || 'VCN'
                    );

                    // Convert Plan to Action for UI
                    finalAction = {
                      type: plan.type === 'DIRECT_TRANSFER' ? 'transfer' : 'swap',
                      summary: plan.explanation,
                      data: {
                        token: plan.inputAsset,
                        amount: plan.inputAmount,
                        to: plan.recipient,
                        // If swap
                        fromToken: plan.inputAsset,
                        toToken: plan.outputAsset,
                        fromAmount: plan.inputAmount,
                        toAmount: plan.outputAmount
                      }
                    };
                    explanationText = plan.explanation;

                  } catch (optErr) {
                    console.warn("Optimizer skipped or failed, falling back to basic resolution:", optErr);
                    // Fallback to basic resolver
                    finalAction = await actionResolver.resolve(intent, userAddress);
                  }
                } else {
                  // Standard resolver for Bridge/Other
                  finalAction = await actionResolver.resolve(intent, userAddress);
                }

                setMessages(prev => [...prev, {
                  role: 'model',
                  text: explanationText || finalAction.summary,
                  action: finalAction // Pass the proposed action to UI
                }]);
                setIsLoading(false);
                setThinkingSteps([]);
                return; // EXIT EARLY to skip Gemini for this turn
              } catch (err) {
                console.error("Action Resolution Failed:", err);
                // Fallthrough to Gemini if resolution fails
              }
            }

            // Fallback to General AI (Gemini)
            let rawBase64 = undefined;
            if (imageAttachment) {
              rawBase64 = imageAttachment.preview.split(',')[1];
            }

            // Strict Admin Control: Use the settings fetched in createEffect
            const text = await generateText(userMsg.text, rawBase64, 'helpdesk', user()?.email || 'anonymous');
            setThinkingSteps(prev => prev.map(s => s.id === 'scan' ? { ...s, status: 'completed' as const } : s.id === 'insight' ? { ...s, status: 'loading' as const } : s));
            await new Promise(r => setTimeout(r, 700));

            setThinkingSteps(prev => [
              ...prev.map(s => s.id === 'insight' ? { ...s, status: 'completed' as const } : s),
              { id: 'success', label: '답변 생성 완료', status: 'success' as const }
            ]);
            await new Promise(r => setTimeout(r, 500));

            const assistantMsg: Message = { role: 'model', text };
            const updatedMsgs = [...messages(), assistantMsg];
            setMessages(updatedMsgs);

            // Persistent Logging: Save or update thread
            if (user()) {
              const sessionId = await saveConversation({
                userId: user()!.email,
                botType: 'helpdesk',
                messages: updatedMsgs.map(m => ({
                  role: m.role as 'user' | 'assistant',
                  text: m.text,
                  timestamp: new Date().toISOString()
                })),
                lastMessage: text.substring(0, 100),
                status: 'completed'
              }, currentSessionId() || undefined);

              if (!currentSessionId()) {
                setCurrentSessionId(sessionId);
                loadHistory();
              }
            }
            setThinkingSteps([]);
          } catch (err) {
            setThinkingSteps([]);
            setMessages(prev => [...prev, { role: 'model', text: 'An error occurred during processing.' }]);
          }
        }
      }
    } catch (e) {
      setThinkingSteps([]);
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

      // Use new AI service to get correct credentials for Voice/Live API
      const { resolveVoiceConfig } = await import('../services/ai');
      const voiceConfig = await resolveVoiceConfig();

      const ai = await getAiInstance(voiceConfig.apiKey);
      const sessionPromise = ai.live.connect({
        model: voiceConfig.model || 'gemini-1.5-flash',
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
          class="fixed bottom-0 left-1/2 -translate-x-1/2 w-[95%] max-w-[1000px] h-[85vh] md:h-[80vh] bg-[#0d0d0f] border border-white/[0.08] rounded-t-[32px] md:rounded-[32px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8),0_0_60px_rgba(59,130,246,0.1)] flex flex-col z-[100] overflow-hidden font-sans backdrop-blur-3xl"
          style={{ "margin-bottom": "max(env(safe-area-inset-bottom), 16px)" }}
          onDragEnter={handleDrag}
        >
          <div class="flex flex-1 overflow-hidden relative">
            {/* History Sidebar */}
            <Presence>
              <Show when={isHistoryOpen()}>
                <Motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '280px', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  class="h-full bg-[#1c1c1e] border-r border-white/5 flex flex-col z-30 shrink-0"
                >
                  <div class="p-4 border-b border-white/5 flex items-center justify-between">
                    <div class="flex items-center gap-2 text-gray-400">
                      <BookOpen class="w-4 h-4" />
                      <span class="text-xs font-bold uppercase tracking-widest text-[#888]">History</span>
                    </div>
                    <button
                      onClick={startNewChat}
                      class="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg active:scale-95"
                      title="New Conversation"
                    >
                      <Plus class="w-4 h-4" />
                    </button>
                  </div>

                  <div class="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none">
                    <Show when={history().length === 0}>
                      <div class="py-10 text-center">
                        <p class="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No history yet</p>
                      </div>
                    </Show>
                    <For each={history()}>
                      {(conv) => (
                        <button
                          onClick={() => selectConversation(conv)}
                          class={`w-full p-3 rounded-2xl text-left transition-all border ${currentSessionId() === conv.id
                            ? 'bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20'
                            : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]'
                            }`}
                        >
                          <div class="flex flex-col gap-1">
                            <span class={`text-[13px] font-semibold truncate ${currentSessionId() === conv.id ? 'text-blue-400' : 'text-gray-200'}`}>
                              {conv.messages[0]?.text || 'New Session'}
                            </span>
                            <div class="flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase">
                              <span>{new Date(conv.createdAt).toLocaleDateString()}</span>
                              <span>{conv.messages.length} msgs</span>
                            </div>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>

                  <div class="p-4 bg-black/10">
                    <p class="text-[9px] text-gray-600 font-black text-center uppercase tracking-widest">Vision Architect v1.0</p>
                  </div>
                </Motion.div>
              </Show>
            </Presence>

            <div class="flex-1 flex flex-col min-w-0 bg-[#161618] relative">
              {/* Sidebar Toggle for Mobile/Tablet */}
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen())}
                class="absolute left-4 top-16 z-30 p-2 rounded-full bg-[#242424] border border-white/10 text-gray-400 hover:text-white transition-all lg:flex hidden"
              >
                <div class={`transition-transform duration-300 ${isHistoryOpen() ? 'rotate-180' : ''}`}>
                  <ChevronDown class="w-4 h-4 -rotate-90" />
                </div>
              </button>
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

              {/* NEW: Chat Queue Line (Sticky below header) */}
              <ChatQueueLine
                tasks={queueTasks()}
                isCompact={isQueueCompact()}
                onTaskClick={(id) => {
                  setSelectedTaskId(id);
                  setIsQueueDrawerOpen(true);
                }}
                onOpenHistory={() => {
                  setSelectedTaskId(null);
                  setIsQueueDrawerOpen(true);
                }}
              />

              {/* NEW: Queue Drawer (Overlay) */}
              <QueueDrawer
                isOpen={isQueueDrawerOpen()}
                onClose={() => setIsQueueDrawerOpen(false)}
                tasks={queueTasks()}
                focusedTaskId={selectedTaskId()}
              />

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
              <div class="flex-1 overflow-y-auto p-4 pt-10 pb-32 space-y-6 scroll-smooth bg-[#0d0d0f]" ref={scrollRef}>
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
                        <div class={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-lg backdrop-blur-sm ${msg.role === 'user'
                          ? 'bg-[#2563eb] text-white rounded-tr-sm shadow-[0_0_20px_rgba(37,99,235,0.2)]'
                          : 'bg-[#18181b] text-gray-200 border border-white/5 rounded-tl-sm shadow-[0_5px_15px_rgba(0,0,0,0.3)]'
                          }`}>
                          <Show when={msg.imageUrl}>
                            <div class="mb-3 rounded-xl overflow-hidden border border-white/10 shadow-md">
                              <img src={msg.imageUrl} alt="Attached" class="w-full h-auto object-cover" />
                            </div>
                          </Show>
                          <div class="whitespace-pre-wrap">{msg.text}</div>

                          {/* RENDER TRANSACTION CARD IF ACTION EXISTS */}
                          <Show when={msg.action && msg.action.type !== 'MESSAGE' && msg.action.type !== 'ERROR'}>
                            <div class="mt-4">
                              <TransactionCard
                                action={msg.action!}
                                onComplete={(hash) => {
                                  handleTxComplete(hash);
                                  // Trigger feedback for Scheduled Transfer
                                  if (msg.action?.visualization?.type === 'SCHEDULE') {
                                    setMessages(prev => [...prev, {
                                      role: 'model',
                                      text: `Scheduled Transfer Confirmed! Check the Queue above for status.`
                                    }]);
                                  }
                                }}
                                onCancel={() => {
                                  // Remove action card or just reset
                                  setMessages(prev => prev.filter(m => m !== msg));
                                }}
                                onOptimisticSchedule={(taskData) => {
                                  // Immediately show in Queue
                                  setQueueTasks(prev => {
                                    // Avoid duplicate if already exists
                                    if (prev.find(t => t.id === taskData.id)) return prev;
                                    const newTask: AgentTask = {
                                      ...taskData,
                                      type: 'TIMELOCK',
                                      status: 'WAITING',
                                      recipient: msg.action?.visualization?.recipient || '',
                                      amount: msg.action?.visualization?.amount || '',
                                      token: msg.action?.visualization?.asset || 'VCN'
                                    };
                                    // Add to top/sorted
                                    return [newTask, ...prev];
                                  });
                                }}
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

              {/* Thinking Steps Overlay */}
              <Show when={thinkingSteps().length > 0}>
                <ThinkingDisplay steps={thinkingSteps()} />
              </Show>

              {/* Footer Area (Modernized Input) */}
              <div class="p-4 md:p-6 bg-[#161618] border-t border-white/[0.04] relative z-30">
                {/* ... existing footer content ... */}
                {/* (I'll just keep the existing code structure but fix the tags) */}
                <Presence>
                  {/* (Shortened for brevity in the tool call, but I will replace the exact lines) */}
                  <Show when={attachments().length > 0}>
                    <Motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      class="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
                    >
                      <For each={attachments()}>
                        {(att, i) => (
                          <div class="relative w-20 h-20 rounded-2xl border border-white/[0.05] bg-[#0d0d0f] flex-shrink-0 group overflow-hidden shadow-3xl">
                            <Show when={att.type === 'image'} fallback={
                              <div class="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-600">
                                <Show when={att.type === 'pdf'} fallback={<FileSpreadsheet class="w-7 h-7 text-green-600" />}>
                                  <FileText class="w-7 h-7 text-red-600" />
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

                <div class="relative flex items-center gap-3 bg-[#0a0a0c] rounded-[24px] border border-white/[0.08] p-2 focus-within:border-blue-500/50 transition-all shadow-3xl group">
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
                    ref={textareaRef}
                    rows={1}
                    class="flex-1 bg-transparent text-white text-[15px] py-3 border-none outline-none focus:ring-0 focus:outline-none resize-none placeholder:text-gray-600 max-h-32 font-medium shadow-none appearance-none"
                    placeholder={isRecording() ? "Listening to your voice..." : "Ask Vision AI anything..."}
                    value={input()}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={(e) => {
                      setIsComposing(false);
                      setInput(e.currentTarget.value);
                    }}
                    onInput={(e) => {
                      setInput(e.currentTarget.value);
                      e.currentTarget.style.height = 'auto';
                      e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (isComposing()) return;

                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                        // Reset height after sending
                        const target = e.currentTarget;
                        setTimeout(() => {
                          if (target) target.style.height = 'auto';
                        }, 0);
                      }
                    }}
                  />

                  {/* Right Tools */}
                  <div class="flex items-center gap-1 px-1">
                    {/* Language Dropdown */}
                    <div class="relative group/lang">
                      <button class="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.05] text-[#777] hover:text-white transition-all text-sm font-bold">
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
            </div>
          </div>
        </Motion.div>
      </Show>
    </Presence>
  );
};

export default AIChat;