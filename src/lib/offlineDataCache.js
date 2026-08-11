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
  // Clear stored server counts
  for (const type of Object.keys(TYPE_CACHE_KEYS)) {
    localStorage.removeItem(`hb9om_server_count_${type}`);
  }
  localStorage.removeItem("hb9om_server_count_repeater");
  localStorage.removeItem("hb9om_server_count_private_nodes");
  localStorage.removeItem("hb9om_server_count_qrz");
}

export async function cacheFromServer() {
  try {
    // Fetch overrides and QRZ in parallel (small datasets)
    const [overrides, qrzLookups] = await Promise.all([
      base44.entities.ReferenceOverride.list(),
      base44.entities.QrzLookup.list("-created_date", 200)
    ]);

    // Fetch reference data per-type (avoids downloading 50-100MB in one call)
    // and cache each type individually with slimming for large datasets
    for (const type of Object.keys(TYPE_CACHE_KEYS)) {
      try {
        await cacheTypeFromServer(type);
      } catch { /* continue with other types */ }
    }

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

// Slim down a reference to essential fields only — reduces JSON size by ~60-70%
// (drops verbose fields like link, description, elevation, etc. that aren't needed offline)
function slimReference(ref) {
  const s = {
    code: ref.code || ref.reference,
    name: ref.name,
    lat: ref.lat,
    lng: ref.lng,
  };
  if (ref.canton) s.canton = ref.canton;
  if (ref.parkType) s.parkType = ref.parkType;
  if (ref.scheme) s.scheme = ref.scheme;
  if (ref.region) s.region = ref.region;
  if (ref.wcaLocation) s.wcaLocation = ref.wcaLocation;
  if (ref.link) s.link = ref.link;
  return s;
}

// Slim down a repeater to essential fields — reduces JSON size by ~50%
function slimRepeater(r) {
  return {
    id: r.id,
    callsign: r.callsign,
    frequency: r.frequency,
    offset_mhz: r.offset_mhz,
    tone: r.tone,
    modes: r.modes,
    primary_mode: r.primary_mode,
    location_name: r.location_name,
    country: r.country,
    country_code: r.country_code,
    lat: r.lat,
    lng: r.lng,
    band: r.band,
    status: r.status,
    web_url: r.web_url,
    echolink_node: r.echolink_node,
    fm_funknetz: r.fm_funknetz,
    fm_funknetz_tgs: r.fm_funknetz_tgs,
    linked_callsigns: r.linked_callsigns,
    source_id: r.source_id,
  };
}

// Per-type storage budget in bytes — prevents one large type (SOTA: 181k refs)
// from consuming the entire localStorage quota, leaving no room for other types.
// Total budget across all types: ~6MB, leaving ~2MB for other app data.
const PER_TYPE_BUDGET_BYTES = 1.5 * 1024 * 1024; // 1.5MB per type

// Try to store data in localStorage — if quota exceeded, try progressively smaller subsets
function tryStoreRepeater(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
    return { stored: true, count: arr.length };
  } catch (e) {
    // Quota exceeded — try with slimmed-down version
    const slimmed = arr.map(slimRepeater);
    try {
      localStorage.setItem(key, JSON.stringify(slimmed));
      return { stored: true, count: slimmed.length, slimmed: true };
    } catch (e2) {
      return { stored: false, count: 0, error: "Speicher voll – " + arr.length + " Relais zu gross für lokalen Speicher" };
    }
  }
}

// Store data with a per-type budget — if data exceeds budget, binary-search for
// the max subset that fits (sorted nearest-to-Switzerland-first).
// Always leaves a 100KB buffer for other localStorage keys (timestamp, etc.)
function storeWithBudget(key, refs, slimmed, budgetBytes) {
  const jsonStr = JSON.stringify(refs);
  const sizeBytes = jsonStr.length * 2; // UTF-16

  // Fits within budget — try to store
  if (sizeBytes <= budgetBytes) {
    try {
      localStorage.setItem(key, jsonStr);
      return { stored: true, count: refs.length, slimmed };
    } catch (e) {
      // Even within budget, quota might be full from other keys — fall through to binary search
    }
  }

  // Sort nearest-to-Switzerland-first so the binary search keeps the most relevant refs
  const sorted = refs.slice().sort((a, b) => {
    const da = Math.abs((a.lat || 0) - 46.8) + Math.abs((a.lng || 0) - 8.2);
    const db = Math.abs((b.lat || 0) - 46.8) + Math.abs((b.lng || 0) - 8.2);
    return da - db;
  });

  // Binary search for max count that fits within budget
  let lo = 0, hi = sorted.length, fit = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const subset = sorted.slice(0, mid);
    const subsetStr = JSON.stringify(subset);
    if (subsetStr.length * 2 <= budgetBytes) {
      try {
        localStorage.removeItem(key);
        localStorage.setItem(key, subsetStr);
        fit = mid;
        lo = mid + 1;
      } catch {
        hi = mid - 1;
      }
    } else {
      hi = mid - 1;
    }
  }

  if (fit > 0) {
    return { stored: true, count: fit, slimmed: true, total: refs.length, truncated: true };
  }
  return { stored: false, count: 0, error: "Speicher voll – zu gross für lokalen Speicher" };
}

// Download a single reference type from the server (ReferenceData entity)
// Merges ALL entries of the type (handles multi-batch storage) and slims down
// references to fit within localStorage quota
export async function cacheTypeFromServer(type) {
  try {
    const entries = await base44.entities.ReferenceData.filter({ type });
    // Merge ALL entries of this type (not just the first — data may be in multiple batches)
    let allRefs = [];
    (entries || []).forEach(entry => {
      if (entry?.references && Array.isArray(entry.references)) {
        allRefs = allRefs.concat(entry.references);
      }
    });

    // Try to store full data first
    const key = TYPE_CACHE_KEYS[type];
    if (!key) return { success: false, count: 0, error: "Unbekannter Typ" };

    // Try full data first; if truncated, try slimmed to fit more
    let result = storeWithBudget(key, allRefs, false, PER_TYPE_BUDGET_BYTES);
    if (result.truncated) {
      const slimRefs = allRefs.map(slimReference);
      const slimResult = storeWithBudget(key, slimRefs, true, PER_TYPE_BUDGET_BYTES);
      if (slimResult.stored && slimResult.count >= result.count) {
        result = slimResult; // slimmed fits more than truncated full
      }
    }
    if (!result.stored) {
      // Full data didn't store at all — try slimmed
      const slimRefs = allRefs.map(slimReference);
      result = storeWithBudget(key, slimRefs, true, PER_TYPE_BUDGET_BYTES);
    }

    if (!result.stored) {
      return { success: false, count: 0, error: result.error };
    }

    // Set timestamp — catch quota error (data is already stored, don't fail)
    try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
    storeServerCount(type, allRefs.length);
    return { success: true, count: result.count, slimmed: result.slimmed, total: allRefs.length, truncated: result.truncated || false };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download repeaters from the server (Repeater entity)
export async function cacheRepeatersFromServer() {
  try {
    const repeaters = await base44.entities.Repeater.list("-created_date", 10000);
    const arr = repeaters || [];
    storeServerCount("repeater", arr.length);
    // Try full data first; if truncated, try slimmed to fit more
    let result = storeWithBudget("hb9om_refs_repeater", arr, false, PER_TYPE_BUDGET_BYTES);
    if (result.truncated) {
      const slimmed = arr.map(slimRepeater);
      const slimResult = storeWithBudget("hb9om_refs_repeater", slimmed, true, PER_TYPE_BUDGET_BYTES);
      if (slimResult.stored && slimResult.count >= result.count) {
        result = slimResult; // slimmed fits more than truncated full
      }
    }
    if (!result.stored) {
      const slimmed = arr.map(slimRepeater);
      result = storeWithBudget("hb9om_refs_repeater", slimmed, true, PER_TYPE_BUDGET_BYTES);
    }
    if (result.stored) {
      try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
      return { success: true, count: result.count, slimmed: result.slimmed, total: arr.length, truncated: result.truncated || false };
    }
    return { success: false, count: 0, error: result.error };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download private nodes (APRS) from the server
export async function cachePrivateNodesFromServer() {
  try {
    const nodes = await base44.entities.PrivateNode.list("-created_date", 5000);
    const arr = nodes || [];
    storeServerCount("private_nodes", arr.length);
    let result = storeWithBudget("hb9om_refs_private_nodes", arr, false, PER_TYPE_BUDGET_BYTES);
    if (!result.stored) {
      const slimmed = arr.map(n => ({
        id: n.id, callsign: n.callsign, node_type: n.node_type, frequency: n.frequency,
        mode: n.mode, network: n.network, node_number: n.node_number,
        location_name: n.location_name, country: n.country, country_code: n.country_code,
        lat: n.lat, lng: n.lng, description: n.description, aprs_symbol: n.aprs_symbol,
        source: n.source, status: n.status
      }));
      result = storeWithBudget("hb9om_refs_private_nodes", slimmed, true, PER_TYPE_BUDGET_BYTES);
    }
    if (result.stored) {
      try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
      return { success: true, count: result.count, slimmed: result.slimmed, total: arr.length, truncated: result.truncated || false };
    }
    return { success: false, count: 0, error: result.error };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download QRZ lookups from the server
export async function cacheQrzFromServer() {
  try {
    const qrz = await base44.entities.QrzLookup.list("-created_date", 500);
    cacheQrzLookups(qrz || []);
    storeServerCount("qrz", (qrz || []).length);
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
  localStorage.removeItem(`hb9om_server_count_${type}`);
}

// Store server count for a type (called after successful download)
export function storeServerCount(type, count) {
  try {
    localStorage.setItem(`hb9om_server_count_${type}`, String(count));
  } catch {}
}

// Get stored server count for a type (from last download)
export function getStoredServerCount(type) {
  try {
    const v = localStorage.getItem(`hb9om_server_count_${type}`);
    return v ? parseInt(v) : null;
  } catch { return null; }
}

// Get server-side counts for all data types (for showing download hints)
// NOTE: ReferenceData entries are NOT fetched here — each entry contains the full
// references array (181k for SOTA = 18-50MB) which causes timeouts. Instead, reference
// type counts come from the last successful download (stored in localStorage).
// Only repeaters, private_nodes, and QRZ are fetched live (small datasets).
export async function getServerDataCounts() {
  const counts = {};
  // Reference types — use stored counts from last download
  for (const type of Object.keys(TYPE_CACHE_KEYS)) {
    const stored = getStoredServerCount(type);
    if (stored != null) counts[type] = stored;
  }
  // Repeaters — list with limit to count (1237 repeaters = 1.89MB, acceptable)
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