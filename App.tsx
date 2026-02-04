
import React, { useState, useEffect } from 'react';
import { ViewState, Client, BusinessProfile, Appointment, Expense, ClientRating } from './types';
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
import HaloLogo from './components/HaloLogo';
import RatingPage from './components/RatingPage';
import { useAuth, getUserEmailFromToken } from './services/authContext';
import { loadUserData, saveUserData, logout as apiLogout } from './services/apiService';
import { LayoutDashboard, Users, Calendar as CalendarIcon, Settings, Link, Briefcase, Moon, Sun, MessageSquare, Sparkles, Globe, Copy, Check, LogIn, LogOut, User, Menu, X as XIcon } from 'lucide-react';

const App: React.FC = () => {
  // Use auth context instead of local state to prevent auth loops
  const { loading: authLoading, isAuthenticated, logout: authLogout, accessToken } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // App State
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ratings, setRatings] = useState<ClientRating[]>([]);

  // Helper function to get storage key based on user email
  const getStorageKey = (email: string | null): string => {
    if (!email || email === DEFAULT_BUSINESS.email) {
      return 'business_data_default'; // Return default key if no email
    }
    // Create a safe key from email (replace special chars)
    const emailKey = email.replace(/[^a-zA-Z0-9]/g, '_');
    return `business_data_${emailKey}`;
  };

  // Track if we've loaded data to prevent overwriting with defaults
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load user data from API when authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && !dataLoaded) {
      const loadData = async () => {
        try {
          const result = await loadUserData();
          
          if (result.error) {
            console.warn('Failed to load data from API:', result.error);
            // Fall back to localStorage if API fails
            const emailFromToken = getUserEmailFromToken(accessToken);
            const email = emailFromToken || businessProfile.email;
            if (email && email !== DEFAULT_BUSINESS.email) {
              const storageKey = getStorageKey(email);
              const saved = localStorage.getItem(storageKey);
              if (saved) {
                const data = JSON.parse(saved);
                if (data.businessProfile) setBusinessProfile(data.businessProfile);
                if (data.clients) setClients(data.clients);
                if (data.appointments) setAppointments(data.appointments);
                if (data.expenses) setExpenses(data.expenses);
                if (data.ratings) setRatings(data.ratings);
              }
            }
          } else if (result.data) {
            // Update business profile email if we got it from token
            const emailFromToken = getUserEmailFromToken(accessToken);
            if (emailFromToken && (!businessProfile.email || businessProfile.email === DEFAULT_BUSINESS.email)) {
              setBusinessProfile(prev => ({ ...prev, email: emailFromToken }));
            }
            
            if (result.data.businessProfile) {
              setBusinessProfile(result.data.businessProfile);
            }
            if (result.data.clients) {
              setClients(result.data.clients);
            }
            if (result.data.appointments) {
              setAppointments(result.data.appointments);
            }
            if (result.data.expenses) {
              setExpenses(result.data.expenses);
            }
            if (result.data.ratings) {
              setRatings(result.data.ratings);
            }
          }
          setDataLoaded(true);
        } catch (error) {
          console.error('Error loading user data:', error);
          setDataLoaded(true); // Mark as loaded even on error to prevent retries
        }
      };
      
      loadData();
    } else if (!isAuthenticated) {
      // Reset dataLoaded when user logs out
      setDataLoaded(false);
    }
  }, [authLoading, isAuthenticated, accessToken, dataLoaded]);

  // Save user data to API whenever it changes (if authenticated)
  // Debounce saves to avoid too many API calls
  useEffect(() => {
    if (isAuthenticated && businessProfile.email && businessProfile.email !== DEFAULT_BUSINESS.email && dataLoaded) {
      // Debounce saves - wait 1 second after last change
      const timeoutId = setTimeout(async () => {
        if (isSaving) return; // Don't save if already saving
        
        setIsSaving(true);
        try {
          const result = await saveUserData({
            businessProfile,
            clients,
            appointments,
            expenses,
            ratings
          });
          
          if (result.error) {
            console.warn('Failed to save data to API:', result.error);
            // Fall back to localStorage if API fails
            const storageKey = getStorageKey(businessProfile.email);
            const dataToSave = {
              businessProfile,
              clients,
              appointments,
              expenses,
              ratings
            };
            localStorage.setItem(storageKey, JSON.stringify(dataToSave));
          }
        } catch (error) {
          console.error('Error saving user data:', error);
          // Fall back to localStorage
          const storageKey = getStorageKey(businessProfile.email);
          const dataToSave = {
            businessProfile,
            clients,
            appointments,
            expenses,
            ratings
          };
          localStorage.setItem(storageKey, JSON.stringify(dataToSave));
        } finally {
          setIsSaving(false);
        }
      }, 1000); // Wait 1 second after last change

      return () => clearTimeout(timeoutId);
    }
  }, [businessProfile, clients, appointments, expenses, ratings, isAuthenticated, dataLoaded, isSaving]);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Check for rating page URL on mount
  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    // Check if we're on a rating page: /rate/:appointmentId?token=...
    if (path.startsWith('/rate/')) {
      const appointmentId = path.split('/rate/')[1]?.split('?')[0];
      const token = params.get('token');
      
      if (appointmentId && token) {
        setCurrentView(ViewState.RATING_PAGE);
      }
    }
  }, []);

  // Apply Theme Effect
  useEffect(() => {
    if (businessProfile.themePreference === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [businessProfile.themePreference]);

  // Handlers
  const handleLogin = async (email?: string) => {
    // Auth state is already set by LoginView via auth context
    // Update business profile email if provided (for email/password sign-in)
    if (email && (!businessProfile.email || businessProfile.email === DEFAULT_BUSINESS.email)) {
      setBusinessProfile(prev => ({ ...prev, email: email }));
      // Data will be loaded by the useEffect that watches isAuthenticated
    }
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
      setRatings([]);
      setDataLoaded(true); // Mark as loaded (new account, no data to load)

      // Auth state is already set by LoginView via auth context
      setShowOnboarding(true);
  };

  const handleLogout = async () => {
    // Logout from API
    try {
      await apiLogout();
    } catch (error) {
      console.error('Error logging out from API:', error);
    }
    
    authLogout(); // Use auth context logout to clear persisted token
    // Reset to default state (data will be loaded when they sign back in)
    setBusinessProfile(DEFAULT_BUSINESS);
    setClients([]);
    setAppointments([]);
    setExpenses([]);
    setRatings([]);
    setDataLoaded(false); // Reset data loaded flag
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

  const handleUpdateAppointment = async (updatedAppt: Appointment) => {
    // Check if appointment was just completed
    const previousAppt = appointments.find(a => a.id === updatedAppt.id);
    const wasJustCompleted = previousAppt?.status !== AppointmentStatus.COMPLETED && 
                             updatedAppt.status === AppointmentStatus.COMPLETED;

    setAppointments(prev => prev.map(a => a.id === updatedAppt.id ? updatedAppt : a));

    // Send rating email if appointment was just completed
    if (wasJustCompleted) {
      const client = clients.find(c => c.id === updatedAppt.clientId);
      if (client && client.email) {
        const service = businessProfile.services.find(s => s.id === updatedAppt.serviceId);
        const ratingLink = `${window.location.origin}/rate/${updatedAppt.id}?token=${encodeURIComponent(btoa(updatedAppt.id + ':' + client.id))}`;
        
        // Import and send email (will be handled asynchronously)
        const { sendEmail, generateRatingEmailHTML } = await import('./services/emailService');
        const { formatTime } = await import('./constants');
        
        const emailSent = await sendEmail({
          to: client.email,
          subject: `Rate Your Experience at ${businessProfile.name}`,
          html: generateRatingEmailHTML(
            client.name,
            businessProfile.name,
            updatedAppt.date,
            formatTime(updatedAppt.time),
            service?.name || 'Service',
            ratingLink
          )
        });

        if (emailSent) {
          console.log(`Rating email sent to ${client.email}`);
        } else {
          console.warn(`Failed to send rating email to ${client.email}`);
        }
      }
    }
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

  const handleAddRating = (rating: Omit<ClientRating, 'id'>) => {
    const newRating: ClientRating = {
      ...rating,
      id: `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    setRatings([...ratings, newRating]);
    // Also update the appointment with the rating
    setAppointments(prev => prev.map(a => 
      a.id === rating.appointmentId 
        ? { ...a, rating: newRating } 
        : a
    ));
  };

  const handlePublicBooking = (newAppt: Appointment, newClients: Client[]) => {
      // Handle all clients (single or multiple)
      const clientsToAdd: Client[] = [];
      const clientIdMap: { [email: string]: string } = {}; // Map email to existing client ID
      
      // Check each client and either use existing or add new
      newClients.forEach(client => {
        const existingClient = clients.find(c => c.email.toLowerCase() === client.email.toLowerCase());
        if (existingClient) {
          clientIdMap[client.email.toLowerCase()] = existingClient.id;
        } else {
          clientsToAdd.push(client);
          clientIdMap[client.email.toLowerCase()] = client.id;
        }
      });
      
      // Update appointment client IDs if they don't match existing clients
      if (newAppt.clientIds) {
        newAppt.clientIds = newAppt.clientIds.map((id, idx) => {
          const clientEmail = newClients[idx]?.email.toLowerCase();
          return clientIdMap[clientEmail] || id;
        });
        newAppt.clientNames = newAppt.clientIds.map(id => {
          const client = [...clients, ...clientsToAdd].find(c => c.id === id);
          return client?.name || '';
        });
      }
      
      // Set primary client for backward compatibility
      newAppt.clientId = newAppt.clientIds?.[0] || newClients[0].id;
      newAppt.clientName = newAppt.clientNames?.[0] || newClients[0].name;
      
      // Add new clients and appointment
      if (clientsToAdd.length > 0) {
        setClients(prev => [...prev, ...clientsToAdd]);
      }
      setAppointments(prev => [...prev, newAppt]);
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

  // Close login modal when user becomes authenticated (only after loading is complete)
  // This prevents closing the modal while auth state is still being restored
  useEffect(() => {
    if (!authLoading && isAuthenticated && showLoginModal) {
      setShowLoginModal(false);
    }
  }, [authLoading, isAuthenticated, showLoginModal]);

  // 1. Check for Rating Page - accessible without auth
  if (currentView === ViewState.RATING_PAGE) {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const appointmentId = path.split('/rate/')[1]?.split('?')[0] || '';
    const token = params.get('token') || '';
    
    const appointment = appointments.find(a => a.id === appointmentId);
    const client = appointment ? clients.find(c => c.id === appointment.clientId) : undefined;
    
    return (
      <RatingPage
        appointmentId={appointmentId}
        token={token}
        appointment={appointment}
        client={client}
        business={businessProfile}
        onSubmitRating={handleAddRating}
      />
    );
  }

  // 2. Check for Public View (Booking Form) - accessible without auth
  if (currentView === ViewState.BOOKING_PUBLIC) {
      return (
        <BookingForm 
            business={businessProfile} 
            onBackToAdmin={() => setCurrentView(ViewState.DASHBOARD)} 
            onBookAppointment={handlePublicBooking}
        />
      );
  }

  // 3. Show loading state while auth is being restored (prevents redirect loops)
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-sm">Authenticating...</p>
        </div>
      </div>
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
          isAuthenticated={isAuthenticated}
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
                    appointments={appointments}
                    business={businessProfile}
                    onBack={() => setSelectedClient(null)} 
                    onUpdateClient={handleUpdateClient}
                    onAddRating={handleAddRating}
                />
            );
        }
        return (
            <ClientList 
                clients={clients} 
                onSelectClient={setSelectedClient}
                onAddClient={handleAddClient}
                onRemoveClient={handleRemoveClient}
                business={businessProfile}
                onCopyLink={handleCopyLink}
                linkCopied={linkCopied}
                isAuthenticated={isAuthenticated}
            />
        );

      case ViewState.DASHBOARD:
      default:
        return <Dashboard 
            business={businessProfile} 
            appointments={appointments}
            ratings={ratings}
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
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-72 lg:w-72 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed h-full z-30 transition-all duration-300 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-4 lg:p-8 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setCurrentView(ViewState.DASHBOARD);
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {businessProfile.avatarUrl ? (
              <img src={businessProfile.avatarUrl} alt="Logo" className="w-10 h-10 rounded-sm object-cover" />
            ) : (
              <div className="w-10 h-10 flex items-center justify-center bg-orange-600 rounded-sm">
                <HaloLogo size={40} className="flex-shrink-0" />
              </div>
            )}
            <span className="font-bold text-2xl uppercase tracking-widest hidden lg:block dark:text-white text-zinc-900">Halo</span>
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 mt-4 lg:mt-8 px-2 lg:px-4 space-y-1 lg:space-y-2">
          <button 
            onClick={() => {
              setCurrentView(ViewState.DASHBOARD);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 lg:gap-4 p-3 lg:p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.DASHBOARD ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium uppercase tracking-wide text-sm">Dashboard</span>
          </button>
          
          <button 
            onClick={() => {
              setSelectedClient(null);
              setCurrentView(ViewState.CLIENTS);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 lg:gap-4 p-3 lg:p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.CLIENTS ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium uppercase tracking-wide text-sm">Clients</span>
          </button>

          <button 
            onClick={() => {
              setCurrentView(ViewState.CALENDAR);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 lg:gap-4 p-3 lg:p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.CALENDAR ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <CalendarIcon className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium uppercase tracking-wide text-sm">Calendar</span>
          </button>
          
          <button 
            onClick={() => {
              setCurrentView(ViewState.MY_BUSINESS);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 lg:gap-4 p-3 lg:p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.MY_BUSINESS ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <Briefcase className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium uppercase tracking-wide text-sm">My Business</span>
          </button>

          <button 
            onClick={() => {
              setCurrentView(ViewState.SETTINGS);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 lg:gap-4 p-3 lg:p-4 transition-all duration-200 border-l-2 ${currentView === ViewState.SETTINGS ? 'border-orange-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium uppercase tracking-wide text-sm">Settings</span>
          </button>
        </nav>

        {/* Public Booking Actions */}
        <div className="p-4 lg:p-6 border-t border-zinc-200 dark:border-zinc-800 space-y-2 lg:space-y-3">
             <button 
                onClick={() => {
                  setCurrentView(ViewState.BOOKING_PUBLIC);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 bg-orange-600 text-black hover:bg-white transition-colors uppercase font-bold text-xs tracking-widest shadow-lg"
             >
                <Globe className="w-4 h-4 flex-shrink-0" />
                <span>Order Page</span>
            </button>
        </div>
      </aside>


      {/* Mobile Logo Button (Top Left) */}
      <button
        onClick={() => {
          setCurrentView(ViewState.DASHBOARD);
          setIsMobileMenuOpen(false);
        }}
        className="lg:hidden fixed top-4 left-4 z-30 w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity bg-orange-600 rounded-sm"
      >
        <HaloLogo size={32} />
      </button>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-72 bg-zinc-50 dark:bg-black min-h-screen relative overflow-auto transition-colors duration-300 pt-16 lg:pt-0 pb-20 lg:pb-0">
         {/* Background accent element */}
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-600/5 blur-[150px] pointer-events-none"></div>
         
         {/* Top Right Sign In/Out Button */}
         <div className="fixed lg:absolute top-4 right-4 z-30">
           {isAuthenticated ? (
             <div className="flex items-center gap-3">
               {businessProfile.email && (
                 <span className="hidden md:block text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                   {businessProfile.email}
                 </span>
               )}
               <button
                 onClick={handleLogout}
                 className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors uppercase text-xs font-bold tracking-widest border border-zinc-700"
               >
                 <LogOut className="w-4 h-4 flex-shrink-0" />
                 <span className="hidden sm:inline">Sign Out</span>
               </button>
             </div>
           ) : (
             <button
               onClick={() => setShowLoginModal(true)}
               className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-orange-600 text-black hover:bg-white transition-colors uppercase text-xs font-bold tracking-widest shadow-lg"
             >
               <LogIn className="w-4 h-4 flex-shrink-0" />
               <span className="hidden sm:inline">Sign In</span>
             </button>
           )}
         </div>

        <div className="p-4 lg:p-8">
          {renderContent()}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 z-40 flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        <button
          onClick={() => {
            setCurrentView(ViewState.DASHBOARD);
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center gap-1 p-2 min-w-[60px] transition-colors ${
            currentView === ViewState.DASHBOARD 
              ? 'text-orange-600 dark:text-orange-500' 
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>
        
        <button
          onClick={() => {
            setSelectedClient(null);
            setCurrentView(ViewState.CLIENTS);
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center gap-1 p-2 min-w-[60px] transition-colors ${
            currentView === ViewState.CLIENTS 
              ? 'text-orange-600 dark:text-orange-500' 
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Clients</span>
        </button>

        <button
          onClick={() => {
            setCurrentView(ViewState.CALENDAR);
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center gap-1 p-2 min-w-[60px] transition-colors ${
            currentView === ViewState.CALENDAR 
              ? 'text-orange-600 dark:text-orange-500' 
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <CalendarIcon className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Calendar</span>
        </button>

        <button
          onClick={() => {
            setCurrentView(ViewState.MY_BUSINESS);
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center gap-1 p-2 min-w-[60px] transition-colors ${
            currentView === ViewState.MY_BUSINESS 
              ? 'text-orange-600 dark:text-orange-500' 
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Business</span>
        </button>

        <button
          onClick={() => {
            setCurrentView(ViewState.SETTINGS);
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center gap-1 p-2 min-w-[60px] transition-colors ${
            currentView === ViewState.SETTINGS 
              ? 'text-orange-600 dark:text-orange-500' 
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
        </button>
      </nav>

      {/* Floating AI Chat Button */}
      {!isChatOpen && (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-20 lg:bottom-8 right-4 lg:right-8 z-50 w-12 h-12 lg:w-14 lg:h-14 bg-orange-600 hover:bg-white text-black transition-all duration-300 shadow-[0_0_20px_rgba(234,88,12,0.4)] flex items-center justify-center rounded-full group"
          >
            <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 group-hover:rotate-12 transition-transform" />
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowLoginModal(false)}>
          <div className="relative w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute -top-10 lg:-top-12 right-0 text-white hover:text-orange-600 transition-colors text-sm uppercase tracking-widest font-bold z-10 p-2"
            >
              Close
            </button>
            <div className="relative">
              <LoginView 
                onLogin={(email) => {
                  handleLogin(email);
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