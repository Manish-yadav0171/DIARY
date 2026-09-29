import React, { useState, useEffect, useCallback, useRef } from 'react';
import DiaryPage from './components/DiaryPage';
import Calendar from './components/Calendar';
import Memories from './components/Memories';
import SettingsPage from './components/SettingsPage';
import Navigation from './components/Navigation';
import LockScreen from './components/LockScreen';
import AuthScreen from './components/AuthScreen';
import {
  getTodayDateKey,
  getUserPin,
  isPinLockEnabled,
  getAutoLockPreference,
  setUserPin,
  removeUserPin
} from './database/diaryStore';
import { switchUserDatabase } from './database/db';
import {
  getStoredUser,
  setStoredUser,
  getStoredToken,
  signOutUser,
  syncUserWithDrive,
  signInWithGoogle
} from './auth/googleAuth';
import {
  Heart,
  Settings as SettingsIcon,
  Download,
  WifiOff,
  CheckCircle2
} from 'lucide-react';
import './styles/global.css';
import './styles/diary.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('diary');
  const [currentDate, setCurrentDate] = useState(getTodayDateKey());
  const [isDark, setIsDark] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // User & Auth State
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [isLocked, setIsLocked] = useState(false);
  const [userPin, setUserPinState] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState(null);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const syncTimeoutRef = useRef(null);

  // Sync theme attribute
  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDark]);

  // Load user security & PIN preferences when user changes
  useEffect(() => {
    async function initUserSecurity() {
      if (!currentUser) return;

      // Switch active Dexie database partition to this user's email
      switchUserDatabase(currentUser.email);

      const pin = await getUserPin();
      const pinEnabled = await isPinLockEnabled();
      setUserPinState(pin);

      if (pinEnabled && pin) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    }

    initUserSecurity();
  }, [currentUser]);

  // Trigger Google Drive sync to retrieve latest data
  const handleDriveSync = useCallback(async (token = null) => {
    const activeToken = token || getStoredToken();
    if (!activeToken || !currentUser?.email) return;

    setIsSyncing(true);
    try {
      const result = await syncUserWithDrive(activeToken);
      if (result.downloadedCount > 0) {
        setSyncToast(`☁️ Retrieved ${result.downloadedCount} entries from your Google Drive!`);
        setTimeout(() => setSyncToast(null), 5000);
      }
      return result;
    } catch (err) {
      console.warn('Auto-sync to Google Drive failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser]);

  // On initial mount with stored user & token: sync latest entries written last night
  useEffect(() => {
    const token = getStoredToken();
    if (currentUser?.email && token) {
      handleDriveSync(token);
    }
  }, [currentUser?.email, handleDriveSync]);

  // Auto-lock on tab switch / window blur if enabled
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && currentUser) {
        const autoLock = await getAutoLockPreference();
        const pin = await getUserPin();
        const pinEnabled = await isPinLockEnabled();
        if (autoLock && pinEnabled && pin) {
          setIsLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser]);

  // Keyboard shortcut Ctrl+L to quickly lock screen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (userPin) {
          setIsLocked(true);
        } else {
          setActiveTab('settings');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [userPin]);

  // PWA and Online/Offline listeners
  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleOnline = () => {
      setIsOffline(false);
      handleDriveSync();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleDriveSync]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Google Login Handler
  const handleLoginSuccess = async (user, accessToken) => {
    setCurrentUser(user);
    // Background sync to immediately fetch entries written last night
    handleDriveSync(accessToken);
  };

  // Guest Login Handler
  const handleGuestLogin = () => {
    const guestUser = {
      name: 'Local Guest',
      email: null,
      picture: null
    };
    setStoredUser(guestUser);
    setCurrentUser(guestUser);
    switchUserDatabase(null);
    setIsLocked(false);
  };

  // Sign out / switch user
  const handleSignOut = () => {
    signOutUser();
    setCurrentUser(null);
    setIsLocked(false);
    setUserPinState(null);
    setActiveTab('diary');
  };

  // Forgot PIN reset with Google
  const handleResetPinWithGoogle = async () => {
    try {
      const clientId =
        localStorage.getItem('diary_google_client_id') ||
        import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (!clientId) {
        alert('Please sign in or configure Google Client ID to verify your identity.');
        return;
      }

      const { user } = await signInWithGoogle(clientId);
      if (user.email.toLowerCase() === currentUser?.email?.toLowerCase()) {
        await removeUserPin();
        setUserPinState(null);
        setIsLocked(false);
        alert('Identity verified! Your PIN has been reset.');
      } else {
        alert(`Account mismatch: signed in as ${user.email}, but this diary belongs to ${currentUser.email}.`);
      }
    } catch (err) {
      alert(`Google verification failed: ${err.message}`);
    }
  };

  // Calendar date select
  const handleCalendarSelectDate = (dateKey) => {
    setCurrentDate(dateKey);
    setActiveTab('diary');
  };

  // 1. If not logged in: show Auth Gatekeeper
  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={handleLoginSuccess}
        onGuestLogin={handleGuestLogin}
      />
    );
  }

  // 2. If locked with PIN: show Lock Screen
  if (isLocked && userPin) {
    return (
      <LockScreen
        expectedPin={userPin}
        onUnlock={() => setIsLocked(false)}
        user={currentUser}
        onSwitchAccount={handleSignOut}
        onResetPinWithGoogle={handleResetPinWithGoogle}
      />
    );
  }

  // 3. Main Diary Application (Unlocked)
  return (
    <div className="app-container" key={currentUser.email || 'guest'}>
      {/* Offline banner notification if internet disconnects */}
      {isOffline && (
        <div className="offline-indicator" role="status">
          <WifiOff size={14} />
          <span>You are offline. Your diary continues to save locally.</span>
        </div>
      )}

      {/* Sync toast notification */}
      {syncToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '75px',
            right: '20px',
            backgroundColor: 'var(--paper-bg)',
            color: 'var(--text-ink)',
            border: '1px solid var(--paper-border)',
            boxShadow: 'var(--paper-shadow)',
            borderRadius: '12px',
            padding: '0.65rem 1rem',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            zIndex: 9999
          }}
        >
          <CheckCircle2 size={16} color="var(--accent-warm)" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Navigation bar with User Info, Sync Status, and Quick Lock */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        installPrompt={deferredPrompt}
        onInstallApp={handleInstallApp}
        user={currentUser}
        isSyncing={isSyncing}
        onLock={userPin ? () => setIsLocked(true) : null}
        onSignOut={handleSignOut}
      />

      <main className="main-content">
        {activeTab === 'diary' && (
          <DiaryPage
            key={currentDate}
            date={currentDate}
            onDateChange={setCurrentDate}
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        )}

        {activeTab === 'calendar' && (
          <Calendar onSelectDate={handleCalendarSelectDate} />
        )}

        {activeTab === 'memories' && (
          <Memories onSelectDate={handleCalendarSelectDate} />
        )}

        {activeTab === 'settings' && (
          <SettingsPage
            isDark={isDark}
            onToggleTheme={toggleTheme}
            isInstalled={isInstalled}
            deferredPrompt={deferredPrompt}
            onInstallApp={handleInstallApp}
            user={currentUser}
            onSignOut={handleSignOut}
            onTriggerSync={handleDriveSync}
            onLock={userPin ? () => setIsLocked(true) : null}
          />
        )}
      </main>
    </div>
  );
}
