import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync, openSync, closeSync, constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { StateDirResolver } from "./state-dir";
import { assertChannelEnvConsistent } from "./channel-profile";

// Resolve daemon entry across deployment contexts:
// - Plugin bundle: bridge-server.js sibling -> ./daemon.js
// - Dev source (bun run src/cli.ts): src/cli.ts sibling -> ./daemon.ts
// - dist/cli.js after bundling: ../plugins/agentbridge/server/daemon.js
export function resolveDaemonPath(
  baseUrl: URL | string = import.meta.url,
  override: string | undefined = process.env.AGENTBRIDGE_DAEMON_ENTRY,
): string {
  const base = typeof baseUrl === "string" ? new URL(baseUrl) : baseUrl;
  if (override) {
    return fileURLToPath(new URL(override, base));
  }

  const candidates = ["./daemon.js", "./daemon.ts", "../plugins/agentbridge/server/daemon.js"];
  const tried: string[] = [];
  for (const candidate of candidates) {
    const resolved = fileURLToPath(new URL(candidate, base));
    tried.push(resolved);
    if (existsSync(resolved)) return resolved;
  }

  throw new Error(
    `Could not locate AgentBridge daemon entry. Tried: ${tried.join(", ")}. ` +
      "Set AGENTBRIDGE_DAEMON_ENTRY env to override.",
  );
}

const DAEMON_PATH = resolveDaemonPath();

export interface DaemonLifecycleOptions {
  stateDir: StateDirResolver;
  controlPort: number;
  log: (msg: string) => void;
  /**
   * Channel profile env (the 6 keys from profileToEnv) to bind EXPLICITLY onto the
   * daemon spawn, instead of relying on process.env inheritance (design §2 '靠继承会丢').
   * The lifecycle's own controlPort/stateDir always win over channelEnv. Omitted for
   * the legacy `default` channel (then launch() behaves exactly as before).
   */
  channelEnv?: Record<string, string>;
}

/**
 * Shared daemon lifecycle management.
 * Used by both CLI (agentbridge codex) and plugin frontend (bridge.ts).
 */
export class DaemonLifecycle {
  private readonly stateDir: StateDirResolver;
  private readonly controlPort: number;
  private readonly log: (msg: string) => void;
  private readonly channelEnv: Record<string, string>;

  constructor(opts: DaemonLifecycleOptions) {
    this.stateDir = opts.stateDir;
    this.controlPort = opts.controlPort;
    this.log = opts.log;
    this.channelEnv = opts.channelEnv ?? {};
    assertChannelEnvConsistent(this.channelEnv, {
      AGENTBRIDGE_CONTROL_PORT: String(this.controlPort),
      AGENTBRIDGE_STATE_DIR: this.stateDir.dir,
    }, "DaemonLifecycle");
  }

  get healthUrl(): string {
    return `http://127.0.0.1:${this.controlPort}/healthz`;
  }

  get readyUrl(): string {
    return `http://127.0.0.1:${this.controlPort}/readyz`;
  }

  get controlWsUrl(): string {
    return `ws://127.0.0.1:${this.controlPort}/ws`;
  }

  /** Ensure daemon is running: check health, check pid, start if needed. */
  async ensureRunning(): Promise<void> {
    if (await this.isHealthy()) {
      await this.waitForReady();
      return;
    }

    const existingPid = this.readPid();
    if (existingPid) {
      if (isProcessAlive(existingPid)) {
        // Verify the live process is actually our daemon, not an OS-reused PID
        if (this.isDaemonProcess(existingPid)) {
          try {
            await this.waitForReady(12, 250);
            return;
          } catch {
            throw new Error(
              `Found existing daemon process ${existingPid}, but control port ${this.controlPort} never became ready.`,
            );
          }
        }
        // Live process but NOT our daemon — stale PID reused by OS
        this.log(`Pid ${existingPid} is alive but not an AgentBridge daemon, removing stale pid file`);
      }
      this.removeStalePidFile();
    }

    // Acquire startup lock to prevent concurrent launches
    const lockAcquired = this.acquireLock();
    if (!lockAcquired) {
      // Another process is launching the daemon — wait for it
      this.log("Another process is starting the daemon, waiting for readiness...");
      await this.waitForReady();
      return;
    }

    try {
      this.launch();
      await this.waitForReady();
    } finally {
      this.releaseLock();
    }
  }

  /** Check if daemon health endpoint responds. */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(this.healthUrl);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Verify the live daemon's identity before an attach/reconnect/kill op (PR4 契约1).
   * A NAMED channel fetches /healthz and requires {channelId, controlPort} (and pid, if
   * given) to match this profile — refusing prevents `kill B` from hitting A through a
   * corrupt state dir, or attaching to the wrong daemon. The legacy `default` channel has
   * no registry profile and may use a legacy manual control port, so it SKIPS the hard
   * check (零回归). Throws on mismatch / unreachable; callers decide refuse vs abort.
   */
  async verifyChannelIdentity(
    context: "attach" | "reconnect" | "kill",
    expectedPid?: number,
  ): Promise<void> {
    const expectedChannelId = this.channelEnv.AGENTBRIDGE_CHANNEL_ID;
    if (!expectedChannelId || expectedChannelId === "default") return; // default: skip hard identity
    let health: { channelId?: string; controlPort?: number; pid?: number };
    try {
      const res = await fetch(this.healthUrl);
      health = (await res.json()) as { channelId?: string; controlPort?: number; pid?: number };
    } catch (err: any) {
      throw new Error(
        `[${context}] channel '${expectedChannelId}' identity check failed: daemon unreachable on ${this.healthUrl}: ${err.message}`,
      );
    }
    if (health.channelId !== expectedChannelId || health.controlPort !== this.controlPort) {
      throw new Error(
        `[${context}] channel identity mismatch: expected {channelId:'${expectedChannelId}',controlPort:${this.controlPort}} but daemon reports {channelId:'${health.channelId}',controlPort:${health.controlPort}} — refusing to proceed`,
      );
    }
    if (expectedPid !== undefined && health.pid !== expectedPid) {
      throw new Error(
        `[${context}] channel identity pid mismatch: expected pid ${expectedPid} but daemon /healthz reports pid ${health.pid} — refusing`,
      );
    }
  }

  /** Wait for daemon to become healthy. */
  async waitForHealthy(maxRetries = 40, delayMs = 250): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (await this.isHealthy()) return;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`Timed out waiting for AgentBridge daemon health on ${this.healthUrl}`);
  }

  /** Check if daemon is ready to accept Codex TUI connections. */
  async isReady(): Promise<boolean> {
    try {
      const response = await fetch(this.readyUrl);
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Wait for daemon to become ready. */
  async waitForReady(maxRetries = 40, delayMs = 250): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (await this.isReady()) return;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`Timed out waiting for AgentBridge daemon readiness on ${this.readyUrl}`);
  }

  /** Read daemon status from status.json. */
  readStatus(): { proxyUrl?: string; controlPort?: number; pid?: number } | null {
    try {
      const raw = readFileSync(this.stateDir.statusFile, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Write daemon status to status.json. */
  writeStatus(status: Record<string, unknown>): void {
    this.stateDir.ensure();
    writeFileSync(this.stateDir.statusFile, JSON.stringify(status, null, 2) + "\n", "utf-8");
  }

  /** Read daemon PID from pid file. */
  readPid(): number | null {
    try {
      const raw = readFileSync(this.stateDir.pidFile, "utf-8").trim();
      if (!raw) return null;
      const pid = Number.parseInt(raw, 10);
      return Number.isFinite(pid) ? pid : null;
    } catch {
      return null;
    }
  }

  /** Write daemon PID to pid file. */
  writePid(pid?: number): void {
    this.stateDir.ensure();
    writeFileSync(this.stateDir.pidFile, `${pid ?? process.pid}\n`, "utf-8");
  }

  /** Remove stale pid file. */
  removePidFile(): void {
    try {
      unlinkSync(this.stateDir.pidFile);
    } catch {}
  }

  /** Remove status file. */
  removeStatusFile(): void {
    try {
      unlinkSync(this.stateDir.statusFile);
    } catch {}
  }

  /** Write killed sentinel — prevents auto-reconnect from relaunching daemon. */
  markKilled(): void {
    this.stateDir.ensure();
    writeFileSync(this.stateDir.killedFile, `${Date.now()}\n`, "utf-8");
  }

  /** Remove killed sentinel — allows daemon to be launched again. */
  clearKilled(): void {
    try {
      unlinkSync(this.stateDir.killedFile);
    } catch {}
  }

  /** Check if daemon was intentionally killed by the user. */
  wasKilled(): boolean {
    return existsSync(this.stateDir.killedFile);
  }

  /** Launch daemon as detached background process. */
  private launch(): void {
    this.stateDir.ensure();
    this.log(`Launching detached daemon on control port ${this.controlPort}`);

    const daemonProc = spawn(process.execPath, ["run", DAEMON_PATH], {
      cwd: process.cwd(),
      // Bind the channel profile env EXPLICITLY (design §2): channelEnv carries
      // CODEX_WS_PORT/CODEX_PROXY_PORT/CODEX_HOME/CHANNEL_ID; the lifecycle's own
      // controlPort/stateDir are written last so they always win over channelEnv.
      env: {
        ...process.env,
        ...this.channelEnv,
        AGENTBRIDGE_CONTROL_PORT: String(this.controlPort),
        AGENTBRIDGE_STATE_DIR: this.stateDir.dir,
      },
      detached: true,
      stdio: "ignore",
    });
    daemonProc.unref();
  }

  private removeStalePidFile(): void {
    this.log("Removing stale pid file");
    this.removePidFile();
  }

  /**
   * Try to acquire the startup lock file exclusively.
   * Returns true if the lock was acquired, false if another process holds it.
   */
  private acquireLock(depth = 0): boolean {
    if (depth > 1) {
      this.log("Lock acquisition failed after retry, proceeding without lock");
      return true;
    }
    this.stateDir.ensure();
    try {
      const fd = openSync(this.stateDir.lockFile, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      writeFileSync(fd, `${process.pid}\n`);
      closeSync(fd);
      return true;
    } catch (err: any) {
      if (err.code === "EEXIST") {
        // Check if the lock holder is still alive — recover from stale locks
        // left by crashed launchers
        try {
          const holderPid = Number.parseInt(readFileSync(this.stateDir.lockFile, "utf-8").trim(), 10);
          if (Number.isFinite(holderPid) && !isProcessAlive(holderPid)) {
            this.log(`Stale lock file from dead process ${holderPid}, removing`);
            this.releaseLock();
            return this.acquireLock(depth + 1);
          }
        } catch {
          // Can't read lock file — remove and retry
          this.log("Cannot read lock file, removing stale lock");
          this.releaseLock();
          return this.acquireLock(depth + 1);
        }
        return false;
      }
      // Non-EEXIST error (permissions, etc.) — log and proceed without lock
      this.log(`Warning: could not acquire startup lock: ${err.message}`);
      return true;
    }
  }

  /** Release the startup lock file. */
  private releaseLock(): void {
    try {
      unlinkSync(this.stateDir.lockFile);
    } catch {}
  }

  /**
   * Kill daemon process precisely.
   * Returns true if a process was found and killed.
   */
  async kill(gracefulTimeoutMs = 3000): Promise<boolean> {
    const pid = this.readPid();
    if (!pid) {
      this.log("No daemon pid file found");
      this.cleanup();
      return false;
    }

    if (!isProcessAlive(pid)) {
      this.log(`Daemon pid ${pid} is not alive, cleaning up stale files`);
      this.cleanup();
      return false;
    }

    // Verify the PID actually belongs to an AgentBridge daemon.
    // If the PID file is stale and the OS has reused the PID,
    // we must NOT kill an unrelated process.
    if (!this.isDaemonProcess(pid)) {
      this.log(`Pid ${pid} is alive but is NOT an AgentBridge daemon — refusing to kill. Cleaning up stale pid file.`);
      this.cleanup();
      return false;
    }

    // Channel identity gate (PR4 契约1): for a named channel, refuse to kill unless the
    // live daemon's /healthz reports the matching channelId/controlPort/pid — prevents
    // `kill B` from hitting A through a corrupt state dir. default skips (零回归).
    try {
      await this.verifyChannelIdentity("kill", pid);
    } catch (err: any) {
      this.log(err.message);
      return false;
    }

    // Identity verified — write the killed sentinel NOW (atomic with the gate that authorized
    // the kill, before any signal). This prevents a frontend relaunch during shutdown AND
    // ensures a REFUSED kill (mismatch above → early return) never leaves a stale sentinel
    // (Codex R3 red-team #1: a separate earlier preflight could flip between check and mark).
    this.markKilled();

    // Try graceful shutdown first (SIGTERM)
    this.log(`Sending SIGTERM to daemon pid ${pid}`);
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      this.cleanup();
      return false;
    }

    // Wait for graceful shutdown
    const deadline = Date.now() + gracefulTimeoutMs;
    while (Date.now() < deadline) {
      if (!isProcessAlive(pid)) {
        this.log(`Daemon pid ${pid} stopped gracefully`);
        this.cleanup();
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Force kill (SIGKILL)
    this.log(`Daemon pid ${pid} did not stop gracefully, sending SIGKILL`);
    try {
      process.kill(pid, "SIGKILL");
    } catch {}

    this.cleanup();
    return true;
  }

  /**
   * Verify that a live PID actually belongs to an AgentBridge daemon
   * by checking the process command line. Prevents killing an unrelated
   * process when the OS has reused a stale PID.
   */
  private isDaemonProcess(pid: number): boolean {
    // Always verify via process command line — status.json/pid files can be
    // stale and matching PIDs only proves two local files agree, not that
    // the live process is actually AgentBridge.
    try {
      const cmd = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf-8" }).trim();
      return cmd.includes("daemon") && (cmd.includes("agentbridge") || cmd.includes("agent_bridge"));
    } catch {
      // ps failed — process may have exited between our check and the ps call
      return false;
    }
  }

  /** Clean up all state files. */
  private cleanup(): void {
    this.removePidFile();
    this.removeStatusFile();
    this.releaseLock();
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export { isProcessAlive };
