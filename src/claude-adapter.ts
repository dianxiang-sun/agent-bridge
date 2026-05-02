/**
 * Claude Code MCP Server — Dual-Mode Message Transport
 *
 * Supports two delivery modes:
 *   - Push mode (OAuth): real-time via notifications/claude/channel
 *   - Pull mode (API key): message queue + get_messages tool
 *
 * Mode defaults to pull in auto mode, or set explicitly via AGENTBRIDGE_MODE env var.
 *
 * Emits:
 *   - "ready"   ()                   — MCP connected, mode resolved
 *   - "reply"   (msg: BridgeMessage) — Claude used the reply tool
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { StateDirResolver } from "./state-dir";
import type { BridgeMessage } from "./types";
import type { AskCodexCompletionSignal, AskCodexOutcome, AskCodexResult } from "./control-protocol";
import type { AskCodexWaitHandle } from "./daemon-client";

export type ReplySender = (msg: BridgeMessage, requireReply?: boolean) => Promise<{ success: boolean; error?: string }>;
export type AskSender = (msg: BridgeMessage, timeoutMs: number) => AskCodexWaitHandle;
export type WaitCancelSender = (requestId: string, reason?: string) => boolean;
export type DeliveryMode = "push" | "pull" | "auto";

const ASK_CODEX_DEFAULT_TIMEOUT_MS = 600_000;
const ASK_CODEX_MIN_TIMEOUT_MS = 10_000;
const ASK_CODEX_MAX_TIMEOUT_MS = 7_200_000;

export const CLAUDE_INSTRUCTIONS = [
  "Codex is an AI coding agent (OpenAI) running in a separate session on the same machine.",
  "",
  "## Message delivery",
  "Messages from Codex may arrive in two ways depending on the connection mode:",
  "- As <channel source=\"agentbridge\" chat_id=\"...\" user=\"Codex\" ...> tags (push mode)",
  "- Via the get_messages tool (pull mode)",
  "",
  "## Collaboration roles",
  "Default roles in this setup:",
  "- Claude: Reviewer, Planner, Hypothesis Challenger",
  "- Codex: Implementer, Executor, Reproducer/Verifier",
  "- Expect Codex to provide independent technical judgment and evidence, not passive agreement.",
  "",
  "## Thinking patterns (task-driven)",
  "- Analytical/review tasks: Independent Analysis & Convergence",
  "- Implementation tasks: Architect -> Builder -> Critic",
  "- Debugging tasks: Hypothesis -> Experiment -> Interpretation",
  "",
  "## Collaboration language",
  "- Use explicit phrases such as \"My independent view is:\", \"I agree on:\", \"I disagree on:\", and \"Current consensus:\".",
  "",
  "## How to interact",
  "- Use the reply tool to send messages back to Codex — pass chat_id back.",
  "- Use the get_messages tool to check for pending messages from Codex.",
  "- After sending a reply, call get_messages to check for responses.",
  "- When the user asks about Codex status or progress, call get_messages.",
  "",
  "## Turn coordination",
  "- When you see '⏳ Codex is working', do NOT call the reply tool — wait for '✅ Codex finished'.",
  "- After Codex finishes a turn, you have an attention window to review and respond before new messages arrive.",
  "- If the reply tool returns a busy error, Codex is still executing — wait and try again later.",
].join("\n");

export class ClaudeAdapter extends EventEmitter {
  private server: Server;
  private notificationSeq = 0;
  private sessionId: string;
  private readonly notificationIdPrefix: string;
  private readonly instanceId: string;
  private replySender: ReplySender | null = null;
  private askSender: AskSender | null = null;
  private waitCancelSender: WaitCancelSender | null = null;
  private readonly logFile: string;

  // Dual-mode transport
  private readonly configuredMode: DeliveryMode;
  private resolvedMode: "push" | "pull" | null = null;
  private pendingMessages: BridgeMessage[] = [];
  private readonly maxBufferedMessages: number;
  private droppedMessageCount = 0;

  constructor(logFile = new StateDirResolver().logFile) {
    super();
    this.logFile = logFile;
    this.instanceId = randomUUID().slice(0, 8);
    this.sessionId = `codex_${Date.now()}`;
    this.notificationIdPrefix = randomUUID().replace(/-/g, "").slice(0, 12);
    this.log(`ClaudeAdapter created (instance=${this.instanceId})`);

    const envMode = process.env.AGENTBRIDGE_MODE as DeliveryMode | undefined;
    this.configuredMode = envMode && ["push", "pull", "auto"].includes(envMode) ? envMode : "auto";
    this.maxBufferedMessages = parseInt(process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES ?? "100", 10);

    this.server = new Server(
      { name: "agentbridge", version: "0.1.0" },
      {
        capabilities: {
          experimental: { "claude/channel": {} },
          tools: {},
        },
        instructions: CLAUDE_INSTRUCTIONS,
      },
    );

    this.setupHandlers();
  }

  // ── Lifecycle ──────────────────────────────────────────────

  async start() {
    const transport = new StdioServerTransport();
    this.resolveMode();
    await this.server.connect(transport);
    this.log(`MCP server connected (mode: ${this.resolvedMode})`);
    this.emit("ready");
  }

  /** Register the async sender that bridge provides for reply delivery. */
  setReplySender(sender: ReplySender) {
    this.replySender = sender;
  }

  /** Register the async sender and cancel hook that bridge provides for ask_codex delivery. */
  setAskSender(sender: AskSender, cancelSender: WaitCancelSender) {
    this.askSender = sender;
    this.waitCancelSender = cancelSender;
  }

  /** Returns the resolved delivery mode. */
  getDeliveryMode(): "push" | "pull" {
    return this.resolvedMode ?? "pull";
  }

  /** Returns the number of messages waiting in the pull queue. */
  getPendingMessageCount(): number {
    return this.pendingMessages.length;
  }

  // ── Mode Detection ─────────────────────────────────────────

  private resolveMode(): void {
    if (this.resolvedMode) return;

    if (this.configuredMode === "push" || this.configuredMode === "pull") {
      this.resolvedMode = this.configuredMode;
      this.log(`Delivery mode set by AGENTBRIDGE_MODE: ${this.resolvedMode}`);
    } else {
      // Default to pull — Claude Code doesn't declare channel support in
      // client capabilities, so we can't reliably detect whether channel
      // delivery is actually working. Users can opt into push explicitly with
      // AGENTBRIDGE_MODE=push when their setup is known to support it.
      this.resolvedMode = "pull";
      this.log("Delivery mode defaulting to pull (set AGENTBRIDGE_MODE=push to opt into channel delivery)");
    }
  }

  // ── Message Delivery ───────────────────────────────────────

  async pushNotification(message: BridgeMessage) {
    this.log(`pushNotification (instance=${this.instanceId}, mode=${this.resolvedMode}, msgId=${message.id}, len=${message.content.length})`);
    if (this.resolvedMode === "push") {
      await this.pushViaChannel(message);
    } else {
      this.queueForPull(message);
    }
  }

  private async pushViaChannel(message: BridgeMessage) {
    const msgId = `codex_msg_${this.notificationIdPrefix}_${++this.notificationSeq}`;
    const ts = new Date(message.timestamp).toISOString();

    try {
      await this.server.notification({
        method: "notifications/claude/channel",
        params: {
          content: message.content,
          meta: {
            chat_id: this.sessionId,
            message_id: msgId,
            user: "Codex",
            user_id: "codex",
            ts,
            source_type: "codex",
          },
        },
      });
      this.log(`Pushed notification: ${msgId}`);
    } catch (e: any) {
      this.log(`Push notification failed: ${e.message}`);
      this.queueForPull(message);
    }
  }

  private queueForPull(message: BridgeMessage) {
    if (this.pendingMessages.length >= this.maxBufferedMessages) {
      this.pendingMessages.shift();
      this.droppedMessageCount++;
      this.log(`Message queue full, dropped oldest message (total dropped: ${this.droppedMessageCount})`);
    }
    this.pendingMessages.push(message);
    this.log(`Queued message for pull (${this.pendingMessages.length} pending, instance=${this.instanceId})`);
  }

  // ── get_messages ───────────────────────────────────────────

  private drainMessages(): { content: Array<{ type: "text"; text: string }> } {
    this.log(`get_messages called (instance=${this.instanceId}, pending=${this.pendingMessages.length}, dropped=${this.droppedMessageCount})`);
    if (this.pendingMessages.length === 0 && this.droppedMessageCount === 0) {
      return {
        content: [{ type: "text" as const, text: "No new messages from Codex." }],
      };
    }

    // Snapshot and clear atomically to avoid issues with concurrent writes
    const messages = this.pendingMessages;
    this.pendingMessages = [];
    const dropped = this.droppedMessageCount;
    this.droppedMessageCount = 0;

    const count = messages.length;
    let header = `[${count} new message${count > 1 ? "s" : ""} from Codex]`;
    if (dropped > 0) {
      header += ` (${dropped} older message${dropped > 1 ? "s" : ""} were dropped due to queue overflow)`;
    }
    header += `\nchat_id: ${this.sessionId}`;

    const formatted = messages
      .map((msg, i) => {
        const ts = new Date(msg.timestamp).toISOString();
        return `---\n[${i + 1}] ${ts}\nCodex: ${msg.content}`;
      })
      .join("\n\n");

    this.log(`get_messages returning ${count} message(s) (instance=${this.instanceId}, dropped=${dropped})`);
    return {
      content: [
        {
          type: "text" as const,
          text: `${header}\n\n${formatted}`,
        },
      ],
    };
  }

  // ── MCP Tool Handlers ─────────────────────────────────────

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "reply",
          description:
            "Send a message back to Codex. Your reply will be injected into the Codex session as a new user turn.",
          inputSchema: {
            type: "object" as const,
            properties: {
              chat_id: {
                type: "string",
                description: "The conversation to reply in (from the inbound <channel> tag).",
              },
              text: {
                type: "string",
                description: "The message to send to Codex.",
              },
              require_reply: {
                type: "boolean",
                description: "When true, Codex is required to send a reply. All Codex messages from this turn will be forwarded immediately (bypassing STATUS buffering). Use this when you need a direct answer from Codex.",
              },
            },
            required: ["text"],
          },
        },
        {
          name: "get_messages",
          description:
            "Check for new messages from Codex. Call this after sending a reply or when you expect a response from Codex.",
          inputSchema: {
            type: "object" as const,
            properties: {},
            required: [],
          },
        },
        {
          name: "ask_codex",
          description:
            "Send a question to Codex and wait for the Codex turn to finish or time out.",
          inputSchema: {
            type: "object" as const,
            properties: {
              text: {
                type: "string",
                minLength: 1,
                description: "The message to send to Codex.",
              },
              chat_id: {
                type: "string",
                description: "Optional conversation annotation to attach to the outbound message.",
              },
              timeout_ms: {
                type: "number",
                description: "Maximum wait time in milliseconds. Values are clamped to 10 seconds through 2 hours.",
              },
            },
            required: ["text"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const { name, arguments: args } = request.params;

      if (name === "reply") {
        return this.handleReply(args as Record<string, unknown>);
      }

      if (name === "get_messages") {
        return this.drainMessages();
      }

      if (name === "ask_codex") {
        return this.handleAskCodex(args as Record<string, unknown>, extra.signal);
      }

      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    });
  }

  private async handleReply(args: Record<string, unknown>) {
    const text = args?.text as string | undefined;
    if (!text) {
      return {
        content: [{ type: "text" as const, text: "Error: missing required parameter 'text'" }],
        isError: true,
      };
    }

    const requireReply = args?.require_reply === true;

    const bridgeMsg: BridgeMessage = {
      id: (args?.chat_id as string) ?? `reply_${Date.now()}`,
      source: "claude",
      content: text,
      timestamp: Date.now(),
    };

    if (!this.replySender) {
      this.log("No reply sender registered");
      return {
        content: [{ type: "text" as const, text: "Error: bridge not initialized, cannot send reply." }],
        isError: true,
      };
    }

    const result = await this.replySender(bridgeMsg, requireReply);
    if (!result.success) {
      this.log(`Reply delivery failed: ${result.error}`);
      return {
        content: [{ type: "text" as const, text: `Error: ${result.error}` }],
        isError: true,
      };
    }

    // Include pending message hint
    const pending = this.pendingMessages.length;
    let responseText = "Reply sent to Codex.";
    if (pending > 0) {
      responseText += ` Note: ${pending} unread Codex message${pending > 1 ? "s" : ""} already waiting \u2014 call get_messages to read them.`;
    }

    return {
      content: [{ type: "text" as const, text: responseText }],
    };
  }

  private async handleAskCodex(args: Record<string, unknown>, signal?: AbortSignal) {
    const text = args?.text;
    if (text === undefined) {
      return {
        content: [{ type: "text" as const, text: "Error: missing required parameter 'text'" }],
        isError: true,
      };
    }
    if (typeof text !== "string" || text.length === 0) {
      return {
        content: [{ type: "text" as const, text: "Error: 'text' must be a non-empty string" }],
        isError: true,
      };
    }

    const startedAt = Date.now();
    if (signal?.aborted) {
      return this.askResultContent(this.makeLocalAskResult({
        outcome: "cancelled",
        completionSignal: "agentbridge_cancelled",
        startedAt,
        error: "ask_codex request was cancelled before dispatch.",
      }));
    }

    if (!this.askSender || !this.waitCancelSender) {
      this.log("No ask_codex sender registered");
      return this.askResultContent(this.makeLocalAskResult({
        outcome: "bridge_error",
        completionSignal: "agentbridge_error",
        startedAt,
        error: "bridge not initialized, cannot ask Codex.",
      }));
    }

    const timeoutMs = this.clampAskCodexTimeout(args?.timeout_ms);
    const bridgeMsg: BridgeMessage = {
      id: (args?.chat_id as string) ?? `ask_${Date.now()}`,
      source: "claude",
      content: text,
      timestamp: startedAt,
    };

    let handle: AskCodexWaitHandle;
    try {
      handle = this.askSender(bridgeMsg, timeoutMs);
    } catch (err: any) {
      return this.askResultContent(this.makeLocalAskResult({
        outcome: "bridge_error",
        completionSignal: "agentbridge_error",
        startedAt,
        error: `Failed to send ask_codex request: ${err.message}`,
      }));
    }

    const onAbort = () => {
      this.waitCancelSender?.(handle.requestId, "abort_signal");
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const result = await handle.result;
      return this.askResultContent(result);
    } catch (err: any) {
      return this.askResultContent(this.makeLocalAskResult({
        requestId: handle.requestId,
        outcome: "bridge_error",
        completionSignal: "agentbridge_error",
        startedAt,
        error: `ask_codex failed: ${err.message}`,
      }));
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }

  private clampAskCodexTimeout(value: unknown): number {
    const numericValue = typeof value === "number" && Number.isFinite(value)
      ? value
      : ASK_CODEX_DEFAULT_TIMEOUT_MS;
    return Math.min(
      ASK_CODEX_MAX_TIMEOUT_MS,
      Math.max(ASK_CODEX_MIN_TIMEOUT_MS, numericValue),
    );
  }

  private askResultContent(result: AskCodexResult): { content: Array<{ type: "text"; text: string }> } {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(this.normalizeAskResult(result)),
        },
      ],
    };
  }

  private normalizeAskResult(result: AskCodexResult): AskCodexResult {
    const metadata = { ...(result.metadata as Record<string, unknown>) };
    delete metadata.requireReply;

    return {
      ...result,
      metadata: {
        ...metadata,
        taskId: null,
      },
    } as AskCodexResult;
  }

  private makeLocalAskResult(args: {
    requestId?: string;
    outcome: AskCodexOutcome;
    completionSignal: AskCodexCompletionSignal;
    startedAt: number;
    error?: string;
  }): AskCodexResult {
    const completedAt = Date.now();
    return {
      outcome: args.outcome,
      messages: [],
      completionSignal: args.completionSignal,
      metadata: {
        ...(args.requestId ? { requestId: args.requestId } : {}),
        chat_id: null,
        turn_id: null,
        taskId: null,
        started_at: args.startedAt,
        completed_at: completedAt,
        elapsed_ms: completedAt - args.startedAt,
        timed_out_at: null,
        message_count: 0,
        post_timeout_delivery: null,
        ...(args.error ? { error: args.error } : {}),
      },
    };
  }

  private log(msg: string) {
    const line = `[${new Date().toISOString()}] [ClaudeAdapter] ${msg}\n`;
    process.stderr.write(line);
    try {
      appendFileSync(this.logFile, line);
    } catch {}
  }
}
