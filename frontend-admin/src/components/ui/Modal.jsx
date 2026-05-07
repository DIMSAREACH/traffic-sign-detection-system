import { AnimatePresence, motion } from "framer-motion";

export default function Modal({ open, title, children, onClose, footer }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
          aria-modal="true"
          role="dialog"
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" />
          <motion.div
            className="relative w-full max-w-lg glass-strong rounded-xl2 border border-[color:var(--ds-border)]"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[color:var(--ds-border)]">
              <div className="min-w-0">
                <div className="text-base font-bold truncate">{title}</div>
              </div>
              <button
                type="button"
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[color:var(--ds-border)] hover:bg-black/5 dark:hover:bg-white/5 transition"
                onClick={onClose}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="px-5 py-4">{children}</div>

            {footer ? (
              <div className="px-5 py-4 border-t border-[color:var(--ds-border)]">{footer}</div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

