import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// deleteAllFilteredLogs — v0.953 Fix 4
// Deletes ALL log entries matching the given filter criteria using service-role.
// Loops with pagination until 0 matching records remain — fixes the "partial delete"
// bug where only the currently loaded page was deleted.
//
// Check order documentation (v0.953 Fix 1):
//   Button-Klick → Import-Lauf ohne jede Pause-Prüfung (this function)
//   Scheduler    → prüft Pause-Flags vor Aufruf
//
// Filter criteria matches the frontend Log.jsx filter logic:
//   filterSource: all | private | club  (maps to log_type)
//   filterType:   reference type (my_reference_type)
//   filterStatus: active | archived | all
//   filterDateFrom / filterDateTo: qso_date range (YYYY-MM-DD)

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}

    const filterSource = body.filterSource || 'all';
    const filterType = body.filterType || 'all';
    const filterStatus = body.filterStatus || 'all';
    const filterDateFrom = body.filterDateFrom || '';
    const filterDateTo = body.filterDateTo || '';

    // Build query — scope to user's visible set (own records + club records, matching read RLS)
    const query: any = {
      $or: [{ created_by_id: user.id }, { is_clubstation: true }],
    };

    // log_type filter (matches frontend isClubQso: log_type === 'club')
    if (filterSource === 'private') {
      query.log_type = { $ne: 'club' };
    } else if (filterSource === 'club') {
      query.log_type = 'club';
    }

    if (filterType !== 'all') query.my_reference_type = filterType;
    if (filterStatus !== 'all') query.status = filterStatus;

    // Date range (string comparison works for YYYY-MM-DD)
    if (filterDateFrom || filterDateTo) {
      query.qso_date = {};
      if (filterDateFrom) query.qso_date.$gte = filterDateFrom;
      if (filterDateTo) query.qso_date.$lte = filterDateTo;
    }

    const sr = base44.asServiceRole;
    let totalDeleted = 0;
    let totalErrors = 0;
    const MAX_ITERATIONS = 200; // Safety limit: max 100,000 records
    const BATCH_SIZE = 500;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      // Query matching records (first page only — after deletion, remaining records shift to the front)
      let batch: any[] = [];
      try {
        batch = await sr.entities.Log.filter(query, '-created_date', BATCH_SIZE, 0);
      } catch {
        break;
      }
      if (!Array.isArray(batch) || batch.length === 0) break;

      const ids = batch.map((r: any) => r.id);

      // Delete this batch via deleteMany (service-role, bypasses RLS)
      try {
        await sr.entities.Log.deleteMany({ id: { $in: ids } });
        totalDeleted += ids.length;
      } catch {
        // Fallback: individual deletes
        for (const id of ids) {
          try {
            await sr.entities.Log.delete(id);
            totalDeleted++;
          } catch {
            totalErrors++;
          }
        }
      }

      // If last batch was smaller than BATCH_SIZE, we're done
      if (batch.length < BATCH_SIZE) break;
    }

    // Verify: query again to confirm 0 remain
    let remaining = 0;
    try {
      const verify = await sr.entities.Log.filter(query, '-created_date', 1, 0);
      remaining = Array.isArray(verify) ? verify.length : 0;
    } catch {}

    return Response.json({
      success: totalErrors === 0,
      deleted: totalDeleted,
      errors: totalErrors,
      remaining,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}