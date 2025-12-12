
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import { 
  Sparkles, X, Send, Loader2, 
  Trash2, Terminal, User, Bot 
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'model',
      text: "Hello! I'm the AllCare Intelligence assistant. I can help you summarize clinical notes, explain lab results, or draft reports. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const getPageContext = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/patients')) return 'Patient Registry';
    if (path.startsWith('/appointments')) return 'Appointments Queue';
    if (path.startsWith('/admissions')) return 'Inpatient Ward & Admissions';
    if (path.startsWith('/billing')) return 'Billing & Finance';
    if (path.startsWith('/hr')) return 'Human Resources';
    if (path.startsWith('/laboratory')) return 'Laboratory';
    if (path.startsWith('/operations')) return 'Operating Theater';
    if (path.startsWith('/reports')) return 'Analytics & Reports';
    return 'Hospital Management System';
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      // Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const contextPrompt = `
        System Context:
        You are an expert AI assistant embedded within "AllCare HMS", a hospital management system.
        The user is currently navigating the "${getPageContext()}" module.
        
        Your Capabilities:
        1. Summarize unstructured clinical text (notes, history).
        2. Explain complex medical terms or lab results in simple language.
        3. Draft professional emails or discharge summaries.
        4. Analyze financial data if provided in text format.
        
        Guidelines:
        - Keep responses concise, professional, and formatted for easy reading.
        - Do not invent patient data. Only analyze what the user provides in the chat.
        - If asked about sensitive real-time database access, explain that you can process text provided in the chat but cannot directly query the live database for privacy reasons.
      `;

      // Construct history for context window (last 10 messages)
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // Call the model
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          ...history,
          { role: 'user', parts: [{ text: userMsg.text }] }
        ],
        config: {
          systemInstruction: contextPrompt,
        }
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "I apologize, I couldn't generate a response at this moment.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);

    } catch (error: any) {
      console.error("Gemini Error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "I encountered an error connecting to the AI service. Please ensure your API key is configured correctly.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const clearHistory = () => {
    setMessages([{
      id: 'init',
      role: 'model',
      text: "Chat history cleared. How can I help you now?",
      timestamp: new Date()
    }]);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-6 right-6 z-[100] p-4 rounded-full shadow-2xl transition-all duration-300
          ${isOpen 
            ? 'bg-red-500 text-white rotate-90 scale-90' 
            : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:scale-110 hover:rotate-12'
          }
        `}
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </button>

      {/* Chat Window */}
      <div 
        className={`
          fixed bottom-24 right-6 z-[99] w-[90vw] sm:w-[400px] max-h-[600px] h-[70vh]
          bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 
          rounded-2xl shadow-2xl flex flex-col transition-all duration-300 origin-bottom-right
          ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-10 pointer-events-none'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <Sparkles className="text-violet-600 dark:text-violet-400" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">AllCare Intelligence</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Gemini 2.5 Flash
              </p>
            </div>
          </div>
          <button 
            onClick={clearHistory}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Clear History"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div 
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1
                  ${msg.role === 'user' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}
                `}
              >
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div 
                className={`
                  max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm whitespace-pre-wrap
                  ${msg.role === 'user' 
                    ? 'bg-primary-600 text-white rounded-tr-none' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                  }
                `}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary-500 placeholder-slate-400 dark:text-white"
              disabled={isThinking}
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white dark:bg-slate-700 text-primary-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isThinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
