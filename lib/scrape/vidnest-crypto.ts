const VIDNEST_CUSTOM_BASE64_ALPHABET =
  "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=";

export function decodeVidnestPayload(encoded: string): string {
  const charMap = new Map<string, number>();
  for (
    let index = 0;
    index < VIDNEST_CUSTOM_BASE64_ALPHABET.length;
    index += 1
  ) {
    charMap.set(VIDNEST_CUSTOM_BASE64_ALPHABET[index]!, index);
  }

  const chars = encoded.split("");
  const blocks: number[] = [];

  for (let index = 0; index < chars.length; index += 4) {
    const c1 = charMap.get(chars[index] ?? "") ?? 0;
    const c2 = charMap.get(chars[index + 1] ?? "") ?? 0;
    const c3 = charMap.get(chars[index + 2] ?? "") ?? 0;
    const c4 = charMap.get(chars[index + 3] ?? "") ?? 0;
    blocks.push((c1 << 18) | (c2 << 12) | (c3 << 6) | c4);
  }

  const bytes: number[] = [];
  for (const block of blocks) {
    bytes.push((block >> 16) & 0xff, (block >> 8) & 0xff, block & 0xff);
  }

  if (encoded.endsWith("==")) {
    bytes.length -= 2;
  } else if (encoded.endsWith("=")) {
    bytes.length -= 1;
  }

  return new TextDecoder().decode(new Uint8Array(bytes));
}
