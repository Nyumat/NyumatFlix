/** Shared stream ranking: source quality and resolution beat x264/playability tiebreakers. */
import { isLikelyMultiMoviePack } from "./titleMatchHelpers.js";
const STEREOSCOPIC_RELEASE_PATTERN = /(?:^|[\s._-])(?:h(?:alf)?[\s._-]?(?:ou|sbs)|sbs|(?:ou|sbs)[\s._-]?3d|3d[\s._-]?(?:ou|sbs)|side[\s._-]?by[\s._-]?side|over[\s._-]?under|top[\s._-]?(?:and[\s._-]?)?bottom|mvc)(?=$|[\s._-])/i;
function streamNameBlob(stream) {
    return `${stream.fileName ?? ""} ${stream.name}`.toLowerCase();
}
export function isStereoscopicRelease(value) {
    return STEREOSCOPIC_RELEASE_PATTERN.test(value);
}
export function isCamOrTelesync(blob) {
    const n = blob.toLowerCase();
    if (/\b(cam|hdcam|hdts|hd-ts|telesync|telecine|hdtscr|screener)\b/.test(n)) {
        return true;
    }
    // Telesync quality tags like 1080p.TS. or .TS.XViD — not .ts/.m2ts file extensions
    if (/\d{3,4}p[.\-_ ]ts[.\-_ ]/i.test(n) ||
        /[.\-_ ]ts[.\-_ ](?:xvid|divx|aac|ac3|mp3|mkv|avi|x264|x265)\b/i.test(n)) {
        return true;
    }
    // HDRip without a WEB/BluRay source is often a cam
    if (/\bhdrip\b/.test(n) && !/\bweb/i.test(n))
        return true;
    // RGB release group + "HD" without WEB/BluRay is typically a cam
    if (/\brgb\b/.test(n) &&
        /\bhd\b/.test(n) &&
        !/\bweb/i.test(n) &&
        !/\bbluray\b/i.test(n)) {
        return true;
    }
    return false;
}
/** Score release source from torrent/file name. Higher = better. Cam/telesync = 0. */
export function releaseQualityScore(blob) {
    const n = blob.toLowerCase();
    if (isCamOrTelesync(n))
        return 0;
    if (/\b(remux|complete\.bluray|blu-ray|bluray)\b/.test(n))
        return 100;
    if (/\bweb-?dl\b/.test(n))
        return 95;
    if (/\b(amzn|itunes|\bit\b|\bgplay\b|\bapple\.?tv|\bds4k\b|\bma\b|\bcore\b|\bcr\b)\b/.test(n)) {
        return 92;
    }
    if (/\bwebrip\b/.test(n))
        return 85;
    if (/\b(web|webdl)\b/.test(n) && !/\bwebcam\b/.test(n))
        return 80;
    if (/\bbdrip\b/.test(n))
        return 75;
    if (/\bhdtv\b/.test(n))
        return 55;
    if (/\bdvdrip\b/.test(n))
        return 35;
    return 45;
}
export function streamResolutionRank(name, resolution) {
    const res = (resolution ?? "").toLowerCase();
    if (/\b(2160p|4k|uhd)\b/.test(res))
        return 4;
    if (/\b1080p\b/.test(res))
        return 3;
    if (/\b720p\b/.test(res))
        return 2;
    if (/\b480p\b/.test(res))
        return 1;
    const lowerName = name.toLowerCase();
    if (/\b(2160p|4k)\b/.test(lowerName))
        return 4;
    if (/\b1080p\b/.test(lowerName))
        return 3;
    if (/\b720p\b/.test(lowerName))
        return 2;
    if (/\b480p\b/.test(lowerName))
        return 1;
    return 0;
}
function isYtsOrMp4Name(blob) {
    return (/\b(yts|yify)\b/.test(blob) || /\.mp4\b/.test(blob) || /\bmp4\b/.test(blob));
}
function isX264Friendly(blob) {
    if (/\b(hevc|x265|h\.?265|av1|remux)\b/.test(blob))
        return false;
    return /\b(x264|h\.?264|avc)\b/.test(blob);
}
function isPlayable(stream) {
    return (stream.browserPlayable === true ||
        stream.playback === "extended" ||
        stream.playback === "hls");
}
function isHeavyMoviRemux(stream) {
    return /\b(remux|complete\.bluray)\b/.test(streamNameBlob(stream));
}
function streamSizeBytes(stream) {
    const raw = stream.size;
    if (typeof raw === "number" && raw > 0)
        return raw;
    if (typeof raw === "string") {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0)
            return parsed;
    }
    return 0;
}
function isRemuxRelease(blob) {
    return /remux|complete\.bluray/i.test(blob);
}
/** Prefer modern codecs on encoded releases; remux quality comes from source tier. */
function encodeCodecScore(blob) {
    if (isRemuxRelease(blob))
        return 0;
    if (/\b(av1)\b/.test(blob))
        return 8;
    if (/\b(x265|h\.?265|hevc)\b/.test(blob))
        return 6;
    if (/\b10bit\b/.test(blob) && /\b(uhd|2160p|4k)\b/.test(blob))
        return 4;
    if (/\b(x264|h\.?264|avc)\b/.test(blob))
        return 2;
    return 0;
}
/** Smaller encoded files at the same tier usually mean better compression. */
function encodeSizeEfficiencyBonus(stream, blob) {
    if (isRemuxRelease(blob))
        return 0;
    const bytes = streamSizeBytes(stream);
    if (bytes <= 0)
        return 0;
    return -bytes / 2e9;
}
function sizePlayabilityPenalty(bytes) {
    if (bytes <= 0)
        return 0;
    const gb = bytes / 1e9;
    if (gb >= 100)
        return 100_000;
    if (gb >= 50)
        return 40_000;
    if (gb >= 25)
        return 15_000;
    if (gb >= 15)
        return 5_000;
    return 0;
}
function playbackTier(stream) {
    if (stream.playback === "direct" && stream.browserPlayable !== false) {
        return 0;
    }
    if (stream.playback === "hls") {
        return 1;
    }
    if (stream.playback === "extended" && !isHeavyMoviRemux(stream)) {
        return 2;
    }
    if (stream.playback === "extended") {
        return 3;
    }
    return 4;
}
/** Higher score = better stream for auto-play and list ordering. */
export function streamPickScore(stream) {
    const blob = streamNameBlob(stream);
    let score = 0;
    // Source quality dominates — WEB-DL/BluRay must beat cam/telesync
    score += releaseQualityScore(blob) * 10;
    // Resolution next — 2160p should beat 1080p at the same source tier
    score += streamResolutionRank(stream.name, stream.resolution) * 100;
    // Playability and codec are tiebreakers only
    if (isPlayable(stream))
        score += 50;
    if (isX264Friendly(blob))
        score += 10;
    if (isYtsOrMp4Name(blob))
        score += 5;
    if (isLikelyMultiMoviePack(blob))
        score -= 100_000;
    score += encodeCodecScore(blob);
    score += encodeSizeEfficiencyBonus(stream, blob);
    score -= sizePlayabilityPenalty(streamSizeBytes(stream));
    return score;
}
export function compareStreamRank(a, b) {
    const tierDelta = playbackTier(a) - playbackTier(b);
    if (tierDelta !== 0) {
        return tierDelta;
    }
    const scoreDelta = streamPickScore(b) - streamPickScore(a);
    if (scoreDelta !== 0) {
        return scoreDelta;
    }
    const aBlob = streamNameBlob(a);
    const bBlob = streamNameBlob(b);
    if (!isRemuxRelease(aBlob) && !isRemuxRelease(bBlob)) {
        return streamSizeBytes(a) - streamSizeBytes(b);
    }
    return 0;
}
export function rankStreams(streams) {
    return [...streams].sort(compareStreamRank);
}
export function pickBestStream(streams) {
    return rankStreams(streams)[0] ?? null;
}
