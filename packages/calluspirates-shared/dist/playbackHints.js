function streamBlob(stream) {
    return [stream.fileName, stream.name, stream.description]
        .filter((part) => Boolean(part?.trim()))
        .join(" ")
        .toLowerCase();
}
function hasDvheProfile(blob, profile) {
    const n = String(profile);
    return new RegExp(String.raw `\bdv(?:he|av|h1)\.?0?${n}(?:\.|\b)`, "i").test(blob);
}
function hasDolbyVisionTag(blob) {
    return (/\b(?:dovi|dolby[.\-_ ]?vision)\b/.test(blob) ||
        /\bdvhe\b/.test(blob) ||
        /\bdv\b/.test(blob));
}
function hasHdr10CompatibleFallback(blob) {
    return (/\bhdr10(?:\+|plus)?(?:[.\-_ ]compatible)?\b/.test(blob) ||
        /\bhdr\b/.test(blob) ||
        /\bhlg\b/.test(blob) ||
        /\bhybrid\b/.test(blob));
}
/** profile 5 (dvhe.05, DV without HDR) decodes magenta/green in the browser. */
export function isIncompatibleDolbyVision(stream) {
    const blob = streamBlob(stream);
    if (hasDvheProfile(blob, 5) || hasDvheProfile(blob, 4)) {
        return true;
    }
    if (hasDvheProfile(blob, 8) ||
        hasDvheProfile(blob, 7) ||
        hasDvheProfile(blob, 9)) {
        return false;
    }
    if (!hasDolbyVisionTag(blob)) {
        return false;
    }
    return !hasHdr10CompatibleFallback(blob);
}
export function shouldSkipBrowserPlayback(stream) {
    return (isTooHeavyForBrowserPlayback(stream) || isIncompatibleDolbyVision(stream));
}
export function streamSizeBytes(stream) {
    const raw = stream.size;
    if (typeof raw === "number" && raw > 0)
        return raw;
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        const gb = trimmed.match(/^([\d.]+)\s*gi?b$/i);
        if (gb)
            return Math.round(Number(gb[1]) * 1e9);
        const mb = trimmed.match(/^([\d.]+)\s*mi?b$/i);
        if (mb)
            return Math.round(Number(mb[1]) * 1e6);
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed) && parsed > 0)
            return parsed;
    }
    return 0;
}
export function isRemuxRelease(stream) {
    return /remux|complete\.bluray/i.test(streamBlob(stream));
}
const MAX_BROWSER_PLAYBACK_GB = 100;
export function isTooHeavyForBrowserPlayback(stream) {
    const bytes = streamSizeBytes(stream);
    if (bytes <= 0)
        return false;
    return bytes / 1e9 >= MAX_BROWSER_PLAYBACK_GB;
}
export function hasHeavyCodecTags(stream) {
    return /\b(hevc|x265|h\.?265|av1|dts|truehd|atmos|ma\.?\s*5\.?1)\b/.test(streamBlob(stream));
}
export function is4KRelease(stream) {
    const blob = streamBlob(stream);
    return /\b(2160p|4k|uhd)\b/.test(blob);
}
export function inferTranscodeProfile(stream) {
    const bytes = streamSizeBytes(stream);
    const gb = bytes / 1e9;
    if (isRemuxRelease(stream) && (is4KRelease(stream) || gb >= 40)) {
        return "ultra";
    }
    if (isRemuxRelease(stream) || gb >= 25) {
        return "heavy";
    }
    if (hasHeavyCodecTags(stream) && gb >= 15) {
        return "heavy";
    }
    return "light";
}
export function inferPlaybackEngineHint(stream) {
    if (stream.playback === "direct" || stream.playback === "hls") {
        return "movi-first";
    }
    if (stream.browserPlayable === true && stream.playback !== "extended") {
        return "movi-first";
    }
    // MP4 remux without a seek index — server transcode before client decode.
    if (prefersProgressiveTranscode(stream)) {
        return "hls-first";
    }
    // MKV / HEVC / other extended: proxy bytes, decode in the browser via movi.
    return "movi-first";
}
export function requiresExtendedPlayback(name) {
    const blob = name.toLowerCase();
    if (/remux|complete\.bluray/i.test(blob))
        return true;
    if (/\b(hevc|x265|h\.?265|av1|truehd|dts-hd|dts\.?\d|atmos)\b/.test(blob)) {
        return true;
    }
    if (/\.(mkv|avi|ts)(?:[?#]|$)/i.test(blob))
        return true;
    // multi-audio releases need movi or transcode — html5 video can't pick tracks
    if (/\bmulti\b/i.test(blob))
        return true;
    // uhd bluray without explicit x264 is typically hevc + non-aac audio
    if (/\b(2160p|4k|uhd)\b/.test(blob) &&
        /\b(bluray|blu-ray|bdrip|brrip)\b/.test(blob) &&
        !/\b(x264|h\.?264|avc)\b/.test(blob)) {
        return true;
    }
    return false;
}
export function isBrowserPlayableRelease(name, mime) {
    if (requiresExtendedPlayback(name))
        return false;
    if (/\.(mp4|m4v|webm)(?:[?#]|$)/i.test(name))
        return true;
    const lower = mime?.toLowerCase() ?? "";
    return lower === "video/mp4" || lower.startsWith("video/mp4;");
}
/**
 * True when this release is worth offering for in-browser play (movi / Vidstack).
 * Remux and HDR10-compatible Dolby Vision (profile 8) go through movi-player.
 * Profile 5 (DV without HDR) is skipped — movi cannot tonemap ICtCp.
 */
export function isBrowserStreamCandidate(stream) {
    if (shouldSkipBrowserPlayback(stream)) {
        return false;
    }
    if (stream.playback === "direct" || stream.playback === "hls") {
        return true;
    }
    if (stream.playback === "extended") {
        return true;
    }
    if (requiresExtendedPlayback(streamBlob(stream))) {
        return true;
    }
    return stream.browserPlayable === true;
}
export function filterBrowserStreams(streams) {
    return streams.filter(isBrowserStreamCandidate);
}
export function partitionBrowserStreams(streams) {
    const browser = [];
    const external = [];
    for (const stream of streams) {
        if (isBrowserStreamCandidate(stream)) {
            browser.push(stream);
        }
        else {
            external.push(stream);
        }
    }
    return { browser, external };
}
export function prefersTranscodeFirst(stream) {
    return inferPlaybackEngineHint(stream) === "hls-first";
}
/** MP4 remuxes often lack a moov/keyframe index — HLS playlist generation fails. */
export function prefersProgressiveTranscode(stream) {
    if (!isRemuxRelease(stream))
        return false;
    return /\.mp4(?:[?#]|$)/i.test(streamBlob(stream));
}
export function isProgressiveTranscodePath(path) {
    return path.includes("/api/transcode/stream");
}
/** HLS playlist fallback from MediaFlow → matching progressive fMP4 transcode URL. */
export function companionProgressiveTranscodePath(transcodePath) {
    if (!transcodePath.includes("/api/transcode/playlist")) {
        return null;
    }
    return transcodePath.replace("/api/transcode/playlist", "/api/transcode/stream");
}
