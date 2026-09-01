import React from "react";
import { Loader2, Trash2, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

/**
 * DeleteProgressOverlay — v0.9018
 * Full-screen overlay with live progress bar + cancel button.
 *
 * Props:
 *   phase: 'deleting' | 'done' | 'error'
 *   count: number — entries deleted so far
 *   total: number|null — total to delete
 *   message: string — custom message at done/error
 *   onClose: function — dismiss done/error state
 *   onCancel: function — cancel during 'deleting' (optional)
 */
export default function DeleteProgressOverlay({ phase, count, total, message, onClose, onCancel }) {
  if (phase === null || phase === undefined) return null;

  const isDeleting = phase === "deleting";
  const isDone = phase === "done";
  const isError = phase === "error";
  const progress = total > 0 ? Math.round((count / total) * 100) : 0;

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
            {total > 0 && (
              <div className="mt-3 w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-red-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              {progress}% — Bitte warten...
            </p>
            {onCancel && (
              <button
                onClick={onCancel}
                className="mt-4 w-full px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Abbrechen
              </button>
            )}
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