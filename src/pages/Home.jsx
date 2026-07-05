import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Popup, useMap, CircleMarker, WMSTileLayer, useMapEvents } from "react-leaflet";
import { base44 } from "@/api/base44Client";
import MapHeader from "@/components/map/MapHeader";
import LayerControl, { LAYER_GROUPS } from "@/components/map/LayerControl";
import MarkerPopup from "@/components/map/MarkerPopup";
import SearchResults from "@/components/map/SearchResults";
import SplashScreen from "@/components/map/SplashScreen";
import LogEntryForm from "@/components/map/LogEntryForm";
import { LIGHTHOUSE_DATA } from "@/data/lighthouses";
import { CASTLE_DATA } from "@/data/castles";
import { Loader2, Radio, Plus } from "lucide-react";

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

function MapBounds({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 13, { duration: 1 });
  }, [center, zoom]);
  return null;
}

function MapEventHandler({ onMove }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMove([c.lat, c.lng]);
    }
  });
  return null;
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeLayers, setActiveLayers] = useState(["sota"]);
  const [baseLayer, setBaseLayer] = useState("osm");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [flyTo, setFlyTo] = useState(null);
  const [flyZoom, setFlyZoom] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState({});
  const [mapCenter, setMapCenter] = useState([46.8182, 8.2275]);
  const [showQsoForm, setShowQsoForm] = useState(false);

  // API-loaded data
  const [sotaData, setSotaData] = useState([]);
  const [potaData, setPotaData] = useState([]);
  const [hbffData, setHbffData] = useState([]);
  const [wwbotaData, setWwbotaData] = useState([]);
  const [castleData, setCastleData] = useState([]);
  const [cacheLoaded, setCacheLoaded] = useState(false);

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
      .catch(() => {})
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
      castles.forEach(c => markers.push({ ...c, layerType: "castle", color: LAYER_COLORS.castle, layerLabel: "Burg/Schloss" }));
    }
    if (activeLayers.includes("iota")) {
      IOTA_DATA.forEach(i => markers.push({ ...i, layerType: "iota", color: LAYER_COLORS.iota, layerLabel: "IOTA" }));
    }
    if (activeLayers.includes("lighthouse")) {
      LIGHTHOUSE_DATA.forEach(l => markers.push({ ...l, layerType: "lighthouse", color: LAYER_COLORS.lighthouse, layerLabel: "Leuchtturm" }));
    }

    return markers;
  }, [activeLayers, sotaData, potaData, hbffData, wwbotaData, castleData]);

  // Search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = allMarkers.filter(m => {
      const name = (m.name || "").toLowerCase();
      const code = (m.code || m.reference || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    }).slice(0, 50);
    setSearchResults(results);
  }, [searchQuery, allMarkers]);

  const handleSelectResult = (item) => {
    setFlyTo([item.lat, item.lng]);
    setFlyZoom(14);
    setSearchResults([]);
    setSearchQuery("");
  };

  const isLoading = Object.values(loading).some(v => v);

  const baseTileUrl = baseLayer === "swisstopo"
    ? "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
    : baseLayer === "satellite"
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

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

      {isLoading && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1001] bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
          <span className="text-sm text-gray-600">Daten werden geladen...</span>
        </div>
      )}

      <div className="flex-1 mt-[52px] relative">
        <MapContainer
          center={[46.8182, 8.2275]}
          zoom={8}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer url={baseTileUrl} attribution={baseAttrib} maxZoom={19} />
          <MapEventHandler onMove={setMapCenter} />

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

          {allMarkers.map((m, idx) => (
            <React.Fragment key={`${m.layerType}-${m.code || m.reference || idx}`}>
              <CircleMarker
                center={[m.lat, m.lng]}
                radius={15}
                pathOptions={{
                  color: "transparent",
                  fillColor: "transparent",
                  fillOpacity: 0,
                  weight: 0
                }}
              >
                <Popup>
                  <MarkerPopup data={m} layerType={m.layerType} />
                </Popup>
              </CircleMarker>
              <CircleMarker
                center={[m.lat, m.lng]}
                radius={6}
                pathOptions={{
                  color: m.color,
                  fillColor: m.color,
                  fillOpacity: 0.8,
                  weight: 2
                }}
                interactive={false}
              />
            </React.Fragment>
          ))}

          {flyTo && <MapBounds center={flyTo} zoom={flyZoom} />}
        </MapContainer>

        <LayerControl
          activeLayers={activeLayers}
          onToggleLayer={toggleLayer}
          baseLayer={baseLayer}
          onChangeBaseLayer={setBaseLayer}
        />

        {/* New QSO floating button */}
        <button
          onClick={() => setShowQsoForm(true)}
          className="fixed bottom-5 right-3 z-[10001] bg-gray-900 text-white rounded-full shadow-2xl px-5 py-3 flex items-center gap-2 hover:bg-gray-800 transition-all hover:scale-105"
          title="Neues QSO erfassen"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Neues QSO</span>
        </button>

        {/* Stats bar */}
        <div className="absolute bottom-5 left-3 z-[1000] max-w-[calc(100%-5.5rem)] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 text-xs text-gray-600 flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-gray-900">{allMarkers.length}</span> Referenzen sichtbar
          {activeLayers.map(lid => {
            const lg = LAYER_GROUPS.find(g => g.id === lid);
            return lg ? (
              <span key={lid} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LAYER_COLORS[lid] }} />
                {lg.label.split("–")[0].trim()}
              </span>
            ) : null;
          })}
        </div>
      </div>

      {showQsoForm && (
        <LogEntryForm
          mapCenter={mapCenter}
          allMarkers={allMarkers}
          onClose={() => setShowQsoForm(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}