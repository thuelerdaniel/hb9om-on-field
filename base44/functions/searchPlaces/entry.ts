import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Search for places/locations via OpenStreetMap Nominatim API.
// Used by the map search to find cities, towns, geographic features.
// Priority: local cache → backend (this) → internet (InvokeLLM)

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const { query, limit } = await req.json();
    if (!query || query.length < 2) return Response.json({ places: [] });

    const maxResults = limit || 10;

    // Search via Nominatim (OpenStreetMap)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${maxResults}&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'hb9om-onfield/1.0 (amateurfunk@hb9om.ch)' },
    });

    if (!response.ok) {
      return Response.json({ places: [], error: `Nominatim API error: ${response.status}` });
    }

    const data = await response.json();

    const places = (data || []).map((item: any) => {
      const name = item.display_name?.split(',')[0] || item.name || '';
      const fullName = item.display_name || name;
      return {
        name,
        fullName,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: 'place',
        layerType: 'place',
        layerLabel: 'Ort',
        color: '#6b7280',
      };
    });

    return Response.json({ places });
  } catch (error: any) {
    return Response.json({ places: [], error: error.message || String(error) });
  }
}