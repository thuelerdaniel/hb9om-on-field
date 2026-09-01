import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// migrateLogEntries — v0.9018
// One-time migration: fixes log_type, operator_callsign, club_callsign on existing entries.
// Admin-only. Uses asServiceRole to bypass RLS.
//
// Rules:
// 1. is_clubstation=false AND club_callsign="HB3YNF" → log_type="private", operator_callsign="HB3YNF", club_callsign=null
// 2. is_clubstation=true → log_type="club", operator_callsign="HB9OM", club_callsign="HB9OM"

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if ((user as any).role !== 'admin') {
      return Response.json({ error: 'Migration nur für Admins' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const stats = { private_fixed: 0, club_fixed: 0, errors: 0 };

    // Rule 1: Private entries with wrong club_callsign="HB3YNF"
    let hasMore = true;
    let guard = 0;
    while (hasMore && guard < 100) {
      guard++;
      try {
        const res = await sr.entities.Log.updateMany(
          { is_clubstation: false, club_callsign: 'HB3YNF' },
          { $set: { log_type: 'private', operator_callsign: 'HB3YNF' }, $unset: { club_callsign: '' } }
        );
        const updated = (res as any)?.updated_count || (res as any)?.modified_count || (res as any)?.count || 0;
        stats.private_fixed += updated;
        hasMore = (res as any)?.has_more === true;
        if (updated === 0 && !hasMore) break;
      } catch (e: any) {
        stats.errors++;
        break;
      }
    }

    // Rule 2: Club entries (is_clubstation=true)
    hasMore = true;
    guard = 0;
    while (hasMore && guard < 100) {
      guard++;
      try {
        const res = await sr.entities.Log.updateMany(
          { is_clubstation: true, log_type: { $ne: 'club' } },
          { $set: { log_type: 'club', operator_callsign: 'HB9OM', club_callsign: 'HB9OM' } }
        );
        const updated = (res as any)?.updated_count || (res as any)?.modified_count || (res as any)?.count || 0;
        stats.club_fixed += updated;
        hasMore = (res as any)?.has_more === true;
        if (updated === 0 && !hasMore) break;
      } catch (e: any) {
        stats.errors++;
        break;
      }
    }

    return Response.json({
      success: true,
      stats,
      message: `Migration: ${stats.private_fixed} Private-Einträge korrigiert, ${stats.club_fixed} Club-Einträge korrigiert, ${stats.errors} Fehler`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}