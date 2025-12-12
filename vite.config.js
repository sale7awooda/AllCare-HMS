
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
        '@': path.resolve(__dirname, './src'), // Standardize to src if structure allows, otherwise keep ./
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''), // Safe fallback to empty string
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000', // Points to local backend in dev
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
