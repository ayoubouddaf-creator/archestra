import { and, eq } from "drizzle-orm";
import db, { schema } from "@/database";

class ChatOpsWhatsAppIdentityModel {
  /**
   * Find the Archestra email for a WhatsApp JID.
   */
  async findEmailByJid(params: {
    organizationId: string;
    jid: string;
  }): Promise<string | null> {
    const row = await db
      .select()
      .from(schema.chatopsWhatsappIdentityTable)
      .where(
        and(
          eq(
            schema.chatopsWhatsappIdentityTable.organizationId,
            params.organizationId,
          ),
          eq(schema.chatopsWhatsappIdentityTable.jid, params.jid),
        ),
      )
      .limit(1);
    return row[0]?.email ?? null;
  }

  /**
   * Find the WhatsApp JID for an Archestra email.
   */
  async findJidByEmail(params: {
    organizationId: string;
    email: string;
  }): Promise<string | null> {
    const row = await db
      .select()
      .from(schema.chatopsWhatsappIdentityTable)
      .where(
        and(
          eq(
            schema.chatopsWhatsappIdentityTable.organizationId,
            params.organizationId,
          ),
          eq(schema.chatopsWhatsappIdentityTable.email, params.email),
        ),
      )
      .limit(1);
    return row[0]?.jid ?? null;
  }

  /**
   * Create or update a JID → email mapping.
   */
  async upsert(params: {
    organizationId: string;
    jid: string;
    email: string;
  }): Promise<void> {
    await db
      .insert(schema.chatopsWhatsappIdentityTable)
      .values({
        organizationId: params.organizationId,
        jid: params.jid,
        email: params.email,
      })
      .onConflictDoUpdate({
        target: [
          schema.chatopsWhatsappIdentityTable.organizationId,
          schema.chatopsWhatsappIdentityTable.jid,
        ],
        set: { email: params.email, updatedAt: new Date() },
      });
  }

  /**
   * Delete a JID → email mapping (e.g. when user unlinks WhatsApp).
   */
  async deleteByJid(params: {
    organizationId: string;
    jid: string;
  }): Promise<void> {
    await db
      .delete(schema.chatopsWhatsappIdentityTable)
      .where(
        and(
          eq(
            schema.chatopsWhatsappIdentityTable.organizationId,
            params.organizationId,
          ),
          eq(schema.chatopsWhatsappIdentityTable.jid, params.jid),
        ),
      );
  }
}

export default new ChatOpsWhatsAppIdentityModel();
