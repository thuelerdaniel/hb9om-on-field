import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Lade neuesten Propagation-Eintrag und gib bestBand + propagation zurück.
// Falls keiner existiert, Hinweis dass fetchPropagation zuerst aufgerufen werden muss.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const latest = await base44.entities.Propagation.list('-updated', 1);

    if (!latest || latest.length === 0) {
      return Response.json({
        success: false,
        message: 'Keine Propagation-Daten vorhanden. Bitte zuerst fetchPropagation aufrufen.',
      });
    }

    const propagation = latest[0];
    const bands = propagation.bands || [];

    const bestBand = bands.reduce((best, b) =>
      (b.score || 0) > (best.score || 0) ? b : best,
      { band: '—', score: -1, condition: '—' }
    );

    return Response.json({
      success: true,
      propagation,
      bestBand,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}