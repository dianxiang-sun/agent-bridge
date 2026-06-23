#!/usr/bin/env bun

/**
 * AgentBridge CLI
 *
 * Commands:
 *   agentbridge init        — Install plugin, check deps, generate project config
 *   agentbridge dev         — Register local marketplace + install plugin for local dev
 *   agentbridge claude      — Start Claude Code with push channel flags
 *   agentbridge codex       — Start Codex TUI connected to daemon
 *   agentbridge kill        — Stop one AgentBridge channel (current tmux/env context, or --channel/--all)
 */

const args = process.argv.slice(2);
const command = args[0];
const restArgs = args.slice(1);

// Marketplace name constant (shared with plugin)
export const MARKETPLACE_NAME = "agentbridge";
export const PLUGIN_NAME = "agentbridge";

async function main() {
  switch (command) {
    case "init":
      const { runInit } = await import("./cli/init");
      await runInit();
      break;
    case "dev":
      const { runDev } = await import("./cli/dev");
      await runDev();
      break;
    case "claude":
      const { runClaude } = await import("./cli/claude");
      await runClaude(restArgs);
      break;
    case "codex":
      const { runCodex } = await import("./cli/codex");
      await runCodex(restArgs);
      break;
    case "kill":
      const { runKill } = await import("./cli/kill");
      await runKill(restArgs);
      break;
    case "list":
      const { runList } = await import("./cli/list");
      await runList(restArgs);
      break;
    case "channel":
      const { runChannel } = await import("./cli/channel");
      await runChannel(restArgs);
      break;
    case "gc":
      const { runGc } = await import("./cli/gc");
      await runGc(restArgs);
      break;
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    case "--version":
    case "-v":
      printVersion();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error(`Run "agentbridge --help" (or "abg --help") for usage.`);
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
AgentBridge — Multi-agent collaboration bridge

Usage:
  agentbridge <command> [args...]
  abg <command> [args...]

Commands:
  init              Install plugin, check dependencies, generate project config
  dev               Register local marketplace + install plugin (for local dev)
  claude [args...]  Start Claude Code with push channel enabled
  codex [args...]   Start Codex TUI connected to AgentBridge daemon
  kill [target]     Stop ONE AgentBridge channel (current context; see Multi-channel)
  kill --all        Stop ALL named channels (default stays running)
  list [--json]     List named channels
  channel create <id>       Create a named channel
  channel trust <id> <dir>  Trust a workspace dir in a channel (skip codex prompt)

Multi-channel:
  Add --channel <id> to claude/codex/kill to run an isolated channel
  (independent ports + state + CODEX_HOME).
  Bare 'kill' (no target) stops the CURRENT channel: inside an abg-tmux session it
  uses the session's AgentBridge marker; otherwise it follows the process env, and
  REFUSES (rather than guess) when the context is ambiguous or unmarked. Target
  explicitly with '--channel <id>' or 'default'.

Options:
  --help, -h        Show this help message
  --version, -v     Show version

Examples:
  abg init                     # First-time setup
  abg claude                   # Start Claude Code
  abg claude --resume          # Start Claude Code and resume session
  abg codex                    # Start Codex TUI
  abg codex --model o3         # Start Codex with specific model
  abg kill                     # Stop the CURRENT channel (tmux marker / env aware)
  abg kill --channel ICSE27    # Stop a specific named channel
  abg kill default             # Stop the canonical default channel
  abg kill --all               # Stop all named channels
`.trim());
}

function printVersion() {
  try {
    const pkg = require("../package.json");
    console.log(`agentbridge v${pkg.version}`);
  } catch {
    console.log("agentbridge (version unknown)");
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
