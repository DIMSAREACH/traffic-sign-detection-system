import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ToastContext = createContext(null);

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = makeId();
      const entry = {
        id,
        title: toast?.title || "",
        message: toast?.message || "",
        variant: toast?.variant || "info",
        timeoutMs: Number.isFinite(toast?.timeoutMs) ? toast.timeoutMs : 3500,
      };
      setToasts((t) => [entry, ...t].slice(0, 4));
      if (entry.timeoutMs > 0) {
        window.setTimeout(() => dismiss(id), entry.timeoutMs);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed right-4 top-4 z-[1100] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-strong rounded-xl2 px-4 py-3 border border-[color:var(--ds-border)]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <span
                    className={
                      "inline-block h-2.5 w-2.5 rounded-full " +
                      (t.variant === "success"
                        ? "bg-green-500"
                        : t.variant === "warning"
                          ? "bg-amber-500"
                          : t.variant === "danger"
                            ? "bg-red-500"
                            : "bg-primary-700")
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {t.title ? <div className="font-bold text-sm">{t.title}</div> : null}
                  {t.message ? <div className="text-sm opacity-80 break-words">{t.message}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-xl border border-[color:var(--ds-border)] hover:bg-black/5 dark:hover:bg-white/5 transition"
                  aria-label="Dismiss"
                >
                  <i className="bi bi-x" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

