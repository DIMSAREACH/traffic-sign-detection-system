import Skeleton from "./Skeleton.jsx";

export default function SmartTable({
  columns,
  rows,
  loading,
  emptyTitle = "No results",
  emptySubtitle = "Try adjusting your search or filters.",
  keyField = "id",
}) {
  if (loading) {
    return (
      <div className="d-flex flex-column gap-2">
        <Skeleton className="h-[44px]" />
        <Skeleton className="h-[44px]" />
        <Skeleton className="h-[44px]" />
        <Skeleton className="h-[44px]" />
        <Skeleton className="h-[44px]" />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-5">
        <div className="fw-bold mb-1">{emptyTitle}</div>
        <div className="text-secondary">{emptySubtitle}</div>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table align-middle mb-0">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.thClassName} style={c.thStyle}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r?.[keyField] ?? JSON.stringify(r)}>
              {columns.map((c) => (
                <td key={c.key} className={c.tdClassName} style={c.tdStyle}>
                  {c.render ? c.render(r) : r?.[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

