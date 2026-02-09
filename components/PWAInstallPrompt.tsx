import React, { useState, useEffect, useRef } from 'react';
import { Download, X, Wifi, WifiOff } from 'lucide-react';

// ── Install Prompt ──
// Shows a banner when the app is installable (beforeinstallprompt event fires)
// and the user hasn't dismissed it.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Re-show after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detect app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] animate-slide-up">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl flex items-center gap-3 max-w-md mx-auto">
        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Download size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Install Halo</p>
          <p className="text-zinc-400 text-xs">Add to home screen for the full experience</p>
        </div>
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-200 transition-colors flex-shrink-0"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-zinc-500 hover:text-white transition-colors flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// ── Offline Indicator ──
// Shows a small banner when the device goes offline

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Show "Back online" briefly then hide
      setShowBanner(true);
      timerRef.current = setTimeout(() => setShowBanner(false), 3000);
    };

    const goOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] animate-slide-down">
      <div
        className={`flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider ${
          isOnline
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi size={14} /> Back Online
          </>
        ) : (
          <>
            <WifiOff size={14} /> You're Offline — Some features may be limited
          </>
        )}
      </div>
    </div>
  );
};
