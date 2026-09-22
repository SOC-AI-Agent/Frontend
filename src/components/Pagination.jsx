export default function Pagination({ 
  total, 
  limit, 
  page, 
  onPageChange, 
  onLimitChange 
}) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 0) return null;

  // Generate page numbers
  const pages = [];
  const startPage = Math.max(0, page - 2);
  const endPage = Math.min(totalPages - 1, page + 2);

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="pagination-wrap">
      <div className="pagination-info">
        <span className="text-muted">Rows per page:</span>
        <select 
          className="form-select pagination-select" 
          value={limit} 
          onChange={(e) => onLimitChange(Number(e.target.value))}
        >
          {[10, 20, 50, 100].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="text-muted ml-4">
          Total: <strong>{total}</strong> items
        </span>
      </div>

      <div className="pagination-pages">
        <button 
          className="page-btn" 
          disabled={page === 0} 
          onClick={() => onPageChange(page - 1)}
        >
          ←
        </button>
        
        {startPage > 0 && <span className="pagination-dots">...</span>}
        
        {pages.map(p => (
          <button 
            key={p} 
            className={`page-btn ${p === page ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p + 1}
          </button>
        ))}

        {endPage < totalPages - 1 && <span className="pagination-dots">...</span>}

        <button 
          className="page-btn" 
          disabled={page >= totalPages - 1} 
          onClick={() => onPageChange(page + 1)}
        >
          →
        </button>
      </div>
    </div>
  );
}
