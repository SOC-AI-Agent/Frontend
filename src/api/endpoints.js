/**
 * Every backend route the dashboard talks to, in one place.
 *
 * Paths used to be inline strings spread across the pages, so the same route
 * was spelled out in several files and a rename meant grepping for it. Import
 * from here instead — `client` already prefixes nothing, these are the full
 * paths that nginx (prod) and the Vite proxy (dev) forward to the backend.
 *
 * Collection paths serve more than one verb: `users.list` is both the GET that
 * lists and the POST that creates, `users.byId(id)` is both PUT and DELETE.
 *
 * Not listed here on purpose — the backend also exposes routes the dashboard
 * never calls:
 *   POST /v1/analyze         SOAR submits an alert   (X-API-Key)
 *   GET  /v1/results/:jobId  SOAR polls for a result (X-API-Key)
 *   GET  /health, GET /      healthcheck / ops
 *   GET  /docs               Swagger UI
 */
export const endpoints = {
  /**
   * The LLM server, not the core backend. nginx proxies /llm to it so the
   * browser stays on one origin; in dev the Vite proxy does the same.
   *
   * The job row holds an agent_run_id but not the trace itself — the trace is
   * the LLM server's, and it is the only record of what the analysing agent
   * asked the query agent for.
   */
  agents: {
    run: (runId) => `/llm/runs/${runId}`,
  },
  /**
   * Ask for the Splunk stage on one job. The requirements are already on the
   * job row — this runs those, it does not work out new ones.
   */
  lookup: (jobId) => `/v1/jobs/${jobId}/lookup`,
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    me: '/auth/me',
  },

  jobs: {
    /** GET — paged list. Params: skip, limit, status_filter */
    list: '/v1/results',
    /** GET — one job, polled every 5s while pending/processing */
    detail: (jobId) => `/v1/jobs/${jobId}`,
  },

  users: {
    /** GET list, POST create */
    list: '/admin/users',
    /** PUT update, DELETE remove */
    byId: (userId) => `/admin/users/${userId}`,
  },

  apiKeys: {
    /** GET list, POST create — the full key is returned once, on create only */
    list: '/admin/api-keys',
    /** DELETE — revokes, does not hard-delete */
    byId: (keyId) => `/admin/api-keys/${keyId}`,
  },

  auditLogs: {
    /** GET — params: skip, limit, event_type, actor_label, ip_address,
     *  status_code, date_from, date_to */
    list: '/admin/audit-logs',
    /** GET — responds with CSV, request it as a blob */
    export: '/admin/audit-logs/export',
  },

  /** GET — job counts, avg processing time, token totals */
  stats: '/admin/stats',
  playbooks: {
    /** GET — playbook index in soc-ai/Qdrant, and whether Confluence is configured */
    status: '/admin/playbooks',
    /** POST — admin only: read Confluence now and re-index (embeds into Qdrant) */
    sync: '/admin/playbooks/sync',
  },
}

export default endpoints
