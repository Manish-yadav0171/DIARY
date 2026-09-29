import Dexie from 'dexie';

let currentDbInstance = null;
let currentDbName = null;

/**
 * Generates a safe, sanitized database name for a given user email
 */
export function getUserDbName(userEmail) {
  if (!userEmail) return 'PersonalDiaryDB_guest';
  const sanitized = userEmail.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
  return `PersonalDiaryDB_${sanitized}`;
}

/**
 * Creates and configures a Dexie instance for a specific database name
 */
function createDbInstance(dbName) {
  const instance = new Dexie(dbName);
  instance.version(1).stores({
    entries: 'id, &date, favourite, createdAt, updatedAt',
    settings: '&key'
  });
  return instance;
}

/**
 * Switches the active database to the given user's private store
 */
export function switchUserDatabase(userEmail) {
  const targetName = getUserDbName(userEmail);
  if (currentDbInstance && currentDbName === targetName) {
    return currentDbInstance;
  }

  if (currentDbInstance) {
    try {
      currentDbInstance.close();
    } catch (e) {
      console.warn('Failed to close previous Dexie instance:', e);
    }
  }

  currentDbName = targetName;
  currentDbInstance = createDbInstance(targetName);
  return currentDbInstance;
}

/**
 * Returns the currently active Dexie database instance.
 * Automatically initializes from localStorage if not yet set.
 */
export function getCurrentDb() {
  if (!currentDbInstance) {
    let email = null;
    try {
      const savedUser = localStorage.getItem('diary_current_user');
      if (savedUser) {
        email = JSON.parse(savedUser)?.email;
      }
    } catch (e) {
      console.warn('Failed to read saved diary user:', e);
    }
    switchUserDatabase(email);
  }
  return currentDbInstance;
}

/**
 * Transparent proxy to allow existing imports `import { db } from './db'`
 * to seamlessly route queries (e.g. `db.entries`, `db.settings`)
 * to the currently authenticated user's private database.
 */
export const db = new Proxy({}, {
  get(target, prop) {
    const active = getCurrentDb();
    const val = active[prop];
    if (typeof val === 'function') {
      return val.bind(active);
    }
    return val;
  }
});
