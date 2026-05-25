#!/usr/bin/env bash

set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"

workspace="${CLAUDE_PROJECT_DIR:-${PWD}}"
cooldown_seconds="${AGENTBRIDGE_HEALTH_HOOK_COOLDOWN_SECONDS:-120}"
state_root="${AGENTBRIDGE_HOOK_STATE_DIR:-${TMPDIR:-/tmp}/agentbridge-hooks}"
port="${AGENTBRIDGE_CONTROL_PORT:-4502}"

if ! command -v curl >/dev/null 2>&1; then
  exit 0
fi

mkdir -p "$state_root" 2>/dev/null || true
workspace_key="$(printf '%s' "$workspace" | cksum | awk '{print $1}')"
stamp_file="${state_root}/sessionstart-${workspace_key}.stamp"
now="$(date +%s)"

if [ -f "$stamp_file" ]; then
  last_notice="$(cat "$stamp_file" 2>/dev/null || echo 0)"
  if [ $((now - last_notice)) -lt "$cooldown_seconds" ]; then
    exit 0
  fi
fi

printf '%s' "$now" >"$stamp_file" 2>/dev/null || true

health_json="$(curl -fsS --max-time 1 "http://127.0.0.1:${port}/healthz" 2>/dev/null || true)"

if [ -n "$health_json" ]; then
  # NOTE: the healthz "bridgeReady" field is the daemon's canReply() (see src/daemon.ts
  # currentStatus), i.e. rawBridgeReady && (tuiConnected || reconnect-grace) — NOT the raw
  # bridge-thread flag. Treat it as can_reply here so the hint matches actual reply-ability.
  tui_connected="false"
  can_reply="false"
  if printf '%s' "$health_json" | grep -Eq '"tuiConnected"[[:space:]]*:[[:space:]]*true'; then
    tui_connected="true"
  fi
  if printf '%s' "$health_json" | grep -Eq '"bridgeReady"[[:space:]]*:[[:space:]]*true'; then
    can_reply="true"
  fi

  if [ "$can_reply" = "true" ] && [ "$tui_connected" = "true" ]; then
    cat <<EOF
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"AgentBridge is running. Daemon healthy, Codex TUI connected. Bridge is ready for communication."}}
EOF
  elif [ "$tui_connected" = "true" ]; then
    cat <<EOF
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"AgentBridge daemon and Codex TUI are connected, but the bridge thread is not ready yet — replies will be rejected until it is. It may still be initializing; retry shortly."}}
EOF
  elif [ "$can_reply" = "true" ]; then
    cat <<EOF
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"AgentBridge daemon is running. Codex TUI recently disconnected; the bridge is still in the reconnect grace window. If this persists, start Codex in another terminal with: agentbridge codex"}}
EOF
  else
    cat <<EOF
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"AgentBridge daemon is running but Codex TUI is not connected yet. Start Codex in another terminal with: agentbridge codex"}}
EOF
  fi
else
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"AgentBridge daemon is not reachable on http://127.0.0.1:${port}/healthz yet. Start the bridge with: agentbridge claude (this terminal) + agentbridge codex (another terminal). If you're already using agentbridge claude, the daemon may still be starting up."}}
EOF
fi
