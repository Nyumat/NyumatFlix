/**
 * encrypt.js - Chunk-level AES-256-GCM encryption
 *
 * Each 2MB chunk is encrypted separately with its own IV.
 * This allows on-demand decryption of individual chunks
 * without loading the entire file into memory.
 *
 * File format:
 *   [4 bytes: chunk count (uint32)]
 *   [chunk 0: 12-byte IV + 16-byte auth tag + encrypted data]
 *   [chunk 1: 12-byte IV + 16-byte auth tag + encrypted data]
 *   ...
 *
 * Usage: node encrypt.js <input-video> [output-file]
 */

import { createCipheriv, randomBytes } from "crypto";
import { readFileSync, writeFileSync, statSync } from "fs";
import { basename } from "path";

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks

async function main() {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3] || inputFile?.replace(/\.\w+$/, ".enc");

  if (!inputFile) {
    console.error("Usage: node encrypt.js <input-video> [output-file]");
    process.exit(1);
  }

  const masterKey = randomBytes(32);
  const inputSize = statSync(inputFile).size;
  const inputData = readFileSync(inputFile);
  const chunkCount = Math.ceil(inputSize / CHUNK_SIZE);

  console.log(`Encrypting: ${inputFile}`);
  console.log(`Size: ${(inputSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Chunks: ${chunkCount} x ${(CHUNK_SIZE / 1024 / 1024).toFixed(0)}MB`);

  // Build output: [4-byte chunk count] + [chunks...]
  const parts = [];

  // Header: chunk count (uint32 LE)
  const header = Buffer.alloc(4);
  header.writeUInt32LE(chunkCount, 0);
  parts.push(header);

  // Chunk index: offset + size for each chunk (for random access)
  // [chunkCount x { originalOffset: uint32, originalSize: uint32, encOffset: uint32, encSize: uint32 }]
  const indexSize = chunkCount * 16;
  const indexBuf = Buffer.alloc(indexSize);
  parts.push(indexBuf); // placeholder, fill later

  let encOffset = 4 + indexSize; // after header + index

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, inputSize);
    const chunk = inputData.subarray(start, end);

    // Each chunk gets its own IV
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(chunk), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Chunk format: [12-byte IV][16-byte tag][encrypted data]
    const encChunk = Buffer.concat([iv, authTag, encrypted]);
    parts.push(encChunk);

    // Fill index entry
    const idx = i * 16;
    indexBuf.writeUInt32LE(start, idx);       // original offset
    indexBuf.writeUInt32LE(end - start, idx + 4); // original size
    indexBuf.writeUInt32LE(encOffset, idx + 8);   // encrypted offset
    indexBuf.writeUInt32LE(encChunk.length, idx + 12); // encrypted size
    encOffset += encChunk.length;

    process.stdout.write(`\r  Chunk ${i + 1}/${chunkCount}`);
  }

  const output = Buffer.concat(parts);
  writeFileSync(outputFile, output);

  const keyFile = outputFile.replace(/\.enc$/, ".key");
  writeFileSync(keyFile, JSON.stringify({
    key: masterKey.toString("base64"),
    algorithm: "aes-256-gcm-chunked",
    chunkSize: CHUNK_SIZE,
    chunkCount,
    originalSize: inputSize,
    encryptedSize: output.length,
    originalFile: basename(inputFile),
  }, null, 2));

  console.log(`\n\nEncrypted: ${outputFile} (${(output.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Key: ${keyFile}`);
  console.log(`Chunks: ${chunkCount} (on-demand decrypt, ~${(CHUNK_SIZE / 1024 / 1024).toFixed(0)}MB RAM per request)`);
  console.log(`\nRun: npm start`);
}

main().catch((e) => { console.error(e); process.exit(1); });
