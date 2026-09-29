import { db } from './db';
import Dexie from 'dexie';

/**
 * Converts a Date object or date string into a local YYYY-MM-DD string key
 */
export function formatDateToKey(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date key in YYYY-MM-DD format
 */
export function getTodayDateKey() {
  return formatDateToKey(new Date());
}

/**
 * Returns previous day's date key
 */
export function getPreviousDay(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return formatDateToKey(dt);
}

/**
 * Returns next day's date key
 */
export function getNextDay(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return formatDateToKey(dt);
}

/**
 * Fetches an entry for a specific date (YYYY-MM-DD)
 */
export async function getEntryByDate(dateKey) {
  try {
    return await db.entries.where('date').equals(dateKey).first();
  } catch (error) {
    console.error('Failed to get entry by date:', error);
    return null;
  }
}

/**
 * Fetches all entries for a specific year and month (month is 1-indexed, e.g., 9 for September)
 */
export async function getEntriesForMonth(year, month) {
  try {
    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;
    return await db.entries
      .where('date')
      .between(`${prefix}-01`, `${prefix}-31`, true, true)
      .toArray();
  } catch (error) {
    console.error('Failed to get entries for month:', error);
    return [];
  }
}

/**
 * Fetches entries written on the same calendar day in past years ("On This Day")
 */
export async function getOnThisDayMemories(dateKey = getTodayDateKey()) {
  try {
    const [currentYear, month, day] = dateKey.split('-');
    const suffix = `-${month}-${day}`;
    const all = await db.entries.toArray();
    return all
      .filter((entry) => {
        if (!entry.date) return false;
        const entryYear = entry.date.split('-')[0];
        return (
          entry.date.endsWith(suffix) &&
          entryYear !== currentYear &&
          Boolean(entry.content || entry.title)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('Failed to get On This Day memories:', error);
    return [];
  }
}

/**
 * Local search across diary titles, contents, moods, and dates
 */
export async function searchEntries(query) {
  try {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const all = await db.entries.toArray();

    return all
      .filter((entry) => {
        const matchTitle = entry.title && entry.title.toLowerCase().includes(q);
        const matchContent = entry.content && entry.content.toLowerCase().includes(q);
        const matchMood = entry.mood && entry.mood.toLowerCase().includes(q);
        const matchDate = entry.date && entry.date.includes(q);
        return matchTitle || matchContent || matchMood || matchDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('Failed to search entries:', error);
    return [];
  }
}

/**
 * Saves or updates a diary entry
 */
export async function saveOrUpdateEntry(entryData) {
  try {
    const now = new Date().toISOString();
    const dateKey = entryData.date || getTodayDateKey();

    // Check if an entry already exists for this date
    const existing = await db.entries.where('date').equals(dateKey).first();

    const recordToSave = {
      id: existing ? existing.id : (entryData.id || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      date: dateKey,
      title: entryData.title !== undefined ? entryData.title : (existing?.title || ''),
      content: entryData.content !== undefined ? entryData.content : (existing?.content || ''),
      mood: entryData.mood !== undefined ? entryData.mood : (existing?.mood || null),
      favourite: entryData.favourite !== undefined ? Boolean(entryData.favourite) : (existing?.favourite || false),
      tags: entryData.tags || existing?.tags || [],
      photos: entryData.photos || existing?.photos || [],
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    await db.entries.put(recordToSave);
    return recordToSave;
  } catch (error) {
    console.error('Failed to save entry:', error);
    throw error;
  }
}

/**
 * Gets all entries sorted by date descending
 */
export async function getAllEntries() {
  try {
    return await db.entries.orderBy('date').reverse().toArray();
  } catch (error) {
    console.error('Failed to fetch all entries:', error);
    return [];
  }
}

/**
 * Gets all entries marked as favourites
 */
export async function getFavouriteEntries() {
  try {
    return await db.entries.filter((e) => Boolean(e.favourite)).toArray();
  } catch (error) {
    console.error('Failed to fetch favourite entries:', error);
    return [];
  }
}

/**
 * Deletes an entry by ID
 */
export async function deleteEntry(id) {
  try {
    await db.entries.delete(id);
    return true;
  } catch (error) {
    console.error('Failed to delete entry:', error);
    return false;
  }
}

/**
 * Settings helpers
 */
export async function getSetting(key, defaultValue = null) {
  try {
    const record = await db.settings.get(key);
    return record ? record.value : defaultValue;
  } catch (error) {
    console.error(`Failed to get setting ${key}:`, error);
    return defaultValue;
  }
}

export async function saveSetting(key, value) {
  try {
    await db.settings.put({ key, value });
    return true;
  } catch (error) {
    console.error(`Failed to save setting ${key}:`, error);
    return false;
  }
}

/**
 * PIN security management helpers
 */
export async function getUserPin() {
  return await getSetting('security_pin', null);
}

export async function setUserPin(pin) {
  if (!pin || pin.length !== 4) {
    throw new Error('PIN must be exactly 4 digits');
  }
  await saveSetting('security_pin', pin);
  await saveSetting('security_pin_enabled', true);
  return true;
}

export async function removeUserPin() {
  await saveSetting('security_pin', null);
  await saveSetting('security_pin_enabled', false);
  return true;
}

export async function isPinLockEnabled() {
  const enabled = await getSetting('security_pin_enabled', false);
  const pin = await getSetting('security_pin', null);
  return Boolean(enabled && pin);
}

export async function setPinLockEnabled(enabled) {
  await saveSetting('security_pin_enabled', Boolean(enabled));
}

/**
 * Auto-lock on idle / tab blur preference
 */
export async function getAutoLockPreference() {
  return await getSetting('auto_lock_on_blur', false);
}

export async function setAutoLockPreference(enabled) {
  await saveSetting('auto_lock_on_blur', Boolean(enabled));
}

/**
 * Migration helper: If an existing user was using the legacy global DB,
 * copy entries into this user's newly partitioned DB so no data is lost.
 */
export async function migrateLegacyDataIfEmpty() {
  try {
    const existingCount = await db.entries.count();
    if (existingCount > 0) return false;

    // Check if Dexie legacy database exists
    const legacyExists = await Dexie.exists('PersonalDiaryDB');
    if (!legacyExists) return false;

    const legacyDb = new Dexie('PersonalDiaryDB');
    legacyDb.version(1).stores({
      entries: 'id, &date, favourite, createdAt, updatedAt',
      settings: '&key'
    });

    const legacyEntries = await legacyDb.entries.toArray();
    if (legacyEntries && legacyEntries.length > 0) {
      for (const entry of legacyEntries) {
        await db.entries.put(entry);
      }
      console.log(`Migrated ${legacyEntries.length} entries from legacy database.`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Legacy database migration skipped:', err);
    return false;
  }
}

