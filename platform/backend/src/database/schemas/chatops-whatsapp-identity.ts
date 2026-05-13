import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Maps WhatsApp JIDs (phone numbers) to Archestra user emails.
 *
 * When a WhatsApp user sends their first message, they are prompted to link
 * their account via "/identify email@example.com". This mapping is stored here
 * so subsequent messages can be attributed to the correct Archestra user.
 */
const chatopsWhatsappIdentityTable = pgTable(
  "chatops_whatsapp_identity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Organization that owns this mapping */
    organizationId: text("organization_id").notNull(),
    /** WhatsApp JID (e.g. "15551234567@s.whatsapp.net") */
    jid: varchar("jid", { length: 64 }).notNull(),
    /** Archestra user email */
    email: varchar("email", { length: 256 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("chatops_whatsapp_identity_org_jid_idx").on(
      table.organizationId,
      table.jid,
    ),
    index("chatops_whatsapp_identity_org_idx").on(table.organizationId),
    index("chatops_whatsapp_identity_email_idx").on(
      table.organizationId,
      table.email,
    ),
  ],
);

export default chatopsWhatsappIdentityTable;
