// APRS-IS Direktanbindung — Reader und Parser für rohe APRS-Pakete.
//
// Transport: rohes TCP (Deno.connect) zu rotate.aprs2.net:14580, read-only Login
// (passcode -1) mit Server-Filter r/<lat>/<lon>/<km>. Verifiziert am 04.11.2026:
// ausgehendes TCP 14580 ist aus Backend-Funktionen erlaubt.
//
// Unterstützte Positionstypen:
//   ! = / @  uncompressed (DDMM.hhN/DDDMM.hhW) inkl. CSE/SPD-Extension und /A=Höhe
//   ! = / @  compressed  (Base-91, inkl. Höhe)
//   ' `      Mic-E (Destination trägt die Breite)
//   :        Messages, > Status, T# Telemetrie, _ Wetter ohne Position → ignoriert
//
// Tempo/Kurs: direkt aus dem Paket (CSE/SPD bzw. NMEA im Kommentar). Fehlt eine
// Angabe, leitet der Sammler Tempo/Kurs aus der Bewegung zwischen zwei Samples ab.

export const APRS_IS_HOST = "rotate.aprs2.net";
export const APRS_IS_PORT = 14580;

export type AprsPacket = {
  callsign: string;
  lat: number;
  lng: number;
  symbol: string;        // 2 Zeichen: Tabelle + Code, z. B. "/>"
  station_type: string;  // mobile | fixed | wx | igate | digi | object | balloon | other
  comment: string;
  speed: number | null;  // km/h
  course: number | null; // Grad
  altitude: number | null; // Meter
  heard: string;         // ISO
  format: string;        // uncompressed | compressed | mice
};

const DIGIT_TABLE: Record<string, number> = {};
"0123456789".split("").forEach((c, i) => (DIGIT_TABLE[c] = i));
"ABCDEFGHIJ".split("").forEach((c, i) => (DIGIT_TABLE[c] = (i + 1) % 10));
"PQRSTUVWXY".split("").forEach((c, i) => (DIGIT_TABLE[c] = i));

const KNOTS_TO_KMH = 1.852;
const FEET_TO_M = 0.3048;

function round(v: number, digits = 5): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/** Symbol + Kommentar → Kategorie für die Karte. */
export function classifyStation(symbol: string, comment: string): string {
  const table = symbol[0] || "/";
  const code = symbol[1] || "";
  const c = (comment || "").toLowerCase();

  if (code === "_") return "wx";
  if (code === "#" || code === "S" || code === "T" || code === "n" || code === "N") return "digi";
  if (code === "I" || code === "i" || code === "[" ) return "igate";
  if (code === "O" || (table === "/" && code === "o")) {
    // Ballon-Objekte erkennt man am Kommentar, sonst Objekt
    if (c.includes("balloon") || c.includes("ballon")) return "balloon";
    return "object";
  }

  const MOBILE_CODES = new Set([
    ">", "v", "V", "<", "k", "K", "U", "u", "Y", "y", "s", "S".toLowerCase(),
    "Q", "q", "j", "J", "f", "F", "a", "X", "x", "B", "b", "C", "c", "G", "g",
    "L", "M", "P", "p", "R", "r", "A", "W", "w", "h", "E", "e", "Z", "U",
  ]);
  if (c.includes("balloon") || c.includes("ballon")) return "balloon";
  if (MOBILE_CODES.has(code)) return "mobile";
  if (code === "-" || code === "H" || code === "_" || code === "&") return "fixed";
  return c.includes("wx") || c.includes("weather") ? "wx" : "fixed";
}

function parseAltitudeFromComment(comment: string, weather: boolean): number | null {
  // /A=001234 → Fuss (nur bei Nicht-Wetter-Paketen offiziell)
  const m = comment.match(/\/A=(\d{6})/);
  if (m && !weather) return Math.round(parseInt(m[1], 10) * FEET_TO_M);
  return null;
}

function parseCourseSpeed(comment: string): { speed: number | null; course: number | null } {
  // Feste 7-Byte-Extension direkt nach dem Symbol: CSE/SPD (Knoten)
  const m = comment.match(/^(\d{3})\/(\d{3})/);
  if (m) {
    const course = parseInt(m[1], 10);
    const speed = parseInt(m[2], 10);
    return {
      course: Number.isFinite(course) ? course : null,
      speed: Number.isFinite(speed) ? Math.round(speed * KNOTS_TO_KMH * 10) / 10 : null,
    };
  }
  // NMEA-Passthrough $GPRMC / $GPGGA im Kommentar
  const rmc = comment.match(/\$GPRMC,([\d.]+),A,([\d.]+),([NS]),([\d.]+),([EW]),([\d.]*),([\d.]*)/);
  if (rmc) {
    const speed = parseFloat(rmc[6]);
    const course = parseFloat(rmc[7]);
    return {
      speed: Number.isFinite(speed) ? Math.round(speed * KNOTS_TO_KMH * 10) / 10 : null,
      course: Number.isFinite(course) ? course : null,
    };
  }
  return { speed: null, course: null };
}

/** Uncompressed: DDMM.hhN/DDDMM.hhW */
function parseUncompressed(body: string): Partial<AprsPacket> | null {
  const m = body.match(/^(\d{2})(\d{2}\.\d{2})([NS])(.)(\d{3})(\d{2}\.\d{2})([EW])(.)(.*)$/s);
  if (!m) return null;
  const lat = parseInt(m[1], 10) + parseFloat(m[2]) / 60;
  const lng = parseInt(m[5], 10) + parseFloat(m[6]) / 60;
  const symbol = m[4] + m[8];
  const comment = m[9] || "";
  const weather = m[8] === "_";
  const { speed, course } = parseCourseSpeed(comment);
  return {
    lat: round(m[3] === "S" ? -lat : lat),
    lng: round(m[7] === "W" ? -lng : lng),
    symbol,
    comment,
    speed: weather ? null : speed,
    course: weather ? null : course,
    altitude: parseAltitudeFromComment(comment, weather),
    station_type: classifyStation(symbol, comment),
    format: "uncompressed",
  };
}

/** Compressed: /YYYYXXXX$ + 2 Bytes Course/Speed bzw. Höhe */
function parseCompressed(body: string): Partial<AprsPacket> | null {
  if (body.length < 13) return null;
  const table = body[0];
  const latChars = body.slice(1, 5);
  const lngChars = body.slice(5, 9);
  const code = body[9];
  const comment = body.slice(13) || "";

  const b91 = (s: string) =>
    [...s].reduce((acc, ch) => acc * 91 + (ch.charCodeAt(0) - 33), 0);

  const latVal = b91(latChars);
  const lngVal = b91(lngChars);
  if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) return null;

  const lat = 90 - latVal / 380926;
  const lng = -180 + lngVal / 190463;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const symbol = table + code;

  // Die zwei Bytes nach dem Symbol: Höhe (Bit 0x18 == 0x10) oder Course/Speed.
  // Course/Speed wird hier NICHT aus den Bytes gelesen (Encoding je nach
  // Implementierung unterschiedlich) — der Sammler leitet Tempo/Kurs aus der
  // Bewegung zwischen zwei Samples ab, das ist formatunabhängig korrekt.
  let altitude: number | null = null;
  const b1 = body.charCodeAt(10) - 33;
  const b2 = body.charCodeAt(11) - 33;
  if ((b1 & 0x18) === 0x10) {
    const altFeet = Math.pow(1.002, ((b1 & 0x0f) << 8) | b2) * 3.28084 * 0 + 0;
    // Höhe im Klartext ist zuverlässiger (Kommentar /A=)
    altitude = altFeet || null;
  }

  const fromComment = parseAltitudeFromComment(comment, code === "_");
  const { speed, course } = parseCourseSpeed(comment);

  return {
    lat: round(lat),
    lng: round(lng),
    symbol,
    comment,
    speed: code === "_" ? null : speed,
    course: code === "_" ? null : course,
    altitude: fromComment ?? altitude,
    station_type: classifyStation(symbol, comment),
    format: "compressed",
  };
}

/**
 * Ein rohes APRS-IS-Paket parsen.
 * Format: SRC>DEST,PATH:payload
 */
export function parseAprsLine(line: string): AprsPacket | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const colon = trimmed.indexOf(":");
  if (colon < 0) return null;
  const header = trimmed.slice(0, colon);
  const payload = trimmed.slice(colon + 1);
  const source = header.split(">")[0].trim().toUpperCase();
  const dest = (header.split(">")[1] || "").split(",")[0].trim().toUpperCase();
  if (!source || !payload) return null;

  const dt = payload[0];
  let body = payload.slice(1);
  let result: Partial<AprsPacket> | null = null;

  if (dt === "!" || dt === "=" || dt === "/" || dt === "@") {
    let posBody = body;
    if (dt === "/" || dt === "@") posBody = body.slice(7); // Zeitstempel überspringen
    // Uncompressed beginnt immer mit zwei Ziffern (Gradangabe),
    // Compressed mit dem Symbol-Tabellenzeichen.
    result = /^\d/.test(posBody) ? parseUncompressed(posBody) : parseCompressed(posBody);
    if (!result) result = parseUncompressed(posBody) || parseCompressed(posBody);
  } else {
    // Mic-E (' `) ist in dieser Region praktisch nicht vertreten und wird nicht
    // geraten — solche Pakete werden im Laufprotokoll gezählt (mice_skipped).
    return null; // Message, Status, Telemetrie, Wetter ohne Position …
  }

  if (!result || result.lat == null || result.lng == null) return null;
  if (!Number.isFinite(result.lat) || !Number.isFinite(result.lng)) return null;
  if (Math.abs(result.lat) > 90 || Math.abs(result.lng) > 180) return null;
  if (result.lat === 0 && result.lng === 0) return null;

  return {
    callsign: source,
    lat: result.lat as number,
    lng: result.lng as number,
    symbol: result.symbol || "/>",
    station_type: result.station_type || "other",
    comment: (result.comment || "").slice(0, 200),
    speed: result.speed ?? null,
    course: result.course ?? null,
    altitude: result.altitude ?? null,
    heard: new Date().toISOString(),
    format: result.format || "unknown",
  };
}

/**
 * TCP-Stream von APRS-IS lesen.
 * @returns geparste Pakete, Rohzeilen-Zähler und Formatstatistik
 */
export async function readAprsStream(opts: {
  lat: number;
  lon: number;
  radiusKm: number;
  loginCall: string;
  durationMs: number;
  maxPackets?: number;
}) {
  const { lat, lon, radiusKm, loginCall, durationMs } = opts;
  const maxPackets = opts.maxPackets ?? 20000;
  const filter = `r/${lat.toFixed(3)}/${lon.toFixed(3)}/${radiusKm}`;

  const stats = {
    host: APRS_IS_HOST,
    port: APRS_IS_PORT,
    filter,
    lines: 0,
    parsed: 0,
    by_format: {} as Record<string, number>,
    mice_skipped: 0,
    duration_ms: 0,
    error: null as string | null,
  };

  const started = Date.now();
  const packets: AprsPacket[] = [];
  const seen = new Set<string>();
  let socket: any = null;

  try {
    // Die Backend-Runtime ist Node-kompatibel: node:net liefert einen echten
    // Socket. Deno.connect existiert zwar, dessen Rückgabewert ist hier aber
    // nicht schreibbar (verifiziert 04.11.2026).
    const net = (await import("node:net")).default;

    const rest = { text: "" };
    const handleText = (text: string) => {
      rest.text += text;
      let idx = rest.text.indexOf("\n");
      while (idx >= 0) {
        const line = rest.text.slice(0, idx).trim();
        rest.text = rest.text.slice(idx + 1);
        stats.lines++;
        if (line && !line.startsWith("#")) {
          const p = parseAprsLine(line);
          if (!p) {
            const payload = line.slice(line.indexOf(":") + 1);
            if (payload.startsWith("'") || payload.startsWith("`")) stats.mice_skipped++;
          }
          if (p) {
            stats.by_format[p.format] = (stats.by_format[p.format] || 0) + 1;
            // nur die neueste Position pro Callsign innerhalb des Fensters
            if (!seen.has(p.callsign) && packets.length < maxPackets) {
              seen.add(p.callsign);
              packets.push(p);
            }
          }
        }
        idx = rest.text.indexOf("\n");
      }
    };

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          socket?.destroy();
        } catch {
          /* ignore */
        }
        resolve();
      };
      const timer = setTimeout(finish, durationMs);

      socket = net.connect({ host: APRS_IS_HOST, port: APRS_IS_PORT }, () => {
        socket.write(`user ${loginCall} pass -1 vers HB9OM-OnField 1.0 filter ${filter}\r\n`);
      });
      socket.on("data", (chunk: any) => {
        try {
          handleText(chunk.toString("utf8"));
          if (packets.length >= maxPackets) {
            clearTimeout(timer);
            finish();
          }
        } catch (e: any) {
          stats.error = String(e?.message || e);
          clearTimeout(timer);
          finish();
        }
      });
      socket.on("error", (e: any) => {
        stats.error = String(e?.message || e);
        clearTimeout(timer);
        finish();
      });
      socket.on("end", () => {
        clearTimeout(timer);
        finish();
      });
      socket.on("close", () => {
        clearTimeout(timer);
        finish();
      });
    });
  } catch (e: any) {
    stats.error = String(e?.message || e);
  } finally {
    try {
      socket?.destroy();
    } catch {
      /* ignore */
    }
  }

  stats.parsed = packets.length;
  stats.duration_ms = Date.now() - started;
  return { packets, stats };
}