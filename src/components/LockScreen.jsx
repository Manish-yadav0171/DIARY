import React, { useState, useEffect } from 'react';
import { Lock, Delete, UserCheck, LogOut, KeyRound } from 'lucide-react';
import '../styles/lockscreen.css';

export default function LockScreen({
  expectedPin,
  onUnlock,
  user,
  onSwitchAccount,
  onResetPinWithGoogle
}) {
  const [pin, setPin] = useState('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle number input
  const handlePressDigit = (digit) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setHasError(false);
      setErrorMessage('');

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setHasError(false);
    setErrorMessage('');
  };

  const handleClear = () => {
    setPin('');
    setHasError(false);
    setErrorMessage('');
  };

  const verifyPin = (inputPin) => {
    if (inputPin === expectedPin) {
      onUnlock();
    } else {
      setHasError(true);
      setErrorMessage('Incorrect PIN. Please try again.');
      setTimeout(() => {
        setPin('');
        setHasError(false);
      }, 500);
    }
  };

  // Keyboard support for PC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePressDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, expectedPin]);

  return (
    <div className="lockscreen-overlay" role="dialog" aria-modal="true">
      <div className="lockscreen-card">
        {/* User avatar or Lock emblem */}
        {user?.picture ? (
          <img
            src={user.picture}
            alt={user.name || 'User'}
            className="lock-user-avatar"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '2px solid var(--accent-gold)',
              boxShadow: '0 4px 12px rgba(132, 94, 61, 0.15)'
            }}
          />
        ) : (
          <div className="lock-emblem">
            <Lock size={28} />
          </div>
        )}

        <div>
          <h2 className="lockscreen-title">
            {user?.name ? `${user.name}'s Diary` : 'Personal Diary'}
          </h2>
          <p className="lockscreen-desc">
            {user?.email ? (
              <span>Locked for <strong>{user.email}</strong></span>
            ) : (
              'Enter your 4-digit PIN to open your diary'
            )}
          </p>
        </div>

        {/* 4-digit dots indicator */}
        <div className={`pin-dots ${hasError ? 'error' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
            />
          ))}
        </div>

        <div className="lock-error-msg">{errorMessage}</div>

        {/* 12-key numeric keypad */}
        <div className="pin-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              className="keypad-btn"
              onClick={() => handlePressDigit(String(num))}
              aria-label={`Digit ${num}`}
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            className="keypad-btn action-btn"
            onClick={handleClear}
            aria-label="Clear PIN"
          >
            C
          </button>

          <button
            type="button"
            className="keypad-btn"
            onClick={() => handlePressDigit('0')}
            aria-label="Digit 0"
          >
            0
          </button>

          <button
            type="button"
            className="keypad-btn action-btn"
            onClick={handleBackspace}
            aria-label="Backspace"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Account actions: Switch account or Forgot PIN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.5rem', width: '100%' }}>
          {onResetPinWithGoogle && (
            <button
              type="button"
              className="btn-auth-link"
              onClick={onResetPinWithGoogle}
              style={{ fontSize: '0.8rem', color: 'var(--accent-warm)' }}
            >
              Forgot PIN? Unlock with Google
            </button>
          )}

          {onSwitchAccount && (
            <button
              type="button"
              className="btn-auth-link"
              onClick={onSwitchAccount}
              style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
            >
              Switch Account / Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
