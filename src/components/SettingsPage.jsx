import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings as SettingsIcon,
  LogOut,
  Key,
  HelpCircle,
  FileText,
  Lock,
  ShieldCheck,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import {
  createDiaryBackup,
  downloadBackupFile,
  validateBackup,
  restoreBackup
} from '../backup/backup';
import {
  requestGoogleAccessToken,
  uploadBackupToDrive,
  downloadBackupFromDrive,
  disconnectGoogleAccount,
  getCachedToken
} from '../backup/googleDrive';
import {
  getSetting,
  saveSetting,
  getUserPin,
  setUserPin,
  removeUserPin,
  isPinLockEnabled,
  setPinLockEnabled,
  getAutoLockPreference,
  setAutoLockPreference
} from '../database/diaryStore';
import '../styles/settings.css';

export default function SettingsPage({
  isDark,
  onToggleTheme,
  isInstalled,
  deferredPrompt,
  onInstallApp,
  user,
  onSignOut,
  onTriggerSync,
  onLock
}) {
  const [dearDiaryEnabled, setDearDiaryEnabled] = useState(true);
  const [clientId, setClientId] = useState('');
  const [showClientDrawer, setShowClientDrawer] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState(null);

  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // PIN security states
  const [hasPin, setHasPin] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [autoLockOnBlur, setAutoLockOnBlur] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Alert message banner: { type: 'success' | 'error', text: '' }
  const [alert, setAlert] = useState(null);

  // Restore confirmation modal data: { data: parsedBackup, source: 'drive' | 'file' }
  const [pendingRestore, setPendingRestore] = useState(null);

  const fileInputRef = useRef(null);

  // Load saved preferences on mount
  useEffect(() => {
    async function loadSettings() {
      const ddPref = await getSetting('dearDiaryEnabled', true);
      setDearDiaryEnabled(Boolean(ddPref));

      const savedClientId =
        (await getSetting('googleClientId')) ||
        import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        localStorage.getItem('diary_google_client_id') ||
        '';
      setClientId(savedClientId);

      const savedBackupTime = await getSetting('lastBackupTime', null);
      setLastBackupTime(savedBackupTime);

      setIsGoogleConnected(Boolean(getCachedToken() || user));

      // PIN preferences
      const existingPin = await getUserPin();
      setHasPin(Boolean(existingPin));
      const enabled = await isPinLockEnabled();
      setPinEnabled(Boolean(enabled));

      const autoLock = await getAutoLockPreference();
      setAutoLockOnBlur(Boolean(autoLock));
    }

    loadSettings();
  }, [user]);

  const showAlert = (type, text) => {
    setAlert({ type, text });
    setTimeout(() => {
      setAlert(null);
    }, 6000);
  };

  // PIN Handlers
  const handleTogglePin = async (e) => {
    const nextVal = e.target.checked;
    if (nextVal && !hasPin) {
      // Need to set up a PIN first
      setShowPinModal(true);
      return;
    }
    setPinEnabled(nextVal);
    await setPinLockEnabled(nextVal);
    showAlert('success', nextVal ? 'PIN Lock enabled.' : 'PIN Lock disabled.');
  };

  const handleSavePin = async (e) => {
    e.preventDefault();
    setPinError('');

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinError('PIN must be exactly 4 numeric digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('PINs do not match. Please re-enter.');
      return;
    }

    try {
      await setUserPin(newPin);
      setHasPin(true);
      setPinEnabled(true);
      setShowPinModal(false);
      setNewPin('');
      setConfirmPin('');
      showAlert('success', '4-Digit PIN successfully saved and enabled!');
    } catch (err) {
      setPinError(err.message || 'Failed to save PIN.');
    }
  };

  const handleRemovePin = async () => {
    if (window.confirm('Are you sure you want to remove your 4-digit PIN lock?')) {
      await removeUserPin();
      setHasPin(false);
      setPinEnabled(false);
      showAlert('success', 'PIN removed successfully.');
    }
  };

  const handleToggleAutoLock = async (e) => {
    const nextVal = e.target.checked;
    setAutoLockOnBlur(nextVal);
    await setAutoLockPreference(nextVal);
    showAlert(
      'success',
      nextVal
        ? 'Auto-lock enabled: Screen locks when switching tabs or reopening.'
        : 'Auto-lock disabled.'
    );
  };

  // Google Drive: Back up now
  const handleGoogleBackup = async () => {
    if (onTriggerSync) {
      setIsBackingUp(true);
      try {
        const res = await onTriggerSync();
        if (res?.success) {
          setLastBackupTime(res.lastSyncTime);
          showAlert('success', `☁️ Successfully synced ${res.totalEntries} entries to Google Drive!`);
        }
      } catch (err) {
        showAlert('error', `Sync failed: ${err.message}`);
      } finally {
        setIsBackingUp(false);
      }
      return;
    }

    if (!clientId.trim()) {
      setShowClientDrawer(true);
      showAlert('error', 'Please configure your Google OAuth Client ID below first.');
      return;
    }

    setIsBackingUp(true);
    try {
      const token = await requestGoogleAccessToken(clientId.trim());
      setIsGoogleConnected(true);

      const backupData = await createDiaryBackup();
      await uploadBackupToDrive(token, backupData);

      const now = new Date().toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      setLastBackupTime(now);
      await saveSetting('lastBackupTime', now);

      showAlert('success', `☁️ Successfully backed up ${backupData.entryCount} entries to Google Drive!`);
    } catch (err) {
      console.error('Google Drive backup error:', err);
      showAlert(
        'error',
        `Google Drive backup failed: ${err.message || 'Unknown error'}. Your diary remains safely stored on this device.`
      );
    } finally {
      setIsBackingUp(false);
    }
  };

  // Google Drive: Restore
  const handleGoogleRestore = async () => {
    if (!clientId.trim()) {
      setShowClientDrawer(true);
      showAlert('error', 'Please configure your Google OAuth Client ID below first.');
      return;
    }

    setIsRestoring(true);
    try {
      const token = await requestGoogleAccessToken(clientId.trim());
      setIsGoogleConnected(true);

      const { data } = await downloadBackupFromDrive(token);
      const validation = validateBackup(data);

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setPendingRestore({ data, source: 'Google Drive' });
    } catch (err) {
      console.error('Google Drive restore error:', err);
      showAlert(
        'error',
        `Restore from Google Drive failed: ${err.message || 'No backup found'}. Your local entries were not changed.`
      );
    } finally {
      setIsRestoring(false);
    }
  };

  // Disconnect Google Account
  const handleDisconnect = () => {
    if (onSignOut) {
      onSignOut();
      return;
    }
    disconnectGoogleAccount();
    setIsGoogleConnected(false);
    showAlert('success', 'Google account disconnected for this session.');
  };

  // Save Client ID
  const handleSaveClientId = async () => {
    await saveSetting('googleClientId', clientId.trim());
    localStorage.setItem('diary_google_client_id', clientId.trim());
    showAlert('success', 'Google OAuth Client ID saved.');
    setShowClientDrawer(false);
  };

  // Local JSON Download
  const handleDownloadLocalBackup = async () => {
    try {
      const { fileName, count } = await downloadBackupFile();
      const now = new Date().toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      setLastBackupTime(now);
      await saveSetting('lastBackupTime', now);

      showAlert('success', `💾 Downloaded ${fileName} (${count} entries) safely.`);
    } catch (err) {
      showAlert('error', `Failed to download backup: ${err.message}`);
    }
  };

  // Local File Upload Trigger
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result);
        const validation = validateBackup(parsed);
        if (!validation.valid) {
          showAlert('error', `Invalid backup file: ${validation.error}`);
          return;
        }
        setPendingRestore({ data: parsed, source: file.name });
      } catch (parseErr) {
        showAlert('error', 'Failed to read JSON file. Please verify it is a valid backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Execute Restore
  const confirmRestore = async (mode) => {
    if (!pendingRestore) return;

    try {
      const result = await restoreBackup(pendingRestore.data, mode);
      setPendingRestore(null);

      showAlert(
        'success',
        `✅ Restore complete! Added ${result.addedCount} new entries, updated ${result.updatedCount} entries.`
      );
    } catch (err) {
      console.error('Restore error:', err);
      showAlert('error', `Restore failed: ${err.message}. Local data remains safe.`);
    }
  };

  // Toggle Dear Diary Format
  const handleToggleDearDiary = async (e) => {
    const nextVal = e.target.checked;
    setDearDiaryEnabled(nextVal);
    await saveSetting('dearDiaryEnabled', nextVal);
  };

  return (
    <div className="settings-container">
      {/* Header */}
      <header className="settings-header">
        <h2>Settings & Security</h2>
        <p className="settings-subtitle">
          Manage your account profile, PIN security, Google Drive sync, and personal diary preferences.
        </p>
      </header>

      {/* Alert Notification */}
      {alert && (
        <div
          className={`settings-alert ${alert.type}`}
          role="alert"
          aria-live="polite"
        >
          {alert.type === 'success' ? (
            <CheckCircle2 size={17} />
          ) : (
            <AlertCircle size={17} />
          )}
          <span>{alert.text}</span>
        </div>
      )}

      {/* SECTION 0: Active User Profile & Account Isolation */}
      <section className="settings-card" aria-labelledby="user-profile-title">
        <div className="settings-card-header">
          <div className="card-title-group">
            <ShieldCheck className="card-icon" size={22} />
            <h3 id="user-profile-title">Current Account & Data Isolation</h3>
          </div>
          <span className="status-pill connected">
            {user ? 'Google Account Active' : 'Local Guest Account'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name || 'User'}
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                border: '2px solid var(--accent-gold)'
              }}
            />
          ) : (
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent-warm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 600
              }}
            >
              {(user?.name || user?.email || 'G')[0].toUpperCase()}
            </div>
          )}

          <div>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-ink)' }}>
              {user?.name || 'Local Guest'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {user?.email || 'No Google account linked'}
            </div>
          </div>
        </div>

        <p className="card-desc">
          🔒 <strong>Isolated Database Partition:</strong> What you write in this account is strictly partitioned from any other account. If someone else logs in with a different Gmail, they will only see their own diary.
        </p>

        <div className="settings-button-row">
          {onTriggerSync && (
            <button
              className="settings-btn primary"
              onClick={handleGoogleBackup}
              disabled={isBackingUp}
            >
              <RefreshCw size={15} className={isBackingUp ? 'spinning' : ''} />
              <span>{isBackingUp ? 'Syncing...' : 'Sync with Drive Now'}</span>
            </button>
          )}

          {onLock && (
            <button className="settings-btn secondary" onClick={onLock}>
              <Lock size={15} />
              <span>Lock Screen Now</span>
            </button>
          )}

          {onSignOut && (
            <button className="settings-btn danger" onClick={onSignOut}>
              <LogOut size={15} />
              <span>Switch Account / Sign Out</span>
            </button>
          )}
        </div>
      </section>

      {/* SECTION 0.5: 4-Digit PIN Security */}
      <section className="settings-card" aria-labelledby="pin-security-title">
        <div className="settings-card-header">
          <div className="card-title-group">
            <Lock className="card-icon" size={22} />
            <h3 id="pin-security-title">4-Digit PIN Lock</h3>
          </div>
          <span className={`status-pill ${pinEnabled ? 'connected' : 'disconnected'}`}>
            {pinEnabled ? 'PIN Enabled' : 'PIN Off'}
          </span>
        </div>

        <p className="card-desc">
          Require a 4-digit numeric passcode to open and view your diary entries. Helps protect your writing from friends or colleagues sharing this device.
        </p>

        <div className="setting-toggle-row">
          <div className="toggle-label-group">
            <span className="toggle-title">Enable PIN Screen Lock</span>
            <span className="toggle-desc">
              {hasPin
                ? 'Prompt for your 4-digit PIN whenever opening the app.'
                : 'Configure a new 4-digit PIN to activate.'}
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={pinEnabled}
              onChange={handleTogglePin}
              aria-label="Toggle PIN Lock"
            />
            <span className="slider" />
          </label>
        </div>

        {hasPin && (
          <div className="setting-toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-title">Auto-Lock on Tab Switch</span>
              <span className="toggle-desc">
                Immediately lock the diary when switching browser tabs or closing the window.
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoLockOnBlur}
                onChange={handleToggleAutoLock}
                aria-label="Toggle Auto-lock on blur"
              />
              <span className="slider" />
            </label>
          </div>
        )}

        <div className="settings-button-row">
          <button
            className="settings-btn secondary"
            onClick={() => {
              setNewPin('');
              setConfirmPin('');
              setPinError('');
              setShowPinModal(true);
            }}
          >
            <KeyRound size={15} />
            <span>{hasPin ? 'Change PIN' : 'Set Up 4-Digit PIN'}</span>
          </button>

          {hasPin && (
            <button className="settings-btn danger" onClick={handleRemovePin}>
              <span>Remove PIN</span>
            </button>
          )}
        </div>
      </section>

      {/* SECTION 1: Google Drive Cloud Backup & Settings */}
      <section className="settings-card" aria-labelledby="gdrive-title">
        <div className="settings-card-header">
          <div className="card-title-group">
            <Cloud className="card-icon" size={22} />
            <h3 id="gdrive-title">Google Drive Auto-Sync Details</h3>
          </div>
          <span
            className={`status-pill ${
              isGoogleConnected ? 'connected' : 'disconnected'
            }`}
          >
            {isGoogleConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <p className="card-desc">
          Your diary entries automatically synchronize to your personal Google Drive in a secure
          <code>diary-backup.json</code> file. This ensures you can access what you wrote last night across your phone and PC.
        </p>

        {lastBackupTime && (
          <div className="backup-time-info">
            <Clock size={15} color="var(--accent-warm)" />
            <span>Last synchronized: {lastBackupTime}</span>
          </div>
        )}

        <div className="settings-button-row">
          <button
            className="settings-btn primary"
            onClick={handleGoogleBackup}
            disabled={isBackingUp}
          >
            <Cloud size={16} />
            <span>{isBackingUp ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          <button
            className="settings-btn secondary"
            onClick={handleGoogleRestore}
            disabled={isRestoring}
          >
            <Upload size={16} />
            <span>{isRestoring ? 'Connecting...' : 'Restore from Google Drive'}</span>
          </button>

          <button
            className="settings-btn secondary"
            onClick={() => setShowClientDrawer(!showClientDrawer)}
            title="Configure Google OAuth Client ID"
          >
            <Key size={15} />
            <span>{showClientDrawer ? 'Hide API Config' : 'Google API Config'}</span>
          </button>
        </div>

        {/* Client ID Configuration Drawer */}
        {showClientDrawer && (
          <div className="client-id-drawer">
            <strong>Google OAuth 2.0 Client ID</strong>
            <p className="client-id-help">
              To connect your Google Drive without an external server, create a free OAuth
              Client ID in your <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-warm)' }}>Google Cloud Console</a> (Application type: Web application, Authorized JavaScript origins: your app URL).
            </p>
            <input
              type="text"
              className="client-id-input"
              placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <button
              className="settings-btn primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={handleSaveClientId}
            >
              Save Client ID
            </button>
          </div>
        )}
      </section>

      {/* SECTION 2: Local File Backup & Restore (Works 100% Offline) */}
      <section className="settings-card" aria-labelledby="local-backup-title">
        <div className="settings-card-header">
          <div className="card-title-group">
            <HardDrive className="card-icon" size={22} />
            <h3 id="local-backup-title">Local File Backup (JSON)</h3>
          </div>
          <span className="status-pill connected">Offline Ready</span>
        </div>

        <p className="card-desc">
          Download a complete, offline snapshot of all your diary entries to your
          computer or phone. You can transfer or restore this file on any device anytime.
        </p>

        <div className="settings-button-row">
          <button className="settings-btn secondary" onClick={handleDownloadLocalBackup}>
            <Download size={16} />
            <span>Download Backup (JSON)</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <button
            className="settings-btn secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            <span>Restore from Local File</span>
          </button>
        </div>
      </section>

      {/* SECTION 3: Diary Writing Preferences */}
      <section className="settings-card" aria-labelledby="pref-title">
        <div className="settings-card-header">
          <div className="card-title-group">
            <FileText className="card-icon" size={22} />
            <h3 id="pref-title">Writing Preferences</h3>
          </div>
        </div>

        <div className="setting-toggle-row">
          <div className="toggle-label-group">
            <span className="toggle-title">"Dear Diary," Opening</span>
            <span className="toggle-desc">
              Automatically display "Dear Diary," at the start of new entry sheets.
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={dearDiaryEnabled}
              onChange={handleToggleDearDiary}
              aria-label="Toggle Dear Diary opening"
            />
            <span className="slider" />
          </label>
        </div>

        <div className="setting-toggle-row">
          <div className="toggle-label-group">
            <span className="toggle-title">Night Writing Mode</span>
            <span className="toggle-desc">
              Comfortable dark paper styling for evening journaling.
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={isDark}
              onChange={onToggleTheme}
              aria-label="Toggle theme"
            />
            <span className="slider" />
          </label>
        </div>
      </section>

      {/* SECTION 4: Progressive Web App Information */}
      <section className="settings-card" aria-labelledby="pwa-info-title">
        <div className="settings-card-header">
          <div className="card-title-group">
            <SettingsIcon className="card-icon" size={22} />
            <h3 id="pwa-info-title">App Information</h3>
          </div>
          <span className="pwa-badge">v0.2.0 Multi-User</span>
        </div>

        <p className="card-desc">
          {isInstalled
            ? '✅ Your diary is currently running as an installed standalone application.'
            : 'Install this diary to your home screen or desktop for a fullscreen writing experience without browser tabs.'}
        </p>

        {deferredPrompt && !isInstalled && (
          <div className="settings-button-row">
            <button className="settings-btn primary" onClick={onInstallApp}>
              <Download size={16} />
              <span>Install Diary Application</span>
            </button>
          </div>
        )}
      </section>

      {/* Modal for PIN Setup / Change */}
      {showPinModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <h3>{hasPin ? 'Change Your 4-Digit PIN' : 'Set Up Your 4-Digit PIN'}</h3>
            </header>
            <form onSubmit={handleSavePin} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Enter a 4-digit numeric passcode to protect your personal diary entries.
              </p>

              {pinError && (
                <div style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 500 }}>
                  {pinError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  4-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--paper-border)',
                    borderRadius: '8px',
                    fontSize: '1.25rem',
                    textAlign: 'center',
                    letterSpacing: '0.5rem',
                    backgroundColor: 'var(--bg-app)'
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Confirm 4-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--paper-border)',
                    borderRadius: '8px',
                    fontSize: '1.25rem',
                    textAlign: 'center',
                    letterSpacing: '0.5rem',
                    backgroundColor: 'var(--bg-app)'
                  }}
                />
              </div>

              <footer className="modal-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="settings-btn secondary"
                  onClick={() => setShowPinModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="settings-btn primary">
                  Save PIN
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Restore */}
      {pendingRestore && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <h3>Restore Diary Entries</h3>
            </header>
            <div className="modal-body">
              <p>
                Found <strong>{pendingRestore.data.entries.length} entries</strong> from{' '}
                <em>{pendingRestore.source}</em>.
              </p>
              <p>
                How would you like to restore?
              </p>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                <strong>• Smart Merge (Recommended):</strong> Imports new entries and only
                updates existing entries if the backup version is newer. Keeps all your
                other local writing intact.
                <br /><br />
                <strong>• Replace All:</strong> Overwrites all existing local entries with
                the backup content.
              </div>
            </div>
            <footer className="modal-actions">
              <button
                className="settings-btn secondary"
                onClick={() => setPendingRestore(null)}
              >
                Cancel
              </button>
              <button
                className="settings-btn primary"
                onClick={() => confirmRestore('merge')}
              >
                Smart Merge (Recommended)
              </button>
              <button
                className="settings-btn danger"
                onClick={() => confirmRestore('replace')}
              >
                Replace All
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
