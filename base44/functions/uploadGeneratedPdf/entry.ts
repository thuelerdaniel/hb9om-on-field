import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Stores a PDF that was generated in the browser (base64) in the app's file storage and
// returns a REAL https URL.
//
// Why: the generated PDF used to be delivered through a locally created blob: URL plus
// window.open() / navigator.share(). Exactly that is blocked or silently swallowed by
// in-app browsers, WebViews and apps added to the home screen — the button click had no
// effect at all. A real https URL can be opened, saved and shared by every browser.
//
// POST body: { filename, base64data }
// Returns:   { success, file_url, file_name, file_size }

const MAX_BASE64_LENGTH = 12000000; // ~9 MB file

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const base64data = body?.base64data;
    const filename = String(body?.filename || '').replace(/[^\w.\-]/g, '_');

    if (!filename || !base64data) {
      return Response.json({ error: 'filename and base64data required' }, { status: 400 });
    }
    if (!filename.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'Only .pdf files allowed' }, { status: 400 });
    }
    if (typeof base64data !== 'string' || base64data.length > MAX_BASE64_LENGTH) {
      return Response.json({ error: 'File too large (max ~9 MB)' }, { status: 413 });
    }

    const bytes = Uint8Array.from(atob(base64data), (c) => c.charCodeAt(0));
    const file = new File([bytes], filename, { type: 'application/pdf' });

    const uploadResult: any = await base44.integrations.Core.UploadPublicFile({ file });
    const fileUrl = uploadResult?.file_url || uploadResult?.data?.file_url;
    if (!fileUrl) throw new Error('Upload failed — no file_url returned');

    return Response.json({
      success: true,
      file_url: fileUrl,
      file_name: filename,
      file_size: bytes.length,
    });
  } catch (error: any) {
    console.error('[uploadGeneratedPdf] Error:', error);
    return Response.json(
      { error: 'Upload failed: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}