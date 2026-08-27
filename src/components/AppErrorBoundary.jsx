import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AppErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
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
                {this.state.error?.message || String(this.state.error)}
              </div>
              {this.state.error?.stack && (
                <details style={{ marginTop: '12px' }}>
                  <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Stack Trace</summary>
                  <pre style={{ color: '#64748b', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '8px' }}>
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              {this.state.errorInfo?.componentStack && (
                <details style={{ marginTop: '12px' }}>
                  <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Komponenten-Stack</summary>
                  <pre style={{ color: '#64748b', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '8px' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
            <button onClick={this.handleReload} style={{
              background: '#06b6d4', color: '#000', border: 'none',
              padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px'
            }}>
              App neu laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}