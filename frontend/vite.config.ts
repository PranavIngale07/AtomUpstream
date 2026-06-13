import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'http://127.0.0.1:8000',
        ws: true
      },
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
        ws: true
      }
    }
  }
})
