CREATE TABLE "watchlist" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"contentId" integer NOT NULL,
	"mediaType" text NOT NULL,
	"status" text DEFAULT 'watching' NOT NULL,
	"lastWatchedSeason" integer,
	"lastWatchedEpisode" integer,
	"lastWatchedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_userId_contentId_mediaType_unique" UNIQUE("userId","contentId","mediaType")
);
--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

