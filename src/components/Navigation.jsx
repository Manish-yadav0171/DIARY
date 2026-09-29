import React from 'react';
import {
  BookOpen,
  Calendar,
  Heart,
  Settings,
  Sun,
  Moon,
  Download,
  Lock,
  Cloud,
  Loader2,
  LogOut
} from 'lucide-react';

export default function Navigation({
  activeTab,
  onSelectTab,
  isDark,
  onToggleTheme,
  installPrompt,
  onInstallApp,
  user,
  isSyncing,
  onLock,
  onSignOut
}) {
  const navItems = [
    { id: 'diary', label: 'Diary', icon: BookOpen },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'memories', label: 'Memories', icon: Heart },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <nav className="navigation-bar" aria-label="Main navigation">
      <div className="navigation-content">
        {/* Desktop Brand / Title & User Badge */}
        <div className="nav-brand" onClick={() => onSelectTab('diary')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BookOpen className="nav-brand-icon" size={20} />
          <span className="nav-brand-title">Personal Diary</span>
          {user && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.55rem',
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent-warm)',
                borderRadius: '12px',
                fontWeight: 500,
                maxWidth: '140px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={user.email}
            >
              {user.name || user.email.split('@')[0]}
            </span>
          )}
        </div>

        {/* Tab Items (Mobile & PC) */}
        <div className="nav-items-group" role="tablist">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isActive}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(item.id)}
                title={item.label}
              >
                <Icon size={19} />
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop Header Actions */}
        <div className="nav-desktop-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Cloud Sync Status */}
          {user && (
            <div
              className={`sync-status-pill ${isSyncing ? 'spinning' : ''}`}
              title={isSyncing ? 'Syncing with Google Drive...' : 'Synced with private Google Drive'}
            >
              {isSyncing ? <Loader2 size={13} /> : <Cloud size={13} color="var(--accent-warm)" />}
              <span style={{ fontSize: '0.74rem' }}>{isSyncing ? 'Syncing...' : 'Synced'}</span>
            </div>
          )}

          {/* Quick Lock Diary Button */}
          {onLock && (
            <button
              className="icon-button"
              onClick={onLock}
              title="Lock Diary with PIN (Ctrl+L)"
              aria-label="Lock screen"
            >
              <Lock size={18} />
            </button>
          )}

          {installPrompt && (
            <button
              className="install-pwa-btn"
              onClick={onInstallApp}
              title="Install Diary on your device"
              aria-label="Install App"
            >
              <Download size={15} />
              <span>Install</span>
            </button>
          )}

          <button
            className="icon-button"
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Paper Mode (Ctrl+D)' : 'Switch to Night Mode (Ctrl+D)'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          {/* User Avatar with Sign Out */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.25rem' }}>
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || 'User'}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: '1px solid var(--paper-border)'
                  }}
                  title={`Signed in as ${user.email}`}
                />
              ) : (
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-warm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                  title={`Signed in as ${user.email}`}
                >
                  {(user.name || user.email || 'U')[0].toUpperCase()}
                </div>
              )}

              {onSignOut && (
                <button
                  className="icon-button"
                  onClick={onSignOut}
                  title="Switch Account / Sign Out"
                  aria-label="Sign out"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
