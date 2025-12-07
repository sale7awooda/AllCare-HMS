
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Default to Railway (Cloud Backend) for development
  // To use Local Backend, create a .env file with: VITE_API_TARGET=http://localhost:3000
  const target = env.VITE_API_TARGET || 'https://railway-hms-production.up.railway.app';

  console.log(`🔌 Proxying API requests to: ${target}`);

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: target,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
