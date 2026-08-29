export type TrackLanguageFields = {
    language?: string | null;
    label?: string | null;
    lang?: string | null;
};
export declare const normalizeTrackLanguage: (value: string) => string;
export declare const trackMatchesLanguage: (track: TrackLanguageFields, preferred: string) => boolean;
export declare const pickTrackIndexByLanguage: <T extends TrackLanguageFields>(tracks: readonly T[], preferred: string | null | undefined) => number | null;
export declare const isJapaneseAudioPreference: (preferredAudioLang?: string | null) => boolean;
