import {
  loadGoogleIdentityServices,
  uploadBackupToDrive,
  downloadBackupFromDrive,
  disconnectGoogleAccount
} from '../backup/googleDrive';
import { createDiaryBackup, restoreBackup, validateBackup } from '../backup/backup';
import { switchUserDatabase } from '../database/db';
import { saveSetting, migrateLegacyDataIfEmpty } from '../database/diaryStore';

const USER_STORAGE_KEY = 'diary_current_user';
const TOKEN_STORAGE_KEY = 'diary_google_token';
const SCOPES = 'https://www.googleapis.com/auth/drive.file email profile openid';

let activeToken = null;

/**
 * Gets the currently stored user session from localStorage
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to parse stored user:', err);
    return null;
  }
}

/**
 * Saves current user profile to localStorage
 */
export function setStoredUser(user) {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

/**
 * Gets cached in-memory or session access token
 */
export function getStoredToken() {
  if (activeToken) return activeToken;
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

/**
 * Stores active access token
 */
export function setStoredToken(token) {
  activeToken = token;
  if (token) {
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (e) {}
  } else {
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (e) {}
  }
}

/**
 * Prompts user with Google OAuth popup to sign in.
 * Requests Drive File scope + Email/Profile to isolate data per account.
 */
export async function signInWithGoogle(clientId) {
  if (!clientId || !clientId.trim()) {
    throw new Error('Google OAuth Client ID is required.');
  }

  await loadGoogleIdentityServices();

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: SCOPES,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            return reject(new Error(tokenResponse.error_description || tokenResponse.error));
          }

          const accessToken = tokenResponse.access_token;
          setStoredToken(accessToken);

          try {
            // Fetch Google user profile
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!profileRes.ok) {
              throw new Error('Failed to retrieve user profile from Google.');
            }

            const profile = await profileRes.json();
            const user = {
              id: profile.sub,
              email: profile.email,
              name: profile.name || profile.email.split('@')[0],
              picture: profile.picture || null
            };

            // Switch Dexie database to this user's private store
            switchUserDatabase(user.email);
            setStoredUser(user);

            // If this is a new database, check for legacy entries to migrate
            await migrateLegacyDataIfEmpty();

            resolve({ user, accessToken });
          } catch (profileErr) {
            reject(profileErr);
          }
        }
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Signs out the current user, clears tokens, switches DB back to guest
 */
export function signOutUser() {
  disconnectGoogleAccount();
  setStoredToken(null);
  setStoredUser(null);
  switchUserDatabase(null);
}

/**
 * Two-way auto sync with Google Drive:
 * 1. Checks user's Google Drive for existing backup.
 * 2. If found, merges cloud entries into local IndexedDB (retrieves what was written last night).
 * 3. Exports the full merged local database and uploads back to Drive.
 */
export async function syncUserWithDrive(accessToken) {
  if (!accessToken) {
    throw new Error('No valid Google access token available for synchronization.');
  }

  let downloadedCount = 0;
  let hasRemote = false;

  // Step 1: Download from Google Drive if exists
  try {
    const remote = await downloadBackupFromDrive(accessToken);
    if (remote?.data) {
      const validation = validateBackup(remote.data);
      if (validation.valid) {
        hasRemote = true;
        const result = await restoreBackup(remote.data, 'merge');
        downloadedCount = result.addedCount + result.updatedCount;
      }
    }
  } catch (downloadErr) {
    // File not found on Drive is normal for first-time users
    if (!downloadErr.message?.includes('No existing diary-backup.json')) {
      console.warn('Google Drive download error:', downloadErr);
    }
  }

  // Step 2: Upload local merged data back to Google Drive
  const localBackup = await createDiaryBackup();
  const uploadResult = await uploadBackupToDrive(accessToken, localBackup);

  const now = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  await saveSetting('lastBackupTime', now);

  return {
    success: true,
    totalEntries: localBackup.entryCount,
    downloadedCount,
    lastSyncTime: now,
    fileId: uploadResult.fileId
  };
}
