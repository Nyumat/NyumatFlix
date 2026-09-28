ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "catalogCardStyle" text DEFAULT 'poster' NOT NULL;
