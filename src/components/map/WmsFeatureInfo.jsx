import React from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";

const LAYER_GROUPS = {
  hazards: {
    label: "Gefahren & Störquellen",
    color: "#dc2626",
    icon: "⚡",
    layers: [
      { id: "ch.bfe.elektrische-anlagen_ueber_36", name: "Starkstromanlagen (>36 kV)" },
      { id: "ch.bakom.standorte-mobilfunkanlagen", name: "Mobilfunkantennen" },
      { id: "ch.bakom.richtfunkverbindungen", name: "Richtfunkstrecken" },
      { id: "ch.bakom.radio-fernsehsender", name: "Radio- & Fernsehsender" }
    ]
  },
  swiss_protected: {
    label: "Natur Zonen / Bundesinventare",
    color: "#16a085",
    icon: "🌿",
    layers: [
      { id: "ch.bafu.bundesinventare-bln", name: "BLN Landschaften" },
      { id: "ch.bafu.bundesinventare-flachmoore", name: "Flachmoore" },
      { id: "ch.bafu.bundesinventare-moorlandschaften", name: "Moorlandschaften" },
      { id: "ch.bafu.bundesinventare-vogelreservate", name: "Vogelreservate" }
    ]
  }
};

// Properties to always hide (technical/internal fields)
const HIDDEN_PROPS = new Set([
  "shape", "geom", "geometry", "geo_shape", "the_geom", "label", "fid",
  "subareanumber", "objectid", "objekt_id", "id", "uuid", "gid",
  "lon", "lat", "longitude", "latitude", "x", "y", "coord_x", "coord_y",
  "ch5a", "ch5b", "ch5c", "importdate", "importguid", "datenherr",
  "quelle", "source", "revision", "revid", "nr", "no",
  "linkurldescription", "linkurl", "url", "frequencies",
  "kanton", "gemeinde", "datum", "bemerkung", "beschreibung", "description",
  "refobjbln", "subareaname", "teilobjekt", "inventar", "biozone",
  "bln_fl", "bln_obj", "flaeche", "area",
  "spannungandere"
]);

const PROP_LABELS = {
  bezeichnung: "Bezeichnung", name: "Name", bln_name: "Name",
  eigentuemer: "Eigentümer", betreiber: "Betreiber", betreibername: "Betreiber",
  spannung: "Spannung", voltage: "Spannung", leitungtyp: "Trasseetyp",
  stromnetztyp: "Stromnetz",
  typ: "Typ", typ_de: "Typ", type: "Typ", status: "Status",
  standort: "Standort", standortbezeichnung: "Standortbezeichnung",
  sendeleistung: "Sendeleistung", frequenz: "Frequenz", frequenzbereich: "Frequenzbereich",
  antennentyp: "Antennentyp", antennenhoehe: "Antennenhöhe",
  azimut: "Azimut", elevation: "Elevation", polarisation: "Polarisation",
  kanal: "Kanal", bandbreite: "Bandbreite", programm: "Programm",
  dienstart: "Dienstart", system: "System", sektor: "Sektor",
  tilt: "Tilt", gain: "Gain", betriebsstatus: "Betriebsstatus",
  inbetriebnahme: "Inbetriebnahme", sendeanlage: "Sendeanlage",
  objekt: "Objekt", teilobjekt: "Teilobjekt",
  station: "Station", koord: "Koordinaten (LV95)",
  power_de: "Leistungsklasse", techno_de: "Technologie",
  adaptiv_de: "Adaptiver Betrieb", bewilligung_de: "Bewilligung",
  agw_de: "Anlagegrenzwert", link_class: "Klasse"
};

// Redundant prefixes to strip from values (label already conveys this)
const VALUE_PREFIXES = [
  "Leistungsklasse : ", "Technologie ", "Anlagegrenzwert ",
  "Classe de puissance : ", "Classe di potenza : ", "Power class : "
];

const MAX_FEATURES_PER_LAYER = 3;
const MAX_RESULTS_PER_LAYER = 10;
const MAX_VALUE_LENGTH = 150;
const REQUEST_TIMEOUT_MS = 8000;

function formatPropName(key) {
  const lower = key.toLowerCase();
  if (HIDDEN_PROPS.has(lower)) return null;
  if (/_fr$|_it$|_en$/.test(lower)) return null;
  if (PROP_LABELS[lower]) return PROP_LABELS[lower];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatPropValue(val, key) {
  if (val === null || val === undefined || val === "") {
    // BAKOM adaptiv_de: empty = conventional antennas only (per BAKOM docs)
    if (key && key.toLowerCase() === "adaptiv_de") return "Keine Angabe (konventionell)";
    return null; // null = skip entirely
  }
  let s = String(val).trim();
  // Strip redundant prefixes
  for (const prefix of VALUE_PREFIXES) {
    if (s.startsWith(prefix)) { s = s.substring(prefix.length); break; }
  }
  // Format voltage/frequency codes
  s = s.replace(/^S(\d+)kV$/, "$1 kV").replace(/^F(\d+)Hz$/, "$1 Hz");
  if (s === "") return null;
  if (s.length > MAX_VALUE_LENGTH) s = s.substring(0, MAX_VALUE_LENGTH) + "…";
  return s;
}

function escapeHtml(val) {
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// WGS84 -> LV95 (Swiss grid EPSG:2056), accuracy ~1m for Switzerland
function wgs84ToLV95(lat, lng) {
  const phi = ((lat - 46.95240555555556) * 3600) / 10000;
  const lambda = ((lng - 7.439583333333333) * 3600) / 10000;
  const y = 600072.37 + 211455.93 * lambda - 10938.51 * lambda * phi - 0.36 * lambda * phi * phi - 44.54 * lambda * lambda * lambda;
  const x = 200147.07 + 308807.95 * phi + 3745.25 * lambda * lambda - 76.63 * phi * phi - 194.56 * lambda * lambda * phi + 119.79 * phi * phi * phi;
  return { E: Math.round(y + 2000000), N: Math.round(x + 1000000) };
}

function buildMapAdminUrl(lat, lng, zoom, layerIds) {
  const { E, N } = wgs84ToLV95(lat, lng);
  const mapAdminZ = Math.max(0, Math.min(13, Math.round(zoom - 2)));
  const layersParam = layerIds.length > 0 ? `&layers=${layerIds.join(";")}` : "";
  return `https://map.geo.admin.ch/#/map?lang=de&center=${E},${N}&z=${mapAdminZ}&crosshair=marker,${E},${N}&bgLayer=ch.swisstopo.pixelkarte-farbe${layersParam}`;
}

function buildFeatureHtml(props, isLast) {
  const propEntries = Object.entries(props)
    .map(([k, v]) => [formatPropName(k), formatPropValue(v, k)])
    .filter(([label, val]) => label !== null && label !== undefined && val !== null);
  const propHtml = propEntries.length > 0
    ? propEntries.map(([label, val]) =>
        `<div style="font-size:12px;color:#4b5563;line-height:1.4;"><span style="font-weight:600;color:#374151;">${escapeHtml(label)}:</span> ${escapeHtml(val)}</div>`
      ).join("")
    : '<div style="font-size:11px;color:#9ca3af;">Keine Detaildaten verfügbar.</div>';
  return `<div style="${isLast ? "" : "margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #f3f4f6;"}">${propHtml}</div>`;
}

// Group mobilfunk results by station name — show unique stations, not duplicate entries
function deduplicateMobilfunk(results) {
  const byStation = new Map();
  for (const r of results) {
    const station = r.attributes?.station || r.attributes?.label || r.featureId;
    if (!byStation.has(station)) byStation.set(station, r);
  }
  return Array.from(byStation.values());
}

function deduplicateResults(results) {
  const mobilfunk = results.filter(r => r.layerBodId === "ch.bakom.standorte-mobilfunkanlagen");
  const others = results.filter(r => r.layerBodId !== "ch.bakom.standorte-mobilfunkanlagen");

  // Mobilfunk: group by station name
  const dedupMobilfunk = deduplicateMobilfunk(mobilfunk);

  // Others: dedup by fid/label
  const seen = new Set();
  const dedupOthers = others.filter(r => {
    const attrs = r.attributes || {};
    const key = `${r.layerBodId}:${attrs.fid || attrs.label || r.featureId || r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...dedupOthers, ...dedupMobilfunk];
}

function buildPopupHtml(results, layerLookup, clickLat, clickLng, zoom) {
  const byLayer = {};
  for (const r of results) {
    const info = layerLookup[r.layerBodId];
    if (!info) continue;
    if (!byLayer[r.layerBodId]) byLayer[r.layerBodId] = { info, features: [] };
    if (byLayer[r.layerBodId].features.length < MAX_RESULTS_PER_LAYER) {
      byLayer[r.layerBodId].features.push(r);
    }
  }

  const allLayerIds = Object.keys(byLayer);

  const sections = Object.entries(byLayer).map(([layerBodId, { info, features }]) => {
    const limited = features.slice(0, MAX_FEATURES_PER_LAYER);
    const remaining = features.length - limited.length;
    const featureHtml = limited.map((f, idx) => buildFeatureHtml(f.attributes || f.properties || {}, idx === limited.length - 1)).join("");
    const moreHtml = remaining > 0 ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px;">+ ${remaining} weitere(s) Objekt(e)</div>` : "";

    // BAKOM layers get an extra info link
    const isBakom = layerBodId.startsWith("ch.bakom");
    const bakomLink = isBakom
      ? `<div style="margin-top:2px;"><a href="https://www.bakom.admin.ch/de/standorte-von-sendeanlagen" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">📡 BAKOM Sendeanlagen-Übersicht →</a></div>`
      : "";
    const mapAdminLink = `<div style="margin-top:2px;"><a href="${escapeHtml(buildMapAdminUrl(clickLat, clickLng, zoom, [layerBodId]))}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">🗺️ In map.geo.admin.ch öffnen →</a></div>`;

    return `<div style="margin-bottom:8px;"><div style="font-weight:600;font-size:12px;margin-bottom:3px;color:${info.groupColor};">${info.icon} ${escapeHtml(info.name)}</div>${featureHtml}${moreHtml}${bakomLink}${mapAdminLink}</div>`;
  }).join("");

  return `<div style="min-width:200px;max-width:280px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #f3f4f6;">
      <span style="font-size:14px;">📍</span>
      <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#374151;">Standort-Info</span>
    </div>
    ${sections}
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #f3f4f6;">
      <a href="${escapeHtml(buildMapAdminUrl(clickLat, clickLng, zoom, allLayerIds))}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">Alle Layer in map.geo.admin.ch öffnen →</a>
    </div>
  </div>`;
}

// Single combined identify call — 1 HTTP request for ALL layers
// Returns null on error (distinguishable from empty []), array of results on success
async function identifyAllLayers(layerIds, lat, lng, mapExtent, imageSize, tolerance) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = "https://api3.geo.admin.ch/rest/services/api/MapServer/identify" +
      `?geometry=${lng.toFixed(6)},${lat.toFixed(6)}` +
      "&geometryType=esriGeometryPoint" +
      `&layers=all:${layerIds.join(",")}` +
      `&tolerance=${tolerance}&returnGeometry=false&sr=4326&lang=de` +
      `&imageDisplay=${imageSize.x},${imageSize.y},96` +
      `&mapExtent=${mapExtent}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    if (err.name === 'AbortError') return null;
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export default function WmsFeatureInfo({ activeLayers, clickMode, performanceMode }) {
  const map = useMapEvents({
    click: async (e) => {
      if (clickMode) return;

      const activeGroups = Object.entries(LAYER_GROUPS).filter(
        ([key]) => activeLayers.includes(key)
      );
      if (activeGroups.length === 0) return;

      const layerLookup = {};
      const layerIds = [];
      activeGroups.forEach(([, config]) => {
        config.layers.forEach(l => {
          layerIds.push(l.id);
          layerLookup[l.id] = { ...l, groupColor: config.color, icon: config.icon };
        });
      });

      // Performance mode: only query the most important layers
      let queryLayerIds = layerIds;
      if (performanceMode) {
        queryLayerIds = layerIds.filter(id => id === "ch.bfe.elektrische-anlagen_ueber_36");
        if (queryLayerIds.length === 0) queryLayerIds = layerIds;
      }

      const { lat, lng } = e.latlng;
      const bounds = map.getBounds();
      const size = map.getSize();
      const zoom = map.getZoom();
      const mapExtent = `${bounds.getWest().toFixed(6)},${bounds.getSouth().toFixed(6)},${bounds.getEast().toFixed(6)},${bounds.getNorth().toFixed(6)}`;

      // Dynamic tolerance: higher when zoomed out (features are sparse), lower when zoomed in
      // Touch devices get doubled tolerance for easier tapping of small features
      const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      const baseTolerance = zoom <= 10 ? 20 : zoom <= 13 ? 12 : 8;
      const tolerance = isTouch ? baseTolerance * 2 : baseTolerance;

      const popup = L.popup({ maxWidth: 300, autoClose: true, closeOnClick: true })
        .setLatLng(e.latlng)
        .setContent('<div style="min-width:140px;text-align:center;padding:6px;"><div style="font-size:12px;color:#6b7280;">⏳ Lade…</div></div>')
        .openOn(map);

      try {
        const allResults = await identifyAllLayers(queryLayerIds, lat, lng, mapExtent, size, tolerance);

        // null = API error (network, timeout, etc.) — show error so user knows something went wrong
        if (allResults === null) {
          if (popup.isOpen()) {
            popup.setContent(
              '<div style="min-width:180px;padding:4px;"><div style="font-size:12px;color:#ef4444;">⚠ Abfrage fehlgeschlagen.</div>' +
              `<a href="${escapeHtml(buildMapAdminUrl(lat, lng, zoom, layerIds))}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">🗺️ In map.geo.admin.ch öffnen →</a>` +
              '</div>'
            );
          }
          return;
        }

        const results = deduplicateResults(allResults);

        if (results.length === 0) {
          map.closePopup(popup);
          return;
        }

        const html = buildPopupHtml(results, layerLookup, lat, lng, zoom);
        if (popup.isOpen()) {
          popup.setContent(html);
          popup.update();
        } else {
          // Popup was closed while loading — re-open with results
          popup.setContent(html);
          popup.openOn(map);
        }
      } catch (err) {
        if (popup.isOpen()) {
          popup.setContent(
            '<div style="font-size:12px;color:#ef4444;padding:4px;">Fehler: ' + escapeHtml(err.message || "Unbekannt") + '</div>'
          );
        }
      }
    }
  });

  return null;
}