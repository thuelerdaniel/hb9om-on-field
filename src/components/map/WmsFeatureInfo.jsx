import React from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";

const LAYER_GROUPS = {
  hazards: {
    label: "Gefahren & Störquellen",
    color: "#dc2626",
    icon: "⚡",
    layers: [
      { id: "ch.bfe.elektrische-anlagen_ueber_36", name: "Elektrische Anlagen (>36 kV)" },
      { id: "ch.bfe.projektierungszonen-starkstromanlagen_v2_0.oereb", name: "Projektierungszonen Starkstrom" },
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
  "spannungandere", "stromnetztyp",
  // multi-language suffixes (we only show _de or non-suffixed)
  "typ_fr", "typ_it", "typ_en", "power_fr", "power_it", "power_en",
  "techno_fr", "techno_it", "techno_en", "adaptiv_fr", "adaptiv_it", "adaptiv_en",
  "bewilligung_fr", "bewilligung_it", "bewilligung_en", "agw_fr", "agw_it", "agw_en"
]);

const PROP_LABELS = {
  bezeichnung: "Bezeichnung", name: "Name", bln_name: "Name",
  eigentuemer: "Eigentümer", betreiber: "Betreiber", betreibername: "Betreiber",
  spannung: "Spannung", voltage: "Spannung", leitungtyp: "Leitungstyp",
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
  // BAKOM Mobilfunkanlagen
  station: "Station", koord: "Koordinaten (LV95)",
  power_de: "Leistungsklasse", techno_de: "Technologie",
  adaptiv_de: "Adaptiver Betrieb", bewilligung_de: "Bewilligung",
  agw_de: "Anlagegrenzwert"
};

const MAX_FEATURES_PER_LAYER = 3;

function formatPropName(key) {
  const lower = key.toLowerCase();
  // Hide technical/internal fields and multi-language variants
  if (HIDDEN_PROPS.has(lower)) return null;
  // Hide _fr, _it, _en suffixes (keep _de or non-suffixed)
  if (/_fr$|_it$|_en$/.test(lower)) return null;
  // Use label if known, otherwise capitalize the key
  if (PROP_LABELS[lower]) return PROP_LABELS[lower];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatPropValue(val) {
  if (val === null || val === undefined || val === "") return "–";
  const s = String(val);
  return s
    .replace(/^S(\d+)kV$/, "$1 kV")
    .replace(/^F(\d+)Hz$/, "$1 Hz");
}

function escapeHtml(val) {
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getLinkUrl(props) {
  for (const key of ["linkurl", "linkurldescription", "url"]) {
    if (props[key]) return props[key];
  }
  return null;
}

function deduplicateResults(results) {
  const seen = new Set();
  return results.filter(r => {
    const attrs = r.attributes || {};
    const key = `${r.layerBodId}:${attrs.fid || attrs.bln_obj || attrs.label || r.featureId || r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// WGS84 -> LV95 (Swiss grid EPSG:2056), accuracy ~1m for Switzerland
function wgs84ToLV95(lat, lng) {
  const phi = ((lat - 46.95240555555556) * 3600) / 10000;
  const lambda = ((lng - 7.439583333333333) * 3600) / 10000;
  const y =
    600072.37 + 211455.93 * lambda - 10938.51 * lambda * phi - 0.36 * lambda * phi * phi - 44.54 * lambda * lambda * lambda;
  const x =
    200147.07 + 308807.95 * phi + 3745.25 * lambda * lambda - 76.63 * phi * phi - 194.56 * lambda * lambda * phi + 119.79 * phi * phi * phi;
  return { E: Math.round(y + 2000000), N: Math.round(x + 1000000) };
}

function buildMapAdminUrl(lat, lng, zoom, layerIds) {
  const { E, N } = wgs84ToLV95(lat, lng);
  // map.geo.admin.ch zoom levels: 0 (whole CH) to 13 (street level); convert from Leaflet zoom
  const mapAdminZ = Math.max(0, Math.min(13, Math.round(zoom - 2)));
  // layers are separated by semicolon; add visibility=t and opacity=1 for each
  const layersParam = layerIds.length > 0
    ? `&layers=${layerIds.map(id => `${id},t,1.0`).join(";")}`
    : "";
  // crosshair=marker,E,N places a marker pin at the exact clicked location
  return `https://map.geo.admin.ch/#/map?lang=de&center=${E},${N}&z=${mapAdminZ}&crosshair=marker,${E},${N}&bgLayer=ch.swisstopo.pixelkarte-farbe${layersParam}`;
}

function buildPopupHtml(results, layerLookup, clickLat, clickLng, zoom) {
  const byLayer = {};
  results.forEach(r => {
    const layerInfo = layerLookup[r.layerBodId];
    if (!layerInfo) return;
    if (!byLayer[r.layerBodId]) byLayer[r.layerBodId] = { info: layerInfo, features: [] };
    byLayer[r.layerBodId].features.push(r);
  });

  const allLayerIds = Object.keys(byLayer);

  const sections = Object.entries(byLayer).map(([layerBodId, { info, features }]) => {
    const limited = features.slice(0, MAX_FEATURES_PER_LAYER);
    const remaining = features.length - limited.length;

    const featureHtml = limited.map((f, idx) => {
      const props = f.attributes || f.properties || {};
      const linkUrl = getLinkUrl(props);
      const propEntries = Object.entries(props)
        .map(([k, v]) => [formatPropName(k), v])
        .filter(([label]) => label !== null && label !== undefined);
      const propHtml = propEntries.length > 0
        ? propEntries.map(([label, val]) =>
            `<div style="font-size:12px;color:#4b5563;line-height:1.4;"><span style="font-weight:600;color:#374151;">${escapeHtml(label)}:</span> ${escapeHtml(formatPropValue(val))}</div>`
          ).join("")
        : "";
      const linkHtml = linkUrl
        ? `<div style="margin-top:4px;"><a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">📄 Datenblatt →</a></div>`
        : "";
      return `<div style="${idx < limited.length - 1 ? "margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #f3f4f6;" : ""}">${propHtml}${linkHtml}</div>`;
    }).join("");

    const moreHtml = remaining > 0
      ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px;">+ ${remaining} weitere(s) Objekt(e)</div>`
      : "";

    const layerMapAdminUrl = buildMapAdminUrl(clickLat, clickLng, zoom, [layerBodId]);
    const mapAdminLink = `<div style="margin-top:4px;"><a href="${escapeHtml(layerMapAdminUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">🗺️ In map.geo.admin.ch öffnen →</a></div>`;

    return `<div style="margin-bottom:8px;">
      <div style="font-weight:600;font-size:12px;margin-bottom:3px;color:${info.groupColor};">${info.icon} ${escapeHtml(info.name)}</div>
      ${featureHtml}${moreHtml}${mapAdminLink}
    </div>`;
  }).join("");

  const bottomMapAdminUrl = buildMapAdminUrl(clickLat, clickLng, zoom, allLayerIds);

  return `<div style="min-width:200px;max-width:280px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #f3f4f6;">
      <span style="font-size:14px;">📍</span>
      <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#374151;">Standort-Info</span>
    </div>
    ${sections}
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #f3f4f6;">
      <a href="${escapeHtml(bottomMapAdminUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">Alle Layer in map.geo.admin.ch öffnen →</a>
    </div>
  </div>`;
}

async function identifyLayer(layerId, lat, lng, mapExtent, imageSize) {
  const url =
    "https://api3.geo.admin.ch/rest/services/api/MapServer/identify" +
    `?geometry=${lng.toFixed(6)},${lat.toFixed(6)}` +
    "&geometryType=esriGeometryPoint" +
    `&layers=all:${layerId}` +
    "&tolerance=30&returnGeometry=false&sr=4326&lang=de" +
    `&imageDisplay=${imageSize.x},${imageSize.y},96` +
    `&mapExtent=${mapExtent}`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
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

      // In performance mode: only query the most important layers (skip Mobilfunk/Richtfunk details)
      let queryLayerIds = layerIds;
      if (performanceMode) {
        queryLayerIds = layerIds.filter(id =>
          id === "ch.bfe.elektrische-anlagen_ueber_36" ||
          id === "ch.bfe.projektierungszonen-starkstromanlagen_v2_0.oereb"
        );
        if (queryLayerIds.length === 0) queryLayerIds = layerIds;
      }

      const { lat, lng } = e.latlng;
      const bounds = map.getBounds();
      const size = map.getSize();
      const zoom = map.getZoom();
      const mapExtent = `${bounds.getWest().toFixed(6)},${bounds.getSouth().toFixed(6)},${bounds.getEast().toFixed(6)},${bounds.getNorth().toFixed(6)}`;

      const popup = L.popup({ maxWidth: 300, autoClose: true, closeOnClick: false })
        .setLatLng(e.latlng)
        .setContent(
          '<div style="min-width:140px;text-align:center;padding:6px;"><div style="font-size:12px;color:#6b7280;">⏳ Lade…</div></div>'
        )
        .openOn(map);

      try {
        const promises = queryLayerIds.map(id => identifyLayer(id, lat, lng, mapExtent, size));
        const layerResults = await Promise.all(promises);
        const allResults = layerResults.flat();
        const results = deduplicateResults(allResults);

        if (results.length === 0) {
          const allLayerIds = layerIds;
          const mapAdminUrl = buildMapAdminUrl(lat, lng, zoom, allLayerIds);
          popup.setContent(
            '<div style="min-width:200px;max-width:260px;">' +
            '<div style="font-size:12px;color:#6b7280;margin-bottom:6px;">Keine Detaildaten an diesem Standort.</div>' +
            '<a href="' + escapeHtml(mapAdminUrl) + '" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">🗺️ In map.geo.admin.ch öffnen →</a>' +
            '</div>'
          );
          return;
        }

        popup.setContent(buildPopupHtml(results, layerLookup, lat, lng, zoom));
      } catch (err) {
        popup.setContent(
          '<div style="font-size:12px;color:#ef4444;padding:4px;">Fehler: ' +
          escapeHtml(err.message || "Unbekannt") +
          '</div>'
        );
      }
    }
  });

  return null;
}