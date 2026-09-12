import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { base44 } from "@/api/base44Client";

const LAYER_CONFIG = {
  sota: { color: "#e74c3c", label: "SOTA", entity: "SotaPoint" },
  pota: { color: "#27ae60", label: "POTA", entity: "PotaPoint" },
  hbff: { color: "#8e44ad", label: "WWFF", entity: "WwffPoint" },
};

/**
 * MapLibre GL JS 3D map component — globe projection, 3D terrain, 3D buildings,
 * SOTA/POTA/WWFF markers with clustering. Completely separate from the Leaflet map.
 */
export default function Map3D({ terrainEnabled, activeLayers }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const activeLayersRef = useRef(activeLayers);
  activeLayersRef.current = activeLayers;
  const [loading, setLoading] = useState(true);

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
      if (!activeLayersRef.current.includes(type)) {
        const source = map.getSource(`${type}-points`);
        if (source) source.setData({ type: "FeatureCollection", features: [] });
        continue;
      }
      try {
        const points = await base44.entities[config.entity].filter(query, undefined, 5000, 0);
        const geojson = {
          type: "FeatureCollection",
          features: (points || []).map(p => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: { code: p.code, name: p.name || p.code },
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
      style: "https://tiles.openfreemap.org/styles/liberty",
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
      // Terrain source — AWS Terrarium tiles, EU bucket for low latency from CH
      map.addSource("terrain", {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod-eu/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        attribution: "Terrain: Mapzen, USGS, NASA (AWS Terrain Tiles)",
      });

      // Navigation controls — pitch + rotate via touch gestures
      map.addControl(new maplibregl.NavigationControl({
        visualizePitch: true,
        visualizeRoll: true,
      }), "top-right");

      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

      // Sky/atmosphere — try setSky (v4+) and setFog
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

        // Cluster circles
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

        // Cluster count labels
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

        // Individual markers
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

        // Popup on marker click
        map.on("click", `${type}-markers`, (e) => {
          if (e.features.length === 0) return;
          const f = e.features[0];
          const coordinates = f.geometry.coordinates.slice();
          const { code, name } = f.properties;
          new maplibregl.Popup()
            .setLngLat(coordinates)
            .setHTML(`<div style="font-family: sans-serif; padding: 4px;"><strong style="color: ${config.color};">${config.label}</strong><br/><strong>${code}</strong><br/>${name || ""}</div>`)
            .addTo(map);
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
    };
  }, [loadMarkers]);

  // Terrain toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("terrain")) return;
    if (terrainEnabled) {
      map.setTerrain({ source: "terrain", exaggeration: 1.2 });
    } else {
      map.setTerrain(null);
    }
  }, [terrainEnabled]);

  // Active layers change — reload markers
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      loadMarkers();
    }
  }, [activeLayers, loadMarkers]);

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