#!/usr/bin/env node
import { access } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const wasmPath = join(__dirname, '..', 'dist', 'wasm', 'movi.js');

try {
  await access(wasmPath);
} catch (error) {
  console.error('Error: dist/wasm/movi.js not found.');
  console.error('Please run: npm run build:wasm');
  process.exit(1);
}
