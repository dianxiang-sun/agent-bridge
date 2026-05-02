import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { ClaudeAdapter } from "../claude-adapter";
import type { AskCodexResult } from "../control-protocol";

// Access internals for testing
function createAdapter(envMode?: string): any {
  const origMode = process.env.AGENTBRIDGE_MODE;
  const origMax = process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES;

  if (envMode !== undefined) {
    process.env.AGENTBRIDGE_MODE = envMode;
  } else {
    delete process.env.AGENTBRIDGE_MODE;
  }

  const adapter = new ClaudeAdapter() as any;

  // Restore env immediately after construction reads it
  if (origMode !== undefined) {
    process.env.AGENTBRIDGE_MODE = origMode;
  } else {
    delete process.env.AGENTBRIDGE_MODE;
  }
  if (origMax !== undefined) {
    process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES = origMax;
  } else {
    delete process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES;
  }

  return adapter;
}

function makeBridgeMessage(content: string, ts?: number) {
  return {
    id: `test_${Date.now()}`,
    source: "codex" as const,
    content,
    timestamp: ts ?? Date.now(),
  };
}

function makeAskCodexResult(
  requestId: string,
  overrides: Partial<AskCodexResult> = {},
): AskCodexResult {
  const base: AskCodexResult = {
    outcome: "turn_completed",
    messages: [
      { id: "codex-1", source: "codex", content: "[IMPORTANT] done", timestamp: Date.now() },
    ],
    completionSignal: "codex_app_server_turn_completed",
    metadata: {
      requestId,
      chat_id: null,
      turn_id: null,
      taskId: null,
      started_at: Date.now() - 20,
      completed_at: Date.now(),
      elapsed_ms: 20,
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

function parseAskCodexTextResult(result: any): AskCodexResult {
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe("text");
  return JSON.parse(result.content[0].text) as AskCodexResult;
}

function makeHandlerExtra(signal = new AbortController().signal) {
  return {
    signal,
    requestId: 1,
    sendNotification: async () => {},
    sendRequest: async () => ({}),
  };
}

describe("Dual-mode transport: mode resolution", () => {
  test("configuredMode defaults to 'auto' when AGENTBRIDGE_MODE is not set", () => {
    const adapter = createAdapter();
    expect(adapter.configuredMode).toBe("auto");
  });

  test("configuredMode respects AGENTBRIDGE_MODE=push", () => {
    const adapter = createAdapter("push");
    expect(adapter.configuredMode).toBe("push");
  });

  test("configuredMode respects AGENTBRIDGE_MODE=pull", () => {
    const adapter = createAdapter("pull");
    expect(adapter.configuredMode).toBe("pull");
  });

  test("invalid AGENTBRIDGE_MODE falls back to 'auto'", () => {
    const adapter = createAdapter("invalid");
    expect(adapter.configuredMode).toBe("auto");
  });

  test("auto mode defaults to pull", () => {
    const adapter = createAdapter();
    adapter.resolveMode();
    expect(adapter.resolvedMode).toBe("pull");
    expect(adapter.getDeliveryMode()).toBe("pull");
  });

  test("resolveMode sets 'push' when configuredMode is 'push'", () => {
    const adapter = createAdapter("push");
    adapter.resolveMode();
    expect(adapter.resolvedMode).toBe("push");
    expect(adapter.getDeliveryMode()).toBe("push");
  });

  test("resolveMode sets 'pull' when configuredMode is 'pull'", () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();
    expect(adapter.resolvedMode).toBe("pull");
    expect(adapter.getDeliveryMode()).toBe("pull");
  });
});

describe("Dual-mode transport: pull mode message queue", () => {
  test("queueForPull adds message to pendingMessages", () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();

    const msg = makeBridgeMessage("hello from codex");
    adapter.queueForPull(msg);

    expect(adapter.pendingMessages).toHaveLength(1);
    expect(adapter.pendingMessages[0].content).toBe("hello from codex");
    expect(adapter.getPendingMessageCount()).toBe(1);
  });

  test("queueForPull drops oldest when queue is full", () => {
    const orig = process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES;
    process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES = "3";
    const adapter = createAdapter("pull");
    process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES = orig;

    adapter.resolveMode();

    adapter.queueForPull(makeBridgeMessage("msg1"));
    adapter.queueForPull(makeBridgeMessage("msg2"));
    adapter.queueForPull(makeBridgeMessage("msg3"));
    adapter.queueForPull(makeBridgeMessage("msg4"));

    expect(adapter.pendingMessages).toHaveLength(3);
    expect(adapter.pendingMessages[0].content).toBe("msg2");
    expect(adapter.pendingMessages[2].content).toBe("msg4");
    expect(adapter.droppedMessageCount).toBe(1);
  });

  test("pushNotification queues in pull mode", async () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();
    await adapter.pushNotification(makeBridgeMessage("pull msg"));
    expect(adapter.pendingMessages).toHaveLength(1);
    expect(adapter.pendingMessages[0].content).toBe("pull msg");
  });

  test("push mode message ids include a session-unique prefix", async () => {
    const adapter = createAdapter("push");
    adapter.resolveMode();

    const notifications: any[] = [];
    adapter.server = {
      notification: async (payload: any) => {
        notifications.push(payload);
      },
    };

    await adapter.pushNotification(makeBridgeMessage("first push", 1705312200000));
    await adapter.pushNotification(makeBridgeMessage("second push", 1705312205000));

    expect(notifications).toHaveLength(2);

    const firstId = notifications[0].params.meta.message_id as string;
    const secondId = notifications[1].params.meta.message_id as string;

    expect(firstId).toMatch(/^codex_msg_[a-f0-9]{12}_1$/);
    expect(secondId).toMatch(/^codex_msg_[a-f0-9]{12}_2$/);
    expect(firstId.replace(/_1$/, "")).toBe(secondId.replace(/_2$/, ""));
    expect(firstId).not.toBe("codex_msg_1");
  });

  test("pushNotification falls back to the pull queue when push delivery throws", async () => {
    const adapter = createAdapter("push");
    adapter.resolveMode();

    adapter.server = {
      notification: async () => {
        throw new Error("channel unavailable");
      },
    };

    await adapter.pushNotification(makeBridgeMessage("fallback msg"));

    expect(adapter.pendingMessages).toHaveLength(1);
    expect(adapter.pendingMessages[0].content).toBe("fallback msg");
  });
});

describe("Dual-mode transport: drainMessages (get_messages)", () => {
  test("returns 'no new messages' when queue is empty", () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();

    const result = adapter.drainMessages();
    expect(result.content[0].text).toBe("No new messages from Codex.");
  });

  test("returns formatted messages and clears queue", () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();

    const ts = 1705312200000; // fixed timestamp for deterministic output
    adapter.queueForPull(makeBridgeMessage("first message", ts));
    adapter.queueForPull(makeBridgeMessage("second message", ts + 5000));

    const result = adapter.drainMessages();
    const text = result.content[0].text;

    expect(text).toContain("[2 new messages from Codex]");
    expect(text).toContain("chat_id:");
    expect(text).toContain("[1]");
    expect(text).toContain("first message");
    expect(text).toContain("[2]");
    expect(text).toContain("second message");

    // Queue should be cleared
    expect(adapter.pendingMessages).toHaveLength(0);
    expect(adapter.getPendingMessageCount()).toBe(0);
  });

  test("includes dropped count when messages were lost", () => {
    const orig = process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES;
    process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES = "2";
    const adapter = createAdapter("pull");
    process.env.AGENTBRIDGE_MAX_BUFFERED_MESSAGES = orig;
    adapter.resolveMode();

    adapter.queueForPull(makeBridgeMessage("a"));
    adapter.queueForPull(makeBridgeMessage("b"));
    adapter.queueForPull(makeBridgeMessage("c")); // drops "a"

    const result = adapter.drainMessages();
    const text = result.content[0].text;
    expect(text).toContain("1 older message");
    expect(text).toContain("dropped due to queue overflow");
    expect(adapter.droppedMessageCount).toBe(0); // reset after drain
  });

  test("singular message uses correct grammar", () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();

    adapter.queueForPull(makeBridgeMessage("only one"));

    const result = adapter.drainMessages();
    expect(result.content[0].text).toContain("[1 new message from Codex]");
  });
});

describe("Dual-mode transport: reply pending hint", () => {
  test("handleReply includes pending message hint when queue is non-empty", async () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();

    adapter.replySender = async () => ({ success: true });
    adapter.queueForPull(makeBridgeMessage("waiting msg 1"));
    adapter.queueForPull(makeBridgeMessage("waiting msg 2"));

    const result = await adapter.handleReply({ chat_id: "test", text: "hello codex" });
    const text = result.content[0].text;

    expect(text).toContain("Reply sent to Codex.");
    expect(text).toContain("2 unread Codex message");
    expect(text).toContain("get_messages");
  });

  test("handleReply has no hint when queue is empty", async () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();

    adapter.replySender = async () => ({ success: true });

    const result = await adapter.handleReply({ chat_id: "test", text: "hello codex" });
    expect(result.content[0].text).toBe("Reply sent to Codex.");
  });

  test("handleReply returns error when text is missing", async () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();

    const result = await adapter.handleReply({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("missing required parameter");
  });

  test("handleReply returns error when replySender is not set", async () => {
    const adapter = createAdapter("pull");
    adapter.resolveMode();

    const result = await adapter.handleReply({ text: "hello" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("bridge not initialized");
  });
});

describe("Dual-mode transport: ask_codex tool", () => {
  test("lists ask_codex with the locked public schema", async () => {
    const adapter = createAdapter("pull");
    const listHandler = adapter.server._requestHandlers.get("tools/list");

    const result = await listHandler(
      { method: "tools/list", params: {} },
      makeHandlerExtra(),
    );
    const tool = result.tools.find((entry: any) => entry.name === "ask_codex");

    expect(tool).toBeDefined();
    expect(tool.inputSchema.required).toEqual(["text"]);
    expect(tool.inputSchema.properties.text.type).toBe("string");
    expect(tool.inputSchema.properties.text.minLength).toBe(1);
    expect(tool.inputSchema.properties.chat_id.type).toBe("string");
    expect(tool.inputSchema.properties.timeout_ms.type).toBe("number");
    expect(tool.inputSchema.properties.message).toBeUndefined();
    expect(tool.inputSchema.properties.timeoutMs).toBeUndefined();
    expect(tool.inputSchema.properties.taskHint).toBeUndefined();
  });

  test("CallTool handler dispatches ask_codex through JSON text content", async () => {
    const adapter = createAdapter("pull");
    adapter.setAskSender(
      () => ({
        requestId: "wait-handler",
        result: Promise.resolve(makeAskCodexResult("wait-handler")),
      }),
      () => false,
    );

    const callHandler = adapter.server._requestHandlers.get("tools/call");
    const result = await callHandler(
      {
        method: "tools/call",
        params: { name: "ask_codex", arguments: { text: "handler path" } },
      },
      makeHandlerExtra(),
    );
    const parsed = parseAskCodexTextResult(result);

    expect(parsed.outcome).toBe("turn_completed");
    expect(parsed.metadata.requestId).toBe("wait-handler");
  });

  test("handleAskCodex returns JSON text content and strips internal metadata", async () => {
    const adapter = createAdapter("pull");
    let observedMessage: any;
    let observedTimeoutMs = 0;

    adapter.setAskSender(
      (message: any, timeoutMs: number) => {
        observedMessage = message;
        observedTimeoutMs = timeoutMs;
        return {
          requestId: "wait-json",
          result: Promise.resolve(makeAskCodexResult("wait-json", {
            metadata: {
              taskId: "sdk-task-id",
              requireReply: true,
            } as any,
          })),
        };
      },
      () => false,
    );

    const result = await adapter.handleAskCodex({
      text: "ask body",
      chat_id: "codex_chat",
      timeout_ms: 20000,
    });
    const parsed = parseAskCodexTextResult(result);

    expect(observedMessage).toMatchObject({
      id: "codex_chat",
      source: "claude",
      content: "ask body",
    });
    expect(observedTimeoutMs).toBe(20000);
    expect(parsed.metadata.taskId).toBeNull();
    expect((parsed.metadata as any).requireReply).toBeUndefined();
  });

  test("timeout_ms clamp applies low bound, high bound, and default", async () => {
    const adapter = createAdapter("pull");
    const observedTimeouts: number[] = [];

    adapter.setAskSender(
      (_message: any, timeoutMs: number) => {
        observedTimeouts.push(timeoutMs);
        const requestId = `wait-timeout-${observedTimeouts.length}`;
        return {
          requestId,
          result: Promise.resolve(makeAskCodexResult(requestId)),
        };
      },
      () => false,
    );

    await adapter.handleAskCodex({ text: "low", timeout_ms: 5000 });
    await adapter.handleAskCodex({ text: "high", timeout_ms: 9000000 });
    await adapter.handleAskCodex({ text: "default" });

    expect(observedTimeouts).toEqual([10000, 7200000, 600000]);
  });

  test("busy outcome is propagated unchanged", async () => {
    const adapter = createAdapter("pull");
    const busyResult = makeAskCodexResult("wait-busy", {
      outcome: "busy",
      messages: [],
      completionSignal: "agentbridge_busy",
      metadata: {
        active_request_id: "wait-active",
        retry_after_ms: 250,
        message_count: 0,
      },
    });
    adapter.setAskSender(
      () => ({
        requestId: "wait-busy",
        result: Promise.resolve(busyResult),
      }),
      () => false,
    );

    const result = await adapter.handleAskCodex({ text: "are you busy?" });
    const parsed = parseAskCodexTextResult(result);

    expect(parsed.outcome).toBe("busy");
    expect(parsed.completionSignal).toBe("agentbridge_busy");
    expect(parsed.metadata.active_request_id).toBe("wait-active");
    expect(parsed.metadata.retry_after_ms).toBe(250);
  });

  test("handleAskCodex returns bridge_error when ask sender is missing", async () => {
    const adapter = createAdapter("pull");

    const result = await adapter.handleAskCodex({ text: "no bridge" });
    const parsed = parseAskCodexTextResult(result);

    expect(parsed.outcome).toBe("bridge_error");
    expect(parsed.completionSignal).toBe("agentbridge_error");
    expect(parsed.metadata.taskId).toBeNull();
    expect(parsed.metadata.error).toContain("bridge not initialized");
  });

  test("handleAskCodex distinguishes missing text from empty or non-string text", async () => {
    const adapter = createAdapter("pull");

    const missing = await adapter.handleAskCodex({});
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toBe("Error: missing required parameter 'text'");

    for (const invalidText of ["", 0, null]) {
      const invalid = await adapter.handleAskCodex({ text: invalidText });
      expect(invalid.isError).toBe(true);
      expect(invalid.content[0].text).toBe("Error: 'text' must be a non-empty string");
    }
  });

  test("abort sends wait_cancel and never calls daemonClient.disconnect", async () => {
    const adapter = createAdapter("pull");
    const controller = new AbortController();
    const cancelCalls: Array<{ requestId: string; reason?: string }> = [];
    let disconnectCalls = 0;
    let resolveWait!: (result: AskCodexResult) => void;
    const daemonClient = {
      sendAskCodex: (_message: any, _timeoutMs: number) => ({
        requestId: "wait-abort",
        result: new Promise<AskCodexResult>((resolve) => {
          resolveWait = resolve;
        }),
      }),
      sendCancelWait: (requestId: string, reason?: string) => {
        cancelCalls.push({ requestId, reason });
        resolveWait(makeAskCodexResult(requestId, {
          outcome: "cancelled",
          messages: [],
          completionSignal: "agentbridge_cancelled",
          metadata: { message_count: 0 },
        }));
        return true;
      },
      disconnect: () => {
        disconnectCalls += 1;
      },
    };
    adapter.setAskSender(
      (message: any, timeoutMs: number) => daemonClient.sendAskCodex(message, timeoutMs),
      (requestId: string, reason?: string) => daemonClient.sendCancelWait(requestId, reason),
    );

    const pending = adapter.handleAskCodex({ text: "cancel me" }, controller.signal);
    controller.abort();
    const result = await pending;
    const parsed = parseAskCodexTextResult(result);

    expect(cancelCalls).toEqual([{ requestId: "wait-abort", reason: "abort_signal" }]);
    expect(disconnectCalls).toBe(0);
    expect(parsed.outcome).toBe("cancelled");
  });

  test("pre-aborted signal returns cancelled without creating a wait", async () => {
    const adapter = createAdapter("pull");
    const controller = new AbortController();
    let sendAskCalls = 0;
    adapter.setAskSender(
      () => {
        sendAskCalls += 1;
        return {
          requestId: "wait-should-not-exist",
          result: Promise.resolve(makeAskCodexResult("wait-should-not-exist")),
        };
      },
      () => false,
    );
    controller.abort();

    const result = await adapter.handleAskCodex({ text: "already cancelled" }, controller.signal);
    const parsed = parseAskCodexTextResult(result);

    expect(sendAskCalls).toBe(0);
    expect(parsed.outcome).toBe("cancelled");
    expect(parsed.completionSignal).toBe("agentbridge_cancelled");
  });

  test("ask sender exceptions map to bridge_error text result", async () => {
    const adapter = createAdapter("pull");
    adapter.setAskSender(
      () => {
        throw new Error("sender exploded");
      },
      () => false,
    );

    const result = await adapter.handleAskCodex({ text: "boom" });
    const parsed = parseAskCodexTextResult(result);

    expect(parsed.outcome).toBe("bridge_error");
    expect(parsed.completionSignal).toBe("agentbridge_error");
    expect(parsed.metadata.error).toContain("sender exploded");
  });
});
