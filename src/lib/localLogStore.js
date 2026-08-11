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

// Pending = offline entries not yet confirmed on server.
// Optimistic in-flight creates (background sync running) are NOT counted as pending.
export function getPendingCount() {
  return loadLocal().filter(e => e._pendingSync || e._pendingUpdate || e._pendingDelete).length;
}

function isOnline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  if (typeof localStorage !== "undefined" && localStorage.getItem("hb9om_force_offline") === "true") return false;
  return true;
}

// Notify subscribers that the local cache changed (e.g. background sync completed)
function notifyCacheChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("log-cache-changed"));
  }
}

// Sync server data, preserving pending offline + optimistic in-flight entries
export async function syncFromServer() {
  const local = loadLocal();
  const localOnly = local.filter(e => e._pendingSync || e._pendingUpdate || e._pendingDelete || e._optimistic);

  if (!isOnline()) return local;

  try {
    const serverData = await base44.entities.Log.list("-qso_date", 500);
    if (serverData) {
      const serverIds = new Set(serverData.map(e => e.id));
      // Keep pending entries not yet on server, plus pending updates/deletes, plus optimistic in-flight
      const keptLocal = localOnly.filter(e => !serverIds.has(e.id) || e._pendingUpdate || e._pendingDelete);
      const visibleLocalOnly = keptLocal.filter(e => !e._pendingDelete);
      // Entries with pending local updates take precedence over stale server data (prevents race condition)
      const localUpdateIds = new Set(visibleLocalOnly.map(e => e.id));
      const filteredServerData = serverData.filter(e => !localUpdateIds.has(e.id));
      const merged = [...filteredServerData, ...visibleLocalOnly];
      saveLocal(merged);
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      return merged;
    }
  } catch {}
  return local;
}

// Optimistic create: write to local cache immediately, sync to server in background.
// Returns immediately (synchronously) so the form can close without waiting on a
// slow cellular connection. The server create runs in the background; on success the
// optimistic temp entry is replaced with the real server entry, on failure it is
// converted to an offline pending entry for later retry by syncPending().
export function createEntry(payload) {
  const local = loadLocal();
  const tempId = "optimistic_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const optimisticEntry = {
    ...payload,
    id: tempId,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    _optimistic: true,
  };
  local.unshift(optimisticEntry);
  saveLocal(local);

  if (isOnline()) {
    // Background server sync — does not block the caller
    (async () => {
      try {
        const serverEntry = await base44.entities.Log.create(payload);
        const cur = loadLocal();
        const idx = cur.findIndex(e => e.id === tempId);
        if (idx >= 0) {
          cur[idx] = serverEntry;
          saveLocal(cur);
        }
        notifyCacheChanged();
      } catch (e) {
        // Server failed — convert to offline pending for later retry
        const cur = loadLocal();
        const idx = cur.findIndex(e => e.id === tempId);
        if (idx >= 0) {
          const offlineId = "offline_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          cur[idx] = { ...cur[idx], id: offlineId, _optimistic: false, _pendingSync: true, _offline: true };
          saveLocal(cur);
        }
        notifyCacheChanged();
      }
    })();
  } else {
    // Offline: convert to pending sync entry so syncPending retries later
    const cur = loadLocal();
    const idx = cur.findIndex(e => e.id === tempId);
    if (idx >= 0) {
      const offlineId = "offline_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      cur[idx] = { ...cur[idx], id: offlineId, _optimistic: false, _pendingSync: true, _offline: true };
      saveLocal(cur);
    }
  }

  return optimisticEntry;
}

// Optimistic update: write to local cache immediately, sync to server in background.
// Returns immediately so the form closes without waiting for the server.
export function updateEntry(id, payload) {
  const local = loadLocal();
  const idx = local.findIndex(e => e.id === id);

  // Offline-only entry (not yet on server)
  if (id.startsWith("offline_")) {
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...payload, updated_date: new Date().toISOString(), _pendingSync: true };
      saveLocal(local);
    }
    return idx >= 0 ? local[idx] : null;
  }

  // Optimistic in-flight entry (temp id, server create still pending in background)
  if (id.startsWith("optimistic_")) {
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...payload, updated_date: new Date().toISOString() };
      saveLocal(local);
    }
    return idx >= 0 ? local[idx] : null;
  }

  // Real server entry: update locally first
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...payload, updated_date: new Date().toISOString() };
    saveLocal(local);
  }

  if (isOnline()) {
    // Background server sync — does not block the caller
    (async () => {
      try {
        const entry = await base44.entities.Log.update(id, payload);
        const cur = loadLocal();
        const i = cur.findIndex(e => e.id === id);
        if (i >= 0) {
          cur[i] = { ...cur[i], ...entry };
          saveLocal(cur);
        }
        notifyCacheChanged();
      } catch (e) {
        // Mark as pending update for later retry
        const cur = loadLocal();
        const i = cur.findIndex(e => e.id === id);
        if (i >= 0) {
          cur[i]._pendingUpdate = true;
          saveLocal(cur);
        }
        notifyCacheChanged();
      }
    })();
  } else {
    if (idx >= 0) {
      local[idx]._pendingUpdate = true;
      saveLocal(local);
    }
  }

  return idx >= 0 ? local[idx] : null;
}

export async function deleteEntry(id) {
  const local = loadLocal();

  // Offline-only or optimistic entry: just remove locally
  if (id.startsWith("offline_") || id.startsWith("optimistic_")) {
    saveLocal(local.filter(e => e.id !== id));
    notifyCacheChanged();
    return;
  }

  if (isOnline()) {
    try {
      await base44.entities.Log.delete(id);
      saveLocal(local.filter(e => e.id !== id));
      notifyCacheChanged();
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

// Bulk update: apply the same payload to multiple entries (optimistic, no background sync).
// Marks entries as _pendingUpdate (real server IDs) or _pendingSync (temp IDs) so that
// syncPending() - called by loadEntries() - handles the server update in a single pass.
// This avoids the race condition where bulkUpdate's background sync and syncPending both
// write to the local cache concurrently, overwriting each other's changes.
export function bulkUpdate(ids, payload) {
  const local = loadLocal();
  const idSet = new Set(ids);
  for (let i = 0; i < local.length; i++) {
    if (idSet.has(local[i].id)) {
      const isTemp = local[i].id.startsWith("offline_") || local[i].id.startsWith("optimistic_");
      local[i] = {
        ...local[i],
        ...payload,
        updated_date: new Date().toISOString(),
        _pendingUpdate: !isTemp,
        _pendingSync: isTemp ? true : (local[i]._pendingSync || false),
      };
    }
  }
  saveLocal(local);
  notifyCacheChanged();
}

// Retry all pending operations (creates, updates, deletes).
// Optimistic in-flight entries are skipped — they have their own background sync.
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
    if (!entry.id || entry.id.startsWith("offline_") || entry.id.startsWith("optimistic_")) continue;

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
      if (entry.id && !entry.id.startsWith("offline_") && !entry.id.startsWith("optimistic_")) {
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
    syncPending().then(() => notifyCacheChanged()).catch(() => {});
  });
}