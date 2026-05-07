import React from "react";

const PU = "#7c3aed";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="d-flex align-items-center justify-content-center"
          style={{ minHeight: "100vh", background: "var(--dm-bg, #f8f7fc)" }}
        >
          <div className="text-center px-4" style={{ maxWidth: 480 }}>
            <div
              style={{
                fontSize: "4rem",
                marginBottom: "1rem",
                color: PU,
              }}
            >
              ⚠️
            </div>
            <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
              Something went wrong
            </h2>
            <p className="text-muted mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <pre
                className="text-start mx-auto mb-4 p-3 rounded"
                style={{
                  maxWidth: 400,
                  fontSize: "0.8rem",
                  background: "rgba(124,58,237,0.06)",
                  color: "#e53e3e",
                  overflow: "auto",
                  maxHeight: 120,
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              className="btn btn-lg"
              style={{
                background: PU,
                color: "#fff",
                borderRadius: 12,
                padding: "0.6rem 2rem",
              }}
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
