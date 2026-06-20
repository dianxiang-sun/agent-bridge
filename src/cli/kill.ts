import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { StateDirResolver } from "../state-dir";
import { DaemonLifecycle, isProcessAlive } from "../daemon-lifecycle";
import { profileToEnv, isValidChannelProfile, type ChannelProfile } from "../channel-profile";
import { resolveKillScope } from "./channel-args";

export async function runKill(args: string[] = []) {
  // Context-aware (用户纠偏 2026-06-20): no args = the channel THIS process is in (or default);
  // <name>/--channel = that named channel; --all = every named channel (NOT legacy default).
  const scope = resolveKillScope(args);

  console.log("AgentBridge Kill — stopping daemon and managed Codex TUI\n");

  if (scope.mode === "all") {
    if (scope.profiles.length === 0) {
      console.log("No named channels to kill.");
      return;
    }
    let any = false;
    for (const profile of scope.profiles) {
      console.log(`[channel ${profile.channelId}]`);
      if (await killOneTarget(profile, false)) any = true;
    }
    console.log(any ? "\nNamed channels stopped." : "\nNo running named channels found.");
    return;
  }

  const killed = await killOneTarget(scope.profile, scope.mode === "default");
  if (killed) {
    console.log("\nAgentBridge stopped.");
    console.log("Please restart Claude Code (`agentbridge claude`), switch to a new conversation, or run `/resume` to fully disconnect.");
  } else {
    console.log("\nNo running AgentBridge daemon or managed Codex TUI found.");
    console.log("Stale state files cleaned up (if any).");
  }
}

/**
 * Kill one channel's daemon + managed Codex TUI, targeting its OWN state dir / control port
 * explicitly (no process.env mutation — safe to call in an --all loop without bleeding one
 * channel's env into the next). A named channel binds channelEnv so the kill identity gate
 * actually runs (red-team #1: the old runKill never passed it → the gate silently no-op'd).
 *
 * The identity gate AND the killed-sentinel write are owned by lifecycle.kill() atomically
 * (Codex R3 #1): a named channel verifies {channelId,controlPort,pid} and only marks+signals
 * on success; default skips the hard check (零回归). A malformed/corrupt profile is refused up
 * front (red-team #2) so its missing stateDir can't make StateDirResolver fall back to the
 * ambient env (which would, under --all, write a sentinel into the wrong channel).
 */
async function killOneTarget(profile: ChannelProfile, isDefault: boolean): Promise<boolean> {
  const log = (msg: string) => console.log(`  ${msg}`);
  if (!isValidChannelProfile(profile)) {
    log(`skipping invalid/corrupt registry entry '${profile.channelId ?? "?"}' (run 'abg gc')`);
    return false;
  }

  const stateDir = new StateDirResolver(profile.stateDir);
  const lifecycle = new DaemonLifecycle({
    stateDir,
    controlPort: profile.controlPort,
    log,
    channelEnv: isDefault ? undefined : profileToEnv(profile),
  });

  // TUI is killed independently (its own pid + cmdline guard). lifecycle.kill() then runs the
  // identity gate and writes the killed sentinel only after it passes — no separate preflight
  // that could flip between check and mark.
  const tuiKilled = await killManagedCodexTui(stateDir, log);
  const killed = await lifecycle.kill();
  return killed || tuiKilled;
}

async function killManagedCodexTui(
  stateDir: StateDirResolver,
  log: (msg: string) => void,
  gracefulTimeoutMs = 3000,
): Promise<boolean> {
  const pid = readTuiPid(stateDir);
  if (!pid) {
    log("No Codex TUI pid file found");
    removeTuiPidFile(stateDir);
    return false;
  }

  if (!isProcessAlive(pid)) {
    log(`Codex TUI pid ${pid} is not alive, cleaning up stale pid file`);
    removeTuiPidFile(stateDir);
    return false;
  }

  if (!isManagedCodexTuiProcess(pid)) {
    log(`Pid ${pid} is alive but is NOT a managed AgentBridge Codex TUI — refusing to kill. Cleaning up stale pid file.`);
    removeTuiPidFile(stateDir);
    return false;
  }

  log(`Sending SIGTERM to Codex TUI pid ${pid}`);
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    removeTuiPidFile(stateDir);
    return false;
  }

  const deadline = Date.now() + gracefulTimeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      log(`Codex TUI pid ${pid} stopped gracefully`);
      removeTuiPidFile(stateDir);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  log(`Codex TUI pid ${pid} did not stop gracefully, sending SIGKILL`);
  try {
    process.kill(pid, "SIGKILL");
  } catch {}

  removeTuiPidFile(stateDir);
  return true;
}

function readTuiPid(stateDir: StateDirResolver): number | null {
  try {
    const raw = readFileSync(stateDir.tuiPidFile, "utf-8").trim();
    if (!raw) return null;
    const pid = Number.parseInt(raw, 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function removeTuiPidFile(stateDir: StateDirResolver) {
  try {
    unlinkSync(stateDir.tuiPidFile);
  } catch {}
}

function isManagedCodexTuiProcess(pid: number): boolean {
  try {
    const cmd = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf-8" }).trim();
    return (
      cmd.includes("codex")
      && cmd.includes("--enable")
      && cmd.includes("tui_app_server")
      && cmd.includes("--remote")
    );
  } catch {
    return false;
  }
}
