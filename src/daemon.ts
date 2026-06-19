#!/usr/bin/env bun

import { appendFileSync } from "node:fs";
import type { ServerWebSocket } from "bun";
import { CodexAdapter } from "./codex-adapter";
import {
  BRIDGE_CONTRACT_REMINDER,
  REPLY_REQUIRED_INSTRUCTION,
  StatusBuffer,
  classifyMessage,
  type FilterMode,
} from "./message-filter";
import { TuiConnectionState } from "./tui-connection-state";
import { DaemonLifecycle } from "./daemon-lifecycle";
import { channelEnvFromProcessEnv } from "./channel-profile";
import { StateDirResolver } from "./state-dir";
import { ConfigService } from "./config-service";
import { CLOSE_CODE_REPLACED } from "./control-protocol";
import type {
  AskCodexCompletionSignal,
  AskCodexOutcome,
  AskCodexResult,
  ControlClientMessage,
  ControlServerMessage,
  DaemonFinalizeSource,
  DaemonStatus,
} from "./control-protocol";
import type { BridgeMessage } from "./types";

interface ControlSocketData {
  clientId: number;
  attached: boolean;
}

interface ActiveWaiter {
  requestId: string;
  ws: ServerWebSocket<ControlSocketData>;
  message: BridgeMessage;
  startedAt: number;
  timeoutMs: number;
  timeoutTimer: ReturnType<typeof setTimeout>;
  messages: BridgeMessage[];
  waiterOwnsReplyRequired: boolean;
}

const stateDir = new StateDirResolver();
stateDir.ensure();
const configService = new ConfigService();
const config = configService.loadOrDefault();

const CODEX_APP_PORT = parseInt(process.env.CODEX_WS_PORT ?? String(config.codex.appPort), 10);
const CODEX_PROXY_PORT = parseInt(process.env.CODEX_PROXY_PORT ?? String(config.codex.proxyPort), 10);
const CONTROL_PORT = parseInt(process.env.AGENTBRIDGE_CONTROL_PORT ?? "4502", 10);
const TUI_DISCONNECT_GRACE_MS = parseInt(process.env.TUI_DISCONNECT_GRACE_MS ?? "2500", 10);
const CLAUDE_DISCONNECT_GRACE_MS = 5_000;
const MAX_BUFFERED_MESSAGES = parseInt(process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES ?? "100", 10);
const FILTER_MODE: FilterMode =
  (process.env.AGENTBRIDGE_FILTER_MODE as FilterMode) === "full" ? "full" : "filtered";
const IDLE_SHUTDOWN_MS = parseInt(process.env.AGENTBRIDGE_IDLE_SHUTDOWN_MS ?? String(config.idleShutdownSeconds * 1000), 10);
const ATTENTION_WINDOW_MS = parseInt(process.env.AGENTBRIDGE_ATTENTION_WINDOW_MS ?? String(config.turnCoordination.attentionWindowSeconds * 1000), 10);
const PROTOCOL_VERSION = 1;

const daemonLifecycle = new DaemonLifecycle({ stateDir, controlPort: CONTROL_PORT, log });

// PR3: bind the channel profile env explicitly onto the codex app-server spawn
// (design §2 — CODEX_HOME is the only real isolation). default → undefined → legacy.
const codex = new CodexAdapter(CODEX_APP_PORT, CODEX_PROXY_PORT, stateDir.logFile, {
  channelEnv: channelEnvFromProcessEnv(),
});
const attachCmd = `codex --enable tui_app_server --remote ${codex.proxyUrl}`;

let controlServer: ReturnType<typeof Bun.serve> | null = null;
let attachedClaude: ServerWebSocket<ControlSocketData> | null = null;
let nextControlClientId = 0;
let nextSystemMessageId = 0;
let codexBootstrapped = false;
let attentionWindowTimer: ReturnType<typeof setTimeout> | null = null;
let inAttentionWindow = false;
let replyRequired = false;
let replyReceivedDuringTurn = false;
let activeWaiter: ActiveWaiter | null = null;
let shuttingDown = false;
let idleShutdownTimer: ReturnType<typeof setTimeout> | null = null;
let claudeDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
let claudeOnlineNoticeSent = false;
let claudeOfflineNoticeShown = false;
let lastAttachStatusSentTs = 0;
const ATTACH_STATUS_COOLDOWN_MS = 30_000; // Don't re-send status on rapid reattach

const bufferedMessages: BridgeMessage[] = [];

const tuiConnectionState = new TuiConnectionState({
  disconnectGraceMs: TUI_DISCONNECT_GRACE_MS,
  log,
  onDisconnectPersisted: (connId) => {
    emitToClaude(
      systemMessage(
        "system_tui_disconnected",
        `⚠️ Codex TUI disconnected (conn #${connId}). Codex is still running in the background — reconnect the TUI to resume.`,
      ),
    );
  },
  onReconnectAfterNotice: (connId) => {
    emitToClaude(
      systemMessage(
        "system_tui_reconnected",
        `✅ Codex TUI reconnected (conn #${connId}). Bridge restored, communication can continue.`,
      ),
    );
    codex.injectMessage("✅ Claude Code is still online, bridge restored. Bidirectional communication can continue.");
  },
});

const statusBuffer = new StatusBuffer((summary) => emitToClaude(summary));

codex.on("turnStarted", () => {
  log("Codex turn started");
  if (activeWaiter) {
    log(`Suppressing system_turn_started during active waiter ${activeWaiter.requestId}`);
    return;
  }
  emitToClaude(
    systemMessage(
      "system_turn_started",
      "⏳ Codex is working on the current turn. Do not interleave reply or get_messages polling; wait for the owning tool result or normal completion routing.",
    ),
  );
});

codex.on("agentMessage", (msg: BridgeMessage) => {
  if (msg.source !== "codex") return;
  if (activeWaiter) {
    log(`Codex → waiter ${activeWaiter.requestId} (${msg.content.length} chars)`);
    activeWaiter.messages.push(msg);
    if (activeWaiter.waiterOwnsReplyRequired) {
      replyReceivedDuringTurn = true;
    }
    return;
  }

  const result = classifyMessage(msg.content, FILTER_MODE);

  // When replyRequired is active, force-forward ALL messages regardless of marker
  if (replyRequired) {
    log(`Codex → Claude [${result.marker}/force-forward-reply-required] (${msg.content.length} chars)`);
    replyReceivedDuringTurn = true;
    if (statusBuffer.size > 0) {
      statusBuffer.flush("reply-required message arrived");
    }
    emitToClaude(msg);
    return;
  }

  // During attention window, suppress STATUS to give Claude space to respond
  if (inAttentionWindow && result.marker === "status") {
    log(`Codex → Claude [${result.marker}/buffer-attention] (${msg.content.length} chars)`);
    statusBuffer.add(msg);
    return;
  }

  log(`Codex → Claude [${result.marker}/${result.action}] (${msg.content.length} chars)`);
  switch (result.action) {
    case "forward":
      if (result.marker === "important" && statusBuffer.size > 0) {
        statusBuffer.flush("important message arrived");
      }
      emitToClaude(msg);
      // IMPORTANT message — give Claude an attention window to respond
      if (result.marker === "important") {
        startAttentionWindow();
      }
      break;
    case "buffer":
      statusBuffer.add(msg);
      break;
    case "drop":
      break;
  }
});

codex.on("turnCompleted", () => {
  log("Codex turn completed");
  if (activeWaiter) {
    finalizeWaiter(activeWaiter.requestId, "turn_completed");
    return;
  }

  statusBuffer.flush("turn completed");

  // Check if reply was required but Codex didn't send any agentMessage
  if (replyRequired && !replyReceivedDuringTurn) {
    log("⚠️ Reply was required but Codex did not send any agentMessage");
    emitToClaude(
      systemMessage(
        "system_reply_missing",
        "⚠️ Codex completed an injected turn without any agentMessage (require_reply was set). Do not retry automatically; ask the user before re-sending, and use ask_codex for tasks needing a result.",
      ),
    );
  }

  // Reset reply-required state
  replyRequired = false;
  replyReceivedDuringTurn = false;

  emitToClaude(
    systemMessage(
      "system_turn_completed",
      "✅ Codex finished the current turn. Use ask_codex for follow-up tasks that need a result; use reply only for one-way notifications.",
    ),
  );
  startAttentionWindow();
});

codex.on("ready", (threadId: string) => {
  tuiConnectionState.markBridgeReady();
  log(`Codex ready — thread ${threadId}`);
  log("Bridge fully operational");

  emitToClaude(
    systemMessage("system_ready", currentReadyMessage()),
  );

  if (attachedClaude && shouldNotifyCodexClaudeOnline()) {
    notifyCodexClaudeOnline();
  }
});

codex.on("tuiConnected", (connId: number) => {
  tuiConnectionState.handleTuiConnected(connId);
  cancelIdleShutdown();
  log(`Codex TUI connected (conn #${connId})`);
  broadcastStatus();
});

codex.on("tuiDisconnected", (connId: number) => {
  tuiConnectionState.handleTuiDisconnected(connId);
  log(`Codex TUI disconnected (conn #${connId})`);
  broadcastStatus();
  scheduleIdleShutdown();
});

codex.on("error", (err: Error) => {
  log(`Codex error: ${err.message}`);
});

codex.on("exit", (code: number | null) => {
  log(`Codex process exited (code ${code})`);
  if (activeWaiter) {
    finalizeWaiter(activeWaiter.requestId, "daemon_error", `Codex app-server exited (code ${code ?? "unknown"}).`);
  }
  codexBootstrapped = false;
  statusBuffer.flush("codex exited");
  tuiConnectionState.handleCodexExit();
  clearPendingClaudeDisconnect("Codex process exited");
  claudeOnlineNoticeSent = false;
  claudeOfflineNoticeShown = false;
  emitToClaude(
    systemMessage(
      "system_codex_exit",
      `⚠️ Codex app-server exited (code ${code ?? "unknown"}). AgentBridge daemon is still running, but the Codex side needs to be restarted.`,
    ),
  );
  broadcastStatus();
});

function startControlServer() {
  controlServer = Bun.serve({
    port: CONTROL_PORT,
    hostname: "127.0.0.1",
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/healthz") {
        return Response.json(currentStatus());
      }

      if (url.pathname === "/readyz") {
        return Response.json(currentStatus(), { status: codexBootstrapped ? 200 : 503 });
      }

      if (url.pathname === "/ws" && server.upgrade(req, { data: { clientId: 0, attached: false } })) {
        return undefined;
      }

      return new Response("AgentBridge daemon");
    },
    websocket: {
      idleTimeout: 960, // 16 minutes — prevent premature idle disconnects
      sendPings: true,
      open: (ws: ServerWebSocket<ControlSocketData>) => {
        ws.data.clientId = ++nextControlClientId;
        log(`Frontend socket opened (#${ws.data.clientId})`);
      },
      close: (ws: ServerWebSocket<ControlSocketData>, code: number, reason: string) => {
        log(`Frontend socket closed (#${ws.data.clientId}, code=${code}, reason=${reason || "none"}, wasAttached=${attachedClaude === ws})`);
        if (attachedClaude === ws) {
          detachClaude(ws, "frontend socket closed", "ws_close");
        }
      },
      message: (ws: ServerWebSocket<ControlSocketData>, raw) => {
        handleControlMessage(ws, raw);
      },
    },
  });
}

function handleControlMessage(ws: ServerWebSocket<ControlSocketData>, raw: string | Buffer) {
  let parsed: unknown;
  try {
    const text = typeof raw === "string" ? raw : raw.toString();
    parsed = JSON.parse(text);
  } catch (e: any) {
    log(`Failed to parse control message: ${e.message}`);
    return;
  }

  if (!isControlMessageObject(parsed)) {
    log(`Rejecting malformed control message (${describeMalformedPayload(parsed)})`);
    return;
  }

  const message = parsed as ControlClientMessage;

  switch (message.type) {
    case "claude_connect":
      attachClaude(ws);
      return;
    case "claude_disconnect":
      detachClaude(ws, "frontend requested disconnect", "claude_disconnect");
      return;
    case "status":
      sendStatus(ws);
      return;
    case "claude_to_codex_wait":
      handleWaitRequest(ws, message);
      return;
    case "claude_to_codex_wait_cancel":
      handleWaitCancel(message.requestId, message.reason);
      return;
    case "claude_to_codex": {
      if (message.message.source !== "claude") {
        sendProtocolMessage(ws, {
          type: "claude_to_codex_result",
          requestId: message.requestId,
          success: false,
          error: "Invalid message source",
        });
        return;
      }

      if (!tuiConnectionState.canReply()) {
        sendProtocolMessage(ws, {
          type: "claude_to_codex_result",
          requestId: message.requestId,
          success: false,
          error: "Codex is not ready. Wait for TUI to connect and create a thread.",
        });
        return;
      }

      const requireReply = !!message.requireReply;
      let contentWithReminder = message.message.content + "\n\n" + BRIDGE_CONTRACT_REMINDER;
      if (requireReply) {
        contentWithReminder += REPLY_REQUIRED_INSTRUCTION;
        replyRequired = true;
        replyReceivedDuringTurn = false;
        log(`Reply required flag set for this message`);
      }
      log(`Forwarding Claude → Codex (${message.message.content.length} chars, requireReply=${requireReply})`);
      const injected = codex.injectMessage(contentWithReminder);
      if (!injected) {
        const reason = codex.turnInProgress
          ? "Codex is busy executing a turn. Wait for it to finish before sending another message."
          : "Injection failed: no active thread or WebSocket not connected.";
        log(`Injection rejected: ${reason}`);
        sendProtocolMessage(ws, {
          type: "claude_to_codex_result",
          requestId: message.requestId,
          success: false,
          error: reason,
        });
        return;
      }
      clearAttentionWindow(); // Claude successfully replied, end attention window
      sendProtocolMessage(ws, {
        type: "claude_to_codex_result",
        requestId: message.requestId,
        success: true,
      });
      return;
    }
    default: {
      const unknownMessage = message as unknown as { type?: unknown; requestId?: unknown };
      const type = unknownMessage.type;
      const requestId = unknownMessage.requestId;
      log(`Received unknown control message type: ${type ?? "<missing>"} (requestId=${requestId ?? "n/a"})`);
      if (typeof requestId === "string") {
        sendProtocolMessage(ws, {
          type: "protocol_error",
          requestId,
          error: `Unsupported message type: ${type ?? "<missing>"}`,
        });
      }
      return;
    }
  }
}

function isControlMessageObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

function describeMalformedPayload(value: unknown): string {
  let payload = "";
  try {
    payload = JSON.stringify(value);
  } catch {
    payload = "<unserializable>";
  }
  return `type=${typeof value}, payload=${String(payload).slice(0, 200)}`;
}

function handleWaitRequest(
  ws: ServerWebSocket<ControlSocketData>,
  message: Extract<ControlClientMessage, { type: "claude_to_codex_wait" }>,
) {
  const startedAt = Date.now();

  if (message.message.source !== "claude") {
    sendWaitResult(ws, {
      requestId: message.requestId,
      outcome: "bridge_error",
      messages: [],
      completionSignal: "agentbridge_error",
      metadata: baseWaitMetadata(message.requestId, startedAt, Date.now(), 0, {
        error: "Invalid message source",
      }),
    });
    return;
  }

  if (activeWaiter) {
    log(`Rejecting wait ${message.requestId}: active waiter ${activeWaiter.requestId} is already running`);
    const completedAt = Date.now();
    sendWaitResult(ws, {
      requestId: message.requestId,
      outcome: "busy",
      messages: [],
      completionSignal: "agentbridge_busy",
      metadata: baseWaitMetadata(message.requestId, startedAt, completedAt, 0, {
        active_request_id: activeWaiter.requestId,
        retry_after_ms: 30000,
      }),
    });
    return;
  }

  if (!tuiConnectionState.canReply()) {
    sendWaitResult(ws, {
      requestId: message.requestId,
      outcome: "bridge_error",
      messages: [],
      completionSignal: "agentbridge_error",
      metadata: baseWaitMetadata(message.requestId, startedAt, Date.now(), 0, {
        error: "Codex is not ready. Wait for TUI to connect and create a thread.",
      }),
    });
    return;
  }

  const timeoutMs = Math.max(0, Math.trunc(message.timeoutMs));
  const waiterOwnsReplyRequired = message.requireReply === true && !replyRequired;
  if (waiterOwnsReplyRequired) {
    replyRequired = true;
    replyReceivedDuringTurn = false;
    log(`Reply required flag set for wait ${message.requestId}`);
  }

  const timeoutTimer = setTimeout(() => {
    finalizeWaiter(message.requestId, "timeout");
  }, timeoutMs);

  activeWaiter = {
    requestId: message.requestId,
    ws,
    message: message.message,
    startedAt,
    timeoutMs,
    timeoutTimer,
    messages: [],
    waiterOwnsReplyRequired,
  };

  const contentWithReminder = `${message.message.content}\n\n${BRIDGE_CONTRACT_REMINDER}${REPLY_REQUIRED_INSTRUCTION}`;
  log(`Forwarding Claude → Codex wait ${message.requestId} (${message.message.content.length} chars, timeoutMs=${timeoutMs})`);
  const injected = codex.injectMessage(contentWithReminder);
  if (!injected) {
    const reason = codex.turnInProgress
      ? "Codex is busy executing a turn. Wait for it to finish before sending another message."
      : "Injection failed: no active thread or WebSocket not connected.";
    log(`Wait injection rejected: ${reason}`);
    finalizeWaiter(message.requestId, "inject_failed", reason);
    return;
  }

  clearAttentionWindow();
}

function handleWaitCancel(requestId: string, reason: string) {
  if (!activeWaiter || activeWaiter.requestId !== requestId) {
    log(`wait_cancel for unknown requestId=${requestId}; ignoring (likely race with prior finalize)`);
    return;
  }

  finalizeWaiter(requestId, "client_cancel", `Wait cancelled: ${reason}`);
}

function finalizeWaiter(requestId: string, source: DaemonFinalizeSource, error?: string): boolean {
  if (!activeWaiter || activeWaiter.requestId !== requestId) {
    log(`finalizeWaiter(${requestId}, source=${source}) no-op`);
    return false;
  }

  const waiter = activeWaiter;
  clearTimeout(waiter.timeoutTimer);
  activeWaiter = null;

  if (waiter.waiterOwnsReplyRequired) {
    replyRequired = false;
    replyReceivedDuringTurn = false;
  }

  const completedAt = Date.now();
  log(`finalizeWaiter(${requestId}, source=${source})`);
  sendWaitResult(waiter.ws, buildWaitResult(waiter, source, completedAt, error));
  return true;
}

function buildWaitResult(
  waiter: ActiveWaiter,
  source: DaemonFinalizeSource,
  completedAt: number,
  error?: string,
): AskCodexResult & { requestId: string } {
  let outcome: AskCodexOutcome;
  let completionSignal: AskCodexCompletionSignal;
  let extraMetadata: Partial<AskCodexResult["metadata"]> = {};

  switch (source) {
    case "turn_completed":
      outcome = "turn_completed";
      completionSignal = "codex_app_server_turn_completed";
      break;
    case "timeout":
      outcome = "timeout";
      completionSignal = "agentbridge_timeout";
      extraMetadata = {
        timed_out_at: completedAt,
        post_timeout_delivery: "normal_agentbridge_routing",
      };
      break;
    case "client_cancel":
      outcome = "cancelled";
      completionSignal = "agentbridge_cancelled";
      extraMetadata = { error: error ?? "Wait cancelled." };
      break;
    case "inject_failed":
    case "ws_close":
    case "claude_disconnect":
    case "daemon_error":
      outcome = "bridge_error";
      completionSignal = "agentbridge_error";
      extraMetadata = { error: error ?? `Wait finalized due to ${source}.` };
      break;
  }

  return {
    requestId: waiter.requestId,
    outcome,
    messages: [...waiter.messages],
    completionSignal,
    metadata: baseWaitMetadata(
      waiter.requestId,
      waiter.startedAt,
      completedAt,
      waiter.messages.length,
      extraMetadata,
    ),
  };
}

function baseWaitMetadata(
  requestId: string,
  startedAt: number,
  completedAt: number,
  messageCount: number,
  extra: Partial<AskCodexResult["metadata"]> = {},
): AskCodexResult["metadata"] {
  return {
    requestId,
    chat_id: null,
    turn_id: null,
    taskId: null,
    started_at: startedAt,
    completed_at: completedAt,
    elapsed_ms: completedAt - startedAt,
    timed_out_at: null,
    message_count: messageCount,
    post_timeout_delivery: null,
    ...extra,
  };
}

function sendWaitResult(
  ws: ServerWebSocket<ControlSocketData>,
  result: AskCodexResult & { requestId: string },
) {
  sendProtocolMessage(ws, {
    type: "codex_to_claude_wait_result",
    requestId: result.requestId,
    outcome: result.outcome,
    messages: result.messages,
    completionSignal: result.completionSignal,
    metadata: result.metadata,
  });
}

function attachClaude(ws: ServerWebSocket<ControlSocketData>) {
  if (attachedClaude && attachedClaude !== ws && attachedClaude.readyState !== WebSocket.CLOSED) {
    // Reject the new connection — don't disrupt the existing active session.
    // Check !== CLOSED (not === OPEN) so that CLOSING state is also treated as
    // "slot occupied", preventing a race where a new session slips in before
    // the old one finishes its close handshake.
    log(`Rejecting Claude frontend #${ws.data.clientId} — another session (#${attachedClaude.data.clientId}) is already attached (readyState=${attachedClaude.readyState})`);
    ws.close(CLOSE_CODE_REPLACED, "another Claude session is already connected");
    return;
  }

  clearPendingClaudeDisconnect("Claude frontend attached");
  attachedClaude = ws;
  ws.data.attached = true;
  cancelIdleShutdown();
  log(`Claude frontend attached (#${ws.data.clientId})`);

  statusBuffer.flush("claude reconnected");
  sendStatus(ws);

  const now = Date.now();
  const isRapidReattach = now - lastAttachStatusSentTs < ATTACH_STATUS_COOLDOWN_MS;

  if (bufferedMessages.length > 0) {
    flushBufferedMessages(ws);
  } else if (!isRapidReattach) {
    // Only send status messages if this is not a rapid reattach (avoid flooding Claude)
    if (tuiConnectionState.canReply()) {
      sendBridgeMessage(ws, systemMessage("system_ready", currentReadyMessage()));
    } else if (codexBootstrapped) {
      sendBridgeMessage(ws, systemMessage("system_waiting", currentWaitingMessage()));
    }
  }

  lastAttachStatusSentTs = now;

  if (tuiConnectionState.canReply() && shouldNotifyCodexClaudeOnline()) {
    notifyCodexClaudeOnline();
  }
}

function detachClaude(ws: ServerWebSocket<ControlSocketData>, reason: string, finalizeSource: Extract<DaemonFinalizeSource, "ws_close" | "claude_disconnect">) {
  if (attachedClaude !== ws) return;

  if (activeWaiter?.ws === ws) {
    finalizeWaiter(activeWaiter.requestId, finalizeSource, `Claude frontend detached: ${reason}.`);
  }

  attachedClaude = null;
  ws.data.attached = false;
  log(`Claude frontend detached (#${ws.data.clientId}, ${reason})`);

  scheduleClaudeDisconnectNotification(ws.data.clientId);

  scheduleIdleShutdown();
}

function startAttentionWindow() {
  clearAttentionWindow();
  inAttentionWindow = true;
  statusBuffer.pause();
  log(`Attention window started (${ATTENTION_WINDOW_MS}ms)`);
  attentionWindowTimer = setTimeout(() => {
    attentionWindowTimer = null;
    inAttentionWindow = false;
    statusBuffer.resume();
    log("Attention window ended");
  }, ATTENTION_WINDOW_MS);
}

function clearAttentionWindow() {
  if (attentionWindowTimer) {
    clearTimeout(attentionWindowTimer);
    attentionWindowTimer = null;
  }
  if (inAttentionWindow) {
    statusBuffer.resume();
  }
  inAttentionWindow = false;
}

function scheduleIdleShutdown() {
  cancelIdleShutdown();
  if (attachedClaude) return; // still has a client

  const snapshot = tuiConnectionState.snapshot();
  if (snapshot.tuiConnected) return; // TUI still connected

  log(`No clients connected. Daemon will shut down in ${IDLE_SHUTDOWN_MS}ms if no one reconnects.`);
  idleShutdownTimer = setTimeout(() => {
    // Re-check before shutting down
    if (attachedClaude || tuiConnectionState.snapshot().tuiConnected) {
      log("Idle shutdown cancelled: client reconnected during grace period");
      return;
    }
    shutdown("idle — no clients connected");
  }, IDLE_SHUTDOWN_MS);
}

function cancelIdleShutdown() {
  if (idleShutdownTimer) {
    clearTimeout(idleShutdownTimer);
    idleShutdownTimer = null;
  }
}

function clearPendingClaudeDisconnect(reason?: string) {
  if (!claudeDisconnectTimer) return;
  clearTimeout(claudeDisconnectTimer);
  claudeDisconnectTimer = null;
  if (reason) {
    log(`Cleared pending Claude disconnect notification (${reason})`);
  }
}

function scheduleClaudeDisconnectNotification(clientId: number) {
  clearPendingClaudeDisconnect("rescheduled");
  claudeDisconnectTimer = setTimeout(() => {
    claudeDisconnectTimer = null;

    if (attachedClaude) {
      log(
        `Skipping Claude disconnect notification for client #${clientId} because Claude already reconnected`,
      );
      return;
    }

    if (!tuiConnectionState.canReply()) {
      log(
        `Suppressing Claude disconnect notification for client #${clientId} because Codex cannot reply`,
      );
      return;
    }

    if (!claudeOnlineNoticeSent) {
      log(
        `Suppressing Claude disconnect notification for client #${clientId} because Claude was never announced online`,
      );
      return;
    }

    codex.injectMessage(
      "⚠️ Claude Code went offline. AgentBridge is still running in the background; it will reconnect automatically when Claude reopens.",
    );
    claudeOnlineNoticeSent = false;
    claudeOfflineNoticeShown = true;
    log(`Claude disconnect persisted past grace window (client #${clientId})`);
  }, CLAUDE_DISCONNECT_GRACE_MS);
}

function emitToClaude(message: BridgeMessage) {
  if (attachedClaude && attachedClaude.readyState === WebSocket.OPEN) {
    if (trySendBridgeMessage(attachedClaude, message)) return;
    // Send failed — fall through to buffer
    log("Send to Claude failed, buffering message for retry on reconnect");
  }

  bufferedMessages.push(message);
  if (bufferedMessages.length > MAX_BUFFERED_MESSAGES) {
    const dropped = bufferedMessages.length - MAX_BUFFERED_MESSAGES;
    bufferedMessages.splice(0, dropped);
    log(`Message buffer overflow: dropped ${dropped} oldest message(s), ${MAX_BUFFERED_MESSAGES} remaining`);
  }
}

function trySendBridgeMessage(ws: ServerWebSocket<ControlSocketData>, message: BridgeMessage): boolean {
  try {
    const result = ws.send(JSON.stringify({ type: "codex_to_claude", message } satisfies ControlServerMessage));
    if (typeof result === "number" && result <= 0) {
      log(`Bridge message send returned ${result} (0=dropped, -1=backpressure)`);
      return false;
    }
    return true;
  } catch (err: any) {
    log(`Failed to send bridge message: ${err.message}`);
    return false;
  }
}

function flushBufferedMessages(ws: ServerWebSocket<ControlSocketData>) {
  const messages = bufferedMessages.splice(0, bufferedMessages.length);
  for (const message of messages) {
    if (!trySendBridgeMessage(ws, message)) {
      // Re-buffer this and all remaining messages on failure
      const failedIndex = messages.indexOf(message);
      const remaining = messages.slice(failedIndex);
      bufferedMessages.unshift(...remaining);
      log(`Flush interrupted: re-buffered ${remaining.length} message(s) after send failure`);
      return;
    }
  }
}

function sendBridgeMessage(ws: ServerWebSocket<ControlSocketData>, message: BridgeMessage) {
  trySendBridgeMessage(ws, message);
}

function sendStatus(ws: ServerWebSocket<ControlSocketData>) {
  sendProtocolMessage(ws, { type: "status", status: currentStatus() });
}

function broadcastStatus() {
  if (!attachedClaude) return;
  sendStatus(attachedClaude);
}

function sendProtocolMessage(ws: ServerWebSocket<ControlSocketData>, message: ControlServerMessage) {
  try {
    ws.send(JSON.stringify(message));
  } catch (err: any) {
    log(`Failed to send control message: ${err.message}`);
  }
}

function currentStatus(): DaemonStatus {
  const snapshot = tuiConnectionState.snapshot();
  return {
    protocolVersion: PROTOCOL_VERSION,
    bridgeReady: tuiConnectionState.canReply(),
    tuiConnected: snapshot.tuiConnected,
    threadId: codex.activeThreadId,
    queuedMessageCount: bufferedMessages.length + statusBuffer.size,
    proxyUrl: codex.proxyUrl,
    appServerUrl: codex.appServerUrl,
    pid: process.pid,
  };
}

function currentWaitingMessage() {
  return `⏳ Waiting for Codex TUI to connect. Run in another terminal:\n${attachCmd}`;
}

function currentReadyMessage() {
  return `✅ Codex TUI connected (${codex.activeThreadId}). Bridge ready.`;
}

function notifyCodexClaudeOnline() {
  claudeOnlineNoticeSent = true;
  claudeOfflineNoticeShown = false;
  codex.injectMessage("✅ AgentBridge connected to Claude Code.");
}

function shouldNotifyCodexClaudeOnline() {
  return !claudeOnlineNoticeSent || claudeOfflineNoticeShown;
}

function systemMessage(idPrefix: string, content: string): BridgeMessage {
  return {
    id: `${idPrefix}_${++nextSystemMessageId}`,
    source: "codex",
    content,
    timestamp: Date.now(),
  };
}

function writePidFile() {
  daemonLifecycle.writePid();
}

function removePidFile() {
  daemonLifecycle.removePidFile();
}

function writeStatusFile() {
  daemonLifecycle.writeStatus({
    proxyUrl: codex.proxyUrl,
    appServerUrl: codex.appServerUrl,
    controlPort: CONTROL_PORT,
    pid: process.pid,
  });
}

function removeStatusFile() {
  daemonLifecycle.removeStatusFile();
}

async function bootCodex() {
  log("Starting AgentBridge daemon...");
  log(`Codex app-server: ${codex.appServerUrl}`);
  log(`Codex proxy: ${codex.proxyUrl}`);
  log(`Control server: ws://127.0.0.1:${CONTROL_PORT}/ws`);

  try {
    await codex.start();
    codexBootstrapped = true;
    writeStatusFile();

    emitToClaude(systemMessage("system_waiting", currentWaitingMessage()));
    broadcastStatus();
  } catch (err: any) {
    log(`Failed to start Codex: ${err.message}`);
    emitToClaude(
      systemMessage(
        "system_codex_start_failed",
        `❌ AgentBridge failed to start Codex app-server: ${err.message}`,
      ),
    );
    broadcastStatus();
  }
}

function shutdown(reason: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`Shutting down daemon (${reason})...`);
  tuiConnectionState.dispose(`daemon shutdown (${reason})`);
  clearPendingClaudeDisconnect(`daemon shutdown (${reason})`);
  controlServer?.stop();
  controlServer = null;
  codex.stop();
  removePidFile();
  removeStatusFile();
  process.exit(0);
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] [AgentBridgeDaemon] ${msg}\n`;
  process.stderr.write(line);
  try {
    appendFileSync(stateDir.logFile, line);
  } catch {}
}

const originalInjectMessage = codex.injectMessage.bind(codex);

export const __daemonTest = {
  handleControlMessage,
  emitAgentMessage(content: string, id = `test_msg_${Date.now()}`) {
    codex.emit("agentMessage", {
      id,
      source: "codex",
      content,
      timestamp: Date.now(),
    } satisfies BridgeMessage);
  },
  emitTurnStarted() {
    codex.emit("turnStarted");
  },
  emitTurnCompleted() {
    codex.emit("turnCompleted");
  },
  emitCodexExit(code: number | null = 1) {
    codex.emit("exit", code);
  },
  setCodexReady() {
    tuiConnectionState.markBridgeReady();
    tuiConnectionState.handleTuiConnected(1);
  },
  setInjectMessage(fn: (text: string) => boolean) {
    codex.injectMessage = fn as typeof codex.injectMessage;
  },
  setTurnInProgress(value: boolean) {
    codex.turnInProgress = value;
  },
  setReplyRequiredState(required: boolean, received: boolean) {
    replyRequired = required;
    replyReceivedDuringTurn = received;
  },
  getReplyRequiredState() {
    return { replyRequired, replyReceivedDuringTurn };
  },
  getActiveWaiter() {
    return activeWaiter;
  },
  getBufferedMessages() {
    return [...bufferedMessages];
  },
  getStatusBufferSize() {
    return statusBuffer.size;
  },
  detachClaudeForTest(
    ws: ServerWebSocket<ControlSocketData>,
    reason: string,
    source: Extract<DaemonFinalizeSource, "ws_close" | "claude_disconnect">,
  ) {
    detachClaude(ws, reason, source);
  },
  finalizeWaiterForTest(requestId: string, source: DaemonFinalizeSource, error?: string) {
    return finalizeWaiter(requestId, source, error);
  },
  reset() {
    if (activeWaiter) {
      clearTimeout(activeWaiter.timeoutTimer);
      activeWaiter = null;
    }
    clearAttentionWindow();
    clearPendingClaudeDisconnect("test reset");
    cancelIdleShutdown();
    statusBuffer.dispose();
    bufferedMessages.splice(0, bufferedMessages.length);
    attachedClaude = null;
    replyRequired = false;
    replyReceivedDuringTurn = false;
    codexBootstrapped = false;
    claudeOnlineNoticeSent = false;
    claudeOfflineNoticeShown = false;
    lastAttachStatusSentTs = 0;
    tuiConnectionState.handleCodexExit();
    codex.turnInProgress = false;
    codex.injectMessage = originalInjectMessage as typeof codex.injectMessage;
  },
};

function startDaemon() {
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("exit", () => { removePidFile(); removeStatusFile(); });
  process.on("uncaughtException", (err) => {
    log(`UNCAUGHT EXCEPTION: ${err.stack ?? err.message}`);
  });
  process.on("unhandledRejection", (reason: any) => {
    log(`UNHANDLED REJECTION: ${reason?.stack ?? reason}`);
  });

  // Refuse to start if user intentionally killed the daemon.
  // This prevents stale auto-reconnect loops from relaunching us.
  // Only `agentbridge codex` / `ensureRunning` clears the sentinel before launching.
  if (daemonLifecycle.wasKilled()) {
    log("Killed sentinel found — daemon was intentionally stopped. Exiting immediately.");
    process.exit(0);
  }

  writePidFile();
  startControlServer();
  void bootCodex();
}

if (import.meta.main) {
  startDaemon();
}
