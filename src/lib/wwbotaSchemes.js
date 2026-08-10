// WWBOTA scheme → color and link mapping.
// Each national WWBOTA scheme gets a distinct color so bunkers from different
// countries are visually distinguishable on the map. Links point to the
// scheme-specific page on wwbota.net.

export const WWBOTA_SCHEME_COLORS = {
  HBBOTA:  '#795548', // CH — brown (original)
  DLBOTA:  '#2c3e50', // DE — dark slate
  FBOTA:   '#2980b9', // FR — blue
  UKBOTA:  '#8e44ad', // GB — purple
  OKBOTA:  '#e67e22', // CZ — orange
  ONBOTA:  '#f1c40f', // BE — gold
  SPBOTA:  '#c0392b', // PL — red
  S5BOTA:  '#27ae60', // SI — green
  EABOTA:  '#d35400', // ES — dark orange
  EIBOTA:  '#16a085', // IE — teal
  ITABOTA: '#3498db', // IT — light blue
  ROBOTA:  '#9b59b6', // RO — violet
  OEBOTA:  '#e74c3c', // AT — red
  PABOTA:  '#f39c12', // NL — amber
  LABOTA:  '#1abc9c', // NO — turquoise
  LXBOTA:  '#95a5a6', // LU — gray
  SMBOTA:  '#34495e', // SE — dark blue-gray
  E7BOTA:  '#7f8c8d', // BA — gray
  ERBOTA:  '#bdc3c7', // MD — light gray
  YUBOTA:  '#a0522d', // RS — sienna
  Z3BOTA:  '#cd6155', // MK — light red
  ZABOTA:  '#d2691e', // AL — chocolate
  '9ABOTA': '#008080', // HR — teal
  '9MBOTA': '#ff6347', // MY — tomato
  CABOTA:  '#b22222', // CA — firebrick
  USBOTA:  '#1e3a5f', // US — navy
  CXBOTA:  '#4169e1', // UY — royal blue
};

// Default fallback color (also used for Swiss fallback data without scheme)
export const WWBOTA_DEFAULT_COLOR = '#795548';

// Major schemes shown in the legend (sorted by approximate bunker count)
export const WWBOTA_LEGEND_SCHEMES = [
  { scheme: 'FBOTA',   country: 'Frankreich',    color: '#2980b9' },
  { scheme: 'UKBOTA',  country: 'Grossbritannien', color: '#8e44ad' },
  { scheme: 'OKBOTA',  country: 'Tschechien',    color: '#e67e22' },
  { scheme: 'ONBOTA',  country: 'Belgien',       color: '#f1c40f' },
  { scheme: 'DLBOTA',  country: 'Deutschland',   color: '#2c3e50' },
  { scheme: 'HBBOTA',  country: 'Schweiz',       color: '#795548' },
  { scheme: 'SPBOTA',  country: 'Polen',         color: '#c0392b' },
  { scheme: 'OEBOTA',  country: 'Österreich',    color: '#e74c3c' },
  { scheme: 'EABOTA',  country: 'Spanien',       color: '#d35400' },
  { scheme: 'ITABOTA', country: 'Italien',      color: '#3498db' },
  { scheme: 'PABOTA',  country: 'Niederlande',   color: '#f39c12' },
  { scheme: 'S5BOTA',  country: 'Slowenien',    color: '#27ae60' },
];

// Get color for a WWBOTA scheme. Falls back to default brown for unknown schemes.
export function getWwbotaColor(scheme) {
  if (!scheme) return WWBOTA_DEFAULT_COLOR;
  return WWBOTA_SCHEME_COLORS[scheme.toUpperCase()] || WWBOTA_DEFAULT_COLOR;
}

// Get the WWBOTA.net detail page URL for a scheme.
// Pattern: https://wwbota.net/{scheme-lowercase}/
// Falls back to the general map page for unknown schemes.
export function getWwbotaLink(scheme, code) {
  if (!scheme) return 'https://wwbota.net/map/';
  const lower = scheme.toLowerCase();
  // Known schemes use the standard URL pattern
  if (WWBOTA_SCHEME_COLORS[scheme.toUpperCase()]) {
    return `https://wwbota.net/${lower}/`;
  }
  return 'https://wwbota.net/map/';
}

// Get a country name from a WWBOTA scheme (for Wikipedia search context)
export function getWwbotaCountryName(scheme) {
  const entry = WWBOTA_LEGEND_SCHEMES.find(s => s.scheme === scheme?.toUpperCase());
  if (entry) return entry.country;
  return null;
}