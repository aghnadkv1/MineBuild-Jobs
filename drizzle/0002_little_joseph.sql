CREATE TABLE "external_integration_token" (
	"provider" text PRIMARY KEY NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "normalized_url" text;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "currency" text DEFAULT 'IDR' NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "pricing_type" text;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "source_status" text;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "source_client_info" jsonb;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "project_duration" text;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "experience_level" text;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "applicants_count" integer;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "discovered_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "job_source_external_id_unique" ON "job" USING btree ("source","external_id") WHERE "job"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "job_source_normalized_url_unique" ON "job" USING btree ("source","normalized_url") WHERE "job"."normalized_url" is not null;