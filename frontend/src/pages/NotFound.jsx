import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const PU = "#7c3aed";

export default function NotFound() {
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "100vh", background: "var(--dm-bg, #f8f7fc)" }}
    >
      <div className="text-center px-4" style={{ maxWidth: 480 }}>
        <h1
          style={{
            fontSize: "5rem",
            fontWeight: 800,
            color: PU,
            lineHeight: 1,
            marginBottom: 0,
          }}
        >
          404
        </h1>
        <h2 className="mb-3" style={{ fontWeight: 600, fontSize: "var(--fs-hero)" }}>
          {t("notFound.title")}
        </h2>
        <p className="text-muted mb-1" style={{ fontSize: "var(--fs-body)" }}>{t("notFound.message")}</p>
        <p
          className="text-muted mb-4"
          style={{ fontSize: "var(--fs-sm)", wordBreak: "break-all" }}
        >
          <code>{location.pathname}</code>
        </p>
        <Link
          to="/"
          className="btn btn-lg"
          style={{
            background: PU,
            color: "#fff",
            borderRadius: 12,
            padding: "0.6rem 2rem",
          }}
        >
          {t("notFound.goHome")}
        </Link>
      </div>
    </div>
  );
}
