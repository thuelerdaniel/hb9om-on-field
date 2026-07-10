import { base44 } from "@/api/base44Client";

const CACHE_KEY = "hb9om_offline_refs";
const OVERRIDES_KEY = "hb9om_offline_overrides";
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

export async function cacheFromServer() {
  try {
    const [cached, overrides] = await Promise.all([
      base44.entities.ReferenceData.list(),
      base44.entities.ReferenceOverride.list()
    ]);

    const data = { sota: [], pota: [], hbff: [], wwbota: [], castle: [] };
    (cached || []).forEach(entry => {
      if (!entry.references) return;
      if (entry.type === 'sota') data.sota = entry.references;
      if (entry.type === 'pota') data.pota = entry.references;
      if (entry.type === 'hbff') data.hbff = entry.references;
      if (entry.type === 'wwbota') data.wwbota = entry.references;
      if (entry.type === 'castle') data.castle = entry.references;
    });
    cacheReferenceData(data);

    const overrideMap = {};
    (overrides || []).forEach(o => {
      const key = `${o.reference_type}:${o.original_code}`;
      overrideMap[key] = o;
    });
    cacheOverrides(overrideMap);
    return true;
  } catch (e) {
    return false;
  }
}