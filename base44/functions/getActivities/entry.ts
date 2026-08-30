import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Lade alle ActivitySpot-Einträge und teile sie in LIVE und ALERTS.
// Fix v0.9016: Strikte Trennung von Live-Spots und geplanten Aktivierungen.
//   liveSpots: alle Live-Spots (SOTA, POTA, WWFF, WWBOTA, andere) — QRT gefiltert
//   alerts:   alle geplanten Aktivierungen (SOTA-Alerts + WWFF-Agendas)
// WWFF Agendas: spots.wwff.co/static/agendas_active.json
// SOTA API: api-db2.sota.org.uk mit ?client=sotawatch&user=anon

const SOTA_BASE = 'https://api-db2.sota.org.uk';
const WWFF_AGENDAS_URL = 'https://spots.wwff.co/static/agendas_active.json';
const UA = 'HB9OM-On-Field/1.0';
const SPOTS_QUERY = '?client=sotawatch&user=anon';

function isQRT(spot: any): boolean {
  const comments = (spot.comments || '').toUpperCase();
  if (comments.includes('QRT')) return true;
  if (!spot.frequency || spot.frequency === 0) return true;
  return false;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const includeFuture = body.include_future === true;

    // Alle ActivitySpots laden
    let spots: any[] = [];
    try {
      spots = await base44.entities.ActivitySpot.list('-spot_time', 500);
    } catch {}

    // LLOTA-Spots separat laden — sie werden sonst vom 500-Limit verdrängt
    // weil SOTA/POTA/DX deutlich mehr Spots pro Zeiteinheit haben.
    try {
      const llotaSpots = await base44.entities.ActivitySpot.filter({ activity_type: 'LLOTA' }, '-spot_time', 200);
      if (llotaSpots && llotaSpots.length > 0) {
        const existingIds = new Set(spots.map(s => s.id));
        for (const ls of llotaSpots) {
          if (!existingIds.has(ls.id)) spots.push(ls);
        }
      }
    } catch {}

    // Fix v0.9016: Strikte Trennung Live vs Alerts
    // Live: nicht is_future, nicht SOTA-ALERT, nicht QRT, frequency > 0
    let liveSpots = spots.filter(s =>
      !s.is_future &&
      s.activity_type !== 'SOTA-ALERT' &&
      !isQRT(s)
    );

    // Alerts aus DB (is_future oder SOTA-ALERT)
    const dbAlerts = spots.filter(s =>
      s.is_future || s.activity_type === 'SOTA-ALERT'
    );

    // Falls keine Live-SOTA-Spots in DB: direkt von SOTA API laden
    const hasLiveSota = liveSpots.some(s => s.activity_type === 'SOTA');
    if (!hasLiveSota) {
      const spotsUrl = `${SOTA_BASE}/api/spots/200/all/all${SPOTS_QUERY}`;
      const sotaUrls = [
        spotsUrl,
        `https://corsproxy.io/?url=${encodeURIComponent(spotsUrl)}`,
      ];
      for (const url of sotaUrls) {
        try {
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': UA },
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) {
            const raw = await resp.json();
            // Fix v0.9016: QRT-Filter + RBNHOLE-Filter
            const sotaSpots = Array.isArray(raw) ? raw.filter((s: any) =>
              s.activatorCallsign && s.frequency &&
              s.callsign !== 'RBNHOLE' &&
              s.type !== 'DEPRECATED' &&
              !(s.comments && s.comments.toUpperCase().includes('QRT'))
            ) : [];
            console.log('[SOTA] Live spots received:', sotaSpots.length);
            // SotaPoint-Lookup nur für Spots ohne lat/lon
            const refCoordMap = new Map<string, { lat: number; lon: number }>();
            for (const s of sotaSpots) {
              if (s.latitude == null || s.longitude == null) {
                const ref = s.summitCode || '';
                if (ref && !refCoordMap.has(ref)) {
                  try {
                    const points = await base44.asServiceRole.entities.SotaPoint.filter({ code: ref });
                    if (points && points.length > 0 && points[0].lat != null) {
                      refCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng) });
                    }
                  } catch {}
                }
              }
            }
            const liveSota = sotaSpots.map((s: any) => {
              const frequency = Number(s.frequency) * 1000;
              const spotTime = s.timeStamp ? new Date(s.timeStamp) : new Date();
              const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
              const ref = s.summitCode || '';
              const fallback = ref ? refCoordMap.get(ref) : undefined;
              return {
                call: s.activatorCallsign,
                activity_type: 'SOTA',
                reference: ref,
                name: s.summitName || s.summitDetails || '',
                frequency,
                band: '',
                mode: s.mode || 'CW',
                latitude: s.latitude != null ? Number(s.latitude) : fallback?.lat,
                longitude: s.longitude != null ? Number(s.longitude) : fallback?.lon,
                comments: s.comments || '',
                spotter: s.callsign || '',
                source: 'SOTA API (live)',
                spot_time: spotTime.toISOString(),
                age_seconds: ageSeconds,
                distance: null,
                azimuth: null,
                is_active: true,
              };
            });
            liveSpots = [...liveSpots, ...liveSota];
            break;
          }
        } catch {}
      }
    }

    // SOTA-Alerts (geplante Aktivierungen) von API
    let sotaAlerts: any[] = [];
    let sotaAlertsAvailable = false;
    if (includeFuture) {
      const alertUrl = `${SOTA_BASE}/api/alerts/100/all/all${SPOTS_QUERY}`;
      const alertUrls = [
        alertUrl,
        `https://corsproxy.io/?url=${encodeURIComponent(alertUrl)}`,
      ];
      for (const url of alertUrls) {
        try {
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': UA },
            signal: AbortSignal.timeout(15000),
          });
          if (resp.ok) {
            sotaAlertsAvailable = true;
            const raw = await resp.json();
            const alertList = Array.isArray(raw) ? raw.filter((a: any) =>
              a.activatingCallsign &&
              a.summitDetails !== 'Unrecognized summit'
            ) : [];
            const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
            for (const a of alertList) {
              const ref = a.associationCode && a.summitCode ? `${a.associationCode}/${a.summitCode}` : '';
              if (ref && !refCoordMap.has(ref)) {
                try {
                  const points = await base44.asServiceRole.entities.SotaPoint.filter({ code: ref });
                  if (points && points.length > 0 && points[0].lat != null) {
                    refCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng), name: points[0].name || '' });
                  }
                } catch {}
              }
            }
            sotaAlerts = alertList.map((a: any) => {
              const ref = a.associationCode && a.summitCode ? `${a.associationCode}/${a.summitCode}` : '';
              const coords = refCoordMap.get(ref);
              return {
                call: a.activatingCallsign || '',
                activity_type: 'SOTA-ALERT',
                reference: ref,
                name: coords?.name || a.summitDetails || '',
                frequency: 0,
                mode: a.mode || '',
                spot_time: a.dateActivated ? new Date(a.dateActivated).toISOString() : null,
                is_future: true,
                latitude: coords?.lat,
                longitude: coords?.lon,
                is_active: false,
                source: 'SOTA-Alerts',
              };
            }).filter((s: any) => s.call);
            break;
          }
        } catch {}
      }
    }

    // Fix v0.9016: WWFF Agendas (geplante WWFF-Aktivierungen)
    let wwffAgendas: any[] = [];
    try {
      const resp = await fetch(WWFF_AGENDAS_URL, {
        headers: { 'Accept': 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const raw = await resp.json();
        if (Array.isArray(raw)) {
          wwffAgendas = raw.map((a: any) => ({
            call: a.activator_call || '',
            activity_type: 'WWFF-ALERT',
            reference: a.reference || '',
            name: '',
            frequency: 0,
            mode: a.mode || '',
            spot_time: a.utc_start ? new Date(a.utc_start).toISOString() : null,
            comments: a.remarks || (a.band ? `Band: ${a.band}` : ''),
            spotter: a.poster || '',
            source: 'WWFF-Agenda',
            is_active: false,
            is_future: true,
          })).filter((s: any) => s.call && s.reference);
          console.log('[WWFF] Agendas received:', wwffAgendas.length);
        }
      }
    } catch (e: any) {
      console.log('[WWFF] Agendas fetch failed:', e.message);
    }

    // LLOTA-Alerts (geplante LLOTA-Aktivierungen) von llota.app HTML-Seite
    // Die Webseite hat keine JSON-API — die geplanten Aktivierungen werden als HTML-Tabelle gerendert.
    let llotaAlerts: any[] = [];
    try {
      const resp = await fetch('https://llota.app/scheduled_activations.html', {
        headers: { 'Accept': 'text/html', 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const html = await resp.text();
        const refCodeRegex = /\bLL[A-Z]{2}-\d{4}\b/;
        const userLinkRegex = /llota\.app\/user\/([^"'<\s]+)/i;
        const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/;
        const timeRegex = /(\d{2}):(\d{2})\s*UTC/i;
        const modeRegex = /\b(SSB|CW|FT8|FM|AM)\b/i;

        const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        for (const row of rows) {
          const refMatch = row.match(refCodeRegex);
          if (!refMatch) continue;
          const reference = refMatch[0];

          const userMatch = row.match(userLinkRegex);
          const call = userMatch ? decodeURIComponent(userMatch[1]).trim() : '';
          if (!call) continue;

          // Extract td cells
          const tds: string[] = [];
          const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
          let tdMatch;
          while ((tdMatch = tdRe.exec(row)) !== null) {
            tds.push(tdMatch[1]);
          }

          // Date/time from first td
          const dateMatch = row.match(dateRegex);
          const timeMatch = row.match(timeRegex);
          let spotTime: string | null = null;
          if (dateMatch) {
            const [, dd, mm, yyyy] = dateMatch;
            const hh = timeMatch ? timeMatch[1] : '00';
            const min = timeMatch ? timeMatch[2] : '00';
            spotTime = `${yyyy}-${mm}-${dd}T${hh}:${min}:00.000Z`;
          }

          // Reference name from 2nd td (strip HTML, remove ref code)
          let refName = '';
          if (tds[1]) {
            const clean = tds[1].replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
            refName = clean.replace(reference, '').trim();
          }

          // Freqs/modes from 4th td
          let freqsModes = '';
          if (tds[3]) {
            freqsModes = tds[3].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          const modeMatch = freqsModes.match(modeRegex);
          const mode = modeMatch ? modeMatch[1] : freqsModes || '';

          // Comments from 5th td
          let comments = '';
          if (tds[4]) {
            const clean = tds[4].replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
            if (clean && clean !== '--' && !clean.startsWith(reference)) {
              comments = clean;
            }
          }

          llotaAlerts.push({
            call,
            activity_type: 'LLOTA-ALERT',
            reference,
            name: refName,
            frequency: 0,
            mode,
            spot_time: spotTime,
            comments: comments || freqsModes,
            spotter: '',
            source: 'LLOTA (llota.app)',
            is_active: false,
            is_future: true,
          });
        }

        // Enrich with coordinates from LlotaRef
        if (llotaAlerts.length > 0) {
          const refCodes = [...new Set(llotaAlerts.map(a => a.reference))];
          const refMap = new Map<string, { lat: number; lng: number; name: string }>();
          for (const code of refCodes) {
            try {
              const refs = await base44.asServiceRole.entities.LlotaRef.filter({ code });
              if (refs && refs.length > 0 && refs[0].lat != null) {
                refMap.set(code, { lat: Number(refs[0].lat), lng: Number(refs[0].lng), name: refs[0].name || '' });
              }
            } catch {}
          }
          llotaAlerts = llotaAlerts.map(a => {
            const refData = refMap.get(a.reference);
            if (refData) {
              return { ...a, name: a.name || refData.name, latitude: refData.lat, longitude: refData.lng };
            }
            return a;
          });
        }

        console.log('[LLOTA] Alerts received:', llotaAlerts.length);
      }
    } catch (e: any) {
      console.log('[LLOTA] Alerts fetch failed:', e.message);
    }

    // Alle Alerts kombiniert: DB-Alerts + SOTA-Alerts + WWFF-Agendas + LLOTA-Alerts
    const allAlerts = [...dbAlerts, ...sotaAlerts, ...wwffAgendas, ...llotaAlerts];

    console.log('[Activities] Live:', liveSpots.length, 'Alerts:', allAlerts.length);

    return Response.json({
      success: true,
      liveSpots,
      alerts: allAlerts,
      liveTotal: liveSpots.length,
      alertsTotal: allAlerts.length,
      sotaAlertsAvailable,
      // Backward-compat: keep old fields for any other consumers
      sota: liveSpots.filter(s => s.activity_type === 'SOTA'),
      pota: liveSpots.filter(s => s.activity_type === 'POTA'),
      wwff: liveSpots.filter(s => s.activity_type === 'WWFF'),
      wwbota: liveSpots.filter(s => s.activity_type === 'WWBOTA'),
      gma: liveSpots.filter(s => s.activity_type === 'GMA'),
      other: liveSpots.filter(s => !['SOTA', 'POTA', 'WWFF', 'WWBOTA', 'GMA'].includes(s.activity_type)),
      total: liveSpots.length,
      futureTotal: allAlerts.length,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}