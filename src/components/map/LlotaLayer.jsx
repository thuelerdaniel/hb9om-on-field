import React, { memo, useMemo, useState, useCallback } from "react";
import { Polygon, CircleMarker, Popup, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Droplets, ExternalLink, MapPin } from "lucide-react";

// LLOTA Lakes Layer — renders lake polygons from LlotaRef.polygon field.
// v0.95: Polygon rendering when zoom >= 10, circle markers when zoomed out.
//
// Color coding:
//   Inactive (activation_count = 0): light blue, fill opacity 0.2
//   Activated (activation_count > 0): strong blue, fill opacity 0.4, with marker pin
//   Live activated (spot present): pulsing red ring around polygon
//
// Performance:
//   Max 200 polygons rendered simultaneously
//   Polygons only render when zoom >= 10

const MAX_POLYGONS = 200;
const POLYGON_ZOOM_THRESHOLD = 10;

// Create a divIcon for activated lakes (marker pin)
function createLakePinIcon(count) {
  return L.divIcon({
    html: `<div style="
      width: 24px; height: 24px;
      border-radius: 50% 50% 50% 0;
      background: #0ea5e9;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      transform: rotate(-45deg);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: bold; color: white;
    "><span style="transform: rotate(45deg);">${count > 0 ? count : ''}</span></div>`,
    className: "llota-lake-pin",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
}

function LlotaPopup({ lake }) {
  return (
    <div style={{ minWidth: 220, maxWidth: 280 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0ea5e9', marginBottom: 4 }}>
        {lake.code}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
        {lake.name || 'Unbenannter See'}
      </div>
      {lake.region && (
        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
          📍 {lake.region}
        </div>
      )}
      {lake.country_name && (
        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
          {lake.country_name}
        </div>
      )}
      {lake.description && (
        <div style={{ fontSize: 11, color: '#444', marginBottom: 6, lineHeight: 1.4 }}>
          {lake.description.substring(0, 200)}
          {lake.description.length > 200 ? '…' : ''}
        </div>
      )}
      {lake.access_info && (
        <div style={{ fontSize: 11, color: '#444', marginBottom: 6, lineHeight: 1.4 }}>
          <strong>Zugang:</strong> {lake.access_info.substring(0, 150)}
          {lake.access_info.length > 150 ? '…' : ''}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10, color: '#666', marginBottom: 6 }}>
        <span>🔥 Aktivierungen: {lake.activation_count || 0}</span>
        {lake.grid_locator && <span>Grid: {lake.grid_locator}</span>}
      </div>
      {lake.info_url && (
        <a
          href={lake.info_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: '#0ea5e9', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} /> Mehr Info
        </a>
      )}
    </div>
  );
}

function LlotaLayerInner({ lakes, activeLlotaRefs, searchQuery, filterCountries, activationFilter }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  // Filter lakes by search, country, and activation status
  const filteredLakes = useMemo(() => {
    if (!lakes || lakes.length === 0) return [];
    let result = lakes.filter(l => l.lat != null && l.lng != null);

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(l =>
        (l.code || '').toLowerCase().includes(q) ||
        (l.name || '').toLowerCase().includes(q)
      );
    }

    if (filterCountries && filterCountries.length > 0) {
      result = result.filter(l => {
        const cc = l.country_code || (l.code || '').split('-')[0] || '';
        return filterCountries.includes(cc);
      });
    }

    if (activationFilter === 'activated') {
      result = result.filter(l => (l.activation_count || 0) > 0);
    } else if (activationFilter === 'never') {
      result = result.filter(l => (l.activation_count || 0) === 0);
    }

    return result;
  }, [lakes, searchQuery, filterCountries, activationFilter]);

  // Active LLOTA refs set (for pulsing red ring)
  const activeRefSet = useMemo(() => new Set(activeLlotaRefs || []), [activeLlotaRefs]);

  // Split into polygon lakes and marker-only lakes
  const { polygonLakes, markerLakes } = useMemo(() => {
    const withPoly = [];
    const withoutPoly = [];
    for (const l of filteredLakes) {
      if (l.polygon && Array.isArray(l.polygon) && l.polygon.length >= 3) {
        withPoly.push(l);
      } else {
        withoutPoly.push(l);
      }
    }
    return { polygonLakes: withPoly, markerLakes: withoutPoly };
  }, [filteredLakes]);

  // Limit polygons for performance
  const visiblePolygons = useMemo(() => {
    if (zoom < POLYGON_ZOOM_THRESHOLD) return [];
    return polygonLakes.slice(0, MAX_POLYGONS);
  }, [polygonLakes, zoom]);

  // Visible markers: all marker-only lakes + polygon lakes when zoomed out
  const visibleMarkers = useMemo(() => {
    if (zoom >= POLYGON_ZOOM_THRESHOLD) {
      return markerLakes.slice(0, MAX_POLYGONS);
    }
    // When zoomed out, show all as markers (limited)
    return filteredLakes.slice(0, MAX_POLYGONS);
  }, [markerLakes, filteredLakes, zoom]);

  return (
    <>
      {/* Polygons — only when zoom >= 10 */}
      {visiblePolygons.map((lake, i) => {
        const isActive = activeRefSet.has(lake.code);
        const isActivated = (lake.activation_count || 0) > 0;
        const positions = lake.polygon.map(p => [p[0], p[1]]);
        const fillColor = isActive ? '#ef4444' : isActivated ? '#0ea5e9' : '#7dd3fc';
        const fillOpacity = isActive ? 0.5 : isActivated ? 0.4 : 0.2;

        return (
          <Polygon
            key={`llota-poly-${lake.code || i}`}
            positions={positions}
            pathOptions={{
              color: isActive ? '#ef4444' : '#0ea5e9',
              weight: isActive ? 3 : 2,
              fillColor,
              fillOpacity,
              opacity: 0.8,
            }}
          >
            <Popup>
              <LlotaPopup lake={lake} />
            </Popup>
          </Polygon>
        );
      })}

      {/* Circle markers for lakes without polygons, or when zoomed out */}
      {visibleMarkers.map((lake, i) => {
        const isActive = activeRefSet.has(lake.code);
        const isActivated = (lake.activation_count || 0) > 0;
        const fillColor = isActive ? '#ef4444' : isActivated ? '#0ea5e9' : '#7dd3fc';
        const radius = isActive ? 8 : isActivated ? 6 : 4;

        return (
          <CircleMarker
            key={`llota-marker-${lake.code || i}`}
            center={[lake.lat, lake.lng]}
            radius={radius}
            pathOptions={{
              color: isActive ? '#ef4444' : '#0ea5e9',
              weight: 2,
              fillColor,
              fillOpacity: isActivated ? 0.6 : 0.3,
            }}
          >
            <Popup>
              <LlotaPopup lake={lake} />
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function arePropsEqual(prev, next) {
  return prev.lakes === next.lakes &&
    prev.activeLlotaRefs === next.activeLlotaRefs &&
    prev.searchQuery === next.searchQuery &&
    prev.filterCountries === next.filterCountries &&
    prev.activationFilter === next.activationFilter;
}

const LlotaLayer = memo(LlotaLayerInner, arePropsEqual);
export default LlotaLayer;