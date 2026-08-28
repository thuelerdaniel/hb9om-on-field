import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// downloadApk — serves an APK file with the correct Content-Type so Android
// browsers recognize it as an installable package. Base44 file storage may
// serve .apk files with a generic Content-Type, which prevents installation.
//
// Usage: GET downloadApk?id=<DownloadItem_id>
// Returns: binary APK with Content-Type: application/vnd.android.package-archive

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return Response.json({ error: 'id parameter required' }, { status: 400 });
    }

    let item: any;
    try {
      item = await base44.asServiceRole.entities.DownloadItem.get(id);
    } catch {
      return Response.json({ error: 'Download item not found' }, { status: 404 });
    }

    if (!item || item.type !== 'apk') {
      return Response.json({ error: 'Item is not an APK' }, { status: 404 });
    }

    if (!item.file_url) {
      return Response.json({ error: 'No file URL stored for this item' }, { status: 500 });
    }

    // Fetch the APK from Base44 file storage
    const fileResp = await fetch(item.file_url, { signal: AbortSignal.timeout(30000) });
    if (!fileResp.ok) {
      return Response.json({ error: `File storage returned HTTP ${fileResp.status}` }, { status: 502 });
    }

    const fileBuffer = await fileResp.arrayBuffer();
    const fileName = (item.name || 'app').replace(/\.[^.]+$/, '') + '.apk';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(fileBuffer.byteLength),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[downloadApk] Error:', error);
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}