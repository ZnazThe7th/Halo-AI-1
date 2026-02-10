
import React, { useState, useRef, useEffect } from 'react';
import OpenAI from 'openai';
import { X, Send, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { Appointment, Client, BusinessProfile, AppointmentStatus } from '../types';
import { toLocalDateStr } from '../constants';

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
    role: 'user' | 'assistant' | 'system' | 'tool';
    text: string;
    isError?: boolean;
    toolCallId?: string;
}

// --- OpenAI Model ---
const AI_MODEL = 'gpt-4o';

// --- Tool Definitions (OpenAI format) ---
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'getFinancialStats',
      description: 'Get current financial statistics including revenue, expenses, client count, and monthly goal progress.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'addClient',
      description: 'Add a new client to the database.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name of the client' },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone number' },
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bookAppointment',
      description: 'Book a new appointment for a client.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Name of the client' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          time: { type: 'string', description: 'Time in HH:mm 24h format' },
          serviceName: { type: 'string', description: 'Name of the service (e.g. Haircut)' }
        },
        required: ['clientName', 'date', 'time']
      }
    }
  }
];

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
  const apiKey = process.env.OPENAI_API_KEY || '';
  const hasApiKey = !!apiKey && apiKey !== 'undefined' && apiKey !== 'null' && apiKey.trim() !== '';

  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([
    { 
      id: '0', 
      role: 'assistant', 
      text: hasApiKey 
        ? `Hello ${business.ownerName || 'there'}. I am Halo AI (v5.2). I can analyze your business, add clients, or manage your calendar. How can I help?`
        : `⚠️ Halo AI is not configured. The OpenAI API key is missing.\n\nTo enable AI features, add OPENAI_API_KEY to your Vercel Environment Variables and redeploy.`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<'connected' | 'disconnected' | 'error'>(hasApiKey ? 'connected' : 'error');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // OpenAI client ref
  const openaiRef = useRef<OpenAI | null>(null);
  // Conversation history for OpenAI (includes system message + all turns)
  const conversationRef = useRef<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>([]);

  // Initialize OpenAI client
  useEffect(() => {
    if (!hasApiKey) {
      console.warn('⚠️ OPENAI_API_KEY not configured - Halo AI is disabled');
      setAiStatus('error');
      return;
    }
    
    try {
      openaiRef.current = new OpenAI({ 
        apiKey,
        dangerouslyAllowBrowser: true // Required for client-side usage
      });
      
      // Set up system message with business context
      conversationRef.current = [{
        role: 'system',
        content: `You are Halo, an advanced AI business assistant (v5.2) for a service business.
Business name: ${business.name || 'Not set'}.
Owner: ${business.ownerName || 'Not set'}.
Services: ${business.services?.map(s => `${s.name} ($${s.price}${s.pricePerPerson ? '/person' : ''})`).join(', ') || 'None configured'}.
Monthly revenue goal: $${business.monthlyRevenueGoal || 0}.
Total clients: ${clients.length}. Total appointments: ${appointments.length}.
Current date: ${toLocalDateStr()}.

You are helpful, professional, and concise. You have access to tools to manage the business.
Always confirm when an action (like adding a client or booking) is done.
Keep responses short and actionable.`
      }];
      
      setAiStatus('connected');
      console.log('✅ Halo AI connected with model:', AI_MODEL);
    } catch (error) {
      console.error('Failed to initialize Halo AI:', error);
      setAiStatus('error');
      setDisplayMessages(prev => [
        ...prev, 
        { id: 'init-error', role: 'assistant', text: `⚠️ Failed to initialize AI: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true }
      ]);
    }
  }, [business.name, hasApiKey]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages, isOpen]);

  // --- Tool Execution Logic ---
  const executeTool = (name: string, args: any): any => {
    console.log("Executing tool:", name, args);
    
    switch (name) {
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
          completedCount: completedAppts.length,
          clientCount: clients.length,
          monthlyGoal: business.monthlyRevenueGoal,
          goalProgress: `${goalProgress}%`
        };
      }

      case 'addClient': {
        const { name: clientName, email, phone } = args;
        const newClient: Client = {
          id: Math.random().toString(36).substr(2, 9),
          name: clientName,
          email: email || 'no-email@example.com',
          phone: phone || '000-000-0000',
          notes: [],
          preferences: 'Added via Halo AI',
          lastVisit: null
        };
        onAddClient(newClient);
        return { success: true, message: `Client ${clientName} added successfully.` };
      }

      case 'bookAppointment': {
        const { clientName, date, time, serviceName } = args;
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
    if (!openaiRef.current) {
      setDisplayMessages(prev => [...prev, 
        { id: Date.now().toString(), role: 'user', text: input },
        { id: (Date.now() + 1).toString(), role: 'assistant', text: '⚠️ AI is not available. Set OPENAI_API_KEY in Vercel Environment Variables and redeploy.', isError: true }
      ]);
      setInput('');
      return;
    }

    const userText = input;
    setDisplayMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText }]);
    setInput('');
    setIsLoading(true);

    // Add user message to conversation history
    conversationRef.current.push({ role: 'user', content: userText });

    try {
      // Call OpenAI
      let response = await openaiRef.current.chat.completions.create({
        model: AI_MODEL,
        messages: conversationRef.current,
        tools: tools,
        tool_choice: 'auto',
      });

      let assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) throw new Error('No response from AI');

      // Handle tool calls (may be multiple rounds)
      let maxRounds = 5; // Safety limit
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && maxRounds > 0) {
        maxRounds--;
        
        // Add assistant's tool-call message to history
        conversationRef.current.push(assistantMessage);
        
        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs: any = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            console.warn('Failed to parse tool arguments:', toolCall.function.arguments);
          }
          
          const result = executeTool(fnName, fnArgs);
          
          // Add tool response to history
          conversationRef.current.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
        
        // Send tool results back to get final response
        response = await openaiRef.current.chat.completions.create({
          model: AI_MODEL,
          messages: conversationRef.current,
          tools: tools,
          tool_choice: 'auto',
        });
        
        assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) break;
      }

      // Display final text response
      const modelText = assistantMessage?.content || "Done — I processed that request.";
      
      // Add to conversation history
      conversationRef.current.push({ role: 'assistant', content: modelText });
      
      // Add to display
      setDisplayMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: modelText }]);

    } catch (error: any) {
      console.error("Chat Error:", error);
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      
      let userFriendlyMsg: string;
      if (errorMsg.includes('API key') || errorMsg.includes('Incorrect API key') || errorMsg.includes('401')) {
        userFriendlyMsg = "⚠️ Invalid API key. Check that OPENAI_API_KEY is correct in your Vercel Environment Variables.";
      } else if (errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
        userFriendlyMsg = "⚠️ Rate limit or quota exceeded. Please wait a moment and try again, or check your OpenAI billing.";
      } else if (errorMsg.includes('model') || errorMsg.includes('404')) {
        userFriendlyMsg = `⚠️ Model "${AI_MODEL}" not available on your account. Check your OpenAI plan.`;
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch')) {
        userFriendlyMsg = "⚠️ Network error. Check your internet connection and try again.";
      } else {
        userFriendlyMsg = `⚠️ AI error: ${errorMsg}`;
      }
      
      setDisplayMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: userFriendlyMsg, isError: true }]);
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
                          {aiStatus === 'connected' ? 'GPT-5.2 Online' : 
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
            {displayMessages.map((msg) => (
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
                  Set OPENAI_API_KEY in Vercel → Settings → Environment Variables → Redeploy
                </p>
              </div>
            )}
        </div>
    </div>
  );
};

export default AIChatPanel;
