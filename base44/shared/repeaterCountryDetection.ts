// Shared country detection and validation for repeaters — used by
// fetchHearhamRepeaters, cleanupRepeaterCountries, cleanupRepeaterGeo,
// and fetchRepeaters to correctly assign and validate country codes.
//
// Provides:
// 1. Callsign-prefix → country detection (most reliable)
// 2. Coordinate → country detection via bounding boxes
// 3. State/province abbreviation → country detection
// 4. Combined 3-layer validation with conflict resolution

// ─── Callsign prefix → country mapping ───
// Based on ITU prefix allocation. Only major amateur radio countries included.
const CALLSIGN_PREFIXES: { pattern: RegExp; cc: string; name: string }[] = [
  // US: K*, N*, W* (followed by digit), AA-AL, KA-KZ, NA-NZ, WA-WZ
  { pattern: /^[KNW]\d/, cc: 'US', name: 'United States' },
  { pattern: /^[AWKNL]\d[A-Z]/, cc: 'US', name: 'United States' },
  // CA: VE, VA, VO, VY, CY, XJ-XI, CF-CK
  { pattern: /^(VE|VA|VO|VY|CY|XJ|XK|XL|XM|XF|XG|XH|XI|CF|CG|CH|CI|CJ|CK)/, cc: 'CA', name: 'Canada' },
  // CH: HB
  { pattern: /^HB/, cc: 'CH', name: 'Switzerland' },
  // DE: DA-DR
  { pattern: /^D[A-R]/, cc: 'DE', name: 'Germany' },
  // GB: G, M, 2E
  { pattern: /^(G|M|2E)\d/, cc: 'GB', name: 'United Kingdom' },
  { pattern: /^G[A-Z]/, cc: 'GB', name: 'United Kingdom' },
  // FR: F
  { pattern: /^F\d/, cc: 'FR', name: 'France' },
  { pattern: /^F[A-Z]/, cc: 'FR', name: 'France' },
  { pattern: /^TM/, cc: 'FR', name: 'France' },
  // IT: I
  { pattern: /^I\d/, cc: 'IT', name: 'Italy' },
  { pattern: /^I[A-Z]/, cc: 'IT', name: 'Italy' },
  // ES: EA-EH
  { pattern: /^E[A-H]/, cc: 'ES', name: 'Spain' },
  // PT: CT, CQ
  { pattern: /^(CT|CQ)/, cc: 'PT', name: 'Portugal' },
  // NL: PA-PI
  { pattern: /^P[A-I]/, cc: 'NL', name: 'Netherlands' },
  // BE: ON, OO, OP, OQ
  { pattern: /^(ON|OO|OP|OQ)/, cc: 'BE', name: 'Belgium' },
  // AT: OE
  { pattern: /^OE/, cc: 'AT', name: 'Austria' },
  // DK: OZ, OU
  { pattern: /^(OZ|OU)/, cc: 'DK', name: 'Denmark' },
  // SE: SA-SM
  { pattern: /^S[A-M]/, cc: 'SE', name: 'Sweden' },
  // NO: LA-LN
  { pattern: /^L[A-N]/, cc: 'NO', name: 'Norway' },
  // FI: OF-OJ
  { pattern: /^O[F-J]/, cc: 'FI', name: 'Finland' },
  // PL: SN-SP, 3Z, HF
  { pattern: /^(S[N-P]|3Z|HF)/, cc: 'PL', name: 'Poland' },
  // CZ: OK, OL
  { pattern: /^(OK|OL)/, cc: 'CZ', name: 'Czechia' },
  // SK: OM
  { pattern: /^OM/, cc: 'SK', name: 'Slovakia' },
  // HU: HA, HG
  { pattern: /^(HA|HG)/, cc: 'HU', name: 'Hungary' },
  // RO: YO-YR
  { pattern: /^Y[O-R]/, cc: 'RO', name: 'Romania' },
  // BG: LZ
  { pattern: /^LZ/, cc: 'BG', name: 'Bulgaria' },
  // GR: SV-SZ, J4
  { pattern: /^(S[V-Z]|J4)/, cc: 'GR', name: 'Greece' },
  // HR: 9A
  { pattern: /^9A/, cc: 'HR', name: 'Croatia' },
  // SI: S5
  { pattern: /^S5/, cc: 'SI', name: 'Slovenia' },
  // RS: YT-YU
  { pattern: /^Y[T-U]/, cc: 'RS', name: 'Serbia' },
  // IE: EI, EJ
  { pattern: /^(EI|EJ)/, cc: 'IE', name: 'Ireland' },
  // LU: LX
  { pattern: /^LX/, cc: 'LU', name: 'Luxembourg' },
  // IS: TF
  { pattern: /^TF/, cc: 'IS', name: 'Iceland' },
  // JP: JA-JS, 7J-7N, 8J-8N
  { pattern: /^J[A-S]/, cc: 'JP', name: 'Japan' },
  { pattern: /^[78]J/, cc: 'JP', name: 'Japan' },
  // KR: HL, D7-D9, 6K-6N
  { pattern: /^(HL|D[7-9]|6[K-N])/, cc: 'KR', name: 'South Korea' },
  // CN: BY, BD, BG, BH, BU, BZ, XU-XZ
  { pattern: /^(BY|BD|BG|BH|BU|BZ|X[U-Z])/, cc: 'CN', name: 'China' },
  // TW: BU, BV
  { pattern: /^BV/, cc: 'TW', name: 'Taiwan' },
  // TH: HS, E2
  { pattern: /^(HS|E2)/, cc: 'TH', name: 'Thailand' },
  // VN: 3W, XV
  { pattern: /^(3W|XV)/, cc: 'VN', name: 'Vietnam' },
  // ID: 8A, YB-YH
  { pattern: /^(8A|Y[B-H])/, cc: 'ID', name: 'Indonesia' },
  // PH: 4D-4I, DU-DZ
  { pattern: /^(4[D-I]|D[U-Z])/, cc: 'PH', name: 'Philippines' },
  // MY: 9M, 9W
  { pattern: /^9[MW]/, cc: 'MY', name: 'Malaysia' },
  // SG: 9V
  { pattern: /^9V/, cc: 'SG', name: 'Singapore' },
  // IN: 8T-8Y, AT-AW, VU-VW
  { pattern: /^(8[T-Y]|A[T-W]|V[U-W])/, cc: 'IN', name: 'India' },
  // AU: VK
  { pattern: /^VK/, cc: 'AU', name: 'Australia' },
  // NZ: ZL, ZK
  { pattern: /^Z[KL]/, cc: 'NZ', name: 'New Zealand' },
  // BR: PY, PP-PR, ZV-ZZ
  { pattern: /^(PY|P[P-R]|Z[V-Z])/, cc: 'BR', name: 'Brazil' },
  // AR: LO-LW, AY-AZ, L2-L9
  { pattern: /^(L[O-W]|[A-L]Y|L[2-9])/, cc: 'AR', name: 'Argentina' },
  // CL: 3G-3G, CA-CE, XQ-XR
  { pattern: /^(3G|C[A-E]|X[Q-R])/, cc: 'CL', name: 'Chile' },
  // CO: 5K, 5L, HK, HJ
  { pattern: /^(5[KL]|H[KJ])/, cc: 'CO', name: 'Colombia' },
  // VE: 4M, YV-YY
  { pattern: /^(4M|Y[V-Y])/, cc: 'VE', name: 'Venezuela' },
  // PE: 4A-4C, OA-OC
  { pattern: /^(4[A-C]|O[A-C])/, cc: 'PE', name: 'Peru' },
  // MX: XA-XI, 4A-4C, 6D-6H
  { pattern: /^(X[A-I]|[46][A-H])/, cc: 'MX', name: 'Mexico' },
  // ZA: ZR-ZU
  { pattern: /^Z[R-U]/, cc: 'ZA', name: 'South Africa' },
  // EG: 6A-6N, SU
  { pattern: /^(6[A-N]|SU)/, cc: 'EG', name: 'Egypt' },
  // NG: 5N, 5O
  { pattern: /^5[NO]/, cc: 'NG', name: 'Nigeria' },
  // KE: 5Z
  { pattern: /^5Z/, cc: 'KE', name: 'Kenya' },
  // MA: 5C, CN
  { pattern: /^(5C|CN)/, cc: 'MA', name: 'Morocco' },
  // DZ: 7R
  { pattern: /^7R/, cc: 'DZ', name: 'Algeria' },
  // TN: 3V
  { pattern: /^3V/, cc: 'TN', name: 'Tunisia' },
  // LY: 5A
  { pattern: /^5A/, cc: 'LY', name: 'Libya' },
  // SD: 6T-6U, ST-SU
  { pattern: /^(6[T-U]|S[T-U])/, cc: 'SD', name: 'Sudan' },
  // SA: 8Z, HZ
  { pattern: /^(8Z|HZ)/, cc: 'SA', name: 'Saudi Arabia' },
  // AE: A6
  { pattern: /^A6/, cc: 'AE', name: 'United Arab Emirates' },
  // IL: 4X-4Z
  { pattern: /^4[X-Z]/, cc: 'IL', name: 'Israel' },
  // TR: TA-TM, YM
  { pattern: /^(T[A-M]|YM)/, cc: 'TR', name: 'Turkey' },
  // RU: R, UA-UI, RA-RZ
  { pattern: /^(R[A-Z]|R\d|U[A-I])/, cc: 'RU', name: 'Russia' },
  // UA: EM, U5-U9, UR-UZ
  { pattern: /^(EM|U[5-9]|U[R-Z])/, cc: 'UA', name: 'Ukraine' },
];

// ─── Country bounding boxes (lat/lng ranges) ───
// Used to validate that coordinates match the assigned country.
const COUNTRY_BBOXES: { cc: string; boxes: { latMin: number; latMax: number; lngMin: number; lngMax: number }[] }[] = [
  { cc: 'US', boxes: [
    { latMin: 24, latMax: 49, lngMin: -125, lngMax: -66 },   // Continental US
    { latMin: 55, latMax: 71, lngMin: -180, lngMax: -130 },   // Alaska
    { latMin: 18, latMax: 22, lngMin: -160, lngMax: -154 },   // Hawaii
  ]},
  { cc: 'CA', boxes: [{ latMin: 41, latMax: 84, lngMin: -141, lngMax: -52 }] },
  { cc: 'MX', boxes: [{ latMin: 14, latMax: 33, lngMin: -118, lngMax: -86 }] },
  { cc: 'CH', boxes: [{ latMin: 45.8, latMax: 47.9, lngMin: 5.9, lngMax: 10.5 }] },
  { cc: 'DE', boxes: [{ latMin: 47, latMax: 55, lngMin: 6, lngMax: 15 }] },
  { cc: 'AT', boxes: [{ latMin: 46, latMax: 49.5, lngMin: 9.5, lngMax: 17 }] },
  { cc: 'FR', boxes: [{ latMin: 41, latMax: 51, lngMin: -5, lngMax: 10 }] },
  { cc: 'IT', boxes: [{ latMin: 35, latMax: 47, lngMin: 6.6, lngMax: 18.5 }] },
  { cc: 'ES', boxes: [{ latMin: 35, latMax: 44, lngMin: -10, lngMax: 4 }] },
  { cc: 'PT', boxes: [{ latMin: 36, latMax: 42, lngMin: -10, lngMax: -6 }] },
  { cc: 'GB', boxes: [{ latMin: 49, latMax: 61, lngMin: -9, lngMax: 2 }] },
  { cc: 'IE', boxes: [{ latMin: 51, latMax: 55, lngMin: -11, lngMax: -5 }] },
  { cc: 'NL', boxes: [{ latMin: 50, latMax: 54, lngMin: 3, lngMax: 7 }] },
  { cc: 'BE', boxes: [{ latMin: 49, latMax: 51, lngMin: 2.5, lngMax: 6.5 }] },
  { cc: 'LU', boxes: [{ latMin: 49.4, latMax: 50.2, lngMin: 5.7, lngMax: 6.5 }] },
  { cc: 'DK', boxes: [{ latMin: 54, latMax: 58, lngMin: 8, lngMax: 13 }] },
  { cc: 'SE', boxes: [{ latMin: 55, latMax: 69, lngMin: 11, lngMax: 24 }] },
  { cc: 'NO', boxes: [{ latMin: 57, latMax: 71, lngMin: 4, lngMax: 31 }] },
  { cc: 'FI', boxes: [{ latMin: 60, latMax: 70, lngMin: 19, lngMax: 32 }] },
  { cc: 'PL', boxes: [{ latMin: 49, latMax: 55, lngMin: 14, lngMax: 24 }] },
  { cc: 'CZ', boxes: [{ latMin: 48, latMax: 51, lngMin: 12, lngMax: 19 }] },
  { cc: 'SK', boxes: [{ latMin: 47, latMax: 50, lngMin: 16, lngMax: 23 }] },
  { cc: 'HU', boxes: [{ latMin: 45.5, latMax: 49, lngMin: 16, lngMax: 23 }] },
  { cc: 'RO', boxes: [{ latMin: 43, latMax: 48, lngMin: 20, lngMax: 30 }] },
  { cc: 'BG', boxes: [{ latMin: 41, latMax: 44, lngMin: 22, lngMax: 28 }] },
  { cc: 'GR', boxes: [{ latMin: 35, latMax: 42, lngMin: 19, lngMax: 28 }] },
  { cc: 'HR', boxes: [{ latMin: 42, latMax: 47, lngMin: 13, lngMax: 20 }] },
  { cc: 'SI', boxes: [{ latMin: 45.5, latMax: 47, lngMin: 13.5, lngMax: 16.7 }] },
  { cc: 'RS', boxes: [{ latMin: 42, latMax: 46, lngMin: 18, lngMax: 23 }] },
  { cc: 'JP', boxes: [{ latMin: 24, latMax: 46, lngMin: 122, lngMax: 146 }] },
  { cc: 'KR', boxes: [{ latMin: 33, latMax: 39, lngMin: 124, lngMax: 132 }] },
  { cc: 'CN', boxes: [{ latMin: 18, latMax: 53, lngMin: 73, lngMax: 135 }] },
  { cc: 'TW', boxes: [{ latMin: 22, latMax: 26, lngMin: 119, lngMax: 122 }] },
  { cc: 'TH', boxes: [{ latMin: 5, latMax: 21, lngMin: 97, lngMax: 106 }] },
  { cc: 'VN', boxes: [{ latMin: 8, latMax: 24, lngMin: 102, lngMax: 110 }] },
  { cc: 'ID', boxes: [{ latMin: -11, latMax: 6, lngMin: 95, lngMax: 141 }] },
  { cc: 'PH', boxes: [{ latMin: 4, latMax: 21, lngMin: 116, lngMax: 127 }] },
  { cc: 'MY', boxes: [{ latMin: 1, latMax: 7, lngMin: 100, lngMax: 119 }] },
  { cc: 'SG', boxes: [{ latMin: 1, latMax: 1.5, lngMin: 103, lngMax: 104 }] },
  { cc: 'IN', boxes: [{ latMin: 6, latMax: 37, lngMin: 68, lngMax: 98 }] },
  { cc: 'AU', boxes: [{ latMin: -44, latMax: -10, lngMin: 113, lngMax: 154 }] },
  { cc: 'NZ', boxes: [{ latMin: -47, latMax: -34, lngMin: 166, lngMax: 179 }] },
  { cc: 'BR', boxes: [{ latMin: -34, latMax: 6, lngMin: -74, lngMax: -34 }] },
  { cc: 'AR', boxes: [{ latMin: -55, latMax: -21, lngMin: -74, lngMax: -53 }] },
  { cc: 'CL', boxes: [{ latMin: -56, latMax: -18, lngMin: -76, lngMax: -66 }] },
  { cc: 'CO', boxes: [{ latMin: -4, latMax: 13, lngMin: -82, lngMax: -67 }] },
  { cc: 'VE', boxes: [{ latMin: 1, latMax: 12, lngMin: -73, lngMax: -60 }] },
  { cc: 'PE', boxes: [{ latMin: -18, latMax: 0, lngMin: -82, lngMax: -69 }] },
  { cc: 'ZA', boxes: [{ latMin: -35, latMax: -22, lngMin: 16, lngMax: 33 }] },
  { cc: 'EG', boxes: [{ latMin: 22, latMax: 32, lngMin: 25, lngMax: 35 }] },
  { cc: 'NG', boxes: [{ latMin: 4, latMax: 14, lngMin: 3, lngMax: 15 }] },
  { cc: 'KE', boxes: [{ latMin: -5, latMax: 5, lngMin: 34, lngMax: 42 }] },
  { cc: 'MA', boxes: [{ latMin: 27, latMax: 36, lngMin: -13, lngMax: -1 }] },
  { cc: 'DZ', boxes: [{ latMin: 18, latMax: 38, lngMin: -9, lngMax: 12 }] },
  { cc: 'TN', boxes: [{ latMin: 30, latMax: 38, lngMin: 7, lngMax: 12 }] },
  { cc: 'LY', boxes: [{ latMin: 19, latMax: 33, lngMin: 9, lngMax: 26 }] },
  { cc: 'SD', boxes: [{ latMin: 9, latMax: 23, lngMin: 22, lngMax: 38 }] },
  { cc: 'SA', boxes: [{ latMin: 15, latMax: 32, lngMin: 34, lngMax: 56 }] },
  { cc: 'AE', boxes: [{ latMin: 22, latMax: 26, lngMin: 51, lngMax: 57 }] },
  { cc: 'IL', boxes: [{ latMin: 29, latMax: 33, lngMin: 34, lngMax: 36 }] },
  { cc: 'TR', boxes: [{ latMin: 36, latMax: 42, lngMin: 26, lngMax: 45 }] },
  { cc: 'RU', boxes: [{ latMin: 41, latMax: 82, lngMin: 19, lngMax: 180 }] },
  { cc: 'UA', boxes: [{ latMin: 44, latMax: 52, lngMin: 22, lngMax: 40 }] },
];

const BBOX_MAP = new Map(COUNTRY_BBOXES.map((b) => [b.cc, b.boxes]));

// US state abbreviations
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
  'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
  'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

// CA province/territory abbreviations
const CA_PROVINCES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
]);

// ─── Detection functions ───

// Validate that coordinates are usable: not null, not NaN, not (0,0), within range.
export function validateCoords(lat: number, lng: number): boolean {
  if (lat == null || lng == null) return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat === 0 && lng === 0) return false; // Null Island
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

export function detectCountryFromCallsign(callsign: string): string {
  if (!callsign) return '';
  const c = callsign.toUpperCase().trim();
  for (const { pattern, cc } of CALLSIGN_PREFIXES) {
    if (pattern.test(c)) return cc;
  }
  return '';
}

export function detectCountryFromLocation(locationName: string): string {
  if (!locationName) return '';
  const match = locationName.match(/,\s*([A-Z]{2})\s*$/);
  if (match) {
    const abbr = match[1];
    if (US_STATES.has(abbr)) return 'US';
    if (CA_PROVINCES.has(abbr)) return 'CA';
  }
  return '';
}

export function detectCountryFromCoords(lat: number, lng: number): string {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return '';
  for (const { cc, boxes } of COUNTRY_BBOXES) {
    for (const box of boxes) {
      if (lat >= box.latMin && lat <= box.latMax && lng >= box.lngMin && lng <= box.lngMax) {
        return cc;
      }
    }
  }
  return '';
}

// Check if coordinates fall within a country's bounding box
export function coordsInCountry(lat: number, lng: number, cc: string): boolean {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng) || !cc) return false;
  const boxes = BBOX_MAP.get(cc);
  if (!boxes) return true; // Unknown country — don't flag as mismatch
  for (const box of boxes) {
    if (lat >= box.latMin && lat <= box.latMax && lng >= box.lngMin && lng <= box.lngMax) {
      return true;
    }
  }
  return false;
}

// Combined country detection — priority: callsign > location > coordinates.
export function detectRepeaterCountry(
  callsign: string,
  lat: number | null,
  lng: number | null,
  locationName: string,
): { country: string; cc: string } {
  const ccFromCallsign = detectCountryFromCallsign(callsign);
  if (ccFromCallsign) {
    const name = COUNTRY_BBOXES.find((b) => b.cc === ccFromCallsign);
    return { country: name ? ccFromCallsign : ccFromCallsign, cc: ccFromCallsign };
  }

  const ccFromLocation = detectCountryFromLocation(locationName);
  if (ccFromLocation) {
    return { country: ccFromLocation, cc: ccFromLocation };
  }

  if (lat != null && lng != null) {
    const ccFromCoords = detectCountryFromCoords(lat, lng);
    if (ccFromCoords) {
      return { country: ccFromCoords, cc: ccFromCoords };
    }
  }

  return { country: '', cc: '' };
}

// Validate a repeater's country_code against its coordinates and callsign.
// Returns { corrected_cc, mismatch_type } if a correction is needed, or null if OK.
export function validateRepeaterGeo(
  callsign: string,
  lat: number | null,
  lng: number | null,
  currentCC: string,
  locationName: string,
): { corrected_cc: string; mismatch_type: string } | null {
  // Check for (0,0) — Null Island, definitely invalid
  if (lat === 0 && lng === 0) {
    return { corrected_cc: currentCC, mismatch_type: 'null_island' };
  }

  // If no coordinates, validate country from callsign only
  if (lat == null || lng == null) {
    const ccFromCallsign = detectCountryFromCallsign(callsign);
    if (ccFromCallsign && ccFromCallsign !== currentCC) {
      return { corrected_cc: ccFromCallsign, mismatch_type: 'callsign_vs_country' };
    }
    return null;
  }

  // If we have coordinates, check if they match the current country
  if (currentCC && !coordsInCountry(lat, lng, currentCC)) {
    // Coordinates don't match the assigned country — try to detect correct country
    const ccFromCoords = detectCountryFromCoords(lat, lng);
    const ccFromCallsign = detectCountryFromCallsign(callsign);

    // If callsign and coords agree on a different country, trust them
    if (ccFromCallsign && ccFromCoords && ccFromCallsign === ccFromCoords) {
      return { corrected_cc: ccFromCallsign, mismatch_type: 'coords_and_callsign_mismatch' };
    }
    // If only coords detect a country, trust coords
    if (ccFromCoords) {
      return { corrected_cc: ccFromCoords, mismatch_type: 'coords_outside_country' };
    }
    // If only callsign detects a country, trust callsign
    if (ccFromCallsign) {
      return { corrected_cc: ccFromCallsign, mismatch_type: 'callsign_mismatch' };
    }
    // Can't determine correct country — null out coordinates
    return { corrected_cc: currentCC, mismatch_type: 'coords_outside_country_no_fix' };
  }

  // Coordinates match country — check if callsign agrees
  if (currentCC) {
    const ccFromCallsign = detectCountryFromCallsign(callsign);
    if (ccFromCallsign && ccFromCallsign !== currentCC) {
      // Callsign suggests different country but coords match current — trust coords
      // (could be a portable operation or border station)
      return null;
    }
  }

  return null;
}