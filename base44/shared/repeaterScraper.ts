// Shared repeater scraping logic — imported by fetchRepeaters and refreshAllData.
// Source: RepeaterBook.com (Switzerland / HB9 / HB0)

const REPEATERBOOK_LIST_URL =
  'https://www.repeaterbook.com/row_repeaters/Display_SS.php?state_id=CH&band=%25&freq=%25&band6=%25&loc=%25&call=%25&status_id=%25&features=%25&system=%25&coverage=%25&use=%25';

const DETAIL_BASE = 'https://www.repeaterbook.com/row_repeaters/details.php?state_id=CH&ID=';

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
  // If nothing matched but string is non-empty, treat as FM
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

function parseStatus(statusStr: string): string {
  if (statusStr.includes('\uD83D\uDFE2') || statusStr.includes('🟢')) return 'on-air';
  if (statusStr.includes('\uD83D\uDD34') || statusStr.includes('🔴')) return 'off-air';
  if (statusStr.includes('\uD83D\uDFE1') || statusStr.includes('🟡')) return 'testing';
  return 'unknown';
}

// ─── List page parser ───

export function parseRepeaterList(html: string): any[] {
  const repeaters: any[] = [];
  const rows = html.split(/<tr[\s>]/);
  for (const row of rows) {
    // Extract ID from data-rpt-id attribute (most reliable)
    const idMatch = row.match(/data-rpt-id="(\d+)"/);
    if (!idMatch) continue;
    const sourceId = idMatch[1];

    // Extract frequency from <a> tag text
    const freqMatch = row.match(/<a[^>]*>\s*([\d.]+)\s*<\/a>/);
    if (!freqMatch) continue;
    const frequency = parseFloat(freqMatch[1]);

    // Extract offset sign from <span class="text-muted">
    const offsetMatch = row.match(/<span class="text-muted">\s*([+\-])\s*<\/span>/);
    const offsetSign = offsetMatch ? offsetMatch[1] : '-';

    // Extract modes from individual badge spans
    const modes: string[] = [];
    const badgeRegex = /<span class="badge[^"]*mode-badge">\s*([^<]+?)\s*<\/span>/g;
    let badgeMatch;
    while ((badgeMatch = badgeRegex.exec(row)) !== null) {
      const mode = badgeMatch[1].trim();
      if (mode) modes.push(mode);
    }

    // Extract all <td> cell text contents for remaining fields
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

    // Cells: [checkbox, frequency+sign, tone, location, call, modes, status]
    const tone = cells[2] || '';
    const locationName = cells[3] || '';
    const callsign = cells[4] || '';

    if (!callsign || !frequency) continue;

    // If modes not found from badges, try parsing from cell text
    const finalModes = modes.length > 0 ? modes : parseModes(cells[5] || '');
    const primaryMode = getPrimaryMode(finalModes);
    const band = getBand(frequency);
    const offsetMag = band === '2m' ? 0.6 : band === '70cm' ? 7.6 : band === '6m' ? 1.0 : band === '10m' ? 0.5 : 0;

    repeaters.push({
      sourceId,
      detailUrl: DETAIL_BASE + sourceId,
      frequency,
      offsetSign,
      offset_mhz: offsetSign === '+' ? offsetMag : -offsetMag,
      tone,
      modes: finalModes,
      primary_mode: primaryMode,
      location_name: locationName,
      callsign,
      band,
      status: parseStatus(row),
      lat: null as number | null,
      lng: null as number | null,
      web_url: null as string | null,
      echolink_node: null as string | null,
      fm_netzwerk: false,
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

  // Coordinates from Google Maps link: query=47.062500%2C8.375000
  const gmMatch = html.match(/google\.com\/maps\/search\/[^"]*query=([\d.-]+)(?:%2C|,)([\d.-]+)/);
  if (gmMatch) {
    lat = parseFloat(gmMatch[1]);
    lng = parseFloat(gmMatch[2]);
  }
  if (lat === null) {
    // Fallback: Nearby Repeaters link: lat=47.06250000&long=8.37500000
    const nrMatch = html.match(/prox2_result\.php\?lat=([\d.-]+)&long=([\d.-]+)/);
    if (nrMatch) {
      lat = parseFloat(nrMatch[1]);
      lng = parseFloat(nrMatch[2]);
    }
  }

  // Web links — look for href in the "Web links" row
  const webMatch = html.match(/Web links<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  if (webMatch) {
    const linkMatch = webMatch[1].match(/href=['"](https?:\/\/[^'"]+)['"]/);
    if (linkMatch) web_url = linkMatch[1];
  }

  // EchoLink node number — look for "Node Number" followed by a number
  const elMatch = html.match(/Node Number[\s\S]*?(\d{4,7})\s/);
  if (elMatch) echolink_node = elMatch[1];

  return { lat, lng, web_url, echolink_node };
}

// ─── Main fetch function ───

export async function fetchRepeaterData(): Promise<any[]> {
  // 1. Fetch list page
  const listResp = await fetch(REPEATERBOOK_LIST_URL, {
    headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
  });
  if (!listResp.ok) throw new Error(`RepeaterBook list fetch failed: HTTP ${listResp.status}`);
  const listHtml = await listResp.text();
  const repeaters = parseRepeaterList(listHtml);

  // 2. Fetch detail pages with concurrency limit
  const CONCURRENCY = 8;
  for (let i = 0; i < repeaters.length; i += CONCURRENCY) {
    const chunk = repeaters.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (rep) => {
      try {
        const detailResp = await fetch(rep.detailUrl, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
        });
        if (!detailResp.ok) return;
        const detailHtml = await detailResp.text();
        const detail = parseRepeaterDetail(detailHtml);
        if (detail.lat !== null) rep.lat = detail.lat;
        if (detail.lng !== null) rep.lng = detail.lng;
        if (detail.web_url) rep.web_url = detail.web_url;
        if (detail.echolink_node) rep.echolink_node = detail.echolink_node;
      } catch {
        // skip failed detail pages — coordinates stay null
      }
    }));
  }

  // 3. Build linking: group by callsign, set linked_callsigns
  const byCallsign = new Map<string, any[]>();
  for (const rep of repeaters) {
    if (!byCallsign.has(rep.callsign)) byCallsign.set(rep.callsign, []);
    byCallsign.get(rep.callsign)!.push(rep);
  }
  for (const rep of repeaters) {
    const group = byCallsign.get(rep.callsign) || [];
    rep.linked_callsigns = group
      .filter(r => r.frequency !== rep.frequency || r.band !== rep.band)
      .map(r => `${r.callsign} ${r.frequency.toFixed(4)} MHz (${r.band})`);
  }

  // 4. Filter out repeaters without coordinates (can't show on map)
  return repeaters;
}