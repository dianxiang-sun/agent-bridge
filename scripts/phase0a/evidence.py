#!/usr/bin/env python3
"""ProbeEvidence closed-shape validation (v3-protocol-spec.md §14.2).

Enforces (harness 义务①, exact-shape CHECK verbatim):
  1. status ∈ {PASS, FAIL, INCONCLUSIVE}  ⇔  all EIGHT run-state fields NOT NULL
  2. status = NOT_RUN                     ⇔  all EIGHT run-state fields NULL
  (3. status=PASS ⇔ passPredicate=true — evaluated in validate.py with predicates.py)

Closed top-level schema (14 fields = 13 hash-input fields + evidenceDigest);
unknown fields rejected (§1.3 unknown-field policy — evidence is release-gate
authority, held to safety-bearing strictness). All checks are fail-closed:
any anomaly appends an error; empty error list is the only acceptance.
"""
import re

from ab_canon import SAFE_INT_MAX

DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")

PROBE_IDS = ["P0A-1", "P0A-2", "P0A-3", "P0A-4", "P0A-5",
             "P0A-6", "P0A-7", "P0A-8", "P0A-9", "P0A-CB"]

RUN_STATES = ("PASS", "FAIL", "INCONCLUSIVE")
ALL_STATES = RUN_STATES + ("NOT_RUN",)

# The EIGHT run-state fields (spec §14.2 exact-shape CHECK, 轮 59/60 verbatim)
EIGHT_FIELDS = ("executedAt", "evidenceDigest", "detail", "artifactRef",
                "observedStateSequence", "expectedStateSequence", "timeoutMs", "fallbackOnFail")

# hash-input field list for evidenceDigest (spec §14.2 comment, 13 fields, order irrelevant under JCS)
HASH_INPUT_FIELDS = ("probeId", "probeSchemaVersion", "status", "hostMatrix",
                     "runbookVersion", "profileVersion", "executedAt", "detail",
                     "observedStateSequence", "artifactRef", "expectedStateSequence",
                     "timeoutMs", "fallbackOnFail")

TOP_FIELDS = set(HASH_INPUT_FIELDS) | {"evidenceDigest"}

HOST_MATRIX_FIELDS = ("product", "hostVersion", "os", "osVersion")


def is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _err(errors, path, msg):
    errors.append(f"{path}: {msg}")


def _req(obj, path, errors, field, pred, want):
    if field not in obj:
        _err(errors, f"{path}.{field}", "missing")
        return None
    v = obj[field]
    if not pred(v):
        _err(errors, f"{path}.{field}", f"expected {want}, got {type(v).__name__}={v!r}")
        return None
    return v


def _closed(obj, path, errors, allowed):
    for k in obj:
        if k not in allowed:
            _err(errors, f"{path}.{k}", "unknown field (closed schema)")


def _check_str(v):
    return isinstance(v, str)


def _check_nonempty_str(v):
    return isinstance(v, str) and v != ""


def _numeric_walk(node, path, errors):
    """Whole-tree numeric discipline (spec §1.4; r82b P1: shape 层统一拒收,
    不留给 digest 重算层抛 traceback): ints must be JSON safe integers,
    floats forbidden anywhere in evidence."""
    if isinstance(node, bool):
        return
    if isinstance(node, float):
        _err(errors, path, "float forbidden in evidence (spec §1.4)")
    elif isinstance(node, int) and abs(node) > SAFE_INT_MAX:
        _err(errors, path, "unsafe int (exceeds JSON safe-integer range, spec §1.4)")
    elif isinstance(node, dict):
        for k, v in node.items():
            _numeric_walk(v, f"{path}.{k}", errors)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _numeric_walk(v, f"{path}[{i}]", errors)


def _check_bool(v):
    return isinstance(v, bool)


def _enum(*vals):
    return lambda v: isinstance(v, str) and v in vals


def _check_digest(v):
    return isinstance(v, str) and bool(DIGEST_RE.match(v))


# ---------- per-probe detail schemas (spec §14.2 verbatim shapes) ----------

def _check_wake_chain(d, path, errors, ctx):
    _closed(d, path, errors, {"perSourceScenarios", "duplicateSessionStartBehavior",
                              "coalescingObserved", "sleepRecoveryScenarios", "wakeLatencyMs"})
    rows = _req(d, path, errors, "perSourceScenarios", lambda v: isinstance(v, list) and len(v) == 4,
                "list of exactly 4 scenario rows")
    if rows is not None:
        for i, r in enumerate(rows):
            p = f"{path}.perSourceScenarios[{i}]"
            if not isinstance(r, dict):
                _err(errors, p, "not an object")
                continue
            _closed(r, p, errors, {"hostHookEvent", "hostHookSource", "mappedRegistrationSource",
                                   "rsBefore", "generationBefore", "rsAfter", "generationAfter",
                                   "registrationEventId", "credentialRolled", "wakeDelivered"})
            _req(r, p, errors, "hostHookEvent", _check_str, "string")
            _req(r, p, errors, "hostHookSource", _check_str, "string")
            _req(r, p, errors, "mappedRegistrationSource",
                 _enum("session_start", "resume", "clear", "compact", "manual", "reconnect"),
                 "registrationSource enum (spec §4.2)")
            _req(r, p, errors, "rsBefore", _check_str, "string ('' when none)")
            _req(r, p, errors, "generationBefore", lambda v: is_int(v) and v >= 0, "int>=0")
            _req(r, p, errors, "rsAfter", _check_str, "string")
            _req(r, p, errors, "generationAfter", lambda v: is_int(v) and v >= 1, "int>=1")
            _req(r, p, errors, "registrationEventId", _check_str, "string")
            _req(r, p, errors, "credentialRolled", _check_bool, "bool")
            _req(r, p, errors, "wakeDelivered", _check_bool, "bool")
    _req(d, path, errors, "duplicateSessionStartBehavior",
         _enum("new_generation", "idempotent_replay", "observed_double_roll"), "behavior enum")
    co = _req(d, path, errors, "coalescingObserved", lambda v: isinstance(v, dict), "object")
    if co is not None:
        _closed(co, f"{path}.coalescingObserved", errors, {"emittedSignals", "observedRewakes"})
        _req(co, f"{path}.coalescingObserved", errors, "emittedSignals",
             lambda v: is_int(v) and v >= 2, "int>=2 (零样本不 PASS)")
        _req(co, f"{path}.coalescingObserved", errors, "observedRewakes",
             lambda v: is_int(v) and v >= 0, "int>=0")
    sc = _req(d, path, errors, "sleepRecoveryScenarios",
              lambda v: isinstance(v, list) and len(v) == 2, "list of exactly 2")
    if sc is not None:
        kinds = []
        for i, r in enumerate(sc):
            p = f"{path}.sleepRecoveryScenarios[{i}]"
            if not isinstance(r, dict):
                _err(errors, p, "not an object")
                continue
            _closed(r, p, errors, {"kind", "recovered", "recoveryWindowMs"})
            k = _req(r, p, errors, "kind", _enum("sleep_wake", "force_quit_relaunch"), "kind enum")
            kinds.append(k)
            _req(r, p, errors, "recovered", _check_bool, "bool")
            _req(r, p, errors, "recoveryWindowMs", lambda v: is_int(v) and v >= 0, "int>=0")
        if len(set(kinds)) != 2:
            _err(errors, f"{path}.sleepRecoveryScenarios", "kind must be UNIQUE across the 2 rows")
    wl = _req(d, path, errors, "wakeLatencyMs", lambda v: isinstance(v, dict), "object")
    if wl is not None:
        _closed(wl, f"{path}.wakeLatencyMs", errors, {"p50", "p95"})
        p50 = _req(wl, f"{path}.wakeLatencyMs", errors, "p50", lambda v: is_int(v) and v >= 0, "int>=0")
        p95 = _req(wl, f"{path}.wakeLatencyMs", errors, "p95", lambda v: is_int(v) and v >= 0, "int>=0")
        if p50 is not None and p95 is not None and not p50 <= p95:
            _err(errors, f"{path}.wakeLatencyMs", "requires p50 <= p95 (spec §14.2)")


def _check_plugin_lifecycle(d, path, errors, ctx):
    _closed(d, path, errors, {"installEnableNewTaskVisible", "hookTrustAccepted",
                              "upgradeHashChangeReTrust", "marketplaceCacheBehavior"})
    _req(d, path, errors, "installEnableNewTaskVisible", _check_bool, "bool")
    _req(d, path, errors, "hookTrustAccepted", _check_bool, "bool")
    _req(d, path, errors, "upgradeHashChangeReTrust", _check_bool, "bool")
    _req(d, path, errors, "marketplaceCacheBehavior", _check_str, "string")


def _check_thread_identity(d, path, errors, ctx):
    _closed(d, path, errors, {"topologyReachable", "threadIdObtainable", "identityStability"})
    _req(d, path, errors, "topologyReachable", _check_bool, "bool")
    _req(d, path, errors, "threadIdObtainable", _check_bool, "bool")
    _req(d, path, errors, "identityStability",
         _enum("stable", "changes_on_resume", "unavailable"), "stability enum")


def _check_mcp_server(d, path, errors, ctx):
    _closed(d, path, errors, {"elicitationShape", "cancelObserved",
                              "sessionNotFoundAfterCrash", "authSource"})
    _req(d, path, errors, "elicitationShape",
         lambda v: v is None or isinstance(v, dict), "object|null")
    _req(d, path, errors, "cancelObserved", _check_bool, "bool")
    _req(d, path, errors, "sessionNotFoundAfterCrash", _check_bool, "bool")
    _req(d, path, errors, "authSource", _enum("subscription", "api_key", "unknown"), "authSource enum")


def _check_worker_visibility(d, path, errors, ctx):
    _closed(d, path, errors, {"desktopThreadVisible", "threadNavigationWorks",
                              "resumeAfterDrain", "concurrentDualClient"})
    _req(d, path, errors, "desktopThreadVisible", _check_bool, "bool")
    _req(d, path, errors, "threadNavigationWorks", _check_bool, "bool")
    _req(d, path, errors, "resumeAfterDrain",
         _enum("resumes", "new_thread", "unavailable"), "resumeAfterDrain enum")
    _req(d, path, errors, "concurrentDualClient", _check_str, "string")


def _check_system_message(d, path, errors, ctx):
    _closed(d, path, errors, {"desktopVisualPosition", "persistence", "followUpQueueMode",
                              "scenarios", "entersModelContext"})
    _req(d, path, errors, "desktopVisualPosition",
         _enum("visible_banner", "visible_inline", "not_visible"), "position enum")
    _req(d, path, errors, "persistence", _enum("persistent", "not_persistent"), "persistence enum")
    _req(d, path, errors, "followUpQueueMode", _enum("queue", "other"), "queue-mode enum")
    sc = _req(d, path, errors, "scenarios", lambda v: isinstance(v, list) and len(v) == 2,
              "list of exactly 2")
    if sc is not None:
        starts = []
        for i, r in enumerate(sc):
            p = f"{path}.scenarios[{i}]"
            if not isinstance(r, dict):
                _err(errors, p, "not an object")
                continue
            _closed(r, p, errors, {"startEvent", "hookFired", "timingMs", "relativePhase"})
            s = _req(r, p, errors, "startEvent", _enum("stop", "user_prompt_submit"), "startEvent enum")
            starts.append(s)
            _req(r, p, errors, "hookFired", _check_bool, "bool")
            _req(r, p, errors, "timingMs", is_int, "int")
            _req(r, p, errors, "relativePhase", _enum("before_next_turn", "after"), "phase enum")
        if len(set(starts)) != 2:
            _err(errors, f"{path}.scenarios", "startEvent must be UNIQUE across the 2 rows")
    _req(d, path, errors, "entersModelContext", _check_bool, "bool")


def _check_resume_isolation(d, path, errors, ctx):
    _closed(d, path, errors, {"claudePResumeRejected"})
    _req(d, path, errors, "claudePResumeRejected", _check_bool, "bool")


def _check_uds_proxy(d, path, errors, ctx):
    _closed(d, path, errors, {"handshakeOk", "reconnectOk", "staleSocketHandled", "rollbackOk"})
    for f in ("handshakeOk", "reconnectOk", "staleSocketHandled", "rollbackOk"):
        _req(d, path, errors, f, _check_bool, "bool")


def _check_host_turn_boundary(d, path, errors, ctx):
    frozen = _req(d, path, errors, "producerFrozen",
                  _enum("none", "host_turn_id", "prompt_epoch"), "producerFrozen tag")
    if frozen == "none":
        _closed(d, path, errors, {"producerFrozen"})
        return
    if frozen == "host_turn_id":
        _closed(d, path, errors, {"producerFrozen", "trustedProducerChannel", "sameTurnGroups",
                                  "crossTurnSamples", "turnIdStableWithinTurn", "turnIdUniqueAcrossTurn"})
        _req(d, path, errors, "trustedProducerChannel", _check_bool, "bool")
        groups = _req(d, path, errors, "sameTurnGroups",
                      lambda v: isinstance(v, list) and len(v) >= 1, "list>=1")
        if groups is not None:
            for i, g in enumerate(groups):
                p = f"{path}.sameTurnGroups[{i}]"
                if not isinstance(g, dict):
                    _err(errors, p, "not an object")
                    continue
                _closed(g, p, errors, {"hostTurn", "samples"})
                _req(g, p, errors, "hostTurn", _check_str, "string")
                _req(g, p, errors, "samples",
                     lambda v: isinstance(v, list) and len(v) >= 2 and all(isinstance(x, str) for x in v),
                     "list>=2 of observedTurnId strings")
        cross = _req(d, path, errors, "crossTurnSamples",
                     lambda v: isinstance(v, list) and len(v) >= 2, "list>=2")
        if cross is not None:
            turns = []
            for i, s in enumerate(cross):
                p = f"{path}.crossTurnSamples[{i}]"
                if not isinstance(s, dict):
                    _err(errors, p, "not an object")
                    continue
                _closed(s, p, errors, {"hostTurn", "observedTurnId"})
                t = _req(s, p, errors, "hostTurn", _check_str, "string")
                turns.append(t)
                _req(s, p, errors, "observedTurnId", _check_str, "string")
            if len(set(turns)) != len(turns):
                _err(errors, f"{path}.crossTurnSamples", "hostTurn must be pairwise distinct")
        _req(d, path, errors, "turnIdStableWithinTurn", _check_bool, "bool")
        _req(d, path, errors, "turnIdUniqueAcrossTurn", _check_bool, "bool")
        return
    if frozen == "prompt_epoch":
        _closed(d, path, errors, {"producerFrozen", "trustedProducerChannel", "sameTurnRestartGroups",
                                  "crossTurnSamples", "eventRefStableAcrossRestart",
                                  "eventRefUniquePerTurn", "epochMonotonic"})
        _req(d, path, errors, "trustedProducerChannel", _check_bool, "bool")
        groups = _req(d, path, errors, "sameTurnRestartGroups",
                      lambda v: isinstance(v, list) and len(v) >= 1, "list>=1")
        if groups is not None:
            for i, g in enumerate(groups):
                p = f"{path}.sameTurnRestartGroups[{i}]"
                if not isinstance(g, dict):
                    _err(errors, p, "not an object")
                    continue
                _closed(g, p, errors, {"hostTurn", "samples"})
                _req(g, p, errors, "hostTurn", _check_str, "string")
                samples = _req(g, p, errors, "samples",
                               lambda v: isinstance(v, list) and len(v) >= 2, "list>=2")
                if samples is not None:
                    for j, sm in enumerate(samples):
                        q = f"{p}.samples[{j}]"
                        if not isinstance(sm, dict):
                            _err(errors, q, "not an object")
                            continue
                        _closed(sm, q, errors, {"observedEventRef", "phase", "assignedEpoch"})
                        _req(sm, q, errors, "observedEventRef", _check_str, "string")
                        _req(sm, q, errors, "phase",
                             _enum("pre_restart", "post_restart", "reconnect"), "phase enum")
                        _req(sm, q, errors, "assignedEpoch", lambda v: is_int(v) and v >= 1, "int>=1")
        cross = _req(d, path, errors, "crossTurnSamples",
                     lambda v: isinstance(v, list) and len(v) >= 2, "list>=2")
        if cross is not None:
            turns, ordinals = [], []
            for i, s in enumerate(cross):
                p = f"{path}.crossTurnSamples[{i}]"
                if not isinstance(s, dict):
                    _err(errors, p, "not an object")
                    continue
                _closed(s, p, errors, {"observationOrdinal", "hostTurn", "observedEventRef", "assignedEpoch"})
                o = _req(s, p, errors, "observationOrdinal", lambda v: is_int(v) and v >= 0, "int>=0")
                ordinals.append(o)
                t = _req(s, p, errors, "hostTurn", _check_str, "string")
                turns.append(t)
                _req(s, p, errors, "observedEventRef", _check_str, "string")
                _req(s, p, errors, "assignedEpoch", lambda v: is_int(v) and v >= 1, "int>=1")
            if len(set(turns)) != len(turns):
                _err(errors, f"{path}.crossTurnSamples", "hostTurn must be pairwise distinct")
            if len(set(ordinals)) != len(ordinals):
                _err(errors, f"{path}.crossTurnSamples", "observationOrdinal must be UNIQUE (轮 60 P1-1)")
        for f in ("eventRefStableAcrossRestart", "eventRefUniquePerTurn", "epochMonotonic"):
            _req(d, path, errors, f, _check_bool, "bool")


def _check_context_basis(d, path, errors, ctx):
    _closed(d, path, errors, {"resolution"})
    res = _req(d, path, errors, "resolution", lambda v: isinstance(v, dict), "object (tagged union)")
    if res is None:
        return
    p = f"{path}.resolution"
    kind = _req(res, p, errors, "kind", _enum("unsolved", "solved"), "kind tag")
    if kind == "unsolved":
        _closed(res, p, errors, {"kind"})
        return
    if kind == "solved":
        _closed(res, p, errors, {"kind", "byteSource", "byteEncoding", "canonicalization",
                                 "digestProducer", "producerTransport", "sampleBasisBytesB64",
                                 "sampleDigest", "callerObtainProtocol", "obtainCarrier"})
        bs = _req(res, p, errors, "byteSource", lambda v: isinstance(v, dict), "object")
        if bs is not None:
            _closed(bs, f"{p}.byteSource", errors, {"kind", "locator"})
            _req(bs, f"{p}.byteSource", errors, "kind",
                 _enum("prompt_history", "other_named"),
                 "byteSource kind enum (transcript 源恒 unsolved,不在枚举)")
            _req(bs, f"{p}.byteSource", errors, "locator", _check_nonempty_str,
                 "non-empty string (spec §14.2: solved 分支证明字段全非空)")
        enc = _req(res, p, errors, "byteEncoding", _enum("utf8", "utf16le", "raw"), "encoding enum")
        canon = _req(res, p, errors, "canonicalization", _enum("jcs_v1", "none"), "canonicalization enum")
        if canon == "jcs_v1" and enc == "raw":
            _err(errors, p, "canonicalization=jcs_v1 requires byteEncoding∈{utf8,utf16le} "
                            "(spec §14.2 轮 56: raw 非合法 JSON 不可 JCS)")
        _req(res, p, errors, "digestProducer", _enum("adapter", "host"), "producer enum (禁 broker)")
        _req(res, p, errors, "producerTransport",
             _enum("authenticated_control_channel", "host_hook_v1"), "transport enum")
        _req(res, p, errors, "sampleBasisBytesB64", _check_nonempty_str,
             "non-empty base64url string (solved 分支证明字段全非空)")
        _req(res, p, errors, "sampleDigest", _check_digest, "sha256:<64hex>")
        _req(res, p, errors, "callerObtainProtocol",
             _enum("host_provided_at_prompt_verified", "none"), "protocol enum")
        car = _req(res, p, errors, "obtainCarrier",
                   lambda v: v is None or isinstance(v, dict), "object|null")
        if isinstance(car, dict):
            q = f"{p}.obtainCarrier"
            _closed(car, q, errors, {"carrierEventRef", "authChannel",
                                     "obtainedAtBeforeSubmit", "callerReceivedDigest"})
            _req(car, q, errors, "carrierEventRef", _check_nonempty_str,
                 "non-empty string (solved 分支证明字段全非空)")
            _req(car, q, errors, "authChannel",
                 _enum("host_hook_v1", "authenticated_control_channel"), "channel enum")
            _req(car, q, errors, "obtainedAtBeforeSubmit", _check_bool, "bool")
            _req(car, q, errors, "callerReceivedDigest", _check_digest, "sha256:<64hex>")


DETAIL_CHECKERS = {
    "P0A-1": _check_wake_chain,
    "P0A-2": _check_plugin_lifecycle,
    "P0A-3": _check_thread_identity,
    "P0A-4": _check_mcp_server,
    "P0A-5": _check_worker_visibility,
    "P0A-6": _check_system_message,
    "P0A-7": _check_resume_isolation,
    "P0A-8": _check_uds_proxy,
    "P0A-9": _check_host_turn_boundary,
    "P0A-CB": _check_context_basis,
}


def _check_state_sequence(v, path, errors):
    if not isinstance(v, dict):
        _err(errors, path, "not an object")
        return
    _closed(v, path, errors, {"events"})
    ev = _req(v, path, errors, "events", lambda x: isinstance(x, list), "list")
    if ev is None:
        return
    for i, row in enumerate(ev):
        p = f"{path}.events[{i}]"
        if not isinstance(row, dict):
            _err(errors, p, "not an object")
            continue
        if "kind" not in row or not isinstance(row["kind"], str):
            _err(errors, p, "missing/invalid 'kind'")
        for k, val in row.items():
            if not (isinstance(val, (str, bool)) or is_int(val)):
                _err(errors, f"{p}.{k}", "state-sequence values must be scalar str/bool/int")


def check_shape(ev) -> list:
    """Full closed-shape check. Returns list of errors (empty = shape OK)."""
    errors = []
    if not isinstance(ev, dict):
        return ["evidence: not a JSON object"]
    _numeric_walk(ev, "evidence", errors)
    if errors:
        return errors  # numeric discipline broken; reject before anything else
    _closed(ev, "evidence", errors, TOP_FIELDS)
    probe = _req(ev, "evidence", errors, "probeId",
                 lambda v: isinstance(v, str) and v in PROBE_IDS, "registered probeId (§14.1)")
    _req(ev, "evidence", errors, "probeSchemaVersion", lambda v: v == 1 and is_int(v), "literal 1")
    status = _req(ev, "evidence", errors, "status",
                  lambda v: isinstance(v, str) and v in ALL_STATES, "status enum")
    hm = _req(ev, "evidence", errors, "hostMatrix", lambda v: isinstance(v, dict), "object")
    if hm is not None:
        _closed(hm, "evidence.hostMatrix", errors, set(HOST_MATRIX_FIELDS))
        for f in HOST_MATRIX_FIELDS:
            _req(hm, "evidence.hostMatrix", errors, f, _check_str, "string")
    _req(ev, "evidence", errors, "runbookVersion", _check_str, "string")
    _req(ev, "evidence", errors, "profileVersion", _check_str, "string")
    # nullable typed fields
    _req(ev, "evidence", errors, "executedAt", lambda v: v is None or (is_int(v) and v >= 0), "int|null")
    _req(ev, "evidence", errors, "evidenceDigest",
         lambda v: v is None or _check_digest(v), "sha256:<64hex>|null")
    _req(ev, "evidence", errors, "detail", lambda v: v is None or isinstance(v, dict), "object|null")
    _req(ev, "evidence", errors, "artifactRef",
         lambda v: v is None or _check_digest(v), "sha256:<64hex>|null")
    _req(ev, "evidence", errors, "observedStateSequence",
         lambda v: v is None or isinstance(v, dict), "object|null")
    _req(ev, "evidence", errors, "expectedStateSequence",
         lambda v: v is None or isinstance(v, dict), "object|null")
    _req(ev, "evidence", errors, "timeoutMs", lambda v: v is None or is_int(v), "int|null")
    _req(ev, "evidence", errors, "fallbackOnFail", lambda v: v is None or isinstance(v, str), "string|null")
    if errors:
        return errors  # base types broken; biconditionals below would cascade noise

    # exact-shape CHECK 1+2 (biconditional, verbatim)
    null_fields = [f for f in EIGHT_FIELDS if ev[f] is None]
    if status in RUN_STATES and null_fields:
        _err(errors, "evidence",
             f"exact-shape violated: status={status} requires ALL EIGHT run-state fields NOT NULL; "
             f"null: {null_fields}")
    if status == "NOT_RUN" and len(null_fields) != len(EIGHT_FIELDS):
        set_fields = [f for f in EIGHT_FIELDS if ev[f] is not None]
        _err(errors, "evidence",
             f"exact-shape violated: status=NOT_RUN requires ALL EIGHT run-state fields NULL; "
             f"non-null: {set_fields}")
    if errors:
        return errors

    if status in RUN_STATES:
        DETAIL_CHECKERS[probe](ev["detail"], "evidence.detail", errors, ev)
        _check_state_sequence(ev["observedStateSequence"], "evidence.observedStateSequence", errors)
        _check_state_sequence(ev["expectedStateSequence"], "evidence.expectedStateSequence", errors)
        if is_int(ev["timeoutMs"]) and ev["timeoutMs"] <= 0:
            _err(errors, "evidence.timeoutMs", "must be > 0 in run states (公共强制项)")
    return errors


def hash_input(ev) -> dict:
    """13-field closed hash-input for evidenceDigest (spec §14.2 / §1.4:
    all fields present, absent = null)."""
    return {f: ev.get(f) for f in HASH_INPUT_FIELDS}
