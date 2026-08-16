// ILLW entrants list fetcher.
// Source: lighthouse-weekend.international — the official entrants list for each year.
// Parses the HTML table and extracts: ILLW number, name, country, callsign(s).
//
// The entrants list URL format is:
//   https://www.lighthouse-weekend.international/index.php/entrants-list-2026
//
// The page contains an HTML table with columns like:
//   ILLW Number | Lighthouse Name | Country | Callsign(s) | ...

const ENTRANTS_BASE_URL = 'https://www.lighthouse-weekend.international/index.php/entrants-list-';

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

// Extract ILLW number from text (format: 2 letters + 4 digits, e.g. CH0001, DE0064)
function extractIllwNumber(text: string): string | null {
  const m = text.match(/\b([A-Z]{2})(\d{4})\b/);
  return m ? `${m[1]}${m[2]}` : null;
}

// Extract callsign(s) from text (amateur radio callsign format)
// Matches patterns like: HB9XYZ, DL1ABC, G4XYZ, VK2DEF, W1GHI, F5ABC
function extractCallsigns(text: string): string[] {
  const matches = text.match(/\b([A-Z]{1,2}[0-9][A-Z0-9]{1,3})\b/g);
  if (!matches) return [];
  // Filter out ILLW numbers (which look like CH0001 = 2 letters + 4 digits)
  return matches.filter(c => !/^[A-Z]{2}\d{4}$/.test(c));
}

export async function fetchIllwEntrants(year: number): Promise<any[]> {
  const url = `${ENTRANTS_BASE_URL}${year}`;
  const entrants: any[] = [];
  const seen = new Set<string>();

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' },
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
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

      if (cells.length < 2) continue;

      // Try to find ILLW number in any cell
      let illwNo: string | null = null;
      let illwCellIdx = -1;
      for (let i = 0; i < cells.length; i++) {
        const num = extractIllwNumber(stripHtml(cells[i]));
        if (num) {
          illwNo = num;
          illwCellIdx = i;
          break;
        }
      }

      if (!illwNo) continue;

      // Skip header rows
      const allText = cells.map(c => stripHtml(c)).join(' ');
      if (allText.toUpperCase().includes('LIGHTHOUSE') && allText.toUpperCase().includes('COUNTRY')) continue;
      if (allText.toUpperCase().startsWith('ILLW')) continue;

      // Deduplicate by ILLW number
      if (seen.has(illwNo)) continue;
      seen.add(illwNo);

      // Extract all cell text for callsign detection
      const allCellText = cells.map(c => stripHtml(c)).join(' ');
      const callsigns = extractCallsigns(allCellText);

      // Extract name and country from non-ILLW cells
      const otherTexts = cells
        .map((c, i) => i !== illwCellIdx ? stripHtml(c) : '')
        .filter(t => t && !extractCallsigns(t).length);

      let name = '';
      let country = '';
      // Name is usually the longest text, country is shorter
      const sorted = otherTexts.sort((a, b) => b.length - a.length);
      if (sorted.length > 0) name = sorted[0];
      if (sorted.length > 1) country = sorted[1];
      // Fallback: if only one non-callsign cell, use it as name
      if (!name) {
        const firstNonCallsign = cells.map(c => stripHtml(c)).find(t => t && !extractIllwNumber(t) && !extractCallsigns(t).length);
        if (firstNonCallsign) name = firstNonCallsign;
      }

      entrants.push({
        illw_number: illwNo,
        name: name || 'Unknown',
        country: country || '',
        callsigns: callsigns.join(', '),
        year: year,
      });
    }
  } catch (error) {
    // Return empty array on error — caller handles
  }

  return entrants;
}