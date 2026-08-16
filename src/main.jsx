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

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)