/** Direct provider ranking helpers shared with NyumatFlix. */
import {
  compareStreamRank,
  isStereoscopicRelease,
  streamPickScore,
} from "./streamRank.js";
export function isStereoscopicDirectStream(stream) {
  return isStereoscopicRelease(`${stream.fileName ?? ""} ${stream.name}`);
}
export function directStreamPickScore(stream) {
  let score = streamPickScore(stream);
  if (stream.playback === "direct" && stream.browserPlayable === true) {
    score += 800;
  }
  return score;
}
export function rankDirectStreams(streams) {
  return streams
    .filter((stream) => !isStereoscopicDirectStream(stream))
    .sort(
      (left, right) =>
        directStreamPickScore(right) - directStreamPickScore(left),
    );
}
export function pickBestDirectStream(streams) {
  return rankDirectStreams(streams)[0] ?? null;
}
function playbackTier(stream) {
  const blob = `${stream.fileName ?? ""} ${stream.name}`.toLowerCase();
  const isHeavyMoviRemux = /\b(remux|complete\.bluray)\b/.test(blob);
  if (stream.playback === "direct" && stream.browserPlayable !== false) {
    return 0;
  }
  if (stream.playback === "hls") {
    return 1;
  }
  if (stream.playback === "extended" && !isHeavyMoviRemux) {
    return 2;
  }
  if (stream.playback === "extended") {
    return 3;
  }
  return 4;
}
function streamByteSize(stream) {
  const size = stream.size;
  if (typeof size === "number" && size > 0) {
    return size;
  }
  if (typeof size === "string") {
    const parsed = Number.parseFloat(size);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}
export function rankDirectMovieStreamsForPlayback(streams) {
  const twoDimensional = streams.filter(
    (stream) => !isStereoscopicDirectStream(stream),
  );
  const cached = twoDimensional.filter((stream) => stream.cached !== false);
  const candidates = cached.length > 0 ? cached : twoDimensional;
  return [...candidates].sort((left, right) => {
    const tierDelta = playbackTier(left) - playbackTier(right);
    if (tierDelta !== 0) {
      return tierDelta;
    }
    const leftTier = playbackTier(left);
    if (leftTier >= 2) {
      const sizeDelta = streamByteSize(left) - streamByteSize(right);
      if (sizeDelta !== 0) {
        return sizeDelta;
      }
    }
    const scoreDelta = compareStreamRank(left, right);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return streamByteSize(left) - streamByteSize(right);
  });
}
export function rankDirectMovieStreams(streams) {
  return rankDirectMovieStreamsForPlayback(streams);
}
export function pickBestDirectMovieStream(streams) {
  return rankDirectMovieStreamsForPlayback(streams)[0] ?? null;
}
