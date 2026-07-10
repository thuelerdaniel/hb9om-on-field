import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, webdav_url, webdav_username, webdav_password, backup_data, backup_filename } = body;

    if (action === 'test') {
      // Test WebDAV connection by doing a PROPFIND
      const authHeader = 'Basic ' + btoa(webdav_username + ':' + webdav_password);
      const resp = await fetch(webdav_url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': authHeader,
          'Depth': '0',
          'Content-Type': 'application/xml'
        }
      });
      if (resp.ok || resp.status === 207) {
        return Response.json({ success: true, message: 'Verbindung erfolgreich' });
      }
      return Response.json({ success: false, error: `HTTP ${resp.status}: ${resp.statusText}` }, { status: 400 });
    }

    if (action === 'upload') {
      if (!backup_data || !webdav_url || !webdav_username || !webdav_password) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }
      const filename = backup_filename || `hb9om_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const authHeader = 'Basic ' + btoa(webdav_username + ':' + webdav_password);

      // Ensure URL ends with /
      const baseUrl = webdav_url.endsWith('/') ? webdav_url : webdav_url + '/';
      const uploadUrl = baseUrl + filename;

      const resp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(backup_data)
      });

      if (resp.ok || resp.status === 201 || resp.status === 204) {
        return Response.json({ success: true, message: `Backup hochgeladen: ${filename}`, url: uploadUrl });
      }
      const errorText = await resp.text().catch(() => '');
      return Response.json({ success: false, error: `HTTP ${resp.status}: ${errorText.slice(0, 200) || resp.statusText}` }, { status: 400 });
    }

    if (action === 'list') {
      // List backup files on WebDAV
      const authHeader = 'Basic ' + btoa(webdav_username + ':' + webdav_password);
      const resp = await fetch(webdav_url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': authHeader,
          'Depth': '1',
          'Content-Type': 'application/xml'
        }
      });
      if (!resp.ok && resp.status !== 207) {
        return Response.json({ error: `HTTP ${resp.status}` }, { status: 400 });
      }
      const text = await resp.text();
      // Extract hrefs from PROPFIND response
      const hrefs = [];
      const regex = /<d?:?href>([^<]+)<\/d?:?href>/gi;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const href = decodeURIComponent(match[1]);
        if (href.includes('hb9om_backup') && href.endsWith('.json')) {
          const parts = href.split('/');
          hrefs.push({ name: parts[parts.length - 1], url: href });
        }
      }
      return Response.json({ files: hrefs });
    }

    if (action === 'download') {
      // Download a backup file from WebDAV
      const authHeader = 'Basic ' + btoa(webdav_username + ':' + webdav_password);
      const resp = await fetch(body.file_url, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      });
      if (!resp.ok) {
        return Response.json({ error: `HTTP ${resp.status}` }, { status: 400 });
      }
      const data = await resp.json();
      return Response.json({ backup: data });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});