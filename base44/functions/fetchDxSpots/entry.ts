import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";

// Lade aktuelle DX-Spots von DX Summit, normalisiere und speichere in DxSpot Entity.
// Lösche Spots älter als 1 Stunde vor dem Speichern neuer Spots.
// Lade max 50 Spots, gib die neuesten 20 zurück.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Scheduled runs have no user context — skip auth. Manual runs require login.
    if (body.scheduled !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // DX Summit API liefert aktuelle Spots
    let spots = [];
    let apiWarning = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch('https://www.dxsummit.fi/api/v1/spots', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const raw = await resp.json();
        spots = Array.isArray(raw) ? raw : (raw.spots || raw.data || []);
      } else {
        apiWarning = `DX Summit API Status ${resp.status}`;
      }
    } catch (e) {
      apiWarning = 'DX Summit API nicht erreichbar — Timeout oder Netzwerkfehler';
    }

    // Max 50 Spots verarbeiten
    const toProcess = spots.slice(0, 50);

    // Alte Spots löschen (> 1 Stunde)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    try {
      await base44.asServiceRole.entities.DxSpot.deleteMany({
        spot_time: { $lt: oneHourAgo },
      });
    } catch (e) {
      // Falls deleteMany mit Datumsfilter nicht unterstützt wird, ignoriere
    }

    const now = Date.now();
    const normalized = [];
    for (const s of toProcess) {
      // DX Summit Felder: frequency (kHz), call, spotter, time, mode (optional)
      const freqKHz = Number(s.frequency || s.freq || 0);
      if (!freqKHz || !s.call) continue;

      // Zeit parsen — DX Summit liefert Unix-Sekunden oder ISO-String
      let spotTime: Date;
      if (s.time) {
        const t = Number(s.time);
        spotTime = !isNaN(t) && t > 1e9
          ? new Date(t * 1000)
          : new Date(s.time);
      } else if (s.spotted_at) {
        spotTime = new Date(s.spotted_at);
      } else {
        spotTime = new Date();
      }

      const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));

      normalized.push({
        call: String(s.call).toUpperCase().trim(),
        frequency: freqKHz,
        band: deriveBand(freqKHz),
        mode: s.mode || s.mod || 'Unknown',
        country: s.country || s.dxcc || '',
        source: 'DX Summit',
        spotter: s.spotter || s.spotted_by || '',
        spot_time: spotTime.toISOString(),
        age_seconds: ageSeconds,
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

    // Speichern via service role (DxSpot ist admin-create)
    let savedCount = 0;
    if (unique.length > 0) {
      try {
        await base44.asServiceRole.entities.DxSpot.bulkCreate(unique);
        savedCount = unique.length;
      } catch (e) {
        // Falls bulkCreate fehlschlägt, versuche einzelne Creates
        for (const spot of unique) {
          try {
            await base44.asServiceRole.entities.DxSpot.create(spot);
            savedCount++;
          } catch {}
        }
      }
    }

    // Neueste 20 zurückgeben (sortiert nach spot_time absteigend)
    const latest = await base44.entities.DxSpot.list('-spot_time', 20);

    return Response.json({
      success: true,
      fetched: toProcess.length,
      saved: savedCount,
      spots: latest,
      warning: apiWarning,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}