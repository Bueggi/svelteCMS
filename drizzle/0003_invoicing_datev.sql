CREATE TYPE "public"."invoice_kind" AS ENUM('invoice', 'correction');--> statement-breakpoint
CREATE TYPE "public"."tax_treatment" AS ENUM('standard', 'oss', 'reverse_charge', 'third_country', 'small_business');--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "kind" "invoice_kind" DEFAULT 'invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "corrects_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "tax_treatment" "tax_treatment" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customer_country" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "service_date" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_provider" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_reference" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "order_reference" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "pdf_base64" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "company_tax_number" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "company_managing_director" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "company_register" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "small_business" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "oss_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "datev_consultant_number" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "datev_client_number" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "datev_chart_of_accounts" text DEFAULT 'SKR03' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "datev_account_length" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "datev_fiscal_year_start_month" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "datev_accounts" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_reference_unique" UNIQUE("payment_reference");