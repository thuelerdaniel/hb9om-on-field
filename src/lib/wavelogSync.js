// Wavelog Sync Library — v0.9022
// ADIF Konvertierung, Upload, Import, Offline Queue
// Alle API-Calls gehen ueber Backend-Function wavelogApi (vermeidet Mixed-Content)

import { base44 } from "@/api/base44Client";

// === ADIF Konvertierung: QSO → ADIF String ===
export function qsoToAdif(qso) {
  let a = '';
  const fullCall = (qso.callsign || '') + (qso.callsign_suffix || '');
  if (fullCall) a += `<call:${fullCall.length}>${fullCall}`;
  const band = qso.band || '';
  if (band) a += `<band:${band.length}>${band}`;
  const mode = qso.mode || '';
  if (mode) a += `<mode:${mode.length}>${mode}`;
  if (qso.frequency) {
    const f = String(qso.frequency);
    a += `<freq:${f.length}>${f}`;
  }
  if (qso.qso_date) {
    const d = qso.qso_date.replace(/[-:]/g, '').split('T')[0];
    a += `<qso_date:8>${d}`;
  }
  if (qso.time_start) {
    const t = qso.time_start.replace(/:/g, '').substring(0, 6);
    a += `<time_on:6>${t}`;
    if (qso.time_end) {
      const te = qso.time_end.replace(/:/g, '').substring(0, 6);
      a += `<time_off:6>${te}`;
    } else {
      a += `<time_off:6>${t}`;
    }
  }
  if (qso.rst_sent) a += `<rst_sent:${qso.rst_sent.length}>${qso.rst_sent}`;
  if (qso.rst_received) a += `<rst_rcvd:${qso.rst_received.length}>${qso.rst_received}`;
  if (qso.my_reference) {
    const ref = qso.my_reference;
    if (qso.my_reference_type === 'sota') a += `<my_sota_ref:${ref.length}>${ref}`;
    if (qso.my_reference_type === 'pota') a += `<my_pota_ref:${ref.length}>${ref}`;
    if (qso.my_reference_type === 'hbff') a += `<my_sig:${ref.length}>${ref}`;
    if (qso.my_reference_type === 'wwbota') a += `<my_sig:${ref.length}>${ref}`;
    if (qso.my_reference_type === 'castle') a += `<my_sig:${ref.length}>${ref}`;
    if (qso.my_reference_type === 'iota') a += `<my_sig_info:${ref.length}>${ref}`;
    if (qso.my_reference_type === 'lighthouse') a += `<my_sig:${ref.length}>${ref}`;
  }
  if (qso.my_grid) a += `<my_gridsquare:${qso.my_grid.length}>${qso.my_grid}`;
  if (qso.operator_name) a += `<name:${qso.operator_name.length}>${qso.operator_name}`;
  if (qso.operator_grid) a += `<gridsquare:${qso.operator_grid.length}>${qso.operator_grid}`;
  if (qso.operator_country) a += `<country:${qso.operator_country.length}>${qso.operator_country}`;
  if (qso.notes) a += `<comment:${qso.notes.length}>${qso.notes}`;
  if (qso.power != null) { const p = String(qso.power); a += `<tx_pwr:${p.length}>${p}`; }
  if (qso.is_clubstation && qso.club_callsign) a += `<station_callsign:${qso.club_callsign.length}>${qso.club_callsign}`;
  if (qso.is_clubstation && qso.club_operator_callsign) a += `<operator:${qso.club_operator_callsign.length}>${qso.club_operator_callsign}`;
  a += '<eor>';
  return a;
}

// === ADIF Parser: ADIF String → QSO-Objekte ===
export function parseAdif(adifString) {
  const qsos = [];
  // v0.9031: Remove ADIF header (everything before <EOH>) — case-insensitive
  const headerEnd = adifString.toUpperCase().indexOf('<EOH>');
  const data = headerEnd >= 0 ? adifString.substring(headerEnd + 5) : adifString;
  // v0.9031: Case-insensitive split — Wavelog exports <EOR> (uppercase), not <eor>
  const records = data.split(/<eor>/i).filter(r => r.trim());
  for (const record of records) {
    const qso = {};
    const regex = /<([^:]+):(\d+)>([^<]*)/gi;
    let match;
    while ((match = regex.exec(record)) !== null) {
      const field = match[1].toLowerCase();
      const len = parseInt(match[2]);
      const value = match[3].substring(0, len);
      switch (field) {
        case 'call': qso.callsign = value; break;
        case 'band': qso.band = value; break;
        case 'mode': qso.mode = value; break;
        case 'freq': qso.frequency = parseFloat(value); break;
        case 'qso_date': qso._qso_date_raw = value; break;
        case 'time_on': qso._time_start_raw = value; break;
        case 'time_off': qso._time_end_raw = value; break;
        case 'rst_sent': qso.rst_sent = value; break;
        case 'rst_rcvd': qso.rst_received = value; break;
        case 'my_sota_ref': qso.my_reference = value; qso.my_reference_type = 'sota'; break;
        case 'my_pota_ref': qso.my_reference = value; qso.my_reference_type = 'pota'; break;
        case 'my_sig': qso.my_reference = value; qso.my_reference_type = 'hbff'; break;
        case 'my_sig_info': qso.my_reference = value; qso.my_reference_type = 'iota'; break;
        case 'my_gridsquare': qso.my_grid = value; break;
        case 'gridsquare': qso.operator_grid = value; break;
        case 'name': qso.operator_name = value; break;
        case 'comment': qso.notes = value; break;
        case 'tx_pwr': qso.power = parseFloat(value); break;
        case 'station_callsign': qso.club_callsign = value; qso.is_clubstation = true; break;
        case 'operator': qso.club_operator_callsign = value; break;
        case 'country': qso.operator_country = value; break;
      }
    }
    // Datum/Zeit Formatierung (ADIF: YYYYMMDD, HHMMSS → ISO)
    if (qso._qso_date_raw) {
      const d = qso._qso_date_raw;
      qso.qso_date = `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
      delete qso._qso_date_raw;
    }
    if (qso._time_start_raw) {
      const t = qso._time_start_raw;
      qso.time_start = t.length >= 4
        ? `${t.substring(0, 2)}:${t.substring(2, 4)}${t.length >= 6 ? ':' + t.substring(4, 6) : ''}`
        : t;
      delete qso._time_start_raw;
    }
    if (qso._time_end_raw) {
      const te = qso._time_end_raw;
      qso.time_end = te.length >= 4
        ? `${te.substring(0, 2)}:${te.substring(2, 4)}${te.length >= 6 ? ':' + te.substring(4, 6) : ''}`
        : te;
      delete qso._time_end_raw;
    }
    if (qso.callsign) qsos.push(qso);
  }
  return qsos;
}

// === Offline Queue (localStorage) ===
const QUEUE_KEY = 'wavelog_offline_queue';

export function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch { return []; }
}

export function addToOfflineQueue(qsoId) {
  const queue = getOfflineQueue();
  if (!queue.includes(qsoId)) queue.push(qsoId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return queue.length;
}

export function removeFromOfflineQueue(qsoId) {
  const queue = getOfflineQueue().filter(id => id !== qsoId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return queue.length;
}

export function getOfflineQueueLength() {
  return getOfflineQueue().length;
}

// === Wavelog API Helper ===
async function callWavelogApi(action, config, extra = {}) {
  const res = await base44.functions.invoke('wavelogApi', {
    action,
    lan_url: config.wavelog_lan_url,
    wan_url: config.wavelog_wan_url,
    api_key: config.wavelog_api_key,
    station_id: config.wavelog_station_id,
    ...extra,
  });
  return res?.data || res;
}

// === Upload: Alle nicht gesendeten QSOs an Wavelog senden ===
export async function uploadToWavelog(config, onProgress) {
  if (!config?.wavelog_enabled || !config?.wavelog_api_key) {
    return { success: false, message: 'Wavelog nicht konfiguriert' };
  }

  // Alle QSOs laden, die noch nicht an Wavelog gesendet wurden
  const allQsos = await base44.entities.Log.list('-created_date', 500);
  const unsent = allQsos.filter(q => !q.wavelog_synced);

  if (unsent.length === 0) {
    return { success: true, message: 'Keine QSOs zum Hochladen', uploaded: 0 };
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < unsent.length; i++) {
    const qso = unsent[i];
    try {
      const adifString = qsoToAdif(qso);
      const result = await callWavelogApi('upload', config, { adif_string: adifString });
      if (result.ok && result.result?.status !== 'failed') {
        await base44.entities.Log.update(qso.id, {
          wavelog_synced: true,
          wavelog_sync_time: new Date().toISOString(),
        });
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }
    if (onProgress) onProgress(i + 1, unsent.length);
  }

  return {
    success: true,
    message: `${success} QSOs an Wavelog gesendet, ${failed} fehlgeschlagen`,
    uploaded: success,
    failed,
  };
}

// === Import: QSOs von Wavelog importieren (Delta-Sync) ===
export async function importFromWavelog(config, onProgress) {
  if (!config?.wavelog_enabled || !config?.wavelog_api_key) {
    return { success: false, message: 'Wavelog nicht konfiguriert' };
  }

  const lastFetchId = config.wavelog_last_fetch_id || 0;
  let result;
  try {
    result = await callWavelogApi('import', config, { fetchfromid: lastFetchId });
  } catch (e) {
    return { success: false, message: 'Wavelog Import fehlgeschlagen: ' + e.message };
  }

  const data = result?.result;
  if (!data || data.exported_qsos === 0 || !data.adif) {
    return { success: true, message: 'Keine neuen QSOs bei Wavelog', imported: 0, lastfetchedid: lastFetchId };
  }

  const qsos = parseAdif(data.adif);
  if (qsos.length === 0) {
    return { success: true, message: 'Keine QSOs im ADIF gefunden', imported: 0, lastfetchedid: data.lastfetchedid };
  }

  // Bestehende QSOs laden fuer Duplikat-Check
  const existing = await base44.entities.Log.list('-created_date', 500);
  // v0.9031: Dedup mit frequency — verhindert falsche Duplikat-Erkennung
  const dupKeys = new Set(existing.map(e => `${e.callsign}|${e.qso_date}|${e.time_start}|${e.frequency}`));

  // v0.9031: Batch-Import — QSOs sammeln, dann in Chunks von 100 erstellen
  const toCreate = [];
  let skipped = 0;
  for (const qso of qsos) {
    const key = `${qso.callsign}|${qso.qso_date}|${qso.time_start}|${qso.frequency}`;
    if (dupKeys.has(key)) {
      skipped++;
    } else {
      toCreate.push({
        ...qso,
        wavelog_synced: true,
        wavelog_imported: true,
        wavelog_import_date: new Date().toISOString(),
      });
      dupKeys.add(key);
    }
  }

  let imported = 0;
  const BATCH_SIZE = 100;
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE);
    try {
      await base44.entities.Log.bulkCreate(batch);
      imported += batch.length;
    } catch (e) {
      console.error('[Wavelog Import] Batch failed, falling back to individual:', e);
      for (const qso of batch) {
        try {
          await base44.entities.Log.create(qso);
          imported++;
        } catch (e2) {
          console.error('[Wavelog Import] Single create failed:', qso.callsign, e2);
        }
      }
    }
    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, toCreate.length), qsos.length);
  }

  return {
    success: true,
    message: `${imported} QSOs von Wavelog importiert, ${skipped} Duplikate übersprungen`,
    imported,
    skipped,
    lastfetchedid: data.lastfetchedid,
  };
}

// === Single QSO an Wavelog senden (fuer Auto-Sync) ===
export async function sendQsoToWavelog(qso, config) {
  if (!config?.wavelog_enabled || !config?.wavelog_api_key || !config?.wavelog_station_id) {
    return { success: false, reason: 'Nicht konfiguriert' };
  }
  try {
    const adifString = qsoToAdif(qso);
    const result = await callWavelogApi('upload', config, { adif_string: adifString });
    if (result.ok && result.result?.status !== 'failed') {
      await base44.entities.Log.update(qso.id, {
        wavelog_synced: true,
        wavelog_sync_time: new Date().toISOString(),
      });
      return { success: true };
    }
    return { success: false, reason: result.result?.reason || 'API-Fehler' };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

// === Offline Queue abarbeiten ===
export async function processWavelogOfflineQueue(config) {
  if (!navigator.onLine) return;
  if (!config?.wavelog_enabled || !config?.wavelog_auto_sync) return;

  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  const remaining = [];
  let synced = 0;

  for (const qsoId of queue) {
    try {
      const qso = await base44.entities.Log.get(qsoId);
      if (!qso || qso.wavelog_synced) continue;
      const result = await sendQsoToWavelog(qso, config);
      if (result.success) {
        synced++;
      } else {
        remaining.push(qsoId);
      }
    } catch (e) {
      remaining.push(qsoId);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { synced, remaining: remaining.length };
}

// === Test Connection ===
export async function testWavelogConnection(config) {
  try {
    const result = await callWavelogApi('test', config);
    return result;
  } catch (e) {
    return { connected: false, error: e.message };
  }
}

// === Get Stations ===
export async function getWavelogStations(config) {
  try {
    const result = await callWavelogApi('stations', config);
    return result;
  } catch (e) {
    return { error: e.message };
  }
}