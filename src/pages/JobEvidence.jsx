import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import client from '../api/client'
import { endpoints } from '../api/endpoints'

/**
 * What was established before the model ran, and what it did with it.
 *
 * The answer on the job page is prose: it can be wrong about its own inputs and
 * nothing on that page would show it. This is the checkable half — the
 * indicators pulled out of the alert, what threat intelligence said about each,
 * which lookups followed from them, and the trace of what the analysing agent
 * actually asked for. Read the two side by side and a summary that contradicts
 * its evidence stops being invisible.
 */
export default function JobEvidence() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [run, setRun] = useState(null)
  const [runError, setRunError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get(endpoints.jobs.detail(id))
        setJob(res.data)
        if (res.data.agent_run_id) {
          // The trace lives on the LLM server, not in the job row. It is the
          // only place that records what the analysing agent asked the query
          // agent for, which is the step between the alert and the answer.
          try {
            const t = await client.get(endpoints.agents.run(res.data.agent_run_id))
            setRun(t.data)
          } catch (e) {
            setRunError(e?.response?.status === 404
              ? 'The run is no longer on the LLM server.'
              : 'Could not reach the LLM server for the trace.')
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) return <Layout title="Evidence"><div className="empty-state"><span className="spinner" /></div></Layout>
  if (!job) return <Layout title="Evidence"><div className="alert alert-error">Job not found</div></Layout>

  const e = job.evidence
  const tq = e?.threatq
  const hits = tq?.hits ?? []

  return (
    <Layout title={`Evidence: ${job.alert_id}`}>
      <div className="page-header">
        <div>
          <Link to={`/jobs/${id}`} className="text-muted" style={{ fontSize: 12 }}>← Back to the analysis</Link>
          <div className="page-title" style={{ marginTop: 4 }}>{job.alert_name}</div>
        </div>
      </div>

      {!e && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          This job ran before enrichment existed, so nothing was recorded. Newer
          jobs carry the indicators and the threat-intelligence results.
        </div>
      )}

      {e && (
        <>
          {/* ── where it came from ───────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Where the alert came from</div>
            {e.source ? (
              e.source.unknown ? (
                <>
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    Unknown — the alert carries no index, sourcetype or security
                    domain, and no rule recognised it. The agent was told to find
                    out by searching for a distinctive value rather than to assume.
                  </p>
                  {e.source.signature?.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Distinctive fields</div>
                      <div className="td-mono" style={{ fontSize: 12 }}>{e.source.signature.join(', ')}</div>
                    </div>
                  )}
                </>
              ) : (
                <Facts rows={[
                  ['Security domain', e.source.domain],
                  ['Sourcetype', e.source.sourcetype],
                  ['Index', e.source.index],
                  ['CIM data model', e.source.dataModel],
                  ['Read from', e.source.from],
                ]} />
              )
            ) : <p className="text-muted" style={{ fontSize: 13 }}>Not recorded.</p>}
          </div>

          {/* ── indicators ───────────────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>
              Indicators extracted <span className="text-muted">({e.indicators?.length ?? 0})</span>
            </div>
            {e.indicators?.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Type</th><th>Value</th><th>From</th><th>Threat intel</th></tr></thead>
                  <tbody>
                    {e.indicators.map((i) => {
                      const hit = hits.find((h) => h.value === i.value)
                      return (
                        <tr key={`${i.type}:${i.value}`}>
                          <td>{i.type}</td>
                          <td className="td-mono">{i.value}</td>
                          <td className="text-muted">{i.source}</td>
                          <td>
                            {!tq?.available ? <span className="text-muted">not checked</span>
                              : hit ? <span className="text-danger">score {hit.score ?? '?'} · {hit.status ?? 'known'}</span>
                              : <span className="text-muted">no record — unknown, not clean</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-muted" style={{ fontSize: 13 }}>None found in the alert.</p>}

            {e.skipped?.length > 0 && (
              <>
                <div className="card-title" style={{ margin: '18px 0 10px' }}>
                  Not looked up <span className="text-muted">({e.skipped.length})</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Value</th><th>Why not</th></tr></thead>
                    <tbody>
                      {e.skipped.map((s) => (
                        <tr key={s.value}>
                          <td className="td-mono">{s.value}</td>
                          <td className="text-muted">{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* ── threat intel ─────────────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Threat intelligence</div>
            {!tq?.available ? (
              <div className="alert alert-warning">
                Not checked — {tq?.error ?? 'lookup unavailable'}. Every indicator
                above is unknown, which is not the same as clean.
              </div>
            ) : hits.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>
                {tq.checked} checked, no records. ThreatQ has not seen them —
                unknown, not clean.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Indicator</th><th>Score</th><th>Status</th><th>Sources</th><th>Adversary</th><th>First seen</th></tr></thead>
                  <tbody>
                    {hits.map((h) => (
                      <tr key={h.value}>
                        <td className="td-mono">{h.value}</td>
                        <td className="text-danger">{h.score ?? '—'}</td>
                        <td>{h.status ?? '—'}</td>
                        <td className="text-muted">{(h.sources ?? []).join(', ') || '—'}</td>
                        <td>{(h.adversaries ?? []).join(', ') || '—'}</td>
                        <td className="text-muted">{h.first_seen ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── suggested lookups ────────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>
              Lookups suggested to the agent <span className="text-muted">({e.lookups?.length ?? 0})</span>
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginBottom: 14 }}>
              Worked out from the alert before the model ran. The agent chooses
              which of these to ask for — it is not obliged to ask for any.
            </p>
            {e.lookups?.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Requirement</th><th>Because</th></tr></thead>
                  <tbody>
                    {e.lookups.map((l) => (
                      <tr key={l.requirement}>
                        <td>{l.requirement}</td>
                        <td className="text-muted">{l.because}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-muted" style={{ fontSize: 13 }}>Nothing followed automatically from this alert.</p>}
          </div>
        </>
      )}

      {/* ── what was actually searched ────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 6 }}>What was actually searched</div>
        <p className="text-muted" style={{ fontSize: 12, marginBottom: 14 }}>
          The query each answer came from, exactly as Splunk received it. An
          answer of "2 events" is a claim; the query beside it is what lets you
          check the claim — whether it looked at the right fields, in the right
          index, over the right window.
        </p>

        {!job.lookup_result?.length ? (
          <p className="text-muted" style={{ fontSize: 13 }}>
            Nothing has been searched for this alert yet.
          </p>
        ) : (
          job.lookup_result.map((a, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 0' }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{a.requirement}</div>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 8 }}>
                {/* Which path ran it. The two differ by three orders of
                    magnitude, so a requirement that quietly fell back to the
                    agent is the one worth noticing. */}
                {a.ranBy === 'backend' ? 'planned — run directly' : 'worked out by the query agent'}
                {' · '}{(a.durationMs / 1000).toFixed(2)}s
                {a.count != null && ` · ${a.count} result(s)`}
              </div>

              {a.spl ? (
                <div className="code-block">{a.spl}</div>
              ) : a.error ? null : (
                <p className="text-warning" style={{ fontSize: 12 }}>
                  No query was recorded for this one, so the answer above cannot be checked.
                </p>
              )}

              {a.error && <div className="alert alert-error" style={{ marginTop: 8 }}>{a.error}</div>}

              {a.runId && (
                <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>
                  agent run <span className="td-mono">{a.runId}</span>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* ── the agent's own steps, when it had any worth showing ────────── */}
      {run?.trace?.some((s) => s.kind !== 'answer') && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 6 }}>What the agent did</div>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 14 }}>
            {run.status} · {run.steps_used} steps · {run.duration_ms} ms ·
            {' '}{run.tokens_prompt}/{run.tokens_eval} tokens
          </p>
          {run.trace.map((s, n) => <TraceStep key={n} step={s} />)}
        </section>
      )}
      {runError && <div className="alert alert-warning">{runError}</div>}

    </Layout>
  )
}

/** Label/value rows, skipping anything the enrichment did not fill in. */
function Facts({ rows }) {
  const present = rows.filter(([, v]) => v)
  if (present.length === 0) return <p className="text-muted" style={{ fontSize: 13 }}>Not recorded.</p>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
      {present.map(([k, v]) => (
        <div key={k}>
          <div className="text-muted" style={{ fontSize: 11, marginBottom: 3 }}>{k}</div>
          <div className="td-mono" style={{ fontSize: 12 }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * One step of the run, opened up.
 *
 * A delegate step is the interesting one: it holds what the analysing agent
 * asked for in plain language, the query agent's own steps — including the SPL
 * it wrote — and the answer that went back up. Those three together are the
 * hand-off the whole two-agent split exists for, and a wrong field in the
 * middle is only visible if all three are shown.
 */
function TraceStep({ step }) {
  const isDelegate = step.kind === 'delegate'
  const asked = isDelegate ? Object.values(step.arguments ?? {})[0] : null

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 0' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
        <strong>{step.step}. {step.kind.replace('_', ' ')}</strong>
        {step.delegate_agent && <span className="text-muted">→ {step.delegate_agent}</span>}
        {step.tool && !isDelegate && <span className="td-mono">{step.tool}</span>}
        {step.duration_ms != null && <span className="text-muted">· {step.duration_ms} ms</span>}
        {step.truncated && <span className="text-warning">· result cut</span>}
      </div>

      {asked && (
        <Block label="What the analysing agent asked for">
          <div style={{ fontSize: 13, fontStyle: 'italic', paddingLeft: 12, borderLeft: '2px solid var(--primary-dim)' }}>
            {asked}
          </div>
        </Block>
      )}

      {!isDelegate && step.arguments && Object.keys(step.arguments).length > 0 && (
        <Block label="Arguments">
          <div className="code-block">{JSON.stringify(step.arguments, null, 2)}</div>
        </Block>
      )}

      {step.delegate_trace?.length > 0 && (
        <Block label="What the query agent did with it">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Step</th><th>Search</th></tr></thead>
              <tbody>
                {step.delegate_trace.map((d, i) => (
                  <tr key={i}>
                    <td>{d.kind.replace('_', ' ')}{d.tool ? ` · ${d.tool}` : ''}</td>
                    <td>
                      {d.arguments
                        ? <div className="code-block">{JSON.stringify(d.arguments, null, 2)}</div>
                        : <span className="text-muted">—</span>}
                      {d.error && <div className="text-danger" style={{ fontSize: 12, marginTop: 6 }}>{String(d.error).slice(0, 200)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      )}

      {step.result && (
        <Block label={`What came back (${step.result_chars} chars)`}>
          <div className="code-block">{step.result}</div>
        </Block>
      )}

      {step.error && (
        <div className="alert alert-error" style={{ marginTop: 10 }}>{String(step.error).slice(0, 400)}</div>
      )}
    </div>
  )
}

function Block({ label, children }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}
