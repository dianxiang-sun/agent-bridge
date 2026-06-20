import { ChannelRegistry, setupChannelHome, type ChannelProfile } from "../channel-profile";

/** Explicitly create (or idempotently reuse) a named channel: allocate profile + set up home. */
export async function createChannel(id: string, registryRoot?: string): Promise<ChannelProfile> {
  const profile = await new ChannelRegistry(registryRoot).allocate(id); // validates id (契约9)
  setupChannelHome(profile);
  return profile;
}

/** `abg channel create <id>` — explicit channel creation (supports the startup-order contract). */
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

  console.error(`Unknown channel subcommand: ${sub ?? "(none)"}. Try: abg channel create <id>`);
  process.exit(1);
}
