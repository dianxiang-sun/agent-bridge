#!/usr/bin/env python3
"""passPredicate per probe (v3-protocol-spec.md §14.3 — 封闭布尔函数, 义务⑤).

evaluate(evidence) -> (bool, [reasons]). Callers must treat any exception as
predicate-not-true (fail-closed); validate.py wraps accordingly.

公共强制项 (spec §14.2): observed==expected ∧ artifactRef≠null ∧ timeoutMs>0 ∧
detail 内一切 *Ms/*WindowMs ∈ [0, timeoutMs]. The artifact re-extraction MUST
(消费方重抽比对) is an I/O obligation performed by validate.py, not here.

Derived booleans (P0A-9 branches, P0A-CB threeQuestionsAllAnswerable) are
RE-DERIVED from samples here and compared against self-reported fields —
self-report never wins (spec §14.2 轮 54/59/60: 派生非自报).
"""
import json
import re

from ab_canon import (ab_canon_text, b64url_decode, b64url_encode, jcs,
                      strict_deep_equal, strict_pairs)

_REGEV_RE = re.compile(r"^regev_[0-9A-HJKMNP-TV-Z]{26}$")  # spec §1.3 regev_ + ULID(Crockford)


def _obs_of_kind(ev, kind):
    obs = ev.get("observedStateSequence") or {}
    return [e for e in (obs.get("events") or []) if isinstance(e, dict) and e.get("kind") == kind]


def _obs_one(ev, kind, reasons):
    """Exactly-one observed event of `kind`, else predicate-false reason.
    Bindings below compare detail self-reports against these artifact-anchored
    rows (observed == deterministic re-extraction is enforced by validate.py),
    so detail can never assert what the artifact does not show (r82b P0-6)."""
    rows = _obs_of_kind(ev, kind)
    if len(rows) != 1:
        reasons.append(f"observed must contain exactly 1 {kind} event, got {len(rows)}")
        return None
    return rows[0]


def _ms_bounds(node, timeout, reasons, path="detail"):
    """Recursively enforce: every *Ms/*WindowMs-named int in detail ∈ [0, timeout];
    for dict/list values under an *Ms key, all nested ints are bounded (e.g. wakeLatencyMs.p50)."""
    if isinstance(node, dict):
        for k, v in node.items():
            p = f"{path}.{k}"
            if isinstance(k, str) and k.endswith("Ms"):
                _ms_check_value(v, timeout, reasons, p)
            else:
                _ms_bounds(v, timeout, reasons, p)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _ms_bounds(v, timeout, reasons, f"{path}[{i}]")


def _ms_check_value(v, timeout, reasons, path):
    if isinstance(v, bool):
        reasons.append(f"{path}: *Ms field is bool")
    elif isinstance(v, int):
        if not 0 <= v <= timeout:
            reasons.append(f"{path}: {v} outside [0, timeoutMs={timeout}]")
    elif isinstance(v, dict):
        for k, x in v.items():
            _ms_check_value(x, timeout, reasons, f"{path}.{k}")
    elif isinstance(v, list):
        for i, x in enumerate(v):
            _ms_check_value(x, timeout, reasons, f"{path}[{i}]")
    else:
        reasons.append(f"{path}: *Ms field is non-numeric {type(v).__name__}")


def _common(ev, reasons):
    if ev["artifactRef"] is None:
        reasons.append("artifactRef is null")
    if not (isinstance(ev["timeoutMs"], int) and ev["timeoutMs"] > 0):
        reasons.append("timeoutMs must be > 0")
        return
    if not strict_deep_equal(ev["observedStateSequence"], ev["expectedStateSequence"]):
        reasons.append("observedStateSequence != expectedStateSequence (类型级深等, bool≠int)")
    _ms_bounds(ev["detail"], ev["timeoutMs"], reasons)


# ---------- per-probe specific conjuncts (spec §14.3 verbatim) ----------

_ROLLING = {"resume", "clear", "compact"}


def _p0a1(d, ev, reasons):
    rows = d["perSourceScenarios"]
    mapped = [r["mappedRegistrationSource"] for r in rows]
    if set(mapped) != {"session_start", "resume", "clear", "compact"}:
        reasons.append(f"perSourceScenarios must cover the 4 sources exactly once, got {mapped}")
    event_ids = [r["registrationEventId"] for r in rows]
    if len(set(event_ids)) != len(event_ids):
        reasons.append("registrationEventId must be pairwise distinct across the 4 scenarios")
    # r83: raw-source 关系约束(值本身 E2E-未知,关系可判)——四场景 raw source 两两异
    # (同 raw 值无法承载四个不同 mapping),hook 事件名四行同一(§1.1: 四场景均为
    # SessionStart 观测;detail↔artifact 的 raw source 逐行绑定由 validate.py RAWSOURCE 门做)
    raw_sources = [r["hostHookSource"] for r in rows]
    if len(set(raw_sources)) != len(raw_sources):
        reasons.append("hostHookSource must be pairwise distinct across the 4 scenarios "
                       "(a single raw value cannot carry two mappings)")
    if len({r["hostHookEvent"] for r in rows}) != 1:
        reasons.append("hostHookEvent must be identical across the 4 scenarios "
                       "(all four are observations of the same hook event, runbook §1.1)")
    for i, r in enumerate(rows):
        m = r["mappedRegistrationSource"]
        if not _REGEV_RE.match(r["registrationEventId"]):
            reasons.append(f"scenario[{i}]: registrationEventId not regev_<ULID> (runbook §1.5 / spec §1.3)")
        if r["hostHookEvent"] == "" or r["hostHookSource"] == "":
            reasons.append(f"scenario[{i}]: hostHookEvent/hostHookSource must be non-empty raw values")
        if m in _ROLLING:
            # spec §4.4: rolling re-registration keeps the SAME rs_ and rolls generation +1
            if r["generationAfter"] != r["generationBefore"] + 1:
                reasons.append(f"scenario[{i}] {m}: generation must +1 (spec §4.4)")
            if r["generationBefore"] < 1:
                reasons.append(f"scenario[{i}] {m}: rolling requires generationBefore >= 1")
            if r["rsBefore"] == "" or r["rsAfter"] != r["rsBefore"]:
                reasons.append(f"scenario[{i}] {m}: rolling keeps the SAME rs_ "
                               "(rsAfter must == rsBefore != '', spec §4.4/§4.10)")
            if not r["credentialRolled"]:
                reasons.append(f"scenario[{i}] {m}: credentialRolled must be true (滚代一致)")
        elif m == "session_start":
            if r["generationBefore"] != 0 or r["rsBefore"] != "":
                reasons.append(f"scenario[{i}] session_start (fresh): requires generationBefore=0 "
                               "and rsBefore='' (no prior rs_)")
            if r["generationAfter"] != 1:
                reasons.append(f"scenario[{i}] session_start (fresh): generationAfter must be 1")
            if r["rsAfter"] == "":
                reasons.append(f"scenario[{i}] session_start: rsAfter must be non-empty")
            if r["credentialRolled"]:
                reasons.append(f"scenario[{i}] session_start (fresh): credentialRolled must be false")
        else:
            reasons.append(f"scenario[{i}]: mapped source {m} not a valid 4-scenario mapping")
        if not r["wakeDelivered"]:
            reasons.append(f"scenario[{i}] {m}: wakeDelivered must be true")
    if d["duplicateSessionStartBehavior"] == "observed_double_roll":
        reasons.append("observed_double_roll is a FAIL condition (spec §14.3)")
    co = d["coalescingObserved"]
    if not co["observedRewakes"] <= co["emittedSignals"]:
        reasons.append("coalescing: observedRewakes must be <= emittedSignals")
    for r in d["sleepRecoveryScenarios"]:
        if not r["recovered"]:
            reasons.append(f"sleepRecovery {r['kind']}: recovered must be true (轮 56: 两场景分别证)")
    # p50<=p95 shape-checked; p95<=timeoutMs via _ms_bounds
    # detail ↔ observed cross-binding (artifact-anchored; r82b P0-6)
    regs = _obs_of_kind(ev, "registration_decision")
    if len(regs) != 4:
        reasons.append(f"observed must contain exactly 4 registration_decision events, got {len(regs)}")
    else:
        for i, (r, o) in enumerate(zip(rows, regs)):
            if (o.get("mappedRegistrationSource") != r["mappedRegistrationSource"]
                    or o.get("generationDelta") != r["generationAfter"] - r["generationBefore"]
                    or o.get("credentialRolled") != r["credentialRolled"]):
                reasons.append(f"scenario[{i}]: detail row does not match observed "
                               f"registration_decision[{i}] (detail 与 artifact 重抽绑定)")
    dup = _obs_one(ev, "duplicate_session_start", reasons)
    if dup is not None and dup.get("behavior") != d["duplicateSessionStartBehavior"]:
        reasons.append("duplicateSessionStartBehavior != observed duplicate_session_start.behavior")
    recs = _obs_of_kind(ev, "recovery_scenario")
    sr = d["sleepRecoveryScenarios"]
    if len(recs) != len(sr) or any(
            o.get("scenarioKind") != r["kind"] or o.get("recovered") != r["recovered"]
            for o, r in zip(recs, sr)):
        reasons.append("sleepRecoveryScenarios must match observed recovery_scenario rows in order")


def _p0a2(d, ev, reasons):
    for f in ("installEnableNewTaskVisible", "hookTrustAccepted", "upgradeHashChangeReTrust"):
        if not d[f]:
            reasons.append(f"{f} must be true")
    if d["marketplaceCacheBehavior"] not in ("refresh_ok", "cache_invalidated_ok"):
        reasons.append("marketplaceCacheBehavior not in closed allow-set "
                       "{refresh_ok, cache_invalidated_ok} (轮 54: 非 presence check)")
    # detail ↔ observed cross-binding (派生非自报)
    inst = _obs_one(ev, "plugin_install", reasons)
    en = _obs_one(ev, "plugin_enable", reasons)
    newp = _obs_one(ev, "new_task_tool_probe", reasons)
    if None not in (inst, en, newp):
        derived = (inst.get("ok") is True and en.get("ok") is True
                   and newp.get("toolVisible") is True)
        if d["installEnableNewTaskVisible"] != derived:
            reasons.append(f"installEnableNewTaskVisible self-report != derived {derived} from observed rows")
    ht = _obs_one(ev, "hook_trust_prompt", reasons)
    if ht is not None and d["hookTrustAccepted"] != (ht.get("accepted") is True):
        reasons.append("hookTrustAccepted self-report != observed hook_trust_prompt.accepted")
    up = _obs_one(ev, "plugin_upgrade", reasons)
    rt = _obs_one(ev, "retrust_prompt", reasons)
    if None not in (up, rt):
        derived = (up.get("hashChanged") is True and rt.get("required") is True
                   and rt.get("accepted") is True)
        if d["upgradeHashChangeReTrust"] != derived:
            reasons.append(f"upgradeHashChangeReTrust self-report != derived {derived} from observed rows")
    mr = _obs_one(ev, "marketplace_refresh", reasons)
    if mr is not None and d["marketplaceCacheBehavior"] != mr.get("behavior"):
        reasons.append("marketplaceCacheBehavior != observed marketplace_refresh.behavior")


def _p0a3(d, ev, reasons):
    if not d["topologyReachable"]:
        reasons.append("topologyReachable must be true")
    if not d["threadIdObtainable"]:
        reasons.append("threadIdObtainable must be true")
    if d["identityStability"] != "stable":
        reasons.append("identityStability must be 'stable'")
    sp = _obs_one(ev, "shim_spawn", reasons)
    if sp is not None and d["topologyReachable"] != (sp.get("reachable") is True):
        reasons.append("topologyReachable self-report != observed shim_spawn.reachable")
    ip = _obs_one(ev, "identity_probe", reasons)
    if ip is not None and d["threadIdObtainable"] != (ip.get("obtained") is True):
        reasons.append("threadIdObtainable self-report != observed identity_probe.obtained")
    stab = _obs_of_kind(ev, "stability_check")
    if not stab:
        reasons.append("observed must contain stability_check events")
    elif d["identityStability"] == "stable" and not all(r.get("stable") is True for r in stab):
        reasons.append("identityStability='stable' contradicted by observed stability_check rows")


def _p0a4(d, ev, reasons):
    if d["authSource"] != "subscription":
        reasons.append("authSource must be 'subscription' (禁静默 API-key)")
    if d["elicitationShape"] is None:
        reasons.append("elicitationShape must be non-null")
    if not d["cancelObserved"]:
        reasons.append("cancelObserved must be true")
    if not d["sessionNotFoundAfterCrash"]:
        reasons.append("sessionNotFoundAfterCrash must be true (轮 54: crash 后确证)")
    au = _obs_one(ev, "auth_check", reasons)
    if au is not None and d["authSource"] != au.get("authSource"):
        reasons.append("authSource self-report != observed auth_check.authSource")
    cp = _obs_one(ev, "cancel_probe", reasons)
    if cp is not None and d["cancelObserved"] != (cp.get("cancelObserved") is True):
        reasons.append("cancelObserved self-report != observed cancel_probe.cancelObserved")
    cr = _obs_one(ev, "crash_restart_probe", reasons)
    if cr is not None and d["sessionNotFoundAfterCrash"] != (cr.get("sessionNotFound") is True):
        reasons.append("sessionNotFoundAfterCrash self-report != observed crash_restart_probe.sessionNotFound")
    ec = _obs_one(ev, "elicitation_captured", reasons)
    if ec is not None and (d["elicitationShape"] is not None) != (ec.get("shapeCaptured") is True):
        reasons.append("elicitationShape presence != observed elicitation_captured.shapeCaptured")


def _p0a5(d, ev, reasons):
    if not d["desktopThreadVisible"]:
        reasons.append("desktopThreadVisible must be true")
    if not d["threadNavigationWorks"]:
        reasons.append("threadNavigationWorks must be true")
    if d["resumeAfterDrain"] not in ("resumes", "new_thread"):
        reasons.append("resumeAfterDrain must be in {resumes, new_thread}")
    if d["concurrentDualClient"] not in ("isolated_ok", "serialized_ok"):
        reasons.append("concurrentDualClient not in closed allow-set "
                       "{isolated_ok, serialized_ok} (轮 54: unsafe race 不 PASS)")
    vc = _obs_one(ev, "visibility_check", reasons)
    if vc is not None and d["desktopThreadVisible"] != (vc.get("visible") is True):
        reasons.append("desktopThreadVisible self-report != observed visibility_check.visible")
    nc = _obs_one(ev, "navigation_check", reasons)
    if nc is not None and d["threadNavigationWorks"] != (nc.get("works") is True):
        reasons.append("threadNavigationWorks self-report != observed navigation_check.works")
    dr = _obs_one(ev, "drain_resume_check", reasons)
    if dr is not None and d["resumeAfterDrain"] != dr.get("behavior"):
        reasons.append("resumeAfterDrain != observed drain_resume_check.behavior")
    dc = _obs_one(ev, "dual_client_check", reasons)
    if dc is not None and d["concurrentDualClient"] != dc.get("behavior"):
        reasons.append("concurrentDualClient != observed dual_client_check.behavior")


def _p0a6(d, ev, reasons):
    if d["entersModelContext"]:
        reasons.append("entersModelContext must be false (architecture F5: 仅 nudge)")
    if d["desktopVisualPosition"] not in ("visible_banner", "visible_inline"):
        reasons.append("desktopVisualPosition must be visible_banner|visible_inline")
    if d["persistence"] != "persistent":
        reasons.append("persistence must be 'persistent'")
    if d["followUpQueueMode"] != "queue":
        reasons.append("followUpQueueMode must be 'queue'")
    for r in d["scenarios"]:
        if not r["hookFired"]:
            reasons.append(f"scenario {r['startEvent']}: hookFired must be true")
        if r["relativePhase"] != "before_next_turn":
            reasons.append(f"scenario {r['startEvent']}: relativePhase must be before_next_turn")
        # 0<=timingMs<=timeoutMs via _ms_bounds
    nudges = _obs_of_kind(ev, "nudge_scenario")
    if len(nudges) != len(d["scenarios"]) or any(
            o.get("startEvent") != r["startEvent"] or o.get("hookFired") != r["hookFired"]
            or o.get("relativePhase") != r["relativePhase"]
            for o, r in zip(nudges, d["scenarios"])):
        reasons.append("scenarios must match observed nudge_scenario rows in order (detail 与 artifact 绑定)")
    vis = _obs_one(ev, "visual_check", reasons)
    if vis is not None and (vis.get("position") != d["desktopVisualPosition"]
                            or vis.get("persistence") != d["persistence"]):
        reasons.append("desktopVisualPosition/persistence != observed visual_check row")
    qm = _obs_one(ev, "queue_mode_check", reasons)
    if qm is not None and d["followUpQueueMode"] != qm.get("mode"):
        reasons.append("followUpQueueMode != observed queue_mode_check.mode")
    mc = _obs_one(ev, "model_context_check", reasons)
    if mc is not None and d["entersModelContext"] != mc.get("entersModelContext"):
        reasons.append("entersModelContext self-report != observed model_context_check.entersModelContext")


def _p0a7(d, ev, reasons):
    if not d["claudePResumeRejected"]:
        reasons.append("claudePResumeRejected must be true")
    ra = _obs_one(ev, "resume_attempt", reasons)
    if ra is not None and d["claudePResumeRejected"] != (ra.get("rejected") is True):
        reasons.append("claudePResumeRejected self-report != observed resume_attempt.rejected")


def _p0a8(d, ev, reasons):
    for f in ("handshakeOk", "reconnectOk", "staleSocketHandled", "rollbackOk"):
        if not d[f]:
            reasons.append(f"{f} must be true")
    for kind, field, dkey in (("uds_handshake", "ok", "handshakeOk"),
                              ("uds_reconnect", "ok", "reconnectOk"),
                              ("stale_socket_probe", "handled", "staleSocketHandled"),
                              ("rollback_probe", "ok", "rollbackOk")):
        row = _obs_one(ev, kind, reasons)
        if row is not None and d[dkey] != (row.get(field) is True):
            reasons.append(f"{dkey} self-report != observed {kind}.{field}")


_PHASE_ORDER = ("pre_restart", "post_restart", "reconnect")  # runbook §9.6 canonical 枚举序


def _p0a9_bindings(d, ev, frozen, groups, reasons):
    """detail ↔ observed cross-binding for P0A-9 (artifact-anchored)."""
    pf = _obs_one(ev, "producer_frozen", reasons)
    if pf is not None and pf.get("producer") != frozen:
        reasons.append("producerFrozen self-report != observed producer_frozen.producer")
    gdone = _obs_of_kind(ev, "same_turn_group_done")
    if len(gdone) != len(groups):
        reasons.append(f"observed same_turn_group_done count {len(gdone)} != group count {len(groups)}")
    else:
        for i, (g, o) in enumerate(zip(groups, gdone)):
            if frozen == "prompt_epoch":
                phases = {s["phase"] for s in g["samples"]}
                joined = "+".join(p for p in _PHASE_ORDER if p in phases)
                if o.get("phasesCovered") != joined:
                    reasons.append(f"group[{i}] phasesCovered != canonical derivation "
                                   f"{joined!r} (runbook §9.6 枚举序去重)")
            elif o.get("phasesCovered") != "n/a":
                reasons.append(f"group[{i}] phasesCovered must be 'n/a' on host_turn_id branch")
    cross_rows = _obs_of_kind(ev, "cross_turn_sample")
    if len(cross_rows) != len(d["crossTurnSamples"]):
        reasons.append(f"observed cross_turn_sample count {len(cross_rows)} != "
                       f"crossTurnSamples count {len(d['crossTurnSamples'])}")
    _obs_one(ev, "derivation_done", reasons)


def _p0a9(d, ev, reasons):
    frozen = d["producerFrozen"]
    if frozen == "none":
        reasons.append("producerFrozen=none: PASS predicate is constantly FAIL "
                       "(未冻结 producer 不可开放 per-turn root)")
        return
    if not d["trustedProducerChannel"]:
        reasons.append("trustedProducerChannel must be true")
    _p0a9_bindings(d, ev, frozen,
                   (d.get("sameTurnGroups") or []) if frozen == "host_turn_id"
                   else (d.get("sameTurnRestartGroups") or []),
                   reasons)
    if frozen == "host_turn_id":
        groups = d["sameTurnGroups"]
        derived_stable = (len(groups) > 0
                          and all(len(set(g["samples"])) == 1 for g in groups)
                          and any(len(g["samples"]) >= 2 for g in groups))
        cross = d["crossTurnSamples"]
        ids = [s["observedTurnId"] for s in cross]
        derived_unique = len(set(ids)) == len(ids) and len(cross) >= 2
        if d["turnIdStableWithinTurn"] != derived_stable:
            reasons.append(f"turnIdStableWithinTurn self-report {d['turnIdStableWithinTurn']} "
                           f"!= derived {derived_stable} (派生非自报)")
        if d["turnIdUniqueAcrossTurn"] != derived_unique:
            reasons.append(f"turnIdUniqueAcrossTurn self-report != derived {derived_unique}")
        if not (derived_stable and derived_unique):
            reasons.append("derived turn-id stability/uniqueness not established")
        return
    # prompt_epoch branch
    groups = d["sameTurnRestartGroups"]

    def group_stable(g):
        epochs = {s["assignedEpoch"] for s in g["samples"]}
        refs = {s["observedEventRef"] for s in g["samples"]}
        return len(epochs) == 1 and len(refs) == 1

    def group_phases_ok(g):
        phases = {s["phase"] for s in g["samples"]}
        return {"pre_restart", "post_restart", "reconnect"} <= phases

    derived_stable = (len(groups) > 0 and all(group_stable(g) for g in groups)
                      and any(group_phases_ok(g) for g in groups))
    cross = sorted(d["crossTurnSamples"], key=lambda s: s["observationOrdinal"])
    refs = [s["observedEventRef"] for s in cross]
    epochs = [s["assignedEpoch"] for s in cross]
    derived_unique = (len(cross) >= 2 and len(set(refs)) == len(refs)
                      and len(set(epochs)) == len(epochs))
    derived_monotonic = all(a < b for a, b in zip(epochs, epochs[1:]))
    for name, derived in (("eventRefStableAcrossRestart", derived_stable),
                          ("eventRefUniquePerTurn", derived_unique),
                          ("epochMonotonic", derived_monotonic)):
        if d[name] != derived:
            reasons.append(f"{name} self-report {d[name]} != derived {derived} (派生非自报)")
        if not derived:
            reasons.append(f"derived {name} is false")


def normalize_basis(sample_b64: str, encoding: str, canonicalization: str) -> bytes:
    """P0A-CB normalization 封闭规则 (spec §14.2 轮 57 P1-9). Raises on any
    decode/JSON-parse failure — callers treat as unsolved (fail-closed)."""
    raw = b64url_decode(sample_b64)
    if encoding == "raw":
        if canonicalization != "none":
            raise ValueError("raw requires canonicalization=none")
        return raw
    text = raw.decode("utf-8") if encoding == "utf8" else raw.decode("utf-16-le")
    if canonicalization == "jcs_v1":
        return jcs(json.loads(text, parse_float=_reject_float, parse_constant=_reject_const,
                              object_pairs_hook=strict_pairs))
    return text.encode("utf-8")


def _reject_float(s):
    raise ValueError(f"float forbidden in JCS basis: {s}")


def _reject_const(s):
    raise ValueError(f"non-finite forbidden: {s}")


def _p0acb(d, ev, reasons):
    res = d["resolution"]
    if res["kind"] != "solved":
        reasons.append("resolution.kind=unsolved: threeQuestionsAllAnswerable derived false")
        return
    if res["callerObtainProtocol"] != "host_provided_at_prompt_verified":
        reasons.append("callerObtainProtocol='none' ⇒ unsolved (spec §14.2)")
    car = res["obtainCarrier"]
    if car is None:
        reasons.append("obtainCarrier=null ⇒ unsolved (轮 59 P1-D: verified 须带 typed carrier)")
        return
    if not car["obtainedAtBeforeSubmit"]:
        reasons.append("obtainCarrier.obtainedAtBeforeSubmit must be true")
    if car["callerReceivedDigest"] != res["sampleDigest"]:
        reasons.append("callerReceivedDigest != sampleDigest")
    try:
        normalized = normalize_basis(res["sampleBasisBytesB64"],
                                     res["byteEncoding"], res["canonicalization"])
    except Exception as e:  # decode/parse failure ⇒ unsolved (fail-closed)
        reasons.append(f"normalization failed ⇒ unsolved: {e}")
        return
    recomputed = ab_canon_text("AgentBridge/ContextBasis/v1",
                               {"byteEncoding": res["byteEncoding"],
                                "canonicalization": res["canonicalization"],
                                "normalizedBytesB64": b64url_encode(normalized)})
    if recomputed != res["sampleDigest"]:
        reasons.append(f"AB-CANON-1 recomputation {recomputed} != sampleDigest {res['sampleDigest']}")
    # carrier-tuple re-extraction from artifact (轮 60 P1-5) is validate.py's I/O step
    # detail ↔ observed cross-binding (artifact-anchored)
    bsp = _obs_one(ev, "byte_source_probe", reasons)
    if bsp is not None and (bsp.get("found") is not True
                            or bsp.get("sourceKind") != res["byteSource"]["kind"]):
        reasons.append("byteSource != observed byte_source_probe row (found/sourceKind)")
    dpp = _obs_one(ev, "digest_producer_probe", reasons)
    if dpp is not None and (dpp.get("producer") != res["digestProducer"]
                            or dpp.get("transport") != res["producerTransport"]):
        reasons.append("digestProducer/producerTransport != observed digest_producer_probe row")
    cop = _obs_one(ev, "caller_obtain_probe", reasons)
    if cop is not None and (cop.get("protocol") != res["callerObtainProtocol"]
                            or cop.get("beforeSubmit") != car["obtainedAtBeforeSubmit"]):
        reasons.append("callerObtainProtocol/obtainedAtBeforeSubmit != observed caller_obtain_probe row")
    drc = _obs_one(ev, "digest_replay_check", reasons)
    if drc is not None and drc.get("match") != (car["callerReceivedDigest"] == res["sampleDigest"]):
        reasons.append("digest_replay_check.match != derived (callerReceivedDigest == sampleDigest)")
    rd = _obs_one(ev, "resolution_done", reasons)
    if rd is not None and rd.get("resolutionKind") != res["kind"]:
        reasons.append("resolution.kind != observed resolution_done.resolutionKind")


SPECIFIC = {"P0A-1": _p0a1, "P0A-2": _p0a2, "P0A-3": _p0a3, "P0A-4": _p0a4,
            "P0A-5": _p0a5, "P0A-6": _p0a6, "P0A-7": _p0a7, "P0A-8": _p0a8,
            "P0A-9": _p0a9, "P0A-CB": _p0acb}


def evaluate(ev):
    """Closed boolean passPredicate over a shape-valid run-state evidence.
    Returns (predicate_true, reasons_if_false)."""
    reasons = []
    _common(ev, reasons)
    SPECIFIC[ev["probeId"]](ev["detail"], ev, reasons)
    return (len(reasons) == 0, reasons)
