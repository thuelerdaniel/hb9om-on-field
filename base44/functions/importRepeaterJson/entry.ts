import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  mapJsonRecord, getDedupKey, getBandFromFreq,
} from '../../shared/repeaterImportMapping.ts';
import { JSON_IMPORT_SOURCE_ID } from '../../shared/syncProtection.ts';

const BATCH_SIZE = 100;
const BATCH_PAUSE_MS = 100;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized — nicht angemeldet' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — nur Administratoren' }, { status: 403 });
    }

    const body = await req.json();

    // --- Action: remove JSON sync protection ---
    if (body.action === 'remove_protection') {
      const result = await base44.asServiceRole.entities.Repeater.updateMany(
        { source_id: JSON_IMPORT_SOURCE_ID },
        { $set: { source_id: 'manual' } }
      );
      return Response.json({
        status: 'success',
        message: 'JSON-Sync-Schutz aufgehoben',
        updated: (result as any)?.modifiedCount || 0,
      });
    }

    // --- Action: import (default) ---
    const jsonContent = body.json_content;
    const sourceTag = body.source_tag || 'RepeaterBook Export';
    const filename = body.filename || 'unknown.json';

    if (!jsonContent || typeof jsonContent !== 'string') {
      return Response.json({ status: 'failed', error: 'Kein JSON-Inhalt erhalten' }, { status: 400 });
    }

    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (e: any) {
      await logImport(base44, filename, sourceTag, 0, 0, 0, 0, 0, 0, 0, {}, {}, 0, 'failed',
        [`JSON Parse Error: ${e.message}`]);
      return Response.json({ status: 'failed', error: `JSON Parse Error: ${e.message}` }, { status: 400 });
    }

    // Validate structure
    if (!parsed.records || !Array.isArray(parsed.records)) {
      await logImport(base44, filename, sourceTag, 0, 0, 0, 0, 0, 0, 0, {}, {}, 0, 'failed',
        ['Invalid JSON: missing "records" array']);
      return Response.json({ status: 'failed', error: 'Invalid JSON: missing "records" array' }, { status: 400 });
    }

    if (parsed.records.length === 0) {
      await logImport(base44, filename, sourceTag, 0, 0, 0, 0, 0, 0, 0, {}, {}, 0, 'failed',
        ['Keine Records im File']);
      return Response.json({ status: 'failed', error: 'Keine Records im File' }, { status: 400 });
    }

    const startTime = Date.now();
    const records = parsed.records;
    const total = records.length;

    let importedNew = 0;
    let updated = 0;
    let skippedDuplicates = 0;
    let errors = 0;
    let withCoords = 0;
    let withoutCoords = 0;
    const byCountry: Record<string, number> = {};
    const byMode: Record<string, number> = {};
    const errorDetails: string[] = [];
    const processedKeys = new Set<string>();

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      // Map all records in batch
      const mapped: any[] = [];
      for (let j = 0; j < batch.length; j++) {
        try {
          const rec = mapJsonRecord(batch[j]);
          // Validate frequency
          if (isNaN(rec.frequency) || rec.frequency < 0 || rec.frequency > 1300) {
            throw new Error(`Ungueltige Frequenz: ${batch[j].freq_mhz}`);
          }
          mapped.push(rec);
        } catch (e: any) {
          errorDetails.push(`Record ${i + j + 1}: ${e.message}`);
          errors++;
        }
      }

      // Collect callsigns for batch lookup
      const callsigns = [...new Set(
        mapped.filter(r => r.callsign && r.callsign !== 'UNKNOWN').map(r => r.callsign)
      )];

      // Query existing repeaters with these callsigns
      const existingMap = new Map<string, any>();
      if (callsigns.length > 0) {
        const existing = await base44.asServiceRole.entities.Repeater.filter(
          { callsign: { $in: callsigns } }, 'id', 5000
        );
        for (const ex of existing) {
          const key = getDedupKey(ex);
          if (!existingMap.has(key)) existingMap.set(key, ex);
        }
      }

      // Process each mapped record
      for (const rec of mapped) {
        try {
          // Track stats
          if (rec.lat != null && rec.lng != null) withCoords++;
          else withoutCoords++;
          byCountry[rec.country_code] = (byCountry[rec.country_code] || 0) + 1;
          for (const m of rec.modes) byMode[m] = (byMode[m] || 0) + 1;

          // Intra-file dedup
          const dedupKey = getDedupKey(rec);
          if (processedKeys.has(dedupKey)) {
            skippedDuplicates++;
            continue;
          }
          processedKeys.add(dedupKey);

          const existing = existingMap.get(dedupKey);

          if (existing) {
            // --- Update existing record ---
            const updateData: any = {
              frequency: rec.frequency,
              offset_mhz: rec.offset_mhz,
              tone: rec.tone,
              location_name: rec.location_name,
              band: rec.band,
              modes: rec.modes,
              primary_mode: rec.primary_mode,
              country_code: rec.country_code,
              country: rec.country,
              source_id: JSON_IMPORT_SOURCE_ID,
            };
            if (rec.description) updateData.description = rec.description;
            if (rec.echolink_node) updateData.echolink_node = rec.echolink_node;

            // Coordinates: JSON wins if present, keep DB if JSON is null
            if (rec.lat != null && rec.lng != null) {
              updateData.lat = rec.lat;
              updateData.lng = rec.lng;
            }

            // Supplement-only fields (don't overwrite existing values)
            if (!existing.status || existing.status === 'unknown') updateData.status = 'on-air';
            if (!existing.web_url) updateData.web_url = '';
            if (!existing.fm_funknetz) updateData.fm_funknetz = false;
            if (!existing.linked_callsigns || existing.linked_callsigns.length === 0) {
              updateData.linked_callsigns = [];
            }
            if (!existing.needs_recalc) updateData.needs_recalc = false;
            if (existing.terrain_factor == null || existing.terrain_factor === 1) {
              updateData.terrain_factor = 1;
            }
            if (!existing.power_source || existing.power_source === 'unknown') {
              updateData.power_source = 'unknown';
            }
            if (!existing.has_emergency_power) updateData.has_emergency_power = false;

            await base44.asServiceRole.entities.Repeater.update(existing.id, updateData);
            updated++;
          } else {
            // --- Create new record ---
            const createData: any = { ...rec };
            for (const key of Object.keys(createData)) {
              if (createData[key] === undefined) delete createData[key];
            }
            await base44.asServiceRole.entities.Repeater.create(createData);
            importedNew++;
          }
        } catch (e: any) {
          errorDetails.push(`Fehler ${rec.callsign}: ${e.message}`);
          errors++;
        }
      }

      // Pause between batches
      if (i + BATCH_SIZE < records.length) {
        await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
      }
    }

    const duration_ms = Date.now() - startTime;
    const status = errors === 0 ? 'success' : (importedNew > 0 || updated > 0) ? 'partial' : 'failed';

    await logImport(base44, filename, sourceTag, total, importedNew, updated,
      skippedDuplicates, errors, withCoords, withoutCoords,
      byCountry, byMode, duration_ms, status, errorDetails.slice(0, 50));

    return Response.json({
      total,
      imported_new: importedNew,
      updated,
      skipped_duplicates: skippedDuplicates,
      errors,
      with_coords: withCoords,
      without_coords: withoutCoords,
      by_country: byCountry,
      by_mode: byMode,
      duration_ms,
      error_details: errorDetails.slice(0, 20),
      status,
      filename,
      cleanup: 'Datei nach Import automatisch entfernt',
    });
  } catch (error: any) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

async function logImport(
  base44: any, filename: string, sourceTag: string, total: number,
  importedNew: number, updated: number, skippedDuplicates: number, errors: number,
  withCoords: number, withoutCoords: number,
  byCountry: Record<string, number>, byMode: Record<string, number>,
  duration_ms: number, status: string, errorDetails: string[]
) {
  try {
    await base44.asServiceRole.entities.ImportLog.create({
      import_date: new Date().toISOString(),
      filename,
      mode: 'json-import',
      source_tag: sourceTag,
      total,
      imported_new: importedNew,
      updated,
      skipped_duplicates: skippedDuplicates,
      errors,
      with_coords: withCoords,
      without_coords: withoutCoords,
      by_country: byCountry,
      by_mode: byMode,
      duration_ms,
      status,
      error_details: errorDetails,
    });
  } catch {}
}