import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { base44 } from "@/api/base44Client";

const LAYER_CONFIG = {
  sota: { color: "#e74c3c", label: "SOTA", entity: "SotaPoint", codeField: "code", nameField: "name",
    extraProps: p => ({ points: p.points, altitude_m: p.altitude_m }) },
  pota: { color: "#27ae60", label: "POTA", entity: "PotaPoint", codeField: "code", nameField: "name",
    extraProps: p => ({ country: p.country, parkType: p.parkType }) },
  hbff: { color: "#8e44ad", label: "WWFF", entity: "WwffPoint", codeField: "code", nameField: "name",
    extraProps: p => ({ country_code: p.country_code, parkType: p.parkType }) },
  lighthouse: { color: "#dc2626", label: "Leuchtturm", entity: "Lighthouse", codeField: "code", nameField: "name",
    extraProps: p => ({ country: p.country }) },
  iota: { color: "#3498db", label: "IOTA", entity: "IotaPoint", codeField: "code", nameField: "name",
    extraProps: p => ({ country: p.country }) },
  llota: { color: "#0ea5e9", label: "LLOTA", entity: "LlotaRef", codeField: "code", nameField: "name",
    extraProps: p => ({ region: p.region, activation_count: p.activation_count }) },
  tota: { color: "#f97316", label: "TOTA", entity: "TotaPoint", codeField: "code", nameField: "name",
    extraProps: p => ({ country: p.country, height_m: p.height_m }) },
  repeater: { color: "#3b82f6", label: "Relais", entity: "Repeater", codeField: "callsign", nameField: "location_name",
    extraProps: p => ({ frequency: p.frequency, band: p.band, mode: p.primary_mode, offset_mhz: p.offset_mhz, tone: p.tone, dcs: p.dcs }) },
  castle: { color: "#e67e22", label: "COTA", entity: null, useFunction: "getReferencesInBounds", codeField: "code", nameField: "name",
    extraProps: p => ({ country: p.countryPrefix, source: p.source }) },
};

/**
 * MapLibre GL JS 3D map component — globe projection, 3D terrain, 3D buildings,
 * SOTA/POTA/WWFF/Repeater/etc markers with clustering. Completely separate from Leaflet.
 *
 * v0.951-FIX2: Accepts styleUrl prop for style selection (Liberty/Bright/Dark).
 * v0.951-FIX3: Terrain uses US bucket (more reliable) + mapLoaded state to fix race condition.
 */
export default function Map3D({ terrainEnabled, activeLayers, styleUrl }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const activeLayersRef = useRef(activeLayers);
  activeLayersRef.current = activeLayers;
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  const loadMarkers = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const query = {
      lat: { $gte: sw.lat, $lte: ne.lat },
      lng: { $gte: sw.lng, $lte: ne.lng },
    };

    for (const [type, config] of Object.entries(LAYER_CONFIG)) {
      // HOTFIX#3: Don't clear data for inactive layers — visibility is controlled
      // by setLayoutProperty in the activeLayers effect (FEHLER 3 fix)
      if (!activeLayersRef.current.includes(type)) continue;
      try {
        let points = [];
        if (config.useFunction === "getReferencesInBounds") {
          const res = await base44.functions.invoke("getReferencesInBounds", {
            types: [type],
            bounds: { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng },
          });
          points = res.data?.[type] || res?.[type] || [];
        } else if (config.entity) {
          points = await base44.entities[config.entity].filter(query, undefined, 5000, 0);
        }
        const geojson = {
          type: "FeatureCollection",
          features: (points || []).filter(p => p.lat != null && p.lng != null).map(p => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: {
              code: p[config.codeField] || "",
              name: p[config.nameField] || "",
              layerType: type,
              ...(config.extraProps ? config.extraProps(p) : {}),
            },
          })),
        };
        const source = map.getSource(`${type}-points`);
        if (source) source.setData(geojson);
      } catch (e) {
        console.warn(`[Map3D] Failed to load ${type} markers:`, e.message);
      }
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl || "https://tiles.openfreemap.org/styles/liberty",
      center: [8.2, 46.8],
      zoom: 7,
      pitch: 30,
      bearing: 0,
      projection: "globe",
      attributionControl: { compact: true },
      hash: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      // v0.951-FIX3: Terrain source — US bucket (more reliable than EU bucket)
      // + maxzoom 14 (terrain tiles only go to zoom 14)
      map.addSource("terrain", {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
        attribution: "Terrain: Mapzen, USGS, NASA (AWS Terrain Tiles)",
      });

      // Navigation controls — pitch + rotate via touch gestures
      map.addControl(new maplibregl.NavigationControl({
        visualizePitch: true,
        visualizeRoll: true,
      }), "top-right");

      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

      // Sky/atmosphere
      try {
        if (map.setSky) {
          map.setSky({ "sky-color": "#199EF2", "sky-horizon-blend": 0.5 });
        }
      } catch {}
      try {
        if (map.setFog) {
          map.setFog({ "color": "#ffffff", "high-color": "#dcefff", "horizon-blend": 0.2, "range": [1, 10] });
        }
      } catch {}

      // Initialize marker sources + layers for each reference type
      for (const [type, config] of Object.entries(LAYER_CONFIG)) {
        map.addSource(`${type}-points`, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 10,
          clusterRadius: 40,
        });

        map.addLayer({
          id: `${type}-clusters`,
          type: "circle",
          source: `${type}-points`,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": config.color,
            "circle-radius": ["step", ["get", "point_count"], 15, 50, 25, 100, 35],
            "circle-opacity": 0.7,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });

        map.addLayer({
          id: `${type}-cluster-count`,
          type: "symbol",
          source: `${type}-points`,
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#000000",
            "text-halo-width": 1,
          },
        });

        map.addLayer({
          id: `${type}-markers`,
          type: "circle",
          source: `${type}-points`,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": config.color,
            "circle-radius": 5,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
          },
        });

        map.on("click", `${type}-markers`, (e) => {
          if (e.features.length === 0) return;
          const f = e.features[0];
          const coordinates = f.geometry.coordinates.slice();
          const p = f.properties;
          let html = `<div style="font-family: sans-serif; padding: 6px; min-width: 200px;">`;
          html += `<div style="color: ${config.color}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${config.label}</div>`;
          html += `<div style="font-size: 14px; font-weight: 700; margin-bottom: 2px;">${p.code || ""}</div>`;
          if (p.name) html += `<div style="font-size: 12px; color: #374151; margin-bottom: 6px;">${p.name}</div>`;
          if (p.points != null) html += `<div style="font-size: 11px; color: #6b7280;">⭐ ${p.points} SOTA-Punkte</div>`;
          if (p.altitude_m != null) html += `<div style="font-size: 11px; color: #6b7280;">Höhe: ${p.altitude_m} m ü.M.</div>`;
          if (p.height_m != null) html += `<div style="font-size: 11px; color: #6b7280;">Turmhöhe: ${p.height_m} m</div>`;
          if (p.country || p.country_code) html += `<div style="font-size: 11px; color: #6b7280;">Land: ${p.country || p.country_code}</div>`;
          if (p.region) html += `<div style="font-size: 11px; color: #6b7280;">Region: ${p.region}</div>`;
          if (p.parkType) html += `<div style="font-size: 11px; color: #6b7280;">Typ: ${p.parkType}</div>`;
          if (p.activation_count != null) html += `<div style="font-size: 11px; color: #6b7280;">Aktivierungen: ${p.activation_count}</div>`;
          if (p.frequency != null) html += `<div style="font-size: 11px; color: #6b7280;">Freq: ${Number(p.frequency).toFixed(4)} MHz</div>`;
          if (p.band) html += `<div style="font-size: 11px; color: #6b7280;">Band: ${p.band}</div>`;
          if (p.mode) html += `<div style="font-size: 11px; color: #6b7280;">Mode: ${p.mode}</div>`;
          if (p.offset_mhz != null && p.offset_mhz !== 0) html += `<div style="font-size: 11px; color: #6b7280;">Offset: ${p.offset_mhz > 0 ? "+" : ""}${p.offset_mhz} MHz</div>`;
          if (p.tone) html += `<div style="font-size: 11px; color: #6b7280;">Tone: ${p.tone}</div>`;
          if (p.dcs) html += `<div style="font-size: 11px; color: #6b7280;">DCS: ${p.dcs}</div>`;
          html += `</div>`;
          new maplibregl.Popup().setLngLat(coordinates).setHTML(html).addTo(map);
        });

        map.on("mouseenter", `${type}-markers`, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", `${type}-markers`, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Cluster click — zoom into cluster
      map.on("click", (e) => {
        for (const type of Object.keys(LAYER_CONFIG)) {
          const features = map.queryRenderedFeatures(e.point, { layers: [`${type}-clusters`] });
          if (features.length > 0) {
            const clusterId = features[0].properties.cluster_id;
            map.getSource(`${type}-points`).getClusterExpansionZoom(clusterId).then(zoom => {
              map.easeTo({ center: features[0].geometry.coordinates, zoom });
            });
            break;
          }
        }
      });

      setMapLoaded(true);
      setLoading(false);
      loadMarkers();
    });

    // Debounced marker reload on map move
    let moveTimer = null;
    map.on("moveend", () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => loadMarkers(), 500);
    });

    return () => {
      if (moveTimer) clearTimeout(moveTimer);
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [loadMarkers, styleUrl]);

  // v0.951-FIX3: Terrain toggle — depends on mapLoaded to fix race condition
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getSource("terrain")) return;
    if (terrainEnabled) {
      map.setTerrain({ source: "terrain", exaggeration: 1.2 });
    } else {
      map.setTerrain(null);
    }
  }, [terrainEnabled, mapLoaded]);

  // Active layers change — reload markers
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      loadMarkers();
    }
  }, [activeLayers, loadMarkers]);

  // HOTFIX#3: Toggle layer visibility via setLayoutProperty (FEHLER 3 fix)
  // Uses stable layer IDs — does NOT regenerate IDs on each toggle.
  // setLayoutProperty('visibility','none'/'visible') reliably hides/shows layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    for (const type of Object.keys(LAYER_CONFIG)) {
      const visible = activeLayers.includes(type) ? "visible" : "none";
      for (const layerId of [`${type}-clusters`, `${type}-cluster-count`, `${type}-markers`]) {
        if (map.getLayer(layerId)) {
          try { map.setLayoutProperty(layerId, "visibility", visible); } catch {}
        }
      }
    }
  }, [activeLayers, mapLoaded]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 z-10">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}