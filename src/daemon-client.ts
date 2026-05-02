import { EventEmitter } from "node:events";
import type { BridgeMessage } from "./types";
import { CLOSE_CODE_REPLACED } from "./control-protocol";
import type {
  AskCodexCompletionSignal,
  AskCodexOutcome,
  AskCodexResult,
  ControlClientMessage,
  ControlServerMessage,
  DaemonClientFinalizeSource,
  DaemonStatus,
} from "./control-protocol";

interface DaemonClientEvents {
  codexMessage: [BridgeMessage];
  disconnect: [];
  rejected: [];
  status: [DaemonStatus];
}

let nextSocketId = 0;
const DEFAULT_WAIT_RESULT_GRACE_MS = 30000;

interface DaemonClientOptions {
  waitResultGraceMs?: number;
}

interface PendingWait {
  requestId: string;
  message: BridgeMessage;
  startedAt: number;
  timeoutMs: number;
  timer: ReturnType<typeof setTimeout>;
  resolve: (value: AskCodexResult) => void;
}

function parsePositiveIntegerMs(value: string | undefined): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export class DaemonClient extends EventEmitter<DaemonClientEvents> {
  private ws: WebSocket | null = null;
  private wsId: number = 0; // Track socket identity for debugging
  private nextRequestId = 1;
  private readonly waitResultGraceMs: number;
  private pendingReplies = new Map<
    string,
    {
      resolve: (value: { success: boolean; error?: string }) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private pendingWaits = new Map<string, PendingWait>();

  constructor(private readonly url: string, options: DaemonClientOptions = {}) {
    super();
    const envWaitResultGraceMs = parsePositiveIntegerMs(process.env.AGENTBRIDGE_WAIT_RESULT_GRACE_MS);
    this.waitResultGraceMs = Math.max(
      0,
      options.waitResultGraceMs ?? envWaitResultGraceMs ?? DEFAULT_WAIT_RESULT_GRACE_MS,
    );
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log(`connect() skipped — ws#${this.wsId} already OPEN`);
      return;
    }

    // Close any lingering socket in non-OPEN state to avoid orphans
    if (this.ws) {
      const state = this.ws.readyState;
      this.log(`connect() closing lingering ws#${this.wsId} (readyState=${state})`);
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    const socketId = ++nextSocketId;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      let settled = false;

      ws.onopen = () => {
        settled = true;
        this.ws = ws;
        this.wsId = socketId;
        this.attachSocketHandlers(ws, socketId);
        this.log(`ws#${socketId} opened and attached`);
        resolve();
      };

      ws.onerror = () => {
        if (settled) return;
        settled = true;
        reject(new Error(`Failed to connect to AgentBridge daemon at ${this.url}`));
      };

      ws.onclose = () => {
        if (settled) return;
        settled = true;
        reject(new Error(`AgentBridge daemon closed the connection during startup (${this.url})`));
      };
    });
  }

  attachClaude() {
    this.send({ type: "claude_connect" });
  }

  async disconnect() {
    if (!this.ws) return;

    const ws = this.ws;
    try {
      this.send({ type: "claude_disconnect" });
    } catch {}

    this.ws = null;
    this.rejectPendingReplies("Daemon connection closed");
    this.rejectPendingWaits("Daemon connection closed", "disconnect");

    try {
      ws.close();
    } catch {}
  }

  async sendReply(message: BridgeMessage, requireReply?: boolean): Promise<{ success: boolean; error?: string }> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, error: "AgentBridge daemon is not connected." };
    }

    const requestId = `reply_${Date.now()}_${this.nextRequestId++}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingReplies.delete(requestId);
        resolve({ success: false, error: "Timed out waiting for AgentBridge daemon reply." });
      }, 15000);

      this.pendingReplies.set(requestId, { resolve, timer });
      this.send({
        type: "claude_to_codex",
        requestId,
        message,
        ...(requireReply ? { requireReply: true } : {}),
      });
    });
  }

  async sendAskCodex(
    message: BridgeMessage,
    timeoutMs: number,
    taskHint?: Record<string, unknown>,
  ): Promise<AskCodexResult> {
    const requestId = `wait_${Date.now()}_${this.nextRequestId++}`;
    const startedAt = Date.now();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return this.makeLocalWaitResult({
        requestId,
        message,
        startedAt,
        outcome: "bridge_error",
        completionSignal: "agentbridge_error",
        error: "AgentBridge daemon is not connected.",
      });
    }

    return new Promise((resolve) => {
      const waitResultTimeoutMs = Math.max(0, timeoutMs) + this.waitResultGraceMs;
      const timer = setTimeout(() => {
        const pending = this.pendingWaits.get(requestId);
        if (!pending) {
          this.finalizePendingWait(requestId, "timeout");
          return;
        }
        this.finalizePendingWait(
          requestId,
          "timeout",
          this.makeLocalWaitResult({
            requestId,
            message: pending.message,
            startedAt: pending.startedAt,
            outcome: "bridge_error",
            completionSignal: "agentbridge_error",
            error: "Timed out waiting for AgentBridge daemon wait_result.",
          }),
        );
      }, waitResultTimeoutMs);

      this.pendingWaits.set(requestId, {
        requestId,
        message,
        startedAt,
        timeoutMs,
        timer,
        resolve,
      });

      try {
        this.send({
          type: "claude_to_codex_wait",
          requestId,
          message,
          timeoutMs,
          requireReply: true,
          ...(taskHint ? { taskHint } : {}),
        });
      } catch (err: any) {
        const pending = this.pendingWaits.get(requestId);
        this.finalizePendingWait(
          requestId,
          "disconnect",
          this.makeLocalWaitResult({
            requestId,
            message: pending?.message ?? message,
            startedAt: pending?.startedAt ?? startedAt,
            outcome: "bridge_error",
            completionSignal: "agentbridge_error",
            error: `Failed to send ask_codex wait request: ${err.message}`,
          }),
        );
      }
    });
  }

  sendCancelWait(requestId: string, reason = "abort_signal"): boolean {
    if (!requestId) {
      this.log("sendCancelWait skipped: missing requestId");
      return false;
    }

    const pending = this.pendingWaits.get(requestId);
    if (!pending) {
      this.finalizePendingWait(requestId, "abort_signal");
      return false;
    }

    let sent = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.send({
          type: "claude_to_codex_wait_cancel",
          requestId,
          reason,
        });
        sent = true;
      } catch (err: any) {
        this.log(`sendCancelWait failed for ${requestId}: ${err.message}`);
      }
    } else {
      this.log(`sendCancelWait could not send ${requestId}: daemon socket is not open`);
    }

    this.finalizePendingWait(
      requestId,
      "abort_signal",
      this.makeLocalWaitResult({
        requestId,
        message: pending.message,
        startedAt: pending.startedAt,
        outcome: "cancelled",
        completionSignal: "agentbridge_cancelled",
        error: `Wait cancelled: ${reason}`,
      }),
    );
    return sent;
  }

  private attachSocketHandlers(ws: WebSocket, socketId: number) {
    ws.onmessage = (event) => {
      const raw = typeof event.data === "string" ? event.data : event.data.toString();

      let message: ControlServerMessage;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }

      switch (message.type) {
        case "codex_to_claude":
          this.emit("codexMessage", message.message);
          return;
        case "claude_to_codex_result": {
          const pending = this.pendingReplies.get(message.requestId);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pendingReplies.delete(message.requestId);
          pending.resolve({ success: message.success, error: message.error });
          return;
        }
        case "codex_to_claude_wait_result":
          this.finalizePendingWait(
            message.requestId,
            "wait_result_received",
            {
              outcome: message.outcome,
              messages: message.messages,
              completionSignal: message.completionSignal,
              metadata: message.metadata,
            },
          );
          return;
        case "status":
          this.emit("status", message.status);
          return;
      }
    };

    ws.onclose = (event) => {
      const isCurrent = this.ws === ws;
      this.log(`ws#${socketId} onclose (code=${event.code}, reason=${event.reason || "none"}, isCurrent=${isCurrent}, currentWsId=${this.wsId})`);
      if (isCurrent) {
        this.ws = null;
        this.rejectPendingReplies("AgentBridge daemon disconnected.");
        this.rejectPendingWaits("AgentBridge daemon disconnected.", "ws_close");
        if (event.code === CLOSE_CODE_REPLACED) {
          this.emit("rejected");
        } else {
          this.emit("disconnect");
        }
      }
      // If this.ws !== ws, this socket was replaced by a newer connection —
      // don't emit "disconnect" or it will trigger a reconnect loop.
    };

    ws.onerror = () => {
      // The close handler is the single place that tears down pending state.
    };
  }

  private rejectPendingReplies(error: string) {
    for (const [requestId, pending] of this.pendingReplies.entries()) {
      clearTimeout(pending.timer);
      pending.resolve({ success: false, error });
      this.pendingReplies.delete(requestId);
    }
  }

  private rejectPendingWaits(error: string, source: DaemonClientFinalizeSource) {
    for (const [requestId, pending] of Array.from(this.pendingWaits.entries())) {
      this.finalizePendingWait(
        requestId,
        source,
        this.makeLocalWaitResult({
          requestId,
          message: pending.message,
          startedAt: pending.startedAt,
          outcome: "bridge_error",
          completionSignal: "agentbridge_error",
          error,
        }),
      );
    }
  }

  private finalizePendingWait(
    requestId: string,
    source: DaemonClientFinalizeSource,
    result?: AskCodexResult,
  ): boolean {
    const pending = this.pendingWaits.get(requestId);
    if (!pending) {
      this.log(`finalizePendingWait(${requestId}, source=${source}) no-op`);
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingWaits.delete(requestId);
    this.log(`finalizePendingWait(${requestId}, source=${source})`);
    pending.resolve(result ?? this.makeLocalWaitResult({
      requestId,
      message: pending.message,
      startedAt: pending.startedAt,
      outcome: "bridge_error",
      completionSignal: "agentbridge_error",
      error: `Wait finalized without result (${source}).`,
    }));
    return true;
  }

  private makeLocalWaitResult(args: {
    requestId: string;
    message: BridgeMessage;
    startedAt: number;
    outcome: AskCodexOutcome;
    completionSignal: AskCodexCompletionSignal;
    error?: string;
  }): AskCodexResult {
    const completedAt = Date.now();
    return {
      outcome: args.outcome,
      messages: [],
      completionSignal: args.completionSignal,
      metadata: {
        requestId: args.requestId,
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

  private send(message: ControlClientMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("AgentBridge daemon socket is not open.");
    }

    this.ws.send(JSON.stringify(message));
  }

  private log(msg: string) {
    process.stderr.write(`[${new Date().toISOString()}] [DaemonClient] ${msg}\n`);
  }
}
