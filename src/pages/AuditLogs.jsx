import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import Layout from '../components/Layout'
import Pagination from '../components/Pagination'
import client from '../api/client'
import { endpoints } from '../api/endpoints'

const EVENT_TYPES = [
  '', 'ANALYZE_REQUEST', 'JOB_QUEUED', 'JOB_PROCESSING', 'JOB_COMPLETED', 'JOB_FAILED',
  'AUTH_LOGIN', 'AUTH_FAILED', 'AUTH_KEY_FAILED',
  'KEY_CREATED', 'KEY_REVOKED',
  'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
  'SYSTEM_CLEANUP', 'AUDIT_EXPORTED',
]

const STATUS_CODES = ['', '200', '201', '202', '400', '401', '403', '404', '422', '500']

const EVENT_COLORS = {
  JOB_COMPLETED:   'badge-completed',
  JOB_FAILED:      'badge-failed',
  JOB_PROCESSING:  'badge-processing',
  JOB_QUEUED:      'badge-pending',
  ANALYZE_REQUEST: 'badge-pending',
  AUTH_LOGIN:      'badge-completed',
  AUTH_FAILED:     'badge-failed',
  AUTH_KEY_FAILED: 'badge-failed',
  KEY_CREATED:     'badge-processing',
  KEY_REVOKED:     'badge-failed',
  USER_CREATED:    'badge-processing',
  USER_UPDATED:    'badge-processing',
  USER_DELETED:    'badge-failed',
  SYSTEM_CLEANUP:  'badge-pending',
  AUDIT_EXPORTED:  'badge-processing',
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [eventFilter, setEventFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [ipFilter, setIpFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ skip: page * limit, limit })
      if (eventFilter) params.set('event_type', eventFilter)
      if (actorFilter) params.set('actor_label', actorFilter)
      if (ipFilter) params.set('ip_address', ipFilter)
      if (statusFilter) params.set('status_code', statusFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const res = await client.get(`${endpoints.auditLogs.list}?${params}`)
      setLogs(res.data.items || [])
      setTotal(res.data.total || 0)
    } finally { setLoading(false) }
  }

  const resetFilters = () => {
    setEventFilter(''); setActorFilter(''); setIpFilter('')
    setStatusFilter(''); setDateFrom(''); setDateTo('')
    setPage(0)
  }

  useEffect(() => { load() }, [page, limit, eventFilter, actorFilter, ipFilter, statusFilter, dateFrom, dateTo])

  const exportCsv = async () => {
    try {
      const res = await client.get(endpoints.auditLogs.export, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0,10)}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Export Failed',
        text: err.response?.data?.detail || err.message || 'Unable to export audit logs.',
        confirmButtonText: 'OK',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#38bdf8',
      })
    }
  }

  const fmt = (d) => d ? new Date(d).toLocaleString() : '—'
  const hasActiveFilter = eventFilter || actorFilter || ipFilter || statusFilter || dateFrom || dateTo

  return (
    <Layout title="Audit Logs">
      <div className="page-header">
        <div>
          <div className="page-title">Audit Trail</div>
          <div className="page-sub">{total} total entries{hasActiveFilter && ' (filtered)'}</div>
        </div>
        <button className="btn btn-ghost" onClick={exportCsv}>↓ Export CSV</button>
      </div>

      {/* Filter Row 1: Event, Actor, IP */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <select className="form-select" value={eventFilter}
          onChange={(e) => { setEventFilter(e.target.value); setPage(0) }} style={{ minWidth: 180 }}>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t || 'All Events'}</option>)}
        </select>

        <input className="form-input" placeholder="Filter by actor…" value={actorFilter}
          onChange={(e) => { setActorFilter(e.target.value); setPage(0) }} style={{ minWidth: 160 }} />

        <input className="form-input" placeholder="Filter by IP…" value={ipFilter}
          onChange={(e) => { setIpFilter(e.target.value); setPage(0) }} style={{ minWidth: 140 }} />

        <select className="form-select" value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }} style={{ minWidth: 130 }}>
          {STATUS_CODES.map((c) => <option key={c} value={c}>{c || 'All Status'}</option>)}
        </select>

        {/* Filter Row 2: Date Range */}
        <input className="form-input" type="date" value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
          title="Date From" style={{ minWidth: 145 }} />

        <input className="form-input" type="date" value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
          title="Date To" style={{ minWidth: 145 }} />

        {hasActiveFilter && (
          <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ color: '#f87171' }}>
            ✕ Clear
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Endpoint</th>
                  <th>IP</th>
                  <th>Job ID</th>
                  <th>Status</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="td-mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(l.timestamp)}</td>
                    <td><span className={`badge ${EVENT_COLORS[l.event_type] || 'badge-pending'}`} style={{ fontSize: 10 }}>{l.event_type}</span></td>
                    <td className="td-mono">{l.actor_label || '—'}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{l.http_method && `${l.http_method} `}{l.endpoint || '—'}</td>
                    <td className="td-mono">{l.ip_address || '—'}</td>
                    <td className="td-mono">{l.job_id ? l.job_id.slice(0, 8) + '…' : '—'}</td>
                    <td className="td-mono">{l.status_code || '—'}</td>
                    <td className="td-mono">{l.duration_ms ? `${l.duration_ms}ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">▣</div>
                <div>{hasActiveFilter ? 'No entries match the current filters' : 'No audit log entries'}</div>
              </div>
            )}
          </div>
        )}

        <Pagination
          total={total}
          limit={limit}
          page={page}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(0); }}
        />
      </div>
    </Layout>
  )
}
