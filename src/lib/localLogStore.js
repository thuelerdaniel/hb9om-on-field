import { base44 } from "@/api/base44Client";

const CACHE_KEY = "hb9om_log_cache";
const LAST_SYNC_KEY = "hb9om_log_last_sync";

export function loadLocal() {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocal(entries) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {}
}

export function getLastSync() {
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function getPendingCount() {
  return loadLocal().filter(e => e._pendingSync || e._pendingUpdate || e._pendingDelete).length;
}

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

// Sync server data, preserving pending offline entries
export async function syncFromServer() {
  const local = loadLocal();
  const pending = local.filter(e => e._pendingSync || e._pendingUpdate || e._pendingDelete);

  if (!isOnline()) return local;

  try {
    const serverData = await base44.entities.Log.list("-qso_date", 500);
    if (serverData) {
      const serverIds = new Set(serverData.map(e => e.id));
      // Keep pending entries not yet on server, plus pending updates/deletes
      const localOnly = pending.filter(e => !serverIds.has(e.id) || e._pendingUpdate || e._pendingDelete);
      // Hide pending-delete entries from display
      const visibleLocalOnly = localOnly.filter(e => !e._pendingDelete);
      const merged = [...serverData, ...visibleLocalOnly];
      saveLocal(merged);
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      return merged;
    }
  } catch {}
  return local;
}

export async function createEntry(payload) {
  const local = loadLocal();

  if (isOnline()) {
    try {
      const entry = await base44.entities.Log.create(payload);
      local.unshift(entry);
      saveLocal(local);
      return entry;
    } catch (e) {
      // Server failed — fall through to offline save
    }
  }

  // Offline: save locally with temp ID and pending flag
  const tempId = "offline_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const offlineEntry = {
    ...payload,
    id: tempId,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    _pendingSync: true,
    _offline: true
  };
  local.unshift(offlineEntry);
  saveLocal(local);
  return offlineEntry;
}

export async function updateEntry(id, payload) {
  const local = loadLocal();
  const idx = local.findIndex(e => e.id === id);

  // Offline-only entry (not yet on server)
  if (id.startsWith("offline_")) {
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...payload, updated_date: new Date().toISOString(), _pendingSync: true };
      saveLocal(local);
    }
    return local[idx];
  }

  // Update locally first
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...payload, updated_date: new Date().toISOString() };
    saveLocal(local);
  }

  if (isOnline()) {
    try {
      const entry = await base44.entities.Log.update(id, payload);
      if (idx >= 0) {
        local[idx] = { ...local[idx], ...entry };
        saveLocal(local);
      }
      return entry;
    } catch (e) {
      // Mark as pending update
    }
  }

  if (idx >= 0) {
    local[idx]._pendingUpdate = true;
    saveLocal(local);
  }
  return local[idx];
}

export async function deleteEntry(id) {
  const local = loadLocal();

  // Offline-only entry: just remove locally
  if (id.startsWith("offline_")) {
    saveLocal(local.filter(e => e.id !== id));
    return;
  }

  if (isOnline()) {
    try {
      await base44.entities.Log.delete(id);
      saveLocal(local.filter(e => e.id !== id));
      return;
    } catch (e) {
      // Mark as pending delete
    }
  }

  const idx = local.findIndex(e => e.id === id);
  if (idx >= 0) {
    local[idx]._pendingDelete = true;
    saveLocal(local);
  }
}

export async function deleteMany(ids) {
  for (const id of ids) {
    await deleteEntry(id);
  }
}

// Retry all pending operations (creates, updates, deletes)
export async function syncPending() {
  if (!isOnline()) return { synced: 0, remaining: 0 };

  const local = loadLocal();
  let synced = 0;
  let remaining = 0;

  // 1. Process pending creates (offline entries with temp IDs)
  for (let i = 0; i < local.length; i++) {
    const entry = local[i];
    if (!entry._pendingSync || entry._pendingDelete) continue;
    if (!entry.id || !entry.id.startsWith("offline_")) continue;

    const { id, created_date, updated_date, _pendingSync, _offline, _pendingUpdate, _pendingDelete, ...payload } = entry;
    try {
      const serverEntry = await base44.entities.Log.create(payload);
      local[i] = serverEntry;
      synced++;
    } catch (e) {
      remaining++;
    }
  }

  // 2. Process pending updates (entries with real server IDs)
  for (let i = 0; i < local.length; i++) {
    const entry = local[i];
    if (!entry._pendingUpdate || entry._pendingDelete) continue;
    if (!entry.id || entry.id.startsWith("offline_")) continue;

    const { _pendingSync, _offline, _pendingUpdate, _pendingDelete, id: _id, created_date, updated_date, created_by_id, ...payload } = entry;
    try {
      const serverEntry = await base44.entities.Log.update(entry.id, payload);
      local[i] = serverEntry;
      synced++;
    } catch (e) {
      remaining++;
    }
  }

  // 3. Process pending deletes
  const survivors = [];
  for (const entry of local) {
    if (entry._pendingDelete) {
      if (entry.id && !entry.id.startsWith("offline_")) {
        try {
          await base44.entities.Log.delete(entry.id);
          synced++;
        } catch (e) {
          remaining++;
          survivors.push(entry);
        }
      } else {
        // Offline-only entry: just drop
        synced++;
      }
    } else {
      survivors.push(entry);
    }
  }

  saveLocal(survivors);
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  return { synced, remaining };
}

// Auto-sync when connection is restored
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncPending().catch(() => {});
  });
}