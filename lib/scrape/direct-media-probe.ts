/** Validate upstream media bytes — HTTP 206 alone is not enough (resolver junk). */

export function looksLikeMp4(bytes: Uint8Array): boolean {
  if (bytes.length < 12) {
    return false;
  }
  return (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  );
}

export function looksLikeMkv(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

export function isVideoContentType(contentType: string | null): boolean {
  const normalized = (contentType ?? "").toLowerCase();
  return normalized.startsWith("video/");
}

export function isDirectBrowserMedia(
  contentType: string | null,
  bytes: Uint8Array,
): boolean {
  if (isVideoContentType(contentType) && looksLikeMp4(bytes)) {
    return true;
  }
  return looksLikeMp4(bytes);
}

export function isExtendedContainerMedia(
  contentType: string | null,
  bytes: Uint8Array,
): boolean {
  if (isDirectBrowserMedia(contentType, bytes)) {
    return true;
  }
  if (looksLikeMkv(bytes)) {
    return true;
  }
  return isVideoContentType(contentType) && !contentType?.startsWith("text/");
}
