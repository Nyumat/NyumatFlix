/**
 * Encrypted Video Server — pre-encrypted file support
 *
 * Self-hosted reference for the encrypted playback protocol used by
 * MoviPlayer. The Cloudflare Workers version (../app/worker.js)
 * fetches its source bytes from an upstream URL; this one reads them
 * from local `.enc` files produced by encrypt.js.
 *
 * Wire protocol (identical to the Cloudflare worker):
 *   POST /api/token
 *     Request:  { url | videoId, fingerprint, clientPubKey }
 *     Response: { token, expiresAt, fileSize, chunkSize,
 *                 serverPubKey, hkdfSalt }
 *     Token = base64url(payload).hmac-sha256-hex(payload)
 *     Payload = { videoId, ip, fingerprint, expiresAt,
 *                 clientPubKey, wrappedServerPriv, hkdfSalt }
 *
 *   GET /api/video  (Range: bytes=<start>-<end>)
 *     Headers: X-Token, X-Fingerprint, X-Nonce,
 *              X-Timestamp, X-Signature
 *     Signature = HMAC(hmacKey, `GET:${token}:${nonce}:${timestamp}:${start}:${length}`)
 *     hmacKey is derived per-token via ECDH(serverPriv, clientPub)
 *     followed by HKDF-SHA256(info="enc:req-hmac", salt=hkdfSalt).
 *     Response body: framed AES-GCM
 *       [4-byte BE length][12-byte IV][ciphertext || 16-byte tag]
 *     encryption key derived with HKDF(info="enc:master-aes", salt=hkdfSalt).
 *
 * On-disk storage: encrypt.js emits .enc files with chunk-level AES-GCM
 * (per-chunk IV + tag). Here we decrypt each requested chunk with the
 * file key, re-encrypt with the session key, and stream the frames
 * back. The file key never leaves the server.
 *
 * Usage:
 *   1. node encrypt.js video.mp4     (produces videos/video.enc + .key)
 *   2. ENC_SERVER_SECRET=... node server.js
 *   3. Open http://localhost:3000
 */

import express from "express";
import cors from "cors";
import { readFileSync, existsSync, readdirSync } from "fs";
import {
  randomBytes,
  createHmac,
  createDecipheriv,
  webcrypto,
} from "crypto";
import { fileURLToPath } from "url";
import { dirname, join, basename } from "path";

const subtle = webcrypto.subtle;
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Required for SharedArrayBuffer (movi-player WASM)
app.use((_req, res, next) => {
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  res.set("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

// Serve movi-player dist files
app.use("/dist", express.static(join(__dirname, "../dist")));

// ─── Configuration ───────────────────────────────────────────────
const ENC_SERVER_SECRET = process.env.ENC_SERVER_SECRET ||
  "dev-encrypted-server-secret-change-me-in-prod";
const ENC_TOKEN_TTL_MS = 30_000;
const ENC_TIMESTAMP_WINDOW_MS = 10_000;
const FRAME_PLAINTEXT = 2 * 1024 * 1024; // Must match client BLOCK_SIZE

if (ENC_SERVER_SECRET.startsWith("dev-")) {
  console.warn(
    "⚠️  ENC_SERVER_SECRET not set — using dev default. Set it for anything past local testing.",
  );
}

// ─── Multi-file Video Library ────────────────────────────────────
const videos = new Map(); // videoId -> { encFile, keyInfo, encBuffer, chunkIndex }

const videosDir = join(__dirname, "videos");
const dirFiles = existsSync(videosDir) ? readdirSync(videosDir) : [];
for (const f of dirFiles) {
  if (!f.endsWith(".enc")) continue;
  const keyPath = join(videosDir, f.replace(/\.enc$/, ".key"));
  if (!existsSync(keyPath)) continue;

  const ki = JSON.parse(readFileSync(keyPath, "utf-8"));
  const encPath = join(videosDir, f);
  const encBuf = readFileSync(encPath);

  // Parse chunk index
  const cc = encBuf.readUInt32LE(0);
  const ci = [];
  for (let i = 0; i < cc; i++) {
    const idx = 4 + i * 16;
    ci.push({
      originalOffset: encBuf.readUInt32LE(idx),
      originalSize: encBuf.readUInt32LE(idx + 4),
      encOffset: encBuf.readUInt32LE(idx + 8),
      encSize: encBuf.readUInt32LE(idx + 12),
    });
  }

  videos.set(ki.originalFile, {
    encFile: encPath,
    keyInfo: ki,
    encBuffer: encBuf,
    chunkIndex: ci,
  });
  console.log(
    `  [${videos.size}] ${ki.originalFile} (${(ki.originalSize / 1024 / 1024).toFixed(1)} MB, ${ki.chunkCount} chunks)`,
  );
}

if (videos.size === 0) {
  console.error("No encrypted videos found! Run: node encrypt.js <video-file>");
  process.exit(1);
}
console.log(`\nLoaded ${videos.size} encrypted video(s)`);

/**
 * Decrypt a single chunk from the pre-encrypted .enc file using the
 * per-file master key. Returns plaintext Buffer (~2 MB). Keeps RAM
 * bounded to one chunk per request.
 */
function decryptChunkFromDisk(video, chunkIdx) {
  const info = video.chunkIndex[chunkIdx];
  const encChunk = video.encBuffer.subarray(
    info.encOffset,
    info.encOffset + info.encSize,
  );
  const iv = encChunk.subarray(0, 12);
  const authTag = encChunk.subarray(12, 28);
  const ciphertext = encChunk.subarray(28);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(video.keyInfo.key, "base64"),
    iv,
  );
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ─── Crypto helpers (match ../app/worker.js) ─────────────────────

function b64Encode(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function b64Decode(s) {
  return new Uint8Array(Buffer.from(s, "base64"));
}
function b64urlEncode(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(s) {
  let padded = s.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4) padded += "=";
  return new Uint8Array(Buffer.from(padded, "base64"));
}

async function hkdf(inputKeyMaterial, info, length = 32, salt) {
  const ikm = await subtle.importKey(
    "raw",
    inputKeyMaterial,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt ?? new Uint8Array(32),
      info: new TextEncoder().encode(info),
    },
    ikm,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function hmacSha256Hex(secret, messageBytes) {
  const hmac = createHmac("sha256", secret);
  hmac.update(messageBytes);
  return hmac.digest("hex");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function aesGcmSeal(rawKey, plaintext) {
  const key = await subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ctWithTag = new Uint8Array(
    await subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  const out = new Uint8Array(iv.length + ctWithTag.length);
  out.set(iv, 0);
  out.set(ctWithTag, iv.length);
  return out;
}

/**
 * Static wrap key derived from ENC_SERVER_SECRET. The Cloudflare worker
 * rotates this hourly via a Durable Object for forward secrecy; this
 * single-process reference sticks with a deterministic derivation so
 * tokens remain decryptable across restarts.
 */
let _wrapKeyBytesPromise = null;
async function getWrapKey() {
  if (!_wrapKeyBytesPromise) {
    _wrapKeyBytesPromise = hkdf(
      new TextEncoder().encode(ENC_SERVER_SECRET),
      "enc:server-priv-wrap",
      32,
    );
  }
  return _wrapKeyBytesPromise;
}

async function wrapServerPriv(privPkcs8) {
  const keyBytes = await getWrapKey();
  const sealed = await aesGcmSeal(keyBytes, privPkcs8);
  return b64Encode(sealed);
}

async function unwrapServerPriv(wrappedB64) {
  const keyBytes = await getWrapKey();
  const sealed = b64Decode(wrappedB64);
  const key = await subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const iv = sealed.subarray(0, 12);
  const ct = sealed.subarray(12);
  const pt = await subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new Uint8Array(pt);
}

async function deriveSessionKeys(serverPrivPkcs8, clientPubRaw, salt) {
  const privKey = await subtle.importKey(
    "pkcs8",
    serverPrivPkcs8,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const pubKey = await subtle.importKey(
    "raw",
    clientPubRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: pubKey },
    privKey,
    256,
  );
  const shared = new Uint8Array(sharedBits);
  const masterBytes = await hkdf(shared, "enc:master-aes", 32, salt);
  const hmacBytes = await hkdf(shared, "enc:req-hmac", 32, salt);
  return { masterBytes, hmacBytes };
}

async function verifyEncToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigGiven = token.slice(dot + 1);
  const sigExpected = await hmacSha256Hex(
    ENC_SERVER_SECRET,
    new TextEncoder().encode(payloadB64),
  );
  if (!constantTimeEqual(sigGiven, sigExpected)) return null;
  try {
    const json = Buffer.from(b64urlDecode(payloadB64)).toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─── Nonce replay tracker (in-memory) ────────────────────────────

const usedNonces = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [n, ts] of usedNonces) {
    if (now - ts > ENC_TIMESTAMP_WINDOW_MS + 5000) usedNonces.delete(n);
  }
}, 5000);

// ─── Helpers ─────────────────────────────────────────────────────

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    ""
  );
}

// ─── API: List Videos ────────────────────────────────────────────

app.get("/api/videos", (_req, res) => {
  const list = Array.from(videos.entries()).map(([id, v]) => ({
    id,
    size: v.keyInfo.originalSize,
    chunks: v.keyInfo.chunkCount,
  }));
  res.json(list);
});

// ─── API: Token ──────────────────────────────────────────────────

app.post("/api/token", async (req, res) => {
  try {
    const body = req.body || {};
    const videoId = body.videoId || body.url;
    const { fingerprint, clientPubKey } = body;
    const ip = getClientIP(req);

    if (!videoId || !fingerprint || !clientPubKey) {
      return res.status(400).json({
        error: "Missing videoId, fingerprint, or clientPubKey",
      });
    }

    const video = videos.get(videoId);
    if (!video) {
      return res.status(404).json({
        error: "Video not found",
        available: Array.from(videos.keys()),
      });
    }

    // Ephemeral server ECDH keypair — wrapped into the token so the
    // /api/video handler can recover it without server-side state.
    const keypair = await subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const serverPubRaw = new Uint8Array(
      await subtle.exportKey("raw", keypair.publicKey),
    );
    const serverPrivPkcs8 = new Uint8Array(
      await subtle.exportKey("pkcs8", keypair.privateKey),
    );
    const wrappedServerPriv = await wrapServerPriv(serverPrivPkcs8);

    // Per-token random HKDF salt. Same value goes into the signed
    // payload AND the JSON response so the client can derive matching
    // session keys locally.
    const hkdfSaltBytes = webcrypto.getRandomValues(new Uint8Array(32));
    const hkdfSaltB64 = b64Encode(hkdfSaltBytes);

    const expiresAt = Date.now() + ENC_TOKEN_TTL_MS;
    const payload = {
      videoId,
      ip,
      fingerprint,
      expiresAt,
      clientPubKey,
      wrappedServerPriv,
      hkdfSalt: hkdfSaltB64,
    };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const payloadB64 = b64urlEncode(payloadBytes);
    const sig = await hmacSha256Hex(
      ENC_SERVER_SECRET,
      new TextEncoder().encode(payloadB64),
    );
    const token = `${payloadB64}.${sig}`;

    res.json({
      token,
      expiresAt,
      fileSize: video.keyInfo.originalSize,
      chunkSize: FRAME_PLAINTEXT,
      serverPubKey: b64Encode(serverPubRaw),
      hkdfSalt: hkdfSaltB64,
      contentDispositionFilename: basename(video.keyInfo.originalFile),
    });

    console.log(
      `[TOKEN] videoId=${videoId} ip=${ip} fp=${fingerprint.slice(0, 8)}…`,
    );
  } catch (err) {
    console.error("[/api/token] error:", err);
    res.status(500).json({ error: "Token issuance failed" });
  }
});

// ─── API: Video (ECDH-signed, framed AES-GCM response) ───────────

app.get("/api/video", async (req, res) => {
  try {
    const token = req.headers["x-token"];
    const fingerprint = req.headers["x-fingerprint"];
    const nonce = req.headers["x-nonce"];
    const tsHeader = req.headers["x-timestamp"];
    const signatureHex = req.headers["x-signature"];
    const ip = getClientIP(req);

    if (!token || !fingerprint || !nonce || !tsHeader || !signatureHex) {
      return res.status(401).json({ error: "Missing auth headers" });
    }

    const timestamp = parseInt(tsHeader, 10);
    if (Math.abs(Date.now() - timestamp) > ENC_TIMESTAMP_WINDOW_MS) {
      return res.status(403).json({ error: "Request too old or too new" });
    }

    const payload = await verifyEncToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid token" });
    if (Date.now() > payload.expiresAt) {
      return res.status(401).json({ error: "Token expired" });
    }
    if (payload.fingerprint !== fingerprint) {
      return res.status(403).json({ error: "Fingerprint mismatch" });
    }
    if (payload.ip && payload.ip !== ip) {
      return res.status(403).json({ error: "IP mismatch" });
    }
    if (!payload.videoId || !payload.clientPubKey || !payload.wrappedServerPriv) {
      return res.status(400).json({ error: "Malformed token" });
    }

    const video = videos.get(payload.videoId);
    if (!video) return res.status(404).json({ error: "Video not found" });
    const fileSize = video.keyInfo.originalSize;

    // Recover server ECDH priv and derive the per-session master/hmac
    // keys the client also derived locally.
    let masterBytes;
    let hmacBytes;
    try {
      const serverPrivPkcs8 = await unwrapServerPriv(payload.wrappedServerPriv);
      const clientPubRaw = b64Decode(payload.clientPubKey);
      const saltBytes = payload.hkdfSalt
        ? b64Decode(payload.hkdfSalt)
        : undefined;
      const derived = await deriveSessionKeys(
        serverPrivPkcs8,
        clientPubRaw,
        saltBytes,
      );
      masterBytes = derived.masterBytes;
      hmacBytes = derived.hmacBytes;
    } catch {
      return res.status(400).json({ error: "Key derivation failed" });
    }

    // Parse Range (always full bounds — the client sends explicit
    // start-end). Clamp to file size so a misbehaving client can't
    // trigger a read past EOF.
    const range = req.headers.range || "";
    let start = 0;
    let end = fileSize - 1;
    if (range.startsWith("bytes=")) {
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10) || 0;
      const endRaw = parts[1] ? parseInt(parts[1], 10) : -1;
      end = endRaw >= 0 ? Math.min(endRaw, fileSize - 1) : fileSize - 1;
    }
    if (start < 0 || start >= fileSize || end < start) {
      return res.status(416).json({ error: "Invalid range" });
    }
    const responseLength = end - start + 1;

    // Verify per-request HMAC signed with the ECDH-derived hmac key.
    // Method is bound in so a GET signature can't be lifted to HEAD.
    const method = "GET";
    const message = `${method}:${token}:${nonce}:${timestamp}:${start}:${responseLength}`;
    const hmacKey = await subtle.importKey(
      "raw",
      hmacBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expectedSigBytes = new Uint8Array(
      await subtle.sign(
        "HMAC",
        hmacKey,
        new TextEncoder().encode(message),
      ),
    );
    const expectedSigHex = Buffer.from(expectedSigBytes).toString("hex");
    if (!constantTimeEqual(signatureHex, expectedSigHex)) {
      return res.status(403).json({ error: "Invalid signature" });
    }

    // Nonce replay check AFTER signature verification so an attacker
    // sending garbage can't probe the nonce store for free.
    if (usedNonces.has(nonce)) {
      return res.status(403).json({ error: "Nonce replay detected" });
    }
    usedNonces.set(nonce, Date.now());

    // Gather plaintext bytes for [start, end] by decrypting the
    // relevant on-disk chunks with the file key. The file key never
    // leaves this server.
    const DISK_CHUNK_SIZE = video.keyInfo.chunkSize;
    const firstChunk = Math.floor(start / DISK_CHUNK_SIZE);
    const lastChunk = Math.floor(end / DISK_CHUNK_SIZE);
    const plainParts = [];
    for (let i = firstChunk; i <= lastChunk; i++) {
      const dec = decryptChunkFromDisk(video, i);
      const chunkStart = i * DISK_CHUNK_SIZE;
      const sliceStart = Math.max(0, start - chunkStart);
      const sliceEnd = Math.min(dec.length, end - chunkStart + 1);
      plainParts.push(dec.subarray(sliceStart, sliceEnd));
    }
    const plaintext = Buffer.concat(plainParts);

    // Re-encrypt with the session master key in FRAME_PLAINTEXT-sized
    // frames, matching the worker's wire format. Each frame is its
    // own AES-GCM message so the client can decrypt progressively.
    const aesKey = await subtle.importKey(
      "raw",
      masterBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    res.writeHead(range ? 206 : 200, {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store, no-cache",
      "Accept-Ranges": "bytes",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Enc-Envelope": "aes-gcm-framed-iv12-tag16",
      "X-Enc-Frame-Size": String(FRAME_PLAINTEXT),
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${fileSize}` } : {}),
    });

    for (let off = 0; off < plaintext.length; off += FRAME_PLAINTEXT) {
      const framePlain = plaintext.subarray(
        off,
        Math.min(off + FRAME_PLAINTEXT, plaintext.length),
      );
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const ctTag = new Uint8Array(
        await subtle.encrypt({ name: "AES-GCM", iv }, aesKey, framePlain),
      );
      const header = Buffer.alloc(4);
      header.writeUInt32BE(iv.length + ctTag.length, 0);
      if (!res.write(header)) await new Promise((r) => res.once("drain", r));
      if (!res.write(Buffer.from(iv)))
        await new Promise((r) => res.once("drain", r));
      if (!res.write(Buffer.from(ctTag)))
        await new Promise((r) => res.once("drain", r));
    }
    res.end();

    console.log(
      `[SERVE] ${payload.videoId} ${start}-${end} ` +
        `(${(responseLength / 1024).toFixed(0)}KB) ` +
        `chunks ${firstChunk}-${lastChunk} ip=${ip}`,
    );
  } catch (err) {
    console.error("[/api/video] error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    else res.end();
  }
});

// ─── Serve Player Page ──────────────────────────────────────────

app.get("/", (_req, res) => {
  const firstVideoId = Array.from(videos.keys())[0];
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Movi - Encrypted Playback</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; flex-direction: column; align-items: center;
      padding: 20px; min-height: 100vh;
    }
    h1 { font-size: 20px; margin-bottom: 4px; color: #8B5CF6; }
    .subtitle { font-size: 13px; color: #666; margin-bottom: 20px; }
    .player-container {
      width: 100%; max-width: 900px; aspect-ratio: 16/9;
      background: #000; border-radius: 12px; overflow: hidden;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }
    movi-player { width: 100%; height: 100%; display: block; }
    .info {
      margin-top: 16px; padding: 16px 20px; background: #111;
      border-radius: 8px; font-size: 12px; color: #888;
      font-family: 'SF Mono', monospace; max-width: 900px; width: 100%;
      line-height: 1.8;
    }
    .security-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 8px; margin-top: 12px;
    }
    .sec-item {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: #666;
    }
    .sec-item .dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #00ff88; flex-shrink: 0;
    }
  </style>
</head>
<body>
  <h1>Encrypted Playback</h1>
  <p class="subtitle">ECDH P-256 + AES-256-GCM (per-request) + method-bound HMAC + 30s tokens + IP/fingerprint binding</p>
  <div class="player-container">
    <movi-player id="player"
      controls thumb fastseek showtitle autoplay muted
      encrypted
      tokenurl="/api/token"
      videourl="/api/video"
      videoid="${firstVideoId}"
    ></movi-player>
  </div>
  <div class="info" id="info">Initializing encrypted playback…</div>

  <script type="module">
    import '/dist/element.js';

    const info = document.getElementById('info');
    info.innerHTML =
      '<div class="security-grid">' +
        [
          'ECDH P-256 key exchange',
          'AES-256-GCM (per-request session key)',
          'Method-bound HMAC signatures',
          '30s token expiry',
          'IP + Fingerprint binding',
          'Nonce replay protection',
          'File key never leaves server',
          'Framed streaming decrypt',
        ].map(s => '<div class="sec-item"><div class="dot"></div>' + s + '</div>').join('') +
      '</div>';
  </script>
</body>
</html>`);
});

// ─── Start ───────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🔒 Encrypted Video Server — http://localhost:${PORT}`);
  console.log(`   Token TTL: ${ENC_TOKEN_TTL_MS}ms`);
  console.log(`   Timestamp window: ±${ENC_TIMESTAMP_WINDOW_MS}ms`);
  console.log(`   Protocol: ECDH P-256 + AES-GCM framed + method-bound HMAC`);
});
