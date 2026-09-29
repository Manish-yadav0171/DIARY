import { db } from '../database/db';
import { getAllEntries, saveSetting, getSetting } from '../database/diaryStore';

/**
 * Creates a complete structured backup of the diary data
 */
export async function createDiaryBackup() {
  const entries = await getAllEntries();
  const dearDiaryPref = await getSetting('dearDiaryEnabled', true);

  const backupData = {
    version: 1,
    appName: 'PersonalDigitalDiary',
    exportedAt: new Date().toISOString(),
    entryCount: entries.length,
    preferences: {
      dearDiaryEnabled: dearDiaryPref
    },
    entries: entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      title: entry.title || '',
      content: entry.content || '',
      mood: entry.mood || null,
      favourite: Boolean(entry.favourite),
      tags: entry.tags || [],
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.updatedAt || new Date().toISOString()
    }))
  };

  return backupData;
}

/**
 * Initiates a browser download of the diary backup JSON file
 */
export async function downloadBackupFile() {
  const backup = await createDiaryBackup();
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const todayStr = new Date().toISOString().slice(0, 10);
  const fileName = `diary-backup-${todayStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { fileName, count: backup.entryCount };
}

/**
 * Validates whether an uploaded or downloaded object is a valid diary backup
 */
export function validateBackup(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'File does not contain valid JSON data.' };
  }

  // Check if entries array exists
  if (!Array.isArray(data.entries)) {
    return {
      valid: false,
      error: 'Backup file is missing an "entries" list.'
    };
  }

  // Validate each entry has at least a date
  const hasInvalidEntry = data.entries.some(
    (e) => !e || typeof e !== 'object' || !e.date || typeof e.date !== 'string'
  );

  if (hasInvalidEntry) {
    return {
      valid: false,
      error: 'One or more entries in the backup are malformed (missing date).'
    };
  }

  return { valid: true, count: data.entries.length };
}

/**
 * Restores diary entries from a backup object
 * @param {Object} backupData - Parsed JSON backup object
 * @param {String} mode - 'merge' (default, safe) or 'replace'
 */
export async function restoreBackup(backupData, mode = 'merge') {
  const validation = validateBackup(backupData);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let addedCount = 0;
  let updatedCount = 0;

  if (mode === 'replace') {
    // Clear existing entries
    await db.entries.clear();
    for (const entry of backupData.entries) {
      await db.entries.put(entry);
      addedCount++;
    }
  } else {
    // Smart merge: preserve existing entries unless backup entry is newer
    for (const backupEntry of backupData.entries) {
      const existing = await db.entries
        .where('date')
        .equals(backupEntry.date)
        .first();

      if (!existing) {
        await db.entries.put(backupEntry);
        addedCount++;
      } else {
        const existingTime = new Date(existing.updatedAt || 0).getTime();
        const backupTime = new Date(backupEntry.updatedAt || 0).getTime();

        if (backupTime > existingTime) {
          // Backup is newer; update
          await db.entries.put({
            ...existing,
            ...backupEntry,
            id: existing.id // preserve local ID
          });
          updatedCount++;
        }
      }
    }
  }

  // Restore preferences if present
  if (backupData.preferences && backupData.preferences.dearDiaryEnabled !== undefined) {
    await saveSetting('dearDiaryEnabled', backupData.preferences.dearDiaryEnabled);
  }

  return { addedCount, updatedCount, total: backupData.entries.length };
}
