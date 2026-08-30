import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { upsertPointsByCode } from '../../shared/pointUpsert.ts';

// LV95 (Swiss Grid 1995) → WGS84 conversion
// Formula from swisstopo (Federal Office of Topography)
function lv95ToWgs84(E, N) {
  const y = (E - 2600000) / 1000000;
  const x = (N - 1200000) / 1000000;
  const lat_sec = 16.902389
    + 3.238648 * x
    - 0.270978 * x * y
    - 0.00257746 * x * x
    - 0.0446937 * x * y * y
    - 0.0140821 * x * x * x;
  const lng_sec = 2.6779094
    + 4.728982 * y
    + 0.791805 * x * y
    + 0.7862721 * y * y
    - 0.1934627 * x * x * y
    - 0.0227111 * y * y * y
    + 0.0173384 * x * x * y * y
    - 0.0086201 * y * y * y * y;
  return { lat: (lat_sec * 100) / 36, lng: (lng_sec * 100) / 36 };
}

// Maidenhead grid locator → WGS84 (approximate center of grid square)
function maidenheadToLatLng(locator) {
  if (!locator || locator.length < 4) return null;
  const A = locator.charCodeAt(0) - 65;
  const B = locator.charCodeAt(1) - 65;
  const C = parseInt(locator[2]);
  const D = parseInt(locator[3]);
  let E = 0, F = 0;
  if (locator.length >= 6) {
    E = locator.charCodeAt(4) - 65;
    F = locator.charCodeAt(5) - 65;
  }
  if (A < 0 || A > 17 || B < 0 || B > 17 || isNaN(C) || isNaN(D)) return null;
  const lng = A * 20 + C * 2 + (E + 0.5) / 12 - 180;
  const lat = B * 10 + D * 1 + (F + 0.5) / 24 - 90;
  return { lat, lng };
}

// Parse CSV line with configurable delimiter (semicolon or comma)
function parseCsvLine(line, delimiter = ';') {
  // Handle quoted fields that may contain the delimiter
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Validate that a URL is safe to fetch server-side (SSRF protection).
// Only HTTPS allowed; blocks private/loopback/link-local/metadata IP ranges.
function validateExternalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }
  const host = parsed.hostname.toLowerCase();
  // Block loopback / localhost
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    throw new Error('Local addresses are not allowed');
  }
  // Block link-local / metadata endpoint
  if (host === '169.254.169.254' || host.startsWith('169.254.')) {
    throw new Error('Link-local addresses are not allowed');
  }
  // Block private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [parseInt(ipv4Match[1]), parseInt(ipv4Match[2])];
    if (a === 10) throw new Error('Private IP range not allowed');
    if (a === 172 && b >= 16 && b <= 31) throw new Error('Private IP range not allowed');
    if (a === 192 && b === 168) throw new Error('Private IP range not allowed');
  }
  return parsed.href;
}

// Fetch and parse Swiss CSV file from URL
async function fetchSwissCsv(url, type) {
  const safeUrl = validateExternalUrl(url);
  const resp = await fetch(safeUrl, {
    headers: { 'User-Agent': 'HB9OM-OnField/1.0' },
  });
  if (!resp.ok) throw new Error('CSV fetch failed: ' + resp.status);
  const text = await resp.text();
  const lines = text.split('\n').filter((l) => l.trim());
  const records = [];

  // Skip header line (first line)
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 3) continue;

    if (type === 'antenna') {
      // Antennen.csv: OBJEKTART;X_Koord;Y_Koord
      const objektart = cols[0] || 'Antenne';
      const x = parseFloat(cols[1]);
      const y = parseFloat(cols[2]);
      if (!isNaN(x) && !isNaN(y)) {
        const { lat, lng } = lv95ToWgs84(x, y);
        records.push({
          code: 'CH-ANT-' + String(i).padStart(4, '0'),
          name: objektart,
          type: 'antenna',
          subtype: objektart,
          lat,
          lng,
          country: 'Switzerland',
          country_code: 'CH',
          source: 'swiss_csv',
        });
      }
    } else if (type === 'tower') {
      // Turm.csv: OBJEKTART;NUTZUNG;NAME;X_KOORD;Y_KOORD
      const nutzung = cols[1] || '';
      const name = cols[2] || nutzung || 'Turm';
      const x = parseFloat(cols[3]);
      const y = parseFloat(cols[4]);
      if (!isNaN(x) && !isNaN(y)) {
        const { lat, lng } = lv95ToWgs84(x, y);
        records.push({
          code: 'CH-TWR-' + String(i).padStart(4, '0'),
          name: name,
          type: 'tower',
          subtype: nutzung,
          lat,
          lng,
          country: 'Switzerland',
          country_code: 'CH',
          source: 'swiss_csv',
          usage: nutzung,
        });
      }
    }
  }
  return records;
}

// Country code map for TOTA reference prefixes (e.g. OKR → CZ, DLR → DE)
// Extended with additional prefixes from wwtota.com
const TOTA_COUNTRY_MAP: Record<string, string> = {
  OKR: 'CZ', OMR: 'SK', DLR: 'DE', OER: 'AT', SPR: 'PL',
  KPR: 'PR', PAR: 'NL', LUR: 'AR', HIR: 'DO', EAR: 'ES',
  CER: 'CL', CTR: 'PT', LZR: 'BG', ONR: 'BE', GBR: 'GB',
  CUR: 'PT', '9MR': 'MY',
  // Additional prefixes
  FRA: 'FR', ITR: 'IT', HUR: 'HU', ROR: 'RO', SRR: 'RS',
  HRR: 'HR', SIR: 'SI', BAR: 'BA', MKR: 'MK', ALR: 'AL',
  MTR: 'MT', CYR: 'CY', GRR: 'GR', LTR: 'LT', LVR: 'LV',
  ERR: 'EE', FIR: 'FI', SFR: 'SE', NOR: 'NO', DKR: 'DK',
  ICR: 'IS', IRR: 'IE', LUR2: 'LU', SWR: 'CH',
  USR: 'US', CAR: 'CA', MXR: 'MX', BRR: 'BR', AUR: 'AU',
  NZR: 'NZ', JPR: 'JP', KRR: 'KR', CNR: 'CN', INR: 'IN',
  IDR: 'ID', THR: 'TH', MYR2: 'MY', PHR: 'PH', SGR: 'SG',
  TRR: 'TR', IRR2: 'IR', ISR: 'IL', ZAR: 'ZA',
};

// Fetch worldwide TOTA towers from wwtota.com CSV export endpoint.
// The website uses DataTables (client-side JS rendering) so HTML scraping returns
// an empty tbody. The site provides a CSV download at /servis/generate_csv.php?ref=ALL
// which returns all 5300+ towers with semicolon-separated columns.
async function fetchWorldwideTota() {
  try {
    const resp = await fetch('https://wwtota.com/servis/generate_csv.php?ref=ALL', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'text/csv,*/*' },
    });
    if (!resp.ok) return [];
    const text = await resp.text();
    if (!text || text.length < 50) return [];

    // Detect delimiter: semicolon or comma
    const firstLine = text.split('\n')[0] || '';
    const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];

    // Parse header to find column indices
    const header = parseCsvLine(lines[0], delimiter);
    const colIdx: Record<string, number> = {};
    header.forEach((h, i) => {
      const key = h.toLowerCase().replace(/[^a-z0-9_]/g, '');
      colIdx[key] = i;
    });

    // Column name variants (CSV header may be in EN or CS)
    const refIdx = colIdx['refno'] ?? colIdx['ref_no'] ?? colIdx['ref'] ?? 0;
    const nameIdx = colIdx['name'] ?? colIdx['nazev'] ?? 1;
    const townIdx = colIdx['town'] ?? colIdx['obec'] ?? 2;
    const locIdx = colIdx['locator'] ?? colIdx['lokator'] ?? 7;
    const heightIdx = colIdx['height'] ?? colIdx['vyska'] ?? 6;
    const spotIdx = colIdx['spotheight'] ?? colIdx['spotheight'] ?? colIdx['kota'] ?? 5;

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i], delimiter);
      if (cols.length < 4) continue;

      const refNo = (cols[refIdx] || '').trim();
      const name = (cols[nameIdx] || '').trim();
      const locator = (cols[locIdx] || '').trim().toUpperCase();
      const height = parseFloat(cols[heightIdx]) || null;
      const spotHeight = parseFloat(cols[spotIdx]) || null;

      // Skip header rows or invalid refs
      if (!refNo || refNo === 'Ref_No' || !refNo.match(/[A-Z0-9]/)) continue;
      if (!locator || locator.length < 4) continue;

      const coords = maidenheadToLatLng(locator);
      if (!coords) continue;

      const prefix = refNo.split('-')[0].toUpperCase();
      const cc = TOTA_COUNTRY_MAP[prefix] || '';

      records.push({
        code: refNo,
        name: name || refNo,
        type: 'tower',
        subtype: 'Lookout Tower',
        lat: coords.lat,
        lng: coords.lng,
        country: '',
        country_code: cc,
        source: 'wwtota.com',
        locator: locator,
        height_m: height,
        spot_height_m: spotHeight,
      });
    }
    return records;
  } catch {
    return [];
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    const body = await req.json().catch(() => ({}));

    // Scheduled runs have no user context — allow if scheduled flag is set.
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin')
        return Response.json({ error: 'Forbidden — Admin only' }, { status: 403 });
    }

    const action = body.action || 'refresh';

    let antennasImported = 0;
    let towersImported = 0;
    let worldwideImported = 0;
    const errors = [];

    // Import Swiss CSV data (from uploaded file URLs)
    if (action === 'importSwiss' || action === 'refresh') {
      if (body.antennas_csv_url) {
        try {
          const antennas = await fetchSwissCsv(body.antennas_csv_url, 'antenna');
          // Delete old Swiss antenna records
          await base44.asServiceRole.entities.TotaPoint.deleteMany({
            source: 'swiss_csv',
            type: 'antenna',
          });
          // Bulk create in batches of 500
          for (let i = 0; i < antennas.length; i += 500) {
            const batch = antennas.slice(i, i + 500);
            await base44.asServiceRole.entities.TotaPoint.bulkCreate(batch);
          }
          antennasImported = antennas.length;
        } catch (e) {
          errors.push('Antennen: ' + e.message);
        }
      }
      if (body.towers_csv_url) {
        try {
          const towers = await fetchSwissCsv(body.towers_csv_url, 'tower');
          await base44.asServiceRole.entities.TotaPoint.deleteMany({
            source: 'swiss_csv',
            type: 'tower',
          });
          for (let i = 0; i < towers.length; i += 500) {
            const batch = towers.slice(i, i + 500);
            await base44.asServiceRole.entities.TotaPoint.bulkCreate(batch);
          }
          towersImported = towers.length;
        } catch (e) {
          errors.push('Tuerme: ' + e.message);
        }
      }
    }

    // Fetch worldwide data from wwtota.com
    if (action === 'fetchWorldwide' || action === 'refresh') {
      try {
        const worldwide = await fetchWorldwideTota();
        // Add last_synced to all worldwide records
        const syncDate = new Date().toISOString();
        for (const w of worldwide) {
          w.last_synced = syncDate;
        }
        // Use upsert-by-code: updates existing towers, creates new ones.
        // No deleteMany — prevents duplicates and data loss on timeout.
        const result = await upsertPointsByCode(base44, 'TotaPoint', 'tota', worldwide, 'wwtota.com');
        worldwideImported = result.created + result.updated;
      } catch (e) {
        errors.push('Worldwide: ' + e.message);
      }
    }

    // Count by type/source using filter (SDK list() caps at 5000 records)
    // Run counts in parallel for speed
    const [antennas, towers, swiss, worldwide] = await Promise.all([
      base44.asServiceRole.entities.TotaPoint.filter({ type: 'antenna' }, '-created_date', 1).catch(() => []),
      base44.asServiceRole.entities.TotaPoint.filter({ type: 'tower' }, '-created_date', 1).catch(() => []),
      base44.asServiceRole.entities.TotaPoint.filter({ source: 'swiss_csv' }, '-created_date', 1).catch(() => []),
      base44.asServiceRole.entities.TotaPoint.filter({ source: 'wwtota.com' }, '-created_date', 1).catch(() => []),
    ]);
    // filter() returns up to 5000 records — use length as a lower-bound count
    // For accurate counts, we'd need a count API, but this is sufficient for the admin UI
    const antennaCount = antennas ? antennas.length : 0;
    const towerCount = towers ? towers.length : 0;
    const swissCount = swiss ? swiss.length : 0;
    const worldwideCount = worldwide ? worldwide.length : 0;
    const totalCount = antennaCount + towerCount;

    return Response.json({
      success: errors.length === 0,
      count: antennasImported + towersImported + worldwideImported,
      antennas_imported: antennasImported,
      towers_imported: towersImported,
      worldwide_imported: worldwideImported,
      total_count: totalCount,
      antenna_count: antennaCount,
      tower_count: towerCount,
      swiss_count: swissCount,
      worldwide_count: worldwideCount,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}