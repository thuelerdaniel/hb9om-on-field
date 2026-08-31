import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Fix 2: WWFF CSV-based Import — rewritten for reliability.
// Downloads the WWFF directory CSV directly from wwff.co, parses it,
// filters active records with valid coordinates, and saves to WwffPoint entity.
// Uses delete-all + bulk-create (faster than upsertPointsByCode which loads all existing records).
//
// CSV Header: reference,status,name,program,dxcc,state,county,continent,iota,
//             iaruLocator,latitude,longitude,IUCNcat,validFrom,validTo,notes,
//             lastMod,changeLog,reviewFlag,specialFlags,website,country,region,dxccEnum,qsoCount,lastAct
//
// Accepts: { countries: "all" | string[], save: boolean }
// Returns: { refs: [...], count, saved, source }

const WWFF_CSV_URL = 'https://wwff.co/wwff-data/wwff_directory.csv';
const FETCH_TIMEOUT_MS = 60000; // 60s — CSV is 24MB
const BATCH_SIZE = 500;

// CSV line parser — handles quoted fields containing commas
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      fields.push(current); current = '';
    } else { current += char; }
  }
  fields.push(current);
  return fields;
}

// DXCC prefix → ISO2 country code map (derived from the WWFF reference code prefix)
const DXCC_TO_ISO2: Record<string, string> = {
  'DL': 'DE', 'OE': 'AT', 'F': 'FR', 'I': 'IT', 'EA': 'ES', 'CT': 'PT',
  'G': 'GB', 'GM': 'GB', 'GW': 'GB', 'GI': 'GB', 'GD': 'GB', 'EI': 'IE',
  'ON': 'BE', 'PA': 'NL', 'LX': 'LU', 'OZ': 'DK', 'SM': 'SE', 'LA': 'NO',
  'OH': 'FI', 'TF': 'IS', 'SP': 'PL', 'OK': 'CZ', 'OM': 'SK', 'HA': 'HU',
  'S5': 'SI', '9A': 'HR', 'YU': 'RS', 'E7': 'BA', '4O': 'ME', 'ZA': 'AL',
  'Z3': 'MK', 'ES': 'EE', 'YL': 'LV', 'LY': 'LT', 'SV': 'GR', 'LZ': 'BG',
  'YO': 'RO', 'TA': 'TR', '5B': 'CY', '9H': 'MT', 'HB': 'CH', 'HB0': 'LI',
  'W': 'US', 'K': 'US', 'VE': 'CA', 'VY': 'CA', 'JA': 'JP', 'HL': 'KR',
  'BY': 'CN', 'VU': 'IN', 'VK': 'AU', 'ZL': 'NZ', 'ZS': 'ZA',
  'PY': 'BR', 'PP': 'BR', 'PQ': 'BR', 'LU': 'AR', 'AY': 'AR',
  'CE': 'CL', 'CA': 'CL',
};

// ISO2 → DXCC prefix map (for country filtering)
const ISO2_TO_DXCC: Record<string, string[]> = {
  CH: ['HB'], LI: ['HB0'], DE: ['DL'], AT: ['OE'], FR: ['F'], IT: ['I'],
  ES: ['EA'], PT: ['CT'], GB: ['G', 'GM', 'GW', 'GI', 'GD'], IE: ['EI'],
  BE: ['ON'], NL: ['PA'], LU: ['LX'], DK: ['OZ'], SE: ['SM'], NO: ['LA'],
  FI: ['OH'], IS: ['TF'], PL: ['SP'], CZ: ['OK'], SK: ['OM'], HU: ['HA'],
  SI: ['S5'], HR: ['9A'], RS: ['YU'], BA: ['E7'], ME: ['4O'], AL: ['ZA'],
  MK: ['Z3'], EE: ['ES'], LV: ['YL'], LT: ['LY'], GR: ['SV'], BG: ['LZ'],
  RO: ['YO'], TR: ['TA'], CY: ['5B'], MT: ['9H'],
  US: ['W', 'K'], CA: ['VE', 'VY'], JP: ['JA'], KR: ['HL'], CN: ['BY'],
  IN: ['VU'], AU: ['VK'], NZ: ['ZL'], ZA: ['ZS'], BR: ['PY', 'PP', 'PQ'],
  AR: ['LU', 'AY'], CL: ['CE', 'CA'],
};

async function downloadWwffCsv(): Promise<string> {
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const resp = await fetch(WWFF_CSV_URL, {
        headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        const bodySnippet = await resp.text().catch(() => '').then(t => t.substring(0, 200));
        throw new Error(`WWFF CSV HTTP ${resp.status} ${resp.statusText}${bodySnippet ? ' — ' + bodySnippet : ''}`);
      }
      return await resp.text();
    } catch (e: any) {
      lastError = e?.name === 'AbortError' ? `WWFF CSV Timeout nach ${FETCH_TIMEOUT_MS / 1000}s (Versuch ${attempt + 1}/3)` : `WWFF CSV: ${e?.message || 'Fetch fehlgeschlagen'} (Versuch ${attempt + 1}/3)`;
      if (attempt < 2) await new Promise(r => setTimeout(r, 5000));
    }
  }
  throw new Error(lastError || 'WWFF CSV fetch failed');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const { countries, save = true } = body;

    // 1. Download CSV
    const csvText = await downloadWwffCsv();
    const lines = csvText.split('\n');
    if (lines.length < 2) {
      return Response.json({ error: 'WWFF CSV leer oder nicht erreichbar' }, { status: 502 });
    }

    // 2. Parse CSV — filter active records with valid coords
    const refs: any[] = [];
    let skippedInactive = 0;
    let skippedNoCoords = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCsvLine(line);
      if (cols.length < 12) continue;

      const reference = cols[0];
      const status = cols[1];
      const name = cols[2];
      const lat = parseFloat(cols[10]);
      const lng = parseFloat(cols[11]);
      const website = cols[20] || '';

      if (!reference || !name) continue;
      // Only import active records
      if (status && status !== 'active') { skippedInactive++; continue; }
      // Skip records without valid coordinates (not 0,0)
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) { skippedNoCoords++; continue; }

      // Derive country_code from WWFF reference code (e.g. "DLFF-0123" → "DE")
      const refPart = reference.split('-')[0].toUpperCase();
      const dxcc = refPart.replace(/FF$/, '');
      const country_code = DXCC_TO_ISO2[dxcc] || dxcc;

      refs.push({
        code: reference,
        name: name,
        lat: lat,
        lng: lng,
        country_code: country_code,
        park_type: 'WWFF',
        link: website || 'https://wwff.co/directory/',
        last_synced: new Date().toISOString(),
      });
    }

    // 3. Filter by countries if specified
    let filteredRefs = refs;
    if (countries && countries !== 'all' && Array.isArray(countries) && countries.length > 0) {
      const prefixes = new Set<string>();
      for (const iso2 of countries) {
        const mapped = ISO2_TO_DXCC[iso2.toUpperCase()];
        if (mapped) for (const p of mapped) prefixes.add(p);
      }
      if (prefixes.size > 0) {
        filteredRefs = refs.filter(r => {
          const refPart = (r.code || '').split('-')[0].toUpperCase();
          const dxcc = refPart.replace(/FF$/, '');
          return prefixes.has(dxcc);
        });
      }
    }

    // 4. Save to WwffPoint entity — delete all + bulk create (faster than upsert)
    let saved = 0;
    if (save && filteredRefs.length > 0) {
      // Delete all existing WwffPoint records in batches
      try {
        for (let attempt = 0; attempt < 100; attempt++) {
          const existing = await base44.asServiceRole.entities.WwffPoint.list("-created_date", 5000);
          if (!existing || existing.length === 0) break;
          await base44.asServiceRole.entities.WwffPoint.deleteMany({ id: { $in: existing.map(r => r.id) } });
          if (existing.length < 5000) break;
        }
      } catch {}

      // Bulk create in batches of 500
      for (let i = 0; i < filteredRefs.length; i += BATCH_SIZE) {
        const batch = filteredRefs.slice(i, i + BATCH_SIZE);
        try {
          await base44.asServiceRole.entities.WwffPoint.bulkCreate(batch);
          saved += batch.length;
        } catch (e: any) {
          // Continue with next batch — partial save is better than none
        }
      }

      // Update ReferenceData metadata
      try {
        const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'hbff' });
        const now = new Date().toISOString();
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
            references: [], total_count: saved, source: 'wwff.co CSV (worldwide)', last_updated: now,
          });
        } else {
          await base44.asServiceRole.entities.ReferenceData.create({
            type: 'hbff', references: [], total_count: saved, source: 'wwff.co CSV (worldwide)', last_updated: now,
          });
        }
      } catch {}
    }

    return Response.json({
      refs: filteredRefs,
      count: filteredRefs.length,
      saved,
      skipped_inactive: skippedInactive,
      skipped_no_coords: skippedNoCoords,
      source: (countries && countries !== 'all' && Array.isArray(countries) && countries.length > 0)
        ? `WWFF CSV (filtered: ${countries.join(', ')})` : 'WWFF CSV (worldwide)',
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}