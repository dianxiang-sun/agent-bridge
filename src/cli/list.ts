import { ChannelRegistry, type ChannelProfile } from "../channel-profile";
import { parseChannelFlag } from "./channel-args";

/** Read named channel profiles from the registry, optionally filtered to one channel id. */
export function buildChannelList(registryRoot?: string, channelId?: string): ChannelProfile[] {
  const all = new ChannelRegistry(registryRoot).list();
  return channelId ? all.filter((c) => c.channelId === channelId) : all;
}

/**
 * `abg list [--channel <id>] [--json]` — list named channels. `--channel` filters to one channel
 * (and rejects an illegal id). PR2 scope is registry/profile-level only; the five-state
 * classification (running/stopped/stale-dead/blocked-port/corrupt) lands in PR5.
 */
export async function runList(args: string[]): Promise<void> {
  const { channelId, rest } = parseChannelFlag(args); // validates --channel (rejects ../x etc.)
  const json = rest.includes("--json");
  const channels = buildChannelList(undefined, channelId ?? undefined);

  if (channelId && channels.length === 0) {
    console.error(`Channel '${channelId}' does not exist.`);
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify(channels, null, 2));
    return;
  }

  if (channels.length === 0) {
    console.log("No named channels. Create one with: abg claude --channel <id>");
    return;
  }

  for (const c of channels) {
    console.log(
      `${c.channelId.padEnd(16)} control=${c.controlPort}  codex-app=${c.codexAppPort}  proxy=${c.codexProxyPort}`,
    );
    console.log(`  stateDir=${c.stateDir}`);
    console.log(`  codexHome=${c.codexHome}`);
  }
}
