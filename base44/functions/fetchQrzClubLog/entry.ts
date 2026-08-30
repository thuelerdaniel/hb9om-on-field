import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// PUNKT 5: Club-Log-Sync — lädt QSOs vom QRZ.com Club-Logbuch herunter.
// Verwendet die QRZ Logbook API (ACTION=FETCH) mit dem Club-API-Key (QRZ_API_KEY Secret).
// Admin-only: Das Club-Logbuch ist gemeinschaftlich, nur Admins dürfen synchronisieren.
// Gibt ADIF-Datensätze zurück, die das Frontend dann ins Log-Entity importiert.
//
// QRZ Logbook API: https://logbook.qrz.com/api
// Params: KEY, ACTION=FETCH, optional LOGIDS
// Response: RESULT=OK&ADIF=<adif data>&COUNT=...  or  RESULT=FAIL&REASON=...

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    // Club-Log-Sync ist Admin-only — Club-Logbuch ist gemeinschaftlich
    if ((user as any).role !== 'admin') {
      return Response.json({ error: 'Club-Log-Sync nur für Admins' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const logIds = body.log_ids || ''; // optional: komma-separierte LOGIDs

    const apiKey = Deno.env.get('QRZ_API_KEY') || '';
    if (!apiKey) {
      return Response.json({
        error: 'Kein Club QRZ API-Key konfiguriert (QRZ_API_KEY Secret fehlt).'
      }, { status: 200 });
    }

    // Fetch QSOs from QRZ Logbook API
    const params = new URLSearchParams();
    params.append('KEY', apiKey);
    params.append('ACTION', 'FETCH');
    if (logIds) params.append('LOGIDS', logIds);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://logbook.qrz.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const resultText = await response.text();

    if (resultText.includes('RESULT=OK') || resultText.includes('RESULT=ok')) {
      // Extract ADIF data from response.
      // QRZ Logbook API FETCH returns: RESULT=OK&COUNT=<n>&LOGIDS=...&ADIF=<adif_data>
      // The ADIF data may contain & characters (URL-encoded as %26) so we capture greedily.
      const countMatch = resultText.match(/COUNT=(\d+)/i);
      const logIdsMatch = resultText.match(/LOGIDS=([^&\s]*)/i);

      // ADIF data: find ADIF= and take everything after it (it's the last field in the response)
      const adifIdx = resultText.search(/ADIF=/i);
      let adifData = '';
      if (adifIdx >= 0) {
        const afterAdif = resultText.slice(adifIdx + 5); // skip "ADIF="
        // ADIF data runs to end of response — safely decode URL-encoded characters
        // Use try/catch because ADIF contains < > characters that break decodeURIComponent
        try {
          adifData = decodeURIComponent(afterAdif).trim();
        } catch {
          // Fallback: replace common URL-encoded chars manually
          adifData = afterAdif
            .replace(/%0A/g, '\n')
            .replace(/%0D/g, '\r')
            .replace(/%20/g, ' ')
            .replace(/%26/g, '&')
            .replace(/%3C/g, '<')
            .replace(/%3E/g, '>')
            .replace(/%3D/g, '=')
            .replace(/%22/g, '"')
            .trim();
        }
        // QRZ API returns HTML-encoded ADIF — decode &lt; &gt; &amp; etc.
        adifData = adifData
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }

      const count = countMatch ? parseInt(countMatch[1]) : 0;
      const returnedLogIds = logIdsMatch ? logIdsMatch[1] : '';

      return Response.json({
        status: 'success',
        adif_data: adifData,
        count,
        log_ids: returnedLogIds,
        message: `${count} QSO(s) vom QRZ Club-Logbuch abgerufen`,
      });
    } else {
      const reasonMatch = resultText.match(/REASON=([^\s&]+)/i);
      const reason = reasonMatch ? reasonMatch[1] : resultText.substring(0, 200);
      return Response.json({
        status: 'error',
        error: `QRZ.com: ${reason}`,
      });
    }
  } catch (error: any) {
    return Response.json({
      error: error.message || String(error),
    }, { status: 500 });
  }
}