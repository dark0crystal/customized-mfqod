import { cpSync, existsSync, linkSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const src = (p: string) => decodeURIComponent(new URL(`./src/${p}`, import.meta.url).pathname);
const root = decodeURIComponent(new URL('.', import.meta.url).pathname);

// Large offline map tiles (public/map/*.pmtiles, ~165 MB, git-ignored) are not copied into dist/.
// Vite's own public-dir copy is turned off and this plugin copies public/ itself. A .pmtiles file is
// hard-linked (no extra disk space) so `npm run preview` still serves /map/oman.pmtiles. If the link
// fails (for example across file systems), the file is skipped. In Docker the tiles come from the
// ./storage/map volume, and the Dockerfile removes dist/map anyway.
const copyPublicWithoutTiles: Plugin = {
  name: 'mfqod-copy-public',
  apply: 'build',
  writeBundle(options) {
    const publicDir = join(root, 'public');
    const outDir = options.dir ?? join(root, 'dist');
    if (!existsSync(publicDir)) return;
    const isTiles = (p: string) => p.endsWith('.pmtiles');
    cpSync(publicDir, outDir, { recursive: true, filter: (from) => !isTiles(from) });
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const from = join(dir, name);
        if (statSync(from).isDirectory()) walk(from);
        else if (isTiles(from)) {
          const to = join(outDir, relative(publicDir, from));
          mkdirSync(dirname(to), { recursive: true });
          try {
            if (!existsSync(to)) linkSync(from, to);
          } catch {
            this.warn(`not copied to dist (serve it from storage/map): ${relative(root, from)}`);
          }
        }
      }
    };
    walk(publicDir);
  },
};

// Static SPA build (served by nginx in production).
// The dev/preview port is passed on the CLI (`vite --port 5181`), see package.json scripts.
export default defineConfig({
  plugins: [react(), tailwindcss(), copyPublicWithoutTiles],
  resolve: {
    alias: [{ find: /^@\//, replacement: src('') }],
  },
  optimizeDeps: {
    // Pre-bundle the heavy dependencies explicitly so the first dev page load stays fast.
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router',
      'use-intl',
      'lucide-react',
      'react-icons/io',
      'react-icons/io5',
      'react-icons/md',
      'react-icons/rx',
      'react-hook-form',
      '@hookform/resolvers/zod',
      'zod',
      'date-fns',
      'recharts',
      'jspdf',
      'jspdf-autotable',
      'html2canvas',
      'leaflet',
      'react-leaflet',
      'protomaps-leaflet',
      'compressorjs',
      'react-confetti',
    ],
  },
  server: {
    host: '127.0.0.1',
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: false,
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
});
