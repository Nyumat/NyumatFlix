import {
  isStereoscopicDirectStream,
  rankDirectMovieStreams,
} from "@calluspirates/shared";

import { rewriteDirectStreamUrls } from "@/lib/direct/client-streams";
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
): DirectStream[] {
  const merged = new Map<string, DirectStream>();
  for (const stream of [...current, ...incoming]) {
    if (isStereoscopicDirectStream(stream)) {
      continue;
    }
    merged.set(streamKey(stream), rewriteDirectStreamUrls(stream));
  }
  return rankDirectMovieStreams([...merged.values()]);
}
