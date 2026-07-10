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
      { id: "ch.bfe.projektierungszonen-starkstromanlagen", name: "Projektierungszonen Starkstrom" }
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

const HIDDEN_PROPS = ["shape", "geom", "geometry", "geo_shape", "the_geom"];
const PROP_LABELS = {
  name: "Name",
  betreiber: "Betreiber",
  spannung: "Spannung",
  voltage: "Spannung",
  typ: "Typ",
  type: "Typ",
  status: "Status",
  bemerkung: "Bemerkung",
  beschreibung: "Beschreibung",
  description: "Beschreibung",
  flaeche: "Fläche",
  area: "Fläche",
  objectid: "ID",
  objekt_id: "ID",
  kanton: "Kanton",
  gemeinde: "Gemeinde",
  datum: "Datum"
};

function formatPropName(key) {
  const lower = key.toLowerCase();
  if (HIDDEN_PROPS.includes(lower)) return null;
  if (PROP_LABELS[lower]) return PROP_LABELS[lower];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function escapeHtml(val) {
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPopupHtml(results, layerLookup) {
  const byLayer = {};
  results.forEach(r => {
    const layerInfo = layerLookup[r.layerBodId];
    if (!layerInfo) return;
    if (!byLayer[r.layerBodId]) byLayer[r.layerBodId] = { info: layerInfo, features: [] };
    byLayer[r.layerBodId].features.push(r);
  });

  const sections = Object.values(byLayer).map(({ info, features }) => {
    const featureHtml = features.map((f, idx) => {
      const props = f.properties || {};
      const propEntries = Object.entries(props)
        .map(([k, v]) => [formatPropName(k), v])
        .filter(([label]) => label !== null && label !== undefined);
      const propHtml = propEntries.length > 0
        ? propEntries.map(([label, val]) =>
            `<div style="font-size:12px;color:#4b5563;"><span style="font-weight:600;color:#374151;">${escapeHtml(label)}:</span> ${escapeHtml(val)}</div>`
          ).join("")
        : '<div style="font-size:12px;color:#9ca3af;">Keine Detaildaten verfügbar</div>';
      return `<div style="${idx < features.length - 1 ? "margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f3f4f6;" : ""}">${propHtml}</div>`;
    }).join("");

    return `<div style="margin-bottom:8px;">
      <div style="font-weight:600;font-size:12px;margin-bottom:4px;color:${info.groupColor};">${info.icon} ${escapeHtml(info.name)}</div>
      ${featureHtml}
    </div>`;
  }).join("");

  return `<div style="min-width:220px;max-width:300px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f3f4f6;">
      <div style="font-size:16px;">📍</div>
      <div>
        <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#374151;">Standort-Info</span>
        <p style="font-size:11px;color:#9ca3af;margin:0;">${results.length} Objekt(e) an diesem Standort</p>
      </div>
    </div>
    ${sections}
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f3f4f6;">
      <a href="https://map.geo.admin.ch/?lang=de" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">In map.geo.admin.ch öffnen →</a>
    </div>
  </div>`;
}

export default function WmsFeatureInfo({ activeLayers, clickMode }) {
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

      const { lat, lng } = e.latlng;

      const popup = L.popup({ maxWidth: 320 })
        .setLatLng(e.latlng)
        .setContent(
          '<div style="min-width:180px;text-align:center;padding:8px;"><div style="font-size:12px;color:#6b7280;">⏳ Lade Standort-Info…</div></div>'
        )
        .openOn(map);

      try {
        const url =
          "https://api3.geo.admin.ch/rest/services/api/MapServer/identify" +
          `?geometry=${lng.toFixed(6)},${lat.toFixed(6)}` +
          "&geometryType=esriGeometryPoint" +
          `&layers=all:${layerIds.join(",")}` +
          "&tolerance=20&returnGeometry=false&sr=4326&lang=de";

        const res = await fetch(url);
        if (!res.ok) { map.closePopup(popup); return; }

        const data = await res.json();
        const results = data.results || [];
        if (results.length === 0) {
          map.closePopup(popup);
          return;
        }

        popup.setContent(buildPopupHtml(results, layerLookup));
      } catch (err) {
        map.closePopup(popup);
      }
    }
  });

  return null;
}