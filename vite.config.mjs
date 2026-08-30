import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp'
};

export default defineConfig({
  // GitHub Pages 将本项目托管在 /badge-lab/ 下；所有 Vite 生成的资源 URL 都必须保留此基路径。
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
