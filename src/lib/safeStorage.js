// Safe localStorage wrappers that catch QuotaExceededError and prevent app crashes.
// Large reference data (SOTA, POTA, repeaters, etc.) is stored in IndexedDB instead
// of localStorage — IndexedDB has 50MB–several GB capacity vs localStorage's 5MB limit.

// ---------------------------------------------------------------------------
// IndexedDB for large offline reference data
// ---------------------------------------------------------------------------

const IDB_NAME = "hb9om_offline_refs";
const IDB_VERSION = 1;
const IDB_STORE = "refs";

let idbPromise = null;

function getIDB() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}

// Store a large value in IndexedDB under a key.
// Returns true on success, false on failure.
export async function idbSet(key, value) {
  try {
    const db = await getIDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// Get a large value from IndexedDB by key. Returns null if not found.
export async function idbGet(key) {
  try {
    const db = await getIDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Delete a key from IndexedDB.
export async function idbDelete(key) {
  try {
    const db = await getIDB();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// Get all keys in IndexedDB that start with a prefix.
export async function idbGetKeys(prefix) {
  try {
    const db = await getIDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result || []).filter(k =>
          typeof k === "string" && (!prefix || k.startsWith(prefix))
        );
        resolve(keys);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Clear all keys in IndexedDB that start with a prefix.
export async function idbClearPrefix(prefix) {
  try {
    const keys = await idbGetKeys(prefix);
    for (const key of keys) {
      await idbDelete(key);
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Safe localStorage wrappers
// ---------------------------------------------------------------------------

// Keys that store LARGE data in localStorage and should be migrated/cleaned.
// These are the offline reference data keys that can each be 1-2 MB.
const LARGE_DATA_KEY_PREFIXES = [
  "hb9om_refs_",          // per-type and per-country reference data
  "hb9om_offline_refs",  // legacy combined cache
  "hb9om_offline_qrz",   // QRZ lookups
];

// Keys that are small metadata and should be kept in localStorage.
const SMALL_METADATA_PREFIXES = [
  "hb9om_server_count_",
  "hb9om_truncated_",
  "hb9om_offline_countries_",
  "hb9om_country_count_",
  "hb9om_offline_countries",
];

// Check if a key stores large data (should be in IndexedDB, not localStorage)
function isLargeDataKey(key) {
  return LARGE_DATA_KEY_PREFIXES.some(p => key.startsWith(p));
}

// Try to set a localStorage item. If QuotaExceededError, run cleanup and retry.
// Returns true on success, false on failure (app never crashes).
export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    // Quota exceeded — try cleanup then retry
    if (isQuotaError(e)) {
      cleanupLargeLocalStorageData();
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

// Safe get — never throws
export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Safe JSON set with size check. Serializes, checks size, uses safeSetItem.
// Returns true on success, false if too large or quota exceeded.
export function safeSetJSON(key, value, maxSizeBytes = 50000) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > maxSizeBytes) {
      console.warn(`[safeStorage] ${key} too large: ${(serialized.length / 1024).toFixed(1)} KB (max ${(maxSizeBytes / 1024).toFixed(0)} KB) — not saved`);
      return false;
    }
    return safeSetItem(key, serialized);
  } catch {
    return false;
  }
}

// Safe JSON get — parses JSON, never throws
export function safeGetJSON(key, fallback = null) {
  try {
    const raw = safeGetItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Safe remove — never throws
export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// Check if an error is a quota exceeded error
function isQuotaError(e) {
  if (!e) return false;
  const name = e.name || "";
  const msg = e.message || "";
  return name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    msg.includes("quota") ||
    msg.includes("Quota");
}

// Remove large data from localStorage that should be in IndexedDB.
// Also removes legacy keys that are no longer needed.
// Returns the number of bytes freed.
export function cleanupLargeLocalStorageData() {
  let freed = 0;
  try {
    const keysToRemove = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && isLargeDataKey(key)) {
        const value = localStorage.getItem(key) || "";
        freed += (key.length + value.length) * 2;
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      try { localStorage.removeItem(key); } catch {}
    }
  } catch {}
  return freed;
}

// Full cleanup: remove ALL hb9om_ data from localStorage (large + small).
// Used by the "App-Speicher löschen" button in Settings.
// Returns stats about what was removed.
export function fullStorageCleanup() {
  let freed = 0;
  let keysRemoved = 0;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("hb9om_")) {
        const value = localStorage.getItem(key) || "";
        freed += (key.length + value.length) * 2;
        try {
          localStorage.removeItem(key);
          keysRemoved++;
        } catch {}
      }
    }
  } catch {}
  return { freed, keysRemoved };
}

// Get total size of all hb9om_ localStorage keys in bytes
export function getLocalStorageSize() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("hb9om_")) {
        const value = localStorage.getItem(key) || "";
        total += (key.length + value.length) * 2;
      }
    }
  } catch {}
  return total;
}

// Get a breakdown of localStorage usage by category
export function getLocalStorageStats() {
  const categories = {
    referenceData: 0,   // hb9om_refs_*
    filterState: 0,     // hb9om_filter_state
    settings: 0,        // hb9om_*_mode, hb9om_*_enabled, etc.
    mapState: 0,        // hb9om_map_state, hb9om_base_layer, etc.
    offlineMeta: 0,     // hb9om_server_count_*, hb9om_truncated_*, etc.
    logCache: 0,        // hb9om_log_cache
    other: 0,
  };
  let total = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("hb9om_")) continue;
      const value = localStorage.getItem(key) || "";
      const size = (key.length + value.length) * 2;
      total += size;

      if (key.startsWith("hb9om_refs_") || key === "hb9om_offline_refs") {
        categories.referenceData += size;
      } else if (key === "hb9om_filter_state") {
        categories.filterState += size;
      } else if (key === "hb9om_log_cache" || key === "hb9om_log_last_sync") {
        categories.logCache += size;
      } else if (
        key.startsWith("hb9om_server_count_") ||
        key.startsWith("hb9om_truncated_") ||
        key.startsWith("hb9om_offline_countries_") ||
        key.startsWith("hb9om_country_count_") ||
        key === "hb9om_offline_cached_at"
      ) {
        categories.offlineMeta += size;
      } else if (
        key === "hb9om_map_state" ||
        key === "hb9om_base_layer" ||
        key === "hb9om_locked_scale" ||
        key === "hb9om_map_opacity" ||
        key === "hb9om_active_layers" ||
        key === "hb9om_active_continents" ||
        key === "hb9om_active_countries"
      ) {
        categories.mapState += size;
      } else {
        categories.other += size;
      }
    }
  } catch {}

  return { total, categories };
}