import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Lade ActivitySpot-Einträge (sort -spot_time, limit 100).
// Gruppiert nach activity_type: { sota: [...], pota: [...], total: number }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let spots: any[] = [];
    try {
      spots = await base44.entities.ActivitySpot.list('-spot_time', 100);
    } catch {}

    const sota = spots.filter(s => s.activity_type === 'SOTA');
    const pota = spots.filter(s => s.activity_type === 'POTA');

    return Response.json({
      success: true,
      sota,
      pota,
      total: spots.length,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}