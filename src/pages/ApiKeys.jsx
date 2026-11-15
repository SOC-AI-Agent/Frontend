import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import Layout from '../components/Layout'
import Pagination from '../components/Pagination'
import ConfirmModal from '../components/ConfirmModal'
import client from '../api/client'
import { endpoints } from '../api/endpoints'
import useAuthStore from '../stores/authStore'
import { copyToClipboard } from '../utils/clipboard'

export default function ApiKeys() {
  const [keys, setKeys] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [form, setForm] = useState({ name: '', expires_days: '' })
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(20)

  // Confirm Revoke
  const [keyToRevoke, setKeyToRevoke] = useState(null)
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [revokeError, setRevokeError] = useState('')

  const load = async () => {
    const res = await client.get(endpoints.apiKeys.list)
    setKeys(res.data)
  }

  const { user } = useAuthStore()
  const canManageKeys = user?.role === 'admin' || user?.role === 'analyst'

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const body = { name: form.name }
      if (form.expires_days) body.expires_days = parseInt(form.expires_days)
      const res = await client.post(endpoints.apiKeys.list, body)
      setNewKey(res.data)
      setForm({ name: '', expires_days: '' })
      await load()
      setShowModal(false)
    } catch (err) {
        const detail = err.response?.data?.detail
        const message = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : (err.message || 'Unable to create API key.'))
        await Swal.fire({
          icon: 'error',
          title: 'Create Key Failed',
          text: message,
          confirmButtonText: 'OK',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#38bdf8',
        })
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeConfirm = async () => {
    if (!keyToRevoke) return
    setRevokeLoading(true)
    setRevokeError('')
    try {
      await client.delete(endpoints.apiKeys.byId(keyToRevoke.id))
      setKeyToRevoke(null)
      await load()
    } catch (err) {
      setRevokeError(err.response?.data?.detail || 'Revoke failed: Internal Server Error')
    } finally {
      setRevokeLoading(false)
    }
  }

  const copy = async (text) => {
    if (await copyToClipboard(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const paginatedKeys = keys.slice(page * limit, (page + 1) * limit)

  return (
    <Layout title="API Keys">
      <div className="page-header">
        <div>
          <div className="page-title">API Keys</div>
          <div className="page-sub">Manage keys for SOAR integration</div>
        </div>
        {canManageKeys && (
          <button className="btn btn-primary" onClick={() => { setNewKey(null); setShowModal(true) }}>+ Create Key</button>
        )}
      </div>

      {/* New key reveal */}
      {newKey && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--success)', '--border-subtle': 'rgba(0,229,160,0.2)' }}>
          <div className="card-title" style={{ color: 'var(--success)', marginBottom: 10 }}>
            ✓ Key Created — Copy now, it won't be shown again!
          </div>
          <div className="key-display">
            <span>{newKey.key}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => copy(newKey.key)}>
              {copied ? '✓ Copied' : '⎘ Copy'}
            </button>
          </div>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
            Header to use: <code style={{ color: 'var(--text-code)' }}>X-API-Key: {newKey.key}</code>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setNewKey(null)}>Dismiss</button>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Key Prefix</th>
                <th>Owner</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Last Used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedKeys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td className="td-mono">{k.key_prefix}…</td>
                  <td className="text-muted">{k.owner_username}</td>
                  <td className="text-muted">
                    {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td>
                    <span className={`badge ${k.is_active ? 'badge-completed' : 'badge-failed'}`}>
                      {k.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="td-mono" style={{ fontSize: 11 }}>
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                  </td>
                  <td>
                    {canManageKeys && k.is_active && (
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => setKeyToRevoke(k)}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {keys.length === 0 && <div className="empty-state">No API keys found</div>}
        </div>

        <Pagination 
          total={keys.length}
          limit={limit}
          page={page}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(0); }}
        />
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Create API Key</div>
            <form onSubmit={create}>
              <div className="form-group">
                <label className="form-label">Key Name</label>
                <input className="form-input" placeholder="e.g. SOAR Production" required
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Expires in (days) — leave empty for no expiry</label>
                <input className="form-input" type="number" placeholder="e.g. 365"
                  value={form.expires_days} onChange={(e) => setForm({ ...form, expires_days: e.target.value })} />
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Generate Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!keyToRevoke}
        title="Revoke API Key"
        message={`Are you sure you want to revoke key "${keyToRevoke?.name}"? Any service using this key will be blocked immediately.`}
        loading={revokeLoading}
        error={revokeError}
        onConfirm={handleRevokeConfirm}
        onCancel={() => { setKeyToRevoke(null); setRevokeError(''); }}
      />
    </Layout>
  )
}
