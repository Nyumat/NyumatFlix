import type { AniBridgeSeasonMappings } from "@/lib/anime/anibridge-season-segments";
import type { FribbAnimeRow } from "@/lib/fribb-core";

export const AOT_TMDB_SHOW_ID = 1429;

export const aotAniBridgeMappings: AniBridgeSeasonMappings = {
  "tmdb_show:1429:s1": {
    "anilist:16498": { "1-25": "1-25" },
  },
  "tmdb_show:1429:s2": {
    "anilist:20958": { "1-12": "1-12" },
  },
  "tmdb_show:1429:s3": {
    "anilist:99147": { "1-12": "1-12" },
    "anilist:104578": { "13-22": "1-10" },
  },
  "tmdb_show:1429:s4": {
    "anilist:110277": { "1-16": "1-16" },
    "anilist:131681": { "17-28": "1-12" },
  },
};

export const aotFribbRows: FribbAnimeRow[] = [
  {
    anilist_id: 16498,
    themoviedb_id: { tv: AOT_TMDB_SHOW_ID },
    season: { tmdb: 1 },
  },
  {
    anilist_id: 20958,
    themoviedb_id: { tv: AOT_TMDB_SHOW_ID },
    season: { tmdb: 2 },
  },
  {
    anilist_id: 99147,
    themoviedb_id: { tv: AOT_TMDB_SHOW_ID },
    season: { tmdb: 3 },
  },
  {
    anilist_id: 104578,
    themoviedb_id: { tv: AOT_TMDB_SHOW_ID },
    season: { tmdb: 3 },
    episode_offset: { tmdb: 12 },
  },
  {
    anilist_id: 110277,
    themoviedb_id: { tv: AOT_TMDB_SHOW_ID },
    season: { tmdb: 4 },
  },
  {
    anilist_id: 131681,
    themoviedb_id: { tv: AOT_TMDB_SHOW_ID },
    season: { tmdb: 4 },
    episode_offset: { tmdb: 16 },
  },
  {
    anilist_id: 146984,
    themoviedb_id: { tv: AOT_TMDB_SHOW_ID },
    season: { tmdb: 4 },
    episode_offset: { tmdb: 28 },
  },
];

export type AotBarometerCase = {
  label: string;
  seasonNumber: number;
  episodeNumber: number;
  anilistId: number;
  relativeEpisodeNumber: number;
};

export const aotBarometerCases: AotBarometerCase[] = [
  {
    label: "S1E1",
    seasonNumber: 1,
    episodeNumber: 1,
    anilistId: 16498,
    relativeEpisodeNumber: 1,
  },
  {
    label: "S1E25",
    seasonNumber: 1,
    episodeNumber: 25,
    anilistId: 16498,
    relativeEpisodeNumber: 25,
  },
  {
    label: "S2E1",
    seasonNumber: 2,
    episodeNumber: 1,
    anilistId: 20958,
    relativeEpisodeNumber: 1,
  },
  {
    label: "S2E12",
    seasonNumber: 2,
    episodeNumber: 12,
    anilistId: 20958,
    relativeEpisodeNumber: 12,
  },
  {
    label: "S3E1",
    seasonNumber: 3,
    episodeNumber: 1,
    anilistId: 99147,
    relativeEpisodeNumber: 1,
  },
  {
    label: "S3E12",
    seasonNumber: 3,
    episodeNumber: 12,
    anilistId: 99147,
    relativeEpisodeNumber: 12,
  },
  {
    label: "S3E13 part 2",
    seasonNumber: 3,
    episodeNumber: 13,
    anilistId: 104578,
    relativeEpisodeNumber: 1,
  },
  {
    label: "S3E22 part 2",
    seasonNumber: 3,
    episodeNumber: 22,
    anilistId: 104578,
    relativeEpisodeNumber: 10,
  },
  {
    label: "S4E1 part 1",
    seasonNumber: 4,
    episodeNumber: 1,
    anilistId: 110277,
    relativeEpisodeNumber: 1,
  },
  {
    label: "S4E16 part 1",
    seasonNumber: 4,
    episodeNumber: 16,
    anilistId: 110277,
    relativeEpisodeNumber: 16,
  },
  {
    label: "S4E17 part 2",
    seasonNumber: 4,
    episodeNumber: 17,
    anilistId: 131681,
    relativeEpisodeNumber: 1,
  },
  {
    label: "S4E28 part 2",
    seasonNumber: 4,
    episodeNumber: 28,
    anilistId: 131681,
    relativeEpisodeNumber: 12,
  },
  {
    label: "S4E29 special 1",
    seasonNumber: 4,
    episodeNumber: 29,
    anilistId: 146984,
    relativeEpisodeNumber: 1,
  },
  {
    label: "S4E30 special 2",
    seasonNumber: 4,
    episodeNumber: 30,
    anilistId: 162314,
    relativeEpisodeNumber: 1,
  },
];
