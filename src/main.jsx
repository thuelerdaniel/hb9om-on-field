import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { base44 } from '@/api/base44Client'
import { cleanupLargeLocalStorageData } from '@/lib/safeStorage'

// Remove large legacy data from localStorage that should be in IndexedDB.
// Runs once at app start — prevents QuotaExceededError on Android (5MB localStorage limit).
// Large reference data (SOTA, POTA, repeaters) is stored in IndexedDB (50MB+ capacity).
try {
  cleanupLargeLocalStorageData();
} catch {}

// Global error handler — reports crashes to admins who opted in
const reportedErrors = new Set();

function reportError(errorType, message, stack) {
  const errorKey = `${errorType}:${String(message || '').slice(0, 100)}`;
  if (reportedErrors.has(errorKey)) return;
  reportedErrors.add(errorKey);

  try {
    base44.functions.invoke('reportAppError', {
      errorType,
      message: String(message || ''),
      stack: String(stack || ''),
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }).catch(() => {});
  } catch (e) {}
}

window.addEventListener('error', (event) => {
  reportError('runtime', event.message, event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportError('unhandled_promise', reason?.message || String(reason), reason?.stack);
});

try {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
} catch (renderError) {
  // Fallback: Wenn React selbst nicht rendern kann
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="position:fixed;inset:0;background:#0d1720;color:#e2e8f0;
      display:flex;align-items:center;justify-content:center;
      font-family:monospace;padding:20px;">
        <div style="max-width:600px">
          <h2 style="color:#ef4444">Render-Fehler</h2>
          <pre style="color:#f87171;font-size:13px;white-space:pre-wrap">
            ${renderError.message}
          </pre>
          <pre style="color:#64748b;font-size:11px;white-space:pre-wrap;margin-top:16px">
            ${renderError.stack || ''}
          </pre>
          <button onclick="window.location.href='/'"
            style="margin-top:16px;padding:10px 24px;background:#06b6d4;
            color:#000;border:none;border-radius:8px;cursor:pointer">
            Neu laden
          </button>
        </div>
      </div>
    `;
  }
  console.error('Render error:', renderError);
}