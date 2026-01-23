import React, { useState, useRef, useEffect } from 'react';
import { intentParser } from '../services/intentParserService';
import { actionResolver, ProposedAction } from '../services/actionResolver';
import { TransactionCard } from './TransactionCard';
import { contractService } from '../services/contractService';

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    action?: ProposedAction;
}

export const AIChatComponent: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        { id: 0, role: 'assistant', content: 'Hello! I am your Vision AI Agent. Ask me to transfer assets, bridge tokens, or optimize your portfolio.' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg: Message = { id: Date.now(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // 1. Parse Intent
            const intent = await intentParser.parseIntent(userMsg.content);

            // 2. Resolve Action
            // Using a dummy user address for now, usually needs wallet.address
            const action = await actionResolver.resolve(intent, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

            const assistantMsg: Message = {
                id: Date.now() + 1,
                role: 'assistant',
                content: action.summary,
                action: action.type === 'TRANSACTION' ? action : undefined
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: "Sorry, I encountered an error processing your request."
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleTxComplete = (hash: string) => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            role: 'assistant',
            content: `✅ Transaction Executed Successfully! Hash: ${hash.slice(0, 10)}...`
        }]);
    };

    return (
        <div className="flex flex-col h-[600px] w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <h3 className="text-white font-bold">Vision AI Wallet</h3>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg p-3 ${msg.role === 'user'
                                ? 'bg-purple-600 text-white rounded-br-none'
                                : 'bg-gray-700 text-gray-200 rounded-bl-none'
                            }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>

                            {/* Action Card (Only for Assistant) */}
                            {msg.action && (
                                <div className="mt-3">
                                    <TransactionCard
                                        action={msg.action}
                                        onComplete={handleTxComplete}
                                        onCancel={() => { }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-700 rounded-lg p-3 rounded-bl-none flex space-x-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-gray-800 border-t border-gray-700">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type your intent (e.g. 'Pay @alice 10 USDC')..."
                        className="flex-1 bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
