import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('./src/renderer', import.meta.url));

// we build the renderer to an internal dist (Vite's defualt), then copy over to ../dist/renderer at build
export default defineConfig({
  plugins: [react()],
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
});
