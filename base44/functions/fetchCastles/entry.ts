import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { inflateRawSync } from 'node:zlib';

function readUInt16LE(buf, offset) {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readUInt32LE(buf, offset) {
  return ((buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Download WCA ODS file from wcagroup.org
    const odsResp = await fetch('https://wcagroup.org/FORMS/WCALIST.ods', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
    });

    if (!odsResp.ok) {
      return Response.json({ error: 'Failed to download WCA list' }, { status: 502 });
    }

    const odsBuffer = new Uint8Array(await odsResp.arrayBuffer());

    // 2. Parse ZIP central directory to find content.xml
    let offset = 0;
    let contentEntry = null;

    while (offset < odsBuffer.length - 4) {
      if (odsBuffer[offset] === 0x50 && odsBuffer[offset + 1] === 0x4B &&
          odsBuffer[offset + 2] === 0x01 && odsBuffer[offset + 3] === 0x02) {
        const compressedSize = readUInt32LE(odsBuffer, offset + 20);
        const uncompressedSize = readUInt32LE(odsBuffer, offset + 24);
        const fileNameLength = readUInt16LE(odsBuffer, offset + 28);
        const extraFieldLength = readUInt16LE(odsBuffer, offset + 30);
        const fileCommentLength = readUInt16LE(odsBuffer, offset + 32);
        const localHeaderOffset = readUInt32LE(odsBuffer, offset + 42);
        const fileName = new TextDecoder().decode(odsBuffer.slice(offset + 46, offset + 46 + fileNameLength));

        if (fileName === 'content.xml') {
          contentEntry = { compressedSize, uncompressedSize, localHeaderOffset };
          break;
        }
        offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
      } else {
        offset++;
      }
    }

    if (!contentEntry) {
      return Response.json({ error: 'content.xml not found in ODS file' }, { status: 500 });
    }

    // 3. Extract and decompress content.xml
    const lho = contentEntry.localHeaderOffset;
    const localFileNameLength = readUInt16LE(odsBuffer, lho + 26);
    const localExtraFieldLength = readUInt16LE(odsBuffer, lho + 28);
    const dataStart = lho + 30 + localFileNameLength + localExtraFieldLength;
    const compressedData = odsBuffer.slice(dataStart, dataStart + contentEntry.compressedSize);
    const decompressed = inflateRawSync(compressedData);
    const xml = new TextDecoder().decode(decompressed);

    // 4. Parse XML to extract Swiss WCA entries from the HB-HB0 table
    const hbTableStart = xml.indexOf('table:name="HB-HB0"');
    if (hbTableStart === -1) {
      return Response.json({ error: 'HB table not found in WCA list' }, { status: 500 });
    }
    const hbTableEnd = xml.indexOf('</table:table>', hbTableStart);
    const hbTableXml = xml.substring(hbTableStart, hbTableEnd);

    const wcaEntries = [];
    const rowRegex = /<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g;
    let match;

    while ((match = rowRegex.exec(hbTableXml)) !== null) {
      const rowContent = match[1];
      if (rowContent.includes('number-rows-repeated')) continue;
      if (rowContent.includes('number-columns-repeated="256"') && !rowContent.includes('text:p')) continue;

      const cells = [];
      const cellRegex = /<table:table-cell[^>]*>([\s\S]*?)<\/table:table-cell>/g;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellContent = cellMatch[1];
        const textMatches = cellContent.match(/<text:p[^>]*>([\s\S]*?)<\/text:p>/g);
        if (textMatches) {
          const text = textMatches.map(t => t.replace(/<[^>]+>/g, '')).join(' ').trim();
          cells.push(text);
        } else {
          cells.push('');
        }
      }

      if (cells.length >= 4 && cells[0] && cells[0].match(/^HB-\d{5}$/)) {
        wcaEntries.push({
          wca: cells[0],
          dcs: cells[1] || '',
          name: (cells[3] || '').toUpperCase().replace(/&APOS;/g, "'").replace(/&AMP;/g, "&"),
          location: (cells[4] || '').toUpperCase().replace(/&APOS;/g, "'").replace(/&AMP;/g, "&")
        });
      }
    }

    // 5. Fetch castle coordinates from Wikidata SPARQL
    const sparqlQuery = `
SELECT ?item ?itemLabel ?coord ?cantonLabel WHERE {
  {
    ?item wdt:P31/wdt:P279* wd:Q23413 .
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q57821 .
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q1763828 .
  }
  ?item wdt:P17 wd:Q39 .
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P131 ?canton . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en,fr,it" . }
} LIMIT 2000`;

    const wdResp = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)'
        }
      }
    );

    if (!wdResp.ok) {
      return Response.json({ error: 'Failed to fetch from Wikidata' }, { status: 502 });
    }

    const wdData = await wdResp.json();
    const bindings = wdData.results?.bindings || [];

    // Deduplicate Wikidata entries by URI
    const seen = new Set();
    const wikidataCastles = [];

    for (const b of bindings) {
      const uri = b.item?.value || '';
      if (seen.has(uri)) continue;
      seen.add(uri);

      const coordStr = b.coord?.value || '';
      const coordMatch = coordStr.match(/Point\(([\d.-]+)\s+([\d.-]+)\)/);
      if (!coordMatch) continue;
      const lng = parseFloat(coordMatch[1]);
      const lat = parseFloat(coordMatch[2]);
      if (isNaN(lat) || isNaN(lng)) continue;

      wikidataCastles.push({
        name: (b.itemLabel?.value || '').toUpperCase(),
        lat,
        lng,
        canton: b.cantonLabel?.value || '',
        uri
      });
    }

    // 6. Match Wikidata entries to WCA entries by name keywords
    const SKIP_WORDS = new Set(['SCHLOSS', 'BURG', 'CHATEAU', 'CHÂTEAU', 'CASTEL',
      'CASTELLO', 'FESTUNG', 'RUINE', 'BURGRUINE', 'SCHLOSSE', 'RUIN', 'OF', 'DE', 'LA', 'LE', 'THE', 'ALT', 'NEU']);

    const castles = [];
    const matchedWCA = new Set();

    for (const wd of wikidataCastles) {
      // Extract significant words from Wikidata name for matching
      const wdWords = wd.name.split(/[\s\-()/',]+/)
        .filter(w => w.length > 3 && !SKIP_WORDS.has(w));

      let bestMatch = null;

      for (const wca of wcaEntries) {
        if (matchedWCA.has(wca.wca)) continue;
        const wcaCombined = wca.name + ' ' + wca.location;

        // Check if any significant word from Wikidata name appears in WCA name or location
        for (const word of wdWords) {
          if (wcaCombined.includes(word)) {
            bestMatch = wca;
            break;
          }
        }
        if (bestMatch) break;
      }

      if (bestMatch) {
        matchedWCA.add(bestMatch.wca);
        castles.push({
          code: bestMatch.wca,
          name: wd.name.charAt(0) + wd.name.slice(1).toLowerCase(),
          lat: wd.lat,
          lng: wd.lng,
          canton: wd.canton,
          link: 'https://wcagroup.org/?page_id=207',
          wcaName: bestMatch.name,
          wcaLocation: bestMatch.location
        });
      }
    }

    return Response.json({
      castles,
      count: castles.length,
      totalWCA: wcaEntries.length,
      source: 'WCA list (wcagroup.org) + Wikidata coordinates'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});