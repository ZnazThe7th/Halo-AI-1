import React, { useState } from 'react';
import { Client, BusinessProfile } from '../types';
import { Search, Plus, X, ChevronRight, User, Mail, Phone, Trash2, Copy, Check, Globe } from 'lucide-react';

interface ClientListProps {
  clients: Client[];
  onSelectClient: (client: Client) => void;
  onAddClient: (client: Client) => void;
  onRemoveClient: (clientId: string) => void;
  business: BusinessProfile;
  onCopyLink: () => void;
  linkCopied: boolean;
  isAuthenticated: boolean;
}

const ClientList: React.FC<ClientListProps> = ({ clients, onSelectClient, onAddClient, onRemoveClient, business, onCopyLink, linkCopied, isAuthenticated }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveClient = () => {
    if (!newClient.name) return;
    
    const client: Client = {
      id: Math.random().toString(36).substr(2, 9),
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone,
      notes: [],
      preferences: 'No preference set yet.',
      lastVisit: null
    };

    onAddClient(client);
    setIsAddModalOpen(false);
    setNewClient({ name: '', email: '', phone: '' });
  };

  const handleDeleteClick = (e: React.MouseEvent, clientId: string) => {
      e.stopPropagation();
      if (window.confirm('Are you sure you want to remove this client? This cannot be undone.')) {
          onRemoveClient(clientId);
      }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 lg:mb-10 border-b border-zinc-800 pb-4 lg:pb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4 lg:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white uppercase tracking-wider mb-2">Client Roster</h1>
          <p className="text-zinc-500">Manage your relationships and history.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => {
              if (!isAuthenticated) {
                alert('Please sign in to copy the booking link.');
                return;
              }
              onCopyLink();
            }}
            disabled={!isAuthenticated}
            className={`bg-zinc-800 dark:bg-zinc-900 text-white hover:bg-zinc-700 transition-colors uppercase font-bold text-xs tracking-widest border border-zinc-700 relative overflow-hidden group px-4 py-3 flex items-center justify-center gap-2 ${
              !isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {linkCopied ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> : <Copy className="w-4 h-4 flex-shrink-0" />}
            <span>{linkCopied ? 'Copied' : 'Copy Booking Link'}</span>
            {linkCopied && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-green-500"></div>}
          </button>
          <button 
            onClick={() => {
              if (!isAuthenticated) {
                alert('Please sign in to add clients.');
                return;
              }
              setIsAddModalOpen(true);
            }}
            disabled={!isAuthenticated}
            className={`bg-orange-600 text-black px-6 py-3 font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center gap-2 ${
              !isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="SEARCH CLIENTS..." 
            className="w-full bg-zinc-900 border border-zinc-800 pl-12 pr-4 py-4 text-white placeholder-zinc-600 focus:border-orange-600 outline-none uppercase tracking-wide text-sm font-bold"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
      </div>

      <div className="bg-zinc-900 border border-zinc-800">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-black border-b border-zinc-800">
                    <tr>
                        <th className="p-3 sm:p-4 lg:p-6 text-xs font-bold uppercase tracking-widest text-zinc-500">Name</th>
                        <th className="p-3 sm:p-4 lg:p-6 text-xs font-bold uppercase tracking-widest text-zinc-500 hidden sm:table-cell">Contact</th>
                        <th className="p-3 sm:p-4 lg:p-6 text-xs font-bold uppercase tracking-widest text-zinc-500 hidden md:table-cell">Last Visit</th>
                        <th className="p-3 sm:p-4 lg:p-6 text-xs font-bold uppercase tracking-widest text-zinc-500">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                    {filteredClients.length > 0 ? filteredClients.map(client => (
                        <tr key={client.id} className="hover:bg-zinc-800/50 transition-colors group">
                            <td className="p-3 sm:p-4 lg:p-6 font-medium text-white text-base sm:text-lg flex items-center gap-2 sm:gap-3">
                                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 font-bold text-xs border border-zinc-700 flex-shrink-0">
                                    {client.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate">{client.name}</div>
                                  <div className="text-xs text-zinc-500 sm:hidden mt-1">{client.email}</div>
                                </div>
                            </td>
                            <td className="p-3 sm:p-4 lg:p-6 text-sm text-zinc-400 hidden sm:table-cell">
                                <div className="text-white mb-1 flex items-center gap-2"><Mail className="w-3 h-3 text-zinc-600 flex-shrink-0"/> <span className="truncate">{client.email}</span></div>
                                <div className="text-zinc-500 font-mono flex items-center gap-2"><Phone className="w-3 h-3 text-zinc-600 flex-shrink-0"/> {client.phone}</div>
                            </td>
                            <td className="p-3 sm:p-4 lg:p-6 text-sm text-zinc-400 font-mono hidden md:table-cell">{client.lastVisit || 'N/A'}</td>
                            <td className="p-3 sm:p-4 lg:p-6 flex items-center gap-3 sm:gap-6">
                                <button 
                                    onClick={() => onSelectClient(client)}
                                    className="text-white font-medium text-sm flex items-center gap-2 group-hover:text-orange-500 transition-colors uppercase tracking-wide"
                                >
                                    View Profile <ChevronRight className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteClick(e, client.id)}
                                    className="text-zinc-600 hover:text-red-500 transition-colors p-2"
                                    title="Remove Client"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={4} className="p-12 text-center text-zinc-500 uppercase tracking-widest">
                                No clients found matching your search.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Add Client Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-700 w-full max-w-md shadow-2xl">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                    <h3 className="font-bold text-white uppercase tracking-wider">New Client</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Full Name</label>
                        <input 
                            type="text" 
                            className="w-full bg-zinc-900 border border-zinc-800 p-3 text-white focus:border-orange-600 outline-none"
                            value={newClient.name}
                            onChange={e => setNewClient({...newClient, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Email Address</label>
                        <input 
                            type="email" 
                            className="w-full bg-zinc-900 border border-zinc-800 p-3 text-white focus:border-orange-600 outline-none"
                            value={newClient.email}
                            onChange={e => setNewClient({...newClient, email: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Phone Number</label>
                        <input 
                            type="tel" 
                            className="w-full bg-zinc-900 border border-zinc-800 p-3 text-white focus:border-orange-600 outline-none font-mono"
                            value={newClient.phone}
                            onChange={e => setNewClient({...newClient, phone: e.target.value})}
                        />
                    </div>
                    <button 
                        onClick={handleSaveClient}
                        className="w-full mt-4 bg-orange-600 text-black py-3 font-bold uppercase tracking-widest hover:bg-white transition-colors"
                    >
                        Create Profile
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default ClientList;