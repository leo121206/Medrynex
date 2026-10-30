import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        // Dev-only proxy — production uses VITE_API_BASE_URL set in the deployment environment
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
    // Expose env vars to the frontend bundle (only VITE_* prefixed vars are exposed)
    define: {
      // Nothing additional needed — Vite automatically exposes VITE_* vars via import.meta.env
    },
  };
});
