import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { base44 } from '@/api/base44Client'
import { cleanupLargeLocalStorageData } from '@/lib/safeStorage'

// Alte Service Worker deregistrieren (verhindert White-Screen durch veraltete Caches)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      console.log('Deregistering old service worker:', reg.scope);
      reg.unregister();
    });
  });
}
if ('caches' in window) {
  caches.keys().then(names => {
    if (names.some(n => n.includes('workbox') || n.includes('base44'))) {
      names.forEach(n => caches.delete(n));
    }
  });
}

// Remove large legacy data from localStorage that should be in IndexedDB.
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
  // Script-Lade-Fehler: Cache leeren und neu laden
  if (event.target && event.target.tagName === 'SCRIPT') {
    console.error('Script failed to load:', event.target.src);
    if (event.target.type === 'module') {
      console.error('Module script failed — clearing cache and reloading');
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(n => caches.delete(n)));
      }
      setTimeout(() => window.location.reload(), 1000);
    }
    return;
  }
  reportError('runtime', event.message, event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportError('unhandled_promise', reason?.message || String(reason), reason?.stack);
});

try {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
} catch (renderError) {
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

// White-Screen-Fallback: Wenn nach 5 Sekunden kein React-Inhalt, Seite neu laden
setTimeout(() => {
  const root = document.getElementById('root');
  if (root && root.children.length > 0) {
    const hasReactRendered = root.querySelector('[data-reactroot], [data-react-id]');
    const isStillSSR = root.querySelector('[data-source-location]');
    if (isStillSSR && !hasReactRendered && !root.querySelector('input, button[type]')) {
      console.error('React failed to hydrate — forcing reload');
      window.location.reload();
    }
  }
}, 5000);