import type { BridgeMessage } from "./types";

export interface DaemonStatus {
  bridgeReady: boolean;
  tuiConnected: boolean;
  threadId: string | null;
  queuedMessageCount: number;
  proxyUrl: string;
  appServerUrl: string;
  pid: number;
}

export type AskCodexOutcome =
  | "turn_completed"
  | "timeout"
  | "bridge_error"
  | "busy"
  | "cancelled";

export type AskCodexCompletionSignal =
  | "codex_app_server_turn_completed"
  | "agentbridge_timeout"
  | "agentbridge_busy"
  | "agentbridge_error"
  | "agentbridge_cancelled";

export type DaemonFinalizeSource =
  | "turn_completed" | "timeout" | "client_cancel" | "ws_close"
  | "claude_disconnect" | "inject_failed" | "daemon_error";

export type DaemonClientFinalizeSource =
  | "wait_result_received" | "timeout" | "abort_signal"
  | "ws_close" | "disconnect";

export interface AskCodexResultMetadata {
  requestId?: string;
  chat_id?: string | null;
  turn_id?: string | null;
  taskId?: string | null;
  started_at?: number;
  completed_at?: number;
  elapsed_ms?: number;
  timed_out_at?: number | null;
  message_count?: number;
  post_timeout_delivery?: "normal_agentbridge_routing" | null;
  active_request_id?: string;
  retry_after_ms?: number;
  error?: string;
}

export interface AskCodexResult {
  outcome: AskCodexOutcome;
  messages: BridgeMessage[];
  completionSignal: AskCodexCompletionSignal;
  metadata: AskCodexResultMetadata;
}

export type ControlClientMessage =
  | { type: "claude_connect" }
  | { type: "claude_disconnect" }
  | { type: "claude_to_codex"; requestId: string; message: BridgeMessage; requireReply?: boolean }
  | {
      type: "claude_to_codex_wait";
      requestId: string;
      message: BridgeMessage;
      timeoutMs: number;
      requireReply: true;
      taskHint?: Record<string, unknown>;
    }
  | { type: "claude_to_codex_wait_cancel"; requestId: string; reason: string }
  | { type: "status" };

export type ControlServerMessage =
  | { type: "codex_to_claude"; message: BridgeMessage }
  | { type: "claude_to_codex_result"; requestId: string; success: boolean; error?: string }
  | ({
      type: "codex_to_claude_wait_result";
      requestId: string;
    } & AskCodexResult)
  | { type: "status"; status: DaemonStatus };

/** WebSocket close code sent by the daemon when a newer Claude session replaces the current one. */
export const CLOSE_CODE_REPLACED = 4001;
