/**
 * Build script for standalone modular bundles
 * Builds each entry point separately to avoid shared chunks
 */

import { build } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import terser from '@rollup/plugin-terser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const entries = [
  { name: 'demuxer', path: 'src/demuxer.ts' },
  { name: 'player', path: 'src/player.ts' },
  { name: 'element', path: 'src/element.ts' },
  { name: 'index', path: 'src/index.ts' },
];

// Rewrites every console.log/info/warn/error/debug call site to
// globalThis.__movilog?.<level>(...). We do this BEFORE terser runs:
// terser's drop_console only matches the literal console.* property
// path, so once rewritten the calls survive minification and reach
// the on-page dev console panel at runtime (see app/index.html).
//
// Lives as a Rollup plugin (renderChunk) so it sees the merged bundle
// after tree-shaking but before minification.
const movilogRewritePlugin = () => ({
  name: 'movilog-rewrite',
  renderChunk(code) {
    if (!/\bconsole\.(log|info|warn|error|debug)\s*\(/.test(code)) return null;
    const out = code.replace(
      /\bconsole\.(log|info|warn|error|debug)(\s*)\(/g,
      'globalThis.__movilog?.$1$2(',
    );
    return { code: out, map: null };
  },
});

const terserConfig = {
  compress: {
    drop_console: true,
    drop_debugger: true,
    passes: 5,
    unsafe: false,
    unsafe_comps: false,
    unsafe_math: false,
    unsafe_methods: false,
    unsafe_proto: false,
    unsafe_regexp: false,
    unsafe_undefined: false,
    dead_code: true,
    unused: true,
    collapse_vars: true,
    evaluate: true,
    reduce_vars: true,
    inline: 2,
    keep_infinity: false,
  },
  mangle: {
    toplevel: false,
    eval: false,
    keep_classnames: true,
    keep_fnames: false,
    reserved: [
      'Movi',
      'Module',
      'FS',
      'HEAP',
      'HEAPU8',
      'HEAP32',
      'HEAPF64',
      'createMoviModule',
      'startsWith',
      'endsWith',
      'locateFile',
      'wasmBinary',
    ],
  },
  format: {
    comments: false,
    beautify: false,
    ascii_only: false,
  },
};

async function buildEntry(entry, format) {
  const formatExt = format === 'es' ? 'js' : format;
  console.log(`Building ${entry.name}.${formatExt}...`);

  await build({
    configFile: false,
    plugins: [
      // Only generate types once for ES format
      ...(format === 'es'
        ? [
            dts({
              insertTypesEntry: true,
              entryRoot: 'src',
              include: [entry.path],
            }),
          ]
        : []),
    ],
    build: {
      // Native class fields output (no __publicField helper). Required
      // by the post-build harden pass: terser's property mangler
      // rewrites `this._foo` accesses, but it does NOT rename the
      // string literal inside `__publicField(this, "_foo", ...)`. With
      // the helper in play, the mangled getter looks up a property
      // that was never installed under its new name → undefined at
      // runtime. All WebCodecs-supporting browsers ship class fields,
      // so dropping the helper costs nothing.
      target: 'es2022',
      lib: {
        entry: resolve(rootDir, entry.path),
        name: 'Movi',
        formats: [format],
        fileName: () => `${entry.name}.${formatExt}`,
      },
      rollupOptions: {
        external: [],
        // Order matters: rewrite console.* → __movilog FIRST, then terser.
        // Terser disabled for the "no-harden" diagnostic build — toggle via
        // env var MOVI_NO_HARDEN=1. Keeps the movilog rewrite (so consoles
        // still pipe to the extension/output channel) but skips the
        // dead-code / inline / mangle passes that we suspect change
        // Asyncify timing in production.
        plugins: process.env.MOVI_NO_HARDEN === "1"
          ? [movilogRewritePlugin()]
          : [movilogRewritePlugin(), terser(terserConfig)],
        output: {
          globals: {},
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.wasm')) {
              return 'wasm/[name][extname]';
            }
            return '[name][extname]';
          },
        },
      },
      sourcemap: false,
      minify: false,
      emptyOutDir: false,
      chunkSizeWarningLimit: 10000,
      outDir: resolve(rootDir, 'dist'),
    },
  });
}

async function buildAll() {
  console.log('Building standalone modular bundles...\n');

  for (const entry of entries) {
    // Build ES format
    await buildEntry(entry, 'es');

    // Build CJS format
    await buildEntry(entry, 'cjs');

    console.log(`✓ ${entry.name} built\n`);
  }

  console.log('✓ All standalone bundles built successfully!');
}

buildAll().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
