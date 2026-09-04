// fetchSotaClusterSpots — versucht SOTA-Cluster (cluster.sota.org.uk:7300) zu lesen.
// Raw TCP (Deno.connect) ist in der Backend-Sandbox blockiert.
// WebSocket-Versuch schlägt fehl (Server ist raw TCP, kein WS) — stiller Fallback:
// Frontend nutzt SOTAwatch-API (fetchSotaSpots) weiter, Anzeige wird nie leer.

export default async function(req: Request): Promise<Response> {
  try {
    const spots: any[] = [];

    try {
      // WebSocket-Versuch — wird fehlschlagen da cluster.sota.org.uk:7300 raw TCP ist.
      // Falls der Server jemals auf WebSocket upgradet, wird dieser Code funktionieren.
      const wsPromise = new Promise<any[]>((resolve) => {
        let collected: any[] = [];
        let textBuffer = "";
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          resolve(collected);
        };

        const timeout = setTimeout(finish, 8000);

        try {
          const ws = new WebSocket("ws://cluster.sota.org.uk:7300");

          ws.onmessage = (event) => {
            textBuffer += String(event.data);
            const lines = textBuffer.split("\n");
            textBuffer = lines.pop() || "";
            for (const line of lines) {
              const l = line.trim();
              if (!l.includes("DX de")) continue;
              const m = l.match(/DX de\s+([A-Z0-9\/-]+):\s+([\d.]+)\s+([A-Z0-9\/-]+)\s*(.*)/);
              if (m) {
                const tm = (m[4] || "").match(/(\d{4})Z/);
                let timeISO = new Date().toISOString();
                if (tm) {
                  const hh = parseInt(tm[1].substring(0, 2), 10);
                  const mm = parseInt(tm[1].substring(2, 4), 10);
                  const d = new Date();
                  d.setUTCHours(hh, mm, 0, 0);
                  timeISO = d.toISOString();
                }
                const comment = (m[4] || "").replace(/\d{4}Z/, "").trim();
                const modeMatch = comment.match(/\b(FM|SSB|CW|FT8|FT4|AM|DV|C4FM|DMR|DSTAR)\b/i);
                collected.push({
                  time: timeISO,
                  spotter: m[1],
                  frequency: parseFloat(m[2]),
                  activatorCallsign: m[3],
                  comment,
                  mode: modeMatch ? modeMatch[1].toUpperCase() : null,
                  source: "sota-cluster",
                });
              }
            }
          };

          ws.onerror = () => {
            clearTimeout(timeout);
            console.log("[SOTA Cluster] WebSocket error (expected — raw TCP server, kein WS)");
            finish();
          };

          ws.onclose = () => {
            clearTimeout(timeout);
            finish();
          };
        } catch (e) {
          clearTimeout(timeout);
          console.log("[SOTA Cluster] WebSocket constructor failed:", e.message);
          finish();
        }
      });

      const result = await wsPromise;
      spots.push(...result);
    } catch (e) {
      console.log("[SOTA Cluster] Connection failed:", e.message);
    }

    return Response.json({
      success: true,
      spots,
      count: spots.length,
      fallback: spots.length === 0,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Unbekannter Fehler" }, { status: 500 });
  }
}