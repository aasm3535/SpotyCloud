/**
 * Persistent file-based storage using Tauri FS.
 * Data is saved to Documents/SpotyCloud/data/ so it survives app updates.
 * Falls back to localStorage during SSR or if Tauri is unavailable.
 */

import {
  readTextFile,
  writeTextFile,
  mkdir,
  exists,
} from '@tauri-apps/plugin-fs';
import { documentDir, join } from '@tauri-apps/api/path';

let basePath: string | null = null;
let initPromise: Promise<void> | null = null;

// Cache for loaded data (avoids repeated file reads)
const cache = new Map<string, unknown>();

async function ensureDir(): Promise<string> {
  if (basePath) return basePath;
  if (initPromise) {
    await initPromise;
    return basePath!;
  }

  initPromise = (async () => {
    const docDir = await documentDir();
    basePath = await join(docDir, 'SpotyCloud', 'data');
    const dirExists = await exists(basePath);
    if (!dirExists) {
      await mkdir(basePath, { recursive: true });
    }
  })();

  await initPromise;
  return basePath!;
}

/**
 * Load data from persistent storage.
 * First checks in-memory cache, then file, then localStorage (migration), then returns defaultValue.
 */
export async function loadData<T>(key: string, defaultValue: T): Promise<T> {
  // Check cache first
  if (cache.has(key)) {
    return cache.get(key) as T;
  }

  try {
    const dir = await ensureDir();
    const filePath = await join(dir, `${key}.json`);
    const fileExists = await exists(filePath);

    if (fileExists) {
      const content = await readTextFile(filePath);
      const data = JSON.parse(content) as T;
      cache.set(key, data);
      return data;
    }

    // Migration: check localStorage for existing data
    if (typeof localStorage !== 'undefined') {
      const localData = localStorage.getItem(key);
      if (localData) {
        const parsed = JSON.parse(localData) as T;
        // Save to file for future use
        await saveData(key, parsed);
        // Remove from localStorage after successful migration
        localStorage.removeItem(key);
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`[Storage] Failed to load "${key}":`, e);

    // Final fallback: try localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const localData = localStorage.getItem(key);
        if (localData) return JSON.parse(localData) as T;
      } catch {}
    }
  }

  cache.set(key, defaultValue);
  return defaultValue;
}

/**
 * Save data to persistent file storage.
 */
export async function saveData<T>(key: string, data: T): Promise<void> {
  cache.set(key, data);

  try {
    const dir = await ensureDir();
    const filePath = await join(dir, `${key}.json`);
    await writeTextFile(filePath, JSON.stringify(data));
  } catch (e) {
    console.warn(`[Storage] Failed to save "${key}":`, e);
    // Fallback: try localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {}
    }
  }
}

/**
 * Synchronous load from cache or localStorage (for initial state before async init).
 * Use loadData() for the authoritative async version.
 */
export function loadDataSync<T>(key: string, defaultValue: T): T {
  if (cache.has(key)) {
    return cache.get(key) as T;
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data) as T;
        cache.set(key, parsed);
        return parsed;
      }
    } catch {}
  }

  return defaultValue;
}

/**
 * Initialize storage: migrate all known keys from localStorage to file storage.
 * Call this once on app startup.
 */
export async function initStorage(): Promise<void> {
  const keysToMigrate = [
    'liked_tracks',
    'liked_tracks_data',
    'spotycloud_playlists',
    'app_settings',
    'eq_state',
    'wave_disliked',
    'spotycloud_client_id',
    'spotycloud_offline_tracks',
    'spotycloud_onboarding_done',
  ];

  for (const key of keysToMigrate) {
    try {
      // This will auto-migrate from localStorage to file if needed
      await loadData(key, null);
    } catch (e) {
      console.warn(`[Storage] Migration failed for "${key}":`, e);
    }
  }

  console.log('[Storage] Initialization complete');
}
