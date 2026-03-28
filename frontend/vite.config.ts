import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const sslKey = process.env.SSL_KEYFILE
const sslCert = process.env.SSL_CERTFILE
const httpsConfig =
  sslKey && sslCert && fs.existsSync(sslKey) && fs.existsSync(sslCert)
    ? { key: fs.readFileSync(sslKey), cert: fs.readFileSync(sslCert) }
    : undefined

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        secure: false,
      },
    },
  },
})
