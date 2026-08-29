import {
  isStereoscopicDirectStream,
  rankDirectMovieStreams,
} from "@calluspirates/shared";

import {
  rewriteDirectStreamUrls,
  type DirectPlaybackTarget,
} from "@/lib/direct/client-streams";
import type { DirectStream } from "@/lib/direct/types";

function streamKey(stream: DirectStream): string {
  const hash = stream.hash?.trim().toLowerCase();
  if (hash) {
    return hash;
  }
  return stream.url;
}

export function mergeDirectStreams(
  current: readonly DirectStream[],
  incoming: readonly DirectStream[],
  target?: DirectPlaybackTarget,
): DirectStream[] {
  const merged = new Map<string, DirectStream>();
  for (const stream of [...current, ...incoming]) {
    if (isStereoscopicDirectStream(stream)) {
      continue;
    }
    const next = target ? rewriteDirectStreamUrls(stream, target) : stream;
    merged.set(streamKey(next), next);
  }
  return rankDirectMovieStreams([...merged.values()]);
}
