
import React, { useState } from 'react';
import { Client, AISummaryResponse } from '../types';
import { generateClientSummary, generateFollowUpMessage } from '../services/geminiService';
import { ArrowLeft, Sparkles, MessageSquare, History, Phone, Mail, Send, Check } from 'lucide-react';

interface ClientProfileProps {
  client: Client;
  onBack: () => void;
  onUpdateClient: (client: Client) => void;
}

const ClientProfile: React.FC<ClientProfileProps> = ({ client, onBack, onUpdateClient }) => {
  const [aiSummary, setAiSummary] = useState<AISummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState<string>('');
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes'>('overview');
  const [newNote, setNewNote] = useState('');
  
  // SMS Sending State
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const handleGenerateSummary = async () => {
    setLoadingSummary(true);
    const result = await generateClientSummary(client);
    setAiSummary(result);
    setLoadingSummary(false);
  };

  const handleDraftFollowUp = async () => {
    setLoadingDraft(true);
    // Generate follow-up message (service and notes would come from last appointment in real implementation)
    const msg = await generateFollowUpMessage(client.name, "Service", "Appointment notes");
    setFollowUpDraft(msg);
    setLoadingDraft(false);
    setSmsSent(false); // Reset sent state if new draft
  };

  const handleSendSMS = () => {
      if (!followUpDraft) return;
      setIsSendingSMS(true);
      setTimeout(() => {
          setIsSendingSMS(false);
          setSmsSent(true);
          // Optional: Clear draft after delay? Keeping it for reference for now.
      }, 1500);
  };

  const handleAddNote = () => {
      if (!newNote.trim()) return;
      
      const dateStr = new Date().toISOString().split('T')[0];
      const noteEntry = `${dateStr}: ${newNote}`;
      
      const updatedClient = {
          ...client,
          notes: [noteEntry, ...client.notes]
      };
      
      onUpdateClient(updatedClient);
      setNewNote('');
  };

  return (
    <div className="bg-black min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-black/95 backdrop-blur-md sticky top-0 z-10 px-8 py-6 flex items-center gap-6">
        <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-sm transition-colors text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white uppercase tracking-wider">{client.name}</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">ID: {client.id.toUpperCase()} // Since 2023</p>
        </div>
        <button className="px-6 py-3 border border-zinc-700 text-white hover:border-white transition-colors text-xs font-bold uppercase tracking-widest">
          Edit Data
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Info */}
        <div className="space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 p-8">
            <div className="w-24 h-24 bg-zinc-800 border border-zinc-700 mx-auto mb-6 flex items-center justify-center text-4xl font-bold text-white">
              {client.name.charAt(0)}
            </div>
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <Mail className="w-4 h-4 text-orange-600" /> {client.email}
              </div>
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <Phone className="w-4 h-4 text-orange-600" /> <span className="font-mono">{client.phone}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-6">
            <h3 className="font-bold text-white uppercase tracking-wider mb-4 text-xs text-zinc-500">Known Preferences</h3>
            <p className="text-white italic leading-relaxed">"{client.preferences}"</p>
          </div>
        </div>

        {/* Center/Right: Activity & AI */}
        <div className="md:col-span-2 space-y-8">
          
          {/* AI Section */}
          <div className="bg-gradient-to-br from-zinc-900 to-black border border-orange-600/30 p-8 relative overflow-hidden">
             {/* Decorative shine */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 blur-[100px] pointer-events-none"></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="flex items-center gap-3 font-bold text-white text-xl uppercase tracking-wider">
                <Sparkles className="w-5 h-5 text-orange-600" /> Halo Insights
              </h2>
              <button 
                onClick={handleGenerateSummary}
                disabled={loadingSummary}
                className="text-xs font-bold uppercase tracking-widest text-orange-600 hover:text-white transition-colors disabled:opacity-50"
              >
                {loadingSummary ? 'PROCESSING...' : 'ANALYZE HISTORY'}
              </button>
            </div>

            {!aiSummary ? (
               <div className="text-center py-8 border border-dashed border-zinc-800 text-zinc-500 text-sm">
                 <p className="uppercase tracking-wide">No analysis generated yet.</p>
               </div>
            ) : (
              <div className="space-y-6 animate-fade-in relative z-10">
                <div className="bg-zinc-800/50 p-6 border-l-2 border-orange-600">
                  <p className="text-zinc-200 leading-relaxed font-medium">"{aiSummary.summary}"</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-zinc-500 tracking-widest mb-3">Key Topics</h4>
                    <ul className="list-square list-inside text-sm text-zinc-300 space-y-2 marker:text-orange-600">
                      {aiSummary.keyTopics.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-zinc-500 tracking-widest mb-3">Talking Points</h4>
                    <ul className="list-square list-inside text-sm text-zinc-300 space-y-2 marker:text-orange-600">
                      {aiSummary.suggestedTalkingPoints.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-zinc-800 flex gap-8">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-zinc-500 hover:text-white'}`}
            >
              History & Notes
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'notes' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-zinc-500 hover:text-white'}`}
            >
              Follow-up Action
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
               {/* New Note Input */}
               <div className="flex gap-4 items-start bg-zinc-900 p-4 border border-zinc-800">
                 <textarea 
                    className="w-full bg-transparent border-none text-white focus:ring-0 outline-none text-sm resize-none placeholder-zinc-600"
                    rows={2}
                    placeholder="LOG NEW VISIT DETAILS..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                 />
                 <button 
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="p-3 bg-white text-black hover:bg-zinc-200 transition-colors disabled:opacity-50"
                 >
                    <Send className="w-4 h-4" />
                 </button>
               </div>

              <div className="space-y-4">
                {client.notes.length > 0 ? client.notes.map((note, idx) => (
                  <div key={idx} className="flex gap-6 p-6 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <History className="w-5 h-5 text-zinc-600 flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-zinc-300 text-sm leading-relaxed">{note.includes(':') ? note.split(':')[1] : note}</p>
                      <p className="text-xs font-mono text-zinc-500 mt-2 uppercase">{note.includes(':') ? note.split(':')[0] : 'Previous visit'}</p>
                    </div>
                  </div>
                )) : (
                    <div className="text-center py-8 text-zinc-500 uppercase tracking-widest text-xs">
                        No notes recorded yet.
                    </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
             <div className="space-y-6">
               <div className="bg-zinc-900 p-8 border border-zinc-800">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-3 uppercase tracking-wider text-sm">
                    <MessageSquare className="w-4 h-4 text-orange-600" />
                    Draft SMS Follow-up
                  </h3>
                  <p className="text-xs text-zinc-500 mb-6 uppercase tracking-wide">AI-Generated based on last visit context.</p>
                  
                  {loadingDraft ? (
                    <div className="h-32 bg-zinc-800 animate-pulse border border-zinc-700"></div>
                  ) : (
                    <textarea 
                        className="w-full p-6 bg-black border border-zinc-700 focus:border-orange-600 outline-none text-sm text-zinc-300 font-mono"
                        rows={4}
                        value={followUpDraft}
                        placeholder="AWAITING GENERATION..."
                        onChange={(e) => setFollowUpDraft(e.target.value)}
                    />
                  )}
                  
                  <div className="flex justify-end gap-4 mt-6">
                    <button 
                        onClick={handleDraftFollowUp}
                        disabled={loadingDraft || isSendingSMS}
                        className="px-6 py-3 border border-zinc-700 text-white font-bold uppercase text-xs tracking-widest hover:border-white transition-colors disabled:opacity-50"
                    >
                        Generate Draft
                    </button>
                    <button 
                        onClick={handleSendSMS}
                        disabled={!followUpDraft || isSendingSMS || smsSent}
                        className={`px-6 py-3 font-bold uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${
                            smsSent 
                            ? 'bg-green-600 text-white' 
                            : 'bg-orange-600 text-black hover:bg-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isSendingSMS ? (
                             'Sending...'
                        ) : smsSent ? (
                             <><Check className="w-4 h-4" /> Sent</>
                        ) : (
                             <><Send className="w-4 h-4" /> Send SMS</>
                        )}
                    </button>
                  </div>
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientProfile;
