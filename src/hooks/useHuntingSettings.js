import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";

// useHuntingSettings — laedt/speichert pro-User Hunting-Filter (UserHuntingSettings Entity).
// RLS: jeder User sieht nur seine eigenen Settings.
// Erstellt Default-Settings beim ersten Besuch.
// Debounced Speichern bei Aenderungen.

const DEFAULT_SETTINGS = {
  selected_activity_types: ["SOTA", "POTA", "WWFF", "WWBOTA"],
  selected_bands: ["80m", "40m", "20m", "15m", "10m"],
  selected_modes: ["SSB", "CW", "FT8", "FM"],
  max_spot_age_hours: 2,
  show_only_swiss: false,
  sort_by: "time",
  filter_distance_km: 0,
  auto_refresh_enabled: true,
  auto_refresh_interval_sec: 60,
};

export function useHuntingSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const saveTimerRef = useRef(null);
  const settingsIdRef = useRef(null);

  // Load current user + settings on mount
  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!me) { setLoading(false); return; }
        setUserId(me.id);

        // Load existing settings (RLS filters by created_by_id)
        const existing = await base44.entities.UserHuntingSettings.list();
        if (existing && existing.length > 0) {
          const s = existing[0];
          settingsIdRef.current = s.id;
          setSettings({ ...DEFAULT_SETTINGS, ...s });
        } else {
          // Create default settings for this user
          const created = await base44.entities.UserHuntingSettings.create({
            user_id: me.id,
            ...DEFAULT_SETTINGS,
            last_updated: new Date().toISOString(),
          });
          settingsIdRef.current = created.id;
          setSettings({ ...DEFAULT_SETTINGS, ...created });
        }
      } catch (e) {
        // Fallback to defaults without saving
        setSettings({ ...DEFAULT_SETTINGS });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Debounced save
  const saveSettings = useCallback((partial) => {
    if (!userId) return;
    setSettings(prev => {
      const updated = { ...prev, ...partial, last_updated: new Date().toISOString() };
      // Debounce the entity update
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          if (settingsIdRef.current) {
            await base44.entities.UserHuntingSettings.update(settingsIdRef.current, {
              ...partial,
              last_updated: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn("useHuntingSettings: save failed", e);
        }
      }, 800);
      return updated;
    });
  }, [userId]);

  // Update GPS position in settings
  const updateGpsPosition = useCallback((lat, lng) => {
    if (!userId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        if (settingsIdRef.current) {
          await base44.entities.UserHuntingSettings.update(settingsIdRef.current, {
            last_user_lat: lat,
            last_user_lng: lng,
            last_updated: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn("useHuntingSettings: GPS update failed", e);
      }
    }, 2000);
  }, [userId]);

  return { settings, loading, saveSettings, updateGpsPosition };
}