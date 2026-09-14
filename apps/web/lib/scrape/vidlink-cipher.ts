import nacl from "tweetnacl";

/** Production VidLink API key (XSalsa20-Poly1305), from public RE of vidlink.pro assets. */
const VIDLINK_SECRETBOX_KEY = Uint8Array.from(
  Buffer.from(
    "c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd",
    "hex",
  ),
);

/** VidLink uses a fixed zero nonce for API route tokens. */
const VIDLINK_ZERO_NONCE = new Uint8Array(24);

const VIDLINK_TOKEN_SKEW_SECONDS = 480;

/** Build the `/api/b/...` route token for a TMDB id (matches enc-dec `enc-vidlink`). */
export const encryptVidlinkMediaId = (mediaId: string | number): string => {
  const id = String(mediaId);
  const timestamp = Math.floor(Date.now() / 1000) + VIDLINK_TOKEN_SKEW_SECONDS;
  const message = Buffer.allocUnsafe(id.length + 8);
  message.write(id, 0, id.length, "utf8");
  message.writeBigUInt64BE(BigInt(timestamp), id.length);

  const ciphertext = nacl.secretbox(
    new Uint8Array(message),
    VIDLINK_ZERO_NONCE,
    VIDLINK_SECRETBOX_KEY,
  );
  if (!ciphertext) {
    throw new Error("VidLink token encryption failed");
  }

  const payload = Buffer.concat([
    Buffer.from(VIDLINK_ZERO_NONCE),
    Buffer.from(ciphertext),
  ]);

  return payload.toString("base64url").replace(/=+$/u, "");
};
