
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'), // Points to project root
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    },
    server: {
      host: true, // Listen on all local IPs
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000', // Use IPv4 loopback to avoid "Network Error"
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})