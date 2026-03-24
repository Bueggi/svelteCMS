CREATE TYPE "public"."subscription_interval" AS ENUM('month', 'year');--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "subscription_interval" "subscription_interval";--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;