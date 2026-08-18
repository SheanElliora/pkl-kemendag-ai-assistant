import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {

  // Baca .env frontend (loadEnv) sehingga
  // target backend bisa diatur lewat VITE_API_TARGET,
  // default menunjuk ke backend lokal.
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
      watch: {
        // File sementara tes E2E (.tmp, test-results, dist) tidak perlu
        // dipantau; mengawasinya bisa mematikan dev server di Windows
        // (EBUSY: resource busy or locked saat file PDF uji ditulis/dihapus).
        ignored: ['**/e2e/.tmp/**', '**/test-results/**', '**/dist/**', '**/node_modules/**'],
      },
    },
  };
});