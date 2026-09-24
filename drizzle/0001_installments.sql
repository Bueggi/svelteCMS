ALTER TYPE "public"."enrollment_status" ADD VALUE 'suspended';--> statement-breakpoint
ALTER TYPE "public"."purchase_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "installments_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "installment_count" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "installment_amount" integer;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "installments_total" integer;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "installments_paid" integer DEFAULT 0 NOT NULL;