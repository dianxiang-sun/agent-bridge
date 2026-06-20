import { afterEach, describe, expect, test } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

// PR5 task 5.5 — two-channel zero-crosstalk E2E (design doc 契约3).
//
// Launches TWO REAL daemon.ts processes (channelId A and B) on disjoint high free ports
// (NEVER 4500-4502, so the live default bridge is never disturbed), each with its own temp
// stateDir / HOME / CODEX_HOME and a fake `codex` shim on PATH. It then drives the FULL real
// route end to end for each channel:
//
//   fake TUI  ──ws──▶ daemon proxy port ─▶ CodexAdapter.onTuiConnect  (emit tuiConnected)
//   fake TUI  ──thread/start──▶ proxy (id→proxyId) ─▶ fake app-server (echo id, return thread.id)
//                                                   ─▶ setActiveThreadId → emit "ready" → markBridgeReady
//   fake Claude ──ws──▶ daemon control /ws ─▶ claude_connect (attach) ─▶ claude_to_codex {source:"claude", token}
//                       ─▶ canReply() gate ─▶ codex.injectMessage ─▶ turn/start ─▶ fake app-server writes JSONL
//
// Hard assertion: channel A's unique token only ever lands in A's app-server turn log and B's
// only in B's — cross logs are empty. Proves message routing isolation, not just healthz identity.

const DAEMON_PATH = fileURLToPath(new URL("../daemon.ts", import.meta.url));

interface DaemonHandle {
  proc: ChildProcess;
  base: string;
  channelId: string;
  controlPort: number;
  appPort: number;
  proxyPort: number;
  turnLog: string;
}

const running: DaemonHandle[] = [];
const openSockets: WebSocket[] = [];

afterEach(async () => {
  // Close fake TUI / Claude sockets first, then kill daemons (their SIGTERM path stops the
  // fake codex child), then remove temp dirs. Order matters to avoid orphaned children.
  for (const ws of openSockets.splice(0)) {
    try { ws.close(); } catch {}
  }
  for (const h of running.splice(0)) {
    await killDaemon(h);
    try { rmSync(h.base, { recursive: true, force: true }); } catch {}
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

/** Three distinct free ports, explicitly excluding the live default bridge's 4500-4502. */
async function threeFreePorts(): Promise<[number, number, number]> {
  const forbidden = new Set([4500, 4501, 4502]);
  const ports = new Set<number>();
  while (ports.size < 3) {
    const p = await getFreePort();
    if (!forbidden.has(p)) ports.add(p);
  }
  return [...ports] as [number, number, number];
}

/** fake `codex` app-server shim. Echoes request ids exactly (proxy maps proxyId↔clientId), returns a
 *  thread id on thread/start (so CodexAdapter emits "ready"), and appends every turn/start's input
 *  text to a per-channel JSONL. ONLY the turn/start handler writes token logs — nothing else may. */
function writeFakeCodexE2E(binDir: string) {
  writeFileSync(
    join(binDir, "codex"),
    `#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
const listen = args[args.indexOf("--listen") + 1];
const port = Number.parseInt(new URL(listen).port, 10);
const turnLog = process.env.AGENTBRIDGE_E2E_TURN_LOG || "";
const channelId = process.env.AGENTBRIDGE_CHANNEL_ID || "default";
Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch(req, server) {
    const p = new URL(req.url).pathname;
    if (p === "/healthz" || p === "/readyz") return Response.json({ ok: true });
    if (server.upgrade(req)) return undefined;
    return new Response("fake codex app-server");
  },
  websocket: {
    open() {},
    message(ws, raw) {
      let msg;
      try { msg = JSON.parse(typeof raw === "string" ? raw : raw.toString()); } catch (e) { return; }
      const method = msg.method;
      if (method === "initialize") {
        ws.send(JSON.stringify({ id: msg.id, result: {} }));
      } else if (method === "thread/start") {
        const tid = channelId + "-thread-" + msg.id;
        ws.send(JSON.stringify({ id: msg.id, result: { thread: { id: tid } } }));
      } else if (method === "turn/start") {
        const params = msg.params || {};
        const input = Array.isArray(params.input) ? params.input : [];
        const text = input.map((i) => (i && typeof i.text === "string" ? i.text : "")).join("");
        const threadId = params.threadId;
        if (turnLog) {
          appendFileSync(turnLog, JSON.stringify({ channelId, method, id: msg.id, threadId, text, ts: Date.now() }) + "\\n");
        }
        ws.send(JSON.stringify({ id: msg.id, result: { turn: { id: "turn-" + msg.id }, thread: { id: threadId } } }));
      }
    },
    close() {},
  },
});
setInterval(() => {}, 1000);
`,
    { mode: 0o755 },
  );
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function killDaemon(h: DaemonHandle): Promise<void> {
  // Capture the codex app-server child pid BEFORE killing. If the daemon is SIGKILLed (the fallback),
  // its shutdown()/codex.stop() never runs, so the fake codex (setInterval keep-alive) would orphan.
  let codexPid: number | undefined;
  try {
    const hz = await fetchHealthz(h.controlPort);
    // Identity-gate the pid source (Codex R3): only trust codexAppServerPid if this healthz truly
    // belongs to THIS test daemon (own channelId + own high control port), never the live bridge.
    if (hz?.channelId === h.channelId && hz?.controlPort === h.controlPort && typeof hz?.codexAppServerPid === "number") {
      codexPid = hz.codexAppServerPid;
    }
  } catch {}

  await new Promise<void>((resolve) => {
    if (h.proc.exitCode !== null) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    h.proc.once("exit", finish);
    try { h.proc.kill("SIGTERM"); } catch { finish(); }
    setTimeout(() => { try { h.proc.kill("SIGKILL"); } catch {} finish(); }, 2500);
  });

  // Make sure the fake codex child is actually gone; reap it explicitly if the daemon couldn't.
  if (codexPid !== undefined) {
    for (let i = 0; i < 20 && isAlive(codexPid); i++) await sleep(100);
    if (isAlive(codexPid)) { try { process.kill(codexPid, "SIGKILL"); } catch {} }
  }
}

async function waitReadyz(controlPort: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${controlPort}/readyz`);
      if (r.status === 200) return;
      last = `status ${r.status}`;
    } catch (e: any) {
      last = e?.message ?? String(e);
    }
    await sleep(150);
  }
  throw new Error(`daemon /readyz never returned 200 within ${timeoutMs}ms (last: ${last})`);
}

async function fetchHealthz(controlPort: number): Promise<any> {
  const r = await fetch(`http://127.0.0.1:${controlPort}/healthz`);
  return await r.json();
}

async function pollHealthz(controlPort: number, predicate: (s: any) => boolean, timeoutMs: number): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let last: any = null;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${controlPort}/healthz`);
      if (r.ok) {
        last = await r.json();
        if (predicate(last)) return last;
      }
    } catch {}
    await sleep(100);
  }
  throw new Error(`healthz predicate not met within ${timeoutMs}ms (last: ${JSON.stringify(last)})`);
}

function wsOpen(ws: WebSocket, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ws open timeout")), timeoutMs);
    ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("ws error before open")); }, { once: true });
  });
}

/** Send a JSON-RPC request on the TUI proxy socket and await the response carrying the same id.
 *  The proxy rewrites ids to a global proxyId on the way out and maps them back to the client id
 *  on the way in, so the fake TUI sees the original id it sent. */
function tuiRpc(ws: WebSocket, req: Record<string, unknown>, expectId: number, timeoutMs = 6000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener("message", onMsg);
      reject(new Error(`tui rpc timeout: ${String(req.method)} (id ${expectId})`));
    }, timeoutMs);
    function onMsg(ev: any) {
      let m: any;
      try { m = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)); } catch { return; }
      if (m && m.id === expectId) {
        clearTimeout(timer);
        ws.removeEventListener("message", onMsg);
        resolve(m);
      }
    }
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify(req));
  });
}

/** Send a control-protocol message and await the first server message matching the predicate. */
function controlRpc(
  ws: WebSocket,
  payload: Record<string, unknown>,
  predicate: (m: any) => boolean,
  timeoutMs = 8000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener("message", onMsg);
      reject(new Error("control rpc timeout"));
    }, timeoutMs);
    function onMsg(ev: any) {
      let m: any;
      try { m = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)); } catch { return; }
      if (predicate(m)) {
        clearTimeout(timer);
        ws.removeEventListener("message", onMsg);
        resolve(m);
      }
    }
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify(payload));
  });
}

async function launchDaemonE2E(channelId: string): Promise<DaemonHandle> {
  const base = mkdtempSync(join(tmpdir(), "abg-e2e-"));
  const binDir = join(base, "bin");
  mkdirSync(binDir, { recursive: true });
  mkdirSync(join(base, "home"), { recursive: true });
  writeFakeCodexE2E(binDir);
  const [controlPort, appPort, proxyPort] = await threeFreePorts();
  const turnLog = join(base, "turns.jsonl");

  const env: Record<string, string> = {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH ?? ""}`,
    HOME: join(base, "home"),
    AGENTBRIDGE_CHANNEL_ID: channelId,
    AGENTBRIDGE_CONTROL_PORT: String(controlPort),
    CODEX_WS_PORT: String(appPort),
    CODEX_PROXY_PORT: String(proxyPort),
    AGENTBRIDGE_STATE_DIR: join(base, "state"),
    CODEX_HOME: join(base, "codex-home"),
    AGENTBRIDGE_E2E_TURN_LOG: turnLog,
    AGENTBRIDGE_IDLE_SHUTDOWN_MS: "120000",
  } as Record<string, string>;

  const proc = spawn(process.execPath, ["run", DAEMON_PATH], { env, stdio: "pipe" });
  const handle: DaemonHandle = { proc, base, channelId, controlPort, appPort, proxyPort, turnLog };
  running.push(handle);

  // /readyz 200 ⇒ codex.start() completed (proxy + app-server ws up), before the TUI handshake.
  await waitReadyz(controlPort, 25000);
  return handle;
}

/** Connect a fake TUI to the proxy, run initialize → thread/start, then wait until the daemon's
 *  canReply() is true for this channel (healthz.bridgeReady === canReply()). Returns the live socket;
 *  it MUST stay open through the Claude send, or onTuiConnect resetting threadId would break canReply. */
async function fakeTuiHandshake(h: DaemonHandle): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${h.proxyPort}`);
  openSockets.push(ws);
  await wsOpen(ws);
  await tuiRpc(ws, { method: "initialize", id: 1, params: {} }, 1);
  const resp = await tuiRpc(ws, { method: "thread/start", id: 2, params: {} }, 2);
  const threadId = resp?.result?.thread?.id;
  if (typeof threadId !== "string" || threadId.length === 0) {
    throw new Error(`fake TUI ${h.channelId}: thread/start returned no thread.id (${JSON.stringify(resp)})`);
  }
  await pollHealthz(
    h.controlPort,
    (s) => s.channelId === h.channelId && s.bridgeReady === true && s.tuiConnected === true && s.threadId === threadId,
    12000,
  );
  return ws;
}

/** Connect a fake Claude to the control port, attach, and send one claude_to_codex carrying `content`.
 *  Asserts the daemon accepted it (claude_to_codex_result.success). */
async function fakeClaudeSend(h: DaemonHandle, content: string): Promise<void> {
  const ws = new WebSocket(`ws://127.0.0.1:${h.controlPort}/ws`);
  openSockets.push(ws);
  await wsOpen(ws);

  const status = await controlRpc(ws, { type: "claude_connect" }, (m) => m && m.type === "status", 5000);
  if (status.status?.channelId !== h.channelId) {
    throw new Error(`claude_connect on ${h.channelId} got status.channelId=${status.status?.channelId}`);
  }

  const requestId = "req-" + randomUUID();
  const result = await controlRpc(
    ws,
    {
      type: "claude_to_codex",
      requestId,
      message: { id: "m-" + randomUUID(), source: "claude", content, timestamp: Date.now() },
    },
    (m) => m && m.type === "claude_to_codex_result" && m.requestId === requestId,
    8000,
  );
  if (!result.success) {
    throw new Error(`claude_to_codex rejected on ${h.channelId}: ${result.error}`);
  }
}

function readTurnLog(path: string): any[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

async function waitForToken(path: string, token: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (readTurnLog(path).some((e) => typeof e.text === "string" && e.text.includes(token))) return;
    await sleep(100);
  }
  throw new Error(`token never appeared in ${path}: ${token}`);
}

/** After both positive tokens have landed, hold sockets open and keep polling BOTH logs for a quiet
 *  window, failing fast if the other channel's token ever shows up late (delayed-replay crosstalk). */
async function assertNoLateCrosstalk(
  a: DaemonHandle,
  b: DaemonHandle,
  tokenA: string,
  tokenB: string,
  windowMs: number,
): Promise<void> {
  const deadline = Date.now() + windowMs;
  while (Date.now() < deadline) {
    if (readTurnLog(a.turnLog).some((e) => typeof e.text === "string" && e.text.includes(tokenB))) {
      throw new Error("late crosstalk: tokenB appeared in A's turn log during quiet window");
    }
    if (readTurnLog(b.turnLog).some((e) => typeof e.text === "string" && e.text.includes(tokenA))) {
      throw new Error("late crosstalk: tokenA appeared in B's turn log during quiet window");
    }
    await sleep(100);
  }
}

describe("PR5 task 5.5 — two-channel zero-crosstalk E2E (契约3)", () => {
  test("A's Claude message reaches only A's Codex and B's only B's (full real routing)", async () => {
    // High-entropy, non-overlapping tokens so a substring match cannot cause a false pass.
    const tokenA = "ABG_E2E_A_" + randomUUID();
    const tokenB = "ABG_E2E_B_" + randomUUID();
    expect(tokenA.includes(tokenB)).toBe(false);
    expect(tokenB.includes(tokenA)).toBe(false);

    const A = await launchDaemonE2E("A");
    const B = await launchDaemonE2E("B");

    // Isolation sanity (defends "shared port / shared log path" false greens).
    const ports = [A.controlPort, A.appPort, A.proxyPort, B.controlPort, B.appPort, B.proxyPort];
    expect(new Set(ports).size).toBe(6);
    for (const p of ports) expect([4500, 4501, 4502]).not.toContain(p);
    expect(A.turnLog).not.toBe(B.turnLog);
    expect(A.base).not.toBe(B.base);

    // Four-party handshake on each channel (sockets kept alive via openSockets).
    await fakeTuiHandshake(A);
    await fakeTuiHandshake(B);

    const hzA = await fetchHealthz(A.controlPort);
    const hzB = await fetchHealthz(B.controlPort);
    expect(hzA.channelId).toBe("A");
    expect(hzB.channelId).toBe("B");

    // Send both channels' tokens CONCURRENTLY to maximize the chance of surfacing any crosstalk.
    await Promise.all([fakeClaudeSend(A, tokenA), fakeClaudeSend(B, tokenB)]);

    await waitForToken(A.turnLog, tokenA, 8000);
    await waitForToken(B.turnLog, tokenB, 8000);

    // Quiet window: keep sockets open and keep checking both logs, to catch any DELAYED crosstalk
    // (a replay/duplication bug landing the other channel's token 50-500ms late) — Codex R2 risk 1.
    await assertNoLateCrosstalk(A, B, tokenA, tokenB, 600);

    const logA = readTurnLog(A.turnLog);
    const logB = readTurnLog(B.turnLog);

    // Count token-specific entries (NOT total lines — daemon may inject an extra "AgentBridge
    // connected" turn that carries neither token).
    const aHasA = logA.filter((e) => typeof e.text === "string" && e.text.includes(tokenA));
    const aHasB = logA.filter((e) => typeof e.text === "string" && e.text.includes(tokenB));
    const bHasB = logB.filter((e) => typeof e.text === "string" && e.text.includes(tokenB));
    const bHasA = logB.filter((e) => typeof e.text === "string" && e.text.includes(tokenA));

    expect(aHasA.length).toBeGreaterThanOrEqual(1);
    expect(aHasB.length).toBe(0); // tokenB NEVER leaks into A's Codex
    expect(bHasB.length).toBeGreaterThanOrEqual(1);
    expect(bHasA.length).toBe(0); // tokenA NEVER leaks into B's Codex

    // The carrying entry is a real turn/start bound to that channel's own thread.
    expect(aHasA[0].method).toBe("turn/start");
    expect(aHasA[0].threadId).toBe(hzA.threadId);
    expect(bHasB[0].method).toBe("turn/start");
    expect(bHasB[0].threadId).toBe(hzB.threadId);
  }, 60000);
});
