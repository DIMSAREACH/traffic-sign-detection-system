import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const PU = "#7c3aed";

/**
 * StyledSelect — a beautiful custom dropdown that replaces native <select>.
 *
 * Props:
 *   value        – current value
 *   onChange      – (value) => void
 *   options       – [{ value, label, icon?, color?, bg? }]
 *   placeholder   – text when nothing selected
 *   disabled      – boolean
 *   icon          – Bootstrap icon class for the trigger (e.g. "bi-car-front")
 *   searchable    – show search input when > 6 options
 *   size          – "sm" | "md" (default "md")
 *   className     – extra class for root
 *   style         – extra style for root
 */
export default function StyledSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  disabled = false,
  icon,
  searchable: forceSearchable,
  size = "md",
  className = "",
  style = {},
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  const searchable = forceSearchable ?? options.length > 6;
  const selected = options.find((o) => String(o.value) === String(value));

  /* position the portal menu */
  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const menuH = Math.min(options.length * 42 + (searchable ? 44 : 0) + 16, 320);
    const flipUp = spaceBelow < menuH && r.top > menuH;
    setPos({
      top: flipUp ? r.top - menuH - 4 : r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 180),
    });
  }, [options.length, searchable]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePos]);

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  /* focus search input when opened */
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 60);
    }
    if (!open) setSearch("");
  }, [open, searchable]);

  /* keyboard nav */
  const handleKey = (e) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const isSm = size === "sm";

  const menu = open && createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
        background: "var(--card-bg, #fff)",
        borderRadius: 14,
        boxShadow: "0 12px 40px rgba(124,58,237,.13), 0 2px 12px rgba(0,0,0,.08)",
        border: "1.5px solid rgba(124,58,237,.15)",
        maxHeight: 320,
        display: "flex",
        flexDirection: "column",
        animation: "ssDropIn .15s ease",
      }}
    >
      {/* search */}
      {searchable && (
        <div style={{ padding: "8px 10px 4px", flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--input-bg, #f8fafc)", borderRadius: 10,
            padding: "6px 10px",
            border: "1px solid var(--border-color, #e2e8f0)",
          }}>
            <i className="bi bi-search" style={{ color: "#94a3b8", fontSize: ".8rem" }} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                border: "none", outline: "none", background: "transparent",
                fontSize: ".82rem", width: "100%",
                color: "var(--text-color, #1e293b)",
              }}
            />
          </div>
        </div>
      )}
      {/* options list */}
      <div style={{ overflowY: "auto", padding: "4px 6px 6px" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "12px 10px", color: "#94a3b8", fontSize: ".82rem", textAlign: "center" }}>
            No results
          </div>
        )}
        {filtered.map((o) => {
          const isActive = String(o.value) === String(value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: isSm ? "7px 10px" : "9px 12px",
                border: "none", borderRadius: 10, cursor: "pointer",
                background: isActive ? (o.bg || "rgba(124,58,237,.08)") : "transparent",
                color: isActive ? (o.color || PU) : "var(--text-color, #1e293b)",
                fontSize: isSm ? ".8rem" : ".85rem",
                fontWeight: isActive ? 700 : 500,
                transition: "all .12s",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "var(--row-hover, rgba(124,58,237,.04))";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              {/* icon or color dot */}
              {(o.icon || o.color) && (
                <span style={{
                  width: isSm ? 26 : 30, height: isSm ? 26 : 30, borderRadius: 8,
                  background: o.bg || `${o.color || PU}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {o.icon
                    ? <i className={`bi ${o.icon}`} style={{ fontSize: ".82rem", color: o.color || PU }} />
                    : <span style={{ width: 10, height: 10, borderRadius: "50%", background: o.color }} />
                  }
                </span>
              )}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {o.label}
              </span>
              {isActive && (
                <i className="bi bi-check2" style={{ color: o.color || PU, fontSize: ".95rem", flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );

  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKey}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: isSm ? "6px 10px" : "9px 14px",
          background: "var(--input-bg, #fff)",
          border: `1.5px solid ${open ? PU : "var(--border-color, #e2e8f0)"}`,
          borderRadius: 12,
          fontSize: isSm ? ".82rem" : ".92rem",
          color: selected ? "var(--text-color, #1e293b)" : "#94a3b8",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          opacity: disabled ? 0.55 : 1,
          transition: "border-color .2s, box-shadow .2s",
          boxShadow: open ? `0 0 0 3px rgba(124,58,237,.1)` : "none",
          textAlign: "left",
        }}
      >
        {/* leading icon */}
        {icon && (
          <i className={`bi ${icon}`} style={{ color: PU, fontSize: isSm ? ".85rem" : "1rem", flexShrink: 0 }} />
        )}
        {/* selected item icon */}
        {!icon && selected?.icon && (
          <i className={`bi ${selected.icon}`} style={{ color: selected.color || PU, fontSize: isSm ? ".85rem" : "1rem", flexShrink: 0 }} />
        )}
        {/* selected color dot */}
        {!icon && !selected?.icon && selected?.color && (
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: selected.color, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.label : placeholder}
        </span>
        <i
          className="bi bi-chevron-down"
          style={{
            fontSize: ".65rem", color: "#94a3b8", flexShrink: 0,
            transition: "transform .2s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>
      {menu}
    </div>
  );
}
