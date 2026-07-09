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
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {}
}

export function getLastSync() {
  return localStorage.getItem(LAST_SYNC_KEY);
}

export async function syncFromServer() {
  try {
    const data = await base44.entities.Log.list("-qso_date", 500);
    if (data) {
      saveLocal(data);
      return data;
    }
  } catch {}
  return loadLocal();
}

export async function createEntry(payload) {
  const entry = await base44.entities.Log.create(payload);
  const local = loadLocal();
  local.unshift(entry);
  saveLocal(local);
  return entry;
}

export async function updateEntry(id, payload) {
  const entry = await base44.entities.Log.update(id, payload);
  const local = loadLocal();
  const idx = local.findIndex((e) => e.id === id);
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...entry };
    saveLocal(local);
  }
  return entry;
}

export async function deleteEntry(id) {
  await base44.entities.Log.delete(id);
  const local = loadLocal().filter((e) => e.id !== id);
  saveLocal(local);
}

export async function deleteMany(ids) {
  for (const id of ids) {
    await base44.entities.Log.delete(id);
  }
  const local = loadLocal().filter((e) => !ids.includes(e.id));
  saveLocal(local);
}