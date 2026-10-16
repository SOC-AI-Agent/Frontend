# Frontend

The analyst dashboard. React and Vite, served by nginx.

```bash
docker compose up -d --build     # http://localhost:3002
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

nginx routes `/auth`, `/v1`, `/admin`, `/health` to the backend API, so the
browser talks to one origin. Where that is comes from `nginx.conf.template`,
which the nginx image fills in at start:

| Variable | Default | Used |
| --- | --- | --- |
| `BACKEND_HOST` | `soc-core-api` | at start — the API's container name on `soc-network` |
| `BACKEND_PORT` | `8000` | at start |
| `NPM_PROXY` | the office proxy (Dockerfile) | at build — npm goes through it. Off the office network, build with `docker compose build --build-arg NPM_PROXY=` |

The dashboard is published on port 3002 (`FRONTEND_HOST_PORT` moves it). The
`deploy_production` job deploys it from the `restructure` branch, and from
`main` once that is merged. Its last step prints the address and asks the
backend's `/health` through this nginx, so a dashboard that cannot reach the
API is caught at deploy. Set `BACKEND_HOST` / `BACKEND_PORT`
in the environment `docker compose` runs in: CI variables in the deploy job,
or `./.env` locally. nginx looks the backend up per request
(Docker's DNS), so it starts even when the backend is down — those paths
answer 502 until it is up — and follows it to a new IP after a redeploy.

There used to also be `/llm`, proxied to
`soc-llm-server` for the agent run trace; the agent platform is
[Agent-Server](../Agent-Server/readme.md) now, which is not on this network and
returns no run id to fetch a trace back by, so that route is gone rather than
pointed at a container that does not exist here. `JobEvidence.jsx`'s trace
section already only ever rendered when a run id was present, so it now just
never does — nothing else on that page changed.

## Running the whole stack

This repo runs on its own with the compose file above, which is enough to work
on it. Running the SOC end to end takes four repos, checked out side by side,
and one script that writes the `.env` files — plus
[Agent-Server](../Agent-Server/readme.md), run separately with its own compose
(it is not one of the four; see `AI-Service/README.md`, "Agent-Server"):

```bash
git clone https://gitlab.com/agentic-soc/backend.git      Backend
git clone https://gitlab.com/agentic-soc/frontend.git     Frontend
git clone https://gitlab.com/agentic-soc/ai-service.git   AI-Service
git clone https://gitlab.com/agentic-soc/mcp-server.git   MCP-Server
git clone https://gitlab.com/agentic-soc/Agent-Server.git Agent-Server

cd Backend
./deploy/dev-setup.sh                            # writes .env in Backend, AI-Service, MCP-Server
docker compose -f deploy/dev.yml --project-directory . up -d --build   # http://localhost:3002

cd ../Agent-Server
cp .env.example .env && docker compose up -d --build   # http://localhost:7100
```

The script lives in Backend because three of the secrets it generates have to
be identical in more than one repo — the tokens the connectors check — and
they are the ones that break quietly: a mismatch is a 401 with nothing saying
why. Generating them in one place is the whole point. It does not touch
Agent-Server, which manages its own `.env`.

---

## Where this came from

Split out of the SOC-AI monorepo. The other pieces:

| Repo | What it is |
| --- | --- |
| `Backend` | API, queue worker, Postgres, Redis. The only writer to the database. |
| `AI-Service` | The backend's stateless door to the agent platform. |
| `MCP-Server` | Tool servers for Splunk, ThreatQ and Confluence. |
| `Frontend` | The analyst dashboard. |

Plus [`Agent-Server`](../Agent-Server/readme.md) (DALL-M): agents as data —
model, prompt, tools — and the loop that runs them. A separate system, its own
network, reached by `AI-Service` over a URL rather than by container name.

They meet on one Docker network called `soc-network`, created by whichever
stack comes up first, and address each other by container name. Bring up
`MCP-Server` first: it is the one the rest call. Agent-Server is not on
`soc-network` and brings itself up on its own.

Each repo carries only the settings its own services read. In the monorepo one
`.env` was shared by every container, which meant the Splunk connector's
environment also held the database password and the ThreatQ credentials — a
compromise of any one service read the secrets of all of them.
