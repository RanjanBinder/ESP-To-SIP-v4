import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vite config for the ESP Editor. Named `.mts` so Vite loads it as ESM
// (vite-plugin-static-copy is ESM-only) without forcing the whole package to
// `type: module` (which would break `react-scripts test`).
//
// WASM loading strategy:
//   dwgImporter.ts uses `new URL('../../node_modules/.../libredwg-web.wasm', import.meta.url)`
//   which Rollup handles natively as an asset reference without going through the
//   package exports field (the wasm path is not listed there).
//   - Dev:  Vite serves the file via its /@fs/ handler (requires fs.strict: false).
//   - Prod: Rollup emits it as a hashed asset in build/assets/.
//
// cad-viewer workers:
//   @mlightcad/cad-simple-viewer loads DXF/DWG parsers and the mtext renderer
//   as web workers fetched from /assets/*.js at runtime. viteStaticCopy puts
//   them there for both dev and production.
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/@mlightcad/data-model/dist/dxf-parser-worker.js',             dest: 'assets', rename: { stripBase: true } },
        { src: 'node_modules/@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js',  dest: 'assets', rename: { stripBase: true } },
        { src: 'node_modules/@mlightcad/cad-simple-viewer/dist/libredwg-parser-worker.js', dest: 'assets', rename: { stripBase: true } },
      ],
    }),
  ],
  // Treat .wasm files as binary assets so they're served / emitted correctly.
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  server: {
    port: 3000,
    open: false,
    fs: {
      // Allow serving files outside the project root (e.g. WASM from node_modules).
      strict: false,
    },
  },
  build: { outDir: 'build', sourcemap: true },
  optimizeDeps: {
    include: ['@mlightcad/cad-simple-viewer', '@mlightcad/data-model', 'three'],
  },
});
