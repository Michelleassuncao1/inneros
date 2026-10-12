ALTER TABLE "campaigns" ADD COLUMN "support_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "ima_support" jsonb;