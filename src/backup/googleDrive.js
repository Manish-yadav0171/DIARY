/**
 * Google Drive API Client for Diary Backups
 * Uses client-side Google Identity Services (GIS) OAuth 2.0 Token Model.
 * Minimum scope: https://www.googleapis.com/auth/drive.file
 * NO CLIENT SECRETS are ever required or stored.
 */

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'diary-backup.json';

// In-memory token cache
let cachedAccessToken = null;
let tokenClient = null;

/**
 * Dynamically loads the Google Identity Services client library
 */
export function loadGoogleIdentityServices() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      return resolve(window.google);
    }

    const existingScript = document.getElementById('google-gsi-script');
    if (existingScript) {
      existingScript.onload = () => resolve(window.google);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () =>
      reject(new Error('Failed to load Google Identity Services. Check your internet connection.'));
    document.head.appendChild(script);
  });
}

/**
 * Requests an OAuth access token from Google
 */
export async function requestGoogleAccessToken(clientId) {
  if (!clientId) {
    throw new Error('Please configure a Google OAuth Client ID first.');
  }

  await loadGoogleIdentityServices();

  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          return reject(new Error(tokenResponse.error_description || tokenResponse.error));
        }
        cachedAccessToken = tokenResponse.access_token;
        resolve(tokenResponse.access_token);
      }
    });

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Checks if a cached access token is available
 */
export function getCachedToken() {
  return cachedAccessToken;
}

/**
 * Revokes the Google OAuth access token and clears session
 */
export function disconnectGoogleAccount() {
  if (cachedAccessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(cachedAccessToken, () => {
      cachedAccessToken = null;
    });
  } else {
    cachedAccessToken = null;
  }
}

/**
 * Finds an existing diary-backup.json file in the user's Drive
 */
async function findBackupFile(accessToken) {
  const query = encodeURIComponent(
    `name = '${BACKUP_FILENAME}' and trashed = false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive search failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

/**
 * Uploads a diary backup JSON object to Google Drive
 */
export async function uploadBackupToDrive(accessToken, backupData) {
  const existingFile = await findBackupFile(accessToken);
  const fileContent = JSON.stringify(backupData, null, 2);

  if (existingFile) {
    // Update existing file content
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      throw new Error(`Failed to update backup file in Google Drive: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      fileId: result.id,
      name: BACKUP_FILENAME,
      modifiedTime: new Date().toISOString()
    };
  } else {
    // Create new multipart file
    const metadata = {
      name: BACKUP_FILENAME,
      mimeType: 'application/json',
      description: 'Personal Digital Diary Backup'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelimiter;

    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const response = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!response.ok) {
      throw new Error(`Failed to upload new backup to Google Drive: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      fileId: result.id,
      name: BACKUP_FILENAME,
      modifiedTime: new Date().toISOString()
    };
  }
}

/**
 * Downloads and parses the latest diary-backup.json from Google Drive
 */
export async function downloadBackupFromDrive(accessToken) {
  const existingFile = await findBackupFile(accessToken);

  if (!existingFile) {
    throw new Error('No existing diary-backup.json file found in your Google Drive.');
  }

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`;
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to download backup from Google Drive: ${response.statusText}`);
  }

  const backupData = await response.json();
  return {
    data: backupData,
    fileId: existingFile.id,
    modifiedTime: existingFile.modifiedTime
  };
}
