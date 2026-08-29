import { engineSourceUrl as directEngineSourceUrlFromStream, engineStreamKind, nextFallbackEngine, selectInitialEngine, supportsWebCodecs, toDirectStream, } from "./playback";
export { supportsWebCodecs };
export function selectDirectPlaybackEngine(playback, fallbackUrl, mediaUrl, fileName, name, size, browserPlayable, playbackHint) {
    const resolvedFileName = fileName ?? (mediaUrl ? mediaUrl.split("/").pop() : undefined);
    const resolvedName = name ?? resolvedFileName;
    return selectInitialEngine(toDirectStream({
        url: mediaUrl ?? "",
        fallbackUrl,
        playback,
        browserPlayable,
        fileName: resolvedFileName,
        name: resolvedName,
        size,
        playbackHint,
    }));
}
export function nextDirectPlaybackEngine(playback, current, fallbackUrl, mediaUrl, fileName, name, playbackHint) {
    const resolvedFileName = fileName ?? (mediaUrl ? mediaUrl.split("/").pop() : undefined);
    const resolvedName = name ?? resolvedFileName;
    return nextFallbackEngine(toDirectStream({
        url: mediaUrl ?? "",
        fallbackUrl,
        playback,
        fileName: resolvedFileName,
        name: resolvedName,
        playbackHint,
    }), current);
}
export function directEngineSourceUrl(mediaUrl, fallbackUrl, engine) {
    return directEngineSourceUrlFromStream(toDirectStream({ url: mediaUrl, fallbackUrl }), engine);
}
export function directEngineStreamKind(engine, sourceUrl) {
    return engineStreamKind(engine, sourceUrl);
}
