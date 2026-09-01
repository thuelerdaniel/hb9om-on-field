import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// deleteUserLogEntries — v0.9018 NACHFOLGE
// Deletes Log entries via service-role (admin), bypassing RLS.
// This is needed because Wavelog-imported entries are created by the service-role
// (created_by_id = service user), so the normal user-token delete fails with RLS.
//
// Parameters:
//   ids: string[]           — specific Log record IDs to delete (preferred)
//   callsign: string        — delete ALL entries matching this club_callsign
//   operator_email: string  — delete ALL entries matching this operator_email
//
// Returns { success, deletedCount, message }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}

    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((id: any) => typeof id === 'string' && id.length > 0) : [];
    const callsign: string = body.callsign || '';
    const operatorEmail: string = body.operator_email || '';

    if (ids.length === 0 && !callsign && !operatorEmail) {
      return Response.json({ error: 'ids, callsign oder operator_email erforderlich' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    let deletedCount = 0;
    let errorCount = 0;

    // Mode 1: Delete by specific IDs (used by the single/bulk delete buttons)
    if (ids.length > 0) {
      for (const id of ids) {
        try {
          await sr.entities.Log.delete(id);
          deletedCount++;
        } catch {
          errorCount++;
        }
      }
      return Response.json({
        success: errorCount === 0,
        deletedCount,
        errorCount,
        message: `${deletedCount} Eintrag${deletedCount !== 1 ? 'e' : ''} gelöscht${errorCount > 0 ? `, ${errorCount} Fehler` : ''}`,
      });
    }

    // Mode 2: Delete by club_callsign
    if (callsign) {
      const BATCH = 500;
      const MAX_PAGES = 20;
      for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await sr.entities.Log.filter(
          { club_callsign: callsign },
          '-created_date', BATCH, page * BATCH
        );
        if (!Array.isArray(batch) || batch.length === 0) break;
        for (const entry of batch) {
          try {
            await sr.entities.Log.delete(entry.id);
            deletedCount++;
          } catch {
            errorCount++;
          }
        }
        if (batch.length < BATCH) break;
      }
      return Response.json({
        success: errorCount === 0,
        deletedCount,
        errorCount,
        message: `${deletedCount} Eintrag${deletedCount !== 1 ? 'e' : ''} für ${callsign} gelöscht${errorCount > 0 ? `, ${errorCount} Fehler` : ''}`,
      });
    }

    // Mode 3: Delete by operator_email
    if (operatorEmail) {
      const BATCH = 500;
      const MAX_PAGES = 20;
      for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await sr.entities.Log.filter(
          { operator_email: operatorEmail },
          '-created_date', BATCH, page * BATCH
        );
        if (!Array.isArray(batch) || batch.length === 0) break;
        for (const entry of batch) {
          try {
            await sr.entities.Log.delete(entry.id);
            deletedCount++;
          } catch {
            errorCount++;
          }
        }
        if (batch.length < BATCH) break;
      }
      return Response.json({
        success: errorCount === 0,
        deletedCount,
        errorCount,
        message: `${deletedCount} Eintrag${deletedCount !== 1 ? 'e' : ''} für ${operatorEmail} gelöscht${errorCount > 0 ? `, ${errorCount} Fehler` : ''}`,
      });
    }

    return Response.json({ error: 'Keine Aktion ausgeführt' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}