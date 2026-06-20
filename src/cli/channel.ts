import { ChannelRegistry, setupChannelHome, parseChannelId, type ChannelProfile } from "../channel-profile";
import { withProjectTrust } from "../channel-config";
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
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

  console.error(`Unknown channel subcommand: ${sub ?? "(none)"}. Try: abg channel create <id> | trust <id> <dir>`);
  process.exit(1);
}
