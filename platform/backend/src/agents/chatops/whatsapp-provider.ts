import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import {
  BufferJSON,
  initAuthCreds,
  makeWASocket,
  proto,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import logger from "@/logging";
import {
  ChatOpsWhatsAppIdentityModel,
  ChatOpsWhatsAppSessionModel,
  OrganizationModel,
} from "@/models";
import type {
  AddApprovalRequestFormOptions,
  ChatOpsEventHandler,
  ChatOpsProvider,
  ChatOpsProviderType,
  ChatReplyOptions,
  ChatThreadMessage,
  ChatThreadMessageFile,
  DiscoveredChannel,
  IncomingChatMessage,
  ThreadHistoryParams,
  UpdateApprovalRequestOptions,
  WhatsAppDbConfig,
} from "@/types";
import type { A2AAttachment } from "../a2a-executor";

const IDENTIFY_CMD = "/identify";
const APPROVAL_KEYWORDS = new Set(["approve", "yes", "👍"]);
const REJECT_KEYWORDS = new Set(["reject", "decline", "no", "👎"]);

/**
 * WhatsApp ChatOps provider using Baileys (WhatsApp Web API).
 *
 * Connection model: persistent WebSocket to WhatsApp servers (socket mode only).
 * Session state (auth credentials + signal keys) is persisted in PostgreSQL
 * so the session survives pod restarts without requiring Redis.
 *
 * User identity mapping:
 *   WhatsApp JID (phone number) → Archestra email
 *   Users link accounts via: /identify their@email.com
 */
export class WhatsAppProvider implements ChatOpsProvider {
  readonly providerId: ChatOpsProviderType = "whatsapp";
  readonly displayName = "WhatsApp";

  private config: WhatsAppDbConfig;
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private eventHandler: ChatOpsEventHandler | null = null;
  private organizationId: string | null = null;
  /** QR code string for the current pairing attempt, null when connected */
  private currentQr: string | null = null;
  /** Whether the socket is currently authenticated */
  private connected = false;
  /** Pending approval requests: approvalId → { taskId, toolName, channelId, originalMessage } */
  private pendingApprovals = new Map<
    string,
    {
      taskId: string;
      toolName: string;
      channelId: string;
      originalMessage: IncomingChatMessage;
    }
  >();

  constructor(config: WhatsAppDbConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled === true;
  }

  setEventHandler(handler: ChatOpsEventHandler): void {
    this.eventHandler = handler;
  }

  /** Return the most recent QR code (null when already connected). */
  getCurrentQr(): string | null {
    return this.currentQr;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async initialize(): Promise<void> {
    if (!this.isConfigured()) return;

    const org = await OrganizationModel.getFirst();
    if (!org) {
      logger.warn("[WhatsApp] No organization found, skipping initialization");
      return;
    }
    this.organizationId = org.id;
    await this.startSocket();
  }

  async cleanup(): Promise<void> {
    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch {
        // ignore close errors
      }
      this.socket = null;
    }
    this.connected = false;
    this.currentQr = null;
  }

  /**
   * Logout: clear session from DB and close socket.
   * After calling this, initialize() must be called again to reconnect.
   */
  async logout(): Promise<void> {
    if (this.organizationId) {
      await ChatOpsWhatsAppSessionModel.deleteAll(this.organizationId);
    }
    await this.cleanup();
  }

  // ────────────────────────────────────────────────────────────
  // Webhook interface stubs (WhatsApp is socket-mode only)
  // ────────────────────────────────────────────────────────────

  async validateWebhookRequest(): Promise<boolean> {
    return false; // No webhook — events come from socket
  }

  handleValidationChallenge(): null {
    return null;
  }

  async parseWebhookNotification(): Promise<IncomingChatMessage | null> {
    return null; // Not used — messages are delivered via socket events
  }

  // ────────────────────────────────────────────────────────────
  // Messaging
  // ────────────────────────────────────────────────────────────

  async sendReply(options: ChatReplyOptions): Promise<string> {
    if (!this.socket) {
      logger.warn("[WhatsApp] sendReply called but socket not connected");
      return "";
    }
    const jid = options.originalMessage.channelId;
    const text = options.footer
      ? `${options.text}\n\n_— ${options.footer}_`
      : options.text;
    try {
      const result = await this.socket.sendMessage(jid, { text });
      return result?.key?.id ?? "";
    } catch (err) {
      logger.error({ err }, "[WhatsApp] Failed to send reply");
      return "";
    }
  }

  async sendDirectMessage(params: {
    userId: string;
    text: string;
    actionUrl?: string;
    actionLabel?: string;
  }): Promise<void> {
    if (!this.socket) return;
    const jid = normalizeJid(params.userId);
    let text = params.text;
    if (params.actionUrl && params.actionLabel) {
      text += `\n\n${params.actionLabel}: ${params.actionUrl}`;
    }
    try {
      await this.socket.sendMessage(jid, { text });
    } catch (err) {
      logger.error({ err }, "[WhatsApp] Failed to send DM");
    }
  }

  async sendAgentSelectionCard(params: {
    message: IncomingChatMessage;
    agents: { id: string; name: string }[];
    isWelcome: boolean;
  }): Promise<void> {
    if (!this.socket) return;
    const jid = params.message.channelId;
    const header = params.isWelcome
      ? `👋 Welcome! I'm ${this.config.botName ?? "Archestra"}.\n\nPlease select an agent by replying with its number:`
      : "Please select an agent by replying with its number:";
    const list = params.agents
      .map((a, i) => `  ${i + 1}. ${a.name}`)
      .join("\n");
    try {
      await this.socket.sendMessage(jid, { text: `${header}\n\n${list}` });
    } catch (err) {
      logger.error({ err }, "[WhatsApp] Failed to send agent selection");
    }
  }

  async addApprovalRequestForm(
    options: AddApprovalRequestFormOptions,
  ): Promise<void> {
    if (!this.socket) return;
    const jid = options.channelId;
    this.pendingApprovals.set(options.approvalId, {
      taskId: options.taskId,
      toolName: options.toolName,
      channelId: options.channelId,
      originalMessage: options.originalMessage,
    });
    try {
      await this.socket.sendMessage(jid, {
        text: `🔔 *Approval required*\n\nTool: \`${options.toolName}\`\n\nReply *approve* or *reject* to continue.`,
      });
    } catch (err) {
      logger.error({ err }, "[WhatsApp] Failed to send approval request");
    }
  }

  async updateApprovalRequest(
    options: UpdateApprovalRequestOptions,
  ): Promise<void> {
    if (!this.socket) return;
    const status = options.approved ? "✅ Approved" : "❌ Rejected";
    try {
      await this.socket.sendMessage(options.channelId, {
        text: `${status}: \`${options.toolName}\``,
      });
    } catch (err) {
      logger.error({ err }, "[WhatsApp] Failed to update approval");
    }
    this.pendingApprovals.delete(options.messageKey);
  }

  // ────────────────────────────────────────────────────────────
  // Thread history (WhatsApp doesn't expose historical messages via Web API)
  // ────────────────────────────────────────────────────────────

  async getThreadHistory(
    _params: ThreadHistoryParams,
  ): Promise<ChatThreadMessage[]> {
    return [];
  }

  async downloadFiles(
    _files: ChatThreadMessageFile[],
  ): Promise<A2AAttachment[]> {
    return [];
  }

  // ────────────────────────────────────────────────────────────
  // User / channel identity
  // ────────────────────────────────────────────────────────────

  async getUserEmail(userId: string): Promise<string | null> {
    if (!this.organizationId) return null;
    return ChatOpsWhatsAppIdentityModel.findEmailByJid({
      organizationId: this.organizationId,
      jid: userId,
    });
  }

  async getUserName(_userId: string): Promise<string | null> {
    return null; // Baileys doesn't expose display names easily without contacts sync
  }

  async getChannelName(channelId: string): Promise<string | null> {
    // For WhatsApp, the channelId IS the phone number JID
    return channelId.replace(/@.+$/, ""); // strip @s.whatsapp.net suffix
  }

  parseInteractivePayload(): null {
    return null; // WhatsApp has no rich interactive payloads
  }

  getWorkspaceId(): string | null {
    return "whatsapp"; // Single workspace per Baileys instance
  }

  getWorkspaceName(): string | null {
    return "WhatsApp";
  }

  hasMissingScopes(): boolean {
    return false;
  }

  async notifyMissingScopes(): Promise<void> {}

  async discoverChannels(): Promise<DiscoveredChannel[] | null> {
    return null; // WhatsApp contacts/groups don't have a discoverable channel list
  }

  // ────────────────────────────────────────────────────────────
  // Typing indicator
  // ────────────────────────────────────────────────────────────

  async setTypingStatus(channelId: string): Promise<void> {
    if (!this.socket) return;
    try {
      await this.socket.sendPresenceUpdate("composing", channelId);
      // Clear after 3 seconds so the "typing" indicator doesn't persist
      setTimeout(async () => {
        try {
          await this.socket?.sendPresenceUpdate("paused", channelId);
        } catch {
          // ignore
        }
      }, 3000);
    } catch {
      // non-fatal
    }
  }

  // ────────────────────────────────────────────────────────────
  // Internal — Baileys socket setup
  // ────────────────────────────────────────────────────────────

  private async startSocket(): Promise<void> {
    const orgId = this.organizationId;
    if (!orgId) return;
    const { state, saveCreds } = await createPostgresAuthState(orgId);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: logger.child({ module: "baileys" }) as ReturnType<
        typeof logger.child
      >,
      browser: ["Archestra", "Chrome", "126.0"],
      markOnlineOnConnect: false,
    });

    this.socket = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Convert raw QR string to data URL so the frontend can render it directly
        QRCode.toDataURL(qr, { width: 300, margin: 2 })
          .then((dataUrl) => {
            this.currentQr = dataUrl;
          })
          .catch(() => {
            this.currentQr = qr; // fall back to raw string
          });
        this.connected = false;
        logger.info("[WhatsApp] QR code updated — scan to pair");
      }

      if (connection === "open") {
        this.connected = true;
        this.currentQr = null;
        logger.info("[WhatsApp] Connected successfully");
      }

      if (connection === "close") {
        this.connected = false;
        const statusCode = (
          lastDisconnect?.error as { output?: { statusCode?: number } }
        )?.output?.statusCode;
        // 401 = logged out — don't reconnect, clear session
        if (statusCode === 401) {
          logger.warn("[WhatsApp] Logged out, clearing session");
          await ChatOpsWhatsAppSessionModel.deleteAll(orgId);
          return;
        }
        // Otherwise reconnect after a short delay
        logger.info(
          { statusCode },
          "[WhatsApp] Connection closed, reconnecting in 5s",
        );
        setTimeout(() => {
          this.startSocket().catch((err) =>
            logger.error({ err }, "[WhatsApp] Reconnect failed"),
          );
        }, 5000);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        await this.handleIncomingMessage(msg).catch((err) =>
          logger.error(
            { err, msgKey: msg.key },
            "[WhatsApp] Error handling message",
          ),
        );
      }
    });
  }

  private async handleIncomingMessage(
    msg: proto.IWebMessageInfo,
  ): Promise<void> {
    // Skip own messages and status updates
    if (msg.key.fromMe) return;
    if (msg.key.remoteJid === "status@broadcast") return;

    const jid = msg.key.remoteJid;
    if (!jid) return;

    const text = extractMessageText(msg);
    if (!text) return;

    const orgId = this.organizationId;
    if (!orgId) return;

    // Handle /identify command
    if (text.trim().toLowerCase().startsWith(IDENTIFY_CMD)) {
      await this.handleIdentifyCommand(jid, text, orgId);
      return;
    }

    // Check for pending approval response
    const approvalHandled = await this.handleApprovalResponse(jid, text);
    if (approvalHandled) return;

    if (!this.eventHandler) return;

    const senderEmail = await this.getUserEmail(jid);
    const senderName = jid.replace(/@.+$/, "");
    const messageId = msg.key.id ?? `${jid}-${Date.now()}`;
    const timestamp = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000)
      : new Date();

    const incoming: IncomingChatMessage = {
      messageId,
      channelId: jid,
      workspaceId: "whatsapp",
      threadId: jid,
      senderId: jid,
      senderEmail: senderEmail ?? undefined,
      senderName,
      text: text.trim(),
      rawText: text,
      timestamp,
      isThreadReply: false,
    };

    await this.eventHandler.handleIncomingMessage(this, incoming);
  }

  private async handleIdentifyCommand(
    jid: string,
    text: string,
    orgId: string,
  ): Promise<void> {
    const parts = text.trim().split(/\s+/);
    const email = parts[1]?.toLowerCase();

    if (!email || !email.includes("@")) {
      await this.socket?.sendMessage(jid, {
        text: `❌ Usage: \`/identify your@email.com\`\n\nSend your Archestra account email to link this phone number.`,
      });
      return;
    }

    await ChatOpsWhatsAppIdentityModel.upsert({
      organizationId: orgId,
      jid,
      email,
    });
    await this.socket?.sendMessage(jid, {
      text: `✅ Linked! Your WhatsApp number is now associated with *${email}*.`,
    });
    logger.info({ jid, email }, "[WhatsApp] Identity linked");
  }

  private async handleApprovalResponse(
    jid: string,
    text: string,
  ): Promise<boolean> {
    if (this.pendingApprovals.size === 0) return false;

    const lower = text.trim().toLowerCase();
    const approved = APPROVAL_KEYWORDS.has(lower);
    const rejected = REJECT_KEYWORDS.has(lower);

    if (!approved && !rejected) return false;

    // Find the pending approval for this channel
    for (const [approvalId, pending] of this.pendingApprovals) {
      if (pending.channelId !== jid) continue;

      if (this.eventHandler) {
        const senderEmail = await this.getUserEmail(jid);
        const decision = {
          taskId: pending.taskId,
          approvalId,
          approved,
          toolName: pending.toolName,
          messageTs: Date.now().toString(),
          channelId: jid,
          workspaceId: "whatsapp" as const,
          originalMessage: pending.originalMessage,
          userId: jid,
          userName: jid.replace(/@.+$/, ""),
          responseUrl: "",
          approverEmail: senderEmail ?? undefined,
        };
        await this.eventHandler.handleInteractiveApprovalDecision(
          this,
          decision,
          async () => {
            await this.updateApprovalRequest({
              channelId: jid,
              messageKey: approvalId,
              toolName: pending.toolName,
              approved,
            });
          },
        );
      }
      this.pendingApprovals.delete(approvalId);
      return true;
    }
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PostgreSQL-backed Baileys auth state
// ────────────────────────────────────────────────────────────────────────────

/**
 * Implements Baileys' auth state interface backed by PostgreSQL.
 * Replaces the Redis-based auth state from the original Ecialo PR.
 */
async function createPostgresAuthState(organizationId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const credsRaw = await ChatOpsWhatsAppSessionModel.get({
    organizationId,
    category: "creds",
    keyId: "creds",
  });

  const creds: AuthenticationCreds = credsRaw
    ? (JSON.parse(
        JSON.stringify(credsRaw),
        BufferJSON.reviver,
      ) as AuthenticationCreds)
    : initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        for (const id of ids) {
          const raw = await ChatOpsWhatsAppSessionModel.get({
            organizationId,
            category: type,
            keyId: id,
          });
          if (raw) {
            const value = JSON.parse(JSON.stringify(raw), BufferJSON.reviver);
            // Baileys expects pre-keys to be wrapped in proto.Message
            if (type === "pre-key") {
              data[id] = proto.Message.decode(
                Buffer.from(value as ArrayBuffer),
              ) as unknown as SignalDataTypeMap[typeof type];
            } else {
              data[id] = value as SignalDataTypeMap[typeof type];
            }
          }
        }
        return data;
      },
      set: async (data) => {
        for (const [type, entries] of Object.entries(data)) {
          const typedEntries = entries as { [id: string]: unknown };
          for (const [id, value] of Object.entries(typedEntries)) {
            if (value) {
              let serialized: unknown = value;
              // Encode pre-keys as proto bytes
              if (type === "pre-key") {
                serialized = proto.Message.encode(
                  value as proto.IMessage,
                ).finish();
              }
              await ChatOpsWhatsAppSessionModel.set({
                organizationId,
                category: type,
                keyId: id,
                value: JSON.parse(
                  JSON.stringify(serialized, BufferJSON.replacer),
                ),
              });
            } else {
              // null value means delete
              await ChatOpsWhatsAppSessionModel.deleteKeys({
                organizationId,
                category: type,
                keyIds: [id],
              });
            }
          }
        }
      },
    },
  };

  const saveCreds = async (): Promise<void> => {
    await ChatOpsWhatsAppSessionModel.set({
      organizationId,
      category: "creds",
      keyId: "creds",
      value: JSON.parse(JSON.stringify(state.creds, BufferJSON.replacer)),
    });
  };

  return { state, saveCreds };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function normalizeJid(jid: string): string {
  if (jid.includes("@")) return jid;
  return `${jid.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
}

function extractMessageText(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    null
  );
}
