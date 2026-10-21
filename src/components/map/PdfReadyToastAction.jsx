import React, { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  canSharePdf, openPdfInTab, pdfFileFromBlob, savePdfOnGesture, isIosLike,
} from "@/lib/pdfDelivery";

// Action buttons inside the "PDF bereit" toast. Both run on a fresh user gesture, which is
// the reliable way to get the file out of the browser: the PDF already exists when the tap
// happens, so no automatic download has to be trusted.
export default function PdfReadyToastAction({ blob, filename }) {
  const [busy, setBusy] = useState(false);
  const file = pdfFileFromBlob(blob, filename);
  const canShare = canSharePdf(file);

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await savePdfOnGesture(blob, filename);
      if (result === "failed") {
        toast({
          variant: "destructive",
          title: "PDF konnte nicht gespeichert werden",
          description: "Bitte «Im Tab öffnen» verwenden und die Datei dort speichern.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = () => {
    if (!openPdfInTab(blob, filename)) {
      toast({
        variant: "destructive",
        title: "PDF konnte nicht geöffnet werden",
        description: "Der Browser hat das neue Fenster blockiert. Bitte Fenster/Popups für diese Seite erlauben.",
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 touch-manipulation"
        style={{ minHeight: 36 }}
      >
        <Download className="w-3.5 h-3.5" />
        {canShare ? "Speichern / Teilen" : (isIosLike() ? "Speichern" : "Erneut laden")}
      </button>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 touch-manipulation"
        style={{ minHeight: 36 }}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Im Tab öffnen
      </button>
    </div>
  );
}