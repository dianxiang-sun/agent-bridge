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
import type { TmuxKillContext } from "./tmux-context";

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
 * Resolve what `abg kill [...]` targets. Identity for a no-arg kill comes from two
 * sources — the tmux session marker (which AgentBridge-managed session am I in) and
 * the process env (which channel was my spawn chain pinned to). A destructive no-arg
 * kill must never GUESS when they disagree or when neither is trustworthy.
 *
 * Priority (no explicit target):
 *  1. explicit argv (`--all` / `--channel` / positional / `default`) wins over all.
 *  2. managed tmux marker + complete env: agree → use it; conflict → hard refuse.
 *  3. managed tmux marker, no env → marker wins (kills the session you're looking at).
 *  4. complete named env, no managed marker → env wins (the pinned spawn chain).
 *  5. in tmux but UNMARKED → hard refuse (can't infer current channel; never fall back default).
 *  6. otherwise → default via defaultProfileFromEnv(env) (honors legacy/E2E env overrides); the
 *     Mechanism C identity gate in killOneTarget validates {channelId:default, pid} before signaling.
 */
export function resolveKillScope(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
  registryRoot?: string,
  tmuxContext: TmuxKillContext = { kind: "outside-tmux" },
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

  // ── No explicit target → context-aware (tmux marker + env), never guess on conflict ──
  const channelEnv = channelEnvFromProcessEnv(env); // throws if CHANNEL_ID set but 6-key incomplete
  const envId = channelEnv ? channelEnv.AGENTBRIDGE_CHANNEL_ID : null; // includes "default"
  const envNamedId = envId !== null && envId !== "default" ? envId : null;

  if (tmuxContext.kind === "managed-tmux") {
    const tmuxId = tmuxContext.channelId;
    // The marker is a coherent triplet: sessionKind=default ⟺ channelId=default. A malformed
    // marker (e.g. a stale named session left with channelId=default) must NOT be trusted — it
    // would slide back into the wrong-channel kill this fix removes (Codex review #1).
    const coherent =
      (tmuxContext.sessionKind === "default" && tmuxId === "default") ||
      (tmuxContext.sessionKind === "named" && tmuxId !== "default");
    if (!coherent) {
      throw new Error(
        `invalid AgentBridge tmux marker in session '${tmuxContext.sessionName}': ` +
        `sessionKind='${tmuxContext.sessionKind}', channelId='${tmuxId}'. Refusing malformed marker for \`kill\`.\n` +
        `Use an explicit target:  abg kill --channel <id>  |  abg kill default  (or rebuild via abg-tmux).`,
      );
    }
    // marker + complete env disagree → corrupted context, refuse (don't pick either).
    if (envId !== null && envId !== tmuxId) {
      throw new Error(
        `ambiguous AgentBridge channel for \`kill\`: tmux session marker says '${tmuxId}' but this ` +
        `shell's environment says '${envId}'. Refusing to guess for a destructive command.\n` +
        `Pick one:  abg kill --channel ${tmuxId}  |  abg kill --channel ${envId}  |  abg kill default`,
      );
    }
    if (tmuxId === "default") {
      return { mode: "default", profile: canonicalDefaultProfile() }; // marker=default → canonical (never env)
    }
    const id = parseChannelId(tmuxId);
    const profile = new ChannelRegistry(registryRoot).read(id);
    if (!profile) {
      throw new Error(`tmux session marker says channel '${id}', but the registry has no such channel (run 'abg gc' or rebuild the session).`);
    }
    return { mode: "named", profile };
  }

  // Not in a managed tmux session.
  if (envNamedId !== null) {
    return { mode: "named", profile: profileFromChannelEnv(channelEnv!) }; // complete named env wins
  }

  // In an UNMARKED tmux session we cannot infer the current channel → refuse (never fall back default).
  if (tmuxContext.kind === "unmarked-tmux") {
    throw new Error(
      `cannot infer the AgentBridge channel of unmarked tmux session '${tmuxContext.sessionName}'. ` +
      `Bare \`abg kill\` would be unsafe here.\n` +
      `Use an explicit target:  abg kill --channel <id>  |  abg kill default\n` +
      `Or rebuild the session with the fixed wrapper:  abg-tmux -f @<channel> <dir>`,
    );
  }

  // Default: outside tmux, or env pinned to default — possibly with env-overridden state/ports for a
  // legacy/E2E default daemon. Honor env overrides here (defaultProfileFromEnv); the Mechanism C
  // identity gate in killOneTarget (healthz must report channelId:default AND the pid must not belong
  // to any named channel) is what actually protects a leaked named STATE_DIR/port from being killed
  // as "default" — doing it there, not here, keeps the legitimate env-scoped default path working.
  return { mode: "default", profile: defaultProfileFromEnv(env) };
}
