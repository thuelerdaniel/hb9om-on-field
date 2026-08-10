import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchSotaSummits } from '../../shared/sotaFetcher.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { associations, maxAssociations } = body;

    const result = await fetchSotaSummits(associations || 'all', maxAssociations);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});