// Client-side boundary cache using IndexedDB.
// Persists fetched boundaries locally so re-displaying (re-selection, filter
// change, app restart) draws the polygon immediately — ZERO network calls.
//
// Key: `${program}:${reference}`  (e.g. "pota:CH-0224", "wwff:DLFF-0001")
// Value: { polygon: [[lat,lng],...], has_boundary: boolean, name: string, cached_date: string }
//
// Storage: IndexedDB (handles large polygon arrays better than localStorage).
// Falls back to localStorage with LRU eviction if IndexedDB is unavailable.

const DB_NAME = "hb9om_boundary_cache";
const STORE_NAME = "boundaries";
const DB_VERSION = 1;
const LS_PREFIX = "hb9om_bcache_";
const LS_MAX_ENTRIES = 200; // LRU limit for localStorage fallback

let dbPromise = null;

// --- IndexedDB setup ---
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null); // graceful fallback
  });
  return dbPromise;
}

function makeKey(program, reference) {
  return `${program}:${reference}`;
}

// --- IndexedDB operations ---
async function idbGet(key) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value || null);
    req.onerror = () => resolve(null);
  });
}

async function idbGetMany(keys) {
  const db = await openDB();
  if (!db) return {};
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const results = {};
    let pending = keys.length;
    if (pending === 0) { resolve(results); return; }
    for (const key of keys) {
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result?.value) results[key] = req.result.value;
        if (--pending === 0) resolve(results);
      };
      req.onerror = () => { if (--pending === 0) resolve(results); };
    }
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// --- localStorage fallback (LRU) ---
function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    // Update access time for LRU
    const val = JSON.parse(raw);
    val._accessed = Date.now();
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
    delete val._accessed;
    return val;
  } catch { return null; }
}

function lsSet(key, value) {
  try {
    const val = { ...value, _accessed: Date.now() };
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
    // LRU eviction if too many entries
    evictLRU();
  } catch { /* QuotaExceeded — silent */ }
}

function evictLRU() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) keys.push(k);
    }
    if (keys.length <= LS_MAX_ENTRIES) return;
    // Sort by _accessed time, remove oldest
    const entries = keys.map(k => {
      try {
        const v = JSON.parse(localStorage.getItem(k) || "{}");
        return { key: k, accessed: v._accessed || 0 };
      } catch { return { key: k, accessed: 0 }; }
    });
    entries.sort((a, b) => a.accessed - b.accessed);
    const toRemove = entries.slice(0, keys.length - LS_MAX_ENTRIES);
    for (const e of toRemove) localStorage.removeItem(e.key);
  } catch { /* silent */ }
}

// --- Public API ---

// Get a single cached boundary. Returns { polygon, has_boundary, name } or null.
export async function getCachedBoundary(program, reference) {
  const key = makeKey(program, reference);
  const val = await idbGet(key);
  if (val) return val;
  return lsGet(key);
}

// Get multiple cached boundaries at once. Returns { "CH-0224": { polygon, ... }, ... }
export async function getCachedBoundaries(program, references) {
  const keys = references.map(r => makeKey(program, r));
  const idbResults = await idbGetMany(keys);
  const results = {};
  // Parse IDB results back to reference keys
  for (const ref of references) {
    const key = makeKey(program, ref);
    if (idbResults[key]) {
      results[ref] = idbResults[key];
    }
  }
  // Fill from localStorage fallback for any missing
  for (const ref of references) {
    if (!results[ref]) {
      const lsVal = lsGet(makeKey(program, ref));
      if (lsVal) results[ref] = lsVal;
    }
  }
  return results;
}

// Store a single boundary in the client cache.
export async function setCachedBoundary(program, reference, data) {
  const key = makeKey(program, reference);
  const value = {
    polygon: data.polygon || null,
    has_boundary: data.has_boundary || false,
    name: data.name || "",
    cached_date: new Date().toISOString(),
  };
  await idbSet(key, value);
  lsSet(key, value); // also write to LS as backup
}

// Store multiple boundaries at once (from batch fetch).
export async function setCachedBoundaries(program, boundaryMap) {
  const tasks = [];
  for (const [ref, data] of Object.entries(boundaryMap)) {
    if (data && (data.polygon || data.has_boundary === false)) {
      tasks.push(setCachedBoundary(program, ref, data));
    }
  }
  await Promise.all(tasks);
}