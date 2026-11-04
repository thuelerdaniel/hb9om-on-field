// collectAprs — sammelt APRS-Positionen direkt von APRS-IS (TCP 14580).
//
// Läuft alle 3 Minuten per Workflow. Liest 50 Sekunden lang Pakete im Umkreis
// von 200 km um die Schweiz (Serverfilter r/46.8/8.2/200) — inklusive aller
// mobilen Stationen (die frühere Symbol-Filterregel ist aufgehoben).
//
// Speicherung:
//   AprsPosition — genau ein Datensatz pro Rufzeichen (aktuelle Position)
//   AprsSample   — rollierende Historie, Retention 72 Stunden
//
// Tempo/Kurs: direkt aus dem Paket (CSE/SPD). Fehlt die Angabe im Paket,
// wird sie aus der Bewegung zwischen zwei Positionen abgeleitet.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { readAprsStream } from "../../shared/aprsIs.ts";
import { haversine, bearing } from "../../shared/geoUtils.ts";

const SAMPLE_MIN_GAP_MS = 15 * 60 * 1000;   // max. 1 Sample pro Station / 15 min
const SAMPLE_RETENTION_MS = 72 * 3600 * 1000;
const POSITION_RETENTION_MS = 7 * 24 * 3600 * 1000;

/** Tempo/Kurs aus der Bewegung zwischen zwei Positionen ableiten. */
function deriveFromMotion(
  prev: { lat: number; lng: number; heard: string },
  next: { lat: number; lng: number },
  nowMs: number
) {
  const prevMs = new Date(prev.heard).getTime();
  const dtSec = (nowMs - prevMs) / 1000;
  if (!Number.isFinite(dtSec) || dtSec < 60 || dtSec > 6 * 3600) return null;
  const km = haversine(prev.lat, prev.lng, next.lat, next.lng);
  if (km > 60) return null; // unplausibler Sprung
  const kmh = (km / dtSec) * 3600;
  if (kmh > 300) return null;
  return {
    speed: Math.round(kmh * 10) / 10,
    course: bearing(prev.lat, prev.lng, next.lat, next.lng),
  };
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const durationMs = Math.min(Math.max(Number(body.duration_ms) || 50000, 10000), 85000);
  const radiusKm = Math.min(Math.max(Number(body.radius_km) || 200, 25), 400);
  const centerLat = Number.isFinite(Number(body.lat)) ? Number(body.lat) : 46.8;
  const centerLng = Number.isFinite(Number(body.lng)) ? Number(body.lng) : 8.2;
  const probeOnly = body.probe === true;

  const started = Date.now();
  const { packets, stats } = await readAprsStream({
    lat: centerLat,
    lon: centerLng,
    radiusKm,
    loginCall: "HB9OM-15",
    durationMs,
  });

  // Diagnose-Modus: nur Rohbefund zurückgeben, nichts schreiben
  if (probeOnly) {
    const wanted = body.probe_format as string | undefined;
    const list = wanted ? packets.filter((p) => p.format === wanted) : packets;
    return Response.json({
      probe: true,
      stats,
      samples: list.slice(0, 15),
      by_type: packets.reduce((acc: Record<string, number>, p) => {
        acc[p.station_type] = (acc[p.station_type] || 0) + 1;
        return acc;
      }, {}),
      mobile_with_speed: packets.filter((p) => p.station_type === "mobile" && p.speed != null).length,
    });
  }

  if (stats.error && packets.length === 0) {
    await recordSchedule(base44, "failed", 0, Date.now() - started, stats.error);
    return Response.json({ ok: false, error: stats.error, stats }, { status: 502 });
  }

  // ---- Bestehende Positionen laden (eine Abfrage statt N Einzelabfragen) ----
  const callsigns = [...new Set(packets.map((p) => p.callsign))];
  const existing = new Map<string, any>();
  for (let i = 0; i < callsigns.length; i += 150) {
    const chunk = callsigns.slice(i, i + 150);
    try {
      const rows = await base44.asServiceRole.entities.AprsPosition.filter(
        { callsign: { $in: chunk } },
        { limit: 500 }
      );
      const list = Array.isArray(rows) ? rows : rows?.items || [];
      for (const row of list) existing.set(String(row.callsign).toUpperCase(), row);
    } catch {
      /* ignore — im Zweifel neu anlegen */
    }
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const toCreate: any[] = [];
  const toUpdate: any[] = [];
  const samples: any[] = [];

  for (const p of packets) {
    const key = p.callsign.toUpperCase();
    const prev = existing.get(key);
    let speed = p.speed;
    let course = p.course;
    let altitude = p.altitude;

    if (prev && (speed == null || course == null) && Number.isFinite(prev.lat) && Number.isFinite(prev.lng)) {
      const derived = deriveFromMotion(
        { lat: prev.lat, lng: prev.lng, heard: prev.last_heard || prev.updated_date },
        { lat: p.lat, lng: p.lng },
        nowMs
      );
      if (derived) {
        if (speed == null) speed = derived.speed;
        if (course == null) course = derived.course;
      }
    }
    if (altitude == null && prev?.altitude != null) altitude = prev.altitude;

    const record: any = {
      callsign: p.callsign,
      lat: p.lat,
      lng: p.lng,
      symbol: p.symbol,
      station_type: p.station_type,
      comment: p.comment,
      speed: speed ?? null,
      course: course ?? null,
      altitude: altitude ?? null,
      last_heard: p.heard,
      last_format: p.format,
      source: "aprs-is",
    };

    // Historie: nur wenn Mindestabstand erreicht und Station sich bewegt hat
    const lastSampleMs = prev?.last_sample_at ? new Date(prev.last_sample_at).getTime() : 0;
    const moved = prev ? haversine(prev.lat ?? 0, prev.lng ?? 0, p.lat, p.lng) > 0 : true;
    if (nowMs - lastSampleMs >= SAMPLE_MIN_GAP_MS && moved) {
      record.last_sample_at = nowIso;
      samples.push({
        callsign: p.callsign,
        lat: p.lat,
        lng: p.lng,
        speed: speed ?? null,
        course: course ?? null,
        altitude: altitude ?? null,
        station_type: p.station_type,
        symbol: p.symbol,
        heard: p.heard,
      });
    }

    if (prev) {
      toUpdate.push({ id: prev.id, ...record, first_heard: prev.first_heard || p.heard, packet_count: (prev.packet_count || 0) + 1 });
    } else {
      toCreate.push({ ...record, first_heard: p.heard, packet_count: 1 });
    }
  }

  // ---- Schreiben ----
  let created = 0;
  let updated = 0;
  let samplesSaved = 0;

  for (let i = 0; i < toCreate.length; i += 100) {
    const batch = toCreate.slice(i, i + 100);
    try {
      await base44.asServiceRole.entities.AprsPosition.bulkCreate(batch);
      created += batch.length;
    } catch {
      /* ignore */
    }
  }
  for (let i = 0; i < toUpdate.length; i += 100) {
    const batch = toUpdate.slice(i, i + 100);
    try {
      await base44.asServiceRole.entities.AprsPosition.bulkUpdate(batch);
      updated += batch.length;
    } catch {
      /* ignore */
    }
  }
  for (let i = 0; i < samples.length; i += 200) {
    const batch = samples.slice(i, i + 200);
    try {
      await base44.asServiceRole.entities.AprsSample.bulkCreate(batch);
      samplesSaved += batch.length;
    } catch {
      /* ignore */
    }
  }

  // ---- Retention ----
  let prunedSamples = 0;
  try {
    const cutoff = new Date(nowMs - SAMPLE_RETENTION_MS).toISOString();
    const res: any = await base44.asServiceRole.entities.AprsSample.deleteMany({ heard: { $lt: cutoff } });
    prunedSamples = Number(res?.deleted ?? res?.count ?? 0) || 0;
  } catch {
    /* ignore */
  }
  try {
    const cutoff = new Date(nowMs - POSITION_RETENTION_MS).toISOString();
    await base44.asServiceRole.entities.AprsPosition.deleteMany({ last_heard: { $lt: cutoff } });
  } catch {
    /* ignore */
  }

  const duration = Date.now() - started;
  const summary = {
    ok: true,
    packets_read: stats.lines,
    stations: packets.length,
    created,
    updated,
    samples: samplesSaved,
    pruned_samples: prunedSamples,
    formats: stats.by_format,
    mobile: packets.filter((p) => p.station_type === "mobile").length,
    mobile_with_speed: packets.filter((p) => p.station_type === "mobile" && p.speed != null).length,
    duration_ms: duration,
    filter: stats.filter,
    error: stats.error,
  };

  await recordSchedule(base44, "success", packets.length, duration, stats.error || null);
  return Response.json(summary);
}

async function recordSchedule(
  base44: any,
  status: string,
  count: number,
  durationMs: number,
  error: string | null
) {
  try {
    const rows: any = await base44.asServiceRole.entities.DailyRefreshSchedule.filter({ source: "aprs" });
    const list = Array.isArray(rows) ? rows : rows?.items || [];
    if (!list.length) return;
    await base44.asServiceRole.entities.DailyRefreshSchedule.update(list[0].id, {
      last_run_time: new Date().toISOString(),
      last_status: status,
      last_count: count,
      last_duration_ms: durationMs,
      last_error: error || "",
      last_error_detail: "",
    });
  } catch {
    /* ignore */
  }
}