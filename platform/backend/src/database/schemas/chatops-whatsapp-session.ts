import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Stores Baileys WhatsApp auth state (credentials + signal keys) in PostgreSQL.
 *
 * Replaces Redis-based storage so WhatsApp session survives pod restarts
 * without requiring an external Redis dependency.
 *
 * Each row holds one auth entry identified by (organizationId, category, keyId):
 *   - category = "creds"       → keyId = "creds", value = Baileys AuthenticationCreds JSON
 *   - category = "pre-key"     → keyId = numeric pre-key ID
 *   - category = "session"     → keyId = session ID
 *   - category = "sender-key"  → keyId = sender key ID
 *   - category = "app-state-sync-key" → keyId = sync key ID
 *   - category = "app-state-sync-version" → keyId = LT hash
 *   - category = "sender-key-memory" → keyId = group JID
 */
const chatopsWhatsappSessionTable = pgTable(
  "chatops_whatsapp_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Organization that owns this session entry */
    organizationId: text("organization_id").notNull(),
    /** Key category (creds, pre-key, session, sender-key, etc.) */
    category: text("category").notNull(),
    /** Key identifier within the category */
    keyId: text("key_id").notNull(),
    /** The auth state value as JSON */
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("chatops_whatsapp_session_org_category_key_idx").on(
      table.organizationId,
      table.category,
      table.keyId,
    ),
    index("chatops_whatsapp_session_org_idx").on(table.organizationId),
  ],
);

export default chatopsWhatsappSessionTable;
