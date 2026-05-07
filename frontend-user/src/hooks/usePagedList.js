import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function usePagedList(fetcher, { initialPageSize = 10, initialFilters = {} } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(initialFilters);

  const lastArgs = useRef(null);

  const params = useMemo(() => {
    const p = { page, page_size: pageSize, ...filters };
    if (search) p.search = search;
    return p;
  }, [page, pageSize, search, filters]);

  const reload = useCallback(async () => {
    lastArgs.current = params;
    setLoading(true);
    setError("");
    try {
      const data = await fetcher(params);
      const nextRows = data?.results ?? data ?? [];
      setRows(Array.isArray(nextRows) ? nextRows : []);
      setCount(Number.isFinite(data?.count) ? data.count : Array.isArray(nextRows) ? nextRows.length : 0);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to load data.");
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [fetcher, params]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    rows,
    loading,
    error,
    page,
    setPage,
    count,
    pageSize,
    setPageSize,
    search,
    setSearch,
    filters,
    setFilters,
    reload,
  };
}

