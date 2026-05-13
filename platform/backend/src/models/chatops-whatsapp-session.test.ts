import { describe, expect, test } from "@/test";
import ChatOpsWhatsAppSessionModel from "./chatops-whatsapp-session";

const ORG = "org-session-test";

describe("ChatOpsWhatsAppSessionModel", () => {
  describe("get", () => {
    test("returns null when no entry exists", async () => {
      const result = await ChatOpsWhatsAppSessionModel.get({
        organizationId: ORG,
        category: "creds",
        keyId: "creds",
      });
      expect(result).toBeNull();
    });
  });

  describe("set and get", () => {
    test("stores and retrieves a value", async () => {
      const value = { noiseKey: "abc", signedIdentityKey: "def" };

      await ChatOpsWhatsAppSessionModel.set({
        organizationId: ORG,
        category: "creds",
        keyId: "creds",
        value,
      });

      const result = await ChatOpsWhatsAppSessionModel.get({
        organizationId: ORG,
        category: "creds",
        keyId: "creds",
      });

      expect(result).toEqual(value);
    });

    test("overwrites existing value on second set", async () => {
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: ORG,
        category: "creds",
        keyId: "creds",
        value: { version: 1 },
      });
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: ORG,
        category: "creds",
        keyId: "creds",
        value: { version: 2 },
      });

      const result = await ChatOpsWhatsAppSessionModel.get({
        organizationId: ORG,
        category: "creds",
        keyId: "creds",
      });

      expect(result).toEqual({ version: 2 });
    });

    test("is scoped to organization", async () => {
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: "org-x",
        category: "creds",
        keyId: "creds",
        value: { org: "x" },
      });

      const result = await ChatOpsWhatsAppSessionModel.get({
        organizationId: "org-y",
        category: "creds",
        keyId: "creds",
      });

      expect(result).toBeNull();
    });

    test("stores entries with different categories independently", async () => {
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: ORG,
        category: "session",
        keyId: "key-1",
        value: { type: "session" },
      });
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: ORG,
        category: "pre-key",
        keyId: "key-1",
        value: { type: "pre-key" },
      });

      const session = await ChatOpsWhatsAppSessionModel.get({
        organizationId: ORG,
        category: "session",
        keyId: "key-1",
      });
      const preKey = await ChatOpsWhatsAppSessionModel.get({
        organizationId: ORG,
        category: "pre-key",
        keyId: "key-1",
      });

      expect(session).toEqual({ type: "session" });
      expect(preKey).toEqual({ type: "pre-key" });
    });
  });

  describe("getAll", () => {
    test("returns empty object when no entries exist for category", async () => {
      const result = await ChatOpsWhatsAppSessionModel.getAll({
        organizationId: "org-empty",
        category: "session",
      });
      expect(result).toEqual({});
    });

    test("returns all keyId→value pairs for a given organization and category", async () => {
      const orgId = "org-getall";
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgId,
        category: "session",
        keyId: "s-1",
        value: { x: 1 },
      });
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgId,
        category: "session",
        keyId: "s-2",
        value: { x: 2 },
      });

      const result = await ChatOpsWhatsAppSessionModel.getAll({
        organizationId: orgId,
        category: "session",
      });
      expect(result).toEqual({ "s-1": { x: 1 }, "s-2": { x: 2 } });
    });

    test("does not return entries from other categories", async () => {
      const orgId = "org-getall-cat";
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgId,
        category: "session",
        keyId: "s-1",
        value: { type: "session" },
      });
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgId,
        category: "creds",
        keyId: "creds",
        value: { type: "creds" },
      });

      const result = await ChatOpsWhatsAppSessionModel.getAll({
        organizationId: orgId,
        category: "session",
      });
      expect(result).toEqual({ "s-1": { type: "session" } });
    });
  });

  describe("deleteKeys", () => {
    test("removes specified keys from a category", async () => {
      const orgId = "org-delkeys";
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgId,
        category: "session",
        keyId: "k1",
        value: { x: 1 },
      });
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgId,
        category: "session",
        keyId: "k2",
        value: { x: 2 },
      });

      await ChatOpsWhatsAppSessionModel.deleteKeys({
        organizationId: orgId,
        category: "session",
        keyIds: ["k1"],
      });

      expect(
        await ChatOpsWhatsAppSessionModel.get({
          organizationId: orgId,
          category: "session",
          keyId: "k1",
        }),
      ).toBeNull();
      expect(
        await ChatOpsWhatsAppSessionModel.get({
          organizationId: orgId,
          category: "session",
          keyId: "k2",
        }),
      ).toEqual({ x: 2 });
    });
  });

  describe("deleteAll", () => {
    test("removes all entries for an organization", async () => {
      const orgId = "org-deleteall";
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgId,
        category: "creds",
        keyId: "creds",
        value: { a: 1 },
      });
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgId,
        category: "session",
        keyId: "s-1",
        value: { b: 2 },
      });

      await ChatOpsWhatsAppSessionModel.deleteAll(orgId);

      // After deleteAll both categories should be empty
      expect(
        await ChatOpsWhatsAppSessionModel.get({
          organizationId: orgId,
          category: "creds",
          keyId: "creds",
        }),
      ).toBeNull();
      expect(
        await ChatOpsWhatsAppSessionModel.get({
          organizationId: orgId,
          category: "session",
          keyId: "s-1",
        }),
      ).toBeNull();
    });

    test("does not affect other organizations", async () => {
      const orgKeep = "org-keep";
      const orgGone = "org-gone";

      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgKeep,
        category: "creds",
        keyId: "creds",
        value: { keep: true },
      });
      await ChatOpsWhatsAppSessionModel.set({
        organizationId: orgGone,
        category: "creds",
        keyId: "creds",
        value: { gone: true },
      });

      await ChatOpsWhatsAppSessionModel.deleteAll(orgGone);

      expect(
        await ChatOpsWhatsAppSessionModel.get({
          organizationId: orgKeep,
          category: "creds",
          keyId: "creds",
        }),
      ).toEqual({ keep: true });
      expect(
        await ChatOpsWhatsAppSessionModel.get({
          organizationId: orgGone,
          category: "creds",
          keyId: "creds",
        }),
      ).toBeNull();
    });
  });
});
