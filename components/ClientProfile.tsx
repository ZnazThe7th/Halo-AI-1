
import React, { useState } from 'react';
import { Client, AISummaryResponse, Appointment, BusinessProfile, AppointmentStatus, ClientRating } from '../types';
import { generateClientSummary, generateFollowUpMessage } from '../services/geminiService';
import { ArrowLeft, Sparkles, MessageSquare, History, Phone, Mail, Send, Check, Star, Calendar } from 'lucide-react';
import { formatTime } from '../constants';

interface ClientProfileProps {
  client: Client;
  appointments: Appointment[];
  business: BusinessProfile;
  onBack: () => void;
  onUpdateClient: (client: Client) => void;
  onAddRating: (rating: ClientRating) => void;
}

const ClientProfile: React.FC<ClientProfileProps> = ({ client, appointments, business, onBack, onUpdateClient, onAddRating }) => {
  const [aiSummary, setAiSummary] = useState<AISummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState<string>('');
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'appointments'>('overview');
  const [newNote, setNewNote] = useState('');
  
  // Email Sending State
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Get client's appointments
  const clientAppointments = appointments
    .filter(a => a.clientId === client.id)
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.time.localeCompare(a.time);
    });

  const completedAppointments = clientAppointments.filter(a => a.status === AppointmentStatus.COMPLETED);
  const unratedAppointments = completedAppointments.filter(a => !a.rating);

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
    setEmailSent(false); // Reset sent state if new draft
  };

  const handleSendEmail = async () => {
    if (!followUpDraft || !client.email) return;
    setIsSendingEmail(true);
    
    try {
      const { sendEmail, generateFollowUpEmailHTML } = await import('../services/emailService');
      const emailSent = await sendEmail({
        to: client.email,
        subject: `Follow-up from ${business.name}`,
        html: generateFollowUpEmailHTML(
          client.name,
          business.name,
          followUpDraft,
          business.email
        )
      });

      if (emailSent) {
        setEmailSent(true);
        console.log(`Follow-up email sent to ${client.email}`);
      } else {
        alert('Failed to send email. Please check your email service configuration.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Error sending email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
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
              onClick={() => setActiveTab('appointments')}
              className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'appointments' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-zinc-500 hover:text-white'}`}
            >
              Appointments
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

          {activeTab === 'appointments' && (
            <div className="space-y-4">
              {unratedAppointments.length > 0 && (
                <div className="bg-blue-600/10 border border-blue-600/30 p-4 mb-6">
                  <p className="text-sm text-blue-500 uppercase tracking-wider font-bold mb-2">
                    {unratedAppointments.length} Appointment{unratedAppointments.length !== 1 ? 's' : ''} Awaiting Rating
                  </p>
                  <p className="text-xs text-zinc-400">Rating emails have been sent to the client. They can rate via the email link.</p>
                </div>
              )}

              {clientAppointments.length > 0 ? (
                <div className="space-y-3">
                  {clientAppointments.map((appt) => {
                    const service = business.services.find(s => s.id === appt.serviceId);
                    const staff = appt.staffId ? business.staff?.find(s => s.id === appt.staffId) : undefined;
                    
                    return (
                      <div key={appt.id} className="bg-zinc-900 border border-zinc-800 p-4 hover:border-zinc-700 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Calendar className="w-4 h-4 text-zinc-500" />
                              <span className="text-white font-bold">{appt.date}</span>
                              <span className="text-zinc-500 text-sm">{formatTime(appt.time)}</span>
                              <span className={`text-xs px-2 py-1 uppercase tracking-wider font-bold ${
                                appt.status === AppointmentStatus.COMPLETED ? 'bg-green-600/20 text-green-500 border border-green-600/30' :
                                appt.status === AppointmentStatus.CONFIRMED ? 'bg-blue-600/20 text-blue-500 border border-blue-600/30' :
                                'bg-yellow-600/20 text-yellow-500 border border-yellow-600/30'
                              }`}>
                                {appt.status}
                              </span>
                            </div>
                            <p className="text-zinc-300 text-sm mb-1">{service?.name || 'Service'}</p>
                            {staff && (
                              <p className="text-zinc-500 text-xs">Staff: {staff.name}</p>
                            )}
                            {appt.rating && (
                              <div className="flex items-center gap-2 mt-2">
                                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                <span className="text-xs text-zinc-400">
                                  {appt.rating.businessRating && `Business: ${appt.rating.businessRating}/5`}
                                  {appt.rating.businessRating && appt.rating.staffRating && ' • '}
                                  {appt.rating.staffRating && `Staff: ${appt.rating.staffRating}/5`}
                                </span>
                              </div>
                            )}
                          </div>
                          {appt.status === AppointmentStatus.COMPLETED && !appt.rating && (
                            <div className="text-xs text-zinc-500 italic">
                              Rating email sent
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 uppercase tracking-widest text-xs">
                  No appointments yet.
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
             <div className="space-y-6">
               <div className="bg-zinc-900 p-8 border border-zinc-800">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-3 uppercase tracking-wider text-sm">
                    <MessageSquare className="w-4 h-4 text-orange-600" />
                    Draft Email Follow-up
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
                  
                  {!client.email && (
                    <p className="text-xs text-orange-500 mt-2">⚠️ Client email is required to send follow-up email.</p>
                  )}
                  
                  <div className="flex justify-end gap-4 mt-6">
                    <button 
                        onClick={handleDraftFollowUp}
                        disabled={loadingDraft || isSendingEmail}
                        className="px-6 py-3 border border-zinc-700 text-white font-bold uppercase text-xs tracking-widest hover:border-white transition-colors disabled:opacity-50"
                    >
                        Generate Draft
                    </button>
                    <button 
                        onClick={handleSendEmail}
                        disabled={!followUpDraft || !client.email || isSendingEmail || emailSent}
                        className={`px-6 py-3 font-bold uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${
                            emailSent 
                            ? 'bg-green-600 text-white' 
                            : 'bg-orange-600 text-black hover:bg-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isSendingEmail ? (
                             'Sending...'
                        ) : emailSent ? (
                             <><Check className="w-4 h-4" /> Sent</>
                        ) : (
                             <><Send className="w-4 h-4" /> Send Email</>
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
