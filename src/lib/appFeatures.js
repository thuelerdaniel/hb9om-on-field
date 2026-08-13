// @ts-nocheck
// ============================================================
// appFeatures.js — Personalisierbare Feature- und Layer-Auswahl
// Verwaltet User-Präferenzen für Layer, Bänder, Werkzeuge, Offline, Erweitert
// Speicherung: localStorage (immer) + User-Entity (eingeloggt)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Map: Feature-Key → LayerControl Group-ID (null = nur Sync-Quelle, kein Karten-Layer)
export const LAYER_KEY_MAP = {
  sota: "sota",
  pota: "pota",
  wwff: "hbff",
  wca: "castle",
  bota: "wwbota",
  tota: "tota",
  iota: "iota",
  lighthouse: "lighthouse",
  naturzonen: "swiss_protected",
  hazards: "hazards",
  fm_funknetz: null,
  ch_repeater_links: null,
  repeater: "repeater",
  aprs: "aprs",
  brandmeister: "brandmeister",
};

// Default: Layer alle an, Bänder alle an, Tools minimal (per Nachtrag)
export const DEFAULT_FEATURES = {
  layers: {
    sota: true, pota: true, wwff: true, wca: true, bota: true,
    tota: true, iota: true, lighthouse: true, naturzonen: true,
    hazards: true, fm_funknetz: true, ch_repeater_links: true,
    repeater: true, aprs: true, brandmeister: true,
  },
  bands: {
    "160m": true, "80m": true, "60m": true, "40m": true, "30m": true,
    "20m": true, "17m": true, "15m": true, "12m": true, "10m": true,
    "6m": true, "2m": true, "1.25m": true, "70cm": true, "33cm": true, "23cm": true,
  },
  tools: {
    fox_hunt: false, legende: false, filter: false, zoom: true,
    search: false, coords: false, repeater_coverage: false, own_coverage: false,
    gps: true, qth_locator: false, height_profile: false,
    logbook: true, statistics: false, qso_add: true, dxcc: false,
    admin: true, json_import: false, sync_status: false,
    change_requests: false, feature_requests: false,
  },
  offline: {
    offline_mode: true, map_download: true, data_download: true, auto_cache: true,
  },
  advanced: {
    advanced_propagation: true, kw_propagation: true, solar_activity: "medium",
    auto_time: true, map_tile: "osm", marker_density: "medium",
    language: "de", imperial: false,
  },
};

// Quick-Button Presets
export const QUICK_PRESETS = {
  minimal: {
    layers: { sota: false, pota: false, wwff: false, wca: false, bota: false, tota: false, iota: false, lighthouse: false, naturzonen: false, hazards: false, fm_funknetz: false, ch_repeater_links: false, repeater: true, aprs: false, brandmeister: false },
    bands: { "160m": false, "80m": false, "60m": false, "40m": false, "30m": false, "20m": false, "17m": false, "15m": false, "12m": false, "10m": false, "6m": false, "2m": true, "1.25m": false, "70cm": true, "33cm": false, "23cm": false },
    tools: { fox_hunt: false, legende: false, filter: true, zoom: true, search: false, coords: false, repeater_coverage: true, own_coverage: true, gps: true, qth_locator: true, height_profile: false, logbook: true, statistics: false, qso_add: true, dxcc: false, admin: true, json_import: false, sync_status: false, change_requests: false, feature_requests: false },
    offline: { offline_mode: true, map_download: false, data_download: false, auto_cache: false },
    advanced: { advanced_propagation: true, kw_propagation: false, solar_activity: "medium", auto_time: true, map_tile: "osm", marker_density: "medium", language: "de", imperial: false },
  },
  standard: JSON.parse(JSON.stringify(DEFAULT_FEATURES)),
  kw: {
    layers: { sota: true, pota: true, wwff: true, wca: true, bota: true, tota: true, iota: true, lighthouse: true, naturzonen: true, hazards: true, fm_funknetz: false, ch_repeater_links: false, repeater: false, aprs: false, brandmeister: false },
    bands: { "160m": true, "80m": true, "60m": true, "40m": true, "30m": true, "20m": true, "17m": true, "15m": true, "12m": true, "10m": true, "6m": false, "2m": false, "1.25m": false, "70cm": false, "33cm": false, "23cm": false },
    tools: { fox_hunt: false, legende: false, filter: false, zoom: true, search: false, coords: false, repeater_coverage: false, own_coverage: true, gps: true, qth_locator: true, height_profile: false, logbook: true, statistics: false, qso_add: true, dxcc: false, admin: true, json_import: false, sync_status: false, change_requests: false, feature_requests: false },
    offline: { ...DEFAULT_FEATURES.offline },
    advanced: { advanced_propagation: true, kw_propagation: true, solar_activity: "medium", auto_time: true, map_tile: "osm", marker_density: "medium", language: "de", imperial: false },
  },
  vhf_uhf: {
    layers: { ...DEFAULT_FEATURES.layers },
    bands: { "160m": false, "80m": false, "60m": false, "40m": false, "30m": false, "20m": false, "17m": false, "15m": false, "12m": false, "10m": false, "6m": true, "2m": true, "1.25m": true, "70cm": true, "33cm": true, "23cm": true },
    tools: { ...DEFAULT_FEATURES.tools },
    offline: { ...DEFAULT_FEATURES.offline },
    advanced: { ...DEFAULT_FEATURES.advanced, kw_propagation: false },
  },
  two_seventy: {
    layers: { sota: false, pota: false, wwff: false, wca: false, bota: false, tota: false, iota: false, lighthouse: false, naturzonen: false, hazards: false, fm_funknetz: false, ch_repeater_links: false, repeater: true, aprs: false, brandmeister: false },
    bands: { "160m": false, "80m": false, "60m": false, "40m": false, "30m": false, "20m": false, "17m": false, "15m": false, "12m": false, "10m": false, "6m": false, "2m": true, "1.25m": false, "70cm": true, "33cm": false, "23cm": false },
    tools: { fox_hunt: false, legende: false, filter: true, zoom: true, search: false, coords: false, repeater_coverage: true, own_coverage: true, gps: true, qth_locator: true, height_profile: false, logbook: true, statistics: false, qso_add: true, dxcc: false, admin: true, json_import: false, sync_status: false, change_requests: false, feature_requests: false },
    offline: { ...DEFAULT_FEATURES.offline },
    advanced: { ...DEFAULT_FEATURES.advanced, kw_propagation: false },
  },
};

const STORAGE_KEY = "app_features";
const EVENT_NAME = "app-features-changed";

// --- Load / Save ---

export function loadFeatures() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_FEATURES));
    const parsed = JSON.parse(raw);
    return {
      layers: { ...DEFAULT_FEATURES.layers, ...parsed.layers },
      bands: { ...DEFAULT_FEATURES.bands, ...parsed.bands },
      tools: { ...DEFAULT_FEATURES.tools, ...parsed.tools },
      offline: { ...DEFAULT_FEATURES.offline, ...parsed.offline },
      advanced: { ...DEFAULT_FEATURES.advanced, ...parsed.advanced },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_FEATURES));
  }
}

let saveTimer = null;

export function saveFeatures(features) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: features }));
  // Debounce User-Entity save (500ms)
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistToUser(features), 500);
}

async function persistToUser(features) {
  try {
    await base44.auth.updateMe({ app_features: features });
  } catch {
    // Not logged in or error — localStorage is the fallback
  }
}

// Beim Login: User-Entity → localStorage (User gewinnt)
export async function syncFeaturesFromUser() {
  try {
    const me = await base44.auth.me();
    if (me?.app_features && typeof me.app_features === "object") {
      const merged = {
        layers: { ...DEFAULT_FEATURES.layers, ...me.app_features.layers },
        bands: { ...DEFAULT_FEATURES.bands, ...me.app_features.bands },
        tools: { ...DEFAULT_FEATURES.tools, ...me.app_features.tools },
        offline: { ...DEFAULT_FEATURES.offline, ...me.app_features.offline },
        advanced: { ...DEFAULT_FEATURES.advanced, ...me.app_features.advanced },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: merged }));
      return merged;
    }
  } catch {
    // Not logged in
  }
  return null;
}

// --- Helpers ---

export function isLayerEnabled(features, layerKey) {
  return features?.layers?.[layerKey] !== false;
}

export function isBandEnabled(features, bandKey) {
  return features?.bands?.[bandKey] !== false;
}

export function isToolEnabled(features, toolKey) {
  return features?.tools?.[toolKey] !== false;
}

export function isOfflineEnabled(features, offlineKey) {
  return features?.offline?.[offlineKey] !== false;
}

// Map LayerControl Group-ID → Feature-Key
export function layerIdToFeatureKey(layerId) {
  const entry = Object.entries(LAYER_KEY_MAP).find(([, v]) => v === layerId);
  return entry ? entry[0] : null;
}

// Abhängigkeiten: wenn Parent aus → Child auch aus
export function applyToolDependencies(tools) {
  const t = { ...tools };
  if (!t.gps) t.own_coverage = false;
  if (!t.logbook) t.qso_add = false;
  if (!t.admin) { t.json_import = false; t.sync_status = false; }
  if (!t.repeater_coverage) t.height_profile = false;
  return t;
}

// --- React Hook ---

export function useAppFeatures() {
  const [features, setFeaturesState] = useState(() => loadFeatures());

  useEffect(() => {
    const handler = (e) => {
      setFeaturesState(e.detail || loadFeatures());
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const setFeatures = useCallback((newFeatures) => {
    saveFeatures(newFeatures);
    setFeaturesState(newFeatures);
  }, []);

  return { features, setFeatures };
}