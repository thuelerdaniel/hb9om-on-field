import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Global error boundary — prevents a single failed layer from crashing the entire app.
// Shows a non-blocking error banner instead of a white screen.
export default class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[MapErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="max-w-sm mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
              Ein Fehler ist aufgetreten
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {this.state.error?.message || "Die Karte konnte nicht geladen werden."}
            </p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" />
              Erneut versuchen
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}