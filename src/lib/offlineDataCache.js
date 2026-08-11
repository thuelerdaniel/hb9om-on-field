import { base44 } from "@/api/base44Client";

const CACHE_KEY = "hb9om_offline_refs";
const OVERRIDES_KEY = "hb9om_offline_overrides";
const QRZ_CACHE_KEY = "hb9om_offline_qrz";
const TIMESTAMP_KEY = "hb9om_offline_cached_at";

// Per-type cache keys — splitting the giant JSON into per-type keys avoids a single
// 100k+ element JSON.parse that blocks the main thread for 100-200ms on startup.
const TYPE_CACHE_KEYS = {
  sota: "hb9om_refs_sota",
  pota: "hb9om_refs_pota",
  hbff: "hb9om_refs_hbff",
  wwbota: "hb9om_refs_wwbota",
  castle: "hb9om_refs_castle",
  iota: "hb9om_refs_iota",
  lighthouse: "hb9om_refs_lighthouse",
};

export function cacheReferenceData(data) {
  try {
    // Write per-type keys for fast lazy loading
    for (const [type, key] of Object.entries(TYPE_CACHE_KEYS)) {
      const refs = data?.[type];
      if (Array.isArray(refs)) {
        try { localStorage.setItem(key, JSON.stringify(refs)); } catch {}
      }
    }
    // Keep legacy key for backward compat (migrated on next load)
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());
  } catch (e) {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());
    } catch (e2) {}
  }
}

// Load a single type from its per-type key — O(n) parse for only the needed type
export function loadCachedReferenceType(type) {
  const key = TYPE_CACHE_KEYS[type];
  if (!key) return null;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Write a single type to its per-type key — allows incremental cache updates
// as data is fetched without rewriting the entire cache
export function cacheReferenceType(type, refs) {
  const key = TYPE_CACHE_KEYS[type];
  if (!key || !Array.isArray(refs)) return;
  try { localStorage.setItem(key, JSON.stringify(refs)); } catch {}
}

export function loadCachedReferenceData() {
  // Prefer per-type keys (lazy, avoids parsing all types at once)
  try {
    const result = {};
    let hasAny = false;
    for (const type of Object.keys(TYPE_CACHE_KEYS)) {
      const key = TYPE_CACHE_KEYS[type];
      const data = localStorage.getItem(key);
      if (data) {
        result[type] = JSON.parse(data);
        hasAny = true;
      }
    }
    if (hasAny) return result;
  } catch {}

  // Fallback to legacy single-key cache
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function cacheQrzLookups(lookups) {
  try {
    localStorage.setItem(QRZ_CACHE_KEY, JSON.stringify(lookups));
  } catch {}
}

export function loadCachedQrzLookups() {
  try {
    const data = localStorage.getItem(QRZ_CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function cacheOverrides(overrides) {
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {}
}

export function loadCachedOverrides() {
  try {
    const data = localStorage.getItem(OVERRIDES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function getCachedAt() {
  return localStorage.getItem(TIMESTAMP_KEY);
}

export function isOfflineReady() {
  return !!localStorage.getItem(CACHE_KEY);
}

// Get total size of all hb9om_ localStorage keys in bytes
export function getLocalCacheSize() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("hb9om_")) {
        const value = localStorage.getItem(key) || "";
        total += key.length + value.length;
      }
    }
  } catch {}
  return total * 2; // UTF-16: 2 bytes per char
}

// Get cache stats: size, reference count, last cached date
export function getLocalCacheStats() {
  const size = getLocalCacheSize();
  const cachedAt = getCachedAt();
  let count = 0;
  // Count from per-type keys directly — avoids parsing all types just to count
  for (const type of Object.keys(TYPE_CACHE_KEYS)) {
    const key = TYPE_CACHE_KEYS[type];
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const arr = JSON.parse(data);
        if (Array.isArray(arr)) count += arr.length;
      } catch {}
    }
  }
  // Fallback to legacy cache if per-type keys are empty
  if (count === 0) {
    const cache = loadCachedReferenceData();
    if (cache) {
      for (const refs of Object.values(cache)) {
        if (Array.isArray(refs)) count += refs.length;
      }
    }
  }
  return { size, count, cachedAt };
}

// Clear local reference cache (keeps other hb9om_ settings)
export function clearLocalReferenceCache() {
  localStorage.removeItem(CACHE_KEY);
  for (const key of Object.values(TYPE_CACHE_KEYS)) localStorage.removeItem(key);
  localStorage.removeItem(OVERRIDES_KEY);
  localStorage.removeItem(QRZ_CACHE_KEY);
  localStorage.removeItem(TIMESTAMP_KEY);
}

export async function cacheFromServer() {
  try {
    const [cached, overrides, qrzLookups] = await Promise.all([
      base44.entities.ReferenceData.list(),
      base44.entities.ReferenceOverride.list(),
      base44.entities.QrzLookup.list("-created_date", 200)
    ]);

    const data = { sota: [], pota: [], hbff: [], wwbota: [], castle: [], iota: [], lighthouse: [] };
    (cached || []).forEach(entry => {
      if (!entry.references) return;
      if (entry.type === 'sota') data.sota = entry.references;
      if (entry.type === 'pota') data.pota = entry.references;
      if (entry.type === 'hbff') data.hbff = entry.references;
      if (entry.type === 'wwbota') data.wwbota = entry.references;
      if (entry.type === 'castle') data.castle = entry.references;
      if (entry.type === 'iota') data.iota = entry.references;
      if (entry.type === 'lighthouse') data.lighthouse = entry.references;
    });
    cacheReferenceData(data);

    const overrideMap = {};
    (overrides || []).forEach(o => {
      const key = `${o.reference_type}:${o.original_code}`;
      overrideMap[key] = o;
    });
    cacheOverrides(overrideMap);

    // Cache QRZ lookups for offline use
    cacheQrzLookups(qrzLookups || []);

    return true;
  } catch (e) {
    return false;
  }
}