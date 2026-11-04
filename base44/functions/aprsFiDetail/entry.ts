// aprsFiDetail — Detailabfrage bei api.aprs.fi für einzelne Rufzeichen.
//
// Regeln aus der aprs.fi-Dokumentation:
//   • keine Bulk-/Archiv-Abfragen, nur On-Demand beim Öffnen eines Popups
//   • maximal 20 Rufzeichen pro Request, gebündelt
//   • eigener User-Agent, Quellenangabe + Backlink in der Oberfläche
//   • pro Nutzer eigener Key aus den Einstellungen (User.aprs_fi_api_key)
//   • 5-Minuten-Cache in AprsDetailCache, Timeout 4 s, Backoff bei 429/5xx
//
// Ohne eigenen Key werden KEINE API-Aufrufe gesendet (reason "no_key") —
// dann zeigt die App ausschliesslich die eigenen APRS-IS-Daten.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

const CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 4000;
const USER_AGENT = "HB9OM-On-Field/1.0 (+https://hb9om.ch)";
const MAX_NAMES = 20;

function toNum(value: any, digits = 1): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function mapLoc(entry: any) {
  return {
    callsign: String(entry.name || "").toUpperCase(),
    type: entry.type || "",
    lasttime: entry.lasttime ? new Date(Number(entry.lasttime) * 1000).toISOString() : null,
    lat: toNum(entry.lat, 5),
    lng: toNum(entry.lng, 5),
    speed: toNum(entry.speed, 1),
    course: toNum(entry.course, 0),
    altitude: toNum(entry.altitude, 0),
    symbol: entry.symbol || "",
    srccall: entry.srccall || "",
    dstcall: entry.dstcall || "",
    comment: String(entry.comment || "").slice(0, 200),
    path: Array.isArray(entry.path) ? entry.path.join(",") : String(entry.path || ""),
    phg: entry.phg || null,
    status: entry.status || null,
  };
}

function mapWx(entry: any) {
  const wx = {
    temp_c: toNum(entry.temp, 1),
    pressure_hpa: toNum(entry.pressure, 1),
    humidity: toNum(entry.humidity, 0),
    wind_dir: toNum(entry.wind_direction, 0),
    wind_kmh: toNum(entry.wind_speed, 1),
    gust_kmh: toNum(entry.wind_gust, 1),
    rain_1h_mm: toNum(entry.rain_1h, 1),
    rain_24h_mm: toNum(entry.rain_24h, 1),
  };
  const hasAny = Object.values(wx).some((v) => v !== null);
  return hasAny ? wx : null;
}

async function callAprsFi(what: string, names: string[], apiKey: string) {
  const url = `https://api.aprs.fi/api/get?name=${encodeURIComponent(names.join(","))}&what=${what}&format=json&apikey=${encodeURIComponent(apiKey)}`;
  let lastError = "unbekannt";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        await new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt)));
        continue;
      }
      const json: any = await res.json();
      return { json };
    } catch (e: any) {
      lastError = String(e?.message || e);
      await new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt)));
    }
  }
  return { error: lastError };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body: any = await req.json().catch(() => ({}));
    const raw: string[] = Array.isArray(body.names) ? body.names : body.name ? [body.name] : [];
    const names: string[] = [...new Set(raw.map((n) => String(n || "").trim().toUpperCase()).filter(Boolean))].slice(0, MAX_NAMES);
    if (!names.length) return Response.json({ error: "names is required" }, { status: 400 });

    const apiKey = String((user as any).aprs_fi_api_key || "").trim();
    if (!apiKey) {
      return Response.json({
        success: false,
        reason: "no_key",
        message: "Kein APRS.fi API-Key (persönlich) hinterlegt — es werden nur APRS-IS-Daten angezeigt.",
        details: [],
        cached: false,
      });
    }

    // ---- Cache (5 Minuten) ----
    const cacheMap = new Map<string, any>();
    try {
      const rows: any = await base44.asServiceRole.entities.AprsDetailCache.filter(
        { callsign: { $in: names } },
        { limit: MAX_NAMES }
      );
      const list = Array.isArray(rows) ? rows : rows?.items || [];
      for (const row of list) cacheMap.set(String(row.callsign).toUpperCase(), row);
    } catch {
      /* Cache ist optional */
    }

    const nowMs = Date.now();
    const fresh = (row: any) => {
      const t = new Date(row?.fetched_date || 0).getTime();
      return Number.isFinite(t) && nowMs - t < CACHE_MS;
    };
    const cachedRows = new Map<string, any>();
    const missing: string[] = [];
    for (const name of names) {
      const row = cacheMap.get(name);
      if (row && fresh(row)) cachedRows.set(name, row);
      else missing.push(name);
    }

    let upstream: { error?: string; message?: string; reason?: string } | null = null;

    if (missing.length) {
      const locRes: any = await callAprsFi("loc", missing, apiKey);
      if (locRes.error) {
        upstream = { error: locRes.error, message: `aprs.fi nicht erreichbar (${locRes.error})`, reason: "upstream" };
      } else if (locRes.json?.result === "fail") {
        const desc = String(locRes.json?.description || "Fehler");
        const reason = /rate/i.test(desc) ? "rate_limit" : /key/i.test(desc) ? "key_invalid" : "upstream";
        upstream = { error: desc, message: `aprs.fi: ${desc}`, reason };
      }

      if (!upstream) {
        const wxRes: any = await callAprsFi("wx", missing, apiKey);
        const locEntries = new Map<string, any>();
        for (const e of locRes.json?.entries || []) {
          const key = String(e.name || "").toUpperCase();
          if (key) locEntries.set(key, mapLoc(e));
        }
        const wxEntries = new Map<string, any>();
        for (const e of (wxRes.json?.entries || [])) {
          const key = String(e.name || "").toUpperCase();
          const wx = key ? mapWx(e) : null;
          if (key && wx) wxEntries.set(key, wx);
        }

        const fetchedIso = new Date().toISOString();
        const toCreate: any[] = [];
        const toUpdate: any[] = [];

        for (const name of missing) {
          const loc = locEntries.get(name) || null;
          const wx = wxEntries.get(name) || null;
          const payload = { callsign: name, loc, wx, found: !!loc, fetched_date: fetchedIso };
          const existing = cacheMap.get(name);
          if (existing?.id) toUpdate.push({ id: existing.id, ...payload });
          else toCreate.push(payload);
          cachedRows.set(name, payload);
        }

        try {
          if (toCreate.length) await base44.asServiceRole.entities.AprsDetailCache.bulkCreate(toCreate);
          if (toUpdate.length) await base44.asServiceRole.entities.AprsDetailCache.bulkUpdate(toUpdate);
        } catch {
          /* Cache-Schreibfehler dürfen die Antwort nicht verhindern */
        }
      }
    }

    const details = names
      .map((name) => {
        const row = cachedRows.get(name);
        if (!row) return null;
        return { callsign: name, found: !!row.loc, loc: row.loc || null, wx: row.wx || null };
      })
      .filter(Boolean);

    return Response.json({
      success: !upstream,
      reason: upstream?.reason || null,
      message: upstream?.message || null,
      details,
      cached: missing.length === 0,
      requested: names.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}