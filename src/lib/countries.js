// Country definitions with continent assignments and SOTA/POTA prefix mappings.
// Used for country-level filtering of overlay layers.

export const COUNTRIES = [
  // Europe
  { iso2: 'CH', name: 'Schweiz', continent: 'eu', sota: 'HB', pota: 'CH' },
  { iso2: 'LI', name: 'Liechtenstein', continent: 'eu', sota: 'HB9L', pota: 'LI' },
  { iso2: 'AT', name: 'Österreich', continent: 'eu', sota: 'OE', pota: 'OE' },
  { iso2: 'FR', name: 'Frankreich', continent: 'eu', sota: 'F', pota: 'F' },
  { iso2: 'DE', name: 'Deutschland', continent: 'eu', sota: 'DL', pota: 'DL' },
  { iso2: 'IT', name: 'Italien', continent: 'eu', sota: 'I', pota: 'I' },
  { iso2: 'ES', name: 'Spanien', continent: 'eu', sota: 'EA', pota: 'EA' },
  { iso2: 'PT', name: 'Portugal', continent: 'eu', sota: 'CT', pota: 'CT' },
  { iso2: 'GB', name: 'Grossbritannien', continent: 'eu', sota: 'G', pota: 'G' },
  { iso2: 'IE', name: 'Irland', continent: 'eu', sota: 'EI', pota: 'EI' },
  { iso2: 'BE', name: 'Belgien', continent: 'eu', sota: 'ON', pota: 'ON' },
  { iso2: 'NL', name: 'Niederlande', continent: 'eu', sota: 'PA', pota: 'PA' },
  { iso2: 'LU', name: 'Luxemburg', continent: 'eu', sota: 'LX', pota: 'LX' },
  { iso2: 'DK', name: 'Dänemark', continent: 'eu', sota: 'OZ', pota: 'OZ' },
  { iso2: 'SE', name: 'Schweden', continent: 'eu', sota: 'SM', pota: 'SM' },
  { iso2: 'NO', name: 'Norwegen', continent: 'eu', sota: 'LA', pota: 'LA' },
  { iso2: 'FI', name: 'Finnland', continent: 'eu', sota: 'OH', pota: 'OH' },
  { iso2: 'IS', name: 'Island', continent: 'eu', sota: 'TF', pota: 'TF' },
  { iso2: 'PL', name: 'Polen', continent: 'eu', sota: 'SP', pota: 'SP' },
  { iso2: 'CZ', name: 'Tschechien', continent: 'eu', sota: 'OK', pota: 'OK' },
  { iso2: 'SK', name: 'Slowakei', continent: 'eu', sota: 'OM', pota: 'OM' },
  { iso2: 'HU', name: 'Ungarn', continent: 'eu', sota: 'HA', pota: 'HA' },
  { iso2: 'RO', name: 'Rumänien', continent: 'eu', sota: 'YO', pota: 'YO' },
  { iso2: 'BG', name: 'Bulgarien', continent: 'eu', sota: 'LZ', pota: 'LZ' },
  { iso2: 'GR', name: 'Griechenland', continent: 'eu', sota: 'SV', pota: 'SV' },
  { iso2: 'HR', name: 'Kroatien', continent: 'eu', sota: '9A', pota: '9A' },
  { iso2: 'SI', name: 'Slowenien', continent: 'eu', sota: 'S5', pota: 'S5' },
  { iso2: 'RS', name: 'Serbien', continent: 'eu', sota: 'YT', pota: 'YT' },
  { iso2: 'BA', name: 'Bosnien-Herzegowina', continent: 'eu', sota: 'E7', pota: 'E7' },
  { iso2: 'ME', name: 'Montenegro', continent: 'eu', sota: '4O', pota: '4O' },
  { iso2: 'AL', name: 'Albanien', continent: 'eu', sota: 'ZA', pota: 'ZA' },
  { iso2: 'MK', name: 'Nordmazedonien', continent: 'eu', sota: 'Z3', pota: 'Z3' },
  { iso2: 'EE', name: 'Estland', continent: 'eu', sota: 'ES', pota: 'ES' },
  { iso2: 'LV', name: 'Lettland', continent: 'eu', sota: 'YL', pota: 'YL' },
  { iso2: 'LT', name: 'Litauen', continent: 'eu', sota: 'LY', pota: 'LY' },
  { iso2: 'RU', name: 'Russland', continent: 'eu', sota: 'UA', pota: 'UA' },
  { iso2: 'UA', name: 'Ukraine', continent: 'eu', sota: 'UR', pota: 'UR' },
  { iso2: 'BY', name: 'Belarus', continent: 'eu', sota: 'EU', pota: 'EU' },
  { iso2: 'MD', name: 'Moldawien', continent: 'eu', sota: 'ER', pota: 'ER' },
  { iso2: 'TR', name: 'Türkei', continent: 'eu', sota: 'TA', pota: 'TA' },
  { iso2: 'CY', name: 'Zypern', continent: 'eu', sota: '5B', pota: '5B' },
  { iso2: 'MT', name: 'Malta', continent: 'eu', sota: '9H', pota: '9H' },
  { iso2: 'AD', name: 'Andorra', continent: 'eu', sota: 'C31', pota: 'C31' },
  { iso2: 'SM', name: 'San Marino', continent: 'eu', sota: 'T7', pota: 'T7' },
  { iso2: 'MC', name: 'Monaco', continent: 'eu', sota: '3A', pota: '3A' },
  { iso2: 'IM', name: 'Isle of Man', continent: 'eu', sota: 'GD', pota: 'IM' },
  { iso2: 'FO', name: 'Färöer', continent: 'eu', sota: 'OY', pota: 'FO' },
  { iso2: 'JE', name: 'Jersey', continent: 'eu', sota: 'GJ', pota: 'GJ' },
  { iso2: 'GG', name: 'Guernsey', continent: 'eu', sota: 'GU', pota: 'GU' },
  { iso2: 'XK', name: 'Kosovo', continent: 'eu', sota: 'YU', pota: 'YU' },
  { iso2: 'GI', name: 'Gibraltar', continent: 'eu', sota: 'ZB', pota: 'ZB' },
  // North America
  { iso2: 'US', name: 'USA', continent: 'na', sota: 'W/K', pota: 'US' },
  { iso2: 'CA', name: 'Kanada', continent: 'na', sota: 'VE', pota: 'CA' },
  { iso2: 'MX', name: 'Mexiko', continent: 'na', sota: 'XE', pota: 'MX' },
  { iso2: 'CU', name: 'Kuba', continent: 'na', sota: 'CO', pota: 'CU' },
  { iso2: 'BS', name: 'Bahamas', continent: 'na', sota: 'C6', pota: 'BS' },
  { iso2: 'DO', name: 'Dominikanische Republik', continent: 'na', sota: 'HI', pota: 'DO' },
  { iso2: 'JM', name: 'Jamaika', continent: 'na', sota: '6Y', pota: 'JM' },
  // South America
  { iso2: 'BR', name: 'Brasilien', continent: 'sa', sota: 'PY', pota: 'PY' },
  { iso2: 'AR', name: 'Argentinien', continent: 'sa', sota: 'LU', pota: 'LU' },
  { iso2: 'CL', name: 'Chile', continent: 'sa', sota: 'CE', pota: 'CE' },
  { iso2: 'CO', name: 'Kolumbien', continent: 'sa', sota: 'HK', pota: 'HK' },
  { iso2: 'PE', name: 'Peru', continent: 'sa', sota: 'OA', pota: 'OA' },
  { iso2: 'EC', name: 'Ecuador', continent: 'sa', sota: 'HC', pota: 'HC' },
  { iso2: 'VE', name: 'Venezuela', continent: 'sa', sota: 'YV', pota: 'YV' },
  { iso2: 'UY', name: 'Uruguay', continent: 'sa', sota: 'CX', pota: 'CX' },
  { iso2: 'PY', name: 'Paraguay', continent: 'sa', sota: 'ZP', pota: 'ZP' },
  { iso2: 'BO', name: 'Bolivien', continent: 'sa', sota: 'CP', pota: 'CP' },
  // Asia
  { iso2: 'JP', name: 'Japan', continent: 'as', sota: 'JA', pota: 'JP' },
  { iso2: 'KR', name: 'Südkorea', continent: 'as', sota: 'HL', pota: 'HL' },
  { iso2: 'CN', name: 'China', continent: 'as', sota: 'BY', pota: 'BY' },
  { iso2: 'IN', name: 'Indien', continent: 'as', sota: 'VU', pota: 'VU' },
  { iso2: 'ID', name: 'Indonesien', continent: 'as', sota: 'YB', pota: 'YB' },
  { iso2: 'TH', name: 'Thailand', continent: 'as', sota: 'HS', pota: 'HS' },
  { iso2: 'MY', name: 'Malaysia', continent: 'as', sota: '9M2', pota: '9M2' },
  { iso2: 'PH', name: 'Philippinen', continent: 'as', sota: 'DU', pota: 'DU' },
  { iso2: 'SG', name: 'Singapur', continent: 'as', sota: '9V', pota: '9V' },
  { iso2: 'NP', name: 'Nepal', continent: 'as', sota: '9N', pota: '9N' },
  { iso2: 'IL', name: 'Israel', continent: 'as', sota: '4X', pota: '4X' },
  { iso2: 'AE', name: 'Vereinigte Arabische Emirate', continent: 'as', sota: 'A6', pota: 'A6' },
  { iso2: 'SA', name: 'Saudi-Arabien', continent: 'as', sota: 'HZ', pota: 'HZ' },
  { iso2: 'IR', name: 'Iran', continent: 'as', sota: 'EP', pota: 'EP' },
  { iso2: 'IQ', name: 'Irak', continent: 'as', sota: 'YI', pota: 'YI' },
  { iso2: 'JO', name: 'Jordanien', continent: 'as', sota: 'JY', pota: 'JY' },
  { iso2: 'LB', name: 'Libanon', continent: 'as', sota: 'OD', pota: 'OD' },
  { iso2: 'SY', name: 'Syrien', continent: 'as', sota: 'YK', pota: 'YK' },
  { iso2: 'KZ', name: 'Kasachstan', continent: 'as', sota: 'UN', pota: 'UN' },
  { iso2: 'GE', name: 'Georgien', continent: 'as', sota: '4L', pota: '4L' },
  { iso2: 'AM', name: 'Armenien', continent: 'as', sota: 'EK', pota: 'EK' },
  { iso2: 'AZ', name: 'Aserbaidschan', continent: 'as', sota: '4J', pota: '4J' },
  // Africa
  { iso2: 'ZA', name: 'Südafrika', continent: 'af', sota: 'ZS', pota: 'ZS' },
  { iso2: 'MA', name: 'Marokko', continent: 'af', sota: 'CN', pota: 'CN' },
  { iso2: 'TN', name: 'Tunesien', continent: 'af', sota: '3V', pota: '3V' },
  { iso2: 'DZ', name: 'Algerien', continent: 'af', sota: '7X', pota: '7X' },
  { iso2: 'LY', name: 'Libyen', continent: 'af', sota: '5A', pota: '5A' },
  { iso2: 'EG', name: 'Ägypten', continent: 'af', sota: 'SU', pota: 'SU' },
  { iso2: 'ET', name: 'Äthiopien', continent: 'af', sota: 'ET', pota: 'ET' },
  { iso2: 'KE', name: 'Kenia', continent: 'af', sota: '5Z', pota: '5Z' },
  { iso2: 'NG', name: 'Nigeria', continent: 'af', sota: '5N', pota: '5N' },
  { iso2: 'GH', name: 'Ghana', continent: 'af', sota: '9G', pota: '9G' },
  { iso2: 'BW', name: 'Botswana', continent: 'af', sota: 'A2', pota: 'A2' },
  { iso2: 'ZW', name: 'Simbabwe', continent: 'af', sota: 'Z2', pota: 'Z2' },
  { iso2: 'NA', name: 'Namibia', continent: 'af', sota: 'V5', pota: 'V5' },
  // Oceania
  { iso2: 'AU', name: 'Australien', continent: 'oc', sota: 'VK', pota: 'VK' },
  { iso2: 'NZ', name: 'Neuseeland', continent: 'oc', sota: 'ZL', pota: 'ZL' },
  { iso2: 'PG', name: 'Papua-Neuguinea', continent: 'oc', sota: 'P2', pota: 'P2' },
  { iso2: 'FJ', name: 'Fidschi', continent: 'oc', sota: '3D2', pota: '3D2' },
];

// Build lookup maps: SOTA prefix → ISO2, POTA prefix → ISO2
// Handle multi-prefix entries like "W/K" by splitting on "/" — both "W" and "K" map to "US".
const SOTA_TO_ISO = {};
const POTA_TO_ISO = {};
for (const c of COUNTRIES) {
  if (c.sota) {
    for (const prefix of c.sota.toUpperCase().split('/')) {
      SOTA_TO_ISO[prefix] = c.iso2;
    }
  }
  if (c.pota) POTA_TO_ISO[c.pota.toUpperCase()] = c.iso2;
}

// Get ISO2 country code from a SOTA summit code (e.g., "HB/AG-001" → "CH")
export function getCountryFromSotaCode(code) {
  if (!code) return null;
  const prefix = code.split('/')[0].toUpperCase();
  return SOTA_TO_ISO[prefix] || null;
}

// Get ISO2 country code from a POTA park reference (e.g., "DE-0001" → "DE")
// POTA refs now use ISO 3166-1 alpha-2 country codes directly (after migration from DXCC prefixes).
export function getCountryFromPotaRef(ref) {
  if (!ref) return null;
  const prefix = ref.split('-')[0].toUpperCase();
  // POTA refs now use ISO 3166-1 alpha-2 country codes directly (e.g., "DE-0001")
  if (prefix.length === 2 && COUNTRIES.some(c => c.iso2 === prefix)) return prefix;
  // Fallback: try old DXCC prefix mapping (for backwards compatibility with cached data)
  return POTA_TO_ISO[prefix] || null;
}

// Get country code from a repeater (uses country_code field directly)
export function getCountryFromRepeater(r) {
  return r?.country_code || null;
}

// Get ISO2 for a country name (fuzzy)
export function getCountryByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  const found = COUNTRIES.find(c =>
    c.name.toLowerCase() === lower ||
    c.name.toLowerCase().includes(lower) ||
    lower.includes(c.name.toLowerCase())
  );
  return found?.iso2 || null;
}

// Get countries for a specific continent
export function getCountriesByContinent(continentId) {
  return COUNTRIES.filter(c => c.continent === continentId);
}

// WWBOTA scheme → ISO2 country code mapping.
// WWBOTA schemes use a mix of DXCC prefixes (HB, DL, F, OK, ON, SP, EA, EI, etc.)
// and ISO2-like codes (UK→GB, US, CA, RO, ITA→IT). This mapping covers all known schemes.
const WWBOTA_SCHEME_TO_ISO = {
  'HBBOTA': 'CH', 'DLBOTA': 'DE', 'FBOTA': 'FR', 'UKBOTA': 'GB',
  'OKBOTA': 'CZ', 'ONBOTA': 'BE', 'SPBOTA': 'PL', 'S5BOTA': 'SI',
  'EABOTA': 'ES', 'EIBOTA': 'IE', 'ITABOTA': 'IT', 'ROBOTA': 'RO',
  'CABOTA': 'CA', 'USBOTA': 'US', 'PABOTA': 'NL', 'OEBOTA': 'AT',
  'LABOTA': 'NO', 'LXBOTA': 'LU', 'E7BOTA': 'BA', 'ERBOTA': 'MD',
  'CXBOTA': 'UY', 'YUBOTA': 'RS', 'Z3BOTA': 'MK', 'ZABOTA': 'AL',
  '9ABOTA': 'HR', '9MBOTA': 'MY', 'SMBOTA': 'SE',
};

// Get ISO2 country code from a WWBOTA scheme name (e.g., "DLBOTA" → "DE")
export function getCountryFromWwbotaScheme(scheme) {
  if (!scheme) return null;
  return WWBOTA_SCHEME_TO_ISO[scheme.toUpperCase()] || null;
}

// Get ISO2 country code from a WCA castle code (e.g., "HB-00027" → "CH")
// WCA codes use DXCC prefixes (same as SOTA) + number, e.g. "HB-00027", "DL-00001", "F-00001"
export function getCountryFromWcaCode(code) {
  if (!code) return null;
  const prefix = code.split('-')[0].toUpperCase();
  if (!prefix) return null;
  return SOTA_TO_ISO[prefix] || null;
}

// Get ISO2 country code from a WWFF reference code (e.g., "DLFF-0001" → "DE")
// WWFF refs use DXCC prefix + "FF" + number. The DXCC prefix maps to ISO2 via SOTA_TO_ISO.
export function getCountryFromWwffCode(code) {
  if (!code) return null;
  const refPart = code.split('-')[0].toUpperCase();
  const dxcc = refPart.replace(/FF$/, '');
  if (!dxcc) return null;
  return SOTA_TO_ISO[dxcc] || null;
}

// Check if a marker matches the selected countries
// activeCountries: array of ISO2 codes. Empty = no country filter (show all).
export function isInCountries(marker, activeCountries) {
  if (!activeCountries || activeCountries.length === 0) return true;

  let iso2 = null;
  if (marker.layerType === 'sota') {
    iso2 = getCountryFromSotaCode(marker.code || marker.reference);
  } else if (marker.layerType === 'pota') {
    iso2 = getCountryFromPotaRef(marker.code || marker.reference);
  } else if (marker.layerType === 'repeater') {
    iso2 = marker.country_code;
  } else if (marker.layerType === 'castle' || marker.layerType === 'lighthouse' || marker.layerType === 'iota') {
    iso2 = getCountryByName(marker.country);
  } else if (marker.layerType === 'hbff') {
    iso2 = getCountryFromWwffCode(marker.code || marker.reference);
  } else if (marker.layerType === 'wwbota') {
    iso2 = getCountryFromWwbotaScheme(marker.scheme);
  }

  // When a country filter is active, hide markers whose country can't be determined.
  // Previously these were shown regardless, making the filter appear broken.
  if (!iso2) return false;
  return activeCountries.includes(iso2);
}