import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

// WMS overlay tile layers for Swiss federal geoportal (map.geo.admin.ch).
// Renders BLN (swiss_protected) and Hazards (hazards) as visual overlays on the map.
// WmsFeatureInfo handles click events for feature identification; this component
// renders the actual WMS tiles so the layers are visible.
//
// WMS endpoint: https://wms.geo.admin.ch/ — supports EPSG:4326 (WGS84).
// Leaflet reprojects from EPSG:4326 to the map's EPSG:3857 automatically.

const WMS_BASE = "https://wms.geo.admin.ch/?";

const OVERLAY_GROUPS = {
  hazards: [
    "ch.bfe.elektrische-anlagen_ueber_36",
    "ch.bakom.standorte-mobilfunkanlagen",
    "ch.bakom.richtfunkverbindungen",
    "ch.bakom.radio-fernsehsender",
  ],
  swiss_protected: [
    "ch.bafu.bundesinventare-bln",
    "ch.bafu.bundesinventare-flachmoore",
    "ch.bafu.bundesinventare-moorlandschaften",
    "ch.bafu.bundesinventare-vogelreservate",
  ],
};

export default function WmsOverlayLayer({ activeLayers }) {
  const map = useMap();
  const layersRef = useRef({});

  useEffect(() => {
    const activeKey = activeLayers.join(",");
    const currentGroups = Object.keys(layersRef.current);

    // Remove layers no longer active
    for (const group of currentGroups) {
      if (!activeLayers.includes(group)) {
        map.removeLayer(layersRef.current[group]);
        delete layersRef.current[group];
      }
    }

    // Add newly active layers
    for (const group of Object.keys(OVERLAY_GROUPS)) {
      if (activeLayers.includes(group) && !layersRef.current[group]) {
        const layerIds = OVERLAY_GROUPS[group].join(",");
        const wmsLayer = L.tileLayer.wms(WMS_BASE, {
          layers: layerIds,
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          crs: L.CRS.EPSG4326,
          opacity: 0.6,
          attribution: '&copy; <a href="https://www.geo.admin.ch">geo.admin.ch</a>',
        });
        wmsLayer.addTo(map);
        layersRef.current[group] = wmsLayer;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers.join(","), map]);

  return null;
}