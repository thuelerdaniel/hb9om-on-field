import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all LogEntry records for this user (newest first, paginate)
    const allEntries: any[] = [];
    let skip = 0;
    const limit = 500;
    while (true) {
      const batch = await base44.entities.LogEntry.list('-qso_date', limit, skip);
      const data = Array.isArray(batch) ? batch : (batch?.data || []);
      allEntries.push(...data);
      if (data.length < limit) break;
      skip += limit;
    }

    // ADIF header
    const header = [
      '<ADIF_VER:5>3.1.4',
      `<PROGRAMID:14>HB9OM On Field`,
      `<PROGRAMVERSION:3>1.0`,
      `<CREATED_TIMESTAMP:15>${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15)}`,
      '<EOH>'
    ].join('\n');

    // ADIF records
    const records = allEntries.map(e => {
      const fields: string[] = [];
      const dateStr = (e.qso_date || '').replace(/-/g, '');
      if (dateStr) fields.push(`<QSO_DATE:8>${dateStr}`);
      if (e.time_on) fields.push(`<TIME_ON:4>${e.time_on.replace(':', '')}`);
      if (e.time_off) fields.push(`<TIME_OFF:4>${e.time_off.replace(':', '')}`);
      if (e.callsign_contact) fields.push(`<CALL:${e.callsign_contact.length}>${e.callsign_contact}`);
      if (e.frequency) fields.push(`<FREQ:${String(e.frequency).length}>${e.frequency}`);
      if (e.band) fields.push(`<BAND:${e.band.length}>${e.band}`);
      if (e.mode) fields.push(`<MODE:${e.mode.length}>${e.mode}`);
      if (e.rst_sent) fields.push(`<RST_SENT:${e.rst_sent.length}>${e.rst_sent}`);
      if (e.rst_recv) fields.push(`<RST_RCVD:${e.rst_recv.length}>${e.rst_recv}`);
      if (e.operator) fields.push(`<OPERATOR:${e.operator.length}>${e.operator}`);
      if (e.tx_power !== undefined && e.tx_power !== null) fields.push(`<TX_PWR:${String(e.tx_power).length}>${e.tx_power}`);
      if (e.reference && e.reference_type) {
        const sig = e.reference_type;
        const sigInfo = e.reference;
        fields.push(`<SIG:${sig.length}>${sig}`);
        fields.push(`<SIG_INFO:${sigInfo.length}>${sigInfo}`);
      }
      if (e.my_lat && e.my_lng) {
        fields.push(`<MY_LAT:${String(e.my_lat).length}>${e.my_lat}`);
        fields.push(`<MY_LON:${String(e.my_lng).length}>${e.my_lng}`);
      }
      if (e.comment) fields.push(`<COMMENT:${e.comment.length}>${e.comment}`);
      fields.push('<EOR>');
      return fields.join(' ');
    }).join('\n');

    const adif = header + '\n' + records + '\n';

    return Response.json({ adif, count: allEntries.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});