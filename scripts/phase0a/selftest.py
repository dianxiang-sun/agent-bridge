#!/usr/bin/env python3
"""Harness self-test (义务⑥ negative fixtures + full-chain positives).

Run: python3 selftest.py       (exit 0 = all green; any failure = exit 1)

Covers:
  - AB-CANON-1 anchors (GV-1/GV-4 recomputed — proves ab_canon.py ≡ gen_golden_vectors.py logic)
  - NOT_RUN fixtures: shape-accepted, --consume rejected (10/10)
  - synthetic full-chain positives for ALL TEN probes (r82b P1: 十项各一;
    incl. P0A-CB carrier tuple + normalization digest)
  - CLI subprocess integration (r82b P0: strict args — unknown/duplicate/missing-value
    options exit 2; documented invocations work; duplicate JSON keys rejected)
  - negative mutations: each must be REJECTED for the stated reason, incl. the
    r82b attack vectors (empty-sequence evidence, unbound env_snapshot, isolation
    violation, corrupt allowlist types, lenient base64url, P0A-1 identity forgery,
    detail↔observed divergence, unsafe int, invalid-UTF-8 artifact)
  - consumption gate both ways (delivery allowlist rejects; explicit permissive
    allowlist accepts; NOT_RUN never consumable)

Synthetic evidence uses hostMatrix.product="synthetic-fixture" and fixed
timestamps — it can never clear a real frozen-matrix consumption gate. The
env_snapshot rows declare isolation="isolated_profile" because the fixtures
EMULATE a fully-compliant probe run (runbook §0.3); honesty about their
synthetic nature is carried by the hostMatrix product marker.
"""
import copy
import hashlib
import json
import os
import subprocess
import sys
import tempfile

import ab_canon
import gen_not_run
from ab_canon import ab_canon_text, b64url_encode
from evidence import PROBE_IDS, hash_input
from extract import extract_observed
from validate import load_json, validate

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATES = load_json(os.path.join(HERE, "expected_templates.json"))
FIXED_AT = 1752700000000
SYNTH_MATRIX = {"product": "synthetic-fixture", "hostVersion": "0.0.0",
                "os": "macOS", "osVersion": "0.0.0"}
DELIVERY_ALLOWLIST = load_json(os.path.join(HERE, "allowlist.json"))
PERMISSIVE_ALLOWLIST = {"approvedRunbookVersions": ["phase0a-runbook/v1"],
                        "currentProfileVersion": "adapter-profile/v0-unfrozen",
                        "frozenHostMatrix": SYNTH_MATRIX}

FAILURES = []


def check(name, cond, note=""):
    tag = "ok" if cond else "FAIL"
    print(f"  [{tag}] {name}" + (f" — {note}" if note and not cond else ""))
    if not cond:
        FAILURES.append(name)


def make_artifact(rows, isolation="isolated_profile", env_overrides=None) -> bytes:
    """rows = [(kind, data), ...]; env_snapshot auto-prepended; seq monotonic from 1."""
    env = {"hostMatrix": SYNTH_MATRIX,
           "runbookVersion": "phase0a-runbook/v1",
           "profileVersion": "adapter-profile/v0-unfrozen",
           "isolation": isolation}
    if env_overrides:
        env.update(env_overrides)
    all_rows = [("env_snapshot", env)] + list(rows)
    lines = []
    for i, (kind, data) in enumerate(all_rows, 1):
        lines.append(json.dumps({"seq": i, "atMs": FIXED_AT + i, "kind": kind, "data": data},
                                sort_keys=True, separators=(",", ":")))
    return ("\n".join(lines) + "\n").encode("utf-8")


def refresh_digest(ev):
    ev["evidenceDigest"] = ab_canon_text("AgentBridge/ProbeEvidence/v1", hash_input(ev))
    return ev


def store_artifact(adir, blob) -> str:
    hexd = hashlib.sha256(blob).hexdigest()
    with open(os.path.join(adir, hexd + ".jsonl"), "wb") as f:
        f.write(blob)
    return "sha256:" + hexd


def build(adir, probe, detail, template_key, rows, timeout=300000, blob=None):
    if blob is None:
        blob = make_artifact(rows)
    ref = store_artifact(adir, blob)
    ev = {"probeId": probe, "probeSchemaVersion": 1, "status": "PASS",
          "hostMatrix": dict(SYNTH_MATRIX),
          "runbookVersion": "phase0a-runbook/v1",
          "profileVersion": "adapter-profile/v0-unfrozen",
          "executedAt": FIXED_AT, "evidenceDigest": None, "detail": detail,
          "artifactRef": ref,
          "observedStateSequence": extract_observed(probe, blob),
          "expectedStateSequence": copy.deepcopy(TEMPLATES[template_key]),
          "timeoutMs": timeout,
          "fallbackOnFail": "synthetic-fixture fallback note"}
    return refresh_digest(ev), blob


def _regev(n: int) -> str:
    return "regev_" + str(n).rjust(26, "0")


def build_p0a1(adir, sources=("startup", "resume", "clear", "compact")):
    scen = [(sources[0], "session_start", "", 0, "rs-fixture-1", 1, False),
            (sources[1], "resume", "rs-fixture-1", 1, "rs-fixture-1", 2, True),
            (sources[2], "clear", "rs-fixture-1", 2, "rs-fixture-1", 3, True),
            (sources[3], "compact", "rs-fixture-1", 3, "rs-fixture-1", 4, True)]
    rows, detail_rows = [], []
    for i, (src, mapped, rsb, gb, rsa, ga, rolled) in enumerate(scen, 1):
        rows += [("session_start_hook", {"source": src}),
                 ("registration_decision", {"mappedRegistrationSource": mapped,
                                            "generationDelta": ga - gb,
                                            "credentialRolled": rolled}),
                 ("signal_write", {}), ("file_changed_hook", {}), ("wake_observed", {})]
        detail_rows.append({"hostHookEvent": "SessionStart", "hostHookSource": src,
                            "mappedRegistrationSource": mapped,
                            "rsBefore": rsb, "generationBefore": gb,
                            "rsAfter": rsa, "generationAfter": ga,
                            "registrationEventId": _regev(i),
                            "credentialRolled": rolled, "wakeDelivered": True})
    rows += [("session_start_hook", {"source": "startup"}),
             ("duplicate_session_start", {"behavior": "idempotent_replay"}),
             ("coalescing_run", {}),
             ("recovery_scenario", {"scenarioKind": "sleep_wake", "recovered": True}),
             ("recovery_scenario", {"scenarioKind": "force_quit_relaunch", "recovered": True})]
    detail = {"perSourceScenarios": detail_rows,
              "duplicateSessionStartBehavior": "idempotent_replay",
              "coalescingObserved": {"emittedSignals": 3, "observedRewakes": 1},
              "sleepRecoveryScenarios": [
                  {"kind": "sleep_wake", "recovered": True, "recoveryWindowMs": 1500},
                  {"kind": "force_quit_relaunch", "recovered": True, "recoveryWindowMs": 2500}],
              "wakeLatencyMs": {"p50": 800, "p95": 2100}}
    return build(adir, "P0A-1", detail, "P0A-1.a", rows)


def build_p0a2(adir):
    rows = [("plugin_install", {"ok": True}), ("plugin_enable", {"ok": True}),
            ("old_task_tool_probe", {"toolVisible": False}),
            ("new_task_tool_probe", {"toolVisible": True}),
            ("hook_trust_prompt", {"accepted": True}),
            ("plugin_upgrade", {"hashChanged": True}),
            ("retrust_prompt", {"required": True, "accepted": True}),
            ("marketplace_refresh", {"behavior": "refresh_ok"})]
    detail = {"installEnableNewTaskVisible": True, "hookTrustAccepted": True,
              "upgradeHashChangeReTrust": True, "marketplaceCacheBehavior": "refresh_ok"}
    return build(adir, "P0A-2", detail, "P0A-2.a", rows)


def build_p0a3(adir):
    rows = [("shim_spawn", {"reachable": True}),
            ("identity_probe", {"obtained": True, "hostInjected": True}),
            ("stability_check", {"phase": "same_thread_recall", "stable": True}),
            ("stability_check", {"phase": "desktop_restart_resume", "stable": True})]
    detail = {"topologyReachable": True, "threadIdObtainable": True,
              "identityStability": "stable"}
    return build(adir, "P0A-3", detail, "P0A-3.a", rows)


def build_p0a4(adir):
    rows = [("mcp_handshake", {"ok": True}), ("thread_started", {}),
            ("elicitation_captured", {"shapeCaptured": True}),
            ("cancel_probe", {"cancelObserved": True}),
            ("crash_restart_probe", {"sessionNotFound": True}),
            ("auth_check", {"authSource": "subscription"})]
    detail = {"elicitationShape": {"capturedKind": "elicitation/create"},
              "cancelObserved": True, "sessionNotFoundAfterCrash": True,
              "authSource": "subscription"}
    return build(adir, "P0A-4", detail, "P0A-4.a", rows)


def build_p0a5(adir):
    rows = [("visibility_check", {"visible": True}), ("navigation_check", {"works": True}),
            ("drain_resume_check", {"behavior": "resumes"}),
            ("dual_client_check", {"behavior": "isolated_ok"})]
    detail = {"desktopThreadVisible": True, "threadNavigationWorks": True,
              "resumeAfterDrain": "resumes", "concurrentDualClient": "isolated_ok"}
    return build(adir, "P0A-5", detail, "P0A-5.a", rows)


def build_p0a6(adir):
    rows = [("nudge_scenario", {"startEvent": "stop", "hookFired": True,
                                "relativePhase": "before_next_turn"}),
            ("visual_check", {"position": "visible_banner", "persistence": "persistent"}),
            ("queue_mode_check", {"mode": "queue"}),
            ("nudge_scenario", {"startEvent": "user_prompt_submit", "hookFired": True,
                                "relativePhase": "before_next_turn"}),
            ("model_context_check", {"entersModelContext": False})]
    detail = {"desktopVisualPosition": "visible_banner", "persistence": "persistent",
              "followUpQueueMode": "queue",
              "scenarios": [
                  {"startEvent": "stop", "hookFired": True, "timingMs": 1200,
                   "relativePhase": "before_next_turn"},
                  {"startEvent": "user_prompt_submit", "hookFired": True, "timingMs": 800,
                   "relativePhase": "before_next_turn"}],
              "entersModelContext": False}
    return build(adir, "P0A-6", detail, "P0A-6.a", rows)


def build_p0a7(adir):
    rows = [("resume_attempt", {"rejected": True}),
            ("desktop_pollution_check", {"polluted": False})]
    detail = {"claudePResumeRejected": True}
    return build(adir, "P0A-7", detail, "P0A-7.a", rows)


def build_p0a8(adir):
    rows = [("uds_handshake", {"ok": True}), ("uds_reconnect", {"ok": True}),
            ("stale_socket_probe", {"handled": True}), ("rollback_probe", {"ok": True})]
    detail = {"handshakeOk": True, "reconnectOk": True,
              "staleSocketHandled": True, "rollbackOk": True}
    return build(adir, "P0A-8", detail, "P0A-8.a", rows)


def build_p0a9(adir, host_instances=("host-inst-1", "host-inst-2", "host-inst-2")):
    rows = [("producer_frozen", {"producer": "prompt_epoch"}),
            ("host_instance", {"instanceId": host_instances[0]}),
            ("host_instance", {"instanceId": host_instances[1]}),
            ("host_instance", {"instanceId": host_instances[2]}),
            ("same_turn_group_done", {"phasesCovered": "pre_restart+post_restart+reconnect"}),
            ("cross_turn_sample", {}), ("cross_turn_sample", {}),
            ("derivation_done", {})]
    detail = {"producerFrozen": "prompt_epoch", "trustedProducerChannel": True,
              "sameTurnRestartGroups": [{
                  "hostTurn": "turn-A",
                  "samples": [
                      {"observedEventRef": "ev-A", "phase": "pre_restart", "assignedEpoch": 1},
                      {"observedEventRef": "ev-A", "phase": "post_restart", "assignedEpoch": 1},
                      {"observedEventRef": "ev-A", "phase": "reconnect", "assignedEpoch": 1}]}],
              "crossTurnSamples": [
                  {"observationOrdinal": 0, "hostTurn": "turn-A",
                   "observedEventRef": "ev-A", "assignedEpoch": 1},
                  {"observationOrdinal": 1, "hostTurn": "turn-B",
                   "observedEventRef": "ev-B", "assignedEpoch": 2}],
              "eventRefStableAcrossRestart": True, "eventRefUniquePerTurn": True,
              "epochMonotonic": True}
    return build(adir, "P0A-9", detail, "P0A-9.a", rows)


def build_p0acb(adir):
    basis_wire = b'{"a": 1}'  # non-canonical spacing on purpose; jcs_v1 normalizes
    normalized = ab_canon.jcs(json.loads(basis_wire))
    sample_digest = ab_canon_text("AgentBridge/ContextBasis/v1",
                                  {"byteEncoding": "utf8", "canonicalization": "jcs_v1",
                                   "normalizedBytesB64": b64url_encode(normalized)})
    carrier = {"carrierEventRef": "evt-carrier-1", "authChannel": "host_hook_v1",
               "obtainedAtBeforeSubmit": True, "callerReceivedDigest": sample_digest}
    rows = [("byte_source_probe", {"found": True, "sourceKind": "prompt_history"}),
            ("digest_producer_probe", {"producer": "host", "transport": "host_hook_v1"}),
            ("caller_obtain_probe", {"protocol": "host_provided_at_prompt_verified",
                                     "beforeSubmit": True}),
            ("digest_replay_check", {"match": True}),
            ("resolution_done", {"resolutionKind": "solved"}),
            ("carrier_tuple", dict(carrier))]
    detail = {"resolution": {
        "kind": "solved",
        "byteSource": {"kind": "prompt_history", "locator": "synthetic://prompt-history"},
        "byteEncoding": "utf8", "canonicalization": "jcs_v1",
        "digestProducer": "host", "producerTransport": "host_hook_v1",
        "sampleBasisBytesB64": b64url_encode(basis_wire),
        "sampleDigest": sample_digest,
        "callerObtainProtocol": "host_provided_at_prompt_verified",
        "obtainCarrier": dict(carrier)}}
    return build(adir, "P0A-CB", detail, "P0A-CB.a", rows)


BUILDERS = {"P0A-1": build_p0a1, "P0A-2": build_p0a2, "P0A-3": build_p0a3,
            "P0A-4": build_p0a4, "P0A-5": build_p0a5, "P0A-6": build_p0a6,
            "P0A-7": build_p0a7, "P0A-8": build_p0a8, "P0A-9": build_p0a9,
            "P0A-CB": build_p0acb}


def expect(adir, name, ev, accept, needle=None, consume=False, allowlist=None):
    ok, report = validate(ev, adir, DELIVERY_ALLOWLIST if allowlist is None else allowlist, consume)
    if accept:
        check(name, ok, f"unexpected reject: {report[-3:]}")
    else:
        hit = needle is None or any(needle in line for line in report)
        check(name, (not ok) and hit,
              f"expected reject with '{needle}', got ok={ok}, report tail={report[-3:]}")


def cli(name, args, want_rc, needle=None, forbid=None):
    r = subprocess.run([sys.executable, os.path.join(HERE, "validate.py")] + args,
                       capture_output=True, text=True)
    out = r.stdout + r.stderr
    hit = needle is None or needle in out
    clean = forbid is None or forbid not in out
    check(name, r.returncode == want_rc and hit and clean,
          f"rc={r.returncode} (want {want_rc}), out={out[:200]!r}")


def main():
    print("== phase0a harness selftest ==")

    print("- AB-CANON anchors")
    try:
        ab_canon.self_check()
        check("ab_canon GV-1/GV-4 anchors", True)
    except AssertionError as e:
        check("ab_canon GV-1/GV-4 anchors", False, str(e))

    print("- NOT_RUN fixtures (regenerate, validate, consume-reject)")
    for probe in PROBE_IDS:
        ev = gen_not_run.not_run_evidence(probe)
        ok, report = validate(ev, None, DELIVERY_ALLOWLIST, False)
        check(f"NOT_RUN {probe} shape-accepted", ok, str(report[-2:]))
        ok2, _ = validate(ev, None, DELIVERY_ALLOWLIST, True)
        check(f"NOT_RUN {probe} consume-rejected", not ok2)

    with tempfile.TemporaryDirectory() as adir:
        print("- synthetic full-chain positives (all ten probes)")
        built = {}
        for probe in PROBE_IDS:
            ev, blob = BUILDERS[probe](adir)
            built[probe] = (ev, blob)
            expect(adir, f"{probe} synthetic PASS accepted (full chain)", ev, True)
        p1, p1_blob = built["P0A-1"]
        p6, _ = built["P0A-6"]
        p8, p8_blob = built["P0A-8"]
        pcb, pcb_blob = built["P0A-CB"]

        print("- consumption gate both ways")
        expect(adir, "consume rejected under delivery allowlist (fail-closed)", p8, False,
               needle="CONSUME", consume=True)
        expect(adir, "consume accepted under explicit permissive allowlist", p8, True,
               consume=True, allowlist=PERMISSIVE_ALLOWLIST)
        nr = gen_not_run.not_run_evidence("P0A-8")
        expect(adir, "NOT_RUN never consumable even under permissive allowlist", nr, False,
               needle="not PASS", consume=True, allowlist=PERMISSIVE_ALLOWLIST)

        print("- allowlist closed schema (r82b P0)")
        bad = dict(PERMISSIVE_ALLOWLIST)
        bad["approvedRunbookVersions"] = "xxphase0a-runbook/v1yy"  # str: substring 'in' fail-open attack
        expect(adir, "a1 allowlist approved as string (type corruption)", p8, False,
               needle="approvedRunbookVersions", consume=True, allowlist=bad)
        bad = dict(PERMISSIVE_ALLOWLIST)
        bad["extra"] = 1
        expect(adir, "a2 allowlist unknown field", p8, False,
               needle="unknown field", consume=True, allowlist=bad)
        bad = dict(PERMISSIVE_ALLOWLIST)
        bad["frozenHostMatrix"] = dict(SYNTH_MATRIX, unexpected="x")
        expect(adir, "a3 allowlist frozen matrix extra field", p8, False,
               needle="frozenHostMatrix", consume=True, allowlist=bad)
        for missing in ("approvedRunbookVersions", "currentProfileVersion", "frozenHostMatrix"):
            bad = {k: v for k, v in PERMISSIVE_ALLOWLIST.items() if k != missing}
            expect(adir, f"a4 allowlist missing {missing}", p8, False,
                   needle=missing, consume=True, allowlist=bad)

        print("- template + env binding (r82b P0)")
        m = copy.deepcopy(p8)
        m["expectedStateSequence"]["events"] = m["expectedStateSequence"]["events"][:-1]
        refresh_digest(m)
        expect(adir, "t1 expected not a registered template variant", m, False, needle="TEMPLATE")

        empty_blob = make_artifact([])
        empty_ref = store_artifact(adir, empty_blob)
        m = copy.deepcopy(p8)
        m["observedStateSequence"] = {"events": []}
        m["expectedStateSequence"] = {"events": []}
        m["artifactRef"] = empty_ref
        refresh_digest(m)
        expect(adir, "t2 self-consistent EMPTY evidence (r82b attack) rejected", m, False,
               needle="TEMPLATE")

        env_blob = make_artifact(
            [("uds_handshake", {"ok": True}), ("uds_reconnect", {"ok": True}),
             ("stale_socket_probe", {"handled": True}), ("rollback_probe", {"ok": True})],
            env_overrides={"runbookVersion": "phase0a-runbook/v99"})
        env_ref = store_artifact(adir, env_blob)
        m = copy.deepcopy(p8)
        m["artifactRef"] = env_ref
        refresh_digest(m)
        expect(adir, "t3 env_snapshot.runbookVersion != evidence (unbound env attack)", m, False,
               needle="ENV")

        print("- isolation gate (r82b P1: runbook 不得单方放宽 architecture)")
        for iso, needle, label in (("degraded_shared_profile", "ISOLATION", "degraded run cannot PASS"),
                                   ("synthetic", "closed enum", "unknown isolation value rejected")):
            iso_blob = make_artifact(
                [("uds_handshake", {"ok": True}), ("uds_reconnect", {"ok": True}),
                 ("stale_socket_probe", {"handled": True}), ("rollback_probe", {"ok": True})],
                isolation=iso)
            iso_ref = store_artifact(adir, iso_blob)
            m = copy.deepcopy(p8)
            m["artifactRef"] = iso_ref
            refresh_digest(m)
            expect(adir, f"i1 {label}", m, False, needle=needle)

        print("- negative mutations (each must reject)")
        m = copy.deepcopy(p8)
        m["evidenceDigest"] = m["evidenceDigest"][:-1] + ("0" if m["evidenceDigest"][-1] != "0" else "1")
        expect(adir, "n1 bad evidenceDigest", m, False, needle="DIGEST")

        m = copy.deepcopy(p8)
        m["artifactRef"] = "sha256:" + "0" * 64
        refresh_digest(m)
        expect(adir, "n2 missing artifact file", m, False, needle="not found")

        m = copy.deepcopy(p8)
        tampered = p8_blob + json.dumps(
            {"seq": 6, "atMs": FIXED_AT + 6, "kind": "uds_handshake", "data": {"ok": True}}
        ).encode() + b"\n"
        with open(os.path.join(adir, m["artifactRef"].split(":")[1] + ".jsonl"), "wb") as f:
            f.write(tampered)
        expect(adir, "n3 artifact bytes tampered (hash mismatch)", m, False, needle="content hash")
        with open(os.path.join(adir, m["artifactRef"].split(":")[1] + ".jsonl"), "wb") as f:
            f.write(p8_blob)  # restore

        m = copy.deepcopy(p8)
        m["observedStateSequence"]["events"] = m["observedStateSequence"]["events"][:-1]
        refresh_digest(m)
        expect(adir, "n4 observed != deterministic re-extraction", m, False, needle="re-extraction")

        m = copy.deepcopy(p6)
        m["detail"]["scenarios"][0]["timingMs"] = m["timeoutMs"] + 1
        refresh_digest(m)
        expect(adir, "n5 timingMs > timeoutMs (bounds)", m, False, needle="PREDICATE")

        m = gen_not_run.not_run_evidence("P0A-8")
        m["detail"] = {}
        expect(adir, "n6 NOT_RUN with non-null detail", m, False, needle="exact-shape")

        m = copy.deepcopy(p8)
        m["fallbackOnFail"] = None
        refresh_digest(m)
        expect(adir, "n7 run-state with a null EIGHT-field", m, False, needle="exact-shape")

        m = copy.deepcopy(p8)
        m["detail"]["handshakeOk"] = False
        refresh_digest(m)
        expect(adir, "n8 status=PASS but predicate false", m, False, needle="PREDICATE")

        m = copy.deepcopy(p8)
        m["extraField"] = 1
        expect(adir, "n9 unknown top-level field", m, False, needle="unknown field")

        m = copy.deepcopy(p8)
        m["probeId"] = "P0A-99"
        expect(adir, "n10 unregistered probeId", m, False, needle="probeId")

        float_path = os.path.join(adir, "float_evidence.json")
        with open(float_path, "w", encoding="utf-8") as f:
            f.write('{"probeId": "P0A-8", "timeoutMs": 1.5}')
        try:
            load_json(float_path)
            check("n11 float rejected at JSON parse layer", False, "parse did not raise")
        except ValueError:
            check("n11 float rejected at JSON parse layer", True)

        m = copy.deepcopy(p8)
        m["status"] = "FAIL"
        refresh_digest(m)
        expect(adir, "n12 status=FAIL but predicate true", m, False, needle="PREDICATE")

        m = copy.deepcopy(p8)
        del m["hostMatrix"]["osVersion"]
        expect(adir, "n14 hostMatrix missing field", m, False, needle="hostMatrix")

        m = copy.deepcopy(p6)
        m["detail"]["scenarios"][1]["timingMs"] = -1
        refresh_digest(m)
        expect(adir, "n15 negative *Ms", m, False, needle="PREDICATE")

        m = copy.deepcopy(pcb)
        m["detail"]["resolution"]["obtainCarrier"]["carrierEventRef"] = "evt-carrier-2"
        refresh_digest(m)
        expect(adir, "n16 carrier tuple != artifact re-extraction", m, False, needle="CARRIER")

        m = copy.deepcopy(pcb)
        m["detail"]["resolution"]["sampleBasisBytesB64"] = b64url_encode(b'{"a": 2}')
        refresh_digest(m)
        expect(adir, "n17 basis bytes changed => AB-CANON recomputation mismatch", m, False,
               needle="PREDICATE")

        al = dict(PERMISSIVE_ALLOWLIST)
        al["approvedRunbookVersions"] = ["phase0a-runbook/v2-only"]
        expect(adir, "n18 consume: runbookVersion not in approved allowlist", p8, False,
               needle="not in approved allowlist", consume=True, allowlist=al)

        al = dict(PERMISSIVE_ALLOWLIST)
        al["frozenHostMatrix"] = dict(SYNTH_MATRIX, hostVersion="9.9.9")
        expect(adir, "n19 consume: hostMatrix != frozen matrix", p8, False,
               needle="frozen host/OS matrix", consume=True, allowlist=al)

        m = copy.deepcopy(p8)
        m["runbookVersion"] = "phase0a-runbook/v0-unapproved"
        refresh_digest(m)
        expect(adir, "n20 evidence runbookVersion diverges from artifact env_snapshot", m, False,
               needle="ENV")

        print("- r82b attack-vector negatives")
        m = copy.deepcopy(pcb)
        m["detail"]["resolution"]["sampleBasisBytesB64"] = "!!e30"
        refresh_digest(m)
        expect(adir, "r1 illegal base64url alphabet", m, False, needle="PREDICATE")

        m = copy.deepcopy(pcb)
        m["detail"]["resolution"]["sampleBasisBytesB64"] = "e31"
        refresh_digest(m)
        expect(adir, "r2 non-canonical base64url tail bits", m, False, needle="PREDICATE")

        m = copy.deepcopy(p1)
        m["detail"]["perSourceScenarios"][0]["generationBefore"] = 999
        m["detail"]["perSourceScenarios"][0]["generationAfter"] = 1000
        refresh_digest(m)
        expect(adir, "r3 P0A-1 fresh with forged generations (999→1000)", m, False,
               needle="PREDICATE")

        m = copy.deepcopy(p1)
        m["detail"]["perSourceScenarios"][1]["rsAfter"] = "rs-DIFFERENT"
        refresh_digest(m)
        expect(adir, "r4 P0A-1 rolling swaps rs_ identity", m, False, needle="PREDICATE")

        m = copy.deepcopy(p1)
        m["detail"]["perSourceScenarios"][1]["credentialRolled"] = False
        refresh_digest(m)
        expect(adir, "r5 P0A-1 detail diverges from observed registration_decision", m, False,
               needle="PREDICATE")

        m = copy.deepcopy(p1)
        m["detail"]["perSourceScenarios"][0]["registrationEventId"] = "not-a-regev"
        refresh_digest(m)
        expect(adir, "r6 P0A-1 registrationEventId not regev_<ULID>", m, False, needle="PREDICATE")

        m = copy.deepcopy(p8)
        m["timeoutMs"] = 2 ** 53
        refresh_digest_safe = m  # digest would raise on unsafe int; shape must reject first
        expect(adir, "r7 unsafe int rejected structurally (no traceback)", refresh_digest_safe,
               False, needle="unsafe int")

        bad_utf8 = b"\xff\xfe not utf8"
        bad_ref = store_artifact(adir, bad_utf8)
        m = copy.deepcopy(p8)
        m["artifactRef"] = bad_ref
        refresh_digest(m)
        expect(adir, "r8 invalid-UTF-8 artifact => structured reject", m, False,
               needle="not valid UTF-8")

        m = copy.deepcopy(built["P0A-2"][0])
        m["detail"]["marketplaceCacheBehavior"] = "cache_invalidated_ok"
        refresh_digest(m)
        expect(adir, "r9 P0A-2 self-report diverges from observed marketplace_refresh", m, False,
               needle="PREDICATE")

        m = copy.deepcopy(built["P0A-9"][0])
        m["detail"]["crossTurnSamples"] = m["detail"]["crossTurnSamples"] + [
            {"observationOrdinal": 2, "hostTurn": "turn-C",
             "observedEventRef": "ev-C", "assignedEpoch": 3}]
        refresh_digest(m)
        expect(adir, "r10 P0A-9 detail sample count != observed cross_turn_sample rows", m, False,
               needle="PREDICATE")

        print("- r83 regressions (type-strict equality / non-object evidence / raw source)")
        m = copy.deepcopy(p8)
        m["expectedStateSequence"]["events"][0]["ok"] = 1  # bool→int; Python == would conflate
        refresh_digest(m)
        expect(adir, "s1 template bool→int type confusion rejected", m, False, needle="TEMPLATE")

        m = copy.deepcopy(p8)
        m["expectedStateSequence"]["events"][0]["ok"] = 1
        m["observedStateSequence"]["events"][0]["ok"] = 1
        int_rows = [("uds_handshake", {"ok": 1}), ("uds_reconnect", {"ok": True}),
                    ("stale_socket_probe", {"handled": True}), ("rollback_probe", {"ok": True})]
        int_blob = make_artifact(int_rows)
        m["artifactRef"] = store_artifact(adir, int_blob)
        refresh_digest(m)
        expect(adir, "s2 all-int artifact + int observed/expected still rejected (TEMPLATE)",
               m, False, needle="TEMPLATE")

        m, _ = build_p0a1(adir)
        a, b = m["detail"]["perSourceScenarios"][1], m["detail"]["perSourceScenarios"][2]
        a["hostHookSource"], b["hostHookSource"] = b["hostHookSource"], a["hostHookSource"]
        refresh_digest(m)
        expect(adir, "s3 P0A-1 swapped raw sources vs artifact rejected", m, False,
               needle="RAWSOURCE")

        m, _ = build_p0a1(adir, sources=("startup", "resume", "resume", "compact"))
        expect(adir, "s4 P0A-1 duplicate raw source (artifact+detail consistent) rejected",
               m, False, needle="PREDICATE")

        m, _ = build_p0a1(adir)
        m["detail"]["perSourceScenarios"][0]["hostHookEvent"] = "SomeOtherHook"
        refresh_digest(m)
        expect(adir, "s5 P0A-1 non-uniform hostHookEvent rejected", m, False, needle="PREDICATE")

        m, _ = build_p0a9(adir, host_instances=("host-inst-1", "host-inst-1", "host-inst-1"))
        expect(adir, "s6 P0A-9 prompt_epoch PASS without host-restart proof rejected", m, False,
               needle="HOSTRESTART")

        print("- CLI subprocess integration (r82b P0: strict args)")
        nr_path = os.path.join(HERE, "fixtures", "not_run", "P0A-1.json")
        cli("c1 documented single-file invocation", [nr_path], 0, needle="ACCEPT")
        cli("c2 documented --artifact-dir invocation", [nr_path, "--artifact-dir", adir], 0,
            needle="ACCEPT")
        cli("c3 unknown option rejected", [nr_path, "--consumee"], 2, needle="unknown option")
        cli("c4 duplicate option rejected", [nr_path, "--consume", "--consume"], 2,
            needle="duplicate option")
        cli("c5 missing option value rejected", [nr_path, "--artifact-dir"], 2,
            needle="requires a value")
        cli("c6 two positionals rejected", [nr_path, nr_path], 2, needle="exactly 1")
        cli("c7 NOT_RUN --consume rejected via CLI", [nr_path, "--consume"], 1, needle="not PASS")
        cli("c8 --allowlist with explicit file works",
            [nr_path, "--allowlist", os.path.join(HERE, "allowlist.json")], 0, needle="ACCEPT")
        dup_path = os.path.join(adir, "dup_key.json")
        with open(dup_path, "w", encoding="utf-8") as f:
            f.write('{"probeId": "P0A-1", "status": "PASS", "status": "NOT_RUN"}')
        cli("c9 duplicate JSON key rejected at parse layer", [dup_path], 1,
            needle="duplicate JSON key")
        for label, payload in (("array", "[]"), ("null", "null"),
                               ("string", '"x"'), ("number", "7")):
            top_path = os.path.join(adir, f"top_{label}.json")
            with open(top_path, "w", encoding="utf-8") as f:
                f.write(payload)
            cli(f"c10 top-level {label} => structured reject, no traceback", [top_path], 1,
                needle="not a JSON object", forbid="Traceback")

    print("- gen_not_run fixtures drift check")
    rc = gen_not_run.main(["gen_not_run.py", "--check"])
    check("fixtures/not_run match regeneration", rc == 0)

    print()
    if FAILURES:
        print(f"SELFTEST FAILED: {len(FAILURES)} failing check(s): {FAILURES}")
        return 1
    print("SELFTEST PASS: all checks green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
