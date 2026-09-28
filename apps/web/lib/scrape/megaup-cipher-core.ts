/** MegaUp UA filter from player RE (see megaup-deobfus `UASlice`). */
const MEGAUP_AGENT_SLICE_RE = /[^A-HI-RSV-Z0-237-9]/g;

const MEGAUP_STATIC_KEYSTREAM_HEX =
  "cd04e9c92863097ef5e0b5010d2d7bb7ff8e3efd831d83da12a45a1aca29d195" +
  "3c552272fdb39a789049975aa97586781074b4a13d841e7945e2f0c5b632b420" +
  "2dc8979699db15aacdc53193784eb52278fb7c0c33e2b3073bb1c2d6b86e9aa1" +
  "7a8c4d58e44d2b6035e2966ead4047bbe68392924ede09de62294c29b998568e" +
  "af420dd8a84a476d0e5ebd76ec8d83dfc186903afc109a855dc05da1d1c57084" +
  "e8316191571538ecdd51be555c4e245bc38068ac8054af44089db6fc10470a7b" +
  "ca7d276045b11caeac973263324e86fcf8d79f8415c33fce7b53e0dfcba2ec81" +
  "57ab8504c03a9687fd57909cc78aeef452b06f54c2d6d990390ed49ddc605a9f" +
  "ecc1509619342f70884a399a51097388f58d2668f1a80d9e14acb6502125658f" +
  "5c42394595c52c8e76baa7b1249051bc09ab642f6eb26a9d2de9bc67f964af9a" +
  "d02dbb3573998e6dd5d05c32160f340da7d94e7e463f98ecf7b75176838cbb23" +
  "9c1b73d394e9fe62eba27b52efda2b50d50ab727e2e21cea81787cc220b3ac03" +
  "8dbd47a9ead5b952b7f2e6ced5ce55a6cb5d2d6cc0f843b38c33f53ddc50d92" +
  "61ac01ddad199b09c79414ade30fce9eb39b040b8881704b368eae842a65858e" +
  "de4bed9cae74089d096558838309b170a4010547718792e00536ebbc1b903e7b" +
  "9f77ff78b66535c7ba90f218bb1bc11677ade52cf3927cdd53a9560d76b0ee9e" +
  "90328b5261f62e35f42";

let cachedStaticKeystream: Buffer | null = null;

const staticKeystream = (): Buffer => {
  if (!cachedStaticKeystream) {
    cachedStaticKeystream = Buffer.from(MEGAUP_STATIC_KEYSTREAM_HEX, "hex");
  }
  return cachedStaticKeystream;
};

export const megaupAgentSlice = (userAgent: string): string =>
  userAgent.replace(MEGAUP_AGENT_SLICE_RE, "").slice(-30);

const expandXorKeystream = (length: number, parts: Buffer[]): Buffer => {
  const out = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) {
    let byte = 0;
    for (const part of parts) {
      if (part.length === 0) {
        continue;
      }
      byte ^= part[i % part.length]!;
    }
    out[i] = byte;
  }
  return out;
};

export type MegaupKeystreamMode = "static" | "agent" | "agent-media";

export const buildMegaupKeystream = (
  length: number,
  init?: { userAgent?: string; mediaId?: string; mode?: MegaupKeystreamMode },
): Buffer => {
  const mode = init?.mode ?? "agent";
  const base = staticKeystream();
  if (mode === "static") {
    return expandXorKeystream(length, [base]);
  }

  const agentPart = Buffer.from(
    megaupAgentSlice(init?.userAgent ?? ""),
    "utf8",
  );
  if (mode === "agent") {
    return expandXorKeystream(length, [base, agentPart]);
  }

  const mediaPart = Buffer.from(init?.mediaId ?? "", "utf8");
  return expandXorKeystream(length, [base, agentPart, mediaPart]);
};

export const urlSafeBase64ToBuffer = (value: string): Buffer => {
  let b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) {
    b64 += "=";
  }
  return Buffer.from(b64, "base64");
};

export const trimJsonEnvelope = (text: string): string => {
  for (let end = text.length; end > 0; end -= 1) {
    const slice = text.slice(0, end);
    if (!slice.endsWith("}")) {
      continue;
    }
    try {
      JSON.parse(slice);
      return slice;
    } catch {
      continue;
    }
  }
  return text;
};

export type MegaupDecryptPayload = {
  sources?: Array<{ file?: string; url?: string; quality?: string }>;
  url?: string;
  file?: string;
  tracks?: Array<{ file?: string; kind?: string; label?: string }>;
  download?: string;
};

const xorDecryptToUtf8 = (
  encryptedBase64: string,
  keystream: Buffer,
): string => {
  const encBytes = urlSafeBase64ToBuffer(encryptedBase64.trim());
  const len = encBytes.length;
  const out = Buffer.alloc(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = encBytes[i]! ^ keystream[i % keystream.length]!;
  }
  return out.toString("utf8");
};

const parseMegaupJson = (jsonText: string): MegaupDecryptPayload => {
  const trimmed = trimJsonEnvelope(jsonText);
  const parsed: unknown = JSON.parse(trimmed);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("MegaUp decrypted payload is not an object");
  }
  return parsed as MegaupDecryptPayload;
};

export const decryptMegaupPayloadWithKeystream = (
  encryptedBase64: string,
  keystream: Buffer,
): MegaupDecryptPayload =>
  parseMegaupJson(xorDecryptToUtf8(encryptedBase64, keystream));

export const decryptMegaupPayloadCore = (
  encryptedBase64: string,
  init?: { userAgent?: string; mediaId?: string },
): MegaupDecryptPayload => {
  const encBytes = urlSafeBase64ToBuffer(encryptedBase64.trim());
  const modes: MegaupKeystreamMode[] = init?.mediaId
    ? ["agent-media", "agent", "static"]
    : ["agent", "static"];

  let lastError: Error | undefined;
  for (const mode of modes) {
    try {
      const keystream = buildMegaupKeystream(encBytes.length, {
        ...init,
        mode,
      });
      return decryptMegaupPayloadWithKeystream(encryptedBase64, keystream);
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("MegaUp decrypt failed");
    }
  }

  throw lastError ?? new Error("MegaUp decrypt failed");
};

/** Symmetric helper for unit tests (XOR keystream). */
export const encryptMegaupPayloadForTest = (
  payload: MegaupDecryptPayload,
  init?: { userAgent?: string; mediaId?: string; mode?: MegaupKeystreamMode },
): string => {
  const plain = JSON.stringify(payload);
  const plainBytes = Buffer.from(plain, "utf8");
  const keystream = buildMegaupKeystream(plainBytes.length, init);
  const out = Buffer.alloc(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i += 1) {
    out[i] = plainBytes[i]! ^ keystream[i % keystream.length]!;
  }
  return out
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
};

export const megaupMediaUrlFromEmbed = (embedUrl: string): string | null => {
  try {
    const parsed = new URL(embedUrl);
    if (!parsed.pathname.includes("/e/")) {
      return null;
    }
    parsed.pathname = parsed.pathname.replace("/e/", "/media/");
    return parsed.toString();
  } catch {
    return null;
  }
};

export const megaupRefererFromEmbed = (embedUrl: string): string | null => {
  try {
    const parsed = new URL(embedUrl);
    const prefix = parsed.pathname.split("/e/")[0];
    return `${parsed.origin}${prefix}/e/`
      .replace(/\/e\/$/, "/")
      .replace(/\/$/, "/");
  } catch {
    return null;
  }
};

export const extractMegaupMediaId = (mediaUrlOrPath: string): string | null => {
  const trimmed = mediaUrlOrPath.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const pathname = trimmed.startsWith("http")
      ? new URL(trimmed).pathname
      : trimmed;
    const segments = pathname.split("/").filter(Boolean);
    const mediaIdx = segments.findIndex((segment) => segment === "media");
    if (mediaIdx >= 0 && segments[mediaIdx + 1]) {
      return segments[mediaIdx + 1] ?? null;
    }
    return segments.at(-1) ?? null;
  } catch {
    return null;
  }
};
