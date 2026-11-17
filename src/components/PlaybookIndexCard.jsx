import { useEffect, useState } from 'react'
import client from '../api/client'
import { endpoints } from '../api/endpoints'
import useAuthStore from '../stores/authStore'

/**
 * The playbooks the model is given as reference: what soc-ai has indexed from
 * Confluence (vectors in Qdrant), and a button for an admin to sync now
 * instead of waiting for the worker's next PLAYBOOK_SYNC_MINUTES.
 */
export default function PlaybookIndexCard() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState(null)

  const load = () =>
    client.get(endpoints.playbooks.status)
      .then((res) => { setStatus(res.data); setError('') })
      .catch((err) => setError(err.response?.data?.detail || 'Playbook status unavailable'))

  useEffect(() => { load() }, [])

  const sync = async () => {
    setSyncing(true)
    setResult(null)
    try {
      const { data } = await client.post(endpoints.playbooks.sync)
      setStatus(data.index)
      setResult({ ok: true, ...data.sync })
    } catch (err) {
      setResult({ ok: false, detail: err.response?.data?.detail || err.message || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  const source = status?.confluence
  const semantic = status?.semantic
  const fmt = (d) => (d ? new Date(d).toLocaleString() : '—')
  const fields = status ? [
    ['Playbooks', status.playbooks],
    ['Pages read', status.pages],
    ['Confluence space', source?.space_key || '—'],
    ['Last indexed', fmt(status.built_at)],
    ['Matching by meaning', semantic?.enabled ? `${semantic.model || 'on'} · ${semantic.embedded_fields ?? 0} vectors` : 'off'],
    ['Auto sync', source?.configured ? `every ${source.sync_minutes} min` : 'not configured'],
  ] : []

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span className="card-title">📚 Playbook Index (Confluence → Qdrant)</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {status && (
            <span className={`badge ${status.indexed && status.playbooks > 0 ? 'badge-completed' : 'badge-failed'}`}>
              {status.indexed && status.playbooks > 0 ? 'indexed' : 'empty'}
            </span>
          )}
          {isAdmin && (
            <button
              className="btn btn-primary btn-sm"
              onClick={sync}
              disabled={syncing || (source && !source.configured)}
              title={source && !source.configured ? 'Set CONFLUENCE_* in Backend/.env first' : 'Read Confluence now and re-index'}
            >
              {syncing ? 'Syncing…' : '⟳ Sync from Confluence'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {source && !source.configured && (
        <div className="alert alert-warning">
          Confluence is not configured, so the model gets no playbook as reference. Set{' '}
          <code>{source.missing.join(', ')}</code> in <code>Backend/.env</code>, then restart{' '}
          <code>soc-core-api</code> and <code>soc-core-worker</code>.
        </div>
      )}

      {result?.ok && (
        <div className="alert alert-success">
          Synced {result.pages} page(s) → {result.playbooks} playbook(s); {result.embedded} field(s) embedded
          into Qdrant, {result.reused} unchanged.
        </div>
      )}
      {result && !result.ok && <div className="alert alert-error">{result.detail}</div>}

      {status && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {fields.map(([label, value]) => (
            <div key={label}>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {semantic?.error && semantic.enabled && (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>Matching by meaning: {semantic.error}</div>
      )}
      {status?.skipped?.length > 0 && (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
          {status.skipped.length} page(s) are not playbooks (no use case ID, conditions or steps):{' '}
          {status.skipped.map((s) => s.title).filter(Boolean).join(', ')}
        </div>
      )}
      {status?.conflicts?.length > 0 && (
        <div className="text-danger" style={{ fontSize: 12, marginTop: 6 }}>
          {status.conflicts.length} name or ID claimed by two pages — only one of them is used.
        </div>
      )}
    </div>
  )
}
