// Shared repeater scraping logic — imported by fetchRepeaters and refreshAllData.
// Source: RepeaterBook.com (worldwide — 68+ countries)

const LIST_BASE = 'https://www.repeaterbook.com/row_repeaters/Display_SS.php';
const DETAIL_BASE = 'https://www.repeaterbook.com/row_repeaters/details.php';

const LIST_PARAMS = 'band=%25&freq=%25&band6=%25&loc=%25&call=%25&status_id=%25&features=%25&system=%25&coverage=%25&use=%25';

const MAX_DETAIL_FETCH = 1500;
const LIST_CONCURRENCY = 8;
const DETAIL_CONCURRENCY = 20;

// Country list from RepeaterBook row_repeaters index.
// Priority 1: Switzerland + neighbors (always fetch detail pages first)
// Priority 2: Rest of Europe
// Priority 3: Other continents
const COUNTRIES = [
  // Priority 1: Switzerland + neighbors
  { code: 'CH', name: 'Switzerland', priority: 1 },
  { code: 'LI', name: 'Liechtenstein', priority: 1 },
  { code: 'AT', name: 'Austria', priority: 1 },
  { code: 'FR', name: 'France', priority: 1 },
  { code: 'DE', name: 'Germany', priority: 1 },
  { code: 'IT', name: 'Italy', priority: 1 },
  // Priority 2: Rest of Europe
  { code: 'AL', name: 'Albania', priority: 2 },
  { code: 'AD', name: 'Andorra', priority: 2 },
  { code: 'BY', name: 'Belarus', priority: 2 },
  { code: 'BE', name: 'Belgium', priority: 2 },
  { code: 'BA', name: 'Bosnia and Herzegovina', priority: 2 },
  { code: 'BG', name: 'Bulgaria', priority: 2 },
  { code: 'HR', name: 'Croatia', priority: 2 },
  { code: 'CY', name: 'Cyprus', priority: 2 },
  { code: 'CZ', name: 'Czechia', priority: 2 },
  { code: 'DK', name: 'Denmark', priority: 2 },
  { code: 'EE', name: 'Estonia', priority: 2 },
  { code: 'FO', name: 'Faroe Islands', priority: 2 },
  { code: 'FI', name: 'Finland', priority: 2 },
  { code: 'GE', name: 'Georgia', priority: 2 },
  { code: 'GI', name: 'Gibraltar', priority: 2 },
  { code: 'GG', name: 'Guernsey', priority: 2 },
  { code: 'GR', name: 'Greece', priority: 2 },
  { code: 'HU', name: 'Hungary', priority: 2 },
  { code: 'IS', name: 'Iceland', priority: 2 },
  { code: 'IM', name: 'Isle of Man', priority: 2 },
  { code: 'IE', name: 'Ireland', priority: 2 },
  { code: 'JE', name: 'Jersey', priority: 2 },
  { code: 'XK', name: 'Kosovo', priority: 2 },
  { code: 'LV', name: 'Latvia', priority: 2 },
  { code: 'LT', name: 'Lithuania', priority: 2 },
  { code: 'LU', name: 'Luxembourg', priority: 2 },
  { code: 'MT', name: 'Malta', priority: 2 },
  { code: 'MD', name: 'Moldova', priority: 2 },
  { code: 'NL', name: 'Netherlands', priority: 2 },
  { code: 'NO', name: 'Norway', priority: 2 },
  { code: 'MK', name: 'North Macedonia', priority: 2 },
  { code: 'PL', name: 'Poland', priority: 2 },
  { code: 'PT', name: 'Portugal', priority: 2 },
  { code: 'RO', name: 'Romania', priority: 2 },
  { code: 'RU', name: 'Russian Federation', priority: 2 },
  { code: 'SM', name: 'San Marino', priority: 2 },
  { code: 'RS', name: 'Serbia', priority: 2 },
  { code: 'SK', name: 'Slovakia', priority: 2 },
  { code: 'SI', name: 'Slovenia', priority: 2 },
  { code: 'ES', name: 'Spain', priority: 2 },
  { code: 'SE', name: 'Sweden', priority: 2 },
  { code: 'UA', name: 'Ukraine', priority: 2 },
  { code: 'GB', name: 'United Kingdom', priority: 2 },
  // Priority 3: Middle East, Asia, Americas, Africa, Oceania
  { code: 'TR', name: 'Türkiye', priority: 3 },
  { code: 'IL', name: 'Israel', priority: 3 },
  { code: 'AE', name: 'United Arab Emirates', priority: 3 },
  { code: 'KW', name: 'Kuwait', priority: 3 },
  { code: 'OM', name: 'Oman', priority: 3 },
  { code: 'AZ', name: 'Azerbaijan', priority: 3 },
  { code: 'CN', name: 'China', priority: 3 },
  { code: 'IN', name: 'India', priority: 3 },
  { code: 'ID', name: 'Indonesia', priority: 3 },
  { code: 'JP', name: 'Japan', priority: 3 },
  { code: 'MY', name: 'Malaysia', priority: 3 },
  { code: 'NP', name: 'Nepal', priority: 3 },
  { code: 'PH', name: 'Philippines', priority: 3 },
  { code: 'SG', name: 'Singapore', priority: 3 },
  { code: 'KR', name: 'South Korea', priority: 3 },
  { code: 'LK', name: 'Sri Lanka', priority: 3 },
  { code: 'TH', name: 'Thailand', priority: 3 },
  { code: 'AR', name: 'Argentina', priority: 3 },
  { code: 'BR', name: 'Brazil', priority: 3 },
  { code: 'CL', name: 'Chile', priority: 3 },
  { code: 'CO', name: 'Colombia', priority: 3 },
  { code: 'EC', name: 'Ecuador', priority: 3 },
  { code: 'PY', name: 'Paraguay', priority: 3 },
  { code: 'PE', name: 'Peru', priority: 3 },
  { code: 'UY', name: 'Uruguay', priority: 3 },
  { code: 'VE', name: 'Venezuela', priority: 3 },
  { code: 'BZ', name: 'Belize', priority: 3 },
  { code: 'CR', name: 'Costa Rica', priority: 3 },
  { code: 'SV', name: 'El Salvador', priority: 3 },
  { code: 'GT', name: 'Guatemala', priority: 3 },
  { code: 'NI', name: 'Nicaragua', priority: 3 },
  { code: 'PA', name: 'Panama', priority: 3 },
  { code: 'BQ', name: 'Caribbean Netherlands', priority: 3 },
  { code: 'CW', name: 'Curaçao', priority: 3 },
  { code: 'DO', name: 'Dominican Republic', priority: 3 },
  { code: 'GD', name: 'Grenada', priority: 3 },
  { code: 'HT', name: 'Haiti', priority: 3 },
  { code: 'HN', name: 'Honduras', priority: 3 },
  { code: 'JM', name: 'Jamaica', priority: 3 },
  { code: 'KN', name: 'Saint Kitts and Nevis', priority: 3 },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', priority: 3 },
  { code: 'TT', name: 'Trinidad and Tobago', priority: 3 },
  { code: 'KY', name: 'Cayman Islands', priority: 3 },
  { code: 'KE', name: 'Kenya', priority: 3 },
  { code: 'MA', name: 'Morocco', priority: 3 },
  { code: 'ZA', name: 'South Africa', priority: 3 },
  { code: 'AU', name: 'Australia', priority: 3 },
  { code: 'NZ', name: 'New Zealand', priority: 3 },
];

// ─── Mode parsing ───

const DIGITAL_MODES = ['Fusion', 'DMR', 'D-STAR', 'P-25', 'NXDN', 'M17'];
const FEATURE_MODES = ['EchoLink', 'WIRES-X', 'AllStar', 'IRLP'];

export function parseModes(modesStr: string): string[] {
  if (!modesStr) return ['FM'];
  const modes: string[] = [];
  let s = modesStr.trim();
  if (s.startsWith('FM')) {
    modes.push('FM');
    s = s.slice(2);
  }
  for (const mode of DIGITAL_MODES) {
    if (s.startsWith(mode)) {
      modes.push(mode);
      s = s.slice(mode.length);
      break;
    }
  }
  for (const feature of FEATURE_MODES) {
    if (s.includes(feature)) {
      modes.push(feature);
      s = s.replace(feature, '');
    }
  }
  if (modes.length === 0 && modesStr.trim().length > 0) {
    modes.push('FM');
  }
  return modes;
}

export function getPrimaryMode(modes: string[]): string {
  for (const mode of ['DMR', 'D-STAR', 'Fusion', 'P-25', 'NXDN', 'M17']) {
    if (modes.includes(mode)) return mode;
  }
  if (modes.includes('FM')) return 'FM';
  return 'Other';
}

export function getBand(frequency: number): string {
  if (frequency >= 28 && frequency < 30) return '10m';
  if (frequency >= 50 && frequency < 54) return '6m';
  if (frequency >= 70 && frequency < 73) return '4m';
  if (frequency >= 144 && frequency < 148) return '2m';
  if (frequency >= 430 && frequency < 440) return '70cm';
  if (frequency >= 1240 && frequency < 1300) return '23cm';
  return 'Other';
}

function parseStatus(row: string): string {
  if (row.includes('\uD83D\uDFE2') || row.includes('🟢')) return 'on-air';
  if (row.includes('\uD83D\uDD34') || row.includes('🔴')) return 'off-air';
  if (row.includes('\uD83D\uDFE1') || row.includes('🟡')) return 'testing';
  return 'unknown';
}

// ─── List page parser ───

export function parseRepeaterList(html: string, countryCode: string, countryName: string): any[] {
  const repeaters: any[] = [];
  const rows = html.split(/<tr[\s>]/);
  for (const row of rows) {
    const idMatch = row.match(/data-rpt-id="(\d+)"/);
    if (!idMatch) continue;
    const sourceId = idMatch[1];

    const freqMatch = row.match(/<a[^>]*>\s*([\d.]+)\s*<\/a>/);
    if (!freqMatch) continue;
    const frequency = parseFloat(freqMatch[1]);

    const offsetMatch = row.match(/<span class="text-muted">\s*([+\-])\s*<\/span>/);
    const offsetSign = offsetMatch ? offsetMatch[1] : '-';

    const modes: string[] = [];
    const badgeRegex = /<span class="badge[^"]*mode-badge">\s*([^<]+?)\s*<\/span>/g;
    let badgeMatch;
    while ((badgeMatch = badgeRegex.exec(row)) !== null) {
      const mode = badgeMatch[1].trim();
      if (mode) modes.push(mode);
    }

    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      const content = tdMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      cells.push(content);
    }

    const tone = cells[2] || '';
    const locationName = cells[3] || '';
    const callsign = cells[4] || '';

    if (!callsign || !frequency) continue;

    const finalModes = modes.length > 0 ? modes : parseModes(cells[5] || '');
    const primaryMode = getPrimaryMode(finalModes);
    const band = getBand(frequency);
    const offsetMag = band === '2m' ? 0.6 : band === '70cm' ? 7.6 : band === '6m' ? 1.0 : band === '10m' ? 0.5 : 0;

    repeaters.push({
      sourceId,
      detailUrl: `${DETAIL_BASE}?state_id=${countryCode}&ID=${sourceId}`,
      frequency,
      offsetSign,
      offset_mhz: offsetSign === '+' ? offsetMag : -offsetMag,
      tone,
      modes: finalModes,
      primary_mode: primaryMode,
      location_name: locationName,
      callsign,
      country: countryName,
      country_code: countryCode,
      band,
      status: parseStatus(row),
      lat: null as number | null,
      lng: null as number | null,
      web_url: null as string | null,
      echolink_node: null as string | null,
      fm_funknetz: false,
    });
  }
  return repeaters;
}

// ─── Detail page parser ───

export function parseRepeaterDetail(html: string): { lat: number | null; lng: number | null; web_url: string | null; echolink_node: string | null } {
  let lat: number | null = null;
  let lng: number | null = null;
  let web_url: string | null = null;
  let echolink_node: string | null = null;

  const gmMatch = html.match(/google\.com\/maps\/search\/[^"]*query=([\d.-]+)(?:%2C|,)([\d.-]+)/);
  if (gmMatch) {
    lat = parseFloat(gmMatch[1]);
    lng = parseFloat(gmMatch[2]);
  }
  if (lat === null) {
    const nrMatch = html.match(/prox2_result\.php\?lat=([\d.-]+)&long=([\d.-]+)/);
    if (nrMatch) {
      lat = parseFloat(nrMatch[1]);
      lng = parseFloat(nrMatch[2]);
    }
  }

  const webMatch = html.match(/Web links<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  if (webMatch) {
    const linkMatch = webMatch[1].match(/href=['"](https?:\/\/[^'"]+)['"]/);
    if (linkMatch) web_url = linkMatch[1];
  }

  const elMatch = html.match(/Node Number[\s\S]*?(\d{4,7})\s/);
  if (elMatch) echolink_node = elMatch[1];

  return { lat, lng, web_url, echolink_node };
}

// ─── Main fetch function ───

export async function fetchRepeaterData(): Promise<any[]> {
  const countryPriority = new Map(COUNTRIES.map(c => [c.code, c.priority]));

  // 1. Fetch list pages for all countries (concurrency 8)
  const allRepeaters: any[] = [];
  for (let i = 0; i < COUNTRIES.length; i += LIST_CONCURRENCY) {
    const chunk = COUNTRIES.slice(i, i + LIST_CONCURRENCY);
    const results = await Promise.all(chunk.map(async (country) => {
      try {
        const url = `${LIST_BASE}?state_id=${country.code}&${LIST_PARAMS}`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
        });
        if (!resp.ok) return [];
        const html = await resp.text();
        return parseRepeaterList(html, country.code, country.name);
      } catch {
        return [];
      }
    }));
    for (const reps of results) {
      allRepeaters.push(...reps);
    }
  }

  // 2. Sort by country priority (priority 1 first), then on-air first
  allRepeaters.sort((a, b) => {
    const pa = countryPriority.get(a.country_code) || 99;
    const pb = countryPriority.get(b.country_code) || 99;
    if (pa !== pb) return pa - pb;
    if (a.status === 'on-air' && b.status !== 'on-air') return -1;
    if (a.status !== 'on-air' && b.status === 'on-air') return 1;
    return 0;
  });

  // 3. Select top MAX_DETAIL_FETCH for detail page fetching (prioritized)
  const toFetch = allRepeaters.slice(0, MAX_DETAIL_FETCH);

  // 4. Fetch detail pages (concurrency 20)
  for (let i = 0; i < toFetch.length; i += DETAIL_CONCURRENCY) {
    const chunk = toFetch.slice(i, i + DETAIL_CONCURRENCY);
    await Promise.all(chunk.map(async (rep) => {
      try {
        const resp = await fetch(rep.detailUrl, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
        });
        if (!resp.ok) return;
        const html = await resp.text();
        const detail = parseRepeaterDetail(html);
        if (detail.lat !== null) rep.lat = detail.lat;
        if (detail.lng !== null) rep.lng = detail.lng;
        if (detail.web_url) rep.web_url = detail.web_url;
        if (detail.echolink_node) rep.echolink_node = detail.echolink_node;
      } catch {
        // skip failed detail pages
      }
    }));
  }

  // 5. Build linking: group by callsign, set linked_callsigns
  const byCallsign = new Map<string, any[]>();
  for (const rep of allRepeaters) {
    if (!byCallsign.has(rep.callsign)) byCallsign.set(rep.callsign, []);
    byCallsign.get(rep.callsign)!.push(rep);
  }
  for (const rep of allRepeaters) {
    const group = byCallsign.get(rep.callsign) || [];
    rep.linked_callsigns = group
      .filter(r => r.frequency !== rep.frequency || r.band !== rep.band)
      .map(r => `${r.callsign} ${r.frequency.toFixed(4)} MHz (${r.band})`);
  }

  return allRepeaters;
}