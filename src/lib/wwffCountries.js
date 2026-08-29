// WWFF prefix → ISO country code mapping
// WWFF codes have format like "DLFF-0001" (Germany), "ZSFF-0439" (South Africa), "HBFF-0001" (Switzerland)
// The prefix before "FF" is the country identifier, NOT an ISO code.
// This maps WWFF prefixes to ISO2 codes for the CountryContinentFilter.

const WWFF_PREFIX_TO_ISO2 = {
  "DL": "DE",    // Germany
  "HB": "CH",    // Switzerland
  "OE": "AT",    // Austria
  "PA": "NL",    // Netherlands
  "ON": "BE",    // Belgium
  "F":  "FR",    // France
  "G":  "GB",    // England
  "GM": "GB",    // England (GM prefix)
  "GI": "GB",    // Northern Ireland
  "GD": "GB",    // Scotland
  "GW": "GB",    // Wales
  "EI": "IE",    // Ireland
  "EA": "ES",    // Spain
  "CT": "PT",    // Portugal
  "I":  "IT",    // Italy
  "SM": "SE",    // Sweden
  "LA": "NO",    // Norway
  "OZ": "DK",    // Denmark
  "OH": "FI",    // Finland
  "TF": "IS",    // Iceland
  "OK": "CZ",    // Czech Republic
  "OM": "CZ",    // Czech Republic (OM prefix)
  "SP": "PL",    // Poland
  "SN": "PL",    // Poland (SN prefix)
  "HA": "HU",    // Hungary
  "HG": "HU",    // Hungary (HG prefix)
  "YO": "RO",    // Romania
  "YR": "RO",    // Romania (YR prefix)
  "LZ": "BG",    // Bulgaria
  "YU": "RS",    // Serbia (former Yugoslavia)
  "S5": "SI",    // Slovenia
  "9A": "HR",    // Croatia
  "E7": "BA",    // Bosnia
  "Z3": "MK",    // North Macedonia
  "Z3A": "MK",   // North Macedonia
  "SV": "GR",    // Greece
  "4X": "IL",    // Israel
  "TA": "TR",    // Turkey
  "UR": "UA",    // Ukraine
  "EU": "UA",    // Ukraine (EU prefix)
  "US": "UA",    // Ukraine (US prefix — not USA in WWFF context!)
  "RA": "RU",    // Russia (European)
  "UA": "RU",    // Russia
  "R1": "RU",    // Russia (Kaliningrad)
  "LY": "LT",    // Lithuania
  "ES": "EE",    // Estonia
  "YL": "LV",    // Latvia
  "ZS": "ZA",    // South Africa
  "V5": "NA",    // Namibia
  "3B": "MU",    // Mauritius
  "4S": "LK",    // Sri Lanka
  "VU": "IN",    // India
  "9M": "MY",    // Malaysia
  "9V": "SG",    // Singapore
  "DU": "PH",    // Philippines
  "YB": "ID",    // Indonesia
  "VK": "AU",    // Australia
  "ZL": "NZ",    // New Zealand
  "3D": "SZ",    // Eswatini
  "A2": "BW",    // Botswana
  "A4": "OM",    // Oman
  "A6": "AE",    // UAE
  "A7": "QA",    // Qatar
  "A9": "BH",    // Bahrain
  "9K": "KW",    // Kuwait
  "7Z": "SA",    // Saudi Arabia
  "5N": "NG",    // Nigeria
  "5R": "MG",    // Madagascar
  "5H": "TZ",    // Tanzania
  "5X": "UG",    // Uganda
  "5Z": "KE",    // Kenya
  "6W": "SN",    // Senegal
  "7Q": "MW",    // Malawi
  "9J": "ZM",    // Zambia
  "Z2": "ZW",    // Zimbabwe
  "C9": "MZ",    // Mozambique
  "D2": "AO",    // Angola
  "D4": "CV",    // Cape Verde
  "D6": "KM",    // Comoros
  "D7": "ZA",    // South Africa (D7 prefix)
  "EL": "LR",    // Liberia
  "SU": "EG",    // Egypt
  "7X": "DZ",    // Algeria
  "5A": "LY",    // Libya
  "3V": "TN",    // Tunisia
  "CN": "MA",    // Morocco
  "EH": "EH",    // Western Sahara
  "J2": "DJ",    // Djibouti
  "J3": "GD",    // Grenada
  "J5": "GW",    // Guinea-Bissau
  "J6": "LC",    // Saint Lucia
  "J7": "DM",    // Dominica
  "J8": "VC",    // Saint Vincent
  "P2": "PG",    // Papua New Guinea
  "P3": "CY",    // Cyprus
  "P4": "AW",    // Aruba
  "P5": "KP",    // North Korea
  "T2": "TV",    // Tuvalu
  "T30": "KI",   // Kiribati
  "T31": "KI",   // Kiribati
  "T32": "KI",   // Kiribati
  "T33": "KI",   // Kiribati
  "3Y": "NO",    // Norway (Bouvet/Svalbard)
  "JY": "JO",    // Jordan
  "OD": "LB",    // Lebanon
  "YI": "IQ",    // Iraq
  "EP": "IR",    // Iran
  "HQ": "SY",    // Syria
  "4X": "IL",    // Israel
  "JY": "JO",    // Jordan
  "AP": "PK",    // Pakistan
  "VU": "IN",    // India
  "8Q": "MV",    // Maldives
  "8R": "GY",    // Guyana
  "8N": "SY",    // Syria
  "XY": "MM",    // Myanmar
  "XU": "KH",    // Cambodia
  "XW": "LA",    // Laos
  "XV": "VN",    // Vietnam
  "3W": "VN",    // Vietnam
  "HS": "TH",    // Thailand
  "9N": "NP",    // Nepal
  "4W": "TL",    // East Timor
  "C3": "AD",    // Andorra
  "C4": "CY",    // Cyprus (C4 prefix)
  "C5": "GM",    // Gambia
  "C6": "BS",    // Bahamas
  "C7": "AD",    // Andorra (C7 prefix)
  "C8": "MZ",    // Mozambique (C8 prefix)
  "4U": "UN",    // UN (ITU/UN HQ)
  "R1": "RU",    // Russia (Kaliningrad)
  "R2": "RU",    // Russia
  "R3": "RU",    // Russia
  "R4": "RU",    // Russia
  "R5": "RU",    // Russia
  "R6": "RU",    // Russia
  "R7": "RU",    // Russia
  "R8": "RU",    // Russia
  "R9": "RU",    // Russia
  "R0": "RU",    // Russia
  "VE": "CA",    // Canada
  "VO": "CA",    // Canada (VO prefix)
  "CY": "CA",    // Canada (CY prefix)
  "CF": "CA",    // Canada (CF prefix)
  "CI": "CA",    // Canada (CI prefix)
  "CJ": "CA",    // Canada (CJ prefix)
  "CK": "CA",    // Canada (CK prefix)
  "CY": "CA",    // Canada
  "V3": "BZ",    // Belize
  "V4": "KN",    // Saint Kitts and Nevis
  "V7": "MH",    // Marshall Islands
  "V8": "BN",    // Brunei
  "XE": "MX",    // Mexico
  "XF": "MX",    // Mexico (XF prefix)
  "XG": "MX",    // Mexico (XG prefix)
  "XH": "MX",    // Mexico (XH prefix)
  "XI": "MX",    // Mexico (XI prefix)
  "XJ": "MX",    // Mexico (XJ prefix)
  "XK": "MX",    // Mexico (XK prefix)
  "4M": "GT",    // Guatemala
  "TG": "GT",    // Guatemala (TG prefix)
  "TD": "GT",    // Guatemala (TD prefix)
  "YS": "SV",    // El Salvador
  "HR": "HN",    // Honduras
  "HP": "PA",    // Panama
  "HP": "PA",    // Panama
  "HQ": "EC",    // Ecuador
  "HC": "EC",    // Ecuador (HC prefix)
  "HD": "EC",    // Ecuador (HD prefix)
  "OA": "PE",    // Peru
  "OB": "PE",    // Peru (OB prefix)
  "OC": "PE",    // Peru (OC prefix)
  "4T": "PE",    // Peru (4T prefix)
  "CP": "BO",    // Bolivia
  "CB": "BO",    // Bolivia (CB prefix)
  "ZP": "PY",    // Paraguay
  "ZP": "PY",    // Paraguay
  "ZY": "BR",    // Brazil
  "ZV": "BR",    // Brazil (ZV prefix)
  "ZW": "BR",    // Brazil (ZW prefix)
  "ZX": "BR",    // Brazil (ZX prefix)
  "ZZ": "BR",    // Brazil (ZZ prefix)
  "ZU": "BR",    // Brazil (ZU prefix)
  "ZT": "BR",    // Brazil (ZT prefix)
  "PP": "BR",    // Brazil (PP prefix)
  "PQ": "BR",    // Brazil (PQ prefix)
  "PR": "BR",    // Brazil (PR prefix)
  "PS": "BR",    // Brazil (PS prefix)
  "PT": "BR",    // Brazil (PT prefix)
  "PU": "BR",    // Brazil (PU prefix)
  "PV": "BR",    // Brazil (PV prefix)
  "PW": "BR",    // Brazil (PW prefix)
  "PX": "BR",    // Brazil (PX prefix)
  "PY": "BR",    // Brazil (PY prefix)
  "PZ": "BR",    // Brazil (PZ prefix)
  "5R": "AR",    // Argentina
  "LO": "AR",    // Argentina (LO prefix)
  "LP": "AR",    // Argentina (LP prefix)
  "LQ": "AR",    // Argentina (LQ prefix)
  "LR": "AR",    // Argentina (LR prefix)
  "LS": "AR",    // Argentina (LS prefix)
  "LT": "AR",    // Argentina (LT prefix)
  "LV": "AR",    // Argentina (LV prefix)
  "LW": "AR",    // Argentina (LW prefix)
  "LX": "AR",    // Argentina (LX prefix)
  "LY": "AR",    // Argentina (LY prefix)
  "LZ": "AR",    // Argentina (LZ prefix)
  "3G": "CL",    // Chile
  "CA": "CL",    // Chile (CA prefix)
  "CB": "CL",    // Chile (CB prefix)
  "CC": "CL",    // Chile (CC prefix)
  "CD": "CL",    // Chile (CD prefix)
  "CE": "CL",    // Chile (CE prefix)
  "CF": "CL",    // Chile (CF prefix)
  "XQ": "CL",    // Chile (XQ prefix)
  "XR": "CL",    // Chile (XR prefix)
  "XW": "CL",    // Chile (XW prefix)
  "3A": "MC",    // Monaco
  "3B": "MU",    // Mauritius (3B prefix)
  "3C": "GQ",    // Equatorial Guinea
  "3D": "ZA",    // South Africa (3D prefix)
  "3X": "GN",    // Guinea
  "4S": "LK",    // Sri Lanka
  "4U": "UN",    // UN HQ
  "4X": "IL",    // Israel
  "4Z": "IL",    // Israel (4Z prefix)
  "5B": "CY",    // Cyprus (5B prefix)
  "5H": "TZ",    // Tanzania
  "5N": "NG",    // Nigeria
  "5P": "DK",    // Denmark (5P prefix)
  "5Q": "DK",    // Denmark (5Q prefix)
  "5R": "MG",    // Madagascar
  "5T": "MR",    // Mauritania
  "5U": "NE",    // Niger
  "5V": "TG",    // Togo
  "5W": "WS",    // Samoa
  "5X": "UG",    // Uganda
  "5Z": "KE",    // Kenya
  "6O": "SO",    // Somalia
  "6Y": "JM",    // Jamaica
  "7P": "LS",    // Lesotho
  "7Q": "MW",    // Malawi
  "7R": "GL",    // Greenland
  "8P": "BB",    // Barbados
  "8S": "SE",    // Sweden (8S prefix)
  "8T": "IN",    // India (8T prefix)
  "8U": "IN",    // India (8U prefix)
  "8V": "IN",    // India (8V prefix)
  "8W": "IN",    // India (8W prefix)
  "8X": "IN",    // India (8X prefix)
  "8Y": "IN",    // India (8Y prefix)
  "9A": "HR",    // Croatia
  "9G": "ET",    // Ethiopia
  "9H": "MT",    // Malta
  "9I": "TT",    // Trinidad and Tobago
  "9J": "ZM",    // Zambia
  "9K": "KW",    // Kuwait
  "9L": "SL",    // Sierra Leone
  "9M": "MY",    // Malaysia
  "9N": "NP",    // Nepal
  "9O": "CD",    // DR Congo
  "9Q": "CD",    // DR Congo (9Q prefix)
  "9R": "CD",    // DR Congo (9R prefix)
  "9S": "CD",    // DR Congo (9S prefix)
  "9T": "CD",    // DR Congo (9T prefix)
  "9U": "BI",    // Burundi
  "9V": "SG",    // Singapore
  "9X": "SR",    // Suriname
  "9Y": "TT",    // Trinidad and Tobago (9Y prefix)
};

// Convert a WWFF code to an ISO2 country code
// e.g. "DLFF-0001" → "DE", "ZSFF-0439" → "ZA", "HBFF-0001" → "CH"
export function wwffCodeToIso2(code) {
  if (!code) return null;
  // Strip everything after "-" first
  const prefix = code.split("-")[0];
  // Strip trailing "FF" (case-insensitive)
  const countryPart = prefix.replace(/FF$/i, "").toUpperCase();
  // Try direct lookup
  if (WWFF_PREFIX_TO_ISO2[countryPart]) return WWFF_PREFIX_TO_ISO2[countryPart];
  // Try single-letter prefixes (e.g. "I" for Italy, "F" for France)
  if (WWFF_PREFIX_TO_ISO2[countryPart[0]]) return WWFF_PREFIX_TO_ISO2[countryPart[0]];
  return countryPart; // Fallback: return the raw prefix
}

// Get a readable country name from WWFF code
export function wwffCodeToCountryName(code, countries) {
  const iso2 = wwffCodeToIso2(code);
  if (!iso2) return code || "?";
  if (countries) {
    const c = countries.find(c => c.iso2 === iso2);
    if (c) return c.name;
  }
  return iso2;
}