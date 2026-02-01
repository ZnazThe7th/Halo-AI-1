import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Mail, Lock, User, Briefcase, KeyRound, CheckCircle, ArrowLeft, X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { generateResetCodeEmail } from '../services/geminiService';
import { fetchGoogleUserInfo, extractBusinessName } from '../services/googleAuthService';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '') as string;
const HAS_GOOGLE_AUTH = !!GOOGLE_CLIENT_ID;

interface LoginViewProps {
  onLogin: () => void;
  onSignup: (name: string, businessName: string, email: string) => void;
}

type LoginMode = 'signin' | 'signup' | 'forgot_email' | 'forgot_code' | 'forgot_new_pass';

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onSignup }) => {
  const [mode, setMode] = useState<LoginMode>('signin');
  const [isLoading, setIsLoading] = useState(false);
  
  // Notification State
  const [notification, setNotification] = useState<{title: string, message: string} | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  
  // Reset Flow State
  const [resetCode, setResetCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
        const timer = setTimeout(() => setNotification(null), 6000);
        return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleGoogleSuccess = async (tokenResponse: any) => {
    setIsLoading(true);
    try {
      // Fetch user info from Google
      const userInfo = await fetchGoogleUserInfo(tokenResponse.access_token);
      
      setIsLoading(false);
      if (mode === 'signup') {
        const businessName = extractBusinessName(userInfo.email, userInfo.name);
        onSignup(userInfo.name, businessName, userInfo.email);
      } else {
        // For sign in, we can use the user info to authenticate
        // In a real app, you'd verify the token with your backend
        onLogin();
      }
    } catch (error) {
      console.error('Google authentication error:', error);
      setIsLoading(false);
      setNotification({
        title: "Authentication Error",
        message: "Failed to authenticate with Google. Please try again."
      });
    }
  };

  const handleGoogleError = () => {
    setIsLoading(false);
    setNotification({
      title: "Authentication Cancelled",
      message: "Google sign-in was cancelled or failed."
    });
  };

  // Always call the hook (React hooks must be called unconditionally)
  // But only use it if Google Auth is configured
  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
  });

  const handleGoogleLogin = () => {
    if (!HAS_GOOGLE_AUTH) {
      setNotification({
        title: "Google Auth Not Configured",
        message: "Please set VITE_GOOGLE_CLIENT_ID in your .env.local file to enable Google Sign-In."
      });
      return;
    }
    setIsLoading(true);
    googleLogin();
  };

  const handleSigninSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (mode === 'signup' && (!fullName || !businessName)) return;

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (mode === 'signup') {
        onSignup(fullName, businessName, email);
      } else {
        onLogin();
      }
    }, 1500);
  };

  // --- Reset Password Flow Handlers ---

  const handleSendResetCode = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!email) return;
      
      setIsLoading(true);
      // Generate a random 6 digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setResetCode(code);

      // Simulate AI Email generation
      const emailBody = await generateResetCodeEmail(email, code);
      
      setIsLoading(false);
      setMode('forgot_code');
      
      // Show simulated email toast
      setNotification({
          title: "New Email: Password Reset",
          message: emailBody
      });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      
      setTimeout(() => {
          setIsLoading(false);
          if (enteredCode === resetCode) {
              setMode('forgot_new_pass');
          } else {
              alert("Incorrect code. Please check the simulated email notification.");
          }
      }, 1000);
  };

  const handleResetPassword = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPassword) return;

      setIsLoading(true);
      setTimeout(() => {
          setIsLoading(false);
          // In real app, API call here.
          setMode('signin');
          setPassword(newPassword); // Pre-fill for convenience
          setNotification({
              title: "Success",
              message: "Password reset successfully. Please sign in."
          });
      }, 1500);
  };

  // --- Render Helpers ---

  const renderTitle = () => {
      switch(mode) {
          case 'signup': return 'Create Account';
          case 'forgot_email': return 'Reset Password';
          case 'forgot_code': return 'Verify Code';
          case 'forgot_new_pass': return 'New Password';
          default: return 'Welcome Back';
      }
  };

  const renderSubtitle = () => {
      switch(mode) {
          case 'signup': return 'Get started with your free trial.';
          case 'forgot_email': return 'Enter your email to receive a code.';
          case 'forgot_code': return 'Enter the 6-digit code sent to your email.';
          case 'forgot_new_pass': return 'Create a secure new password.';
          default: return 'Sign in to manage your business.';
      }
  };

  return (
    <div className="bg-black flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden rounded-sm">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-zinc-800/20 blur-[120px] rounded-full pointer-events-none"></div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      {/* Simulated Email Toast */}
      {notification && (
          <div className="absolute top-8 right-0 left-0 mx-auto w-full max-w-sm px-4 z-50">
            <div className="bg-zinc-900 border border-zinc-700 p-4 shadow-2xl rounded-sm animate-in slide-in-from-top-5 duration-500 relative">
                <button onClick={() => setNotification(null)} className="absolute top-2 right-2 text-zinc-500 hover:text-white"><X className="w-4 h-4"/></button>
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-white flex items-center justify-center shrink-0 rounded-sm">
                        <Mail className="w-4 h-4 text-black" />
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">{notification.title}</h4>
                        <p className="text-zinc-400 text-xs leading-relaxed font-mono bg-black p-2 border border-zinc-800 rounded-sm">{notification.message}</p>
                    </div>
                </div>
            </div>
          </div>
      )}

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        
        {/* Logo Section */}
        <div className="text-center mb-8">
           <div className="w-12 h-12 bg-orange-600 mx-auto flex items-center justify-center text-2xl font-bold text-black mb-4 shadow-[0_0_30px_rgba(234,88,12,0.4)]">
             H
           </div>
           <h1 className="text-2xl font-bold text-white uppercase tracking-widest mb-1">Halo</h1>
           <p className="text-zinc-500 uppercase tracking-widest text-xs font-bold">Professional Assistant OS</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-950 border border-zinc-800 p-8 shadow-2xl relative group transition-all duration-300">
           <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-orange-600 to-transparent opacity-50"></div>
           
           <h2 className="text-xl font-bold text-white mb-2 text-center">
             {renderTitle()}
           </h2>
           <p className="text-zinc-500 text-center text-sm mb-8">
             {renderSubtitle()}
           </p>

           {/* --- Login / Signup Mode --- */}
           {(mode === 'signin' || mode === 'signup') && (
               <>
                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full bg-white text-zinc-900 hover:bg-zinc-200 transition-colors font-bold py-4 flex items-center justify-center gap-3 relative overflow-hidden mb-6"
                >
                    {isLoading ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                        <span className="uppercase tracking-widest text-xs">Authenticating...</span>
                    </div>
                    ) : (
                    <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="text-sm">{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
                    </>
                    )}
                </button>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-zinc-950 px-2 text-zinc-500 font-bold tracking-widest">Or continue with email</span>
                    </div>
                </div>

                <form onSubmit={handleSigninSignupSubmit} className="space-y-4">
                    {mode === 'signup' && (
                        <>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input 
                                    type="text" 
                                    className="w-full bg-black border border-zinc-800 pl-12 pr-4 py-3 text-white focus:border-orange-600 outline-none transition-colors placeholder-zinc-700"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Business Name</label>
                            <div className="relative">
                                <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input 
                                    type="text" 
                                    className="w-full bg-black border border-zinc-800 pl-12 pr-4 py-3 text-white focus:border-orange-600 outline-none transition-colors placeholder-zinc-700"
                                    placeholder="John's Barbershop"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input 
                                type="email" 
                                className="w-full bg-black border border-zinc-800 pl-12 pr-4 py-3 text-white focus:border-orange-600 outline-none transition-colors placeholder-zinc-700"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Password</label>
                             {mode === 'signin' && (
                                <button type="button" onClick={() => setMode('forgot_email')} className="text-[10px] text-orange-600 hover:text-white uppercase font-bold tracking-widest">Forgot?</button>
                             )}
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input 
                                type="password" 
                                className="w-full bg-black border border-zinc-800 pl-12 pr-4 py-3 text-white focus:border-orange-600 outline-none transition-colors placeholder-zinc-700"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all font-bold py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                    >
                        {isLoading ? (mode === 'signup' ? 'Creating Account...' : 'Signing In...') : (mode === 'signup' ? 'Create Account' : 'Sign In')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => {
                            setMode(mode === 'signin' ? 'signup' : 'signin');
                            setEmail('');
                            setPassword('');
                            setFullName('');
                            setBusinessName('');
                        }}
                        className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors border-b border-transparent hover:border-zinc-500 pb-1"
                    >
                    {mode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </button>
                </div>
               </>
           )}

           {/* --- Forgot Password Flow --- */}
           
           {/* Step 1: Email */}
           {mode === 'forgot_email' && (
               <form onSubmit={handleSendResetCode} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input 
                                type="email" 
                                className="w-full bg-black border border-zinc-800 pl-12 pr-4 py-3 text-white focus:border-orange-600 outline-none transition-colors placeholder-zinc-700"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-orange-600 text-black font-bold py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-white transition-colors"
                    >
                        {isLoading ? 'Sending Code...' : 'Send Reset Code'}
                    </button>
                    <div className="text-center">
                         <button type="button" onClick={() => setMode('signin')} className="text-xs text-zinc-500 hover:text-white flex items-center justify-center gap-2 w-full uppercase tracking-widest font-bold">
                             <ArrowLeft className="w-3 h-3" /> Back to Sign In
                         </button>
                    </div>
               </form>
           )}

           {/* Step 2: Code */}
           {mode === 'forgot_code' && (
                <form onSubmit={handleVerifyCode} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Verification Code</label>
                        <div className="relative">
                            <KeyRound className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input 
                                type="text" 
                                className="w-full bg-black border border-zinc-800 pl-12 pr-4 py-3 text-white focus:border-orange-600 outline-none transition-colors placeholder-zinc-700 font-mono tracking-widest text-lg"
                                placeholder="123456"
                                maxLength={6}
                                value={enteredCode}
                                onChange={(e) => setEnteredCode(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-orange-600 text-black font-bold py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-white transition-colors"
                    >
                        {isLoading ? 'Verifying...' : 'Verify Code'}
                    </button>
                    <div className="text-center">
                        <button type="button" onClick={() => setMode('forgot_email')} className="text-xs text-zinc-500 hover:text-white uppercase tracking-widest font-bold">
                            Resend Code
                        </button>
                    </div>
                </form>
           )}

           {/* Step 3: New Password */}
           {mode === 'forgot_new_pass' && (
                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input 
                                type="password" 
                                className="w-full bg-black border border-zinc-800 pl-12 pr-4 py-3 text-white focus:border-orange-600 outline-none transition-colors placeholder-zinc-700"
                                placeholder="New secure password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-white text-black font-bold py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
                    >
                        {isLoading ? 'Resetting...' : 'Set New Password'}
                    </button>
                </form>
           )}


           <div className="mt-8 flex items-center justify-between border-t border-zinc-800 pt-6">
              <div className="flex items-center gap-2 text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
                <Sparkles className="w-3 h-3" />
                Powered by Gemini AI
              </div>
              <span className="text-[10px] text-zinc-600 font-mono">v1.3.1</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;