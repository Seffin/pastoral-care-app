import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Avoids CORS friction in dev: web app calls /api/... and Vite
      // forwards to the backend. In production, serve behind the same
      // origin/reverse proxy or set VITE_API_BASE_URL.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
