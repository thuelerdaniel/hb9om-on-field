import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createEntry, updateEntry } from "@/lib/localLogStore";
import { autoCloudBackup } from "@/lib/dataBackup";
import { uploadToWavelog } from "@/lib/wavelogSync";
import { X, Search, Loader2, MapPin, Plus, Radio, Pencil, Building, User, Check, Clock, Sun, Globe } from "lucide-react";
import MobileSelect from "@/components/ui/MobileSelect";
import ReferenceSearchInput from "@/components/log/ReferenceSearchInput";
import { CEPT_COUNTRIES, HOME_COUNTRY } from "@/lib/ceptCountries";
import { safeSetItem, safeGetItem } from "@/lib/safeStorage";

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function latLngToGrid(lat, lng) {
  const adjLng = lng + 180;
  const adjLat = lat + 90;
  const fieldLng = Math.floor(adjLng / 20);
  const fieldLat = Math.floor(adjLat / 10);
  const squareLng = Math.floor((adjLng % 20) / 2);
  const squareLat = Math.floor(adjLat % 10);
  return String.fromCharCode(65 + fieldLng) + String.fromCharCode(65 + fieldLat) + squareLng + squareLat;
}

const SUFFIXES = [
  { value: "", label: "—" },
  { value: "/P", label: "/P" },
  { value: "/M", label: "/M" },
  { value: "/AM", label: "/AM" },
  { value: "/MM", label: "/MM" },
  { value: "/QRP", label: "/QRP" },
  { value: "/A", label: "/A" },
];

const REF_TYPES = [
  { value: "sota", label: "SOTA" },
  { value: "pota", label: "POTA" },
  { value: "hbff", label: "WWFF" },
  { value: "wwbota", label: "WWBOTA" },
  { value: "castle", label: "Burg/Schloss" },
  { value: "iota", label: "IOTA" },
  { value: "lighthouse", label: "Leuchtturm" },
  { value: "repeater", label: "Relais" },
  { value: "tota", label: "TOTA" },
  { value: "aprs", label: "APRS-Station" },
  { value: "swiss_protected", label: "Bundesinventar" },
  { value: "generell", label: "Generell (nur Locator)" },
  { value: "custom", label: "Eigene Referenz" },
];

const BANDS = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "4m", "2m", "70cm", "23cm", "Other"];
const MODES = ["SSB", "CW", "FM", "FT8", "FT4", "PSK", "RTTY", "AM", "Other"];

const PERSIST_KEYS = {
  frequency: "hb9om_last_frequency",
  band: "hb9om_last_band",
  mode: "hb9om_last_mode",
  rstSent: "hb9om_last_rst_sent",
  rstReceived: "hb9om_last_rst_received",
  power: "hb9om_last_power",
  refType: "hb9om_last_ref_type",
  refCode: "hb9om_last_ref_code",
  refName: "hb9om_last_ref_name",
  callsignSuffix: "hb9om_last_callsign_suffix",
  mySuffix: "hb9om_last_my_suffix",
  isClubstation: "hb9om_last_is_clubstation",
  clubCallsign: "hb9om_last_club_callsign",
  clubOperatorCallsign: "hb9om_last_club_op_callsign",
  clubOperatorName: "hb9om_last_club_op_name",
  myGrid: "hb9om_last_my_grid",
  notes: "hb9om_last_notes",
  myCountryCode: "hb9om_last_my_country",
  myLicenseClass: "hb9om_last_my_license",
};

// Band <-> Frequency mapping (IARU Region 1)
const BAND_FREQ_RANGES = {
  "160m": [1.810, 2.000],
  "80m": [3.500, 3.800],
  "60m": [5.3515, 5.3665],
  "40m": [7.000, 7.200],
  "30m": [10.100, 10.150],
  "20m": [14.000, 14.350],
  "17m": [18.068, 18.168],
  "15m": [21.000, 21.450],
  "12m": [24.890, 24.990],
  "10m": [28.000, 29.700],
  "6m": [50.000, 52.000],
  "4m": [70.000, 70.500],
  "2m": [144.000, 146.000],
  "70cm": [430.000, 440.000],
  "23cm": [1240.000, 1300.000],
};

function freqToBand(freq) {
  const f = parseFloat(freq);
  if (!f || isNaN(f)) return null;
  for (const [band, [min, max]] of Object.entries(BAND_FREQ_RANGES)) {
    if (f >= min && f <= max) return band;
  }
  return null;
}

function bandToCenterFreq(band) {
  const range = BAND_FREQ_RANGES[band];
  if (!range) return null;
  return Math.round(((range[0] + range[1]) / 2) * 1000) / 1000;
}

export default function LogEntryForm({ mapCenter, myPosition, allMarkers, activeLayers, onClose, onSaved, editEntry }) {
  const isEditing = !!editEntry;
  const isOffline = typeof navigator !== "undefined" && (!navigator.onLine || safeGetItem("hb9om_force_offline") === "true");
  const [justSaved, setJustSaved] = useState(false);
  const [highContrast, setHighContrast] = useState(safeGetItem("hb9om_hc_mode") === "true");

  const toggleHighContrast = () => {
    const newVal = !highContrast;
    setHighContrast(newVal);
    safeSetItem("hb9om_hc_mode", String(newVal));
  };

  const [callsign, setCallsign] = useState(editEntry?.callsign || "");
  const [callsignSuffix, setCallsignSuffix] = useState(editEntry?.callsign_suffix ?? (safeGetItem(PERSIST_KEYS.callsignSuffix) || ""));
  const [qrzLoading, setQrzLoading] = useState(false);
  const [qrzError, setQrzError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [operator, setOperator] = useState({
    name: editEntry?.operator_name || "",
    address: editEntry?.operator_address || "",
    country: editEntry?.operator_country || "",
    grid: editEntry?.operator_grid || "",
    email: editEntry?.operator_email || ""
  });

  const today = new Date().toISOString().slice(0, 10);
  const nowUTC = new Date().toISOString().slice(11, 16);

  const [qsoDate, setQsoDate] = useState(editEntry?.qso_date || today);
  const [timeStart, setTimeStart] = useState(editEntry?.time_start || nowUTC);
  const [timeEnd, setTimeEnd] = useState(editEntry?.time_end || "");
  const [frequency, setFrequency] = useState(editEntry ? String(editEntry.frequency || "") : (safeGetItem(PERSIST_KEYS.frequency) || ""));
  const [band, setBand] = useState(editEntry?.band || (safeGetItem(PERSIST_KEYS.band) || "2m"));
  const [mode, setMode] = useState(editEntry?.mode || (safeGetItem(PERSIST_KEYS.mode) || "FM"));
  const [rstSent, setRstSent] = useState(editEntry?.rst_sent || (safeGetItem(PERSIST_KEYS.rstSent) || "59"));
  const [rstReceived, setRstReceived] = useState(editEntry?.rst_received || (safeGetItem(PERSIST_KEYS.rstReceived) || "59"));
  const [power, setPower] = useState(editEntry?.power != null ? String(editEntry.power) : (safeGetItem(PERSIST_KEYS.power) || ""));
  const [notes, setNotes] = useState(editEntry?.notes ?? (safeGetItem(PERSIST_KEYS.notes) || ""));
  const [saving, setSaving] = useState(false);

  const handleFrequencyChange = (val) => {
    setFrequency(val);
    const detectedBand = freqToBand(val);
    if (detectedBand && detectedBand !== band) {
      setBand(detectedBand);
    }
  };

  const handleBandChange = (newBand) => {
    setBand(newBand);
    const centerFreq = bandToCenterFreq(newBand);
    if (centerFreq) {
      setFrequency(String(centerFreq));
    }
  };

  const [isClubstation, setIsClubstation] = useState(editEntry?.is_clubstation ?? (safeGetItem(PERSIST_KEYS.isClubstation) === "true"));
  const [clubCallsign, setClubCallsign] = useState(editEntry?.club_callsign || (safeGetItem(PERSIST_KEYS.clubCallsign) || safeGetItem("hb9om_club_callsign") || ""));
  const [clubOperatorCallsign, setClubOperatorCallsign] = useState(editEntry?.club_operator_callsign || (safeGetItem(PERSIST_KEYS.clubOperatorCallsign) || safeGetItem("hb9om_my_callsign") || ""));
  const [clubOperatorName, setClubOperatorName] = useState(editEntry?.club_operator_name || safeGetItem("hb9om_club_operator_name") || "");

  const [refType, setRefType] = useState(editEntry?.my_reference_type || (activeLayers?.find(l => ["sota", "pota", "hbff", "wwbota", "castle", "iota", "lighthouse"].includes(l)) || safeGetItem(PERSIST_KEYS.refType) || "custom"));
  const [refCode, setRefCode] = useState(editEntry?.my_reference || (safeGetItem(PERSIST_KEYS.refCode) || ""));
  const [refName, setRefName] = useState(editEntry?.my_reference_name || (safeGetItem(PERSIST_KEYS.refName) || ""));
  // Lizenz/Kland/Suffix kommen aus den Einstellungen (nicht mehr pro-QSO wählbar)
  const [mySuffix, setMySuffix] = useState(editEntry?.my_suffix ?? (safeGetItem(PERSIST_KEYS.mySuffix) || safeGetItem("hb9om_my_suffix") || "/P"));
  const [myGrid, setMyGrid] = useState(editEntry?.my_grid || (safeGetItem(PERSIST_KEYS.myGrid) || ""));
  const [myCountryCode, setMyCountryCode] = useState(editEntry?.my_country_prefix || safeGetItem("hb9om_my_operating_country") || "");
  const [myLicenseClass, setMyLicenseClass] = useState(editEntry?.my_license_class || safeGetItem("hb9om_my_license_class") || "full");
  const [refCoords, setRefCoords] = useState(null);
  const [showRefDropdown, setShowRefDropdown] = useState(false);
  const wakeLockRef = useRef(null);
  const qrzInFlightRef = useRef(false);

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch (e) { }
    };
    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && wakeLockRef.current === null) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);



  const positionCenter = myPosition || mapCenter;

  const nearbyRefs = useMemo(() => {
    if (!positionCenter || !allMarkers || allMarkers.length === 0) return [];
    const [clat, clng] = positionCenter;
    let result = allMarkers
      .map(m => ({ ...m, distance: haversine(clat, clng, m.lat, m.lng) }))
      .filter(m => m.distance < 25);

    // Filter by selected reference type (except custom/generell where all are shown)
    if (refType && refType !== "custom" && refType !== "generell") {
      result = result.filter(m => m.layerType === refType);
    }

    return result
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);
  }, [positionCenter, allMarkers, refType]);

  useEffect(() => {
    if (nearbyRefs.length === 1 && nearbyRefs[0].distance < 2 && !refCode && !isEditing) {
      const r = nearbyRefs[0];
      setRefType(r.layerType || "custom");
      setRefCode(r.code || r.reference || "");
      setRefName(r.name || "");
    }
  }, [nearbyRefs]);

  // Pre-fill club callsign from settings (cached by ClubCallsignManager)
  useEffect(() => {
    if (isEditing) return;
    const cachedClubCall = safeGetItem("hb9om_club_callsign");
    if (cachedClubCall && !clubCallsign) {
      setClubCallsign(cachedClubCall);
    }
    // Try fetching from backend (admin only — non-admins use cached value)
    base44.functions.invoke("manageApiKeys", { action: "getClubCallsign" })
      .then(res => {
        const cc = res.data?.config?.club_callsign;
        if (cc) {
          safeSetItem("hb9om_club_callsign", cc);
          setClubCallsign(prev => prev || cc);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (refType === "generell" && positionCenter && !myGrid) {
      setMyGrid(latLngToGrid(positionCenter[0], positionCenter[1]));
    }
  }, [refType, positionCenter]);

  const handleQRZLookup = async () => {
    if (qrzInFlightRef.current) return;
    const qrzEnabled = safeGetItem("hb9om_qrz_enabled") !== "false";
    if (!qrzEnabled) return;
    if (!callsign || callsign.length < 3) return;
    if (isOffline) return;

    qrzInFlightRef.current = true;
    setQrzLoading(true);
    setQrzError("");
    try {
      const res = await base44.functions.invoke("fetchQRZ", {
        callsign: callsign.toUpperCase().trim()
      });
      if (res.data?.error) {
        setQrzError(res.data.error);
        base44.entities.QrzLookup.create({
          callsign: callsign.toUpperCase().trim(),
          lookup_status: "error",
          error_message: res.data.error
        }).then(() => trimQrzLog()).catch(() => {});
      } else if (res.data?.callsign) {
        const d = res.data;
        setOperator({
          name: d.name || "",
          address: d.address || "",
          country: d.country || "",
          grid: d.grid || "",
          email: d.email || ""
        });
        base44.entities.QrzLookup.create({
          callsign: d.callsign,
          name: d.name || "",
          address: d.address || "",
          country: d.country || "",
          grid: d.grid || "",
          email: d.email || "",
          lat: d.lat || null,
          lng: d.lng || null,
          lookup_status: "success"
        }).then(() => trimQrzLog()).catch(() => {});
      }
    } catch (e) {
      const detail = e?.response?.data?.error || e?.message || "unbekannt";
      setQrzError("QRZ.com Abfrage fehlgeschlagen: " + detail);
    } finally {
      qrzInFlightRef.current = false;
      setQrzLoading(false);
    }
  };

  const trimQrzLog = async () => {
    try {
      const entries = await base44.entities.QrzLookup.list("-created_date", 50);
      if (entries && entries.length > 10) {
        const toDelete = entries.slice(10);
        for (const e of toDelete) {
          await base44.entities.QrzLookup.delete(e.id);
        }
      }
    } catch (e) { }
  };

  const selectRef = (r) => {
    setRefType(r.layerType || "custom");
    setRefCode(r.code || r.reference || "");
    setRefName(r.name || "");
    setRefCoords(r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null);
    setShowRefDropdown(false);
  };

  // Clear refCode, refName and coords when reference type changes
  const handleRefTypeChange = (newType) => {
    setRefType(newType);
    setRefCode("");
    setRefName("");
    setRefCoords(null);
  };

  const persistFormValues = () => {
    safeSetItem(PERSIST_KEYS.frequency, frequency);
    safeSetItem(PERSIST_KEYS.band, band);
    safeSetItem(PERSIST_KEYS.mode, mode);
    safeSetItem(PERSIST_KEYS.rstSent, rstSent);
    safeSetItem(PERSIST_KEYS.rstReceived, rstReceived);
    safeSetItem(PERSIST_KEYS.power, power);
    safeSetItem(PERSIST_KEYS.refType, refType);
    safeSetItem(PERSIST_KEYS.refCode, refCode);
    safeSetItem(PERSIST_KEYS.refName, refName);
    safeSetItem(PERSIST_KEYS.callsignSuffix, callsignSuffix);
    safeSetItem(PERSIST_KEYS.mySuffix, mySuffix);
    safeSetItem(PERSIST_KEYS.isClubstation, isClubstation ? "true" : "false");
    safeSetItem(PERSIST_KEYS.clubCallsign, clubCallsign);
    safeSetItem(PERSIST_KEYS.clubOperatorCallsign, clubOperatorCallsign);
    safeSetItem(PERSIST_KEYS.clubOperatorName, clubOperatorName);
    safeSetItem(PERSIST_KEYS.myGrid, myGrid);
    safeSetItem(PERSIST_KEYS.notes, notes);
    // Lizenz/Kland kommen aus Einstellungen — nicht mehr pro-QSO persistieren
  };

  const handleSave = async () => {
    if (!callsign || !qsoDate || !frequency) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        callsign: callsign.toUpperCase().trim(),
        callsign_suffix: callsignSuffix,
        qso_date: qsoDate,
        time_start: timeStart,
        time_end: timeEnd,
        frequency: parseFloat(frequency),
        band,
        mode,
        rst_sent: rstSent,
        rst_received: rstReceived,
        power: power ? parseFloat(power) : null,
        operator_name: operator.name,
        operator_address: operator.address,
        operator_country: operator.country,
        operator_grid: operator.grid,
        operator_email: operator.email,
        is_clubstation: isClubstation,
        club_callsign: isClubstation ? clubCallsign.toUpperCase().trim() : "",
        club_operator_callsign: isClubstation ? clubOperatorCallsign.toUpperCase().trim() : "",
        club_operator_name: isClubstation ? clubOperatorName : "",
        my_reference: refType === "generell" ? "" : refCode,
        my_reference_type: refType,
        my_reference_name: refType === "generell" ? "" : refName,
        my_suffix: mySuffix,
        my_country_prefix: myCountryCode || "",
        my_country_name: myCountryCode ? (CEPT_COUNTRIES.find(c => c.code === myCountryCode)?.name || "") : "",
        my_license_class: myCountryCode ? myLicenseClass : "",
        my_grid: refType === "generell" ? myGrid : "",
        notes,
        status: editEntry?.status || "active"
      };

      if (isEditing) {
        await updateEntry(editEntry.id, payload);
        if (onSaved) onSaved();
        if (onClose) onClose();
      } else {
        await createEntry(payload);
        persistFormValues();
        if (onSaved) onSaved();
        // Trigger auto cloud backup if enabled
        autoCloudBackup();
        // Wavelog Auto-Sync: Wenn logging_backend = "wavelog" und auto_sync aktiv,
        // QSOs nach kurzem Delay (Server-Sync) an Wavelog senden
        if (navigator.onLine) {
          try {
            const hs = await base44.entities.UserHuntingSettings.list();
            if (hs && hs.length > 0) {
              const s = hs[0];
              if (s.wavelog_enabled && s.logging_backend === "wavelog" && s.wavelog_auto_sync) {
                setTimeout(() => {
                  uploadToWavelog({
                    wavelog_enabled: s.wavelog_enabled,
                    wavelog_lan_url: s.wavelog_lan_url,
                    wavelog_wan_url: s.wavelog_wan_url,
                    wavelog_api_key: s.wavelog_api_key,
                    wavelog_station_id: s.wavelog_station_id,
                  }).catch(e => console.warn("[Wavelog] Auto-sync failed:", e));
                }, 1500);
              }
            }
          } catch (e) { /* silent */ }
        }
        // Reset for next QSO but keep persistent values (freq, band, mode, etc.)
        setCallsign("");
        setCallsignSuffix(safeGetItem(PERSIST_KEYS.callsignSuffix) || "");
        setOperator({ name: "", address: "", country: "", grid: "", email: "" });
        setQrzError("");
        setSaveError("");
        setNotes(safeGetItem(PERSIST_KEYS.notes) || "");
        const now = new Date();
        setQsoDate(now.toISOString().slice(0, 10));
        setTimeStart(now.toISOString().slice(11, 16));
        setTimeEnd("");
        setRstSent(safeGetItem(PERSIST_KEYS.rstSent) || "59");
        setRstReceived(safeGetItem(PERSIST_KEYS.rstReceived) || "59");
        setPower(safeGetItem(PERSIST_KEYS.power) || "");
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      }
    } catch (e) {
      setSaveError("Fehler beim Speichern: " + (e.message || "unbekannt"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-3 pb-20">
      <div
        className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-6rem)] overflow-y-auto ${highContrast ? 'hc-mode' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl">
          <div className="flex items-center gap-2">
            {isEditing ? <Pencil className="w-5 h-5 text-gray-700" /> : <Radio className="w-5 h-5 text-gray-700" />}
            <h2 className="font-bold text-gray-900 dark:text-slate-100">{isEditing ? "QSO bearbeiten" : "Neues QSO-Log"}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleHighContrast}
              className={`p-1.5 rounded-lg border flex items-center gap-1 font-medium shadow-sm ${highContrast ? 'hc-primary border-yellow-400' : 'border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-800'}`}
              title={highContrast ? "Normaler Modus" : "Hoher Kontrast (Sonnenmodus)"}
            >
              <Sun className="w-4 h-4" />
              <span className="text-xs font-medium pr-0.5"> Sonne</span>
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-1.5">
          {/* Allgemeine */}
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1">Allgemeine</h3>

          {/* QSO Partner */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rufzeichen (QSO-Partner)</label>
            <div className="flex gap-1.5 mt-1">
              <input
                type="text"
                value={callsign}
                onChange={e => setCallsign(e.target.value)}
                onBlur={handleQRZLookup}
                onKeyDown={e => e.key === "Enter" && handleQRZLookup()}
                placeholder="z.B. HB9XYZ"
                className="flex-1 min-w-0 px-2.5 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
              />
              <MobileSelect
                value={callsignSuffix}
                onValueChange={setCallsignSuffix}
                triggerClassName="px-1.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9 w-12 flex-shrink-0"
                options={SUFFIXES.map(s => ({ value: s.value, label: s.value || "—" }))}
              />
              <button
                onClick={handleQRZLookup}
                disabled={qrzLoading || !callsign || isOffline}
                className="px-2.5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
                title={isOffline ? "QRZ-Abfrage nur online möglich" : "QRZ.com abfragen"}
              >
                {qrzLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                QRZ
              </button>
            </div>
            {isOffline && <p className="text-xs text-amber-600 mt-1">⚠ QRZ-Abfrage nur online möglich – Operator-Daten manuell eingeben</p>}
            {qrzError && <p className="text-xs text-amber-600 mt-1">{qrzError}</p>}
            {operator.name && (
              <div className="mt-1 p-1.5 bg-blue-50 rounded text-[11px] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium text-gray-900">{operator.name}</span>
                {operator.address && <span className="text-gray-500 truncate max-w-[140px]">{operator.address}</span>}
                {operator.country && <span className="text-gray-500">{operator.country}</span>}
                {operator.grid && <span className="text-gray-500 font-mono">{operator.grid}</span>}
                {operator.email && <a href={`mailto:${operator.email}`} className="text-blue-600 hover:underline truncate max-w-[100px]">{operator.email}</a>}
                <span className="text-blue-500">✓ QRZ</span>
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Datum</label>
              <input type="date" value={qsoDate} onChange={e => setQsoDate(e.target.value)} className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Startzeit UTC</label>
              <div className="flex gap-1.5 mt-1">
                <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} className="flex-1 min-w-0 px-2 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button
                  type="button"
                  onClick={() => setTimeStart(new Date().toISOString().slice(11, 16))}
                  className="px-2.5 py-2 text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center justify-center flex-shrink-0"
                  title="Auf aktuelle UTC-Zeit setzen"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Endzeit UTC</label>
              <div className="flex gap-1.5 mt-1">
                <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} className="flex-1 min-w-0 px-2 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button
                  type="button"
                  onClick={() => setTimeEnd(new Date().toISOString().slice(11, 16))}
                  className="px-2.5 py-2 text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center justify-center flex-shrink-0"
                  title="Auf aktuelle UTC-Zeit setzen"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Frequenz (MHz)</label>
              <input type="number" step="0.001" value={frequency} onChange={e => handleFrequencyChange(e.target.value)} placeholder="z.B. 144.500" className="w-full mt-1 px-2 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* RST */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">RST gesendet</label>
              <input type="text" value={rstSent} onChange={e => setRstSent(e.target.value)} className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">RST erhalten</label>
              <input type="text" value={rstReceived} onChange={e => setRstReceived(e.target.value)} className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Band</label>
              <MobileSelect
                value={band}
                onValueChange={handleBandChange}
                triggerClassName="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
                options={BANDS.map(b => ({ value: b, label: b }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Mode</label>
              <MobileSelect
                value={mode}
                onValueChange={setMode}
                triggerClassName="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
                options={MODES.map(m => ({ value: m, label: m }))}
              />
            </div>
          </div>

          {/* Power */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Sendeleistung (Watt)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={power}
              onChange={e => setPower(e.target.value)}
              placeholder="z.B. 5"
              className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Clubstation toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isClubstation}
              onChange={e => setIsClubstation(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
            />
            <span className="text-sm text-gray-700 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" /> Clubstation – abweichendes Stations-Rufzeichen
            </span>
          </label>

          {/* Read-only Praefix-Anzeige — Werte aus Einstellungen, gilt für beide Calls */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div className="text-xs min-w-0">
                  <span className="text-gray-500 dark:text-slate-400">Funke aus: </span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    {myCountryCode
                      ? `${(CEPT_COUNTRIES.find(c => c.code === myCountryCode)?.flag || "")} ${CEPT_COUNTRIES.find(c => c.code === myCountryCode)?.name || ""} (${CEPT_COUNTRIES.find(c => c.code === myCountryCode)?.prefix || ""})`
                      : `${HOME_COUNTRY.flag} ${HOME_COUNTRY.name}`}
                  </span>
                  <span className="text-gray-400 ml-1">· {myLicenseClass === "full" ? "Full" : "Novice"}</span>
                </div>
              </div>
              <Link to="/settings" onClick={onClose} className="text-xs text-blue-600 hover:underline flex-shrink-0 font-medium">
                → Ändern
              </Link>
            </div>
            <div className="mt-2 space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Personal:</span>
                <span className="font-mono font-bold text-gray-900 dark:text-slate-100">
                  {`${myCountryCode ? (CEPT_COUNTRIES.find(c => c.code === myCountryCode)?.prefix || "") : ""}${safeGetItem("hb9om_my_callsign") || ""}${mySuffix || ""}`}
                </span>
              </div>
              {isClubstation && clubCallsign && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Club:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-slate-100">
                    {`${myCountryCode ? (CEPT_COUNTRIES.find(c => c.code === myCountryCode)?.prefix || "") : ""}${clubCallsign.toUpperCase()}${mySuffix || ""}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Standort / Referenz */}
          <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Mein Standort / Referenz
              </label>
              {nearbyRefs.length > 0 && (
                <button
                  onClick={() => setShowRefDropdown(!showRefDropdown)}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  {nearbyRefs.length} Referenz{nearbyRefs.length !== 1 ? 'en' : ''} in der Nähe
                </button>
              )}
            </div>

            {showRefDropdown && nearbyRefs.length > 0 && (
              <div className="mb-2 max-h-40 overflow-y-auto bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
                {nearbyRefs.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectRef(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-xs"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                    <span className="font-mono font-semibold text-gray-900">{r.code || r.reference}</span>
                    <span className="flex-1 truncate text-gray-500">{r.name}</span>
                    <span className="text-gray-400">{r.distance.toFixed(1)} km</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <MobileSelect
                value={refType}
                onValueChange={handleRefTypeChange}
                triggerClassName="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
                options={REF_TYPES.map(t => ({ value: t.value, label: t.label }))}
              />
              <MobileSelect
                value={mySuffix}
                onValueChange={setMySuffix}
                triggerClassName="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
                options={SUFFIXES.map(s => ({ value: s.value, label: s.value || "Suffix" }))}
              />
            </div>

            {/* Dediziertes Such-Eingabefeld mit Autovervollstaendigung */}
            {refType !== "generell" && refType !== "custom" && (
              <ReferenceSearchInput
                refType={refType}
                allMarkers={allMarkers}
                mapCenter={mapCenter}
                myPosition={myPosition}
                onSelect={selectRef}
                isOffline={isOffline}
              />
            )}

            {refType === "generell" ? (
              <div className="mt-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Mein Locator (Maidenhead)</label>
                <input
                  type="text"
                  value={myGrid}
                  onChange={e => setMyGrid(e.target.value.toUpperCase())}
                  placeholder="z.B. JN36"
                  maxLength={8}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
                />
                <p className="text-[10px] text-gray-400 mt-1">Standard 4 Stellen – auf 6 Stellen erweiterbar</p>
              </div>
            ) : (
              <>
                {/* refCode — wird durch Suche ausgefüllt, manuell editierbar */}
                <div className="mt-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Referenz-Code</label>
                  <input
                    type="text"
                    value={refCode}
                    onChange={e => setRefCode(e.target.value)}
                    placeholder="z.B. HB/AG-001"
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                {/* refName — wird durch Suche ausgefüllt, manuell editierbar */}
                <div className="mt-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Referenz-Name</label>
                  <input
                    type="text"
                    value={refName}
                    onChange={e => setRefName(e.target.value)}
                    placeholder="Name der Referenz"
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                {/* Koordinaten-Anzeige bei ausgewaehlter Referenz */}
                {refCoords && (
                  <div className="mt-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-950/30 rounded-lg text-xs text-green-700 dark:text-green-300 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span>📍 {refCoords.lat.toFixed(4)}, {refCoords.lng.toFixed(4)}</span>
                    {refCoords.lat != null && refCoords.lng != null && (
                      <span className="text-[10px] text-green-600 dark:text-green-400 ml-1">
                        (Locator: {latLngToGrid(refCoords.lat, refCoords.lng)})
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
            {mapCenter && (
              <p className="text-[10px] text-gray-400 mt-1.5">
                📍 Karte zentriert auf: {mapCenter[0].toFixed(4)}, {mapCenter[1].toFixed(4)}
              </p>
            )}
          </div>

          {/* Notizen */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Notizen</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Notizen für dieses & nächste QSO (wird übernommen)..."
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>

          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-gray-100 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800 rounded-b-2xl">
          <button
            onClick={handleSave}
            disabled={saving || !callsign || !frequency}
            className={`w-full px-3 py-2.5 text-xs sm:text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-1.5 ${highContrast ? 'hc-primary' : ''}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : justSaved ? <Check className="w-4 h-4" /> : isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isEditing ? "Aktualisieren" : justSaved ? "Gespeichert!" : "QSO speichern & weiter"}
          </button>
        </div>
      </div>

    </div>
  );
}