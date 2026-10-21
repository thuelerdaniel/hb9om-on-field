import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { exportRepeatersPdf } from "@/lib/repeaterPdfExport";
import { uploadPdfBlob } from "@/lib/pdfDelivery";
import PdfReadyToastAction from "@/components/map/PdfReadyToastAction";
import { collectDisplayedRepeaters, REPEATER_VIEWPORT_PADDING } from "@/lib/repeaterDisplayPipeline";

// Repeater PDF list — the list contains exactly the repeaters the map is showing right now:
// the shared display pipeline (country/continent/mode/search/radius/links), then viewport
// culling and the same marker cap as the map rendering. Generation runs in chunks with a
// progress overlay. The finished file is then stored through the backend and delivered as a
// real https URL (src/lib/pdfDelivery.js) — locally created blob: URLs are not used any more,
// those are exactly what WebViews and home-screen apps refuse to open.
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

      // Store the file and deliver its real https URL. A URL works everywhere — including
      // WebViews and home-screen apps, where a scripted download/blob URL does nothing.
      setPdfExport(prev => (prev ? { ...prev, uploading: true } : prev));
      let url = null;
      try {
        url = await uploadPdfBlob(res.blob, res.filename);
      } catch (err) {
        const message = err?.response?.data?.error || err?.message || String(err);
        toast({
          variant: "destructive",
          title: "PDF konnte nicht bereitgestellt werden",
          description: `${message} — bitte erneut auf «PDF-Liste» tippen.`,
        });
        return;
      }

      // The toast never claims that a file arrived (we cannot know that): it reports that the
      // file is ready and links to it. No auto-dismiss, so the link stays available as long
      // as needed.
      toast({
        title: "PDF bereit",
        description: `${res.count} Relais · ${res.pages} Seiten · Datei: ${res.filename} — unten öffnen oder speichern`,
        duration: 0,
        action: <PdfReadyToastAction url={url} filename={res.filename} />,
      });
    } catch (err) {
      toast({ variant: "destructive", title: "PDF-Liste fehlgeschlagen", description: String(err?.message || err) });
    } finally {
      setPdfExport(null);
    }
  };

  return { pdfExport, handleExportRepeatersPdf };
}