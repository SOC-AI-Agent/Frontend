import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Pagination from '../components/Pagination'
import client from '../api/client'
import { endpoints } from '../api/endpoints'
import { Link } from 'react-router-dom'

export default function Jobs() {
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(20)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ skip: page * limit, limit })
      if (statusFilter) params.set('status_filter', statusFilter)
      const res = await client.get(`${endpoints.jobs.list}?${params}`)
      setJobs(res.data.items || [])
      setTotal(res.data.total || 0)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page, limit, statusFilter])

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return 'badge-pending'
      case 'processing': return 'badge-processing'
      case 'completed': return 'badge-completed'
      case 'failed': return 'badge-failed'
      default: return 'badge-pending'
    }
  }

  return (
    <Layout title="Analysis Jobs">
      <div className="page-header">
        <div>
          <div className="page-title">Analysis History</div>
          <div className="page-sub">{total} total jobs found</div>
        </div>
      </div>

      <div className="filter-bar">
        <select 
          className="form-select" 
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
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
                  <th>Job ID</th>
                  <th>Alert ID</th>
                  <th>Alert Name</th>
                  <th>Model</th>
                  <th>Tokens</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.job_id}>
                    <td className="td-mono">
                      <Link to={`/jobs/${j.job_id}`} className="text-primary" style={{ textDecoration: 'none' }}>
                        {j.job_id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="td-mono">{j.alert_id}</td>
                    <td>{j.alert_name}</td>
                    <td className="text-muted">{j.model_used || '—'}</td>
                    <td className="td-mono">{j.tokens_prompt + j.tokens_eval || 0}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(j.status)}`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="td-mono">{j.processing_time_ms ? `${(j.processing_time_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{new Date(j.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jobs.length === 0 && (
              <div className="empty-state">No jobs found</div>
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
