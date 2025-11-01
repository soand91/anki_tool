import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// we build the renderer to an internal dist (Vite's defualt), then copy over to ../dist/renderer at build
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': fileURLToPath(new URL("./src/renderer", import.meta.url)),
      '@shared': fileURLToPath(new URL('./main/shared', import.meta.url)),
    },
  },
  root: 'src/renderer',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
});