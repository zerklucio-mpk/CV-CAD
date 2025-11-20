
import React, { useState, useRef, useEffect } from 'react';
import { SparklesIcon } from './Icon';
import { generateCadData } from '../services/geminiService';
import { useAppContext } from '../hooks/useAppContext';
import { AnyShape } from '../types';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isError?: boolean;
}

const AIAssistant: React.FC = () => {
    const { addShapes, createNewDrawing } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hola, soy tu asistente de CAD impulsado por Gemini. ¿Qué te gustaría dibujar hoy? (Ej: "Dibuja una planta de casa simple con dos habitaciones")'
        }
    ]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Check for keywords to clear canvas (optional heuristic)
            if (input.toLowerCase().includes('nuevo dibujo') || input.toLowerCase().includes('borrar todo')) {
                 createNewDrawing();
            }

            const generatedShapes = await generateCadData(input);
            
            if (generatedShapes && generatedShapes.length > 0) {
                // Sanitize shapes to match AnyShape type strictly where needed
                const validShapes = generatedShapes.map(s => {
                    // Ensure defaults if AI misses them
                    if (!s.properties) s.properties = { color: '#FFFFFF', fill: 'transparent', strokeWidth: 1 };
                    if (s.type === 'text' && !s.fontSize) s.fontSize = 12;
                    if (s.type === 'symbol' && !s.size) s.size = 24;
                    return s;
                });
                
                addShapes(validShapes as Omit<AnyShape, 'id'>[]);
                
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: `¡Listo! He generado ${validShapes.length} elementos basados en tu descripción.`
                }]);
            } else {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Entendí tu solicitud, pero no pude generar formas válidas. Intenta ser más específico con las dimensiones o formas.'
                }]);
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Lo siento, hubo un error al conectar con Gemini. Verifica tu API Key.',
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-[60] p-4 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 ${
                    isOpen 
                    ? 'bg-secondary text-white rotate-90' 
                    : 'bg-primary text-white hover:bg-primary-focus'
                }`}
                aria-label="Toggle AI Assistant"
            >
                {isOpen ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <SparklesIcon className="w-6 h-6" />
                )}
            </button>

            {/* Chat Interface */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-[60] w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-base-100 dark:bg-dark-base-200 border border-base-300 dark:border-dark-base-300 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary to-primary-focus p-4 flex items-center gap-2 text-primary-content">
                        <SparklesIcon className="w-5 h-5" />
                        <h3 className="font-bold">Gemini CAD Assistant</h3>
                    </div>

                    {/* Messages Area */}
                    <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 bg-base-100 dark:bg-dark-base-100">
                        {messages.map((msg) => (
                            <div 
                                key={msg.id} 
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div 
                                    className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                                        msg.role === 'user' 
                                            ? 'bg-primary text-primary-content rounded-br-none' 
                                            : msg.isError 
                                                ? 'bg-red-100 text-red-800 border border-red-200 rounded-bl-none'
                                                : 'bg-base-200 dark:bg-dark-base-300 text-base-content dark:text-dark-base-content rounded-bl-none'
                                    }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-base-200 dark:bg-dark-base-300 p-3 rounded-2xl rounded-bl-none flex gap-2 items-center">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-base-100 dark:bg-dark-base-200 border-t border-base-300 dark:border-dark-base-300">
                        <div className="relative flex items-end gap-2">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Describe qué dibujar..."
                                className="w-full resize-none max-h-32 min-h-[44px] bg-base-200 dark:bg-dark-base-300 text-base-content dark:text-dark-base-content rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                rows={1}
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                className="p-3 bg-primary hover:bg-primary-focus text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-[1px]"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                </svg>
                            </button>
                        </div>
                        <div className="text-xs text-center mt-2 text-base-content/40 dark:text-dark-base-content/40">
                            Impulsado por Google Gemini 2.5 Flash
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistant;
