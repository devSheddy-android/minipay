import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Keep /api in the path: the Spring controllers already include this prefix.
  const proxy = {
    '/api': {
      target: env.MINIPAY_BACKEND_URL || 'http://localhost:8080',
      changeOrigin: true,
      timeout: 15000,
      proxyTimeout: 15000,
    },
  };

  return {
    plugins: [react()],
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
  };
});
