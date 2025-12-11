
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point '@' to the root directory since the project structure is flat
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://allcare.up.railway.app',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
