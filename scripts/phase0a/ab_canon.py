#!/usr/bin/env python3
"""AB-CANON-1 canonical primitive (v3-protocol-spec.md §1.4) — side-effect-free helper.

Deliberately NOT importing docs/gen_golden_vectors.py (importing it prints the
golden vectors — side effect; ledger 入口 v7 纪律). The jcs/ab_canon logic below
is byte-for-byte equivalent; self_check() re-derives GV-1/GV-4 anchors to prove it.
JCS subset note is identical to gen_golden_vectors.py: ASCII keys, safe integers,
no floats — inputs outside the subset raise (fail-closed).
"""
import base64
import hashlib
import json
import re

SAFE_INT_MAX = 2**53 - 1

_B64URL_RE = re.compile(r"^[A-Za-z0-9_-]*$")


def strict_pairs(pairs):
    """object_pairs_hook: duplicate JSON keys rejected BEFORE any canonical use
    (spec §1.4 JCS 收紧②「重复 key 在 JCS 之前即拒」; §14.2 轮 62 将其应用于
    P0A-CB normalization). Shared by every JSON loader in this package."""
    d = {}
    for k, v in pairs:
        if k in d:
            raise ValueError(f"duplicate JSON key: {k!r}")
        d[k] = v
    return d


def strict_deep_equal(a, b) -> bool:
    """JSON-typed deep equality (r83 P0): Python's == conflates bool with int
    (True==1, False==0), so template membership / observed==expected / binding
    comparisons must NOT use it directly. bool only equals bool; containers
    recurse; other scalars require identical type AND value. Total function —
    never raises."""
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(strict_deep_equal(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(strict_deep_equal(x, y) for x, y in zip(a, b))
    if type(a) is not type(b):
        return False
    return a == b


def jcs(value) -> bytes:
    def check(v):
        if isinstance(v, float):
            raise ValueError("floats forbidden")
        if isinstance(v, dict):
            for k in v:
                if not (isinstance(k, str) and k.isascii()):
                    raise ValueError("non-ascii key")
                check(v[k])
        if isinstance(v, list):
            for x in v:
                check(x)
        if isinstance(v, int) and not isinstance(v, bool) and abs(v) > SAFE_INT_MAX:
            raise ValueError("unsafe int")
    check(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def ab_canon_raw(domain: str, value) -> bytes:
    return hashlib.sha256(domain.encode("utf-8") + b"\x00" + jcs(value)).digest()


def ab_canon_text(domain: str, value) -> str:
    return "sha256:" + ab_canon_raw(domain, value).hex()


def sha256_text(raw: bytes) -> str:
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def b64url_decode(s: str) -> bytes:
    """Strict unpadded base64url (spec §14.2 sampleBasisBytesB64): URL-safe
    alphabet only, no padding chars, and the encoding must be CANONICAL —
    b64url_encode(decoded) == input (rejects non-canonical tail bits like
    'e31' whose canonical form is 'e30'). Any violation raises (fail-closed)."""
    if not isinstance(s, str) or not _B64URL_RE.match(s):
        raise ValueError("invalid base64url: illegal character (URL-safe unpadded alphabet only)")
    if len(s) % 4 == 1:
        raise ValueError("invalid base64url: impossible length")
    raw = base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
    if b64url_encode(raw) != s:
        raise ValueError("invalid base64url: non-canonical encoding (tail bits / padding)")
    return raw


# --- self-check anchors: recomputed from spec Appendix GV inputs (GV-1, GV-4).
# Values must match docs/gen_golden_vectors.py stdout (锚 d80341b0…, unchanged by this file).
_GV1_INPUT = {"cwdCanonical": "/Users/test/project",
              "vcsCommonDirCanonical": "/Users/test/project/.git",
              "worktreeName": None}
_GV1_EXPECTED = "sha256:674b43ebe34233340a7b2440f20567b62b0d131d59383b3932a239d5bccfa91b"

_GV4_INPUT = {"requestKind": "register",
              "registrationEventId": "regev_00000000000000000000000000",
              "resumeTokenHash": None, "approvalBootstrap": None,
              "envelope": {"surface": "claude-cli", "hostVersion": "2.1.209",
                           "pluginVersion": "0.1.0-test",
                           "hostNativeSessionId": "11111111-1111-1111-1111-111111111111",
                           "generationHint": None,
                           "registrationSource": "session_start",
                           "workspaceFingerprint": {**_GV1_INPUT, "digest": _GV1_EXPECTED},
                           "capabilities": {"canStartTurn": True, "canInjectActiveConversation": False,
                                            "canReturnSynchronousResult": True, "canWakeIdle": True,
                                            "supportsCancellation": True, "requiresForeground": False,
                                            "inboundMode": "hook_wake", "canPresentApproval": False,
                                            "canAttestHumanGesture": False, "attestationSchemes": []},
                           "billingClass": "subscription", "accountClass": "consumer",
                           "approvalMode": "default", "transcriptPath": None}}
_GV4_EXPECTED = "sha256:61f3eb74280ff20ae58be94d1f24d7d9e87df23508e414df615eac4d2388fa53"


def self_check() -> None:
    got1 = ab_canon_text("AgentBridge/WorkspaceFingerprint/v1", _GV1_INPUT)
    if got1 != _GV1_EXPECTED:
        raise AssertionError(f"GV-1 anchor mismatch: {got1}")
    got4 = ab_canon_text("AgentBridge/RegisterBody/v1", _GV4_INPUT)
    if got4 != _GV4_EXPECTED:
        raise AssertionError(f"GV-4 anchor mismatch: {got4}")


if __name__ == "__main__":
    self_check()
    print("ab_canon self_check OK (GV-1, GV-4 anchors match)")
