import React, { createContext, useContext, useEffect, useState } from 'react';

type AuthState = {
  loading: boolean;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (accessToken: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Restore auth state from localStorage on mount
  // Use try/finally to guarantee loading is always set to false
  useEffect(() => {
    try {
      const saved = localStorage.getItem('google_access_token');
      if (saved) {
        setAccessToken(saved);
      }
    } catch (error) {
      console.error('Error reading auth state from localStorage:', error);
    } finally {
      // Always set loading to false, even if there's an error
      setLoading(false);
    }
  }, []);

  const login = (token: string) => {
    localStorage.setItem('google_access_token', token);
    setAccessToken(token);
  };

  const logout = () => {
    localStorage.removeItem('google_access_token');
    setAccessToken(null);
  };

  const isAuthenticated = !!accessToken;

  return (
    <AuthContext.Provider value={{ loading, accessToken, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// Helper function to extract email from auth token
export function getUserEmailFromToken(token: string | null): string | null {
  if (!token) return null;
  
  // If it's an email-based token (format: email_<base64>_<timestamp>)
  if (token.startsWith('email_')) {
    try {
      const parts = token.split('_');
      if (parts.length >= 2) {
        const decoded = atob(parts[1]);
        if (decoded.includes('@')) {
          return decoded;
        }
      }
    } catch (e) {
      // Ignore decode errors
    }
  }
  
  // For Google tokens, we'd need to decode the JWT or fetch user info
  // For now, return null and we'll get email from business profile
  return null;
}
