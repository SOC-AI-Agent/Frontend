import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `npm run dev` only — the deployed dashboard does not use this file at run
// time: its nginx forwards the same paths to soc-core-api:8000 on soc-network
// (nginx.conf.template). Here the dev server forwards them to the production
// backend, so the dashboard can be worked on against real data. The machine
// running it must reach 10.40.35.18:8082 (the server's firewall decides).
// BACKEND_URL points it elsewhere: BACKEND_URL=http://localhost:8082 npm run dev
const backend = process.env.BACKEND_URL || 'http://10.40.35.18:8082'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The paths nginx forwards in production, the API docs included.
    proxy: {
      '/auth': backend,
      '/v1': backend,
      '/admin': backend,
      '/health': backend,
      '/docs': backend,
      // No /llm proxy any more — the agent platform is Agent-Server now, not
      // on this network, and its response carries no run id to fetch a trace
      // back by. See nginx.conf for the fuller note.
    }
  }
})
