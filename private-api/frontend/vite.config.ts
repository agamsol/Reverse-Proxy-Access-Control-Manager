import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// All private-api endpoints are proxied so the SPA can use same-origin paths.
const PROXY_PREFIXES = [
  '/status',
  '/auth',
  '/service',
  '/pending',
  '/connection',
  '/webhook',
] as const

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: Object.fromEntries(
      PROXY_PREFIXES.map((p) => [p, { target: 'http://127.0.0.1:8001', changeOrigin: true }]),
    ),
  },
})
