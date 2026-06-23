import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { StateDirResolver } from "../state-dir";
import { DaemonLifecycle, isProcessAlive } from "../daemon-lifecycle";
import { profileToEnv, isValidChannelProfile, ChannelRegistry, type ChannelProfile } from "../channel-profile";
import { resolveKillScope } from "./channel-args";
import { detectTmuxKillContext } from "./tmux-context";

export async function runKill(args: string[] = []) {
  // Only no-arg kill consults the tmux marker; explicit targets (--all/--channel/positional) must not
  // pay for — or be blocked by — a tmux probe (Codex review #3). The marker is written by the abg-tmux
  // wrapper (NOT the session name); the process env pins a spawned subprocess; ambiguous or unmarked
  // contexts refuse rather than guess. (fix/kill-current-channel — closes the pane-2 hole.)
  const tmuxContext = hasExplicitKillTarget(args) ? ({ kind: "outside-tmux" } as const) : detectTmuxKillContext();
  const scope = resolveKillScope(args, process.env, undefined, tmuxContext);

  console.log("AgentBridge Kill — stopping daemon and managed Codex TUI\n");

  if (scope.mode === "all") {
    if (scope.profiles.length === 0) {
      console.log("No named channels to kill.");
      return;
    }
    let any = false;
    for (const profile of scope.profiles) {
      console.log(`[channel ${profile.channelId}]`);
      const outcome = await killOneTarget(profile, false);
      if (outcome.killed) any = true;
    }
    console.log(any ? "\nNamed channels stopped." : "\nNo running named channels found.");
    return;
  }

  const outcome = await killOneTarget(scope.profile, scope.mode === "default");
  if (outcome.refused) {
    console.log(outcome.tuiKilled
      ? "\nThe managed Codex TUI was cleaned up, but the daemon was NOT stopped — its identity did not match the 'default' target."
      : "\nRefused: the live daemon's identity did not match the 'default' target — nothing was stopped.");
    console.log("Run `abg kill --channel <id>` for a named channel, `abg gc` to clean a stale registry, or check `abg list`.");
  } else if (outcome.killed) {
    console.log("\nAgentBridge stopped.");
    console.log("Please restart Claude Code (`agentbridge claude`), switch to a new conversation, or run `/resume` to fully disconnect.");
  } else {
    console.log("\nNo running AgentBridge daemon or managed Codex TUI found.");
    console.log("Stale state files cleaned up (if any).");
  }
}

/** Whether argv carries an explicit kill target (so the tmux marker must be ignored / not probed). */
function hasExplicitKillTarget(args: string[]): boolean {
  for (const a of args) {
    if (a === "--all" || a === "--channel" || a.startsWith("--channel=")) return true;
    if (!a.startsWith("-") && a.length > 0) return true; // positional channel name / 'default'
  }
  return false;
}

/** Outcome of killing one target: whether anything stopped, whether a default kill was refused on
 *  identity, and whether the managed Codex TUI was cleaned (for an accurate refused message). */
type KillOutcome = { killed: boolean; refused: boolean; tuiKilled: boolean };

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
async function killOneTarget(profile: ChannelProfile, isDefault: boolean): Promise<KillOutcome> {
  const log = (msg: string) => console.log(`  ${msg}`);
  if (!isValidChannelProfile(profile)) {
    log(`skipping invalid/corrupt registry entry '${profile.channelId ?? "?"}' (run 'abg gc')`);
    return { killed: false, refused: false, tuiKilled: false };
  }

  const stateDir = new StateDirResolver(profile.stateDir);
  const lifecycle = new DaemonLifecycle({
    stateDir,
    controlPort: profile.controlPort,
    log,
    channelEnv: isDefault ? undefined : profileToEnv(profile),
  });

  // TUI is killed independently, now with its OWN channel-identity proof (codex-tui.json
  // metadata + live --remote cmdline match), so it does NOT depend on the daemon being alive —
  // an orphan TUI whose daemon already died is still cleanable. lifecycle.kill() then runs the
  // daemon identity gate and writes the killed sentinel only after it passes.
  const tuiKilled = await killManagedCodexTuiForProfile(profile, stateDir, log, isDefault);
  // The lifecycle identity gate skips default (no named env), so add a default-specific check:
  // verify /healthz reports default identity when reachable; on a wedged (unreachable) daemon fall
  // back narrowly but NEVER signal a pid a named channel claims (Mechanism C hardening).
  if (isDefault && !(await authorizeDefaultDaemonKill(profile, lifecycle, log))) {
    return { killed: false, refused: true, tuiKilled };
  }
  const daemonKilled = await lifecycle.kill();
  return { killed: daemonKilled || tuiKilled, refused: false, tuiKilled };
}

/** Channel-scoped TUI identity record, a legacy bare pid, or nothing. */
export type TuiRecord =
  | { kind: "none" }
  | { kind: "legacy"; pid: number }
  | { kind: "meta"; pid: number; channelId: string; controlPort: number; proxyUrl?: string };

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

/** Read the TUI record: prefer codex-tui.json (channel identity), fall back to legacy bare pid. */
export function readTuiRecord(stateDir: StateDirResolver): TuiRecord {
  try {
    const raw = readFileSync(stateDir.tuiMetaFile, "utf-8").trim();
    if (raw) {
      const obj = JSON.parse(raw);
      const pid = Number(obj?.pid);
      const controlPort = Number(obj?.controlPort);
      // pid/controlPort must be positive integers — 0/-1/1.5/"123abc" are not valid identity (Codex review #3).
      if (isPositiveInt(pid) && typeof obj?.channelId === "string" && obj.channelId !== "" && isPositiveInt(controlPort)) {
        return {
          kind: "meta",
          pid,
          channelId: obj.channelId,
          controlPort,
          proxyUrl: typeof obj?.proxyUrl === "string" ? obj.proxyUrl : undefined,
        };
      }
    }
  } catch {
    // malformed/missing meta → fall through to legacy
  }
  try {
    const raw = readFileSync(stateDir.tuiPidFile, "utf-8").trim();
    if (raw) {
      const pid = Number(raw); // Number() (not parseInt) so "123abc" → NaN → rejected
      if (isPositiveInt(pid)) return { kind: "legacy", pid };
    }
  } catch {}
  return { kind: "none" };
}

export type TuiKillDecision =
  | { action: "kill"; pid: number }
  | { action: "skip"; reason: string }
  | { action: "refuse"; reason: string };

/**
 * Pure authorization for a TUI kill (Mechanism D). Authorizes ONLY when the live process is a
 * managed Codex TUI whose recorded identity matches the TARGET channel — it never depends on the
 * daemon being alive, so an orphan TUI is still cleanable. A legacy bare pid (no channel identity)
 * is refused for a named channel and allowed only for default (backward compat). Cross-channel
 * metadata is refused — this is the gate that stops `kill A` from taking down channel B's TUI.
 */
export function decideTuiKill(
  record: TuiRecord,
  profile: Pick<ChannelProfile, "channelId" | "controlPort" | "codexProxyPort">,
  isDefault: boolean,
  probe: { alive: boolean; cmdMatches: boolean },
): TuiKillDecision {
  if (record.kind === "none") return { action: "skip", reason: "no Codex TUI record" };
  if (!probe.alive) return { action: "skip", reason: `Codex TUI pid ${record.pid} not alive` };
  if (!probe.cmdMatches) {
    return { action: "refuse", reason: `pid ${record.pid} is not this channel's managed Codex TUI (cmdline/--remote mismatch)` };
  }
  if (record.kind === "legacy") {
    if (!isDefault) {
      return { action: "refuse", reason: `legacy codex-tui.pid lacks channel metadata; refusing named '${profile.channelId}' TUI pid ${record.pid} (restart Codex to write codex-tui.json)` };
    }
    return { action: "kill", pid: record.pid };
  }
  if (record.channelId !== profile.channelId || record.controlPort !== profile.controlPort) {
    return {
      action: "refuse",
      reason: `Codex TUI identity mismatch: target {channelId:'${profile.channelId}',controlPort:${profile.controlPort}} but record {channelId:'${record.channelId}',controlPort:${record.controlPort}}`,
    };
  }
  // named: the registry profile proxy IS the channel-identity boundary — record proxy must match it
  // (when present). default: proxy is status/config-derived and is proven by the live --remote cmdline
  // (probe uses record.proxyUrl for default), so it is NOT pinned to the canonical profile proxy here
  // — otherwise a legitimate default TUI on a non-canonical proxy would be unkillable (Codex review #2).
  if (!isDefault) {
    const expectedProxy = `ws://127.0.0.1:${profile.codexProxyPort}`;
    if (record.proxyUrl !== undefined && record.proxyUrl !== expectedProxy) {
      return { action: "refuse", reason: `Codex TUI proxy mismatch: named '${profile.channelId}' expects ${expectedProxy} but record has ${record.proxyUrl}` };
    }
  }
  return { action: "kill", pid: record.pid };
}

function probeTuiProcess(pid: number, expectedProxyUrl: string): { alive: boolean; cmdMatches: boolean } {
  if (!isProcessAlive(pid)) return { alive: false, cmdMatches: false };
  return { alive: true, cmdMatches: isManagedCodexTuiProcess(pid, expectedProxyUrl) };
}

async function killManagedCodexTuiForProfile(
  profile: ChannelProfile,
  stateDir: StateDirResolver,
  log: (msg: string) => void,
  isDefault: boolean,
  gracefulTimeoutMs = 3000,
): Promise<boolean> {
  const record = readTuiRecord(stateDir);
  // Live cmdline proof URL: named → registry profile proxy; default → the proxy actually recorded
  // at launch (status/config-derived), falling back to the profile proxy for legacy/no-meta.
  const expectedProxyUrl =
    record.kind === "meta" && isDefault && record.proxyUrl
      ? record.proxyUrl
      : `ws://127.0.0.1:${profile.codexProxyPort}`;
  const probe = record.kind === "none" ? { alive: false, cmdMatches: false } : probeTuiProcess(record.pid, expectedProxyUrl);
  const decision = decideTuiKill(record, profile, isDefault, probe);

  if (decision.action === "skip") {
    log(record.kind === "none" ? "No Codex TUI metadata/pid file found" : decision.reason + ", cleaning up stale TUI files");
    removeTuiFiles(stateDir);
    return false;
  }
  if (decision.action === "refuse") {
    log(decision.reason + " — refusing to kill.");
    return false;
  }

  const pid = decision.pid;
  log(`Sending SIGTERM to Codex TUI pid ${pid}`);
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    removeTuiFiles(stateDir);
    return false;
  }

  const deadline = Date.now() + gracefulTimeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      log(`Codex TUI pid ${pid} stopped gracefully`);
      removeTuiFiles(stateDir);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  log(`Codex TUI pid ${pid} did not stop gracefully, sending SIGKILL`);
  try {
    process.kill(pid, "SIGKILL");
  } catch {}

  removeTuiFiles(stateDir);
  return true;
}

function removeTuiFiles(stateDir: StateDirResolver) {
  try { unlinkSync(stateDir.tuiMetaFile); } catch {}
  try { unlinkSync(stateDir.tuiPidFile); } catch {}
}

function isManagedCodexTuiProcess(pid: number, expectedProxyUrl?: string): boolean {
  try {
    const cmd = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf-8" }).trim();
    if (!cmd.includes("codex") || !cmd.includes("--enable") || !cmd.includes("tui_app_server") || !cmd.includes("--remote")) {
      return false;
    }
    if (expectedProxyUrl) {
      return cmd.includes(`--remote ${expectedProxyUrl}`) || cmd.includes(`--remote=${expectedProxyUrl}`);
    }
    return true;
  } catch {
    return false;
  }
}

export type DefaultKillDecision = { action: "proceed" } | { action: "refuse"; reason: string };

/**
 * Pure authorization for killing the DEFAULT daemon (Mechanism C hardening). The named identity
 * gate in lifecycle.kill() skips default, so without this a leaked state/port env (or a corrupt
 * default pidfile pointing at a named daemon) could let "default" hit the wrong daemon. Policy:
 *  - no live pid → proceed (lifecycle.kill just cleans up).
 *  - /healthz reachable → require it to report {channelId:default, controlPort, pid}; else refuse.
 *  - /healthz unreachable (wedged daemon) → proceed ONLY if the pid is not claimed by any named
 *    channel — a wedged default stays killable, but a named pid is never signaled as "default".
 */
export function decideDefaultDaemonKill(
  pid: number | null,
  alive: boolean,
  health: { channelId?: string; controlPort?: number; pid?: number } | null,
  expectedControlPort: number,
  pidRecordedByNamed: boolean,
): DefaultKillDecision {
  if (pid === null || !alive) return { action: "proceed" };
  if (health) {
    if (health.channelId !== "default" || health.controlPort !== expectedControlPort || health.pid !== pid) {
      return {
        action: "refuse",
        reason: `default kill identity mismatch: /healthz reports {channelId:'${health.channelId}',controlPort:${health.controlPort},pid:${health.pid}} ≠ expected {default,${expectedControlPort},${pid}}`,
      };
    }
    return { action: "proceed" };
  }
  if (pidRecordedByNamed) {
    return { action: "refuse", reason: `default /healthz unreachable and pid ${pid} is recorded by a named channel — refusing (use 'abg kill --channel <id>')` };
  }
  return { action: "proceed" };
}

async function fetchHealthz(
  controlPort: number,
  timeoutMs = 500,
): Promise<{ channelId?: string; controlPort?: number; pid?: number } | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${controlPort}/healthz`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null; // non-2xx is not a trustworthy identity source (Codex review #5)
    return (await res.json()) as { channelId?: string; controlPort?: number; pid?: number };
  } catch {
    return null;
  }
}

type NamedPidScan = { kind: "found" } | { kind: "clear" } | { kind: "unknown"; reason: string };

/**
 * Scan named-channel daemon.pid files for `pid`. Tri-state (Codex review #2): a registry-read or
 * pidfile-read error is `unknown`, NOT silently "clear" — so the wedged-default fallback can fail
 * CLOSED rather than letting a named pid be killed as "default" when the registry can't be verified.
 * Only a genuinely-absent pid file (ENOENT, a stopped named channel) is skipped.
 */
function scanNamedDaemonPids(pid: number): NamedPidScan {
  let profiles: ChannelProfile[];
  try {
    profiles = new ChannelRegistry().list();
  } catch (err: any) {
    return { kind: "unknown", reason: `registry unreadable: ${err?.message ?? err}` };
  }
  for (const profile of profiles) {
    if (!isValidChannelProfile(profile)) {
      return { kind: "unknown", reason: `corrupt registry entry '${profile.channelId ?? "?"}'` };
    }
    try {
      const raw = readFileSync(new StateDirResolver(profile.stateDir).pidFile, "utf-8").trim();
      if (!raw) continue;
      const recorded = Number(raw);
      if (!Number.isInteger(recorded) || recorded <= 0) {
        return { kind: "unknown", reason: `malformed daemon.pid for channel '${profile.channelId}'` };
      }
      if (recorded === pid) return { kind: "found" };
    } catch (err: any) {
      if (err?.code === "ENOENT") continue; // a stopped named channel simply has no pid file
      return { kind: "unknown", reason: `cannot read daemon.pid for channel '${profile.channelId}': ${err?.message ?? err}` };
    }
  }
  return { kind: "clear" };
}

async function authorizeDefaultDaemonKill(
  profile: ChannelProfile,
  lifecycle: DaemonLifecycle,
  log: (msg: string) => void,
): Promise<boolean> {
  const pid = lifecycle.readPid();
  const alive = pid !== null && isProcessAlive(pid);
  const health = alive ? await fetchHealthz(profile.controlPort) : null;

  // The named-pid scan is only needed when the daemon is alive AND /healthz is unreachable (wedged).
  let pidRecordedByNamed = false;
  if (alive && pid !== null && health === null) {
    const scan = scanNamedDaemonPids(pid);
    if (scan.kind === "unknown") {
      // Can't prove the pid is the default daemon (registry/pidfile unverifiable) → fail closed.
      log(`default /healthz unreachable and the named-channel registry could not be verified (${scan.reason}) — refusing. Run 'abg gc', or use 'abg kill --channel <id>'.`);
      return false;
    }
    pidRecordedByNamed = scan.kind === "found";
  }

  const decision = decideDefaultDaemonKill(pid, alive, health, profile.controlPort, pidRecordedByNamed);
  if (decision.action === "refuse") {
    log(decision.reason + " — refusing to kill.");
    return false;
  }
  return true;
}
