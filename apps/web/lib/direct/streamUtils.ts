import type { DirectStream } from "@nyumatflix/playback";

export function streamIdentity(stream: DirectStream): string {
  if (stream.hash) {
    return `hash:${stream.hash}`;
  }
  return `${stream.source ?? "stream"}:${stream.name}`;
}
