import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapContainer, useMap, WMSTileLayer, useMapEvents } from "react-leaflet";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import MapHeader from "@/components/map/MapHeader";
import LayerControl, { LAYER_GROUPS } from "@/components/map/LayerControl";
import MapLegend from "@/components/map/MapLegend";
import SearchResults from "@/components/map/SearchResults";
import SplashScreen from "@/components/map/SplashScreen";
import LogEntryForm from "@/components/map/LogEntryForm";
import MapControls from "@/components/map/MapControls";
import MapMarkers from "@/components/map/MapMarkers";
import PositionMarker from "@/components/map/PositionMarker";
import WmsFeatureInfo from "@/components/map/WmsFeatureInfo";
import GpsTracker from "@/components/map/GpsTracker";
import RadioLoader from "@/components/map/RadioLoader";
import { LIGHTHOUSE_DATA } from "@/data/lighthouses";
import { CASTLE_DATA } from "@/data/castles";
import { IOTA_WORLDWIDE_DATA } from "@/data/iota-worldwide";
import { Loader2, Radio, Plus, LocateFixed, MapPin, Move, Download, WifiOff, Wifi, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import BottomNavigation from "@/components/BottomNavigation";
import ReferenceEditDialog from "@/components/admin/ReferenceEditDialog";
import MapTileLayer from "@/components/map/MapTileLayer";
import OfflineAreaDialog from "@/components/map/OfflineAreaDialog";
import ChangeRequestDialog from "@/components/map/ChangeRequestDialog";
import PerformanceSuggestionPopup from "@/components/map/PerformanceSuggestionPopup";
import RepeaterLayer from "@/components/map/RepeaterLayer";
import RepeaterFilter from "@/components/map/RepeaterFilter";
import AprsFilter from "@/components/map/AprsFilter";
import BrandMeisterFilter from "@/components/map/BrandMeisterFilter";
import PrivateNodeLayer from "@/components/map/PrivateNodeLayer";
import FoxHuntingSwitch from "@/components/FoxHuntingSwitch";
import RepeaterLinkSuggestDialog from "@/components/map/RepeaterLinkSuggestDialog";
import { FILTER_MODES as REPEATER_FILTER_MODES } from "@/lib/repeaterModes";
import { loadOfflineReferences, getOfflineAreas } from "@/lib/offlineMapStore";
import { cacheReferenceData, loadCachedReferenceData, loadCachedReferenceType, cacheOverrides, loadCachedOverrides, cacheQrzLookups, loadCachedPrivateNodes } from "@/lib/offlineDataCache";
import { isInContinents, CONTINENTS } from "@/lib/continents";
import { isInCountries, COUNTRIES, getCountriesByContinent } from "@/lib/countries";
import { getWwbotaColor } from "@/lib/wwbotaSchemes";
import VersionChangelogPopup, { hasSeenCurrentChangelog, isChangelogPermanentlyDismissed, resetChangelog } from "@/components/map/VersionChangelogPopup";
import PreloadHint from "@/components/map/PreloadHint";
import ViewportLimitHint from "@/components/map/ViewportLimitHint";
import { boundsToObj, boundsContained, unionBounds, mergeRefs, REF_TYPES } from "@/lib/boundsLoading";

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

// Worldwide IOTA island groups (curated subset of ~1200 IOTA groups from iota-world.org)
const IOTA_DATA = IOTA_WORLDWIDE_DATA;

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
  swiss_protected: "#16a085",
  hazards: "#dc2626"
};

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
      onMove([c.lat, c.lng], map.getBounds());
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

function MapController({ lockedScale, mapRef, onReady }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    if (onReady) onReady();
  }, [map, mapRef, onReady]);

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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return ["sota"];
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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [lockedScale, setLockedScale] = useState(() => {
    const saved = localStorage.getItem("hb9om_map_locked_scale");
    return saved ? parseInt(saved) : null;
  });
  const mapRef = useRef(null);
  const loadedBoundsRef = useRef({});
  // Worldwide fetch queue — heavy backend fetches (fetchSOTA, fetchPOTA, etc.) run with
  // limited concurrency (2 at a time) to parallelize independent type fetches without
  // overwhelming the backend or the main thread. Network I/O doesn't block the UI; the
  // previous 1-at-a-time queue added 35-70s of serial delay when activating multiple layers.
  const worldwideFetchQueue = useRef([]);
  const worldwideActive = useRef(0);
  const MAX_CONCURRENT_FETCHES = 2;
  const enqueueWorldwideFetch = useCallback(async (fetchFn) => {
    worldwideFetchQueue.current.push(fetchFn);
    // If under the concurrency limit, start a worker that drains the queue
    if (worldwideActive.current >= MAX_CONCURRENT_FETCHES) return;
    worldwideActive.current++;
    try {
      while (worldwideFetchQueue.current.length > 0) {
        const fn = worldwideFetchQueue.current.shift();
        try { await fn(); } catch (e) { /* silent */ }
      }
    } finally {
      worldwideActive.current--;
    }
  }, []);
  const [mapReady, setMapReady] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);

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
  const [performanceMode, setPerformanceMode] = useState(() => localStorage.getItem("hb9om_performance_mode") === "true");
  const [autoModeOverride, setAutoModeOverride] = useState(() => localStorage.getItem("hb9om_auto_mode_override") === "true");
  const [autoCanvasActive, setAutoCanvasActive] = useState(false);
  const isOffline = !isOnline || forceOffline;
  const [offlineAreas, setOfflineAreas] = useState([]);
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [serverOverrides, setServerOverrides] = useState({});
  const [pendingDragChange, setPendingDragChange] = useState(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [viewportLimitInfo, setViewportLimitInfo] = useState({ visibleCount: 0, maxRender: 2000, totalCount: 0, isCapped: false });
  const { toast } = useToast();

  const handleViewportLimitChange = useCallback((info) => {
    setViewportLimitInfo(info);
  }, []);

  const handleMarkerDrag = useCallback(async (marker, newLat, newLng) => {
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
  }, [isAdmin, toast]);

  // Bounds-based reference loading: only fetch references visible on the map
  const fetchRefsInBounds = useCallback(async (bnds, typesToFetch) => {
    if (!bnds || isOffline || typesToFetch.length === 0) return;
    try {
      const res = await base44.functions.invoke("getReferencesInBounds", { bounds: bnds, types: typesToFetch });
      if (res.data?.references) {
        const refs = res.data.references;
        // Only update in-memory state — do NOT overwrite the offline cache.
        // cacheReferenceType was called here previously, but it overwrote the full
        // offline download (e.g. 11k SOTA refs) with a smaller viewport subset (~3k),
        // destroying the user's saved offline data on every map pan.
        if (refs.sota) setSotaData(prev => mergeRefs(prev, refs.sota));
        if (refs.pota) setPotaData(prev => mergeRefs(prev, refs.pota));
        if (refs.hbff) setHbffData(prev => mergeRefs(prev, refs.hbff));
        if (refs.wwbota) setWwbotaData(prev => mergeRefs(prev, refs.wwbota));
        if (refs.castle) setCastleData(prev => mergeRefs(prev, refs.castle));
        if (refs.iota) setIotaData(prev => mergeRefs(prev, refs.iota));
        if (refs.lighthouse) setLighthouseData(prev => mergeRefs(prev, refs.lighthouse));
        typesToFetch.forEach(t => {
          loadedBoundsRef.current[t] = unionBounds(loadedBoundsRef.current[t], bnds);
        });
      }
    } catch (e) { /* silent — local cache or fallback data still shows */ }
  }, [isOffline]);

  const handleMapMove = useCallback((center, bnds) => {
    setMapCenter(center);
    if (bnds) setMapBounds(boundsToObj(bnds));
  }, []);

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
  const sotaWorldwideFetched = useRef(false);
  const potaWorldwideFetched = useRef(false);
  const [hbffData, setHbffData] = useState([]);
  const [wwbotaData, setWwbotaData] = useState([]);
  const [castleData, setCastleData] = useState([]);
  const [iotaData, setIotaData] = useState([]);
  const [lighthouseData, setLighthouseData] = useState([]);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [serverCacheLoaded, setServerCacheLoaded] = useState(false);
  const [serverCacheLoading, setServerCacheLoading] = useState(true);
  const [loadingCancelled, setLoadingCancelled] = useState(false);
  const [repeaters, setRepeaters] = useState([]);
  const [repeaterFilterModes, setRepeaterFilterModes] = useState(() => {
    try {
      const saved = localStorage.getItem("hb9om_repeater_filter_modes");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [...REPEATER_FILTER_MODES];
  });
  const [repeaterSearchQuery, setRepeaterSearchQuery] = useState("");
  const [repeaterShowLinks, setRepeaterShowLinks] = useState(() => localStorage.getItem("hb9om_repeater_show_links") !== "false");
  const [repeaterShowCoverage, setRepeaterShowCoverage] = useState(() => localStorage.getItem("hb9om_repeater_show_coverage") === "true");
  const [repeaterShowOnlyLinked, setRepeaterShowOnlyLinked] = useState(() => localStorage.getItem("hb9om_repeater_show_only_linked") === "true");
  const [repeaterFilterCountry, setRepeaterFilterCountry] = useState("all");
  const [repeaterRadiusKm, setRepeaterRadiusKm] = useState(() => {
    const saved = localStorage.getItem("hb9om_repeater_radius_km");
    return saved ? parseInt(saved) : 0;
  });
  const [aprsFilterTypes, setAprsFilterTypes] = useState(() => {
    try {
      const saved = localStorage.getItem("hb9om_aprs_filter_types");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [aprsSearchQuery, setAprsSearchQuery] = useState("");
  const [bmFilterTypes, setBmFilterTypes] = useState(() => {
    try {
      const saved = localStorage.getItem("hb9om_bm_filter_types");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [bmSearchQuery, setBmSearchQuery] = useState("");
  const [adminLinks, setAdminLinks] = useState([]);
  const [privateNodes, setPrivateNodes] = useState([]);
  const [linkSuggestTarget, setLinkSuggestTarget] = useState(null);
  const [foxHuntingMode, setFoxHuntingMode] = useState(() => localStorage.getItem("hb9om_fox_hunting_mode") || "fox");
  const [activeContinents, setActiveContinents] = useState(() => {
    try {
      const saved = localStorage.getItem("hb9om_active_continents");
      if (saved) return JSON.parse(saved);
    } catch {}
    return []; // empty = all world
  });
  const [activeCountries, setActiveCountries] = useState(() => {
    try {
      const saved = localStorage.getItem("hb9om_active_countries");
      if (saved) return JSON.parse(saved);
    } catch {}
    return []; // empty = all countries
  });
  const [showChangelog, setShowChangelog] = useState(false);
  const [individualCoverage, setIndividualCoverage] = useState(() => new Set(
    (() => { try { return JSON.parse(localStorage.getItem("hb9om_individual_coverage") || "[]"); } catch { return []; } })()
  ));

  useEffect(() => {
    localStorage.setItem("hb9om_repeater_filter_modes", JSON.stringify(repeaterFilterModes));
  }, [repeaterFilterModes]);
  useEffect(() => {
    localStorage.setItem("hb9om_repeater_show_links", String(repeaterShowLinks));
  }, [repeaterShowLinks]);
  useEffect(() => {
    localStorage.setItem("hb9om_repeater_show_coverage", String(repeaterShowCoverage));
  }, [repeaterShowCoverage]);
  useEffect(() => {
    localStorage.setItem("hb9om_repeater_show_only_linked", String(repeaterShowOnlyLinked));
  }, [repeaterShowOnlyLinked]);
  useEffect(() => {
    localStorage.setItem("hb9om_repeater_radius_km", String(repeaterRadiusKm));
  }, [repeaterRadiusKm]);
  useEffect(() => {
    localStorage.setItem("hb9om_aprs_filter_types", JSON.stringify(aprsFilterTypes || []));
  }, [aprsFilterTypes]);
  useEffect(() => {
    localStorage.setItem("hb9om_bm_filter_types", JSON.stringify(bmFilterTypes || []));
  }, [bmFilterTypes]);
  useEffect(() => {
    localStorage.setItem("hb9om_fox_hunting_mode", foxHuntingMode);
  }, [foxHuntingMode]);
  useEffect(() => {
    localStorage.setItem("hb9om_active_continents", JSON.stringify(activeContinents));
  }, [activeContinents]);
  useEffect(() => {
    localStorage.setItem("hb9om_active_countries", JSON.stringify(activeCountries));
  }, [activeCountries]);

  // Show version changelog popup after splash screen
  useEffect(() => {
    if (!showSplash && !hasSeenCurrentChangelog() && !isChangelogPermanentlyDismissed()) {
      setShowChangelog(true);
    }
  }, [showSplash]);

  const handleToggleCountry = useCallback((iso2) => {
    setActiveCountries(prev => {
      if (prev.includes(iso2)) return prev.filter(c => c !== iso2);
      return [...prev, iso2];
    });
  }, []);
  useEffect(() => {
    localStorage.setItem("hb9om_individual_coverage", JSON.stringify([...individualCoverage]));
  }, [individualCoverage]);

  const handleToggleContinent = useCallback((continentId) => {
    setActiveContinents(prev => {
      if (continentId === "__all") return [];
      if (prev.includes(continentId)) return prev.filter(c => c !== continentId);
      return [...prev, continentId];
    });
  }, []);

  const handleToggleRepeaterCoverage = useCallback((repeater) => {
    setIndividualCoverage(prev => {
      const next = new Set(prev);
      if (next.has(repeater.id)) next.delete(repeater.id);
      else next.add(repeater.id);
      return next;
    });
  }, []);

  // Check admin status
  useEffect(() => {
    base44.functions.invoke("adminManageUsers", { action: "checkStatus" })
      .then(res => setIsAdmin(res.data?.isAdmin === true))
      .catch(() => setIsAdmin(false));
    base44.auth.me()
      .then(user => { if (user) setCurrentUserId(user.id); })
      .catch(() => {});
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

  useEffect(() => {
    if (isOffline) {
      setServerOverrides(loadCachedOverrides());
    } else {
      loadServerOverrides();
    }
  }, [loadServerOverrides, isOffline]);

  // Load pending change request count for badge + subscribe to updates
  useEffect(() => {
    if (isOffline) return; // Skip server polling when offline
    const loadPendingCount = async () => {
      try {
        if (isAdmin) {
          // Admin: fetch ALL pending requests via backend function (bypasses RLS)
          const res = await base44.functions.invoke("manageChangeRequests", { action: "listAll" });
          const pending = (res.data?.requests || []).filter(r => r.status === "pending").length;
          setPendingRequestCount(pending);
        } else {
          // Regular user: only own requests (RLS-scoped)
          const requests = await base44.entities.ReferenceChangeRequest.list("-created_date", 100);
          const pending = (requests || []).filter(r => r.status === "pending").length;
          setPendingRequestCount(pending);
        }
      } catch (e) { }
    };
    loadPendingCount();
    const unsubscribe = base44.entities.ReferenceChangeRequest.subscribe(() => {
      loadPendingCount();
    });
    // Polling fallback for admins (RLS may block realtime for other users' requests)
    const pollInterval = isAdmin ? setInterval(loadPendingCount, 30000) : null;
    return () => {
      if (unsubscribe) unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isAdmin, currentUserId, isOffline]);

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

  // Load reference data on mount — only parse cache for ACTIVE layer types to avoid
  // blocking on startup when only 1-2 layers are active but 100k+ refs are cached.
  useEffect(() => {
    setServerOverrides(loadCachedOverrides());
    setCacheLoaded(true);

    // Load ONLY active layer types from per-type cache keys (fast, lazy parsing)
    const typesToLoad = activeLayers.filter(l => ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'iota', 'lighthouse'].includes(l));
    let hasLocalData = false;
    for (const type of typesToLoad) {
      const refs = loadCachedReferenceType(type);
      if (refs && refs.length > 0) {
        hasLocalData = true;
        if (type === 'sota') setSotaData(refs);
        else if (type === 'pota') setPotaData(refs);
        else if (type === 'hbff') setHbffData(refs);
        else if (type === 'wwbota') setWwbotaData(refs);
        else if (type === 'castle') setCastleData(refs);
        else if (type === 'iota') setIotaData(refs);
        else if (type === 'lighthouse') setLighthouseData(refs);
      }
    }

    if (isOffline) {
      // Offline: load ALL cached types (not just active) for QSO form availability
      const localCache = loadCachedReferenceData();
      if (localCache) {
        if (localCache.sota) setSotaData(localCache.sota);
        if (localCache.pota) setPotaData(localCache.pota);
        if (localCache.hbff) setHbffData(localCache.hbff);
        if (localCache.wwbota) setWwbotaData(localCache.wwbota);
        if (localCache.castle) setCastleData(localCache.castle);
        if (localCache.iota) setIotaData(localCache.iota);
        if (localCache.lighthouse) setLighthouseData(localCache.lighthouse);
      }
      // Load cached private nodes (APRS + BrandMeister) for offline use
      const cachedNodes = loadCachedPrivateNodes();
      if (cachedNodes && cachedNodes.length > 0) setPrivateNodes(cachedNodes);
      setServerCacheLoaded(true);
      setServerCacheLoading(false);
      return;
    }
    // Online mode with local cache: mark as loaded immediately so splash dismisses fast.
    if (hasLocalData) {
      setServerCacheLoaded(true);
      setServerCacheLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  // Lazy-load cached data when a new layer is activated (not loaded on mount).
  // Avoids a server fetch when the data is already in the per-type local cache.
  const loadedCacheTypes = useRef(new Set());
  useEffect(() => {
    if (!cacheLoaded) return;
    const refTypes = ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'iota', 'lighthouse'];
    for (const type of refTypes) {
      if (!activeLayers.includes(type) && !showQsoForm) continue;
      if (loadedCacheTypes.current.has(type)) continue;
      loadedCacheTypes.current.add(type);
      const refs = loadCachedReferenceType(type);
      if (refs && refs.length > 0) {
        if (type === 'sota' && sotaData.length === 0) setSotaData(refs);
        else if (type === 'pota' && potaData.length === 0) setPotaData(refs);
        else if (type === 'hbff' && hbffData.length === 0) setHbffData(refs);
        else if (type === 'wwbota' && wwbotaData.length === 0) setWwbotaData(refs);
        else if (type === 'castle' && castleData.length === 0) setCastleData(refs);
        else if (type === 'iota' && iotaData.length === 0) setIotaData(refs);
        else if (type === 'lighthouse' && lighthouseData.length === 0) setLighthouseData(refs);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers, cacheLoaded, showQsoForm]);

  // Bounds-based fetch: load only references within the current map viewport.
  // Fires on map ready, pan/zoom (debounced 500ms), and layer toggle. Accumulates loaded data.
  useEffect(() => {
    if (!mapReady || isOffline || !cacheLoaded) return;

    const bnds = mapBounds || (mapRef.current ? boundsToObj(mapRef.current.getBounds()) : null);
    if (!bnds) return;

    const typesToFetch = (showQsoForm ? REF_TYPES : activeLayers.filter(l => REF_TYPES.includes(l)))
      .filter(l => !boundsContained(bnds, loadedBoundsRef.current[l]));

    if (typesToFetch.length === 0) {
      if (!serverCacheLoaded) { setServerCacheLoaded(true); setServerCacheLoading(false); }
      return;
    }

    const t = setTimeout(() => {
      setServerCacheLoading(true);
      fetchRefsInBounds(bnds, typesToFetch)
        .catch(() => {})
        .finally(() => { setServerCacheLoaded(true); setServerCacheLoading(false); });
    }, 300);
    return () => clearTimeout(t);
  }, [mapReady, mapBounds, activeLayers, isOffline, cacheLoaded, serverCacheLoaded, fetchRefsInBounds, showQsoForm]);

  // Load ALL reference types immediately when QSO form opens (no debounce — silent background load)
  useEffect(() => {
    if (!showQsoForm || isOffline || !serverCacheLoaded || !mapReady) return;
    // Priority 1: 50km around user position (or map center if no position)
    const posCenter = positionMode === "fixed" ? fixedPosition : (positionMode === "gps" ? gpsPosition : null);
    const center = posCenter || mapCenter;
    if (center) {
      const [lat, lng] = center;
      const latDelta = 50 / 111; // ~50km in degrees latitude
      const lngDelta = 50 / (111 * Math.cos(lat * Math.PI / 180));
      const priorityBounds = {
        north: lat + latDelta, south: lat - latDelta,
        east: lng + lngDelta, west: lng - lngDelta
      };
      const priorityTypes = REF_TYPES.filter(t => !boundsContained(priorityBounds, loadedBoundsRef.current[t]));
      if (priorityTypes.length > 0) {
        fetchRefsInBounds(priorityBounds, priorityTypes);
      }
    }
    // Priority 2: wider map viewport (fills in more data for autocomplete)
    const bnds = mapBounds || (mapRef.current ? boundsToObj(mapRef.current.getBounds()) : null);
    if (bnds) {
      const typesToFetch = REF_TYPES.filter(t => !boundsContained(bnds, loadedBoundsRef.current[t]));
      if (typesToFetch.length > 0) {
        fetchRefsInBounds(bnds, typesToFetch);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQsoForm, serverCacheLoaded, isOffline, mapReady, mapBounds, fetchRefsInBounds, mapCenter, positionMode, fixedPosition, gpsPosition]);

  // Dismiss splash after minimum 3s AND server cache loaded — uses the time to fetch data in background
  const mountTime = useRef(Date.now());
  useEffect(() => {
    if (!showSplash) return;
    const MIN_SPLASH_MS = 1500;
    const MAX_SPLASH_MS = 4000;
    const elapsed = Date.now() - mountTime.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    // Server cache already loaded (or offline): dismiss after remaining min time
    if (serverCacheLoaded || isOffline) {
      const t = setTimeout(() => setShowSplash(false), remaining);
      return () => clearTimeout(t);
    }
    // Still loading: dismiss when 3s elapsed AND serverCacheLoaded, max 6s fallback
    const interval = setInterval(() => {
      const el = Date.now() - mountTime.current;
      if ((serverCacheLoaded && el >= MIN_SPLASH_MS) || el >= MAX_SPLASH_MS) {
        setShowSplash(false);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [showSplash, serverCacheLoaded, isOffline]);

  // Load SOTA from API — worldwide fetch if cached data is Swiss-only
  useEffect(() => {
    if (!serverCacheLoaded || (!activeLayers.includes("sota") && !showQsoForm) || isOffline) return;
    if (sotaWorldwideFetched.current) return;
    // Check if cached data is already worldwide (has summits outside Switzerland bbox)
    const isWorldwide = sotaData.length > 0 && sotaData.some(s => s.lat < 45 || s.lat > 48 || s.lng < 5 || s.lng > 11);
    if (isWorldwide) { sotaWorldwideFetched.current = true; return; }
    sotaWorldwideFetched.current = true;
    setLoading(prev => ({ ...prev, sota: true }));
    enqueueWorldwideFetch(async () => {
      try {
        const res = await base44.functions.invoke("fetchSOTA", { associations: "all" });
        if (res.data?.saved) {
          loadedBoundsRef.current.sota = null;
          const bnds = mapRef.current ? boundsToObj(mapRef.current.getBounds()) : null;
          if (bnds) fetchRefsInBounds(bnds, ['sota']);
        }
      } catch (e) { /* silent */ }
      finally { setLoading(prev => ({ ...prev, sota: false })); }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, sotaData, showQsoForm, enqueueWorldwideFetch, fetchRefsInBounds]);

  // Load POTA from API — worldwide fetch if cached data is Swiss-only
  useEffect(() => {
    if (!serverCacheLoaded || (!activeLayers.includes("pota") && !showQsoForm) || isOffline) return;
    if (potaWorldwideFetched.current) return;
    // Check if cached data is already worldwide (has parks outside Switzerland bbox)
    const isWorldwide = potaData.length > 0 && potaData.some(p => p.lat < 45 || p.lat > 48 || p.lng < 5 || p.lng > 11);
    if (isWorldwide) { potaWorldwideFetched.current = true; return; }
    potaWorldwideFetched.current = true;
    setLoading(prev => ({ ...prev, pota: true }));
    enqueueWorldwideFetch(async () => {
      try {
        const res = await base44.functions.invoke("fetchPOTA", { entities: "all" });
        if (res.data?.saved) {
          loadedBoundsRef.current.pota = null;
          const bnds = mapRef.current ? boundsToObj(mapRef.current.getBounds()) : null;
          if (bnds) fetchRefsInBounds(bnds, ['pota']);
        }
      } catch (e) { /* silent */ }
      finally { setLoading(prev => ({ ...prev, pota: false })); }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, potaData, showQsoForm, enqueueWorldwideFetch, fetchRefsInBounds]);

  // Load HBFF from API if not cached
  useEffect(() => {
    if (!serverCacheLoaded || (!activeLayers.includes("hbff") && !showQsoForm) || hbffData.length > 0 || isOffline) return;
    setLoading(prev => ({ ...prev, hbff: true }));
    enqueueWorldwideFetch(async () => {
      try {
        const res = await base44.functions.invoke("fetchHBFF", { batchSize: 500, batchStart: 0 });
        if (res.data?.references?.length > 0) setHbffData(res.data.references);
      } catch (e) { /* silent */ }
      finally { setLoading(prev => ({ ...prev, hbff: false })); }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, showQsoForm, enqueueWorldwideFetch]);

  // Load WWBOTA from API if not cached
  useEffect(() => {
    if (!serverCacheLoaded || (!activeLayers.includes("wwbota") && !showQsoForm) || wwbotaData.length > 0 || isOffline) return;
    setLoading(prev => ({ ...prev, wwbota: true }));
    enqueueWorldwideFetch(async () => {
      try {
        const res = await base44.functions.invoke("fetchWWBOTA", {});
        if (res.data?.bunkers?.length > 0) setWwbotaData(res.data.bunkers);
      } catch (e) { /* silent */ }
      finally { setLoading(prev => ({ ...prev, wwbota: false })); }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, showQsoForm, enqueueWorldwideFetch]);

  // Load Castles from API if not cached
  useEffect(() => {
    if (!serverCacheLoaded || (!activeLayers.includes("castle") && !showQsoForm) || castleData.length > 0 || isOffline) return;
    setLoading(prev => ({ ...prev, castle: true }));
    enqueueWorldwideFetch(async () => {
      try {
        const res = await base44.functions.invoke("fetchCastles", {});
        if (res.data?.saved) {
          loadedBoundsRef.current.castle = null;
          const bnds = mapRef.current ? boundsToObj(mapRef.current.getBounds()) : null;
          if (bnds) fetchRefsInBounds(bnds, ['castle']);
        }
      } catch (e) { /* silent */ }
      finally { setLoading(prev => ({ ...prev, castle: false })); }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, showQsoForm, enqueueWorldwideFetch, fetchRefsInBounds]);

  // Load IOTA from API if not cached
  useEffect(() => {
    if (!serverCacheLoaded || (!activeLayers.includes("iota") && !showQsoForm) || iotaData.length > 0 || isOffline) return;
    setLoading(prev => ({ ...prev, iota: true }));
    enqueueWorldwideFetch(async () => {
      try {
        const res = await base44.functions.invoke("fetchIOTA", {});
        if (res.data?.saved) {
          loadedBoundsRef.current.iota = null;
          const bnds = mapRef.current ? boundsToObj(mapRef.current.getBounds()) : null;
          if (bnds) fetchRefsInBounds(bnds, ['iota']);
        }
      } catch (e) { /* silent */ }
      finally { setLoading(prev => ({ ...prev, iota: false })); }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, showQsoForm, enqueueWorldwideFetch, fetchRefsInBounds]);

  // Load Lighthouses from API if not cached
  useEffect(() => {
    if (!serverCacheLoaded || (!activeLayers.includes("lighthouse") && !showQsoForm) || lighthouseData.length > 0 || isOffline) return;
    setLoading(prev => ({ ...prev, lighthouse: true }));
    enqueueWorldwideFetch(async () => {
      try {
        const res = await base44.functions.invoke("fetchLighthouses", {});
        if (res.data?.saved) {
          loadedBoundsRef.current.lighthouse = null;
          const bnds = mapRef.current ? boundsToObj(mapRef.current.getBounds()) : null;
          if (bnds) fetchRefsInBounds(bnds, ['lighthouse']);
        }
      } catch (e) { /* silent */ }
      finally { setLoading(prev => ({ ...prev, lighthouse: false })); }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, showQsoForm, enqueueWorldwideFetch, fetchRefsInBounds]);

  // Load repeaters from DB when repeater layer is active (queued — 10k records is a heavy query)
  useEffect(() => {
    if (!serverCacheLoaded || (!activeLayers.includes("repeater") && !showQsoForm) || repeaters.length > 0 || isOffline) return;
    enqueueWorldwideFetch(async () => {
      try {
        const data = await base44.entities.Repeater.list("-created_date", 10000);
        if (data && data.length > 0) setRepeaters(data);
      } catch (e) { /* silent */ }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, showQsoForm, enqueueWorldwideFetch]);

  // Load approved admin-managed repeater links when repeater layer is active (queued)
  useEffect(() => {
    if (!serverCacheLoaded || !activeLayers.includes("repeater") || isOffline) return;
    enqueueWorldwideFetch(async () => {
      try {
        const data = await base44.entities.RepeaterLink.list("-created_date", 500);
        if (data) setAdminLinks(data);
      } catch (e) { /* silent */ }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, enqueueWorldwideFetch]);

  // Load private nodes from DB when APRS or BrandMeister layer is active (queued — heavy query)
  useEffect(() => {
    if (!serverCacheLoaded || (!activeLayers.includes("aprs") && !activeLayers.includes("brandmeister")) || privateNodes.length > 0 || isOffline) return;
    enqueueWorldwideFetch(async () => {
      try {
        const data = await base44.entities.PrivateNode.list("-created_date", 10000);
        if (data && data.length > 0) setPrivateNodes(data);
      } catch (e) { /* silent */ }
    });
  }, [activeLayers, serverCacheLoaded, isOffline, enqueueWorldwideFetch]);

  const handleEdit = useCallback((data, layerType) => {
    setEditTarget({ data, layerType });
  }, []);

  const toggleLayer = useCallback((layerId) => {
    setActiveLayers(prev => {
      const next = prev.includes(layerId) ? prev.filter(l => l !== layerId) : [...prev, layerId];
      // Write synchronously — don't rely on the effect alone (prevents loss on fast unmount/refresh)
      try { localStorage.setItem("hb9om_map_active_layers", JSON.stringify(next)); } catch {}
      return next;
    });
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
      wwbota.forEach(b => markers.push({
        ...b,
        layerType: "wwbota",
        color: getWwbotaColor(b.scheme),
        layerLabel: "WWBOTA"
      }));
    }
    if (activeLayers.includes("castle")) {
      const castles = castleData.length > 0 ? castleData : CASTLE_DATA;
      castles.forEach(c => { if (c.lat && c.lng) markers.push({ ...c, layerType: "castle", color: LAYER_COLORS.castle, layerLabel: "Burg/Schloss" }); });
    }
    if (activeLayers.includes("iota")) {
      const iota = iotaData.length > 0 ? iotaData : IOTA_DATA;
      iota.forEach(i => markers.push({ ...i, layerType: "iota", color: LAYER_COLORS.iota, layerLabel: "IOTA" }));
    }
    if (activeLayers.includes("lighthouse")) {
      const lighthouses = lighthouseData.length > 0 ? lighthouseData : LIGHTHOUSE_DATA;
      lighthouses.forEach(l => markers.push({ ...l, layerType: "lighthouse", color: LAYER_COLORS.lighthouse, layerLabel: "Leuchtturm" }));
    }

    // Skip override copy when no overrides exist (common case — avoids 50k object copies)
    const hasOverrides = Object.keys(serverOverrides).length > 0 || Object.keys(localOverrides).length > 0;
    return markers
      .filter(m => isInContinents(m.lat, m.lng, activeContinents))
      .filter(m => isInCountries(m, activeCountries))
      .map(m => {
        if (!hasOverrides) return m;
        const code = m.code || m.reference;
        const ovKey = `${m.layerType}:${code}`;
        const ov = serverOverrides[ovKey];
        const localOv = localOverrides[code];
        if (!ov && !localOv) return m;
        return {
          ...m,
          name: ov?.adjusted_name || m.name,
          lat: ov?.manual_lat != null ? ov.manual_lat : (localOv?.lat ?? m.lat),
          lng: ov?.manual_lng != null ? ov.manual_lng : (localOv?.lng ?? m.lng),
        };
      });
  }, [activeLayers, sotaData, potaData, hbffData, wwbotaData, castleData, localOverrides, serverOverrides, activeContinents, activeCountries]);

  // Castle match statistics for legend
  const castleStats = useMemo(() => {
    if (castleData.length === 0) return null;
    const matched = castleData.filter(c => c.lat && c.lng).length;
    return { matched, total: castleData.length };
  }, [castleData]);

  // Filtered repeater count for filter panel
  const filteredRepeaterCount = useMemo(() => {
    let result = repeaters;
    if (repeaterFilterCountry !== "all") {
      if (repeaterFilterCountry.startsWith("continent:")) {
        const contId = repeaterFilterCountry.split(":")[1];
        const contCountries = getCountriesByContinent(contId).map(c => c.iso2);
        result = result.filter(r => contCountries.includes(r.country_code));
      } else {
        result = result.filter(r => r.country_code === repeaterFilterCountry);
      }
    }
    // No modes selected = NO repeaters shown (user must actively choose at least one mode)
    if (repeaterFilterModes.length === 0) {
      return 0;
    }
    result = result.filter(r => repeaterFilterModes.some(m => {
      if (["EchoLink", "AllStar", "IRLP", "WIRES-X"].includes(m)) {
        return (r.modes || []).includes(m);
      }
      return r.primary_mode === m;
    }));
    if (repeaterSearchQuery.length >= 2) {
      const q = repeaterSearchQuery.toLowerCase();
      result = result.filter(r =>
        (r.callsign || "").toLowerCase().includes(q) ||
        (r.location_name || "").toLowerCase().includes(q) ||
        (r.country || "").toLowerCase().includes(q) ||
        String(r.frequency || "").includes(q)
      );
    }
    return result.length;
  }, [repeaters, repeaterFilterModes, repeaterSearchQuery, repeaterFilterCountry]);

  // Split private nodes by source — APRS (aprs.fi) vs BrandMeister (DMR network)
  // These are fundamentally different systems: APRS is a positioning system,
  // BrandMeister is a DMR voice/data network with talkgroups.
  const aprsNodes = useMemo(() =>
    privateNodes.filter(n => (n.source || "").toLowerCase().includes("aprs")),
    [privateNodes]
  );
  const brandmeisterNodes = useMemo(() =>
    privateNodes.filter(n => (n.source || "").toLowerCase().includes("brandmeister")),
    [privateNodes]
  );

  // Filtered APRS node count for filter panel
  const filteredAprsCount = useMemo(() => {
    if (aprsFilterTypes && aprsFilterTypes.length === 0) return 0;
    let result = aprsNodes;
    if (aprsFilterTypes && aprsFilterTypes.length > 0) {
      result = result.filter(n => aprsFilterTypes.includes(n.node_type));
    }
    if (aprsSearchQuery.length >= 2) {
      const q = aprsSearchQuery.toLowerCase();
      result = result.filter(n =>
        (n.callsign || "").toLowerCase().includes(q) ||
        (n.location_name || "").toLowerCase().includes(q) ||
        (n.network || "").toLowerCase().includes(q)
      );
    }
    return result.length;
  }, [aprsNodes, aprsFilterTypes, aprsSearchQuery]);

  // Filtered BrandMeister node count for filter panel
  const filteredBmCount = useMemo(() => {
    if (bmFilterTypes && bmFilterTypes.length === 0) return 0;
    let result = brandmeisterNodes;
    if (bmFilterTypes && bmFilterTypes.length > 0) {
      result = result.filter(n => bmFilterTypes.includes(n.node_type));
    }
    if (bmSearchQuery.length >= 2) {
      const q = bmSearchQuery.toLowerCase();
      result = result.filter(n =>
        (n.callsign || "").toLowerCase().includes(q) ||
        (n.location_name || "").toLowerCase().includes(q) ||
        (n.network || "").toLowerCase().includes(q) ||
        (n.node_number || "").toLowerCase().includes(q)
      );
    }
    return result.length;
  }, [brandmeisterNodes, bmFilterTypes, bmSearchQuery]);

  // Country list for filter dropdown
  const repeaterCountries = useMemo(() => {
    const counts = {};
    for (const r of repeaters) {
      const cc = r.country_code || '?';
      counts[cc] = counts[cc] || { code: cc, name: r.country || cc, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts);
  }, [repeaters]);

  // All available markers (regardless of active layers) — for QSO form nearby refs.
  // ONLY compute when QSO form is open — building 100k+ markers on every data change
  // blocks the main thread during worldwide fetch completion.
  const allAvailableMarkers = useMemo(() => {
    if (!showQsoForm) return [];
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
    const iotaAvail = iotaData.length > 0 ? iotaData : IOTA_DATA;
    iotaAvail.forEach(i => markers.push({ ...i, layerType: "iota", color: LAYER_COLORS.iota, layerLabel: "IOTA" }));
    const lighthousesAvail = lighthouseData.length > 0 ? lighthouseData : LIGHTHOUSE_DATA;
    lighthousesAvail.forEach(l => markers.push({ ...l, layerType: "lighthouse", color: LAYER_COLORS.lighthouse, layerLabel: "Leuchtturm" }));
    // Include repeaters for QSO form worldwide search
    if (repeaters.length > 0) {
      repeaters.forEach(r => {
        if (r.lat && r.lng) markers.push({
          ...r,
          code: r.callsign,
          reference: r.callsign,
          name: `${r.callsign} ${r.frequency?.toFixed(4) || ''} MHz`.trim() + (r.location_name ? ` · ${r.location_name}` : ''),
          layerType: "repeater",
          color: "#3b82f6",
          layerLabel: "Relais"
        });
      });
    }
    // Skip override copy when no overrides exist (common case — avoids 100k object copies)
    const hasOverrides = Object.keys(serverOverrides).length > 0;
    if (!hasOverrides) return markers;
    return markers.map(m => {
      const code = m.code || m.reference;
      const ovKey = `${m.layerType}:${code}`;
      const ov = serverOverrides[ovKey];
      if (!ov) return m;
      return {
        ...m,
        name: ov.adjusted_name || m.name,
        lat: ov.manual_lat != null ? ov.manual_lat : m.lat,
        lng: ov.manual_lng != null ? ov.manual_lng : m.lng,
      };
    });
  }, [showQsoForm, sotaData, potaData, hbffData, wwbotaData, castleData, iotaData, lighthouseData, serverOverrides, repeaters]);

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
    const refResults = allMarkers.filter(m => {
      const name = (m.name || "").toLowerCase();
      const code = (m.code || m.reference || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    }).slice(0, 30);

    // Also search repeaters by callsign, location, frequency
    const repeaterResults = (activeLayers.includes("repeater") && repeaters.length > 0)
      ? repeaters.filter(r => {
          if (!r.lat || !r.lng) return false;
          const callsign = (r.callsign || "").toLowerCase();
          const location = (r.location_name || "").toLowerCase();
          const country = (r.country || "").toLowerCase();
          const freq = String(r.frequency || "");
          return callsign.includes(q) || location.includes(q) || country.includes(q) || freq.includes(q);
        }).slice(0, 20).map(r => ({
          ...r,
          name: `${r.callsign} ${r.frequency?.toFixed(4) || ""} MHz`.trim() + (r.location_name ? ` · ${r.location_name}` : ""),
          code: r.callsign,
          reference: r.callsign,
          layerType: "repeater",
          color: "#3b82f6",
          layerLabel: "Relais"
        }))
      : [];

    setSearchResults([...refResults, ...repeaterResults].slice(0, 50));
  }, [debouncedQuery, allMarkers, activeLayers, repeaters]);

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

  const hasAnyData = sotaData.length > 0 || potaData.length > 0 || hbffData.length > 0 || wwbotaData.length > 0 || castleData.length > 0 || iotaData.length > 0 || lighthouseData.length > 0;
  const isLoading = !loadingCancelled && !showQsoForm && (Object.values(loading).some(v => v) || serverCacheLoading || (!serverCacheLoaded && !isOffline));

  // Cancel loading — aborts the loading indicator and lets the user interact with already-loaded data
  const handleCancelLoading = useCallback(() => {
    setLoadingCancelled(true);
    setLoading({});
    setServerCacheLoading(false);
    setServerCacheLoaded(true);
    toast({ title: "Laden abgebrochen", description: "Daten werden im Hintergrund weitergeladen", duration: 3000 });
  }, [toast]);

  const [showPerfSuggestion, setShowPerfSuggestion] = useState(false);
  const perfTimerRef = useRef(null);

  // Time-based auto-canvas: if loading takes longer than 3 seconds, switch to canvas mode
  // and show a suggestion popup (first time per login session, unless dismissed)
  useEffect(() => {
    if (autoModeOverride) return; // User has disabled auto-canvas
    const alreadyShown = sessionStorage.getItem("hb9om_auto_canvas_shown") === "true";
    if (alreadyShown) return;
    // Start timer once when loading begins — don't reset on isLoading flicker
    if (isLoading && !perfTimerRef.current) {
      perfTimerRef.current = setTimeout(() => {
        setAutoCanvasActive(true);
        sessionStorage.setItem("hb9om_auto_canvas_shown", "true");
        if (localStorage.getItem("hb9om_perf_suggestion_dismissed") !== "true") {
          setShowPerfSuggestion(true);
        }
        perfTimerRef.current = null;
      }, 3000);
    }
    // NOTE: autoCanvasActive is NOT reset when loading finishes — switching back to SVG
    // markers causes a heavy re-render that freezes the browser while the popup is visible.
    // Once activated, canvas mode stays for the session; user can toggle in Settings.
  }, [isLoading, autoModeOverride]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (perfTimerRef.current) clearTimeout(perfTimerRef.current); };
  }, []);

  const handleActivatePerformanceMode = useCallback(() => {
    setPerformanceMode(true);
    localStorage.setItem("hb9om_performance_mode", "true");
    setShowPerfSuggestion(false);
    toast({ title: "Energiesparmodus aktiviert", description: "Marker werden als einfache Punkte dargestellt", duration: 3000 });
  }, [toast]);

  const handleDontAskAgain = useCallback(() => {
    localStorage.setItem("hb9om_perf_suggestion_dismissed", "true");
    setShowPerfSuggestion(false);
    toast({ title: "Hinweis deaktiviert", description: "Wird beim nächsten Login wieder angezeigt", duration: 3000 });
  }, [toast]);

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

      {showChangelog && (
        <VersionChangelogPopup onClose={() => setShowChangelog(false)} />
      )}

      <PreloadHint activeLayers={activeLayers} isLoading={isLoading} />

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

      <RadioLoader isLoading={isLoading} onCancel={handleCancelLoading} />

      {showPerfSuggestion && (
        <PerformanceSuggestionPopup
          onActivate={handleActivatePerformanceMode}
          onDontAskAgain={handleDontAskAgain}
          onClose={() => setShowPerfSuggestion(false)}
        />
      )}

      <div className="flex-1 mt-[52px] relative">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          className="h-full w-full"
          zoomControl={false}
          preferCanvas={true}
          zoomSnap={0.5}
          zoomDelta={0.5}
          updateWhenIdle={true}
          keepBuffer={2}
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
            onMove={handleMapMove}
            onZoom={setMapZoom}
            onMapClick={handleMapClick}
            clickMode={pickingPosition}
          />
          <MapController lockedScale={lockedScale} mapRef={mapRef} onReady={() => setMapReady(true)} />

          {currentPosition && (
            <PositionMarker position={currentPosition} fixed={positionFixed} radius={positionRadius} onRadiusChange={setPositionRadius} onPositionChange={handlePositionChange} />
          )}

          {/* Hazards & Interference Sources WMS overlay (high-voltage, mobile antennas, directional radio, broadcast) */}
          {activeLayers.includes("hazards") && (
            <>
              <WMSTileLayer
                url="https://wms.geo.admin.ch/"
                layers="ch.bfe.elektrische-anlagen_ueber_36"
                format="image/png"
                transparent={true}
                opacity={0.9}
                attribution='&copy; BFE'
              />
              <WMSTileLayer
                url="https://wms.geo.admin.ch/"
                layers="ch.bakom.standorte-mobilfunkanlagen"
                format="image/png"
                transparent={true}
                opacity={0.85}
                attribution='&copy; BAKOM'
              />
              <WMSTileLayer
                url="https://wms.geo.admin.ch/"
                layers="ch.bakom.richtfunkverbindungen"
                format="image/png"
                transparent={true}
                opacity={0.8}
              />
              <WMSTileLayer
                url="https://wms.geo.admin.ch/"
                layers="ch.bakom.radio-fernsehsender"
                format="image/png"
                transparent={true}
                opacity={0.8}
              />
            </>
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

          <WmsFeatureInfo activeLayers={activeLayers} clickMode={pickingPosition} performanceMode={performanceMode} />
          <GpsTracker />

          <MapMarkers
            markers={allMarkers}
            dragMode={dragMode}
            isAdmin={isAdmin}
            onMarkerDrag={handleMarkerDrag}
            onEdit={handleEdit}
            performanceMode={performanceMode}
            autoCanvasActive={autoCanvasActive}
            userPosition={currentPosition}
            onViewportLimitChange={handleViewportLimitChange}
          />

          {activeLayers.includes("repeater") && repeaters.length > 0 && (
            <RepeaterLayer
              repeaters={repeaters}
              filterModes={repeaterFilterModes}
              searchQuery={repeaterSearchQuery}
              showLinks={repeaterShowLinks}
              showCoverage={repeaterShowCoverage}
              showOnlyLinked={repeaterShowOnlyLinked}
              performanceMode={performanceMode}
              filterCountry={repeaterFilterCountry}
              userPosition={currentPosition}
              radiusKm={repeaterRadiusKm}
              adminLinks={adminLinks}
              onSuggestLink={(repeater) => setLinkSuggestTarget(repeater)}
              individualCoverage={individualCoverage}
              onToggleCoverage={handleToggleRepeaterCoverage}
              activeContinents={activeContinents}
              activeCountries={activeCountries}
              isAdmin={isAdmin}
            />
          )}

          {activeLayers.includes("aprs") && aprsNodes.length > 0 && (
            <PrivateNodeLayer
              nodes={aprsNodes}
              performanceMode={performanceMode}
              userPosition={currentPosition}
              filterTypes={aprsFilterTypes}
              searchQuery={aprsSearchQuery}
              sourceFilter="aprs"
              colorScheme="aprs"
            />
          )}

          {activeLayers.includes("brandmeister") && brandmeisterNodes.length > 0 && (
            <PrivateNodeLayer
              nodes={brandmeisterNodes}
              performanceMode={performanceMode}
              userPosition={currentPosition}
              filterTypes={bmFilterTypes}
              searchQuery={bmSearchQuery}
              sourceFilter="brandmeister"
              colorScheme="brandmeister"
            />
          )}

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
          activeContinents={activeContinents}
          onToggleContinent={handleToggleContinent}
          activeCountries={activeCountries}
          onToggleCountry={handleToggleCountry}
        />

        {activeLayers.includes("aprs") && aprsNodes.length > 0 && (
          <AprsFilter
            filterTypes={aprsFilterTypes}
            onFilterTypesChange={setAprsFilterTypes}
            searchQuery={aprsSearchQuery}
            onSearchQueryChange={setAprsSearchQuery}
            nodeCount={aprsNodes.length}
            visibleCount={filteredAprsCount}
          />
        )}

        {activeLayers.includes("brandmeister") && brandmeisterNodes.length > 0 && (
          <BrandMeisterFilter
            filterTypes={bmFilterTypes}
            onFilterTypesChange={setBmFilterTypes}
            searchQuery={bmSearchQuery}
            onSearchQueryChange={setBmSearchQuery}
            nodeCount={brandmeisterNodes.length}
            visibleCount={filteredBmCount}
            leftOffsetClass={activeLayers.includes("aprs") && aprsNodes.length > 0 ? "left-40" : "left-16"}
          />
        )}

        {activeLayers.includes("repeater") && repeaters.length > 0 && (
          <RepeaterFilter
            filterModes={repeaterFilterModes}
            onFilterModesChange={setRepeaterFilterModes}
            searchQuery={repeaterSearchQuery}
            onSearchQueryChange={setRepeaterSearchQuery}
            showLinks={repeaterShowLinks}
            onShowLinksChange={setRepeaterShowLinks}
            showCoverage={repeaterShowCoverage}
            onShowCoverageChange={setRepeaterShowCoverage}
            showOnlyLinked={repeaterShowOnlyLinked}
            onShowOnlyLinkedChange={setRepeaterShowOnlyLinked}
            filterCountry={repeaterFilterCountry}
            onFilterCountryChange={setRepeaterFilterCountry}
            countries={repeaterCountries}
            repeaterCount={repeaters.length}
            visibleCount={filteredRepeaterCount}
            radiusKm={repeaterRadiusKm}
            onRadiusKmChange={setRepeaterRadiusKm}
            userPosition={currentPosition}
          />
        )}

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
            disabled={isOffline}
            className={`w-10 h-10 bg-white rounded-lg shadow-lg border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              offlineAreas.length > 0 ? "border-blue-400 text-blue-500" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title={isOffline ? "Nur online möglich" : "Offline-Karte herunterladen"}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const newVal = !forceOffline;
              setForceOffline(newVal);
              localStorage.setItem("hb9om_force_offline", String(newVal));
              if (newVal) {
                // Cache all current data for offline use
                cacheReferenceData({ sota: sotaData, pota: potaData, hbff: hbffData, wwbota: wwbotaData, castle: castleData, iota: iotaData, lighthouse: lighthouseData });
                cacheOverrides(serverOverrides);
                // Cache QRZ lookups for offline use
                base44.entities.QrzLookup.list("-created_date", 200)
                  .then(qrz => cacheQrzLookups(qrz || []))
                  .catch(() => {});
                toast({ title: "Offline-Modus aktiviert", description: "Daten für Offline-Nutzung gespeichert", duration: 3000 });
              } else {
                toast({ title: "Online-Modus aktiviert", duration: 2000 });
              }
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
            disabled={isOffline}
            className={`w-10 h-10 bg-white rounded-lg shadow-lg border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              dragMode ? "border-purple-400 text-purple-500 animate-pulse" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title={isOffline ? "Nur online möglich" : isAdmin ? "Punkte verschieben (Drag & Drop)" : "Punkte korrigieren (Antrag an Admin)"}
          >
            <Move className="w-4 h-4" />
          </button>
          <Link
            to={isAdmin ? "/admin/change-requests" : "/change-requests"}
            className={`relative w-10 h-10 bg-white rounded-lg shadow-lg border flex items-center justify-center transition-colors ${
              pendingRequestCount > 0
                ? "border-amber-400 text-amber-600"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title={isAdmin ? "Anträge prüfen" : "Meine Änderungsanträge"}
          >
            <ClipboardList className="w-4 h-4" />
            {pendingRequestCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingRequestCount}
              </span>
            )}
          </Link>

        </div>

        {pickingPosition && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
            📍 Auf Karte tippen um Position zu setzen
          </div>
        )}

        {dragMode && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[1000] bg-purple-900 text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5" />
            {isAdmin ? "Marker halten & ziehen" : "Marker ziehen → Antrag an Admin"}
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

        {viewportLimitInfo.isCapped && (
          <ViewportLimitHint
            visibleCount={viewportLimitInfo.visibleCount}
            maxRender={viewportLimitInfo.maxRender}
            totalCount={viewportLimitInfo.totalCount}
          />
        )}

        <FoxHuntingSwitch mode={foxHuntingMode} onModeChange={setFoxHuntingMode} />
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
          referenceData={{ sota: sotaData, pota: potaData, hbff: hbffData, wwbota: wwbotaData, castle: castleData, iota: iotaData, lighthouse: lighthouseData }}
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

      {linkSuggestTarget && (
        <RepeaterLinkSuggestDialog
          fromRepeater={linkSuggestTarget}
          allRepeaters={repeaters}
          onClose={() => setLinkSuggestTarget(null)}
          onSubmit={() => setLinkSuggestTarget(null)}
        />
      )}

      <BottomNavigation />
    </div>
  );
}