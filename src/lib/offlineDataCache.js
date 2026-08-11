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

// --- Per-type cache operations ---

// Download a single reference type from the server (ReferenceData entity)
export async function cacheTypeFromServer(type) {
  try {
    const entries = await base44.entities.ReferenceData.filter({ type });
    const entry = (entries || [])[0];
    const refs = entry?.references || [];
    cacheReferenceType(type, refs);
    // Update timestamp
    localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());
    return { success: true, count: refs.length };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download repeaters from the server (Repeater entity)
export async function cacheRepeatersFromServer() {
  try {
    const repeaters = await base44.entities.Repeater.list("-created_date", 10000);
    const arr = repeaters || [];
    try { localStorage.setItem("hb9om_refs_repeater", JSON.stringify(arr)); } catch {}
    localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());
    return { success: true, count: arr.length };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download private nodes (APRS) from the server
export async function cachePrivateNodesFromServer() {
  try {
    const nodes = await base44.entities.PrivateNode.list("-created_date", 5000);
    const arr = nodes || [];
    try { localStorage.setItem("hb9om_refs_private_nodes", JSON.stringify(arr)); } catch {}
    localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());
    return { success: true, count: arr.length };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download QRZ lookups from the server
export async function cacheQrzFromServer() {
  try {
    const qrz = await base44.entities.QrzLookup.list("-created_date", 500);
    cacheQrzLookups(qrz || []);
    return { success: true, count: (qrz || []).length };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Load cached repeaters
export function loadCachedRepeaters() {
  try {
    const data = localStorage.getItem("hb9om_refs_repeater");
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

// Load cached private nodes
export function loadCachedPrivateNodes() {
  try {
    const data = localStorage.getItem("hb9om_refs_private_nodes");
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

// Get per-type local cache stats (count + size in bytes)
export function getReferenceTypeStats() {
  const stats = {};
  // Reference types from TYPE_CACHE_KEYS
  for (const [type, key] of Object.entries(TYPE_CACHE_KEYS)) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const arr = JSON.parse(data);
        stats[type] = { count: Array.isArray(arr) ? arr.length : 0, size: (key.length + data.length) * 2 };
      } else {
        stats[type] = { count: 0, size: 0 };
      }
    } catch {
      stats[type] = { count: 0, size: 0 };
    }
  }
  // Repeaters
  try {
    const data = localStorage.getItem("hb9om_refs_repeater");
    if (data) {
      const arr = JSON.parse(data);
      stats.repeater = { count: Array.isArray(arr) ? arr.length : 0, size: ("hb9om_refs_repeater".length + data.length) * 2 };
    } else { stats.repeater = { count: 0, size: 0 }; }
  } catch { stats.repeater = { count: 0, size: 0 }; }
  // Private nodes
  try {
    const data = localStorage.getItem("hb9om_refs_private_nodes");
    if (data) {
      const arr = JSON.parse(data);
      stats.private_nodes = { count: Array.isArray(arr) ? arr.length : 0, size: ("hb9om_refs_private_nodes".length + data.length) * 2 };
    } else { stats.private_nodes = { count: 0, size: 0 }; }
  } catch { stats.private_nodes = { count: 0, size: 0 }; }
  // QRZ
  try {
    const data = localStorage.getItem(QRZ_CACHE_KEY);
    if (data) {
      const arr = JSON.parse(data);
      stats.qrz = { count: Array.isArray(arr) ? arr.length : 0, size: (QRZ_CACHE_KEY.length + data.length) * 2 };
    } else { stats.qrz = { count: 0, size: 0 }; }
  } catch { stats.qrz = { count: 0, size: 0 }; }
  return stats;
}

// Clear a single type from local cache
export function clearReferenceType(type) {
  const key = TYPE_CACHE_KEYS[type];
  if (key) localStorage.removeItem(key);
  if (type === "repeater") localStorage.removeItem("hb9om_refs_repeater");
  if (type === "private_nodes") localStorage.removeItem("hb9om_refs_private_nodes");
  if (type === "qrz") localStorage.removeItem(QRZ_CACHE_KEY);
}

// Get server-side counts for all data types (for showing download hints)
export async function getServerDataCounts() {
  const counts = {};
  try {
    const entries = await base44.entities.ReferenceData.list();
    (entries || []).forEach(entry => {
      if (entry.type) counts[entry.type] = entry.total_count || (entry.references?.length || 0);
    });
  } catch {}
  // Repeaters - quick list to count (limit 10000)
  try {
    const repeaters = await base44.entities.Repeater.list("-created_date", 10000);
    counts.repeater = (repeaters || []).length;
  } catch { counts.repeater = 0; }
  // Private nodes
  try {
    const nodes = await base44.entities.PrivateNode.list("-created_date", 5000);
    counts.private_nodes = (nodes || []).length;
  } catch { counts.private_nodes = 0; }
  // QRZ
  try {
    const qrz = await base44.entities.QrzLookup.list("-created_date", 500);
    counts.qrz = (qrz || []).length;
  } catch { counts.qrz = 0; }
  return counts;
}

// Check offline readiness — returns what's ready and what's missing
export function getOfflineReadiness() {
  const stats = getReferenceTypeStats();
  const readiness = {
    sota: stats.sota.count > 0,
    pota: stats.pota.count > 0,
    hbff: stats.hbff.count > 0,
    wwbota: stats.wwbota.count > 0,
    castle: stats.castle.count > 0,
    iota: stats.iota.count > 0,
    lighthouse: stats.lighthouse.count > 0,
    repeater: stats.repeater.count > 0,
    private_nodes: stats.private_nodes.count > 0,
    qrz: stats.qrz.count > 0,
    mapTiles: false, // set by caller from offlineMapStore
  };
  readiness.allRefs = readiness.sota && readiness.pota && readiness.hbff && readiness.wwbota &&
    readiness.castle && readiness.iota && readiness.lighthouse;
  return readiness;
}