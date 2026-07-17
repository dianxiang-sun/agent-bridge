#!/usr/bin/env python3
"""Deterministic artifact→observedStateSequence extraction (义务③).

Rule table is byte-for-byte the runbook's 附录 A (docs/phase0a-runbook.md);
extraction = keep rows whose kind is in the probe's allow-set, sort by seq
ascending, project {"kind"} ∪ retained data fields. Retained fields carry only
enum/bool/small-int constants so expectedStateSequence can be pre-written
(runbook §0.7). Any anomaly (bad JSONL, duplicate/non-monotonic seq, missing
retained field, non-scalar value) raises ExtractError — evidence is rejected,
never silently skipped (fail-closed).

The special P0A-CB `carrier_tuple` row is NOT part of observed extraction; it
is re-extracted separately via carrier_tuple_from_artifact() and compared to
detail.resolution.obtainCarrier by validate.py (spec §14.2 轮 60 P1-5).
"""
import json

from ab_canon import strict_pairs

# runbook 附录 A: probe → {kind: [retained data fields]}
EXTRACT_RULES = {
    "P0A-1": {
        "session_start_hook": [],  # hook source 原值不可预知 → 入 detail 不入 observed(runbook §1.6/附录 A)
        "registration_decision": ["mappedRegistrationSource", "generationDelta", "credentialRolled"],
        "signal_write": [],
        "file_changed_hook": [],
        "wake_observed": [],
        "duplicate_session_start": ["behavior"],
        "coalescing_run": [],
        "recovery_scenario": ["scenarioKind", "recovered"],
    },
    "P0A-2": {
        "plugin_install": ["ok"],
        "plugin_enable": ["ok"],
        "old_task_tool_probe": ["toolVisible"],
        "new_task_tool_probe": ["toolVisible"],
        "hook_trust_prompt": ["accepted"],
        "plugin_upgrade": ["hashChanged"],
        "retrust_prompt": ["required", "accepted"],
        "marketplace_refresh": ["behavior"],
    },
    "P0A-3": {
        "shim_spawn": ["reachable"],
        "identity_probe": ["obtained", "hostInjected"],
        "stability_check": ["phase", "stable"],
    },
    "P0A-4": {
        "mcp_handshake": ["ok"],
        "thread_started": [],
        "elicitation_captured": ["shapeCaptured"],
        "cancel_probe": ["cancelObserved"],
        "crash_restart_probe": ["sessionNotFound"],
        "auth_check": ["authSource"],
    },
    "P0A-5": {
        "visibility_check": ["visible"],
        "navigation_check": ["works"],
        "drain_resume_check": ["behavior"],
        "dual_client_check": ["behavior"],
    },
    "P0A-6": {
        "nudge_scenario": ["startEvent", "hookFired", "relativePhase"],
        "visual_check": ["position", "persistence"],
        "queue_mode_check": ["mode"],
        "model_context_check": ["entersModelContext"],
    },
    "P0A-7": {
        "resume_attempt": ["rejected"],
        "desktop_pollution_check": ["polluted"],
    },
    "P0A-8": {
        "uds_handshake": ["ok"],
        "uds_reconnect": ["ok"],
        "stale_socket_probe": ["handled"],
        "rollback_probe": ["ok"],
    },
    "P0A-9": {
        "producer_frozen": ["producer"],
        "same_turn_group_done": ["phasesCovered"],
        "cross_turn_sample": [],
        "derivation_done": [],
    },
    "P0A-CB": {
        "byte_source_probe": ["found", "sourceKind"],
        "digest_producer_probe": ["producer", "transport"],
        "caller_obtain_probe": ["protocol", "beforeSubmit"],
        "digest_replay_check": ["match"],
        "resolution_done": ["resolutionKind"],
    },
}


class ExtractError(Exception):
    pass


def _reject_float(s):
    raise ExtractError(f"float forbidden in artifact: {s}")


def _reject_const(s):
    raise ExtractError(f"non-finite forbidden in artifact: {s}")


ENV_SNAPSHOT_REQUIRED = ("hostMatrix", "runbookVersion", "profileVersion", "isolation")


def parse_artifact(data: bytes):
    """Parse artifact JSONL; enforce seq strictly increasing by 1 from 1 and
    the env_snapshot first row incl. its required fields (runbook §0.4)."""
    rows = []
    try:
        lines = data.decode("utf-8").splitlines()
    except UnicodeDecodeError as e:
        raise ExtractError(f"artifact is not valid UTF-8: {e}")
    if not lines:
        raise ExtractError("artifact is empty")
    for n, line in enumerate(lines, 1):
        if not line.strip():
            raise ExtractError(f"artifact line {n}: blank line forbidden")
        try:
            row = json.loads(line, parse_float=_reject_float, parse_constant=_reject_const,
                             object_pairs_hook=strict_pairs)
        except ExtractError:
            raise
        except Exception as e:
            raise ExtractError(f"artifact line {n}: invalid JSON: {e}")
        if not isinstance(row, dict):
            raise ExtractError(f"artifact line {n}: not an object")
        for f in ("seq", "atMs", "kind", "data"):
            if f not in row:
                raise ExtractError(f"artifact line {n}: missing '{f}'")
        if not (isinstance(row["seq"], int) and not isinstance(row["seq"], bool)):
            raise ExtractError(f"artifact line {n}: seq not int")
        if row["seq"] != n:
            raise ExtractError(f"artifact line {n}: seq must be strictly {n} (monotonic +1 from 1)")
        if not isinstance(row["kind"], str) or not isinstance(row["data"], dict):
            raise ExtractError(f"artifact line {n}: kind must be str, data must be object")
        rows.append(row)
    if rows[0]["kind"] != "env_snapshot":
        raise ExtractError("artifact first row must be kind=env_snapshot (runbook §0.4)")
    for f in ENV_SNAPSHOT_REQUIRED:
        if f not in rows[0]["data"]:
            raise ExtractError(f"env_snapshot missing required field '{f}' (runbook §0.4)")
    return rows


def env_snapshot_data(artifact_bytes: bytes) -> dict:
    """First-row env_snapshot data — validate.py cross-checks it against the
    evidence top-level hostMatrix/runbookVersion/profileVersion and the
    isolation gate (r82b P0: 防自洽空 artifact/未绑定环境入门)."""
    return parse_artifact(artifact_bytes)[0]["data"]


def host_instance_ids(artifact_bytes: bytes) -> list:
    """P0A-9 only (r84 F1): instanceId values of host_instance rows, in order.
    These rows prove the collection actually spanned a HOST restart (spec §14.2
    轮 58: pre/post_restart = 宿主重启, not stub restart). Not in any extraction
    allow-set — never enters observed. Raises on a malformed row (fail-closed)."""
    ids = []
    for row in parse_artifact(artifact_bytes):
        if row["kind"] != "host_instance":
            continue
        v = row["data"].get("instanceId")
        if not isinstance(v, str) or v == "":
            raise ExtractError(f"artifact seq {row['seq']}: host_instance.instanceId "
                               "must be a non-empty string (runbook §9.3)")
        ids.append(v)
    return ids


def p0a1_scenario_sources(artifact_bytes: bytes) -> list:
    """P0A-1 only (r83): raw hook sources of the FOUR scenario rows, in order.
    A scenario row = a session_start_hook row immediately followed by a
    registration_decision row (the duplicate-precursor session_start_hook is
    followed by duplicate_session_start instead). validate.py binds these to
    detail.perSourceScenarios[i].hostHookSource — detail cannot misreport (or
    swap) what the hash-anchored artifact actually recorded."""
    rows = parse_artifact(artifact_bytes)
    sources = []
    for cur, nxt in zip(rows, rows[1:]):
        if cur["kind"] == "session_start_hook" and nxt["kind"] == "registration_decision":
            if "source" not in cur["data"]:
                raise ExtractError(f"artifact seq {cur['seq']}: scenario session_start_hook "
                                   "missing raw 'source' (runbook §1.5)")
            sources.append(cur["data"]["source"])
    return sources


def extract_observed(probe_id: str, artifact_bytes: bytes) -> dict:
    if probe_id not in EXTRACT_RULES:
        raise ExtractError(f"no extraction rule for probe {probe_id}")
    rules = EXTRACT_RULES[probe_id]
    events = []
    for row in parse_artifact(artifact_bytes):
        kind = row["kind"]
        if kind not in rules:
            continue  # env_snapshot and non-allow-set rows never enter observed
        ev = {"kind": kind}
        for f in rules[kind]:
            if f not in row["data"]:
                raise ExtractError(f"artifact seq {row['seq']} kind={kind}: retained field '{f}' missing")
            v = row["data"][f]
            if not (isinstance(v, (str, bool)) or (isinstance(v, int) and not isinstance(v, bool))):
                raise ExtractError(f"artifact seq {row['seq']} kind={kind}.{f}: retained value must be scalar")
            ev[f] = v
        events.append(ev)
    return {"events": events}


CARRIER_FIELDS = ("carrierEventRef", "authChannel", "obtainedAtBeforeSubmit", "callerReceivedDigest")


def carrier_tuple_from_artifact(artifact_bytes: bytes) -> dict:
    """P0A-CB only: re-extract the full obtainCarrier tuple from the single
    carrier_tuple artifact row (轮 60 P1-5: 全 tuple MUST 重抽一致)."""
    rows = [r for r in parse_artifact(artifact_bytes) if r["kind"] == "carrier_tuple"]
    if len(rows) != 1:
        raise ExtractError(f"expected exactly 1 carrier_tuple row, got {len(rows)}")
    data = rows[0]["data"]
    if set(data.keys()) != set(CARRIER_FIELDS):
        raise ExtractError(f"carrier_tuple fields {sorted(data)} != required {sorted(CARRIER_FIELDS)}")
    return {f: data[f] for f in CARRIER_FIELDS}
