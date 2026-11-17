import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import PlaybookIndexCard from '../components/PlaybookIndexCard'
import client from '../api/client'
import { endpoints } from '../api/endpoints'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentJobs, setRecentJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      client.get(endpoints.stats).catch(() => null),
      client.get(`${endpoints.jobs.list}?limit=5`),
    ]).then(([statsRes, jobsRes]) => {
      if (statsRes) setStats(statsRes.data)
      setRecentJobs(jobsRes.data.items || [])
    }).finally(() => setLoading(false))
  }, [])

  const statCards = stats ? [
    { label: 'Total Jobs',  value: stats.total_jobs,  accent: 'var(--primary)',  sub: 'all time' },
    { label: 'Completed',   value: stats.completed,   accent: 'var(--success)',  sub: 'successful' },
    { label: 'Pending',     value: stats.pending,     accent: 'var(--info)',     sub: 'in queue' },
    { label: 'Processing',  value: stats.processing,  accent: 'var(--warning)',  sub: 'running now' },
    { label: 'Failed',      value: stats.failed,      accent: 'var(--danger)',   sub: 'errors' },
    { label: 'Avg Time',    value: stats.avg_processing_ms ? `${(stats.avg_processing_ms/1000).toFixed(1)}s` : 'N/A',
      accent: 'var(--info)', sub: stats.model || 'ollama' },
    { label: 'Total Tokens', value: stats.total_tokens.toLocaleString(), accent: 'var(--primary)', sub: 'total used' },
    { label: 'Avg Tokens',  value: stats.avg_tokens.toLocaleString(),  accent: 'var(--success)', sub: 'per job' },
  ] : []

  const fmt = (d) => d ? new Date(d).toLocaleString() : '—'

  return (
    <Layout title="Dashboard">
      {loading ? (
        <div className="empty-state"><span className="spinner" /></div>
      ) : (
        <>
          <div className="page-header">
            <div>
              <div className="page-title">Overview</div>
              <div className="page-sub">Real-time analysis job statistics</div>
            </div>
          </div>

          <div className="stats-grid">
            {statCards.map((s) => (
              <div key={s.label} className="stat-card" style={{ '--accent': s.accent }}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <PlaybookIndexCard />

          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Analysis Jobs</span>
              <Link to="/jobs" className="btn btn-ghost btn-sm">View All →</Link>
            </div>
            {recentJobs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <div>No jobs yet. SOAR will send alerts to <code>/v1/analyze</code></div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Alert ID</th>
                      <th>Alert Name</th>
                      <th>Status</th>
                      <th>Model</th>
                      <th>Tokens</th>
                      <th>Time (ms)</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((j) => (
                      <tr key={j.job_id} style={{ cursor: 'pointer' }}>
                        <td><Link to={`/jobs/${j.job_id}`} className="td-mono text-primary">{j.alert_id}</Link></td>
                        <td className="truncate" style={{ maxWidth: 220 }}>{j.alert_name}</td>
                        <td><StatusBadge status={j.status} /></td>
                        <td className="td-mono">{j.model_used || '—'}</td>
                        <td className="td-mono">{(j.tokens_prompt + j.tokens_eval) || '—'}</td>
                        <td className="td-mono">{j.processing_time_ms || '—'}</td>
                        <td className="text-muted">{fmt(j.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}
