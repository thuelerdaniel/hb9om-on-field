import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { exportRepeatersPdf } from "@/lib/repeaterPdfExport";
import { attemptAutomaticDownload } from "@/lib/pdfDelivery";
import PdfReadyToastAction from "@/components/map/PdfReadyToastAction";
import { collectDisplayedRepeaters, REPEATER_VIEWPORT_PADDING } from "@/lib/repeaterDisplayPipeline";

// Repeater PDF list — the list contains exactly the repeaters the map is showing right now:
// the shared display pipeline (country/continent/mode/search/radius/links), then viewport
// culling and the same marker cap as the map rendering. Generation runs in chunks with a
// progress overlay. Delivering the finished file is separate (src/lib/pdfDelivery.js):
// one automatic download attempt where such a download works, plus share/open buttons that
// run on the user's own gesture — a download started after the asynchronous generation is
// blocked or swallowed by some browsers (iOS, WebViews, Home-Screen apps).
// Every outcome is reported with a toast — never a native dialog, those can be suppressed
// by the browser and fail without a trace.
export default function useRepeaterPdfExport({
  mapRef, repeaters,
  filterModes, exclusiveModes, searchQuery, filterCountries,
  activeContinents, activeCountries, radiusKm,
  position, showOnlyLinked, adminLinks,
}) {
  const [pdfExport, setPdfExport] = useState(null);

  const handleExportRepeatersPdf = async () => {
    if (pdfExport) return;
    let bounds = null;
    let center = null;
    const map = mapRef?.current;
    if (map) {
      try {
        const b = map.getBounds();
        if (b) {
          bounds = b.pad(REPEATER_VIEWPORT_PADDING);
          const c = map.getCenter();
          if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) center = [c.lat, c.lng];
        }
      } catch {
        bounds = null;
        center = null;
      }
    }

    const displayed = collectDisplayedRepeaters({
      repeaters, filterModes, exclusiveModes, searchQuery, filterCountries,
      activeContinents, activeCountries, radiusKm,
      userPosition: position, showOnlyLinked, adminLinks,
    }, bounds);

    setPdfExport({ progress: 0, count: displayed.length });
    try {
      const res = await exportRepeatersPdf(displayed, {
        modes: filterModes, exclusive: exclusiveModes,
        countries: filterCountries, continents: activeContinents,
        search: searchQuery, radiusKm,
        onlyLinked: showOnlyLinked, bounds, center,
      }, {
        onProgress: (p) => setPdfExport(prev => (prev ? { ...prev, progress: p } : prev)),
      });

      if (!res.ok) {
        const empty = res.reason === "empty";
        toast({
          variant: empty ? "default" : "destructive",
          title: empty ? "Keine Relais im Kartenausschnitt" : "PDF-Liste fehlgeschlagen",
          description: res.message,
        });
        return;
      }

      // The toast never claims that a download arrived (we cannot know that): it reports that
      // the file is ready and offers the ways to it. It has no auto-dismiss, so the way to the
      // file stays available as long as needed.
      const auto = attemptAutomaticDownload(res.blob, res.filename);
      toast({
        title: "PDF bereit",
        description: `${res.count} Relais · ${res.pages} Seiten · Datei: ${res.filename}${auto === "deferred" ? " — bitte unten speichern" : ""}`,
        duration: 0,
        action: <PdfReadyToastAction blob={res.blob} filename={res.filename} />,
      });
    } catch (err) {
      toast({ variant: "destructive", title: "PDF-Liste fehlgeschlagen", description: String(err?.message || err) });
    } finally {
      setPdfExport(null);
    }
  };

  return { pdfExport, handleExportRepeatersPdf };
}