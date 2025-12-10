import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Volume2, Bolt, Sparkles, BookOpen, Mic, MicOff, Activity, Paperclip, Trash2, Palette, Bot, User, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateText, generateImage, generateSpeech, getAudioContext, ai, createPcmBlob, base64ToArrayBuffer, decodeRawPcm } from '../services/geminiService';
import { Message, AspectRatio } from '../types';
import { Modality, LiveServerMessage } from "@google/genai";
import { VISION_CHAIN_KNOWLEDGE } from '../data/knowledge';

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

const TypingIndicator = () => (
  <motion.div 
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    className="flex gap-3"
  >
     <div className="w-8 h-8 rounded-full bg-[#1d1d1f] border border-white/10 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
        <Bot className="w-4 h-4 text-blue-400" />
     </div>
     <div className="bg-[#1d1d1f] px-4 py-3 rounded-2xl rounded-tl-sm border border-white/10 flex items-center gap-1.5 shadow-sm">
        <motion.span 
          className="w-1.5 h-1.5 bg-gray-400 rounded-full"
          animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }}
        />
        <motion.span 
          className="w-1.5 h-1.5 bg-gray-400 rounded-full"
          animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        />
        <motion.span 
          className="w-1.5 h-1.5 bg-gray-400 rounded-full"
          animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
     </div>
  </motion.div>
);

const ImageSkeleton = () => (
    <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex gap-3"
    >
        <div className="w-8 h-8 rounded-full bg-[#1d1d1f] border border-white/10 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
            <Bot className="w-4 h-4 text-blue-400" />
        </div>
        <div className="space-y-2">
            <div className="bg-[#1d1d1f] border border-white/10 p-2 rounded-2xl rounded-tl-sm shadow-sm">
                <div className="w-48 h-48 bg-white/5 rounded-xl animate-pulse relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-20" />
                    <Sparkles className="w-6 h-6 text-white/20 animate-pulse" />
                </div>
            </div>
            <div className="flex items-center gap-2 ml-1">
                 <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
                 <span className="text-[10px] text-gray-500 font-medium animate-pulse">Generating visual...</span>
            </div>
        </div>
    </motion.div>
);

const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello. I am the Vision Chain AI Architect. I can analyze images, generate visuals, and answer technical questions.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'text' | 'image'>('text');
  const [useFastModel, setUseFastModel] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Square);
  
  // Unified Chat Mode States
  const [isImageGenMode, setIsImageGenMode] = useState(false); 
  const [attachment, setAttachment] = useState<string | null>(null); 
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Voice Mode State
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0); 

  // Audio Refs for Live API
  const audioContextsRef = useRef<{input?: AudioContext, output?: AudioContext}>({});
  const sessionRef = useRef<any>(null); 
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
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
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;
    
    const userMsg: Message = { 
        role: 'user', 
        text: input,
        imageUrl: attachment || undefined,
        type: attachment ? 'image' : 'text'
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentAttachment = attachment;
    clearAttachment(); 
    
    setLoadingType(isImageGenMode ? 'image' : 'text');
    setIsLoading(true);

    try {
        if (isImageGenMode) {
            const imageUrl = await generateImage(userMsg.text, aspectRatio);
            if (imageUrl) {
                setMessages(prev => [...prev, { role: 'model', text: 'Visual generated successfully.', type: 'image', imageUrl }]);
            } else {
                setMessages(prev => [...prev, { role: 'model', text: 'Failed to generate visual. Please try again with a different prompt.' }]);
            }
        } else {
            let rawBase64 = undefined;
            if (currentAttachment) {
                rawBase64 = currentAttachment.split(',')[1];
            }
            const text = await generateText(userMsg.text, rawBase64, useFastModel);
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
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
      } catch (err) { console.error("Audio playback failed", err); }
    }
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

        audioContextsRef.current = { input: inputContext, output: outputContext };

        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        streamRef.current = stream;

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
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
                    const source = inputContext.createMediaStreamSource(stream);
                    const scriptProcessor = inputContext.createScriptProcessor(4096, 1, 1);
                    sourceRef.current = source;
                    processorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        
                        let sum = 0;
                        for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                        const rms = Math.sqrt(sum / inputData.length);
                        setVolumeLevel(Math.min(rms * 5, 1)); 

                        const pcmBlob = createPcmBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };

                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputContext.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputContext) {
                        const audioData = base64ToArrayBuffer(base64Audio);
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputContext.currentTime);
                        const audioBuffer = await decodeRawPcm(audioData, outputContext);
                        const source = outputContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputContext.destination);
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        const sourceNode = source;
                        audioSourcesRef.current.add(sourceNode);
                        source.onended = () => { audioSourcesRef.current.delete(sourceNode); };
                    }
                    if (message.serverContent?.interrupted) {
                        audioSourcesRef.current.forEach(src => src.stop());
                        audioSourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
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
        sessionRef.current = sessionPromise;

    } catch (err) {
        console.error("Failed to start voice session", err);
        setVoiceError("Failed to access microphone or connect.");
        setIsVoiceMode(false);
    }
  };

  const stopVoiceSession = () => {
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current.onaudioprocess = null; processorRef.current = null; }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    if (audioContextsRef.current.input) audioContextsRef.current.input.close();
    if (audioContextsRef.current.output) audioContextsRef.current.output.close();
    audioContextsRef.current = {};
    if (sessionRef.current) { sessionRef.current.then((s: any) => s.close()); sessionRef.current = null; }
    setIsVoiceConnected(false);
    setVolumeLevel(0);
    nextStartTimeRef.current = 0;
    audioSourcesRef.current.clear();
  };

  const toggleVoiceMode = () => {
      if (isVoiceMode) {
          setIsVoiceMode(false);
          stopVoiceSession();
      } else {
          setIsVoiceMode(true);
          startVoiceSession();
      }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
          className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[650px] bg-[#161617]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5 z-20">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-white">Vision AI</h2>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-gray-400">Online</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                 {/* Minimize/Close buttons could go here */}
                 <button 
                    onClick={() => { onClose(); stopVoiceSession(); setIsVoiceMode(false); }} 
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
          </div>
          
          {/* Control Bar */}
          <div className="bg-[#0a0a0a]/50 px-4 py-2 flex items-center justify-between border-b border-white/5 z-20 text-[11px]">
             <div className="flex items-center gap-2 text-gray-400">
                <BookOpen className="w-3 h-3 text-blue-400" />
                <span>Knowledge Base Active</span>
             </div>
             <button 
                onClick={() => setUseFastModel(!useFastModel)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${useFastModel ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'}`}
             >
                {useFastModel ? <Bolt className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                <span className="font-medium">{useFastModel ? 'Flash 2.5' : 'Pro 3.0'}</span>
             </button>
          </div>

          {/* VOICE MODE OVERLAY */}
          {isVoiceMode && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-[#050505]/95 backdrop-blur-md flex flex-col items-center justify-center top-[105px] bottom-0"
              >
                  <div className="flex-1 flex flex-col items-center justify-center w-full relative">
                      {voiceError ? (
                          <div className="text-red-400 text-center px-8">
                              <p className="mb-4 bg-red-500/10 p-4 rounded-xl border border-red-500/20">{voiceError}</p>
                              <button onClick={toggleVoiceMode} className="text-sm text-gray-400 hover:text-white transition-colors">Return to Chat</button>
                          </div>
                      ) : (
                        <>
                             {/* Dynamic Voice Visualizer */}
                             <div className="relative w-32 h-32 flex items-center justify-center">
                                {/* Outer Ripple */}
                                <motion.div 
                                    animate={{ 
                                        scale: isVoiceConnected ? 1.2 + (volumeLevel * 1) : 1, 
                                        opacity: isVoiceConnected ? 0.2 + (volumeLevel * 0.3) : 0 
                                    }}
                                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                                    className="absolute inset-0 bg-blue-500 rounded-full blur-2xl"
                                />
                                {/* Inner Ring */}
                                <motion.div 
                                    animate={{ 
                                        scale: isVoiceConnected ? 1 + (volumeLevel * 0.4) : 1,
                                    }}
                                    className={`w-24 h-24 rounded-full flex items-center justify-center border transition-all duration-300 relative z-10 ${isVoiceConnected ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.3)]' : 'border-white/10 bg-white/5'}`}
                                >
                                    {isVoiceConnected ? (
                                        <Activity className="w-8 h-8 text-blue-400" />
                                    ) : (
                                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    )}
                                </motion.div>
                             </div>

                             <div className="mt-8 text-center space-y-2">
                                <h3 className="text-white font-medium text-lg tracking-tight">
                                    {isVoiceConnected ? "Vision AI Live" : "Connecting..."}
                                </h3>
                                <p className="text-gray-500 text-sm font-medium">
                                    {isVoiceConnected 
                                      ? (volumeLevel > 0.05 ? "Listening..." : "Speak now") 
                                      : "Establishing secure link"}
                                </p>
                             </div>
                        </>
                      )}
                  </div>
                  <div className="w-full p-8 flex justify-center pb-12">
                      <button 
                        onClick={toggleVoiceMode} 
                        className="p-4 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                      >
                          <MicOff className="w-6 h-6" />
                      </button>
                  </div>
              </motion.div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth" ref={scrollRef}>
            {messages.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${msg.role === 'user' ? 'bg-blue-600' : 'bg-[#1d1d1f] border border-white/10'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-blue-400" />}
                </div>

                <div className={`max-w-[80%] space-y-1`}>
                   <div className={`p-3.5 rounded-2xl text-[13.5px] leading-relaxed shadow-sm backdrop-blur-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-[#1d1d1f] text-gray-200 border border-white/10 rounded-tl-sm'
                    }`}>
                      {msg.imageUrl && (
                          <div className="mb-3 rounded-xl overflow-hidden border border-white/10 shadow-md">
                              <img src={msg.imageUrl} alt="Attached" className="w-full h-auto object-cover" />
                          </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                   </div>
                   
                   {/* Message Actions (Model Only) */}
                   {msg.role === 'model' && msg.type !== 'image' && (
                     <div className="flex items-center gap-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => playTTS(msg.text)} className="text-gray-500 hover:text-blue-400 flex items-center gap-1 text-[10px] transition-colors">
                            <Volume2 className="w-3 h-3" /> Read Aloud
                        </button>
                     </div>
                   )}
                </div>
              </motion.div>
            ))}
            
            {/* Loading Indicators */}
            {isLoading && (loadingType === 'image' ? <ImageSkeleton /> : <TypingIndicator />)}
          </div>

          {/* Input Area - Sticky Bottom */}
          <div className="p-4 bg-[#0a0a0a]/80 backdrop-blur-xl border-t border-white/10">
             {/* Attachment Preview */}
             <AnimatePresence>
                 {attachment && (
                     <motion.div 
                        initial={{ opacity: 0, y: 10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: 10, height: 0 }}
                        className="mb-3 flex items-center gap-2 overflow-hidden"
                     >
                         <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/10 group shadow-lg">
                             <img src={attachment} alt="Preview" className="w-full h-full object-cover" />
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <button onClick={clearAttachment} className="text-white p-1 hover:text-red-400 transition-colors">
                                     <Trash2 className="w-5 h-5" />
                                 </button>
                             </div>
                         </div>
                         <span className="text-xs text-blue-400 font-medium bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">Image attached</span>
                     </motion.div>
                 )}
             </AnimatePresence>
             
             {/* Input Bar */}
             <div className="relative flex gap-2 items-end">
               <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
               />
               
               {/* Tools Group */}
               <div className="flex gap-1 pb-1.5">
                   <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImageGenMode}
                      className={`p-2 rounded-xl transition-all ${isImageGenMode ? 'opacity-30 cursor-not-allowed text-gray-600' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                      title="Attach Image"
                   >
                      <Paperclip className="w-4.5 h-4.5" />
                   </button>
                   <button 
                      onClick={() => {
                          setIsImageGenMode(!isImageGenMode);
                          if (!isImageGenMode) clearAttachment();
                      }}
                      className={`p-2 rounded-xl transition-all ${isImageGenMode ? 'bg-purple-500 text-white shadow-lg shadow-purple-900/50' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                      title="Image Generation Mode"
                   >
                      <Palette className="w-4.5 h-4.5" />
                   </button>
               </div>

               <div className="relative flex-1">
                 <input
                   className={`w-full bg-[#1c1c1e] text-white text-sm rounded-xl py-3 pl-4 pr-10 outline-none border transition-all placeholder:text-gray-600 ${isImageGenMode ? 'border-purple-500/50 focus:border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-white/10 focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}
                   placeholder={isImageGenMode ? "Describe the image to generate..." : "Ask anything..."}
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                 />
                 <button 
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !attachment)}
                  className={`absolute right-1.5 top-1.5 p-1.5 rounded-lg text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isImageGenMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                 >
                   <Send className="w-3.5 h-3.5" />
                 </button>
               </div>
               
               {/* Voice Button */}
               <button 
                  onClick={toggleVoiceMode}
                  className="p-3 bg-[#1c1c1e] hover:bg-[#2c2c2e] rounded-xl text-gray-400 hover:text-white transition-all border border-white/10 hover:border-white/20 hover:shadow-lg mb-[1px]"
                  title="Voice Chat"
               >
                  <Mic className="w-4.5 h-4.5" />
               </button>
             </div>
             
             {/* Mode Indicator */}
             <AnimatePresence>
                {isImageGenMode && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 text-[10px] text-purple-400 flex items-center gap-1.5 px-1 font-medium"
                    >
                        <Sparkles className="w-3 h-3" />
                        <span>Image Generation Mode Active</span>
                    </motion.div>
                )}
             </AnimatePresence>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIChat;