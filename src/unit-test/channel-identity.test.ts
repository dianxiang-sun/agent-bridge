import { afterEach, describe, expect, test } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { connect, createServer } from "node:net";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DaemonLifecycle } from "../daemon-lifecycle";
import { CodexAdapter } from "../codex-adapter";
import { StateDirResolver } from "../state-dir";

// PR4 — channel identity (契约1) + checkPorts (契约8).
// Launches the REAL daemon.ts on high free ports (never 4500-4502) under a temp state
// dir, with a fake `codex` shim on PATH so bootCodex never spawns real codex and the
// live bridge is never disturbed. The daemon control server's /healthz comes up from
// startControlServer() independently of bootCodex, so identity assertions are fast.

const DAEMON_PATH = fileURLToPath(new URL("../daemon.ts", import.meta.url));

interface DaemonHandle {
  proc: ChildProcess;
  base: string;
  controlPort: number;
  appPort: number;
  proxyPort: number;
}

const running: DaemonHandle[] = [];

afterEach(async () => {
  for (const h of running.splice(0)) {
    await new Promise<void>((resolve) => {
      if (h.proc.exitCode !== null) return resolve();
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      h.proc.once("exit", finish);
      try { h.proc.kill("SIGTERM"); } catch { finish(); }
      setTimeout(() => { try { h.proc.kill("SIGKILL"); } catch {} finish(); }, 2500);
    });
    try { rmSync(h.base, { recursive: true, force: true }); } catch {}
  }
});

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

async function threeFreePorts(): Promise<[number, number, number]> {
  const ports = new Set<number>();
  while (ports.size < 3) ports.add(await getFreePort());
  return [...ports] as [number, number, number];
}

async function readStatusJson(base: string): Promise<Record<string, unknown>> {
  const p = join(base, "state", "status.json");
  for (let i = 0; i < 60; i++) {
    try { return JSON.parse(readFileSync(p, "utf-8")); } catch {}
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error("status.json was never written");
}

/** fake `codex` shim: serves /healthz + accepts ws on its --listen port so the daemon's
 *  CodexAdapter.start() completes without real codex. */
function writeFakeCodex(binDir: string) {
  writeFileSync(join(binDir, "codex"), `#!/usr/bin/env bun
const args = process.argv.slice(2);
const listen = args[args.indexOf("--listen") + 1];
const port = Number.parseInt(new URL(listen).port, 10);
Bun.serve({ hostname: "127.0.0.1", port, fetch(req, server) {
  const p = new URL(req.url).pathname;
  if (p === "/healthz" || p === "/readyz") return Response.json({ ok: true });
  if (server.upgrade(req)) return undefined;
  return new Response("fake codex app-server");
}, websocket: { open() {}, message() {}, close() {} } });
setInterval(() => {}, 1000);
`, { mode: 0o755 });
}

async function launchDaemon(channelId: string | null): Promise<DaemonHandle> {
  const base = mkdtempSync(join(tmpdir(), "abg-id-"));
  const binDir = join(base, "bin");
  mkdirSync(binDir, { recursive: true });
  mkdirSync(join(base, "home"), { recursive: true });
  writeFakeCodex(binDir);
  const [controlPort, appPort, proxyPort] = await threeFreePorts();

  const env: Record<string, string> = {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH ?? ""}`,
    HOME: join(base, "home"),
    AGENTBRIDGE_CONTROL_PORT: String(controlPort),
    CODEX_WS_PORT: String(appPort),
    CODEX_PROXY_PORT: String(proxyPort),
    AGENTBRIDGE_STATE_DIR: join(base, "state"),
    CODEX_HOME: join(base, "codex-home"),
    AGENTBRIDGE_IDLE_SHUTDOWN_MS: "60000",
  } as Record<string, string>;
  if (channelId) env.AGENTBRIDGE_CHANNEL_ID = channelId;
  else delete env.AGENTBRIDGE_CHANNEL_ID;

  const proc = spawn(process.execPath, ["run", DAEMON_PATH], { env, stdio: "pipe" });
  const handle: DaemonHandle = { proc, base, controlPort, appPort, proxyPort };
  running.push(handle);

  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${controlPort}/healthz`);
      if (r.ok) break;
    } catch {}
    await new Promise((res) => setTimeout(res, 200));
  }
  return handle;
}

describe("PR4 channel identity — healthz (契约1)", () => {
  test("named channel healthz returns channelId + controlPort + pid", async () => {
    const h = await launchDaemon("A");
    const res = await fetch(`http://127.0.0.1:${h.controlPort}/healthz`);
    expect(res.ok).toBe(true);
    const j = (await res.json()) as { channelId?: string; controlPort?: number; pid?: number };
    expect(j.channelId).toBe("A");
    expect(j.controlPort).toBe(h.controlPort);
    expect(typeof j.pid).toBe("number");
  }, 25000);

  test("default channel (no AGENTBRIDGE_CHANNEL_ID) healthz channelId='default' (零回归 additive)", async () => {
    const h = await launchDaemon(null);
    const res = await fetch(`http://127.0.0.1:${h.controlPort}/healthz`);
    const j = (await res.json()) as { channelId?: string };
    expect(j.channelId).toBe("default");
  }, 25000);
});

describe("PR4 verifyChannelIdentity (Task 4.3 契约1)", () => {
  function namedLifecycle(port: number, stateDir: string) {
    return new DaemonLifecycle({
      stateDir: new StateDirResolver(stateDir),
      controlPort: port,
      log: () => {},
      channelEnv: {
        AGENTBRIDGE_CHANNEL_ID: "A",
        AGENTBRIDGE_CONTROL_PORT: String(port),
        CODEX_WS_PORT: "40001",
        CODEX_PROXY_PORT: "40002",
        AGENTBRIDGE_STATE_DIR: stateDir,
        CODEX_HOME: "/tmp/abg-vci-home",
      },
    });
  }

  test("named: rejects when healthz channelId mismatches profile (防 kill B 误杀 A)", async () => {
    const port = await getFreePort();
    const srv = Bun.serve({ port, hostname: "127.0.0.1", fetch: () => Response.json({ channelId: "WRONG", controlPort: port, pid: 99 }) });
    try {
      const lc = namedLifecycle(port, "/tmp/abg-vci-mismatch");
      await expect(lc.verifyChannelIdentity("kill")).rejects.toThrow(/mismatch/i);
    } finally { srv.stop(true); }
  }, 10000);

  test("named: resolves when channelId + controlPort match", async () => {
    const port = await getFreePort();
    const srv = Bun.serve({ port, hostname: "127.0.0.1", fetch: () => Response.json({ channelId: "A", controlPort: port, pid: 99 }) });
    try {
      const lc = namedLifecycle(port, "/tmp/abg-vci-match");
      await lc.verifyChannelIdentity("attach"); // must not throw
    } finally { srv.stop(true); }
  }, 10000);

  test("default: skips hard identity (no channelEnv → no fetch even if unreachable)", async () => {
    const lc = new DaemonLifecycle({ stateDir: new StateDirResolver("/tmp/abg-vci-default"), controlPort: 59998, log: () => {} });
    await lc.verifyChannelIdentity("kill"); // returns immediately, no server needed
  }, 10000);
});

describe("PR4 checkPorts wiring (Task 4.4 契约8)", () => {
  test("named daemon records codexAppServerPid in status.json (onAppServerSpawned chain)", async () => {
    const h = await launchDaemon("A");
    const status = await readStatusJson(h.base);
    expect(typeof status.codexAppServerPid).toBe("number");
  }, 25000);
});

describe("PR4 status.json + log channelId (Task 4.2)", () => {
  test("named: status.json carries channelId + log prefix is [channel:A]", async () => {
    const h = await launchDaemon("A");
    const status = await readStatusJson(h.base);
    expect(status.channelId).toBe("A");
    const log = readFileSync(join(h.base, "state", "agentbridge.log"), "utf-8");
    expect(log).toContain("[channel:A]");
  }, 25000);

  test("default: status.json channelId='default' + log keeps [AgentBridgeDaemon] grep-able (零回归)", async () => {
    const h = await launchDaemon(null);
    const status = await readStatusJson(h.base);
    expect(status.channelId).toBe("default");
    const log = readFileSync(join(h.base, "state", "agentbridge.log"), "utf-8");
    expect(log).toContain("[AgentBridgeDaemon]");
  }, 25000);
});

describe("PR4 checkPorts listener-only integration (Task 4.4 — Codex R2 blocker fix)", () => {
  test("named: a neighbor codex app-server (pid != recorded) is NOT killed even with a separate active client on the port", async () => {
    const base = mkdtempSync(join(tmpdir(), "abg-cp-"));
    const binDir = join(base, "bin");
    mkdirSync(binDir, { recursive: true });
    writeFakeCodex(binDir);
    const [appPort, proxyPort] = await threeFreePorts();
    const statusFile = join(base, "status.json");

    // Occupant: a codex app-server LISTENING on appPort (separate process).
    const occupant = spawn(process.execPath, ["run", join(binDir, "codex"), "app-server", "--listen", `ws://127.0.0.1:${appPort}`], { stdio: "ignore" });
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(`http://127.0.0.1:${appPort}/healthz`); if (r.ok) break; } catch {}
      await new Promise((res) => setTimeout(res, 100));
    }
    // A SEPARATE active client connection — plain `lsof -ti :port` would also list THIS
    // process's pid; listener-only discovery must ignore it.
    const client = connect(appPort, "127.0.0.1");
    await new Promise<void>((res) => { client.once("connect", () => res()); client.once("error", () => res()); });

    // status.json records a DIFFERENT pid → the occupant is a neighbor, not ours.
    writeFileSync(statusFile, JSON.stringify({ codexAppServerPid: (occupant.pid ?? 0) + 100000 }));

    const adapter = new CodexAdapter(appPort, proxyPort, join(base, "log"), {
      channelId: "A",
      statusFile,
      channelEnv: {
        AGENTBRIDGE_CHANNEL_ID: "A",
        AGENTBRIDGE_CONTROL_PORT: String(appPort + 5),
        CODEX_WS_PORT: String(appPort),
        CODEX_PROXY_PORT: String(proxyPort),
        AGENTBRIDGE_STATE_DIR: base,
        CODEX_HOME: join(base, "h"),
      },
    });

    let threw = false;
    try {
      await adapter.start();
    } catch (e: any) {
      threw = true;
      expect(e.message).toMatch(/occupied|refusing|blocked/i);
    }
    const occupantAlive = (() => { try { process.kill(occupant.pid!, 0); return true; } catch { return false; } })();

    client.destroy();
    try { occupant.kill("SIGKILL"); } catch {}
    try { adapter.stop(); } catch {}
    rmSync(base, { recursive: true, force: true });

    expect(threw).toBe(true);         // named refused to reclaim the neighbor's port
    expect(occupantAlive).toBe(true); // neighbor codex app-server NOT killed
  }, 25000);
});
