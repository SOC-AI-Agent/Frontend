export default function StatusBadge({ status }) {
  const map = {
    pending:    'badge-pending',
    processing: 'badge-processing',
    completed:  'badge-completed',
    failed:     'badge-failed',
  }
  return <span className={`badge ${map[status] || 'badge-pending'}`}>{status}</span>
}
