import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { base44 } from '@/api/base44Client'

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

// Detect APK WebView and inject CSS overrides for rendering bugs.
// Android WebView supports backdrop-filter poorly (can render as solid white box,
// clipping child content) and env(safe-area-inset-*) can return wrong values.
// - display-mode: standalone → PWA/APK launched from home screen
// - navigator.userAgent contains 'wv' → Android System WebView
// - document.referrer starts with 'android-app://' → APK WebView
if (typeof window !== 'undefined') {
  try {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isWebViewUA = /wv/.test(navigator.userAgent || '');
    const isAndroidApp = (document.referrer || '').startsWith('android-app://');
    if (isStandalone || isWebViewUA || isAndroidApp) {
      document.documentElement.classList.add('apk-webview');
      // Inject CSS at runtime to avoid PostCSS/Tailwind build issues
      const style = document.createElement('style');
      style.textContent = `
        .apk-webview .backdrop-blur-sm,
        .apk-webview .backdrop-blur,
        .apk-webview .backdrop-blur-md,
        .apk-webview .backdrop-blur-lg {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .apk-webview .leaflet-control-attribution {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          background: rgba(255, 255, 255, 0.95) !important;
        }
        .apk-webview .h-screen {
          height: 100dvh !important;
        }
      `;
      document.head.appendChild(style);
    }
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