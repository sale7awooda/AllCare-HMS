
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Helper: Try to fetch the local health endpoint
const getBackendUrl = async () => {
  try {
    // Try to reach local backend with a short timeout (500ms)
    // We use 127.0.0.1 to avoid IPv6 localhost issues in some cloud envs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);
    
    await fetch('http://127.0.0.1:3000/health', { 
      method: 'GET', 
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    console.log('🚀 Local Backend Detected. Proxying to http://127.0.0.1:3000');
    return 'http://127.0.0.1:3000';
  } catch (error) {
    console.log('☁️  Local Backend offline or unreachable. Proxying to Railway Production.');
    return 'https://railway-hms-production.up.railway.app';
  }
};

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // 1. Check if user explicitly set a target in .env
  let target = env.VITE_API_TARGET;

  // 2. If no explicit target, auto-detect using fetch
  if (!target) {
    target = await getBackendUrl();
  }

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
