import {
  parseChannelId,
  ChannelRegistry,
  profileToEnv,
  channelEnvFromProcessEnv,
  profileFromChannelEnv,
  canonicalDefaultProfile,
  defaultProfileFromEnv,
  type ChannelProfile,
} from "../channel-profile";

/**
 * Parse and strip the AgentBridge-owned `--channel <id>` / `--channel=<id>` flag from argv.
 *
 * The flag is NEVER passed through to the native claude/codex command. Returns the validated
 * channel id (or null when absent) and the remaining native args. Rejects a missing value,
 * a duplicate flag, and any illegal/reserved id (via parseChannelId).
 */
export function parseChannelFlag(argv: string[]): { channelId: string | null; rest: string[] } {
  let channelId: string | null = null;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--channel") {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) {
        throw new Error("--channel requires a value, e.g. --channel myproj");
      }
      if (channelId !== null) throw new Error("--channel specified more than once");
      channelId = parseChannelId(v);
      i++; // consume the value token
      continue;
    }

    if (a.startsWith("--channel=")) {
      if (channelId !== null) throw new Error("--channel specified more than once");
      channelId = parseChannelId(a.slice("--channel=".length));
      continue;
    }

    rest.push(a);
  }

  return { channelId, rest };
}

export interface ResolvedChannel {
  /** null = default / no --channel (legacy inheritance path, untouched). */
  profile: ChannelProfile | null;
  nativeArgs: string[];
  /** 6 env vars to apply for a named channel, or null for default. */
  env: Record<string, string> | null;
}

export interface ResolvedCodexChannel extends ResolvedChannel {
  /** Named channel: proxy URL straight from the profile (NO config fallback). null for default. */
  proxyUrl: string | null;
}

/**
 * codex: read-only resolution; a missing channel throws (契约 5 — no implicit allocate).
 * Named channels get their proxy URL straight from the profile — never the config fallback.
 */
export function resolveCodexChannel(argv: string[], registryRoot?: string): ResolvedCodexChannel {
  const { channelId, rest } = parseChannelFlag(argv);
  if (channelId === null) return { profile: null, nativeArgs: rest, env: null, proxyUrl: null };
  const profile = new ChannelRegistry(registryRoot).read(channelId);
  if (!profile) {
    throw new Error(
      `Channel '${channelId}' does not exist. Run 'abg claude --channel ${channelId}' first, or 'abg channel create ${channelId}'.`,
    );
  }
  return {
    profile,
    nativeArgs: rest,
    env: profileToEnv(profile),
    proxyUrl: `ws://127.0.0.1:${profile.codexProxyPort}`,
  };
}

/** kill: read-only resolution; a missing channel throws. */
export function resolveKillChannel(argv: string[], registryRoot?: string): ResolvedChannel {
  const { channelId, rest } = parseChannelFlag(argv);
  if (channelId === null) return { profile: null, nativeArgs: rest, env: null };
  const profile = new ChannelRegistry(registryRoot).read(channelId);
  if (!profile) {
    throw new Error(`Channel '${channelId}' does not exist (nothing to kill).`);
  }
  return { profile, nativeArgs: rest, env: profileToEnv(profile) };
}

/** What `abg kill [...]` targets — one named channel, all named channels, or legacy default. */
export type KillScope =
  | { mode: "default"; profile: ChannelProfile }
  | { mode: "named"; profile: ChannelProfile }
  | { mode: "all"; profiles: ChannelProfile[] };

/**
 * Resolve what `abg kill [...]` targets (context-aware, 用户纠偏 2026-06-20):
 *  - `--all`              → every named registry channel (NOT default — it stays常驻保活).
 *  - `<name>` / `--channel`→ that named channel from the registry (explicit wins over ambient
 *                            env); `default` → the canonical legacy default (scrubbed of any
 *                            named env so a kill-from-named-context doesn't pollute the target).
 *  - no target            → context-aware from env: a COMPLETE named channel env → that channel
 *                            (env tuple is authoritative, not the registry — kills the bridge
 *                            you're IN); a channel id set but the 6-key env incomplete → throw
 *                            (never fall back to default, that would kill the wrong bridge);
 *                            no / `default` channel id → legacy default (honors env overrides).
 */
export function resolveKillScope(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
  registryRoot?: string,
): KillScope {
  let all = false;
  let flagName: string | null = null;
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") { all = true; continue; }
    if (a === "--channel") {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Error("--channel requires a value, e.g. --channel myproj");
      if (flagName !== null) throw new Error("--channel specified more than once");
      flagName = v; i++; continue;
    }
    if (a.startsWith("--channel=")) {
      if (flagName !== null) throw new Error("--channel specified more than once");
      flagName = a.slice("--channel=".length); continue;
    }
    if (a.startsWith("-")) continue; // ignore unrelated flags (don't treat as channel name)
    positionals.push(a);
  }
  if (positionals.length > 1) {
    throw new Error(`kill: too many channel names (${positionals.join(", ")}); pass one name, or --all`);
  }
  const positional = positionals[0] ?? null;
  if (positional !== null && flagName !== null && positional !== flagName) {
    throw new Error(`kill: conflicting targets — positional '${positional}' vs --channel '${flagName}'`);
  }
  const explicit = flagName ?? positional;

  if (all) {
    if (explicit !== null) throw new Error("kill: --all cannot be combined with a channel name");
    return { mode: "all", profiles: new ChannelRegistry(registryRoot).list() }; // named registry only
  }

  if (explicit !== null) {
    if (explicit === "default") return { mode: "default", profile: canonicalDefaultProfile() };
    const id = parseChannelId(explicit); // rejects illegal / reserved
    const profile = new ChannelRegistry(registryRoot).read(id);
    if (!profile) throw new Error(`Channel '${id}' does not exist (nothing to kill).`);
    return { mode: "named", profile };
  }

  // No explicit target → context-aware from ambient env.
  const channelEnv = channelEnvFromProcessEnv(env); // throws if CHANNEL_ID set but 6-key incomplete
  if (channelEnv && channelEnv.AGENTBRIDGE_CHANNEL_ID !== "default") {
    return { mode: "named", profile: profileFromChannelEnv(channelEnv) }; // env tuple authoritative
  }
  return { mode: "default", profile: defaultProfileFromEnv(env) }; // legacy: honor env overrides
}
