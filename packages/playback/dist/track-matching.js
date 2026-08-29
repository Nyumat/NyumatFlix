export const normalizeTrackLanguage = (value) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
export const trackMatchesLanguage = (track, preferred) => {
    const normalizedPreferred = normalizeTrackLanguage(preferred);
    if (!normalizedPreferred) {
        return false;
    }
    const candidates = [track.language, track.label, track.lang].filter((value) => typeof value === "string" && value.length > 0);
    return candidates.some((candidate) => {
        const normalizedCandidate = normalizeTrackLanguage(candidate);
        if (!normalizedCandidate) {
            return false;
        }
        return (normalizedCandidate === normalizedPreferred ||
            normalizedCandidate.includes(normalizedPreferred) ||
            normalizedPreferred.includes(normalizedCandidate));
    });
};
export const pickTrackIndexByLanguage = (tracks, preferred) => {
    if (!preferred) {
        return null;
    }
    const index = tracks.findIndex((track) => trackMatchesLanguage(track, preferred));
    return index >= 0 ? index : null;
};
export const isJapaneseAudioPreference = (preferredAudioLang) => Boolean(preferredAudioLang &&
    (trackMatchesLanguage({ lang: preferredAudioLang }, "jpn") ||
        trackMatchesLanguage({ lang: preferredAudioLang }, "ja")));
