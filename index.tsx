import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './services/authContext';
import App from './App';

// Temporary debug log - remove after confirming Vercel env var is working
console.log("VITE_GOOGLE_CLIENT_ID:", import.meta.env.VITE_GOOGLE_CLIENT_ID);

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '') as string;
const isValidClientId = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'your_google_client_id_here' && GOOGLE_CLIENT_ID.trim() !== '';

if (!isValidClientId) {
  console.warn('⚠️ Google OAuth Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in Vercel Environment Variables (for production) or .env.local (for local dev). Google Sign-In will be disabled.');
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh', 
          backgroundColor: '#000', 
          color: '#fff',
          padding: '20px',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Application Error</h1>
          <p style={{ color: '#888' }}>{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#ea580c', 
              color: '#000', 
              border: 'none', 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reload Page
          </button>
          <details style={{ marginTop: '20px', color: '#666' }}>
            <summary style={{ cursor: 'pointer' }}>Error Details</summary>
            <pre style={{ marginTop: '10px', color: '#888', fontSize: '12px' }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Provider order matters: GoogleOAuthProvider -> AuthProvider -> App
// Always wrap with GoogleOAuthProvider - it handles empty clientId gracefully
// The LoginView component will show a message if Google Auth isn't configured
// We always provide the provider to prevent "useGoogleLogin must be used within GoogleOAuthProvider" errors
// If clientId is invalid, the provider will still render but Google Sign-In will be disabled
const AppWrapper = (
  <GoogleOAuthProvider clientId={isValidClientId ? GOOGLE_CLIENT_ID : 'dummy-client-id'}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </GoogleOAuthProvider>
);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {AppWrapper}
    </ErrorBoundary>
  </React.StrictMode>
);

// ── Register Service Worker for PWA ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered, scope:', registration.scope);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available — optionally notify user
                console.log('[PWA] New version available. Refresh to update.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker registration failed:', error);
      });
  });
}
