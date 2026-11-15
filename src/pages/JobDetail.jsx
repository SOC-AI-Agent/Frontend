import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import SplunkResults from '../components/SplunkResults'
import client from '../api/client'
import { endpoints } from '../api/endpoints'
import { copyToClipboard } from '../utils/clipboard'

/**
 * What each lookup state means, in words an analyst can act on — including
 * whether the button is coming back, because its absence is otherwise
 * indistinguishable from it never having been there.
 */
const LOOKUP_NOTE = {
  not_requested: 'Not searched yet. Nothing has been run against Splunk for this alert.',
  queued: 'Queued — waiting for the worker. The button returns when it finishes.',
  running: 'Searching Splunk now, one requirement at a time. Answers appear below as each '
    + 'finishes; when the last is in, an agent reads them and writes the analysis. '
    + 'The button returns when it is done.',
  completed: 'Searched.',
  failed: 'The last run did not finish. Press the button to run it again.',
}

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const pollRef = useRef(null)

  const load = async () => {
    try {
      const res = await client.get(endpoints.jobs.detail(id))
      setJob(res.data)
      // Keep polling while either stage is still working. A completed job with
      // a running lookup is still a page that changes under the reader.
      const busy =
        ['pending', 'processing'].includes(res.data.status) ||
        ['queued', 'running'].includes(res.data.lookup_status)
      if (busy) pollRef.current = setTimeout(load, 5000)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    return () => clearTimeout(pollRef.current)
  }, [id])

  const fmt = (d) => d ? new Date(d).toLocaleString() : '—'
  const copy = (text) => copyToClipboard(text)

  // Only offered when there is something stored to run and nothing running.
  // Re-running would spend the same minutes again and overwrite the answers,
  // so the backend refuses it too — this just keeps the button honest.
  const busyLookup = ['queued', 'running'].includes(job?.lookup_status)
  const done = job?.lookup_result?.length ?? 0
  const canRun = job?.splunk_requirements?.length > 0 && !busyLookup

  const runLookup = async () => {
    setRunning(true)
    setLookupError(null)
    try {
      await client.post(endpoints.lookup(id))
      // Straight back to polling: the lookup is minutes, and the page already
      // knows how to follow a job that is still working.
      await load()
    } catch (e) {
      setLookupError(e?.response?.data?.message ?? 'Could not start the lookup.')
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <Layout title="Job Detail"><div className="empty-state"><span className="spinner" /></div></Layout>
  if (!job) return <Layout title="Job Detail"><div className="alert alert-error">Job not found</div></Layout>

  return (
    <Layout title={`Job: ${job.alert_id}`}>
      <div className="page-header">
        <div>
          <Link to="/jobs" className="text-muted" style={{ fontSize: 12 }}>← Back to Jobs</Link>
          <div className="page-title" style={{ marginTop: 4 }}>{job.alert_name}</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
            <StatusBadge status={job.status} />
            {(job.status === 'pending' || job.status === 'processing') && (
              <span className="text-muted" style={{ fontSize: 12 }}>● Auto-refreshing every 5s…</span>
            )}
          </div>
        </div>
        {/* The answer below is prose. This leads to what it was built from —
            the indicators, what intel said about them, and what the agent
            asked for — which is the half that can actually be checked. */}
        <Link to={`/jobs/${id}/evidence`} className="btn btn-ghost">
          Evidence &amp; agent trace
        </Link>
      </div>

      {/* Meta */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>Job Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
          {[
            ['Job ID',    job.job_id],
            ['Alert ID',  job.alert_id],
            ['Model',     job.model_used || '—'],
            ['Duration',  job.processing_time_ms ? `${(job.processing_time_ms/1000).toFixed(2)}s` : '—'],
            ['Tokens (Prompt)', job.tokens_prompt || '—'],
            ['Tokens (Response)', job.tokens_eval || '—'],
            ['Created',   fmt(job.created_at)],
            ['Completed', fmt(job.completed_at)],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 3 }}>{k}</div>
              <div className="td-mono" style={{ fontSize: 12 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {job.error_message && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <strong>Error:</strong> {job.error_message}
        </div>
      )}

      {/* AI Response */}
      {job.ai_response && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">🤖 AI Analysis Response</span>
            <button className="btn btn-ghost btn-sm" onClick={() => copy(job.ai_response)}>⎘ Copy</button>
          </div>
          <div className="code-block">{job.ai_response}</div>
        </div>
      )}

      {/* What stage 1 said it would want, and the button that spends the time.
          Kept next to the answer rather than on the evidence page: this is the
          decision the analyst makes right after reading the suggestion. */}
      {job.status === 'completed' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">🔍 What this needs from Splunk</span>
            {canRun && (
              <button className="btn btn-primary btn-sm" onClick={runLookup} disabled={running}>
                {running ? 'Starting…' : `Search Splunk (${job.splunk_requirements.length})`}
              </button>
            )}
          </div>

          {job.splunk_requirements?.length > 0 ? (
            <ol style={{ margin: '0 0 12px 18px', fontSize: 13, lineHeight: 1.7 }}>
              {job.splunk_requirements.map((r, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  {r.requirement}
                  {/* Where it is aimed. An unaimed search returning nothing and
                      an aimed one returning nothing are different answers, and
                      this is the only place that difference is visible. */}
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {r.fields?.length
                      ? <>searches <span className="td-mono">{r.fields.join(' / ')}</span>
                          {r.index && <> in <span className="td-mono">{r.index}</span></>}
                          {r.sourcetype && <>/<span className="td-mono">{r.sourcetype}</span></>}
                          {r.aimedBy === 'probe' && <> · found by probing Splunk</>}
                          {r.aimedBy === 'cim' && <> · common field name</>}
                        </>
                      : r.indicator_type || r.indicatorType
                        ? <span className="text-warning">
                            not aimed — no field for a {r.indicatorType ?? r.indicator_type} here; searched as a quoted term
                          </span>
                        : r.because}
                  </div>
                  {/* The details sent to Text-to-SPL with the question, and any the
                      agent wrote that are not in the alert (not sent). */}
                  {r.context && Object.keys(r.context).length > 0 && (
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                      with{' '}
                      {Object.entries(r.context).map(([k, v], n) => (
                        <span key={k}>{n > 0 && ' · '}{k} <span className="td-mono">{v}</span></span>
                      ))}
                    </div>
                  )}
                  {r.droppedContext?.length > 0 && (
                    <div className="text-warning" style={{ fontSize: 11, marginTop: 2 }}>
                      not in the alert, left out: {r.droppedContext.join(' · ')}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted" style={{ fontSize: 13 }}>
              The first pass did not ask for anything from Splunk.
            </p>
          )}

          {job.splunk_requirements?.length > 0 && (
            <p className="text-muted" style={{ fontSize: 12 }}>
              {busyLookup && <span className="spinner" style={{ marginRight: 8 }} />}
              {LOOKUP_NOTE[job.lookup_status] ?? job.lookup_status}
              {/* Progress, not just "working". Ten minutes of an unchanging
                  page reads as a hang; "2 of 4 done" reads as a queue. */}
              {busyLookup && done > 0 && ` — ${done} of ${job.splunk_requirements.length} done`}
              {job.final_analysis?.status === 'running' && ' — reading the results'}
              {job.lookup_time_ms != null && ` · ${(job.lookup_time_ms / 1000).toFixed(1)}s`}
            </p>
          )}

          {job.lookup_error && (
            <div className="alert alert-error" style={{ marginTop: 10 }}>{job.lookup_error}</div>
          )}
          {lookupError && (
            <div className="alert alert-error" style={{ marginTop: 10 }}>{lookupError}</div>
          )}

          {job.lookup_result?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {job.lookup_result.map((a, i) => (
                <div key={i} style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 0' }}>
                  <div style={{ fontSize: 13, fontStyle: 'italic', marginBottom: 2 }}>
                    {/* The number the analysis below cites: [splunk N]. */}
                    <span className="td-mono" style={{ fontStyle: 'normal', marginRight: 6 }}>[{i + 1}]</span>
                    {a.requirement}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 6 }}>
                    {a.fields?.length
                      ? `searched ${a.fields.join(' / ')}${a.index ? ` in ${a.index}` : ''}${a.sourcetype ? `/${a.sourcetype}` : ''}`
                      : 'no field was named for this — an empty result may mean the wrong one was searched'}
                  </div>
                  {a.error
                    ? <div className="text-danger" style={{ fontSize: 12 }}>{a.error}</div>
                    : <SplunkResults answer={a} />}
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {(a.durationMs / 1000).toFixed(1)}s
                    {a.writtenBy === 'agent' && <> · SPL by <span className="td-mono">{a.splAgent ?? 'soc-spl-writer'}</span></>}
                    {a.writtenBy && a.writtenBy !== 'agent' && (
                      <span title={a.draftError || undefined}>
                        {' · '}SPL by connector{a.draftError ? ` (${a.splAgent ?? 'soc-spl-writer'} draft dropped)` : ''}
                      </span>
                    )}
                    {a.runId && <> · <Link to={`/jobs/${id}/evidence`}>trace</Link></>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* The second reading: the suggestion and the Splunk results read together by an
          agent with no tools. Kept beside the numbered results it cites, so a claim
          can be walked back to the search that made it. */}
      {job.final_analysis && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">🧾 Analysis with Splunk evidence</span>
            {job.final_analysis.status === 'completed' && (
              <button className="btn btn-ghost btn-sm" onClick={() => copy(job.final_analysis.text)}>⎘ Copy</button>
            )}
          </div>

          {job.final_analysis.status === 'running' && (
            <p className="text-muted" style={{ fontSize: 13 }}>
              <span className="spinner" style={{ marginRight: 8 }} />
              An agent is reading the results beside the first reading. This is a model call, so it takes a while.
            </p>
          )}
          {job.final_analysis.status === 'skipped' && (
            <p className="text-muted" style={{ fontSize: 13 }}>{job.final_analysis.reason}</p>
          )}
          {job.final_analysis.status === 'failed' && (
            <div className="alert alert-error">
              The analysis did not finish: {job.final_analysis.error}. The results above are still good.
            </div>
          )}
          {job.final_analysis.status === 'completed' && (
            <>
              <div className="code-block">{job.final_analysis.text}</div>
              <p className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>
                Written from {job.final_analysis.resultsUsed} result{job.final_analysis.resultsUsed === 1 ? '' : 's'}
                {job.final_analysis.model && <> by <span className="td-mono">{job.final_analysis.model}</span></>}
                {job.final_analysis.durationMs != null && <> in {(job.final_analysis.durationMs / 1000).toFixed(1)}s</>}
                . It cannot search; it only reads what is above.
              </p>
              {job.lookup_result?.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12 }}>
                    The results it rests on ({job.lookup_result.length})
                  </summary>
                  <ol style={{ margin: '8px 0 0 18px', fontSize: 12, lineHeight: 1.7 }}>
                    {job.lookup_result.map((a, i) => (
                      <li key={i}>
                        <span className="td-mono">[{i + 1}]</span> {a.requirement}
                        <div className="text-muted" style={{ fontSize: 11 }}>
                          {a.error
                            ? `failed: ${a.error}`
                            : a.spl
                              ? <><span className="td-mono">{a.spl}</span> · {a.count ?? '?'} row{a.count === 1 ? '' : 's'}</>
                              : 'not searched'}
                        </div>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {/* Raw Log */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">📄 Raw Log</span>
          <button className="btn btn-ghost btn-sm" onClick={() => copy(job.raw_log)}>⎘ Copy</button>
        </div>
        <div className="code-block">{job.raw_log}</div>
      </div>

    </Layout>
  )
}
