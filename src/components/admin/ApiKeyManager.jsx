import React, { useState, useEffect } from "react";
import {
  KeyRound, Loader2, CheckCircle2, XCircle, AlertTriangle, Trash2,
  Save, Eye, EyeOff, Network, Radio, Search, Plus, Shield, User,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const GLOBAL_KEY_INFO = {
  qrz_username: {
    label: "QRZ.com Benutzername",
    icon: Search,
    description: "Globaler QRZ.com-Benutzername für Admins und Demo-Konto",
    type: "text",
    warning: "QRZ-Abfragen für Admins und Demo verwenden diesen Key. Ohne Key schlagen QRZ-Abfragen fehl.",
  },
  qrz_password: {
    label: "QRZ.com Passwort",
    icon: KeyRound,
    description: "Globales QRZ.com-Passwort (XML-Subscription erforderlich)",
    type: "password",
    warning: "QRZ-Abfragen für Admins und Demo schlagen fehl ohne dieses Passwort.",
  },
  aprs_fi: {
    label: "APRS.fi API-Key",
    icon: Radio,
    description: "Globaler API-Key für APRS.fi-Abfragen (Private Nodes, Relais-Koordinaten)",
    type: "password",
    warning: "APRS-Daten (Private Nodes, Relais-Verfeinerung) sind ohne Key nicht verfügbar.",
  },
  brandmeister: {
    label: "BrandMeister API-Key",
    icon: Network,
    description: "Globaler API-Key für BrandMeister Network (DMR-Relais, Talkgroups, Verlinkungen)",
    type: "password",
    warning: "BrandMeister-Daten (DMR-Relais, Talkgroups, Crosslinks) sind ohne Key nicht verfügbar.",
  },
};

const PERSONAL_KEY_INFO = {
  qrz_username: {
    label: "QRZ.com Benutzername",
    icon: Search,
    type: "text",
  },
  qrz_password: {
    label: "QRZ.com Passwort",
    icon: KeyRound,
    type: "password",
  },
  aprs_fi_api_key: {
    label: "APRS.fi API-Key",
    icon: Radio,
    type: "password",
  },
  brandmeister_api_key: {
    label: "BrandMeister API-Key",
    icon: Network,
    type: "password",
  },
};

function KeyField({ keyName, info, value, onChange, onDelete, isGlobal }) {
  const [showValue, setShowValue] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = info.icon || KeyRound;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-600 dark:text-slate-300" />
        <label className="text-sm font-semibold text-gray-900 dark:text-slate-100">{info.label}</label>
        {value && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            hinterlegt
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{info.description || ""}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={info.type === "password" && !showValue ? "password" : "text"}
            value={value}
            onChange={e => onChange(keyName, e.target.value)}
            placeholder={value && isGlobal ? "*** (überschreiben zum Ändern)" : "Nicht gesetzt"}
            autoComplete="off"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
          />
          {info.type === "password" && (
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {value && onDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-2.5 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center"
            title="Key löschen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {confirmDelete && (
        <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/50">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400">
              {info.warning || `Wenn Sie diesen Key löschen, stehen die entsprechenden Abfragen nicht mehr zur Verfügung.`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={() => { onDelete(keyName); setConfirmDelete(false); }}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Endgültig löschen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiKeyManager() {
  const [globalKeys, setGlobalKeys] = useState({});
  const [personalKeys, setPersonalKeys] = useState({});
  const [globalDrafts, setGlobalDrafts] = useState({});
  const [personalDrafts, setPersonalDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [useGlobalKeys, setUseGlobalKeys] = useState(true);
  const [showPersonal, setShowPersonal] = useState(false);
  const { toast } = useToast();

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const [globalRes, personalRes] = await Promise.all([
        base44.functions.invoke("manageApiKeys", { action: "getGlobal" }),
        base44.functions.invoke("manageApiKeys", { action: "getPersonal" }),
      ]);
      setGlobalKeys(globalRes.data?.keys || {});
      setPersonalKeys(personalRes.data?.keys || {});
      setUseGlobalKeys(personalRes.data?.keys?.use_global_keys !== false);
    } catch (e) {
      toast({ title: "Fehler", description: "API-Keys konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleSaveGlobal = async (keyName) => {
    const value = globalDrafts[keyName];
    if (value === undefined || value === "") return;
    setSavingGlobal(true);
    try {
      await base44.functions.invoke("manageApiKeys", { action: "setGlobal", keyName, value });
      toast({ title: "Gespeichert", description: `Globaler Key '${GLOBAL_KEY_INFO[keyName].label}' gespeichert` });
      setGlobalDrafts({ ...globalDrafts, [keyName]: "" });
      fetchKeys();
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Speichern fehlgeschlagen", variant: "destructive" });
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleDeleteGlobal = async (keyName) => {
    setSavingGlobal(true);
    try {
      await base44.functions.invoke("manageApiKeys", { action: "deleteGlobal", keyName });
      toast({ title: "Gelöscht", description: `Globaler Key '${GLOBAL_KEY_INFO[keyName].label}' gelöscht` });
      fetchKeys();
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Löschen fehlgeschlagen", variant: "destructive" });
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleSavePersonal = async () => {
    setSavingPersonal(true);
    try {
      const updateData = { use_global_keys: useGlobalKeys };
      for (const [key, value] of Object.entries(personalDrafts)) {
        if (value && value !== "***") {
          updateData[key] = value;
        }
      }
      await base44.functions.invoke("manageApiKeys", { action: "setPersonal", ...updateData });
      toast({ title: "Gespeichert", description: "Persönliche Keys gespeichert" });
      setPersonalDrafts({});
      fetchKeys();
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Speichern fehlgeschlagen", variant: "destructive" });
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleDeletePersonal = async (fieldName) => {
    setSavingPersonal(true);
    try {
      await base44.functions.invoke("manageApiKeys", { action: "deletePersonal", fieldName });
      toast({ title: "Gelöscht", description: `Persönlicher Key gelöscht` });
      fetchKeys();
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Löschen fehlgeschlagen", variant: "destructive" });
    } finally {
      setSavingPersonal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Global Keys Section */}
      <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3 border border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Globale API-Keys</h3>
          <span className="text-[10px] text-gray-500 dark:text-slate-400">für Admins & Demo-Konto</span>
        </div>
        <div className="space-y-2">
          {Object.entries(GLOBAL_KEY_INFO).map(([keyName, info]) => (
            <div key={keyName}>
              <KeyField
                keyName={keyName}
                info={info}
                value={globalKeys[keyName] || ""}
                onChange={(k, v) => setGlobalDrafts({ ...globalDrafts, [k]: v })}
                onDelete={handleDeleteGlobal}
                isGlobal
              />
              {globalDrafts[keyName] && (
                <button
                  onClick={() => handleSaveGlobal(keyName)}
                  disabled={savingGlobal}
                  className="mt-1 w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {savingGlobal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Key speichern
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Personal Keys Section */}
      <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3 border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Persönliche API-Keys</h3>
            <span className="text-[10px] text-gray-500 dark:text-slate-400">überschreiben globale Keys</span>
          </div>
          <button
            onClick={() => setUseGlobalKeys(!useGlobalKeys)}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${useGlobalKeys ? "bg-blue-500" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${useGlobalKeys ? "translate-x-6" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
          {useGlobalKeys
            ? "Sie verwenden aktuell die globalen Keys. Schalten Sie aus, um persönliche Keys zu verwenden."
            : "Sie verwenden persönliche Keys. Globale Keys werden ignoriert."}
        </p>
        {!useGlobalKeys && (
          <div className="space-y-2">
            {Object.entries(PERSONAL_KEY_INFO).map(([keyName, info]) => (
              <KeyField
                key={keyName}
                keyName={keyName}
                info={info}
                value={personalKeys[keyName] || ""}
                onChange={(k, v) => setPersonalDrafts({ ...personalDrafts, [k]: v })}
                onDelete={handleDeletePersonal}
              />
            ))}
            <button
              onClick={handleSavePersonal}
              disabled={savingPersonal || Object.keys(personalDrafts).length === 0}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {savingPersonal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Persönliche Keys speichern
            </button>
          </div>
        )}
      </div>
    </div>
  );
}