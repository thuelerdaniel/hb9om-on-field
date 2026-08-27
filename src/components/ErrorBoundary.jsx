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
    console.error('App Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace', background: '#0a0e17', color: '#ff6b6b', minHeight: '100vh' }}>
          <h2>Render-Fehler</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#aaa' }}>{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>Neu laden</button>
        </div>
      );
    }
    return this.props.children;
  }
}