ALTER TABLE "assets" DROP CONSTRAINT "assets_original_key_present";--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "original_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "source_key" text;--> statement-breakpoint
UPDATE "assets" SET "source_key" = 'legacy-source/' || "id"::text WHERE "source_key" IS NULL;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "source_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD COLUMN "target_prompt_id" uuid;--> statement-breakpoint
ALTER TABLE "upload_items" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "upload_items" SET "position" = 0 WHERE "position" IS NULL;--> statement-breakpoint
ALTER TABLE "upload_items" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_items" ADD COLUMN "declared_size" integer;--> statement-breakpoint
UPDATE "upload_items" SET "declared_size" = 0 WHERE "declared_size" IS NULL;--> statement-breakpoint
ALTER TABLE "upload_items" ALTER COLUMN "declared_size" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_items" ADD COLUMN "declared_type" text;--> statement-breakpoint
UPDATE "upload_items" SET "declared_type" = 'application/octet-stream' WHERE "declared_type" IS NULL;--> statement-breakpoint
ALTER TABLE "upload_items" ALTER COLUMN "declared_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_items" ADD COLUMN "file_name" text;--> statement-breakpoint
UPDATE "upload_items" SET "file_name" = 'legacy' WHERE "file_name" IS NULL;--> statement-breakpoint
ALTER TABLE "upload_items" ALTER COLUMN "file_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_target_prompt_id_prompts_id_fk" FOREIGN KEY ("target_prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_source_key_unique" UNIQUE("source_key");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_source_key_present" CHECK (char_length("assets"."source_key") > 0);--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_original_key_present" CHECK ("assets"."original_key" is null or char_length("assets"."original_key") > 0);--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_position_nonnegative" CHECK ("upload_items"."position" >= 0);--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_declared_size_nonnegative" CHECK ("upload_items"."declared_size" >= 0);--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_declared_type_present" CHECK (char_length("upload_items"."declared_type") > 0);--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_file_name_present" CHECK (char_length("upload_items"."file_name") > 0);--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_file_name_length" CHECK (char_length("upload_items"."file_name") <= 300);