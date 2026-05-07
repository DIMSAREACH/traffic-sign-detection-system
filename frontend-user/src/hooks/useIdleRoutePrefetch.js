import { useEffect } from "react";

/**
 * Load lazy route chunks when the browser is idle so the first sidebar click is usually instant.
 */
export function useIdleRoutePrefetch(prefetchFn) {
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) prefetchFn();
    };

    let id;
    if (typeof window.requestIdleCallback === "function") {
      id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    id = window.setTimeout(run, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [prefetchFn]);
}
