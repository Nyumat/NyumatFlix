import { mergeDirectStreams } from "@/lib/direct/merge-direct-streams";
import { directDiscoveryEventPath } from "@/lib/direct/discovery-paths";
import {
  collectStreamsFromDirectSse,
  type DirectSseStream,
} from "@/lib/direct/scrape-sse";
import { ensureDirectSession } from "@/lib/direct/session";
import type { DirectStream, DirectStreamsResponse } from "@/lib/direct/types";
import type { ProgressiveDirectStreamRequest } from "@/lib/direct/progressive-streams-request";

export type CollectDirectStreamsClientOptions = {
  signal?: AbortSignal;
  /** Return after the first SSE batch with streams instead of waiting for done. */
  quick?: boolean;
};

function hasAnyStream(streams: readonly DirectSseStream[]): boolean {
  return streams.length > 0;
}

export async function collectDirectStreamsClient(
  request: ProgressiveDirectStreamRequest,
  options?: CollectDirectStreamsClientOptions,
): Promise<DirectStreamsResponse> {
  const response = await fetch(directDiscoveryEventPath(request), {
    headers: { Accept: "text/event-stream" },
    signal: options?.signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Direct stream discovery ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
    );
  }

  const quick = options?.quick ?? false;
  const payload = await collectStreamsFromDirectSse(
    response,
    options?.signal ?? AbortSignal.timeout(180_000),
    quick ? hasAnyStream : () => false,
  );

  const { apiBase, token } = await ensureDirectSession();
  const target = { apiBase, accessToken: token };
  const streams = mergeDirectStreams(
    [],
    payload.streams as DirectStream[],
    target,
  );

  return {
    streams,
    ...(payload.message ? { message: payload.message } : {}),
  };
}
