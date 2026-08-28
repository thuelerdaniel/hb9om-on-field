import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// uploadApk — accepts an APK file as base64 data, stores it via the UploadFile
// integration, and creates a DownloadItem record. This bypasses Base44's
// frontend file-type restrictions which block .apk uploads.
//
// POST body: { filename, base64data, version, description, uploaded_by }
// Returns: { success, id, download_url }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — Admin only' }, { status: 403 });

    const body = await req.json();
    const { filename, base64data, version, description, uploaded_by } = body;

    if (!filename || !base64data) {
      return Response.json({ error: 'filename and base64data required' }, { status: 400 });
    }

    // Validate file extension
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext !== 'apk') {
      return Response.json({ error: 'Only .apk files allowed' }, { status: 400 });
    }

    // Convert base64 to Blob → File
    const byteCharacters = atob(base64data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/vnd.android.package-archive' });
    const file = new File([blob], filename, { type: 'application/vnd.android.package-archive' });

    // Upload via Base44 UploadFile integration (backend has no frontend type restriction)
    const uploadResult: any = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const fileUrl = uploadResult?.file_url || uploadResult?.data?.file_url;
    if (!fileUrl) throw new Error('Upload failed — no file_url returned');

    // Create DownloadItem record
    const item = await base44.asServiceRole.entities.DownloadItem.create({
      name: filename.replace(/\.[^.]+$/, ''),
      type: 'apk',
      file_url: fileUrl,
      file_size: byteArray.length,
      version: version || undefined,
      description: description || undefined,
      upload_date: new Date().toISOString(),
      uploaded_by: uploaded_by || user.full_name || user.email || 'Admin',
      is_active: true,
    });

    return Response.json({
      success: true,
      id: item.id,
      file_url: fileUrl,
      file_size: byteArray.length,
    });
  } catch (error) {
    console.error('[uploadApk] Error:', error);
    return Response.json({
      error: 'Upload failed: ' + (error.message || 'Unknown error')
    }, { status: 500 });
  }
}