# Encrypted Video Server Example

Self-hosted reference implementation of MoviPlayer's encrypted-playback
protocol, backed by pre-encrypted `.enc` files produced by
`encrypt.js`. Mirrors the wire protocol used by the Cloudflare
Workers edge at `../app/worker.js` — MoviPlayer's `encrypted` mode
attributes work against either backend unchanged.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Encrypt a video (one-time, produces videos/<name>.enc + .key)
node encrypt.js /path/to/video.mp4

# 3. Set the server secret (used to HMAC-sign tokens + derive the
#    static wrap key for server ECDH private keys). Omit for local
#    testing — a dev default is used with a warning.
export ENC_SERVER_SECRET="$(openssl rand -hex 32)"

# 4. Start server
npm start

# 5. Open browser
open http://localhost:3000
```

## Wire protocol

```
Browser                                        Server
  │                                              │
  │  Generate ephemeral P-256 ECDH keypair       │
  │  (private key is non-extractable)            │
  │                                              │
  ├─ POST /api/token ──────────────────────────►│ Generate ephemeral server ECDH
  │  { videoId, fingerprint, clientPubKey }      │  keypair + random hkdfSalt
  │                                              │ Wrap server priv with static
  │                                              │  key derived from ENC_SERVER_SECRET
  │                                              │ Sign token payload with HMAC
  │◄─────────────────────────────────────────────┤
  │  { token, serverPubKey, hkdfSalt,            │
  │    fileSize, chunkSize, expiresAt }          │
  │                                              │
  │  Derive session keys via ECDH + HKDF         │
  │  (master-AES for decrypt, req-HMAC for sign) │
  │                                              │
  ├─ GET /api/video ───────────────────────────►│ Verify token HMAC
  │  X-Token, X-Nonce, X-Timestamp, X-Signature  │ Verify timestamp window
  │  Range: bytes=<start>-<end>                  │ Unwrap server priv
  │  Signature = HMAC(hmacKey,                   │ Re-derive session keys
  │    "GET:token:nonce:ts:start:length")        │ Verify X-Signature
  │                                              │ Check nonce hasn't been replayed
  │                                              │ Decrypt needed disk chunks
  │                                              │  with the per-file master key
  │                                              │ Re-encrypt plaintext with
  │                                              │  session master key in 2 MB
  │                                              │  framed AES-GCM
  │◄─────────────────────────────────────────────┤
  │  [ 4-byte BE len ][ 12-byte IV ][ CT || Tag ] (repeated per frame)
  │                                              │
  │  Decrypt each frame progressively            │
  │  → WASM demuxer → canvas                     │
  │                                              │
  │  Token refresh happens automatically ~500 ms │
  │  before expiry                               │
```

## Security layers

| Layer | Protection |
|---|---|
| Pre-encrypted at rest | `.enc` file is AES-256-GCM with a random per-file master key; `.key` sidecar holds it and never leaves the server |
| Per-request session key | Every `/api/video` uses a fresh ECDH-derived AES-GCM key; recording the wire bytes yields nothing without the (non-extractable) client priv |
| Non-extractable client priv | Re-imported with `extractable=false`; DevTools `exportKey()` refuses |
| Method-bound HMAC | `GET` signatures cannot be lifted to `HEAD` or vice versa |
| Nonce replay window | Every nonce is single-use within the timestamp window |
| Token TTL 30 s | Stolen tokens expire fast; IP + fingerprint pinning blocks cross-session replay |
| HKDF salt per token | Session keys are unique even if ECDH secrets happened to collide |
| No `<video>` element | Canvas-only path; no right-click → Save Video; no EME surface |

## Files

- `encrypt.js` — Encrypts a plaintext video into `videos/<name>.enc` + `<name>.key`
- `server.js` — Express server implementing the encrypted playback protocol
- `videos/*.enc` — Encrypted video data. Safe to sync to cheap storage
- `videos/*.key` — Per-file master key. KEEP SERVER-ONLY

## Notes

- The Cloudflare Workers backend rotates its wrap key hourly via a
  Durable Object for forward secrecy; this single-process server uses
  a deterministic derivation from `ENC_SERVER_SECRET` instead (no
  state to keep, tokens survive restarts, but no forward secrecy).
- The nonce tracker is an in-memory `Map` — sufficient for single-
  process deployments. Scale-out would swap in Redis.
- File size and chunk layout come from the `.key` sidecar; the server
  never reads plaintext from disk and never caches it outside the
  currently-serving range.
