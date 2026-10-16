import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8082',
      '/v1': 'http://localhost:8082',
      '/admin': 'http://localhost:8082',
      '/health': 'http://localhost:8082',
      // No /llm proxy any more — the agent platform is Agent-Server now, not
      // on this network, and its response carries no run id to fetch a trace
      // back by. See nginx.conf for the fuller note.
    }
  }
})
