import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

// Parse semicolon-separated CSV line
function parseCsvLine(line) {
  return line.split(';').map((v) => v.trim());
}

// Fetch and parse Swiss CSV file from URL
async function fetchSwissCsv(url, type) {
  const resp = await fetch(url, {
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

// Fetch worldwide TOTA towers from wwtota.com by scraping the tower list HTML table
async function fetchWorldwideTota() {
  try {
    const resp = await fetch('https://wwtota.com/seznam/?lang=en', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'text/html' },
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const records = [];

    // Parse table rows — the table has columns:
    // Ref_No | Name | Town | District | Region | Spot height | Height | Locator | Accessible | ...
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const cells = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        // Strip HTML tags and decode entities
        const text = cellMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
        cells.push(text);
      }
      // Need at least 8 columns and a valid Ref_No
      if (cells.length >= 8 && cells[0] && cells[1] && cells[0].length > 2) {
        const refNo = cells[0];
        const name = cells[1];
        const town = cells[2] || '';
        const locator = cells[7] || '';
        const spotHeight = parseFloat(cells[5]) || null;
        const height = parseFloat(cells[6]) || null;

        // Skip header rows or empty rows
        if (refNo === 'Ref_No' || !refNo.match(/[A-Z]/)) continue;

        const coords = maidenheadToLatLng(locator);
        if (coords) {
          // Derive country code from prefix (e.g. OKR → CZ, DLR → DE)
          const prefix = refNo.split('-')[0];
          const countryMap = {
            OKR: 'CZ', OMR: 'SK', DLR: 'DE', OER: 'AT', SPR: 'PL',
            KPR: 'PR', PAR: 'NL', LUR: 'AR', HIR: 'DO', EAR: 'ES',
            CER: 'CL', CTR: 'PT', LZR: 'BG', ONR: 'BE', GBR: 'GB',
            CUR: 'PT', '9MR': 'MY',
          };
          const cc = countryMap[prefix] || '';
          records.push({
            code: refNo,
            name: name,
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
      }
    }
    return records;
  } catch {
    return [];
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin')
      return Response.json({ error: 'Forbidden — Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
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
        await base44.asServiceRole.entities.TotaPoint.deleteMany({
          source: 'wwtota.com',
        });
        for (let i = 0; i < worldwide.length; i += 500) {
          const batch = worldwide.slice(i, i + 500);
          await base44.asServiceRole.entities.TotaPoint.bulkCreate(batch);
        }
        worldwideImported = worldwide.length;
      } catch (e) {
        errors.push('Worldwide: ' + e.message);
      }
    }

    // Get current total count
    const existing = await base44.asServiceRole.entities.TotaPoint.list(
      '-created_date',
      20000
    );
    const totalCount = existing ? existing.length : 0;
    const antennaCount = existing
      ? existing.filter((t) => t.type === 'antenna').length
      : 0;
    const towerCount = existing
      ? existing.filter((t) => t.type === 'tower').length
      : 0;

    return Response.json({
      success: errors.length === 0,
      antennas_imported: antennasImported,
      towers_imported: towersImported,
      worldwide_imported: worldwideImported,
      total_count: totalCount,
      antenna_count: antennaCount,
      tower_count: towerCount,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}