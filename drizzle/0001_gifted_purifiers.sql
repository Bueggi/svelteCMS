-- Minimal migration for Landing Page Builder
CREATE TYPE "public"."landing_page_status" AS ENUM('draft', 'public');
ALTER TABLE "courses" ADD COLUMN "landing_page_data" text;
ALTER TABLE "courses" ADD COLUMN "landing_page_html" text;
ALTER TABLE "courses" ADD COLUMN "landing_page_css" text;
ALTER TABLE "courses" ADD COLUMN "landing_page_status" "landing_page_status" DEFAULT 'draft' NOT NULL;