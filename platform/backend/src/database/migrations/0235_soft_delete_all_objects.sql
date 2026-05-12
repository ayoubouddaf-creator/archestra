ALTER TABLE "agents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "mcp_server" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "chat_api_keys" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "virtual_api_keys" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tool_invocation_policies" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "schedule_triggers" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "chatops_channel_binding" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "internal_mcp_catalog" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "agents_deleted_at_idx" ON "agents" ("deleted_at");--> statement-breakpoint
CREATE INDEX "knowledge_bases_deleted_at_idx" ON "knowledge_bases" ("deleted_at");--> statement-breakpoint
CREATE INDEX "conversations_deleted_at_idx" ON "conversations" ("deleted_at");--> statement-breakpoint
CREATE INDEX "mcp_server_deleted_at_idx" ON "mcp_server" ("deleted_at");--> statement-breakpoint
CREATE INDEX "tools_deleted_at_idx" ON "tools" ("deleted_at");--> statement-breakpoint
CREATE INDEX "chat_api_keys_deleted_at_idx" ON "chat_api_keys" ("deleted_at");--> statement-breakpoint
CREATE INDEX "virtual_api_keys_deleted_at_idx" ON "virtual_api_keys" ("deleted_at");--> statement-breakpoint
CREATE INDEX "schedule_triggers_deleted_at_idx" ON "schedule_triggers" ("deleted_at");--> statement-breakpoint
CREATE INDEX "chatops_channel_binding_deleted_at_idx" ON "chatops_channel_binding" ("deleted_at");--> statement-breakpoint
CREATE INDEX "internal_mcp_catalog_deleted_at_idx" ON "internal_mcp_catalog" ("deleted_at");
