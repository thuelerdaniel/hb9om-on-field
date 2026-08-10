import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Restore Point Manager — creates, lists, restores, and deletes app-state snapshots.
// Admin-only. Stores entity data in chunks across AppSetting records (UploadFile is
// not available from backend functions). Used to roll back to a previous version's data.

// Repeater is excluded — it can be re-fetched via "Daten aktualisieren" (47s).
// ReferenceData is excluded — also re-fetchable, potentially very large.
// PrivateNode is excluded — re-fetchable via APRS.fi.
// Log/QrzLookup are user-specific (RLS protected).
const ENTITIES_TO_BACKUP = [
  'RepeaterLink',
  'ReferenceOverride',
  'AppSetting',
  'RepeaterCorrection',
  'FeatureRequest',
  'ReferenceChangeRequest',
  'SyncLog',
];

const BULK_BATCH = 500;
const CHUNK_SIZE = 10000; // 10KB per chunk — within entity field size limit

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Nur Administratoren' }, { status: 403 });

    const body = await req.json();
    const { action, label, restore_point_id } = body;

    // ─── CREATE ───
    if (action === 'create') {
      const pointLabel = label || `snapshot_${new Date().toISOString().slice(0, 16)}`;
      const timestamp = Date.now();
      const keyPrefix = `restore_point_${timestamp}`;

      const backup: any = {
        app_version: '0.8',
        created_at: new Date().toISOString(),
        label: pointLabel,
        created_by: user.full_name || user.email,
        entities: {},
      };

      for (const entityName of ENTITIES_TO_BACKUP) {
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 10000);
        backup.entities[entityName] = records.map(({ id, created_date, updated_date, created_by_id, ...rest }: any) => rest);
      }

      const counts = Object.fromEntries(
        Object.entries(backup.entities).map(([k, v]: [string, any]) => [k, v.length])
      );
      const totalRecords = Object.values(counts).reduce((a: number, b: any) => a + b, 0);

      // Serialize and split into chunks
      const backupJson = JSON.stringify(backup);
      const chunks: string[] = [];
      for (let i = 0; i < backupJson.length; i += CHUNK_SIZE) {
        chunks.push(backupJson.slice(i, i + CHUNK_SIZE));
      }

      // Store metadata record
      const metadata = JSON.stringify({
        label: pointLabel,
        created_at: backup.created_at,
        counts,
        total_records: totalRecords,
        chunk_count: chunks.length,
      });
      await base44.asServiceRole.entities.AppSetting.create({
        key: `${keyPrefix}_meta`,
        value: metadata,
        enabled: true,
      });

      // Store chunk records
      for (let i = 0; i < chunks.length; i++) {
        await base44.asServiceRole.entities.AppSetting.create({
          key: `${keyPrefix}_chunk_${i}`,
          value: chunks[i],
          enabled: true,
        });
      }

      return Response.json({
        success: true,
        id: `${keyPrefix}_meta`,
        label: pointLabel,
        counts,
        total_records: totalRecords,
        chunk_count: chunks.length,
      });
    }

    // ─── LIST ───
    if (action === 'list') {
      const all = await base44.asServiceRole.entities.AppSetting.list('-created_date', 5000);
      // Find all _meta records
      const metaRecords = all.filter(s => s.key && s.key.includes('_meta') && s.key.startsWith('restore_point_'));
      const restorePoints = metaRecords.map(s => {
        let meta: any = {};
        try { meta = JSON.parse(s.value); } catch {}
        return {
          id: s.id,
          key: s.key,
          label: meta.label || s.key,
          created_date: s.created_date,
          counts: meta.counts || {},
          total_records: meta.total_records || 0,
          chunk_count: meta.chunk_count || 0,
        };
      });
      return Response.json({ restore_points: restorePoints });
    }

    // ─── RESTORE ───
    if (action === 'restore') {
      if (!restore_point_id) return Response.json({ error: 'restore_point_id erforderlich' }, { status: 400 });

      // Get the meta record to find the key prefix
      const metaSetting = await base44.asServiceRole.entities.AppSetting.get(restore_point_id);
      const metaKey = metaSetting.key; // e.g., restore_point_12345_meta
      const keyPrefix = metaKey.replace(/_meta$/, '');

      // Get all chunk records for this restore point
      const all = await base44.asServiceRole.entities.AppSetting.list('-created_date', 5000);
      const chunkRecords = all
        .filter(s => s.key && s.key.startsWith(`${keyPrefix}_chunk_`))
        .sort((a, b) => {
          const aIdx = parseInt(a.key.match(/_chunk_(\d+)$/)?.[1] || '0');
          const bIdx = parseInt(b.key.match(/_chunk_(\d+)$/)?.[1] || '0');
          return aIdx - bIdx;
        });

      // Reassemble the JSON
      const backupJson = chunkRecords.map(s => s.value).join('');
      const backup = JSON.parse(backupJson);

      // Restore entities
      const results: any = {};
      for (const [entityName, records] of Object.entries(backup.entities || {})) {
        const recs = records as any[];
        // Clear existing records
        await base44.asServiceRole.entities[entityName].deleteMany({});
        // Restore in batches
        for (let i = 0; i < recs.length; i += BULK_BATCH) {
          const batch = recs.slice(i, i + BULK_BATCH);
          await base44.asServiceRole.entities[entityName].bulkCreate(batch);
        }
        results[entityName] = recs.length;
      }

      return Response.json({
        success: true,
        label: backup.label || 'unknown',
        restored_at: new Date().toISOString(),
        restored: results,
      });
    }

    // ─── DELETE ───
    if (action === 'delete') {
      if (!restore_point_id) return Response.json({ error: 'restore_point_id erforderlich' }, { status: 400 });

      // Get the meta record to find the key prefix
      const metaSetting = await base44.asServiceRole.entities.AppSetting.get(restore_point_id);
      const keyPrefix = metaSetting.key.replace(/_meta$/, '');

      // Delete all chunk records
      const all = await base44.asServiceRole.entities.AppSetting.list('-created_date', 5000);
      const chunkIds = all
        .filter(s => s.key && s.key.startsWith(`${keyPrefix}_chunk_`))
        .map(s => s.id);
      for (const id of chunkIds) {
        await base44.asServiceRole.entities.AppSetting.delete(id);
      }

      // Delete the meta record
      await base44.asServiceRole.entities.AppSetting.delete(restore_point_id);

      return Response.json({ success: true, deleted_chunks: chunkIds.length });
    }

    return Response.json({ error: 'Unbekannte Aktion: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});