import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const PU = "#7c3aed";

/**
 * Route guard that restricts access based on user role.
 * @param {string[]} roles — allowed roles (e.g. ["admin", "officer"])
 * @param {string} redirect — where to send unauthorized users
 */
export default function RoleRoute({ children, roles = [], redirect = "/login" }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
        <div className="text-center">
          <div className="spinner-border mb-3" style={{ width: "2.5rem", height: "2.5rem", color: PU }} role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const userRole = user.role || "driver";
  if (roles.length > 0 && !roles.includes(userRole)) {
    return <Navigate to={redirect} replace />;
  }

  return children;
}
