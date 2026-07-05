import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Simple ZIP extraction using Deno built-in APIs
async function extractKmlFromKmz(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  // Find local file header signature: PK\x03\x04 (0x504b0304)
  let offset = 0;
  while (offset < bytes.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig === 0x04034b50) {
      // Local file header found
      const compressionMethod = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const fileNameLength = view.getUint16(offset + 26, true);
      const extraFieldLength = view.getUint16(offset + 28, true);
      const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
      const fileName = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + fileNameLength));

      if (fileName.endsWith('.kml')) {
        if (compressionMethod === 0) {
          // Stored (no compression)
          return new TextDecoder().decode(bytes.subarray(dataOffset, dataOffset + compressedSize));
        } else if (compressionMethod === 8) {
          // Deflated - use DecompressionStream
          const compressedData = bytes.subarray(dataOffset, dataOffset + compressedSize);
          const ds = new DecompressionStream('deflate-raw');
          const stream = new Blob([compressedData]).stream().pipeThrough(ds);
          const decompressed = await new Response(stream).text();
          return decompressed;
        }
      }
      offset = dataOffset + compressedSize;
    } else {
      offset++;
    }
  }
  return null;
}

// Parse HBFF reference list HTML to extract all references
function parseHBFFRefList(html) {
  const refs = [];
  // Split by table rows
  const rows = html.split(/<tr[\s>]/);
  for (const row of rows) {
    // Find HBFF-XXXX link in this row (HTML uses single quotes)
    const linkMatch = row.match(/href=['"](https:\/\/hbff\.ch\/geo\/HBFF-(\d{4})\.htm)['"]/);
    if (!linkMatch) continue;
    const refNum = linkMatch[2];
    const detailUrl = linkMatch[1];

    // Extract all td cell contents
    const cells = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      let content = tdMatch[1]
        .replace(/<[^>]*>/g, '') // strip inner HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      cells.push(content);
    }

    // cells[0] = ref code, cells[1] = name, cells[2] = canton, cells[3] = dxcc,
    // cells[4] = continent, cells[5] = entity, cells[6] = parkType, cells[7] = activation count
    if (cells.length >= 7) {
      refs.push({
        code: 'HBFF-' + refNum,
        name: cells[1] || '',
        canton: cells[2] || '',
        dxcc: cells[3] || '',
        continent: cells[4] || '',
        entity: cells[5] || '',
        parkType: cells[6] || '',
        detailUrl: detailUrl,
        kmzUrl: `https://hbff.ch/kmz/HBFF-${refNum}_Borders.kmz`
      });
    }
  }
  return refs;
}

// Extract coordinates from KMZ file (ZIP containing KML)
async function extractCoordsFromKMZ(kmzUrl) {
  try {
    const resp = await fetch(kmzUrl);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const kmlText = await extractKmlFromKmz(buffer);
    if (!kmlText) return null;
    // Parse KML coordinates: <coordinates>lng,lat,alt lng,lat,alt ...</coordinates>
    const coordMatches = kmlText.matchAll(/<coordinates>([\d.\-,\s]+)<\/coordinates>/g);
    let sumLat = 0, sumLng = 0, count = 0;
    for (const m of coordMatches) {
      const coordStr = m[1].trim();
      const pairs = coordStr.split(/\s+/);
      for (const pair of pairs) {
        const parts = pair.split(',');
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          sumLat += lat;
          sumLng += lng;
          count++;
        }
      }
    }
    if (count > 0) {
      return { lat: sumLat / count, lng: sumLng / count };
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 50;
    const batchStart = body.batchStart || 0;

    // Fetch HBFF reference list (the actual table is in the slim version loaded via iframe)
    const resp = await fetch('https://hbff.ch/Refs/HBFFReferenceSlim.html');
    if (!resp.ok) {
      return Response.json({ error: 'Failed to fetch HBFF reference list' }, { status: 502 });
    }
    const html = await resp.text();

    // Parse all references from the table
    const allRefs = parseHBFFRefList(html);

    // Process a batch of references to get coordinates from KMZ files
    const batch = allRefs.slice(batchStart, batchStart + batchSize);
    const results = [];

    // Fetch KMZ files in parallel (with concurrency limit)
    const concurrencyLimit = 30;
    for (let i = 0; i < batch.length; i += concurrencyLimit) {
      const chunk = batch.slice(i, i + concurrencyLimit);
      const chunkResults = await Promise.all(
        chunk.map(async (ref) => {
          const coords = await extractCoordsFromKMZ(ref.kmzUrl);
          return {
            code: ref.code,
            name: ref.name,
            canton: ref.canton,
            dxcc: ref.dxcc,
            entity: ref.entity,
            parkType: ref.parkType,
            lat: coords?.lat || null,
            lng: coords?.lng || null,
            link: ref.detailUrl,
            kmzUrl: ref.kmzUrl
          };
        })
      );
      results.push(...chunkResults);
    }

    const found = results.filter(r => r.lat !== null);
    const hasMore = batchStart + batchSize < allRefs.length;

    return Response.json({
      references: results,
      foundWithCoords: found.length,
      totalRefs: allRefs.length,
      batchStart: batchStart,
      batchSize: batchSize,
      hasMore: hasMore,
      source: 'HBFF.ch'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});