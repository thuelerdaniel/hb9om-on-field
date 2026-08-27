import React, { useState, useEffect } from 'react';

export default function AppErrorBoundary({ children }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setError({
        message: e.message || 'Unknown error',
        stack: e.error?.stack || '',
        file: e.filename || '',
        line: e.lineno || 0
      });
    };
    const rejectionHandler = (e) => {
      const reason = e.reason;
      setError({
        message: reason?.message || String(reason),
        stack: reason?.stack || '',
        file: 'unhandledrejection',
        line: 0
      });
    };
    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', rejectionHandler);
    return () => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  if (error) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0d1720', color: '#e2e8f0', padding: '20px',
        fontFamily: 'monospace', overflow: 'auto'
      }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <h2 style={{ color: '#ef4444', fontSize: '18px', marginBottom: '16px' }}>
            App-Fehler erkannt
          </h2>
          <div style={{
            background: '#1a1a2e', padding: '16px', borderRadius: '8px',
            border: '1px solid #ef444433', marginBottom: '16px',
            fontSize: '13px', lineHeight: 1.5
          }}>
            <div style={{ color: '#fbbf24', marginBottom: '8px' }}>Fehler:</div>
            <div style={{ color: '#f87171', wordBreak: 'break-word' }}>
              {error.message}
            </div>
            {error.file && (
              <div style={{ color: '#94a3b8', marginTop: '8px', fontSize: '11px' }}>
                {error.file}:{error.line}
              </div>
            )}
            {error.stack && (
              <details style={{ marginTop: '12px' }}>
                <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Stack Trace</summary>
                <pre style={{
                  color: '#64748b', fontSize: '11px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '8px'
                }}>
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
          <button onClick={() => window.location.href = '/'} style={{
            background: '#06b6d4', color: '#000', border: 'none',
            padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold',
            cursor: 'pointer', fontSize: '14px'
          }}>
            App neu laden
          </button>
        </div>
      </div>
    );
  }

  return children;
}