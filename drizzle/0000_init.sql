CREATE TYPE "public"."analytics_event_kind" AS ENUM('page_view', 'detail_view', 'prompt_copy', 'search', 'search_empty');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('uploading', 'queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prompt_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('original', 'collected');--> statement-breakpoint
CREATE TYPE "public"."upload_item_status" AS ENUM('pending', 'uploading', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."upload_mode" AS ENUM('single', 'multiple');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username"),
	CONSTRAINT "admins_username_present" CHECK (char_length("admins"."username") > 0),
	CONSTRAINT "admins_password_hash_present" CHECK (char_length("admins"."password_hash") > 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"admin_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_present" CHECK (char_length("sessions"."token_hash") > 0)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "asset_status" DEFAULT 'uploading' NOT NULL,
	"original_key" text NOT NULL,
	"card_key" text,
	"detail_key" text,
	"mime_type" text,
	"byte_size" integer,
	"width" integer,
	"height" integer,
	"checksum" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	CONSTRAINT "assets_original_key_unique" UNIQUE("original_key"),
	CONSTRAINT "assets_byte_size_nonnegative" CHECK ("assets"."byte_size" is null or "assets"."byte_size" >= 0),
	CONSTRAINT "assets_dimensions" CHECK (("assets"."width" is null and "assets"."height" is null) or ("assets"."width" > 0 and "assets"."height" > 0 and cast("assets"."width" as bigint) * cast("assets"."height" as bigint) <= 40000000)),
	CONSTRAINT "assets_original_key_present" CHECK (char_length("assets"."original_key") > 0)
);
--> statement-breakpoint
CREATE TABLE "collection_prompts" (
	"collection_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "collection_prompts_collection_id_prompt_id_pk" PRIMARY KEY("collection_id","prompt_id"),
	CONSTRAINT "collection_prompts_collection_id_position_unique" UNIQUE("collection_id","position"),
	CONSTRAINT "collection_prompts_position_nonnegative" CHECK ("collection_prompts"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_asset_id" uuid,
	"status" "collection_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug"),
	CONSTRAINT "collections_slug_present" CHECK (char_length("collections"."slug") > 0),
	CONSTRAINT "collections_version_positive" CHECK ("collections"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"lease_token" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "jobs_type_present" CHECK (char_length("jobs"."type") > 0),
	CONSTRAINT "jobs_dedupe_key_present" CHECK (char_length("jobs"."dedupe_key") > 0),
	CONSTRAINT "jobs_attempts_nonnegative" CHECK ("jobs"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"kind" "analytics_event_kind" NOT NULL,
	"prompt_id" uuid,
	"path" text NOT NULL,
	"query_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_events_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "analytics_events_event_id_present" CHECK (char_length("analytics_events"."event_id") > 0),
	CONSTRAINT "analytics_events_path_present" CHECK (char_length("analytics_events"."path") > 0),
	CONSTRAINT "analytics_events_query_text_length" CHECK (char_length("analytics_events"."query_text") <= 100)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_action_present" CHECK (char_length("audit_logs"."action") > 0),
	CONSTRAINT "audit_logs_entity_type_present" CHECK (char_length("audit_logs"."entity_type") > 0),
	CONSTRAINT "audit_logs_request_id_present" CHECK (char_length("audit_logs"."request_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"admin_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_admin_id_key_pk" PRIMARY KEY("admin_id","key"),
	CONSTRAINT "idempotency_keys_key_present" CHECK (char_length("idempotency_keys"."key") > 0),
	CONSTRAINT "idempotency_keys_request_hash_present" CHECK (char_length("idempotency_keys"."request_hash") > 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limits_key_hash_window_start_pk" PRIMARY KEY("key_hash","window_start"),
	CONSTRAINT "rate_limits_key_hash_present" CHECK (char_length("rate_limits"."key_hash") > 0),
	CONSTRAINT "rate_limits_count_nonnegative" CHECK ("rate_limits"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "prompt_assets" (
	"prompt_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"alt" text,
	CONSTRAINT "prompt_assets_prompt_id_asset_id_pk" PRIMARY KEY("prompt_id","asset_id"),
	CONSTRAINT "prompt_assets_prompt_id_position_unique" UNIQUE("prompt_id","position"),
	CONSTRAINT "prompt_assets_position_nonnegative" CHECK ("prompt_assets"."position" >= 0),
	CONSTRAINT "prompt_assets_alt_length" CHECK (char_length("prompt_assets"."alt") <= 300)
);
--> statement-breakpoint
CREATE TABLE "prompt_tags" (
	"prompt_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "prompt_tags_prompt_id_tag_id_pk" PRIMARY KEY("prompt_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"summary" text,
	"prompt_text" text DEFAULT '' NOT NULL,
	"negative_prompt" text,
	"usage_notes" text,
	"parameters_text" text,
	"model_version" text,
	"aspect_ratio" text,
	"requires_reference" boolean DEFAULT false NOT NULL,
	"source_type" "source_type" DEFAULT 'original' NOT NULL,
	"source_author" text,
	"source_url" text,
	"category_id" uuid,
	"model_id" uuid,
	"status" "prompt_status" DEFAULT 'draft' NOT NULL,
	"cover_asset_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "prompts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "prompts_slug_present" CHECK (char_length("prompts"."slug") > 0),
	CONSTRAINT "prompts_title_length" CHECK (char_length("prompts"."title") <= 120),
	CONSTRAINT "prompts_summary_length" CHECK (char_length("prompts"."summary") <= 500),
	CONSTRAINT "prompts_prompt_text_length" CHECK (char_length("prompts"."prompt_text") <= 50000),
	CONSTRAINT "prompts_negative_prompt_length" CHECK (char_length("prompts"."negative_prompt") <= 10000),
	CONSTRAINT "prompts_usage_notes_length" CHECK (char_length("prompts"."usage_notes") <= 10000),
	CONSTRAINT "prompts_parameters_text_length" CHECK (char_length("prompts"."parameters_text") <= 10000),
	CONSTRAINT "prompts_source_author_length" CHECK (char_length("prompts"."source_author") <= 120),
	CONSTRAINT "prompts_source_url" CHECK ("prompts"."source_url" is null or (char_length("prompts"."source_url") <= 2048 and ("prompts"."source_url" like 'https://%' or "prompts"."source_url" like 'http://%'))),
	CONSTRAINT "prompts_version_positive" CHECK ("prompts"."version" >= 1),
	CONSTRAINT "prompts_published_at_present" CHECK ("prompts"."status" <> 'published' or "prompts"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_normalized_name_unique" UNIQUE("normalized_name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_slug_present" CHECK (char_length("categories"."slug") > 0),
	CONSTRAINT "categories_normalized_name_form" CHECK ("categories"."normalized_name" = lower(btrim("categories"."normalized_name")))
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "models_normalized_name_unique" UNIQUE("normalized_name"),
	CONSTRAINT "models_slug_unique" UNIQUE("slug"),
	CONSTRAINT "models_slug_present" CHECK (char_length("models"."slug") > 0),
	CONSTRAINT "models_normalized_name_form" CHECK ("models"."normalized_name" = lower(btrim("models"."normalized_name")))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "tags_normalized_name_unique" UNIQUE("normalized_name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tags_slug_present" CHECK (char_length("tags"."slug") > 0),
	CONSTRAINT "tags_normalized_name_form" CHECK ("tags"."normalized_name" = lower(btrim("tags"."normalized_name")))
);
--> statement-breakpoint
CREATE TABLE "upload_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "upload_mode" NOT NULL,
	"defaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"admin_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"client_item_id" text NOT NULL,
	"asset_id" uuid,
	"prompt_id" uuid,
	"status" "upload_item_status" DEFAULT 'pending' NOT NULL,
	"error_code" text,
	CONSTRAINT "upload_items_batch_id_client_item_id_unique" UNIQUE("batch_id","client_item_id"),
	CONSTRAINT "upload_items_client_item_id_present" CHECK (char_length("upload_items"."client_item_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_prompts" ADD CONSTRAINT "collection_prompts_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_prompts" ADD CONSTRAINT "collection_prompts_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_cover_asset_id_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_assets" ADD CONSTRAINT "prompt_assets_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_assets" ADD CONSTRAINT "prompt_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_tags" ADD CONSTRAINT "prompt_tags_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_tags" ADD CONSTRAINT "prompt_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_cover_asset_id_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_batch_id_upload_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "assets_status_created_at_idx" ON "assets" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "collection_prompts_prompt_id_idx" ON "collection_prompts" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "jobs_status_run_at_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "prompt_tags_tag_id_prompt_id_idx" ON "prompt_tags" USING btree ("tag_id","prompt_id");--> statement-breakpoint
CREATE INDEX "prompts_public_list_idx" ON "prompts" USING btree ("status","published_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "prompts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "prompts_category_id_idx" ON "prompts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "prompts_model_id_idx" ON "prompts" USING btree ("model_id");