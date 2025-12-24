
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const BACKEND_PORT = env.API_PORT || 3001;
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    },
    server: {
      host: '0.0.0.0', // Listen on all interfaces
      port: 5173,      // Default Vite port
      strictPort: false,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${BACKEND_PORT}`, // Force IPv4 loopback
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path // Keep /api prefix as backend expects it (or strip if backend doesn't use /api prefix, but current setup seems to expect /api)
        }
      }
    }
  }
})
