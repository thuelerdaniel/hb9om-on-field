import { base44 } from "@/api/base44Client";
import { getCountryFromSotaCode, getCountryFromPotaRef, getCountryFromWwffCode, getCountryFromWwbotaScheme, getCountryByName, getCountryFromWcaCode, getCountryFromLatLng } from "@/lib/countries";

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

// Load a single type — merges per-country keys if present, otherwise reads single-key cache
export function loadCachedReferenceType(type) {
  // Check for per-country keys first (country-filtered download)
  const countries = getCachedCountriesForType(type);
  if (countries.length > 0) {
    const merged = [];
    for (const country of countries) {
      try {
        const data = localStorage.getItem(`hb9om_refs_${type}_${country}`);
        if (data) {
          const arr = JSON.parse(data);
          if (Array.isArray(arr)) merged.push(...arr);
        }
      } catch {}
    }
    return merged.length > 0 ? merged : null;
  }
  // Fallback to single-key cache
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
  // Use loadCachedReferenceType which handles per-country keys
  try {
    const result = {};
    let hasAny = false;
    for (const type of Object.keys(TYPE_CACHE_KEYS)) {
      const refs = loadCachedReferenceType(type);
      if (refs) {
        result[type] = refs;
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
  // Count from per-country keys and per-type keys
  for (const type of Object.keys(TYPE_CACHE_KEYS)) {
    const stats = getTypeStats(type, TYPE_CACHE_KEYS[type]);
    count += stats.count;
  }
  // Count repeaters (per-country or single-key)
  count += getTypeStats("repeater", "hb9om_refs_repeater").count;
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
  // Clear per-country keys for all reference types and repeaters
  for (const type of Object.keys(TYPE_CACHE_KEYS)) clearPerCountryKeys(type);
  clearPerCountryKeys("repeater");
  localStorage.removeItem("hb9om_refs_repeater");
  localStorage.removeItem("hb9om_refs_private_nodes");
  localStorage.removeItem("hb9om_refs_tota");
  localStorage.removeItem(OVERRIDES_KEY);
  localStorage.removeItem(QRZ_CACHE_KEY);
  localStorage.removeItem(TIMESTAMP_KEY);
  // Clear stored server counts
  for (const type of Object.keys(TYPE_CACHE_KEYS)) {
    localStorage.removeItem(`hb9om_server_count_${type}`);
    localStorage.removeItem(`hb9om_truncated_${type}`);
  }
  localStorage.removeItem("hb9om_server_count_repeater");
  localStorage.removeItem("hb9om_server_count_private_nodes");
  localStorage.removeItem("hb9om_server_count_tota");
  localStorage.removeItem("hb9om_server_count_qrz");
  localStorage.removeItem("hb9om_truncated_repeater");
  localStorage.removeItem("hb9om_truncated_private_nodes");
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

// Slim down a reference to essential fields only — reduces JSON size by ~70-80%.
// Only keeps fields needed for offline map display (markers + popups).
// Drops verbose fields: link (URLs useless offline), canton, region, wcaLocation, active.
// parkType is only kept for POTA (needed for popup display); dropped for WWBOTA to save space.
function slimReference(ref) {
  const s = {
    code: ref.code || ref.reference,
    name: ref.name,
    lat: ref.lat,
    lng: ref.lng,
  };
  // scheme needed for WWBOTA color coding (small field, always keep if present)
  if (ref.scheme) s.scheme = ref.scheme;
  // parkType only needed for POTA popup display — skip for WWBOTA (saves ~30 bytes/ref)
  if (ref.parkType && !ref.scheme) s.parkType = ref.parkType;
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

// Per-country storage budget — when downloading by country, each country gets its own
// localStorage key with this budget. This allows 6-10 countries to fit without hitting
// the quota limit that a single large key would reach.
const PER_COUNTRY_BUDGET_BYTES = 2.5 * 1024 * 1024; // 2.5MB per country

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

// Estimate available localStorage space by directly testing localStorage writes.
// navigator.storage.estimate() is NOT reliable here — it reports the origin's total
// storage quota (IndexedDB, service workers, etc.), which is often 1GB+, while
// localStorage has its own separate limit (typically 5-10MB per origin).
// Using the Storage API value leads to over-estimating available space, causing
// localStorage.setItem to fail with "QuotaExceededError" even though estimate()
// reported plenty of room. The only reliable way to know the localStorage limit is
// to actually try writing to it.
async function estimateAvailableSpace() {
  const testKey = "__hb9om_space_test__";

  // Binary search for the max test string that fits in localStorage.
  // Range: 100KB to 15MB — covers typical mobile (5MB) and desktop (10MB) limits.
  const lo = 100 * 1024;
  const hi = 15 * 1024 * 1024;
  let available = 0;

  // First try the midpoint (≈7.5MB) — if it fits, we know the limit is high
  // and can skip the lower sizes. If it fails, we search down.
  let left = lo, right = hi;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    try {
      localStorage.setItem(testKey, "x".repeat(mid));
      localStorage.removeItem(testKey);
      available = mid;
      left = mid + 1;
    } catch {
      localStorage.removeItem(testKey);
      right = mid - 1;
    }
  }

  // Fallback: if binary search failed entirely (even 100KB didn't fit), try
  // navigator.storage.estimate() as a last resort — better than returning 0.
  if (available === 0) {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est && est.quota) {
          return Math.min(est.quota - (est.usage || 0), 5 * 1024 * 1024);
        }
      }
    } catch {}
  }

  return available;
}

// Types stored as individual point entities (SotaPoint, PotaPoint, WwffPoint)
// — loaded via getReferencesInBounds backend function instead of ReferenceData
const POINT_TYPES = { sota: true, pota: true, hbff: true };

// Load all refs for a type — from point entities (SOTA/POTA/WWFF) or ReferenceData (others).
// Shared by cacheTypeFromServer and cacheTypeFromServerByCountries.
//
// Point types are loaded with client-side pagination: the SDK caps list/filter at 5000
// records per call, so we paginate using a created_date cursor to load ALL records
// (e.g., POTA has 89k+ records). Without pagination, only the 5000 newest records
// would be loaded, which may all be from one country — making country-filtered
// downloads fail with "no data for selected countries".
async function loadAllRefsForType(type, countryCodes = null) {
  // POTA: fetch directly from the POTA API via backend function.
  // The database has 89k+ PotaPoint records but the SDK caps reads at 6500 per session.
  // Going straight to the source API bypasses this limit entirely.
  if (type === 'pota') {
    try {
      const response = await base44.functions.invoke('fetchPotaForOffline', {
        entities: countryCodes && countryCodes.length > 0 ? countryCodes : 'all'
      });
      const data = response?.data || response;
      const parks = data?.parks || [];
      if (parks.length > 0) {
        return parks.map(p => ({
          code: p.reference,
          reference: p.reference,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          parkType: p.parkType,
          active: p.active
        }));
      }
    } catch (e) {
      // Fall through to database loading as fallback
    }
  }

  // SOTA: fetch directly from sotadata.org.uk CSV via backend function.
  // The database has 180k+ SotaPoint records but the SDK caps reads at 6500 per session.
  // Going straight to the source CSV API bypasses this limit entirely.
  if (type === 'sota') {
    try {
      const response = await base44.functions.invoke('fetchSotaForOffline', {
        countries: countryCodes && countryCodes.length > 0 ? countryCodes : 'all'
      });
      const data = response?.data || response;
      const summits = data?.summits || [];
      if (summits.length > 0) {
        return summits.map(s => ({
          code: s.code,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          altitude_m: s.alt,
          points: s.points
        }));
      }
    } catch (e) {
      // Fall through to database loading as fallback
    }
  }

  // WWFF: fetch directly from wwff.co CSV via backend function.
  // Same 6500-record SDK limit issue as SOTA and POTA.
  if (type === 'hbff') {
    try {
      const response = await base44.functions.invoke('fetchWwffForOffline', {
        countries: countryCodes && countryCodes.length > 0 ? countryCodes : 'all'
      });
      const data = response?.data || response;
      const refs = data?.refs || [];
      if (refs.length > 0) {
        return refs.map(r => ({
          code: r.code,
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          link: r.link
        }));
      }
    } catch (e) {
      // Fall through to database loading as fallback
    }
  }

  // Private nodes (APRS) — loaded from PrivateNode entity, not ReferenceData.
  // PrivateNode records have no country_code field, so country filtering uses
  // getCountryFromLatLng to derive the country from coordinates.
  if (type === 'private_nodes') {
    const nodes = await base44.entities.PrivateNode.list("-created_date", 5000);
    return (nodes || []).map(n => ({
      callsign: n.callsign,
      node_type: n.node_type,
      frequency: n.frequency,
      mode: n.mode,
      network: n.network,
      node_number: n.node_number,
      location_name: n.location_name,
      country: n.country,
      country_code: n.country_code,
      lat: n.lat,
      lng: n.lng,
      description: n.description,
      aprs_symbol: n.aprs_symbol,
      source: n.source,
      status: n.status,
    }));
  }

  if (POINT_TYPES[type]) {
    const entityMap = { sota: 'SotaPoint', pota: 'PotaPoint', hbff: 'WwffPoint' };
    const normalizeMap = {
      sota: (r) => ({ code: r.code, name: r.name, lat: r.lat, lng: r.lng }),
      pota: (r) => ({ code: r.code, reference: r.code, name: r.name, lat: r.lat, lng: r.lng, parkType: r.parkType, active: r.active }),
      hbff: (r) => ({ code: r.code, name: r.name, lat: r.lat, lng: r.lng, link: r.link }),
    };
    const entityName = entityMap[type];
    const normalize = normalizeMap[type];
    const LIMIT = 5000;
    const MAX_PAGES = 60; // 60 * 5000 = 300k records max
    const allRefs = [];

    // Skip-based pagination: list(sort, limit, skip) — the SDK's 3rd arg is skip.
    // Cursor-based pagination doesn't work ($lt not supported by SDK filter).
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await base44.entities[entityName].list('-created_date', LIMIT, page * LIMIT);
      if (!Array.isArray(result) || result.length === 0) break;
      allRefs.push(...result.map(normalize));
      if (result.length < LIMIT) break;
    }

    // Fallback: if point entity is empty, load from ReferenceData (pre-migration data)
    if (allRefs.length === 0) {
      const entries = await base44.entities.ReferenceData.filter({ type });
      const refs = [];
      (entries || []).forEach(entry => {
        if (entry?.references && Array.isArray(entry.references)) {
          refs.push(...entry.references);
        }
      });
      return refs;
    }
    return allRefs;
  }
  // Load from ReferenceData entity
  const entries = await base44.entities.ReferenceData.filter({ type });
  const refs = [];
  (entries || []).forEach(entry => {
    if (entry?.references && Array.isArray(entry.references)) {
      refs.push(...entry.references);
    }
  });
  return refs;
}

// Countries sorted by proximity to Switzerland — CH first, then neighbors, then Europe, then world.
// Used by autoSplitByCountry to prioritize nearby countries when storage is limited.
const CH_PRIORITY = [
  'CH', 'LI', 'AT', 'DE', 'FR', 'IT', 'ES', 'PT', 'BE', 'NL', 'LU',
  'DK', 'SE', 'NO', 'FI', 'IS', 'GB', 'IE', 'PL', 'CZ', 'SK', 'HU',
  'SI', 'HR', 'RS', 'BA', 'ME', 'AL', 'MK', 'EE', 'LV', 'LT', 'GR',
  'BG', 'RO', 'TR', 'CY', 'MT', 'AD', 'SM', 'MC', 'IM', 'FO', 'JE', 'GG', 'XK', 'GI',
  'US', 'CA', 'MX', 'CU', 'BS', 'DO', 'JM',
  'BR', 'AR', 'CL', 'CO', 'PE', 'EC', 'VE', 'UY', 'PY', 'BO',
  'JP', 'KR', 'CN', 'IN', 'ID', 'TH', 'MY', 'PH', 'SG', 'NP', 'IL', 'AE', 'SA',
  'IR', 'IQ', 'JO', 'LB', 'SY', 'KZ', 'GE', 'AM', 'AZ',
  'ZA', 'MA', 'TN', 'DZ', 'LY', 'EG', 'ET', 'KE', 'NG', 'GH', 'BW', 'ZW', 'NA',
  'AU', 'NZ', 'PG', 'FJ'
];

// Auto-split refs by country when the full dataset doesn't fit in a single localStorage key.
// Each country gets its own key with PER_COUNTRY_BUDGET_BYTES.
// Countries are stored in proximity-to-CH order so nearby countries are prioritized.
// Refs with no country code go into a special "XX" key.
// Returns { stored, count, slimmed, truncated }.
// Slim down a TOTA point to essential fields
function slimTota(t) {
  return {
    id: t.id, code: t.code, name: t.name, type: t.type, subtype: t.subtype,
    lat: t.lat, lng: t.lng, country: t.country, country_code: t.country_code,
    source: t.source, usage: t.usage, locator: t.locator,
    height_m: t.height_m, spot_height_m: t.spot_height_m,
  };
}

// Slim down a private node to essential fields
function slimPrivateNode(n) {
  return {
    id: n.id, callsign: n.callsign, node_type: n.node_type, frequency: n.frequency,
    mode: n.mode, network: n.network, node_number: n.node_number,
    location_name: n.location_name, country: n.country, country_code: n.country_code,
    lat: n.lat, lng: n.lng, description: n.description, aprs_symbol: n.aprs_symbol,
    source: n.source, status: n.status
  };
}

// Generic auto-split by country with a custom slimming function
// Used by TOTA, repeaters, and APRS which have their own slimming logic.
function autoSplitByCountryGeneric(type, refs, useSlimmed, slimFn) {
  const byCountry = {};
  const noCountry = [];
  for (const ref of refs) {
    const iso2 = getRefCountryCode(ref, type);
    if (iso2) {
      if (!byCountry[iso2]) byCountry[iso2] = [];
      byCountry[iso2].push(ref);
    } else {
      noCountry.push(ref);
    }
  }

  // Sort countries by proximity to Switzerland
  const sortedCountries = Object.keys(byCountry).sort((a, b) => {
    const aIdx = CH_PRIORITY.indexOf(a);
    const bIdx = CH_PRIORITY.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  // Clear old single-key and per-country keys
  const key = TYPE_CACHE_KEYS[type];
  if (key) localStorage.removeItem(key);
  clearPerCountryKeys(type);

  let totalStored = 0;
  let anyTruncated = false;
  let anySlimmed = useSlimmed;
  const storedCountries = [];

  for (const country of sortedCountries) {
    const countryRefs = byCountry[country];
    const countryKey = `hb9om_refs_${type}_${country}`;

    let result = storeWithBudget(countryKey, countryRefs, useSlimmed, PER_COUNTRY_BUDGET_BYTES);
    if (result.truncated && !useSlimmed) {
      const slimRefs = countryRefs.map(slimFn);
      const slimResult = storeWithBudget(countryKey, slimRefs, true, PER_COUNTRY_BUDGET_BYTES);
      if (slimResult.stored && slimResult.count >= result.count) result = slimResult;
    }
    if (!result.stored && !useSlimmed) {
      const slimRefs = countryRefs.map(slimFn);
      result = storeWithBudget(countryKey, slimRefs, true, PER_COUNTRY_BUDGET_BYTES);
    }

    if (result.stored) {
      totalStored += result.count;
      if (result.truncated) anyTruncated = true;
      if (result.slimmed) anySlimmed = true;
      storedCountries.push(country);
    } else {
      // Quota exceeded — can't store more countries
      anyTruncated = true;
      break;
    }
  }

  // Store refs with no country in a special "XX" key
  if (noCountry.length > 0) {
    const xxKey = `hb9om_refs_${type}_XX`;
    let result = storeWithBudget(xxKey, noCountry, useSlimmed, PER_COUNTRY_BUDGET_BYTES);
    if (!result.stored && !useSlimmed) {
      const slimRefs = noCountry.map(slimFn);
      result = storeWithBudget(xxKey, slimRefs, true, PER_COUNTRY_BUDGET_BYTES);
    }
    if (result.stored) {
      totalStored += result.count;
      if (result.truncated) anyTruncated = true;
      if (result.slimmed) anySlimmed = true;
      storedCountries.push('XX');
    }
  }

  if (storedCountries.length > 0) {
    setCachedCountriesForType(type, storedCountries);
    // Clear country filter — auto-split means all countries are stored, no user filter
    setOfflineCountryFilter(type, null);
    return { stored: true, count: totalStored, slimmed: anySlimmed, truncated: anyTruncated };
  }
  return { stored: false, count: 0, error: "Speicher voll – kein Land gespeichert" };
}

// Original auto-split for reference types — uses slimReference
function autoSplitByCountry(type, refs, useSlimmed = false) {
  return autoSplitByCountryGeneric(type, refs, useSlimmed, slimReference);
}

// Download a single reference type from the server.
// SOTA/POTA/WWFF are loaded via the getReferencesInBounds backend function (which reads
// from individual point entities). Other types are loaded from ReferenceData.references.
// If the full dataset doesn't fit in a single localStorage key, auto-splits by country
// (each country gets its own key) to avoid hitting the storage limit.
export async function cacheTypeFromServer(type) {
  try {
    const allRefs = await loadAllRefsForType(type);

    const key = TYPE_CACHE_KEYS[type];
    if (!key) return { success: false, count: 0, error: "Unbekannter Typ" };

    // Store metadata FIRST (before data, while localStorage quota is still available).
    // If we store data first and quota is full, metadata can't be saved → UI shows no hints.
    storeServerCount(type, allRefs.length);
    storeCountryCounts(type, allRefs);

    // Strategy: try full data → if truncated, auto-split by country → if still fails, slimmed
    let result = storeWithBudget(key, allRefs, false, PER_TYPE_BUDGET_BYTES);

    if (result.truncated) {
      // Full data doesn't fit — auto-split by country (full, not slimmed)
      result = autoSplitByCountry(type, allRefs, false);
    }

    if (!result.stored) {
      // Auto-split with full data failed — try slimmed auto-split
      result = autoSplitByCountry(type, allRefs, true);
    }

    if (!result.stored) {
      // Last resort: try slimmed single key
      const slimRefs = allRefs.map(slimReference);
      result = storeWithBudget(key, slimRefs, true, PER_TYPE_BUDGET_BYTES);
    }

    if (!result.stored) {
      return { success: false, count: 0, error: result.error };
    }

    // Store truncated flag and timestamp AFTER data (might fail if quota full — non-critical)
    storeTruncatedFlag(type, result.truncated || false);
    try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
    return { success: true, count: result.count, slimmed: result.slimmed, total: allRefs.length, truncated: result.truncated || false };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download TOTA points from the server (TotaPoint entity)
export async function cacheTotaFromServer() {
  try {
    const points = await loadAllTotaPoints();
    const arr = points || [];
    storeServerCount("tota", arr.length);
    storeCountryCounts("tota", arr);
    let result = storeWithBudget("hb9om_refs_tota", arr, false, PER_TYPE_BUDGET_BYTES);
    if (result.truncated) {
      // Auto-split by country (full, not slimmed)
      result = autoSplitByCountryGeneric("tota", arr, false, slimTota);
    }
    if (!result.stored) {
      // Auto-split with slimmed data
      result = autoSplitByCountryGeneric("tota", arr, true, slimTota);
    }
    if (!result.stored) {
      // Last resort: slimmed single key
      result = storeWithBudget("hb9om_refs_tota", arr.map(slimTota), true, PER_TYPE_BUDGET_BYTES);
    }
    if (result.stored) {
      try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
      storeTruncatedFlag("tota", result.truncated || false);
      return { success: true, count: result.count, slimmed: result.slimmed, total: arr.length, truncated: result.truncated || false };
    }
    storeTruncatedFlag("tota", false);
    return { success: false, count: 0, error: result.error };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Load cached TOTA points
export function loadCachedTota() {
  // Check for per-country keys first (country-filtered download)
  const countries = getCachedCountriesForType("tota");
  if (countries.length > 0) {
    const merged = [];
    for (const country of countries) {
      try {
        const data = localStorage.getItem(`hb9om_refs_tota_${country}`);
        if (data) {
          const arr = JSON.parse(data);
          if (Array.isArray(arr)) merged.push(...arr);
        }
      } catch {}
    }
    return merged.length > 0 ? merged : [];
  }
  try {
    const data = localStorage.getItem("hb9om_refs_tota");
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

// Download TOTA points filtered by selected countries.
// Each country is stored in its own localStorage key (hb9om_refs_tota_{country}).
export async function cacheTotaFromServerByCountries(countryCodes) {
  try {
    // TOTA has ~10k records — load all with pagination, then filter by country
    const all = await loadAllTotaPoints();
    const arr = all || [];

    // Clear old data FIRST to free space
    localStorage.removeItem("hb9om_refs_tota");
    clearPerCountryKeys("tota");

    const availableSpace = await estimateAvailableSpace();
    if (availableSpace < 10240) {
      return { success: false, count: 0, error: "Speicher voll – bitte andere Layer löschen (Einstellungen → Offline)" };
    }
    const dynamicBudget = PER_COUNTRY_BUDGET_BYTES;

    storeServerCount("tota", arr.length);
    storeCountryCounts("tota", arr);

    // If no countries selected, store all in single key
    if (countryCodes.length === 0) {
      let result = storeWithBudget("hb9om_refs_tota", arr, false, PER_TYPE_BUDGET_BYTES);
      if (result.stored) {
        clearPerCountryKeys("tota");
        setOfflineCountryFilter("tota", countryCodes);
        try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
        storeTruncatedFlag("tota", result.truncated || false);
        return { success: true, count: result.count, slimmed: result.slimmed, total: arr.length, allTotal: arr.length, truncated: result.truncated || false, countries: 0 };
      }
      storeTruncatedFlag("tota", false);
      return { success: false, count: 0, error: result.error };
    }

    // Group by country (derive from country_code or source)
    const byCountry = {};
    for (const t of arr) {
      const iso2 = t.country_code || (t.source === "swiss_csv" ? "CH" : "");
      if (iso2 && countryCodes.includes(iso2)) {
        if (!byCountry[iso2]) byCountry[iso2] = [];
        byCountry[iso2].push(t);
      }
    }

    // Sort countries by size (smallest first)
    const sortedCountries = Object.entries(byCountry).sort((a, b) => a[1].length - b[1].length);

    let totalStored = 0, totalFiltered = 0;
    let anyTruncated = false, anySlimmed = false;
    const storedCountries = [];

    for (const [country, refs] of sortedCountries) {
      const countryKey = `hb9om_refs_tota_${country}`;
      let result = storeWithBudget(countryKey, refs, false, dynamicBudget);
      if (result.stored) {
        totalStored += result.count;
        totalFiltered += refs.length;
        if (result.truncated) anyTruncated = true;
        if (result.slimmed) anySlimmed = true;
        storedCountries.push(country);
      }
    }

    if (storedCountries.length === 0) {
      if (Object.keys(byCountry).length === 0) {
        return { success: false, count: 0, error: "Keine Daten für die ausgewählten Länder gefunden" };
      }
      return { success: false, count: 0, error: "Speicher voll – bitte andere Layer löschen (Einstellungen → Offline)" };
    }

    setCachedCountriesForType("tota", storedCountries);
    setOfflineCountryFilter("tota", countryCodes);
    try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
    storeTruncatedFlag("tota", anyTruncated);
    return {
      success: true, count: totalStored, slimmed: anySlimmed,
      total: totalFiltered, allTotal: arr.length,
      truncated: anyTruncated, countries: storedCountries.length
    };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Load all TOTA points with pagination (SDK caps at 5000 per call)
async function loadAllTotaPoints() {
  const LIMIT = 5000;
  const MAX_PAGES = 10; // 10 * 5000 = 50k records max
  const allPoints = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await base44.entities.TotaPoint.list('-created_date', LIMIT, page * LIMIT);
    if (!Array.isArray(result) || result.length === 0) break;
    allPoints.push(...result);
    if (result.length < LIMIT) break;
  }
  return allPoints;
}

// Download repeaters from the server (Repeater entity)
export async function cacheRepeatersFromServer() {
  try {
    const repeaters = await base44.entities.Repeater.list("-created_date", 10000);
    const arr = repeaters || [];
    storeServerCount("repeater", arr.length);
    storeCountryCounts("repeater", arr);
    // Try full data first; if truncated, auto-split by country; if still fails, slimmed
    let result = storeWithBudget("hb9om_refs_repeater", arr, false, PER_TYPE_BUDGET_BYTES);
    if (result.truncated) {
      result = autoSplitByCountryGeneric("repeater", arr, false, slimRepeater);
    }
    if (!result.stored) {
      result = autoSplitByCountryGeneric("repeater", arr, true, slimRepeater);
    }
    if (!result.stored) {
      result = storeWithBudget("hb9om_refs_repeater", arr.map(slimRepeater), true, PER_TYPE_BUDGET_BYTES);
    }
    if (result.stored) {
      try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
      storeTruncatedFlag("repeater", result.truncated || false);
      return { success: true, count: result.count, slimmed: result.slimmed, total: arr.length, truncated: result.truncated || false };
    }
    storeTruncatedFlag("repeater", false);
    return { success: false, count: 0, error: result.error };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download private nodes (APRS) from the server
export async function cachePrivateNodesFromServer() {
  try {
    const nodes = await base44.entities.PrivateNode.list("-created_date", 10000);
    const arr = nodes || [];
    storeServerCount("private_nodes", arr.length);
    storeCountryCounts("private_nodes", arr);
    // Try full data first; if truncated, auto-split by country; if still fails, slimmed
    let result = storeWithBudget("hb9om_refs_private_nodes", arr, false, PER_TYPE_BUDGET_BYTES);
    if (result.truncated) {
      result = autoSplitByCountryGeneric("private_nodes", arr, false, slimPrivateNode);
    }
    if (!result.stored) {
      result = autoSplitByCountryGeneric("private_nodes", arr, true, slimPrivateNode);
    }
    if (!result.stored) {
      result = storeWithBudget("hb9om_refs_private_nodes", arr.map(slimPrivateNode), true, PER_TYPE_BUDGET_BYTES);
    }
    if (result.stored) {
      try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
      storeTruncatedFlag("private_nodes", result.truncated || false);
      return { success: true, count: result.count, slimmed: result.slimmed, total: arr.length, truncated: result.truncated || false };
    }
    storeTruncatedFlag("private_nodes", false);
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

// Load cached repeaters — merges per-country keys if present
export function loadCachedRepeaters() {
  const countries = getCachedCountriesForType("repeater");
  if (countries.length > 0) {
    const merged = [];
    for (const country of countries) {
      try {
        const data = localStorage.getItem(`hb9om_refs_repeater_${country}`);
        if (data) {
          const arr = JSON.parse(data);
          if (Array.isArray(arr)) merged.push(...arr);
        }
      } catch {}
    }
    return merged;
  }
  try {
    const data = localStorage.getItem("hb9om_refs_repeater");
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

// Load cached private nodes — merges per-country keys if present
export function loadCachedPrivateNodes() {
  const countries = getCachedCountriesForType("private_nodes");
  if (countries.length > 0) {
    const merged = [];
    for (const country of countries) {
      try {
        const data = localStorage.getItem(`hb9om_refs_private_nodes_${country}`);
        if (data) {
          const arr = JSON.parse(data);
          if (Array.isArray(arr)) merged.push(...arr);
        }
      } catch {}
    }
    return merged;
  }
  try {
    const data = localStorage.getItem("hb9om_refs_private_nodes");
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

// Count stats for a type from per-country keys or single-key cache
function getTypeStats(type, legacyKey) {
  const countries = getCachedCountriesForType(type);
  if (countries.length > 0) {
    let count = 0, size = 0;
    for (const country of countries) {
      const countryKey = `hb9om_refs_${type}_${country}`;
      try {
        const data = localStorage.getItem(countryKey);
        if (data) {
          const arr = JSON.parse(data);
          count += Array.isArray(arr) ? arr.length : 0;
          size += (countryKey.length + data.length) * 2;
        }
      } catch {}
    }
    return { count, size };
  }
  try {
    const data = localStorage.getItem(legacyKey);
    if (data) {
      const arr = JSON.parse(data);
      return { count: Array.isArray(arr) ? arr.length : 0, size: (legacyKey.length + data.length) * 2 };
    }
    return { count: 0, size: 0 };
  } catch { return { count: 0, size: 0 }; }
}

// Get per-type local cache stats (count + size in bytes)
export function getReferenceTypeStats() {
  const stats = {};
  // Reference types from TYPE_CACHE_KEYS
  for (const [type, key] of Object.entries(TYPE_CACHE_KEYS)) {
    stats[type] = getTypeStats(type, key);
  }
  // Repeaters
  stats.repeater = getTypeStats("repeater", "hb9om_refs_repeater");
  // TOTA
  stats.tota = getTypeStats("tota", "hb9om_refs_tota");
  // Private nodes — supports per-country keys
  stats.private_nodes = getTypeStats("private_nodes", "hb9om_refs_private_nodes");
  return stats;
}

// Clear a single type from local cache (including per-country keys)
export function clearReferenceType(type) {
  clearPerCountryKeys(type);
  const key = TYPE_CACHE_KEYS[type];
  if (key) localStorage.removeItem(key);
  if (type === "repeater") localStorage.removeItem("hb9om_refs_repeater");
  if (type === "private_nodes") localStorage.removeItem("hb9om_refs_private_nodes");
  if (type === "tota") localStorage.removeItem("hb9om_refs_tota");
  if (type === "qrz") localStorage.removeItem(QRZ_CACHE_KEY);
  localStorage.removeItem(`hb9om_server_count_${type}`);
  localStorage.removeItem(`hb9om_offline_countries_${type}`);
  localStorage.removeItem(`hb9om_country_counts_${type}`);
  localStorage.removeItem(`hb9om_truncated_${type}`);
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

// Store whether the last download was truncated (storage limit reached)
export function storeTruncatedFlag(type, truncated) {
  try {
    localStorage.setItem(`hb9om_truncated_${type}`, String(truncated));
  } catch {}
}

// Get whether the last download was truncated (storage limit reached)
export function getTruncatedFlag(type) {
  try {
    return localStorage.getItem(`hb9om_truncated_${type}`) === "true";
  } catch { return false; }
}

// Get stored server counts for all reference types (from localStorage, synchronous)
// Use this for immediate display before live counts are fetched.
export function getStoredServerCounts() {
  const counts = {};
  for (const type of Object.keys(TYPE_CACHE_KEYS)) {
    const stored = getStoredServerCount(type);
    if (stored != null) counts[type] = stored;
  }
  return counts;
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
  try {
    const tota = await base44.entities.TotaPoint.list("-created_date", 20000);
    counts.tota = (tota || []).length;
  } catch { counts.tota = 0; }
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
    tota: stats.tota.count > 0,
    mapTiles: false, // set by caller from offlineMapStore
  };
  readiness.allRefs = readiness.sota && readiness.pota && readiness.hbff && readiness.wwbota &&
    readiness.castle && readiness.iota && readiness.lighthouse;
  return readiness;
}

// --- Country-based filtering for offline downloads ---

// Get the list of countries that have cached data for a type (per-country split).
// First tries the stored list (fast path). If missing (e.g. quota was full after data
// was stored and the list couldn't be saved), scans localStorage for per-country keys.
export function getCachedCountriesForType(type) {
  try {
    const data = localStorage.getItem(`hb9om_offline_countries_data_${type}`);
    if (data) {
      const arr = JSON.parse(data);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  // Fallback: scan localStorage for per-country keys (reliable when stored list is missing)
  const countries = [];
  const prefix = `hb9om_refs_${type}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const country = key.substring(prefix.length);
      if (country.length >= 2) countries.push(country);
    }
  }
  return countries;
}

// Store the list of countries that have cached data for a type
function setCachedCountriesForType(type, countries) {
  try {
    localStorage.setItem(`hb9om_offline_countries_data_${type}`, JSON.stringify(countries));
  } catch {}
}

// Clear all per-country keys for a type
function clearPerCountryKeys(type) {
  const countries = getCachedCountriesForType(type);
  for (const country of countries) {
    localStorage.removeItem(`hb9om_refs_${type}_${country}`);
  }
  localStorage.removeItem(`hb9om_offline_countries_data_${type}`);
}

// Get country code for a reference based on its type
function getRefCountryCode(ref, type) {
  if (!ref) return null;
  if (type === 'sota') return getCountryFromSotaCode(ref.code || ref.reference);
  if (type === 'pota') return getCountryFromPotaRef(ref.code || ref.reference);
  if (type === 'repeater') return ref.country_code || null;
  if (type === 'private_nodes') {
    // APRS nodes often have no country_code — derive from lat/lng as fallback
    return ref.country_code || getCountryFromLatLng(ref.lat, ref.lng);
  }
  if (type === 'hbff') return getCountryFromWwffCode(ref.code || ref.reference);
  if (type === 'wwbota') return getCountryFromWwbotaScheme(ref.scheme);
  if (type === 'castle') return getCountryFromWcaCode(ref.code) || getCountryByName(ref.country);
  if (type === 'lighthouse' || type === 'iota') return getCountryByName(ref.country);
  if (type === 'tota') return ref.country_code || (ref.source === 'swiss_csv' ? 'CH' : null);
  return null;
}

// Store country counts for a type (called after fetching all data)
function storeCountryCounts(type, refs) {
  try {
    const counts = {};
    for (const ref of refs) {
      const iso2 = getRefCountryCode(ref, type);
      if (iso2) counts[iso2] = (counts[iso2] || 0) + 1;
    }
    localStorage.setItem(`hb9om_country_counts_${type}`, JSON.stringify(counts));
  } catch {}
}

// Get country counts for a type (from last download)
export function getCountryCountsForType(type) {
  try {
    const data = localStorage.getItem(`hb9om_country_counts_${type}`);
    return data ? JSON.parse(data) : {};
  } catch { return {}; }
}

// Get/set the user's country filter selection for a type
export function getOfflineCountryFilter(type) {
  try {
    const data = localStorage.getItem(`hb9om_offline_countries_${type}`);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function setOfflineCountryFilter(type, countries) {
  try {
    localStorage.setItem(`hb9om_offline_countries_${type}`, JSON.stringify(countries));
  } catch {}
}

// Download a reference type filtered by selected countries.
// Each country is stored in its own localStorage key (hb9om_refs_{type}_{country})
// so that one large country cannot consume the budget of another.
export async function cacheTypeFromServerByCountries(type, countryCodes) {
  try {
    const allRefs = await loadAllRefsForType(type, countryCodes);

    const key = TYPE_CACHE_KEYS[type];
    if (!key) return { success: false, count: 0, error: "Unbekannter Typ" };

    // Clear old data FIRST to free space before storing metadata
    localStorage.removeItem(key);
    clearPerCountryKeys(type);

    // Each country gets the full PER_COUNTRY_BUDGET_BYTES — storeWithBudget handles
    // truncation if a country's data exceeds the budget. The previous code divided
    // availableSpace by numCountries, giving each country only ~750KB when 6 countries
    // were selected — too small for large datasets like WWBOTA France (7'388 refs).
    const availableSpace = await estimateAvailableSpace();
    if (availableSpace < 10240) {
      return { success: false, count: 0, error: "Speicher voll – bitte andere Layer löschen (Einstellungen → Offline)" };
    }
    const dynamicBudget = PER_COUNTRY_BUDGET_BYTES;

    // Store metadata AFTER clearing (while space is available)
    storeServerCount(type, allRefs.length);
    storeCountryCounts(type, allRefs);

    // If no countries selected, store all in single key (legacy behavior)
    if (countryCodes.length === 0) {
      let result = storeWithBudget(key, allRefs, false, PER_TYPE_BUDGET_BYTES);
      if (result.truncated) {
        const slimRefs = allRefs.map(slimReference);
        const slimResult = storeWithBudget(key, slimRefs, true, PER_TYPE_BUDGET_BYTES);
        if (slimResult.stored && slimResult.count >= result.count) result = slimResult;
      }
      if (!result.stored) {
        const slimRefs = allRefs.map(slimReference);
        result = storeWithBudget(key, slimRefs, true, PER_TYPE_BUDGET_BYTES);
      }
      if (!result.stored) return { success: false, count: 0, error: result.error };
      clearPerCountryKeys(type);
      setOfflineCountryFilter(type, countryCodes);
      storeTruncatedFlag(type, result.truncated || false);
      try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
      return { success: true, count: result.count, slimmed: result.slimmed, total: allRefs.length, allTotal: allRefs.length, truncated: result.truncated || false, countries: 0 };
    }

    // Group refs by country
    const byCountry = {};
    for (const ref of allRefs) {
      const iso2 = getRefCountryCode(ref, type);
      if (iso2 && countryCodes.includes(iso2)) {
        if (!byCountry[iso2]) byCountry[iso2] = [];
        byCountry[iso2].push(ref);
      }
    }

    // Sort countries by size (smallest first) so small countries are stored before
    // large ones — prevents a large country (e.g. DE with 16k POTA parks) from
    // consuming all available localStorage space, leaving none for smaller countries.
    const sortedCountries = Object.entries(byCountry).sort((a, b) => a[1].length - b[1].length);

    // Store each country in its own key with dynamic budget
    let totalStored = 0, totalFiltered = 0;
    let anyTruncated = false, anySlimmed = false;
    const storedCountries = [];

    for (const [country, refs] of sortedCountries) {
      const countryKey = `hb9om_refs_${type}_${country}`;
      let result = storeWithBudget(countryKey, refs, false, dynamicBudget);
      if (result.truncated) {
        const slimRefs = refs.map(slimReference);
        const slimResult = storeWithBudget(countryKey, slimRefs, true, dynamicBudget);
        if (slimResult.stored && slimResult.count >= result.count) result = slimResult;
      }
      if (!result.stored) {
        const slimRefs = refs.map(slimReference);
        result = storeWithBudget(countryKey, slimRefs, true, dynamicBudget);
      }
      if (result.stored) {
        totalStored += result.count;
        totalFiltered += refs.length;
        if (result.truncated) anyTruncated = true;
        if (result.slimmed) anySlimmed = true;
        storedCountries.push(country);
      }
    }

    if (storedCountries.length === 0) {
      if (Object.keys(byCountry).length === 0) {
        return { success: false, count: 0, error: "Keine Daten für die ausgewählten Länder gefunden" };
      }
      return { success: false, count: 0, error: "Speicher voll – bitte andere Layer löschen (Einstellungen → Offline)" };
    }

    setCachedCountriesForType(type, storedCountries);
    setOfflineCountryFilter(type, countryCodes);
    storeTruncatedFlag(type, anyTruncated);
    try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
    return {
      success: true, count: totalStored, slimmed: anySlimmed,
      total: totalFiltered, allTotal: allRefs.length,
      truncated: anyTruncated, countries: storedCountries.length
    };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download private nodes (APRS) filtered by selected countries.
// Each country is stored in its own localStorage key (hb9om_refs_private_nodes_{country}).
// Nodes without country_code get their country derived from lat/lng.
export async function cachePrivateNodesFromServerByCountries(countryCodes) {
  try {
    const nodes = await base44.entities.PrivateNode.list("-created_date", 5000);
    const arr = nodes || [];

    // Clear old data FIRST to free space
    localStorage.removeItem("hb9om_refs_private_nodes");
    clearPerCountryKeys("private_nodes");

    const availableSpace = await estimateAvailableSpace();
    if (availableSpace < 10240) {
      return { success: false, count: 0, error: "Speicher voll – bitte andere Layer löschen (Einstellungen → Offline)" };
    }
    const dynamicBudget = PER_COUNTRY_BUDGET_BYTES;

    storeServerCount("private_nodes", arr.length);
    storeCountryCounts("private_nodes", arr);

    // If no countries selected, store all in single key
    if (countryCodes.length === 0) {
      let result = storeWithBudget("hb9om_refs_private_nodes", arr, false, PER_TYPE_BUDGET_BYTES);
      if (result.stored) {
        clearPerCountryKeys("private_nodes");
        setOfflineCountryFilter("private_nodes", countryCodes);
        try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
        storeTruncatedFlag("private_nodes", result.truncated || false);
        return { success: true, count: result.count, slimmed: result.slimmed, total: arr.length, allTotal: arr.length, truncated: result.truncated || false, countries: 0 };
      }
      storeTruncatedFlag("private_nodes", false);
      return { success: false, count: 0, error: result.error };
    }

    // Group by country (derive from lat/lng if country_code is empty)
    const byCountry = {};
    for (const n of arr) {
      const iso2 = n.country_code || getCountryFromLatLng(n.lat, n.lng);
      if (iso2 && countryCodes.includes(iso2)) {
        if (!byCountry[iso2]) byCountry[iso2] = [];
        byCountry[iso2].push(n);
      }
    }

    let totalStored = 0, totalFiltered = 0;
    let anyTruncated = false, anySlimmed = false;
    const storedCountries = [];

    for (const [country, refs] of Object.entries(byCountry)) {
      const countryKey = `hb9om_refs_private_nodes_${country}`;
      let result = storeWithBudget(countryKey, refs, false, dynamicBudget);
      if (result.stored) {
        totalStored += result.count;
        totalFiltered += refs.length;
        if (result.truncated) anyTruncated = true;
        if (result.slimmed) anySlimmed = true;
        storedCountries.push(country);
      }
    }

    if (storedCountries.length === 0) {
      if (Object.keys(byCountry).length === 0) {
        return { success: false, count: 0, error: "Keine Daten für die ausgewählten Länder gefunden" };
      }
      return { success: false, count: 0, error: "Speicher voll – bitte andere Layer löschen (Einstellungen → Offline)" };
    }

    setCachedCountriesForType("private_nodes", storedCountries);
    setOfflineCountryFilter("private_nodes", countryCodes);
    try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
    storeTruncatedFlag("private_nodes", anyTruncated);
    return {
      success: true, count: totalStored, slimmed: anySlimmed,
      total: totalFiltered, allTotal: arr.length,
      truncated: anyTruncated, countries: storedCountries.length
    };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download repeaters filtered by selected countries.
// Each country is stored in its own localStorage key (hb9om_refs_repeater_{country}).
export async function cacheRepeatersFromServerByCountries(countryCodes) {
  try {
    const repeaters = await base44.entities.Repeater.list("-created_date", 10000);
    const arr = repeaters || [];

    // Clear old data FIRST to free space
    localStorage.removeItem("hb9om_refs_repeater");
    clearPerCountryKeys("repeater");

    // Each country gets the full PER_COUNTRY_BUDGET_BYTES — storeWithBudget handles
    // truncation if a country's data exceeds the budget. The previous code divided
    // availableSpace by numCountries, giving each country only ~750KB when 6 countries
    // were selected — too small for large datasets like WWBOTA France (7'388 refs).
    const availableSpace = await estimateAvailableSpace();
    if (availableSpace < 10240) {
      return { success: false, count: 0, error: "Speicher voll – bitte andere Layer löschen (Einstellungen → Offline)" };
    }
    const dynamicBudget = PER_COUNTRY_BUDGET_BYTES;

    storeServerCount("repeater", arr.length);
    storeCountryCounts("repeater", arr);

    // If no countries selected, store all in single key (legacy behavior)
    if (countryCodes.length === 0) {
      let result = storeWithBudget("hb9om_refs_repeater", arr, false, PER_TYPE_BUDGET_BYTES);
      if (result.truncated) {
        const slimmed = arr.map(slimRepeater);
        const slimResult = storeWithBudget("hb9om_refs_repeater", slimmed, true, PER_TYPE_BUDGET_BYTES);
        if (slimResult.stored && slimResult.count >= result.count) result = slimResult;
      }
      if (!result.stored) {
        const slimmed = arr.map(slimRepeater);
        result = storeWithBudget("hb9om_refs_repeater", slimmed, true, PER_TYPE_BUDGET_BYTES);
      }
      if (result.stored) {
        clearPerCountryKeys("repeater");
        setOfflineCountryFilter("repeater", countryCodes);
        try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
        storeTruncatedFlag("repeater", result.truncated || false);
        return { success: true, count: result.count, slimmed: result.slimmed, total: arr.length, allTotal: arr.length, truncated: result.truncated || false, countries: 0 };
      }
      storeTruncatedFlag("repeater", false);
      return { success: false, count: 0, error: result.error };
    }

    // Group by country
    const byCountry = {};
    for (const r of arr) {
      if (r.country_code && countryCodes.includes(r.country_code)) {
        if (!byCountry[r.country_code]) byCountry[r.country_code] = [];
        byCountry[r.country_code].push(r);
      }
    }

    let totalStored = 0, totalFiltered = 0;
    let anyTruncated = false, anySlimmed = false;
    const storedCountries = [];

    for (const [country, refs] of Object.entries(byCountry)) {
      const countryKey = `hb9om_refs_repeater_${country}`;
      let result = storeWithBudget(countryKey, refs, false, dynamicBudget);
      if (result.truncated) {
        const slimmed = refs.map(slimRepeater);
        const slimResult = storeWithBudget(countryKey, slimmed, true, dynamicBudget);
        if (slimResult.stored && slimResult.count >= result.count) result = slimResult;
      }
      if (!result.stored) {
        const slimmed = refs.map(slimRepeater);
        result = storeWithBudget(countryKey, slimmed, true, dynamicBudget);
      }
      if (result.stored) {
        totalStored += result.count;
        totalFiltered += refs.length;
        if (result.truncated) anyTruncated = true;
        if (result.slimmed) anySlimmed = true;
        storedCountries.push(country);
      }
    }

    if (storedCountries.length === 0) {
      if (Object.keys(byCountry).length === 0) {
        return { success: false, count: 0, error: "Keine Daten für die ausgewählten Länder gefunden" };
      }
      return { success: false, count: 0, error: "Speicher voll – bitte andere Layer löschen (Einstellungen → Offline)" };
    }

    setCachedCountriesForType("repeater", storedCountries);
    setOfflineCountryFilter("repeater", countryCodes);
    try { localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString()); } catch {}
    storeTruncatedFlag("repeater", anyTruncated);
    return {
      success: true, count: totalStored, slimmed: anySlimmed,
      total: totalFiltered, allTotal: arr.length,
      truncated: anyTruncated, countries: storedCountries.length
    };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}