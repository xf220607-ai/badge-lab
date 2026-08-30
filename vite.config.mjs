import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp'
};

export default defineConfig({
  base: '/badge-lab/',
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        maker: resolve(import.meta.dirname, 'maker.html')
      }
    }
  }
});
