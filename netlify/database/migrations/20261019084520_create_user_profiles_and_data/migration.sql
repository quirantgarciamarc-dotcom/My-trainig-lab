CREATE TABLE "coach_usage_log" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"quota_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_app_data" (
	"user_id" text PRIMARY KEY,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY,
	"email" text DEFAULT '' NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"age" text DEFAULT '' NOT NULL,
	"height_cm" text DEFAULT '' NOT NULL,
	"current_weight_kg" text DEFAULT '' NOT NULL,
	"goal_weight_kg" text DEFAULT '' NOT NULL,
	"goal_fat_percent" text DEFAULT '' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "coach_usage_log_user_key_date_idx" ON "coach_usage_log" ("user_id","quota_key","created_at");--> statement-breakpoint
ALTER TABLE "user_app_data" ADD CONSTRAINT "user_app_data_user_id_user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE;