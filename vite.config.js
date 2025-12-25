
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
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
      host: '0.0.0.0', 
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: `http://localhost:${BACKEND_PORT}`,
          changeOrigin: true,
          secure: false,
          ws: true,
          // Ensure we don't accidentally strip /api if the backend expects it
          // Or add it if the backend doesn't. 
          // Current backend uses app.use('/api', ...), so no rewrite needed.
        }
      }
    }
  }
})
