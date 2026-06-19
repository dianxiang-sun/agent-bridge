import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { channelEnvFromProcessEnv } from "../channel-profile";
import { DaemonLifecycle } from "../daemon-lifecycle";
import { CodexAdapter } from "../codex-adapter";
import { StateDirResolver } from "../state-dir";

// PR3 — daemon-lifecycle / codex-adapter must spawn with the channel profile env
// EXPLICITLY bound, not relying on accidental process.env inheritance (design §2).
//
// Both tests run a CLEAN-env subprocess driver (NONE of the 6 channel keys in the
// parent env) and pass the profile only through constructor options. A fake daemon
// / fake codex shim dumps the env it actually received. This is what distinguishes
// "explicitly injected" from "happened to inherit" — the PR2 CLI e2e cannot, because
// the CLI mutates process.env so the child inherits regardless (red-team: false-green).

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));
const CHANNEL_KEYS = [
  "AGENTBRIDGE_CHANNEL_ID",
  "AGENTBRIDGE_CONTROL_PORT",
  "CODEX_WS_PORT",
  "CODEX_PROXY_PORT",
  "AGENTBRIDGE_STATE_DIR",
  "CODEX_HOME",
] as const;

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) {
    try { c(); } catch {}
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

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf-8").trim();
  return text ? text.split("\n").map((l) => JSON.parse(l) as T) : [];
}

// A parent env with NONE of the 6 channel keys — proves explicit injection, not
// inheritance. Only PATH/HOME (so spawned bun/codex still resolve) plus ABG_TEST_*.
function cleanEnv(extra: Record<string, string>): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    ...extra,
  };
}

describe("PR3 lifecycle/spawn explicit env (回归 design §2 '靠继承会丢')", () => {
  test("DaemonLifecycle.launch injects channelEnv into the daemon spawn from a clean-env parent", async () => {
    const base = mkdtempSync(join(tmpdir(), "abg-le-daemon-"));
    cleanups.push(() => rmSync(base, { recursive: true, force: true }));
    const stateDir = join(base, "state");
    const codexHome = join(base, "codex-home-A");
    const envLog = join(base, "daemon-launch.jsonl");
    const fakeDaemon = join(base, "fake-daemon.ts");
    const driver = join(base, "driver.ts");
    const controlPort = await getFreePort();

    // channelEnv carries the 4 keys launch() does NOT currently write explicitly
    // (CODEX_WS_PORT/CODEX_PROXY_PORT/CODEX_HOME/CHANNEL_ID) plus the 2 it does.
    const channelEnv = {
      AGENTBRIDGE_CHANNEL_ID: "A",
      AGENTBRIDGE_CONTROL_PORT: String(controlPort),
      CODEX_WS_PORT: "4510",
      CODEX_PROXY_PORT: "4511",
      AGENTBRIDGE_STATE_DIR: stateDir,
      CODEX_HOME: codexHome,
    };

    writeFileSync(fakeDaemon, `import { appendFileSync } from "node:fs";
const controlPort = Number.parseInt(process.env.AGENTBRIDGE_CONTROL_PORT ?? "0", 10);
appendFileSync(${JSON.stringify(envLog)}, JSON.stringify({ pid: process.pid, env: pick() }) + "\\n");
Bun.serve({ hostname: "127.0.0.1", port: controlPort, fetch(req) {
  const p = new URL(req.url).pathname;
  if (p === "/healthz" || p === "/readyz") return Response.json({ ok: true });
  return new Response("fake daemon");
} });
setInterval(() => {}, 1000);
function pick() { return Object.fromEntries(${JSON.stringify(CHANNEL_KEYS)}.map((k) => [k, process.env[k] ?? null])); }
`);

    writeFileSync(driver, `import { pathToFileURL } from "node:url";
const lc = await import(pathToFileURL(${JSON.stringify(join(SRC_DIR, "daemon-lifecycle.ts"))}).href);
const sd = await import(pathToFileURL(${JSON.stringify(join(SRC_DIR, "state-dir.ts"))}).href);
const channelEnv = JSON.parse(process.env.ABG_TEST_CHANNEL_ENV);
const lifecycle = new lc.DaemonLifecycle({
  stateDir: new sd.StateDirResolver(process.env.ABG_TEST_STATE_DIR),
  controlPort: Number.parseInt(process.env.ABG_TEST_CONTROL_PORT, 10),
  log: () => {},
  channelEnv,
});
await lifecycle.ensureRunning();
process.exit(0);
`);

    const r = spawnSync(process.execPath, ["run", driver], {
      env: cleanEnv({
        AGENTBRIDGE_DAEMON_ENTRY: fakeDaemon,
        ABG_TEST_STATE_DIR: stateDir,
        ABG_TEST_CONTROL_PORT: String(controlPort),
        ABG_TEST_CHANNEL_ENV: JSON.stringify(channelEnv),
      }),
      encoding: "utf-8",
      timeout: 20_000,
    });

    const launches = readJsonl<{ pid: number; env: Record<string, string | null> }>(envLog);
    cleanups.push(() => {
      for (const l of launches) {
        try { process.kill(l.pid, "SIGTERM"); } catch {}
      }
    });

    expect(r.status).toBe(0);
    expect(launches).toHaveLength(1);
    // The 4 keys launch() must now inject EXPLICITLY (clean parent has none of them):
    expect(launches[0].env.CODEX_WS_PORT).toBe("4510");
    expect(launches[0].env.CODEX_PROXY_PORT).toBe("4511");
    expect(launches[0].env.CODEX_HOME).toBe(codexHome);
    expect(launches[0].env.AGENTBRIDGE_CHANNEL_ID).toBe("A");
  });

  test("CodexAdapter.start spawns codex with CODEX_HOME explicitly from a clean-env parent", async () => {
    const base = mkdtempSync(join(tmpdir(), "abg-le-codex-"));
    cleanups.push(() => rmSync(base, { recursive: true, force: true }));
    const binDir = join(base, "bin");
    const codexHome = join(base, "codex-home-A");
    const envLog = join(base, "codex-spawn.jsonl");
    const driver = join(base, "driver.ts");
    mkdirSync(binDir, { recursive: true });
    const appPort = await getFreePort();
    let proxyPort = await getFreePort();
    if (proxyPort === appPort) proxyPort = await getFreePort();

    // fake `codex` shim on PATH: dumps received env, serves /healthz, accepts ws.
    writeFileSync(join(binDir, "codex"), `#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
const listen = args[args.indexOf("--listen") + 1];
const port = Number.parseInt(new URL(listen).port, 10);
appendFileSync(${JSON.stringify(envLog)}, JSON.stringify({ pid: process.pid, env: pick() }) + "\\n");
Bun.serve({ hostname: "127.0.0.1", port, fetch(req, server) {
  const p = new URL(req.url).pathname;
  if (p === "/healthz" || p === "/readyz") return Response.json({ ok: true });
  if (server.upgrade(req)) return undefined;
  return new Response("fake codex app-server");
}, websocket: { open() {}, message() {}, close() {} } });
setInterval(() => {}, 1000);
function pick() { return Object.fromEntries(${JSON.stringify(CHANNEL_KEYS)}.map((k) => [k, process.env[k] ?? null])); }
`, { mode: 0o755 });

    writeFileSync(driver, `import { pathToFileURL } from "node:url";
const mod = await import(pathToFileURL(${JSON.stringify(join(SRC_DIR, "codex-adapter.ts"))}).href);
const channelEnv = JSON.parse(process.env.ABG_TEST_CHANNEL_ENV);
const adapter = new mod.CodexAdapter(
  Number.parseInt(process.env.ABG_TEST_APP_PORT, 10),
  Number.parseInt(process.env.ABG_TEST_PROXY_PORT, 10),
  ${JSON.stringify(join(base, "adapter.log"))},
  { channelEnv },
);
await adapter.start();
adapter.stop();
process.exit(0);
`);

    const channelEnv = {
      AGENTBRIDGE_CHANNEL_ID: "A",
      AGENTBRIDGE_CONTROL_PORT: String(appPort + 2),
      CODEX_WS_PORT: String(appPort),
      CODEX_PROXY_PORT: String(proxyPort),
      AGENTBRIDGE_STATE_DIR: join(base, "state"),
      CODEX_HOME: codexHome,
    };

    const r = spawnSync(process.execPath, ["run", driver], {
      env: cleanEnv({
        // PATH includes our fake codex dir; channelEnv deliberately has NO PATH,
        // so a correct merge keeps PATH (codex resolvable); an env REPLACE drops
        // it and codex fails to spawn (red-team path 4).
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        ABG_TEST_APP_PORT: String(appPort),
        ABG_TEST_PROXY_PORT: String(proxyPort),
        ABG_TEST_CHANNEL_ENV: JSON.stringify(channelEnv),
      }),
      encoding: "utf-8",
      timeout: 25_000,
    });

    const spawns = readJsonl<{ pid: number; env: Record<string, string | null> }>(envLog);
    cleanups.push(() => {
      for (const s of spawns) {
        try { process.kill(s.pid, "SIGTERM"); } catch {}
      }
    });

    expect(r.status).toBe(0);
    expect(spawns).toHaveLength(1);
    // Assert the FULL 6-key tuple reached codex (not just CODEX_HOME) — guards against
    // a future buildSpawnEnv that only forwards CODEX_HOME (Codex Round 2 red-team #1).
    expect(spawns[0].env).toEqual(channelEnv);
  });
});

describe("channelEnvFromProcessEnv (named-gated extraction, 零回归)", () => {
  test("no AGENTBRIDGE_CHANNEL_ID → undefined (legacy/default — manual CODEX_HOME stays untouched)", () => {
    expect(channelEnvFromProcessEnv({ CODEX_HOME: "/x", PATH: "/usr/bin" })).toBeUndefined();
    expect(channelEnvFromProcessEnv({})).toBeUndefined();
  });
  test("CHANNEL_ID present + all 6 keys → returns the 6-key record", () => {
    const env = {
      AGENTBRIDGE_CHANNEL_ID: "A",
      AGENTBRIDGE_CONTROL_PORT: "4512",
      CODEX_WS_PORT: "4510",
      CODEX_PROXY_PORT: "4511",
      AGENTBRIDGE_STATE_DIR: "/s/A",
      CODEX_HOME: "/h/A",
    };
    expect(channelEnvFromProcessEnv(env)).toEqual(env);
  });
  test("CHANNEL_ID present but incomplete → fail-closed throw", () => {
    expect(() => channelEnvFromProcessEnv({ AGENTBRIDGE_CHANNEL_ID: "A", CODEX_HOME: "/h/A" }))
      .toThrow(/incomplete channel env/i);
  });
});

describe("PR3 split-brain guard (red-team path 1: channelEnv conflicts with constructor)", () => {
  test("DaemonLifecycle throws when channelEnv control port ≠ constructor controlPort", () => {
    expect(() => new DaemonLifecycle({
      stateDir: new StateDirResolver("/tmp/abg-mismatch-state"),
      controlPort: 4512,
      log: () => {},
      channelEnv: { AGENTBRIDGE_CONTROL_PORT: "9999", CODEX_HOME: "/h" },
    })).toThrow(/mismatch/i);
  });
  test("DaemonLifecycle throws when channelEnv state dir ≠ constructor stateDir", () => {
    expect(() => new DaemonLifecycle({
      stateDir: new StateDirResolver("/tmp/abg-mismatch-state"),
      controlPort: 4512,
      log: () => {},
      channelEnv: { AGENTBRIDGE_CONTROL_PORT: "4512", AGENTBRIDGE_STATE_DIR: "/tmp/other-dir" },
    })).toThrow(/mismatch/i);
  });
  test("CodexAdapter throws when channelEnv CODEX_WS_PORT ≠ constructor appPort", () => {
    expect(() => new CodexAdapter(4510, 4511, "/tmp/x.log", {
      channelEnv: { CODEX_WS_PORT: "9999" },
    })).toThrow(/mismatch/i);
  });
  test("matching channelEnv does NOT throw (consistent profile is the normal path)", () => {
    expect(() => new CodexAdapter(4510, 4511, "/tmp/x.log", {
      channelEnv: { CODEX_WS_PORT: "4510", CODEX_PROXY_PORT: "4511", CODEX_HOME: "/h/A" },
    })).not.toThrow();
  });
});
