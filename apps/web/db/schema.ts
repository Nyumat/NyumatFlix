import type { AdapterAccountType } from "@auth/core/adapters";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      compoundKey: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    },
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    {
      compositePk: primaryKey({
        columns: [verificationToken.identifier, verificationToken.token],
      }),
    },
  ],
);

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [
    {
      compositePK: primaryKey({
        columns: [authenticator.userId, authenticator.credentialID],
      }),
    },
  ],
);

export const watchlist = pgTable(
  "watchlist",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentId: integer("contentId").notNull(),
    mediaType: text("mediaType").notNull().$type<"movie" | "tv">(),
    status: text("status")
      .notNull()
      .default("watching")
      .$type<
        "watching" | "plan_to_watch" | "on_hold" | "dropped" | "completed"
      >(),
    lastWatchedSeason: integer("lastWatchedSeason"),
    lastWatchedEpisode: integer("lastWatchedEpisode"),
    lastWatchedAt: timestamp("lastWatchedAt", { mode: "date" }),
    dismissedAt: timestamp("dismissedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.userId, table.contentId, table.mediaType),
    index("watchlist_user_updated_idx").on(table.userId, table.updatedAt),
    check(
      "watchlist_status_check",
      sql`${table.status} IN ('watching', 'plan_to_watch', 'on_hold', 'dropped', 'completed')`,
    ),
  ],
);

export const playbackProgress = pgTable(
  "playback_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentId: integer("contentId").notNull(),
    mediaType: text("mediaType").notNull().$type<"movie" | "tv">(),
    seasonNumber: integer("seasonNumber").notNull().default(0),
    episodeNumber: integer("episodeNumber").notNull().default(0),
    watchedSeconds: real("watchedSeconds").notNull().default(0),
    durationSeconds: real("durationSeconds").notNull().default(0),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(
      table.userId,
      table.mediaType,
      table.contentId,
      table.seasonNumber,
      table.episodeNumber,
    ),
    index("playback_progress_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
    check(
      "playback_progress_media_type_check",
      sql`${table.mediaType} IN ('movie', 'tv')`,
    ),
  ],
);

export const userSettings = pgTable("user_settings", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  playbackAudio: text("playbackAudio")
    .notNull()
    .default("sub")
    .$type<"sub" | "dub">(),
  playbackQuality: text("playbackQuality")
    .notNull()
    .default("1080p")
    .$type<"1080p" | "720p" | "480p">(),
  playbackEnglishSubtitles: boolean("playbackEnglishSubtitles")
    .notNull()
    .default(true),
  disableHoverSound: boolean("disableHoverSound").notNull().default(false),
  disableHeroTrailers: boolean("disableHeroTrailers").notNull().default(false),
  selectedServerId: text("selectedServerId"),
  userSelectedPlaybackServer: boolean("userSelectedPlaybackServer")
    .notNull()
    .default(false),
  policyGenerationAtChoice: text("policyGenerationAtChoice"),
  vidnestContentType: text("vidnestContentType")
    .notNull()
    .default("tv")
    .$type<"movie" | "tv" | "anime" | "animepahe">(),
  vidsrcApi: text("vidsrcApi").notNull().default("1"),
  subtitleAppearance: jsonb("subtitleAppearance"),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});
