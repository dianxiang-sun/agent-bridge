import { ChannelRegistry, setupChannelHome, parseChannelId, classifyChannel, isPortFree, type ChannelProfile, type ChannelState } from "../channel-profile";
import { isProcessAlive } from "../daemon-lifecycle";
import { withProjectTrust } from "../channel-config";
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

/** Explicitly create (or idempotently reuse) a named channel: allocate profile + set up home. */
export async function createChannel(id: string, registryRoot?: string): Promise<ChannelProfile> {
  const profile = await new ChannelRegistry(registryRoot).allocate(id); // validates id (契约9)
  setupChannelHome(profile);
  return profile;
}

/**
 * `agentbridge channel trust <id> <dir>` — idempotently pre-trust a workspace dir in a named
 * channel's ISOLATED codex `config.toml`, so codex won't prompt "Project-local config ... disabled
 * until the project is trusted" on a fresh per-channel CODEX_HOME. Returns the patched config path.
 * Uses the smol-toml round-trip (`withProjectTrust`) — no duplicate tables, path key auto-escaped.
 */
export async function trustChannelDir(id: string, projectDir: string, registryRoot?: string): Promise<string> {
  const channelId = parseChannelId(id);
  const profile = new ChannelRegistry(registryRoot).read(channelId);
  if (!profile) {
    throw new Error(`Channel '${channelId}' not created. Run: agentbridge channel create ${channelId}`);
  }
  // Canonicalize to the real absolute path so the trust key matches codex's actual cwd
  // (rejects relative './x' and resolves symlinks — a relative key would silently never match).
  let resolvedDir: string;
  try {
    resolvedDir = realpathSync(projectDir);
  } catch {
    throw new Error(`Project dir does not exist: ${projectDir}`);
  }
  // A fresh per-channel CODEX_HOME may have no config yet — treat missing as empty TOML and
  // create it, so the unattended trust preset never fails on a clean home.
  mkdirSync(profile.codexHome, { recursive: true, mode: 0o700 });
  const configPath = join(profile.codexHome, "config.toml");
  const existing = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  writeFileSync(configPath, withProjectTrust(existing, resolvedDir), { mode: 0o600 });
  return configPath;
}

/** Recursive on-disk size of a path; 0 when missing. Best-effort (unreadable
 *  entries skipped) — this feeds a human dry-run report, not accounting. */
function dirSizeBytes(path: string): number {
  try {
    const st = statSync(path);
    if (!st.isDirectory()) return st.size;
    let total = 0;
    for (const entry of readdirSync(path)) {
      total += dirSizeBytes(join(path, entry));
    }
    return total;
  } catch {
    return 0;
  }
}

function fmtMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** classifyChannel is control-port/daemon-pid centric: a SIGKILLed daemon never runs
 *  CodexAdapter.stop(), so its codex app-server (recorded in status.json) can outlive
 *  it while the channel classifies as "stopped". Probe the recorded pid and the
 *  channel's app/proxy ports so --prune never deletes codexHome under a live orphan.
 *  Returns a human-readable description of the live thing, or null when all clear. */
async function detectLiveOrphan(profile: ChannelProfile): Promise<string | null> {
  try {
    const raw = readFileSync(join(profile.stateDir, "status.json"), "utf-8");
    const pid = (JSON.parse(raw) as { codexAppServerPid?: number | null })?.codexAppServerPid;
    if (typeof pid === "number" && isProcessAlive(pid)) {
      return `codex app-server pid ${pid}`;
    }
  } catch {
    // no/unreadable status.json — fall through to the port probes
  }
  if (!(await isPortFree(profile.codexAppPort))) return `app port ${profile.codexAppPort} still occupied`;
  if (!(await isPortFree(profile.codexProxyPort))) return `proxy port ${profile.codexProxyPort} still occupied`;
  return null;
}

export interface ChannelDeleteResult {
  channelId: string;
  state: ChannelState;
  pruned: boolean;
  stateDir: string | null;
  codexHome: string | null;
  stateDirBytes: number;
  codexHomeBytes: number;
}

/**
 * `agentbridge channel delete <id> [--prune]` — the EXPLICIT disk-reclaim path that
 * `abg gc` deliberately does not provide (gc is registry-only by design: it must
 * never destroy Codex sessions/memories as a side effect of automatic cleanup).
 * Without --prune this is a dry run: report the channel state + on-disk sizes and
 * delete nothing. With --prune: remove stateDir, codexHome AND the registry entry.
 * running / blocked-port channels are always refused (kill or free the port first);
 * a corrupt profile only drops its registry entry (its path fields can't be trusted).
 */
export async function deleteChannel(id: string, opts: { prune: boolean }, registryRoot?: string): Promise<ChannelDeleteResult> {
  const channelId = parseChannelId(id);
  const reg = new ChannelRegistry(registryRoot);
  const profile = reg.read(channelId);
  if (!profile) {
    throw new Error(`Channel '${channelId}' is not in the registry.`);
  }
  const state = await classifyChannel(profile);
  if (state === "running") {
    throw new Error(`Channel '${channelId}' is RUNNING — stop it first: agentbridge kill --channel ${channelId}`);
  }
  if (state === "blocked-port") {
    throw new Error(`Channel '${channelId}' is blocked-port (its port is held by an unverified process) — resolve the port conflict first, then re-run delete.`);
  }
  const diskTrusted = state !== "corrupt";
  const stateDir = diskTrusted ? profile.stateDir : null;
  const codexHome = diskTrusted ? profile.codexHome : null;
  const stateDirBytes = stateDir ? dirSizeBytes(stateDir) : 0;
  const codexHomeBytes = codexHome ? dirSizeBytes(codexHome) : 0;
  if (opts.prune) {
    if (diskTrusted) {
      const orphan = await detectLiveOrphan(profile);
      if (orphan) {
        throw new Error(`Channel '${channelId}' still has a live process (${orphan}) — stop it first, then re-run delete.`);
      }
    }
    if (stateDir) rmSync(stateDir, { recursive: true, force: true });
    if (codexHome) rmSync(codexHome, { recursive: true, force: true });
    await reg.remove(channelId);
  }
  return { channelId, state, pruned: opts.prune, stateDir, codexHome, stateDirBytes, codexHomeBytes };
}

/** `abg channel create <id>` / `abg channel trust <id> <dir>` — explicit channel ops. */
export async function runChannel(args: string[]): Promise<void> {
  const sub = args[0];

  if (sub === "create") {
    const id = args[1];
    if (!id) {
      console.error("Usage: abg channel create <id>");
      process.exit(1);
    }
    const profile = await createChannel(id);
    console.log(
      `Created channel '${profile.channelId}': control=${profile.controlPort}  codex-app=${profile.codexAppPort}  proxy=${profile.codexProxyPort}`,
    );
    console.log(`  stateDir=${profile.stateDir}`);
    console.log(`  codexHome=${profile.codexHome}`);
    return;
  }

  if (sub === "trust") {
    const id = args[1];
    const dir = args[2];
    if (!id || !dir) {
      console.error("Usage: abg channel trust <id> <dir>");
      process.exit(1);
    }
    await trustChannelDir(id, dir);
    console.log(`Trusted '${dir}' in channel '${id}'`);
    return;
  }

  if (sub === "delete") {
    const id = args[1];
    const prune = args.includes("--prune");
    if (!id || id.startsWith("--")) {
      console.error("Usage: abg channel delete <id> [--prune]");
      process.exit(1);
    }
    try {
      const r = await deleteChannel(id, { prune });
      if (r.pruned) {
        console.log(`Deleted channel '${r.channelId}' (${r.state}): registry entry${r.stateDir ? " + stateDir + codexHome" : ""} removed — ${fmtMB(r.stateDirBytes + r.codexHomeBytes)} freed.`);
      } else {
        console.log(`[dry-run] channel '${r.channelId}' (state: ${r.state}) — nothing deleted. --prune would remove:`);
        console.log(`  registry entry`);
        if (r.stateDir) console.log(`  stateDir   ${r.stateDir} (${fmtMB(r.stateDirBytes)})`);
        if (r.codexHome) console.log(`  codexHome  ${r.codexHome} (${fmtMB(r.codexHomeBytes)}) — Codex sessions/memories, NOT recoverable`);
      }
    } catch (err: any) {
      console.error(`channel delete failed: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown channel subcommand: ${sub ?? "(none)"}. Try: abg channel create <id> | trust <id> <dir> | delete <id> [--prune]`);
  process.exit(1);
}
