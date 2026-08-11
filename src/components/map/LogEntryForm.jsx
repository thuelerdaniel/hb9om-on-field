import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { createEntry, updateEntry } from "@/lib/localLogStore";
import { autoCloudBackup } from "@/lib/dataBackup";
import { X, Search, Loader2, MapPin, Plus, Radio, Pencil, Building, User, Check, Clock, Sun } from "lucide-react";
import MobileSelect from "@/components/ui/MobileSelect";

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
];

const REF_TYPES = [
  { value: "sota", label: "SOTA" },
  { value: "pota", label: "POTA" },
  { value: "hbff", label: "HBFF" },
  { value: "wwbota", label: "WWBOTA" },
  { value: "castle", label: "Burg/Schloss" },
  { value: "iota", label: "IOTA" },
  { value: "lighthouse", label: "Leuchtturm" },
  { value: "repeater", label: "Relais" },
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
  const isOffline = typeof navigator !== "undefined" && (!navigator.onLine || localStorage.getItem("hb9om_force_offline") === "true");
  const [justSaved, setJustSaved] = useState(false);
  const [highContrast, setHighContrast] = useState(localStorage.getItem("hb9om_hc_mode") === "true");

  const toggleHighContrast = () => {
    const newVal = !highContrast;
    setHighContrast(newVal);
    localStorage.setItem("hb9om_hc_mode", String(newVal));
  };

  const [callsign, setCallsign] = useState(editEntry?.callsign || "");
  const [callsignSuffix, setCallsignSuffix] = useState(editEntry?.callsign_suffix ?? (localStorage.getItem(PERSIST_KEYS.callsignSuffix) || ""));
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
  const [frequency, setFrequency] = useState(editEntry ? String(editEntry.frequency || "") : (localStorage.getItem(PERSIST_KEYS.frequency) || ""));
  const [band, setBand] = useState(editEntry?.band || (localStorage.getItem(PERSIST_KEYS.band) || "2m"));
  const [mode, setMode] = useState(editEntry?.mode || (localStorage.getItem(PERSIST_KEYS.mode) || "FM"));
  const [rstSent, setRstSent] = useState(editEntry?.rst_sent || (localStorage.getItem(PERSIST_KEYS.rstSent) || "59"));
  const [rstReceived, setRstReceived] = useState(editEntry?.rst_received || (localStorage.getItem(PERSIST_KEYS.rstReceived) || "59"));
  const [power, setPower] = useState(editEntry?.power != null ? String(editEntry.power) : (localStorage.getItem(PERSIST_KEYS.power) || ""));
  const [notes, setNotes] = useState(editEntry?.notes ?? (localStorage.getItem(PERSIST_KEYS.notes) || ""));
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

  const [isClubstation, setIsClubstation] = useState(editEntry?.is_clubstation ?? (localStorage.getItem(PERSIST_KEYS.isClubstation) === "true"));
  const [clubCallsign, setClubCallsign] = useState(editEntry?.club_callsign || (localStorage.getItem(PERSIST_KEYS.clubCallsign) || ""));
  const [clubOperatorCallsign, setClubOperatorCallsign] = useState(editEntry?.club_operator_callsign || (localStorage.getItem(PERSIST_KEYS.clubOperatorCallsign) || localStorage.getItem("hb9om_my_callsign") || ""));
  const [clubOperatorName, setClubOperatorName] = useState(editEntry?.club_operator_name || (localStorage.getItem(PERSIST_KEYS.clubOperatorName) || ""));
  const [showClubPopup, setShowClubPopup] = useState(false);

  const [refType, setRefType] = useState(editEntry?.my_reference_type || (activeLayers?.find(l => ["sota", "pota", "hbff", "wwbota", "castle", "iota", "lighthouse"].includes(l)) || localStorage.getItem(PERSIST_KEYS.refType) || "custom"));
  const [refCode, setRefCode] = useState(editEntry?.my_reference || (localStorage.getItem(PERSIST_KEYS.refCode) || ""));
  const [refName, setRefName] = useState(editEntry?.my_reference_name || (localStorage.getItem(PERSIST_KEYS.refName) || ""));
  const [mySuffix, setMySuffix] = useState(editEntry?.my_suffix ?? (localStorage.getItem(PERSIST_KEYS.mySuffix) || ""));
  const [myGrid, setMyGrid] = useState(editEntry?.my_grid || (localStorage.getItem(PERSIST_KEYS.myGrid) || ""));
  const [showRefDropdown, setShowRefDropdown] = useState(false);
  const [showRefCodeDropdown, setShowRefCodeDropdown] = useState(false);
  const [showRefNameDropdown, setShowRefNameDropdown] = useState(false);
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

  useEffect(() => {
    if (refType === "generell" && positionCenter && !myGrid) {
      setMyGrid(latLngToGrid(positionCenter[0], positionCenter[1]));
    }
  }, [refType, positionCenter]);

  const handleQRZLookup = async () => {
    if (qrzInFlightRef.current) return;
    const qrzEnabled = localStorage.getItem("hb9om_qrz_enabled") !== "false";
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
    setShowRefDropdown(false);
    setShowRefCodeDropdown(false);
    setShowRefNameDropdown(false);
  };

  // Clear refCode and refName when reference type changes — user is starting a new reference selection
  const handleRefTypeChange = (newType) => {
    setRefType(newType);
    setRefCode("");
    setRefName("");
    setShowRefCodeDropdown(false);
    setShowRefNameDropdown(false);
  };

  // Debounced search terms — prevents filtering 180k+ markers on every keystroke
  const [debouncedRefCode, setDebouncedRefCode] = useState("");
  const [debouncedRefName, setDebouncedRefName] = useState("");
  const refCodeDebounceRef = useRef(null);
  const refNameDebounceRef = useRef(null);

  useEffect(() => {
    if (refCodeDebounceRef.current) clearTimeout(refCodeDebounceRef.current);
    refCodeDebounceRef.current = setTimeout(() => setDebouncedRefCode(refCode), 180);
    return () => { if (refCodeDebounceRef.current) clearTimeout(refCodeDebounceRef.current); };
  }, [refCode]);

  useEffect(() => {
    if (refNameDebounceRef.current) clearTimeout(refNameDebounceRef.current);
    refNameDebounceRef.current = setTimeout(() => setDebouncedRefName(refName), 180);
    return () => { if (refNameDebounceRef.current) clearTimeout(refNameDebounceRef.current); };
  }, [refName]);

  // Inline autocomplete for refCode — filter ALL available markers by code, narrowed to selected refType
  const refCodeMatches = useMemo(() => {
    if (!debouncedRefCode || debouncedRefCode.length < 2) return [];
    const q = debouncedRefCode.toLowerCase();
    let result = allMarkers.filter(m => {
      const code = (m.code || m.reference || "").toLowerCase();
      return code.includes(q);
    });
    if (refType && refType !== "custom" && refType !== "generell") {
      result = result.filter(m => m.layerType === refType);
    }
    return result.slice(0, 50);
  }, [debouncedRefCode, allMarkers, refType]);

  // Inline autocomplete for refName — filter ALL available markers by name, narrowed to selected refType
  const refNameMatches = useMemo(() => {
    if (!debouncedRefName || debouncedRefName.length < 2) return [];
    const q = debouncedRefName.toLowerCase();
    let result = allMarkers.filter(m => {
      const name = (m.name || "").toLowerCase();
      return name.includes(q);
    });
    if (refType && refType !== "custom" && refType !== "generell") {
      result = result.filter(m => m.layerType === refType);
    }
    return result.slice(0, 50);
  }, [debouncedRefName, allMarkers, refType]);

  // Server-side search: finds references NOT yet loaded in allMarkers (worldwide, not bounds-limited).
  // Two INDEPENDENT searches (code + name) — each field gets its own results, so typing in one
  // field is never shadowed by a longer value in the other.
  const flattenServerRefs = (references) => {
    const colorMap = {
      sota: "#e74c3c", pota: "#27ae60", hbff: "#8e44ad", wwbota: "#795548",
      castle: "#e67e22", iota: "#3498db", lighthouse: "#f39c12", repeater: "#3b82f6"
    };
    const labelMap = {
      sota: "SOTA", pota: "POTA", hbff: "HBFF", wwbota: "WWBOTA",
      castle: "Burg/Schloss", iota: "IOTA", lighthouse: "Leuchtturm", repeater: "Relais"
    };
    const matches = [];
    for (const [type, refs] of Object.entries(references || {})) {
      for (const r of (refs || [])) {
        matches.push({
          ...r,
          code: r.code || r.reference,
          reference: r.reference || r.code,
          layerType: type,
          color: colorMap[type] || "#888",
          layerLabel: labelMap[type] || type
        });
      }
    }
    return matches;
  };

  const runServerSearch = useCallback(async (query, typesFilter, center) => {
    const res = await base44.functions.invoke("searchReferences", {
      query,
      types: typesFilter,
      center
    });
    return res.data?.references ? flattenServerRefs(res.data.references).slice(0, 50) : [];
  }, []);

  // --- Server search for refCode ---
  const [serverRefCodeMatches, setServerRefCodeMatches] = useState([]);
  const serverCodeSearchRef = useRef(null);
  const lastServerCodeQueryRef = useRef("");

  useEffect(() => {
    if (!debouncedRefCode || debouncedRefCode.length < 2) {
      setServerRefCodeMatches([]);
      lastServerCodeQueryRef.current = "";
      return;
    }
    if (isOffline) return;
    if (serverCodeSearchRef.current) clearTimeout(serverCodeSearchRef.current);
    serverCodeSearchRef.current = setTimeout(async () => {
      if (lastServerCodeQueryRef.current === debouncedRefCode) return;
      lastServerCodeQueryRef.current = debouncedRefCode;
      try {
        const center = positionCenter ? { lat: positionCenter[0], lng: positionCenter[1] } : (mapCenter ? { lat: mapCenter[0], lng: mapCenter[1] } : null);
        const typesFilter = refType && refType !== "custom" && refType !== "generell" ? [refType] : null;
        const matches = await runServerSearch(debouncedRefCode, typesFilter, center);
        setServerRefCodeMatches(matches);
      } catch (e) { /* silent */ }
    }, 400);
    return () => { if (serverCodeSearchRef.current) clearTimeout(serverCodeSearchRef.current); };
  }, [debouncedRefCode, refType, positionCenter, mapCenter, isOffline, runServerSearch]);

  // --- Server search for refName ---
  const [serverRefNameMatches, setServerRefNameMatches] = useState([]);
  const serverNameSearchRef = useRef(null);
  const lastServerNameQueryRef = useRef("");

  useEffect(() => {
    if (!debouncedRefName || debouncedRefName.length < 2) {
      setServerRefNameMatches([]);
      lastServerNameQueryRef.current = "";
      return;
    }
    if (isOffline) return;
    if (serverNameSearchRef.current) clearTimeout(serverNameSearchRef.current);
    serverNameSearchRef.current = setTimeout(async () => {
      if (lastServerNameQueryRef.current === debouncedRefName) return;
      lastServerNameQueryRef.current = debouncedRefName;
      try {
        const center = positionCenter ? { lat: positionCenter[0], lng: positionCenter[1] } : (mapCenter ? { lat: mapCenter[0], lng: mapCenter[1] } : null);
        const typesFilter = refType && refType !== "custom" && refType !== "generell" ? [refType] : null;
        const matches = await runServerSearch(debouncedRefName, typesFilter, center);
        setServerRefNameMatches(matches);
      } catch (e) { /* silent */ }
    }, 400);
    return () => { if (serverNameSearchRef.current) clearTimeout(serverNameSearchRef.current); };
  }, [debouncedRefName, refType, positionCenter, mapCenter, isOffline, runServerSearch]);

  // Merge local + server matches for refCode (dedup by code, server fills gaps not in allMarkers)
  const mergedRefCodeMatches = useMemo(() => {
    const local = refCodeMatches;
    if (serverRefCodeMatches.length === 0) return local;
    const localCodes = new Set(local.map(m => (m.code || m.reference || "").toLowerCase()));
    const serverOnly = serverRefCodeMatches.filter(m => {
      const code = (m.code || m.reference || "").toLowerCase();
      return code.includes(debouncedRefCode.toLowerCase()) && !localCodes.has(code);
    });
    return [...local, ...serverOnly].slice(0, 50);
  }, [refCodeMatches, serverRefCodeMatches, debouncedRefCode]);

  // Merge local + server matches for refName (dedup by code, server fills gaps not in allMarkers)
  const mergedRefNameMatches = useMemo(() => {
    const local = refNameMatches;
    if (serverRefNameMatches.length === 0) return local;
    const localCodes = new Set(local.map(m => (m.code || m.reference || "").toLowerCase()));
    const q = debouncedRefName.toLowerCase();
    const serverOnly = serverRefNameMatches.filter(m => {
      const name = (m.name || "").toLowerCase();
      return name.includes(q) && !localCodes.has((m.code || m.reference || "").toLowerCase());
    });
    return [...local, ...serverOnly].slice(0, 50);
  }, [refNameMatches, serverRefNameMatches, debouncedRefName]);

  const persistFormValues = () => {
    localStorage.setItem(PERSIST_KEYS.frequency, frequency);
    localStorage.setItem(PERSIST_KEYS.band, band);
    localStorage.setItem(PERSIST_KEYS.mode, mode);
    localStorage.setItem(PERSIST_KEYS.rstSent, rstSent);
    localStorage.setItem(PERSIST_KEYS.rstReceived, rstReceived);
    localStorage.setItem(PERSIST_KEYS.power, power);
    localStorage.setItem(PERSIST_KEYS.refType, refType);
    localStorage.setItem(PERSIST_KEYS.refCode, refCode);
    localStorage.setItem(PERSIST_KEYS.refName, refName);
    localStorage.setItem(PERSIST_KEYS.callsignSuffix, callsignSuffix);
    localStorage.setItem(PERSIST_KEYS.mySuffix, mySuffix);
    localStorage.setItem(PERSIST_KEYS.isClubstation, isClubstation ? "true" : "false");
    localStorage.setItem(PERSIST_KEYS.clubCallsign, clubCallsign);
    localStorage.setItem(PERSIST_KEYS.clubOperatorCallsign, clubOperatorCallsign);
    localStorage.setItem(PERSIST_KEYS.clubOperatorName, clubOperatorName);
    localStorage.setItem(PERSIST_KEYS.myGrid, myGrid);
    localStorage.setItem(PERSIST_KEYS.notes, notes);
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
        // Reset for next QSO but keep persistent values (freq, band, mode, etc.)
        setCallsign("");
        setCallsignSuffix(localStorage.getItem(PERSIST_KEYS.callsignSuffix) || "");
        setOperator({ name: "", address: "", country: "", grid: "", email: "" });
        setQrzError("");
        setSaveError("");
        setNotes(localStorage.getItem(PERSIST_KEYS.notes) || "");
        const now = new Date();
        setQsoDate(now.toISOString().slice(0, 10));
        setTimeStart(now.toISOString().slice(11, 16));
        setTimeEnd("");
        setRstSent(localStorage.getItem(PERSIST_KEYS.rstSent) || "59");
        setRstReceived(localStorage.getItem(PERSIST_KEYS.rstReceived) || "59");
        setPower(localStorage.getItem(PERSIST_KEYS.power) || "");
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      }
    } catch (e) {
      setSaveError("Fehler beim Speichern: " + (e.message || "unbekannt"));
    } finally {
      setSaving(false);
    }
  };

  const handleClubPopupConfirm = () => {
    if (!clubCallsign || clubCallsign.length < 3) return;
    setShowClubPopup(false);
  };

  const handleClubPopupClose = () => {
    if (!clubCallsign) setIsClubstation(false);
    setShowClubPopup(false);
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

        <div className="p-4 space-y-2">
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
              <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs space-y-0.5">
                <p className="font-medium text-gray-900">{operator.name}</p>
                {operator.address && <p className="text-gray-600">{operator.address}</p>}
                <div className="flex gap-3 flex-wrap">
                  {operator.country && <span className="text-gray-500">{operator.country}</span>}
                  {operator.grid && <span className="text-gray-500 font-mono">Grid: {operator.grid}</span>}
                  {operator.email && <span className="text-gray-500">{operator.email}</span>}
                </div>
                <p className="text-blue-500 mt-1">✓ Daten von QRZ.com übernommen</p>
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
              onChange={e => {
                const checked = e.target.checked;
                setIsClubstation(checked);
                if (checked && !clubCallsign) {
                  setShowClubPopup(true);
                }
              }}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
            />
            <span className="text-sm text-gray-700 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" /> Clubstation – abweichendes Stations-Rufzeichen
            </span>
          </label>

          {/* Clubstation summary (when active and popup closed) */}
          {isClubstation && clubCallsign && !showClubPopup && (
            <div className="p-3 bg-blue-50 rounded-lg flex items-center justify-between">
              <div className="text-xs space-y-0.5">
                <p className="font-mono font-bold text-gray-900">{clubCallsign.toUpperCase()}</p>
                {clubOperatorCallsign && <p className="text-gray-600">Operator: {clubOperatorCallsign.toUpperCase()}{clubOperatorName && ` · ${clubOperatorName}`}</p>}
              </div>
              <button
                onClick={() => setShowClubPopup(true)}
                className="p-1.5 hover:bg-white rounded-lg text-blue-600"
                title="Bearbeiten"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
                {/* refCode with inline autocomplete dropdown */}
                <div className="relative mt-2">
                  <input
                    type="text"
                    value={refCode}
                    onChange={e => {
                      setRefCode(e.target.value);
                      setShowRefCodeDropdown(e.target.value.length >= 2);
                    }}
                    onFocus={() => refCode.length >= 2 && setShowRefCodeDropdown(true)}
                    onBlur={() => setTimeout(() => setShowRefCodeDropdown(false), 200)}
                    placeholder="Referenz-Code (z.B. HB/AG-001)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  {showRefCodeDropdown && mergedRefCodeMatches.length > 0 && (
                    <div className="mt-1 max-h-60 overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-50">
                      {mergedRefCodeMatches.map((r, i) => (
                        <button
                          key={i}
                          onMouseDown={(e) => { e.preventDefault(); selectRef(r); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left text-xs"
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                          <span className="font-mono font-semibold text-gray-900">{r.code || r.reference}</span>
                          <span className="flex-1 truncate text-gray-500">{r.name}</span>
                          <span className="text-gray-400 capitalize">{r.layerLabel || r.layerType}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* refName with inline autocomplete dropdown */}
                <div className="relative mt-2">
                  <input
                    type="text"
                    value={refName}
                    onChange={e => {
                      setRefName(e.target.value);
                      setShowRefNameDropdown(e.target.value.length >= 2);
                    }}
                    onFocus={() => refName.length >= 2 && setShowRefNameDropdown(true)}
                    onBlur={() => setTimeout(() => setShowRefNameDropdown(false), 200)}
                    placeholder="Name der Referenz"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  {showRefNameDropdown && mergedRefNameMatches.length > 0 && (
                    <div className="mt-1 max-h-60 overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-50">
                      {mergedRefNameMatches.map((r, i) => (
                        <button
                          key={i}
                          onMouseDown={(e) => { e.preventDefault(); selectRef(r); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left text-xs"
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                          <span className="font-mono font-semibold text-gray-900">{r.code || r.reference}</span>
                          <span className="flex-1 truncate text-gray-500">{r.name}</span>
                          <span className="text-gray-400 capitalize">{r.layerLabel || r.layerType}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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

      {/* Clubstation Popup */}
      {showClubPopup && (
        <div className="fixed inset-0 z-[10002] bg-black/50 flex items-center justify-center p-4 pb-20" onClick={handleClubPopupClose}>
          <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm max-h-[calc(100vh-6rem)] overflow-y-auto ${highContrast ? 'hc-mode' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Building className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">Clubstation</h3>
              </div>
              <button onClick={handleClubPopupClose} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                  <Building className="w-3 h-3" /> Rufzeichen der Clubstation *
                </label>
                <input
                  type="text"
                  value={clubCallsign}
                  onChange={e => setClubCallsign(e.target.value.toUpperCase().trim())}
                  onKeyDown={e => e.key === "Enter" && clubCallsign.length >= 3 && handleClubPopupConfirm()}
                  placeholder="z.B. HB9OM"
                  autoFocus
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                  <User className="w-3 h-3" /> Operator (persönliches Rufzeichen)
                </label>
                <input
                  type="text"
                  value={clubOperatorCallsign}
                  onChange={e => setClubOperatorCallsign(e.target.value)}
                  placeholder="z.B. HB9ABC"
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Name Operator</label>
                <input
                  type="text"
                  value={clubOperatorName}
                  onChange={e => setClubOperatorName(e.target.value)}
                  placeholder="Name des Operators"
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <p className="text-[10px] text-gray-400">Das Clubstations-Rufzeichen wird für jeden QSO-Eintrag gespeichert.</p>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={handleClubPopupClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button
                onClick={handleClubPopupConfirm}
                disabled={!clubCallsign || clubCallsign.length < 3}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}