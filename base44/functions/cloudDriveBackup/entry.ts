import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const GOOGLE_DRIVE_CONNECTOR_ID = '6a513a8f2e9f3bb9dadc9564';
const ONEDRIVE_CONNECTOR_ID = '6a513adebee7a531c23b3e6a';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, provider, backup_data, backup_filename, file_id } = body;

    let connectorId;
    if (provider === 'googledrive') {
      connectorId = GOOGLE_DRIVE_CONNECTOR_ID;
    } else if (provider === 'one_drive') {
      connectorId = ONEDRIVE_CONNECTOR_ID;
    } else {
      return Response.json({ error: 'Invalid provider. Use "googledrive" or "one_drive".' }, { status: 400 });
    }

    // Status check: lightweight connection test without listing files
    if (action === 'status') {
      try {
        const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
        if (conn && conn.accessToken) {
          return Response.json({ connected: true, provider });
        }
        return Response.json({ connected: false, provider });
      } catch (e) {
        return Response.json({ connected: false, provider });
      }
    }

    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({ error: 'not_connected', message: 'Cloud-Verbindung nicht eingerichtet. Bitte verbinden Sie Ihr Konto über den «Verbinden»-Button.' }, { status: 403 });
    }

    if (!accessToken) {
      return Response.json({ error: 'not_connected', message: 'Kein Access-Token erhalten. Bitte verbinden Sie Ihr Konto neu.' }, { status: 403 });
    }

    // ─── Google Drive ───
    if (provider === 'googledrive') {
      if (action === 'upload') {
        if (!backup_data) return Response.json({ error: 'backup_data required' }, { status: 400 });
        const filename = backup_filename || `hb9om_backup_${new Date().toISOString().slice(0, 10)}.json`;
        const boundary = '-------hb9om' + Date.now();
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        const metadata = { name: filename, mimeType: 'application/json' };
        const jsonStr = JSON.stringify(backup_data);

        const multipartBody = delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          jsonStr +
          closeDelim;

        const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });

        if (!resp.ok) {
          const errText = await resp.text();
          return Response.json({ success: false, error: `HTTP ${resp.status}: ${errText.slice(0, 300)}` }, { status: 400 });
        }
        const data = await resp.json();
        return Response.json({ success: true, file_id: data.id, message: `Backup hochgeladen: ${filename}` });
      }

      if (action === 'list') {
        const q = encodeURIComponent("name contains 'hb9om_backup' and trashed = false");
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,modifiedTime,size)`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!resp.ok) {
          const errText = await resp.text();
          return Response.json({ error: `HTTP ${resp.status}: ${errText.slice(0, 200)}` }, { status: 400 });
        }
        const data = await resp.json();
        const files = (data.files || []).map(f => ({
          id: f.id,
          name: f.name,
          modified: f.modifiedTime,
          size: f.size
        }));
        return Response.json({ files });
      }

      if (action === 'download') {
        if (!file_id) return Response.json({ error: 'file_id required' }, { status: 400 });
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!resp.ok) {
          return Response.json({ error: `HTTP ${resp.status}` }, { status: 400 });
        }
        const backup = await resp.json();
        return Response.json({ backup });
      }

      if (action === 'delete') {
        if (!file_id) return Response.json({ error: 'file_id required' }, { status: 400 });
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (resp.ok || resp.status === 204) {
          return Response.json({ success: true, message: 'Backup gelöscht' });
        }
        return Response.json({ success: false, error: `HTTP ${resp.status}` }, { status: 400 });
      }
    }

    // ─── OneDrive (Microsoft Graph) ───
    if (provider === 'one_drive') {
      const folderPath = '/hb9om_backups';

      if (action === 'upload') {
        if (!backup_data) return Response.json({ error: 'backup_data required' }, { status: 400 });
        const filename = backup_filename || `hb9om_backup_${new Date().toISOString().slice(0, 10)}.json`;
        const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${folderPath}/${filename}:/content`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(backup_data)
        });

        if (!resp.ok) {
          const errText = await resp.text();
          return Response.json({ success: false, error: `HTTP ${resp.status}: ${errText.slice(0, 300)}` }, { status: 400 });
        }
        const data = await resp.json();
        return Response.json({ success: true, file_id: data.id, message: `Backup hochgeladen: ${filename}` });
      }

      if (action === 'list') {
        const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${folderPath}:/children?$orderby=lastModifiedDateTime desc&$top=50&$select=id,name,lastModifiedDateTime,size`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (resp.status === 404) {
          return Response.json({ files: [] });
        }
        if (!resp.ok) {
          const errText = await resp.text();
          return Response.json({ error: `HTTP ${resp.status}: ${errText.slice(0, 200)}` }, { status: 400 });
        }
        const data = await resp.json();
        const files = (data.value || [])
          .filter(f => f.name.includes('hb9om_backup'))
          .map(f => ({
            id: f.id,
            name: f.name,
            modified: f.lastModifiedDateTime,
            size: f.size
          }));
        return Response.json({ files });
      }

      if (action === 'download') {
        if (!file_id) return Response.json({ error: 'file_id required' }, { status: 400 });
        const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${file_id}/content`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!resp.ok) {
          return Response.json({ error: `HTTP ${resp.status}` }, { status: 400 });
        }
        const backup = await resp.json();
        return Response.json({ backup });
      }

      if (action === 'delete') {
        if (!file_id) return Response.json({ error: 'file_id required' }, { status: 400 });
        const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${file_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (resp.ok || resp.status === 204) {
          return Response.json({ success: true, message: 'Backup gelöscht' });
        }
        return Response.json({ success: false, error: `HTTP ${resp.status}` }, { status: 400 });
      }
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});