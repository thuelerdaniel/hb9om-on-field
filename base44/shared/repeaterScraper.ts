// Shared repeater scraping logic — imported by fetchRepeaters and refreshAllData.
// Sources: RepeaterBook.com (worldwide — 68+ countries), ukrepeater.net (UK),
//          WIA Australia (CSV), dstarusers.org (D-STAR worldwide)

import { fetchAdditionalRepeaterSources } from './additionalRepeaterSources.ts';

const LIST_BASE = 'https://www.repeaterbook.com/row_repeaters/Display_SS.php';
const DETAIL_BASE = 'https://www.repeaterbook.com/row_repeaters/details.php';

// US/Canada/Mexico use a separate URL structure (not row_repeaters)
const NA_LIST_BASE = 'https://www.repeaterbook.com/repeaters/Display_SS.php';
const NA_DETAIL_BASE = 'https://www.repeaterbook.com/repeaters/details.php';

const LIST_PARAMS = 'band=%25&freq=%25&band6=%25&loc=%25&call=%25&status_id=%25&features=%25&system=%25&coverage=%25&use=%25';

const MAX_DETAIL_FETCH = 8000;
const MAX_PER_COUNTRY = 200;
const MAX_PER_COUNTRY_PRIORITY_1 = 500; // Switzerland + neighbors
const MAX_PER_COUNTRY_PRIORITY_2 = 30;  // Rest of Europe
const MAX_PER_COUNTRY_PRIORITY_3 = 15;  // Asia, Africa, Americas, Oceania
const MAX_PER_US_CA_REGION = 35;
const LIST_CONCURRENCY = 12;
const DETAIL_CONCURRENCY = 80;
const FETCH_TIMEOUT_MS = 8000;
const DETAIL_DEADLINE_MS = 200000; // 200 seconds — enough for worldwide detail fetches

// Fetch with timeout — prevents a single slow/stuck response from blocking the whole batch.
// Aborts after FETCH_TIMEOUT_MS and returns null (caller treats as failed fetch).
async function fetchWithTimeout(url: string, opts?: any): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      ...opts,
      signal: controller.signal,
    });
    return resp;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Country list from RepeaterBook row_repeaters index.
// Priority 1: Switzerland + neighbors (always fetch detail pages first)
// Priority 2: Rest of Europe
// Priority 3: Other continents
const COUNTRIES = [
  // Priority 1: Switzerland + neighbors
  { code: 'CH', name: 'Switzerland', priority: 1 },
  { code: 'LI', name: 'Liechtenstein', priority: 1 },
  { code: 'AT', name: 'Austria', priority: 1 },
  { code: 'FR', name: 'France', priority: 1 },
  { code: 'DE', name: 'Germany', priority: 1 },
  { code: 'IT', name: 'Italy', priority: 1 },
  // Priority 2: Rest of Europe
  { code: 'AL', name: 'Albania', priority: 2 },
  { code: 'AD', name: 'Andorra', priority: 2 },
  { code: 'BY', name: 'Belarus', priority: 2 },
  { code: 'BE', name: 'Belgium', priority: 2 },
  { code: 'BA', name: 'Bosnia and Herzegovina', priority: 2 },
  { code: 'BG', name: 'Bulgaria', priority: 2 },
  { code: 'HR', name: 'Croatia', priority: 2 },
  { code: 'CY', name: 'Cyprus', priority: 2 },
  { code: 'CZ', name: 'Czechia', priority: 2 },
  { code: 'DK', name: 'Denmark', priority: 2 },
  { code: 'EE', name: 'Estonia', priority: 2 },
  { code: 'FO', name: 'Faroe Islands', priority: 2 },
  { code: 'FI', name: 'Finland', priority: 2 },
  { code: 'GE', name: 'Georgia', priority: 2 },
  { code: 'GI', name: 'Gibraltar', priority: 2 },
  { code: 'GG', name: 'Guernsey', priority: 2 },
  { code: 'GR', name: 'Greece', priority: 2 },
  { code: 'HU', name: 'Hungary', priority: 2 },
  { code: 'IS', name: 'Iceland', priority: 2 },
  { code: 'IM', name: 'Isle of Man', priority: 2 },
  { code: 'IE', name: 'Ireland', priority: 2 },
  { code: 'JE', name: 'Jersey', priority: 2 },
  { code: 'XK', name: 'Kosovo', priority: 2 },
  { code: 'LV', name: 'Latvia', priority: 2 },
  { code: 'LT', name: 'Lithuania', priority: 2 },
  { code: 'LU', name: 'Luxembourg', priority: 2 },
  { code: 'MT', name: 'Malta', priority: 2 },
  { code: 'MD', name: 'Moldova', priority: 2 },
  { code: 'NL', name: 'Netherlands', priority: 2 },
  { code: 'NO', name: 'Norway', priority: 2 },
  { code: 'MK', name: 'North Macedonia', priority: 2 },
  { code: 'PL', name: 'Poland', priority: 2 },
  { code: 'PT', name: 'Portugal', priority: 2 },
  { code: 'RO', name: 'Romania', priority: 2 },
  { code: 'RU', name: 'Russian Federation', priority: 2 },
  { code: 'SM', name: 'San Marino', priority: 2 },
  { code: 'RS', name: 'Serbia', priority: 2 },
  { code: 'SK', name: 'Slovakia', priority: 2 },
  { code: 'SI', name: 'Slovenia', priority: 2 },
  { code: 'ES', name: 'Spain', priority: 2 },
  { code: 'SE', name: 'Sweden', priority: 2 },
  { code: 'UA', name: 'Ukraine', priority: 2 },
  { code: 'GB', name: 'United Kingdom', priority: 2 },
  // Priority 3: Middle East, Asia, Americas, Africa, Oceania
  { code: 'TR', name: 'Türkiye', priority: 3 },
  { code: 'IL', name: 'Israel', priority: 3 },
  { code: 'AE', name: 'United Arab Emirates', priority: 3 },
  { code: 'KW', name: 'Kuwait', priority: 3 },
  { code: 'OM', name: 'Oman', priority: 3 },
  { code: 'AZ', name: 'Azerbaijan', priority: 3 },
  { code: 'CN', name: 'China', priority: 3 },
  { code: 'IN', name: 'India', priority: 3 },
  { code: 'ID', name: 'Indonesia', priority: 3 },
  { code: 'JP', name: 'Japan', priority: 3 },
  { code: 'MY', name: 'Malaysia', priority: 3 },
  { code: 'NP', name: 'Nepal', priority: 3 },
  { code: 'PH', name: 'Philippines', priority: 3 },
  { code: 'SG', name: 'Singapore', priority: 3 },
  { code: 'KR', name: 'South Korea', priority: 3 },
  { code: 'LK', name: 'Sri Lanka', priority: 3 },
  { code: 'TH', name: 'Thailand', priority: 3 },
  { code: 'AR', name: 'Argentina', priority: 3 },
  { code: 'BR', name: 'Brazil', priority: 3 },
  { code: 'CL', name: 'Chile', priority: 3 },
  { code: 'CO', name: 'Colombia', priority: 3 },
  { code: 'EC', name: 'Ecuador', priority: 3 },
  { code: 'PY', name: 'Paraguay', priority: 3 },
  { code: 'PE', name: 'Peru', priority: 3 },
  { code: 'UY', name: 'Uruguay', priority: 3 },
  { code: 'VE', name: 'Venezuela', priority: 3 },
  { code: 'BZ', name: 'Belize', priority: 3 },
  { code: 'CR', name: 'Costa Rica', priority: 3 },
  { code: 'SV', name: 'El Salvador', priority: 3 },
  { code: 'GT', name: 'Guatemala', priority: 3 },
  { code: 'NI', name: 'Nicaragua', priority: 3 },
  { code: 'PA', name: 'Panama', priority: 3 },
  { code: 'MX', name: 'Mexico', priority: 3 },
  { code: 'CU', name: 'Cuba', priority: 3 },
  { code: 'BS', name: 'Bahamas', priority: 3 },
  { code: 'BB', name: 'Barbados', priority: 3 },
  { code: 'LC', name: 'Saint Lucia', priority: 3 },
  { code: 'AG', name: 'Antigua and Barbuda', priority: 3 },
  { code: 'DM', name: 'Dominica', priority: 3 },
  { code: 'BQ', name: 'Caribbean Netherlands', priority: 3 },
  { code: 'CW', name: 'Curaçao', priority: 3 },
  { code: 'DO', name: 'Dominican Republic', priority: 3 },
  { code: 'GD', name: 'Grenada', priority: 3 },
  { code: 'HT', name: 'Haiti', priority: 3 },
  { code: 'HN', name: 'Honduras', priority: 3 },
  { code: 'JM', name: 'Jamaica', priority: 3 },
  { code: 'KN', name: 'Saint Kitts and Nevis', priority: 3 },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', priority: 3 },
  { code: 'TT', name: 'Trinidad and Tobago', priority: 3 },
  { code: 'KY', name: 'Cayman Islands', priority: 3 },
  { code: 'KE', name: 'Kenya', priority: 3 },
  { code: 'MA', name: 'Morocco', priority: 3 },
  { code: 'ZA', name: 'South Africa', priority: 3 },
  { code: 'NG', name: 'Nigeria', priority: 3 },
  { code: 'GH', name: 'Ghana', priority: 3 },
  { code: 'EG', name: 'Egypt', priority: 3 },
  { code: 'ET', name: 'Ethiopia', priority: 3 },
  { code: 'NA', name: 'Namibia', priority: 3 },
  { code: 'BW', name: 'Botswana', priority: 3 },
  { code: 'ZW', name: 'Zimbabwe', priority: 3 },
  { code: 'ZM', name: 'Zambia', priority: 3 },
  { code: 'MU', name: 'Mauritius', priority: 3 },
  { code: 'RE', name: 'Reunion', priority: 3 },
  { code: 'MG', name: 'Madagascar', priority: 3 },
  { code: 'SN', name: 'Senegal', priority: 3 },
  { code: 'CM', name: 'Cameroon', priority: 3 },
  { code: 'UG', name: 'Uganda', priority: 3 },
  { code: 'TZ', name: 'Tanzania', priority: 3 },
  { code: 'LS', name: 'Lesotho', priority: 3 },
  { code: 'SZ', name: 'Eswatini', priority: 3 },
  { code: 'AU', name: 'Australia', priority: 3 },
  { code: 'NZ', name: 'New Zealand', priority: 3 },
  { code: 'PG', name: 'Papua New Guinea', priority: 3 },
  { code: 'FJ', name: 'Fiji', priority: 3 },
  // Additional South America
  { code: 'BO', name: 'Bolivia', priority: 3 },
  { code: 'GY', name: 'Guyana', priority: 3 },
  { code: 'SR', name: 'Suriname', priority: 3 },
  // Priority 3: North America (US/Canada/Mexico) — uses separate URL structure
  // US states (state_id is numeric on RepeaterBook)
  { code: 'US-AL', name: 'Alabama', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '01', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-AK', name: 'Alaska', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '02', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-AZ', name: 'Arizona', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '04', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-AR', name: 'Arkansas', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '05', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-CA', name: 'California', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '06', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-CO', name: 'Colorado', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '08', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-CT', name: 'Connecticut', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '09', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-DE', name: 'Delaware', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '10', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-FL', name: 'Florida', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '12', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-GA', name: 'Georgia', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '13', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-HI', name: 'Hawaii', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '15', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-ID', name: 'Idaho', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '16', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-IL', name: 'Illinois', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '17', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-IN', name: 'Indiana', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '18', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-IA', name: 'Iowa', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '19', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-KS', name: 'Kansas', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '20', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-KY', name: 'Kentucky', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '21', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-LA', name: 'Louisiana', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '22', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-ME', name: 'Maine', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '23', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-MD', name: 'Maryland', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '24', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-MA', name: 'Massachusetts', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '25', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-MI', name: 'Michigan', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '26', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-MN', name: 'Minnesota', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '27', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-MS', name: 'Mississippi', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '28', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-MO', name: 'Missouri', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '29', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-MT', name: 'Montana', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '30', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-NE', name: 'Nebraska', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '31', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-NV', name: 'Nevada', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '32', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-NH', name: 'New Hampshire', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '33', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-NJ', name: 'New Jersey', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '34', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-NM', name: 'New Mexico', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '35', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-NY', name: 'New York', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '36', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-NC', name: 'North Carolina', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '37', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-ND', name: 'North Dakota', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '38', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-OH', name: 'Ohio', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '39', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-OK', name: 'Oklahoma', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '40', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-OR', name: 'Oregon', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '41', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-PA', name: 'Pennsylvania', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '42', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-RI', name: 'Rhode Island', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '44', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-SC', name: 'South Carolina', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '45', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-SD', name: 'South Dakota', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '46', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-TN', name: 'Tennessee', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '47', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-TX', name: 'Texas', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '48', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-UT', name: 'Utah', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '49', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-VT', name: 'Vermont', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '50', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-VA', name: 'Virginia', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '51', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-WA', name: 'Washington', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '53', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-WV', name: 'West Virginia', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '54', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-WI', name: 'Wisconsin', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '55', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-WY', name: 'Wyoming', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '56', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'US-DC', name: 'District of Columbia', priority: 3, region_type: 'north_america', country_code: 'US', state_id: '11', maxPerRegion: MAX_PER_US_CA_REGION },
  // Canadian provinces (state_id is 2-letter province code)
  { code: 'CA-AB', name: 'Alberta', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'AB', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-BC', name: 'British Columbia', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'BC', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-MB', name: 'Manitoba', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'MB', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-NB', name: 'New Brunswick', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'NB', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-NL', name: 'Newfoundland and Labrador', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'NL', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-NS', name: 'Nova Scotia', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'NS', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-NT', name: 'Northwest Territories', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'NT', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-NU', name: 'Nunavut', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'NU', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-ON', name: 'Ontario', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'ON', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-PE', name: 'Prince Edward Island', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'PE', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-QC', name: 'Quebec', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'QC', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-SK', name: 'Saskatchewan', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'SK', maxPerRegion: MAX_PER_US_CA_REGION },
  { code: 'CA-YT', name: 'Yukon', priority: 3, region_type: 'north_america', country_code: 'CA', state_id: 'YT', maxPerRegion: MAX_PER_US_CA_REGION },
];

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

function parseStatus(row: string): string {
  if (row.includes('\uD83D\uDFE2') || row.includes('🟢')) return 'on-air';
  if (row.includes('\uD83D\uDD34') || row.includes('🔴')) return 'off-air';
  if (row.includes('\uD83D\uDFE1') || row.includes('🟡')) return 'testing';
  return 'unknown';
}

// ─── List page parser ───

export function parseRepeaterList(html: string, countryCode: string, countryName: string, options?: { hasCountyColumn?: boolean, stateId?: string, regionType?: string, entryCode?: string }): any[] {
  const hasCountyColumn = options?.hasCountyColumn || false;
  const stateId = options?.stateId || countryCode;
  const regionType = options?.regionType || 'world';
  const entryCode = options?.entryCode || countryCode;
  const repeaters: any[] = [];
  const rows = html.split(/<tr[\s>]/);
  for (const row of rows) {
    const idMatch = row.match(/data-rpt-id="(\d+)"/);
    if (!idMatch) continue;
    const sourceId = idMatch[1];

    const freqMatch = row.match(/<a[^>]*>\s*([\d.]+)\s*<\/a>/);
    if (!freqMatch) continue;
    const frequency = parseFloat(freqMatch[1]);

    const offsetMatch = row.match(/<span class="text-muted">\s*([+\-])\s*<\/span>/);
    const offsetSign = offsetMatch ? offsetMatch[1] : '-';

    const modes: string[] = [];
    const badgeRegex = /<span class="badge[^"]*mode-badge">\s*([^<]+?)\s*<\/span>/g;
    let badgeMatch;
    while ((badgeMatch = badgeRegex.exec(row)) !== null) {
      const mode = badgeMatch[1].trim();
      if (mode) modes.push(mode);
    }

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

    // US/Canada format has an extra "County" column — callsign is at index 5 instead of 4
    const callsignIdx = hasCountyColumn ? 5 : 4;
    const tone = cells[2] || '';
    const locationName = cells[3] || '';
    const callsign = cells[callsignIdx] || '';

    if (!callsign || !frequency) continue;

    const modesIdx = hasCountyColumn ? 7 : 5;
    const finalModes = modes.length > 0 ? modes : parseModes(cells[modesIdx] || '');
    const primaryMode = getPrimaryMode(finalModes);
    const band = getBand(frequency);
    const offsetMag = band === '2m' ? 0.6 : band === '70cm' ? 7.6 : band === '6m' ? 1.0 : band === '10m' ? 0.5 : 0;

    // Build detail URL based on region type
    const detailUrl = regionType === 'north_america'
      ? `${NA_DETAIL_BASE}?state_id=${stateId}&country_code=${countryCode}&ID=${sourceId}`
      : `${DETAIL_BASE}?state_id=${countryCode}&ID=${sourceId}`;

    repeaters.push({
      sourceId,
      detailUrl,
      _entryCode: entryCode,
      frequency,
      offsetSign,
      offset_mhz: offsetSign === '+' ? offsetMag : -offsetMag,
      tone,
      modes: finalModes,
      primary_mode: primaryMode,
      location_name: locationName,
      callsign,
      country: countryName,
      country_code: countryCode,
      band,
      status: parseStatus(row),
      lat: null as number | null,
      lng: null as number | null,
      web_url: null as string | null,
      echolink_node: null as string | null,
      fm_funknetz: false,
    });
  }
  return repeaters;
}

// ─── Detail page parser ───

export function parseRepeaterDetail(html: string): { lat: number | null; lng: number | null; web_url: string | null; echolink_node: string | null; network_links: string; has_emergency_power: boolean; power_source: string } {
  let lat: number | null = null;
  let lng: number | null = null;
  let web_url: string | null = null;
  let echolink_node: string | null = null;
  let network_links = '';
  let has_emergency_power = false;
  let power_source = 'unknown';

  const gmMatch = html.match(/google\.com\/maps\/search\/[^"]*query=([\d.-]+)(?:%2C|,)([\d.-]+)/);
  if (gmMatch) {
    lat = parseFloat(gmMatch[1]);
    lng = parseFloat(gmMatch[2]);
  }
  if (lat === null) {
    const nrMatch = html.match(/prox2_result\.php\?lat=([\d.-]+)&long=([\d.-]+)/);
    if (nrMatch) {
      lat = parseFloat(nrMatch[1]);
      lng = parseFloat(nrMatch[2]);
    }
  }

  const webMatch = html.match(/Web links<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  if (webMatch) {
    const linkMatch = webMatch[1].match(/href=['"](https?:\/\/[^'"]+)['"]/);
    if (linkMatch) web_url = linkMatch[1];
  }

  // EchoLink node number — try multiple patterns
  const elMatch = html.match(/EchoLink[^]*?Node\s*(?:Number|#)?\s*[:>]?\s*(\d{3,7})/i)
    || html.match(/Node Number[\s\S]*?(\d{4,7})\s/)
    || html.match(/EL-\s*(\d{3,7})/);
  if (elMatch) echolink_node = elMatch[1];

  // Extract actual crosslink data from the "Crosslinked to / with" textarea
  const crossMatch = html.match(/network_links[^>]*>([\s\S]*?)<\/textarea>/);
  if (crossMatch) {
    network_links = crossMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  // Extract "Notes" field — contains "Connected via NF link with X (loc) and Y (loc) in city"
  const notesMatch = html.match(/<th[^>]*>\s*Notes\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (notesMatch) {
    const notesText = notesMatch[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
    if (notesText) {
      // Append notes to network_links so parseLinkedCallsigns can extract callsigns from it
      network_links = network_links ? `${network_links}\n${notesText}` : notesText;
    }
  }

  // Parse power / backup power info from detail page
  // RepeaterBook shows "Backup Power" and "Solar Power" as features
  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes('solar') || lowerHtml.includes('photovoltaic')) {
    has_emergency_power = true;
    power_source = 'solar';
  }
  if (lowerHtml.includes('backup power') || lowerHtml.includes('battery') || lowerHtml.includes('ups') || lowerHtml.includes('emergency power') || lowerHtml.includes('notstrom')) {
    has_emergency_power = true;
    if (power_source === 'unknown') power_source = 'notstrom';
  }
  if (lowerHtml.includes('ac power only') || lowerHtml.includes('grid only') || lowerHtml.includes('netzstrom')) {
    if (power_source === 'unknown') power_source = 'netz';
  }

  return { lat, lng, web_url, echolink_node, network_links, has_emergency_power, power_source };
}

// Parse the free-text network_links field into a list of linked repeater identifiers.
// Owners enter callsigns, sometimes with frequencies. We extract callsign-like tokens.
export function parseLinkedCallsigns(networkLinks: string, ownCallsign?: string): string[] {
  if (!networkLinks) return [];
  // Match amateur radio callsign patterns with optional -R/-L/-D/-P/-M suffix or /NN SSID
  // e.g. DB0XYZ, HB9ABC-R, HB9GL-L, OE3XAA/2
  const callsignRegex = /\b([A-Z]{1,2}\d[A-Z0-9]{1,4}(?:[-/][A-Z0-9]+)?)\b/g;
  const matches: string[] = [];
  let m;
  const ownBase = ownCallsign ? ownCallsign.replace(/[-/].*$/, '').toUpperCase() : null;
  while ((m = callsignRegex.exec(networkLinks.toUpperCase())) !== null) {
    const call = m[1];
    // Skip own callsign (the source repeater itself)
    if (ownBase && call.replace(/[-/].*$/, '') === ownBase) continue;
    // Skip common false positives (2-letter region codes like "NF" in "NF link")
    if (call.length < 4) continue;
    if (!matches.includes(call)) matches.push(call);
  }
  return matches;
}

// ─── UK Repeater source (ukrepeater.net / RSGB ETCC) ───
// Fetches UK repeater list pages by band. Each band page contains a full HTML table
// with callsign, frequency, mode, location, and coordinates — no per-repeater detail
// fetches needed, so this is much faster than RepeaterBook's per-repeater scraping.

const UK_BANDS = [
  { band: '10M', url: 'https://ukrepeater.net/listband22.html?bands=10M' },
  { band: '6M', url: 'https://ukrepeater.net/listband22.html?bands=6M' },
  { band: '4M', url: 'https://ukrepeater.net/listband22.html?bands=4M' },
  { band: '2M', url: 'https://ukrepeater.net/listband22.html?bands=2-M' },
  { band: '70CM', url: 'https://ukrepeater.net/listband22.html?bands=70CM' },
  { band: '70CM-RBW', url: 'https://ukrepeater.net/listband22.html?bands=70CM&channels=RBW' },
  { band: '70CM-RU', url: 'https://ukrepeater.net/listband22.html?bands=70CM&channels=RU' },
  { band: '70-DVU', url: 'https://ukrepeater.net/listband22.html?bands=70-DVU' },
];

// UK repeater data is embedded in JavaScript L.marker() calls for a Leaflet map.
// Each marker has coordinates in L.marker([lat, lng]) and popup content with all
// repeater details: callsign, frequency, mode, CTCSS, location, Maidenhead locator, status.
export function parseUkRepeaterList(html: string): any[] {
  const repeaters: any[] = [];
  // Match: L.marker([lat, lng],{icon: ...}).addTo(map) .bindPopup('...')
  const markerRegex = /L\.marker\(\[([\d.-]+),\s*([\d.-]+)\][^)]*\)[^;]*\.bindPopup\('([^']*)'\)/g;
  let match;
  while ((match = markerRegex.exec(html)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    const popup = match[3];

    // Extract callsign from <b>CALLSIGN</b>
    const callMatch = popup.match(/<b>([^<]+)<\/b>/);
    if (!callMatch) continue;
    const callsign = callMatch[1].trim();
    if (!callsign.match(/^GB3|^GB7|^MB6|^MR|^G[0-9]/i)) continue;

    // Extract TX frequency (output): TX:145.6625MHz
    const txMatch = popup.match(/TX:([\d.]+)\s*MHz/i);
    if (!txMatch) continue;
    const frequency = parseFloat(txMatch[1]);
    if (!frequency || isNaN(frequency)) continue;

    // Extract RX frequency (input) for offset calculation: RX:145.0625MHz
    const rxMatch = popup.match(/RX:([\d.]+)\s*MHz/i);
    const rxFreq = rxMatch ? parseFloat(rxMatch[1]) : null;
    const offset_mhz = rxFreq != null ? rxFreq - frequency : 0;

    // Extract mode from "Type/s: AnalogueVoice" or "Type/s: DMR|DSTAR"
    const typeMatch = popup.match(/Type\/s:\s*([^<\n]+)/i);
    const typeStr = (typeMatch ? typeMatch[1] : '').toUpperCase();
    const modes: string[] = [];
    if (typeStr.includes('DMR')) modes.push('DMR');
    if (typeStr.includes('D-STAR') || typeStr.includes('DSTAR')) modes.push('D-STAR');
    if (typeStr.includes('FUSION') || typeStr.includes('YSF') || typeStr.includes('C4FM')) modes.push('Fusion');
    if (typeStr.includes('ANALOG') || typeStr.includes('VOICE') || typeStr.includes('FM') || modes.length === 0) modes.push('FM');

    // Extract CTCSS tone
    const ctcssMatch = popup.match(/CTCSS:\s*([\d.]+)/i);
    const tone = ctcssMatch ? ctcssMatch[1] : '';

    // Extract location name + Maidenhead locator from "LOCATION [IO81]"
    const locMatch = popup.match(/([A-Z][A-Z\s]+?)\s*\[([A-R]{2}[0-9]{2}[A-X]{2}?)\]/i);
    const locationName = locMatch ? locMatch[1].trim() : '';
    const locator = locMatch ? locMatch[2].toUpperCase() : '';

    // Extract status: OPERATIONAL / NOT OPERATIONAL
    const status = popup.toUpperCase().includes('NOT OPERATIONAL') ? 'off-air' : 'on-air';

    const band = getBand(frequency);

    repeaters.push({
      sourceId: 'uk-' + callsign,
      detailUrl: null,
      _entryCode: 'GB',
      frequency,
      offsetSign: offset_mhz >= 0 ? '+' : '-',
      offset_mhz,
      tone,
      modes,
      primary_mode: getPrimaryMode(modes),
      location_name: locationName || locator,
      callsign,
      country: 'United Kingdom',
      country_code: 'GB',
      band,
      status,
      lat,
      lng,
      web_url: null,
      echolink_node: null,
      fm_funknetz: false,
    });
  }
  return repeaters;
}

// Convert Maidenhead grid locator to lat/lng (approximate — 6-char precision ~5km)
function maidenheadToLatLng(locator: string): [number, number] | null {
  const loc = locator.toUpperCase();
  if (loc.length < 4) return null;
  const A = 'A'.charCodeAt(0);
  const lonField = (loc.charCodeAt(0) - A) * 20;
  const latField = (loc.charCodeAt(1) - A) * 10;
  const lonSquare = parseInt(loc[2]) * 2;
  const latSquare = parseInt(loc[3]);
  let lonSub = 0, latSub = 0;
  if (loc.length >= 6) {
    lonSub = (loc.charCodeAt(4) - A) * (2 / 24);
    latSub = (loc.charCodeAt(5) - A) * (1 / 24);
  }
  const lng = -180 + lonField + lonSquare + lonSub;
  const lat = -90 + latField + latSquare + latSub;
  return [lat, lng];
}

export async function fetchUkRepeaterData(): Promise<any[]> {
  const allRepeaters: any[] = [];
  const results = await Promise.all(UK_BANDS.map(async (bandInfo) => {
    try {
      const resp = await fetchWithTimeout(bandInfo.url, {
        headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
      });
      if (!resp || !resp.ok) return [];
      const html = await resp.text();
      return parseUkRepeaterList(html);
    } catch {
      return [];
    }
  }));
  for (const reps of results) {
    allRepeaters.push(...reps);
  }
  // Deduplicate by callsign+frequency (bands may overlap)
  const seen = new Set<string>();
  return allRepeaters.filter(r => {
    const key = r.callsign + '_' + r.frequency;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main fetch function ───

export async function fetchRepeaterData(): Promise<any[]> {
  const countryPriority = new Map(COUNTRIES.map(c => [c.code, c.priority]));

  // 0. Fetch UK repeaters from ukrepeater.net (fast — 5 band pages, no detail fetches)
  let ukRepeaters: any[] = [];
  try {
    ukRepeaters = await fetchUkRepeaterData();
  } catch {
    // UK source is optional — don't fail the whole import
  }

  // 1. Fetch list pages — ALL COUNTRIES (Priority 1+2+3).
  // Priority 1: Switzerland + neighbors (full detail fetch)
  // Priority 2: Rest of Europe (reduced detail fetch)
  // Priority 3: Asia, Africa, Americas, Oceania (minimal detail fetch)
  // This gives worldwide coverage across all continents.
  const allRepeaters: any[] = [];
  for (let i = 0; i < COUNTRIES.length; i += LIST_CONCURRENCY) {
    const chunk = COUNTRIES.slice(i, i + LIST_CONCURRENCY);
    const results = await Promise.all(chunk.map(async (country) => {
      try {
        const isNA = country.region_type === 'north_america';
        const stateId = country.state_id || country.code;
        const cc = country.country_code || country.code;
        const url = isNA
          ? `${NA_LIST_BASE}?state_id=${stateId}&country_code=${cc}&${LIST_PARAMS}`
          : `${LIST_BASE}?state_id=${country.code}&${LIST_PARAMS}`;
        const resp = await fetchWithTimeout(url, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
        });
        if (!resp || !resp.ok) return [];
        const html = await resp.text();
        return parseRepeaterList(html, cc, country.name, {
          hasCountyColumn: isNA,
          stateId,
          regionType: isNA ? 'north_america' : 'world',
          entryCode: country.code,
        });
      } catch {
        return [];
      }
    }));
    for (const reps of results) {
      allRepeaters.push(...reps);
    }
  }

  // 1b. Merge UK repeaters from ukrepeater.net (already have coordinates from Maidenhead locator)
  // Remove any UK repeaters from RepeaterBook that are already in the UK source (dedup by callsign+freq)
  if (ukRepeaters.length > 0) {
    const ukKeys = new Set(ukRepeaters.map(r => r.callsign + '_' + r.frequency));
    for (let i = allRepeaters.length - 1; i >= 0; i--) {
      if (allRepeaters[i].country_code === 'GB' && ukKeys.has(allRepeaters[i].callsign + '_' + allRepeaters[i].frequency)) {
        allRepeaters.splice(i, 1);
      }
    }
    allRepeaters.push(...ukRepeaters);
  }

  // 1c. Merge additional sources: WIA Australia (CSV) + dstarusers.org (D-STAR worldwide)
  // These sources add coverage for countries not well covered by RepeaterBook (Australia, D-STAR worldwide)
  let additionalRepeaters: any[] = [];
  try {
    const additional = await fetchAdditionalRepeaterSources();
    // WIA Australia — dedup against RepeaterBook by callsign+freq
    if (additional.wia.length > 0) {
      const rbKeys = new Set(allRepeaters.map(r => r.callsign + '_' + r.frequency));
      const wiaNew = additional.wia.filter(r => !rbKeys.has(r.callsign + '_' + r.frequency));
      additionalRepeaters.push(...wiaNew);
    }
    // dstarusers.org — dedup against RepeaterBook by callsign+freq
    if (additional.dstar.length > 0) {
      const rbKeys = new Set(allRepeaters.map(r => r.callsign + '_' + r.frequency));
      const dstarNew = additional.dstar.filter(r => !rbKeys.has(r.callsign + '_' + r.frequency));
      additionalRepeaters.push(...dstarNew);
    }
  } catch {
    // Additional sources are optional — don't fail the whole import
  }
  if (additionalRepeaters.length > 0) {
    allRepeaters.push(...additionalRepeaters);
  }

  // 2. Sort by country priority (priority 1 first), then on-air first
  allRepeaters.sort((a, b) => {
    const pa = countryPriority.get(a.country_code) || 99;
    const pb = countryPriority.get(b.country_code) || 99;
    if (pa !== pb) return pa - pb;
    if (a.status === 'on-air' && b.status !== 'on-air') return -1;
    if (a.status !== 'on-air' && b.status === 'on-air') return 1;
    return 0;
  });

  // 3. Select repeaters for detail page fetching — per-country quota ensures worldwide coverage.
  // Each country gets up to MAX_PER_COUNTRY detail fetches (on-air first), so no single
  // country can starve others. Total capped at MAX_DETAIL_FETCH.
  // Build a lookup of country code → maxPerRegion (for US/CA states)
  const maxPerRegionMap = new Map<string, number>();
  for (const c of COUNTRIES) {
    if (c.maxPerRegion) maxPerRegionMap.set(c.code, c.maxPerRegion);
  }

  const byCountry = new Map<string, any[]>();
  for (const rep of allRepeaters) {
    const entryCode = rep._entryCode || rep.country_code;
    if (!byCountry.has(entryCode)) byCountry.set(entryCode, []);
    byCountry.get(entryCode)!.push(rep);
  }
  const toFetch: any[] = [];
  for (const [entryCode, reps] of byCountry) {
    reps.sort((a, b) => {
      if (a.status === 'on-air' && b.status !== 'on-air') return -1;
      if (a.status !== 'on-air' && b.status === 'on-air') return 1;
      return 0;
    });
    // Per-priority detail fetch quota — ensures worldwide coverage within time budget.
    // Priority 1 (CH+neighbors): 500 detail fetches (full coordinates)
    // Priority 2 (rest of Europe): 30 detail fetches (key repeaters only)
    // Priority 3 (Asia/Africa/Americas/Oceania): 15 detail fetches (major repeaters)
    const country = COUNTRIES.find(c => c.code === entryCode);
    const priority = country?.priority || 3;
    let defaultMax: number;
    if (maxPerRegionMap.has(entryCode)) {
      defaultMax = maxPerRegionMap.get(entryCode)!;
    } else if (priority === 1) {
      defaultMax = MAX_PER_COUNTRY_PRIORITY_1;
    } else if (priority === 2) {
      defaultMax = MAX_PER_COUNTRY_PRIORITY_2;
    } else {
      defaultMax = MAX_PER_COUNTRY_PRIORITY_3;
    }
    toFetch.push(...reps.slice(0, defaultMax));
  }
  // Sort final list by country priority for consistent processing
  toFetch.sort((a, b) => {
    const pa = countryPriority.get(a.country_code) || 99;
    const pb = countryPriority.get(b.country_code) || 99;
    return pa - pb;
  });
  // Hard cap
  toFetch.splice(MAX_DETAIL_FETCH);

  // 4. Fetch detail pages (concurrency 40) — with a hard time deadline
  const detailStartTime = Date.now();
  for (let i = 0; i < toFetch.length; i += DETAIL_CONCURRENCY) {
    // Stop if we've exceeded the detail fetch time budget
    if (Date.now() - detailStartTime > DETAIL_DEADLINE_MS) break;
    const chunk = toFetch.slice(i, i + DETAIL_CONCURRENCY);
    await Promise.all(chunk.map(async (rep) => {
      try {
        const resp = await fetchWithTimeout(rep.detailUrl, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
        });
        if (!resp || !resp.ok) return;
        const html = await resp.text();
        const detail = parseRepeaterDetail(html);
        if (detail.lat !== null) rep.lat = detail.lat;
        if (detail.lng !== null) rep.lng = detail.lng;
        if (detail.web_url) rep.web_url = detail.web_url;
        if (detail.echolink_node) rep.echolink_node = detail.echolink_node;
        if (detail.network_links) rep.network_links = detail.network_links;
        if (detail.has_emergency_power) {
          rep.has_emergency_power = detail.has_emergency_power;
          rep.power_source = detail.power_source;
        }
      } catch {
        // skip failed detail pages
      }
    }));
  }

  // 5. Build linking ONLY from actual crosslink data (network_links field).
  // Same callsign on different bands does NOT mean linked — many repeaters
  // share a callsign but operate independently. Only the "Crosslinked to / with"
  // field on RepeaterBook indicates an actual cross-band link.
  // Build a lookup of callsign → repeaters (with coords) for resolving link targets.
  const byCallsign = new Map<string, any[]>();
  for (const rep of allRepeaters) {
    if (rep.lat === null || rep.lng === null) continue;
    if (!byCallsign.has(rep.callsign)) byCallsign.set(rep.callsign, []);
    byCallsign.get(rep.callsign)!.push(rep);
  }

  for (const rep of allRepeaters) {
    const linkedCallsigns = parseLinkedCallsigns(rep.network_links || '');
    // Resolve linked callsigns to actual repeaters in our dataset (with coords).
    // Only show links to repeaters we actually have on the map.
    const resolved = [];
    for (const linkedCall of linkedCallsigns) {
      // Match by base callsign (strip suffixes like /P, /M)
      const baseCall = linkedCall.split('/')[0];
      const targets = byCallsign.get(baseCall) || [];
      for (const target of targets) {
        if (target.callsign === rep.callsign && target.frequency === rep.frequency) continue;
        resolved.push(`${target.callsign} ${target.frequency.toFixed(4)} MHz (${target.band})`);
      }
    }
    // Deduplicate
    rep.linked_callsigns = [...new Set(resolved)];
  }

  return allRepeaters;
}

// ─── Private Nodes / Hotspots ───
// Scrape RepeaterBook's "Nodes" section for AllStar, EchoLink, and private nodes.
// These are standalone nodes (not repeaters) that provide access to networks.

const NODE_LIST_BASE = 'https://www.repeaterbook.com/row_repeaters/Display_SS.php';

export async function fetchPrivateNodeData(): Promise<any[]> {
  const nodes: any[] = [];
  // RepeaterBook doesn't have a dedicated "private nodes" page, but AllStar/EchoLink
  // nodes appear in the repeater list with type "Node". We filter for those.
  // Also check for AllStar nodes via the AllStar Network API.
  for (let i = 0; i < COUNTRIES.length; i += LIST_CONCURRENCY) {
    const chunk = COUNTRIES.slice(i, i + LIST_CONCURRENCY);
    const results = await Promise.all(chunk.map(async (country) => {
      try {
        const isNA = country.region_type === 'north_america';
        const stateId = country.state_id || country.code;
        const cc = country.country_code || country.code;
        const listBase = isNA ? NA_LIST_BASE : NODE_LIST_BASE;
        const detailBase = isNA ? NA_DETAIL_BASE : DETAIL_BASE;
        const url = isNA
          ? `${listBase}?state_id=${stateId}&country_code=${cc}&${LIST_PARAMS}&system=Node`
          : `${listBase}?state_id=${country.code}&${LIST_PARAMS}&system=Node`;
        const resp = await fetchWithTimeout(url, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
        });
        if (!resp || !resp.ok) return [];
        const html = await resp.text();
        // Parse nodes from the table — same structure as repeaters but with node type
        const rows = html.split(/<tr[\s>]/);
        const countryNodes: any[] = [];
        for (const row of rows) {
          const idMatch = row.match(/data-rpt-id="(\d+)"/);
          if (!idMatch) continue;
          const cells: string[] = [];
          const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
          let tdMatch;
          while ((tdMatch = tdRegex.exec(row)) !== null) {
            const content = tdMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
            cells.push(content);
          }
          const callsignIdx = isNA ? 5 : 4;
          const callsign = cells[callsignIdx] || '';
          if (!callsign) continue;
          const freqMatch = row.match(/<a[^>]*>\s*([\d.]+)\s*<\/a>/);
          const frequency = freqMatch ? parseFloat(freqMatch[1]) : null;
          const locationName = cells[3] || '';

          // Try to get coords from detail page link
          const detailId = idMatch[1];
          const detailUrl = isNA
            ? `${detailBase}?state_id=${stateId}&country_code=${cc}&ID=${detailId}`
            : `${detailBase}?state_id=${country.code}&ID=${detailId}`;

          countryNodes.push({
            callsign,
            node_type: 'allstar_node',
            frequency: frequency || 0,
            mode: 'AllStar',
            network: 'AllStar Link',
            node_number: detailId,
            location_name: locationName,
            country: country.name,
            country_code: cc,
            lat: null as number | null,
            lng: null as number | null,
            detailUrl,
            source: 'RepeaterBook',
          });
        }
        return countryNodes;
      } catch {
        return [];
      }
    }));
    for (const cn of results) nodes.push(...cn);
  }

  // Fetch detail pages for coordinates (limited to first 500 for performance)
  const toFetch = nodes.slice(0, 500);
  for (let i = 0; i < toFetch.length; i += DETAIL_CONCURRENCY) {
    const chunk = toFetch.slice(i, i + DETAIL_CONCURRENCY);
    await Promise.all(chunk.map(async (node) => {
      try {
        const resp = await fetchWithTimeout(node.detailUrl, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
        });
        if (!resp || !resp.ok) return;
        const html = await resp.text();
        const detail = parseRepeaterDetail(html);
        if (detail.lat !== null) node.lat = detail.lat;
        if (detail.lng !== null) node.lng = detail.lng;
        if (detail.echolink_node) {
          node.node_number = detail.echolink_node;
          node.network = 'EchoLink';
          node.node_type = 'echolink_node';
          node.mode = 'EchoLink';
        }
      } catch {}
    }));
  }

  // Only return nodes with coordinates
  return nodes.filter(n => n.lat !== null && n.lng !== null);
}