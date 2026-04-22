import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/status': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/services': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/request-access': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/config': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
