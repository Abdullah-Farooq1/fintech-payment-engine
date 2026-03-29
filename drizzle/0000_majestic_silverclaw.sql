CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'EUR', 'GBP', 'PKR');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "account_type" NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"balance" numeric(20, 4) DEFAULT '0.0000' NOT NULL,
	"is_system" varchar(5) DEFAULT 'false' NOT NULL,
	"metadata" varchar(1000) DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "no_negative_assets" CHECK (NOT ("accounts"."type" = 'asset' AND "accounts"."balance" < 0))
);
