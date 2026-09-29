import React, { useState, useEffect } from 'react';
import { BookOpen, ShieldCheck, Cloud, Lock, Settings as SettingsIcon, AlertCircle, Sparkles } from 'lucide-react';
import { signInWithGoogle } from '../auth/googleAuth';
import '../styles/auth.css';

export default function AuthScreen({ onLoginSuccess, onGuestLogin }) {
  const [clientId, setClientId] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || localStorage.getItem('diary_google_client_id') || '';
    setClientId(envClientId);
  }, []);

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    const idToUse = clientId.trim() || import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!idToUse) {
      setShowConfig(true);
      setErrorMsg('Please configure your Google OAuth Client ID below to sign in.');
      return;
    }

    setIsLoading(true);
    try {
      localStorage.setItem('diary_google_client_id', idToUse);
      const { user, accessToken } = await signInWithGoogle(idToUse);
      onLoginSuccess(user, accessToken);
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      setErrorMsg(err.message || 'Google sign-in was interrupted or failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true">
      <div className="auth-card">
        {/* Diary Emblem */}
        <div className="auth-emblem">
          <BookOpen size={32} />
        </div>

        {/* Header */}
        <div>
          <h1 className="auth-title">Personal Diary</h1>
          <p className="auth-subtitle">
            Sign in with your Google account to access your private diary and sync what you wrote last night.
          </p>
        </div>

        {/* Features highlight */}
        <div className="auth-features-list">
          <div className="auth-feature-item">
            <ShieldCheck className="auth-feature-icon" size={17} />
            <span><strong>100% Private:</strong> Each Gmail account gets its own isolated diary partition.</span>
          </div>
          <div className="auth-feature-item">
            <Cloud className="auth-feature-icon" size={17} />
            <span><strong>Google Drive Sync:</strong> Your writing automatically syncs to your private Drive.</span>
          </div>
          <div className="auth-feature-item">
            <Lock className="auth-feature-icon" size={17} />
            <span><strong>PIN Lock:</strong> Set a 4-digit code to quickly lock and protect your diary.</span>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="auth-error-banner" role="alert">
            <AlertCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
            {errorMsg}
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          className="btn-google-signin"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg className="google-logo-svg" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{isLoading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
        </button>

        {/* Secondary options */}
        <div className="auth-secondary-actions">
          <button
            type="button"
            className="btn-auth-link"
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? 'Hide Client ID Setup' : '⚙️ Configure Google Client ID'}
          </button>

          {onGuestLogin && (
            <button
              type="button"
              className="btn-auth-link"
              onClick={onGuestLogin}
              style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}
            >
              Continue as Local Guest (Offline Mode)
            </button>
          )}
        </div>

        {/* Google Client ID Configuration Drawer */}
        {showConfig && (
          <div className="auth-client-config">
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-ink)' }}>
              Google OAuth Client ID:
            </strong>
            <p>
              To authenticate with Google directly from the browser, create a free OAuth 2.0 Web Client ID in your <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-warm)' }}>Google Cloud Console</a>.
            </p>
            <input
              type="text"
              placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <button
              type="button"
              className="btn-google-signin"
              style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
              onClick={handleGoogleSignIn}
            >
              Save & Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
