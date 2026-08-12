// Additional repeater sources beyond RepeaterBook.
// Sources: WIA Australia (CSV), dstarusers.org (D-STAR worldwide HTML table)
// Imported by repeaterScraper.ts and used in fetchRepeaterData().

const FETCH_TIMEOUT_MS = 12000;

async function fetchWithTimeout(url: string, opts?: any): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      ...opts,
      signal: controller.signal,
    });
    return resp;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Mode/band helpers (duplicated from repeaterScraper to avoid circular imports) ───

function getBand(frequency: number): string {
  if (frequency >= 28 && frequency < 30) return '10m';
  if (frequency >= 50 && frequency < 54) return '6m';
  if (frequency >= 70 && frequency < 73) return '4m';
  if (frequency >= 144 && frequency < 148) return '2m';
  if (frequency >= 430 && frequency < 440) return '70cm';
  if (frequency >= 1240 && frequency < 1300) return '23cm';
  return 'Other';
}

function getPrimaryMode(modes: string[]): string {
  for (const mode of ['DMR', 'D-STAR', 'Fusion', 'P-25', 'NXDN', 'M17']) {
    if (modes.includes(mode)) return mode;
  }
  if (modes.includes('FM')) return 'FM';
  return 'Other';
}

// ─── WIA Australia (CSV download) ───
// WIA (Wireless Institute of Australia) publishes a CSV with all Australian repeaters.
// The CSV has no coordinates, but callsign prefixes (VK1-VK8) map to states/territories.
// We use approximate state-center coordinates for each VK prefix.

const VK_STATE_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  'VK1': { lat: -35.3, lng: 149.1, name: 'ACT' },
  'VK2': { lat: -33.3, lng: 151.0, name: 'NSW' },
  'VK3': { lat: -37.5, lng: 145.0, name: 'VIC' },
  'VK4': { lat: -27.0, lng: 153.0, name: 'QLD' },
  'VK5': { lat: -34.9, lng: 138.6, name: 'SA' },
  'VK6': { lat: -31.9, lng: 115.9, name: 'WA' },
  'VK7': { lat: -42.0, lng: 146.5, name: 'TAS' },
  'VK8': { lat: -19.5, lng: 133.8, name: 'NT' },
};

// WIA status codes → our status enum
function mapWiaStatus(s: string): string {
  switch (s?.trim()) {
    case 'O': return 'on-air';
    case 'W': return 'on-air'; // Weekly broadcast — operational
    case 'L': return 'testing'; // Licensed
    case 'LN': return 'off-air'; // Licensed non-operational
    case 'X': return 'off-air'; // Not operational
    default: return 'unknown';
  }
}

export async function fetchWiaRepeaterData(): Promise<any[]> {
  const repeaters: any[] = [];

  // 1. Fetch the data page to find the current CSV URL (date in filename changes)
  let csvUrl: string | null = null;
  try {
    const resp = await fetchWithTimeout('https://www.wia.org.au/members/repeaters/data/', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
    });
    if (resp && resp.ok) {
      const html = await resp.text();
      const match = html.match(/href="(https:\/\/www\.wia\.org\.au\/members\/repeaters\/data\/documents\/WIA%20Repeater%20Directory%20[^"]+\.csv)"/i);
      if (match) csvUrl = match[1];
    }
  } catch {}

  if (!csvUrl) {
    csvUrl = 'https://www.wia.org.au/members/repeaters/data/documents/WIA%20Repeater%20Directory%20260705.csv';
  }

  // 2. Download and parse the CSV
  let csvText: string | null = null;
  try {
    const resp = await fetchWithTimeout(csvUrl, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/csv,*/*' },
    });
    if (!resp || !resp.ok) return [];
    csvText = await resp.text();
  } catch {
    return [];
  }

  if (!csvText) return [];

  // 3. Parse CSV — format: Output, Input, Call, Location, Service Area, S, ERP, HASL, T/O, Sp, Tone, Notes
  // Section headers are in {{BAND;MODE;VKx}} format, e.g. {{10M;FM;*}}, {{6M;FM;VK2}}, etc.
  const lines = csvText.split('\n');
  let currentMode = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Section header: {{10M;FM;VK2}}
    const sectionMatch = trimmed.match(/^\{\{([^;]+);([^;]+);([^}]+)\}\}/);
    if (sectionMatch) {
      currentMode = sectionMatch[2].trim();
      continue;
    }

    // Data row: comma-separated
    const cols = trimmed.split(',');
    if (cols.length < 6) continue;

    const outputFreq = parseFloat(cols[0]?.trim() || '');
    const inputFreq = parseFloat(cols[1]?.trim() || '');
    const callsign = cols[2]?.trim() || '';
    const location = cols[3]?.trim() || '';
    const serviceArea = cols[4]?.trim() || '';
    const statusCode = cols[5]?.trim() || '';
    const tone = cols[10]?.trim() || '';

    if (!callsign || !callsign.match(/^VK\d/i)) continue;
    if (isNaN(outputFreq) || outputFreq <= 0) continue;

    const vkPrefix = callsign.substring(0, 3).toUpperCase();
    const stateCoords = VK_STATE_COORDS[vkPrefix];
    if (!stateCoords) continue;

    const freqMHz = outputFreq;
    const band = getBand(freqMHz);
    const modes = currentMode ? (currentMode === 'DSTAR' ? ['D-STAR'] : [currentMode]) : ['FM'];
    const primaryMode = getPrimaryMode(modes);
    const offset_mhz = !isNaN(inputFreq) ? (inputFreq - freqMHz) : 0;

    repeaters.push({
      sourceId: 'wia-' + callsign + '-' + freqMHz,
      detailUrl: null,
      _entryCode: 'AU',
      frequency: freqMHz,
      offsetSign: offset_mhz >= 0 ? '+' : '-',
      offset_mhz,
      tone: tone === '-' ? '' : tone,
      modes,
      primary_mode: primaryMode,
      location_name: location || serviceArea,
      callsign,
      country: 'Australia',
      country_code: 'AU',
      band,
      status: mapWiaStatus(statusCode),
      lat: stateCoords.lat,
      lng: stateCoords.lng,
      web_url: null,
      echolink_node: null,
      fm_funknetz: false,
    });
  }

  const seen = new Set<string>();
  return repeaters.filter(r => {
    const key = r.callsign + '_' + r.frequency;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── dstarusers.org (D-STAR repeaters worldwide) ───
// Scrape the HTML table at dstarusers.org/repeaters.php
// Columns: Callsign, City, State, 2m, 70cm, 23cm, 23cmDD
// No coordinates — use US state centers or country centers for approximate positioning.

const US_STATE_COORDS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AK: [64.2, -149.5], AZ: [34.2, -111.5], AR: [34.8, -92.4],
  CA: [37.2, -119.8], CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5],
  FL: [27.8, -81.7], GA: [32.8, -83.6], HI: [20.3, -156.8], ID: [44.2, -114.5],
  IL: [40.0, -89.2], IN: [40.0, -86.3], IA: [42.0, -93.5], KS: [38.5, -98.0],
  KY: [37.5, -85.3], LA: [31.0, -92.0], ME: [45.3, -69.0], MD: [39.3, -77.2],
  MA: [42.2, -71.8], MI: [44.0, -85.5], MN: [46.0, -94.2], MS: [32.8, -89.7],
  MO: [38.5, -92.5], MT: [47.0, -109.5], NE: [41.5, -99.8], NV: [39.5, -117.0],
  NH: [43.7, -71.5], NJ: [40.0, -74.5], NM: [34.5, -105.9], NY: [42.8, -75.5],
  NC: [35.5, -79.2], ND: [47.5, -100.5], OH: [40.2, -82.5], OK: [35.5, -97.5],
  OR: [44.0, -120.5], PA: [40.9, -77.2], RI: [41.7, -71.5], SC: [34.0, -81.0],
  SD: [44.5, -100.0], TN: [35.8, -86.3], TX: [31.0, -97.5], UT: [40.0, -111.5],
  VT: [44.0, -72.7], VA: [37.5, -78.5], WA: [47.4, -120.8], WV: [38.5, -80.5],
  WI: [44.5, -89.5], WY: [43.0, -107.3], DC: [38.9, -77.0], GU: [13.4, 144.8],
};

const COUNTRY_COORDS: Record<string, { iso2: string; lat: number; lng: number }> = {
  'australia': { iso2: 'AU', lat: -25.3, lng: 133.8 },
  'austria': { iso2: 'AT', lat: 47.5, lng: 14.5 },
  'belgium': { iso2: 'BE', lat: 50.6, lng: 4.6 },
  'brazil': { iso2: 'BR', lat: -14.2, lng: -51.9 },
  'bulgaria': { iso2: 'BG', lat: 42.7, lng: 25.2 },
  'canada': { iso2: 'CA', lat: 56.1, lng: -106.3 },
  'chile': { iso2: 'CL', lat: -35.7, lng: -71.5 },
  'china': { iso2: 'CN', lat: 35, lng: 103.8 },
  'colombia': { iso2: 'CO', lat: 4.6, lng: -74.3 },
  'croatia': { iso2: 'HR', lat: 45.1, lng: 15.2 },
  'cyprus': { iso2: 'CY', lat: 35.1, lng: 33.4 },
  'czech republic': { iso2: 'CZ', lat: 49.8, lng: 15.5 },
  'denmark': { iso2: 'DK', lat: 56.3, lng: 9.5 },
  'finland': { iso2: 'FI', lat: 61.9, lng: 25.7 },
  'france': { iso2: 'FR', lat: 46.6, lng: 2.2 },
  'germany': { iso2: 'DE', lat: 51.2, lng: 10.5 },
  'greece': { iso2: 'GR', lat: 39.1, lng: 21.8 },
  'hong kong': { iso2: 'HK', lat: 22.3, lng: 114.2 },
  'hungary': { iso2: 'HU', lat: 47.2, lng: 19.5 },
  'iceland': { iso2: 'IS', lat: 64.9, lng: -19.0 },
  'india': { iso2: 'IN', lat: 22.6, lng: 78.9 },
  'indonesia': { iso2: 'ID', lat: -2.5, lng: 118.0 },
  'ireland': { iso2: 'IE', lat: 53.4, lng: -8.2 },
  'italy': { iso2: 'IT', lat: 42.5, lng: 12.6 },
  'japan': { iso2: 'JP', lat: 36.2, lng: 138.2 },
  'korea, south': { iso2: 'KR', lat: 36.6, lng: 127.8 },
  'mexico': { iso2: 'MX', lat: 23.6, lng: -102.6 },
  'namibia': { iso2: 'NA', lat: -22.0, lng: 17.0 },
  'netherlands antilles': { iso2: 'CW', lat: 12.2, lng: -69.0 },
  'new zealand': { iso2: 'NZ', lat: -41.0, lng: 174.0 },
  'norway': { iso2: 'NO', lat: 60.5, lng: 8.5 },
  'panama': { iso2: 'PA', lat: 8.5, lng: -80.8 },
  'philippines': { iso2: 'PH', lat: 12.9, lng: 121.8 },
  'poland': { iso2: 'PL', lat: 51.9, lng: 19.1 },
  'portugal': { iso2: 'PT', lat: 39.4, lng: -8.2 },
  'romania': { iso2: 'RO', lat: 45.9, lng: 24.9 },
  'russia': { iso2: 'RU', lat: 61.5, lng: 105.3 },
  'san marino': { iso2: 'SM', lat: 43.9, lng: 12.5 },
  'serbia': { iso2: 'RS', lat: 44.0, lng: 21.0 },
  'slovakia': { iso2: 'SK', lat: 48.7, lng: 19.7 },
  'slovenia': { iso2: 'SI', lat: 46.2, lng: 14.9 },
  'south africa': { iso2: 'ZA', lat: -30.6, lng: 22.9 },
  'south korea': { iso2: 'KR', lat: 36.6, lng: 127.8 },
  'spain': { iso2: 'ES', lat: 40.5, lng: -3.7 },
  'sweden': { iso2: 'SE', lat: 62.0, lng: 15.0 },
  'switzerland': { iso2: 'CH', lat: 46.8, lng: 8.2 },
  'taiwan': { iso2: 'TW', lat: 23.7, lng: 121.0 },
  'thailand': { iso2: 'TH', lat: 15.9, lng: 100.9 },
  'the netherlands': { iso2: 'NL', lat: 52.1, lng: 5.3 },
  'trinidad and tobago': { iso2: 'TT', lat: 10.7, lng: -61.2 },
  'turkey': { iso2: 'TR', lat: 39.0, lng: 35.2 },
  'uk': { iso2: 'GB', lat: 54.0, lng: -2.5 },
  'ukraine': { iso2: 'UA', lat: 48.9, lng: 31.4 },
  'united arab emirates': { iso2: 'AE', lat: 23.4, lng: 53.8 },
  'usa': { iso2: 'US', lat: 39.8, lng: -98.6 },
  'venezuela': { iso2: 'VE', lat: 6.4, lng: -66.6 },
  'el salvador': { iso2: 'SV', lat: 13.7, lng: -88.9 },
  'guatemala': { iso2: 'GT', lat: 15.7, lng: -90.2 },
  'haiti': { iso2: 'HT', lat: 18.9, lng: -72.3 },
  'honduras': { iso2: 'HN', lat: 14.6, lng: -86.2 },
  'nicaragua': { iso2: 'NI', lat: 12.9, lng: -85.2 },
  'argentina': { iso2: 'AR', lat: -38.4, lng: -63.6 },
};

function parseFreqString(str: string): { freq: number; offset: number } | null {
  const match = str.match(/([\d.]+)\s*MHz\s*([+\-][\d.]+)/i);
  if (!match) return null;
  const freq = parseFloat(match[1]);
  const offset = parseFloat(match[2]);
  if (isNaN(freq) || freq <= 0) return null;
  return { freq, offset };
}

export async function fetchDstarUsersData(): Promise<any[]> {
  const repeaters: any[] = [];

  let html: string | null = null;
  try {
    const resp = await fetchWithTimeout('https://dstarusers.org/repeaters.php?repeatersort=1', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
    });
    if (!resp || !resp.ok) return [];
    html = await resp.text();
  } catch {
    return [];
  }

  if (!html) return [];

  const rowRegex = /<tr[^>]*>\s*<td[^>]*>\s*<a[^>]*href="viewrepeater\.php\?system=([^"]+)"[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const callsign = match[2].trim();
    const city = match[3].trim();
    const state = match[4].trim();
    const freq2m = match[5].trim();
    const freq70cm = match[6].trim();
    const freq23cm = match[7].trim();

    if (!callsign) continue;

    let countryCode = 'US';
    let lat: number | null = null;
    let lng: number | null = null;
    let country = 'United States';

    if (state.length === 2 && state === state.toUpperCase() && US_STATE_COORDS[state]) {
      const coords = US_STATE_COORDS[state];
      lat = coords[0];
      lng = coords[1];
    } else {
      const stateLower = state.toLowerCase();
      if (COUNTRY_COORDS[stateLower]) {
        const cc = COUNTRY_COORDS[stateLower];
        lat = cc.lat;
        lng = cc.lng;
        countryCode = cc.iso2;
        country = state;
      }
    }

    const bandFreqs: { freqStr: string }[] = [];
    if (freq2m) bandFreqs.push({ freqStr: freq2m });
    if (freq70cm) bandFreqs.push({ freqStr: freq70cm });
    if (freq23cm) bandFreqs.push({ freqStr: freq23cm });

    for (const bf of bandFreqs) {
      const parsed = parseFreqString(bf.freqStr);
      if (!parsed) continue;

      const band = getBand(parsed.freq);
      const modes = ['D-STAR'];

      repeaters.push({
        sourceId: 'dstarusers-' + callsign + '-' + parsed.freq,
        detailUrl: `https://dstarusers.org/viewrepeater.php?system=${callsign}`,
        _entryCode: countryCode,
        frequency: parsed.freq,
        offsetSign: parsed.offset >= 0 ? '+' : '-',
        offset_mhz: parsed.offset,
        tone: '',
        modes,
        primary_mode: 'D-STAR',
        location_name: city || state || '',
        callsign,
        country,
        country_code: countryCode,
        band,
        status: 'unknown',
        lat,
        lng,
        web_url: `https://dstarusers.org/viewrepeater.php?system=${callsign}`,
        echolink_node: null,
        fm_funknetz: false,
      });
    }
  }

  const seen = new Set<string>();
  return repeaters.filter(r => {
    const key = r.callsign + '_' + r.frequency;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main export: fetch all additional sources ───

export async function fetchAdditionalRepeaterSources(): Promise<{
  wia: any[];
  dstar: any[];
}> {
  const [wia, dstar] = await Promise.allSettled([
    fetchWiaRepeaterData(),
    fetchDstarUsersData(),
  ]);

  return {
    wia: wia.status === 'fulfilled' ? wia.value : [],
    dstar: dstar.status === 'fulfilled' ? dstar.value : [],
  };
}