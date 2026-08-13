// Generates potential APRS station callsigns from known prefixes.
// Used by fetchAprsStations for incremental discovery — each scheduled run
// queries 50 callsigns from the seed list (offset-based), building up AprsStation
// over time without a hard limit on total records.
//
// The seed list is deterministic (same order every run), so an offset stored
// in AppSettings tracks progress. When the offset wraps around, the function
// re-queries earlier callsigns — effectively updating existing stations.

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function gen(prefix: string, suffixLen: number, max: number): string[] {
  const result: string[] = [];
  function recurse(current: string, depth: number) {
    if (result.length >= max) return;
    if (depth === 0) { result.push(prefix + current); return; }
    for (const c of CHARS) {
      recurse(current + c, depth - 1);
      if (result.length >= max) return;
    }
  }
  recurse('', suffixLen);
  return result;
}

export function generateAprsCallsignSeed(): string[] {
  const base = new Set<string>();

  // German digipeaters: DB0 + 2-3 letters
  gen('DB0', 2, 400).forEach(c => base.add(c));
  gen('DB0', 3, 400).forEach(c => base.add(c));

  // Swiss: HB9 + 3 letters
  gen('HB9', 3, 300).forEach(c => base.add(c));

  // Austrian: OE + digit + 2 letters
  for (let d = 1; d <= 9; d++) gen(`OE${d}`, 2, 30).forEach(c => base.add(c));

  // French: F + digit + 3 letters
  for (let d = 0; d <= 8; d++) gen(`F${d}`, 3, 30).forEach(c => base.add(c));

  // Italian: I/IZ/IW + digit + 3 letters
  for (let d = 0; d <= 9; d++) {
    gen(`I${d}`, 3, 25).forEach(c => base.add(c));
    gen(`IZ${d}`, 3, 15).forEach(c => base.add(c));
    gen(`IW${d}`, 3, 15).forEach(c => base.add(c));
  }

  // Spanish: EA/EB + digit + 3 letters
  for (let d = 0; d <= 9; d++) {
    gen(`EA${d}`, 3, 15).forEach(c => base.add(c));
    gen(`EB${d}`, 3, 15).forEach(c => base.add(c));
  }

  // Dutch: PA/PD + digit + 3 letters
  for (let d = 0; d <= 9; d++) {
    gen(`PA${d}`, 3, 15).forEach(c => base.add(c));
    gen(`PD${d}`, 3, 15).forEach(c => base.add(c));
  }

  // UK: G/M + digit + 3 letters
  for (let d = 0; d <= 9; d++) {
    gen(`G${d}`, 3, 15).forEach(c => base.add(c));
    gen(`M${d}`, 3, 15).forEach(c => base.add(c));
  }

  // Scandinavian: SM/LA + digit + 3 letters, OZ + 3 letters
  for (let d = 0; d <= 9; d++) {
    gen(`SM${d}`, 3, 15).forEach(c => base.add(c));
    gen(`LA${d}`, 3, 15).forEach(c => base.add(c));
  }
  gen('OZ', 3, 50).forEach(c => base.add(c));

  // Polish: SP/SQ + digit + 3 letters
  for (let d = 0; d <= 9; d++) {
    gen(`SP${d}`, 3, 15).forEach(c => base.add(c));
    gen(`SQ${d}`, 3, 15).forEach(c => base.add(c));
  }

  // Czech: OK + digit + 3 letters
  for (let d = 0; d <= 9; d++) gen(`OK${d}`, 3, 15).forEach(c => base.add(c));

  // Hungarian: HA + digit + 3 letters
  for (let d = 0; d <= 9; d++) gen(`HA${d}`, 3, 15).forEach(c => base.add(c));

  // US: W/K/N + digit + 3 letters
  for (let d = 0; d <= 9; d++) {
    gen(`W${d}`, 3, 40).forEach(c => base.add(c));
    gen(`K${d}`, 3, 40).forEach(c => base.add(c));
    gen(`N${d}`, 3, 40).forEach(c => base.add(c));
  }

  // Canada: VE + digit + 3 letters
  for (let d = 0; d <= 9; d++) gen(`VE${d}`, 3, 15).forEach(c => base.add(c));

  // Japan: JA/JE/JF + digit + 3 letters
  for (let d = 0; d <= 9; d++) {
    gen(`JA${d}`, 3, 15).forEach(c => base.add(c));
    gen(`JE${d}`, 3, 15).forEach(c => base.add(c));
    gen(`JF${d}`, 3, 15).forEach(c => base.add(c));
  }

  // Australia: VK + digit + 3 letters
  for (let d = 1; d <= 9; d++) gen(`VK${d}`, 3, 15).forEach(c => base.add(c));

  // Add common SSID variants for fixed-station types (-1: digipeater, -10: igate)
  const withSsids = new Set<string>(base);
  for (const cs of base) {
    withSsids.add(`${cs}-1`);
    withSsids.add(`${cs}-10`);
  }

  return Array.from(withSsids);
}