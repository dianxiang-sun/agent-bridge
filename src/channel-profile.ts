/**
 * Channel profile orchestration for AgentBridge multi-channel (方案 A).
 *
 * Each named channel gets an independent daemon triple (control/codex-app/codex-proxy
 * ports) + isolated state dir + isolated CODEX_HOME. The `default` channel keeps legacy
 * behavior (4500/4501/4502 + shared ~/.codex). See docs/multi-channel-design.md (SSOT).
 *
 * This module is the outer orchestration layer; daemon internals are unchanged.
 */

import { homedir, platform } from "node:os";
import { join } from "node:path";
import {
  openSync,
  closeSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
  copyFileSync,
  renameSync,
  unlinkSync,
  lstatSync,
  symlinkSync,
  realpathSync,
  constants,
} from "node:fs";
import { connect } from "node:net";
import { StateDirResolver } from "./state-dir";
import { generateChannelConfig } from "./channel-config";

/** Reserved ids that cannot be used as a named channel id (契约 9). */
export const RESERVED_IDS = ["default", "all", "list", "status", "gc", "kill", "create"] as const;

/** Allowed channel id syntax: first char alnum, then [A-Za-z0-9._-], total ≤ 64. */
const CHANNEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * Validate and return a channel id, or throw (契约 9).
 *
 * Rejects: empty, reserved names, path-traversal (`..` / `/`), illegal chars,
 * non-alnum first char, and ids longer than 64 chars. Paths are never built from
 * unvalidated user input — only from ids that pass this gate.
 */
export function parseChannelId(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Invalid channel id: empty");
  }
  if ((RESERVED_IDS as readonly string[]).includes(raw)) {
    throw new Error(`Reserved channel id: '${raw}' (reserved: ${RESERVED_IDS.join(", ")})`);
  }
  if (raw.includes("..") || raw.includes("/")) {
    throw new Error(`Channel id contains path-traversal characters: '${raw}'`);
  }
  if (!CHANNEL_ID_RE.test(raw)) {
    throw new Error(
      `Invalid channel id '${raw}': allowed [A-Za-z0-9._-], first char must be alphanumeric, max 64 chars`,
    );
  }
  return raw;
}

/** A complete channel runtime profile. `default` = legacy, named = isolated triple. */
export interface ChannelProfile {
  channelId: string;
  controlPort: number;
  codexAppPort: number;
  codexProxyPort: number;
  stateDir: string;
  codexHome: string;
}

/**
 * Platform-default AgentBridge base dir, IGNORING AGENTBRIDGE_STATE_DIR so that named
 * channels share one stable root even when a per-channel state dir is in the environment.
 * (XDG_STATE_HOME on Linux is a legitimate global relocation and is still honored.)
 */
function canonicalBase(): string {
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "AgentBridge");
  }
  const xdgState = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  return join(xdgState, "agentbridge");
}

/** `<canonical base>/channels` — registry + per-channel state dirs live here. */
export function channelsBaseDir(): string {
  return join(canonicalBase(), "channels");
}

/** `<canonical base>/codex-home` — per-channel CODEX_HOME dirs live here. */
export function codexHomeBaseDir(): string {
  return join(canonicalBase(), "codex-home");
}

/**
 * The legacy `default` channel profile: fixed ports 4500/4501/4502, the existing
 * StateDirResolver dir (honors AGENTBRIDGE_STATE_DIR), and inherited ~/.codex.
 * Never allocates ports — `default` is the backward-compat path.
 */
export function defaultProfile(): ChannelProfile {
  return {
    channelId: "default",
    controlPort: 4502,
    codexAppPort: 4500,
    codexProxyPort: 4501,
    stateDir: new StateDirResolver().dir,
    codexHome: process.env.CODEX_HOME ?? join(homedir(), ".codex"),
  };
}

const REGISTRY_SCHEMA_VERSION = 1;
const MAX_CHANNEL_INDEX = 250; // base up to 4500 + 250*10 = 7000

interface RegistryFile {
  schemaVersion: number;
  channels: Record<string, ChannelProfile>;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Probe whether a local TCP port is free by attempting a connect (never spawns codex,
 * never touches CODEX_HOME — design §5). ECONNREFUSED → free; an accepted connection or
 * no response within the timeout → conservatively treated as occupied.
 */
export function isPortFree(port: number, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: "127.0.0.1" });
    let settled = false;
    const done = (free: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(free);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(false));
    socket.once("timeout", () => done(false));
    socket.once("error", (err: NodeJS.ErrnoException) => done(err?.code === "ECONNREFUSED"));
  });
}

/**
 * Channel registry: allocates/reads per-channel profiles under `<root>/channels/`.
 * Uses an O_CREAT|O_EXCL lock that NEVER fails open (契约 4), atomic temp+rename writes
 * with a `.bak`, and a schemaVersion. A corrupt registry → fail-closed throw.
 */
export class ChannelRegistry {
  private readonly registryDir: string; // <root>/channels
  private readonly codexHomeBase: string; // <root>/codex-home
  private readonly registryFile: string;
  private readonly lockFile: string;

  constructor(root?: string) {
    this.registryDir = root ? join(root, "channels") : channelsBaseDir();
    this.codexHomeBase = root ? join(root, "codex-home") : codexHomeBaseDir();
    this.registryFile = join(this.registryDir, "registry.json");
    this.lockFile = join(this.registryDir, "registry.lock");
  }

  read(channelId: string): ChannelProfile | null {
    return this.readRaw().channels[channelId] ?? null;
  }

  list(): ChannelProfile[] {
    return Object.values(this.readRaw().channels);
  }

  /** Allocate (or idempotently reuse) a named channel profile. Lock-guarded; named only. */
  async allocate(channelId: string): Promise<ChannelProfile> {
    const id = parseChannelId(channelId); // rejects reserved/illegal incl. "default"
    return this.withLock(async () => {
      const reg = this.readRaw();
      const existing = reg.channels[id];
      if (existing) return existing; // idempotent reuse

      const used = new Set<number>();
      for (const p of Object.values(reg.channels)) {
        used.add(p.codexAppPort);
        used.add(p.codexProxyPort);
        used.add(p.controlPort);
      }

      let chosenBase: number | null = null;
      for (let i = 1; i <= MAX_CHANNEL_INDEX; i++) {
        const base = 4500 + i * 10;
        const triple = [base, base + 1, base + 2];
        if (triple.some((p) => used.has(p))) continue;
        const free = await Promise.all(triple.map((p) => isPortFree(p)));
        if (free.every(Boolean)) {
          chosenBase = base;
          break;
        }
      }
      if (chosenBase === null) {
        throw new Error(`No free channel port slot (checked indices 1..${MAX_CHANNEL_INDEX})`);
      }

      const profile: ChannelProfile = {
        channelId: id,
        codexAppPort: chosenBase,
        codexProxyPort: chosenBase + 1,
        controlPort: chosenBase + 2,
        stateDir: join(this.registryDir, id),
        codexHome: join(this.codexHomeBase, id),
      };
      reg.channels[id] = profile;
      this.writeAtomic(reg);
      return profile;
    });
  }

  private readRaw(): RegistryFile {
    if (!existsSync(this.registryFile)) {
      return { schemaVersion: REGISTRY_SCHEMA_VERSION, channels: {} };
    }
    let text: string;
    try {
      text = readFileSync(this.registryFile, "utf-8");
    } catch (err: any) {
      throw new Error(`registry.json unreadable (fail-closed): ${this.registryFile}: ${err.message}`);
    }
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || typeof parsed.channels !== "object") {
        throw new Error("missing 'channels' object");
      }
      return parsed as RegistryFile;
    } catch (err: any) {
      throw new Error(
        `registry.json corrupt (fail-closed) — repair or run 'abg gc': ${this.registryFile}: ${err.message}`,
      );
    }
  }

  private writeAtomic(reg: RegistryFile): void {
    this.ensureDir();
    reg.schemaVersion = REGISTRY_SCHEMA_VERSION;
    if (existsSync(this.registryFile)) {
      try {
        copyFileSync(this.registryFile, this.registryFile + ".bak");
      } catch {}
    }
    const tmp = this.registryFile + ".tmp";
    writeFileSync(tmp, JSON.stringify(reg, null, 2) + "\n", { mode: 0o600 });
    renameSync(tmp, this.registryFile);
  }

  private ensureDir(): void {
    if (!existsSync(this.registryDir)) {
      mkdirSync(this.registryDir, { recursive: true, mode: 0o700 });
    }
    try {
      chmodSync(this.registryDir, 0o700);
    } catch {}
  }

  /** Acquire the registry lock, run fn, release. NEVER fails open (契约 4). */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    this.ensureDir();
    const maxAttempts = 300;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (this.tryAcquireLock()) {
        try {
          return await fn();
        } finally {
          this.releaseLock();
        }
      }
      await sleep(20);
    }
    throw new Error(
      `Could not acquire registry lock after ${maxAttempts} attempts (never fail-open): ${this.lockFile}`,
    );
  }

  private tryAcquireLock(): boolean {
    try {
      const fd = openSync(this.lockFile, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      writeFileSync(fd, `${process.pid}\n`);
      closeSync(fd);
      return true;
    } catch (err: any) {
      if (err.code === "EEXIST") {
        // Recover only from a lock held by a dead process; otherwise keep waiting.
        try {
          const holder = Number.parseInt(readFileSync(this.lockFile, "utf-8").trim(), 10);
          if (Number.isFinite(holder) && !isProcessAlive(holder)) {
            this.releaseLock();
          }
        } catch {
          // Unreadable lock — leave it; caller retries.
        }
        return false;
      }
      // NEVER fail-open: any other error propagates.
      throw new Error(`registry lock error (never fail-open): ${err.message}`);
    }
  }

  private releaseLock(): void {
    try {
      unlinkSync(this.lockFile);
    } catch {}
  }
}

/**
 * Create the per-channel CODEX_HOME (0700) and symlink the shared auth.json / plugins /
 * .tmp from the root codex home. A real (non-symlink) dir/file at the destination is left
 * untouched to avoid clobbering or nesting (same policy as the PoC). config.toml is
 * generated separately (see channel-config.ts) — not symlinked.
 */
export function setupChannelHome(profile: ChannelProfile, rootCodexHome?: string): void {
  const root = rootCodexHome ?? process.env.CODEX_HOME ?? join(homedir(), ".codex");
  mkdirSync(profile.codexHome, { recursive: true, mode: 0o700 });
  try {
    chmodSync(profile.codexHome, 0o700);
  } catch {}
  // Shared (symlinked) state: login + plugin cache + tmp + notify scripts (契约 2/7).
  for (const name of ["auth.json", "plugins", ".tmp", "computer-use"]) {
    linkShared(join(root, name), join(profile.codexHome, name));
  }
  // Generated (NOT symlinked) per-channel config.toml — root-home paths rewritten (契约 2).
  const rootConfig = join(root, "config.toml");
  if (existsSync(rootConfig)) {
    const resolvedRoot = safeRealpath(root);
    const generated = generateChannelConfig(
      readFileSync(rootConfig, "utf-8"),
      resolvedRoot,
      profile.codexHome,
    );
    const dest = join(profile.codexHome, "config.toml");
    writeFileSync(dest, generated, { mode: 0o600 });
    try {
      chmodSync(dest, 0o600);
    } catch {}
  }
}

/** realpath if the path exists (resolves /tmp→/private/tmp etc. for 契约 2 prefix match);
 * otherwise return as-is so synthetic/test paths still work. */
function safeRealpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/** Symlink src→dest when dest is absent or already a symlink; skip a real file/dir. */
function linkShared(src: string, dest: string): void {
  if (!existsSync(src)) return; // root side missing → skip
  let destIsSymlink = false;
  try {
    destIsSymlink = lstatSync(dest).isSymbolicLink();
  } catch {
    // dest does not exist
  }
  if (destIsSymlink || !existsSync(dest)) {
    try {
      unlinkSync(dest);
    } catch {}
    symlinkSync(src, dest);
  }
}

/** Canonical env var names AgentBridge uses to pin a channel across spawned processes. */
export const CHANNEL_ENV_KEYS = {
  channelId: "AGENTBRIDGE_CHANNEL_ID",
  controlPort: "AGENTBRIDGE_CONTROL_PORT",
  codexAppPort: "CODEX_WS_PORT",
  codexProxyPort: "CODEX_PROXY_PORT",
  stateDir: "AGENTBRIDGE_STATE_DIR",
  codexHome: "CODEX_HOME",
} as const;

/** Render a channel profile as the 6 env vars that pin daemon + native spawns to it. */
export function profileToEnv(p: ChannelProfile): Record<string, string> {
  return {
    [CHANNEL_ENV_KEYS.channelId]: p.channelId,
    [CHANNEL_ENV_KEYS.controlPort]: String(p.controlPort),
    [CHANNEL_ENV_KEYS.codexAppPort]: String(p.codexAppPort),
    [CHANNEL_ENV_KEYS.codexProxyPort]: String(p.codexProxyPort),
    [CHANNEL_ENV_KEYS.stateDir]: p.stateDir,
    [CHANNEL_ENV_KEYS.codexHome]: p.codexHome,
  };
}

/**
 * Extract a complete channel profile env from an ambient env, gated on
 * AGENTBRIDGE_CHANNEL_ID (the inverse of profileToEnv). Returns undefined when no
 * named channel is active (legacy/default) — this preserves zero regression for users
 * who set CODEX_HOME / AGENTBRIDGE_CONTROL_PORT manually in default mode. When a channel
 * id IS present, ALL 6 keys are required, else it fails closed: an incomplete channel
 * env is a bug, not a silent partial bind. Used by bridge.ts / daemon.ts to pin spawns
 * EXPLICITLY (PR3) instead of relying on process.env inheritance (design §2).
 */
export function channelEnvFromProcessEnv(
  env: Record<string, string | undefined> = process.env,
): Record<string, string> | undefined {
  if (!env[CHANNEL_ENV_KEYS.channelId]) return undefined;
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of Object.values(CHANNEL_ENV_KEYS)) {
    const value = env[key];
    if (value === undefined || value === "") missing.push(key);
    else out[key] = value;
  }
  if (missing.length > 0) {
    throw new Error(
      `Incomplete channel env: AGENTBRIDGE_CHANNEL_ID is set but missing ${missing.join(", ")}`,
    );
  }
  return out;
}

/**
 * Throw if channelEnv pins a key to a value that conflicts with the owner's own
 * authoritative value for that key (split-brain guard, red-team path 1). The failure
 * this prevents: a daemon writing pid/status to one dir while the launcher waits on
 * another. Keys absent from channelEnv are fine — only present-and-different throws.
 */
export function assertChannelEnvConsistent(
  channelEnv: Record<string, string>,
  owned: Record<string, string>,
  owner: string,
): void {
  for (const [key, ownedValue] of Object.entries(owned)) {
    const envValue = channelEnv[key];
    if (envValue !== undefined && envValue !== ownedValue) {
      throw new Error(
        `${owner} channelEnv mismatch: ${key}='${envValue}' conflicts with authoritative '${ownedValue}' (split-brain)`,
      );
    }
  }
}
