
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, FunctionDeclaration, Type, Chat, GenerateContentResponse } from "@google/genai";
import { X, Send, Sparkles, MessageSquare, Briefcase, User, Calendar, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Appointment, Client, BusinessProfile, AppointmentStatus } from '../types';

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  business: BusinessProfile;
  clients: Client[];
  appointments: Appointment[];
  onAddClient: (client: Client) => void;
  onAddAppointment: (appt: Appointment) => void;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    isTool?: boolean;
    isError?: boolean;
}

// --- Gemini Model ---
// Use a stable, widely available model
const GEMINI_MODEL = 'gemini-2.0-flash';

// --- Tool Declarations ---

const getFinancialStatsTool: FunctionDeclaration = {
  name: 'getFinancialStats',
  description: 'Get current financial statistics including revenue, expenses, and monthly goal progress.',
  parameters: { type: Type.OBJECT, properties: {} }
};

const addClientTool: FunctionDeclaration = {
  name: 'addClient',
  description: 'Add a new client to the database.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Full name of the client' },
      email: { type: Type.STRING, description: 'Email address' },
      phone: { type: Type.STRING, description: 'Phone number' },
    },
    required: ['name']
  }
};

const bookAppointmentTool: FunctionDeclaration = {
  name: 'bookAppointment',
  description: 'Book a new appointment for a client.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      clientName: { type: Type.STRING, description: 'Name of the client' },
      date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
      time: { type: Type.STRING, description: 'Time in HH:mm 24h format' },
      serviceName: { type: Type.STRING, description: 'Name of the service (e.g. Haircut)' }
    },
    required: ['clientName', 'date', 'time']
  }
};

const AIChatPanel: React.FC<AIChatPanelProps> = ({ 
  isOpen, 
  onClose, 
  business, 
  clients, 
  appointments, 
  onAddClient, 
  onAddAppointment 
}) => {
  // Check if API key is available (injected at build time via vite.config.ts)
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  const hasApiKey = !!apiKey && apiKey !== 'undefined' && apiKey !== 'null' && apiKey.trim() !== '';

  const [messages, setMessages] = useState<ChatMessage[]>([
      { 
        id: '0', 
        role: 'model', 
        text: hasApiKey 
          ? `Hello ${business.ownerName || 'there'}. I am Halo AI. I can analyze your business, add clients, or manage your calendar. How can I help?`
          : `⚠️ Halo AI is not configured. The Gemini API key is missing.\n\nTo enable AI features, add GEMINI_API_KEY to your Vercel Environment Variables and redeploy.`
      }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<'connected' | 'disconnected' | 'error'>(hasApiKey ? 'disconnected' : 'error');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Gemini Instance Ref
  const chatSessionRef = useRef<Chat | null>(null);

  // Initialize Chat Session
  useEffect(() => {
    if (!hasApiKey) {
      console.warn('⚠️ GEMINI_API_KEY not configured - Halo AI is disabled');
      setAiStatus('error');
      return;
    }
    
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      chatSessionRef.current = ai.chats.create({
        model: GEMINI_MODEL,
        config: {
          systemInstruction: `You are Halo, an advanced AI business operating system for a service business named ${business.name || 'the business'}. 
          Owner name: ${business.ownerName || 'the owner'}.
          Services offered: ${business.services?.map(s => `${s.name} ($${s.price})`).join(', ') || 'none configured'}.
          You are helpful, professional, and concise. You have access to tools to manage the business.
          Always confirm when an action (like adding a client) is done.
          Current Date: ${new Date().toISOString().split('T')[0]}.
          Total clients: ${clients.length}. Total appointments: ${appointments.length}.`,
          tools: [{ functionDeclarations: [getFinancialStatsTool, addClientTool, bookAppointmentTool] }]
        }
      });
      
      setAiStatus('connected');
      console.log('✅ Halo AI connected with model:', GEMINI_MODEL);
    } catch (error) {
      console.error('Failed to initialize Halo AI:', error);
      setAiStatus('error');
      setMessages(prev => [
        ...prev, 
        { id: 'init-error', role: 'model', text: `⚠️ Failed to initialize AI: ${error instanceof Error ? error.message : 'Unknown error'}. Check your API key.`, isError: true }
      ]);
    }
  }, [business.name, hasApiKey]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // --- Tool Execution Logic ---

  const executeTool = async (functionCall: any): Promise<any> => {
      console.log("Executing tool:", functionCall.name, functionCall.args);
      
      switch (functionCall.name) {
          case 'getFinancialStats': {
              const completedAppts = appointments.filter(a => a.status === AppointmentStatus.COMPLETED);
              const grossRevenue = completedAppts.reduce((sum, appt) => {
                  const s = business.services.find(serv => serv.id === appt.serviceId);
                  return sum + (s ? s.price : 0);
              }, 0);
              const goalProgress = Math.min(100, (grossRevenue / (business.monthlyRevenueGoal || 1)) * 100).toFixed(1);
              return {
                  grossRevenue,
                  appointmentsCount: appointments.length,
                  clientCount: clients.length,
                  monthlyGoal: business.monthlyRevenueGoal,
                  goalProgress: `${goalProgress}%`
              };
          }

          case 'addClient': {
             const { name, email, phone } = functionCall.args;
             const newClient: Client = {
                 id: Math.random().toString(36).substr(2, 9),
                 name: name,
                 email: email || 'no-email@example.com',
                 phone: phone || '000-000-0000',
                 notes: [],
                 preferences: 'Added via AI',
                 lastVisit: null
             };
             onAddClient(newClient);
             return { success: true, message: `Client ${name} added successfully.` };
          }

          case 'bookAppointment': {
              const { clientName, date, time, serviceName } = functionCall.args;
              // Find service (simple fuzzy match or default)
              const service = business.services.find(s => s.name.toLowerCase().includes(serviceName?.toLowerCase() || '')) || business.services[0];
              if (!service) {
                return { error: 'No services configured. Please add a service in Settings first.' };
              }
              const newAppt: Appointment = {
                  id: Math.random().toString(36).substr(2, 9),
                  clientId: 'ai-generated',
                  clientName: clientName,
                  serviceId: service.id,
                  date: date,
                  time: time,
                  status: AppointmentStatus.CONFIRMED
              };
              onAddAppointment(newAppt);
              return { success: true, message: `Booked ${clientName} for ${service.name} at ${time} on ${date}.` };
          }

          default:
              return { error: 'Unknown function' };
      }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // Check if AI is available
    if (!chatSessionRef.current) {
      setMessages(prev => [...prev, 
        { id: Date.now().toString(), role: 'user', text: input },
        { id: (Date.now() + 1).toString(), role: 'model', text: '⚠️ AI is not available. Make sure GEMINI_API_KEY is set in your Vercel Environment Variables and redeploy.', isError: true }
      ]);
      setInput('');
      return;
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
        // 1. Send message to Gemini
        let response = await chatSessionRef.current.sendMessage({ message: userMsg.text });
        
        // 2. Check for Tool Calls
        const functionCalls = response.candidates?.[0]?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);

        if (functionCalls && functionCalls.length > 0) {
             // Handle Function Calls
             const functionResponses = [];
             
             for (const call of functionCalls) {
                 if(call) {
                     const result = await executeTool(call);
                     functionResponses.push({
                         id: call.id,
                         name: call.name,
                         response: { result: result }
                     });
                 }
             }

             // 3. Send Tool Response back to Gemini
             response = await chatSessionRef.current.sendMessage({
                 message: functionResponses.map(fr => ({ functionResponse: fr }))
             });
        }

        // 4. Display Final Text Response
        const modelText = response.text || "I processed that request.";
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: modelText }]);

    } catch (error: any) {
        console.error("Chat Error:", error);
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        
        // Provide helpful error messages
        let userFriendlyMsg: string;
        if (errorMsg.includes('API key') || errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('403')) {
          userFriendlyMsg = "⚠️ Invalid API key. Check that GEMINI_API_KEY is correct in your Vercel Environment Variables.";
        } else if (errorMsg.includes('not found') || errorMsg.includes('404') || errorMsg.includes('model')) {
          userFriendlyMsg = `⚠️ Model "${GEMINI_MODEL}" not available. The API returned: ${errorMsg}`;
        } else if (errorMsg.includes('quota') || errorMsg.includes('429')) {
          userFriendlyMsg = "⚠️ API quota exceeded. Please try again later or check your Google AI billing.";
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          userFriendlyMsg = "⚠️ Network error. Check your internet connection and try again.";
        } else {
          userFriendlyMsg = `⚠️ AI error: ${errorMsg}`;
        }
        
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: userFriendlyMsg, isError: true }]);
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 lg:inset-auto lg:bottom-24 lg:right-8 lg:z-50 lg:w-96 lg:h-[600px] z-50 flex flex-col bg-zinc-950 border-0 lg:border border-zinc-800 shadow-2xl lg:rounded-sm overflow-hidden font-sans">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-black flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 flex items-center justify-center rounded-sm ${aiStatus === 'connected' ? 'bg-orange-600' : 'bg-zinc-700'}`}>
                    {aiStatus === 'error' ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-black animate-pulse" />
                    )}
                </div>
                <div>
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider">Halo AI</h3>
                    <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          aiStatus === 'connected' ? 'bg-green-500' : 
                          aiStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}></span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {aiStatus === 'connected' ? GEMINI_MODEL : 
                           aiStatus === 'error' ? 'Not configured' : 'Connecting...'}
                        </span>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/50">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 text-sm leading-relaxed rounded-sm whitespace-pre-wrap ${
                        msg.role === 'user' 
                        ? 'bg-zinc-800 text-white border border-zinc-700' 
                        : msg.isError
                        ? 'bg-red-950/50 text-red-200 border border-red-900/50'
                        : 'bg-orange-600/10 text-zinc-200 border border-orange-900/30'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex justify-start">
                     <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">Thinking...</span>
                     </div>
                </div>
            )}
        </div>

        {/* Input */}
        <div className="p-4 bg-black border-t border-zinc-800">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-2 rounded-sm focus-within:border-orange-600 transition-colors">
                <input 
                    type="text" 
                    className="flex-1 bg-transparent text-white text-sm outline-none px-2 placeholder-zinc-600"
                    placeholder={hasApiKey ? "Ask about revenue, add client, or book..." : "AI not configured — API key required"}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    disabled={isLoading}
                />
                <button 
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="p-2 bg-orange-600 hover:bg-white text-black transition-colors rounded-sm disabled:opacity-50"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
            {hasApiKey && (
              <div className="flex justify-center mt-3 gap-3">
                  <button onClick={() => setInput("How is my revenue this month?")} className="text-[10px] text-zinc-500 hover:text-orange-500 uppercase tracking-wide border border-zinc-800 px-2 py-1 rounded-sm">Analytics</button>
                  <button onClick={() => setInput("Add client John Doe 555-0199")} className="text-[10px] text-zinc-500 hover:text-orange-500 uppercase tracking-wide border border-zinc-800 px-2 py-1 rounded-sm">Add Client</button>
                  <button onClick={() => setInput("Book a haircut for tomorrow at 2pm")} className="text-[10px] text-zinc-500 hover:text-orange-500 uppercase tracking-wide border border-zinc-800 px-2 py-1 rounded-sm">Book</button>
              </div>
            )}
            {!hasApiKey && (
              <div className="mt-3 text-center">
                <p className="text-[10px] text-red-400 uppercase tracking-wide">
                  Set GEMINI_API_KEY in Vercel → Settings → Environment Variables → Redeploy
                </p>
              </div>
            )}
        </div>
    </div>
  );
};

export default AIChatPanel;
