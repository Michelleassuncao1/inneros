CREATE TABLE "ai_training_progress" (
	"user_id" uuid NOT NULL,
	"training_id" text NOT NULL,
	"training_version" text NOT NULL,
	"guide_version" text NOT NULL,
	"guide_ack_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"best_score" integer,
	"passed_at" timestamp with time zone,
	"general_training" text,
	"registered_at" timestamp with time zone,
	"certificate_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_training_progress_user_id_training_id_training_version_pk" PRIMARY KEY("user_id","training_id","training_version"),
	CONSTRAINT "ai_training_progress_certificate_code_unique" UNIQUE("certificate_code"),
	CONSTRAINT "ai_training_score" CHECK ("ai_training_progress"."best_score" IS NULL OR "ai_training_progress"."best_score" BETWEEN 0 AND 100),
	CONSTRAINT "ai_training_formation" CHECK (coalesce(length("ai_training_progress"."general_training"), 0) <= 300),
	CONSTRAINT "ai_training_ordre" CHECK ("ai_training_progress"."registered_at" IS NULL OR ("ai_training_progress"."passed_at" IS NOT NULL AND "ai_training_progress"."guide_ack_at" IS NOT NULL AND "ai_training_progress"."certificate_code" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "ai_training_progress" ADD CONSTRAINT "ai_training_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;