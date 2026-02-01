
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, FunctionDeclaration, Type, Chat, GenerateContentResponse } from "@google/genai";
import { X, Send, Sparkles, MessageSquare, Briefcase, User, Calendar, CheckCircle, Loader2 } from 'lucide-react';
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
}

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
  const [messages, setMessages] = useState<ChatMessage[]>([
      { id: '0', role: 'model', text: `Hello ${business.ownerName}. I am Halo AI (v5.2). I can analyze your business, add clients, or manage your calendar. How can I help?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Gemini Instance Ref
  const chatSessionRef = useRef<Chat | null>(null);

  // Initialize Chat Session
  useEffect(() => {
    if (!process.env.API_KEY) return;
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    chatSessionRef.current = ai.chats.create({
      model: 'gemini-3-flash-preview', // Correct model for text chat
      config: {
        systemInstruction: `You are Halo, an advanced AI business operating system for a service business named ${business.name}. 
        You are helpful, professional, and concise. You have access to tools to manage the business.
        Always confirm when an action (like adding a client) is done.
        Current Date: ${new Date().toISOString().split('T')[0]}.`,
        tools: [{ functionDeclarations: [getFinancialStatsTool, addClientTool, bookAppointmentTool] }]
      }
    });
  }, [business.name]);

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
    if (!input.trim() || !chatSessionRef.current) return;

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

    } catch (error) {
        console.error("Chat Error", error);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "I'm having trouble connecting to the neural network right now. Please try again." }]);
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
                <div className="w-8 h-8 bg-orange-600 flex items-center justify-center rounded-sm">
                    <Sparkles className="w-4 h-4 text-black animate-pulse" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider">Halo AI</h3>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        <span className="text-[10px] text-zinc-500 font-mono">GPT-5.2 (Simulated)</span>
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
                    <div className={`max-w-[85%] p-3 text-sm leading-relaxed rounded-sm ${
                        msg.role === 'user' 
                        ? 'bg-zinc-800 text-white border border-zinc-700' 
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
                    placeholder="Ask about revenue, add client, or book..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
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
            <div className="flex justify-center mt-3 gap-3">
                <button onClick={() => setInput("How is my revenue this month?")} className="text-[10px] text-zinc-500 hover:text-orange-500 uppercase tracking-wide border border-zinc-800 px-2 py-1 rounded-sm">Analytics</button>
                <button onClick={() => setInput("Add client John Doe 555-0199")} className="text-[10px] text-zinc-500 hover:text-orange-500 uppercase tracking-wide border border-zinc-800 px-2 py-1 rounded-sm">Add Client</button>
            </div>
        </div>
    </div>
  );
};

export default AIChatPanel;
