import { appendFileSync, renameSync, statSync } from "node:fs";

/** Default per-file cap. One rotated backup (`<file>.1`) is kept, so a log's
 *  total disk footprint is bounded by ~2x this value. Override (bytes) via
 *  AGENTBRIDGE_LOG_MAX_BYTES. */
const DEFAULT_MAX_BYTES = (() => {
  const parsed = parseInt(process.env.AGENTBRIDGE_LOG_MAX_BYTES ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 5 * 1024 * 1024;
})();

/** Size-capped append for daemon/bridge/adapter logging. When appending would
 *  push `file` past the cap, it is renamed to `<file>.1` first (replacing any
 *  previous backup). All failures are swallowed — logging must never take the
 *  process down (same contract as the bare appendFileSync try/catch it replaces). */
export function appendLogRotated(file: string, line: string, maxBytes = DEFAULT_MAX_BYTES): void {
  try {
    try {
      if (statSync(file).size + line.length > maxBytes) {
        renameSync(file, `${file}.1`);
      }
    } catch {
      // ENOENT and friends: nothing to rotate.
    }
    appendFileSync(file, line);
  } catch {
    // Logging is best-effort by contract.
  }
}
