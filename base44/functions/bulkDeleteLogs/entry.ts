import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// bulkDeleteLogs — v0.9018
// Deletes a batch of Log entries by ID using service-role (bypasses RLS).
// Called repeatedly from the frontend in batches of 500 for progress tracking + cancel.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}

    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((id: any) => typeof id === 'string' && id.length > 0)
      : [];

    if (ids.length === 0) return Response.json({ error: 'Keine IDs' }, { status: 400 });

    const sr = base44.asServiceRole;
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