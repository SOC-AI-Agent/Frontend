export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, loading, error }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title" style={{ color: 'var(--danger)' }}>⚠️ {title || 'Confirm Action'}</div>
        
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <p className="text-muted" style={{ margin: '16px 0', fontSize: 14 }}>
          {message || 'Are you sure you want to proceed?'}
        </p>
        <div className="flex gap-2 justify-end mt-4">
          <button 
            className="btn btn-ghost" 
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="btn btn-danger" 
            onClick={onConfirm}
            disabled={loading}
            style={{ minWidth: 100 }}
          >
            {loading ? <span className="spinner" /> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
