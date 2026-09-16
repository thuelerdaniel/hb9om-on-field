import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// bulkDeleteLogs — v0.954
// Deletes Log entries by ID list OR by filter (e.g. {operator_callsign, log_type}).
// Uses service-role (bypasses RLS) for both paths.
// Called from the frontend in batches of 500 for progress tracking + cancel (IDs path),
// or with a filter object for bulk cleanup operations (filter path).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}

    const sr = base44.asServiceRole;

    // Path 1: Delete by filter (e.g. {operator_callsign, log_type}) — v0.954
    if (body.filter && typeof body.filter === 'object' && !Array.isArray(body.filter)) {
      try {
        await sr.entities.Log.deleteMany(body.filter);
        return Response.json({
          success: true,
          deleted: 0, // deleteMany doesn't return count
          errors: 0,
          filter: body.filter,
          message: 'Delete by filter ausgeführt',
        });
      } catch (e: any) {
        return Response.json({ error: e.message || String(e) }, { status: 500 });
      }
    }

    // Path 2: Delete by IDs (original behavior)
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((id: any) => typeof id === 'string' && id.length > 0)
      : [];

    if (ids.length === 0) return Response.json({ error: 'Keine IDs und kein Filter' }, { status: 400 });

    let deletedCount = 0;
    let errorCount = 0;

    // Try deleteMany with $in (much faster than individual deletes)
    try {
      await sr.entities.Log.deleteMany({ id: { $in: ids } });
      deletedCount = ids.length;
    } catch {
      // Fallback: individual deletes
      for (const id of ids) {
        try {
          await sr.entities.Log.delete(id);
          deletedCount++;
        } catch {
          errorCount++;
        }
      }
    }

    return Response.json({
      success: errorCount === 0,
      deleted: deletedCount,
      errors: errorCount,
      total: ids.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}