import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Plus, Move, Radio, MapPin, Loader2 } from "lucide-react";
import { MapContainer, useMap, useMapEvents } from "react-leaflet";
import { base44 } from "@/api/base44Client";
import { useMapData } from "@/hooks/useMapData";
import { FILTER_MODES } from "@/lib/repeaterModes";
import { shouldShowHeavyLoadDialog, getRememberedDecision } from "@/components/map/HeavyLoadConfirmDialog";
import { hasSeenCurrentChangelog, isChangelogPermanentlyDismissed } from "@/components/map/VersionChangelogPopup";

// Map components
import MapTileLayer from "@/components/map/MapTileLayer";
import MapHeader from "@/components/map/MapHeader";
import LayerControl from "@/components/map/LayerControl";
import MapControls from "@/components/map/MapControls";
import MapPositionControls from "@/components/map/MapPositionControls";
import MapLegend from "@/components/map/MapLegend";
import MapMarkers from "@/components/map/MapMarkers";
import ViewportDataLoader from "@/components/map/ViewportDataLoader";
import MapErrorBoundary from "@/components/MapErrorBoundary";
import RepeaterLayer from "@/components/map/RepeaterLayer";
import TotaLayer from "@/components/map/TotaLayer";
import PrivateNodeLayer from "@/components/map/PrivateNodeLayer";
import PositionMarker from "@/components/map/PositionMarker";
import GpsTracker from "@/components/map/GpsTracker";
import WmsFeatureInfo from "@/components/map/WmsFeatureInfo";
import WmsOverlayLayer from "@/components/map/WmsOverlayLayer";
import SearchResults from "@/components/map/SearchResults";
import RadioLoader from "@/components/map/RadioLoader";
import PreloadHint from "@/components/map/PreloadHint";
import ViewportLimitHint from "@/components/map/ViewportLimitHint";
import HeavyLoadConfirmDialog from "@/components/map/HeavyLoadConfirmDialog";
import OfflineAreaDialog from "@/components/map/OfflineAreaDialog";
import PerformanceSuggestionPopup from "@/components/map/PerformanceSuggestionPopup";
import SplashScreen from "@/components/map/SplashScreen";
import VersionChangelogPopup from "@/components/map/VersionChangelogPopup";
import DonationPopup from "@/components/DonationPopup";
import LogEntryForm from "@/components/map/LogEntryForm";
import ChangeRequestDialog from "@/components/map/ChangeRequestDialog";
import RepeaterLinkSuggestDialog from "@/components/map/RepeaterLinkSuggestDialog";
import RepeaterCorrectionDialog from "@/components/map/RepeaterCorrectionDialog";
import UserCoverageDialog from "@/components/map/UserCoverageDialog";
import UserCoverageLayer from "@/components/map/UserCoverageLayer";
import PublicPositionLayer from "@/components/map/PublicPositionLayer";

// Filters
import RepeaterFilter from "@/components/map/RepeaterFilter";
import TotaFilter from "@/components/map/TotaFilter";
import AprsFilter from "@/components/map/AprsFilter";
import BrandMeisterFilter from "@/components/map/BrandMeisterFilter";

// Other components
import BottomNavigation from "@/components/BottomNavigation";
import FirstTimeSetup from "@/components/FirstTimeSetup";
import FoxHuntingSwitch from "@/components/FoxHuntingSwitch";
import MapMenuDrawer from "@/components/map/MapMenuDrawer";
import { useAppFeatures, syncFeaturesFromUser } from "@/lib/appFeatures";

// Tile layer configs
const TILE_CONFIGS = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
    tileKeyPrefix: "osm",
  },
  swisstopo: {
    url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    attribution: '&copy; swisstopo',
    maxZoom: 18,
    tileKeyPrefix: "swisstopo",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri',
    maxZoom: 19,
    tileKeyPrefix: "satellite",
  },
};

// Scale → zoom mapping for SwissTopo
const SCALE_TO_ZOOM = { 10000: 14, 25000: 12, 50000: 10, 100000: 8 };

// Layer colors for marker building
const LAYER_COLORS = {
  sota: "#e74c3c", pota: "#27ae60", hbff: "#8e44ad", wwbota: "#795548",
  castle: "#e67e22", iota: "#3498db", lighthouse: "#f39c12",
};

// Layer labels for search matching
const LAYER_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "WWFF", wwbota: "WWBOTA",
  castle: "WCA", iota: "IOTA", lighthouse: "WLOTA",
  repeater: "Relais", tota: "TOTA", aprs: "APRS", brandmeister: "BrandMeister",
};

// Build a unified markers array from all reference types (search uses ALL loaded data, not just active layers)
function buildMarkers(data, activeLayers) {
  const markers = [];
  for (const type of ["sota", "pota", "hbff", "wwbota", "castle", "iota", "lighthouse"]) {
    if (activeLayers && !activeLayers.includes(type)) continue;
    const refs = data[type] || [];
    for (const ref of refs) {
      if (ref.lat == null || ref.lng == null) continue;
      markers.push({
        ...ref,
        code: ref.code || ref.reference,
        reference: ref.reference || ref.code,
        layerType: type,
        layerLabel: LAYER_LABELS[type] || type,
        color: ref.color || LAYER_COLORS[type],
      });
    }
  }
  return markers;
}

// Build search candidates from ALL loaded data (regardless of active layers) for comprehensive search
function buildSearchCandidates(data, repeaters) {
  const candidates = [];
  for (const type of ["sota", "pota", "hbff", "wwbota", "castle", "iota", "lighthouse"]) {
    const refs = data[type] || [];
    for (const ref of refs) {
      if (ref.lat == null || ref.lng == null) continue;
      candidates.push({
        ...ref,
        code: ref.code || ref.reference,
        reference: ref.reference || ref.code,
        layerType: type,
        layerLabel: LAYER_LABELS[type] || type,
        color: ref.color || LAYER_COLORS[type],
      });
    }
  }
  // Include repeaters
  for (const r of (repeaters || [])) {
    if (r.lat == null || r.lng == null) continue;
    candidates.push({
      ...r,
      code: r.callsign,
      name: r.location_name || r.callsign,
      layerType: "repeater",
      layerLabel: LAYER_LABELS.repeater,
      color: "#3b82f6",
    });
  }
  // Include TOTA
  for (const t of (data.tota || [])) {
    if (t.lat == null || t.lng == null) continue;
    candidates.push({
      ...t,
      code: t.code,
      name: t.name,
      layerType: "tota",
      layerLabel: LAYER_LABELS.tota,
      color: "#f97316",
    });
  }
  return candidates;
}

// Component to handle map events (zoom, move) and expose map ref
function MapController({ onMapReady, onZoomIn, onZoomOut, lockedScale, onMapClick }) {
  const map = useMap();
  // Ref ensures the click handler always calls the latest onMapClick,
  // even though useMapEvents only registers once.
  const onMapClickRef = useRef(null);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);

  useMapEvents({
    zoomend: () => {
      const c = map.getCenter();
      localStorage.setItem("hb9om_map_state", JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
    },
    moveend: () => {
      const c = map.getCenter();
      localStorage.setItem("hb9om_map_state", JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
    },
    click: (e) => { if (onMapClickRef.current) onMapClickRef.current(e.latlng); },
  });

  return null;
}

export default function Home() {
  // User info
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Feature flags
  const { features } = useAppFeatures();

  // Map state — activeLayers must be declared BEFORE useMapData (which needs it)
  const [activeLayers, setActiveLayers] = useState(() => {
    const saved = localStorage.getItem("hb9om_active_layers");
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    // Default: all layers OFF — no automatic loading on map open.
    // User must explicitly enable layers; state persists in localStorage.
    return [];
  });

  // Data loading — gated by activeLayers (only loads data for enabled layers)
  const { data, repeaters, privateNodes, adminLinks, loading, loadingMessage, cancelLoading, onViewportData } = useMapData(activeLayers);
  const [baseLayer, setBaseLayer] = useState(() => localStorage.getItem("hb9om_base_layer") || "osm");
  const [lockedScale, setLockedScale] = useState(() => {
    const saved = localStorage.getItem("hb9om_locked_scale");
    return saved ? parseInt(saved) : null;
  });
  const [mapOpacity, setMapOpacity] = useState(() => {
    const saved = localStorage.getItem("hb9om_map_opacity");
    return saved ? parseFloat(saved) : 1;
  });
  const [activeContinents, setActiveContinents] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hb9om_active_continents")) || []; } catch { return []; }
  });
  const [activeCountries, setActiveCountries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hb9om_active_countries")) || []; } catch { return []; }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [placeResults, setPlaceResults] = useState([]);
  const [serverSearching, setServerSearching] = useState(false);

  // Position state
  const [userPosition, setUserPosition] = useState(null);
  const [fixedPosition, setFixedPosition] = useState(null);
  const [positionRadius, setPositionRadius] = useState(5000);

  // UI mode state
  const [performanceMode, setPerformanceMode] = useState(() => localStorage.getItem("hb9om_performance_mode") === "true");
  const [dragMode, setDragMode] = useState(() => localStorage.getItem("hb9om_drag_mode") === "true");
  const [foxMode, setFoxMode] = useState(() => localStorage.getItem("hb9om_fox_mode") || "fox");
  const [showLogForm, setShowLogForm] = useState(false);
  const [editLogEntry, setEditLogEntry] = useState(null);
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);

  // User coverage (MODUS B) — persisted to localStorage so it survives page reloads.
  // The coverage stays on the map like other reference symbols until explicitly deleted.
  const COVERAGE_STORAGE_KEY = "hb9om_user_coverage_current";
  const [showUserCoverageDialog, setShowUserCoverageDialog] = useState(false);
  const [userCoverage, setUserCoverage] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(COVERAGE_STORAGE_KEY)); return s?.coverage || null; } catch { return null; }
  });
  const [userCoveragePosition, setUserCoveragePosition] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(COVERAGE_STORAGE_KEY)); return s?.position || null; } catch { return null; }
  });
  const [userCoverageDevice, setUserCoverageDevice] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(COVERAGE_STORAGE_KEY)); return s?.device || "mobil"; } catch { return "mobil"; }
  });
  const [mapClickForCoverage, setMapClickForCoverage] = useState(false);
  const [mapClickForPosition, setMapClickForPosition] = useState(false);

  // Persist coverage state to localStorage — saves when a position is set,
  // even before coverage is calculated, so the marker survives page reloads.
  useEffect(() => {
    if (userCoveragePosition) {
      localStorage.setItem(COVERAGE_STORAGE_KEY, JSON.stringify({
        coverage: userCoverage,
        position: userCoveragePosition,
        device: userCoverageDevice,
      }));
    } else {
      localStorage.removeItem(COVERAGE_STORAGE_KEY);
    }
  }, [userCoverage, userCoveragePosition, userCoverageDevice]);

  // Public positions — shared GPS positions visible to all users
  const [publicPositions, setPublicPositions] = useState([]);

  // Load public positions periodically (every 60s) and on mount
  useEffect(() => {
    const loadPublicPositions = async () => {
      try {
        const res = await base44.functions.invoke("managePublicPosition", { action: "list" });
        const data = res?.data || res;
        if (data?.positions) setPublicPositions(data.positions);
      } catch {}
    };
    loadPublicPositions();
    const interval = setInterval(loadPublicPositions, 60000);
    return () => clearInterval(interval);
  }, []);

  // Donation popup trigger — increments on layer menu open/close to trigger check
  const [donationTriggerKey, setDonationTriggerKey] = useState(0);

  // Setup complete — triggers ViewportDataLoader reload when FirstTimeSetup closes
  const [setupComplete, setSetupComplete] = useState(() => localStorage.getItem("hb9om_setup_complete") === "true");

  // Splash & changelog
  const [showSplash, setShowSplash] = useState(() => {
    const dismissed = sessionStorage.getItem("hb9om_splash_dismissed") === "true";
    return !dismissed;
  });
  const [showChangelog, setShowChangelog] = useState(() => {
    return !hasSeenCurrentChangelog() && !isChangelogPermanentlyDismissed();
  });

  // Heavy load confirmation
  const [pendingLayers, setPendingLayers] = useState(null);

  // Layer menu open state — lifted for external control (ViewportLimitHint action button)
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  // Performance suggestion
  const [showPerfSuggestion, setShowPerfSuggestion] = useState(false);
  const perfSuggestionShownRef = useRef(false);

  // Viewport limit
  const [viewportLimit, setViewportLimit] = useState({ visibleCount: 0, maxRender: 0, totalCount: 0, isCapped: false });

  // Dialogs
  const [changeRequestMarker, setChangeRequestMarker] = useState(null);
  const [repeaterLinkSuggest, setRepeaterLinkSuggest] = useState(null);
  const [repeaterCorrection, setRepeaterCorrection] = useState(null);
  const [individualCoverage, setIndividualCoverage] = useState(new Set());

  // Restore saved filter state (point 13)
  const savedFilterState = (() => {
    try { return JSON.parse(localStorage.getItem("hb9om_filter_state")) || {}; } catch { return {}; }
  })();

  // Repeater filters
  const [repeaterFilterModes, setRepeaterFilterModes] = useState(savedFilterState.repeaterFilterModes || FILTER_MODES);
  const [repeaterSearchQuery, setRepeaterSearchQuery] = useState(savedFilterState.repeaterSearchQuery || "");
  const [repeaterFilterCountries, setRepeaterFilterCountries] = useState(savedFilterState.repeaterFilterCountries || []);
  const [showRepeaterLinks, setShowRepeaterLinks] = useState(savedFilterState.showRepeaterLinks || false);
  const [showRepeaterCoverage, setShowRepeaterCoverage] = useState(savedFilterState.showRepeaterCoverage || false);
  const [showOnlyLinked, setShowOnlyLinked] = useState(savedFilterState.showOnlyLinked || false);
  const [repeaterRadiusKm, setRepeaterRadiusKm] = useState(savedFilterState.repeaterRadiusKm || 0);

  // TOTA filters
  const [totaFilterTypes, setTotaFilterTypes] = useState(savedFilterState.totaFilterTypes ?? null);
  const [totaSearchQuery, setTotaSearchQuery] = useState(savedFilterState.totaSearchQuery || "");
  const [totaFilterCountries, setTotaFilterCountries] = useState(savedFilterState.totaFilterCountries || []);
  const [showChTota, setShowChTota] = useState(() => localStorage.getItem("hb9om_show_ch_tota") === "true");
  const [totaViewportCount, setTotaViewportCount] = useState({ visible: 0, total: 0 });

  // APRS filters
  const [aprsFilterTypes, setAprsFilterTypes] = useState(savedFilterState.aprsFilterTypes ?? null);
  const [aprsSearchQuery, setAprsSearchQuery] = useState(savedFilterState.aprsSearchQuery || "");
  const [aprsFilterCountries, setAprsFilterCountries] = useState(savedFilterState.aprsFilterCountries || []);

  // BrandMeister filters
  const [bmFilterTypes, setBmFilterTypes] = useState(savedFilterState.bmFilterTypes ?? null);
  const [bmSearchQuery, setBmSearchQuery] = useState(savedFilterState.bmSearchQuery || "");
  const [bmFilterCountries, setBmFilterCountries] = useState(savedFilterState.bmFilterCountries || []);

  // Save filter state to localStorage (point 13: remember filter settings)
  useEffect(() => {
    const filterState = {
      repeaterFilterModes, repeaterSearchQuery, repeaterFilterCountries,
      showRepeaterLinks, showRepeaterCoverage, showOnlyLinked, repeaterRadiusKm,
      totaFilterTypes, totaSearchQuery, totaFilterCountries,
      aprsFilterTypes, aprsSearchQuery, aprsFilterCountries,
      bmFilterTypes, bmSearchQuery, bmFilterCountries,
    };
    localStorage.setItem("hb9om_filter_state", JSON.stringify(filterState));
  }, [repeaterFilterModes, repeaterSearchQuery, repeaterFilterCountries,
      showRepeaterLinks, showRepeaterCoverage, showOnlyLinked, repeaterRadiusKm,
      totaFilterTypes, totaSearchQuery, totaFilterCountries,
      aprsFilterTypes, aprsSearchQuery, aprsFilterCountries,
      bmFilterTypes, bmSearchQuery, bmFilterCountries]);

  // Map ref
  const mapRef = useRef(null);

  // Load user info
  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setCurrentUser(me);
        setIsAdmin(me?.role === "admin");
        // Sync feature flags from User entity (User entity wins)
        syncFeaturesFromUser();
      } catch {}
    })();
  }, []);

  // Trigger donation popup when layer menu opens or closes
  useEffect(() => {
    setDonationTriggerKey(k => k + 1);
  }, [menuDrawerOpen]);

  // Save active layers to localStorage
  useEffect(() => {
    localStorage.setItem("hb9om_active_layers", JSON.stringify(activeLayers));
  }, [activeLayers]);

  // Save base layer to localStorage
  useEffect(() => {
    localStorage.setItem("hb9om_base_layer", baseLayer);
  }, [baseLayer]);

  // Save performance mode
  useEffect(() => {
    localStorage.setItem("hb9om_performance_mode", String(performanceMode));
  }, [performanceMode]);

  // Save map opacity, drag mode, fox mode, continents/countries, locked scale
  useEffect(() => {
    localStorage.setItem("hb9om_map_opacity", String(mapOpacity));
  }, [mapOpacity]);

  useEffect(() => {
    localStorage.setItem("hb9om_drag_mode", String(dragMode));
  }, [dragMode]);

  useEffect(() => {
    localStorage.setItem("hb9om_fox_mode", foxMode);
  }, [foxMode]);

  useEffect(() => {
    localStorage.setItem("hb9om_active_continents", JSON.stringify(activeContinents));
  }, [activeContinents]);

  useEffect(() => {
    localStorage.setItem("hb9om_active_countries", JSON.stringify(activeCountries));
  }, [activeCountries]);

  useEffect(() => {
    if (lockedScale != null) {
      localStorage.setItem("hb9om_locked_scale", String(lockedScale));
    } else {
      localStorage.removeItem("hb9om_locked_scale");
    }
  }, [lockedScale]);

  // Auto-dismiss splash after 3 seconds
  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem("hb9om_splash_dismissed", "true");
    }, 3000);
    return () => clearTimeout(timer);
  }, [showSplash]);

  // Get GPS position on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Build unified markers array for MapMarkers
  const allMarkers = useMemo(() => buildMarkers(data, activeLayers), [data, activeLayers]);
  // All loaded markers regardless of active layers — used by QSO form for reference selection
  const allMarkersUnfiltered = useMemo(() => buildMarkers(data, null), [data]);

  // Search across ALL loaded data (not just active layers) — matches code, name, layerType, layerLabel
  const searchCandidates = useMemo(() => buildSearchCandidates(data, repeaters), [data, repeaters]);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = searchCandidates
      .filter(m =>
        (m.code || m.reference || "").toLowerCase().includes(q) ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.layerType || "").toLowerCase().includes(q) ||
        (m.layerLabel || "").toLowerCase().includes(q) ||
        (m.callsign || "").toLowerCase().includes(q) ||
        (m.location_name || "").toLowerCase().includes(q)
      )
      .slice(0, 30);
    setSearchResults(results);
  }, [searchQuery, searchCandidates]);

  // Place search via backend (point 14: search places with timeout popup)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setPlaceResults([]);
      setServerSearching(false);
      return;
    }
    setServerSearching(true);
    const timer = setTimeout(() => {
      base44.functions.invoke("searchPlaces", { query: searchQuery, limit: 10 })
        .then(res => {
          setPlaceResults(res.data?.places || []);
        })
        .catch(() => setPlaceResults([]))
        .finally(() => setServerSearching(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Merge local results with place results (point 14)
  const mergedSearchResults = useMemo(() => {
    const places = placeResults.filter(p =>
      !searchResults.some(r => r.name === p.name && r.lat === p.lat)
    );
    return [...searchResults, ...places].slice(0, 30);
  }, [searchResults, placeResults]);

  // Show performance suggestion when many markers are loaded
  useEffect(() => {
    if (perfSuggestionShownRef.current) return;
    if (allMarkers.length > 5000 && !performanceMode) {
      setShowPerfSuggestion(true);
      perfSuggestionShownRef.current = true;
    }
  }, [allMarkers.length, performanceMode]);

  // Layer toggle with heavy load confirmation
  const handleToggleLayer = useCallback((layerId) => {
    setActiveLayers(prev => {
      if (prev.includes(layerId)) {
        return prev.filter(l => l !== layerId);
      }
      // Check if this is a heavy layer that needs confirmation
      if (shouldShowHeavyLoadDialog(layerId)) {
        const decision = getRememberedDecision(layerId);
        if (decision === "confirm") {
          return [...prev, layerId];
        }
        // Show confirmation dialog
        setPendingLayers([layerId]);
        return prev; // Don't add yet — wait for confirmation
      }
      return [...prev, layerId];
    });
  }, []);

  const handleHeavyLoadConfirm = useCallback(() => {
    if (pendingLayers) {
      setActiveLayers(prev => [...prev, ...pendingLayers]);
      setPendingLayers(null);
    }
  }, [pendingLayers]);

  const handleHeavyLoadCancel = useCallback(() => {
    // Still activate the layer — data is already loaded, just show it
    if (pendingLayers) {
      setActiveLayers(prev => [...prev, ...pendingLayers]);
      setPendingLayers(null);
    }
  }, [pendingLayers]);

  // Continent/country toggle
  const handleToggleContinent = useCallback((continentId) => {
    if (continentId === "__all") {
      setActiveContinents([]);
      return;
    }
    setActiveContinents(prev =>
      prev.includes(continentId)
        ? prev.filter(c => c !== continentId)
        : [...prev, continentId]
    );
  }, []);

  const handleToggleCountry = useCallback((countryCode) => {
    setActiveCountries(prev =>
      prev.includes(countryCode)
        ? prev.filter(c => c !== countryCode)
        : [...prev, countryCode]
    );
  }, []);

  // Map control handlers
  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  const handleScaleChange = useCallback((scale) => {
    if (scale === "auto") {
      setLockedScale(null);
      return;
    }
    const zoom = SCALE_TO_ZOOM[parseInt(scale)];
    if (zoom != null) {
      setLockedScale(parseInt(scale));
      mapRef.current?.setZoom(zoom);
    }
  }, []);

  const handleScaleUp = useCallback(() => {
    if (!lockedScale) return;
    const scales = [10000, 25000, 50000, 100000];
    const idx = scales.indexOf(lockedScale);
    if (idx > 0) {
      const newScale = scales[idx - 1];
      setLockedScale(newScale);
      mapRef.current?.setZoom(SCALE_TO_ZOOM[newScale]);
    }
  }, [lockedScale]);

  const handleScaleDown = useCallback(() => {
    if (!lockedScale) return;
    const scales = [10000, 25000, 50000, 100000];
    const idx = scales.indexOf(lockedScale);
    if (idx < scales.length - 1) {
      const newScale = scales[idx + 1];
      setLockedScale(newScale);
      mapRef.current?.setZoom(SCALE_TO_ZOOM[newScale]);
    }
  }, [lockedScale]);

  // Search result selection
  const handleSearchSelect = useCallback((result) => {
    if (result.lat != null && result.lng != null) {
      mapRef.current?.flyTo([result.lat, result.lng], 13, { duration: 1 });
    }
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  // Marker drag (for position correction)
  const handleMarkerDrag = useCallback((marker, newLat, newLng) => {
    setChangeRequestMarker({ marker, newPosition: [newLat, newLng] });
  }, []);

  // Repeater link suggestion
  const handleSuggestLink = useCallback((repeater) => {
    setRepeaterLinkSuggest(repeater);
  }, []);

  // Repeater correction
  const handleRepeaterCorrection = useCallback((repeater) => {
    setRepeaterCorrection(repeater);
  }, []);

  // Toggle individual coverage — accepts either a repeater object or an id string
  const handleToggleCoverage = useCallback((repeaterOrId) => {
    const id = typeof repeaterOrId === 'string' ? repeaterOrId : repeaterOrId?.id;
    if (!id) return;
    setIndividualCoverage(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Position change from PositionMarker popup
  const handlePositionChange = useCallback((pos) => {
    setFixedPosition(pos);
  }, []);

  // GPS tracking enabled state — for button highlighting
  const [gpsTrackingActive, setGpsTrackingActive] = useState(
    () => localStorage.getItem("hb9om_gps_tracking_enabled") !== "false"
  );

  useEffect(() => {
    const handler = () => {
      setGpsTrackingActive(localStorage.getItem("hb9om_gps_tracking_enabled") !== "false");
    };
    window.addEventListener("gps-tracking-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("gps-tracking-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // Memoized callback for public position updates from GpsTracker
  // MUST be stable (useCallback) — if it changes every render, GpsTracker's
  // broadcastPosition useCallback changes, which re-runs the GPS watch effect
  // on every render, clearing the watch before it can get a position.
  const handlePublicPositionUpdate = useCallback((pos) => {
    setPublicPositions(prev => {
      const idx = prev.findIndex(p => p.is_own);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], lat: pos.lat, lng: pos.lng, last_updated: new Date().toISOString() };
        return copy;
      }
      return [{ ...pos, callsign: localStorage.getItem("hb9om_my_callsign") || "Ich", is_own: true, last_updated: new Date().toISOString() }, ...prev];
    });
  }, []);

  // "Center on my position" button — toggles GPS tracking on/off
  const handleCenterOnPosition = useCallback(() => {
    const trackingEnabled = localStorage.getItem("hb9om_gps_tracking_enabled") !== "false";
    if (trackingEnabled) {
      // Turn OFF
      localStorage.setItem("hb9om_gps_tracking_enabled", "false");
      setGpsTrackingActive(false);
      window.dispatchEvent(new CustomEvent("gps-tracking-changed"));
    } else {
      // Turn ON + get GPS position + center map
      localStorage.setItem("hb9om_gps_tracking_enabled", "true");
      setGpsTrackingActive(true);
      window.dispatchEvent(new CustomEvent("gps-tracking-changed"));
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const newPos = [pos.coords.latitude, pos.coords.longitude];
            setUserPosition(newPos);
            mapRef.current?.flyTo(newPos, 14, { duration: 1 });
          },
          () => {
            // Fallback — center on Switzerland
            mapRef.current?.flyTo([46.8, 8.2], 8, { duration: 1 });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      }
    }
  }, []);

  // Get current GPS position and center map
  const handleGetGps = useCallback((onDone) => {
    if (!navigator.geolocation) {
      onDone?.();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(newPos);
        mapRef.current?.flyTo(newPos, 14, { duration: 1 });
        onDone?.();
      },
      () => { onDone?.(); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // Toggle offline mode
  const [forceOffline, setForceOffline] = useState(() => localStorage.getItem("hb9om_force_offline") === "true");
  const toggleOffline = useCallback(() => {
    const newVal = !forceOffline;
    setForceOffline(newVal);
    localStorage.setItem("hb9om_force_offline", String(newVal));
    window.dispatchEvent(new Event("offline-mode-changed"));
  }, [forceOffline]);

  // Build repeater country list for filter
  const repeaterCountries = useMemo(() => {
    const counts = {};
    for (const r of repeaters) {
      const cc = r.country_code || "?";
      counts[cc] = counts[cc] || { code: cc, name: r.country || cc, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [repeaters]);

  // Build private node country lists for APRS and BrandMeister
  const aprsNodes = useMemo(() => privateNodes.filter(n => {
    const src = (n.source || "").toLowerCase();
    return src.includes("aprs") || !src.includes("brandmeister");
  }), [privateNodes]);

  const bmNodes = useMemo(() => privateNodes.filter(n => {
    const src = (n.source || "").toLowerCase();
    return src.includes("brandmeister");
  }), [privateNodes]);

  const aprsCountries = useMemo(() => {
    const counts = {};
    for (const n of aprsNodes) {
      const cc = n.country_code || "?";
      counts[cc] = counts[cc] || { code: cc, name: n.country || cc, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [aprsNodes]);

  const bmCountries = useMemo(() => {
    const counts = {};
    for (const n of bmNodes) {
      const cc = n.country_code || "?";
      counts[cc] = counts[cc] || { code: cc, name: n.country || cc, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [bmNodes]);

  // Build TOTA country list
  const totaCountries = useMemo(() => {
    const counts = {};
    for (const p of data.tota || []) {
      const cc = p.country_code || (p.source === "swiss_csv" ? "CH" : "?");
      counts[cc] = counts[cc] || { code: cc, name: p.country || cc, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [data.tota]);

  // Filtered repeater count for display
  const visibleRepeaterCount = useMemo(() => {
    let count = repeaters.filter(r => r.lat != null && r.lng != null);
    if (repeaterFilterCountries.length > 0) {
      count = count.filter(r => repeaterFilterCountries.includes(r.country_code));
    }
    if (repeaterFilterModes.length > 0) {
      count = count.filter(r => repeaterFilterModes.some(m => r.modes?.includes(m)));
    }
    return count.length;
  }, [repeaters, repeaterFilterCountries, repeaterFilterModes]);

  // Visible TOTA count
  const visibleTotaCount = totaViewportCount.visible;

  // Visible APRS count
  const visibleAprsCount = useMemo(() => {
    let count = aprsNodes.filter(n => n.lat != null && n.lng != null);
    if (aprsFilterTypes && aprsFilterTypes.length === 0) return 0;
    if (aprsFilterTypes && aprsFilterTypes.length > 0) {
      count = count.filter(n => aprsFilterTypes.includes(n.node_type));
    }
    return count.length;
  }, [aprsNodes, aprsFilterTypes]);

  // Visible BrandMeister count
  const visibleBmCount = useMemo(() => {
    let count = bmNodes.filter(n => n.lat != null && n.lng != null);
    if (bmFilterTypes && bmFilterTypes.length === 0) return 0;
    if (bmFilterTypes && bmFilterTypes.length > 0) {
      count = count.filter(n => bmFilterTypes.includes(n.node_type));
    }
    return count.length;
  }, [bmNodes, bmFilterTypes]);

  // Check if SwissTopo scale should be shown
  const showScaleControl = baseLayer === "swisstopo";

  // Check if WMS feature info should be active (Swiss hazards/protected areas)
  const wmsActive = activeLayers.includes("swiss_protected") || activeLayers.includes("hazards");

  // Current position (fixed takes priority over GPS)
  const currentPosition = fixedPosition || userPosition;

  // Tile config
  const tileConfig = TILE_CONFIGS[baseLayer] || TILE_CONFIGS.osm;
  const isOffline = typeof navigator !== "undefined" && (!navigator.onLine || forceOffline);

  // Calculate filter button left offsets based on active layers
  const filterButtons = useMemo(() => {
    const buttons = [];
    let offsetIdx = 0;
    const offsets = ["left-3", "left-16", "left-28", "left-40", "left-52"];
    if (activeLayers.includes("repeater")) {
      buttons.push({ type: "repeater", offset: offsets[offsetIdx++] });
    }
    if (activeLayers.includes("tota")) {
      buttons.push({ type: "tota", offset: offsets[offsetIdx++] });
    }
    if (activeLayers.includes("aprs")) {
      buttons.push({ type: "aprs", offset: offsets[offsetIdx++] });
    }
    if (activeLayers.includes("brandmeister")) {
      buttons.push({ type: "brandmeister", offset: offsets[offsetIdx++] });
    }
    return buttons;
  }, [activeLayers]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Splash Screen */}
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}

      {/* First Time Setup — only after splash dismissed */}
      {!showSplash && <FirstTimeSetup onDone={() => setSetupComplete(true)} />}

      {/* Version Changelog Popup */}
      {showChangelog && <VersionChangelogPopup onClose={() => setShowChangelog(false)} />}

      {/* Map — wrapped in error boundary to prevent white-screen crashes */}
      <MapErrorBoundary>
      <MapContainer
        center={(() => { try { const s = JSON.parse(localStorage.getItem("hb9om_map_state")); return s ? [s.lat, s.lng] : [46.8, 8.2]; } catch { return [46.8, 8.2]; } })()}
        zoom={(() => { try { const s = JSON.parse(localStorage.getItem("hb9om_map_state")); return s?.zoom || 8; } catch { return 8; } })()}
        className="w-full h-full"
        zoomControl={false}
        preferCanvas={true}
        style={{ background: "#e8e8e8" }}
      >
        <MapTileLayer
          key={baseLayer}
          url={tileConfig.url}
          attribution={tileConfig.attribution}
          maxZoom={tileConfig.maxZoom}
          opacity={mapOpacity}
          isOffline={isOffline}
          tileKeyPrefix={tileConfig.tileKeyPrefix}
        />
        <MapController
          onMapReady={handleMapReady}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          lockedScale={lockedScale}
          onMapClick={(latlng) => {
            if (mapClickForCoverage) {
              setUserCoveragePosition([latlng.lat, latlng.lng]);
              setMapClickForCoverage(false);
            } else if (mapClickForPosition) {
              setFixedPosition([latlng.lat, latlng.lng]);
              setUserPosition([latlng.lat, latlng.lng]);
              setMapClickForPosition(false);
              mapRef.current?.flyTo([latlng.lat, latlng.lng], 13, { duration: 1 });
            }
          }}
        />
        <ViewportDataLoader
          activeLayers={activeLayers}
          onDataLoaded={onViewportData}
          isOffline={isOffline}
          reloadTrigger={setupComplete}
        />
        <MapMarkers
          markers={allMarkers}
          dragMode={dragMode}
          isAdmin={isAdmin}
          onMarkerDrag={handleMarkerDrag}
          performanceMode={performanceMode}
          userPosition={currentPosition}
          onViewportLimitChange={setViewportLimit}
        />
        {activeLayers.includes("repeater") && (
          <RepeaterLayer
            repeaters={repeaters}
            filterModes={repeaterFilterModes}
            searchQuery={repeaterSearchQuery}
            showLinks={showRepeaterLinks}
            showCoverage={showRepeaterCoverage}
            showOnlyLinked={showOnlyLinked}
            performanceMode={performanceMode}
            filterCountries={repeaterFilterCountries}
            userPosition={currentPosition}
            radiusKm={repeaterRadiusKm}
            adminLinks={adminLinks}
            onSuggestLink={handleSuggestLink}
            individualCoverage={individualCoverage}
            onToggleCoverage={handleToggleCoverage}
            activeContinents={activeContinents}
            activeCountries={activeCountries}
            isAdmin={isAdmin}
          />
        )}
        {activeLayers.includes("tota") && (
          <TotaLayer
            filterTypes={totaFilterTypes}
            searchQuery={totaSearchQuery}
            performanceMode={performanceMode}
            userPosition={currentPosition}
            activeContinents={activeContinents}
            activeCountries={activeCountries}
            filterCountries={totaFilterCountries}
            showChTota={showChTota}
            onCountsChange={(visible, total) => setTotaViewportCount({ visible, total })}
          />
        )}
        {activeLayers.includes("aprs") && (
          <PrivateNodeLayer
            nodes={aprsNodes}
            performanceMode={performanceMode}
            userPosition={currentPosition}
            filterTypes={aprsFilterTypes}
            searchQuery={aprsSearchQuery}
            colorScheme="aprs"
            filterCountries={aprsFilterCountries}
            activeContinents={activeContinents}
            activeCountries={activeCountries}
          />
        )}
        {activeLayers.includes("brandmeister") && (
          <PrivateNodeLayer
            nodes={bmNodes}
            performanceMode={performanceMode}
            userPosition={currentPosition}
            filterTypes={bmFilterTypes}
            searchQuery={bmSearchQuery}
            sourceFilter="brandmeister"
            colorScheme="brandmeister"
            filterCountries={bmFilterCountries}
            activeContinents={activeContinents}
            activeCountries={activeCountries}
          />
        )}
        <PositionMarker
          position={fixedPosition}
          fixed={true}
          radius={positionRadius}
          onRadiusChange={setPositionRadius}
          onPositionChange={handlePositionChange}
          draggable={dragMode}
        />
        <GpsTracker
          radius={positionRadius}
          onRadiusChange={setPositionRadius}
          onPositionChange={handlePositionChange}
          onPublicPositionUpdate={handlePublicPositionUpdate} />
        <WmsOverlayLayer activeLayers={activeLayers} />
        <WmsFeatureInfo
          activeLayers={activeLayers}
          clickMode={dragMode}
          performanceMode={performanceMode}
        />
        {/* User Coverage (MODUS B) — orange polygon + position marker on map.
            Marker shows as soon as a position is set; polygon after calculation. */}
        {(userCoveragePosition || userCoverage) && (
          <UserCoverageLayer
            coverage={userCoverage}
            position={userCoveragePosition}
            deviceType={userCoverageDevice}
            onMarkerClick={() => setShowUserCoverageDialog(true)}
          />
        )}

        {/* Public positions — shared GPS positions visible to all users.
            Only rendered when the APRS layer is active (per user request). */}
        {publicPositions.length > 0 && activeLayers.includes("aprs") && (
          <PublicPositionLayer positions={publicPositions} />
        )}
      </MapContainer>
      </MapErrorBoundary>

      {/* Header */}
      <MapHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleSidebar={() => setMenuDrawerOpen(true)}
        sidebarOpen={menuDrawerOpen}
        showSearch={features.tools.search !== false}
      />

      {/* Map Menu Drawer */}
      <MapMenuDrawer
        open={menuDrawerOpen}
        onClose={() => setMenuDrawerOpen(false)}
        isLoading={loading}
        loadingMessage={loadingMessage}
      />

      {/* Search Results — only if search is enabled */}
      {features.tools.search !== false && (
        <SearchResults
          results={mergedSearchResults}
          onSelect={handleSearchSelect}
          onClose={() => { setSearchQuery(""); setSearchResults([]); }}
        />
      )}

      {/* Server search indicator (point 14: timeout popup) */}
      {serverSearching && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[2000] bg-white rounded-xl shadow-2xl p-3 max-w-sm flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-900">Server-Suche läuft…</p>
            <p className="text-[10px] text-gray-500">Orte und Referenzen werden gesucht (geschätzt 2-5 Sek.)</p>
          </div>
        </div>
      )}

      {/* Layer Control */}
      <LayerControl
        activeLayers={activeLayers}
        onToggleLayer={handleToggleLayer}
        baseLayer={baseLayer}
        onChangeBaseLayer={setBaseLayer}
        onSelectScale={handleScaleChange}
        lockedScale={lockedScale}
        mapOpacity={mapOpacity}
        onChangeOpacity={setMapOpacity}
        activeContinents={activeContinents}
        onToggleContinent={handleToggleContinent}
        activeCountries={activeCountries}
        onToggleCountry={handleToggleCountry}
        externalIsOpen={layerMenuOpen}
        onOpenChange={setLayerMenuOpen}
      />

      {/* Map Controls (zoom, scale) */}
      <MapControls
        lockedScale={lockedScale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onScaleUp={handleScaleUp}
        onScaleDown={handleScaleDown}
        baseLayer={baseLayer}
      />

      {/* Position Controls (offline, GPS, center position, offline download) */}
      <MapPositionControls
        onCenterPosition={handleCenterOnPosition}
        onGetGps={handleGetGps}
        isOffline={isOffline}
        onToggleOffline={toggleOffline}
        onOpenOfflineDownload={() => setShowOfflineDialog(true)}
        onSetPositionViaMap={() => setMapClickForPosition(true)}
        setPositionActive={mapClickForPosition}
        gpsTrackingActive={gpsTrackingActive}
      />

      {/* Drag-Mode Toggle (Marker verschieben für Positionskorrektur) — only if filter tool enabled */}
      {features.tools.filter !== false && (
        <button
          onClick={() => setDragMode(!dragMode)}
          className={`fixed left-4 z-[1000] w-11 h-11 flex items-center justify-center rounded-lg shadow-lg border transition-colors ${
            dragMode
              ? "bg-blue-500 border-blue-600 text-white"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 230px)" }}
          title={dragMode ? "Marker-Verschiebung aktiv — tippen zum Deaktivieren" : "Marker verschieben (Positionskorrektur)"}
        >
          <Move className="w-5 h-5" />
        </button>
      )}

      {/* Filter buttons — positioned based on active layers (only if filter tool enabled) */}
      {features.tools.filter !== false && filterButtons.map(btn => {
        if (btn.type === "repeater") {
          return (
            <RepeaterFilter
              key="repeater-filter"
              filterModes={repeaterFilterModes}
              onFilterModesChange={setRepeaterFilterModes}
              searchQuery={repeaterSearchQuery}
              onSearchQueryChange={setRepeaterSearchQuery}
              showLinks={showRepeaterLinks}
              onShowLinksChange={setShowRepeaterLinks}
              showCoverage={showRepeaterCoverage}
              onShowCoverageChange={setShowRepeaterCoverage}
              showOnlyLinked={showOnlyLinked}
              onShowOnlyLinkedChange={setShowOnlyLinked}
              filterCountries={repeaterFilterCountries}
              onFilterCountriesChange={setRepeaterFilterCountries}
              countries={repeaterCountries}
              repeaterCount={repeaters.length}
              visibleCount={visibleRepeaterCount}
              radiusKm={repeaterRadiusKm}
              onRadiusKmChange={setRepeaterRadiusKm}
              userPosition={currentPosition}
              leftOffsetClass={btn.offset}
            />
          );
        }
        if (btn.type === "tota") {
          return (
            <TotaFilter
              key="tota-filter"
              filterTypes={totaFilterTypes}
              onFilterTypesChange={setTotaFilterTypes}
              searchQuery={totaSearchQuery}
              onSearchQueryChange={setTotaSearchQuery}
              pointCount={totaViewportCount.total}
              visibleCount={totaViewportCount.visible}
              filterCountries={totaFilterCountries}
              onFilterCountriesChange={setTotaFilterCountries}
              showChTota={showChTota}
              onShowChTotaChange={(val) => {
                setShowChTota(val);
                localStorage.setItem("hb9om_show_ch_tota", String(val));
              }}
              leftOffsetClass={btn.offset}
            />
          );
        }
        if (btn.type === "aprs") {
          return (
            <AprsFilter
              key="aprs-filter"
              filterTypes={aprsFilterTypes}
              onFilterTypesChange={setAprsFilterTypes}
              searchQuery={aprsSearchQuery}
              onSearchQueryChange={setAprsSearchQuery}
              nodeCount={aprsNodes.length}
              visibleCount={visibleAprsCount}
              countries={aprsCountries}
              filterCountries={aprsFilterCountries}
              onFilterCountriesChange={setAprsFilterCountries}
              leftOffsetClass={btn.offset}
            />
          );
        }
        if (btn.type === "brandmeister") {
          return (
            <BrandMeisterFilter
              key="bm-filter"
              filterTypes={bmFilterTypes}
              onFilterTypesChange={setBmFilterTypes}
              searchQuery={bmSearchQuery}
              onSearchQueryChange={setBmSearchQuery}
              nodeCount={bmNodes.length}
              visibleCount={visibleBmCount}
              countries={bmCountries}
              filterCountries={bmFilterCountries}
              onFilterCountriesChange={setBmFilterCountries}
              leftOffsetClass={btn.offset}
            />
          );
        }
        return null;
      })}

      {/* Legend — only if enabled */}
      {features.tools.legende !== false && (
        <MapLegend
          activeLayers={activeLayers}
          markerCount={allMarkers.length}
        />
      )}

      {/* User coverage button — "Meine Abdeckung berechnen" (only if own_coverage enabled) */}
      {features.tools.own_coverage !== false && (
        <button
          onClick={() => setShowUserCoverageDialog(true)}
          className="fixed left-4 z-[1000] w-11 h-11 flex items-center justify-center rounded-lg shadow-lg border bg-white border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 175px)" }}
          title="Meine Abdeckung berechnen"
        >
          <Radio className="w-5 h-5 text-orange-500" />
        </button>
      )}

      {/* Fox/Hunting switch — only if fox_hunt enabled */}
      {features.tools.fox_hunt !== false && (
        <FoxHuntingSwitch mode={foxMode} onModeChange={setFoxMode} />
      )}

      {/* Loading indicator */}
      <RadioLoader isLoading={loading} onCancel={cancelLoading} message={loadingMessage} />

      {/* Preload hint */}
      <PreloadHint activeLayers={activeLayers} isLoading={loading} />

      {/* Viewport limit hint */}
      <ViewportLimitHint
        visibleCount={viewportLimit.visibleCount}
        maxRender={viewportLimit.maxRender}
        totalCount={viewportLimit.totalCount}
        onOpenLayers={() => setLayerMenuOpen(true)}
      />

      {/* Performance suggestion */}
      {showPerfSuggestion && !performanceMode && (
        <PerformanceSuggestionPopup
          onActivate={() => { setPerformanceMode(true); setShowPerfSuggestion(false); }}
          onDontAskAgain={() => { setShowPerfSuggestion(false); localStorage.setItem("hb9om_perf_suggestion_dismissed", "true"); }}
          onClose={() => setShowPerfSuggestion(false)}
        />
      )}

      {/* Heavy load confirmation dialog */}
      {pendingLayers && (
        <HeavyLoadConfirmDialog
          layers={pendingLayers}
          onConfirm={handleHeavyLoadConfirm}
          onCancel={handleHeavyLoadCancel}
        />
      )}

      {/* Offline area dialog */}
      {showOfflineDialog && (
        <OfflineAreaDialog
          mapRef={mapRef}
          baseLayer={baseLayer}
          baseTileUrl={tileConfig.url}
          tileKeyPrefix={tileConfig.tileKeyPrefix}
          referenceData={data}
          onClose={() => setShowOfflineDialog(false)}
          onDownloaded={() => setShowOfflineDialog(false)}
        />
      )}

      {/* Log entry form */}
      {showLogForm && (
        <LogEntryForm
          mapCenter={mapRef.current?.getCenter()?.lat ? [mapRef.current.getCenter().lat, mapRef.current.getCenter().lng] : null}
          myPosition={currentPosition}
          allMarkers={allMarkersUnfiltered}
          activeLayers={activeLayers}
          onClose={() => { setShowLogForm(false); setEditLogEntry(null); }}
          editEntry={editLogEntry}
        />
      )}

      {/* Change request dialog (marker position correction) */}
      {changeRequestMarker && (
        <ChangeRequestDialog
          marker={changeRequestMarker.marker}
          newPosition={changeRequestMarker.newPosition}
          onClose={() => setChangeRequestMarker(null)}
          onSubmit={() => setChangeRequestMarker(null)}
        />
      )}

      {/* Repeater link suggestion dialog */}
      {repeaterLinkSuggest && (
        <RepeaterLinkSuggestDialog
          fromRepeater={repeaterLinkSuggest}
          allRepeaters={repeaters}
          onClose={() => setRepeaterLinkSuggest(null)}
        />
      )}

      {/* Repeater correction dialog */}
      {repeaterCorrection && (
        <RepeaterCorrectionDialog
          repeater={repeaterCorrection}
          onClose={() => setRepeaterCorrection(null)}
        />
      )}

      {/* Neues QSO Button — Floating Action Button (only if qso_add enabled) */}
      {features.tools.qso_add !== false && (
        <button
          onClick={() => setShowLogForm(true)}
          className="fixed right-4 z-[1000] h-14 px-5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
          title="Neues QSO-Log erfassen"
        >
          <Plus className="w-6 h-6" />
          <span className="font-semibold text-sm whitespace-nowrap">Log QSO</span>
        </button>
      )}

      {/* Map click hint for coverage position — shown when mapClickForCoverage is active */}
      {mapClickForCoverage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2000] bg-orange-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 pointer-events-none">
          <MapPin className="w-5 h-5 animate-bounce" />
          <span className="text-sm font-semibold">Auf Karte klicken um Position zu setzen</span>
        </div>
      )}

      {/* Map click hint for setting position — shown when mapClickForPosition is active */}
      {mapClickForPosition && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2000] bg-blue-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 pointer-events-none">
          <MapPin className="w-5 h-5 animate-bounce" />
          <span className="text-sm font-semibold">Auf Karte klicken um Position zu setzen</span>
        </div>
      )}

      {/* User Coverage Dialog (MODUS B) — hidden when mapClickForCoverage is active */}
      {showUserCoverageDialog && !mapClickForCoverage && (
        <UserCoverageDialog
          onClose={() => { setShowUserCoverageDialog(false); setMapClickForCoverage(false); }}
          onCoverageResult={(result) => {
            if (!result) {
              setUserCoverage(null);
              setUserCoveragePosition(null);
            } else {
              setUserCoverage(result);
              setUserCoveragePosition(result._position || null);
              setUserCoverageDevice(result._device || "mobil");
            }
          }}
          mapCenter={mapRef.current?.getCenter()?.lat ? [mapRef.current.getCenter().lat, mapRef.current.getCenter().lng] : null}
          externalPosition={userCoveragePosition}
          onMapClickMode={() => setMapClickForCoverage(true)}
        />
      )}

      {/* Donation Popup — appears on view changes */}
      <DonationPopup triggerKey={donationTriggerKey} />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}