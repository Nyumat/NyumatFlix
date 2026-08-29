import { createDecipheriv, createHash } from "node:crypto";

const ALLANIME_AES_ALGO = "aes-256-ctr";
const ALLANIME_VERSION_LENGTH = 1;
const ALLANIME_IV_LENGTH = 12;
const ALLANIME_AUTH_TAG_LENGTH = 16;
const ALLANIME_BLOB_VERSION = 0x01;
const ALLANIME_COUNTER_SUFFIX = Buffer.from([0x00, 0x00, 0x00, 0x02]);
const ALLANIME_SECRET = "Xot36i3lK3:v1";
const ALLANIME_KEY = createHash("sha256").update(ALLANIME_SECRET).digest();

export type AllanimeSourceUrl = {
  sourceUrl?: string;
  sourceName?: string;
  type?: string;
  downloadUrl?: string;
  priority?: number;
};

export type AllanimeEpisodePayload = {
  episode?: {
    episodeString?: string;
    sourceUrls?: AllanimeSourceUrl[];
  };
};

const parseDecryptedPayload = (payload: string): unknown => {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return JSON.parse(payload.replace(/,\s*([\]}])/g, "$1")) as unknown;
  }
};

export const decryptAllanimeTobeparsed = (blobBase64: string): unknown => {
  const blob = Buffer.from(blobBase64, "base64");
  const minimumLength =
    ALLANIME_VERSION_LENGTH + ALLANIME_IV_LENGTH + ALLANIME_AUTH_TAG_LENGTH;

  if (blob.length < minimumLength) {
    throw new Error("AllAnime encrypted payload is too short");
  }

  const version = blob[0];
  if (version !== ALLANIME_BLOB_VERSION) {
    throw new Error(
      `Unsupported AllAnime blob version: ${version ?? "unknown"}`,
    );
  }

  const ivStart = ALLANIME_VERSION_LENGTH;
  const ivEnd = ivStart + ALLANIME_IV_LENGTH;
  const ciphertextStart = ivEnd;
  const ciphertextEnd = blob.length - ALLANIME_AUTH_TAG_LENGTH;

  if (ciphertextEnd < ciphertextStart) {
    throw new Error("AllAnime encrypted payload has invalid boundaries");
  }

  const iv = blob.subarray(ivStart, ivEnd);
  const ciphertext = blob.subarray(ciphertextStart, ciphertextEnd);
  const ctrIv = Buffer.concat([iv, ALLANIME_COUNTER_SUFFIX]);

  const decipher = createDecipheriv(ALLANIME_AES_ALGO, ALLANIME_KEY, ctrIv);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return parseDecryptedPayload(decrypted.toString("utf8"));
};

export const normalizeAllanimeApiResponse = <T>(json: unknown): T => {
  if (!json || typeof json !== "object") {
    return json as T;
  }

  const record = json as Record<string, unknown>;
  const topLevelTobeparsed = record.tobeparsed;
  if (typeof topLevelTobeparsed === "string" && topLevelTobeparsed.length > 0) {
    const decrypted = decryptAllanimeTobeparsed(topLevelTobeparsed);
    if (decrypted && typeof decrypted === "object") {
      return { data: decrypted } as T;
    }
  }

  const dataField = record.data;
  if (dataField && typeof dataField === "object") {
    const dataRecord = dataField as Record<string, unknown>;
    const nestedTobeparsed = dataRecord.tobeparsed;
    if (typeof nestedTobeparsed === "string" && nestedTobeparsed.length > 0) {
      const decrypted = decryptAllanimeTobeparsed(nestedTobeparsed);
      if (decrypted && typeof decrypted === "object") {
        return { data: decrypted } as T;
      }
    }
  }

  return json as T;
};

const HEX_PAIR_TO_CHAR: Record<string, string> = {
  "79": "A",
  "7a": "B",
  "7b": "C",
  "7c": "D",
  "7d": "E",
  "7e": "F",
  "7f": "G",
  "70": "H",
  "71": "I",
  "72": "J",
  "73": "K",
  "74": "L",
  "75": "M",
  "76": "N",
  "77": "O",
  "68": "P",
  "69": "Q",
  "6a": "R",
  "6b": "S",
  "6c": "T",
  "6d": "U",
  "6e": "V",
  "6f": "W",
  "60": "X",
  "61": "Y",
  "62": "Z",
  "59": "a",
  "5a": "b",
  "5b": "c",
  "5c": "d",
  "5d": "e",
  "5e": "f",
  "5f": "g",
  "50": "h",
  "51": "i",
  "52": "j",
  "53": "k",
  "54": "l",
  "55": "m",
  "56": "n",
  "57": "o",
  "48": "p",
  "49": "q",
  "4a": "r",
  "4b": "s",
  "4c": "t",
  "4d": "u",
  "4e": "v",
  "4f": "w",
  "40": "x",
  "41": "y",
  "42": "z",
  "08": "0",
  "09": "1",
  "0a": "2",
  "0b": "3",
  "0c": "4",
  "0d": "5",
  "0e": "6",
  "0f": "7",
  "00": "8",
  "01": "9",
  "15": "-",
  "16": ".",
  "67": "_",
  "46": "~",
  "02": ":",
  "17": "/",
  "07": "?",
  "1b": "#",
  "63": "[",
  "65": "]",
  "78": "@",
  "19": "!",
  "1c": "$",
  "1e": "&",
  "10": "(",
  "11": ")",
  "12": "*",
  "13": "+",
  "14": ",",
  "03": ";",
  "05": "=",
  "1d": "%",
};

/** Decode AllAnime `--` provider path tokens (ani-cli custom hex alphabet). */
export const decodeAllanimeProviderPath = (encoded: string): string => {
  const body = encoded.startsWith("--") ? encoded.slice(2) : encoded;
  const pairs = body.match(/.{1,2}/g) ?? [];

  return pairs
    .map((pair) => HEX_PAIR_TO_CHAR[pair.toLowerCase()] ?? "")
    .join("")
    .replace(/\/clock(?!\.json)/, "/clock.json");
};

export const pickBestAllanimeStream = (
  sources: AllanimeSourceUrl[],
): { url: string; kind: "hls" | "mp4" } | null => {
  const candidates = sources
    .map((source) => {
      const raw = source.sourceUrl ?? source.downloadUrl ?? "";
      const decoded = raw.startsWith("--")
        ? decodeAllanimeProviderPath(raw)
        : raw;
      return { ...source, decoded };
    })
    .filter((source) => source.decoded.length > 0);

  const hls = candidates.find(
    (source) =>
      source.type === "hls" ||
      source.decoded.includes(".m3u8") ||
      source.decoded.includes("master.m3u8"),
  );
  if (hls) {
    return { url: hls.decoded, kind: "hls" };
  }

  const mp4 = candidates.find(
    (source) =>
      source.type === "mp4" ||
      source.decoded.includes(".mp4") ||
      source.decoded.endsWith("/Mp4"),
  );
  if (mp4) {
    return { url: mp4.decoded, kind: "mp4" };
  }

  return null;
};
