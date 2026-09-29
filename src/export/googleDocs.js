/**
 * Google Docs Export Engine
 * Creates cleanly formatted Google Docs containing diary entries.
 * Scope: https://www.googleapis.com/auth/documents
 * NO CLIENT SECRETS are required or stored.
 */

import { loadGoogleIdentityServices } from '../backup/googleDrive';

const DOCS_SCOPE = 'https://www.googleapis.com/auth/documents';

/**
 * Requests an OAuth access token with Google Docs write permissions
 */
export async function requestGoogleDocsToken(clientId) {
  if (!clientId) {
    throw new Error('Please configure your Google OAuth Client ID in Settings first.');
  }

  await loadGoogleIdentityServices();

  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DOCS_SCOPE,
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          return reject(new Error(tokenResponse.error_description || tokenResponse.error));
        }
        resolve(tokenResponse.access_token);
      }
    });

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Exports a single diary entry to a newly created Google Doc
 */
export async function exportEntryToGoogleDocs(accessToken, entry) {
  if (!entry || !entry.date) {
    throw new Error('Invalid diary entry data.');
  }

  const [y, m, d] = entry.date.split('-').map(Number);
  const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const docTitle = entry.title
    ? `Diary: ${entry.title} (${entry.date})`
    : `Diary Entry - ${formattedDate}`;

  // 1. Create a blank document
  const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: docTitle })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create Google Doc: ${errorText}`);
  }

  const document = await createResponse.json();
  const documentId = document.documentId;

  // 2. Prepare formatted text content to insert
  let textToInsert = `${formattedDate}\n\n`;
  if (entry.title) {
    textToInsert += `${entry.title}\n\n`;
  }
  if (entry.mood) {
    textToInsert += `Mood: ${entry.mood}\n\n`;
  }
  textToInsert += `Dear Diary,\n\n${entry.content || '(No writing)'}\n\n---\nExported from Personal Digital Diary`;

  // 3. Insert formatted text using batchUpdate
  const updateResponse = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: textToInsert
            }
          }
        ]
      })
    }
  );

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to insert diary content: ${errorText}`);
  }

  return {
    documentId,
    title: docTitle,
    docUrl: `https://docs.google.com/document/d/${documentId}/edit`
  };
}

/**
 * Exports a diary entry as a human-readable text / markdown file (100% Offline)
 */
export function downloadEntryAsText(entry) {
  const [y, m, d] = entry.date.split('-').map(Number);
  const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  let fileContent = `# ${formattedDate}\n\n`;
  if (entry.title) fileContent += `## ${entry.title}\n\n`;
  if (entry.mood) fileContent += `**Mood:** ${entry.mood}\n\n`;
  if (entry.tags && entry.tags.length > 0) {
    fileContent += `**Tags:** ${entry.tags.map(t => `#${t}`).join(' ')}\n\n`;
  }
  fileContent += `Dear Diary,\n\n${entry.content || ''}\n\n`;

  const blob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `diary-entry-${entry.date}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats entry for browser printing (Save as PDF)
 */
export function printDiaryEntry(entry) {
  const [y, m, d] = entry.date.split('-').map(Number);
  const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Diary Entry - ${entry.date}</title>
        <style>
          body {
            font-family: 'Georgia', serif;
            line-height: 1.8;
            color: #2b2622;
            padding: 40px;
            max-width: 680px;
            margin: 0 auto;
          }
          h1 { font-size: 24px; margin-bottom: 4px; color: #845e3d; }
          h2 { font-size: 20px; margin-top: 0; }
          .meta { font-family: sans-serif; font-size: 13px; color: #797066; margin-bottom: 24px; }
          .content { font-size: 16px; white-space: pre-wrap; }
          .prompt { font-style: italic; color: #845e3d; margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <h1>${formattedDate}</h1>
        ${entry.title ? `<h2>${entry.title}</h2>` : ''}
        <div class="meta">
          ${entry.mood ? `Mood: ${entry.mood} ` : ''}
          ${entry.tags && entry.tags.length > 0 ? `· ${entry.tags.map(t => `#${t}`).join(' ')}` : ''}
        </div>
        <div class="prompt">Dear Diary,</div>
        <div class="content">${entry.content || ''}</div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
