import React, { useState, useMemo } from "react";
import { X, Building, User, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import MobileSelect from "@/components/ui/MobileSelect";
import { bulkUpdate } from "@/lib/localLogStore";

const REF_TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "WWFF", wwbota: "WWBOTA",
  castle: "Burg/Schloss", iota: "IOTA", lighthouse: "Leuchtturm",
  repeater: "Repeater", swiss_protected: "Bundesinventar",
  generell: "Generell", custom: "Eigene",
};

const BAND_OPTIONS = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "4m", "2m", "70cm", "23cm", "Other"];
const MODE_OPTIONS = ["SSB", "CW", "FM", "FT8", "FT4", "PSK", "RTTY", "AM", "Other"];
const SUFFIX_OPTIONS = [
  { value: "", label: "(kein Suffix)" },
  { value: "/P", label: "/P (portabel)" },
  { value: "/M", label: "/M (mobil)" },
  { value: "/AM", label: "/AM (Auto mobil)" },
  { value: "/MM", label: "/MM (Maritim mobil)" },
];

// Toggle row: checkbox + label + control
function FieldToggle({ label, enabled, onToggle, children }) {
  return (
    <div className={`border rounded-lg p-3 transition-colors ${enabled ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800" : "border-gray-200 dark:border-slate-700"}`}>
      <label className="flex items-center gap-2.5 cursor-pointer mb-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onToggle(e.target.checked)}
          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{label}</span>
      </label>
      {enabled && <div className="ml-7">{children}</div>}
    </div>
  );
}

export default function BulkEditDialog({ selectedIds, entries, onClose, onApplied }) {
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  // Field enable flags + values
  const [convertClub, setConvertClub] = useState(false);
  const [setSuffix, setSetSuffix] = useState(false);
  const [suffixVal, setSuffixVal] = useState("");
  const [setRefType, setSetRefType] = useState(false);
  const [refTypeVal, setRefTypeVal] = useState("custom");
  const [setRef, setSetRef] = useState(false);
  const [refVal, setRefVal] = useState("");
  const [setRefName, setSetRefName] = useState(false);
  const [refNameVal, setRefNameVal] = useState("");
  const [setGrid, setSetGrid] = useState(false);
  const [gridVal, setGridVal] = useState("");
  const [setBand, setSetBand] = useState(false);
  const [bandVal, setBandVal] = useState("2m");
  const [setMode, setSetMode] = useState(false);
  const [modeVal, setModeVal] = useState("FM");
  const [setStatus, setSetStatus] = useState(false);
  const [statusVal, setStatusVal] = useState("active");

  const selectedEntries = useMemo(
    () => entries.filter(e => selectedIds.includes(e.id)),
    [entries, selectedIds]
  );

  const clubCount = selectedEntries.filter(e => e.is_clubstation).length;

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const payload = {};
      if (convertClub) {
        payload.is_clubstation = false;
        payload.club_callsign = "";
        payload.club_operator_callsign = "";
        payload.club_operator_name = "";
      }
      if (setSuffix) payload.my_suffix = suffixVal;
      if (setRefType) payload.my_reference_type = refTypeVal;
      if (setRef) payload.my_reference = refVal.trim();
      if (setRefName) payload.my_reference_name = refNameVal.trim();
      if (setGrid) payload.my_grid = gridVal.trim();
      if (setBand) payload.band = bandVal;
      if (setMode) payload.mode = modeVal;
      if (setStatus) payload.status = statusVal;

      if (Object.keys(payload).length === 0) {
        setError("Bitte mindestens ein Feld auswählen.");
        setApplying(false);
        return;
      }

      bulkUpdate(selectedIds, payload);
      setDone(true);
      setTimeout(() => {
        onApplied?.();
        onClose();
      }, 900);
    } catch (e) {
      setError("Fehler beim Anwenden: " + (e.message || "unbekannt"));
      setApplying(false);
    }
  };

  const anyEnabled = convertClub || setSuffix || setRefType || setRef || setRefName || setGrid || setBand || setMode || setStatus;

  if (done) {
    return (
      <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Aktualisiert</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {selectedIds.length} Einträge wurden aktualisiert.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Einträge umbuchen</h3>
              <p className="text-[10px] text-gray-400">{selectedIds.length} ausgewählt</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Quick action: Club → Personal */}
          {clubCount > 0 && (
            <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={convertClub}
                  onChange={e => setConvertClub(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300">
                    <Building className="w-4 h-4" /> Club → Persönlich
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Wandelt {clubCount} Club-Station-Eintrag{clubCount !== 1 ? "e" : ""} in persönliche Log-Einträge um. Entfernt Club-Rufzeichen und Operator-Felder.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Field toggles */}
          <FieldToggle label="Mein Suffix" enabled={setSuffix} onToggle={setSetSuffix}>
            <MobileSelect
              value={suffixVal}
              onValueChange={setSuffixVal}
              options={SUFFIX_OPTIONS}
              triggerClassName="w-full h-9"
            />
          </FieldToggle>

          <FieldToggle label="Referenz-Typ" enabled={setRefType} onToggle={setSetRefType}>
            <MobileSelect
              value={refTypeVal}
              onValueChange={setRefTypeVal}
              options={Object.entries(REF_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              triggerClassName="w-full h-9"
            />
          </FieldToggle>

          <FieldToggle label="Referenz-Code" enabled={setRef} onToggle={setSetRef}>
            <input
              type="text"
              value={refVal}
              onChange={e => setRefVal(e.target.value)}
              placeholder="z.B. HB/AG-001"
              className="w-full h-9 px-3 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </FieldToggle>

          <FieldToggle label="Referenz-Name" enabled={setRefName} onToggle={setSetRefName}>
            <input
              type="text"
              value={refNameVal}
              onChange={e => setRefNameVal(e.target.value)}
              placeholder="z.B. Bachtel"
              className="w-full h-9 px-3 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </FieldToggle>

          <FieldToggle label="Mein Locator" enabled={setGrid} onToggle={setSetGrid}>
            <input
              type="text"
              value={gridVal}
              onChange={e => setGridVal(e.target.value.toUpperCase())}
              placeholder="z.B. JN47"
              className="w-full h-9 px-3 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </FieldToggle>

          <FieldToggle label="Band" enabled={setBand} onToggle={setSetBand}>
            <MobileSelect
              value={bandVal}
              onValueChange={setBandVal}
              options={BAND_OPTIONS.map(b => ({ value: b, label: b }))}
              triggerClassName="w-full h-9"
            />
          </FieldToggle>

          <FieldToggle label="Mode" enabled={setMode} onToggle={setSetMode}>
            <MobileSelect
              value={modeVal}
              onValueChange={setModeVal}
              options={MODE_OPTIONS.map(m => ({ value: m, label: m }))}
              triggerClassName="w-full h-9"
            />
          </FieldToggle>

          <FieldToggle label="Status" enabled={setStatus} onToggle={setSetStatus}>
            <MobileSelect
              value={statusVal}
              onValueChange={setStatusVal}
              options={[
                { value: "active", label: "Aktiv" },
                { value: "archived", label: "Archiviert" },
              ]}
              triggerClassName="w-full h-9"
            />
          </FieldToggle>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex gap-2">
          <button
            onClick={onClose}
            disabled={applying}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleApply}
            disabled={applying || !anyEnabled}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {applying ? "Wird angewendet…" : "Anwenden"}
          </button>
        </div>
      </div>
    </div>
  );
}