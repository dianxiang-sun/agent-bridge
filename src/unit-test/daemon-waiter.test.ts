import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { __daemonTest } from "../daemon";
import type { ControlClientMessage, ControlServerMessage, DaemonFinalizeSource } from "../control-protocol";
import type { BridgeMessage } from "../types";

interface MockControlSocket {
  data: { clientId: number; attached: boolean };
  readyState: number;
  sent: ControlServerMessage[];
  send(data: string): number;
  close(): void;
}

let nextClientId = 1;

function createSocket(): MockControlSocket {
  return {
    data: { clientId: nextClientId++, attached: false },
    readyState: WebSocket.OPEN,
    sent: [],
    send(data: string) {
      this.sent.push(JSON.parse(data));
      return 1;
    },
    close() {
      this.readyState = WebSocket.CLOSED;
    },
  };
}

function claudeMessage(content = "question"): BridgeMessage {
  return {
    id: `claude_msg_${Date.now()}`,
    source: "claude",
    content,
    timestamp: Date.now(),
  };
}

function waitRequest(requestId = "wait_1", timeoutMs = 60000): ControlClientMessage {
  return {
    type: "claude_to_codex_wait",
    requestId,
    message: claudeMessage(),
    timeoutMs,
    requireReply: true,
  };
}

function sendControl(ws: MockControlSocket, message: ControlClientMessage) {
  __daemonTest.handleControlMessage(ws as any, JSON.stringify(message));
}

function sendRawControl(ws: MockControlSocket, raw: unknown) {
  __daemonTest.handleControlMessage(ws as any, JSON.stringify(raw));
}

function captureStderr(fn: () => void) {
  const originalWrite = process.stderr.write;
  let output = "";
  process.stderr.write = ((chunk: any) => {
    output += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stderr.write = originalWrite;
  }
  return output;
}

function waitResults(ws: MockControlSocket) {
  return ws.sent.filter((msg) => msg.type === "codex_to_claude_wait_result");
}

function lastWaitResult(ws: MockControlSocket) {
  const results = waitResults(ws);
  return results[results.length - 1] as Extract<ControlServerMessage, { type: "codex_to_claude_wait_result" }>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("daemon active waiter", () => {
  beforeEach(() => {
    __daemonTest.reset();
    __daemonTest.setCodexReady();
    __daemonTest.setInjectMessage(() => true);
  });

  afterEach(() => {
    __daemonTest.reset();
  });

  test("happy path captures ordered agent messages and sends wait_result", () => {
    const ws = createSocket();

    sendControl(ws, waitRequest("wait_happy"));
    __daemonTest.emitAgentMessage("[IMPORTANT] first", "codex_1");
    __daemonTest.emitAgentMessage("[STATUS] second", "codex_2");
    __daemonTest.emitTurnCompleted();

    const result = lastWaitResult(ws);
    expect(result.requestId).toBe("wait_happy");
    expect(result.outcome).toBe("turn_completed");
    expect(result.completionSignal).toBe("codex_app_server_turn_completed");
    expect(result.messages.map((msg) => msg.id)).toEqual(["codex_1", "codex_2"]);
    expect(__daemonTest.getActiveWaiter()).toBeNull();
    expect(__daemonTest.getBufferedMessages()).toEqual([]);
  });

  test("unknown control message logs and returns protocol_error when requestId is present", () => {
    const ws = createSocket();

    const stderr = captureStderr(() => {
      sendRawControl(ws, {
        type: "future_control_message",
        requestId: "future_1",
      });
    });

    expect(stderr).toContain("Received unknown control message type: future_control_message (requestId=future_1)");
    expect(ws.sent).toEqual([
      {
        type: "protocol_error",
        requestId: "future_1",
        error: "Unsupported message type: future_control_message",
      },
    ]);
  });

  test("malformed control message is logged and ignored before switch", () => {
    const ws = createSocket();

    const stderr = captureStderr(() => {
      sendRawControl(ws, null);
    });

    expect(stderr).toContain("Rejecting malformed control message");
    expect(ws.sent).toEqual([]);
  });

  test("busy second wait returns immediate busy result without replacing active waiter", () => {
    const ws = createSocket();

    sendControl(ws, waitRequest("wait_active"));
    sendControl(ws, waitRequest("wait_busy"));

    const result = lastWaitResult(ws);
    expect(result.requestId).toBe("wait_busy");
    expect(result.outcome).toBe("busy");
    expect(result.completionSignal).toBe("agentbridge_busy");
    expect(result.metadata.active_request_id).toBe("wait_active");
    expect(result.metadata.retry_after_ms).toBe(30000);
    expect(__daemonTest.getActiveWaiter()?.requestId).toBe("wait_active");
  });

  test("injection failure finalizes with bridge_error and clears waiter", () => {
    const ws = createSocket();
    __daemonTest.setInjectMessage(() => false);

    sendControl(ws, waitRequest("wait_inject_fail"));

    const result = lastWaitResult(ws);
    expect(result.requestId).toBe("wait_inject_fail");
    expect(result.outcome).toBe("bridge_error");
    expect(result.completionSignal).toBe("agentbridge_error");
    expect(result.metadata.error).toContain("Injection failed");
    expect(__daemonTest.getActiveWaiter()).toBeNull();
  });

  test("timeout returns partial messages and resumes normal routing afterward", async () => {
    const ws = createSocket();

    sendControl(ws, waitRequest("wait_timeout", 5));
    __daemonTest.emitAgentMessage("[IMPORTANT] partial", "codex_partial");
    await delay(15);
    __daemonTest.emitAgentMessage("[IMPORTANT] late", "codex_late");

    const result = lastWaitResult(ws);
    expect(result.requestId).toBe("wait_timeout");
    expect(result.outcome).toBe("timeout");
    expect(result.messages.map((msg) => msg.id)).toEqual(["codex_partial"]);
    expect(result.metadata.timed_out_at).toBeNumber();
    expect(result.metadata.post_timeout_delivery).toBe("normal_agentbridge_routing");
    expect(__daemonTest.getBufferedMessages().map((msg) => msg.id)).toContain("codex_late");
  });

  test("wait_cancel finalizes as cancelled and stale cancel is ignored", () => {
    const ws = createSocket();

    sendControl(ws, waitRequest("wait_cancel"));
    sendControl(ws, {
      type: "claude_to_codex_wait_cancel",
      requestId: "wait_cancel",
      reason: "abort_signal",
    });
    sendControl(ws, {
      type: "claude_to_codex_wait_cancel",
      requestId: "wait_cancel",
      reason: "abort_signal",
    });

    const results = waitResults(ws);
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe("cancelled");
    expect(results[0].completionSignal).toBe("agentbridge_cancelled");
    expect(results[0].metadata.error).toContain("abort_signal");
    expect(__daemonTest.getActiveWaiter()).toBeNull();
  });

  test("claude_disconnect and ws_close finalize active waiter with distinct sources", () => {
    for (const [source, requestId] of [
      ["claude_disconnect", "wait_disconnect"],
      ["ws_close", "wait_ws_close"],
    ] as Array<[Extract<DaemonFinalizeSource, "claude_disconnect" | "ws_close">, string]>) {
      __daemonTest.reset();
      __daemonTest.setCodexReady();
      __daemonTest.setInjectMessage(() => true);
      const ws = createSocket();
      sendControl(ws, { type: "claude_connect" });
      sendControl(ws, waitRequest(requestId));

      if (source === "claude_disconnect") {
        sendControl(ws, { type: "claude_disconnect" });
      } else {
        __daemonTest.detachClaudeForTest(ws as any, "frontend socket closed", "ws_close");
      }

      const result = lastWaitResult(ws);
      expect(result.requestId).toBe(requestId);
      expect(result.outcome).toBe("bridge_error");
      expect(result.metadata.error).toContain(source === "ws_close" ? "frontend socket closed" : "frontend requested disconnect");
      expect(__daemonTest.getActiveWaiter()).toBeNull();
    }
  });

  test("replyRequired scratch resets only when waiter owns it", () => {
    const ownedWs = createSocket();
    __daemonTest.setReplyRequiredState(false, false);
    sendControl(ownedWs, waitRequest("wait_owned_reply_required"));
    __daemonTest.emitAgentMessage("[IMPORTANT] answer", "codex_owned");
    __daemonTest.emitTurnCompleted();

    expect(lastWaitResult(ownedWs).outcome).toBe("turn_completed");
    expect(__daemonTest.getReplyRequiredState()).toEqual({
      replyRequired: false,
      replyReceivedDuringTurn: false,
    });

    __daemonTest.reset();
    __daemonTest.setCodexReady();
    __daemonTest.setInjectMessage(() => true);
    const preexistingWs = createSocket();
    __daemonTest.setReplyRequiredState(true, false);
    sendControl(preexistingWs, waitRequest("wait_preexisting_reply_required"));
    __daemonTest.emitAgentMessage("[IMPORTANT] answer", "codex_preexisting");
    __daemonTest.emitTurnCompleted();

    expect(lastWaitResult(preexistingWs).outcome).toBe("turn_completed");
    expect(__daemonTest.getReplyRequiredState()).toEqual({
      replyRequired: true,
      replyReceivedDuringTurn: false,
    });
  });

  test("system turnStarted and turnCompleted UI messages are suppressed during waiter", () => {
    const ws = createSocket();
    __daemonTest.emitAgentMessage("[STATUS] pre-wait buffered status", "codex_status");
    expect(__daemonTest.getStatusBufferSize()).toBe(1);

    sendControl(ws, waitRequest("wait_system_suppression"));
    __daemonTest.emitTurnStarted();
    __daemonTest.emitTurnCompleted();

    const result = lastWaitResult(ws);
    expect(result.outcome).toBe("turn_completed");
    const pendingMessages = __daemonTest.getBufferedMessages();
    expect(pendingMessages.some((msg) => msg.id.startsWith("system_turn_started_"))).toBe(false);
    expect(pendingMessages.some((msg) => msg.id.startsWith("system_turn_completed_"))).toBe(false);
    expect(pendingMessages.some((msg) => msg.id.startsWith("status_summary_"))).toBe(false);
    expect(__daemonTest.getStatusBufferSize()).toBe(1);
  });

  test("idempotent finalizeWaiter returns no-op on second call and first result wins", () => {
    const ws = createSocket();

    sendControl(ws, waitRequest("wait_idempotent"));
    __daemonTest.emitAgentMessage("[IMPORTANT] first result", "codex_first");

    const first = __daemonTest.finalizeWaiterForTest("wait_idempotent", "turn_completed");
    const second = __daemonTest.finalizeWaiterForTest("wait_idempotent", "timeout");

    const results = waitResults(ws);
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe("turn_completed");
    expect(results[0].messages.map((msg) => msg.id)).toEqual(["codex_first"]);
  });
});
