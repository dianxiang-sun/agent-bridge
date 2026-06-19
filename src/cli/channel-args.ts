import { parseChannelId, ChannelRegistry, profileToEnv, type ChannelProfile } from "../channel-profile";

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
