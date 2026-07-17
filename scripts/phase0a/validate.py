#!/usr/bin/env python3
"""ProbeEvidence validator CLI (harness 义务①-⑤ 全链; fail-closed).

Usage:
  python3 validate.py <evidence.json> [--artifact-dir DIR] [--allowlist FILE] [--consume]

CLI parsing is strict (r82b): unknown options, missing option values and
duplicate options all exit 2 — nothing is silently ignored.

Pipeline (any failing step rejects, exit 1; exit 0 only on full acceptance):
  1. parse (floats / NaN / Inf / duplicate JSON keys rejected at the JSON layer)
  2. closed shape + exact-shape CHECK 1/2 (evidence.py)         [义务①]
  3. run states: evidenceDigest AB-CANON-1 recomputation        [义务②]
  3b. run states: expectedStateSequence == a registered variant
     in expected_templates.json (SSOT; 自造/空 expected 不入门)
  4. run states: artifact exists, bytes hash == artifactRef,
     deterministic re-extraction == observedStateSequence,
     env_snapshot == evidence 顶层 (hostMatrix/runbook/profile),
     isolation ∈ closed enum ∧ (PASS ⇒ isolated_profile)        [义务③]
     (P0A-CB: carrier tuple re-extraction == obtainCarrier)
  5. run states: passPredicate ⇔ status (exact-shape CHECK 3)   [义务⑤/①]
  6. --consume: PASS ∧ digest ∧ closed-schema allowlist ∧
     profileVersion==current ∧ runbookVersion ∈ approved ∧
     hostMatrix==frozen                                          [义务④]

NOT_RUN evidence passes steps 1-2 only (nothing else exists to check) and is
always rejected under --consume (not PASS). This tool never mutates anything.
"""
import hashlib
import json
import os
import sys

import evidence as ev_schema
import predicates
from ab_canon import ab_canon_text, strict_deep_equal, strict_pairs
from extract import (ExtractError, carrier_tuple_from_artifact, env_snapshot_data,
                     extract_observed, host_instance_ids, p0a1_scenario_sources)

HERE = os.path.dirname(os.path.abspath(__file__))

# runbook §0.3/§0.4 closed enum; PASS evidence requires the architecture §15
# isolation hard requirement (isolated OS profile) — degraded runs are
# rehearsal-only and can never validate as PASS (r82b P1: runbook 不得单方放宽).
ISOLATION_VALUES = ("isolated_profile", "degraded_shared_profile")

_TEMPLATES = None


def _reject_float(s):
    raise ValueError(f"float forbidden in evidence JSON: {s}")


def _reject_const(s):
    raise ValueError(f"non-finite forbidden in evidence JSON: {s}")


def load_json(path):
    with open(path, "rb") as f:
        return json.loads(f.read().decode("utf-8"),
                          parse_float=_reject_float, parse_constant=_reject_const,
                          object_pairs_hook=strict_pairs)


def templates():
    """expected_templates.json (SSOT) — evidence.expectedStateSequence must be a
    verbatim copy of one registered variant (r82b P0: 防自洽空 extractor 入门)."""
    global _TEMPLATES
    if _TEMPLATES is None:
        _TEMPLATES = load_json(os.path.join(HERE, "expected_templates.json"))
    return _TEMPLATES


def check_allowlist(al) -> list:
    """Closed allowlist schema (r82b P0: 类型损坏可 fail-open → 封闭校验)."""
    errors = []
    if not isinstance(al, dict):
        return ["allowlist: not a JSON object"]
    for k in al:
        if k not in ("_comment", "approvedRunbookVersions", "currentProfileVersion", "frozenHostMatrix"):
            errors.append(f"allowlist.{k}: unknown field (closed schema)")
    if "_comment" in al and not isinstance(al["_comment"], str):
        errors.append("allowlist._comment: must be string")
    arv = al.get("approvedRunbookVersions")
    if not isinstance(arv, list) or any(not isinstance(x, str) or x == "" for x in arv):
        errors.append("allowlist.approvedRunbookVersions: must be a list of non-empty strings")
    elif len(set(arv)) != len(arv):
        errors.append("allowlist.approvedRunbookVersions: entries must be unique")
    cpv = al.get("currentProfileVersion")
    if not isinstance(cpv, str) or cpv == "":
        errors.append("allowlist.currentProfileVersion: must be a non-empty string")
    if "frozenHostMatrix" not in al:
        errors.append("allowlist.frozenHostMatrix: missing (must be present; null = not frozen)")
    else:
        fhm = al["frozenHostMatrix"]
        if fhm is not None:
            if not isinstance(fhm, dict) or set(fhm.keys()) != set(ev_schema.HOST_MATRIX_FIELDS) \
                    or any(not isinstance(fhm[f], str) or fhm[f] == ""
                           for f in ev_schema.HOST_MATRIX_FIELDS):
                errors.append("allowlist.frozenHostMatrix: must be null or an exact "
                              f"{{{', '.join(ev_schema.HOST_MATRIX_FIELDS)}}} object of non-empty strings")
    return errors


def validate(ev, artifact_dir, allowlist, consume):
    """Returns (ok: bool, report: [str])."""
    report = []

    shape_errors = ev_schema.check_shape(ev)
    if shape_errors:
        return False, [f"SHAPE: {e}" for e in shape_errors]
    report.append("shape: OK (closed schema + exact-shape 1/2)")

    status = ev["status"]
    if status in ev_schema.RUN_STATES:
        recomputed = ab_canon_text("AgentBridge/ProbeEvidence/v1", ev_schema.hash_input(ev))
        if recomputed != ev["evidenceDigest"]:
            return False, report + [f"DIGEST: recomputed {recomputed} != evidenceDigest {ev['evidenceDigest']}"]
        report.append("evidenceDigest: OK (AB-CANON-1 recomputed)")

        variants = [v for k, v in templates().items()
                    if k.startswith(ev["probeId"] + ".")]
        if not any(strict_deep_equal(ev["expectedStateSequence"], v) for v in variants):
            return False, report + ["TEMPLATE: expectedStateSequence is not a registered "
                                    f"template variant for {ev['probeId']} (expected_templates.json "
                                    "= SSOT; 逐字=JSON 类型级深等,bool≠int; 自洽空/自造 expected 不入门)"]
        report.append("template: OK (expectedStateSequence == a registered variant)")

        if artifact_dir is None:
            return False, report + ["ARTIFACT: run-state evidence requires --artifact-dir "
                                    "(re-extraction is MUST, spec §14.2 轮 59)"]
        hexpart = ev["artifactRef"].split(":", 1)[1]
        apath = os.path.join(artifact_dir, hexpart + ".jsonl")
        if not os.path.isfile(apath):
            return False, report + [f"ARTIFACT: {apath} not found"]
        with open(apath, "rb") as f:
            ablob = f.read()
        got = hashlib.sha256(ablob).hexdigest()
        if got != hexpart:
            return False, report + [f"ARTIFACT: content hash {got} != artifactRef {hexpart}"]
        try:
            reextracted = extract_observed(ev["probeId"], ablob)
            env = env_snapshot_data(ablob)
        except ExtractError as e:
            return False, report + [f"ARTIFACT: extraction failed: {e}"]
        if not strict_deep_equal(reextracted, ev["observedStateSequence"]):
            return False, report + ["ARTIFACT: deterministic re-extraction != observedStateSequence "
                                    "(JSON 类型级深等, bool≠int)"]
        # env_snapshot ↔ evidence 顶层绑定(r82b P0: artifact 必须与声称的环境/版本一致)
        for f in ("hostMatrix", "runbookVersion", "profileVersion"):
            if not strict_deep_equal(env.get(f), ev[f]):
                return False, report + [f"ENV: env_snapshot.{f} != evidence.{f} "
                                        "(artifact 与 evidence 顶层环境绑定)"]
        iso = env.get("isolation")
        if iso not in ISOLATION_VALUES:
            return False, report + [f"ENV: env_snapshot.isolation {iso!r} not in closed enum "
                                    f"{list(ISOLATION_VALUES)} (runbook §0.3)"]
        if status == "PASS" and iso != "isolated_profile":
            return False, report + ["ISOLATION: status=PASS requires isolation=isolated_profile "
                                    "(architecture §15 硬要求; degraded run 只能记 FAIL/INCONCLUSIVE)"]
        report.append("artifact: OK (bytes hash + deterministic re-extraction + env binding match)")

        if ev["probeId"] == "P0A-CB" and ev["detail"]["resolution"]["kind"] == "solved":
            try:
                car = carrier_tuple_from_artifact(ablob)
            except ExtractError as e:
                return False, report + [f"CARRIER: {e}"]
            if not strict_deep_equal(car, ev["detail"]["resolution"]["obtainCarrier"]):
                return False, report + ["CARRIER: artifact carrier_tuple != detail obtainCarrier "
                                        "(轮 60 P1-5: 全 tuple 重抽一致; 类型级深等)"]
            report.append("carrier tuple: OK (re-extracted, matches)")

        if (ev["probeId"] == "P0A-9" and status == "PASS"
                and ev["detail"].get("producerFrozen") == "prompt_epoch"):
            # r84 F1: pre/post_restart 相位=宿主实例重启(spec §14.2 轮 58)——
            # PASS 必须携带跨宿主实例的 artifact 证明,桩进程重启不构成相位
            try:
                inst = host_instance_ids(ablob)
            except ExtractError as e:
                return False, report + [f"HOSTRESTART: {e}"]
            if len(inst) < 2 or len(set(inst)) < 2:
                return False, report + ["HOSTRESTART: prompt_epoch PASS requires >=2 host_instance "
                                        "artifact rows with >=2 distinct instanceId "
                                        "(宿主重启证明, runbook §9.3 / spec §14.2 轮 58)"]
            report.append(f"host instances: OK ({len(set(inst))} distinct across {len(inst)} rows)")

        if ev["probeId"] == "P0A-1":
            # r83: detail 的 raw hostHookSource 绑定 artifact 场景行原值(hash 锚定)——
            # detail 不得错报/互换 artifact 实际记录的 raw source
            try:
                srcs = p0a1_scenario_sources(ablob)
            except ExtractError as e:
                return False, report + [f"RAWSOURCE: {e}"]
            claimed = [r.get("hostHookSource") for r in (ev["detail"].get("perSourceScenarios") or [])]
            if not strict_deep_equal(srcs, claimed):
                return False, report + ["RAWSOURCE: detail.perSourceScenarios[*].hostHookSource != "
                                        "artifact scenario session_start_hook raw sources (in order)"]
            report.append("raw sources: OK (detail bound to artifact scenario rows)")

        try:
            pred, reasons = predicates.evaluate(ev)
        except Exception as e:  # fail-closed: predicate errors are never PASS
            pred, reasons = False, [f"predicate raised: {e}"]
        if status == "PASS" and not pred:
            return False, report + ["PREDICATE: status=PASS but passPredicate=false "
                                    "(exact-shape CHECK 3)"] + [f"  - {r}" for r in reasons]
        if status in ("FAIL", "INCONCLUSIVE") and pred:
            return False, report + [f"PREDICATE: status={status} but passPredicate=true "
                                    "(FAIL/INCONCLUSIVE ⇒ passPredicate≠true)"]
        report.append(f"predicate: OK (passPredicate={pred} consistent with status={status})")

    if consume:
        if status != "PASS":
            return False, report + [f"CONSUME: status={status} is not PASS"]
        if allowlist is None:
            return False, report + ["CONSUME: no allowlist config (fail-closed)"]
        al_errors = check_allowlist(allowlist)
        if al_errors:
            return False, report + [f"CONSUME: {e} (fail-closed)" for e in al_errors]
        if ev["runbookVersion"] not in allowlist["approvedRunbookVersions"]:
            return False, report + [f"CONSUME: runbookVersion {ev['runbookVersion']!r} not in approved allowlist"]
        if ev["profileVersion"] != allowlist["currentProfileVersion"]:
            return False, report + [f"CONSUME: profileVersion {ev['profileVersion']!r} != current "
                                    f"{allowlist['currentProfileVersion']!r}"]
        if allowlist["frozenHostMatrix"] is None \
                or not strict_deep_equal(ev["hostMatrix"], allowlist["frozenHostMatrix"]):
            return False, report + ["CONSUME: hostMatrix != frozen host/OS matrix (or matrix not frozen)"]
        report.append("consume gate: OK (PASS + digest + 三重 staleness gate)")

    return True, report


def parse_cli(argv):
    """Strict fail-closed CLI parsing (r82b P0: option 值不作位置参数;未知/缺值/
    重复 option 一律拒). Returns (evidence_path, artifact_dir, allowlist_path,
    consume) or raises ValueError with a precise message."""
    positional = []
    artifact_dir = None
    allowlist_path = os.path.join(HERE, "allowlist.json")
    consume = False
    seen = set()
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--consume":
            if "consume" in seen:
                raise ValueError("duplicate option --consume")
            seen.add("consume")
            consume = True
            i += 1
        elif a in ("--artifact-dir", "--allowlist"):
            if a in seen:
                raise ValueError(f"duplicate option {a}")
            seen.add(a)
            if i + 1 >= len(argv) or argv[i + 1].startswith("--"):
                raise ValueError(f"option {a} requires a value")
            if a == "--artifact-dir":
                artifact_dir = argv[i + 1]
            else:
                allowlist_path = argv[i + 1]
            i += 2
        elif a.startswith("-"):
            raise ValueError(f"unknown option {a}")
        else:
            positional.append(a)
            i += 1
    if len(positional) != 1:
        raise ValueError(f"expected exactly 1 evidence file, got {len(positional)}")
    return positional[0], artifact_dir, allowlist_path, consume


def main(argv):
    try:
        ev_path, artifact_dir, allowlist_path, consume = parse_cli(argv)
    except ValueError as e:
        print(f"ARGS: {e}\n")
        print(__doc__)
        return 2
    try:
        ev = load_json(ev_path)
    except Exception as e:
        print(f"REJECT {ev_path}\n  PARSE: {e}")
        return 1
    allowlist = None
    if os.path.isfile(allowlist_path):
        try:
            allowlist = load_json(allowlist_path)
        except Exception as e:
            print(f"REJECT {ev_path}\n  ALLOWLIST: unreadable ({e}) — fail-closed")
            return 1
    try:
        ok, report = validate(ev, artifact_dir, allowlist, consume)
    except Exception as e:  # belt: any unhandled anomaly is a structured rejection, never a traceback
        ok, report = False, [f"INTERNAL: unhandled {type(e).__name__}: {e} (fail-closed)"]
    verdict = "ACCEPT" if ok else "REJECT"
    # r83 P1: ev may be any parsed JSON value (list/str/int/null) — never assume dict here
    probe = ev.get("probeId") if isinstance(ev, dict) else None
    status = ev.get("status") if isinstance(ev, dict) else None
    print(f"{verdict} {ev_path} (probe={probe!r} status={status!r} consume={consume})")
    for line in report:
        print(f"  {line}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
