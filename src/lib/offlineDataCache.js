import { base44 } from "@/api/base44Client";
import { loadAllRepeaters, loadAllPrivateNodes, loadAllTotaPoints, loadRepeatersByCountries } from "@/lib/paginatedLoader";
import { getCountryFromSotaCode, getCountryFromPotaRef, getCountryFromWwffCode, getCountryFromWwbotaScheme, getCountryByName, getCountryFromWcaCode, getCountryFromLatLng } from "@/lib/countries";
import { safeSetItem, safeGetItem, safeRemoveItem, idbSet, idbGet, idbDelete, idbGetKeys, idbClearPrefix } from "@/lib/safeStorage";

const CACHE_KEY = "hb9om_offline_refs";
const OVERRIDES_KEY = "hb9om_offline_overrides";
const QRZ_CACHE_KEY = "hb9om_offline_qrz";
const TIMESTAMP_KEY = "hb9om_offline_cached_at";

// Cache TTL — 10 minutes. Cached reference data expires after this period,
// forcing a re-fetch from the server to ensure data freshness.
const CACHE_TTL_MS = 10 * 60 * 1000;

// Check if the cache has expired (older than TTL). Returns true if expired or no timestamp.
export function isCacheExpired() {
  const cachedAt = safeGetItem(TIMESTAMP_KEY);
  if (!cachedAt) return true;
  const ageMs = Date.now() - new Date(cachedAt).getTime();
  return ageMs > CACHE_TTL_MS;
}

// Get remaining cache age in minutes (for UI display)
export function getCacheAgeMinutes() {
  const cachedAt = safeGetItem(TIMESTAMP_KEY);
  if (!cachedAt) return null;
  const ageMs = Date.now() - new Date(cachedAt).getTime();
  return Math.floor(ageMs / 60000);
}

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
  llota: "hb9om_refs_llota",
};

export async function cacheReferenceData(data) {
  try {
    // Write per-type keys to IndexedDB (large data) — localStorage is too small (5MB)
    for (const [type, key] of Object.entries(TYPE_CACHE_KEYS)) {
      const refs = data?.[type];
      if (Array.isArray(refs)) {
        await idbSet(key, refs);
      }
    }
    // Small metadata stays in localStorage
    safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
  } catch (e) {
    // Silent — IndexedDB write failed
  }
}

// Load a single type — merges per-country keys if present, otherwise reads single-key cache.
// Now async: reads from IndexedDB (large data) instead of localStorage.
export async function loadCachedReferenceType(type) {
  // Check for per-country keys first (country-filtered download)
  const countries = getCachedCountriesForType(type);
  if (countries.length > 0) {
    const merged = [];
    for (const country of countries) {
      const arr = await idbGet(`hb9om_refs_${type}_${country}`);
      if (Array.isArray(arr)) merged.push(...arr);
    }
    return merged.length > 0 ? merged : null;
  }
  // Fallback to single-key cache (IndexedDB)
  const key = TYPE_CACHE_KEYS[type];
  if (!key) return null;
  const arr = await idbGet(key);
  return Array.isArray(arr) ? arr : null;
}

// Write a single type to its per-type key — allows incremental cache updates
// as data is fetched without rewriting the entire cache.
// Now uses IndexedDB (large data) instead of localStorage.
export async function cacheReferenceType(type, refs) {
  const key = TYPE_CACHE_KEYS[type];
  if (!key || !Array.isArray(refs)) return;
  await idbSet(key, refs);
}

export async function loadCachedReferenceData() {
  // TTL check — if cache is older than 10 minutes, return null (force re-fetch)
  if (isCacheExpired()) return null;

  // Use loadCachedReferenceType which handles per-country keys (now async, IndexedDB)
  try {
    const result = {};
    let hasAny = false;
    for (const type of Object.keys(TYPE_CACHE_KEYS)) {
      const refs = await loadCachedReferenceType(type);
      if (refs) {
        result[type] = refs;
        hasAny = true;
      }
    }
    if (hasAny) return result;
  } catch {}

  // Fallback to legacy single-key cache (localStorage — for backward compat)
  const data = safeGetItem(CACHE_KEY);
  return data ? JSON.parse(data) : null;
}

export async function cacheQrzLookups(lookups) {
  await idbSet(QRZ_CACHE_KEY, lookups || []);
}

export async function loadCachedQrzLookups() {
  const data = await idbGet(QRZ_CACHE_KEY);
  return Array.isArray(data) ? data : [];
}

export function cacheOverrides(overrides) {
  safeSetItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

export function loadCachedOverrides() {
  const data = safeGetItem(OVERRIDES_KEY);
  return data ? JSON.parse(data) : {};
}

export function getCachedAt() {
  return safeGetItem(TIMESTAMP_KEY);
}

export async function isOfflineReady() {
  // Check if any reference data exists in IndexedDB
  for (const key of Object.values(TYPE_CACHE_KEYS)) {
    const data = await idbGet(key);
    if (Array.isArray(data) && data.length > 0) return true;
  }
  // Check per-country keys
  for (const type of Object.keys(TYPE_CACHE_KEYS)) {
    const countries = getCachedCountriesForType(type);
    if (countries.length > 0) return true;
  }
  return false;
}

// Get total size of all hb9om_ localStorage keys in bytes (small metadata only —
// large data is now in IndexedDB)
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

// Get cache stats: size, reference count, last cached date.
// Now async — counts come from IndexedDB.
export async function getLocalCacheStats() {
  const size = getLocalCacheSize();
  const cachedAt = getCachedAt();
  let count = 0;
  // Count from per-type keys and per-country keys (IndexedDB)
  for (const type of Object.keys(TYPE_CACHE_KEYS)) {
    const stats = await getTypeStatsAsync(type, TYPE_CACHE_KEYS[type]);
    count += stats.count;
  }
  // Count repeaters (per-country or single-key)
  count += (await getTypeStatsAsync("repeater", "hb9om_refs_repeater")).count;
  // Count TOTA and private nodes
  count += (await getTypeStatsAsync("tota", "hb9om_refs_tota")).count;
  count += (await getTypeStatsAsync("private_nodes", "hb9om_refs_private_nodes")).count;
  return { size, count, cachedAt };
}

// Clear local reference cache (keeps other hb9om_ settings).
// Now clears both IndexedDB (large data) and localStorage (small metadata).
export async function clearLocalReferenceCache() {
  // Clear IndexedDB large data
  await idbClearPrefix("hb9om_refs_");
  await idbDelete(QRZ_CACHE_KEY);
  // Clear localStorage small metadata
  safeRemoveItem(CACHE_KEY);
  safeRemoveItem(OVERRIDES_KEY);
  safeRemoveItem(QRZ_CACHE_KEY);
  safeRemoveItem(TIMESTAMP_KEY);
  for (const type of Object.keys(TYPE_CACHE_KEYS)) clearPerCountryKeys(type);
  clearPerCountryKeys("repeater");
  clearPerCountryKeys("tota");
  clearPerCountryKeys("private_nodes");
  // Clear stored server counts
  for (const type of Object.keys(TYPE_CACHE_KEYS)) {
    safeRemoveItem(`hb9om_server_count_${type}`);
    safeRemoveItem(`hb9om_truncated_${type}`);
  }
  safeRemoveItem("hb9om_server_count_repeater");
  safeRemoveItem("hb9om_server_count_private_nodes");
  safeRemoveItem("hb9om_server_count_tota");
  safeRemoveItem("hb9om_server_count_qrz");
  safeRemoveItem("hb9om_truncated_repeater");
  safeRemoveItem("hb9om_truncated_private_nodes");
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

// Store data in IndexedDB — no budget needed (IndexedDB has 50MB+ capacity).
// Async: awaits the IndexedDB write to ensure data is persisted before returning.
async function storeWithBudget(key, refs, slimmed, budgetBytes) {
  await idbSet(key, refs);
  return { stored: true, count: refs.length, slimmed, truncated: false };
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
export async function loadAllRefsForType(type, countryCodes = null) {
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

  // IOTA: load from IotaPoint entity (individual records, not ReferenceData).
  // 1,178 island groups — fits in a single SDK list call.
  if (type === 'iota') {
    const LIMIT = 5000;
    const allRefs = [];
    for (let page = 0; page < 5; page++) {
      const result = await base44.entities.IotaPoint.list('id', LIMIT, page * LIMIT);
      if (!Array.isArray(result) || result.length === 0) break;
      allRefs.push(...result.map(r => ({
        code: r.code,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        dxcc_num: r.dxcc_num,
        status: r.status,
        island_count: r.island_count,
        pc_credited: r.pc_credited,
        grp_region: r.grp_region,
        link: 'https://www.iota-world.org/'
      })));
      if (result.length < LIMIT) break;
    }
    return allRefs;
  }

  // Private nodes (APRS) — loaded from PrivateNode entity, not ReferenceData.
  // PrivateNode records have no country_code field, so country filtering uses
  // getCountryFromLatLng to derive the country from coordinates.
  if (type === 'private_nodes') {
    const nodes = await loadAllPrivateNodes();
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
      sota: (r) => ({ code: r.code, name: r.name, lat: r.lat, lng: r.lng, altitude_m: r.altitude_m, points: r.points }),
      pota: (r) => ({ code: r.code, reference: r.code, name: r.name, lat: r.lat, lng: r.lng, parkType: r.parkType, active: r.active }),
      hbff: (r) => ({ code: r.code, name: r.name, lat: r.lat, lng: r.lng, link: r.link }),
    };
    const entityName = entityMap[type];
    const normalize = normalizeMap[type];
    const LIMIT = 5000;
    const MAX_PAGES = 60; // 60 * 5000 = 300k records max
    const allRefs = [];

    // Skip-based pagination with id sort — deterministic and stable across pages.
    // -created_date sort is non-deterministic when records share identical timestamps
    // (bulk insert), causing skip/duplicate across pages.
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await base44.entities[entityName].list('id', LIMIT, page * LIMIT);
      if (!Array.isArray(result) || result.length === 0) break;
      allRefs.push(...result.map(normalize));
      if (result.length < LIMIT) break;
    }

    // Point entities (SotaPoint, PotaPoint, WwffPoint) are now the source of truth.
    // ReferenceData fallback removed — entities are populated by sync functions.
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

// Generic auto-split by country with a custom slimming function.
// Now async: stores each country in IndexedDB (no budget/truncation needed).
async function autoSplitByCountryGeneric(type, refs, useSlimmed, slimFn) {
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
  if (key) safeRemoveItem(key);
  await idbDelete(key);
  await idbClearPrefix(`hb9om_refs_${type}_`);
  clearPerCountryKeys(type);

  let totalStored = 0;
  const storedCountries = [];

  for (const country of sortedCountries) {
    const countryRefs = byCountry[country];
    const countryKey = `hb9om_refs_${type}_${country}`;
    const result = await storeWithBudget(countryKey, countryRefs, useSlimmed, PER_COUNTRY_BUDGET_BYTES);
    if (result.stored) {
      totalStored += result.count;
      storedCountries.push(country);
    }
  }

  // Store refs with no country in a special "XX" key
  if (noCountry.length > 0) {
    const xxKey = `hb9om_refs_${type}_XX`;
    const result = await storeWithBudget(xxKey, noCountry, useSlimmed, PER_COUNTRY_BUDGET_BYTES);
    if (result.stored) {
      totalStored += result.count;
      storedCountries.push('XX');
    }
  }

  if (storedCountries.length > 0) {
    setCachedCountriesForType(type, storedCountries);
    setOfflineCountryFilter(type, null);
    return { stored: true, count: totalStored, slimmed: useSlimmed, truncated: false };
  }
  return { stored: false, count: 0, error: "Keine Daten gespeichert" };
}

// Original auto-split for reference types — uses slimReference
async function autoSplitByCountry(type, refs, useSlimmed = false) {
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

    // Store metadata in localStorage (small)
    storeServerCount(type, allRefs.length);
    storeCountryCounts(type, allRefs);

    // Store full data in IndexedDB (no budget/truncation needed — 50MB+ capacity)
    let result = await storeWithBudget(key, allRefs, false, PER_TYPE_BUDGET_BYTES);

    if (!result.stored) {
      return { success: false, count: 0, error: result.error };
    }

    storeTruncatedFlag(type, false);
    safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
    return { success: true, count: result.count, slimmed: false, total: allRefs.length, truncated: false };
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
    let result = await storeWithBudget("hb9om_refs_tota", arr, false, PER_TYPE_BUDGET_BYTES);
    if (!result.stored) {
      result = await autoSplitByCountryGeneric("tota", arr, false, slimTota);
    }
    if (result.stored) {
      safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
      storeTruncatedFlag("tota", false);
      return { success: true, count: result.count, slimmed: false, total: arr.length, truncated: false };
    }
    storeTruncatedFlag("tota", false);
    return { success: false, count: 0, error: result.error };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Load cached TOTA points (IndexedDB)
// TTL: returns empty array if cache is older than 10 minutes
export async function loadCachedTota() {
  if (isCacheExpired()) return [];
  const countries = getCachedCountriesForType("tota");
  if (countries.length > 0) {
    const merged = [];
    for (const country of countries) {
      const arr = await idbGet(`hb9om_refs_tota_${country}`);
      if (Array.isArray(arr)) merged.push(...arr);
    }
    return merged;
  }
  const arr = await idbGet("hb9om_refs_tota");
  return Array.isArray(arr) ? arr : [];
}

// Download TOTA points filtered by selected countries.
// Each country is stored in its own localStorage key (hb9om_refs_tota_{country}).
export async function cacheTotaFromServerByCountries(countryCodes) {
  try {
    const arr = await loadTotaPointsByCountries(countryCodes);

    // Clear old data FIRST (IndexedDB + localStorage)
    safeRemoveItem("hb9om_refs_tota");
    await idbDelete("hb9om_refs_tota");
    await idbClearPrefix("hb9om_refs_tota_");
    clearPerCountryKeys("tota");

    storeServerCount("tota", arr.length);
    storeCountryCounts("tota", arr);

    // If no countries selected, store all in single key
    if (countryCodes.length === 0) {
      const result = await storeWithBudget("hb9om_refs_tota", arr, false, PER_TYPE_BUDGET_BYTES);
      if (result.stored) {
        clearPerCountryKeys("tota");
        setOfflineCountryFilter("tota", countryCodes);
        safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
        storeTruncatedFlag("tota", false);
        return { success: true, count: result.count, slimmed: false, total: arr.length, allTotal: arr.length, truncated: false, countries: 0 };
      }
      storeTruncatedFlag("tota", false);
      return { success: false, count: 0, error: result.error };
    }

    // Group by country
    const byCountry = {};
    for (const t of arr) {
      const iso2 = t.country_code || (t.source === "swiss_csv" ? "CH" : "");
      if (iso2 && countryCodes.includes(iso2)) {
        if (!byCountry[iso2]) byCountry[iso2] = [];
        byCountry[iso2].push(t);
      }
    }

    const sortedCountries = Object.entries(byCountry).sort((a, b) => a[1].length - b[1].length);
    let totalStored = 0, totalFiltered = 0;
    const storedCountries = [];

    for (const [country, refs] of sortedCountries) {
      const countryKey = `hb9om_refs_tota_${country}`;
      const result = await storeWithBudget(countryKey, refs, false, PER_COUNTRY_BUDGET_BYTES);
      if (result.stored) {
        totalStored += result.count;
        totalFiltered += refs.length;
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
    safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
    storeTruncatedFlag("tota", false);
    return {
      success: true, count: totalStored, slimmed: false,
      total: totalFiltered, allTotal: arr.length,
      truncated: false, countries: storedCountries.length
    };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// loadAllTotaPoints is imported from paginatedLoader.js (deterministic id-sorted pagination)

// Load TOTA points for specific countries using server-side filtering.
// Avoids loading all 10k+ points into memory when only CH is needed.
// Swiss CSV points (source="swiss_csv") are included for CH even if country_code is empty.
// SDK filter caps at 5000 per call — for most countries this is sufficient.
async function loadTotaPointsByCountries(countryCodes) {
  if (!countryCodes || countryCodes.length === 0) {
    return loadAllTotaPoints();
  }
  const LIMIT = 5000;
  const allPoints = [];
  const seenIds = new Set();

  for (const country of countryCodes) {
    // Filter by country_code — server-side, only loads matching records
    try {
      const points = await base44.entities.TotaPoint.filter({ country_code: country }, 'id', LIMIT);
      for (const p of (points || [])) {
        if (!seenIds.has(p.id)) { seenIds.add(p.id); allPoints.push(p); }
      }
    } catch { /* continue with other countries */ }

    // Swiss CSV points have source="swiss_csv" — include for CH even if country_code is missing
    if (country === "CH") {
      try {
        const swissPoints = await base44.entities.TotaPoint.filter({ source: "swiss_csv" }, 'id', LIMIT);
        for (const p of (swissPoints || [])) {
          if (!seenIds.has(p.id)) { seenIds.add(p.id); allPoints.push(p); }
        }
      } catch { /* silent */ }
    }
  }
  return allPoints;
}

// Download repeaters from the server (Repeater entity)
export async function cacheRepeatersFromServer() {
  try {
    const repeaters = await loadAllRepeaters();
    const arr = repeaters || [];
    storeServerCount("repeater", arr.length);
    storeCountryCounts("repeater", arr);
    let result = await storeWithBudget("hb9om_refs_repeater", arr, false, PER_TYPE_BUDGET_BYTES);
    if (!result.stored) {
      result = await autoSplitByCountryGeneric("repeater", arr, false, slimRepeater);
    }
    if (result.stored) {
      safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
      storeTruncatedFlag("repeater", false);
      return { success: true, count: result.count, slimmed: false, total: arr.length, truncated: false };
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
    const nodes = await loadAllPrivateNodes();
    const arr = nodes || [];
    storeServerCount("private_nodes", arr.length);
    storeCountryCounts("private_nodes", arr);
    let result = await storeWithBudget("hb9om_refs_private_nodes", arr, false, PER_TYPE_BUDGET_BYTES);
    if (!result.stored) {
      result = await autoSplitByCountryGeneric("private_nodes", arr, false, slimPrivateNode);
    }
    if (result.stored) {
      safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
      storeTruncatedFlag("private_nodes", false);
      return { success: true, count: result.count, slimmed: false, total: arr.length, truncated: false };
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
    await cacheQrzLookups(qrz || []);
    storeServerCount("qrz", (qrz || []).length);
    return { success: true, count: (qrz || []).length };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Load cached repeaters — merges per-country keys if present (IndexedDB)
// TTL: returns empty array if cache is older than 10 minutes
export async function loadCachedRepeaters() {
  if (isCacheExpired()) return [];
  const countries = getCachedCountriesForType("repeater");
  if (countries.length > 0) {
    const merged = [];
    for (const country of countries) {
      const arr = await idbGet(`hb9om_refs_repeater_${country}`);
      if (Array.isArray(arr)) merged.push(...arr);
    }
    return merged;
  }
  const arr = await idbGet("hb9om_refs_repeater");
  return Array.isArray(arr) ? arr : [];
}

// Load cached private nodes — merges per-country keys if present (IndexedDB)
// TTL: returns empty array if cache is older than 10 minutes
export async function loadCachedPrivateNodes() {
  if (isCacheExpired()) return [];
  const countries = getCachedCountriesForType("private_nodes");
  if (countries.length > 0) {
    const merged = [];
    for (const country of countries) {
      const arr = await idbGet(`hb9om_refs_private_nodes_${country}`);
      if (Array.isArray(arr)) merged.push(...arr);
    }
    return merged;
  }
  const arr = await idbGet("hb9om_refs_private_nodes");
  return Array.isArray(arr) ? arr : [];
}

// Count stats for a type from per-country keys or single-key cache (IndexedDB, async)
async function getTypeStatsAsync(type, legacyKey) {
  const countries = getCachedCountriesForType(type);
  if (countries.length > 0) {
    let count = 0;
    for (const country of countries) {
      const arr = await idbGet(`hb9om_refs_${type}_${country}`);
      if (Array.isArray(arr)) count += arr.length;
    }
    return { count, size: 0 };
  }
  const arr = await idbGet(legacyKey);
  return { count: Array.isArray(arr) ? arr.length : 0, size: 0 };
}

// Sync wrapper for backward compat — returns 0 (use async version for real counts)
function getTypeStats(type, legacyKey) {
  return { count: 0, size: 0 };
}

// Get per-type local cache stats (count + size). Now async — reads from IndexedDB.
export async function getReferenceTypeStats() {
  const stats = {};
  for (const [type, key] of Object.entries(TYPE_CACHE_KEYS)) {
    stats[type] = await getTypeStatsAsync(type, key);
  }
  stats.repeater = await getTypeStatsAsync("repeater", "hb9om_refs_repeater");
  stats.tota = await getTypeStatsAsync("tota", "hb9om_refs_tota");
  stats.private_nodes = await getTypeStatsAsync("private_nodes", "hb9om_refs_private_nodes");
  return stats;
}

// Clear a single type from local cache (IndexedDB + localStorage metadata)
export async function clearReferenceType(type) {
  clearPerCountryKeys(type);
  const key = TYPE_CACHE_KEYS[type];
  if (key) { safeRemoveItem(key); await idbDelete(key); }
  await idbClearPrefix(`hb9om_refs_${type}_`);
  if (type === "repeater") await idbDelete("hb9om_refs_repeater");
  if (type === "private_nodes") await idbDelete("hb9om_refs_private_nodes");
  if (type === "tota") await idbDelete("hb9om_refs_tota");
  if (type === "qrz") await idbDelete(QRZ_CACHE_KEY);
  safeRemoveItem(`hb9om_server_count_${type}`);
  safeRemoveItem(`hb9om_offline_countries_${type}`);
  safeRemoveItem(`hb9om_country_counts_${type}`);
  safeRemoveItem(`hb9om_truncated_${type}`);
}

// Store server count for a type (called after successful download)
export function storeServerCount(type, count) {
  safeSetItem(`hb9om_server_count_${type}`, String(count));
}

// Get stored server count for a type (from last download)
export function getStoredServerCount(type) {
  const v = safeGetItem(`hb9om_server_count_${type}`);
  return v ? parseInt(v) : null;
}

// Store whether the last download was truncated (storage limit reached)
export function storeTruncatedFlag(type, truncated) {
  safeSetItem(`hb9om_truncated_${type}`, String(truncated));
}

// Get whether the last download was truncated (storage limit reached)
export function getTruncatedFlag(type) {
  return safeGetItem(`hb9om_truncated_${type}`) === "true";
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
  // Repeaters — use paginated loader for full count (31k+ repeaters, single list capped at 10k)
  try {
    const repeaters = await loadAllRepeaters();
    counts.repeater = (repeaters || []).length;
  } catch { counts.repeater = 0; }
  // Private nodes — use paginated loader for full count (33k+ nodes, single list capped at 10k)
  try {
    const nodes = await loadAllPrivateNodes();
    counts.private_nodes = (nodes || []).length;
  } catch { counts.private_nodes = 0; }
  // TOTA — use paginated loader for full count (10k+ points, single list capped at 5k)
  try {
    const tota = await loadAllTotaPoints();
    counts.tota = (tota || []).length;
  } catch { counts.tota = 0; }
  return counts;
}

// Check offline readiness — returns what's ready and what's missing. Now async (IndexedDB).
export async function getOfflineReadiness() {
  const stats = await getReferenceTypeStats();
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
  const data = safeGetItem(`hb9om_offline_countries_data_${type}`);
  if (data) {
    try {
      const arr = JSON.parse(data);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch {}
  }
  // No per-country data found — return empty (data is in IndexedDB now)
  return [];
}

// Store the list of countries that have cached data for a type
function setCachedCountriesForType(type, countries) {
  safeSetItem(`hb9om_offline_countries_data_${type}`, JSON.stringify(countries));
}

// Clear all per-country metadata for a type (IndexedDB data cleared separately)
function clearPerCountryKeys(type) {
  const countries = getCachedCountriesForType(type);
  // Note: IndexedDB data is cleared by the caller via idbClearPrefix
  safeRemoveItem(`hb9om_offline_countries_data_${type}`);
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
  const counts = {};
  for (const ref of refs) {
    const iso2 = getRefCountryCode(ref, type);
    if (iso2) counts[iso2] = (counts[iso2] || 0) + 1;
  }
  safeSetItem(`hb9om_country_counts_${type}`, JSON.stringify(counts));
}

// Get country counts for a type (from last download)
export function getCountryCountsForType(type) {
  const data = safeGetItem(`hb9om_country_counts_${type}`);
  return data ? JSON.parse(data) : {};
}

// Get/set the user's country filter selection for a type
export function getOfflineCountryFilter(type) {
  const data = safeGetItem(`hb9om_offline_countries_${type}`);
  return data ? JSON.parse(data) : null;
}

export function setOfflineCountryFilter(type, countries) {
  safeSetItem(`hb9om_offline_countries_${type}`, JSON.stringify(countries));
}

// Download a reference type filtered by selected countries.
// Each country is stored in its own localStorage key (hb9om_refs_{type}_{country})
// so that one large country cannot consume the budget of another.
export async function cacheTypeFromServerByCountries(type, countryCodes) {
  try {
    const allRefs = await loadAllRefsForType(type, countryCodes);

    const key = TYPE_CACHE_KEYS[type];
    if (!key) return { success: false, count: 0, error: "Unbekannter Typ" };

    // Clear old data FIRST (IndexedDB + localStorage metadata)
    safeRemoveItem(key);
    await idbDelete(key);
    await idbClearPrefix(`hb9om_refs_${type}_`);
    clearPerCountryKeys(type);

    // Store metadata in localStorage (small)
    storeServerCount(type, allRefs.length);
    storeCountryCounts(type, allRefs);

    // If no countries selected, store all in single key (IndexedDB)
    if (countryCodes.length === 0) {
      const result = await storeWithBudget(key, allRefs, false, PER_TYPE_BUDGET_BYTES);
      if (!result.stored) return { success: false, count: 0, error: result.error };
      clearPerCountryKeys(type);
      setOfflineCountryFilter(type, countryCodes);
      storeTruncatedFlag(type, false);
      safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
      return { success: true, count: result.count, slimmed: false, total: allRefs.length, allTotal: allRefs.length, truncated: false, countries: 0 };
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

    // Sort countries by size (smallest first)
    const sortedCountries = Object.entries(byCountry).sort((a, b) => a[1].length - b[1].length);

    let totalStored = 0, totalFiltered = 0;
    const storedCountries = [];

    for (const [country, refs] of sortedCountries) {
      const countryKey = `hb9om_refs_${type}_${country}`;
      const result = await storeWithBudget(countryKey, refs, false, PER_COUNTRY_BUDGET_BYTES);
      if (result.stored) {
        totalStored += result.count;
        totalFiltered += refs.length;
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
    storeTruncatedFlag(type, false);
    safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
    return {
      success: true, count: totalStored, slimmed: false,
      total: totalFiltered, allTotal: allRefs.length,
      truncated: false, countries: storedCountries.length
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
    const nodes = await loadAllPrivateNodes();
    const arr = nodes || [];

    // Clear old data FIRST (IndexedDB + localStorage)
    safeRemoveItem("hb9om_refs_private_nodes");
    await idbDelete("hb9om_refs_private_nodes");
    await idbClearPrefix("hb9om_refs_private_nodes_");
    clearPerCountryKeys("private_nodes");

    storeServerCount("private_nodes", arr.length);
    storeCountryCounts("private_nodes", arr);

    if (countryCodes.length === 0) {
      const result = await storeWithBudget("hb9om_refs_private_nodes", arr, false, PER_TYPE_BUDGET_BYTES);
      if (result.stored) {
        clearPerCountryKeys("private_nodes");
        setOfflineCountryFilter("private_nodes", countryCodes);
        safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
        storeTruncatedFlag("private_nodes", false);
        return { success: true, count: result.count, slimmed: false, total: arr.length, allTotal: arr.length, truncated: false, countries: 0 };
      }
      storeTruncatedFlag("private_nodes", false);
      return { success: false, count: 0, error: result.error };
    }

    const byCountry = {};
    for (const n of arr) {
      const iso2 = n.country_code || getCountryFromLatLng(n.lat, n.lng);
      if (iso2 && countryCodes.includes(iso2)) {
        if (!byCountry[iso2]) byCountry[iso2] = [];
        byCountry[iso2].push(n);
      }
    }

    let totalStored = 0, totalFiltered = 0;
    const storedCountries = [];

    for (const [country, refs] of Object.entries(byCountry)) {
      const countryKey = `hb9om_refs_private_nodes_${country}`;
      const result = await storeWithBudget(countryKey, refs, false, PER_COUNTRY_BUDGET_BYTES);
      if (result.stored) {
        totalStored += result.count;
        totalFiltered += refs.length;
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
    safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
    storeTruncatedFlag("private_nodes", false);
    return {
      success: true, count: totalStored, slimmed: false,
      total: totalFiltered, allTotal: arr.length,
      truncated: false, countries: storedCountries.length
    };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}

// Download repeaters filtered by selected countries.
// Each country is stored in its own localStorage key (hb9om_refs_repeater_{country}).
export async function cacheRepeatersFromServerByCountries(countryCodes) {
  try {
    const repeaters = await loadRepeatersByCountries(countryCodes);
    const arr = repeaters || [];

    // Clear old data FIRST (IndexedDB + localStorage)
    safeRemoveItem("hb9om_refs_repeater");
    await idbDelete("hb9om_refs_repeater");
    await idbClearPrefix("hb9om_refs_repeater_");
    clearPerCountryKeys("repeater");

    storeServerCount("repeater", arr.length);
    storeCountryCounts("repeater", arr);

    if (countryCodes.length === 0) {
      const result = await storeWithBudget("hb9om_refs_repeater", arr, false, PER_TYPE_BUDGET_BYTES);
      if (result.stored) {
        clearPerCountryKeys("repeater");
        setOfflineCountryFilter("repeater", countryCodes);
        safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
        storeTruncatedFlag("repeater", false);
        return { success: true, count: result.count, slimmed: false, total: arr.length, allTotal: arr.length, truncated: false, countries: 0 };
      }
      storeTruncatedFlag("repeater", false);
      return { success: false, count: 0, error: result.error };
    }

    const byCountry = {};
    for (const r of arr) {
      if (r.country_code && countryCodes.includes(r.country_code)) {
        if (!byCountry[r.country_code]) byCountry[r.country_code] = [];
        byCountry[r.country_code].push(r);
      }
    }

    let totalStored = 0, totalFiltered = 0;
    const storedCountries = [];

    for (const [country, refs] of Object.entries(byCountry)) {
      const countryKey = `hb9om_refs_repeater_${country}`;
      const result = await storeWithBudget(countryKey, refs, false, PER_COUNTRY_BUDGET_BYTES);
      if (result.stored) {
        totalStored += result.count;
        totalFiltered += refs.length;
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
    safeSetItem(TIMESTAMP_KEY, new Date().toISOString());
    storeTruncatedFlag("repeater", false);
    return {
      success: true, count: totalStored, slimmed: false,
      total: totalFiltered, allTotal: arr.length,
      truncated: false, countries: storedCountries.length
    };
  } catch (e) {
    return { success: false, count: 0, error: e.message };
  }
}