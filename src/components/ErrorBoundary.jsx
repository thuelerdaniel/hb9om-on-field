import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary${this.props.name ? ':' + this.props.name : ''}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace', background: '#0a0e17', color: '#ff6b6b', minHeight: '100vh' }}>
          <h2>⚠ {this.props.name || 'App'} Fehler</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#aaa', fontSize: '13px' }}>{this.state.error?.message}</pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '10px', padding: '6px 16px', background: '#1a2b45', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}