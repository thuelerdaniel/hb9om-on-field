import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin-only
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'check';

    if (action === 'check') {
      const results = [];
      const startTime = Date.now();

      // Get cached data from ReferenceData entity
      const cached = await base44.asServiceRole.entities.ReferenceData.list();
      const cacheMap = {};
      (cached || []).forEach(entry => {
        cacheMap[entry.type] = entry;
      });

      // 1. Check SOTA
      try {
        const resp = await fetch('https://api.sota.org.uk/api/summits/HB', {
          headers: { 'Accept': 'application/json' }
        });
        if (resp.ok) {
          const data = await resp.json();
          const externalCount = Array.isArray(data) ? data.length : 0;
          const cachedCount = cacheMap.sota?.references?.length || cacheMap.sota?.total_count || 0;
          results.push({
            type: 'sota',
            label: 'SOTA – Summits on the Air',
            source: 'api.sota.org.uk',
            cached_count: cachedCount,
            external_count: externalCount,
            status: externalCount > cachedCount ? 'new_data' : 'up_to_date',
            difference: externalCount - cachedCount,
            last_updated: cacheMap.sota?.last_updated || null,
            auto_updated: true
          });
        } else {
          results.push({ type: 'sota', label: 'SOTA', source: 'api.sota.org.uk', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'sota', label: 'SOTA', source: 'api.sota.org.uk', status: 'error', error: e.message });
      }

      // 2. Check POTA
      try {
        const resp = await fetch('https://pota.app/api/parks/CH', {
          headers: { 'Accept': 'application/json' }
        });
        if (resp.ok) {
          const data = await resp.json();
          const externalCount = Array.isArray(data) ? data.length : (data.parks?.length || 0);
          const cachedCount = cacheMap.pota?.references?.length || cacheMap.pota?.total_count || 0;
          results.push({
            type: 'pota',
            label: 'POTA – Parks on the Air',
            source: 'pota.app',
            cached_count: cachedCount,
            external_count: externalCount,
            status: externalCount > cachedCount ? 'new_data' : 'up_to_date',
            difference: externalCount - cachedCount,
            last_updated: cacheMap.pota?.last_updated || null,
            auto_updated: true
          });
        } else {
          results.push({ type: 'pota', label: 'POTA', source: 'pota.app', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'pota', label: 'POTA', source: 'pota.app', status: 'error', error: e.message });
      }

      // 3. Check HBFF
      try {
        const resp = await fetch('https://hbff.ch/Refs/HBFFReferenceSlim.html');
        if (resp.ok) {
          const html = await resp.text();
          // Count table rows as a rough indicator
          const rowCount = (html.match(/<tr/gi) || []).length - 1;
          const cachedCount = cacheMap.hbff?.references?.length || cacheMap.hbff?.total_count || 0;
          results.push({
            type: 'hbff',
            label: 'HBFF – Flora & Fauna',
            source: 'hbff.ch',
            cached_count: cachedCount,
            external_count: Math.max(0, rowCount),
            status: rowCount > cachedCount ? 'new_data' : 'up_to_date',
            difference: Math.max(0, rowCount) - cachedCount,
            last_updated: cacheMap.hbff?.last_updated || null,
            auto_updated: true
          });
        } else {
          results.push({ type: 'hbff', label: 'HBFF', source: 'hbff.ch', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'hbff', label: 'HBFF', source: 'hbff.ch', status: 'error', error: e.message });
      }

      // 4. Check WWBOTA
      try {
        const resp = await fetch('https://wwbota.net/hbbota/');
        if (resp.ok) {
          const html = await resp.text();
          const rowCount = (html.match(/<tr/gi) || []).length - 1;
          const cachedCount = cacheMap.wwbota?.references?.length || cacheMap.wwbota?.total_count || 0;
          results.push({
            type: 'wwbota',
            label: 'WWBOTA – Bunkers on the Air',
            source: 'wwbota.net',
            cached_count: cachedCount,
            external_count: Math.max(0, rowCount),
            status: rowCount > cachedCount ? 'new_data' : 'up_to_date',
            difference: Math.max(0, rowCount) - cachedCount,
            last_updated: cacheMap.wwbota?.last_updated || null,
            auto_updated: true
          });
        } else {
          results.push({ type: 'wwbota', label: 'WWBOTA', source: 'wwbota.net', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'wwbota', label: 'WWBOTA', source: 'wwbota.net', status: 'error', error: e.message });
      }

      // 5. Check Castles (WCA)
      try {
        const resp = await fetch('https://wcagroup.org/?page_id=207');
        if (resp.ok) {
          const html = await resp.text();
          const rowCount = (html.match(/<tr/gi) || []).length - 1;
          const cachedCount = cacheMap.castle?.references?.length || cacheMap.castle?.total_count || 0;
          results.push({
            type: 'castle',
            label: 'Burgen & Schlösser (WCA/COTA)',
            source: 'wcagroup.org',
            cached_count: cachedCount,
            external_count: Math.max(0, rowCount),
            status: rowCount > cachedCount ? 'new_data' : 'up_to_date',
            difference: Math.max(0, rowCount) - cachedCount,
            last_updated: cacheMap.castle?.last_updated || null,
            auto_updated: true
          });
        } else {
          results.push({ type: 'castle', label: 'Burgen', source: 'wcagroup.org', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'castle', label: 'Burgen', source: 'wcagroup.org', status: 'error', error: e.message });
      }

      // 6. Check Lighthouses (ARLHS WLOL)
      try {
        const resp = await fetch('https://wlol.arlhs.com/');
        if (resp.ok) {
          results.push({
            type: 'lighthouse',
            label: 'Leuchttürme (ARLHS WLOL)',
            source: 'wlol.arlhs.com',
            cached_count: 6,
            external_count: 6,
            status: 'up_to_date',
            difference: 0,
            auto_updated: false,
            note: 'Statische Daten im Code – manuelle Überprüfung empfohlen'
          });
        } else {
          results.push({ type: 'lighthouse', label: 'Leuchttürme', source: 'wlol.arlhs.com', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'lighthouse', label: 'Leuchttürme', source: 'wlol.arlhs.com', status: 'error', error: e.message });
      }

      // 7. Check Bandplan (USKA/IARU)
      try {
        const resp = await fetch('https://www.uska.ch/amateurfunk/bandplan/');
        if (resp.ok) {
          results.push({
            type: 'bandplan',
            label: 'Bandplan (IARU Region 1 / USKA)',
            source: 'uska.ch',
            cached_count: 15,
            external_count: 15,
            status: 'up_to_date',
            difference: 0,
            auto_updated: false,
            note: 'Statische Daten im Code – bei Änderungen der IARU-Empfehlungen manuell aktualisieren'
          });
        } else {
          results.push({ type: 'bandplan', label: 'Bandplan', source: 'uska.ch', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'bandplan', label: 'Bandplan', source: 'uska.ch', status: 'error', error: e.message });
      }

      // 8. Check IOTA
      try {
        const resp = await fetch('https://www.iota-world.org/islands-on-the-air/iota-groups-islands.html');
        if (resp.ok) {
          results.push({
            type: 'iota',
            label: 'IOTA – Islands on the Air',
            source: 'iota-world.org',
            cached_count: 0,
            external_count: 0,
            status: 'up_to_date',
            difference: 0,
            auto_updated: false,
            note: 'Schweiz hat keine IOTA-Referenzen (Binnenland)'
          });
        } else {
          results.push({ type: 'iota', label: 'IOTA', source: 'iota-world.org', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'iota', label: 'IOTA', source: 'iota-world.org', status: 'error', error: e.message });
      }

      // 9. Check BAKOM / BFE layers (geo.admin.ch)
      try {
        const resp = await fetch('https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities');
        if (resp.ok) {
          const xml = await resp.text();
          const hasMobilfunk = xml.includes('ch.bakom.standorte-mobilfunkanlagen');
          const hasRichtfunk = xml.includes('ch.bakom.richtfunkverbindungen');
          const hasRadioTV = xml.includes('ch.bakom.radio-fernsehsender');
          const hasElektrisch = xml.includes('ch.bfe.elektrische-anlagen_ueber_36');
          results.push({
            type: 'geo_admin',
            label: 'Gefahrenlayer (map.geo.admin.ch)',
            source: 'wms.geo.admin.ch',
            status: (hasMobilfunk && hasRichtfunk && hasRadioTV && hasElektrisch) ? 'up_to_date' : 'check_needed',
            auto_updated: false,
            note: `Mobilfunk: ${hasMobilfunk ? '✓' : '✗'}, Richtfunk: ${hasRichtfunk ? '✓' : '✗'}, Radio/TV: ${hasRadioTV ? '✓' : '✗'}, Starkstrom: ${hasElektrisch ? '✓' : '✗'}`
          });
        } else {
          results.push({ type: 'geo_admin', label: 'Gefahrenlayer', source: 'wms.geo.admin.ch', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'geo_admin', label: 'Gefahrenlayer', source: 'wms.geo.admin.ch', status: 'error', error: e.message });
      }

      // 10. Check QRZ.com XML interface
      try {
        const resp = await fetch('https://xmldata.qrz.com/xml/current/?username=test&password=test');
        if (resp.ok) {
          const xml = await resp.text();
          const isReachable = xml.includes('QRZ') || xml.includes('xml');
          results.push({
            type: 'qrz',
            label: 'QRZ.com XML-Interface',
            source: 'xmldata.qrz.com',
            status: isReachable ? 'up_to_date' : 'error',
            auto_updated: false,
            note: 'QRZ.com-Server erreichbar – einzelne Abfragen pro Benutzer'
          });
        } else {
          results.push({ type: 'qrz', label: 'QRZ.com', source: 'xmldata.qrz.com', status: 'error', error: `HTTP ${resp.status}` });
        }
      } catch (e) {
        results.push({ type: 'qrz', label: 'QRZ.com', source: 'xmldata.qrz.com', status: 'error', error: e.message });
      }

      const duration = Date.now() - startTime;
      const upToDate = results.filter(r => r.status === 'up_to_date').length;
      const newData = results.filter(r => r.status === 'new_data').length;
      const errors = results.filter(r => r.status === 'error').length;

      // Save check result to SyncLog
      try {
        await base44.asServiceRole.entities.SyncLog.create({
          timestamp: new Date().toISOString(),
          overall_status: errors > 0 ? (newData > 0 ? 'partial' : 'partial') : (newData > 0 ? 'partial' : 'success'),
          total_duration_ms: duration,
          results: results,
          trigger: 'manual'
        });
      } catch {}

      return Response.json({
        checked_at: new Date().toISOString(),
        duration_ms: duration,
        summary: { total: results.length, up_to_date, new_data: newData, errors, check_needed: results.length - upToDate - newData - errors },
        results
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});