import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

const PU = "#7c3aed";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
        <div className="text-center">
          <div className="spinner-border mb-3" style={{ width: "2.5rem", height: "2.5rem", color: PU }} role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
          <div className="text-secondary fw-medium" style={{ fontSize: ".95rem" }}>Loading…</div>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
