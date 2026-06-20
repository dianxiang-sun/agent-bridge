import { ChannelRegistry, classifyChannel, type ChannelState } from "../channel-profile";

export interface GcResult {
  removed: Array<{ channelId: string; state: ChannelState }>;
  kept: Array<{ channelId: string; state: ChannelState }>;
}

/**
 * Which lifecycle states `abg gc` reclaims (契约6). stale-dead / corrupt are always swept;
 * blocked-port is NEVER auto-reclaimed (契约6) unless --force; running / stopped are retained
 * (a stopped channel keeps its profile for reuse). Forgetting a blocked-port allocation with
 * --force only drops the registry entry — it does NOT kill the occupant or free the port.
 */
export function shouldGc(state: ChannelState, force: boolean): boolean {
  if (state === "stale-dead" || state === "corrupt") return true;
  if (force && state === "blocked-port") return true;
  return false;
}

/**
 * `abg gc [--force]` — drop registry entries for dead/corrupt channels (契约6). REGISTRY-ONLY:
 * never deletes a channel's codexHome / stateDir (用户拍板: 那里有 Codex sessions/memories,
 * 删=数据丢失; 目录清理留给未来显式 --prune-dirs)。Whole-registry corruption surfaces as a
 * fail-closed throw from readRaw (命令级,不静默重写空 registry)。
 */
export async function runGc(args: string[] = [], registryRoot?: string): Promise<GcResult> {
  const force = args.includes("--force");
  const reg = new ChannelRegistry(registryRoot);
  const result: GcResult = { removed: [], kept: [] };

  // Key-driven (not value-driven): a corrupt entry may lack its own channelId field, but the
  // map key is always authoritative for removal.
  for (const [channelId, profile] of reg.entries()) {
    const state = await classifyChannel(profile);
    if (shouldGc(state, force)) {
      await reg.remove(channelId); // registry-only: codexHome / stateDir left untouched
      result.removed.push({ channelId, state });
    } else {
      result.kept.push({ channelId, state });
    }
  }

  for (const r of result.removed) console.log(`gc: removed '${r.channelId}' (${r.state})`);
  if (result.removed.length === 0) console.log("gc: nothing to reclaim.");
  if (!force && result.kept.some((k) => k.state === "blocked-port")) {
    console.log("gc: blocked-port channel(s) retained — re-run with --force to forget them (does NOT free the port or kill anything).");
  }
  return result;
}
