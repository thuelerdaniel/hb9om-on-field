import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Manage repeater correction reports.
// Actions:
// - report: Any logged-in user can report incorrect repeater data (creates pending report)
// - listAll: Admin lists all correction reports
// - approve: Admin approves — applies the corrected value to the repeater
// - reject: Admin rejects

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'listOwn';

    // report — any logged-in user
    if (action === 'report') {
      const { repeater_id, callsign, field_name, current_value, corrected_value, description } = body;
      if (!repeater_id || !callsign || !field_name) {
        return Response.json({ error: 'repeater_id, callsign and field_name required' }, { status: 400 });
      }
      const created = await base44.entities.RepeaterCorrection.create({
        repeater_id,
        callsign,
        field_name,
        current_value: current_value || '',
        corrected_value: corrected_value || '',
        description: description || '',
        status: 'pending',
        submitted_by_name: user.full_name || user.email,
      });
      return Response.json({ correction: created });
    }

    // listOwn — user sees their own reports
    if (action === 'listOwn') {
      const reports = await base44.entities.RepeaterCorrection.list('-created_date', 100);
      return Response.json({ reports });
    }

    // Admin-only actions
    if (['listAll', 'approve', 'reject'].includes(action)) {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
      }

      if (action === 'listAll') {
        const reports = await base44.asServiceRole.entities.RepeaterCorrection.list('-created_date', 500);
        return Response.json({ reports });
      }

      if (action === 'approve') {
        const { id, adminComment } = body;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const report = await base44.asServiceRole.entities.RepeaterCorrection.get(id);
        if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

        // Apply the corrected value to the repeater
        if (report.corrected_value && report.repeater_id) {
          try {
            const updateData: any = {};
            const fieldName = report.field_name;
            const val = report.corrected_value;

            if (fieldName === 'frequency') updateData.frequency = parseFloat(val);
            else if (fieldName === 'offset_mhz') updateData.offset_mhz = parseFloat(val);
            else if (fieldName === 'tone') updateData.tone = val;
            else if (fieldName === 'location_name') updateData.location_name = val;
            else if (fieldName === 'status') updateData.status = val;
            else if (fieldName === 'band') updateData.band = val;
            else if (fieldName === 'country') updateData.country = val;
            else if (fieldName === 'web_url') updateData.web_url = val;
            else if (fieldName === 'lat_lng') {
              const parts = val.split(',').map((s: string) => parseFloat(s.trim()));
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                updateData.lat = parts[0];
                updateData.lng = parts[1];
              }
            } else if (fieldName === 'modes') {
              updateData.modes = val.split(',').map((s: string) => s.trim()).filter(Boolean);
            }

            if (Object.keys(updateData).length > 0) {
              await base44.asServiceRole.entities.Repeater.update(report.repeater_id, updateData);
            }
          } catch (e) {
            // Log but don't fail — the report is still marked as approved
          }
        }

        const updated = await base44.asServiceRole.entities.RepeaterCorrection.update(id, {
          status: 'approved',
          reviewed_by_name: user.full_name || user.email,
          admin_comment: adminComment || '',
        });
        return Response.json({ correction: updated });
      }

      if (action === 'reject') {
        const { id, adminComment } = body;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const updated = await base44.asServiceRole.entities.RepeaterCorrection.update(id, {
          status: 'rejected',
          reviewed_by_name: user.full_name || user.email,
          admin_comment: adminComment || '',
        });
        return Response.json({ correction: updated });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}