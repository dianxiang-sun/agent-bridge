import { execFileSync } from "node:child_process";

/**
 * AgentBridge channel identity of the CURRENT tmux client, derived from explicit
 * session markers written by abg-tmux (NOT from the session name).
 */
export type TmuxKillContext =
  | { kind: "outside-tmux" }
  | { kind: "unmarked-tmux"; sessionName: string }
  | { kind: "managed-tmux"; sessionName: string; sessionKind: string; channelId: string };

/** Injectable seam for tests; mirrors the slice of execFileSync we use. */
export type TmuxExec = (file: string, args: string[]) => string;

const defaultExec: TmuxExec = (file, args) =>
  execFileSync(file, args, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });

/**
 * Resolve the AgentBridge channel of the current tmux client via the marker triplet
 * `@agentbridge_managed` / `@agentbridge_session_kind` / `@agentbridge_channel_id`.
 *
 * Deliberately does NOT use the tmux session NAME as identity: a default-channel
 * session for directory basename `ICSE27` and a named channel `@ICSE27` derive the
 * SAME session name, so the name cannot disambiguate. The marker triplet can.
 *
 * Queries `display-message` with NO `-t` target so it follows the current $TMUX
 * client/socket — correct under nested or `tmux -L <other>` servers. An unset custom
 * option reads back as "" (verified tmux 3.6b), so an empty/partial marker => unmarked.
 * If tmux is missing or the query fails while $TMUX is set, we are in tmux but cannot
 * identify the session: classify unmarked so a destructive no-arg kill refuses rather
 * than guesses.
 */
export function detectTmuxKillContext(
  env: Record<string, string | undefined> = process.env,
  exec: TmuxExec = defaultExec,
): TmuxKillContext {
  if (!env.TMUX) return { kind: "outside-tmux" };

  let raw: string;
  try {
    raw = exec("tmux", [
      "display-message",
      "-p",
      "#{session_name}\t#{@agentbridge_managed}\t#{@agentbridge_session_kind}\t#{@agentbridge_channel_id}",
    ]).replace(/\n+$/, "");
  } catch {
    return { kind: "unmarked-tmux", sessionName: "" };
  }

  const [sessionName = "", managed = "", sessionKind = "", channelId = ""] = raw.split("\t");
  if (managed === "1" && sessionKind !== "" && channelId !== "") {
    return { kind: "managed-tmux", sessionName, sessionKind, channelId };
  }
  return { kind: "unmarked-tmux", sessionName };
}
