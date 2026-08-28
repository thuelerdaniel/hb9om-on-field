// Shared spot utilities — QRT filter, callsign-to-flag (flagcdn.com), reference URLs.
// Used by LiveSpotActivity, ActivityPanel, SpotDetailsModal.

import { parseCallsign } from "./callsignParser";

// ─── Fix 1: QRT-Stationen erkennen ───
// Prüft case-insensitive ob "QRT" in comments/remarks enthalten ist.
export function isQRT(spot) {
  if (!spot) return false;
  const text = (spot.comments || spot.remarks || '').toString().toUpperCase();
  return text.includes('QRT');
}

// ─── Fix 4: Callsign → ISO 2-letter country code ───
// DXCC prefix table — erweitert für Portable/Prefix-Callsigns.
const PREFIX_MAP = {
  '9A': 'HR', 'I': 'IT', 'DL': 'DE', 'EA': 'ES', 'EA1': 'ES', 'EA2': 'ES',
  'EA3': 'ES', 'EA4': 'ES', 'EA5': 'ES', 'EA6': 'ES', 'EA7': 'ES', 'EA8': 'ES', 'EA9': 'ES',
  'HB': 'CH', 'HB0': 'LI', 'HB9': 'CH',
  'OE': 'AT', 'OH': 'FI', 'OK': 'CZ', 'ON': 'BE', 'PA': 'NL',
  'SP': 'PL', 'SV': 'GR', 'TK': 'FR', 'VE': 'CA', 'VK': 'AU',
  'W': 'US', 'K': 'US', 'N': 'US', 'AA': 'US', 'AB': 'US', 'AC': 'US', 'AD': 'US',
  'AE': 'US', 'AF': 'US', 'AG': 'US', 'AH': 'US', 'AI': 'US', 'AJ': 'US', 'AK': 'US', 'AL': 'US',
  'G': 'GB', 'M': 'GB', '2E': 'GB', 'M6': 'GB', 'M7': 'GB', 'M8': 'GB',
  'F': 'FR', 'F4': 'FR', 'F5': 'FR', 'F6': 'FR', 'F8': 'FR',
  'JA': 'JP', 'JH': 'JP', 'JL': 'JP', 'JR': 'JP', 'JG': 'JP',
  'TA': 'TR', 'YB': 'ID', 'ZL': 'NZ', 'ZS': 'ZA',
  'PY': 'BR', 'PU': 'BR', 'PV': 'BR', 'PT': 'BR', 'PP': 'BR',
  'LU': 'AR', 'CE': 'CL', 'CX': 'UY', 'OA': 'PE',
  'HK': 'CO', 'YY': 'VE', 'XE': 'MX', 'XG': 'MX',
  '4X': 'IL', '4Z': 'IL', '4O': 'ME', '4U': 'UN',
  'R': 'RU', 'RA': 'RU', 'RZ': 'RU', 'RW': 'RU', 'RV': 'RU',
  'UA': 'UA', 'UR': 'UA', 'US': 'UA', 'UT': 'UA', 'UU': 'UA',
  'ES': 'EE', 'EW': 'BY', 'EU': 'EE', 'LY': 'LT', 'YL': 'LV',
  'SN': 'PL', 'SO': 'PL', 'SQ': 'PL', '3Z': 'PL', 'HF': 'PL',
  'OM': 'AT', '5B': 'CY', '9H': 'MT', 'Z3': 'MK', 'YU': 'RS',
  'YT': 'RS', 'YZ': 'RS', 'S5': 'SI', 'OL': 'CZ',
  'VU': 'IN', 'AT': 'IN', 'AU': 'IN', 'AV': 'IN', 'AW': 'IN',
  '4S': 'LK', '8S': 'LK', 'HS': 'TH', 'E2': 'TH',
  '9M': 'MY', '9W': 'MY',
  'DU': 'PH', 'DV': 'PH', 'DW': 'PH', 'DX': 'PH', 'DY': 'PH', 'DZ': 'PH',
  'YB': 'ID', 'YC': 'ID', 'YD': 'ID', 'YE': 'ID', 'YF': 'ID', 'YG': 'ID', 'YH': 'ID',
  'ZS': 'ZA', 'ZR': 'ZA', 'ZT': 'ZA', 'ZU': 'ZA',
  'AY': 'ZA', 'AZ': 'ZA',
  '5R': 'MG', '6W': 'SN', '5N': 'NG', '5H': 'TZ', '5Z': 'KE',
  '3B': 'MU', '3B8': 'MU', '3B9': 'MU',
  'LA': 'NO', 'LB': 'NO', 'LC': 'NO', 'LD': 'NO', 'LE': 'NO', 'LF': 'NO',
  'LG': 'NO', 'LH': 'NO', 'LI': 'NO', 'LJ': 'NO', 'LK': 'NO', 'LL': 'NO', 'LM': 'NO', 'LN': 'NO', 'LO': 'NO',
  'SM': 'SE', 'SA': 'SE', 'SB': 'SE', 'SC': 'SE', 'SD': 'SE', 'SE': 'SE', 'SF': 'SE',
  'SG': 'SE', 'SH': 'SE', 'SI': 'SE', 'SJ': 'SE', 'SK': 'SE', 'SL': 'SE',
  'OZ': 'DK', 'OU': 'DK', 'OV': 'DK', 'OW': 'DK', 'OX': 'DK', 'OY': 'DK',
  'EB': 'ES', 'EC': 'ES', 'ED': 'ES', 'EE': 'ES', 'EF': 'ES', 'EG': 'ES', 'EH': 'ES',
  'CT': 'PT', 'CQ': 'PT', 'CR': 'PT', 'CS': 'PT',
  'OO': 'BE', 'OP': 'BE', 'OQ': 'BE', 'OR': 'BE', 'OS': 'BE', 'OT': 'BE',
  'LX': 'LU',
  'HA': 'HU', 'HG': 'HU',
  'DA': 'DE', 'DB': 'DE', 'DC': 'DE', 'DD': 'DE', 'DE': 'DE', 'DF': 'DE',
  'DG': 'DE', 'DH': 'DE', 'DI': 'DE', 'DJ': 'DE', 'DK': 'DE', 'DM': 'DE', 'DN': 'DE',
  'DO': 'DE', 'DP': 'DE', 'DQ': 'DE', 'DR': 'DE', 'DS': 'DE', 'DT': 'DE', 'DU': 'DE',
  'DV': 'DE', 'DW': 'DE',
  'II': 'IT', 'IK': 'IT', 'IN': 'IT', 'IQ': 'IT', 'IR': 'IT', 'IT': 'IT', 'IU': 'IT',
  'IV': 'IT', 'IW': 'IT', 'IX': 'IT', 'IY': 'IT', 'IZ': 'IT',
  'GM': 'GB', 'GW': 'GB', 'GI': 'GB', 'GD': 'GB', 'GU': 'GB', 'GJ': 'GB',
  'PD': 'NL', 'PE': 'NL', 'PF': 'NL', 'PG': 'NL', 'PH': 'NL', 'PI': 'NL', 'PJ': 'NL',
  'PK': 'NL', 'PL': 'NL', 'PM': 'NL', 'PN': 'NL', 'PO': 'NL', 'PP': 'NL', 'PQ': 'NL',
  'PR': 'NL', 'PS': 'NL', 'PT': 'NL', 'PU': 'NL', 'PV': 'NL', 'PW': 'NL', 'PX': 'NL', 'PZ': 'NL',
  'TM': 'FR', 'TH': 'FR', 'HW': 'FR', 'HX': 'FR',
  'JE': 'JP', 'JF': 'JP', 'JI': 'JP', 'JJ': 'JP', 'JK': 'JP', 'JM': 'JP', 'JN': 'JP',
  'JO': 'JP', 'JP': 'JP', 'JQ': 'JP', 'JS': 'JP', 'JT': 'JP', 'JU': 'JP', 'JV': 'JP',
  'JW': 'JP', 'JX': 'JP', 'JY': 'JP',
  'AX': 'AU',
  'ZK': 'NZ',
  'VA': 'CA', 'VO': 'CA', 'VY': 'CA', 'CY': 'CA',
  'XF': 'MX', 'XH': 'MX', 'XI': 'MX',
  'LO': 'AR', 'LP': 'AR', 'LQ': 'AR', 'LR': 'AR', 'LS': 'AR', 'LT': 'AR', 'LV': 'AR', 'LW': 'AR',
  'PP': 'BR', 'PQ': 'BR', 'PR': 'BR', 'PS': 'BR', 'ZV': 'BR', 'ZW': 'BR', 'ZZ': 'BR', 'ZY': 'BR',
  'CA': 'CL', 'CB': 'CL', 'CC': 'CL', 'CD': 'CL', 'XQ': 'CL', 'XR': 'CL', '3G': 'CL',
  'CV': 'UY', 'CW': 'UY',
  'RA': 'RU', 'RB': 'RU', 'RC': 'RU', 'RD': 'RU', 'RE': 'RU', 'RF': 'RU', 'RG': 'RU',
  'RH': 'RU', 'RI': 'RU', 'RJ': 'RU', 'RK': 'RU', 'RL': 'RU', 'RM': 'RU', 'RN': 'RU',
  'RO': 'RU', 'RP': 'RU', 'RQ': 'RU', 'RR': 'RU', 'RS': 'RU', 'RT': 'RU', 'RU': 'RU',
  'RV': 'RU', 'RW': 'RU', 'RX': 'RU', 'RY': 'RU', 'RZ': 'RU',
  'KA': 'US', 'KB': 'US', 'KC': 'US', 'KD': 'US', 'KE': 'US', 'KF': 'US', 'KG': 'US',
  'KH': 'US', 'KI': 'US', 'KJ': 'US', 'KK': 'US', 'KL': 'US', 'KM': 'US', 'KN': 'US',
  'KO': 'US', 'KP': 'US', 'KQ': 'US', 'KR': 'US', 'KS': 'US', 'KT': 'US', 'KU': 'US',
  'KV': 'US', 'KW': 'US', 'KX': 'US', 'KY': 'US', 'KZ': 'US',
  'NA': 'US', 'NB': 'US', 'NC': 'US', 'ND': 'US', 'NE': 'US', 'NF': 'US', 'NG': 'US',
  'NH': 'US', 'NI': 'US', 'NJ': 'US', 'NK': 'US', 'NL': 'US', 'NM': 'US', 'NN': 'US',
  'NO': 'US', 'NP': 'US', 'NQ': 'US', 'NR': 'US', 'NS': 'US', 'NT': 'US', 'NU': 'US',
  'NV': 'US', 'NW': 'US', 'NX': 'US', 'NY': 'US', 'NZ': 'US',
  'WA': 'US', 'WB': 'US', 'WC': 'US', 'WD': 'US', 'WE': 'US', 'WF': 'US', 'WG': 'US',
  'WH': 'US', 'WI': 'US', 'WJ': 'US', 'WK': 'US', 'WL': 'US', 'WM': 'US', 'WN': 'US',
  'WO': 'US', 'WP': 'US', 'WQ': 'US', 'WR': 'US', 'WS': 'US', 'WT': 'US', 'WU': 'US',
  'WV': 'US', 'WW': 'US', 'WX': 'US', 'WY': 'US', 'WZ': 'US',
  'OF': 'FI', 'OG': 'FI', 'OI': 'FI',
  'TB': 'TR', 'TC': 'TR',
};

export function getCountryCodeFromCallsign(callsign) {
  if (!callsign) return null;
  const parsed = parseCallsign(callsign);
  const prefix = parsed.prefix;
  const base = parsed.base;

  // 1. Versuche Prefix-basierte Erkennung (wenn Prefix vorhanden)
  if (prefix) {
    // Exakter Match zuerst
    if (PREFIX_MAP[prefix]) return PREFIX_MAP[prefix];
    // Partial Match: versuche kürzere Prefixe (z.B. "EA2" → "EA")
    for (let i = prefix.length; i >= 2; i--) {
      const partial = prefix.substring(0, i);
      if (PREFIX_MAP[partial]) return PREFIX_MAP[partial];
    }
    // 1-Zeichen Prefix
    if (PREFIX_MAP[prefix.substring(0, 1)]) return PREFIX_MAP[prefix.substring(0, 1)];
  }

  // 2. Base-Callsign-basierte Erkennung
  if (base) {
    // 2-Zeichen Prefix
    const twoChar = base.substring(0, 2);
    if (PREFIX_MAP[twoChar]) return PREFIX_MAP[twoChar];
    // 1-Zeichen Prefix
    const oneChar = base.substring(0, 1);
    if (PREFIX_MAP[oneChar]) return PREFIX_MAP[oneChar];
  }

  return null;
}

// Fix 4: Flaggen-Bilder von flagcdn.com
export function getFlagImg(callsign) {
  const code = getCountryCodeFromCallsign(callsign);
  if (!code) return null;
  return {
    code,
    url: `https://flagcdn.com/16x12/${code.toLowerCase()}.png`,
  };
}

// ─── Fix 7 + 9: Referenz-URLs ───
// WWFF: https://wwff.co/directory/ (keine Per-Referenz-URL)
// WWBOTA: scheme-basiert (ukbota.net, wwbota.net/cxbota/, etc.)
export function getReferenceUrl(activityType, reference) {
  if (!reference) return null;
  try {
    const ref = reference.toUpperCase();
    const actType = (activityType || '').toUpperCase();

    // SOTA: sotl.as
    if (actType === 'SOTA' || ref.match(/^[A-Z0-9]+\/[A-Z0-9]+-[0-9]+$/)) {
      const parts = reference.split('/');
      if (parts.length >= 2) return `https://sotl.as/summit/${parts[0]}/${parts.slice(1).join('/')}`;
      return null;
    }

    // POTA: pota.app
    if (actType === 'POTA' || ref.match(/^[A-Z]{2}-\d+$/)) {
      return `https://pota.app/#/park/${reference}`;
    }

    // Fix 7: WWFF — keine Per-Referenz-URL, Directory-Seite
    if (actType === 'WWFF' || ref.match(/^[A-Z]{2}FF-\d{4}$/)) {
      return `https://wwff.co/directory/`;
    }

    // Fix 9: WWBOTA — scheme-basierte URLs
    if (actType === 'WWBOTA' || ref.match(/^B\//)) {
      return getWwbotaUrl(reference);
    }

    // IOTA
    if (actType === 'IOTA' || ref.match(/^[A-Z]{2}-\d{3}$/)) {
      return `https://www.iota-world.org/iota-islands/iota-group/${reference}`;
    }

    // WCA
    if (actType === 'WCA') return `https://www.castlesandcities.com/`;
  } catch {}
  return null;
}

// Fix 9: WWBOTA scheme-basierte URLs
export function getWwbotaUrl(reference) {
  if (!reference) return `https://wwbota.net/`;
  const ref = reference.toUpperCase();
  if (ref.startsWith('B/G-')) return `https://ukbota.net/`;
  if (ref.startsWith('B/PA-')) return `https://wwbota.net/`;
  if (ref.startsWith('B/CX-')) return `https://wwbota.net/cxbota/`;
  if (ref.startsWith('B/YU-')) return `https://wwbota.net/yubota/`;
  return `https://wwbota.net/`;
}