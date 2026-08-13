// Shared country detection for repeaters — used by fetchHearhamRepeaters
// and cleanupRepeaterCountries to correctly assign US vs CA country codes.
//
// Hearham.com returns repeaters for all of North America. The previous code
// blindly assigned country_code 'CA' to all repeaters in the Canada bounding
// box, which incorrectly tagged US repeaters (K/N/W callsigns in MN, WA, etc.)
// as Canadian. This module provides per-repeater country detection.

// US state abbreviations (2-letter postal codes)
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
  'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
  'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

// CA province/territory abbreviations
const CA_PROVINCES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
]);

// Detect country from amateur radio callsign prefix.
// US: K*, N*, W* (followed by digit)
// CA: VE*, VA*, VO*, VY*, CY*, XJ-XI*
export function detectCountryFromCallsign(callsign: string): string {
  if (!callsign) return '';
  const c = callsign.toUpperCase().trim();
  // US callsigns start with K, N, or W followed by a digit
  if (/^[KNW]\d/.test(c)) return 'US';
  // CA callsigns start with VE, VA, VO, VY, CY, or XJ-XI
  if (/^(VE|VA|VO|VY|CY|XJ|XK|XL|XM|XF|XG|XH|XI)/.test(c)) return 'CA';
  return '';
}

// Detect country from state/province abbreviation in location name.
// e.g. "Soudan, MN" → US, "Toronto, ON" → CA
export function detectCountryFromLocation(locationName: string): string {
  if (!locationName) return '';
  // Extract 2-letter abbreviation from end of location name (after last comma)
  const match = locationName.match(/,\s*([A-Z]{2})\s*$/);
  if (match) {
    const abbr = match[1];
    if (US_STATES.has(abbr)) return 'US';
    if (CA_PROVINCES.has(abbr)) return 'CA';
  }
  return '';
}

// Detect country from coordinates using bounding boxes.
// US: contiguous (24-49 lat, -125 to -66 lng), Alaska, Hawaii
// CA: 41-84 lat, -141 to -52 lng (excluding US overlap zone)
export function detectCountryFromCoords(lat: number, lng: number): string {
  // US bounding boxes
  const inContiguousUS = lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66;
  const inAlaska = lat >= 55 && lat <= 71 && lng >= -180 && lng <= -130;
  const inHawaii = lat >= 18 && lat <= 22 && lng >= -160 && lng <= -154;
  if (inContiguousUS || inAlaska || inHawaii) return 'US';

  // CA bounding box — exclude the US overlap zone (lat 41-49, lng -125 to -66)
  const inCABroad = lat >= 41 && lat <= 84 && lng >= -141 && lng <= -52;
  if (inCABroad && !inContiguousUS) return 'CA';

  return '';
}

// Combined country detection — priority: callsign > location > coordinates.
// Returns { country, cc } or { country: '', cc: '' } if unknown.
export function detectRepeaterCountry(
  callsign: string,
  lat: number | null,
  lng: number | null,
  locationName: string,
): { country: string; cc: string } {
  const ccFromCallsign = detectCountryFromCallsign(callsign);
  if (ccFromCallsign) {
    return { country: ccFromCallsign === 'US' ? 'United States' : 'Canada', cc: ccFromCallsign };
  }

  const ccFromLocation = detectCountryFromLocation(locationName);
  if (ccFromLocation) {
    return { country: ccFromLocation === 'US' ? 'United States' : 'Canada', cc: ccFromLocation };
  }

  if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
    const ccFromCoords = detectCountryFromCoords(lat, lng);
    if (ccFromCoords) {
      return { country: ccFromCoords === 'US' ? 'United States' : 'Canada', cc: ccFromCoords };
    }
  }

  return { country: '', cc: '' };
}

// Validate coordinates — returns null if invalid (null, 0/0, NaN, out of range).
// Used to prevent rendering repeaters at "Null Island" (0,0) or with bad data.
export function validateCoords(lat: number | null, lng: number | null): { lat: number; lng: number } | null {
  if (lat == null || lng == null) return null;
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat === 0 && lng === 0) return null; // Null Island
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}