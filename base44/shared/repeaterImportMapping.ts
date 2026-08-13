// Shared mapping logic for JSON Repeater Import (RepeaterBook export format).
// Used by importRepeaterJson backend function.

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", BR: "Brazil", BY: "Belarus",
  CH: "Switzerland", DE: "Germany", FR: "France", IT: "Italy",
  UK: "United Kingdom", GB: "United Kingdom", AT: "Austria",
  ES: "Spain", PT: "Portugal", NL: "Netherlands", BE: "Belgium",
  LU: "Luxembourg", DK: "Denmark", SE: "Sweden", NO: "Norway",
  FI: "Finland", IS: "Iceland", IE: "Ireland", PL: "Poland",
  CZ: "Czech Republic", SK: "Slovakia", HU: "Hungary", RO: "Romania",
  BG: "Bulgaria", GR: "Greece", HR: "Croatia", SI: "Slovenia",
  RS: "Serbia", BA: "Bosnia and Herzegovina", MK: "North Macedonia",
  ME: "Montenegro", AL: "Albania", LT: "Lithuania", LV: "Latvia",
  EE: "Estonia", RU: "Russia", UA: "Ukraine", MD: "Moldova",
  TR: "Turkey", GE: "Georgia", AM: "Armenia", AZ: "Azerbaijan",
  JP: "Japan", KR: "South Korea", CN: "China", TW: "Taiwan",
  TH: "Thailand", MY: "Malaysia", SG: "Singapore", ID: "Indonesia",
  PH: "Philippines", VN: "Vietnam", IN: "India", PK: "Pakistan",
  BD: "Bangladesh", LK: "Sri Lanka", NP: "Nepal", IR: "Iran",
  IQ: "Iraq", SA: "Saudi Arabia", AE: "United Arab Emirates",
  IL: "Israel", JO: "Jordan", LB: "Lebanon", SY: "Syria",
  OM: "Oman", YE: "Yemen", KZ: "Kazakhstan", UZ: "Uzbekistan",
  AU: "Australia", NZ: "New Zealand", FJ: "Fiji", PG: "Papua New Guinea",
  ZA: "South Africa", EG: "Egypt", MA: "Morocco", DZ: "Algeria",
  TN: "Tunisia", LY: "Libya", SD: "Sudan", ET: "Ethiopia",
  KE: "Kenya", NG: "Nigeria", GH: "Ghana", AO: "Angola",
  MZ: "Mozambique", ZW: "Zimbabwe", BW: "Botswana", NA: "Namibia",
  MX: "Mexico", GT: "Guatemala", BZ: "Belize", HN: "Honduras",
  SV: "El Salvador", NI: "Nicaragua", CR: "Costa Rica", PA: "Panama",
  CU: "Cuba", JM: "Jamaica", HT: "Haiti", DO: "Dominican Republic",
  PR: "Puerto Rico", TT: "Trinidad and Tobago", BS: "Bahamas",
  CO: "Colombia", VE: "Venezuela", EC: "Ecuador", PE: "Peru",
  BO: "Bolivia", PY: "Paraguay", UY: "Uruguay", AR: "Argentina",
  CL: "Chile", BR: "Brazil",
};

export function getBandFromFreq(freqMHz: number): string {
  if (freqMHz >= 1.8 && freqMHz < 2.0) return "160m";
  if (freqMHz >= 3.5 && freqMHz < 4.0) return "80m";
  if (freqMHz >= 5.0 && freqMHz < 5.5) return "60m";
  if (freqMHz >= 7.0 && freqMHz < 7.3) return "40m";
  if (freqMHz >= 10.1 && freqMHz < 10.15) return "30m";
  if (freqMHz >= 14 && freqMHz < 14.35) return "20m";
  if (freqMHz >= 18 && freqMHz < 18.7) return "17m";
  if (freqMHz >= 21 && freqMHz < 21.45) return "15m";
  if (freqMHz >= 24 && freqMHz < 24.99) return "12m";
  if (freqMHz >= 28 && freqMHz < 29.7) return "10m";
  if (freqMHz >= 50 && freqMHz < 54) return "6m";
  if (freqMHz >= 70 && freqMHz < 71) return "4m";
  if (freqMHz >= 144 && freqMHz < 148) return "2m";
  if (freqMHz >= 216 && freqMHz < 225) return "1.25m";
  if (freqMHz >= 430 && freqMHz < 450) return "70cm";
  if (freqMHz >= 902 && freqMHz < 928) return "33cm";
  if (freqMHz >= 1240 && freqMHz < 1300) return "23cm";
  return "Other";
}

export function buildModesArray(r: any): string[] {
  const modes: string[] = [];
  if (String(r.dmr || "").toUpperCase() === "YES") modes.push("DMR");
  if (String(r.dstar_node || "").trim() !== "") modes.push("D-STAR");
  if (String(r.ysf || "").toUpperCase() === "YES") modes.push("Fusion");
  if (String(r.nxdn || "").toUpperCase() === "YES") modes.push("NXDN");
  if (String(r.p25 || "").toUpperCase() === "YES") modes.push("P25");
  if (String(r.tetra || "").toUpperCase() === "YES") modes.push("TETRA");
  if (String(r.m17 || "").toUpperCase() === "YES") modes.push("M17");
  if (String(r.atv || "").toUpperCase() === "YES") modes.push("ATV");
  if (modes.length === 0) modes.push("FM");
  return modes;
}

export function mapJsonRecord(r: any): any {
  const callsign = String(r.callsign || "").toUpperCase().trim() || "UNKNOWN";
  const frequency = parseFloat(String(r.freq_mhz || r.frequency || "0")) || 0;
  const offset_mhz = parseFloat(String(r.offset_mhz || "0")) || 0;

  let tone = String(r.tone || "").trim();
  if (tone.toUpperCase() === "CSQ") tone = "";

  // Coordinates — both must be present or both absent
  let lat: number | null = null;
  let lng: number | null = null;
  const latStr = String(r.lat || "").trim();
  const lonStr = String(r.lon || r.lng || "").trim();
  if (latStr !== "" && lonStr !== "") {
    const pLat = parseFloat(latStr);
    const pLng = parseFloat(lonStr);
    if (!isNaN(pLat) && !isNaN(pLng) &&
        pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180 &&
        !(pLat === 0 && pLng === 0)) {
      lat = pLat;
      lng = pLng;
    }
  }

  // Location: "City, ST" format
  const city = String(r.city || "").trim();
  const state = String(r.state || "").trim();
  let location_name = "";
  if (city && state) location_name = `${city}, ${state}`;
  else if (city) location_name = city;
  else if (state) location_name = state;

  // Country
  let country_code = String(r.country || "").trim().toUpperCase();
  if (country_code.length !== 2) country_code = "XX";
  if (country_code === "UK") country_code = "GB";
  const country = COUNTRY_NAMES[country_code] || country_code;

  // Modes
  const modes = buildModesArray(r);
  const primary_mode = modes[0] || "FM";

  // Band
  const band = getBandFromFreq(frequency);

  // Description from landmark
  const landmark = String(r.landmark || "").trim();
  const description = landmark || undefined;

  // EchoLink node
  const echolink_node = String(r.echolink_node || "").trim() || undefined;

  return {
    callsign,
    frequency,
    offset_mhz,
    tone,
    modes,
    primary_mode,
    location_name,
    country,
    country_code,
    lat,
    lng,
    band,
    status: "on-air",
    web_url: "",
    echolink_node,
    fm_funknetz: false,
    source_id: "json-import",
    coords_from_locator: false,
    coords_geocoded: false,
    description,
  };
}

// Dedup key — priority: callsign+freq, then city+freq, then lat+lon
export function getDedupKey(record: any): string {
  const freqRounded = Math.round((record.frequency || 0) * 1000) / 1000;
  const cs = String(record.callsign || "").toUpperCase().trim();
  if (cs && cs !== "UNKNOWN") {
    return `cf:${cs}|${freqRounded}`;
  }
  const loc = String(record.location_name || "").trim();
  if (loc) {
    return `lf:${loc}|${freqRounded}`;
  }
  if (record.lat != null && record.lng != null) {
    const latR = Math.round(record.lat * 10000) / 10000;
    const lngR = Math.round(record.lng * 10000) / 10000;
    return `ll:${latR}|${lngR}`;
  }
  return `f:${freqRounded}`;
}