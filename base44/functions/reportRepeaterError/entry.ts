import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Report a repeater error — saves to RepeaterReport entity.
// Any authenticated user can submit a report. Admins can read/update/delete all reports.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { repeater_callsign, repeater_id, repeater_frequency, error_type, description } = body;

    if (!repeater_callsign || !error_type) {
      return Response.json({ error: 'repeater_callsign und error_type sind erforderlich' }, { status: 400 });
    }

    const validTypes = ['wrong_frequency', 'wrong_location', 'offline_defect', 'wrong_info', 'other'];
    if (!validTypes.includes(error_type)) {
      return Response.json({ error: 'Ungültiger error_type' }, { status: 400 });
    }

    const user = await base44.auth.me().catch(() => null);
    const reported_by = user?.full_name || user?.email || 'unbekannt';

    await base44.asServiceRole.entities.RepeaterReport.create({
      repeater_callsign,
      repeater_id: repeater_id || '',
      repeater_frequency: repeater_frequency || null,
      error_type,
      description: (description || '').substring(0, 1000),
      reported_by,
      status: 'open'
    });

    return Response.json({
      success: true,
      message: 'Fehlermeldung erhalten. Vielen Dank!'
    });
  } catch (error) {
    console.error('[reportRepeaterError] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});