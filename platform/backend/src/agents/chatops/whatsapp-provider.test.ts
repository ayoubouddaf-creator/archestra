import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock Baileys so the test suite can run without the package installed
// and without a real WebSocket connection.
vi.mock("@whiskeysockets/baileys", () => ({
  default: {},
  makeWASocket: vi.fn(),
  initAuthCreds: vi.fn(() => ({ noiseKey: {}, signedIdentityKey: {} })),
  BufferJSON: { replacer: vi.fn(), reviver: vi.fn() },
  proto: {
    Message: {
      encode: vi.fn(() => ({ finish: vi.fn(() => new Uint8Array()) })),
      decode: vi.fn(() => ({})),
    },
  },
}));

// Mock qrcode to avoid native canvas dependencies
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(
      async (data: string) => `data:image/png;base64,MOCK_${data}`,
    ),
  },
}));

// Mock DB models used by the provider
vi.mock("@/models", () => ({
  ChatOpsWhatsAppIdentityModel: {
    findEmailByJid: vi.fn(),
    upsert: vi.fn(),
  },
  ChatOpsWhatsAppSessionModel: {
    get: vi.fn(),
    getAll: vi.fn(async () => ({})),
    set: vi.fn(),
    deleteKeys: vi.fn(),
    deleteAll: vi.fn(),
  },
  OrganizationModel: {
    getFirst: vi.fn(async () => ({ id: "org-1" })),
  },
}));

// Mock ChatOpsConfigModel to avoid DB in WhatsAppProvider.initialize()
vi.mock("@/models/chatops-config", () => ({
  default: {
    getWhatsAppConfig: vi.fn(async () => ({
      enabled: true,
      botName: "TestBot",
    })),
  },
}));

import { WhatsAppProvider } from "./whatsapp-provider";

// =============================================================================
// Helpers
// =============================================================================

function createProvider(
  config: { enabled: boolean; botName?: string } = { enabled: true },
): WhatsAppProvider {
  return new WhatsAppProvider(config);
}

// =============================================================================
// isConfigured
// =============================================================================

describe("WhatsAppProvider.isConfigured", () => {
  test("returns true when enabled is true", () => {
    const provider = createProvider({ enabled: true });
    expect(provider.isConfigured()).toBe(true);
  });

  test("returns false when enabled is false", () => {
    const provider = createProvider({ enabled: false });
    expect(provider.isConfigured()).toBe(false);
  });
});

// =============================================================================
// providerId
// =============================================================================

describe("WhatsAppProvider.providerId", () => {
  test("is whatsapp", () => {
    const provider = createProvider();
    expect(provider.providerId).toBe("whatsapp");
  });
});

// =============================================================================
// getCurrentQr / isConnected — initial state
// =============================================================================

describe("WhatsAppProvider initial state", () => {
  test("getCurrentQr returns null before connection", () => {
    const provider = createProvider();
    expect(provider.getCurrentQr()).toBeNull();
  });

  test("isConnected returns false before connection", () => {
    const provider = createProvider();
    expect(provider.isConnected()).toBe(false);
  });
});

// =============================================================================
// getWorkspaceId / getWorkspaceName
// =============================================================================

describe("WhatsAppProvider workspace identity", () => {
  test("getWorkspaceId returns 'whatsapp'", () => {
    const provider = createProvider();
    expect(provider.getWorkspaceId()).toBe("whatsapp");
  });

  test("getWorkspaceName returns 'WhatsApp'", () => {
    const provider = createProvider();
    expect(provider.getWorkspaceName()).toBe("WhatsApp");
  });
});

// =============================================================================
// getChannelName
// =============================================================================

describe("WhatsAppProvider.getChannelName", () => {
  test("strips @s.whatsapp.net suffix", async () => {
    const provider = createProvider();
    expect(await provider.getChannelName("15551234567@s.whatsapp.net")).toBe(
      "15551234567",
    );
  });

  test("strips @g.us suffix for group JIDs", async () => {
    const provider = createProvider();
    expect(await provider.getChannelName("12345678-9@g.us")).toBe("12345678-9");
  });

  test("leaves bare strings unchanged", async () => {
    const provider = createProvider();
    expect(await provider.getChannelName("plainstring")).toBe("plainstring");
  });
});

// =============================================================================
// parseWebhookNotification / parseInteractivePayload / handleValidationChallenge / validateWebhookRequest
// =============================================================================

describe("WhatsAppProvider webhook stubs", () => {
  test("parseWebhookNotification returns null (socket-mode only)", async () => {
    const provider = createProvider();
    expect(await provider.parseWebhookNotification({}, {})).toBeNull();
  });

  test("parseInteractivePayload returns null (no rich payloads)", () => {
    const provider = createProvider();
    expect(provider.parseInteractivePayload({})).toBeNull();
  });

  test("handleValidationChallenge returns null", () => {
    const provider = createProvider();
    expect(provider.handleValidationChallenge({})).toBeNull();
  });

  test("validateWebhookRequest returns true (no signature verification needed)", async () => {
    const provider = createProvider();
    expect(await provider.validateWebhookRequest("body", {})).toBe(true);
  });
});

// =============================================================================
// hasMissingScopes / notifyMissingScopes
// =============================================================================

describe("WhatsAppProvider scopes", () => {
  test("hasMissingScopes always returns false", () => {
    const provider = createProvider();
    expect(provider.hasMissingScopes()).toBe(false);
  });

  test("notifyMissingScopes resolves without throwing", async () => {
    const provider = createProvider();
    await expect(
      provider.notifyMissingScopes({} as never),
    ).resolves.toBeUndefined();
  });
});

// =============================================================================
// discoverChannels
// =============================================================================

describe("WhatsAppProvider.discoverChannels", () => {
  test("returns null (no discoverable channel list)", async () => {
    const provider = createProvider();
    expect(await provider.discoverChannels()).toBeNull();
  });
});

// =============================================================================
// getThreadHistory / downloadFiles
// =============================================================================

describe("WhatsAppProvider thread history", () => {
  test("getThreadHistory returns empty array", async () => {
    const provider = createProvider();
    const result = await provider.getThreadHistory({
      channelId: "15551234567@s.whatsapp.net",
      workspaceId: "whatsapp",
      threadId: "15551234567@s.whatsapp.net",
    });
    expect(result).toEqual([]);
  });

  test("downloadFiles returns empty array", async () => {
    const provider = createProvider();
    expect(await provider.downloadFiles([])).toEqual([]);
  });
});

// =============================================================================
// getUserName
// =============================================================================

describe("WhatsAppProvider.getUserName", () => {
  test("returns null (Baileys does not expose display names easily)", async () => {
    const provider = createProvider();
    expect(await provider.getUserName("15551234567@s.whatsapp.net")).toBeNull();
  });
});

// =============================================================================
// handleIdentifyCommand (via mock socket)
// =============================================================================

describe("WhatsAppProvider.handleIdentifyCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function createProviderWithSocket(): {
    provider: WhatsAppProvider;
    sendMessage: ReturnType<typeof vi.fn>;
  } {
    const provider = createProvider();
    const sendMessage = vi.fn().mockResolvedValue({ key: { id: "msg-1" } });
    // biome-ignore lint/suspicious/noExplicitAny: test-only — inject mock socket
    (provider as any).socket = { sendMessage };
    // biome-ignore lint/suspicious/noExplicitAny: test-only — set organization
    (provider as any).organizationId = "org-1";
    return { provider, sendMessage };
  }

  test("valid /identify command links email and confirms", async () => {
    const { ChatOpsWhatsAppIdentityModel: IdentityModel } = await import(
      "@/models"
    );
    vi.mocked(IdentityModel.upsert).mockResolvedValue(undefined as never);

    const { provider, sendMessage } = createProviderWithSocket();

    // biome-ignore lint/suspicious/noExplicitAny: test-only — call private method
    await (provider as any).handleIdentifyCommand(
      "15551234567@s.whatsapp.net",
      "/identify alice@example.com",
      "org-1",
    );

    expect(IdentityModel.upsert).toHaveBeenCalledWith({
      organizationId: "org-1",
      jid: "15551234567@s.whatsapp.net",
      email: "alice@example.com",
    });
    const sentText: string = sendMessage.mock.calls[0][1].text;
    expect(sentText).toContain("alice@example.com");
    expect(sentText).toContain("✅");
  });

  test("missing email in /identify sends error message", async () => {
    const { provider, sendMessage } = createProviderWithSocket();

    // biome-ignore lint/suspicious/noExplicitAny: test-only — call private method
    await (provider as any).handleIdentifyCommand(
      "15551234567@s.whatsapp.net",
      "/identify",
      "org-1",
    );

    expect(sendMessage).toHaveBeenCalled();
    const sentText: string = sendMessage.mock.calls[0][1].text;
    expect(sentText).toContain("❌");
    expect(sentText).toContain("/identify");
  });

  test("invalid email (no @) sends error message", async () => {
    const { provider, sendMessage } = createProviderWithSocket();

    // biome-ignore lint/suspicious/noExplicitAny: test-only — call private method
    await (provider as any).handleIdentifyCommand(
      "15551234567@s.whatsapp.net",
      "/identify notanemail",
      "org-1",
    );

    expect(sendMessage).toHaveBeenCalled();
    const sentText: string = sendMessage.mock.calls[0][1].text;
    expect(sentText).toContain("❌");
  });

  test("email is lowercased before storage", async () => {
    const { ChatOpsWhatsAppIdentityModel: IdentityModel } = await import(
      "@/models"
    );
    vi.mocked(IdentityModel.upsert).mockResolvedValue(undefined as never);

    const { provider } = createProviderWithSocket();

    // biome-ignore lint/suspicious/noExplicitAny: test-only — call private method
    await (provider as any).handleIdentifyCommand(
      "15551234567@s.whatsapp.net",
      "/identify Alice@EXAMPLE.COM",
      "org-1",
    );

    expect(IdentityModel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@example.com" }),
    );
  });
});

// =============================================================================
// handleApprovalResponse (approval keyword matching)
// =============================================================================

describe("WhatsAppProvider.handleApprovalResponse", () => {
  const CHANNEL = "15551234567@s.whatsapp.net";

  function createProviderWithPendingApproval(): {
    provider: WhatsAppProvider;
    eventHandler: {
      handleInteractiveApprovalDecision: ReturnType<typeof vi.fn>;
    };
  } {
    const provider = createProvider();
    const sendMessage = vi.fn().mockResolvedValue({ key: { id: "msg-2" } });
    // biome-ignore lint/suspicious/noExplicitAny: test-only — inject mock socket
    (provider as any).socket = { sendMessage };
    // biome-ignore lint/suspicious/noExplicitAny: test-only — set organization
    (provider as any).organizationId = "org-1";

    // Add a pending approval for the channel
    // biome-ignore lint/suspicious/noExplicitAny: test-only — access private map
    (provider as any).pendingApprovals.set("approval-1", {
      taskId: "task-1",
      toolName: "delete_file",
      channelId: CHANNEL,
      originalMessage: {
        messageId: "m1",
        channelId: CHANNEL,
        workspaceId: "whatsapp",
        threadId: CHANNEL,
        senderId: CHANNEL,
        senderName: "15551234567",
        text: "run it",
        rawText: "run it",
        timestamp: new Date(),
        isThreadReply: false,
      },
    });

    const eventHandler = {
      handleInteractiveApprovalDecision: vi.fn().mockResolvedValue(undefined),
      handleIncomingMessage: vi.fn(),
    };
    // biome-ignore lint/suspicious/noExplicitAny: test-only — set event handler
    (provider as any).eventHandler = eventHandler;

    return { provider, eventHandler };
  }

  const approveKeywords = ["approve", "APPROVE", "Approve", "👍"];
  const rejectKeywords = ["reject", "REJECT", "Reject", "👎"];

  for (const keyword of approveKeywords) {
    test(`"${keyword}" is recognized as approval`, async () => {
      const { provider, eventHandler } = createProviderWithPendingApproval();

      // biome-ignore lint/suspicious/noExplicitAny: test-only — call private method
      const handled = await (provider as any).handleApprovalResponse(
        CHANNEL,
        keyword,
      );

      expect(handled).toBe(true);
      expect(
        eventHandler.handleInteractiveApprovalDecision,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ approved: true }),
        expect.any(Function),
      );
    });
  }

  for (const keyword of rejectKeywords) {
    test(`"${keyword}" is recognized as rejection`, async () => {
      const { provider, eventHandler } = createProviderWithPendingApproval();

      // biome-ignore lint/suspicious/noExplicitAny: test-only — call private method
      const handled = await (provider as any).handleApprovalResponse(
        CHANNEL,
        keyword,
      );

      expect(handled).toBe(true);
      expect(
        eventHandler.handleInteractiveApprovalDecision,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ approved: false }),
        expect.any(Function),
      );
    });
  }

  test("unrelated text returns false and does not call event handler", async () => {
    const { provider, eventHandler } = createProviderWithPendingApproval();

    // biome-ignore lint/suspicious/noExplicitAny: test-only — call private method
    const handled = await (provider as any).handleApprovalResponse(
      CHANNEL,
      "hello world",
    );

    expect(handled).toBe(false);
    expect(
      eventHandler.handleInteractiveApprovalDecision,
    ).not.toHaveBeenCalled();
  });

  test("approval for wrong channel returns false", async () => {
    const { provider, eventHandler } = createProviderWithPendingApproval();

    // biome-ignore lint/suspicious/noExplicitAny: test-only — call private method
    const handled = await (provider as any).handleApprovalResponse(
      "different@s.whatsapp.net",
      "approve",
    );

    expect(handled).toBe(false);
    expect(
      eventHandler.handleInteractiveApprovalDecision,
    ).not.toHaveBeenCalled();
  });

  test("no pending approvals always returns false", async () => {
    const provider = createProvider();
    // biome-ignore lint/suspicious/noExplicitAny: test-only — call private method
    const handled = await (provider as any).handleApprovalResponse(
      CHANNEL,
      "approve",
    );
    expect(handled).toBe(false);
  });
});

// =============================================================================
// sendAgentSelectionCard — message format
// =============================================================================

describe("WhatsAppProvider.sendAgentSelectionCard", () => {
  test("sends numbered list with agent names", async () => {
    const provider = createProvider({ enabled: true, botName: "Archie" });
    const sendMessage = vi.fn().mockResolvedValue({ key: { id: "msg-3" } });
    // biome-ignore lint/suspicious/noExplicitAny: test-only — inject mock socket
    (provider as any).socket = { sendMessage };

    await provider.sendAgentSelectionCard({
      message: {
        messageId: "m1",
        channelId: "15551234567@s.whatsapp.net",
        workspaceId: "whatsapp",
        threadId: "15551234567@s.whatsapp.net",
        senderId: "15551234567@s.whatsapp.net",
        senderName: "15551234567",
        text: "hello",
        rawText: "hello",
        timestamp: new Date(),
        isThreadReply: false,
      },
      agents: [
        { id: "agent-1", name: "Sales" },
        { id: "agent-2", name: "Support" },
      ],
      isWelcome: true,
    });

    const sentText: string = sendMessage.mock.calls[0][1].text;
    expect(sentText).toContain("1. Sales");
    expect(sentText).toContain("2. Support");
    expect(sentText).toContain("Archie");
  });

  test("non-welcome card omits greeting", async () => {
    const provider = createProvider();
    const sendMessage = vi.fn().mockResolvedValue({ key: { id: "msg-4" } });
    // biome-ignore lint/suspicious/noExplicitAny: test-only — inject mock socket
    (provider as any).socket = { sendMessage };

    await provider.sendAgentSelectionCard({
      message: {
        messageId: "m2",
        channelId: "15551234567@s.whatsapp.net",
        workspaceId: "whatsapp",
        threadId: "15551234567@s.whatsapp.net",
        senderId: "15551234567@s.whatsapp.net",
        senderName: "15551234567",
        text: "hello",
        rawText: "hello",
        timestamp: new Date(),
        isThreadReply: false,
      },
      agents: [{ id: "agent-1", name: "Sales" }],
      isWelcome: false,
    });

    const sentText: string = sendMessage.mock.calls[0][1].text;
    expect(sentText).not.toContain("Welcome");
    expect(sentText).toContain("1. Sales");
  });

  test("does nothing when socket is null", async () => {
    const provider = createProvider();
    // biome-ignore lint/suspicious/noExplicitAny: test-only — ensure socket is null
    (provider as any).socket = null;

    // Should not throw
    await expect(
      provider.sendAgentSelectionCard({
        message: {
          messageId: "m3",
          channelId: "c1",
          workspaceId: "whatsapp",
          threadId: "c1",
          senderId: "c1",
          senderName: "user",
          text: "",
          rawText: "",
          timestamp: new Date(),
          isThreadReply: false,
        },
        agents: [],
        isWelcome: false,
      }),
    ).resolves.toBeUndefined();
  });
});

// =============================================================================
// sendReply — footer appended with em dash
// =============================================================================

describe("WhatsAppProvider.sendReply", () => {
  test("appends footer with em dash when provided", async () => {
    const provider = createProvider();
    const sendMessage = vi.fn().mockResolvedValue({ key: { id: "msg-5" } });
    // biome-ignore lint/suspicious/noExplicitAny: test-only — inject mock socket
    (provider as any).socket = { sendMessage };

    await provider.sendReply({
      originalMessage: {
        messageId: "m1",
        channelId: "15551234567@s.whatsapp.net",
        workspaceId: "whatsapp",
        threadId: "15551234567@s.whatsapp.net",
        senderId: "15551234567@s.whatsapp.net",
        senderName: "user",
        text: "hi",
        rawText: "hi",
        timestamp: new Date(),
        isThreadReply: false,
      },
      text: "Hello there!",
      footer: "Sales Bot",
    });

    const sentText: string = sendMessage.mock.calls[0][1].text;
    expect(sentText).toContain("Hello there!");
    expect(sentText).toContain("Sales Bot");
    expect(sentText).toContain("—");
  });

  test("sends text without footer when not provided", async () => {
    const provider = createProvider();
    const sendMessage = vi.fn().mockResolvedValue({ key: { id: "msg-6" } });
    // biome-ignore lint/suspicious/noExplicitAny: test-only — inject mock socket
    (provider as any).socket = { sendMessage };

    await provider.sendReply({
      originalMessage: {
        messageId: "m2",
        channelId: "15551234567@s.whatsapp.net",
        workspaceId: "whatsapp",
        threadId: "15551234567@s.whatsapp.net",
        senderId: "15551234567@s.whatsapp.net",
        senderName: "user",
        text: "hi",
        rawText: "hi",
        timestamp: new Date(),
        isThreadReply: false,
      },
      text: "Hello!",
    });

    const sentText: string = sendMessage.mock.calls[0][1].text;
    expect(sentText).toBe("Hello!");
  });

  test("returns empty string when socket is null", async () => {
    const provider = createProvider();
    // biome-ignore lint/suspicious/noExplicitAny: test-only — ensure socket is null
    (provider as any).socket = null;

    const result = await provider.sendReply({
      originalMessage: {
        messageId: "m3",
        channelId: "c1",
        workspaceId: "whatsapp",
        threadId: "c1",
        senderId: "c1",
        senderName: "user",
        text: "",
        rawText: "",
        timestamp: new Date(),
        isThreadReply: false,
      },
      text: "text",
    });

    expect(result).toBe("");
  });
});
