ALTER TABLE "courses" DROP COLUMN "landing_page_data";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "landing_page_html";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "landing_page_css";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "landing_page_status";--> statement-breakpoint
DROP TYPE "public"."landing_page_status";