// CSV-Parser für den Relais-Import (Admin → JSON-/CSV-Repeater-Import).
//
// Wandelt eine CSV-Datei (RepeaterBook-Export oder eigene Tabelle) in dieselben
// Feldnamen um, die der JSON-Export verwendet (callsign, freq_mhz, offset_mhz,
// tone, dcs, lat, lon, city, state, country, landmark, dmr, ysf, dstar_node …).
// Die weitere Verarbeitung läuft danach unverändert über importRepeaterJson und
// repeaterImportMapping.ts — CSV und JSON ergeben denselben Datensatz.

// RFC4180: Anführungszeichen, "" als Escape, Zeilenumbrüche in Feldern,
// Trennzeichen , oder ; oder Tab, BOM am Dateianfang.
function detectDelimiter(firstLine) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && counts[ch] !== undefined) counts[ch]++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ",";
}

function parseRows(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLineEnd = clean.search(/\r?\n/);
  const delimiter = detectDelimiter(firstLineEnd === -1 ? clean : clean.slice(0, firstLineEnd));

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Spalten-Aliase → Feldname des JSON-Exports
const ALIASES = {
  callsign: ["callsign", "call", "rufzeichen"],
  freq_mhz: ["frequency", "freq", "freqmhz", "frequencymhz", "outputfreq", "rxfreq", "mhz"],
  offset_mhz: ["offset", "offsetmhz", "shift", "offsetvalue"],
  input_freq: ["inputfreq", "inputfrequency", "txfreq"],
  tone: ["uplinktone", "tone", "ctcss", "rxtone", "subton", "subtone", "toneuplink"],
  dcs: ["dcs", "dcscode"],
  lat: ["latitude", "lat"],
  lon: ["longitude", "lon", "lng", "long"],
  city: ["location", "city", "place", "ort"],
  state: ["state", "province", "canton", "kanton"],
  country: ["country", "countrycode", "land"],
  landmark: ["landmark", "description", "notes", "bemerkung"],
  echolink_node: ["echolinknode", "echolink"],
  dmr: ["dmr"],
  dstar_node: ["dstar", "dstarnode", "dstar"],
  ysf: ["systemfusion", "fusion", "ysf", "c4fm"],
  nxdn: ["nxdn"],
  p25: ["p25"],
  tetra: ["tetra"],
  m17: ["m17"],
  atv: ["atv"],
};

const isTruthyFlag = (v) => {
  const s = String(v || "").trim().toLowerCase();
  return s !== "" && s !== "no" && s !== "n" && s !== "0" && s !== "-" && s !== "false";
};

function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((raw, idx) => {
    const key = norm(raw);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (map[field] === undefined && aliases.includes(key)) map[field] = idx;
    }
  });
  return map;
}

export function parseRepeaterCsv(text) {
  const rows = parseRows(text);
  if (rows.length < 2) return [];

  const headerMap = buildHeaderMap(rows[0]);
  const get = (row, field) => {
    const idx = headerMap[field];
    return idx === undefined ? "" : String(row[idx] ?? "").trim();
  };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const callsign = get(row, "callsign");
    const freq = get(row, "freq_mhz");
    if (!callsign && !freq) continue;

    let offset = parseFloat(get(row, "offset_mhz"));
    if (!Number.isFinite(offset)) offset = 0;
    // Fehlt der Offset, aber die Eingangsfrequenz ist da: Offset daraus ableiten
    const inputFreq = parseFloat(get(row, "input_freq"));
    if (!offset && Number.isFinite(inputFreq) && Number.isFinite(parseFloat(freq))) {
      offset = Math.round((inputFreq - parseFloat(freq)) * 1000) / 1000;
    }

    records.push({
      callsign: callsign.toUpperCase(),
      freq_mhz: freq,
      offset_mhz: offset,
      tone: get(row, "tone"),
      dcs: get(row, "dcs"),
      lat: get(row, "lat"),
      lon: get(row, "lon"),
      city: get(row, "city"),
      state: get(row, "state"),
      country: get(row, "country"),
      landmark: get(row, "landmark"),
      echolink_node: get(row, "echolink_node"),
      dmr: isTruthyFlag(get(row, "dmr")) ? "YES" : "",
      dstar_node: get(row, "dstar_node"),
      ysf: isTruthyFlag(get(row, "ysf")) ? "YES" : "",
      nxdn: isTruthyFlag(get(row, "nxdn")) ? "YES" : "",
      p25: isTruthyFlag(get(row, "p25")) ? "YES" : "",
      tetra: isTruthyFlag(get(row, "tetra")) ? "YES" : "",
      m17: isTruthyFlag(get(row, "m17")) ? "YES" : "",
      atv: isTruthyFlag(get(row, "atv")) ? "YES" : "",
    });
  }
  return records;
}