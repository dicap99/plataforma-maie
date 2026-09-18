import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    // En Docker se usa VITE_PORT=80 (docker-compose.yml); en local, 5173.
    port: Number(process.env.VITE_PORT) || 5173,
  },
})
