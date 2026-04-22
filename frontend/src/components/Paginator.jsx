/**
 * Reusable server-side paginator.
 * Props:
 *   page        – current 1-based page number
 *   total       – total item count from API
 *   pageSize    – items per page
 *   onChange    – (newPage: number) => void
 *   loading     – disable buttons while loading
 *   variant     – "default" | "purple" (accent colour override)
 */

const PU = "#7c3aed";
const PA = (a) => `rgba(124,58,237,${a})`;

function pageNumbers(page, totalPages) {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 4)
    return [1, 2, 3, 4, 5, "…", totalPages];
  if (page >= totalPages - 3)
    return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
}

export default function Paginator({ page, total, pageSize, onChange, loading = false }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start      = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end        = Math.min(page * pageSize, total);

  const btn = (label, targetPage, active = false, disabled = false) => (
    <button
      key={label}
      disabled={disabled || loading}
      onClick={() => !disabled && !loading && onChange(targetPage)}
      style={{
        minWidth: 34, height: 34,
        padding: "0 8px",
        borderRadius: 8,
        border: active
          ? `1.5px solid ${PU}`
          : "1.5px solid var(--border-color, #e2e8f0)",
        background: active ? PU : "var(--card-bg, #fff)",
        color: active
          ? "#fff"
          : disabled
          ? "var(--text-muted, #cbd5e1)"
          : "var(--text-color, #334155)",
        fontWeight: active ? 700 : 500,
        fontSize: ".85rem",
        cursor: disabled || loading ? "default" : "pointer",
        transition: "all .15s",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {label}
    </button>
  );

  const nums = pageNumbers(page, totalPages);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px",
        padding: "10px 16px",
        borderTop: "1px solid var(--border-color, #f1f5f9)",
        background: "var(--table-head-bg, #f8faff)",
        borderRadius: "0 0 14px 14px",
        fontSize: ".82rem",
        color: "var(--text-muted, #64748b)",
      }}
    >
      {/* info */}
      <span>
        {total === 0 ? "No results" : (
          <>Showing <strong style={{ color: "var(--text-color, #1e293b)" }}>{start}–{end}</strong> of{" "}
          <strong style={{ color: "var(--text-color, #1e293b)" }}>{total}</strong></>
        )}
      </span>

      {/* buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* prev */}
        {btn(
          <i className="bi bi-chevron-left" style={{ fontSize: ".75rem" }} />,
          page - 1,
          false,
          page === 1
        )}

        {nums.map((n, i) =>
          n === "…"
            ? (
              <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: "var(--text-muted, #94a3b8)" }}>…</span>
            )
            : btn(n, n, n === page)
        )}

        {/* next */}
        {btn(
          <i className="bi bi-chevron-right" style={{ fontSize: ".75rem" }} />,
          page + 1,
          false,
          page === totalPages
        )}
      </div>
    </div>
  );
}
