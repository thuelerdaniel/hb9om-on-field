import React from "react";
import { Download, ExternalLink } from "lucide-react";

// Action links inside the "PDF bereit" toast.
//
// Both are plain links on the real https URL of the stored file — no script, no blob URL.
// That is the one form every browser, WebView and home-screen app can actually open, save
// and share; a scripted download or a scripted share is what silently did nothing before.
export default function PdfReadyToastAction({ url, filename }) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold touch-manipulation";
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <a
        href={url}
        download={filename}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} bg-blue-600 text-white hover:bg-blue-700`}
        style={{ minHeight: 36 }}
      >
        <Download className="w-3.5 h-3.5" />
        Speichern / Teilen
      </a>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
        style={{ minHeight: 36 }}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Im Tab öffnen
      </a>
    </div>
  );
}