import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Fix 1: Backend-Function für APK/ZIP/PDF Upload.
// Base44 Frontend-Upload blockiert APK/ZIP — diese Backend-Function empfängt
// beliebige Dateitypen via HTTP POST FormData und speichert sie via UploadFile Integration.
// Nur Admins dürfen uploaden (role check).

const ALLOWED_EXTENSIONS = ['apk', 'zip', 'pdf'];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — Admin only' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return Response.json({
        error: `File type .${extension} not allowed. Allowed: .apk, .zip, .pdf`
      }, { status: 400 });
    }

    // Upload via Base44 UploadFile integration (backend hat keine Frontend-Type-Restriktion)
    const uploadResult: any = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const fileUrl = uploadResult?.file_url || uploadResult?.data?.file_url;
    if (!fileUrl) throw new Error('Upload failed — no file_url returned');

    // DownloadItem erstellen
    const name = (formData.get('name') as string) || fileName;
    const version = (formData.get('version') as string) || '';
    const description = (formData.get('description') as string) || '';
    const isActive = formData.get('is_active') !== 'false';

    await base44.asServiceRole.entities.DownloadItem.create({
      name,
      type: extension,
      file_url: fileUrl,
      file_size: file.size,
      version: version || undefined,
      description: description || undefined,
      upload_date: new Date().toISOString(),
      uploaded_by: user.full_name || user.email || 'Admin',
      is_active: isActive,
    });

    return Response.json({
      success: true,
      file_url: fileUrl,
      file_size: file.size,
      file_name: fileName,
      version,
    });
  } catch (error) {
    console.error('[uploadAppFile] Error:', error);
    return Response.json({
      error: 'Upload failed: ' + (error.message || 'Unknown error')
    }, { status: 500 });
  }
}