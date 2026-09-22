import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/v1': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      // The LLM server, for the agent run trace. Rewritten because the path is
      // only a prefix on this side — /llm/runs/x is /runs/x over there.
      '/llm': {
        target: 'http://localhost:8400',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/llm/, ''),
      },
    }
  }
})
