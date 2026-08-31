// GPX File Parser — extrahiert Wegpunkte (wpt) und Track-Punkte (trkpt) aus GPX-XML.
// Nutzt den Browser DOMParser (keine externe Bibliothek nötig).

export function parseGpxFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");
        const parseError = doc.querySelector("parsererror");
        if (parseError) {
          reject(new Error("Ungültiges GPX-XML"));
          return;
        }

        const waypoints = [];

        // wpt-Elemente (Waypoints)
        const wpts = doc.querySelectorAll("wpt");
        wpts.forEach((wpt, i) => {
          const lat = parseFloat(wpt.getAttribute("lat"));
          const lon = parseFloat(wpt.getAttribute("lon"));
          if (!isNaN(lat) && !isNaN(lon)) {
            const nameEl = wpt.querySelector("name");
            waypoints.push({
              lat,
              lon,
              name: nameEl ? nameEl.textContent.trim() : `WP${i + 1}`,
              order: i,
            });
          }
        });

        // trkpt-Elemente (Track-Punkte) — falls keine wpt gefunden wurden
        if (waypoints.length === 0) {
          const trkpts = doc.querySelectorAll("trkpt");
          trkpts.forEach((trkpt, i) => {
            const lat = parseFloat(trkpt.getAttribute("lat"));
            const lon = parseFloat(trkpt.getAttribute("lon"));
            if (!isNaN(lat) && !isNaN(lon)) {
              const nameEl = trkpt.querySelector("name");
              waypoints.push({
                lat,
                lon,
                name: nameEl ? nameEl.textContent.trim() : `TP${i + 1}`,
                order: i,
              });
            }
          });
        }

        // rtept-Elemente (Route-Punkte) — weitere Fallback-Quelle
        if (waypoints.length === 0) {
          const rtepts = doc.querySelectorAll("rtept");
          rtepts.forEach((rtept, i) => {
            const lat = parseFloat(rtept.getAttribute("lat"));
            const lon = parseFloat(rtept.getAttribute("lon"));
            if (!isNaN(lat) && !isNaN(lon)) {
              const nameEl = rtept.querySelector("name");
              waypoints.push({
                lat,
                lon,
                name: nameEl ? nameEl.textContent.trim() : `RP${i + 1}`,
                order: i,
              });
            }
          });
        }

        if (waypoints.length === 0) {
          reject(new Error("Keine Wegpunkte im GPX gefunden"));
          return;
        }

        resolve(waypoints);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsText(file);
  });
}