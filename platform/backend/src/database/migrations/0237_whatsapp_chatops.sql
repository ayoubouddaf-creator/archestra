CREATE TABLE "chatops_whatsapp_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"category" text NOT NULL,
	"key_id" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatops_whatsapp_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"jid" varchar(64) NOT NULL,
	"email" varchar(256) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chatops_whatsapp_session_org_category_key_idx" ON "chatops_whatsapp_session" USING btree ("organization_id","category","key_id");--> statement-breakpoint
CREATE INDEX "chatops_whatsapp_session_org_idx" ON "chatops_whatsapp_session" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chatops_whatsapp_identity_org_jid_idx" ON "chatops_whatsapp_identity" USING btree ("organization_id","jid");--> statement-breakpoint
CREATE INDEX "chatops_whatsapp_identity_org_idx" ON "chatops_whatsapp_identity" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chatops_whatsapp_identity_email_idx" ON "chatops_whatsapp_identity" USING btree ("organization_id","email");
