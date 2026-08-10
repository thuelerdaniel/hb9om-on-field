import React, { useState } from "react";
import { Radio, Globe, Headphones, Link2, ExternalLink, Signal, Navigation, MapPin, Zap, Battery, Sun, Plus, CircleDot, Mountain, RefreshCw, Activity, Edit3, Loader2, Check, X, AlertTriangle, BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { MODE_COLORS, MODE_LABELS, STATUS_LABELS } from "@/lib/repeaterModes";
import RepeaterCorrectionDialog from "@/components/map/RepeaterCorrectionDialog";

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

const POWER_INFO = {
  netz: { icon: Zap, label: "Netzstrom", color: "#6b7280" },
  notstrom: { icon: Battery, label: "Notstrom (Batterie/USV)", color: "#22c55e" },
  solar: { icon: Sun, label: "Solar", color: "#f59e0b" },
  unknown: null,
};

export default function RepeaterPopup({ repeater, linkedRepeaters = [], userPosition, onSuggestLink, onToggleCoverage, showCoverageForThis, isAdmin }) {
  const [showSuggestHint, setShowSuggestHint] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(repeater.web_url || "");
  const [savingUrl, setSavingUrl] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);

  // Build RepeaterBook source link from source_id and country_code
  // Non-North-America: row_repeaters/details.php?state_id=CH&ID=12345
  // North-America (US/CA): repeaters/details.php?state_id=06&country_code=US&ID=12345
  const repeaterBookUrl = repeater.source_id
    ? (repeater.country_code === 'US' || repeater.country_code === 'CA'
      ? `https://www.repeaterbook.com/repeaters/details.php?country_code=${repeater.country_code}&ID=${repeater.source_id}`
      : `https://www.repeaterbook.com/row_repeaters/details.php?state_id=${repeater.country_code || ''}&ID=${repeater.source_id}`)
    : null;
  const statusInfo = STATUS_LABELS[repeater.status] || STATUS_LABELS.unknown;
  const hasCoords = repeater.lat != null && repeater.lng != null;
  const navUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${repeater.lat},${repeater.lng}`
    : null;
  const distance = hasCoords && userPosition
    ? haversineKm(userPosition[0], userPosition[1], repeater.lat, repeater.lng)
    : null;
  const powerInfo = POWER_INFO[repeater.power_source] || null;

  const handleSaveUrl = async () => {
    setSavingUrl(true);
    try {
      await base44.functions.invoke("manageRepeater", {
        action: "setWebUrl",
        repeater_id: repeater.id,
        web_url: urlInput.trim(),
      });
      repeater.web_url = urlInput.trim();
      setEditingUrl(false);
    } catch (e) {
      // error - stay in edit mode
    } finally {
      setSavingUrl(false);
    }
  };

  const handleTriggerCoverage = async () => {
    setCalcLoading(true);
    try {
      await base44.functions.invoke("manageRepeater", {
        action: "triggerCoverage",
        repeater_id: repeater.id,
      });
      repeater.needs_recalc = false;
      repeater.coverage_updated = new Date().toISOString();
    } catch (e) {
    } finally {
      setCalcLoading(false);
    }
  };

  return (
    <div className="text-xs min-w-[200px] max-w-[260px]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" style={{ color: MODE_COLORS[repeater.primary_mode] || "#6b7280" }} />
            {repeater.callsign}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{repeater.location_name}</div>
          {repeater.country && (
            <div className="text-[10px] text-gray-400 mt-0.5">{repeater.country}</div>
          )}
        </div>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
        >
          {statusInfo.label}
        </span>
      </div>

      <div className="bg-gray-50 rounded-lg p-2 mb-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase">Frequenz</span>
          <span className="font-mono font-bold text-sm text-gray-900">
            {repeater.frequency.toFixed(4)} MHz
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-400 uppercase">Offset</span>
          <span className="font-mono text-[11px] text-gray-600">
            {repeater.offset_mhz > 0 ? "+" : ""}{repeater.offset_mhz?.toFixed(2) || "0.00"} MHz
          </span>
        </div>
        {repeater.tone && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400 uppercase">Zugang</span>
            <span className="font-mono text-[11px] text-gray-600">{repeater.tone}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {(repeater.modes || []).map((mode, i) => (
          <span
            key={i}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{
              color: MODE_COLORS[mode] || "#6b7280",
              backgroundColor: (MODE_COLORS[mode] || "#6b7280") + "15",
            }}
          >
            {MODE_LABELS[mode] || mode}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-2">
        <Signal className="w-3 h-3" />
        <span>Band: <span className="font-medium text-gray-700">{repeater.band}</span></span>
      </div>

      {repeater.fm_funknetz && (
        <div className="flex items-center gap-1 text-[11px] text-green-600 mb-1.5 bg-green-50 rounded px-1.5 py-1">
          <Headphones className="w-3 h-3" />
          <span>Auf FM-Funknetz.de anhörbar</span>
        </div>
      )}

      {powerInfo && (
        <div className="flex items-center gap-1 text-[11px] mb-1.5 rounded px-1.5 py-1" style={{ color: powerInfo.color, backgroundColor: powerInfo.color + "15" }}>
          <powerInfo.icon className="w-3 h-3" />
          <span>Stromversorgung: <span className="font-medium">{powerInfo.label}</span></span>
        </div>
      )}

      {repeater.echolink_node && (
        <div className="flex items-center gap-1 text-[11px] text-indigo-600 mb-1.5 bg-indigo-50 rounded px-1.5 py-1">
          <Link2 className="w-3 h-3" />
          <span>EchoLink-Node: <span className="font-mono font-bold">{repeater.echolink_node}</span></span>
        </div>
      )}

      {distance != null && (
        <div className="flex items-center gap-1 text-[11px] text-blue-600 mb-1.5 bg-blue-50 rounded px-1.5 py-1">
          <MapPin className="w-3 h-3" />
          <span>Entfernung: <span className="font-bold">{formatDistance(distance)}</span></span>
        </div>
      )}

      {linkedRepeaters.length > 0 && (
        <div className="mb-2 border-t border-gray-100 pt-2">
          <div className="text-[10px] text-gray-400 uppercase mb-1 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Verlinkungen ({linkedRepeaters.length})
          </div>
          <div className="space-y-1">
            {linkedRepeaters.map((lr, i) => (
              <div key={i} className="text-[11px] bg-blue-50 rounded px-1.5 py-1 border border-blue-100">
                <div className="flex items-center gap-1 font-mono font-bold text-blue-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {lr.callsign}
                  {lr.frequency != null && (
                    <span className="font-normal text-gray-600 ml-0.5">
                      {lr.frequency.toFixed(4)} MHz
                    </span>
                  )}
                  {lr.source === 'admin' && (
                    <span className="ml-auto text-[8px] text-gray-400 font-sans font-normal italic">Admin</span>
                  )}
                </div>
                {lr.band && (
                  <div className="text-[10px] text-gray-400 ml-3">Band: {lr.band}</div>
                )}
                {lr.location_name && (
                  <div className="text-[10px] text-gray-500 ml-3 truncate">{lr.location_name}</div>
                )}
                {lr.distance != null && (
                  <div className="text-[10px] text-blue-500 ml-3 flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" /> {formatDistance(lr.distance)} entfernt
                  </div>
                )}
                {lr.network && (
                  <div className="text-[10px] text-gray-400 ml-3">Netz: {lr.network}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 mt-1">
        {onToggleCoverage && hasCoords && (
          <button
            onClick={() => onToggleCoverage(repeater)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium border rounded-lg ${
              showCoverageForThis
                ? "text-green-700 bg-green-50 border-green-300"
                : "text-green-600 border-green-200 hover:bg-green-50"
            }`}
          >
            <CircleDot className="w-3 h-3" />
            {showCoverageForThis ? "Abdeckung an" : "Abdeckung"}
          </button>
        )}
        {onSuggestLink && hasCoords && (
          <button
            onClick={() => onSuggestLink(repeater)}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            <Plus className="w-3 h-3" />
            Verlinkung
          </button>
        )}
      </div>

      {/* Web link — show if found, admin can edit */}
      <div className="mt-1">
        {editingUrl ? (
          <div className="flex flex-col gap-1">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="w-full text-[11px] px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-1">
              <button
                onClick={handleSaveUrl}
                disabled={savingUrl}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Speichern
              </button>
              <button
                onClick={() => { setEditingUrl(false); setUrlInput(repeater.web_url || ""); }}
                className="flex items-center justify-center px-2 py-1 text-[11px] font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {repeater.web_url ? (
              <a
                href={repeater.web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 hover:underline"
              >
                <Globe className="w-3 h-3" />
                <span className="truncate">{repeater.web_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
              </a>
            ) : (
              <span className="flex-1 text-[10px] text-gray-300 italic">Kein Web-Link gefunden</span>
            )}
            {isAdmin && (
              <button
                onClick={() => setEditingUrl(true)}
                className="flex items-center justify-center w-6 h-6 text-[10px] text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                title="Web-Link bearbeiten (Admin)"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {navUrl && (
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Navigation className="w-3 h-3" />
          Navigieren (Google Maps)
        </a>
      )}

      {hasCoords && (
        <a
          href={`https://www.iz8wnh.it/rpts/?lat=${repeater.lat}&lng=${repeater.lng}&call=${encodeURIComponent(repeater.callsign)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50"
        >
          <Signal className="w-3 h-3" />
          RadioMobile-Abdeckung (iz8wnh.it)
          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
        </a>
      )}

      {/* Coverage calculation status — always show */}
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-400 uppercase">Abdeckungs-Status</span>
          {repeater.needs_recalc ? (
            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
              <RefreshCw className="w-2.5 h-2.5" /> Neuberechnung offen
            </span>
          ) : repeater.coverage_radius_km != null ? (
            <span className={`text-[11px] font-bold ${
              (repeater.coverage_refinement_pct || 0) >= 60 ? 'text-green-600' :
              (repeater.coverage_refinement_pct || 0) >= 30 ? 'text-amber-600' : 'text-gray-400'
            }`}>
              {repeater.coverage_refinement_pct || 0}%
            </span>
          ) : (
            <span className="text-[10px] font-bold text-gray-400">Nicht berechnet</span>
          )}
        </div>
        {repeater.coverage_radius_km != null && (
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
            <div
              className={`h-full rounded-full transition-all ${
                (repeater.coverage_refinement_pct || 0) >= 60 ? 'bg-green-500' :
                (repeater.coverage_refinement_pct || 0) >= 30 ? 'bg-amber-500' : 'bg-gray-400'
              }`}
              style={{ width: `${repeater.coverage_refinement_pct || 0}%` }}
            />
          </div>
        )}
        <div className="text-[9px] text-gray-400 mt-0.5">
          {repeater.coverage_radius_km != null
            ? (repeater.coverage_source === "aprs_refined"
              ? "APRS-verfeinert (Stationsdichte)"
              : repeater.coverage_source === "terrain_adjusted"
              ? "Gelände-adjustiert (Höhe & Terrain)"
              : repeater.coverage_source === "manual"
              ? "Manuell gesetzt"
              : "Band-Schätzung (noch nicht verfeinert)")
            : "Noch nicht berechnet — Admin kann Berechnung anstossen"}
          {repeater.coverage_updated && ` · ${new Date(repeater.coverage_updated).toLocaleDateString('de-CH')}`}
        </div>
        {(repeater.elevation_m != null || repeater.terrain_factor != null) && (
          <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-400">
            {repeater.elevation_m != null && (
              <span className="flex items-center gap-0.5">
                <Mountain className="w-2.5 h-2.5" /> {Math.round(repeater.elevation_m)} m ü.M.
              </span>
            )}
            {repeater.terrain_factor != null && repeater.terrain_factor !== 1 && (
              <span className="flex items-center gap-0.5">
                <Activity className="w-2.5 h-2.5" /> Faktor {repeater.terrain_factor.toFixed(2)}
              </span>
            )}
          </div>
        )}
        {/* Admin-only: trigger coverage calculation for this repeater */}
        {isAdmin && hasCoords && (
          <button
            onClick={handleTriggerCoverage}
            disabled={calcLoading}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 disabled:opacity-50"
          >
            {calcLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {calcLoading ? "Berechnung läuft..." : "Abdeckung berechnen (Admin)"}
          </button>
        )}
      </div>

      {/* Source link to RepeaterBook + report incorrect data */}
      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
        {repeaterBookUrl && (
          <a
            href={repeaterBookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <BookOpen className="w-3 h-3" />
            Quelle bei RepeaterBook
            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
          </a>
        )}
        <button
          onClick={() => setShowCorrection(true)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50"
        >
          <AlertTriangle className="w-3 h-3" />
          Falsche Angaben melden
        </button>
      </div>

      <div className="text-[9px] text-gray-300 mt-2 pt-1 border-t border-gray-100">
        Quelle: RepeaterBook.com
      </div>

      {showCorrection && (
        <RepeaterCorrectionDialog
          repeater={repeater}
          onClose={() => setShowCorrection(false)}
        />
      )}
    </div>
  );
}