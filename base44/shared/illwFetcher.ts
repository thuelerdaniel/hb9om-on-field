// ILLW (International Lighthouse/Lightship Weekend) official list fetcher.
// Source: wllw.org — the only OFFICIAL list of lighthouses/lightships used by ILLW.
// Parses 3 HTML pages (Part 1-3) and extracts coordinates from Google Maps links.
//
// The list is split across 3 pages:
//   Part 1: /en/           (Alaska thru France)
//   Part 2: /en/list-page-2 (Germany thru Norway)
//   Part 3: /en/list-3     (Oman thru Wales)
//
// Each table row has: Country, Lighthouse Name, DXCC, Continent, Map link, ILLW No.
// The Map link contains coordinates in 3 possible formats:
//   1. Decimal degrees:  /place/57.0360°N 135.3335°W
//   2. Degrees-minutes:   /place/22°34'N 59°32'E
//   3. Direct @lat,lng:   /@8.9090537,-79.5246652,1843m

const ILLW_PAGES = [
  'https://wllw.org/index.php/en/',
  'https://wllw.org/index.php/en/list-page-2',
  'https://wllw.org/index.php/en/list-3',
];

const ILLW_BASE_URL = 'https://wllw.org/index.php/en/';

// Strip HTML tags and decode entities
function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse coordinates from a Google Maps URL.
// Handles 3 formats: decimal degrees, degrees-minutes, and direct @lat,lng.
function parseCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    decoded = url;
  }

  // Format 1: /place/57.0360°N 135.3335°W (decimal degrees)
  let m = decoded.match(/\/place\/(-?\d+\.?\d*)\s*°\s*([NS])\s*(-?\d+\.?\d*)\s*°\s*([EW])/);
  if (m) {
    const lat = parseFloat(m[1]) * (m[2] === 'S' ? -1 : 1);
    const lng = parseFloat(m[3]) * (m[4] === 'W' ? -1 : 1);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Format 2: /place/22°34'N 59°32'E (degrees minutes)
  m = decoded.match(/\/place\/(\d+)\s*°\s*(\d+)'\s*([NS])\s*(\d+)\s*°\s*(\d+)'\s*([EW])/);
  if (m) {
    const lat = (parseFloat(m[1]) + parseFloat(m[2]) / 60) * (m[3] === 'S' ? -1 : 1);
    const lng = (parseFloat(m[4]) + parseFloat(m[5]) / 60) * (m[6] === 'W' ? -1 : 1);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Format 3: /@8.9090537,-79.5246652,1843m (direct lat,lng)
  m = decoded.match(/\/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

// Fetch and parse the full ILLW lighthouse list from wllw.org.
// Returns an array of lighthouse objects with coordinates extracted from
// the Google Maps links in the "Map" column of each table.
export async function fetchIllwLighthouses(): Promise<any[]> {
  const allLighthouses: any[] = [];
  const seen = new Set<string>();

  for (const pageUrl of ILLW_PAGES) {
    try {
      const resp = await fetch(pageUrl, {
        headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' },
      });
      if (!resp.ok) continue;
      const html = await resp.text();

      // Split by table rows
      const rows = html.split(/<tr[\s>]/);
      for (const row of rows) {
        // Extract all <td> cells from this row
        const cells: string[] = [];
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
        let tdMatch;
        while ((tdMatch = tdRegex.exec(row)) !== null) {
          cells.push(tdMatch[1]);
        }

        // Need at least 6 cells: Country, Name, DXCC, Continent, Map, ILLW No.
        if (cells.length < 6) continue;

        // Find Google Maps link in cell 4 (Map column)
        const mapLinkMatch = cells[4].match(/href="(https:\/\/www\.google\.com\/maps\/[^"]+)"/);
        if (!mapLinkMatch) continue;

        const mapUrl = mapLinkMatch[1];
        const coords = parseCoordsFromUrl(mapUrl);
        if (!coords) continue;

        const country = stripHtml(cells[0]);
        const name = stripHtml(cells[1]);
        const dxcc = stripHtml(cells[2]);
        const continent = stripHtml(cells[3]);
        const illwNo = stripHtml(cells[5]);

        // Skip header rows and empty rows
        if (!name || !illwNo) continue;
        if (country.toUpperCase() === 'COUNTRY' || name.toUpperCase().startsWith('LIGHTHOUSE NAME')) continue;
        // Skip "Also See" reference rows (empty country, starts with "Also See")
        if (!country && name.startsWith('Also See')) continue;

        // Deduplicate by ILLW number
        if (seen.has(illwNo)) continue;
        seen.add(illwNo);

        allLighthouses.push({
          code: illwNo,
          name: name,
          lat: coords.lat,
          lng: coords.lng,
          country: country,
          continent: continent,
          dxcc: dxcc,
          link: ILLW_BASE_URL,
          illw_no: illwNo,
          source: 'ILLW (wllw.org)',
        });
      }
    } catch {
      // Continue with next page on error
    }
  }

  return allLighthouses;
}