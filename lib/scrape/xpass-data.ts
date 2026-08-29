const XPASS_DATA_RESPONSE_PREFIX = "spv3-data-response|";
/** Matches `mplayermini.js` build stamp used for response key derivation. */
export const XPASS_DATA_BUILD = "spv3-build-1787631086-e7f1a41248afb870";

const XPASS_ALLOWED_HOSTS = new Set(["play.xpass.top", "play2.xpass.top"]);

export type XPassBackupServer = {
  id?: string;
  name?: string;
  url?: string;
  dl?: boolean;
};

export const extractXPassDataUrl = (html: string): string | null => {
  const match = html.match(/var dataUrl="([^"]+)"/);
  return match?.[1] ?? null;
};

export const decodeXPassBase64Url = (input: string): Uint8Array => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(`${normalized}${padding}`), (char) =>
    char.charCodeAt(0),
  );
};

export const isValidXPassDataToken = (
  token: string,
  hostname: string,
  dataPathname: string,
  embedContext: string,
): boolean => {
  if (!dataPathname.includes("/data/")) {
    return false;
  }

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !/^[0-9a-f]{64}$/.test(signaturePart ?? "")) {
    return false;
  }

  let parts: string[];
  try {
    parts = new TextDecoder()
      .decode(decodeXPassBase64Url(payloadPart))
      .split("|");
  } catch {
    return false;
  }

  if (
    parts.length !== 10 ||
    parts[0] !== "v2" ||
    parts[1] !== hostname ||
    parts[2] !== embedContext ||
    parts[3] !== dataPathname ||
    !parts[9]
  ) {
    return false;
  }

  const expires = Number(parts[8]);
  const now = Math.floor(Date.now() / 1000);
  return Number.isFinite(expires) && expires > now && expires <= now + 0x12c;
};

export const deriveXPassDataKey = async (
  hostname: string,
  dataPathname: string,
  token: string,
): Promise<Uint8Array> => {
  const material = `${XPASS_DATA_RESPONSE_PREFIX}${XPASS_DATA_BUILD}|${hostname}|${dataPathname}|${token}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material),
  );
  return new Uint8Array(digest);
};

export const decryptXPassDataResponse = async (
  encryptedBody: string,
  options: {
    hostname: string;
    dataPathname: string;
    token: string;
    embedContext: string;
  },
): Promise<XPassBackupServer[]> => {
  const { hostname, dataPathname, token, embedContext } = options;

  if (!XPASS_ALLOWED_HOSTS.has(hostname)) {
    throw new Error("XPass data hostname is not allowed");
  }

  if (!dataPathname.includes("/data/")) {
    throw new Error("XPass data path is invalid");
  }

  if (!isValidXPassDataToken(token, hostname, dataPathname, embedContext)) {
    throw new Error("XPass data token is invalid or expired");
  }

  const key = await deriveXPassDataKey(hostname, dataPathname, token);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    "AES-GCM",
    false,
    ["decrypt"],
  );

  const encrypted = decodeXPassBase64Url(encryptedBody.trim());
  if (encrypted.length <= 12) {
    throw new Error("XPass encrypted response is incomplete");
  }

  const iv = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext,
  );

  const payload = JSON.parse(new TextDecoder().decode(plain)) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("XPass decrypted payload is not a backup list");
  }

  return payload.filter(
    (entry): entry is XPassBackupServer =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as XPassBackupServer).url === "string",
  );
};

export const playlistPathsFromXPassBackups = (
  backups: XPassBackupServer[],
): string[] => {
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const backup of backups) {
    const raw = backup.url?.replace(/^\//, "");
    if (!raw || !raw.includes("playlist.json") || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    paths.push(raw);
  }

  return paths;
};
