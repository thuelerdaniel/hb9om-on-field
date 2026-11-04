import React, { useState } from "react";
import { Download, ExternalLink, Link as LinkIcon, Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Aktionen in der Einblendung «PDF bereit».
//
// Punkt E: Die erzeugte Datei liegt bereits als echte https-Adresse im Datei-Speicher
// (pdfDelivery.js → uploadGeneratedPdf). Darum gilt:
//  1. «Speichern / Teilen» ist ein Knopf, kein nackter Download mehr. Er nutzt
//     navigator.share (mit der Datei) — als ZUSATZ. Wo das nicht geht (Desktop,
//     WebView ohne Share), öffnet er die https-Adresse; dort lässt sich das PDF
//     in jedem Browser speichern.
//  2. Die https-Adresse steht zusätzlich als Text in der Einblendung und lässt sich
//     kopieren — ein Weg, der in jedem Browser, jeder PWA und jedem WebView
//     funktioniert. Die Einblendung bleibt offen, bis der Nutzer sie schliesst.
export default function PdfReadyToastAction({ url, filename }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold touch-manipulation";

  const handleShare = async () => {
    setBusy(true);
    try {
      // Zusatz: echter System-Teilen-Dialog mit der Datei, wenn unterstützt
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const file = new File([blob], filename || "relais.pdf", { type: "application/pdf" });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename || "PDF" });
            return;
          }
        } catch (err) {
          // Abbruch durch den Nutzer ist kein Fehler
          if (err && err.name === "AbortError") return;
          // sonst: Fallback unten
        }
      }
      // Immer funktionierender Weg: echte https-Adresse öffnen
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Kopieren nicht möglich", description: "Bitte den Link markieren und kopieren." });
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleShare}
          disabled={busy}
          className={`${base} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60`}
          style={{ minHeight: 40 }}
        >
          <Download className="w-3.5 h-3.5" />
          {busy ? "Wird geöffnet…" : "Speichern / Teilen"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
          style={{ minHeight: 40 }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Im Tab öffnen
        </a>
      </div>

      {/* Echte https-Adresse — funktioniert überall, auch in PWA/WebView */}
      <div className="flex items-center gap-1.5 rounded-md bg-gray-50 border border-gray-200 px-2 py-1">
        <LinkIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
        <span className="text-[10px] text-gray-700 truncate flex-1 font-mono">{url}</span>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-600"
          title="Link kopieren"
        >
          {copied ? <Check className="w-3 h-3 text-green-600" /> : <span className="text-[10px] font-semibold">Kopieren</span>}
        </button>
      </div>
    </div>
  );
}