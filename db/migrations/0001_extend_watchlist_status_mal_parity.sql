UPDATE "watchlist" SET "status" = 'plan_to_watch' WHERE "status" = 'waiting';--> statement-breakpoint
UPDATE "watchlist" SET "status" = 'completed' WHERE "status" = 'finished';--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_status_check" CHECK ("watchlist"."status" IN ('watching', 'plan_to_watch', 'on_hold', 'dropped', 'completed'));
