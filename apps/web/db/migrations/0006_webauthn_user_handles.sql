ALTER TABLE "user" ADD COLUMN "webauthnUserHandle" text;--> statement-breakpoint
ALTER TABLE "authenticator" ADD COLUMN "webauthnUserId" text;
