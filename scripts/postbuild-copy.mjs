import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.resolve(__dirname, '../src/renderer/dist'); // <— Vite output
const dest = path.resolve(__dirname, '../dist/renderer');    // <— Electron prod

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

function copyDir(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    entry.isDirectory() ? (fs.mkdirSync(d, { recursive: true }), copyDir(s, d))
                        : fs.copyFileSync(s, d);
  }
}
copyDir(src, dest);
console.log('Copied Vite renderer build → dist/renderer');
