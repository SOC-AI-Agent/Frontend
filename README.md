# Frontend

The analyst dashboard. React and Vite, served by nginx.

```bash
docker compose up -d --build     # http://localhost:3000
```

## What it shows

The job list and, per job, the suggestion the model wrote — and beside it the
evidence it was written from: which indicators were extracted and what threat
intelligence said about each, which playbook covers the alert, what the search
plan is and which field each search is aimed at.

That pairing is the point. A suggestion is prose and can be wrong about its own
inputs; read next to the evidence, a summary that contradicts what it was given
stops being invisible.

The Splunk lookups are behind a button rather than automatic, because each one
costs inference and that should be a person's decision about a particular
alert.

## Proxying

nginx routes `/auth`, `/v1`, `/admin`, `/health` to `soc-core-api` and `/llm`
to `soc-llm-server`, so the browser talks to one origin. `/llm` carries a 900s
read timeout: nginx gives up at 60s by default, which is shorter than a single
CPU-only agent run, and a cut-off request looks like the LLM server died.


---

## Where this came from

Split out of the SOC-AI monorepo. The other pieces:

| Repo | What it is |
| --- | --- |
| `Backend` | API, queue worker, Postgres, Redis. The only writer to the database. |
| `AI-Service` | The backend's stateless door to the agent platform. |
| `LLM-Server` | Agents as data — model, prompt, tools — and the loop that runs them. |
| `MCP-Server` | Tool servers for Splunk, ThreatQ and Confluence. |
| `Frontend` | The analyst dashboard. |

They meet on one Docker network called `soc-network`, created by whichever
stack comes up first, and address each other by container name. Bring up
`MCP-Server` and `LLM-Server` first: those are the ones the rest call.

Each repo carries only the settings its own services read. In the monorepo one
`.env` was shared by every container, which meant the Splunk connector's
environment also held the database password and the ThreatQ credentials — a
compromise of any one service read the secrets of all of them.
