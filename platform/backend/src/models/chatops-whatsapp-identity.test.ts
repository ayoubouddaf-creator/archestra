import { describe, expect, test } from "@/test";
import ChatOpsWhatsAppIdentityModel from "./chatops-whatsapp-identity";

const ORG = "org-test";

describe("ChatOpsWhatsAppIdentityModel", () => {
  describe("findEmailByJid", () => {
    test("returns null when no mapping exists", async () => {
      const result = await ChatOpsWhatsAppIdentityModel.findEmailByJid({
        organizationId: ORG,
        jid: "15551234567@s.whatsapp.net",
      });
      expect(result).toBeNull();
    });

    test("returns email after upsert", async () => {
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: ORG,
        jid: "15551234567@s.whatsapp.net",
        email: "alice@example.com",
      });

      const result = await ChatOpsWhatsAppIdentityModel.findEmailByJid({
        organizationId: ORG,
        jid: "15551234567@s.whatsapp.net",
      });

      expect(result).toBe("alice@example.com");
    });

    test("is scoped to organization", async () => {
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: "org-a",
        jid: "15551234567@s.whatsapp.net",
        email: "user@org-a.com",
      });

      const result = await ChatOpsWhatsAppIdentityModel.findEmailByJid({
        organizationId: "org-b",
        jid: "15551234567@s.whatsapp.net",
      });

      expect(result).toBeNull();
    });
  });

  describe("findJidByEmail", () => {
    test("returns null when no mapping exists", async () => {
      const result = await ChatOpsWhatsAppIdentityModel.findJidByEmail({
        organizationId: ORG,
        email: "nobody@example.com",
      });
      expect(result).toBeNull();
    });

    test("returns JID after upsert", async () => {
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: ORG,
        jid: "19876543210@s.whatsapp.net",
        email: "bob@example.com",
      });

      const result = await ChatOpsWhatsAppIdentityModel.findJidByEmail({
        organizationId: ORG,
        email: "bob@example.com",
      });

      expect(result).toBe("19876543210@s.whatsapp.net");
    });
  });

  describe("upsert", () => {
    test("overwrites email for existing JID", async () => {
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: ORG,
        jid: "15559990000@s.whatsapp.net",
        email: "first@example.com",
      });
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: ORG,
        jid: "15559990000@s.whatsapp.net",
        email: "second@example.com",
      });

      const result = await ChatOpsWhatsAppIdentityModel.findEmailByJid({
        organizationId: ORG,
        jid: "15559990000@s.whatsapp.net",
      });

      expect(result).toBe("second@example.com");
    });

    test("handles multiple JIDs independently", async () => {
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: ORG,
        jid: "11111111111@s.whatsapp.net",
        email: "user1@example.com",
      });
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: ORG,
        jid: "22222222222@s.whatsapp.net",
        email: "user2@example.com",
      });

      const email1 = await ChatOpsWhatsAppIdentityModel.findEmailByJid({
        organizationId: ORG,
        jid: "11111111111@s.whatsapp.net",
      });
      const email2 = await ChatOpsWhatsAppIdentityModel.findEmailByJid({
        organizationId: ORG,
        jid: "22222222222@s.whatsapp.net",
      });

      expect(email1).toBe("user1@example.com");
      expect(email2).toBe("user2@example.com");
    });
  });

  describe("deleteByJid", () => {
    test("removes the mapping for a given JID", async () => {
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: ORG,
        jid: "13330000000@s.whatsapp.net",
        email: "deleteme@example.com",
      });

      await ChatOpsWhatsAppIdentityModel.deleteByJid({
        organizationId: ORG,
        jid: "13330000000@s.whatsapp.net",
      });

      const result = await ChatOpsWhatsAppIdentityModel.findEmailByJid({
        organizationId: ORG,
        jid: "13330000000@s.whatsapp.net",
      });

      expect(result).toBeNull();
    });

    test("does not delete other JIDs", async () => {
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: ORG,
        jid: "14440000000@s.whatsapp.net",
        email: "keep@example.com",
      });
      await ChatOpsWhatsAppIdentityModel.upsert({
        organizationId: ORG,
        jid: "15550000000@s.whatsapp.net",
        email: "gone@example.com",
      });

      await ChatOpsWhatsAppIdentityModel.deleteByJid({
        organizationId: ORG,
        jid: "15550000000@s.whatsapp.net",
      });

      expect(
        await ChatOpsWhatsAppIdentityModel.findEmailByJid({
          organizationId: ORG,
          jid: "14440000000@s.whatsapp.net",
        }),
      ).toBe("keep@example.com");
    });
  });
});
