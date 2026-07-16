import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = process.env.ABG_REPO_SRC_DIR ?? fileURLToPath(new URL("..", import.meta.url));
const CLI_PATH = process.env.ABG_CLI_PATH ?? join(SRC_DIR, "cli.ts");
const CHANNEL_KEYS = [
  "AGENTBRIDGE_CHANNEL_ID",
  "AGENTBRIDGE_CONTROL_PORT",
  "CODEX_WS_PORT",
  "CODEX_PROXY_PORT",
  "AGENTBRIDGE_STATE_DIR",
  "CODEX_HOME",
] as const;
interface Harness {
  root: string;
  home: string;
  project: string;
  bin: string;
  logs: string;
  rootCodexHome: string;
  fakeDaemon: string;
  fakeBridge: string;
  launchLog: string;
}
const harnesses: Harness[] = [];

afterEach(() => {
  for (const h of harnesses.splice(0)) {
    for (const launch of readJsonl<{ pid: number }>(h.launchLog)) {
      try { process.kill(launch.pid, "SIGTERM"); } catch {}
    }
    rmSync(h.root, { recursive: true, force: true });
  }
});

describe("PR2 channel CLI regressions", () => {
  test("rejected claude --channel command does not allocate a channel", () => {
    const h = makeHarness();
    const r = runCli(h, ["claude", "--channel", "A", "--channels", "manual"]);

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('"--channels" is automatically set by agentbridge claude');
    expect(readRegistry(h)?.channels?.A).toBeUndefined();
  });

  test("claude --channel injects all channel env and strips --channel before native claude", () => {
    const h = makeHarness();
    installClaudeShim(h);

    const r = runCli(h, ["claude", "--channel", "A", "--resume"]);

    expect(r.status).toBe(0);
    const profile = readRegistry(h)?.channels?.A;
    expect(profile).toBeTruthy();

    const claude = readJsonl<{ args: string[]; env: Record<string, string | null> }>(join(h.logs, "claude.jsonl"));
    expect(claude).toHaveLength(1);
    expect(claude[0].args).toEqual([
      "--dangerously-load-development-channels",
      "plugin:agentbridge@agentbridge",
      "--resume",
    ]);
    expect(claude[0].args).not.toContain("--channel");
    expect(claude[0].args).not.toContain("A");

    const launches = readJsonl<{ env: Record<string, string | null> }>(h.launchLog);
    expect(launches).toHaveLength(1);
    expect(launches[0].env).toEqual({
      AGENTBRIDGE_CHANNEL_ID: "A",
      AGENTBRIDGE_CONTROL_PORT: String(profile.controlPort),
      CODEX_WS_PORT: String(profile.codexAppPort),
      CODEX_PROXY_PORT: String(profile.codexProxyPort),
      AGENTBRIDGE_STATE_DIR: profile.stateDir,
      CODEX_HOME: profile.codexHome,
    });
  });
});

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), "abg-pr2-regression-"));
  const h = {
    root,
    home: join(root, "home"),
    project: join(root, "project"),
    bin: join(root, "bin"),
    logs: join(root, "logs"),
    rootCodexHome: join(root, "root-codex-home"),
    fakeDaemon: join(root, "fake-daemon.ts"),
    fakeBridge: join(root, "fake-bridge.ts"),
    launchLog: join(root, "logs", "daemon-launches.jsonl"),
  };
  harnesses.push(h);
  for (const dir of [h.home, h.project, h.bin, h.logs, h.rootCodexHome]) mkdirSync(dir, { recursive: true });
  mkdirSync(join(h.project, ".agentbridge"), { recursive: true });
  writeFileSync(join(h.rootCodexHome, "config.toml"), 'model = "probe"\n');
  writeFileSync(join(h.project, ".agentbridge", "config.json"), JSON.stringify({
    version: "1.0",
    codex: { appPort: 49990, proxyPort: 49991 },
    idleShutdownSeconds: 30,
    turnCoordination: { attentionWindowSeconds: 15 },
  }, null, 2) + "\n");
  writeFakeBridge(h);
  writeFakeDaemon(h);
  return h;
}

function runCli(h: Harness, args: string[]) {
  return spawnSync(process.execPath, ["run", CLI_PATH, ...args], {
    cwd: h.project,
    env: {
      ...process.env,
      HOME: h.home,
      XDG_STATE_HOME: join(h.home, ".local", "state"),
      PATH: `${h.bin}:${process.env.PATH ?? ""}`,
      CODEX_HOME: h.rootCodexHome,
      AGENTBRIDGE_DAEMON_ENTRY: h.fakeDaemon,
    },
    encoding: "utf-8",
    timeout: 15_000,
  });
}

function installClaudeShim(h: Harness) {
  writeFileSync(join(h.bin, "claude"), `#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(join(h.logs, "claude.jsonl"))}, JSON.stringify({ args, env: pick() }) + "\\n");
const r = spawnSync(process.execPath, ["run", ${JSON.stringify(h.fakeBridge)}], { cwd: process.cwd(), env: process.env, encoding: "utf-8" });
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 0);
function pick() { return Object.fromEntries(${JSON.stringify(CHANNEL_KEYS)}.map((k) => [k, process.env[k] ?? null])); }
`, { mode: 0o755 });
}

function writeFakeBridge(h: Harness) {
  writeFileSync(h.fakeBridge, `import { pathToFileURL } from "node:url";
const lifecycleMod = await import(pathToFileURL(${JSON.stringify(join(SRC_DIR, "daemon-lifecycle.ts"))}).href);
const stateMod = await import(pathToFileURL(${JSON.stringify(join(SRC_DIR, "state-dir.ts"))}).href);
const lifecycle = new lifecycleMod.DaemonLifecycle({
  stateDir: new stateMod.StateDirResolver(),
  controlPort: Number.parseInt(process.env.AGENTBRIDGE_CONTROL_PORT ?? "4502", 10),
  log: () => {},
});
await lifecycle.ensureRunning();
`);
}

function writeFakeDaemon(h: Harness) {
  writeFileSync(h.fakeDaemon, `import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const stateDir = process.env.AGENTBRIDGE_STATE_DIR;
const controlPort = Number.parseInt(process.env.AGENTBRIDGE_CONTROL_PORT ?? "4502", 10);
if (!stateDir) throw new Error("AGENTBRIDGE_STATE_DIR missing");
mkdirSync(stateDir, { recursive: true });
appendFileSync(${JSON.stringify(h.launchLog)}, JSON.stringify({ pid: process.pid, env: pick() }) + "\\n");
writeFileSync(join(stateDir, "daemon.pid"), String(process.pid) + "\\n");
writeFileSync(join(stateDir, "status.json"), JSON.stringify({ controlPort, pid: process.pid }, null, 2) + "\\n");
Bun.serve({ hostname: "127.0.0.1", port: controlPort, fetch(req) {
  const path = new URL(req.url).pathname;
  if (path === "/healthz" || path === "/readyz") return Response.json({ ok: true });
  return new Response("fake daemon");
}});
setInterval(() => {}, 1000);
function pick() { return Object.fromEntries(${JSON.stringify(CHANNEL_KEYS)}.map((k) => [k, process.env[k] ?? null])); }
`);
}

function readRegistry(h: Harness): any | null {
  // Mirrors canonicalBase() in channel-profile.ts: macOS uses Application Support,
  // other platforms use XDG state (pinned to h.home/.local/state by runCli's env).
  const p =
    platform() === "darwin"
      ? join(h.home, "Library", "Application Support", "AgentBridge", "channels", "registry.json")
      : join(h.home, ".local", "state", "agentbridge", "channels", "registry.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : null;
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf-8").trim();
  return text ? text.split("\n").map((line) => JSON.parse(line) as T) : [];
}
