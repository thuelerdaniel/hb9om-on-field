// Shared SOTA (Summits on the Air) worldwide data fetcher.
// Uses the bulk CSV download from sotadata.org.uk for efficiency
// (single HTTP request instead of thousands of API calls).
// Used by both fetchSOTA (on-demand) and refreshAllData (scheduled cache).

const SOTA_CSV_URL = 'https://www.sotadata.org.uk/summitslist.csv';

// Parse a single CSV line, handling quoted fields with embedded commas.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

// ISO2 country code → SOTA association prefix mapping.
// SOTA uses DXCC-based prefixes (e.g., HB=Switzerland, DL=Germany, F=France),
// NOT ISO2 codes. This reverse map is needed for offline downloads where the
// user selects countries by ISO2 code.
const ISO2_TO_SOTA_PREFIX: Record<string, string[]> = {
  CH: ['HB'], LI: ['HB0'], DE: ['DL'], AT: ['OE'], FR: ['F'], IT: ['I'],
  ES: ['EA'], PT: ['CT'], GB: ['G', 'GM', 'GW', 'GI', 'GD'], IE: ['EI'],
  BE: ['ON'], NL: ['PA'], LU: ['LX'], DK: ['OZ'], SE: ['SM'], NO: ['LA'],
  FI: ['OH'], IS: ['TF'], PL: ['SP'], CZ: ['OK'], SK: ['OM'], HU: ['HA'],
  SI: ['S5'], HR: ['9A'], RS: ['YU'], BA: ['E7'], ME: ['4O'], AL: ['ZA'],
  MK: ['Z3'], EE: ['ES'], LV: ['YL'], LT: ['LY'], GR: ['SV'], BG: ['LZ'],
  RO: ['YO'], TR: ['TA'], CY: ['5B', 'H2'], MT: ['9H'], AD: ['C31'],
  SM: ['T7'], MC: ['3A'], IM: ['GD'], FO: ['FO'], JE: ['GJ'], GG: ['GU'],
  XK: ['Z6'],
  US: ['W', 'K', 'KH6', 'KL7', 'KP2', 'KP3', 'KP4'], CA: ['VE', 'VY'],
  MX: ['XE', 'XF', 'XG'], JP: ['JA'], KR: ['HL'], CN: ['BY'], IN: ['VU'],
  TH: ['HS'], MY: ['9M'], PH: ['DU'], SG: ['9V'], NP: ['9N'], IL: ['4X'],
  AE: ['A6'], SA: ['HZ'], ZA: ['ZS'], MA: ['CN'], TN: ['3V'], DZ: ['7X'],
  LY: ['5A'], EG: ['SU'], ET: ['ET'], KE: ['5Z'], NG: ['5N'], GH: ['9G1'],
  AU: ['VK'], NZ: ['ZL'], PG: ['P2'], FJ: ['3D2'], BR: ['PY', 'PP', 'PQ'],
  AR: ['LU', 'AY', 'LO', 'LP'], CL: ['CE', 'CA'], CO: ['HK'], PE: ['OA'],
  EC: ['HC'], VE: ['YV'], UY: ['CX'], PY: ['ZP'], BO: ['CP'],
};

export function iso2ToSotaPrefixes(iso2Codes: string[]): string[] {
  const prefixes = new Set<string>();
  for (const iso2 of iso2Codes) {
    const mapped = ISO2_TO_SOTA_PREFIX[iso2.toUpperCase()];
    if (mapped) {
      for (const p of mapped) prefixes.add(p);
    }
  }
  return Array.from(prefixes);
}

// Fetch SOTA summits for specific ISO2 countries (or all if empty).
// Used by fetchSotaForOffline backend function for offline downloads.
export async function fetchSotaSummitsForCountries(
  iso2Codes: string[]
): Promise<{ summits: any[]; source: string }> {
  if (!iso2Codes || iso2Codes.length === 0) {
    // Fetch all
    const result = await fetchSotaSummits('all');
    return { summits: result.summits, source: 'SOTA CSV (worldwide)' };
  }
  const prefixes = iso2ToSotaPrefixes(iso2Codes);
  if (prefixes.length === 0) {
    return { summits: [], source: 'SOTA CSV (no matching prefixes)' };
  }
  const result = await fetchSotaSummits(prefixes);
  return { summits: result.summits, source: `SOTA CSV (${prefixes.join(', ')})` };
}

export async function fetchSotaSummits(
  scope: string | string[] = 'all',
  maxAssociations?: number
): Promise<{ summits: any[]; associations: string[]; association_count: number }> {
  // Always use the CSV for worldwide data — it's a single HTTP request
  // and contains all ~125,000 summits globally.
  // v0.9025: 300s timeout — CSV is large (~125k summits, ~20MB), needs generous timeout
  const resp = await fetch(SOTA_CSV_URL, {
    headers: { 'Accept': 'text/csv', 'User-Agent': 'HB9OM-OnField/1.0' },
    signal: AbortSignal.timeout(300000),
  });
  if (!resp.ok) throw new Error(`SOTA CSV fetch failed: ${resp.status}`);

  const text = await resp.text();
  const lines = text.split('\n');
  if (lines.length < 2) return { summits: [], associations: [], association_count: 0 };

  // Header: SummitCode,AssociationName,RegionName,SummitName,AltM,AltFt,
  //         GridRef1,GridRef2,Longitude,Latitude,Points,BonusPoints,
  //         ValidFrom,ValidTo,ActivationCount,ActivationDate,ActivationCall
  const allSummits: any[] = [];
  const associationNames = new Set<string>();
  const associationPrefixes = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 10) continue;

    const code = cols[0];
    if (!code) continue;

    // Extract association prefix (e.g., "HB/AG-001" → "HB")
    const prefix = code.split('/')[0];
    associationPrefixes.add(prefix);

    const lat = parseFloat(cols[9]);
    const lng = parseFloat(cols[8]);
    if (isNaN(lat) || isNaN(lng)) continue;

    const assocName = cols[1] || prefix;
    associationNames.add(assocName);

    allSummits.push({
      code: code,
      name: cols[3] || code,
      lat: lat,
      lng: lng,
      alt: parseInt(cols[4]) || 0,
      points: parseInt(cols[10]) || 0,
      activationCount: parseInt(cols[14]) || 0,
      region: cols[2] || ''
    });
  }

  // If scope is a specific set of associations, filter
  let filtered = allSummits;
  if (Array.isArray(scope) && scope.length > 0 && scope[0] !== 'all') {
    const scopeSet = new Set(scope.map((s: string) => s.toUpperCase()));
    filtered = allSummits.filter(s => scopeSet.has(s.code.split('/')[0].toUpperCase()));
  }

  return {
    summits: filtered,
    associations: Array.from(associationNames),
    association_count: associationPrefixes.size
  };
}