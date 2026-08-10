// SWISS-ARTG repeater and station data, manually curated from swiss-artg.ch
// Keyed by callsign; each entry may specify a frequency for disambiguation
// (e.g. HB9AK has multiple repeaters at different frequencies/sites).
//
// Source: https://www.swiss-artg.ch/index.php?id=38 (Standorte)

export const SWISS_ARTG_REPEATERS = [
  {
    callsign: "HB9AK",
    frequency: 438.4,
    artgCallsign: "HB9AK-R",
    location: "Uf Alpen (SH) – Schleitheim",
    elevation: 560,
    locator: "JN47FR",
    description: "FM-Relais (SVXLink) mit Echolink-Anbindung im FM-Funknetz",
    pageUrl: "https://www.swiss-artg.ch/index.php?id=166",
    echolinkId: "326020",
    ctcss: "88.5 Hz",
    fmFunknetz: true,
    fmFunknetzTgs: [
      { tg: 2280, name: "CQ-Aufruf (Deutschschweiz)" },
      { tg: 228010, name: "SWISS-ARTG" },
    ],
    dtmf: [
      { code: "0#", name: "Help" },
      { code: "1#", name: "Parrot (Papagei)" },
      { code: "2#", name: "Echolink" },
      { code: "3#", name: "Wetter Info (Metar)" },
    ],
    coverage: "Schaffhausen (NW), Klettgau, Blumberg",
    sysop: "HB9PAE Peter Stirnimann",
    services: [
      "2m APRS iGate HB9AK-12 (144.800 MHz)",
      "LoRa APRS iGate HB9AK-11",
      "DAPNET Paging (439.9875 MHz)",
    ],
  },
  {
    callsign: "HB9AK",
    frequency: 438.6,
    artgCallsign: "HB9AK-1",
    location: "Hörnli (ZH) – Fischenthal",
    elevation: 1133,
    locator: "JN47LI",
    description: "DMR Repeater (Brandmeister SwissDMR)",
    pageUrl: "https://www.swiss-artg.ch/index.php?id=72",
    dashboardUrl: "https://brandmeister.network/?page=repeater&id=228809",
    dmrId: "228809",
    network: "Brandmeister (SwissDMR, Server BM 2281)",
    colorCode: 1,
    outputPower: "25 W",
    ctcss: null,
    talkgroups: [
      { ts: 1, tg: 228, name: "Schweiz national" },
      { ts: 2, tg: 2280, name: "Schweiz deutsch" },
      { ts: 2, tg: 2288, name: "Region Zürich" },
      { ts: 2, tg: 2289, name: "Region Ostschweiz" },
    ],
    emergencyPower: true,
    services: [
      "FM-Relais (SVX) HB9AK-L 439.900 MHz im FM-Funknetz",
      "Winlink E-Mail Gateway (10m: 28.311 MHz, 2m: 144.875 MHz)",
      "KI-Gateway HB9AK-6 (VarAC / Google Gemini)",
      "HAMNET Knoten (AS 64726)",
      "LoRa APRS iGate HB9AK-10",
      "DAPNET (439.9875 MHz)",
      "Web RX (2m, 70cm, ADS-B)",
    ],
  },
  {
    callsign: "HB9AK",
    frequency: 439.9,
    artgCallsign: "HB9AK-L",
    location: "Hörnli (ZH) – Fischenthal",
    elevation: 1133,
    locator: "JN47LI",
    description: "FM-Relais (SVXLink) im FM-Funknetz",
    pageUrl: "https://www.swiss-artg.ch/index.php?id=72",
    ctcss: "88.5 Hz",
    fmFunknetz: true,
    fmFunknetzTgs: [
      { tg: 2280, name: "CQ-Aufruf (Deutschschweiz)" },
      { tg: 228010, name: "SWISS-ARTG" },
    ],
    emergencyPower: true,
    services: [
      "DMR Repeater HB9AK-1 (438.600 MHz)",
      "Winlink E-Mail Gateway (10m/2m)",
      "KI-Gateway (VarAC / Gemini)",
      "HAMNET, LoRa APRS iGate, DAPNET",
    ],
  },
  {
    callsign: "HB9AK",
    frequency: 438.3,
    artgCallsign: "HB9AK",
    location: "Landstuhl (BE) – Neuenegg",
    elevation: 651,
    locator: "JN36PV",
    description: "WINLINK Kurzwellen-Gateway (80m–15m)",
    pageUrl: "https://www.swiss-artg.ch/index.php?id=63",
    emergencyPower: true,
    sysop: "HB9AUR Martin Spreng",
    services: [
      "Winlink HF Gateway (80m: 3613/3591.5, 40m: 7050, 30m: 10144.4, 20m: 14108.9/14115, 17m: 18114.4, 15m: 21113.5 kHz)",
      "WSPR-Bake (160m–6m)",
      "2m APRS iGate HB9AK-6",
      "HAMNET",
    ],
  },
  {
    callsign: "HB9ZRH",
    frequency: 145.575,
    artgCallsign: "HB9ZRH_C",
    location: "Uetliberg (ZH) – Stallikon",
    elevation: 871,
    locator: "JN47FI",
    description: "D-STAR Repeater (XLX229)",
    pageUrl: "https://www.swiss-artg.ch/index.php?id=110",
    reflector: "XLX229 D (D-STAR Schweiz)",
    reflectorUrl: "http://dstar.hamnet.xyz/",
    alsoConnectedTo: "SwissDMR TG 22822",
    services: [
      "Packet Radio Digipeater (438.525/430.925 MHz 1k2, 438.550/430.950 MHz 9k6)",
      "HAMNET Gateway (AS 64723)",
      "LoRa APRS iGate HB9ZRH-10",
    ],
  },
  {
    callsign: "HB9SG",
    frequency: 438.3625,
    artgCallsign: "HB9SG",
    location: "Hohe Buche (AR) – Brülisau",
    elevation: null,
    locator: "JN47RJ",
    description: "DMR Repeater (Partnerstandort USKA St. Gallen)",
    pageUrl: "https://www.swiss-artg.ch/index.php?id=115",
    services: [
      "HAMNET Anbindung",
      "23cm FM-Relais 1298.225 MHz im FM-Funknetz (TG 2280, 228020)",
    ],
  },
  {
    callsign: "HB9SG",
    frequency: 1298.225,
    artgCallsign: "HB9SG",
    location: "Hohe Buche (AR)",
    elevation: null,
    locator: "JN47RJ",
    description: "23cm FM-Relais (SVXLink) im FM-Funknetz",
    pageUrl: "https://www.swiss-artg.ch/index.php?id=115",
    ctcss: "88.5 Hz",
    fmFunknetz: true,
    fmFunknetzTgs: [
      { tg: 2280, name: "CQ-Aufruf (Deutschschweiz)" },
      { tg: 228020, name: "St. Gallen" },
    ],
    services: ["HAMNET"],
  },
  {
    callsign: "HB9AK-4",
    frequency: 144.9,
    artgCallsign: "HB9AK-4",
    location: "Bullet (VD)",
    elevation: 1130,
    locator: "JN36GT",
    description: "WINLINK Gateway (VARA FM, Packet) + VarAC KI-Gateway",
    pageUrl: "https://www.swiss-artg.ch/index.php?id=169",
    modes: "VARA FM (WIDE/NARROW), Packet 1200 Bd",
    outputPower: "25 W",
    services: ["VarAC Chat (KI-Gateway mit Google Gemini)"],
  },
];

// APRS and data stations from SWISS-ARTG (not voice repeaters, but may be in PrivateNode DB)
export const SWISS_ARTG_STATIONS = [
  { callsign: "HB9AK-5", location: "Chur (GR)", elevation: 610, locator: "JN46SU", description: "2m APRS iGate (144.800 MHz)", pageUrl: "https://www.swiss-artg.ch/index.php?id=84", coverage: "Churer Rheintal bis Sargans, Bündner Oberland bis Laax, Schanfigg bis Langwies, Lenzerheidepass bis Parpan", sysop: "HB9DSN Benno Stanger" },
  { callsign: "HB9AK-7", location: "Älpli (GR) – Malans", elevation: 1801, locator: "JN47TA", description: "2m APRS Digipeater (144.800 MHz)", pageUrl: "https://www.swiss-artg.ch/index.php?id=85", coverage: "Churer Rheintal Sargans, Bad Ragaz Maienfeld bis Walenstadt, Lenzerheide und Oberhalbstein", sysop: "HB9DSN Benno Stanger", solarPower: true },
  { callsign: "HB9AK-2", location: "Disentis (GR)", elevation: null, locator: "JN46JQ", description: "2m APRS iGate (144.800 MHz)", pageUrl: "https://www.swiss-artg.ch/index.php?id=182" },
  { callsign: "HB9AK-30", location: "Schufelberger Egg (ZH) – Hinwil", elevation: 1000, locator: "JN47KH", description: "HAMNET Userzugang + WebSDR (80m/60m)", pageUrl: "https://www.swiss-artg.ch/index.php?id=92" },
];

// Find SWISS-ARTG data for a repeater by callsign + frequency (within 1 kHz tolerance)
export function findSwissArtgRepeater(callsign, frequency) {
  if (!callsign) return null;
  // Try exact callsign + frequency match first
  let match = SWISS_ARTG_REPEATERS.find(
    r => r.callsign === callsign && frequency != null && r.frequency != null &&
         Math.abs(r.frequency - frequency) < 0.001
  );
  if (match) return match;
  // Try callsign only (if no frequency match, return first entry for that callsign)
  match = SWISS_ARTG_REPEATERS.find(r => r.callsign === callsign);
  return match || null;
}

// Find SWISS-ARTG station data for a PrivateNode by callsign
export function findSwissArtgStation(callsign) {
  if (!callsign) return null;
  return SWISS_ARTG_STATIONS.find(s => s.callsign === callsign) || null;
}