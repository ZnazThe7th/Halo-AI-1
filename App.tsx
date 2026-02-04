
import React, { useState, useEffect } from 'react';
import { ViewState, Client, BusinessProfile, Appointment, Expense, ClientRating, AppointmentStatus } from './types';
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
          // First, try to get email from backend session (most reliable)
          let userEmail: string | null = null;
          try {
            const { getCurrentUser } = await import('./services/apiService');
            const userResult = await getCurrentUser();
            if (userResult.data && userResult.data.email) {
              userEmail = userResult.data.email;
              console.log('✅ Got email from backend session:', userEmail);
              // Update business profile email if we got it from backend
              if (userEmail && (!businessProfile.email || businessProfile.email === DEFAULT_BUSINESS.email)) {
                setBusinessProfile(prev => ({ ...prev, email: userEmail! }));
              }
            }
          } catch (e) {
            console.warn('Could not get email from backend session, using token/fallback');
          }
          
          // Fallback to token or business profile email
          const emailFromToken = getUserEmailFromToken(accessToken);
          const email = userEmail || emailFromToken || businessProfile.email;
          console.log('🔄 Loading data for user:', email || 'unknown');
          
          const result = await loadUserData();
          
          if (result.error) {
            // If API is unavailable, silently fall back to localStorage (this is expected)
            if (result.error === 'API_UNAVAILABLE') {
              console.info('Backend API not available, using localStorage for data persistence');
            } else {
              console.warn('Failed to load data from API:', result.error);
            }
            // Fall back to localStorage if API fails (only if API is truly unavailable)
            // This ensures cross-device sync when backend is available
            if (result.error === 'API_UNAVAILABLE') {
              console.warn('⚠️ Backend API not available - using localStorage (data will NOT sync across devices)');
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
                  console.log('📦 Loaded data from localStorage (API unavailable):', {
                    appointments: data.appointments?.length || 0
                  });
                } else {
                  console.log('📦 No localStorage data found for:', email);
                }
              }
            } else {
              // API is available but returned an error - don't use localStorage
              // This ensures we always use backend when it's configured
              console.error('❌ Backend API error (not using localStorage fallback):', result.error);
            }
          } else if (result.data) {
            // Update business profile email if we got it from backend or token
            if (email && (!businessProfile.email || businessProfile.email === DEFAULT_BUSINESS.email)) {
              setBusinessProfile(prev => ({ ...prev, email }));
            }
            
            // Always set data from backend, even if arrays are empty (this ensures sync)
            if (result.data.businessProfile) {
              setBusinessProfile(result.data.businessProfile);
            }
            // Set arrays - use empty array if not provided to ensure clean state
            setClients(result.data.clients || []);
            setAppointments(result.data.appointments || []);
            setExpenses(result.data.expenses || []);
            setRatings(result.data.ratings || []);
            
            console.log('✅ Loaded data from backend:', {
              appointments: result.data.appointments?.length || 0,
              clients: result.data.clients?.length || 0,
              expenses: result.data.expenses?.length || 0
            });
            
            // If backend data is empty but we have localStorage data, merge them
            // This helps migrate data from localStorage to backend
            if (email && email !== DEFAULT_BUSINESS.email) {
              const storageKey = getStorageKey(email);
              const saved = localStorage.getItem(storageKey);
              if (saved) {
                const localData = JSON.parse(saved);
                // If backend has no appointments but localStorage does, use localStorage data
                // This ensures data migration from localStorage to backend
                if ((!result.data.appointments || result.data.appointments.length === 0) && 
                    localData.appointments && localData.appointments.length > 0) {
                  console.log('🔄 Migrating localStorage data to backend:', {
                    appointments: localData.appointments.length
                  });
                  // Merge: use backend data as base, but add localStorage data if backend is empty
                  const mergedData = {
                    businessProfile: result.data.businessProfile || localData.businessProfile || businessProfile,
                    clients: result.data.clients?.length > 0 ? result.data.clients : (localData.clients || []),
                    appointments: result.data.appointments?.length > 0 ? result.data.appointments : (localData.appointments || []),
                    expenses: result.data.expenses?.length > 0 ? result.data.expenses : (localData.expenses || []),
                    ratings: result.data.ratings?.length > 0 ? result.data.ratings : (localData.ratings || [])
                  };
                  
                  // Update state with merged data
                  if (mergedData.businessProfile) setBusinessProfile(mergedData.businessProfile);
                  setClients(mergedData.clients);
                  setAppointments(mergedData.appointments);
                  setExpenses(mergedData.expenses);
                  setRatings(mergedData.ratings);
                  
                  // Save merged data to backend immediately
                  setTimeout(async () => {
                    const saveResult = await saveUserData(mergedData);
                    if (!saveResult.error) {
                      console.log('✅ Migrated data to backend successfully');
                    }
                  }, 500);
                }
              }
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
            // If API is unavailable, silently fall back to localStorage (this is expected)
            if (result.error === 'API_UNAVAILABLE') {
              console.warn('⚠️ Backend API not available - data will NOT sync across devices. Please configure VITE_API_URL.');
            } else {
              console.warn('Failed to save data to API:', result.error);
            }
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
          } else {
            console.log('✅ Saved data to backend:', {
              appointments: appointments.length,
              clients: clients.length,
              expenses: expenses.length
            });
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
    }
    
    // Reset dataLoaded to force reload from backend after login
    // This ensures we get fresh data from the backend, not stale localStorage
    setDataLoaded(false);
    
    // Try to get email from backend session to ensure we're using the correct email
    try {
      const { getCurrentUser } = await import('./services/apiService');
      const userResult = await getCurrentUser();
      if (userResult.data && userResult.data.email) {
        const backendEmail = userResult.data.email;
        console.log('✅ Got email from backend session:', backendEmail);
        if (backendEmail && (!businessProfile.email || businessProfile.email === DEFAULT_BUSINESS.email)) {
          setBusinessProfile(prev => ({ ...prev, email: backendEmail }));
        }
      }
    } catch (e) {
      console.warn('Could not get email from backend session:', e);
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
    // Update appointment in state (or insert if it doesn't exist)
    let shouldSendRatingEmail = false;
    setAppointments(prev => {
      const idx = prev.findIndex(a => a.id === updatedAppt.id);
      const previousAppt = idx >= 0 ? prev[idx] : undefined;
      shouldSendRatingEmail =
        previousAppt?.status !== AppointmentStatus.COMPLETED &&
        updatedAppt.status === AppointmentStatus.COMPLETED;

      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedAppt;
        return next;
      }
      return [...prev, updatedAppt];
    });

    // Send rating email if appointment was just completed (never block UI updates)
    if (shouldSendRatingEmail) {
      try {
        const client = clients.find(c => c.id === updatedAppt.clientId);
        if (client && client.email) {
          const service = businessProfile.services.find(s => s.id === updatedAppt.serviceId);
          const ratingLink = `${window.location.origin}/rate/${updatedAppt.id}?token=${encodeURIComponent(btoa(updatedAppt.id + ':' + client.id))}`;

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
      } catch (err) {
        console.error('Error sending rating email:', err);
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

  const handleResetEarnings = async () => {
    if (!confirm('Are you sure you want to reset all earnings? This will remove all completed appointments and expenses. A summary email will be sent to your email address.')) {
      return;
    }

    try {
      // Collect all completed appointments and expenses before clearing
      const completedAppointments = appointments.filter(a => a.status === AppointmentStatus.COMPLETED);
      const allExpenses = [...expenses];

      // Calculate earnings before reset
      const getAppointmentPrice = (appt: Appointment): number => {
        const service = businessProfile.services.find(s => s.id === appt.serviceId);
        if (!service) return 0;
        if (service.pricePerPerson) {
          const numPeople = appt.numberOfPeople || (appt.clientIds?.length || appt.clientNames?.length || 1);
          return service.price * numPeople;
        }
        return service.price;
      };

      const grossRevenue = completedAppointments.reduce((total, appt) => total + getAppointmentPrice(appt), 0);
      const totalExpenses = allExpenses.reduce((total, exp) => total + exp.amount, 0);
      const writeOffs = allExpenses
        .filter(exp => ['Supplies', 'Rent', 'Marketing'].includes(exp.category))
        .reduce((total, exp) => total + exp.amount, 0);
      const taxableIncome = Math.max(0, grossRevenue - writeOffs);
      const estimatedTax = taxableIncome * (businessProfile.taxRate / 100);
      const netEarnings = grossRevenue - totalExpenses - estimatedTax;

      // Prepare appointment data for email
      const appointmentData = completedAppointments.map(appt => {
        const service = businessProfile.services.find(s => s.id === appt.serviceId);
        const price = getAppointmentPrice(appt);
        return {
          date: appt.date,
          time: appt.time,
          clientName: appt.clientName || 'Unknown Client',
          serviceName: service?.name || 'Unknown Service',
          amount: price
        };
      });

      // Prepare expense data for email
      const expenseData = allExpenses.map(exp => ({
        name: exp.name,
        category: exp.category,
        amount: exp.amount,
        date: exp.date
      }));

      // Generate and send reset email
      const { sendEmail, generateEarningsResetEmailHTML } = await import('./services/emailService');
      const resetDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const emailSent = await sendEmail({
        to: businessProfile.email || 'noreply@halo.app',
        subject: `Earnings Reset - ${businessProfile.name}`,
        html: generateEarningsResetEmailHTML(
          businessProfile.name,
          businessProfile.ownerName,
          resetDate,
          completedAppointments.length,
          grossRevenue,
          totalExpenses,
          estimatedTax,
          netEarnings,
          appointmentData,
          expenseData
        )
      });

      if (emailSent) {
        console.log('Earnings reset email sent successfully');
      } else {
        console.warn('Failed to send earnings reset email');
      }

      // Clear completed appointments and all expenses
      setAppointments(prev => prev.filter(a => a.status !== AppointmentStatus.COMPLETED));
      setExpenses([]);

      alert('Earnings have been reset. A summary email has been sent to your email address.');
    } catch (error) {
      console.error('Error resetting earnings:', error);
      alert('An error occurred while resetting earnings. Please try again.');
    }
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
            onResetEarnings={handleResetEarnings}
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