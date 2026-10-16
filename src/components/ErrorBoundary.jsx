import React from "react";

// ErrorBoundary — fängt React-Render-Crashes und zeigt eine diagnostische Fehlerseite.
// Verbessert v0.959-HF6:
// (a) Loggt Fehlermeldung + Stacktrace-Kurzform in die Browser-Konsole
// (b) Aufklappbare Details per Tap (Fehlername + Nachricht + Component-Stack)
// (c) Zeigt denselben Fehler nur ONCE — keine Banner-Flut bei wiederholtem Wurf
// (d) "Bericht kopieren" Button für Daniel — kopiert Fehlerbericht als Text

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      expanded: false,
      copied: false,
    };
    // Track dismissed error signatures — prevents banner flood on repeated throw
    this.dismissedSignatures = new Set();
    this.currentSignature = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Build error signature — message + first meaningful stack frame
    const msg = error?.message || String(error);
    const stackLine = info?.componentStack?.split("\n").find(l => l.trim()) || "";
    this.currentSignature = `${msg}::${stackLine.trim()}`;

    // Store errorInfo for copy-report and details display
    this.setState({ errorInfo: info });

    // (a) Enhanced console logging — full diagnostic info
    console.group(`%c[ErrorBoundary${this.props.name ? ':' + this.props.name : ''}]`, 'color:#ef4444;font-weight:bold');
    console.error('Error:', error?.message || error);
    console.error('Name:', error?.name || 'Unknown');
    console.error('Stack:', error?.stack || 'no stack');
    console.error('Component Stack:', info?.componentStack || 'no component stack');
    console.groupEnd();
  }

  handleReload = () => {
    // Track dismissed signature — prevents re-showing same error
    if (this.currentSignature) {
      this.dismissedSignatures.add(this.currentSignature);
    }
    this.setState({ hasError: false, error: null, errorInfo: null, expanded: false, copied: false });
    this.currentSignature = null;
  };

  handleToggleDetails = () => {
    this.setState((prev) => ({ expanded: !prev.expanded }));
  };

  handleCopyReport = () => {
    const err = this.state.error;
    const info = this.state.errorInfo;
    const report = [
      `=== HB9OM On Field — Fehlerbericht ===`,
      `Zeit: ${new Date().toISOString()}`,
      `Komponente: ${this.props.name || 'App'}`,
      ``,
      `Fehlername: ${err?.name || 'Unknown'}`,
      `Fehlermeldung: ${err?.message || String(err)}`,
      ``,
      `=== Stack Trace ===`,
      err?.stack || 'no stack',
      ``,
      `=== Component Stack ===`,
      info?.componentStack || 'no component stack',
      ``,
      `=== Browser Info ===`,
      `URL: ${window.location.href}`,
      `UserAgent: ${navigator.userAgent}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight}`,
    ].join('\n');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(report).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      }).catch(() => {
        // Fallback: create a temporary textarea
        const ta = document.createElement('textarea');
        ta.value = report;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };

  render() {
    if (this.state.hasError) {
      // (c) Once-only: if this exact error was already dismissed, render minimal fallback
      // — prevents banner flood when the same crash re-occurs after "Neu laden"
      if (this.currentSignature && this.dismissedSignatures.has(this.currentSignature)) {
        return (
          <div style={{
            padding: '12px', textAlign: 'center', fontFamily: 'monospace',
            background: '#0a0e17', color: '#666', minHeight: '60px',
            fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span>⚠ {this.props.name || 'App'} — Fehler wurde bereits gemeldet. Seite neu laden zum Zurücksetzen.</span>
          </div>
        );
      }

      const err = this.state.error;
      const shortStack = err?.stack?.split('\n').slice(0, 4).join('\n') || '';

      return (
        <div style={{
          padding: '20px', textAlign: 'center', fontFamily: 'monospace',
          background: '#0a0e17', color: '#ff6b6b', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>
            ⚠ {this.props.name || 'App'} Fehler
          </h2>
          <pre style={{
            whiteSpace: 'pre-wrap', color: '#aaa', fontSize: '12px',
            maxWidth: '90vw', marginBottom: '12px',
          }}>
            {err?.message || String(err)}
          </pre>

          {/* (b) Tap to expand details */}
          <button
            onClick={this.handleToggleDetails}
            style={{
              marginTop: '4px', padding: '4px 12px', background: '#1a2b45', color: '#7dd3fc',
              border: '1px solid #2a3b55', borderRadius: '4px', cursor: 'pointer',
              fontSize: '11px', marginBottom: '8px',
            }}
          >
            {this.state.expanded ? '▲ Details ausblenden' : '▼ Details anzeigen'}
          </button>

          {this.state.expanded && (
            <div style={{
              textAlign: 'left', background: '#111', border: '1px solid #333',
              borderRadius: '6px', padding: '10px', maxWidth: '90vw', maxHeight: '40vh',
              overflow: 'auto', marginBottom: '12px',
            }}>
              <div style={{ color: '#7dd3fc', fontSize: '10px', marginBottom: '4px' }}>
                Fehlername: <span style={{ color: '#ff6b6b' }}>{err?.name || 'Unknown'}</span>
              </div>
              <div style={{ color: '#7dd3fc', fontSize: '10px', marginBottom: '8px' }}>
                Quelle: <span style={{ color: '#aaa' }}>{this.props.name || 'App'}</span>
              </div>
              <pre style={{
                whiteSpace: 'pre-wrap', color: '#888', fontSize: '10px', lineHeight: '1.4',
              }}>
                {shortStack}
              </pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '6px 16px', background: '#1a2b45', color: '#fff',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
              }}
            >
              Neu laden
            </button>
            {/* (d) Copy report button */}
            <button
              onClick={this.handleCopyReport}
              style={{
                padding: '6px 16px', background: this.state.copied ? '#22c55e' : '#1a2b45',
                color: this.state.copied ? '#fff' : '#7dd3fc',
                border: '1px solid #2a3b55', borderRadius: '4px', cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {this.state.copied ? '✓ Kopiert' : '📋 Bericht kopieren'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}