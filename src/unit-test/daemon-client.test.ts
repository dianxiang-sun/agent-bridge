import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { DaemonClient } from "../daemon-client";
import type { AskCodexResult } from "../control-protocol";

/**
 * Tests for DaemonClient — connection, disconnection, and message routing.
 *
 * Uses a real WebSocket server on a random port so we exercise the full
 * connect / message / close path without mocking WebSocket internals.
 */

let server: ReturnType<typeof Bun.serve> | null = null;
let serverPort = 0;
let client: DaemonClient;
let serverSockets: Set<any>;
let originalWaitResultGraceEnv: string | undefined;

// Shared message handler — tests can replace this to intercept server-side messages
let onServerMessage: (ws: any, raw: string | Buffer) => void = () => {};

function startServer() {
  serverSockets = new Set();
  const srv = Bun.serve({
    port: 0,
    fetch(req, s) {
      if (s.upgrade(req)) return undefined;
      return new Response("ok");
    },
    websocket: {
      open(ws: any) {
        serverSockets.add(ws);
      },
      message(ws: any, raw: any) {
        onServerMessage(ws, raw);
      },
      close(ws: any) {
        serverSockets.delete(ws);
      },
    },
  });
  server = srv;
  serverPort = srv.port as number;
}

function stopServer() {
  if (server) {
    server.stop(true);
    server = null;
  }
}

function sendToClient(data: Record<string, unknown>) {
  for (const ws of serverSockets) {
    ws.send(JSON.stringify(data));
  }
}

function makeClaudeMessage(id = "chat-test", content = "hello codex") {
  return {
    id,
    source: "claude" as const,
    content,
    timestamp: Date.now(),
  };
}

function makeAskCodexResult(
  requestId: string,
  overrides: Partial<AskCodexResult> = {},
): AskCodexResult {
  const base: AskCodexResult = {
    outcome: "turn_completed",
    messages: [
      { id: "codex-msg-1", source: "codex", content: "[IMPORTANT] done", timestamp: Date.now() },
    ],
    completionSignal: "codex_app_server_turn_completed",
    metadata: {
      requestId,
      chat_id: "chat-test",
      turn_id: null,
      taskId: null,
      started_at: Date.now() - 10,
      completed_at: Date.now(),
      elapsed_ms: 10,
      timed_out_at: null,
      message_count: 1,
      post_timeout_delivery: null,
    },
  };

  return {
    ...base,
    ...overrides,
    metadata: {
      ...base.metadata,
      ...overrides.metadata,
    },
  };
}

function makeWaitResultFrame(requestId: string, overrides: Partial<AskCodexResult> = {}) {
  return {
    type: "codex_to_claude_wait_result",
    requestId,
    ...makeAskCodexResult(requestId, overrides),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("DaemonClient", () => {
  beforeEach(() => {
    originalWaitResultGraceEnv = process.env.AGENTBRIDGE_WAIT_RESULT_GRACE_MS;
    onServerMessage = () => {};
    startServer();
    client = new DaemonClient(`ws://127.0.0.1:${serverPort}/ws`);
  });

  afterEach(async () => {
    await client.disconnect();
    if (originalWaitResultGraceEnv === undefined) {
      delete process.env.AGENTBRIDGE_WAIT_RESULT_GRACE_MS;
    } else {
      process.env.AGENTBRIDGE_WAIT_RESULT_GRACE_MS = originalWaitResultGraceEnv;
    }
    stopServer();
  });

  test("connect() succeeds against a live server", async () => {
    await client.connect();
    // No error thrown = success
  });

  test("connect() rejects when server is not reachable", async () => {
    stopServer();
    const badClient = new DaemonClient("ws://127.0.0.1:19999/ws");
    await expect(badClient.connect()).rejects.toThrow();
  });

  test("emits disconnect when server closes the socket", async () => {
    await client.connect();

    const disconnected = new Promise<void>((resolve) => {
      client.on("disconnect", () => resolve());
    });

    for (const ws of serverSockets) {
      ws.close();
    }

    await disconnected;
  });

  test("emits rejected (not disconnect) when server closes with code 4001", async () => {
    await client.connect();

    let disconnectEmitted = false;
    client.on("disconnect", () => { disconnectEmitted = true; });

    const rejected = new Promise<void>((resolve) => {
      client.on("rejected", () => resolve());
    });

    for (const ws of serverSockets) {
      ws.close(4001, "another Claude session is already connected");
    }

    await rejected;
    // Give a tick for any stray disconnect to fire
    await new Promise((r) => setTimeout(r, 50));
    expect(disconnectEmitted).toBe(false);
  });

  test("emits disconnect (not rejected) for non-4001 close codes", async () => {
    await client.connect();

    let rejectedEmitted = false;
    client.on("rejected", () => { rejectedEmitted = true; });

    const disconnected = new Promise<void>((resolve) => {
      client.on("disconnect", () => resolve());
    });

    for (const ws of serverSockets) {
      ws.close(1000, "normal closure");
    }

    await disconnected;
    await new Promise((r) => setTimeout(r, 50));
    expect(rejectedEmitted).toBe(false);
  });

  test("pending replies rejected on rejected close (code 4001)", async () => {
    await client.connect();

    // Send a message that expects a reply — it will never be answered
    const replyPromise = client.sendReply(
      { id: "test-pending", source: "claude", content: "hello", timestamp: Date.now() },
      false,
    );

    // Close with 4001 before any response
    for (const ws of serverSockets) {
      ws.close(4001, "another Claude session is already connected");
    }

    const result = await replyPromise;
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("emits codexMessage on codex_to_claude", async () => {
    await client.connect();

    const msgPromise = new Promise<any>((resolve) => {
      client.on("codexMessage", (msg) => resolve(msg));
    });

    sendToClient({
      type: "codex_to_claude",
      message: { id: "test1", source: "codex", content: "hello", timestamp: 1 },
    });

    const msg = await msgPromise;
    expect(msg.content).toBe("hello");
    expect(msg.source).toBe("codex");
  });

  test("emits status on status message", async () => {
    await client.connect();

    const statusPromise = new Promise<any>((resolve) => {
      client.on("status", (s) => resolve(s));
    });

    sendToClient({
      type: "status",
      status: {
        bridgeReady: true,
        tuiConnected: false,
        threadId: null,
        queuedMessageCount: 0,
        proxyUrl: "http://localhost:4501",
        appServerUrl: "http://localhost:4502",
        pid: 123,
      },
    });

    const status = await statusPromise;
    expect(status.bridgeReady).toBe(true);
  });

  test("sendReply returns error when not connected", async () => {
    const result = await client.sendReply({
      id: "r1",
      source: "claude",
      content: "hi",
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not connected");
  });

  test("sendReply resolves on successful result", async () => {
    // Set up echo handler before connecting
    onServerMessage = (ws: any, raw: any) => {
      const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (msg.type === "claude_to_codex") {
        ws.send(JSON.stringify({
          type: "claude_to_codex_result",
          requestId: msg.requestId,
          success: true,
        }));
      }
    };

    await client.connect();

    const result = await client.sendReply({
      id: "r2",
      source: "claude",
      content: "reply text",
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  test("pending replies rejected on disconnect", async () => {
    await client.connect();

    const replyPromise = client.sendReply({
      id: "r3",
      source: "claude",
      content: "will be rejected",
      timestamp: Date.now(),
    });

    // Close server socket to trigger disconnect
    for (const ws of serverSockets) {
      ws.close();
    }

    const result = await replyPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain("disconnected");
  });

  test("can reconnect after disconnect", async () => {
    await client.connect();

    const disconnected = new Promise<void>((resolve) => {
      client.on("disconnect", () => resolve());
    });

    for (const ws of serverSockets) {
      ws.close();
    }
    await disconnected;

    // Reconnect — should succeed
    await client.connect();

    // Verify it works by sending a message
    const msgPromise = new Promise<any>((resolve) => {
      client.on("codexMessage", (msg) => resolve(msg));
    });

    sendToClient({
      type: "codex_to_claude",
      message: { id: "test2", source: "codex", content: "after reconnect", timestamp: 2 },
    });

    const msg = await msgPromise;
    expect(msg.content).toBe("after reconnect");
  });

  test("attachClaude sends claude_connect message", async () => {
    const received = new Promise<any>((resolve) => {
      onServerMessage = (_ws: any, raw: any) => {
        resolve(JSON.parse(typeof raw === "string" ? raw : raw.toString()));
      };
    });

    await client.connect();
    client.attachClaude();

    const msg = await received;
    expect(msg.type).toBe("claude_connect");
  });

  test("sendAskCodex sends wait request and resolves once on wait_result_received", async () => {
    let waitRequest: any;
    let resolveRequestSeen!: () => void;
    const requestSeen = new Promise<void>((resolve) => {
      resolveRequestSeen = resolve;
    });

    onServerMessage = (ws: any, raw: any) => {
      const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (msg.type !== "claude_to_codex_wait") return;

      waitRequest = msg;
      resolveRequestSeen();
      ws.send(JSON.stringify(makeWaitResultFrame(msg.requestId, {
        messages: [
          { id: "codex-1", source: "codex", content: "[IMPORTANT] first", timestamp: 1 },
        ],
      })));
      ws.send(JSON.stringify(makeWaitResultFrame(msg.requestId, {
        messages: [
          { id: "codex-duplicate", source: "codex", content: "[IMPORTANT] duplicate", timestamp: 2 },
        ],
      })));
    };

    await client.connect();
    const resultPromise = client.sendAskCodex(
      makeClaudeMessage("chat-slice-1", "question"),
      60000,
      { future: true },
    );

    await requestSeen;
    const result = await resultPromise;
    await delay(10);

    expect(waitRequest.type).toBe("claude_to_codex_wait");
    expect(waitRequest.requestId).toMatch(/^wait_/);
    expect(waitRequest.message.content).toBe("question");
    expect(waitRequest.timeoutMs).toBe(60000);
    expect(waitRequest.requireReply).toBe(true);
    expect(waitRequest.taskHint).toEqual({ future: true });

    expect(result.outcome).toBe("turn_completed");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe("[IMPORTANT] first");
    expect((client as any).pendingWaits.size).toBe(0);
  });

  test("sendAskCodex returns bridge_error when not connected", async () => {
    const result = await client.sendAskCodex(makeClaudeMessage(), 60000);

    expect(result.outcome).toBe("bridge_error");
    expect(result.completionSignal).toBe("agentbridge_error");
    expect(result.metadata.error).toContain("not connected");
    expect(result.metadata.requestId).toMatch(/^wait_/);
  });

  test("local bridge_error result leaves chat_id null", async () => {
    const result = await client.sendAskCodex(makeClaudeMessage("message-id-not-chat-id"), 60000);

    expect(result.outcome).toBe("bridge_error");
    expect(result.metadata.chat_id).toBeNull();
  });

  test("AGENTBRIDGE_WAIT_RESULT_GRACE_MS overrides wait result grace timer", () => {
    process.env.AGENTBRIDGE_WAIT_RESULT_GRACE_MS = "12345";

    const envClient = new DaemonClient(`ws://127.0.0.1:${serverPort}/ws`);

    expect((envClient as any).waitResultGraceMs).toBe(12345);
  });

  test("pending wait timeout finalizes once and ignores late wait_result", async () => {
    client = new DaemonClient(`ws://127.0.0.1:${serverPort}/ws`, { waitResultGraceMs: 5 });

    let requestId = "";
    let resolveRequestSeen!: () => void;
    const requestSeen = new Promise<void>((resolve) => {
      resolveRequestSeen = resolve;
    });

    onServerMessage = (_ws: any, raw: any) => {
      const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (msg.type !== "claude_to_codex_wait") return;
      requestId = msg.requestId;
      resolveRequestSeen();
    };

    await client.connect();
    const resultPromise = client.sendAskCodex(makeClaudeMessage(), 5);
    await requestSeen;

    const result = await resultPromise;
    sendToClient(makeWaitResultFrame(requestId));
    await delay(10);

    expect(result.outcome).toBe("bridge_error");
    expect(result.completionSignal).toBe("agentbridge_error");
    expect(result.metadata.error).toContain("Timed out waiting");
    expect((client as any).pendingWaits.size).toBe(0);
  });

  test("pending wait finalizes on ws-close", async () => {
    let resolveRequestSeen!: () => void;
    const requestSeen = new Promise<void>((resolve) => {
      resolveRequestSeen = resolve;
    });

    onServerMessage = (_ws: any, raw: any) => {
      const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (msg.type === "claude_to_codex_wait") resolveRequestSeen();
    };

    await client.connect();
    const resultPromise = client.sendAskCodex(makeClaudeMessage(), 60000);
    await requestSeen;

    for (const ws of serverSockets) {
      ws.close();
    }

    const result = await resultPromise;
    expect(result.outcome).toBe("bridge_error");
    expect(result.metadata.error).toContain("disconnected");
    expect((client as any).pendingWaits.size).toBe(0);
  });

  test("pending wait finalizes on explicit disconnect", async () => {
    let resolveRequestSeen!: () => void;
    const requestSeen = new Promise<void>((resolve) => {
      resolveRequestSeen = resolve;
    });

    onServerMessage = (_ws: any, raw: any) => {
      const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (msg.type === "claude_to_codex_wait") resolveRequestSeen();
    };

    await client.connect();
    const resultPromise = client.sendAskCodex(makeClaudeMessage(), 60000);
    await requestSeen;

    await client.disconnect();

    const result = await resultPromise;
    expect(result.outcome).toBe("bridge_error");
    expect(result.metadata.error).toContain("Daemon connection closed");
    expect((client as any).pendingWaits.size).toBe(0);
  });

  test("sendCancelWait sends wait_cancel and keeps the socket open", async () => {
    let requestId = "";
    let resolveRequestSeen!: () => void;
    let resolveCancelSeen!: (value: any) => void;
    const requestSeen = new Promise<void>((resolve) => {
      resolveRequestSeen = resolve;
    });
    const cancelSeen = new Promise<any>((resolve) => {
      resolveCancelSeen = resolve;
    });

    onServerMessage = (_ws: any, raw: any) => {
      const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (msg.type === "claude_to_codex_wait") {
        requestId = msg.requestId;
        resolveRequestSeen();
      }
      if (msg.type === "claude_to_codex_wait_cancel") {
        resolveCancelSeen(msg);
      }
    };

    await client.connect();
    const resultPromise = client.sendAskCodex(makeClaudeMessage(), 60000);
    await requestSeen;

    const sent = client.sendCancelWait(requestId);
    const cancel = await cancelSeen;
    const result = await resultPromise;

    expect(sent).toBe(true);
    expect(cancel).toEqual({
      type: "claude_to_codex_wait_cancel",
      requestId,
      reason: "abort_signal",
    });
    expect(result.outcome).toBe("cancelled");
    expect(result.completionSignal).toBe("agentbridge_cancelled");
    expect((client as any).ws?.readyState).toBe(WebSocket.OPEN);
    expect((client as any).pendingWaits.size).toBe(0);
  });

  test("second call to finalizePendingWait with same requestId is a no-op", async () => {
    let requestId = "";
    let resolveRequestSeen!: () => void;
    const requestSeen = new Promise<void>((resolve) => {
      resolveRequestSeen = resolve;
    });

    onServerMessage = (_ws: any, raw: any) => {
      const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (msg.type === "claude_to_codex_wait") {
        requestId = msg.requestId;
        resolveRequestSeen();
      }
    };

    await client.connect();
    const resultPromise = client.sendAskCodex(makeClaudeMessage(), 60000);
    await requestSeen;

    const firstResult = makeAskCodexResult(requestId, {
      outcome: "bridge_error",
      completionSignal: "agentbridge_error",
      messages: [],
      metadata: { error: "first result wins" },
    });
    const secondResult = makeAskCodexResult(requestId, {
      metadata: { error: "second result must be ignored" },
    });

    const first = (client as any).finalizePendingWait(requestId, "timeout", firstResult);
    const second = (client as any).finalizePendingWait(requestId, "wait_result_received", secondResult);
    const result = await resultPromise;

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(result.metadata.error).toBe("first result wins");
    expect((client as any).pendingWaits.size).toBe(0);
  });

  test("concurrent timeout and wait_result_received race resolves once", async () => {
    let requestId = "";
    let resolveRequestSeen!: () => void;
    const requestSeen = new Promise<void>((resolve) => {
      resolveRequestSeen = resolve;
    });

    onServerMessage = (_ws: any, raw: any) => {
      const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (msg.type === "claude_to_codex_wait") {
        requestId = msg.requestId;
        resolveRequestSeen();
      }
    };

    await client.connect();
    const waitPromise = client.sendAskCodex(makeClaudeMessage(), 60000);
    let resolvedCount = 0;
    const observedPromise = waitPromise.then((result) => {
      resolvedCount += 1;
      return result;
    });
    await requestSeen;

    const timeoutResult = makeAskCodexResult(requestId, {
      outcome: "bridge_error",
      completionSignal: "agentbridge_error",
      messages: [],
      metadata: { error: "timeout won" },
    });
    const waitResult = makeAskCodexResult(requestId, {
      metadata: { error: "wait result won" },
    });

    const finalized = await Promise.all([
      Promise.resolve().then(() => (client as any).finalizePendingWait(requestId, "timeout", timeoutResult)),
      Promise.resolve().then(() => (client as any).finalizePendingWait(requestId, "wait_result_received", waitResult)),
    ]);

    const result = await observedPromise;
    await delay(10);

    expect(finalized.filter(Boolean)).toHaveLength(1);
    expect(resolvedCount).toBe(1);
    expect(["timeout won", "wait result won"]).toContain(String(result.metadata.error));
    expect((client as any).pendingWaits.size).toBe(0);
  });
});
