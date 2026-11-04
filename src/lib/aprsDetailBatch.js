import { base44 } from "@/api/base44Client";

// Bündelt Detailabfragen an aprs.fi (Backend aprsFiDetail):
//  • nur beim Öffnen eines Popups, nie beim Laden/Pannen der Karte
//  • max. 20 Rufzeichen pro Request, 250 ms Sammelfenster
//  • Ergebnis 5 Minuten im Speicher (identisch zum Server-Cache)
//  • ohne eigenen Key wird kein einziger Request mehr gesendet

const CACHE_MS = 5 * 60 * 1000;
const BATCH_DELAY_MS = 250;
const MAX_BATCH = 20;

const cache = new Map();       // callsign -> { at, detail }
const pending = new Map();     // callsign -> resolve
let queue = new Set();
let timer = null;
let keyMissing = false;

function settle(name, value) {
  const p = pending.get(name);
  pending.delete(name);
  p?.(value);
}

async function flush() {
  timer = null;
  const all = [...queue];
  const names = all.slice(0, MAX_BATCH);
  queue = new Set(all.slice(MAX_BATCH));
  if (queue.size) timer = setTimeout(flush, BATCH_DELAY_MS);
  if (!names.length) return;

  try {
    const res = await base44.functions.invoke("aprsFiDetail", { names });
    const data = res?.data || {};
    if (data.reason === "no_key") keyMissing = true;
    const byCallsign = new Map((data.details || []).map((d) => [d.callsign, d]));
    for (const name of names) {
      const detail = byCallsign.get(name) || null;
      if (detail) cache.set(name, { at: Date.now(), detail });
      settle(name, {
        ...(detail || {}),
        reason: data.reason || null,
        message: data.message || null,
      });
    }
  } catch (e) {
    for (const name of names) settle(name, { reason: "error", message: String(e?.message || e) });
  }
}

/** Detaildaten zu einem Rufzeichen holen (gebündelt, 5-Minuten-Cache). */
export function getAprsDetail(callsign) {
  const name = String(callsign || "").trim().toUpperCase();
  if (!name) return Promise.resolve(null);

  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return Promise.resolve({ ...hit.detail, reason: null, fromCache: true });
  }
  if (keyMissing) return Promise.resolve({ reason: "no_key" });

  return new Promise((resolve) => {
    pending.set(name, resolve);
    queue.add(name);
    if (!timer) timer = setTimeout(flush, BATCH_DELAY_MS);
  });
}