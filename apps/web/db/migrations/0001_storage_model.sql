CREATE TABLE IF NOT EXISTS "playback_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "contentId" integer NOT NULL,
  "mediaType" text NOT NULL,
  "seasonNumber" integer DEFAULT 0 NOT NULL,
  "episodeNumber" integer DEFAULT 0 NOT NULL,
  "watchedSeconds" real DEFAULT 0 NOT NULL,
  "durationSeconds" real DEFAULT 0 NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "playback_progress_userId_mediaType_contentId_seasonNumber_episodeNumber_unique" UNIQUE("userId","mediaType","contentId","seasonNumber","episodeNumber"),
  CONSTRAINT "playback_progress_media_type_check" CHECK ("mediaType" IN ('movie', 'tv'))
);

CREATE INDEX IF NOT EXISTS "playback_progress_user_updated_idx" ON "playback_progress" ("userId","updatedAt");

CREATE TABLE IF NOT EXISTS "user_settings" (
  "userId" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "playbackAudio" text DEFAULT 'sub' NOT NULL,
  "playbackQuality" text DEFAULT '1080p' NOT NULL,
  "playbackEnglishSubtitles" boolean DEFAULT true NOT NULL,
  "disableHoverSound" boolean DEFAULT false NOT NULL,
  "disableHeroTrailers" boolean DEFAULT false NOT NULL,
  "selectedServerId" text,
  "userSelectedPlaybackServer" boolean DEFAULT false NOT NULL,
  "policyGenerationAtChoice" text,
  "vidnestContentType" text DEFAULT 'tv' NOT NULL,
  "vidsrcApi" text DEFAULT '1' NOT NULL,
  "subtitleAppearance" jsonb,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "dismissedAt" timestamp;
