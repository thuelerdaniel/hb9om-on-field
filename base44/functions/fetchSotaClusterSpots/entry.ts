// fetchSotaClusterSpots — SOTA-Cluster (cluster.sota.org.uk:7300) via raw TCP.
// v0.9035: Login-Sequenz + kHz→MHz Umrechnung korrigiert.
//
// Protokoll (verifiziert):
// 1. TCP-Verbindung aufbauen
// 2. Server sendet: "Welcome to the GM4LLD SOTA Cluster ... login: "
// 3. WIR senden: "HB9OM\n"
// 4. Server antwortet: "HB9OM de GM4LLD sota_cluster >"
// 5. Danach werden Spots gepusht: "DX de SPOTTER:  FREQ_kHz  ACTIVATOR  SUMMIT  ZEIT"
//
// Frequenz ist in kHz: 144200.0 kHz = 144.200 MHz → Umrechnung: MHz = kHz / 1000
//
// Fallback: falls raw TCP blockiert ist, liefert die Funktion 0 Spots (fallback: true),
// das Frontend verwendet weiterhin die SOTAwatch-API (fetchSotaSpots).

export default async function (req: Request): Promise<Response> {
  // Dynamic import — falls node:net in der Sandbox nicht verfügbar ist, stiller Fallback.
  let netMod: any;
  try {
    netMod = await import("node:net");
  } catch (e) {
    console.log("[SOTA Cluster] node:net nicht verfügbar:", e?.message || e);
    return Response.json({ success: true, spots: [], count: 0, fallback: true });
  }

  return new Promise<Response>((resolve) => {
    const spots: any[] = [];
    let buffer = "";
    let loginSent = false;
    let settled = false;
    let client: any = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        if (client) client.destroy();
      } catch (e) {}
      resolve(
        Response.json({
          success: true,
          spots,
          count: spots.length,
          fallback: spots.length === 0,
        })
      );
    };

    const timeout = setTimeout(finish, 12000);

    try {
      client = netMod.default.createConnection({
        host: "cluster.sota.org.uk",
        port: 7300,
      });
    } catch (e) {
      console.log("[SOTA Cluster] createConnection fehlgeschlagen:", e?.message || e);
      clearTimeout(timeout);
      return finish();
    }

    client.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const l = rawLine.trim();

        // 1. Auf login-Prompt warten, dann Callsign senden
        if (!loginSent && (l.includes("login:") || l.includes("login :"))) {
          loginSent = true;
          try {
            client.write("HB9OM\n");
          } catch (e) {}
          continue;
        }
        if (l.includes("sota_cluster >")) continue;

        // 2. Spot-Zeilen parsen: "DX de SPOTTER:  FREQ_kHz  ACTIVATOR  SUMMIT  ZEIT"
        if (!l.includes("DX de")) continue;
        const m = l.match(
          /DX de\s+([A-Z0-9\/\-\.]+):\s*([\d.]+)\s+([A-Z0-9\/\-]+)\s+(\S+)\s+(\d{4})Z/
        );
        if (m) {
          const freqKHz = parseFloat(m[2]);
          const freqMHz = freqKHz / 1000; // kHz → MHz
          const hh = parseInt(m[5].substring(0, 2), 10);
          const mm = parseInt(m[5].substring(2, 4), 10);
          const d = new Date();
          d.setUTCHours(hh, mm, 0, 0);
          const comment = l
            .substring(l.indexOf(m[4]) + m[4].length)
            .replace(/\d{4}Z/, "")
            .trim();
          const modeMatch = comment.match(
            /\b(FM|SSB|CW|FT8|FT4|AM|DV|C4FM|DMR|DSTAR)\b/i
          );
          spots.push({
            time: d.toISOString(),
            spotter: m[1],
            frequency: freqMHz,
            activatorCallsign: m[3],
            summitRef: m[4],
            comment: comment,
            mode: modeMatch ? modeMatch[1].toUpperCase() : null,
            source: "sota-cluster",
          });
        }
      }
    });

    client.on("error", (err: Error) => {
      console.log("[SOTA Cluster] Socket error:", err?.message || err);
      clearTimeout(timeout);
      finish();
    });

    client.on("close", () => {
      clearTimeout(timeout);
      finish();
    });
  });
}