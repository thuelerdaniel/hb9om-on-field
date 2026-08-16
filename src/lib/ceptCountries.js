// CEPT Laender-Praefixe fuer Amateurfunk-Betrieb im Ausland
// Basierend auf CEPT T/R 61-01 (Full License / HAREC) und ECC/REC/05(06) (Novice)
// Quelle: https://www.darc.de/der-club/referate/ausland/funken-im-ausland/cept-laenderliste/

export const CEPT_COUNTRIES = [
  // CEPT Voll-Lizenz (T/R 61-01)
  { name: "Albanien", code: "AL", prefix: "ZA/", flag: "🇦🇱", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Belgien", code: "BE", prefix: "ON/", flag: "🇧🇪", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Bosnien-Herzegowina", code: "BA", prefix: "E7/", flag: "🇧🇦", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Bulgarien", code: "BG", prefix: "LZ/", flag: "🇧🇬", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Dänemark", code: "DK", prefix: "OZ/", flag: "🇩🇰", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Deutschland", code: "DE", prefix: "DL/", flag: "🇩🇪", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Estland", code: "EE", prefix: "ES/", flag: "🇪🇪", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Finnland", code: "FI", prefix: "OH/", flag: "🇫🇮", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Frankreich", code: "FR", prefix: "F/", flag: "🇫🇷", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Georgien", code: "GE", prefix: "", flag: "🇬🇪", cept_full: false, cept_novice: false, non_cept: false, notes: "Kein HAREC-Abkommen" },
  { name: "Griechenland", code: "GR", prefix: "SV/", flag: "🇬🇷", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Grossbritannien (UK)", code: "GB", prefix: "M/", flag: "🇬🇧", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Irland", code: "IE", prefix: "EI/", flag: "🇮🇪", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Island", code: "IS", prefix: "TF/", flag: "🇮🇸", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Italien", code: "IT", prefix: "I/", flag: "🇮🇹", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Kroatien", code: "HR", prefix: "9A/", flag: "🇭🇷", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Lettland", code: "LV", prefix: "YL/", flag: "🇱🇻", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Liechtenstein", code: "LI", prefix: "HB0/", flag: "🇱🇮", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Litauen", code: "LT", prefix: "LY/", flag: "🇱🇹", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Luxemburg", code: "LU", prefix: "LX/", flag: "🇱🇺", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Malta", code: "MT", prefix: "9H/", flag: "🇲🇹", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Moldau", code: "MD", prefix: "ER/", flag: "🇲🇩", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Montenegro", code: "ME", prefix: "4O/", flag: "🇲🇪", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Niederlande", code: "NL", prefix: "PA/", flag: "🇳🇱", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Nordmazedonien", code: "MK", prefix: "Z3/", flag: "🇲🇰", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Norwegen", code: "NO", prefix: "LA/", flag: "🇳🇴", cept_full: true, cept_novice: false, non_cept: false, notes: "Anerkannt, kein Novice" },
  { name: "Österreich", code: "AT", prefix: "OE/", flag: "🇦🇹", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Polen", code: "PL", prefix: "SP/", flag: "🇵🇱", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Portugal", code: "PT", prefix: "CT/", flag: "🇵🇹", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Rumänien", code: "RO", prefix: "YO/", flag: "🇷🇴", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Russland", code: "RU", prefix: "UA/", flag: "🇷🇺", cept_full: true, cept_novice: true, non_cept: false },
  { name: "San Marino", code: "SM", prefix: "T7/", flag: "🇸🇲", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Schweden", code: "SE", prefix: "SM/", flag: "🇸🇪", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Schweiz", code: "CH", prefix: "HB9/", flag: "🇨🇭", cept_full: true, cept_novice: true, non_cept: false, is_home: true },
  { name: "Serbien", code: "RS", prefix: "YU/", flag: "🇷🇸", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Slowakei", code: "SK", prefix: "OM/", flag: "🇸🇰", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Slowenien", code: "SI", prefix: "S5/", flag: "🇸🇮", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Spanien", code: "ES", prefix: "EA/", flag: "🇪🇸", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Türkei", code: "TR", prefix: "TA/", flag: "🇹🇷", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Tschechien", code: "CZ", prefix: "OK/", flag: "🇨🇿", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Ukraine", code: "UA", prefix: "UR/", flag: "🇺🇦", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Ungarn", code: "HU", prefix: "HA/", flag: "🇭🇺", cept_full: true, cept_novice: true, non_cept: false },
  { name: "Vatikan", code: "VA", prefix: "HV/", flag: "🇻🇦", cept_full: true, cept_novice: false, non_cept: false },
  { name: "Zypern", code: "CY", prefix: "5B/", flag: "🇨🇾", cept_full: true, cept_novice: false, non_cept: false },

  // Nicht-CEPT-Laender (Gastlizenz noetig)
  { name: "Australien", code: "AU", prefix: "VK/", flag: "🇦🇺", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Neuseeland", code: "NZ", prefix: "ZL/", flag: "🇳🇿", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Südafrika", code: "ZA", prefix: "ZS/", flag: "🇿🇦", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "USA", code: "US", prefix: "W/", flag: "🇺🇸", cept_full: false, cept_novice: false, non_cept: true, notes: "W/ oder K/ + Distrikt, Gastlizenz" },
  { name: "Kanada", code: "CA", prefix: "VE/", flag: "🇨🇦", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Japan", code: "JP", prefix: "JA/", flag: "🇯🇵", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Brasilien", code: "BR", prefix: "PY/", flag: "🇧🇷", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Argentinien", code: "AR", prefix: "LU/", flag: "🇦🇷", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Chile", code: "CL", prefix: "CE/", flag: "🇨🇱", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Marokko", code: "MA", prefix: "CN/", flag: "🇲🇦", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Israel", code: "IL", prefix: "4X/", flag: "🇮🇱", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Indien", code: "IN", prefix: "VU/", flag: "🇮🇳", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "China", code: "CN", prefix: "BY/", flag: "🇨🇳", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Südkorea", code: "KR", prefix: "HL/", flag: "🇰🇷", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Thailand", code: "TH", prefix: "HS/", flag: "🇹🇭", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
  { name: "Mexiko", code: "MX", prefix: "XE/", flag: "🇲🇽", cept_full: false, cept_novice: false, non_cept: true, notes: "Gastlizenz erforderlich" },
];

// Heimatland (Schweiz) — kein Praefix noetig
export const HOME_COUNTRY = CEPT_COUNTRIES.find(c => c.is_home);

// Filter fuer Novice-faehige Laender
export const NOVICE_COUNTRIES = CEPT_COUNTRIES.filter(c => c.cept_novice);

// Filter fuer CEPT Full-License Laender
export const FULL_COUNTRIES = CEPT_COUNTRIES.filter(c => c.cept_full);

// Filter fuer Nicht-CEPT-Laender
export const NON_CEPT_COUNTRIES = CEPT_COUNTRIES.filter(c => c.non_cept);

// CEPT-Dokumentations-Links
export const CEPT_LINKS = [
  { label: "CEPT T/R 61-01 (Full License)", url: "https://docdb.cept.org/download/4045" },
  { label: "CEPT ECC/REC/05(06) (Novice)", url: "https://docdb.cept.org/download/4413" },
  { label: "USKA CEPT-Info", url: "https://uska.ch/en/cept/" },
  { label: "DARC CEPT-Länderliste", url: "https://www.darc.de/der-club/referate/ausland/funken-im-ausland/cept-laenderliste/" },
  { label: "DARC Funken im Ausland", url: "https://www.darc.de/der-club/referate/ausland/funken-im-ausland/" },
  { label: "IARU Operating Abroad", url: "https://www.iaru-r1.org/reference/operating-abroad/" },
  { label: "ARRL CEPT", url: "https://www.arrl.org/cept" },
  { label: "RSGB International Prefixes", url: "https://rsgb.org/main/operating/licensing-novs-visitors/international-prefixes/" },
];