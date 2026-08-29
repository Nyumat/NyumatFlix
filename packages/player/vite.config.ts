import { defineConfig } from 'vite';

// Production build is handled by scripts/build-standalone.js (not this config)
// This config is only used for dev server (vite dev) and vitest
export default defineConfig({
  worker: {
    format: 'es',
  },
  // Don't let Vite pre-bundle the generated WASM glue into node_modules/.vite.
  // It's a ~6 MB emscripten module rebuilt via `npm run build:wasm`; if Vite
  // caches it as an optimized dep, the dev server keeps serving a STALE copy
  // after a WASM rebuild (no [movi] logs, old behaviour). Excluding it makes
  // the dev server always read the fresh dist/wasm/movi.js.
  optimizeDeps: {
    exclude: ['movi'],
  },
  server: {
    allowedHosts: true,
    headers: {
      // Required for SharedArrayBuffer
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
