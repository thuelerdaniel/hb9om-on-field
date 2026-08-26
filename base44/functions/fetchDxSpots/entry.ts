import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";

// Lade DX-Spots von jo30.de DXCluster (primär) oder DX Summit (Fallback).
// Berechne Distanz, Azimuth und Confidence aus Station-Locator (JN36FL oder AppSetting).
// Speichere max 50 Spots, lösche Spots älter als 1 Stunde.

const DEFAULT_LOCATOR = 'JN36FL';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Station-Locator aus AppSetting laden, Fallback JN36FL
    let stationLocator = DEFAULT_LOCATOR;
    try {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'station_info' });
      if (settings && settings.length > 0) {
        const info = JSON.parse(settings[0].value || '{}');
        if (info.locator) stationLocator = info.locator.toUpperCase();
      }
    } catch {}
    const stationPos = maidenheadToLatLon(stationLocator) || { lat: 46.5, lon: 6.5 };

    // DX-Cluster Spots laden — primär dxc.jo30.de, Fallback DX Summit
    let spots: any[] = [];
    let apiWarning: string | null = null;
    let source = 'DXCluster (jo30.de)';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch('https://dxc.jo30.de/dxcache/spots', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const raw = await resp.json();
        spots = Array.isArray(raw) ? raw : (raw.spots || raw.data || []);
      } else {
        apiWarning = `jo30.de API Status ${resp.status}`;
      }
    } catch (e) {
      apiWarning = 'jo30.de API nicht erreichbar';
    }

    if (spots.length === 0) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch('https://www.dxsummit.fi/api/v1/spots', {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const raw = await resp.json();
          spots = Array.isArray(raw) ? raw : (raw.spots || raw.data || []);
          source = 'DX Summit';
        } else if (!apiWarning) {
          apiWarning = `DX Summit API Status ${resp.status}`;
        }
      } catch (e) {
        if (!apiWarning) apiWarning = 'DX Summit API nicht erreichbar';
      }
    }

    const toProcess = spots.slice(0, 50);

    // Alte Spots löschen (> 1 Stunde)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    try {
      await base44.asServiceRole.entities.DxSpot.deleteMany({
        spot_time: { $lt: oneHourAgo },
      });
    } catch {}

    const now = Date.now();
    const normalized = [];
    for (const s of toProcess) {
      const freqKHz = Number(s.frequency || s.freq || 0);
      const call = s.spotted || s.call || s.dxcallsign;
      if (!freqKHz || !call) continue;

      // Zeit parsen
      let spotTime: Date;
      if (s.when) {
        spotTime = new Date(s.when);
      } else if (s.time) {
        const t = Number(s.time);
        spotTime = !isNaN(t) && t > 1e9 ? new Date(t * 1000) : new Date(s.time);
      } else if (s.spotted_at) {
        spotTime = new Date(s.spotted_at);
      } else {
        spotTime = new Date();
      }

      const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));
      const message = s.message || s.comment || s.info || '';
      const comments = message ? [message] : [];

      // Locator aus Kommentar extrahieren (z.B. "JN47QM" oder "locator JN47QM")
      let locator = '';
      const locMatch = message.match(/\b([A-R]{2}\d{2}[A-X]{2})\b/i);
      if (locMatch) locator = locMatch[1].toUpperCase();

      // Activity aus Kommentar erkennen
      let activity = '';
      const msgUpper = message.toUpperCase();
      if (msgUpper.includes('SOTA')) activity = 'SOTA';
      else if (msgUpper.includes('POTA')) activity = 'POTA';

      // Country/Code aus add-Objekt oder Feld
      const country = s.country || s.dxcc || s.add?.country || '';
      const countryCode = s.countryCode || s.add?.countryCode || s.dxcc_cc || '';

      // Distanz + Azimuth berechnen (nur wenn Locator vorhanden)
      let distance = 0;
      let azimuth = 0;
      if (locator) {
        const dxPos = maidenheadToLatLon(locator);
        if (dxPos) {
          distance = haversine(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
          azimuth = bearing(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
        }
      }

      // Confidence: Basis 50, +20 spotter, +10 locator, +10 country, +10 activity. Max 100.
      let confidence = 50;
      if (s.spotter || s.spotted_by) confidence += 20;
      if (locator) confidence += 10;
      if (country) confidence += 10;
      if (activity) confidence += 10;
      confidence = Math.min(100, confidence);

      normalized.push({
        call: String(call).toUpperCase().trim(),
        frequency: freqKHz,
        band: deriveBand(freqKHz),
        mode: s.add?.mode || s.mode || s.mod || 'Unknown',
        country,
        countryCode,
        source,
        sources: [source],
        spotter: s.spotter || s.spotted_by || '',
        age_seconds: ageSeconds,
        spot_time: spotTime.toISOString(),
        confidence,
        distance,
        azimuth,
        locator,
        comments,
        activity,
        is_active: true,
      });
    }

    // Duplikate entfernen (gleicher Call + Frequenz)
    const seen = new Set();
    const unique = normalized.filter(s => {
      const key = `${s.call}_${s.frequency}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let savedCount = 0;
    if (unique.length > 0) {
      try {
        await base44.asServiceRole.entities.DxSpot.bulkCreate(unique);
        savedCount = unique.length;
      } catch (e) {
        for (const spot of unique) {
          try {
            await base44.asServiceRole.entities.DxSpot.create(spot);
            savedCount++;
          } catch {}
        }
      }
    }

    const latest = await base44.entities.DxSpot.list('-spot_time', 20);

    return Response.json({
      success: true,
      fetched: toProcess.length,
      saved: savedCount,
      spots: latest,
      warning: apiWarning,
      stationLocator,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}