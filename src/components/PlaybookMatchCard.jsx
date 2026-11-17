export default function PlaybookMatchCard({ playbook: pb }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">📖 Referenced Use Case / Playbook</span>
        {pb && (
          <span className={`badge ${pb.matched ? 'badge-completed' : 'badge-pending'}`}>
            {pb.matched
              ? `matched via ${pb.how}${typeof pb.similarity === 'number' ? ` (${(pb.similarity * 100).toFixed(0)}%)` : ''}`
              : `not matched (${pb.how || 'miss'})`}
          </span>
        )}
      </div>

      {!pb && <p className="text-muted" style={{ fontSize: 13 }}>Not recorded.</p>}

      {pb?.matched && pb.playbook && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 3 }}>Use Case ID</div>
            <div className="td-mono" style={{ fontSize: 12 }}>{pb.playbook.use_case_id || '—'}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 3 }}>Playbook</div>
            <div style={{ fontSize: 13 }}>
              {pb.playbook.url ? (
                <a href={pb.playbook.url} target="_blank" rel="noreferrer">{pb.playbook.alert_name}</a>
              ) : (
                pb.playbook.alert_name
              )}
            </div>
          </div>
          {pb.playbook.version && (
            <div>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 3 }}>Version</div>
              <div className="td-mono" style={{ fontSize: 12 }}>{pb.playbook.version}</div>
            </div>
          )}
          {pb.matchedField && (
            <div>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 3 }}>Matched Field</div>
              <div className="td-mono" style={{ fontSize: 12 }}>{pb.matchedField}</div>
            </div>
          )}
        </div>
      )}

      {pb && !pb.matched && (
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
          {pb.note || 'No matching playbook found for this alert.'}
        </p>
      )}

      {pb?.stale && (
        <div className="alert alert-warning" style={{ marginTop: 10 }}>
          Playbook index is stale (the last Confluence sync failed); matched against the last good copy.
        </div>
      )}
    </div>
  )
}
