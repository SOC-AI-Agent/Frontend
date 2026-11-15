import { useMemo, useState } from 'react'

/**
 * One Splunk answer, made readable: what the rows have in common, when they
 * happened, which values dominate, and a table of what differs.
 *
 * Built from the rows the backend keeps beside each answer. Jobs from before the
 * rows were kept have only the text, which is shown as it always was.
 */

const MAX_COLUMNS = 10
const MAX_TOP_FIELDS = 4
const MAX_BARS = 8

// Splunk's own bookkeeping: never a column, never a chart.
const HIDDEN = new Set(['punct', 'linecount', 'splunk_server', 'splunk_server_group', 'timestartpos', 'timeendpos', 'eventtype', 'tag'])
const EMPTY = new Set(['', '-', 'null', 'none', 'n/a'])

const text = (v) => (v == null ? '' : Array.isArray(v) ? v.map(text).join(', ') : String(v))
const isEmpty = (v) => EMPTY.has(text(v).trim().toLowerCase())

function parseTime(v) {
  const s = text(v)
  if (!s) return null
  // Epoch seconds, as some searches return it.
  const t = /^\d{9,11}(\.\d+)?$/.test(s) ? Number(s) * 1000 : Date.parse(s)
  return Number.isNaN(t) ? null : t
}

const fmtTime = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + 'Z'

const SPANS = [
  [1e3, '1s'], [5e3, '5s'], [10e3, '10s'], [30e3, '30s'], [60e3, '1m'], [300e3, '5m'],
  [900e3, '15m'], [3600e3, '1h'], [6 * 3600e3, '6h'], [86400e3, '1d'],
]

function fmtSpan(ms) {
  if (ms < 1e3) return `${ms}ms`
  if (ms < 60e3) return `${Math.round(ms / 1e3)}s`
  if (ms < 3600e3) return `${Math.round(ms / 60e3)}m`
  if (ms < 86400e3) return `${(ms / 3600e3).toFixed(1)}h`
  return `${(ms / 86400e3).toFixed(1)}d`
}

/** Everything the views need, worked out once per answer. */
function analyse(rows) {
  const keys = []
  for (const r of rows) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k)
  const visible = keys.filter((k) => !HIDDEN.has(k) && !k.startsWith('date_') && (k === '_time' || !k.startsWith('_')))

  const times = rows.map((r) => parseTime(r._time))
  const hasTime = times.some((t) => t != null)

  const constant = []
  const varying = []
  let hiddenEmpty = 0
  for (const k of visible) {
    const values = rows.map((r) => r[k])
    if (values.every(isEmpty)) { hiddenEmpty += 1; continue }
    const distinct = new Set(values.map(text))
    if (k !== '_time' && rows.length > 1 && distinct.size === 1) constant.push([k, text(values[0])])
    else varying.push({ key: k, distinct: distinct.size })
  }
  // Time first, then the rest in the order Splunk gave them.
  varying.sort((a, b) => (a.key === '_time' ? -1 : b.key === '_time' ? 1 : 0))

  // A stats result: no events, a count per group. Charted as the counts themselves.
  const countKey = ['count', 'Count'].find((k) => rows.every((r) => r[k] != null && !Number.isNaN(Number(r[k]))))
  const stats = !hasTime && countKey && rows.length > 0

  // Fields worth a bar chart: a few distinct values, repeated across rows.
  const topFields = varying
    .filter((f) => f.key !== '_time' && f.key !== countKey && f.distinct >= 2 && f.distinct <= 10 && f.distinct < rows.length)
    .sort((a, b) => a.distinct - b.distinct)
    .slice(0, MAX_TOP_FIELDS)
    .map((f) => {
      const counts = new Map()
      for (const r of rows) {
        const v = isEmpty(r[f.key]) ? '(empty)' : text(r[f.key])
        counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      return { key: f.key, bars: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_BARS) }
    })

  let timeline = null
  if (hasTime) {
    const known = times.filter((t) => t != null)
    const first = Math.min(...known)
    const last = Math.max(...known)
    const range = last - first
    if (range > 0) {
      const [span, label] = SPANS.find(([ms]) => range / ms <= 40) ?? SPANS[SPANS.length - 1]
      const start = Math.floor(first / span) * span
      const buckets = new Array(Math.floor((last - start) / span) + 1).fill(0)
      for (const t of known) buckets[Math.floor((t - start) / span)] += 1
      timeline = { first, last, range, label, span, start, buckets }
    } else {
      timeline = { first, last, range: 0 }
    }
  }

  return { constant, varying, hiddenEmpty, topFields, timeline, stats, countKey }
}

function Bars({ bars, total }) {
  const max = Math.max(...bars.map(([, n]) => n), 1)
  return (
    <div className="sr-bars">
      {bars.map(([label, n]) => (
        <div key={label} className="sr-bar-row" title={`${label}: ${n}`}>
          <span className="sr-bar-label td-mono">{label}</span>
          <span className="sr-bar-track">
            <span className="sr-bar-fill" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="sr-bar-n">{n}{total ? <span className="text-muted"> · {Math.round((n / total) * 100)}%</span> : null}</span>
        </div>
      ))}
    </div>
  )
}

function Timeline({ t }) {
  if (t.range === 0) {
    return <div className="text-muted sr-note">All events at {fmtTime(t.first)}.</div>
  }
  const max = Math.max(...t.buckets, 1)
  const w = 100 / t.buckets.length
  return (
    <div>
      <svg className="sr-timeline" viewBox="0 0 100 40" preserveAspectRatio="none" role="img"
        aria-label={`Events per ${t.label}`}>
        {t.buckets.map((n, i) => n > 0 && (
          <rect key={i} x={i * w + w * 0.1} width={w * 0.8} y={40 - (n / max) * 38} height={(n / max) * 38}>
            <title>{`${fmtTime(t.start + i * t.span)}: ${n}`}</title>
          </rect>
        ))}
      </svg>
      <div className="sr-axis text-muted">
        <span>{fmtTime(t.first)}</span>
        <span>events per {t.label} · max {max}</span>
        <span>{fmtTime(t.last)}</span>
      </div>
    </div>
  )
}

export default function SplunkResults({ answer: a }) {
  const rows = Array.isArray(a.rows) ? a.rows : null
  const [view, setView] = useState('table')
  const [allColumns, setAllColumns] = useState(false)
  const info = useMemo(() => (rows && rows.length ? analyse(rows) : null), [rows])

  // Older jobs, and searches that found nothing: the text says it best.
  if (!info) return <div className="code-block">{a.answer}</div>

  const n = rows.length
  const columns = allColumns ? info.varying : info.varying.slice(0, MAX_COLUMNS)
  const t = info.timeline
  const summary = info.varying
    .filter((f) => f.key !== '_time' && f.key !== info.countKey && f.distinct > 1)
    .sort((x, y) => x.distinct - y.distinct)
    .slice(0, 3)

  return (
    <div className="sr">
      {/* ── summary ── */}
      <div className="sr-summary">
        <span className="sr-stat"><strong>{a.capped ? `${n}+` : n}</strong> {info.stats ? 'group(s)' : 'event(s)'}</span>
        {t && t.range > 0 && <span className="sr-stat">over <strong>{fmtSpan(t.range)}</strong></span>}
        {summary.map((f) => (
          <span key={f.key} className="sr-stat"><strong>{f.distinct}</strong> <span className="td-mono">{f.key}</span></span>
        ))}
        <span className="sr-toggle">
          <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Table</button>
          <button type="button" className={view === 'raw' ? 'active' : ''} onClick={() => setView('raw')}>Raw</button>
        </span>
      </div>
      {a.capped && (
        <div className="text-warning sr-note">
          Only the first {n} rows came back; the charts describe these, not everything in Splunk.
        </div>
      )}

      {view === 'raw' ? (
        <div className="code-block">{a.answer}</div>
      ) : (
        <>
          {/* ── what every row shares ── */}
          {info.constant.length > 0 && (
            <div className="sr-constant">
              <span className="text-muted">every row:</span>
              {info.constant.map(([k, v]) => (
                <span key={k} className="sr-chip" title={`${k}=${v}`}>
                  <span className="text-muted">{k}</span>=<span className="td-mono">{v}</span>
                </span>
              ))}
            </div>
          )}

          {/* ── charts ── */}
          {(t || info.topFields.length > 0 || info.stats) && (
            <div className="sr-charts">
              {t && (
                <div className="sr-panel sr-panel-wide">
                  <div className="sr-panel-title">When</div>
                  <Timeline t={t} />
                </div>
              )}
              {info.stats && (
                <div className="sr-panel sr-panel-wide">
                  <div className="sr-panel-title">{info.countKey} by {info.varying.filter((f) => f.key !== info.countKey).map((f) => f.key).join(', ') || 'group'}</div>
                  <Bars
                    bars={rows
                      .map((r) => [
                        info.varying.filter((f) => f.key !== info.countKey).map((f) => text(r[f.key])).join(' · ') || '(all)',
                        Number(r[info.countKey]),
                      ])
                      .sort((x, y) => y[1] - x[1])
                      .slice(0, MAX_BARS)}
                  />
                </div>
              )}
              {!info.stats && info.topFields.map((f) => (
                <div key={f.key} className="sr-panel">
                  <div className="sr-panel-title td-mono">{f.key}</div>
                  <Bars bars={f.bars} total={n} />
                </div>
              ))}
            </div>
          )}

          {/* ── what differs ── */}
          {columns.length > 0 && (
            <div className="sr-table-wrap">
              <table className="sr-table">
                <thead>
                  <tr>{columns.map((c) => <th key={c.key}>{c.key}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {columns.map((c) => {
                        const v = c.key === '_time' && parseTime(r._time) != null ? fmtTime(parseTime(r._time)) : text(r[c.key])
                        return <td key={c.key} title={v}>{v}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-muted sr-note">
            {info.varying.length > MAX_COLUMNS && (
              <button type="button" className="sr-link" onClick={() => setAllColumns(!allColumns)}>
                {allColumns ? `show first ${MAX_COLUMNS} columns` : `show all ${info.varying.length} columns`}
              </button>
            )}
            {info.hiddenEmpty > 0 && <span> {info.hiddenEmpty} empty field(s) hidden.</span>}
          </div>
        </>
      )}
    </div>
  )
}
