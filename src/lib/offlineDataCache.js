import { base44 } from "@/api/base44Client";

const CACHE_KEY = "hb9om_offline_refs";
const OVERRIDES_KEY = "hb9om_offline_overrides";
const QRZ_CACHE_KEY = "hb9om_offline_qrz";
const TIMESTAMP_KEY = "hb9om_offline_cached_at";

export function cacheReferenceData(data) {
  try {
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

export function loadCachedReferenceData() {
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
  const cache = loadCachedReferenceData();
  let count = 0;
  if (cache) {
    for (const refs of Object.values(cache)) {
      if (Array.isArray(refs)) count += refs.length;
    }
  }
  return { size, count, cachedAt };
}

// Clear local reference cache (keeps other hb9om_ settings)
export function clearLocalReferenceCache() {
  localStorage.removeItem(CACHE_KEY);
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