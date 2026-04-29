const DB_NAME = 'chiller-assistant-db';
const DB_VERSION = 1;
const THREADS_STORE = 'threads';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'assistant-settings';

const defaultSettings = {
  model: 'openrouter/free',
  apiUrl: '/api/assistant',
  autoOpenCharts: true,
  saveChats: true,
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(THREADS_STORE)) {
        database.createObjectStore(THREADS_STORE, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open assistant database.'));
  });
}

function wrapRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

export async function loadAssistantThreads() {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(THREADS_STORE, 'readonly');
    const store = transaction.objectStore(THREADS_STORE);
    const rows = await wrapRequest(store.getAll());
    database.close();
    return Array.isArray(rows) ? rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')) : [];
  } catch {
    return [];
  }
}

export async function saveAssistantThread(thread) {
  const database = await openDatabase();
  const transaction = database.transaction(THREADS_STORE, 'readwrite');
  const store = transaction.objectStore(THREADS_STORE);
  await wrapRequest(store.put(thread));
  database.close();
  return thread;
}

export async function deleteAssistantThread(threadId) {
  const database = await openDatabase();
  const transaction = database.transaction(THREADS_STORE, 'readwrite');
  const store = transaction.objectStore(THREADS_STORE);
  await wrapRequest(store.delete(threadId));
  database.close();
}

export async function loadAssistantSettings() {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(SETTINGS_STORE, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    const row = await wrapRequest(store.get(SETTINGS_KEY));
    database.close();
    return {
      ...defaultSettings,
      ...(row?.value || {}),
    };
  } catch {
    return defaultSettings;
  }
}

export async function saveAssistantSettings(settings) {
  const nextSettings = {
    ...defaultSettings,
    ...settings,
  };

  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE, 'readwrite');
  const store = transaction.objectStore(SETTINGS_STORE);
  await wrapRequest(
    store.put({
      id: SETTINGS_KEY,
      value: nextSettings,
    }),
  );
  database.close();
  return nextSettings;
}

export { defaultSettings as assistantDefaultSettings };
