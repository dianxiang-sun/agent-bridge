#!/usr/bin/env python3
"""AB-CANON-1 golden vector generator (v3-protocol-spec.md Appendix GV).

JCS subset note: json.dumps(sort_keys=True, separators=(',',':'), ensure_ascii=False)
matches RFC 8785 for inputs constrained by the spec: ASCII keys, safe integers,
strings without exotic control characters. Vectors below stay inside that subset;
full-JCS edge vectors ship with conformance fixtures.
"""
import json, hashlib, hmac, base64

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
            for x in v: check(x)
        if isinstance(v, int) and abs(v) > 2**53 - 1:
            raise ValueError("unsafe int")
    check(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def ab_canon_raw(domain: str, value) -> bytes:
    return hashlib.sha256(domain.encode("utf-8") + b"\x00" + jcs(value)).digest()

def text(raw: bytes) -> str:
    return "sha256:" + raw.hex()

def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")

out = []
def emit(name, domain, value):
    raw = ab_canon_raw(domain, value)
    out.append((name, domain, jcs(value).decode("utf-8"), text(raw)))
    return text(raw)

# GV-1 WorkspaceFingerprint
wf_input = {"cwdCanonical": "/Users/test/project",
            "vcsCommonDirCanonical": "/Users/test/project/.git",
            "worktreeName": None}
wf_digest = emit("GV-1 WorkspaceFingerprint", "AgentBridge/WorkspaceFingerprint/v1", wf_input)

# GV-2 Hello
hello = {"clientNonce": "AAAAAAAAAAAAAAAAAAAAAA",
         "minProtocolVersion": 1, "maxProtocolVersion": 1,
         "surface": "claude-cli", "hostVersion": "2.1.209",
         "pluginVersion": "0.1.0-test",
         "protocolFeatures": ["task_core_v1", "wake_signal_v1"]}
hello_digest = emit("GV-2 Hello", "AgentBridge/Hello/v1", hello)

# GV-3 HelloAck
hello_ack = {"protocolVersion": 1, "brokerVersion": "3.0.0-test",
             "installationId": "inst_00000000000000000000000000",
             "brokerBootEpoch": 1, "serverNonce": b64url(b"\x01" * 16),  # canonical base64url
             "negotiatedProtocolFeatures": ["task_core_v1", "wake_signal_v1"],
             "limits": {"maxFrameBytes": 1048576, "heartbeatIntervalMs": 30000,
                        "maxInflightSubmits": 4}}
hello_ack_digest = emit("GV-3 HelloAck", "AgentBridge/HelloAck/v1", hello_ack)

# GV-4 RegisterBodyHashInput
envelope = {"surface": "claude-cli", "hostVersion": "2.1.209",
            "pluginVersion": "0.1.0-test",
            "hostNativeSessionId": "11111111-1111-1111-1111-111111111111",
            "generationHint": None,
            "registrationSource": "session_start",
            "workspaceFingerprint": {**wf_input, "digest": wf_digest},
            "capabilities": {"canStartTurn": True, "canInjectActiveConversation": False,
                             "canReturnSynchronousResult": True, "canWakeIdle": True,
                             "supportsCancellation": True, "requiresForeground": False,
                             "inboundMode": "hook_wake", "canPresentApproval": False,
                             "canAttestHumanGesture": False, "attestationSchemes": []},
            "billingClass": "subscription", "accountClass": "consumer",
            "approvalMode": "default", "transcriptPath": None}
register_body = {"requestKind": "register",
                 "registrationEventId": "regev_00000000000000000000000000",
                 "resumeTokenHash": None, "approvalBootstrap": None,
                 "envelope": envelope}
body_digest = emit("GV-4 RegisterBodyHashInput", "AgentBridge/RegisterBody/v1", register_body)

# GV-5 HandshakeProof MAC
secret = bytes(range(32))  # 000102...1f
proof_input = {"requestKind": "register",
               "clientHelloDigest": hello_digest,
               "helloAckDigest": hello_ack_digest,
               "requestBodyDigest": body_digest,
               "resumeTokenHash": None}
proof_raw = ab_canon_raw("AgentBridge/HandshakeProof/v1", proof_input)
mac = hmac.new(secret, proof_raw, hashlib.sha256).digest()
out.append(("GV-5 HandshakeProof", "AgentBridge/HandshakeProof/v1",
            jcs(proof_input).decode("utf-8"),
            f"inner={text(proof_raw)}  mac(secret=0x000102..1f)={b64url(mac)}"))

# GV-6 EnrollmentPoPClaim inner digest (Ed25519 signature itself follows RFC 8032
# standard test-vector conformance; the AgentBridge-specific part is this message digest)
challenge_nonce = b64url(b"\x02" * 32)  # 32B canonical base64url per spec §4.8
pop_claim = {"installationId": "inst_00000000000000000000000000",
             "endpointId": "ep_00000000000000000000000000",
             "expectedEndpointGeneration": 1, "provisionRevision": 1,
             "enrollmentKeyId": "enroll-test-1",
             "declaredSchemes": ["user_presence_dialog_v1"],
             "bootstrapChallengeNonce": challenge_nonce,
             "registrationEventId": "regev_00000000000000000000000000"}
emit("GV-6 EnrollmentPoPClaim", "AgentBridge/EnrollmentPoP/v1", pop_claim)

# GV-7 approval-register canonicalRequestDigest (RegisterBodyHashInput with
# ApprovalBootstrapHashInput; hash inputs = UTF-8 bytes of wire strings)
def wire_hash(s: str) -> str:
    return "sha256:" + hashlib.sha256(s.encode("utf-8")).hexdigest()

bc_wire = "bc1." + b64url(b"\xaa" * 32)
pop_sig_wire = b64url(b"\xbb" * 64)  # fixture bytes; digest vector does not need a valid signature
approval_hash_input = {"endpointId": "ep_00000000000000000000000000",
                       "expectedEndpointGeneration": 1, "provisionRevision": 1,
                       "enrollmentKeyId": "enroll-test-1",
                       "declaredSchemes": ["user_presence_dialog_v1"],
                       "bootstrapCapabilityHash": wire_hash(bc_wire),
                       "enrollmentProofOfPossessionHash": wire_hash(pop_sig_wire)}
approval_envelope = {"surface": "approval_system", "hostVersion": "-",
                     "pluginVersion": "1.0.0-test", "hostNativeSessionId": "approval-agent-1",
                     "generationHint": None, "registrationSource": "session_start",
                     "workspaceFingerprint": {**wf_input, "digest": wf_digest},
                     "capabilities": {"canStartTurn": False, "canInjectActiveConversation": False,
                                      "canReturnSynchronousResult": True, "canWakeIdle": False,
                                      "supportsCancellation": False, "requiresForeground": True,
                                      "inboundMode": "none", "canPresentApproval": True,
                                      "canAttestHumanGesture": True,
                                      "attestationSchemes": ["user_presence_dialog_v1"]},
                     "billingClass": "unknown", "accountClass": "unknown",
                     "approvalMode": "default", "transcriptPath": None}
approval_register_body = {"requestKind": "register",
                          "registrationEventId": "regev_00000000000000000000000001",
                          "resumeTokenHash": None,
                          "approvalBootstrap": approval_hash_input,
                          "envelope": approval_envelope}
emit("GV-7 approval RegisterBodyHashInput", "AgentBridge/RegisterBody/v1", approval_register_body)

for name, domain, jcs_str, digest in out:
    print(f"### {name}\ndomain: {domain}\nJCS: {jcs_str}\nresult: {digest}\n")
