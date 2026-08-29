const MAGIC_BYTES = [109, 118, 109, 49] as const;
const JL = [
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
  2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
  1925078388, 2162078206, 2614888103, 3248222580,
] as const;
const STATE_SIZE = 61;
const ROUND_COUNT = 8;
const MS = 2654435769;

function splitmix64(x: number): number {
  let l = x >>> 0;
  l ^= l >>> 16;
  l = Math.imul(l, 2246822507) >>> 0;
  l ^= l >>> 13;
  l = Math.imul(l, 3266489909) >>> 0;
  l ^= l >>> 16;
  return l >>> 0;
}

function isEvenProduct(n: number): boolean {
  return ((n * (n + 1)) & 1) === 0;
}

function isOddProduct(n: number): boolean {
  return ((n * (n + 1)) & 1) === 1;
}

function rotateLeft(l: number, bits: number): number {
  l = l >>> 0;
  bits = bits & 31;
  return bits === 0 ? l >>> 0 : ((l << bits) | (l >>> (32 - bits))) >>> 0;
}

function mix(l: number, o: number, e: number): number {
  return (((l ^ o) >>> 0) | ((l & o & e) >>> 0)) >>> 0;
}

function hashSeed(seed: string): number {
  let o = 1732584193 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    o = rotateLeft((o ^ Math.imul(seed.charCodeAt(i), JL[i & 15])) >>> 0, 5);
  }
  return splitmix64(o);
}

function rc4Seed(seed: string): number[] {
  const table = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + table[i] + seed.charCodeAt(i % seed.length)) & 255;
    [table[i], table[j]] = [table[j], table[i]];
  }
  return table;
}

function fnvHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 16777619) >>> 0;
  }
  return splitmix64(hash);
}

function initState(seed: string, mediaId: number) {
  if (isOddProduct(seed.length)) {
    return { S: rc4Seed(seed), acc: hashSeed(seed) };
  }

  const state = new Array<number>(STATE_SIZE);
  let cursor = splitmix64(fnvHash(seed) ^ splitmix64(mediaId ^ MS)) >>> 0;

  for (let round = 0; round < ROUND_COUNT; round++) {
    if (isEvenProduct(round)) {
      const index = cursor % STATE_SIZE;
      cursor = rotateLeft((cursor + MS) >>> 0, 7 + (round & 7));
      state[index] = (cursor ^ splitmix64(cursor)) >>> 0;
      cursor = splitmix64(cursor + index);
    } else {
      state[round] = JL[round & 15];
    }
  }

  return { S: state, acc: splitmix64(cursor ^ 2779096485) >>> 0 };
}

function nextWord(
  state: { S: number[]; acc: number },
  counter: number,
): number {
  const table = state.S;
  let acc = state.acc;
  const slot = acc % STATE_SIZE;
  const guard = 0 - +(slot in table);
  const value = (table[slot] || 0) >>> 0;
  const mixed = Math.imul(MS, counter + 1) >>> 0;
  let word = mix(acc, (value ^ mixed) >>> 0, guard);
  word =
    (rotateLeft((word + acc) >>> 0, slot & 31) ^
      rotateLeft(acc, Math.imul(slot, 7) & 31)) >>>
    0;
  acc = splitmix64(word + MS);
  table[slot] = acc >>> 0;
  state.acc = acc;
  return acc;
}

function keystream(seed: string, mediaId: number, length: number): Uint8Array {
  const state = initState(seed, mediaId);
  const output = new Uint8Array(length);
  let counter = 0;

  for (let offset = 0; offset < length; ) {
    const word = nextWord(state, counter++);
    output[offset++] = word & 255;
    if (offset < length) output[offset++] = (word >>> 8) & 255;
    if (offset < length) output[offset++] = (word >>> 16) & 255;
    if (offset < length) output[offset++] = (word >>> 24) & 255;
  }

  return output;
}

function decodePayload(encoded: string): Uint8Array {
  const normalized = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
}

export function decryptVidKingPayload(
  encoded: string,
  seed: string,
  mediaId: number,
): string {
  const payload = decodePayload(encoded);
  const stream = keystream(seed, mediaId, payload.length);

  for (let i = 0; i < payload.length; i++) {
    payload[i] ^= stream[i];
  }

  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (payload[i] !== MAGIC_BYTES[i]) {
      throw new Error("VidKing decryption failed");
    }
  }

  return new TextDecoder("utf-8").decode(payload.subarray(MAGIC_BYTES.length));
}
