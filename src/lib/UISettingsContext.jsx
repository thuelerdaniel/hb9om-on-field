import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// UISettingsContext — pro-User UI-Präferenzen (Panel-Zustand, eingeklappte
// Filter-Sektionen). Persistiert in UserHuntingSettings.ui_settings, damit die
// persönliche Präferenz geräteübergreifend erhalten bleibt.
//
// RLS der UserHuntingSettings-Entity beschränkt den Zugriff auf den eigenen Account.

const UISettingsContext = createContext({ ui: {}, updateUI: () => {} });

export function UISettingsProvider({ children }) {
  const [ui, setUi] = useState({});
  const uiRef = useRef({});
  const settingsIdRef = useRef(null);
  const timerRef = useRef(null);

  // Load (or create) the current user's settings record on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!me || cancelled) return;
        let record = null;
        try {
          const list = await base44.entities.UserHuntingSettings.list();
          const arr = Array.isArray(list) ? list : (list?.items || []);
          record = arr[0] || null;
        } catch {
          record = null;
        }
        if (cancelled) return;
        if (!record) {
          try {
            record = await base44.entities.UserHuntingSettings.create({
              user_id: me.id,
              ui_settings: {},
              last_updated: new Date().toISOString(),
            });
          } catch {
            record = null;
          }
        }
        if (!record || cancelled) return;
        settingsIdRef.current = record.id;
        const loaded = (record.ui_settings && typeof record.ui_settings === "object") ? record.ui_settings : {};
        uiRef.current = loaded;
        setUi(loaded);
      } catch {
        // Not signed in / anonymous → in-memory defaults only
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Merge a patch into ui_settings and persist (debounced).
  const updateUI = useCallback((patch) => {
    if (!patch || typeof patch !== "object") return;
    uiRef.current = { ...uiRef.current, ...patch };
    setUi(uiRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!settingsIdRef.current) return;
      try {
        await base44.entities.UserHuntingSettings.update(settingsIdRef.current, {
          ui_settings: uiRef.current,
          last_updated: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("UISettings: save failed", e);
      }
    }, 600);
  }, []);

  return (
    <UISettingsContext.Provider value={{ ui, updateUI }}>
      {children}
    </UISettingsContext.Provider>
  );
}

export function useUISettings() {
  return useContext(UISettingsContext);
}