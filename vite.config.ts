import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('./src/renderer', import.meta.url));

// we build the renderer to dist/renderer for Electron. Use relative base in build
// so file:// loads in packaged app resolve assets correctly.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : './',
  resolve: {
    alias: {
      '@renderer': fileURLToPath(new URL("./src/renderer", import.meta.url)),
      '@shared': fileURLToPath(new URL('./main/shared', import.meta.url)),
    },
  },
  root: rootDir,
  build: {
    outDir: path.resolve(rootDir, '../../dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, 'index.html'),
        hud: path.resolve(rootDir, 'components/hud/index.html'),
      },
    },
  },
}));
