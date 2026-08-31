// deduplicateTotaPoints — Removes duplicate TotaPoint records by code.
// Keeps the oldest record (smallest created_date) for each code, deletes the rest.
// Admin-only function for one-time cleanup and future maintenance.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;

    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run || false;

    // Phase 1: Load all TotaPoints in batches, find duplicates by code
    const allRecords: any[] = [];
    let skip = 0;
    const limit = 500;
    let hasMore = true;
    while (hasMore) {
      const batch = await admin.entities.TotaPoint.list('-created_date', limit, skip);
      if (!batch || batch.length === 0) break;
      allRecords.push(...batch);
      skip += limit;
      hasMore = batch.length === limit;
    }

    // Group by code, keep oldest (smallest created_date), collect duplicate IDs
    const codeMap: Record<string, { id: string; created_date: string }> = {};
    const toDelete: string[] = [];

    for (const r of allRecords) {
      if (!r.code) continue;
      if (codeMap[r.code]) {
        const existing = codeMap[r.code];
        if (r.created_date > existing.created_date) {
          toDelete.push(r.id);
        } else {
          toDelete.push(existing.id);
          codeMap[r.code] = { id: r.id, created_date: r.created_date };
        }
      } else {
        codeMap[r.code] = { id: r.id, created_date: r.created_date };
      }
    }

    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        total_scanned: allRecords.length,
        unique_codes: Object.keys(codeMap).length,
        duplicates_found: toDelete.length,
      });
    }

    // Phase 2: Delete duplicates in batches using deleteMany with $in
    let deletedCount = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      try {
        await admin.entities.TotaPoint.deleteMany({ id: { $in: chunk } });
        deletedCount += chunk.length;
      } catch {
        // Fallback: individual deletes
        for (const id of chunk) {
          try { await admin.entities.TotaPoint.delete(id); deletedCount++; } catch {}
        }
      }
    }

    return Response.json({
      success: true,
      total_scanned: allRecords.length,
      unique_codes: Object.keys(codeMap).length,
      duplicates_found: toDelete.length,
      duplicates_deleted: deletedCount,
    });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}