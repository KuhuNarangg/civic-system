import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // If 5173 is busy, Vite will auto-pick 5174/5175 etc.
    // The backend's CORS is configured to allow any localhost:* origin.
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
