import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fully static, client-side SPA. No server, no API, no env-dependent runtime.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
    // The vendored vis-network bundle is imported as a raw string and inlined
    // into the generated report; keep it out of the JS asset graph.
    assetsInlineLimit: 0,
  },
});
