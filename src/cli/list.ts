import { ChannelRegistry, classifyChannel, type ChannelProfile, type ChannelState } from "../channel-profile";
import { parseChannelFlag } from "./channel-args";

/** Read named channel profiles from the registry, optionally filtered to one channel id. */
export function buildChannelList(registryRoot?: string, channelId?: string): ChannelProfile[] {
  const all = new ChannelRegistry(registryRoot).list();
  return channelId ? all.filter((c) => c.channelId === channelId) : all;
}

/** Each registry channel + its live five-state (running/stopped/stale-dead/blocked-port/corrupt). */
export async function buildChannelStatusList(
  registryRoot?: string,
  channelId?: string,
): Promise<Array<ChannelProfile & { state: ChannelState }>> {
  const profiles = buildChannelList(registryRoot, channelId);
  return Promise.all(profiles.map(async (p) => ({ ...p, state: await classifyChannel(p) })));
}

/**
 * `abg list [--channel <id>] [--json]` — list named channels with their lifecycle state.
 * `--channel` filters to one channel (and rejects an illegal id). The five-state classification
 * (running/stopped/stale-dead/blocked-port/corrupt) is computed live via classifyChannel (PR5).
 */
export async function runList(args: string[]): Promise<void> {
  const { channelId, rest } = parseChannelFlag(args); // validates --channel (rejects ../x etc.)
  const json = rest.includes("--json");

  if (channelId && buildChannelList(undefined, channelId).length === 0) {
    console.error(`Channel '${channelId}' does not exist.`);
    process.exit(1);
  }

  const channels = await buildChannelStatusList(undefined, channelId ?? undefined);

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
      `${c.channelId.padEnd(16)} ${c.state.padEnd(12)} control=${c.controlPort}  codex-app=${c.codexAppPort}  proxy=${c.codexProxyPort}`,
    );
    console.log(`  stateDir=${c.stateDir}`);
    console.log(`  codexHome=${c.codexHome}`);
  }
}
