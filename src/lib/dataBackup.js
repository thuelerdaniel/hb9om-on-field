import { base44 } from "@/api/base44Client";
import { loadLocal, saveLocal } from "@/lib/localLogStore";

const BACKUP_VERSION = 1;

function getUserSettings() {
  const keys = [
    "hb9om_my_callsign", "hb9om_qrz_enabled", "hb9om_setup_complete",
    "hb9om_last_frequency", "hb9om_last_band", "hb9om_last_mode",
    "hb9om_last_rst_sent", "hb9om_last_rst_received", "hb9om_last_power",
    "hb9om_last_ref_type", "hb9om_last_ref_code", "hb9om_last_ref_name",
    "hb9om_last_callsign_suffix", "hb9om_last_my_suffix",
    "hb9om_last_is_clubstation", "hb9om_last_club_callsign",
    "hb9om_last_club_op_callsign", "hb9om_last_club_op_name",
    "hb9om_last_my_grid", "hb9om_hc_mode",
    "hb9om_map_active_layers", "hb9om_map_base_layer",
    "hb9om_map_opacity", "hb9om_map_center", "hb9om_map_zoom",
    "hb9om_map_locked_scale", "hb9om_position_radius"
  ];
  const settings = {};
  for (const key of keys) {
    const val = localStorage.getItem(key);
    if (val !== null) settings[key] = val;
  }
  return settings;
}

function restoreUserSettings(settings) {
  if (!settings) return;
  for (const [key, val] of Object.entries(settings)) {
    try { localStorage.setItem(key, val); } catch {}
  }
}

export async function createBackup() {
  const user = await base44.auth.me();

  // Gather logs (from local store — includes offline entries)
  const logs = loadLocal();

  // Gather QRZ lookups
  let qrzLookups = [];
  try {
    qrzLookups = await base44.entities.QrzLookup.list("-created_date", 200);
  } catch {}

  // Gather change requests
  let changeRequests = [];
  try {
    changeRequests = await base44.entities.ReferenceChangeRequest.list("-created_date", 200);
  } catch {}

  // Gather feature requests
  let featureRequests = [];
  try {
    featureRequests = await base44.entities.FeatureRequest.list("-created_date", 200);
  } catch {}

  const backup = {
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    user: user ? { id: user.id, email: user.email, full_name: user.full_name } : null,
    settings: getUserSettings(),
    logs: logs || [],
    qrz_lookups: qrzLookups || [],
    change_requests: changeRequests || [],
    feature_requests: featureRequests || []
  };

  return backup;
}

export function downloadBackup(backup) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const callsign = backup.settings?.hb9om_my_callsign || "hb9om";
  const a = document.createElement("a");
  a.href = url;
  a.download = `hb9om_backup_${callsign}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreBackup(backup) {
  if (!backup || backup.version !== BACKUP_VERSION) {
    throw new Error("Ungültiges oder inkompatibles Backup-Format");
  }

  // Restore settings
  restoreUserSettings(backup.settings);

  // Restore logs to local store
  if (backup.logs && Array.isArray(backup.logs)) {
    saveLocal(backup.logs);
  }

  // Restore QRZ lookups to server
  if (backup.qrz_lookups && backup.qrz_lookups.length > 0) {
    try {
      // Clear existing, then restore
      const existing = await base44.entities.QrzLookup.list("-created_date", 200);
      for (const e of existing) {
        await base44.entities.QrzLookup.delete(e.id);
      }
      for (const q of backup.qrz_lookups) {
        const { id, created_date, updated_date, created_by_id, ...payload } = q;
        await base44.entities.QrzLookup.create(payload);
      }
    } catch {}
  }

  return {
    settingsRestored: Object.keys(backup.settings || {}).length,
    logsRestored: (backup.logs || []).length,
    qrzRestored: (backup.qrz_lookups || []).length
  };
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (err) {
        reject(new Error("Datei konnte nicht gelesen werden: ungültiges JSON"));
      }
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsText(file);
  });
}

// Auto cloud backup: triggered after QSO save if enabled
export async function autoCloudBackup() {
  const autoEnabled = localStorage.getItem("hb9om_auto_cloud_backup") === "true";
  if (!autoEnabled) return;
  if (!navigator.onLine || localStorage.getItem("hb9om_force_offline") === "true") return;

  const provider = localStorage.getItem("hb9om_cloud_provider");

  try {
    const backup = await createBackup();
    const callsign = backup.settings?.hb9om_my_callsign || "hb9om";
    const filename = `hb9om_backup_${callsign}_${new Date().toISOString().slice(0, 10)}.json`;

    if (provider === "googledrive" || provider === "one_drive") {
      const res = await base44.functions.invoke("cloudDriveBackup", {
        action: "upload",
        provider,
        backup_data: backup,
        backup_filename: filename
      });
      if (res.data?.success) {
        localStorage.setItem("hb9om_last_cloud_backup", new Date().toISOString());
      }
    } else {
      // WebDAV fallback
      const me = await base44.auth.me();
      const url = me?.webdav_url;
      const user = me?.webdav_username;
      const pass = me?.webdav_password;
      if (!url || !user || !pass) return;

      const res = await base44.functions.invoke("cloudBackup", {
        action: "upload",
        webdav_url: url,
        webdav_username: user,
        webdav_password: pass,
        backup_data: backup,
        backup_filename: filename
      });
      if (res.data?.success) {
        localStorage.setItem("hb9om_last_cloud_backup", new Date().toISOString());
      }
    }
  } catch (e) {
    // Silent failure - don't interrupt QSO flow
  }
}