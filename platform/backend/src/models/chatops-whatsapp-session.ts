import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/database";

class ChatOpsWhatsAppSessionModel {
  /**
   * Get a single auth state entry by (organizationId, category, keyId).
   */
  async get(params: {
    organizationId: string;
    category: string;
    keyId: string;
  }): Promise<unknown | null> {
    const row = await db
      .select()
      .from(schema.chatopsWhatsappSessionTable)
      .where(
        and(
          eq(
            schema.chatopsWhatsappSessionTable.organizationId,
            params.organizationId,
          ),
          eq(schema.chatopsWhatsappSessionTable.category, params.category),
          eq(schema.chatopsWhatsappSessionTable.keyId, params.keyId),
        ),
      )
      .limit(1);
    return row[0]?.value ?? null;
  }

  /**
   * Get all entries for a given (organizationId, category).
   */
  async getAll(params: {
    organizationId: string;
    category: string;
  }): Promise<Record<string, unknown>> {
    const rows = await db
      .select()
      .from(schema.chatopsWhatsappSessionTable)
      .where(
        and(
          eq(
            schema.chatopsWhatsappSessionTable.organizationId,
            params.organizationId,
          ),
          eq(schema.chatopsWhatsappSessionTable.category, params.category),
        ),
      );
    return Object.fromEntries(rows.map((r) => [r.keyId, r.value]));
  }

  /**
   * Upsert an auth state entry.
   */
  async set(params: {
    organizationId: string;
    category: string;
    keyId: string;
    value: unknown;
  }): Promise<void> {
    await db
      .insert(schema.chatopsWhatsappSessionTable)
      .values({
        organizationId: params.organizationId,
        category: params.category,
        keyId: params.keyId,
        value: params.value as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [
          schema.chatopsWhatsappSessionTable.organizationId,
          schema.chatopsWhatsappSessionTable.category,
          schema.chatopsWhatsappSessionTable.keyId,
        ],
        set: {
          value: params.value as Record<string, unknown>,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Delete specific entries by (organizationId, category, keyId[]).
   */
  async deleteKeys(params: {
    organizationId: string;
    category: string;
    keyIds: string[];
  }): Promise<void> {
    if (params.keyIds.length === 0) return;
    await db
      .delete(schema.chatopsWhatsappSessionTable)
      .where(
        and(
          eq(
            schema.chatopsWhatsappSessionTable.organizationId,
            params.organizationId,
          ),
          eq(schema.chatopsWhatsappSessionTable.category, params.category),
          inArray(schema.chatopsWhatsappSessionTable.keyId, params.keyIds),
        ),
      );
  }

  /**
   * Delete ALL session entries for an organization (full logout/reset).
   */
  async deleteAll(organizationId: string): Promise<void> {
    await db
      .delete(schema.chatopsWhatsappSessionTable)
      .where(
        eq(schema.chatopsWhatsappSessionTable.organizationId, organizationId),
      );
  }
}

export default new ChatOpsWhatsAppSessionModel();
