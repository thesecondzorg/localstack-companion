import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4566',
      '/ws': {
        target: 'ws://localhost:4566',
        ws: true
      }
    }
  },
  build: {
    outDir: '../backend/static',
    emptyOutDir: true
  }
})
