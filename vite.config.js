
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        // PROXY CONFIGURATION
        // If VITE_API_TARGET is set in .env, use it. Otherwise, default to Railway.
        // To use local backend, set VITE_API_TARGET=http://localhost:3000 in .env
        '/api': {
          target: env.VITE_API_TARGET || 'https://railway-hms-production.up.railway.app',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
