import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const manualChunkPackages = {
  charts: ['apexcharts', 'react-apexcharts'],
  calendar: ['@fullcalendar/core', '@fullcalendar/react', '@fullcalendar/daygrid', '@fullcalendar/timegrid', '@fullcalendar/list', '@fullcalendar/interaction'],
  forms: ['react-hook-form', 'yup', 'react-select'],
  maps: ['@react-google-maps/api', '@vis.gl/react-google-maps'],
  ui: ['react-bootstrap', '@tanstack/react-table'],
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll('\\', '/')
          for (const [chunk, packages] of Object.entries(manualChunkPackages)) {
            if (packages.some((pkg) => normalized.includes(`/node_modules/${pkg}/`))) return chunk
          }
        },
      },
    },
  },
})
