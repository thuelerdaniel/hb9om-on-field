// Shared SOTA (Summits on the Air) worldwide data fetcher.
// Uses the bulk CSV download from sotadata.org.uk for efficiency
// (single HTTP request instead of thousands of API calls).
// Used by both fetchSOTA (on-demand) and refreshAllData (scheduled cache).

const SOTA_CSV_URL = 'http://www.sotadata.org.uk/summitslist.csv';

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

export async function fetchSotaSummits(
  scope: string | string[] = 'all',
  maxAssociations?: number
): Promise<{ summits: any[]; associations: string[]; association_count: number }> {
  // Always use the CSV for worldwide data — it's a single HTTP request
  // and contains all ~125,000 summits globally.
  const resp = await fetch(SOTA_CSV_URL, {
    headers: { 'Accept': 'text/csv', 'User-Agent': 'HB9OM-OnField/1.0' }
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