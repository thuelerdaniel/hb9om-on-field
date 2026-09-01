import React from "react";
import { Loader2, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * DeleteProgressOverlay — v0.9018 FORTSCHRITSANZEIGE
 * Full-screen overlay shown while Log entries are being deleted.
 * Blocks UI interaction until deletion completes.
 *
 * Props:
 *   phase: 'deleting' | 'done' | 'error'
 *   count: number — entries deleted so far (during 'deleting') or total (at 'done')
 *   total: number|null — total to delete (if known), for "X von Y" display
 *   message: string — optional custom message (used at 'done'/'error')
 *   onClose: function — called when user dismisses the 'done'/'error' state
 */
export default function DeleteProgressOverlay({ phase, count, total, message, onClose }) {
  if (phase === null || phase === undefined) return null;

  const isDeleting = phase === "deleting";
  const isDone = phase === "done";
  const isError = phase === "error";

  return (
    <div className="fixed inset-0 z-[10002] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        {isDeleting && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
              Log-Einträge löschen...
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {total != null && total > 0
                ? `${count || 0} von ${total} Einträgen gelöscht`
                : `${count || 0} Einträge gelöscht`}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              Bitte warten — dies kann einen Moment dauern.
            </p>
          </>
        )}

        {isDone && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
              Fertig!
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {message || `${count} Einträge erfolgreich gelöscht`}
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full px-4 py-2.5 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600"
            >
              OK
            </button>
          </>
        )}

        {isError && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
              Fehler beim Löschen
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {message || "Ein Fehler ist aufgetreten."}
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
            >
              OK
            </button>
          </>
        )}
      </div>
    </div>
  );
}