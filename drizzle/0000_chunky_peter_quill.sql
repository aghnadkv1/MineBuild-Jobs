CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builder_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"styles" text[] DEFAULT '{}' NOT NULL,
	"project_types" text[] DEFAULT '{}' NOT NULL,
	"minecraft_versions" text[] DEFAULT '{}' NOT NULL,
	"tools" text[] DEFAULT '{}' NOT NULL,
	"experience" text,
	"availability" text DEFAULT 'available' NOT NULL,
	"preferred_budget_min" integer,
	"preferred_budget_max" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"builder_id" text NOT NULL,
	"client_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text,
	"source" text DEFAULT 'minebuild' NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"project_type" text,
	"style" text[] DEFAULT '{}' NOT NULL,
	"minecraft_version" text,
	"required_skills" text[] DEFAULT '{}' NOT NULL,
	"budget_min" integer,
	"budget_max" integer,
	"budget_negotiable" boolean DEFAULT false NOT NULL,
	"deadline" date,
	"complexity" text,
	"estimated_size" text,
	"deliverables" text[] DEFAULT '{}' NOT NULL,
	"reference_urls" text[] DEFAULT '{}' NOT NULL,
	"source_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	"fingerprint" text NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "match_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"builder_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"skill_score" integer DEFAULT 0 NOT NULL,
	"project_type_score" integer DEFAULT 0 NOT NULL,
	"style_score" integer DEFAULT 0 NOT NULL,
	"budget_score" integer DEFAULT 0 NOT NULL,
	"complexity_score" integer DEFAULT 0 NOT NULL,
	"portfolio_score" integer DEFAULT 0 NOT NULL,
	"missing_requirements" text[] DEFAULT '{}' NOT NULL,
	"strengths" text[] DEFAULT '{}' NOT NULL,
	"reasons" text[] DEFAULT '{}' NOT NULL,
	"risks" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"attachment_urls" text[] DEFAULT '{}' NOT NULL,
	"portfolio_project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"dedupe_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"builder_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"style" text[] DEFAULT '{}' NOT NULL,
	"minecraft_version" text,
	"project_role" text,
	"project_date" date,
	"dimensions" text,
	"image_urls" text[] DEFAULT '{}' NOT NULL,
	"source_url" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"builder_id" uuid NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_job" (
	"user_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_job_user_id_job_id_pk" PRIMARY KEY("user_id","job_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'builder' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_profile" ADD CONSTRAINT "builder_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_builder_id_user_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_result" ADD CONSTRAINT "match_result_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_result" ADD CONSTRAINT "match_result_builder_id_builder_profile_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builder_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_portfolio_project_id_portfolio_project_id_fk" FOREIGN KEY ("portfolio_project_id") REFERENCES "public"."portfolio_project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_project" ADD CONSTRAINT "portfolio_project_builder_id_builder_profile_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builder_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_builder_id_builder_profile_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builder_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_job" ADD CONSTRAINT "saved_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_job" ADD CONSTRAINT "saved_job_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "builder_profile_public_idx" ON "builder_profile" USING btree ("is_public");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_job_parties_unique" ON "conversation" USING btree ("job_id","builder_id","client_id");--> statement-breakpoint
CREATE INDEX "conversation_builder_idx" ON "conversation" USING btree ("builder_id","updated_at");--> statement-breakpoint
CREATE INDEX "conversation_client_idx" ON "conversation" USING btree ("client_id","updated_at");--> statement-breakpoint
CREATE INDEX "job_status_posted_idx" ON "job" USING btree ("status","posted_at");--> statement-breakpoint
CREATE INDEX "job_client_id_idx" ON "job" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "job_type_idx" ON "job" USING btree ("project_type");--> statement-breakpoint
CREATE INDEX "job_budget_idx" ON "job" USING btree ("budget_min","budget_max");--> statement-breakpoint
CREATE UNIQUE INDEX "match_job_builder_unique" ON "match_result" USING btree ("job_id","builder_id");--> statement-breakpoint
CREATE INDEX "match_builder_score_idx" ON "match_result" USING btree ("builder_id","score");--> statement-breakpoint
CREATE INDEX "message_conversation_created_idx" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_dedupe_unique" ON "notification" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "portfolio_builder_id_idx" ON "portfolio_project" USING btree ("builder_id");--> statement-breakpoint
CREATE INDEX "proposal_builder_created_idx" ON "proposal" USING btree ("builder_id","created_at");--> statement-breakpoint
CREATE INDEX "proposal_job_id_idx" ON "proposal" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "saved_job_job_id_idx" ON "saved_job" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");