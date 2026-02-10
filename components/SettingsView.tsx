
import React, { useState, useEffect } from 'react';
import { BusinessProfile, Service } from '../types';
import { Save, Plus, X, Edit3, Trash2, Store, Clock, DollarSign, Timer, Calculator, Moon, Sun, Camera, Upload, LogOut, Mail, Key, Copy, Check, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';

interface SettingsViewProps {
  business: BusinessProfile;
  onUpdate: (profile: BusinessProfile) => void;
  onLogout: () => void;
  isAuthenticated: boolean;
}

const SettingsView: React.FC<SettingsViewProps> = ({ business, onUpdate, onLogout, isAuthenticated }) => {
  // Modal States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  // AI Integration State
  const [apiKeyPreview, setApiKeyPreview] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [aiKeyError, setAiKeyError] = useState<string | null>(null);

  // Check for existing API key on mount
  useEffect(() => {
    if (isAuthenticated) {
      checkApiKey();
    }
  }, [isAuthenticated]);

  const getApiBase = () => {
    // @ts-ignore
    const viteUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
    return viteUrl || '';
  };

  const checkApiKey = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/ai/keys`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setApiKeyPreview(data.keyPreview);
      }
    } catch { /* ignore if backend unavailable */ }
  };

  const generateApiKey = async () => {
    setIsGeneratingKey(true);
    setAiKeyError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/ai/keys/generate`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate key');
      }
      const data = await res.json();
      setNewApiKey(data.apiKey);
      setApiKeyPreview(`${data.apiKey.slice(0, 10)}...${data.apiKey.slice(-4)}`);
    } catch (err: any) {
      setAiKeyError(err.message || 'Failed to generate API key');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const revokeApiKey = async () => {
    try {
      await fetch(`${getApiBase()}/api/ai/keys`, { method: 'DELETE', credentials: 'include' });
      setApiKeyPreview(null);
      setNewApiKey(null);
    } catch { /* ignore */ }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  // Form States
  const [profileForm, setProfileForm] = useState({
    name: business.name,
    ownerName: business.ownerName,
    email: business.email,
    category: business.category,
    start: business.workingHours.start,
    end: business.workingHours.end,
    taxRate: business.taxRate,
    avatarUrl: business.avatarUrl || ''
  });

  const emptyService: Service = {
    id: '',
    name: '',
    price: 0,
    durationMin: 30,
    description: '',
    pricePerPerson: false
  };
  const [serviceForm, setServiceForm] = useState<Service>(emptyService);

  // Handlers
  const handleSaveProfile = () => {
    onUpdate({
      ...business,
      name: profileForm.name,
      ownerName: profileForm.ownerName,
      email: profileForm.email,
      category: profileForm.category,
      taxRate: Number(profileForm.taxRate),
      workingHours: { start: profileForm.start, end: profileForm.end },
      avatarUrl: profileForm.avatarUrl || undefined
    });
    setIsProfileModalOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setProfileForm(prev => ({ ...prev, avatarUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const toggleTheme = () => {
      const newTheme = business.themePreference === 'dark' ? 'light' : 'dark';
      onUpdate({ ...business, themePreference: newTheme });
  };

  const openEditService = (service: Service) => {
    setServiceForm({ ...service });
    setEditingService(service);
    setIsServiceModalOpen(true);
  };

  const openAddService = () => {
    setServiceForm({ ...emptyService, id: Math.random().toString(36).substr(2, 9) });
    setEditingService(null); // Null implies new
    setIsServiceModalOpen(true);
  };

  const handleSaveService = () => {
    let updatedServices = [...business.services];
    if (editingService) {
      // Update existing
      updatedServices = updatedServices.map(s => s.id === serviceForm.id ? serviceForm : s);
    } else {
      // Add new
      updatedServices.push(serviceForm);
    }
    
    onUpdate({ ...business, services: updatedServices });
    setIsServiceModalOpen(false);
  };

  const handleDeleteService = (id: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      const updatedServices = business.services.filter(s => s.id !== id);
      onUpdate({ ...business, services: updatedServices });
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto pb-20">
      <header className="mb-10 border-b border-zinc-200 dark:border-zinc-800 pb-6 flex justify-between items-end">
        <div>
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-2">Settings</h1>
            <p className="text-zinc-500 mb-2">Manage your business profile and service menu.</p>
            <div className="flex items-center gap-2 text-orange-600 text-xs font-bold uppercase tracking-widest bg-orange-600/10 px-2 py-1 w-fit rounded-sm">
                <Mail className="w-3 h-3" />
                {business.email}
            </div>
        </div>
        
        {/* Appearance Toggle */}
        <div className="flex flex-col items-end">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Appearance</p>
            <button 
                onClick={toggleTheme}
                className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 hover:border-orange-600 dark:hover:border-orange-600 transition-colors"
            >
                {business.themePreference === 'dark' ? (
                    <>
                        <Moon className="w-4 h-4 text-orange-600" />
                        <span className="text-xs font-bold uppercase tracking-wide text-white">Night Mode</span>
                    </>
                ) : (
                    <>
                        <Sun className="w-4 h-4 text-orange-600" />
                        <span className="text-xs font-bold uppercase tracking-wide text-zinc-900">Day Mode</span>
                    </>
                )}
            </button>
        </div>
      </header>

      {/* Business Profile Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-600" /> Public Profile
          </h2>
          <button 
            onClick={() => {
              if (!isAuthenticated) {
                alert('Please sign in to edit your profile.');
                return;
              }
              setProfileForm({
                name: business.name,
                ownerName: business.ownerName,
                email: business.email,
                category: business.category,
                start: business.workingHours.start,
                end: business.workingHours.end,
                taxRate: business.taxRate,
                avatarUrl: business.avatarUrl || ''
              });
              setIsProfileModalOpen(true);
            }}
            disabled={!isAuthenticated}
            className={`text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              !isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Edit3 className="w-4 h-4" /> Edit Profile
          </button>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 relative overflow-hidden group shadow-sm">
           <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-100 dark:bg-zinc-800 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
           
           <div className="flex flex-col md:flex-row gap-8 relative z-10">
              {/* Avatar Display */}
              <div className="flex-shrink-0">
                  <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full flex items-center justify-center overflow-hidden">
                      {business.avatarUrl ? (
                          <img src={business.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                          <Camera className="w-8 h-8 text-zinc-400" />
                      )}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Business Name</p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">{business.name}</p>

                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Owner</p>
                    <p className="text-lg text-zinc-800 dark:text-white">{business.ownerName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Category</p>
                    <p className="text-lg text-zinc-800 dark:text-white mb-6">{business.category}</p>

                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Tax Rate</p>
                    <p className="text-lg text-zinc-800 dark:text-white font-mono flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-orange-600" />
                        {business.taxRate}%
                    </p>
                  </div>
              </div>
           </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" /> Service Menu
          </h2>
          <button 
            onClick={() => {
              if (!isAuthenticated) {
                alert('Please sign in to add services.');
                return;
              }
              openAddService();
            }}
            disabled={!isAuthenticated}
            className={`bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-700 dark:hover:bg-zinc-200 px-4 py-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors shadow-sm ${
              !isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Plus className="w-4 h-4" /> Add Service
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {business.services.map((service) => (
            <div key={service.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-zinc-400 dark:hover:border-zinc-700 transition-all shadow-sm">
               <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white uppercase">{service.name}</h3>
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide rounded-sm flex items-center gap-1">
                        <Timer className="w-3 h-3" /> {service.durationMin} min
                    </span>
                  </div>
                  <p className="text-zinc-500 text-sm">{service.description}</p>
               </div>
               
               <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold text-orange-500 font-mono">${service.price}</span>
                    {service.pricePerPerson && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">per person</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-6">
                      <button onClick={() => openEditService(service)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteService(service.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
               </div>
            </div>
          ))}
          
          {business.services.length === 0 && (
             <div className="text-center p-12 border border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-500 uppercase tracking-widest text-sm">
                 No services listed yet. Add one to start.
             </div>
          )}
        </div>
      </section>

      {/* Account Actions */}
      {isAuthenticated && (
        <section className="border-t border-zinc-200 dark:border-zinc-800 pt-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wide">Account Session</h2>
                    <p className="text-sm text-zinc-500">Sign out of your account on this device.</p>
                </div>
                <button 
                  onClick={onLogout}
                  className="flex items-center gap-2 px-6 py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
                >
                    <LogOut className="w-4 h-4" /> Sign Out
                </button>
            </div>
        </section>
      )}

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 w-full max-w-md shadow-2xl">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                  <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Edit Profile</h3>
                  <button onClick={() => setIsProfileModalOpen(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 space-y-4">
                  {/* Avatar Upload */}
                  <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full flex items-center justify-center overflow-hidden">
                           {profileForm.avatarUrl ? (
                               <img src={profileForm.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                           ) : (
                               <Camera className="w-6 h-6 text-zinc-400" />
                           )}
                      </div>
                      <label className="cursor-pointer bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-900 dark:text-white flex items-center gap-2">
                          <Upload className="w-4 h-4" /> Upload Picture
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Email Address</label>
                    <input type="email" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Business Name</label>
                    <input type="text" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Owner Name</label>
                    <input type="text" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none" value={profileForm.ownerName} onChange={e => setProfileForm({...profileForm, ownerName: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Category</label>
                    <input type="text" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none" value={profileForm.category} onChange={e => setProfileForm({...profileForm, category: e.target.value})} />
                  </div>
                   <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Tax Rate (%)</label>
                    <input type="number" min="0" max="100" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none font-mono" value={profileForm.taxRate} onChange={e => setProfileForm({...profileForm, taxRate: parseFloat(e.target.value)})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Open (HH:MM)</label>
                        <input type="time" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none font-mono" value={profileForm.start} onChange={e => setProfileForm({...profileForm, start: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Close (HH:MM)</label>
                        <input type="time" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none font-mono" value={profileForm.end} onChange={e => setProfileForm({...profileForm, end: e.target.value})} />
                      </div>
                  </div>
                  <button onClick={handleSaveProfile} className="w-full mt-4 bg-zinc-900 dark:bg-white text-white dark:text-black py-3 font-bold uppercase tracking-widest hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors">Save Changes</button>
              </div>
           </div>
        </div>
      )}

      {/* ── AI Integrations Section ── */}
      {isAuthenticated && (
        <section className="mt-10 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-orange-600" />
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wider">AI Integrations</h2>
              <p className="text-xs text-zinc-500 mt-1">Connect ChatGPT, Gemini, Claude, or any AI to manage your business</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* API Key */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">API Key</span>
                </div>
                {apiKeyPreview && (
                  <button
                    onClick={revokeApiKey}
                    className="text-xs text-red-500 hover:text-red-400 font-bold uppercase tracking-wider"
                  >
                    Revoke
                  </button>
                )}
              </div>

              {aiKeyError && (
                <div className="mb-3 p-3 bg-red-900/20 border border-red-800 text-red-400 text-xs rounded-sm">
                  {aiKeyError}
                </div>
              )}

              {newApiKey ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-900/20 border border-emerald-800 text-emerald-400 text-xs rounded-sm">
                    ⚠️ Copy your API key now — it won't be shown again.
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newApiKey}
                      className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-3 text-zinc-900 dark:text-white font-mono text-xs select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(newApiKey)}
                      className="p-3 bg-orange-600 text-black hover:bg-orange-500 transition-colors"
                      title="Copy"
                    >
                      {keyCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => setNewApiKey(null)}
                    className="text-xs text-zinc-500 hover:text-white transition-colors"
                  >
                    Done — I've copied it
                  </button>
                </div>
              ) : apiKeyPreview ? (
                <div className="flex items-center gap-3">
                  <code className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-3 text-zinc-500 font-mono text-xs">
                    {apiKeyPreview}
                  </code>
                  <button
                    onClick={generateApiKey}
                    disabled={isGeneratingKey}
                    className="p-3 bg-zinc-800 text-white hover:bg-zinc-700 transition-colors text-xs"
                    title="Regenerate"
                  >
                    <RefreshCw className={`w-4 h-4 ${isGeneratingKey ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateApiKey}
                  disabled={isGeneratingKey}
                  className="w-full py-3 bg-orange-600 text-black font-bold uppercase tracking-widest text-sm hover:bg-orange-500 transition-colors flex items-center justify-center gap-2"
                >
                  {isGeneratingKey ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Key className="w-4 h-4" /> Generate API Key</>
                  )}
                </button>
              )}
            </div>

            {/* Platform Setup Guides */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Setup Guides</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* ChatGPT */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-orange-600 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🤖</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">ChatGPT</span>
                  </div>
                  <ol className="text-[11px] text-zinc-500 space-y-1 list-decimal list-inside">
                    <li>Open ChatGPT → Create a GPT</li>
                    <li>Go to Actions → Import URL</li>
                    <li>Paste: <code className="text-orange-500 text-[10px]">https://halo-ai-1.vercel.app/.well-known/openapi.json</code></li>
                    <li>Set Auth → API Key → Bearer</li>
                    <li>Paste your Halo API key</li>
                  </ol>
                </div>

                {/* Gemini */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-orange-600 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">✨</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">Gemini</span>
                  </div>
                  <ol className="text-[11px] text-zinc-500 space-y-1 list-decimal list-inside">
                    <li>Use Gemini with Extensions</li>
                    <li>Import the OpenAPI spec URL</li>
                    <li>Configure Bearer auth</li>
                    <li>Use your Halo API key</li>
                  </ol>
                </div>

                {/* Claude */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-orange-600 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🧠</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">Claude</span>
                  </div>
                  <ol className="text-[11px] text-zinc-500 space-y-1 list-decimal list-inside">
                    <li>Clone the repo, <code className="text-orange-500 text-[10px]">cd mcp-server</code></li>
                    <li>Run <code className="text-orange-500 text-[10px]">npm install</code></li>
                    <li>Add to Claude Desktop config</li>
                    <li>Set HALO_API_KEY env var</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Quick Reference */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Available Commands</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="text-orange-600">→</span> "What's on my schedule today?"
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="text-orange-600">→</span> "Book John for Piano at 3pm tomorrow"
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="text-orange-600">→</span> "Show me all my clients"
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="text-orange-600">→</span> "How much have I earned this month?"
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="text-orange-600">→</span> "Mark appointment xyz as completed"
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="text-orange-600">→</span> "Add a new client named Sarah"
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Edit Service Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 w-full max-w-md shadow-2xl">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                  <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider">{editingService ? 'Edit Service' : 'Add New Service'}</h3>
                  <button onClick={() => setIsServiceModalOpen(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Service Name</label>
                    <input type="text" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Description</label>
                    <textarea rows={2} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none resize-none" value={serviceForm.description} onChange={e => setServiceForm({...serviceForm, description: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Price ($)</label>
                        <input type="number" min="0" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none font-mono" value={serviceForm.price} onChange={e => setServiceForm({...serviceForm, price: parseFloat(e.target.value)})} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Duration (Min)</label>
                        <input type="number" step="15" min="15" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-zinc-900 dark:text-white focus:border-orange-600 outline-none font-mono" value={serviceForm.durationMin} onChange={e => setServiceForm({...serviceForm, durationMin: parseInt(e.target.value)})} />
                      </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <input 
                      type="checkbox" 
                      id="pricePerPerson"
                      checked={serviceForm.pricePerPerson || false}
                      onChange={e => setServiceForm({...serviceForm, pricePerPerson: e.target.checked})}
                      className="w-4 h-4 text-orange-600 bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 rounded focus:ring-orange-500"
                    />
                    <label htmlFor="pricePerPerson" className="text-sm text-zinc-900 dark:text-white font-medium cursor-pointer">
                      Price per person (allows multiple clients in same appointment)
                    </label>
                  </div>
                  <button onClick={handleSaveService} className="w-full mt-4 bg-orange-600 text-black py-3 font-bold uppercase tracking-widest hover:bg-orange-500 transition-colors">
                      {editingService ? 'Save Updates' : 'Create Service'}
                  </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default SettingsView;
