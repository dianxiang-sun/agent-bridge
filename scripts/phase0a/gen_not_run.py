#!/usr/bin/env python3
"""Generate the 10 NOT_RUN ProbeEvidence records (the ONLY legal evidence this
paper-stage deliverable produces; spec §14.2: 本文交付时一律 NOT_RUN ⇔ 八字段全 NULL).

Usage:
  python3 gen_not_run.py           # (re)write fixtures/not_run/<probe>.json
  python3 gen_not_run.py --check   # verify committed fixtures match regeneration byte-for-byte

hostMatrix here is the PLANNED execution matrix (runbook §0.2: product = 被探测
行为所属宿主; versions frozen only at execution time — placeholders until then).
"""
import json
import os
import sys

from evidence import PROBE_IDS, check_shape

RUNBOOK_VERSION = "phase0a-runbook/v1"
PROFILE_VERSION = "adapter-profile/v0-unfrozen"

PLANNED_PRODUCT = {
    "P0A-1": "claude-code-desktop",
    "P0A-2": "codex-desktop",
    "P0A-3": "codex-desktop",
    "P0A-4": "codex-cli",
    "P0A-5": "codex-desktop",
    "P0A-6": "codex-desktop",
    "P0A-7": "claude-code-cli",
    "P0A-8": "codex-cli",
    "P0A-9": "claude-code-desktop",
    "P0A-CB": "claude-code-desktop",
}


def not_run_evidence(probe_id: str) -> dict:
    return {
        "probeId": probe_id,
        "probeSchemaVersion": 1,
        "status": "NOT_RUN",
        "hostMatrix": {"product": PLANNED_PRODUCT[probe_id],
                       "hostVersion": "TBD-at-execution",
                       "os": "macOS",
                       "osVersion": "TBD-at-execution"},
        "runbookVersion": RUNBOOK_VERSION,
        "profileVersion": PROFILE_VERSION,
        "executedAt": None,
        "evidenceDigest": None,
        "detail": None,
        "artifactRef": None,
        "observedStateSequence": None,
        "expectedStateSequence": None,
        "timeoutMs": None,
        "fallbackOnFail": None,
    }


def render(ev: dict) -> bytes:
    return (json.dumps(ev, indent=2, ensure_ascii=False, sort_keys=False) + "\n").encode("utf-8")


def main(argv):
    check = "--check" in argv
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "not_run")
    os.makedirs(outdir, exist_ok=True)
    drift = []
    for probe in PROBE_IDS:
        ev = not_run_evidence(probe)
        errors = check_shape(ev)
        if errors:  # self-guard: generator must never emit shape-invalid evidence
            raise AssertionError(f"{probe}: generated NOT_RUN evidence fails shape: {errors}")
        path = os.path.join(outdir, f"{probe}.json")
        blob = render(ev)
        if check:
            if not os.path.isfile(path):
                drift.append(f"{path}: missing")
            else:
                with open(path, "rb") as f:
                    if f.read() != blob:
                        drift.append(f"{path}: differs from regeneration")
        else:
            with open(path, "wb") as f:
                f.write(blob)
            print(f"wrote {path}")
    if check:
        if drift:
            for d in drift:
                print(f"DRIFT {d}")
            return 1
        print("gen_not_run --check OK (10 fixtures match regeneration)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
