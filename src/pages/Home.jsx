import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Popup, useMap, CircleMarker, Marker, WMSTileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import MapHeader from "@/components/map/MapHeader";
import LayerControl, { LAYER_GROUPS } from "@/components/map/LayerControl";
import MapLegend from "@/components/map/MapLegend";
import MarkerPopup from "@/components/map/MarkerPopup";
import SearchResults from "@/components/map/SearchResults";
import SplashScreen from "@/components/map/SplashScreen";
import LogEntryForm from "@/components/map/LogEntryForm";
import MapControls from "@/components/map/MapControls";
import PositionMarker from "@/components/map/PositionMarker";
import { LIGHTHOUSE_DATA } from "@/data/lighthouses";
import { CASTLE_DATA } from "@/data/castles";
import { Loader2, Radio, Plus, LocateFixed, MapPin, Move, Download, WifiOff, Wifi, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import BottomNavigation from "@/components/BottomNavigation";
import ReferenceEditDialog from "@/components/admin/ReferenceEditDialog";
import MapTileLayer from "@/components/map/MapTileLayer";
import OfflineAreaDialog from "@/components/map/OfflineAreaDialog";
import ChangeRequestDialog from "@/components/map/ChangeRequestDialog";
import { loadOfflineReferences, getOfflineAreas } from "@/lib/offlineMapStore";

// Swiss HBFF sample data (key references with coordinates from hbff.ch)
const HBFF_DATA = [
  { code: "HBFF-0001", name: "Aeulehaeg Nature Reserve, Balzers", lat: 47.0667, lng: 9.5167, canton: "", parkType: "Nature Res.", link: "https://hbff.ch/geo/HBFF-0001.htm" },
  { code: "HBFF-0008", name: "Neeracher Ried Bird Reserve", lat: 47.4833, lng: 8.4500, canton: "ZH", parkType: "Bird Reserve", link: "https://hbff.ch/geo/HBFF-0008.htm" },
  { code: "HBFF-0009", name: "Wasserschloss Brugg-Stilli Floodplains", lat: 47.4800, lng: 8.2300, canton: "AG", parkType: "Floodpl. Res.", link: "https://hbff.ch/geo/HBFF-0009.htm" },
  { code: "HBFF-0010", name: "Park of Jura Aargau", lat: 47.4200, lng: 7.9800, canton: "AG", parkType: "Natur park", link: "https://hbff.ch/geo/HBFF-0010.htm" },
  { code: "HBFF-0012", name: "Säntis Protected Natural Area", lat: 47.2494, lng: 9.3432, canton: "AI", parkType: "Pr.Nat.Area", link: "https://hbff.ch/geo/HBFF-0012.htm" },
  { code: "HBFF-0014", name: "Regional Naturpark Diemtigtal", lat: 46.6300, lng: 7.5000, canton: "BE", parkType: "Natur park", link: "https://hbff.ch/geo/HBFF-0014.htm" },
  { code: "HBFF-0016", name: "Park Chasseral", lat: 47.1317, lng: 7.0578, canton: "BE", parkType: "Natur park", link: "https://hbff.ch/geo/HBFF-0016.htm" },
  { code: "HBFF-0020", name: "Vanil Noir Nature Reserve", lat: 46.5100, lng: 7.1400, canton: "FR", parkType: "Nature Res.", link: "https://hbff.ch/geo/HBFF-0020.htm" },
  { code: "HBFF-0021", name: "Préalpes Fribourgeoises Nature Park", lat: 46.5500, lng: 7.1000, canton: "FR", parkType: "Natur park", link: "https://hbff.ch/geo/HBFF-0021.htm" },
  { code: "HBFF-0043", name: "Bös Fulen Nature Reserve", lat: 46.9800, lng: 8.8900, canton: "SZ", parkType: "Nature Res.", link: "https://hbff.ch/geo/HBFF-0043.htm" },
  { code: "HBFF-0168", name: "Gantrisch Nature Park", lat: 46.7300, lng: 7.4200, canton: "BE", parkType: "Natur park", link: "https://hbff.ch/geo/HBFF-0168.htm" },
  { code: "HBFF-0169", name: "Naturpark Gantrisch Kernzone", lat: 46.7200, lng: 7.4100, canton: "BE", parkType: "Pr.Nat.Area", link: "https://hbff.ch/geo/HBFF-0169.htm" },
  { code: "HBFF-0248", name: "BLN Chasseral", lat: 47.1300, lng: 7.0600, canton: "BE", parkType: "BLN", link: "https://hbff.ch/geo/HBFF-0248.htm" },
  { code: "HBFF-0270", name: "Tektonikarena Sardona", lat: 46.9200, lng: 9.2000, canton: "GL", parkType: "UNESCO", link: "https://hbff.ch/geo/HBFF-0270.htm" },
  { code: "HBFF-0330", name: "BLN Augstmatthorn-Hohgant", lat: 46.7700, lng: 7.8600, canton: "BE", parkType: "BLN", link: "https://hbff.ch/geo/HBFF-0330.htm" },
  { code: "HBFF-0331", name: "BLN Berner Hochalpen Aletsch-Bietschhorn", lat: 46.4900, lng: 7.9000, canton: "VS", parkType: "BLN", link: "https://hbff.ch/geo/HBFF-0331.htm" },
  { code: "HBFF-0387", name: "Alpstein Jagdbanngebiet", lat: 47.2700, lng: 9.3800, canton: "AI", parkType: "Jagdbanngebiet", link: "https://hbff.ch/geo/HBFF-0387.htm" },
  { code: "HBFF-0489", name: "Vanil Noir Federal Reserve", lat: 46.5200, lng: 7.1300, canton: "FR", parkType: "Fed. Reserve", link: "https://hbff.ch/geo/HBFF-0489.htm" },
];

// Swiss IOTA references
const IOTA_DATA = [
  { code: "EU-165", name: "Bodensee Inseln (Mainau, Reichenau)", lat: 47.6600, lng: 9.2000, link: "https://www.iota-world.org/islands-on-the-air/iota-groups-islands.html?filter_search=EU-165" },
];

// Swiss WWBOTA bunkers
const WWBOTA_DATA = [
  { code: "HB-0001", name: "Bunker Sargans Festung", lat: 47.0500, lng: 9.4400, link: "https://wwbota.net/hbbota/" },
  { code: "HB-0002", name: "Festung Heldsberg", lat: 47.4950, lng: 9.5950, link: "https://wwbota.net/hbbota/" },
  { code: "HB-0003", name: "Artilleriewerk Faulensee", lat: 46.6667, lng: 7.7167, link: "https://wwbota.net/hbbota/" },
  { code: "HB-0004", name: "Festung Crestawald", lat: 46.7750, lng: 9.4167, link: "https://wwbota.net/hbbota/" },
  { code: "HB-0005", name: "Euschels Festung", lat: 46.6300, lng: 7.2600, link: "https://wwbota.net/hbbota/" },
  { code: "HB-0006", name: "Festung Vitznau", lat: 47.0133, lng: 8.4808, link: "https://wwbota.net/hbbota/" },
  { code: "HB-0007", name: "Artilleriewerk Reuenthal", lat: 47.5700, lng: 8.1600, link: "https://wwbota.net/hbbota/" },
  { code: "HB-0008", name: "Festung Dailly", lat: 46.2583, lng: 7.0083, link: "https://wwbota.net/hbbota/" },
  { code: "HB-0009", name: "Festung Savatan", lat: 46.2667, lng: 7.0500, link: "https://wwbota.net/hbbota/" },
  { code: "HB-0010", name: "Artilleriewerk Magletsch", lat: 47.1167, lng: 9.4833, link: "https://wwbota.net/hbbota/" },
];

const LAYER_COLORS = {
  sota: "#e74c3c",
  pota: "#27ae60",
  hbff: "#8e44ad",
  wwbota: "#795548",
  castle: "#e67e22",
  iota: "#3498db",
  lighthouse: "#f39c12",
  swiss_protected: "#16a085"
};

function createDraggableIcon(color) {
  return L.divIcon({
    html: `<div style="width: 18px; height: 18px; border-radius: 50%; background: ${color}; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5); cursor: move;"></div>`,
    className: "draggable-marker-icon",
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function MapBounds({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 13, { duration: 1 });
  }, [center, zoom]);
  return null;
}

function MapEventHandler({ onMove, onZoom, onMapClick, clickMode }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMove([c.lat, c.lng]);
    },
    zoomend: () => {
      onZoom(map.getZoom());
    },
    click: (e) => {
      if (clickMode && onMapClick) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

function MapController({ lockedScale, mapRef }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    if (!lockedScale) return;
    const center = map.getCenter();
    const lat = center.lat;
    const metersPerPixel = lockedScale * 0.00028;
    const earthCircumference = 40075016.686;
    const requiredZoom = Math.log2((earthCircumference * Math.cos(lat * Math.PI / 180)) / (metersPerPixel * 256));
    const roundedZoom = Math.max(1, Math.min(22, Math.round(requiredZoom)));
    map.setZoom(roundedZoom, { animate: true });
  }, [map, lockedScale]);

  return null;
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeLayers, setActiveLayers] = useState(() => {
    try {
      const saved = localStorage.getItem("hb9om_map_active_layers");
      return saved ? JSON.parse(saved) : ["sota"];
    } catch { return ["sota"]; }
  });
  const [baseLayer, setBaseLayer] = useState(() => localStorage.getItem("hb9om_map_base_layer") || "osm");
  const [mapOpacity, setMapOpacity] = useState(() => {
    const saved = localStorage.getItem("hb9om_map_opacity");
    return saved ? parseFloat(saved) : 1;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [flyTo, setFlyTo] = useState(null);
  const [flyZoom, setFlyZoom] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState({});
  const [mapCenter, setMapCenter] = useState(() => {
    try {
      const saved = localStorage.getItem("hb9om_map_center");
      return saved ? JSON.parse(saved) : [46.8182, 8.2275];
    } catch { return [46.8182, 8.2275]; }
  });
  const [mapZoom, setMapZoom] = useState(() => {
    const saved = localStorage.getItem("hb9om_map_zoom");
    return saved ? parseInt(saved) : 8;
  });
  const [showQsoForm, setShowQsoForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [lockedScale, setLockedScale] = useState(() => {
    const saved = localStorage.getItem("hb9om_map_locked_scale");
    return saved ? parseInt(saved) : null;
  });
  const mapRef = useRef(null);

  // GPS / fixed position
  const [gpsPosition, setGpsPosition] = useState(null);
  const [fixedPosition, setFixedPosition] = useState(null);
  const [positionMode, setPositionMode] = useState("none"); // "gps" | "fixed" | "none"
  const [pickingPosition, setPickingPosition] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [positionRadius, setPositionRadius] = useState(() => {
    const saved = localStorage.getItem("hb9om_position_radius");
    return saved ? parseInt(saved) : 5000;
  });
  const [dragMode, setDragMode] = useState(false);
  const [localOverrides, setLocalOverrides] = useState({});
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [forceOffline, setForceOffline] = useState(() => localStorage.getItem("hb9om_force_offline") === "true");
  const isOffline = !isOnline || forceOffline;
  const [offlineAreas, setOfflineAreas] = useState([]);
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [serverOverrides, setServerOverrides] = useState({});
  const [pendingDragChange, setPendingDragChange] = useState(null);
  const { toast } = useToast();

  const handleMarkerDrag = async (marker, newLat, newLng) => {
    const code = marker.code || marker.reference;
    if (!code) return;

    // Non-admin: open change request dialog instead of saving directly
    if (!isAdmin) {
      setPendingDragChange({ marker, newPosition: [newLat, newLng] });
      return;
    }

    // Admin: save directly to ReferenceOverride
    try {
      const overrides = await base44.entities.ReferenceOverride.filter({
        reference_type: marker.layerType,
        original_code: code
      });
      if (overrides && overrides.length > 0) {
        await base44.entities.ReferenceOverride.update(overrides[0].id, {
          manual_lat: newLat, manual_lng: newLng, original_name: marker.name
        });
      } else {
        await base44.entities.ReferenceOverride.create({
          reference_type: marker.layerType, original_code: code,
          original_name: marker.name, manual_lat: newLat, manual_lng: newLng
        });
      }
      toast({ title: "Position gespeichert", description: `${marker.name} verschoben` });
      const ovKey = `${marker.layerType}:${code}`;
      setServerOverrides(prev => ({
        ...prev,
        [ovKey]: { ...(prev[ovKey] || {}), reference_type: marker.layerType, original_code: code, manual_lat: newLat, manual_lng: newLng }
      }));
    } catch (e) {
      toast({ title: "Speichern fehlgeschlagen", description: "Position lokal gespeichert, Server-Speicherung fehlgeschlagen: " + (e.message || "Unbekannter Fehler"), variant: "destructive" });
    }
  };

  // Persist map settings to localStorage
  useEffect(() => {
    localStorage.setItem("hb9om_map_active_layers", JSON.stringify(activeLayers));
  }, [activeLayers]);
  useEffect(() => {
    localStorage.setItem("hb9om_map_base_layer", baseLayer);
  }, [baseLayer]);
  useEffect(() => {
    localStorage.setItem("hb9om_map_opacity", String(mapOpacity));
  }, [mapOpacity]);
  useEffect(() => {
    localStorage.setItem("hb9om_map_center", JSON.stringify(mapCenter));
  }, [mapCenter]);
  useEffect(() => {
    localStorage.setItem("hb9om_map_zoom", String(mapZoom));
  }, [mapZoom]);
  useEffect(() => {
    if (lockedScale) {
      localStorage.setItem("hb9om_map_locked_scale", String(lockedScale));
    } else {
      localStorage.removeItem("hb9om_map_locked_scale");
    }
  }, [lockedScale]);

  useEffect(() => {
    localStorage.setItem("hb9om_position_radius", String(positionRadius));
  }, [positionRadius]);

  // API-loaded data
  const [sotaData, setSotaData] = useState([]);
  const [potaData, setPotaData] = useState([]);
  const [hbffData, setHbffData] = useState([]);
  const [wwbotaData, setWwbotaData] = useState([]);
  const [castleData, setCastleData] = useState([]);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  // Check admin status
  useEffect(() => {
    base44.functions.invoke("adminManageUsers", { action: "checkStatus" })
      .then(res => setIsAdmin(res.data?.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, []);

  // Load server-side reference overrides (adjusted names, manual coordinates)
  const loadServerOverrides = useCallback(async () => {
    try {
      const overrides = await base44.entities.ReferenceOverride.list();
      const map = {};
      (overrides || []).forEach(o => {
        const key = `${o.reference_type}:${o.original_code}`;
        map[key] = o;
      });
      setServerOverrides(map);
    } catch (e) { }
  }, []);

  useEffect(() => { loadServerOverrides(); }, [loadServerOverrides]);

  // Offline detection and area loading
  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => setIsOnline(true);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    getOfflineAreas().then(areas => setOfflineAreas(areas)).catch(() => {});
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Load all cached reference data on mount
  useEffect(() => {
    base44.entities.ReferenceData.list()
      .then(cached => {
        if (!cached) return;
        cached.forEach(entry => {
          if (!entry.references) return;
          if (entry.type === 'sota') setSotaData(entry.references);
          if (entry.type === 'pota') setPotaData(entry.references);
          if (entry.type === 'hbff') setHbffData(entry.references);
          if (entry.type === 'wwbota') setWwbotaData(entry.references);
          if (entry.type === 'castle') setCastleData(entry.references);
        });
      })
      .catch(() => {
        // Offline fallback: load cached references from downloaded areas
        loadOfflineReferences().then(refs => {
          if (refs.sota?.length) setSotaData(refs.sota);
          if (refs.pota?.length) setPotaData(refs.pota);
          if (refs.hbff?.length) setHbffData(refs.hbff);
          if (refs.wwbota?.length) setWwbotaData(refs.wwbota);
          if (refs.castle?.length) setCastleData(refs.castle);
        }).catch(() => {});
      })
      .finally(() => setCacheLoaded(true));
  }, []);

  // Load SOTA from API if not cached
  useEffect(() => {
    if (!cacheLoaded || !activeLayers.includes("sota") || sotaData.length > 0) return;
    setLoading(prev => ({ ...prev, sota: true }));
    base44.functions.invoke("fetchSOTA", { region: "HB" })
      .then(res => {
        if (res.data?.summits) setSotaData(res.data.summits);
      })
      .catch(() => {})
      .finally(() => setLoading(prev => ({ ...prev, sota: false })));
  }, [activeLayers, cacheLoaded]);

  // Load POTA from API if not cached
  useEffect(() => {
    if (!cacheLoaded || !activeLayers.includes("pota") || potaData.length > 0) return;
    setLoading(prev => ({ ...prev, pota: true }));
    base44.functions.invoke("fetchPOTA", {})
      .then(res => {
        if (res.data?.parks) setPotaData(res.data.parks);
      })
      .catch(() => {})
      .finally(() => setLoading(prev => ({ ...prev, pota: false })));
  }, [activeLayers, cacheLoaded]);

  // Load HBFF from API if not cached
  useEffect(() => {
    if (!cacheLoaded || !activeLayers.includes("hbff") || hbffData.length > 0) return;
    setLoading(prev => ({ ...prev, hbff: true }));
    base44.functions.invoke("fetchHBFF", { batchSize: 500, batchStart: 0 })
      .then(res => { if (res.data?.references) setHbffData(res.data.references); })
      .catch(() => {})
      .finally(() => setLoading(prev => ({ ...prev, hbff: false })));
  }, [activeLayers, cacheLoaded]);

  // Load WWBOTA from API if not cached
  useEffect(() => {
    if (!cacheLoaded || !activeLayers.includes("wwbota") || wwbotaData.length > 0) return;
    setLoading(prev => ({ ...prev, wwbota: true }));
    base44.functions.invoke("fetchWWBOTA", {})
      .then(res => { if (res.data?.bunkers) setWwbotaData(res.data.bunkers); })
      .catch(() => {})
      .finally(() => setLoading(prev => ({ ...prev, wwbota: false })));
  }, [activeLayers, cacheLoaded]);

  // Load Castles from API if not cached
  useEffect(() => {
    if (!cacheLoaded || !activeLayers.includes("castle") || castleData.length > 0) return;
    setLoading(prev => ({ ...prev, castle: true }));
    base44.functions.invoke("fetchCastles", {})
      .then(res => { if (res.data?.castles) setCastleData(res.data.castles); })
      .catch(() => {})
      .finally(() => setLoading(prev => ({ ...prev, castle: false })));
  }, [activeLayers, cacheLoaded]);

  const toggleLayer = useCallback((layerId) => {
    setActiveLayers(prev =>
      prev.includes(layerId) ? prev.filter(l => l !== layerId) : [...prev, layerId]
    );
  }, []);

  // Build all markers by layer
  const allMarkers = useMemo(() => {
    const markers = [];

    if (activeLayers.includes("sota") && sotaData.length > 0) {
      sotaData.forEach(s => {
        if (s.lat && s.lng) markers.push({ ...s, layerType: "sota", color: LAYER_COLORS.sota, layerLabel: "SOTA" });
      });
    }
    if (activeLayers.includes("pota") && potaData.length > 0) {
      potaData.forEach(p => {
        markers.push({ ...p, layerType: "pota", color: LAYER_COLORS.pota, layerLabel: "POTA" });
      });
    }
    if (activeLayers.includes("hbff")) {
      const hbff = hbffData.length > 0 ? hbffData : HBFF_DATA;
      hbff.forEach(h => markers.push({ ...h, layerType: "hbff", color: LAYER_COLORS.hbff, layerLabel: "HBFF" }));
    }
    if (activeLayers.includes("wwbota")) {
      const wwbota = wwbotaData.length > 0 ? wwbotaData : WWBOTA_DATA;
      wwbota.forEach(b => markers.push({ ...b, layerType: "wwbota", color: LAYER_COLORS.wwbota, layerLabel: "WWBOTA" }));
    }
    if (activeLayers.includes("castle")) {
      const castles = castleData.length > 0 ? castleData : CASTLE_DATA;
      castles.forEach(c => { if (c.lat && c.lng) markers.push({ ...c, layerType: "castle", color: LAYER_COLORS.castle, layerLabel: "Burg/Schloss" }); });
    }
    if (activeLayers.includes("iota")) {
      IOTA_DATA.forEach(i => markers.push({ ...i, layerType: "iota", color: LAYER_COLORS.iota, layerLabel: "IOTA" }));
    }
    if (activeLayers.includes("lighthouse")) {
      LIGHTHOUSE_DATA.forEach(l => markers.push({ ...l, layerType: "lighthouse", color: LAYER_COLORS.lighthouse, layerLabel: "Leuchtturm" }));
    }

    return markers.map(m => {
      const code = m.code || m.reference;
      const ovKey = `${m.layerType}:${code}`;
      const ov = serverOverrides[ovKey];
      return {
        ...m,
        name: ov?.adjusted_name || m.name,
        lat: ov?.manual_lat != null ? ov.manual_lat : (localOverrides[code]?.lat ?? m.lat),
        lng: ov?.manual_lng != null ? ov.manual_lng : (localOverrides[code]?.lng ?? m.lng),
      };
    });
  }, [activeLayers, sotaData, potaData, hbffData, wwbotaData, castleData, localOverrides, serverOverrides]);

  // Castle match statistics for legend
  const castleStats = useMemo(() => {
    if (castleData.length === 0) return null;
    const matched = castleData.filter(c => c.lat && c.lng).length;
    return { matched, total: castleData.length };
  }, [castleData]);

  // All available markers (regardless of active layers) — for QSO form nearby refs
  const allAvailableMarkers = useMemo(() => {
    const markers = [];
    if (sotaData.length > 0) {
      sotaData.forEach(s => {
        if (s.lat && s.lng) markers.push({ ...s, layerType: "sota", color: LAYER_COLORS.sota, layerLabel: "SOTA" });
      });
    }
    if (potaData.length > 0) {
      potaData.forEach(p => markers.push({ ...p, layerType: "pota", color: LAYER_COLORS.pota, layerLabel: "POTA" }));
    }
    const hbff = hbffData.length > 0 ? hbffData : HBFF_DATA;
    hbff.forEach(h => markers.push({ ...h, layerType: "hbff", color: LAYER_COLORS.hbff, layerLabel: "HBFF" }));
    const wwbota = wwbotaData.length > 0 ? wwbotaData : WWBOTA_DATA;
    wwbota.forEach(b => markers.push({ ...b, layerType: "wwbota", color: LAYER_COLORS.wwbota, layerLabel: "WWBOTA" }));
    const castles = castleData.length > 0 ? castleData : CASTLE_DATA;
    castles.forEach(c => { if (c.lat && c.lng) markers.push({ ...c, layerType: "castle", color: LAYER_COLORS.castle, layerLabel: "Burg/Schloss" }); });
    IOTA_DATA.forEach(i => markers.push({ ...i, layerType: "iota", color: LAYER_COLORS.iota, layerLabel: "IOTA" }));
    LIGHTHOUSE_DATA.forEach(l => markers.push({ ...l, layerType: "lighthouse", color: LAYER_COLORS.lighthouse, layerLabel: "Leuchtturm" }));
    return markers.map(m => {
      const code = m.code || m.reference;
      const ovKey = `${m.layerType}:${code}`;
      const ov = serverOverrides[ovKey];
      return {
        ...m,
        name: ov?.adjusted_name || m.name,
        lat: ov?.manual_lat != null ? ov.manual_lat : m.lat,
        lng: ov?.manual_lng != null ? ov.manual_lng : m.lng,
      };
    });
  }, [sotaData, potaData, hbffData, wwbotaData, castleData, serverOverrides]);

  // Search (debounced)
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const q = debouncedQuery.toLowerCase();
    const results = allMarkers.filter(m => {
      const name = (m.name || "").toLowerCase();
      const code = (m.code || m.reference || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    }).slice(0, 50);
    setSearchResults(results);
  }, [debouncedQuery, allMarkers]);

  const handleSelectResult = (item) => {
    setFlyTo([item.lat, item.lng]);
    setFlyZoom(14);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleChangeBaseLayer = useCallback((layer) => {
    setBaseLayer(layer);
    if (layer !== "swisstopo") {
      setLockedScale(null);
    }
  }, []);

  const handleChangeOpacity = useCallback((opacity) => {
    setMapOpacity(opacity);
  }, []);

  const handleSelectScale = useCallback((scaleId) => {
    if (scaleId === "auto") {
      setLockedScale(null);
      return;
    }
    const scale = parseInt(scaleId);
    setLockedScale(prev => prev === scale ? null : scale);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (mapRef.current) mapRef.current.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapRef.current) mapRef.current.zoomOut();
  }, []);

  const handleScaleUp = useCallback(() => {
    const scales = [10000, 25000, 50000, 100000];
    setLockedScale(prev => {
      const idx = scales.indexOf(prev);
      if (idx === -1) return 100000;
      if (idx === 0) return prev;
      return scales[idx - 1];
    });
  }, []);

  const handleScaleDown = useCallback(() => {
    const scales = [10000, 25000, 50000, 100000];
    setLockedScale(prev => {
      const idx = scales.indexOf(prev);
      if (idx === -1) return prev;
      if (idx === scales.length - 1) return null;
      return scales[idx + 1];
    });
  }, []);

  const calculateZoomForRadius = useCallback((lat, radius) => {
    const earthCircumference = 40075016.686;
    const size = mapRef.current ? mapRef.current.getSize() : { x: 400, y: 400 };
    const minDim = Math.min(size.x, size.y);
    const targetMetersPerPixel = (radius * 2 * 2.5) / minDim;
    const zoom = Math.log2((earthCircumference * Math.cos(lat * Math.PI / 180)) / (256 * targetMetersPerPixel));
    return Math.max(8, Math.min(17, Math.round(zoom)));
  }, []);

  const handleGpsLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setGpsPosition(newPos);
        setFixedPosition(null);
        setPositionMode("gps");
        setFlyTo(newPos);
        setFlyZoom(calculateZoomForRadius(newPos[0], positionRadius));
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        alert("GPS-Position konnte nicht ermittelt werden: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [calculateZoomForRadius, positionRadius]);

  const handleTogglePickPosition = useCallback(() => {
    setPickingPosition(prev => !prev);
  }, []);

  const handleMapClick = useCallback((latlng) => {
    if (!pickingPosition) return;
    setFixedPosition(latlng);
    setGpsPosition(null);
    setPositionMode("fixed");
    setPickingPosition(false);
    setFlyTo(latlng);
    setFlyZoom(calculateZoomForRadius(latlng[0], positionRadius));
  }, [pickingPosition, positionRadius, calculateZoomForRadius]);

  const handlePositionChange = useCallback((latlng) => {
    setFixedPosition(latlng);
    setGpsPosition(null);
    setPositionMode("fixed");
    setFlyTo(latlng);
    setFlyZoom(calculateZoomForRadius(latlng[0], positionRadius));
  }, [positionRadius, calculateZoomForRadius]);

  const currentPosition = positionMode === "fixed" ? fixedPosition : (positionMode === "gps" ? gpsPosition : null);
  const positionFixed = positionMode === "fixed";

  const isLoading = Object.values(loading).some(v => v);

  const SWISSTOPO_SCALE_LAYERS = {
    10000: { layer: "ch.swisstopo.landeskarte-farbe-10", format: "png" },
    25000: { layer: "ch.swisstopo.pixelkarte-farbe-pk25.noscale", format: "jpeg" },
    50000: { layer: "ch.swisstopo.pixelkarte-farbe-pk50.noscale", format: "jpeg" },
    100000: { layer: "ch.swisstopo.pixelkarte-farbe-pk100.noscale", format: "jpeg" },
  };

  const swisstopoConfig = (baseLayer === "swisstopo" && lockedScale && SWISSTOPO_SCALE_LAYERS[lockedScale])
    ? SWISSTOPO_SCALE_LAYERS[lockedScale]
    : { layer: "ch.swisstopo.pixelkarte-farbe", format: "jpeg" };

  const baseTileUrl = baseLayer === "swisstopo"
    ? `https://wmts.geo.admin.ch/1.0.0/${swisstopoConfig.layer}/default/current/3857/{z}/{x}/{y}.${swisstopoConfig.format}`
    : baseLayer === "satellite"
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const tileKeyPrefix = baseLayer === "swisstopo" ? `swisstopo_${swisstopoConfig.layer}` : baseLayer;

  const baseAttrib = baseLayer === "swisstopo"
    ? '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>'
    : baseLayer === "satellite"
    ? '&copy; <a href="https://www.esri.com">ESRI</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <div className="h-screen w-screen flex flex-col relative">
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}

      <MapHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      {searchResults.length > 0 && (
        <SearchResults
          results={searchResults}
          onSelect={handleSelectResult}
          onClose={() => setSearchResults([])}
        />
      )}

      {isOffline && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1001] bg-amber-900 text-white text-xs px-4 py-1.5 rounded-b-lg shadow-lg flex items-center gap-1.5">
          <WifiOff className="w-3 h-3" /> Offline-Modus – Karte aus Cache
        </div>
      )}

      {isLoading && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1001] bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
          <span className="text-sm text-gray-600">Daten werden geladen...</span>
        </div>
      )}

      <div className="flex-1 mt-[52px] relative">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          className="h-full w-full"
          zoomControl={false}
        >
          <MapTileLayer
            url={baseTileUrl}
            attribution={baseAttrib}
            maxZoom={baseLayer === "swisstopo" ? 22 : 19}
            opacity={mapOpacity}
            isOffline={isOffline}
            tileKeyPrefix={tileKeyPrefix}
            key={isOffline ? "offline" : swisstopoConfig.layer}
          />
          <MapEventHandler
            onMove={setMapCenter}
            onZoom={setMapZoom}
            onMapClick={handleMapClick}
            clickMode={pickingPosition}
          />
          <MapController lockedScale={lockedScale} mapRef={mapRef} />

          {currentPosition && (
            <PositionMarker position={currentPosition} fixed={positionFixed} radius={positionRadius} onRadiusChange={setPositionRadius} onPositionChange={handlePositionChange} />
          )}

          {/* Swiss Federal Inventories WMS overlay */}
          {activeLayers.includes("swiss_protected") && (
            <>
              <WMSTileLayer
                url="https://wms.geo.admin.ch/"
                layers="ch.bafu.bundesinventare-bln"
                format="image/png"
                transparent={true}
                opacity={0.5}
                attribution='&copy; BAFU'
              />
              <WMSTileLayer
                url="https://wms.geo.admin.ch/"
                layers="ch.bafu.bundesinventare-flachmoore"
                format="image/png"
                transparent={true}
                opacity={0.5}
              />
              <WMSTileLayer
                url="https://wms.geo.admin.ch/"
                layers="ch.bafu.bundesinventare-moorlandschaften"
                format="image/png"
                transparent={true}
                opacity={0.5}
              />
              <WMSTileLayer
                url="https://wms.geo.admin.ch/"
                layers="ch.bafu.bundesinventare-vogelreservate"
                format="image/png"
                transparent={true}
                opacity={0.5}
              />
            </>
          )}

          {allMarkers.map((m, idx) => {
            const key = `${m.layerType}-${m.code || m.reference || idx}`;
            if (dragMode && isAdmin) {
              return (
                <Marker
                  key={key}
                  position={[m.lat, m.lng]}
                  icon={createDraggableIcon(m.color)}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = e.target.getLatLng();
                      const code = m.code || m.reference;
                      if (isAdmin) {
                        if (code) {
                          setLocalOverrides(prev => ({ ...prev, [code]: { lat: ll.lat, lng: ll.lng } }));
                        }
                      }
                      handleMarkerDrag(m, ll.lat, ll.lng);
                    }
                  }}
                />
              );
            }
            return (
              <CircleMarker
                key={key}
                center={[m.lat, m.lng]}
                radius={7}
                pathOptions={{
                  color: m.color,
                  fillColor: m.color,
                  fillOpacity: 0.85,
                  weight: 2
                }}
                eventHandlers={{
                  click: (e) => {
                    const map = e.target._map;
                    if (map) {
                      map.flyTo([m.lat, m.lng], Math.max(map.getZoom(), 13), { duration: 0.5 });
                    }
                  }
                }}
              >
                <Popup>
                  <MarkerPopup data={m} layerType={m.layerType} isAdmin={isAdmin} onEdit={(data) => setEditTarget({ data, layerType: m.layerType })} />
                </Popup>
              </CircleMarker>
            );
          })}

          {flyTo && <MapBounds center={flyTo} zoom={flyZoom} />}
        </MapContainer>

        <LayerControl
          activeLayers={activeLayers}
          onToggleLayer={toggleLayer}
          baseLayer={baseLayer}
          onChangeBaseLayer={handleChangeBaseLayer}
          onSelectScale={handleSelectScale}
          lockedScale={lockedScale}
          mapOpacity={mapOpacity}
          onChangeOpacity={handleChangeOpacity}
        />

        <MapControls
          lockedScale={lockedScale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onScaleUp={handleScaleUp}
          onScaleDown={handleScaleDown}
          baseLayer={baseLayer}
        />

        {/* GPS / Position controls */}
        <div className="absolute left-3 top-20 z-[1000] flex flex-col gap-2">
          <button
            onClick={handleGpsLocate}
            disabled={gpsLoading}
            className={`w-10 h-10 bg-white rounded-lg shadow-lg border flex items-center justify-center transition-colors ${
              positionMode === "gps" ? "border-red-400 text-red-500" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            } ${gpsLoading ? "opacity-40" : ""}`}
            title="Meine GPS-Position anzeigen"
          >
            {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          </button>
          <button
            onClick={handleTogglePickPosition}
            className={`w-10 h-10 bg-white rounded-lg shadow-lg border flex items-center justify-center transition-colors ${
              pickingPosition ? "border-blue-400 text-blue-500 animate-pulse" :
              positionMode === "fixed" ? "border-blue-400 text-blue-500" :
              "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title={pickingPosition ? "Auf Karte tippen um Position zu setzen" : "Position auf Karte fixieren"}
          >
            <MapPin className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowOfflineDialog(true)}
            className={`w-10 h-10 bg-white rounded-lg shadow-lg border flex items-center justify-center transition-colors ${
              offlineAreas.length > 0 ? "border-blue-400 text-blue-500" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title="Offline-Karte herunterladen"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const newVal = !forceOffline;
              setForceOffline(newVal);
              localStorage.setItem("hb9om_force_offline", String(newVal));
              toast({ title: newVal ? "Offline-Modus aktiviert" : "Online-Modus aktiviert", duration: 2000 });
            }}
            className={`w-10 h-10 bg-white rounded-lg shadow-lg border flex items-center justify-center transition-colors ${
              forceOffline ? "border-amber-400 text-amber-500" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title={forceOffline ? "Offline-Modus deaktivieren" : "Offline-Modus aktivieren"}
          >
            {forceOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setDragMode(!dragMode)}
            className={`w-10 h-10 bg-white rounded-lg shadow-lg border flex items-center justify-center transition-colors ${
              dragMode ? "border-purple-400 text-purple-500 animate-pulse" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title={isAdmin ? "Punkte verschieben (Drag & Drop)" : "Punkte korrigieren (Antrag an Admin)"}
          >
            <Move className="w-4 h-4" />
          </button>
          <Link
            to="/change-requests"
            className="w-10 h-10 bg-white rounded-lg shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center transition-colors"
            title="Meine Änderungsanträge"
          >
            <ClipboardList className="w-4 h-4" />
          </Link>

        </div>

        {pickingPosition && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
            📍 Auf Karte tippen um Position zu setzen
          </div>
        )}

        {dragMode && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[1000] bg-purple-900 text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
            {isAdmin ? "✋ Marker festhalten und ziehen" : "✋ Marker ziehen – wird als Antrag gesendet"}
          </div>
        )}

        {/* New QSO floating button */}
        <button
          onClick={() => setShowQsoForm(true)}
          className="fixed bottom-20 right-3 z-[1000] bg-gray-900 text-white rounded-full shadow-2xl px-5 py-3 flex items-center gap-2 hover:bg-gray-800 transition-all hover:scale-105"
          title="Neues QSO erfassen"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Neues QSO</span>
        </button>

        <MapLegend activeLayers={activeLayers} markerCount={allMarkers.length} castleStats={castleStats} />
      </div>

      {editTarget && (
        <ReferenceEditDialog
          referenceType={editTarget.layerType}
          originalCode={editTarget.data.code || editTarget.data.reference || ""}
          originalName={editTarget.data.name || ""}
          originalLocation={editTarget.data.canton || editTarget.data.wcaLocation || editTarget.data.region || ""}
          onClose={() => setEditTarget(null)}
          onSaved={() => { loadServerOverrides(); setEditTarget(null); }}
        />
      )}

      {showQsoForm && (
        <LogEntryForm
          mapCenter={mapCenter}
          myPosition={currentPosition}
          allMarkers={allAvailableMarkers}
          activeLayers={activeLayers}
          onClose={() => setShowQsoForm(false)}
          onSaved={() => {}}
        />
      )}

      {showOfflineDialog && (
        <OfflineAreaDialog
          mapRef={mapRef}
          baseLayer={baseLayer}
          baseTileUrl={baseTileUrl}
          tileKeyPrefix={tileKeyPrefix}
          referenceData={{ sota: sotaData, pota: potaData, hbff: hbffData, wwbota: wwbotaData, castle: castleData }}
          onClose={() => setShowOfflineDialog(false)}
          onDownloaded={() => {
            getOfflineAreas().then(areas => setOfflineAreas(areas));
            setShowOfflineDialog(false);
          }}
        />
      )}

      {pendingDragChange && (
        <ChangeRequestDialog
          marker={pendingDragChange.marker}
          newPosition={pendingDragChange.newPosition}
          onClose={() => setPendingDragChange(null)}
          onSubmit={() => setPendingDragChange(null)}
        />
      )}

      <BottomNavigation />
    </div>
  );
}