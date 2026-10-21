import React from "react";
import { Loader2 } from "lucide-react";

// Progress overlay while the repeater PDF list is generated in chunks.
// Purely informational — the map stays usable underneath.
export default function PdfExportProgress({ progress = 0, count = 0, uploading = false }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="fixed inset-x-0 top-16 z-[2200] flex justify-center pointer-events-none px-3">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 w-[min(92vw,340px)]">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            {uploading ? "PDF wird bereitgestellt…" : "PDF-Liste wird erstellt…"}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {count} Relais · {uploading ? "Datei wird im Speicher abgelegt" : `${pct}%`}
          </p>
          <div className="mt-1.5 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-200" style={{ width: `${uploading ? 100 : pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}