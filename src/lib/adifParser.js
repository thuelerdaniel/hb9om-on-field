// ADIF Parser — parses ADIF 2.x/3.x file content into Log entity records.
// Validates each record, maps fields, derives missing data, and flags duplicates.

const BAND_ENUM = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "4m", "2m", "70cm", "23cm", "Other"];
const MODE_ENUM = ["SSB", "CW", "FM", "FT8", "FT4", "PSK", "RTTY", "AM", "Other"];

// Frequency (MHz) → band mapping
const FREQ_TO_BAND = [
  { min: 1.8, max: 2.0, band: "160m" },
  { min: 3.5, max: 3.6, band: "80m" },
  { min: 5.06, max: 5.45, band: "60m" },
  { min: 7.0, max: 7.3, band: "40m" },
  { min: 10.1, max: 10.15, band: "30m" },
  { min: 14.0, max: 14.35, band: "20m" },
  { min: 18.06, max: 18.17, band: "17m" },
  { min: 21.0, max: 21.45, band: "15m" },
  { min: 24.89, max: 24.99, band: "12m" },
  { min: 28.0, max: 29.7, band: "10m" },
  { min: 50.0, max: 54.0, band: "6m" },
  { min: 70.0, max: 70.5, band: "4m" },
  { min: 144.0, max: 148.0, band: "2m" },
  { min: 430.0, max: 440.0, band: "70cm" },
  { min: 1240.0, max: 1300.0, band: "23cm" },
];

function freqToBand(freq) {
  if (freq == null || isNaN(freq)) return null;
  for (const f of FREQ_TO_BAND) {
    if (freq >= f.min && freq <= f.max) return f.band;
  }
  return null;
}

// Extract suffix from callsign (e.g. "HB9OM/P" → callsign="HB9OM", suffix="/P")
function extractSuffix(call) {
  if (!call) return { callsign: "", suffix: "" };
  const match = String(call).toUpperCase().match(/^(.+?)\/(P|M|AM|MM)$/);
  if (match) return { callsign: match[1], suffix: "/" + match[2] };
  return { callsign: String(call).toUpperCase().trim(), suffix: "" };
}

// Detect reference type from reference code
function detectRefType(ref) {
  if (!ref) return "custom";
  const r = ref.toUpperCase();
  if (/^[A-Z]{2}\/[A-Z]{2}-\d+/.test(r)) return "sota";
  if (/^[A-Z]{2,4}FF-\d+/.test(r)) return "hbff";
  if (/^[A-Z]{2,4}BOTA-\d+/.test(r)) return "wwbota";
  if (/^[A-Z]{2}-\d+/.test(r)) return "pota";
  if (/^(G|D|F|I|HB|OK|OE|SP|SM|EA|CT|PA|ON|DL|F|I)[A-Z]{0,2}-\d+/.test(r)) return "pota";
  return "custom";
}

// Parse ADIF date YYYYMMDD → YYYY-MM-DD
function parseAdifDate(d) {
  if (!d) return null;
  d = String(d).trim();
  if (d.length !== 8 || !/^\d{8}$/.test(d)) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

// Parse ADIF time HHMM or HHMMSS → HH:MM
function parseAdifTime(t) {
  if (!t) return null;
  t = String(t).trim();
  if (t.length >= 4 && /^\d{4,6}$/.test(t)) {
    return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
  }
  return null;
}

// Common mode mappings (ADIF files often use sub-modes)
const MODE_MAP = {
  USB: "SSB", LSB: "SSB",
  CWR: "CW", PCW: "CW",
  PSK31: "PSK", PSK63: "PSK", PSK125: "PSK", BPSK: "PSK", QPSK: "PSK",
  MFSK: "FT8", JT65: "FT8", JT9: "FT8", JS8: "FT8", FST4: "FT8",
  OLIVIA: "PSK", CONTESTI: "SSB",
  PACKET: "Other", HELL: "Other", ATV: "Other", SSTV: "Other", AMTOR: "Other", PACTOR: "Other",
  DSTAR: "FM", C4FM: "FM", DMR: "FM", FUSION: "FM",
};

// Parse the entire ADIF file content into an array of raw field maps.
export function parseAdifContent(content) {
  const records = [];
  const eohMatch = content.match(/<eoh>/i);
  const body = eohMatch ? content.slice(eohMatch.index + 5) : content;

  // Split into records by <eor>
  const rawRecords = body.split(/<eor>/i);

  for (const raw of rawRecords) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const fields = {};
    // Match <fieldname:length>value or <fieldname:length:type>value
    const regex = /<([a-z0-9_]+):(\d+)(?::[a-z])?>([^<]*)/gi;
    let match;
    while ((match = regex.exec(trimmed)) !== null) {
      const fieldName = match[1].toLowerCase();
      const length = parseInt(match[2], 10);
      let value = match[3] || "";
      if (length > 0 && value.length > length) value = value.slice(0, length);
      fields[fieldName] = value.trim();
    }

    if (Object.keys(fields).length > 0) {
      records.push(fields);
    }
  }

  return records;
}

// Map a raw ADIF record to a Log entity object.
// Returns { record, issues, isValid, missingFields }
export function mapAdifRecord(raw) {
  const issues = [];
  const missingFields = [];

  // Callsign + suffix
  const { callsign, suffix } = extractSuffix(raw.call);

  // Date
  const qsoDate = parseAdifDate(raw.qso_date);
  if (raw.qso_date && !qsoDate) issues.push(`Ungültiges Datumsformat: '${raw.qso_date}'`);

  // Time
  const timeStart = parseAdifTime(raw.time_on) || "";
  const timeEnd = parseAdifTime(raw.time_off) || "";

  // Frequency
  const frequency = raw.freq ? parseFloat(raw.freq) : null;
  if (raw.freq && (frequency == null || isNaN(frequency))) {
    issues.push(`Ungültige Frequenz: '${raw.freq}'`);
  }

  // Band — from ADIF or derived from frequency
  let band = raw.band ? raw.band.toLowerCase().trim() : null;
  if (!band && frequency != null) {
    band = freqToBand(frequency);
    if (band) issues.push(`Band aus Frequenz abgeleitet: ${band}`);
  }
  if (band && !BAND_ENUM.includes(band)) {
    issues.push(`Band '${band}' nicht im Enum → 'Other'`);
    band = "Other";
  }
  if (!band) {
    band = "Other";
  }

  // Mode
  let mode = raw.mode ? raw.mode.toUpperCase().trim() : null;
  let submode = raw.submode ? raw.submode.toUpperCase().trim() : null;
  if (mode && !MODE_ENUM.includes(mode)) {
    if (MODE_MAP[mode]) {
      mode = MODE_MAP[mode];
    } else if (submode && MODE_MAP[submode]) {
      mode = MODE_MAP[submode];
    } else {
      issues.push(`Mode '${mode}' nicht im Enum → 'Other'`);
      mode = "Other";
    }
  }
  if (!mode) {
    mode = "Other";
    issues.push("Mode fehlt → 'Other' gesetzt");
  }

  // Reference
  const myRef = raw.my_sig_info || raw.my_ref || raw.sig_info || raw.my_sig || "";
  const myRefType = myRef ? detectRefType(myRef) : "custom";

  // Club station detection
  const stationCallsign = raw.station_callsign || "";
  const operator = raw.operator || "";
  const isClub = !!(stationCallsign && operator);

  const record = {
    callsign,
    callsign_suffix: suffix,
    qso_date: qsoDate,
    time_start: timeStart,
    time_end: timeEnd,
    frequency,
    band,
    mode,
    rst_sent: raw.rst_sent || "",
    rst_received: raw.rst_rcvd || "",
    power: raw.tx_pwr ? parseFloat(raw.tx_pwr) : null,
    operator_name: raw.name || "",
    operator_address: raw.address || "",
    operator_country: raw.country || "",
    operator_grid: raw.gridsquare || "",
    operator_email: raw.email || "",
    is_clubstation: isClub,
    club_callsign: isClub ? stationCallsign.toUpperCase() : "",
    club_operator_callsign: isClub ? operator.toUpperCase() : "",
    club_operator_name: "",
    my_reference: myRef,
    my_reference_type: myRefType,
    my_reference_name: "",
    my_suffix: "",
    my_grid: raw.my_gridsquare || "",
    notes: raw.notes || raw.comment || "",
    status: "active",
  };

  // Validate required fields
  if (!callsign) missingFields.push("Rufzeichen");
  if (!qsoDate) missingFields.push("Datum");
  if (frequency == null || isNaN(frequency)) missingFields.push("Frequenz");
  if (!mode) missingFields.push("Mode");

  const isValid = missingFields.length === 0;

  return { record, issues, isValid, missingFields };
}

// Generate a dedup key for a record
export function dedupKey(r) {
  return [
    (r.callsign || "").toUpperCase(),
    r.qso_date || "",
    (r.time_start || "").slice(0, 5),
    r.frequency != null ? Number(r.frequency).toFixed(4) : "",
    (r.band || "").toLowerCase(),
    (r.mode || "").toUpperCase(),
  ].join("|");
}

// Full parse + validate + dedup pipeline.
// existingEntries: array of existing Log entries to check duplicates against.
// Returns { parsed, duplicates, invalid, summary }
export function parseAndValidate(content, existingEntries) {
  const rawRecords = parseAdifContent(content);
  const existingKeys = new Set((existingEntries || []).map(e => dedupKey(e)));
  const seenKeys = new Set();

  const parsed = [];
  const duplicates = [];
  const invalid = [];

  rawRecords.forEach((raw, idx) => {
    const { record, issues, isValid, missingFields } = mapAdifRecord(raw);
    const key = dedupKey(record);

    const isDuplicateOfExisting = isValid && existingKeys.has(key);
    const isDuplicateInFile = isValid && seenKeys.has(key);

    const entry = {
      index: idx + 1,
      record,
      issues,
      isValid,
      missingFields,
      isDuplicate: isDuplicateOfExisting || isDuplicateInFile,
      duplicateType: isDuplicateOfExisting ? "existing" : (isDuplicateInFile ? "file" : null),
    };

    if (!isValid) {
      invalid.push(entry);
    } else if (entry.isDuplicate) {
      duplicates.push(entry);
    } else {
      parsed.push(entry);
    }

    if (isValid) seenKeys.add(key);
  });

  return {
    rawCount: rawRecords.length,
    parsed,
    duplicates,
    invalid,
    summary: {
      total: rawRecords.length,
      valid: parsed.length + duplicates.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      importable: parsed.length,
    },
  };
}