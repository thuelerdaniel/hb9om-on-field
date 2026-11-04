// Diagnose: Welche TCP-API steht in der Backend-Runtime wirklich zur Verfügung?
// Prüft Deno.connect-Rückgabewert (Node-Socket vs. Deno-Conn vs. Stub) und ob
// ein echter Datenaustausch mit APRS-IS möglich ist.

export default async function (req: Request): Promise<Response> {
  const out: any = { tcp: {}, nodeNet: {}, nodeTls: {} };
  const deno = (globalThis as any).Deno;

  // 1) Deno.connect-Rückgabewert untersuchen
  try {
    const conn = await deno.connect({ hostname: "rotate.aprs2.net", port: 14580 });
    out.tcp.type = typeof conn;
    out.tcp.keys = Object.keys(conn).slice(0, 20);
    out.tcp.hasOn = typeof conn.on;
    out.tcp.hasRead = typeof conn.read;
    out.tcp.hasWrite = typeof conn.write;
    out.tcp.fd = conn.fd ?? null;
    out.tcp.readable = typeof conn.readable;
    out.tcp.writable = typeof conn.writable;
    try {
      const r = conn.write("user HB9OM-15 pass -1 vers OnField 1.0\r\n");
      out.tcp.writeString = { ok: true, result: String(r) };
    } catch (e: any) {
      out.tcp.writeString = { ok: false, error: String(e?.message || e) };
    }
    try {
      conn.close();
    } catch {
      /* ignore */
    }
  } catch (e: any) {
    out.tcp.connectError = String(e?.message || e);
  }

  // 2) Node net-Modul (Runtime ist Node-kompatibel)
  try {
    const net = (await import("node:net")).default;
    out.nodeNet.hasConnect = typeof net?.connect === "function";
    const data = await new Promise<string>((resolve) => {
      let buffer = "";
      let done = false;
      const socket = net.connect({ host: "rotate.aprs2.net", port: 14580 }, () => {
        socket.write("user HB9OM-15 pass -1 vers OnField 1.0 filter r/46.8/8.2/200\r\n");
      });
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        resolve(buffer.slice(0, 400) || "(keine Daten)");
      }, 15000);
      socket.on("data", (chunk: any) => {
        buffer += chunk.toString("utf8");
        if (buffer.split("\n").length > 6 && !done) {
          done = true;
          clearTimeout(timer);
          try {
            socket.destroy();
          } catch {
            /* ignore */
          }
          resolve(buffer.slice(0, 400));
        }
      });
      socket.on("error", (e: any) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve("ERROR: " + String(e?.message || e));
      });
    });
    out.nodeNet.firstData = data;
  } catch (e: any) {
    out.nodeNet.error = String(e?.message || e);
  }

  return Response.json(out);
}