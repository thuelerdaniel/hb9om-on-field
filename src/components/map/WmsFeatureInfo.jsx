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
      { id: "ch.bfe.projektierungszonen-starkstromanlagen_v2_0.oereb", name: "Projektierungszonen Starkstrom" }
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
const HIDDEN_PROPS = [
  "shape", "geom", "geometry", "geo_shape", "the_geom", "label", "fid",
  "subareanumber", "objectid", "objekt_id", "id", "uuid", "gid",
  "lon", "lat", "longitude", "latitude", "x", "y", "coord_x", "coord_y",
  "ch5a", "ch5b", "ch5c", "importdate", "importguid", "datenherr",
  "quelle", "source", "revision", "revid", "nr", "no", "code",
  "linkurldescription", "linkurl", "url", "frequencies",
  "kanton", "gemeinde", "datum", "bemerkung", "beschreibung", "description",
  "refobjbln", "subareaname", "teilobjekt", "inventar", "biozone",
  "bln_fl", "bln_obj", "bln_name", "objekt", "flaeche", "area",
  "spannungandere", "stromnetztyp", "frequenz"
];

// Only show these key properties for hazards layer (in this order)
const HAZARD_PROP_WHITELIST = ["bezeichnung", "name", "eigentuemer", "betreiber", "spannung", "leitungtyp", "typ", "type", "status"];

// Only show these key properties for nature zones
const NATURE_PROP_WHITELIST = ["name", "bln_name", "objekt", "teilobjekt", "typ", "type", "status"];

const PROP_LABELS = {
  bezeichnung: "Bezeichnung",
  name: "Name",
  bln_name: "Name",
  eigentuemer: "Eigentümer",
  betreiber: "Betreiber",
  spannung: "Spannung",
  voltage: "Spannung",
  leitungtyp: "Leitungstyp",
  typ: "Typ",
  type: "Typ",
  status: "Status",
  objekt: "Objekt",
  teilobjekt: "Teilobjekt"
};

const MAX_FEATURES_PER_LAYER = 3;

function formatPropName(key) {
  const lower = key.toLowerCase();
  if (HIDDEN_PROPS.includes(lower)) return null;
  if (PROP_LABELS[lower]) return PROP_LABELS[lower];
  return null; // Hide any property not in our label map
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

function buildPopupHtml(results, layerLookup) {
  const byLayer = {};
  results.forEach(r => {
    const layerInfo = layerLookup[r.layerBodId];
    if (!layerInfo) return;
    if (!byLayer[r.layerBodId]) byLayer[r.layerBodId] = { info: layerInfo, features: [] };
    byLayer[r.layerBodId].features.push(r);
  });

  const sections = Object.values(byLayer).map(({ info, features }) => {
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
        : '<div style="font-size:12px;color:#9ca3af;">Keine Detaildaten verfügbar</div>';
      const linkHtml = linkUrl
        ? `<div style="margin-top:4px;"><a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">📄 Datenblatt →</a></div>`
        : "";
      return `<div style="${idx < limited.length - 1 ? "margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #f3f4f6;" : ""}">${propHtml}${linkHtml}</div>`;
    }).join("");

    const moreHtml = remaining > 0
      ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px;">+ ${remaining} weitere(s) Objekt(e)</div>`
      : "";

    return `<div style="margin-bottom:8px;">
      <div style="font-weight:600;font-size:12px;margin-bottom:3px;color:${info.groupColor};">${info.icon} ${escapeHtml(info.name)}</div>
      ${featureHtml}${moreHtml}
    </div>`;
  }).join("");

  return `<div style="min-width:200px;max-width:280px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #f3f4f6;">
      <span style="font-size:14px;">📍</span>
      <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#374151;">Standort-Info</span>
    </div>
    ${sections}
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #f3f4f6;">
      <a href="https://map.geo.admin.ch/?lang=de" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#2563eb;text-decoration:none;">In map.geo.admin.ch öffnen →</a>
    </div>
  </div>`;
}

async function identifyLayer(layerId, lat, lng, mapExtent, imageSize) {
  const url =
    "https://api3.geo.admin.ch/rest/services/api/MapServer/identify" +
    `?geometry=${lng.toFixed(6)},${lat.toFixed(6)}` +
    "&geometryType=esriGeometryPoint" +
    `&layers=all:${layerId}` +
    "&tolerance=20&returnGeometry=false&sr=4326&lang=de" +
    `&imageDisplay=${imageSize.x},${imageSize.y},96` +
    `&mapExtent=${mapExtent}`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
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
      const bounds = map.getBounds();
      const size = map.getSize();
      const mapExtent = `${bounds.getWest().toFixed(6)},${bounds.getSouth().toFixed(6)},${bounds.getEast().toFixed(6)},${bounds.getNorth().toFixed(6)}`;

      const popup = L.popup({ maxWidth: 300, autoClose: true, closeOnClick: true })
        .setLatLng(e.latlng)
        .setContent(
          '<div style="min-width:140px;text-align:center;padding:6px;"><div style="font-size:12px;color:#6b7280;">⏳ Lade…</div></div>'
        )
        .openOn(map);

      try {
        const promises = layerIds.map(id => identifyLayer(id, lat, lng, mapExtent, size));
        const layerResults = await Promise.all(promises);
        const allResults = layerResults.flat();
        const results = deduplicateResults(allResults);

        if (results.length === 0) {
          map.closePopup(popup);
          return;
        }

        popup.setContent(buildPopupHtml(results, layerLookup));
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