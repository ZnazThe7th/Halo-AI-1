
import React, { useState, useEffect } from 'react';
import { ViewState, Client, BusinessProfile, Appointment, Expense } from './types';
import { DEFAULT_BUSINESS } from './constants';
import Dashboard from './components/Dashboard';
import BookingForm from './components/BookingForm';
import ClientProfile from './components/ClientProfile';
import CalendarView from './components/CalendarView';
import SettingsView from './components/SettingsView';
import ClientList from './components/ClientList';
import MyBusinessView from './components/MyBusinessView';
import LoginView from './components/LoginView';
import OnboardingTutorial from './components/OnboardingTutorial';
import AIChatPanel from './components/AIChatPanel'; // Import Chat Panel
import { LayoutDashboard, Users, Calendar as CalendarIcon, Settings, Link, Briefcase, Moon, Sun, MessageSquare, Sparkles, Globe, Copy, Check, LogIn, LogOut, User } from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // App State
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Apply Theme Effect
  useEffect(() => {
    if (businessProfile.themePreference === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [businessProfile.themePreference]);

  // Handlers
  const handleLogin = () => {
    setIsAuthenticated(true);
    setShowOnboarding(false);
  };

  const handleSignup = (name: string, businessName: string, email: string) => {
      // Create new profile based on sign up info
      const newProfile: BusinessProfile = {
          ...DEFAULT_BUSINESS,
          ownerName: name,
          name: businessName,
          email: email,
      };
      
      setBusinessProfile(newProfile);
      setAppointments([]);
      setClients([]);
      setExpenses([]);

      setIsAuthenticated(true);
      setShowOnboarding(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentView(ViewState.DASHBOARD); // Reset view on logout
  };

  const handleUpdateBusiness = (updatedProfile: BusinessProfile) => {
    setBusinessProfile(updatedProfile);
  };

  const handleAddClient = (newClient: Client) => {
    setClients([...clients, newClient]);
  };

  const handleUpdateClient = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    if (selectedClient && selectedClient.id === updatedClient.id) {
        setSelectedClient(updatedClient);
    }
  };

  const handleRemoveClient = (clientId: string) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
  };

  const handleUpdateAppointment = (updatedAppt: Appointment) => {
    setAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));
  };

  const handleAddAppointment = (newAppt: Appointment) => {
    setAppointments(prev => [...prev, newAppt]);
  };

  const handleRemoveAppointment = (appointmentId: string) => {
    setAppointments(prev => prev.filter(a => a.id !== appointmentId));
  };

  const handleAddExpense = (newExpense: Expense) => {
    setExpenses([...expenses, newExpense]);
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const handlePublicBooking = (newAppt: Appointment, newClient: Client) => {
      // 1. Check if client exists by email
      const existingClient = clients.find(c => c.email.toLowerCase() === newClient.email.toLowerCase());
      
      if (existingClient) {
          // Link appointment to existing client
          newAppt.clientId = existingClient.id;
          newAppt.clientName = existingClient.name;
          setAppointments(prev => [...prev, newAppt]);
      } else {
          // Add new client and appointment
          setClients(prev => [...prev, newClient]);
          setAppointments(prev => [...prev, newAppt]);
      }
  };

  const handleCopyLink = () => {
      // Simulate copying a real URL
      const mockUrl = `https://halo.app/book/${businessProfile.name.toLowerCase().replace(/\s+/g, '-')}`;
      navigator.clipboard.writeText(mockUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
  };

  // State for login modal
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 1. Check for Public View first (Booking Form) - accessible without auth
  if (currentView === ViewState.BOOKING_PUBLIC) {
      return (
        <BookingForm 
            business={businessProfile} 
            onBackToAdmin={() => setCurrentView(ViewState.DASHBOARD)} 
            onBookAppointment={handlePublicBooking}
        />
      );
  }

  // Simple Router Switch for Authenticated Views
  const renderContent = () => {
    switch (currentView) {
      case ViewState.CALENDAR:
        return <CalendarView 
            appointments={appointments} 
            business={businessProfile} 
            onUpdateAppointment={handleUpdateAppointment}
            onAddAppointment={handleAddAppointment}
        />;

      case ViewState.SETTINGS:
        return <SettingsView 
          business={businessProfile} 
          onUpdate={handleUpdateBusiness} 
          onLogout={handleLogout}
        />;

      case ViewState.MY_BUSINESS:
        return <MyBusinessView 
            business={businessProfile} 
            appointments={appointments} 
            expenses={expenses}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onUpdateBusiness={handleUpdateBusiness}
        />;

      case ViewState.CLIENTS:
        if (selectedClient) {
            return (
                <ClientProfile 
                    client={selectedClient} 
                    onBack={() => setSelectedClient(null)} 
                    onUpdateClient={handleUpdateClient}
                />
            );
        }
        return (
            <ClientList 
                clients={clients} 
                onSelectClient={setSelectedClient}
                onAddClient={handleAddClient}
                onRemoveClient={handleRemoveClient}
            />
        );

      case ViewState.DASHBOARD:
      default:
        return <Dashboard 
            business={businessProfile} 
            appointments={appointments} 
            onViewAllAppointments={() => setCurrentView(ViewState.CLIENTS)} 
            onUpdateAppointment={handleUpdateAppointment}
            onRemoveAppointment={handleRemoveAppointment}
            onNavigateToCalendar={() => setCurrentView(ViewState.CALENDAR)}
        />;
    }
  };

  // Admin Layout (Only renders if authenticated)
  return (
    <div className="min-h-screen flex font-sans text-zinc-900 dark:text-white bg-zinc-50 dark:bg-black transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-20 lg:w-72 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed h-full z-20 transition-all duration-300">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 flex items-center justify-center font-bold text-xl text-black rounded-sm overflow-hidden">
             {businessProfile.avatarUrl ? (
                 <img src={businessProfile.avatarUrl} alt="Logo" className="w-full h-full object-cover" />
             ) : (
                 "H"
             )}
          </div>
          <span className="font-bold text-2xl uppercase tracking-widest hidden lg:block dark:text-white text-zinc-900">Halo</span>
        </div>

        <nav className="flex-1 mt-8 px-4 space-y-2">
          <button 
            onClick={() => setCurrentView(ViewState.DASHBOARD)}
            className={`w-full flex items-center gap-4 p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.DASHBOARD ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="hidden lg:block font-medium uppercase tracking-wide text-sm">Dashboard</span>
          </button>
          
          <button 
            onClick={() => { setSelectedClient(null); setCurrentView(ViewState.CLIENTS); }}
            className={`w-full flex items-center gap-4 p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.CLIENTS ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <Users className="w-5 h-5" />
            <span className="hidden lg:block font-medium uppercase tracking-wide text-sm">Clients</span>
          </button>

          <button 
            onClick={() => setCurrentView(ViewState.CALENDAR)}
            className={`w-full flex items-center gap-4 p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.CALENDAR ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <CalendarIcon className="w-5 h-5" />
            <span className="hidden lg:block font-medium uppercase tracking-wide text-sm">Calendar</span>
          </button>
          
          <button 
            onClick={() => setCurrentView(ViewState.MY_BUSINESS)}
            className={`w-full flex items-center gap-4 p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.MY_BUSINESS ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <Briefcase className="w-5 h-5" />
            <span className="hidden lg:block font-medium uppercase tracking-wide text-sm">My Business</span>
          </button>

          <button 
            onClick={() => setCurrentView(ViewState.SETTINGS)}
            className={`w-full flex items-center gap-4 p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.SETTINGS ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <Settings className="w-5 h-5" />
            <span className="hidden lg:block font-medium uppercase tracking-wide text-sm">Settings</span>
          </button>
        </nav>

        {/* Public Booking Actions */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
             <button 
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 bg-zinc-800 dark:bg-zinc-900 text-white hover:bg-zinc-700 transition-colors uppercase font-bold text-xs tracking-widest border border-zinc-700 relative overflow-hidden group"
             >
                {linkCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                <span className="hidden lg:block">{linkCopied ? 'Copied' : 'Copy Booking Link'}</span>
                {linkCopied && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-green-500"></div>}
            </button>
             <button 
                onClick={() => setCurrentView(ViewState.BOOKING_PUBLIC)}
                className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 bg-orange-600 text-black hover:bg-white transition-colors uppercase font-bold text-xs tracking-widest shadow-lg"
             >
                <Globe className="w-4 h-4" />
                <span className="hidden lg:block">Preview Page</span>
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-20 lg:ml-72 bg-zinc-50 dark:bg-black min-h-screen relative overflow-auto transition-colors duration-300">
         {/* Background accent element */}
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-600/5 blur-[150px] pointer-events-none"></div>
         
         {/* Top Right Sign In/Out Button */}
         <div className="absolute top-4 right-4 z-30">
           {isAuthenticated ? (
             <div className="flex items-center gap-3">
               {businessProfile.email && (
                 <span className="hidden md:block text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                   {businessProfile.email}
                 </span>
               )}
               <button
                 onClick={handleLogout}
                 className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors uppercase text-xs font-bold tracking-widest border border-zinc-700"
               >
                 <LogOut className="w-4 h-4" />
                 <span>Sign Out</span>
               </button>
             </div>
           ) : (
             <button
               onClick={() => setShowLoginModal(true)}
               className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-black hover:bg-white transition-colors uppercase text-xs font-bold tracking-widest shadow-lg"
             >
               <LogIn className="w-4 h-4" />
               <span>Sign In</span>
             </button>
           )}
         </div>

        {renderContent()}
      </main>

      {/* Floating AI Chat Button */}
      {!isChatOpen && (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-orange-600 hover:bg-white text-black transition-all duration-300 shadow-[0_0_20px_rgba(234,88,12,0.4)] flex items-center justify-center rounded-full group animate-bounce-slow"
          >
            <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          </button>
      )}

      {/* AI Chat Panel */}
      <AIChatPanel 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        business={businessProfile}
        clients={clients}
        appointments={appointments}
        onAddClient={handleAddClient}
        onAddAppointment={handleAddAppointment}
      />

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-orange-600 transition-colors text-sm uppercase tracking-widest font-bold z-10"
            >
              Close
            </button>
            <div className="relative">
              <LoginView 
                onLogin={() => {
                  handleLogin();
                  setShowLoginModal(false);
                }} 
                onSignup={(name, businessName, email) => {
                  handleSignup(name, businessName, email);
                  setShowLoginModal(false);
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;