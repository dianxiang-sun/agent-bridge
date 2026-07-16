# AgentBridge v3 协议规格(wire-level)— DRAFT v0.12.18

> **状态**:DRAFT v0.12.18(2026-07-16;主体会话 7 起草封版,v0.12.11=会话 8 交接审计冷读修正,v0.12.12=会话 8 Chunk 7 P2 回扫修复(5 处 deferred P2),v0.12.13=Codex r63 全文终审 REJECT(P0=0/P1×6/P2×7)全量修入,v0.12.14=r64 差分(P1×4+P2×5)全量修入,v0.12.15=r65 窄差分修入,v0.12.16=r66 修入,v0.12.17=r67 修入,v0.12.18=r68(H1 消双 schema+H2 逐分量 max)修入,**r69 全路 APPROVE=Chunk 7 CLOSED**;基线 v0.7.2 经用户 APPLY「落盘」写入本路径,**未 commit**,Git 写另待用户批)。分层状态:**Chunk 0+1(§1-§4+附录 GV+§16 的 4000-4029/既有 domain)已定稿(Codex 轮 8 全路 APPROVE)**;**Chunk 2(§5/§6+§16 的 4030/4031 与 IdempotencyScope 域)已定稿(Codex 轮 17 全路 APPROVE 封版;审计链=轮 9-17)**;**封版两章的全部 additive 增补(轮 18-25 P0 证据驱动;§1.3/§2.6/§3.2/§5.1/§5.2/§5.4/§5.6/§6.1)经 Codex 轮 25 逐项 CONFIRMED**;**Chunk 3(§7/§8/§9+§16 增量 4032-4058 与 10 domain)已定稿(Codex 轮 29 全路 APPROVE 封版,2026-07-15;审计链=轮 18-29 十二轮对抗,v0.9→v0.9.10)**;**Chunk 4(§10+§16 增量 4059 与 8 domain+§10.14 十五组 additive)已定稿(Codex 轮 41 全路 APPROVE 封版,2026-07-16;审计链=轮 31-41 十一轮对抗,v0.10→v0.10.10;封版审定字节 SHA=911d746569a7efacb70daae5d4ceaa8c94cadeb0c0ff63faccbc4efe49247f1b,本状态行同步为其后唯一元数据改动;轮 41 附 1 非阻塞 P2(open 自环 CAS 的 lastProbe fence)入 Chunk 7 待办)**;**Chunk 5(§11 push-completion+deny-only 审批记录/§12 人闸 effect wire+§16 增量 4060-4063 与 8 domain+§10.14 additive #16-#21)已定稿(Codex 轮 51 全路 APPROVE 封版,2026-07-16;审计链=轮 42-51 十轮对抗,v0.11→v0.11.9;封版审定字节 SHA=01a5faccf421ecd3b55a9cd2d5f56d9668104f0f1e6ea44ce8b20bb9c870b8d4,本状态行同步为其后唯一元数据改动)**;**Chunk 6(§13 signal-file/§14 Phase 0A 探测包 NOT RUN/§15 决策登记册+§16 增量 4064 与 4 domain+§10.14 additive #22-#26)已定稿(Codex 轮 62 全路 APPROVE 封版,2026-07-16;审计链=轮 52-62 十一轮对抗,v0.12→v0.12.10;封版审定字节 SHA=8e8f0cf725239e36d90b92cd99728e38f2cc32559ee59aef06a3ba256e5b431b)**;**§1-§16 全章起草封版完毕**;**Chunk 7 组装终审完成(CLOSED;Codex r69 全路 APPROVE,2026-07-16 会话 8——审计链=r63 全文红队→r64-r68 五轮差分→r69 终签,v0.12.12→v0.12.18;P2 回扫 15 项处置+冷读+累计 additive 合法性+四注册表闭包+GV 全程 d80341b0…;architecture 同步修订建议 A-1..A-9 已清单化待用户 APPLY)**。工作台账=`~/Desktop/agentbridge_v3_apply_2026-07/ledger.md`。
> **版本史**:v0.1(Chunk 0+1 初稿)→ v0.2(轮 2 P0×7/P1×8/P2×3 修入)→ v0.3(轮 3 新 P0×7 等修入+GV 实算)→ v0.4(轮 4 P0-A/B/C:统一 commitRegistration 事务、PoP 稳定 challenge 化、endpoint 代重放门)→ v0.4.1(轮 5 窄修:anti-TOCTOU 同事务重验、enrollment 双类密钥模型、ApprovalBootstrapHashInput 封闭、ApprovalProvisionBundle 交付、worker 进程内注册、GV canonical nonce 重算+GV-7)→ v0.4.2(轮 6:适用域三分/join 谓词/ID 必填)→ v0.4.3(轮 7:pairing.claim 专属集、enrollment 分层;**轮 8 Codex 全路 APPROVE,Chunk 0+1 定稿**)→ v0.5–v0.7(Chunk 2:§5 转移表+§6 任务面存储,轮 9-12 四轮红队迭代;详修订记录)。
> **作者**:Claude + Codex 多轮协作(2026-07-15 会话 5:用户授权全自动起草,Codex 任审核方,13 轮对抗;经用户 APPLY 落盘)。
> **上位文档**:`docs/v3-architecture.md`(DRAFT v0.9,SHA `4b4010942f…`,commit fec2285)。本文是其 §0-A 交付清单(.1–.10)+ HANDOFF §J.3-b carry-in 项的 wire 级实现规格。
> **冲突规则**:本文与 architecture 冲突时 **architecture 胜**,本文属缺陷必须修;architecture 的不变量变更必须先改 architecture 再改本文,禁止用本文"事实上推翻"上位不变量。
> **证据纪律**:引用现实现使用【代码】`file:line`(本机快照 2026-07-15,commit fec2285 基线);引用 architecture 使用 §编号。平台行为一律不得由本文发明——见规范状态标签体系(§1.2)。

---

## 1. 文档定位与规范体系

### 1.1 覆盖范围与章节映射(追溯表)

| 本文章节 | 覆盖 §0-A 项 / carry-in | 交付阶段对齐(architecture §16) |
|---|---|---|
| §2 传输与控制协议 framing | §0-A.1 | Phase 1A |
| §3 sessionAuth 原语 | §0-A.2 | Phase 1A |
| §4 身份、注册、配对与 generation | §0-A.10(身份子集)+ §0-A.5(Phase 1A 身份存储子集)+ carry-in「半升级/capability downgrade wire」 | Phase 1A |
| §5 phase 转移表 | §0-A.4 | Phase 1B |
| §6 存储 schema 映射(任务面) | §0-A.5(其余) | Phase 1B |
| §7 MCP 工具 schema(三面) | §0-A.3 + carry-in「Claim/Complete 专项 conformance schema」 | Phase 1B/3 |
| §8 retryClass tool-manifest | §0-A.7 | Phase 1B |
| §9 requestedContext 与 contextDigest | §0-A.8 | Phase 1B(v1 profile) |
| §10 预算/lineage/生命周期实体 | §0-A.10(全量)+ carry-in「多-agent provenance hash」 | Phase 1B(structural 子集)/后续 |
| §11 push-completion wire + deny-only 审批记录 | §0-A.9(push 部分) | Phase 1B |
| §12 人闸/effect wire(hard-disabled) | §0-A.9(人闸/效果部分) | G-5 gate(spec-complete,启用受闸) |
| §13 signal-file 格式 | §0-A.6 | Phase 0A(experimental probe envelope)→ Phase 1B |
| §14 Phase 0A 探测登记与 evidence schema | (③纸面准备包;与 .6/.8/.10 互校) | Phase 0A(NOT RUN) |
| §15 决策登记册(decision register) | 全文 USER-DECISION 汇总 | — |
| §16 typed error registry + canonical domain 注册表 | 横切 | — |

不在本文范围:G1–G5→字段/phase/gate 追溯矩阵(并行文档,HANDOFF §J.3-b 明示不属 §0-A);Console UI 规格;上游 RFC 文案(§18-Q1 治理件)。

### 1.2 规范状态标签

| 标签 | 含义 | 约束 |
|---|---|---|
| **[NORMATIVE]** | 纯设计即可定,立即生效的 wire 规范 | 实现必须遵守;改动=本文修订 |
| **[E2E-GATED→P0A-n]** | 依赖 Phase 0A 第 n 项探测事实(architecture §15) | 只给条件 profile / probe schema / fallback;**探测通过前禁止实现方当作已证事实**;探测失败=回改本文与 architecture |
| **[USER-DECISION→DS-n]** | 依赖用户产品/治理裁决(§15 决策登记册第 n 条) | 本文给选项+推荐+默认安全侧;定案前实现按"默认安全侧"或不实现 |
| **[G5-GATED]** | 规格完整可实现,但**启用**受 architecture §15 G-5 composite gate | 构建 hard-disabled;单开关原子启用;禁止部分启用 |
| **[UNSUPPORTED]** | 显式不支持(v1) | 实现必须返回 typed error,禁止静默降级 |

- 标签作用于**条目**(条/字段/子节),不作用于整章;一个小节内混合多标签时必须逐条目标注(禁止节标题一个标签盖全节)。
- 关键词:**必须**(MUST)/**禁止**(MUST NOT)/**应当**(SHOULD)/**可以**(MAY),按 RFC 2119 语义。
- 发布默认数值(如 TTL/上限)标 `[default,可 policy 收紧]`:属 [NORMATIVE] 的 policy 默认值,Phase 0A/运行数据可**校准**数值,不改变其规范地位(区别于 E2E-GATED:后者是"事实未知",前者是"值可调")。

### 1.3 wire 编码通则 [NORMATIVE]

- **字符集**:UTF-8 JSON;字段名 camelCase(architecture §5 已定)。
- **数值**:money/token/计数一律整数(禁浮点/NaN/Inf,architecture §6.6);任何安全承重字段出现非有限数 → 整条消息拒绝。
- **时间**:整数毫秒 UTC epoch,字段名以 `At` 结尾;duration 以 `Ms` 结尾。
- **ID**:实体 ID 为带前缀 ULID。**broker 铸造**:`inst_`/`ep_`/`rs_`/`conn_`/`task_`/`disp_`/`lease_`/`offer_`/`intent_`(**reserved-unused,r64 N6:Chunk 0+1 预注册;EffectIntent 实际=`efi_`(§12.3),无实体消费本前缀——保留注册防复用歧义**)/`perm_`(**reserved-unused,同上:EffectPermit 实际=`efp_`(§12.6)**)/`appr_`/`root_`/`wkr_`/`bind_`/`benv_`/`ba_`/`rsv_`/`bov_`/`pc_`/`fan_`/`actg_`/`act_`/`pai_`/`dbind_`(§10;Chunk 4 增补)/`efc_`/`efi_`/`apch_`/`apl_`/`hga_`/`efp_`/`efa_`/`wel_`(§12;Chunk 5 增补)/`room_`(§6.1 rooms;Chunk 6 增补)/`wtr_`(waiter_leases)/`caps_`(capability_snapshots)/`fal_`(fallback_allowlists)/`rms_`(retry_manifest_snapshots)(末四者 r63 P2-11·P1-4/v0.12.13:反向闭包补注册);**客户端铸造**(仅作幂等/关联键,不构成 authority):`regev_`(§2.5.1)、`creq_`/`cmpl_`(§7.3;Chunk 3 增补)、JSON-RPC request id。宿主原生 ID(Claude session_id、Codex threadId)只作属性,禁止充当 broker 实体主键。
- **digest 文本形**:`sha256:<64 hex 小写>`;算法前缀必带。
- **token 明文**:`<kind>1.<base64url(32B CSPRNG)>`(kind 注册表见 §3.2 分类表);**bearer/capability 类 token** broker 一律只存 SHA-256、常数时间比较;**cryptographic key 材料**(installationTokenSecret、attestation enrollment key)不适用 hash-only(须以可用形态保存于 Keychain/0600,另列轮换规则),二者分类见 §3.2。
- **长度与形状上限**:request id ≤ 64 字符;nonce 16–64 字节(base64url);string 字段默认 ≤ 4 KiB、数组默认 ≤ 64 元素(个别字段显式放宽);feature/capability 数组必须去重,重复即拒。
- **未知字段策略**:安全承重消息(register、task.submit、claim、claim_ack、complete_task、begin_apply_submission/fetch_submission/ack_submission(§7.1 wire-only 集)、审批/effect 全族)未知顶层字段 → 拒绝(`unknown_field`);纯信息型消息(status、event 通知)→ 忽略但审计计数。前向兼容走版本协商+protocol feature(§2.4),不走宽容解析。

### 1.4 AB-CANON-1 canonical 编码原语 [NORMATIVE]

供一切 digest/HMAC/签名复用:

- **输出**:`AB-CANON-1(domain, value) = SHA-256( utf8(domain) || 0x00 || JCS(value) )`,输出为 **raw 32 字节**;需要文本表示时用 §1.3 digest 文本形(`sha256:<hex>`),HMAC/签名输入一律用 raw 字节。
- **JCS**:RFC 8785 canonical JSON 的 UTF-8 字节序列,附加收紧:①数值必须为 JSON 安全整数;②重复 key 在 JCS 之前即拒;③字符串必须为合法 UTF-8(不做 NFC 归一,字节即真值)。
- **hash-input schema 与 wire schema 分离**:参与 hash 的对象是**构造值**(由定义节给出封闭字段表),不是 wire 消息本身。hash-input schema 的所有字段**必须全部出现**,可选字段取值 `null` 表示缺席——hash-input 层禁止"字段缺席"(从根上消除裁剪碰撞;wire 层 `null`≠缺席的规则不受影响,因为二者是不同 schema)。
- **嵌套 digest 编码**:hash-input 对象内引用另一 digest 时,一律取 §1.3 文本形(`sha256:<64 hex 小写>`)作为 JSON 字符串值;禁止 raw bytes/base64url 混用。
- **hash-input 字段名**:一律 ASCII(消除 JCS 的 UTF-16 code unit 排序与实现语言默认码点排序在非 BMP 键名上的差异面)。
- **golden vectors**:附录 GV 给出 WorkspaceFingerprint/Hello/RegisterBody/HandshakeProof 的字节级实算向量(本稿随附,脚本生成,禁止实现者猜);Unicode/整数边界扩展向量随 conformance fixtures 交付。
- domain 字符串注册表见 §16.3;**未在注册表登记的 domain 禁止使用**。

### 1.5 与现实现(legacy)的关系 [NORMATIVE]

- 现行控制协议(TCP WebSocket,`ControlClientMessage`/`ControlServerMessage`,无鉴权无握手【代码】src/control-protocol.ts:66-92)**整体保留为 legacy 通道**,受 P0-0 兼容基线护航(architecture §15);v3 控制协议使用**新的 UDS socket**,与 legacy 端口并存,互不复用连接。
- legacy 客户端永远到不了 v3 socket;v3 客户端不得向 legacy 端口发 v3 帧。**版本不匹配时的回退只允许回退 chat-plane(legacy ask_codex/reply/get_messages 既有语义);禁止把 v3 任务面/审批面操作"翻译"到 legacy 通道执行**(半升级只禁 RPC,architecture §14)。移除 legacy 须按 architecture §16 另立门禁。

---

## 2. 传输与控制协议 framing(§0-A.1)

### 2.1 传输

- [NORMATIVE] **socket**:Unix Domain Socket,路径 `$STATE_DIR/broker.sock`(STATE_DIR 解析规则同现实现【代码】src/state-dir.ts:15-28,含 `AGENTBRIDGE_STATE_DIR` override;检测并拒绝 network/同步文件系统,architecture §11)。socket 文件 mode 0600;父目录属主必须为当前 UID。
- [NORMATIVE] **对端校验**:accept 后立即取 peercred(macOS `LOCAL_PEERCRED`,Linux `SO_PEERCRED`);`uid ≠ broker uid` → 立即关闭并审计。对端 PID 记入审计。**实现注释义务(D-4)**:此检查及一切 token/0600 机制对 same-UID 攻击者不构成安全承诺(architecture §10.4),PEP/鉴权代码处必须原文声明。
- [UNSUPPORTED] loopback TCP 控制协议(macOS/Linux;防端口面扩大)。
- [USER-DECISION→DS-1] Windows 支持范围与时间点(传输 named pipe vs loopback + signal 路径语义 §13.1 + peer identity + 支持阶段;architecture §18-Q3;§15 登记);定案前 Windows 全不在支持矩阵。
- stale socket 清理:仅选主锁持有者可清(architecture §11),本文不重复其规则。

### 2.2 framing [NORMATIVE]

- **JSON-RPC 2.0 over NDJSON**:每行一条完整 JSON-RPC 消息,`\n` 分隔。**禁止 JSON-RPC batch(顶层数组一律拒并关闭连接)**——防 batch 绕过"第一条必须 hello"的握手状态机。
- **帧上限**:默认单帧 ≤ 1 MiB(握手可协商更小,禁协商更大);超限 → `frame_too_large` 并关闭连接。大载荷一律走 `payloadRef`/`artifactRef`(content-addressed,architecture §6.2),控制通道不传大字节。
- **request id**:字符串(≤64 字符),客户端生成,连接内唯一;推荐 ULID。响应必须回显。notification(无 id)仅限 §2.6 白名单;安全承重操作禁止用 notification。
- **并发模型(方法并发矩阵)**:architecture §6.3 的"单 RuntimeSession 单 in-flight"指**执行 turn/dispatch 槽**,不覆盖控制面。本协议分三个并发类:

| 并发类 | 方法(v1) | 规则 |
|---|---|---|
| dispatch-slot 类 | `task.claim`、`task.preview_request`(及后续执行面领取族) | per-RuntimeSession 串行;槽占用中再来 → `session_busy`(不排队) |
| control 类 | `task.renew_lease`、`task.complete`、`task.cancel`、`task.await_result`、suspension 动作提交、`task.lookup_by_idempotency_key`、`status`、pairing 族、heartbeat | 并发允许;对象级 CAS(expectedStateRevision 等)保证安全;**禁止**被 dispatch-slot 占用所阻塞 |
| submit 类 | `task.submit`(含 ask_* 糖) | per-caller 有界 pipeline:in-flight ≤ `maxInflightSubmits`(default 4,可 policy 收紧);超界 → `session_busy` |

锁序遵守 architecture §6.3(`session turn → workspace lease → external tool`);跨同步 RPC 不得持有可竞争资源。

### 2.3 握手序列 [NORMATIVE]

连接建立后第一条消息必须是 `hello`,顺序固定:`hello → register|resume → 操作期`。操作期之前发任何其它方法 → `handshake_required` 并关闭。

```text
C→B  request  hello {
       clientNonce: string(16–64B base64url),
       minProtocolVersion: int, maxProtocolVersion: int,     # v1 客户端 = {1, 1}
       surface: "claude-desktop"|"claude-cli"|"codex-desktop"|"codex-cli"|"worker"|"approval_system",
       hostVersion: string, pluginVersion: string,
       protocolFeatures: string[]                             # 仅 wire 语法模块;§2.4
     }
B→C  result   helloAck {
       protocolVersion: int,                                  # 交集内 broker 选定;无交集→error
       brokerVersion: string,
       installationId: "inst_…",                              # 稳定安装标识(原 brokerInstanceId,更名防误绑)
       brokerBootEpoch: int,                                  # broker 进程代;重启递增;仅对账用,禁止参与
                                                              #   RuntimeSession generation/ownerTuple 比较
       serverNonce: string(16–64B),
       negotiatedProtocolFeatures: string[],                  # ⊆ 双方支持交集;语法互通声明,不是授权(§2.4)
       limits: { maxFrameBytes: int, heartbeatIntervalMs: int, maxInflightSubmits: int }
     }
```

- 无共同版本 → `protocol_version_unsupported{supportedRange}`,连接关闭;客户端禁止换参数重试超过 1 次;回退规则见 §1.5(只回退 chat-plane)。
- broker 未就绪(storage/migration/writer 未 ready,architecture §11 readiness)→ `hello` 直接得 `broker_not_ready{retryAfterMs}`;DRAINING 中 → 仅允许 `resume` 且 `registrationSource=reconnect`(architecture §11「DRAINING 期间接受 reconnect」——只接续传输层,**不接受会滚代/改义务的语义注册**);新 `register` 或 `source ∈ {resume, clear, compact, manual}` → `broker_draining{retryAfterMs}`。
- `hello` 后 5s 内未完成 `register`/`resume` → `handshake_timeout` 关闭。同连接重复 `hello`/重复 `register` → `handshake_violation` 关闭。

### 2.4 protocol feature 与 capability 两层分离(carry-in「半升级」;I-5 机器化) [NORMATIVE]

**层 1:protocolFeatures(语法层,helloAck 协商)**——只声明"双方都会说这套报文",**不是授权**:
`task_core_v1`(任务面报文族)、`suspension_v1`(SuspensionReceipt 动作族)、`approval_holder_v1`(holder-only 动作族报文)、`wake_signal_v1`(signal-file 唤醒链报文/语义)、`host_turn_boundary_v1`(`auth.hostTurnClaim` 扩展,§4.10)、`legacy_chat_v1`(聊天面直通)。
feature 只增不改义:语义变更必须换新名(`_v2`),旧名保留或显式退役。

**层 2:effectiveCapabilities(授权层,registerAck 返回;调用时以 broker 当时判定为权威)**:

```text
effectiveCapability 判定公式(每能力独立求值):
  granted = declared(envelope.capabilities)
          ∩ implemented(negotiatedProtocolFeatures)
          ∩ evidencePassed(该能力关联的 Phase 0A/E2E gate 已过)
          ∩ policyAuthorized(broker policy;I-5:capabilityAvailable ≠ policyAuthorized)
          ∩ gateEnabled(该能力关联的 conformance gate/hard-disable 开关,如 G-5)
registerAck 携带:
  effectiveCapabilities: CapabilitySet(裁剪后),
  deniedCapabilities: [{capability, reason ∈ {not_declared, feature_missing, evidence_missing,
                        policy_denied, gate_disabled}, sinceProtocolVersion?}],
  policyEpoch: int
```

- **调用时权威 + 单一 authorizer**:registerAck 的快照仅供显示/诊断/审计,**不得作为授权依据**;`authorize(capability, rs, now)` 是唯一判定函数,**client 方法分发、scheduler/dispatch 候选筛选、dispatch CAS 事务内重验三处共用同一实现**(防 broker 主动派发绕过撤销:policyEpoch 变化后,即使 notification 丢失,下一次 dispatch CAS 内重验也会命中)。policy/gate/evidence 变化 → `policyEpoch` 递增 + notification `event.policyEpochChanged{policyEpoch}` + 受影响 rs_ 的 dispatch eligibility 在同事务重算;受影响调用返回 `capability_disabled{capability, reason}`。
- **capability→gate 映射表 [NORMATIVE]**(authorize 的静态输入;逐能力封闭枚举):

| capability | 需 protocolFeature | evidence gate | surface allowlist | hard gate |
|---|---|---|---|---|
| `canStartTurn`(执行面接单) | task_core_v1 | — | claude-*/codex-*/worker | — |
| `canReturnSynchronousResult` / `supportsCancellation` | task_core_v1 | — | 全部 | — |
| `canWakeIdle` | wake_signal_v1 | P0A-1(唤醒链) | claude-desktop/claude-cli | wake canary(§16 architecture) |
| `canInjectActiveConversation`(attached 注入) | task_core_v1+suspension_v1 | **[UNSUPPORTED] v1(轮 55:P0A-1 只证 wake、P0A-6 只证 nudge,均不证注入;专门 injection 探测未定义前该能力恒 false/unsupported,architecture §7 Codex Desktop attached 不支持 active-turn steer/live takeover;开放=补独立 probe+本文修订,§10.14#24)** | 见 architecture §7 姿态表 | 对应 adapter conformance gate |
| `inboundMode=manual_claim_current` | task_core_v1 | P0A-6 | codex-desktop/codex-cli | manual_claim gate(§15 architecture) |
| `inboundMode=armed_pull` | task_core_v1 | — | codex-* | armed_pull gate(§15 architecture) |
| `canPresentApproval`/`canAttestHumanGesture` | approval_holder_v1 | enrollment 完成(§4.8) | approval_system(且 provisioned) | **G-5** |
| `inboundMode=hook_wake` | wake_signal_v1 | P0A-1 | claude-desktop/claude-cli | 同 canWakeIdle 行 |
| `inboundMode=channel` | —(CLI Channels 增强,F11) | — | claude-cli | policy 默认 off |
| `inboundMode=pull`/`headless` | task_core_v1 | — | worker | —(worker 由 broker 预置) |
| `inboundMode=none` | — | — | 全部 | —(无入站,无需授权) |

  policy key 维度(installation policy 的允许/拒绝)对每行独立求值;**授权承载成员**未列出的组合恒 denied。**声明性成员**(当前即 `requiresForeground`)只是 scheduler 约束元数据,不授予任何能力、不参与 denied 判定;CapabilitySet 每个成员必须且只能归属两类之一,新增成员时同步归类。
- **deniedCapabilities 原因优先级(确定性)**:按求值序取第一个失败原因:`not_declared → feature_missing → evidence_missing → policy_denied → gate_disabled`(跨实现 ack/审计一致)。
- **降级语义**:任一端缺 `task_core_v1` → 双向任务 RPC 关闭(`capability_disabled`),`legacy_chat_v1` 仍可用(降级只禁 RPC,不断聊天面);Claude 侧 `canWakeIdle` 未 granted → 该 session 不进入 dispatch 候选(`pinned_target_unavailable` 语义,architecture §6.3),不静默改投他处。降级必须在 registerAck `deniedCapabilities[]` 显式返回并审计;**运行期新出现的降级**必须经 `policyEpochChanged` 通知,不允许静默。

### 2.5 register / resume / 注册幂等 [NORMATIVE]

```text
C→B  request  register {
       registrationEventId: "regev_<ulid>",       # 客户端生成;同一注册事件的重投递必须复用同 ID(§2.5.1)
       installationProof: HandshakeProof,          # §2.7;绑定完整握手 transcript
       envelope: RegistrationEnvelope,             # §4.2
       approvalBootstrap?: ApprovalBootstrap       # 仅 surface=approval_system;§4.8;参与 requestBodyDigest
     }
B→C  result   registerAck {
       endpointId: "ep_…", endpointGeneration: int,
       runtimeSessionRecordId: "rs_…",
       generation: int,                            # broker 权威(§4.4)
       assignmentState: "unassigned"|"bound"|"revoked",   # §4.9;bound 时附 bindingId/bindingEpoch
       binding?: { bindingId: "bind_…", bindingEpoch: int },
       connectionId: "conn_…", connectionEpoch: int,          # per-RuntimeSession 单调;§4.6
       connectionFencingToken: "fc1.…",
       sessionAuth: { token: "sa1.…", expiresAt: int },       # 每次 registerAck 都轮换铸新(§3.1)
       resumeToken: "rt1.…",                       # 单次消费,轮换(§4.5)
       deliveryRevision: int,                      # §2.5.1;客户端乱序 ack 采纳依据之一
       effectiveCapabilities, deniedCapabilities, policyEpoch,   # §2.4
       attentionPolicy: "interruptible"|"idle_only"|"manual_accept"|"do_not_disturb",
       limits(同 helloAck,可能按 session 收紧)
     }
C→B  request  resume {
       registrationEventId, installationProof,
       resumeToken: "rt1.…",
       envelope: RegistrationEnvelope
     }
B→C  result   registerAck(同上)
```

#### 2.5.1 注册幂等与重放(决策/投递分离) [NORMATIVE]

- **canonicalRequestDigest**(封闭 hash-input schema,§1.4 规则:全字段显式、缺席=null):

```text
RegisterBodyHashInput {
  requestKind: "register"|"resume",
  registrationEventId: string,
  resumeTokenHash: string|null,     # = sha256(resumeToken wire 字符串 UTF-8 字节) 文本形;register 时 null
  approvalBootstrap: object|null,   # = §4.8 ApprovalBootstrapHashInput 构造值
  envelope: RegistrationEnvelope 全字段(generationHint/transcriptPath 缺席=null)
}
canonicalRequestDigest = AB-CANON-1("AgentBridge/RegisterBody/v1", RegisterBodyHashInput)
```

  该 digest 同时就是 HandshakeProof 的 `requestBodyDigest`(§2.7)——覆盖 requestKind、envelope、resumeToken、bootstrap 分支全部语义(重放匹配与 MAC 绑定共用同一 digest)。
- broker 持久记录拆两层:
  - **RegistrationDecision(不可变;唯一允许的后写字段=`supersededAt` 墓碑标记)**:`{registrationEventId, canonicalRequestDigest, requestKind, runtimeSessionRecordId, resultGeneration, resultEndpointGeneration, provisionRevision?, supersededAt?, decidedAt}`——身份/generation 决策本体。**assignment 不入 Decision**(配对状态由当前权威 binding 派生,重放时按当下值返回,防与 pairing.claim/revoke 漂移);
  - **CredentialDelivery(可变)**:`{registrationEventId, deliveryRevision, latestConnectionEpoch, lastDeliveredAt}`——凭据投递状态。
- **commitRegistration 统一事务 [NORMATIVE]**(register/resume/redelivery 共用唯一入口;整体单 SQLite 事务,不存在子步骤间 crash 窗口):

```text
commitRegistration:
  **按序执行(r64 N1+r65 N1'/v0.12.15:以下行序=可执行顺序,主体非注释——冷读实现照序落码)**:
  ① HandshakeProof 先验(失败=统一 4007,不得让未认证请求观察 Decision/token/bootstrap 任何在性——eventId oracle 面=零);
  ② RegistrationDecision lookup(按 registrationEventId):异 digest→4009 registration_conflict;
     同 digest 但重放四门(下方「重放判定」2)任一败→4026 registration_event_superseded;
     同 digest 且四门全过→credential redelivery——**不读取、不消费、不重验任何 token/bootstrap 行与 PoP**
     (consumed resumeToken 行已 GC 亦成立(§4.5);bc/PoP 归属由 Decision 的 canonicalRequestDigest 承载
     ——该 digest 即 HandshakeProof requestBodyDigest,覆盖 bootstrap 分支全部语义(本节上方);
     r65 N1':删 bc-row revalidation 双规范,redelivery 恒 Decision-only);
  ③ Decision miss → validate+consume resumeToken 或 approvalBootstrap(§4.8;首次消费即原子写归属列,此后该列仅审计)
  → resolve/get-or-create 身份(rs_ 的 active logicalSessionKeyHash 唯一约束,§4.11)
  → insert RegistrationDecision(重放路径跳过,复用原 Decision)
  → CAS rs_.latestRegistrationEventId + generation 判定(§4.4;必要时内联 retireGeneration 级联)
  → currentConnectionEpoch+1 + 旧 Connection close-intent + 旧 fc/sa/rt/WaiterLease 撤销
  → insert Connection(绑定快照)+ 新 fc/sa/rt hash
  → upsert CredentialDelivery(deliveryRevision+1)
  → commit;之后组装 registerAck(assignmentState 取当前权威 binding)并 best-effort 通知旧 socket
```

- **重放判定**(同 `registrationEventId` 到达,在 commitRegistration 入口分流):
  1. `canonicalRequestDigest` 不同 → `registration_conflict` 拒(不碰任何现有凭据);
  2. digest 相同,且**全部**成立:该 event 是该 rs_ 的 `latestRegistrationEventId`、`resultGeneration == 当前 generation`、`resultEndpointGeneration == Endpoint.currentGeneration`、(有 provisionRevision 时)与当前预置记录一致、rs_ lifecycle ≠ OFFLINE → **credential redelivery**(走 commitRegistration 的 takeover 腿:epoch+1、撤旧铸新、`deliveryRevision+1`,**复用原 Decision,绝不重做 generation 判定**);
  3. 任一不成立(更新的注册决策 / endpoint 代已退役 / 会话已 tombstone)→ `registration_event_superseded` 拒,**不得撤销/补发任何当前凭据**(防旧事件击落新代/穿透 re-provision)。
- **客户端义务**:同一次宿主注册事件的传输层重试必须复用同 `registrationEventId`(换新宿主事件必须换新 ID);同一时刻至多一个未决注册请求;多个 ack 乱序到达时**只采纳 `(connectionEpoch, deliveryRevision)` 最高者**;收到 `registration_event_superseded` 后禁止再重试该 event。
- **并发**:同一 rs_ 的注册/重放请求经单 writer 串行化(architecture §11),不存在两个 replay 同时赢。
- register 逻辑幂等键 = `{installationId, surface, hostNativeSessionId, workspaceFingerprint.digest}`,持久化为 `logicalSessionKeyHash = AB-CANON-1("AgentBridge/LogicalSessionKey/v1", 四字段)`,active 行部分唯一约束(§4.11;禁止重复 rs_)。
- **retention(GC)**:每 rs_ 的 `latestRegistrationEventId` 决策记录常驻;更早决策保留 30d [default] 后 GC。GC 后的远古 event 重放会被当作新注册事件(保守侧:按 §4.4 滚代,只作废旧凭据),如实声明。
- 注册请求 body 中出现任何 origin/principal/approval/lineage 类字段 → 整条拒绝(`forbidden_field`;architecture §6.2 禁填集)。

### 2.6 操作期通则 [NORMATIVE]

- 操作期每条 request 的 `params.auth = { connectionFencingToken, sessionAuth }`(approval_system 另加 §4.8 要求;broker 内部 push adapter 走进程内接口不经 wire,§11)。
- **复合校验(每请求,常数时间,fail-fast)**:
  1. 本 socket 的 Connection 记录存在、`revokedAt IS NULL`、`connectionEpoch == 该 RuntimeSession.currentConnectionEpoch`(旧 epoch 一律拒,`connection_superseded`);
  2. `Connection.endpointGeneration == Endpoint.currentGeneration`(不符 → `endpoint_generation_stale`;§4.8 retireEndpointGeneration 配套的**当前态**检查,不止比快照);
  3. `connectionFencingToken` hash 命中且其绑定元组 `{connectionId, connectionEpoch, endpointId, endpointGeneration, runtimeSessionRecordId, generation, brokerBootEpoch}` 与本 socket 的 Connection **绑定快照全量相等**(快照列见 §4.1);
  4. `sessionAuth` 按 §3.3 校验,且其绑定 `{endpointId, endpointGeneration, runtimeSessionRecordId, generation, connectionEpoch}` 与该 Connection 绑定快照**全量相等**(禁止跨 session 拼接:B 连接的 fc + A 会话的 sa 必拒);
  5. 方法级授权(§2.4 单一 authorizer:surface × assignmentState × capability × policy/gate,§4.9);
  6. 对象级 CAS(expectedStateRevision / token 绑定)。
  任一层失败后层不执行;公开错误码见 §16.2(`auth_invalid` 统一,例外见该节)。
- **同事务重验(anti-TOCTOU)[NORMATIVE]**:任何持久状态变更的 mutation 必须与其**适用 authority 集**的重验在**同一 writer 事务**内紧邻执行(先验后写,单线性化点);任一重验失败 → 事务零写入。事务外/连接层的前置校验只是 fail-fast 优化,**不具权威**——防"校验通过后、提交前,admin 撤销(retireEndpointGeneration/pairing.revoke/policy 变更)已生效"的旧 authority 写入竞态。**适用 authority 集按入口分三类(各自封闭,不得混用)**:
  1. **外部操作期 mutator**(携 `auth` 的已注册会话方法):重验上述 1–6 全套 + owner tuple + policyEpoch/capability + **方法专属 authority set** + 对象 CAS;**仅 bound-required 方法**(任务面/路由面)重验 active binding/bindingEpoch。`pairing.claim` 的方法专属集 = caller 当前身份 + `assignmentState ∈ {unassigned, bound, revoked}` + pairing code 有效性 + issuer 当前身份 + 双侧 evidence + binding 唯一约束 CAS——**不要求 caller 已有 binding**(它正是首次配对/撤销后重配的入口);
  2. **握手期 mutator**(`commitRegistration`:register/resume/redelivery):此时 Connection/fc/sa 尚不存在,重验集 = §2.5.1/§4.8 定义的封闭前置,**按 §2.5.1 三段分支 tagged(r66 F1/v0.12.16:消除与 §2.5.1「Decision-hit 不读 token/bootstrap 行」的合集式双规范)**——common:installationProof(HandshakeProof);Decision-hit(redelivery):canonical digest+重放四门,**禁止读取/消费/重验 token、bootstrap 行与 PoP**;Decision-miss resume:校验并消费 resumeToken;Decision-miss approval:校验/消费 bootstrap+预置记录/enrollment/PoP CAS;普通 register:无 token/bootstrap 前置;各 miss 分支之后才应用 logicalSessionKey 唯一约束与身份写集;
  3. **admin/broker 内部 mutator**(`retire*`、provision、`pairing.issue/revoke`、进程内 push adapter):重验各自定义节的封闭 authority(admin plane peercred 通道;push 走 PushCompletionHandle 完整 tuple,architecture §6.2/§6.4)+ 对象 CAS。
  scheduler/dispatch CAS 属第 1/3 类之并,事务内重验完整集合(§2.4)。
- **notification 白名单**(broker→client,无 id):`event.taskChanged{taskId, stateRevision, verificationRevision}`(verificationRevision 为 Chunk 3 additive 增补——F15 观察闭环,不改既有字段语义)、`event.policyEpochChanged{policyEpoch}`、`event.approvalWorkChanged{}`(Chunk 3 增补;仅信号零内容,holder 面 §7.6)、`event.shutdown{graceMs, reason, drainGeneration}`、`event.heartbeat`。客户端→broker 唯一 notification:`event.heartbeatAck`。其余一律 request/response。
- 心跳:`limits.heartbeatIntervalMs`(default 30 000)无流量时 broker 发 `event.heartbeat`;连续 3 周期无 ack → 连接判死,走 §4.6。

### 2.7 HandshakeProof(installation 证明) [NORMATIVE]

- **密钥**:`installationTokenSecret`(≥32B 随机)+ `keyId`;存储 = macOS Keychain,fallback `$STATE_DIR/installation-token`(0600,内容 `{keyId, secret, previousKeyId?, previousSecret?, rotatedAt?}`)。首次由 broker 生成;客户端读本机存储,不经网络分发。**轮换**:broker 原子写入 `{new current, previous=旧}` 双钥窗口(default 24h,窗口内两钥皆可验,窗口后 previous 作废);proof 携带 `keyId`,未知 keyId → 拒。
- **结构**:

```text
HandshakeProof {
  keyId: string,
  mac: base64url(HMAC-SHA256(secret[keyId], AB-CANON-1raw("AgentBridge/HandshakeProof/v1", {
    requestKind: "register"|"resume",
    clientHelloDigest,        # = AB-CANON-1("AgentBridge/Hello/v1", hello 全 params);
                              #   本结构内一切 digest 字段取 §1.3 文本形字符串(§1.4 嵌套规则)
    helloAckDigest,           # = AB-CANON-1("AgentBridge/HelloAck/v1", helloAck 全 result)
    requestBodyDigest,        # = canonicalRequestDigest(§2.5.1;token 明文字段以 sha256 文本形替换)
    resumeTokenHash: string|null    # resume 时 = sha256(resumeToken) 文本形;register 时 null(冗余显式绑定)
  })))
}
```

(`AB-CANON-1raw` = 取 raw 32 字节输出作 HMAC 消息。)

- 绑定完整握手 transcript ⇒ 版本/feature 剥离、envelope 篡改、跨连接重放、register/resume 混淆全部失效。`hello.surface` 与 `envelope.surface` **必须相等**(不等 → `surface_mismatch` 拒)。
- 校验失败 → `installation_proof_invalid`,连接关闭,审计(含 peercred PID)。
- 该机制防的是:secret 明文上 wire/日志、stale 客户端误连、握手篡改混淆。**不防 same-UID 攻击者**(能读 0600 文件;architecture §10.4 out-of-scope,如实声明)。

### 2.8 broker 生命周期的 wire 呈现(DR-6 对齐) [NORMATIVE]

- **readiness**:`liveness+storageReady+writerAlive+migrationReady`(architecture §11)未满足 → 见 §2.3(`broker_not_ready`)。
- **DRAINING**:仅接受 `resume + registrationSource=reconnect`(与 §2.3 同一规则,不重复放宽);其余注册 → `broker_draining`;向存量连接广播 `event.shutdown{graceMs, reason:"drain", drainGeneration}`;grace 到期仍未断的连接由 broker 关闭。新候选 broker 见 live drain generation 只等待(architecture §11)。
- **三级停机**(`disconnect-self / drain-and-restart / force-stop-installation`,architecture DR-6):属**本机 admin plane**(CLI 经 UDS 管理接口,peercred 同 UID + admin 确认),**不投影为模型可见 MCP 工具**;wire 上只观察到相应 `event.shutdown{reason}` 与连接关闭。admin plane 的完整规格随 Console/治理块交付,本文只锁"不入模型工具面"这一不变量。
- **storage 降级(r64 N7/v0.12.14:4029 此前仅注册未接线)**:readiness 达成**之后**发生的持久层降级(SQLITE_FULL/磁盘 read-only/WAL 不可写等)→ mutation 类请求统一 4029 `storage_degraded`(retryable=true,retryAfterMs;只读查询按可服务性尽力),同时进入 DR-6 保守停机评估;**优先级**:readiness 未达成恒 4023 `broker_not_ready`(4029 仅 post-readiness),两码不并发。
- **crash-only**:fatal 异常停 accept、非零退出(architecture §11);客户端视角=连接断+重连遇 `broker_not_ready`/新 `brokerBootEpoch`。

---

## 3. sessionAuth 原语(§0-A.2)

### 3.1 铸造与轮换 [NORMATIVE]

- 铸造者:**仅 broker**;时机 = **每次 registerAck**(register / resume / reconnect-resume 成功后同一事务):铸新 token + 原子撤销该 RuntimeSession 此前的 sessionAuth。**不存在"复用旧 sessionAuth"的路径**(broker 只存 hash,无法回显旧明文;每 ack 必轮换)。
- 表示:`sa1.<base64url(32B CSPRNG)>`;持久层只存 `sha256(token)` + 绑定元组;明文仅在 registerAck 出现一次,禁止进日志/DB/signal-file/transcript/MCP payload。
- 绑定元组:`{installationId, endpointId, endpointGeneration, runtimeSessionRecordId, generation, connectionEpoch, mintedAt, expiresAt}`。
- 过期:`expiresAt = mintedAt + 24h [default,可 policy 收紧]`;**续期仅在 durable commit 后生效**——broker 在处理成功的已认证调用时,若持久 `expiresAt - now < 12h` 则在同事务把 `expiresAt` 推进到 `now+24h`(阈值写降低写放大;**拒绝判定只看持久值**,不存在"内存已续期但持久未写"的中间态)。绝对上限:自 mintedAt 起 7 天,到期必须重新 register/resume。

### 3.2 token 与凭据分类总表 [NORMATIVE]

四类(存储/传输纪律按类,不按个例):

**A. serialized bearer capability(hash-only 存储,明文单次下发,wire 携带)**

| token | 认证对象 | 绑定元组(核心) | 生命周期 | 定义节 |
|---|---|---|---|---|
| `connectionFencingToken fc1.` | 单条 socket 连接 | conn/epoch/ep/epGen/rs/gen/bootEpoch | 连接存续;supersede 即废 | §2.6 |
| `sessionAuth sa1.` | RuntimeSession 当前注册代 | inst/ep/**epGen**/rs/gen/connEpoch | 24h 滑动/7d 硬顶/轮换即废 | §3 |
| `resumeToken rt1.` | 会话重绑资格 | rs/铸造时 gen | 单次消费;每 ack 轮换;7d | §4.5 |
| `pairingCode pc1.` | 一次性配对授权 | inst/workspace/**issuer rs_**/nonce(claim 时另验双侧 evidence,§4.9) | 短 TTL(10min default)单次 | §4.9 |
| `bootstrapCapability bc1.` | provisioned 端点开通 | inst/endpointId/**expectedEpGen/provisionRevision**/enrollment keyId | 单次消费,admin 签发 | §4.8 |
| `claimToken ct1.` | 单个 ClaimOffer | offer+candidateOwner 四层 | offer TTL,单次 | §7.3 |
| `completionToken cpt1.` | 单个 ExecutionLease 结单权 | task/disp/lease/leaseEpoch/attempt/ownerTuple | **仅允许一次状态转换**;完全相同 `completionOperationDigest` 的重放返回旧 receipt,异 digest → conflict(architecture §6.4) | §7.3 |
| SuspensionReceipt `nextActions[].token` `sact1.`(r63 P2-10/v0.12.13:kind 补注册——§1.3 token 通则要求 `<kind>1.` 前缀而本行此前无 kind;§7.4 铸造同步) | 单动作 capability | origin principal/session/stateRevision/action(architecture §6.3) | mutating 一次性;`await_result` 轮换续用;非终态响应轮换 | §7.4 |
| holder-only:`submit_approval` / `submit_budget_override` / `submit_verification` token `hact1.`(Chunk 3 增补第三类;r63 P2-10/v0.12.13:kind 补注册,§7.6 claim_approval 铸造同步) | 仅 approval_system holder | approval endpoint/generation/principal/(opHash \| root+dimension+currentCap+proposedNewCap+**budgetRevision**+policyEpoch \| taskId+verificationRevision)元组(architecture §10.1/§6.6;§7.6) | 经 `claim_approval` 才铸;一次性 | §7.6/§12 |
| continuation capability `cn1.` | 异步恢复资格 | 原 callerTaskId/rootAdmissionId(architecture §6.6) | broker 签发,绑 lineage;**v1 铸造入口 UNSUPPORTED**(§10.3) | §10.3 |

**B. broker 进程内不可序列化 handle(永不上 wire/DB/日志)**:`PushCompletionHandle`(内含明文 completionToken;仅 broker 进程内 adapter 持有,crash 后不重发、不由 hash 还原——architecture §6.2;§11 详)。

**C. sealed/签名授权记录(持久实体,非 bearer)**:sealed `EffectPermit`(绑 approvalId/opHash/attempt/toolUseId,不可委托/转移;§12)、`ActivationGrant`、`DedicatedBinding`、`WorkspaceBinding`(§4.9)——凭"记录+CAS 消费"生效,不凭出示明文。

**D. cryptographic key 材料(Keychain/0600,带 keyId 轮换,永不 hash-only)**:`installationTokenSecret`(§2.7)、attestation enrollment 私钥(§12;`keyId→principal` enrollment 绑定)。

- 语义分工:fc 回答"这条 socket 是该会话当前唯一连接";sa 回答"调用方是该注册代的会话本体";对象 token(A 类下半)回答"对这个对象持此单一权能"。执行面调用三层齐验(architecture §6.2)。
- **同名消歧**(architecture §6.2 明示):`resumeToken`(会话重绑)≠ SuspensionReceipt 的 `nextActions[].token`(挂起动作);wire 字段名不同,禁互换。

### 3.3 校验规则 [NORMATIVE]

携带 `auth.sessionAuth` 的请求,broker 依次校验:
1. `sha256(token)` 查表:命中 active 行 → 续;命中 **revoked tombstone**(行保留 ≥ `sessionLingerMs`,含 `revokeReason`)→ `revokeReason=generation_rolled` 时返回公开码 `generation_stale`(驱动客户端 re-register;可达性由 tombstone 保证),其余 reason → `auth_invalid`;未命中 → `auth_invalid`;
2. 绑定 `{endpointId, endpointGeneration, runtimeSessionRecordId, generation, connectionEpoch}` 与本 socket Connection 绑定快照全量相等(§2.6-4);
3. 绑定 generation == 该 RuntimeSession 当前 generation(理论上已被 1/2 覆盖;保留为防御性重申——architecture §5);
4. `now < 持久 expiresAt`。
失败公开码:统一 `auth_invalid`,**唯一例外** `generation_stale`(泄露论证见 §16.2);审计侧区分全部子码 `{not_found, revoked, tuple_mismatch, generation_stale, expired}`。

### 3.4 撤销 [NORMATIVE]

原子撤销触发:registerAck 轮换(§3.1)、`retireGeneration`(§4.4,含 generation 滚动/会话僵死回收/linger 到期)、endpoint 注销、`disconnect-self`/`force-stop-installation`(DR-6)。撤销后到达的调用按 §3.3-1 拒。broker 重启:sessionAuth **行不被批量删除**(身份/审计连续性),但**不可再授权**——旧行绑定旧 `connectionEpoch`,启动恢复事务(§4.6)已把全部旧连接标 crash-closed,新连接必经 resume(source=reconnect)或同 event redelivery(§2.5.1)→ §3.1 轮换铸新。「重启不整体失效」仅指记录连续性,**不**指旧 token 在新 boot 可继续使用(WaiterLease 则一律失效,architecture §6.3)。

---

## 4. 身份、注册、配对与 generation(§0-A.10 身份子集 + §0-A.5 Phase 1A 存储子集)

### 4.1 实体与 ID [NORMATIVE]

```text
Installation   inst_<ulid>  本机安装;密钥见 §2.7
Endpoint       ep_<ulid>    {installationId, surface, currentGeneration: int, provisioned: bool(§4.8),
                             provider: "anthropic"|"openai"|null, region: string|null, regionRevision: int(Chunk 6
                               v0.12.6-v0.12.8,轮 59 P1-F:provider=claude-*→anthropic/codex-*→openai;region=
                               broker 权威账户 binding 地区(writer 仅 admin/provisioning plane,policy_control 类);
                               region 变更 admin CAS 推进 regionRevision;direct 治理权威源,§5.1 fence),
                             status: "active"|"revoked", createdAt, lastSeenAt}
RuntimeSession rs_<ulid>    {endpointId, hostNativeSessionId, generation, currentConnectionEpoch,
                             latestRegistrationEventId,
                             connectivity: "connected"|"disconnected",     # 正交属性,非生命周期态
                             lifecycle: "DISCOVERED"|"ATTACHED"|"READY"|"BUSY"|"DRAINING"|"OFFLINE",
                                                  # architecture §5 状态机;OFFLINE 为终态 tombstone
                             assignmentState: "unassigned"|"bound"|"revoked",   # §4.9
                             boundBindingRef?: {bindingId, bindingEpoch},       # §4.9;授权时重验 active
                             identityEvidenceRef?,                              # §4.9 SessionIdentityEvidence
                             workspaceFingerprint, billingClass{declared,verified?},
                             accountClass{declared,verified?}, approvalMode,
                             capabilities(declared), grantedCapabilities(审计快照,非授权依据),
                             policyEpoch, attentionPolicy, registeredAt, lastSeenAt}
Connection     conn_<ulid>  {runtimeSessionRecordId, connectionEpoch,
                             绑定快照(不可变): {endpointId, endpointGeneration, generation,
                                               brokerBootEpoch, fencingTokenHash},
                             peerPid(审计), connectedAt, closedAt?, closeReason?, revokedAt?}
BrokerState    (单行)       {installationId, brokerBootEpoch: int(持久单调), drainGeneration?,
                             schemaVersion, lastBootAt, lastRecoveryAt}
SessionIdentityEvidence     {runtimeSessionRecordId, status: "verified"|"unverified",
                             sourceProfileId, profileVersion, observedHandleDigest, verifiedAt}
                             # broker-owned;客户端无法填写;来源 profile 见 §4.9
```

- **Endpoint 解析规则**:宿主 surface(claude-desktop/claude-cli/codex-desktop/codex-cli)= **get-or-create 单例** per `{installationId, surface}`(部分唯一索引强制);`approval_system` = 仅预置记录可注册(§4.8);**`worker` 不走外部 wire 注册**——worker 的 endpoint/rs_ 由 broker 进程内 adapter 在 spawn 事务中直接创建,身份绑 `{supervisorPid, childPid, pidStartTime, launchNonce}`(architecture §9.2 worker 生命周期记录),外部 wire 上 `surface=worker` 一律 `endpoint_not_provisioned`。
- **RuntimeSession lifecycle 合法转移(封闭表)**:`DISCOVERED→ATTACHED`(register 完成)、`ATTACHED→READY`(bound+connected+capability granted)、`READY⇄BUSY`(dispatch 槽占用/释放)、`READY|BUSY→ATTACHED`(binding/capability 撤销后的退出边)、`ATTACHED|READY|BUSY→DRAINING`(**仅终局收尾**:linger 到期处理/endpoint revoked/优雅停)、`DRAINING→OFFLINE`(终态 tombstone)。**generation 滚动不改变 lifecycle**(同一 rs_ 滚代后保持原态;旧代义务经 §4.4 overlapRiskSet 单独追踪,dispatch eligibility 是独立谓词,不借道 DRAINING——防"滚代即 DRAINING→只能走 OFFLINE"的死端)。DB CHECK 依此封闭表(非法转移=约束违例)。**OFFLINE tombstone 再命中**:新注册命中 OFFLINE 记录的逻辑幂等键 → 新建 rs_ 记录(tombstone 保留;resumeToken 链不跨 tombstone)。
- `connectivity` 与 `lifecycle` 正交:`disconnected` ≠ OFFLINE;`disconnected` 期间 lifecycle 保持但 dispatch eligibility=false;linger 到期才 OFFLINE(§4.6)。此为对 architecture §5 生命周期的**正交扩充**(不改其状态机;若 architecture 后续吸收本字段,以 architecture 为准)。
- `hostNativeSessionId`:宿主原生 ID,属性非主键;其**可信度由 SessionIdentityEvidence 承载**(§4.9),自报非空≠可信。同一宿主 session 因 resume 改变原生 ID 时以 resumeToken 链继承 rs_ 记录(原生 ID 行为属 [E2E-GATED→P0A-1] 观测项,wire 已预留继承路径)。
- `roomId`:v1 = 每 installation 一个**隐式 default room**(wire 无字段,实体预留列);multi-room 属 Phase 5(architecture §16),届时另行修订。`workspaceFingerprint`/`roomId` 只做匹配与授权(architecture §5)。

### 4.2 RegistrationEnvelope wire 定义 [NORMATIVE]

```text
RegistrationEnvelope {
  surface: enum(§2.3 六值;必须 == hello.surface),
  hostVersion: string, pluginVersion: string,
  hostNativeSessionId: string,                 # 必填(外部 approval_system 提供自身稳定实例 ID,
                                               #   如 GV-7 的 "approval-agent-1";worker 不走外部 wire,
                                               #   无缺席例外——logicalSessionKey/hash-input 无分叉)
  generationHint?: int,                        # 自报仅审计;权威见 §4.4
  registrationSource: "session_start"|"resume"|"clear"|"compact"|"manual"|"reconnect",
  workspaceFingerprint: WorkspaceFingerprint,  # §4.3
  capabilities: CapabilitySet,                 # §4.7
  billingClass: "subscription"|"api"|"unknown",
  accountClass: "consumer"|"business"|"unknown",
  approvalMode: "default"|"acceptEdits"|"bypassPermissions"|"dontAsk"|"unknown",
  transcriptPath?: string                      # 仅 Claude surfaces;watchPaths 推导用,broker 不读内容
}
```

- [E2E-GATED→P0A-1] **registrationSource 的宿主映射**:哪个宿主 hook 事件(SessionStart source=startup/resume/clear/compact 等)产生哪个 `registrationSource` 值、同一 live session 是否会重复产生 `session_start`、coalescing 行为——属 adapter profile,Phase 0A.1 探测后冻结。**broker 侧对各 source 值的处理规则(§4.4)本身是 [NORMATIVE]**(探测只改 adapter 怎么填,不改 broker 怎么判)。
- `billingClass/accountClass` 为自报+broker 证据分级双值(`{declared, verified?}`);verified 缺失按 `unknown` 参与预算/数据治理判定(architecture §10.2 fail-closed 接线)。自报≠授权。
- `approvalMode ∈ {bypassPermissions, dontAsk}` ⇒ broker 对该 session 强制 `preview_only`(architecture §10.1 末条)。

### 4.3 WorkspaceFingerprint [NORMATIVE]

```text
WorkspaceFingerprint {
  cwdCanonical: string,                # realpath;插件 shim 计算(宿主侧自报)
  vcsCommonDirCanonical: string|null,  # git rev-parse --git-common-dir 的 realpath
  worktreeName: string|null,
  digest: "sha256:…"   # = AB-CANON-1("AgentBridge/WorkspaceFingerprint/v1",
}                      #   {cwdCanonical, vcsCommonDirCanonical, worktreeName})——hash-input 全字段显式(§1.4)
```

- broker 重算 digest 并比对,不符 → `workspace_fingerprint_mismatch`。
- **信任边界(如实声明)**:fingerprint 是**自报值**,只用于匹配/路由/binding 键,**不证明**进程真在该 workspace 工作;不参与 §12 EffectContext 的同名字段语义(那由 broker 在 claim/dispatch 事务另行建立)。

### 4.4 generation 判定与 retireGeneration(权威在 broker) [NORMATIVE]

- generation 为 per-RuntimeSession 单调整数,broker 铸造;`generationHint` 仅审计。
- **滚动判定**(输入=经认证连接提交的 `registrationSource`;宿主映射见 §4.2 的 E2E 标注):

| registrationSource | generation 行为 | 依据 |
|---|---|---|
| `resume` / `clear` / `compact` | +1(retireGeneration 级联) | architecture §5 |
| `reconnect`(纯 socket 断重连) | 不变;走 §4.6 connection supersede(fencing/sa 轮换) | |
| `session_start` 命中存量 live rs_(不同 registrationEventId) | +1(保守:视为宿主重启;滚动只作废旧凭据不产生权限)。**同 registrationEventId 重放不滚**(§2.5.1) | 保守侧 |
| `session_start` 无存量 | 新建 rs_,generation=1 | |
| `manual` | 按存量判定;歧义时 +1(保守侧) | |

- **retireGeneration(rs_, oldG, retirementReason) 原子事务(级联矩阵)**——generation 滚动、会话僵死回收、linger 到期(§4.6)、endpoint 注销共用;`retirementReason ∈ {generation_rolled, session_retired, linger_expired, endpoint_revoked}`(封闭枚举);进 reconciling 的记录统一 `reconciliationReason=owner_identity_retired` 并携带 `retirementReason`(architecture §6.1 的开放枚举合法扩展,§5 章注册):

| 对象(绑 oldG) | 动作 | 说明 |
|---|---|---|
| sessionAuth / connectionFencingToken | revoke(tombstone 保留 ≥ lingerMs,含 revokeReason,§3.3-1 可达性) | 同事务 |
| resumeToken(铸于 oldG) | revoke(滚动路径同时铸新代新 token) | |
| ClaimOffer(candidateOwner 含 oldG) | revoke(offer tombstone) | architecture §6.2 |
| **overlapRiskSet** = {**status=active** 的 ExecutionLease, 未证明已停止的非终态 DispatchAttempt, executing EffectAttempt}(**按 risk object 判定,phase 名不豁免**:waiting_* Task 若仍挂 active lease/executing effect,该 risk object 照常入集;**lease.status=pending_ack 不入集**——执行权从未激活,该 lease 走 §5.2 T6b 收口,不进 reconciling) | active lease/未证停止 attempt → **立即** `reconciling(owner_identity_retired)`,不等 TTL;**executing EffectAttempt → 先走 architecture §10.1 settle/drain 赢家(consume 先赢不撤销),事实不明才 reconciling**——事务内只写 drain/reconcile **intent 与转态,不等待外部 settle**(SQLite 事务不含外部 I/O);同一 Task 多个 risk object 只做一次 stateRevision CAS | architecture §6.1/§10.1(禁止把 lease 静默转给新代;consume 先赢的 effect 不得伪装可撤销) |
| WaiterLease(connectionEpoch 属 oldG 连接) | 原子删除 | architecture §6.3 |
| SuspensionReceipt 动作 token(绑 oldG session) | revoke;**Task 的 waiting_* 状态不变、不入 overlapRiskSet**,新代经授权 `lookup_by_idempotency_key`/`await_result` 重建通道 | architecture §6.3 |
| pending ApprovalChallenge(目标 executor 属 oldG) | **同一 CAS**:challenge cancel + holder presentation 撤回 + 关联 Task 按 §6.1 决策表转态(executing permit 走 settle/reconcile 赢家,不撤销) | architecture §10.1「审批挂起中 executor 丢失 → challenge cancelled」 |
| scheduler eligibility | **新代在 oldG 的 overlapRiskSet 清空前不进入 dispatch 候选**(候选资格另受 §7.3 session 级 poisoned slot guard 约束——Chunk 3 增补交叉引用);`queued/waiting_input/waiting_callback` 等非重叠义务**不阻塞**新代(防活性冻结:一个合法 suspension 不得永久冻结 session)。释放条件=旧 turn 证明已停止 / 相关 attempt terminal / reconciliation 落 terminal unknown | architecture §6.1「未证明旧 turn 已停止不得重新 dispatch」的精确化 |

- **PostCompact/generation 与模型上下文**:compact 后 broker/generation 由 PostCompact 更新,模型上下文只能经 `SessionStart(source:"compact")` 的 `additionalContext` 重注入(architecture §8.1);signal-file 按 §13 **以 rs_ 切文件(跨滚代稳定,与 rs_ 记录同粒度——Chunk 6 增补 v0.12.1 修正,§10.14#22:此前「以 generation 切文件」为 Chunk 0+1 占位,§13 交付后以 per-rs_ 为准;文件内 generation 字段+代 CAS 承载滚代语义,旧代迟到写入被丢弃,§13.4)**。

### 4.5 resumeToken [NORMATIVE]

- 每次 registerAck 轮换铸新(单次消费;每 rs_ **恰一个 active**);`rt1.`,hash-only,绑定 `{runtimeSessionRecordId, 铸造时 generation}`,`expiresAt = mintedAt + 7d [default,可 policy 收紧]`。
- 消费(`resume`):校验 hash+未消费+未过期+**绑定 generation == 当前 generation**(不符 → `auth_invalid`;说明:滚动路径已同步轮换 resumeToken,当前 token 必绑当前代;旧代 token 属已撤销凭据)。**判定例外(先于 generic auth_invalid;r63 P2-12/v0.12.13)**:所绑 rs_ 已 OFFLINE tombstone(linger 到期退役,§4.6)→ 4025 `session_linger_expired`(caller 得到可辨别的「须全新注册」信号;此前该码仅注册未接线)。原子:标记消费 + §4.4 判定 + 铸新。
- 重复消费:若与已消费记录同 `registrationEventId`(ack 丢失重试)→ 按 §2.5.1 重放;否则 `resume_token_consumed`(审计:疑似副本重放)。**已消费记录 retention = 30d [default,可 policy 收紧] 后可 GC;判定顺序(r63 P1-2 修:GC 不得破坏 §2.5.1 redelivery)**:resume 请求恒**先按 `registrationEventId` 查 RegistrationDecision(§2.5.1;完整顺序=§2.5.1 commitRegistration 执行顺序封闭条:HandshakeProof→Decision→token,r64 N1)**——同 event+同 canonicalRequestDigest+仍 latest → 按 Decision 绑定 redelivery(**不依赖 consumed-token 行,行已 GC 亦成立**;Decision latest 常驻,§2.5.1);无 Decision 命中才落 token 路径:consumed-token 行在 → `resume_token_consumed`(审计:疑似副本重放);行已 GC → `auth_invalid`(此支仅剩「新 registrationEventId 使用旧 token」情形,拒绝正确、无复活面)。
- 丢失恢复:走 register 逻辑幂等键(§2.5.1);resumeToken 只是快路径与跨原生 ID 继承载体,不是唯一恢复通道。

### 4.6 连接接管(connection supersede)与断连 [NORMATIVE]

- **每 RuntimeSession 恰一个 current 连接**:`currentConnectionEpoch` 单调递增。新连接完成 register/resume(含 `registrationSource=reconnect`)→ **DB 单事务**:`currentConnectionEpoch+1` + 新 Connection 记录(含不可变绑定快照)+ 旧 Connection `revokedAt`+`closeReason=superseded`(durable close-intent)+ 旧 fc/sa 撤销(§3.1 轮换涵盖 sa)+ 旧连接 WaiterLease 原子删除(architecture §6.3)。**commit 之后** best-effort 向旧 socket 发 `event.shutdown{reason:"superseded"}` 并关闭(网络 I/O 不入 SQLite 原子区,architecture §11 单 writer 纪律;通知失败不影响安全——epoch fence 已挡;legacy 同型行为:CLOSE_CODE_REPLACED【代码】src/control-protocol.ts:92)。
- 旧连接此后任何请求 → `connection_superseded`(§2.6-1 已挡)。**不存在双活连接窗口**:epoch CAS 与凭据撤销同一 DB 事务。
- **requestKind × registrationSource 合法组合矩阵**:

| requestKind | 合法 registrationSource | generation |
|---|---|---|
| `register` | `session_start` / `manual` | §4.4 表 |
| `resume` | `reconnect`(传输层重连,含 broker 重启后)/ `resume` / `clear` / `compact`(宿主语义事件) | reconnect 不滚;其余滚 |
| 其它组合 | → `invalid_registration_source` 拒(不得信任任意自报组合) | |

- 断连(close/心跳死)→ Connection 记 closeReason;rs_ `connectivity=disconnected`(lifecycle 不变,dispatch eligibility=false);等 reconnect。
- **启动恢复事务(crash-only 配套;完成前不开 accept)**:durable `brokerBootEpoch+1`(BrokerState 单行 CAS)→ 所有 `closedAt IS NULL` 的 Connection 标 `closeReason=broker_crash`+revoke 其 fc → 关联 rs_ 全部 `connectivity=disconnected`(dispatch ineligible)→ **全部 WaiterLease 删除**(architecture §6.3「broker 重启后所有 WaiterLease 一律失效」)→ sessionAuth 行保留但不可再授权(§3.4)。此事务与 architecture §11 选主/迁移顺序衔接:选主锁 → migration → 启动恢复 → accept。
- `disconnected` 超过 `sessionLingerMs [default 72h,可 policy 收紧;P0A-1 探测桌面 sleep/强退恢复窗口后校准]` → `retireGeneration(reason=linger_expired)` + lifecycle=OFFLINE(tombstone);该 session 为 target 的 pinned dispatch 走 `pinned_target_unavailable`(architecture §6.3)。

### 4.7 CapabilitySet [NORMATIVE]

```text
CapabilitySet {
  canStartTurn, canInjectActiveConversation, canReturnSynchronousResult,
  canWakeIdle, supportsCancellation, requiresForeground: bool,
  inboundMode: "channel"|"hook_wake"|"manual_claim_current"|"armed_pull"|"pull"|"headless"|"none",
  canPresentApproval: bool, canAttestHumanGesture: bool,
  attestationSchemes: ("user_presence_dialog_v1"|"secure_enclave_p256_biometry_v1")[]
}
```

- 未知枚举/未知字段 → 拒(§1.3);declared 经 §2.4 公式裁剪为 granted,入 rs_ 与审计。
- `canPresentApproval/canAttestHumanGesture/attestationSchemes` 仅 `surface=approval_system` 且**该 endpoint 经 §4.8 预置开通**后可为真/非空;其它情形自报 → `capability_not_allowed_for_surface` 拒注册。

### 4.8 provisioned 端点开通(approval_system / worker;防自封) [NORMATIVE]

- `surface ∈ {approval_system, worker}` **禁止通用 first-register**(`endpoint_not_provisioned` 拒):worker endpoint 由 broker spawn 时内部自建(§9.2 architecture,不经外部 wire);approval_system 必须走 bootstrap:
- **wire 载体**(register 的 `approvalBootstrap` 字段,§2.5;参与 requestBodyDigest/HMAC):

```text
EnrollmentRegistry(admin provision 时创建,broker 持久;architecture §10.1 keyId→principal enrollment 的存储 owner):
  {enrollmentKeyId, endpointId, principalId,
   keyKind: "bootstrap_identity"|"attestation_scheme",
   algorithm: "ed25519_v1"(publicKey=base64url 32B)
            | "secure_enclave_p256_v1"(publicKey=base64url SEC1 压缩 33B),
     # 约束:bootstrap_identity 密钥必须 ed25519_v1(确定性签名,digest 稳定性依赖它);
     # attestation_scheme 密钥按 scheme 定:user_presence_dialog_v1→ed25519_v1(软件 key,
     #   same-UID 可读——§10.4 out-of-scope 如实声明);secure_enclave_p256_biometry_v1→
     #   secure_enclave_p256_v1(SE 非导出;ECDSA 非确定性无害:attestation 签名 per-challenge,
     #   永不进入任何不可变 digest)。无真实对应 enrollment 记录时,该 scheme 能力=
     #   evidence_missing denied(§2.4;禁静默降档,architecture §10.1)
   schemeId?(keyKind=attestation_scheme 时必填), allowedSchemes[], provisionRevision,
   bootstrapChallengeNonce: string(32B canonical base64url,provision 时生成并持久,跨握手稳定),
   status: "active"|"revoked", createdAt, revokedAt?}

ApprovalProvisionBundle(admin provision 命令的带外输出;challenge 交付协议):
  {endpointId, expectedEndpointGeneration, provisionRevision, enrollmentKeyId,
   bootstrapChallengeNonce, bootstrapCapability}
  # 经 admin plane 交付给 Approval Agent,由其持久于自身 0600 私有配置,保留至收到成功
  #   registerAck 或 registration_event_superseded(非"消费即删"——消费对客户端不可观测);
  # 不经任务 RPC/通知/transcript;broker 侧与 registry 常数时间比对

ApprovalBootstrap {
  endpointId: "ep_…",                  # 预置记录(admin plane 创建 Endpoint{provisioned=true} + EnrollmentRegistry 行)
  expectedEndpointGeneration: int,
  provisionRevision: int,
  bootstrapCapability: "bc1.…",        # admin 签发;绑 {installationId, endpointId,
                                       #   expectedEndpointGeneration, provisionRevision, enrollmentKeyId};
                                       #   单次消费,TTL 10min [default]
  enrollmentKeyId: string,
  declaredSchemes: string[],           # 必须 == envelope.capabilities.attestationSchemes(逐元素相等)
                                       #   且 ⊆ EnrollmentRegistry.allowedSchemes,否则拒(防 scheme-confusion)
  enrollmentProofOfPossession: string  # base64url(Ed25519 签名 64B);消息 = AB-CANON-1raw(
                                       #   "AgentBridge/EnrollmentPoP/v1", EnrollmentPoPClaim)
}

EnrollmentPoPClaim {                   # hash-input schema;全字段稳定,不含任何握手 nonce
  installationId, endpointId, expectedEndpointGeneration: int, provisionRevision: int,
  enrollmentKeyId, declaredSchemes: string[],
  bootstrapChallengeNonce,             # 来自 EnrollmentRegistry(provision 期持久)——跨握手重放安全:
                                       #   ack 丢失后换连接重试可原样复用同一 PoP,digest 不变
  registrationEventId                  # 绑定本注册事件,防跨 event 挪用
}
```

- **防重放分工(设计说明)**:PoP 只证"enrollment 私钥持有者授权此 endpoint/代/事件的开通"(签**稳定** challenge,Ed25519 确定性签名 ⇒ 同消息同字节,digest 稳定);**当前握手**的防重放由 HandshakeProof 承担(绑双 nonce+transcript)。二者正交,ack-loss 重试无自锁。
- **ApprovalBootstrapHashInput(封闭 schema;canonicalRequestDigest 的 approvalBootstrap 字段取此构造值)**:

```text
ApprovalBootstrapHashInput {
  endpointId, expectedEndpointGeneration, provisionRevision, enrollmentKeyId,
  declaredSchemes: string[],
  bootstrapCapabilityHash,            # = sha256(bootstrapCapability wire 字符串的 UTF-8 字节) 文本形
  enrollmentProofOfPossessionHash     # = sha256(签名 wire 字符串的 UTF-8 字节) 文本形
}
# hash 输入锁定为 wire 字符串字节(非 base64url 解码字节)——消除双实现分歧;
# wire 字符串本身受 canonical base64url 校验(非 canonical 编码在解析层即拒)
```
- **开通事务**(commitRegistration §2.5.1 的 bootstrap 腿)——判定分两层,失败出口不同:
  - **admission 层(hard-fail,整次注册拒)**:预置记录 CAS(`endpointId+expectedEndpointGeneration+provisionRevision` 全中)→ `endpoint_not_provisioned`;bootstrap 密钥行精确匹配 `{keyKind=bootstrap_identity, algorithm=ed25519_v1, endpointId, principalId, provisionRevision, status=active}`(attestation 行不得充当 bootstrap 行)、bc 消费、PoP 验签(公钥/算法取自 bootstrap 行)、`declaredSchemes ⊆ allowedSchemes` → 任一不符 `bootstrap_capability_invalid`;
  - **scheme evidence 层(soft-deny,注册成功、能力裁剪)**:declaredSchemes 中某 scheme 缺精确匹配 `{keyKind=attestation_scheme, schemeId, endpointId, principalId, provisionRevision, status=active, algorithm=该 scheme 规定算法}` 的行、或 `secure_enclave_p256_biometry_v1` 的硬件 enrollment/profile 验证(G-5 conformance 项)未过 → **仅裁掉该 scheme 对应能力**,registerAck `deniedCapabilities[reason=evidence_missing]`,不拒注册——软件登记一行 P-256 公钥**不构成**硬件证据(禁静默降档,architecture §10.1;§2.4 公式的 evidencePassed 维即此)。
  admission 过 → 建 rs_/Connection + 写 RegistrationDecision(含 resultEndpointGeneration/provisionRevision)。**redelivery 路径(r65 N1'/v0.12.15:统一 Decision-only,删 bc-row revalidation 双规范)**:走 §2.5.1 Decision-hit 腿——仅验 HandshakeProof+canonicalRequestDigest+重放四门(digest 已覆盖 ApprovalBootstrapHashInput/PoP hash-input,同 digest 即同 bc/PoP 语义);**不读 bc 行、不重验 PoP**(首次 Decision-miss 事务已原子消费 bc 并写 `consumedByRegistrationEventId`——该列此后仅审计,不再充当重送路径判据)。
- **客户端持久化义务**:Approval Agent 首次发送 register 前必须持久化 `{registrationEventId, RegisterBody, PoP}` 于自身 0600 配置(与 ProvisionBundle 同处),收到成功 registerAck 或 `registration_event_superseded` 后方可清除——覆盖 send 后、ack 前的客户端 crash(否则丢失 eventId 而 bc 已绑旧 event,自锁)。
- 语义依据:Approval Agent 随 broker 交付、G-5 前不激活(architecture §10.1);holder-only 动作仅投影给已注册 approval_system(architecture §6.3);"已注册"在 wire 层收紧为"已预置开通"——installationProof 只证明同安装,不足以区分普通 shim 与审批面(冒充=holder 面抢占/饿死攻击,注册层必须挡)。
- **retireEndpointGeneration(ep_, oldEpGen, reason) 原子事务**(重开通/升级/换密钥/撤销触发):对该 epGen 下**每个 rs_ 内联执行 `retireGeneration(endpoint_revoked)`**(§4.4 级联——含 overlapRiskSet 进 reconciling,不止撤 Connection/token:worker 类 rs_ 的活跃执行 authority 由此正确进入 settle/reconcile)+ 撤销未消费 bootstrapCapability + holder token + ApprovalPresentationLease + capability snapshot + **supersede 该 epGen 下全部 RegistrationDecision(置 supersededAt,旧 event 重放必落 §2.5.1-3)**;pending ApprovalChallenge 按 architecture §10.1 cancel/requeue;然后 `Endpoint.currentGeneration+1`。§2.6-2 的**当前态**检查保证旧代连接即刻失效,不依赖级联完备性单点。
- [G5-GATED] 开通成功 ≠ 激活:G-5 未过时该 endpoint 审批能力恒 denied(`gate_disabled`),`claim_approval` 等 holder 方法一律 `capability_disabled`;deny-only 阶段(Phase 1B)审批面只有记录职能,无放行职能(architecture §16)。

### 4.9 配对与 WorkspaceBinding(Phase 1A「最小 one-pair/workspace binding ACL」,architecture §16) [NORMATIVE]

- **注册 ≠ 配对**(architecture §5):新 rs_ 默认 `assignmentState=unassigned`。unassigned 会话允许的方法 = `{status, heartbeat, pairing.claim, pairing.status}`(issue/revoke 属 admin plane,见下);一切任务面/审批面/路由方法 → `not_paired` 拒。
- **WorkspaceBinding 实体(C 类授权记录)**:

```text
WorkspaceBinding bind_<ulid> {
  bindingId, bindingEpoch: int,
  installationId, workspaceFingerprintDigest,
  sideA: { surface, endpointId },              # 配对的两侧端点类
  sideB: { surface, endpointId },
  createdAt, createdVia: "pairing_code"|"admin",
  revokedAt?: int
}
```

  同 `{installationId, workspaceFingerprintDigest, orderedSurfaceA, orderedSurfaceB}` 至多一条 active(部分唯一索引,**键到 surface 层**——one-pair-per-workspace-per-surface-pair;sides 的 endpointId 是绑定数据、不进唯一键;§4.11 schema 同此);创建/撤销均 CAS(`bindingEpoch`)。
- **sideA/sideB canonical ordering**:两侧按 `(surface, endpointId)` 字典序排序后落库(A↔B 与 B↔A 归一,唯一索引不可绕)。
- **SessionIdentityEvidence(可信 session handle 的证据承载;broker-owned)**:`hostNativeSessionId` 是自报字段,**非空≠可信**。可信度由 evidence profile 判定:

| sourceProfileId | 来源 | status 判定 |
|---|---|---|
| `claude_hook_session_start_v1` | Claude 插件 SessionStart hook 经已认证控制通道提交 session_id(F10 官方 hook 机制) | verified(hook 行为细节 [E2E-GATED→P0A-1] 确认后冻结 profileVersion) |
| `codex_shim_thread_identity_v1` | Codex MCP shim 拓扑/thread 身份获取 | **[E2E-GATED→P0A-2/-3]:探测通过前恒 `unverified`** |
| (无 profile 命中) | — | unverified |

- **自动恢复(收紧)**:新注册 rs_ 满足**全部**:①命中恰一条 active binding;②该 binding 对应 side 的 `{endpointId, surface}` 精确匹配当前 endpoint 且 `endpointGeneration` 为当前值;③本侧 SessionIdentityEvidence.status=verified → `assignmentState=bound`(registerAck 携 binding;rs_ 记 `boundBindingRef{bindingId,bindingEpoch}`,后续每次授权重验该 binding 仍 active 且 epoch 未变)。命中多条 → 保持 unassigned,registerAck `details.bindingHint="ambiguous_binding"`(信息提示,非 error;路由时目标不唯一拒绝——architecture §5)。evidence unverified → 保持 unassigned(该 surface attached 配对不可用)。
- **pairing 方法 schema 与授权分离**:

```text
pairing.issue  {auth} → {pairingCode(明文,单次显示), expiresAt}
   授权:仅本机 admin plane / 用户显式 CLI(`agentbridge pair`);模型 shim MCP 工具面不暴露
pairing.claim  {auth, pairingCode} → {bindingId, bindingEpoch, assignmentState:"bound"}
  # 失败(code 过期/已消费/绑定不符/唯一约束 CAS 败)统一 → 4021 `pairing_code_invalid`,
  #   不泄露具体原因(r63 P2-12/v0.12.13:§16.2 行所指正文出口即此,此前仅注册未接线;
  #   **r64 N5:evidence 非 verified 不入 4021——恒走下方既有 4020
  #   `attached_adapter_unsupported` 分支,消除同条件双码冲突**)
   授权:已注册 session,assignmentState ∈ {unassigned, bound, revoked}(revoked 的唯一恢复入口);
   要求双侧 SessionIdentityEvidence.status=verified,
   否则 `attached_adapter_unsupported`(architecture §5「拿不到可信 handle 判 unsupported」)
pairing.status {auth} → {assignmentState, binding?}
pairing.revoke {auth, bindingId} → {}   授权:仅 admin plane / 用户显式 CLI
```

  `pc1.` 绑 `{installationId, workspaceFingerprintDigest, issuerRuntimeSessionRecordId, nonce, expiresAt=10min [default]}`,hash-only,单次;claim 事务原子:消费 code + 建 binding(canonical ordering + 唯一约束)+ 双侧 rs_ `assignmentState=bound` + 写 `boundBindingRef`。
- **revoked 语义**:撤销(admin/用户命令)→ binding `revokedAt` + 双侧 `assignmentState=revoked`;revoked 会话允许方法 = `{status, heartbeat, pairing.claim, pairing.status}`(**不允许自动恢复**;重新配对唯一路径 = 新 pairing code 经 `pairing.claim`,成功转 bound);任务面照 `not_paired` 拒;in-flight Task 按 architecture §6.1 取消/续行处理(不因 binding 撤销伪造终态)。
- 残余风险如实声明:same-UID agent 可自行跑 CLI 取得 pairing code——落 architecture §10.4 out-of-scope。

### 4.10 HostTurnBoundary 身份来源(§0-A.10)

- [NORMATIVE] wire 形状:操作期 `auth` 可扩展 `hostTurnClaim?: { kind: "host_turn_id", value: string } | { kind: "prompt_epoch", value: int }`;protocol feature `host_turn_boundary_v1` 未协商时该字段出现 → `capability_disabled`。v1 客户端不发送。
- [NORMATIVE] **HostSessionKey(fallback root 键)**:= `runtimeSessionRecordId`(rs_ 记录身份)。**禁止**把 generation / connectionEpoch / originInvocationId / idempotencyKey / 时间窗纳入该键(architecture §6.6:跨 reconnect/resume/compact 稳定、绝不 per-invocation root;rs_ 记录跨滚代不变,恰满足)。宿主原生 session 更换(新 rs_)= 真正的新会话,允许新 root。
- [E2E-GATED→P0A-9] per-turn root 启用前提:宿主可信 turn 边界证明。现状事实:`turn_id` 恒 null【代码】src/control-protocol.ts:46、src/claude-adapter.ts:512(architecture §0-A.10 同引)。探测通过前 broker policy 固定 session-scoped root(HostSessionKey);通过后切 per-turn 属 policy 切换,wire 形状不变。

### 4.11 Phase 1A 身份存储 schema(§0-A.5 子集;冷读者起手表) [NORMATIVE]

Phase 1A 落库最小表集(列细节=本章各实体字段;任务面表在 §6):

| 表 | 主键 | 关键唯一约束/索引/列 |
|---|---|---|
| `broker_state` | (单行) | brokerBootEpoch(持久单调)/drainGeneration/schemaVersion/lastRecoveryAt/**activeRetryManifestSnapshotRef(→rms_)/maxAcceptedManifestVersion/highWaterDigest(r63 P1-4/v0.12.13:§8.1 active 指针+防回退高水位的持久载体,安装事务同写)** |
| `installations` | installationId | 单行(本机);keyId/rotation 元数据(secret 本体 Keychain/0600,**不入库**) |
| `endpoints` | endpointId | **(installationId, surface) 部分唯一(仅宿主 surface;§4.1 解析规则)**;currentGeneration/provisioned/status;**provider+region+regionRevision(Chunk 6,轮 59:direct 治理权威源+drift 锚,§5.1 fence)列** |
| `runtime_sessions` | runtimeSessionRecordId | **logicalSessionKeyHash 部分唯一(active,非 OFFLINE;§2.5.1 get-or-create 依此)**;(endpointId, hostNativeSessionId) 索引;generation/currentConnectionEpoch/latestRegistrationEventId/assignmentState/boundBindingRef/connectivity/lifecycle(CHECK 按 §4.1 封闭转移表)/policyEpoch 列;**disconnectedAt(§5.6)/signalHighWater(Chunk 6:signal-file updateSequence 单调水位,§13.3)/nextWakeEligibleAt(Chunk 6 v0.12.5:GCRA denied 时 TAT 下一放行时点,§5.6 wake_reeval 时钟源;GCRA allowed 建 wake 或无 pending 时同事务清 NULL——轮 57 P2,防热扫)/manualAcceptPendingSince+manualAcceptEventId(Chunk 6:manual_accept 一次性事实)**列;**新表 `consumed_accept_events`(Chunk 6 v0.12.6,轮 57 P1-4:append-only,PK=(runtimeSessionRecordId, acceptEventId);manual_accept 消费 wake 同事务 insert——同 acceptEventId 重投命中 PK 即拒,不再建 wake;非单值 last,e1→e2 后 e1 重放仍拒)** |
| `connections` | connectionId | (runtimeSessionRecordId, connectionEpoch) 唯一;**不可变绑定快照列:endpointId/endpointGeneration/generation/brokerBootEpoch/fencingTokenHash**;revokedAt/closeReason |
| `session_auth_tokens` | tokenHash | (runtimeSessionRecordId) 索引;expiresAt/revokedAt/**revokeReason(tombstone,保留≥lingerMs,§3.3-1)**;每 rs_ 至多一条 active(部分唯一) |
| `resume_tokens` | tokenHash | 同上;每 rs_ 至多一条 active;**consumedAt/consumedByRegistrationEventId(首次消费归属;Decision-first(§4.5/§2.5.1)后仅审计/诊断)** |
| `registration_decisions` | registrationEventId | 不可变列:canonicalRequestDigest/requestKind/runtimeSessionRecordId/resultGeneration/resultEndpointGeneration/provisionRevision;**唯一后写列:supersededAt(墓碑)**;30d retention(latest 常驻,§2.5.1) |
| `credential_deliveries` | registrationEventId | 可变:deliveryRevision/latestConnectionEpoch/lastDeliveredAt |
| `enrollment_registry` | enrollmentKeyId | **keyKind/schemeId(attestation 行必填)**/endpointId/principalId/algorithm/publicKey/allowedSchemes/provisionRevision/bootstrapChallengeNonce/status;条件唯一:(endpointId, provisionRevision, keyKind=bootstrap_identity) 至多一行 active、(endpointId, provisionRevision, schemeId) 至多一行 active(§4.8 join 谓词) |
| `session_identity_evidence` | runtimeSessionRecordId | status/sourceProfileId/profileVersion/observedHandleDigest(broker-owned,§4.9) |
| `workspace_bindings` | bindingId | **(installationId, workspaceFingerprintDigest, orderedSurfaceA, orderedSurfaceB) 部分唯一(active;键到 surface 层,§4.9)**;sideA/sideB endpointId 数据列;bindingEpoch/revokedAt |
| `pairing_codes` | codeHash | issuerRuntimeSessionRecordId/workspaceFingerprintDigest/expiresAt/consumedAt |
| `bootstrap_capabilities` | capHash | endpointId/expectedEndpointGeneration/provisionRevision/enrollmentKeyId/expiresAt/consumedAt/**consumedByRegistrationEventId(首次消费原子归属;r65 N1' 后仅审计——redelivery 判据=Decision digest,§4.8)** |
| `capability_snapshots` | snapshotId(`caps_`,r63 P2-11) | (runtimeSessionRecordId, policyEpoch, registrationEventId, revision) 唯一;evidenceProfileDigest 列;**审计专用,授权走 §2.4 authorize()** |
| `audit_log` | seq | append-only(architecture §11 审计纪律) |

- SQLite 纪律(WAL/单 writer/迁移/备份)按 architecture §11,不在此复述。任务面实体(tasks/claim_offers/execution_leases/…)的映射在 §6(Phase 1B)。

---

## 5. Task phase 转移表(§0-A.4) [NORMATIVE]

### 5.1 前提与横切规则

- phase/outcome/verification 三正交字段的**语义** SSOT = architecture §6.1;本节只补齐转移触发、合法边、CAS 赢家与实现机制,不重定义语义。
- **单一 reducer**:一切 Task 状态变更经唯一 `taskReducer(taskId, trigger, expectedStateRevision)`(writer 事务;anti-TOCTOU §2.6 类 1/3);**phase 变更**合法性由 reducer + `BEFORE UPDATE` trigger(校验 `(OLD.phase, NEW.phase)` ∈ §5.2 合法边表)双重强制——行级 CHECK 只管单行形状,管不了跨行转移。
- **phase-preserving mutation 类**(同 phase 更新,trigger 放行 `OLD.phase==NEW.phase`):queueReason/nextEligibleAt 重排(T4c、**T4d(Chunk 4 增补)**)、cancelRequested 置位(reconciling 中)、terminationIntent 写入(D3)、claim ACK(§5.3)。**revision 三分**(architecture §6.2):authority/phase/lease 变化推进 `stateRevision`;verification 走 `verificationRevision`;evidence append 走 `eventSequence`——三者互不代替,phase-preserving 更新按其类别推进对应 revision。
- **全局 deadline fence(rule 0 的机器化,architecture §6.1)**:每个 mutator 在同事务先验 `transactionNow < resolvedDeadlineAt`。已超时:
  - 无执行风险(submitted / queued / waiting_input[pre_dispatch] / **leased 且 lease.status=pending_ack**——执行权从未激活,走 T6b)→ 直接 terminal `expired`;
  - 有执行风险(**leased 且 lease.status=active** / dispatching / running / waiting_*[in_execution] / cancelling)→ 持久 `terminationIntent=expired` + interrupt/drain outbox → drain 完成且无未决 effect → terminal `expired`;executing EffectAttempt 走 architecture §10.1 deadline 赢家(consume 先赢→settle 后 terminal,保留 effectMayHaveOccurred);事实不明 → reconciling;
  - **complete_task 不得越过 deadline**:completion CAS 的 fence 集含 deadline;`now ≥ resolvedDeadlineAt` 时拒绝以 succeeded/failed 结单,真实执行结果记 `late_result` evidence(receipt 可见),终态按上两条走 expired 路径(**受 terminationIntent write-once first-winner 与 T20 分支约束(r63 P1-1):既有 cancel intent 时 T19/T20 按各自行规则出 cancelled/unknown,不被 deadline 改写为 expired**)——janitor tick 空窗不构成豁免。
  - deadline 的**封闭边**在 §5.2:D1(active→cancelling(terminationIntent=expired))/D2(approval-pending 快速 expired)/D3(reconciling 自环)/T6b(pending_ack 直达)/T21(pre-dispatch 直达);`cancelling` 承载一切 stop drain(cancel 与 expired 共用),终态 outcome 由 terminationIntent 定(cancelled|expired),与 architecture §6.1「cancelling→cancelled」兼容扩展(expired 出口=deadline 派生,authorship 不变)。
- **统一 obligation cleanup reducer 四分(职责边界封闭,防过早释放)**:
  1. `beginStop(task, intent∈{cancel, expired})`(denied 不经 cancelling,由决策表直接 terminal):写 terminationIntent(**write-once,首个 stop CAS 赢,跨 reconciliation 保留**)、**WaiterLease 原子删除**(cancel 即删等待边,architecture §6.3)、撤 active ClaimOffer/suspension 动作 token/pending ApprovalChallenge/unused EffectPermit(executing 恒走 §10.1 赢家,不撤)、fence completion authority(completion tombstone disposition=revoked, revokeCause=stop_won, revokedAuthority 按该 lease 当时 status:active→`activated` / pending_ack→`never_activated`;迟到 complete 路由不读 revokeCause——读 {revokedAuthority, fence 匹配, phase},见 §5.3)、**本 dispatch 的 `dispatch_intent` outbox(pending|sent)→ abandoned(abandonReason=stop_won;r63 P2-8/v0.12.13:原仅收 pending——sent 行的执行安全本由 T7 receiver fence 承担,但 T14 赢后 Task 离开 dispatching、T8 不可达,sent 行永久悬空;本收口治台账闭合非执行安全)**、发 interrupt/drain outbox——**不释放 occupancy/reservation,不做 settlement**(旧 turn 未证停);
  2. `enterReconcile(task, reason)`:封存旧 attempt/risk 记录、lease revoke(completion tombstone **无行则写入** disposition=revoked, revokeCause=reconcile_entry, revokedAuthority=activated;**已有 revoked 行(beginStop 先写)则不改写**——revokeCause write-once,迟到 complete 路由取 live task state,§5.3)、**冻结写入 `reconcileDeadlineAt`**、reconcile intent——不做最终 settlement;
  3. `enterTerminal(task, outcome)`(含 finishStop):**唯一执行书挡③ settlement**(幂等 UsageEvent→held 释放/settled→circuit→terminal receipt 原子,architecture §6.6)+ **关闭 active ExecutionLease(status=closed)+ terminalize 未终 DispatchAttempt + completion authority 收口** + WaiterLease 删除(幂等 backstop)+ **释放 runtime execution slot(§7.3;Chunk 3 增补)** + 通知 outbox;
  4. `settleAttemptForRetry`(**T18/T6b 回 queued 腿共用**):书挡③ 的 retry 腿——同事务 insert UsageEvent(T6b 无执行,用量按 0/上界规则)、held→settled/released、释放 concurrency、更新 circuit、写 `retryNotBeforeAt`(T6b 可为立即)、**释放 runtime execution slot(§7.3)**。
  **slot 释放点封闭 = reducer 3/4 的 conclusive 收口 + `releasePoisonedSlot`(poisoned 态唯一出口)**(beginStop/enterReconcile **不释放**;**enterTerminal 按 §6.1 poison 谓词判定:执行风险未证停 → 置 poisoned_unresolved 而非释放——覆盖 T20 全 outcome 与 D2**;与「不释放 occupancy」同义;Chunk 3 增补,轮 19/22/23)。
  **任何 terminal/cancel/reconcile 路径不得绕过对应 reducer**——防 ghost wait edge/泄漏 authority/过早释放。
- `cancelRequested` 是 flag 列非 phase:任何非终态可置位,由下一个合法决策点消费;**reconciling 中只置 flag 不转移**(事实不明优先)。
- **数据治理 fence(Chunk 6 增补 v0.12.2-v0.12.6,轮 53-57;architecture §10.2/I-4 转移接线;无 fresh/同厂商豁免——治理对一切 provider dispatch 适用)**:
  - ①**书挡①(T1)** 从 room(§6.1 rooms)派生冻结 `effectiveDataGovernance`(§6.1),含最保守合并(caller 只能收紧,§6.1)。
  - ②**目标 {provider, region, targetAccountClass} 来源(轮 57 P1-10 三路同源)= D-6 resolvedTarget 冻结写入 tasks 的 `{resolvedProvider, resolvedRegion, resolvedTargetAccountClass}`**:direct(endpointId/rs_ selector)=目标 endpoint.provider + endpoint.region(§4.1 增列,轮 57)+ 目标 rs_.accountClass.verified;dedicated/fallback=选中 dbind 对应 endpoint.provider/region + 该 pin 的 activation_grant.region/accountClass(dedicated_bindings 增 activationGrantRef,§10.9,轮 57)；managed activation=endpoint.provider + activation_grant.region/accountClass。**任一路无权威 region → 恒 4064(fail-closed,不以「未知」当匹配)**。
  - ③**eligibility 判定在 Task durable acceptance 之前**(D-6/activation,architecture §6.3):`{resolvedProvider, resolvedRegion} ∈ effectiveDataGovernance.providerRegionAllowlist(空集/不含 → **`data_governance_denied`(4064)**)∧ (dataClassification=restricted ⇒ **caller accountClass≠unknown ∧ resolvedTargetAccountClass≠unknown**(轮 57 P1-13:目标账户亦须 verified non-unknown,architecture §6.3 grant account 重验/§10.2「unknown 不处理公司数据」双侧)∨ accountClassPolicy=require_known ⇒ 两侧≠unknown)`——4064 不复用 4036/4040 语义(轮 57 P1-12)。
  - ④**accept 后 room governancePolicyEpoch drift → superseded**——producer 双路(轮 57 P1-11 域对齐):(a) **pre-dispatch Task**:T3/T4 dispatch 事务 fence `governancePolicyEpoch==room 当前 ∧ 重解析 governanceResolveDigest==冻结值`(轮 59:room epoch 或 endpoint.regionRevision/grant.version 任一 drift 均命中),不符走 T21 superseded;room admin 更新事务扫描**仅标记该 from 集的 Task**(governanceReevalPending),janitor `governance_drift` 补跑 T21;(b) **已 dispatch Task**(leased/dispatching/running/cancelling/reconciling):不走 T21(非其 from 集),而是 grandfather(允许当前 attempt 跑完;architecture §10.2 未要求撤销运行中派发)——若 policy 要求即刻停,走既有 beginStop/reconcile 安全链(§5.1 reducer),非 T21。
  此接线为受审 additive(D-6/T1 前置+T21 drift guard+endpoint.region/dbind.activationGrantRef 载体,不新增边)。
- **revision 推进规则**:仅 authority/phase/lease 类 mutation 推进 `stateRevision`;verification 类只推进 `verificationRevision`;evidence 只 append `eventSequence`(architecture §6.2 三分,互不代替)。每 phase 转移 append task_event。

### 5.2 转移表(封闭;pull 与 push 两腿不交叉——对 architecture §6.1 开放问题 .4 的裁决:pull=`queued→leased→running`,push=`queued→dispatching→running`)

| # | from | 触发 | guard(deadline fence 恒含,不再重复) | to | 同事务副作用 |
|---|---|---|---|---|---|
| T1 | —(accept 书挡①) | task.submit durable accept | D-6 目标解析已过+书挡①reserve 成功+**同事务治理原子重验(轮 55-59:读当前 room→派生 effectiveDataGovernance→按 D-6 冻结目标重验 {resolvedProvider,resolvedRegion}∈allowlist ∧ caller accountClass≠unknown ∧ resolvedTargetAccountClass≠unknown(restricted/require_known 时)+冻结 governanceResolveDigest;D-6 选目标(epoch N)后 admin 改 N+1 移除该目标 → T1 重验命中拒,消除 TOCTOU;§5.1 fence③)** | submitted | insert Task/idempotency/lineage/effectiveDataGovernance(快照);失败=typed error 不生成 taskId |
| T2 | submitted | eligibility 评估(accept 同事务或恢复补跑) | !cancelRequested(置位则径 T14) | queued | queueReason ∈ {ready, target_busy, awaiting_wake, budget_wait(+nextEligibleAt), **provider_wait(Chunk 4 增补 v0.10.6:circuit 专属,T4d)**} |
| T3 | queued | `claim` CAS(pull) | `queueReason=ready 且 now ≥ max(nextEligibleAt, retryNotBeforeAt)(NULL=不限)`;offer 有效且 `offer.offeredStateRevision == task.stateRevision == request.expectedStateRevision`;**offer.candidateOwner == 调用会话(四层+generation)且 Task resolved target == 该会话**(route ACL,Chunk 3 增补);**rs execution slot guard(轮 24 同步)**:当前 {rs_, generation} 无 held slot **且同 rs_ 任意 generation 无 poisoned_unresolved slot**(session 级隔离,§6.1;冲突→4013);**数据治理 fence(Chunk 6 v0.12.5-v0.12.8,§5.1 fence③(a)+④):effectiveDataGovernance.governancePolicyEpoch==目标 room 当前 ∧ **重解析成功且 governanceResolveDigest==tasks.governanceResolveDigest**(轮 59-60 P1-F/P1-6:含 endpoint.regionRevision/grant.version;**重解析失败(grant 过期/撤销/缺失/region mismatch)或 digest 不等 → 不 dispatch,走 T21 superseded(resolve_invalid)**)**;!cancelRequested;**书挡② reserve 成功**(attempt 消耗/concurrency/context/cost,与 T4 共用同一 dispatch-bookend reducer,architecture §6.6) | leased | 首次 dispatch 时 CAS TaskRouteOwnership;offer 消费+sibling revoke+DispatchAttempt+ExecutionLease(含 dispatchId)+completionTokenHash+**claim_deliveries 行(claimRequestId 幂等,§5.3)**;payload 随同步响应返回(非 outbox) |
| T4 | queued | `reserve_push_dispatch`(push) | **逐字枚举(不继承 T3 的 offer/调用会话条件——push 无 ClaimOffer)**:`queueReason=ready 且 now ≥ max(nextEligibleAt, retryNotBeforeAt)`;Task resolved target == 该 worker rs_;**worker rs execution slot guard 同 T3(当前 gen 无 held 且任意 gen 无 poisoned,§6.1)**;**数据治理 fence 同 T3(§5.1 fence③(a)+④:room epoch ∧ governanceResolveDigest 重验;push 到 codex_worker 是跨厂商主路)**;route CAS;书挡② reserve 成功(同 reducer);!cancelRequested。**T4 所建 lease 初始 status=active**(push 无 pending_ack 阶段) | dispatching | DispatchAttempt+ExecutionLease+completionTokenHash+holder tuple **持久化**+`dispatch_intent` outbox(intent_committed;`dispatchAckDeadlineAt` 写入);**PushCompletionHandle 为 commit 后进程内构造物,非事务产物** |
| T4c | queued | 书挡② reserve 失败:短期 rate/并发 reset<deadline;**或 reset ≥ deadline(Chunk 4 增补 v0.10.6,轮 36 授权:重排后 nextEligibleAt=max(resetAt) ≥ deadline,任务不再变 eligible,由 deadline fence 到点收口 expired——扩触发域不改副作用,防「defer×长 reset」无出口;§10.4 effectiveExhaustionPolicy defer 条为其判定源)** | — | queued(**phase-preserving**) | `queueReason=budget_wait`+`nextEligibleAt` 重排(dispatch_deferred 事件;不得回滚后仍 eligible 热循环——architecture §6.6 三出口①;出口②=T9b waiting_input(budget),出口③=T21 terminal) |
| T4d(Chunk 4 增补 v0.10.6,轮 36 授权:provider circuit 专属重排边——circuit 非预算,不得复用 budget_wait 标签/T9b/T21,architecture §6.6 三出口专属预算) | queued | 书挡② ProviderCircuit 检查失败:open(cooldown 未到)或 half_open 非探针(§10.4);**书挡② 整事务回滚后的替代写集(轮 37,同 T4c 回滚纪律)** | — | queued(**phase-preserving**) | `queueReason=provider_wait`(T2 枚举同步增补)+`nextEligibleAt`=cooldownUntilAt(open)或 probeDeadlineAt(half_open 输家,§10.4——未来时点,无热循环;probe 卡死由 §5.6 probe 收口行治理)+**`waitingCircuitRef`=该 circuit 桶(tasks 增列,§10.14#13——probe 成功提前唤醒的索引;离开本状态时清)**+dispatch_deferred 事件(deferCause=provider_circuit_open) |
| T5 | leased | `execution_started` 明确证据:`runtime_bound` 事件或 adapter profile 证明 turn 已启动 | lease 有效且 **lease.status=active**(§5.3 ACK barrier);**renew_lease 永不触发本转移**(renew 只证持有,architecture §6.2「不改 stateRevision」) | running | evidence 补写(hostTurnId 等)。无此证据的 surface:leased 直达 terminal(T6)合法,running 可以从不出现 |
| T6 | leased | `complete_task`(快任务直达合法) | §6.4 completion CAS 全过(§5.3 tombstone 规则);**lease.status=active** | terminal | enterTerminal(receipt+tombstone 原子) |
| T6b | leased(lease.status=**pending_ack**) | ackDeadline 到 / **lease 过期** / 启动恢复扫描(janitor)/ retireGeneration / cancel / deadline | **pending_ack 证明执行权从未激活**(非 T17「事实不明」——不进 reconciling,不受 retryClass=forbidden 限制:无执行发生)。**除成功 `claim_ack` 激活(§5.3,lease→active)外,本行是该状态一切失活/撤权/超时/取消的唯一出口:D1/T14/T17 均显式排除 pending_ack** | live 触发 → queued;cancel/deadline 触发 → terminal(cancelled\|expired,stop_confirmed 平凡成立) | 撤 delivery(superseded)+token(tombstone revoked, revokeCause=delivery_superseded, revokedAuthority=never_activated)+关闭 lease+settleAttemptForRetry(回 queued 腿)或 enterTerminal(终态腿) |
| D3 | reconciling | deadline 到(janitor) | — | reconciling(**phase-preserving**) | write-once `terminationIntent=expired`(**已有 intent(=cancel,T16 先写)则不改写——§5.1「首个 stop CAS 赢」write-once 通则的 D3 显式化,v0.12.12/R13 deferred P2**)+撤 unused authority(executing effect 保留走 §10.1);此后 T18 被 guard 禁;**T19/T20 outcome 按各自行既有规则,不因 D3 改变(r63 P1-1 修:T19=intent 非 null 恒按 intent(expired\|cancelled);T20=intent=expired→expired / cancelRequested 且证明无 effect→cancelled / 其余→unknown——既有 cancel intent 下无法证明无 effect 时 T20 仍 unknown,D3 不得抹掉该分支)**;D3 的作用=intent 缺席的已知超时不落 unknown(NULL 时写入 expired) |
| T7 | dispatching | adapter 领取 `dispatch_intent`(sender claim)并执行 start CAS | **receiver-side start fence**:adapter **先完成本 CAS(完整 tuple)才允许发起 worker 协议调用**;旧 dispatch 的 CAS 失败=丢弃 intent 不执行(sent 后暂停的旧 sender 无法产生执行);**丢弃=同一事务幂等收口该 outbox 行 →abandoned(abandonReason=receiver_fence_lost;r63 P2-8——与 beginStop 收口双入口幂等,无永久 sent 残留)**。worker 接受调用的 `acknowledged` 为后续 evidence append | running | **同事务 outbox dispatch_intent → acked**。(无 T7b:一切 push result 必在 start CAS 之后到达,统一走 T13——D-1 快速终态不构成 dispatching 阶段旁路) |
| T8 | dispatching | `dispatchAckDeadlineAt` 到(janitor) | `intent_committed` 后**截止时仍无唯一关联的 ack/terminal result(不论有无 sent evidence)** | reconciling | reconciliationReason=dispatch_ack_missing;enterReconcile(lease revoke+tombstone=revoked);**outbox dispatch_intent → abandoned(防已进 reconciling 仍外发)** |
| T9a | running | executor 挂起:elicitation → approval/clarification;**事件须过因果 guard(suspensionOrdinal 单调+exact fence,§7.4——r63 P2-7;失败=仅审计零副作用)** | — | waiting_input(scope=**in_execution**) | SuspensionReceipt 铸造——**caller 动作 token 族按 reason 封闭**:clarification={await_result, supply_input};approval={await_result}(holder 面另走 claim_approval,architecture §6.3);同步 WaiterLease 删除;approval 同事务建 ApprovalChallenge(§10.1);**收口既有 live resume_intent 按 §7.4 分状态(guard 过后才执行)** |
| T9b | queued | 书挡②判定 budget suspension(policy=pause_for_human)/ DR-5 级 4 wake | 无 lease(**pre_dispatch**);budget 腿要求 **Approval Agent/holder capability 可用**,否则不产生第四出口(按 policy 当场 fail 或 reset<deadline 时 T4c——architecture §6.6) | waiting_input(scope=pre_dispatch, reason=budget\|wake) | SuspensionReceipt(仅 await_result,architecture §6.6);**budget 腿:workItem get-or-create+写 waitingBudgetWorkItemRef(Chunk 5 #20)** |
| T10 | running | executor 需反问(I-1 禁嵌套);**事件须过因果 guard(同 T9a,§7.4——r63 P2-7)** | — | waiting_callback(in_execution) | 解开外层 waiter;**铸 supply_callback 动作 token(T12 消费)**;**收口既有 live resume_intent 按 §7.4 分状态(guard 过后才执行)** |
| T11a | waiting_input(pre_dispatch) | budget override:holder `submit_budget_override` token 消费(经 claim_approval 铸,一次性,绑 root+old/new budget+policyEpoch)/ wake 达成 | budget 腿:**BudgetOverrideGrant append(revision)同事务**(architecture §6.6) | queued | queueReason 重赋;书挡②在下次 T3/T4 重跑;**budget 腿:按 waitingBudgetWorkItemRef 索引全量唤醒+清该列(Chunk 5 #20)** |
| T11b | waiting_input(in_execution, reason=clarification) | `supply_input` 动作 token 消费 | executor 存活(lease 有效) | running | mutating token **消费即终(不轮换)**;后续 receipt 只轮换 read-only `await_result`(architecture §6.3) |
| T12 | waiting_callback | `supply_callback` 动作 token 消费(callback 结果到达) | 同上 | running | 同上 |
| T13 | running | `complete_task` 或 broker 派生终态(authorship=architecture §6.1) | completion CAS / 派生规则 | terminal | enterTerminal;verification 按 §6.4 |
| D1 | leased(**排除 pending_ack→T6b**)/dispatching/running/waiting_*(in_execution),**排除 D2 集合**(approval-pending 且 permit absent\|unused) | deadline 到(janitor/mutator fence) | executing EffectAttempt 走 §10.1 赢家(不抢) | cancelling(terminationIntent=expired) | beginStop(intent=expired);drain 后 T15 出 terminal(expired) |
| D2 | waiting_input(in_execution, reason=approval) | deadline 到且 permit **absent 或 unused**(与 D1 互斥的唯一分派;T22 遇 Task deadline 一律 delegate 本行) | — | terminal(expired) | **同事务**:challenge cancel+permit revoke(如有)+EffectIntent 撤销+**enterTerminal(expired)**(唯一 settlement 点)+executor interrupt/drain obligation(worker BUSY 收割,architecture §9.2);permit 已 executing → D1 路径 drain |
| T14 | submitted/queued/leased(**排除 pending_ack→T6b**)/dispatching/running/waiting_* | cancel_requested(API/onCallerLoss/binding 撤销策略) | — | cancelling(terminationIntent=cancel) | beginStop(intent=cancel);**pre-dispatch 来源(submitted/queued/waiting[pre_dispatch]:无 executor)→ 同事务 stop_confirmed 平凡成立,直接续 T15 出 terminal(cancelled),不滞留 cancelling** |
| T15 | cancelling | stop_confirmed(「旧 turn 已停」证据任一:interrupt ack/收割完成/§5.3 迟到 complete 路由的 stop 证据(**须 fenceTuple 匹配当前 drain 目标 attempt**);**且**无未决 effect) | — | terminal(outcome=按 terminationIntent:cancelled\|expired) | enterTerminal(唯一 settlement 点);迟到执行结果=late_result |
| T16 | cancelling | executor 丢失/effect 事实不明 | **无 executing EffectAttempt**(有则强制走 T24 effect-aware 路径,防漏存 permit/attempt/lease 对账状态) | reconciling | **enterReconcile**(reason=cancel_uncertain;terminationIntent 保留) |
| T17 | leased(**排除 pending_ack→T6b**)/dispatching/running/waiting_*(in_execution)/cancelling | lease 过期未证停(janitor)/ retireGeneration(§4.4)/ 启动恢复扫描 / **resume applyDeadline 到(v0.9.6,§7.4)** | 不能证明旧 turn 已停止;**executing EffectAttempt 不抢**(其 settle/drain 归 §10.1 赢家/T24) | reconciling | reconciliationReason ∈ {lease_expired, owner_identity_retired(+retirementReason), executor_lost, **resume_apply_uncertain(v0.9.6)**};**enterReconcile**(lease revoke+completionToken tombstone disposition=**revoked**;迟到 complete 走 §5.3 路由——fenceTuple 匹配本次封存 attempt 时=T19 证据输入,历史 attempt 恒 evidence-only)+ reconcile_started + interrupt/drain intent outbox;「未证停 attempt」保留为 overlap 风险记录(§4.4) |
| T18 | reconciling | 对账:旧 turn 证明已停+无 effect 发生 | retryClass ∈ {safe, idempotent} 且 !cancelRequested 且 **`terminationIntent IS NULL`**(**forbidden/带 stop intent 恒禁 →T20**) | queued | **settleAttemptForRetry(§5.1 reducer 4:UsageEvent+held 释放/settled+concurrency 释放+circuit+`retryNotBeforeAt`)**+terminalize 旧 DispatchAttempt(reconciled 事件)+清 reconciliationReason+赋 queueReason;**不消耗新 attempt** |
| T19 | reconciling | 对账发现完成证据(completion receipt/协议终态/effect postimage) | 经 §6.4 同一 core handler;**`terminationIntent` 非 null 时 outcome 恒按 intent(expired\|cancelled)**——stop 已先赢,真实执行结果仅记 evidence+effectMayHaveOccurred(effect 结清后才终态),不复活 succeeded/failed(architecture §10.1 赢家「保留真实 outcome 于证据」+§6.1 cancel 语义) | terminal(真实 outcome 或 intent 强制值) | enterTerminal;不伪造 unknown |
| T20 | reconciling | 无法对账(reconcileDeadlineAt 到)/retryClass=forbidden 不可重试 | — | terminal:`terminationIntent=expired → expired`;cancelRequested 且证明无 effect → cancelled;其余 → unknown(reconciliation_unresolved) | enterTerminal;非幂等写禁自动重试 |
| T21 | submitted/queued/waiting_input(pre_dispatch) | deadline 到(expired)/basis 过期(superseded)/**governance drift(Chunk 6 增补,§5.1 fence④;轮 60 P1-6:room governancePolicyEpoch drift **或** T3/T4 重解析 governanceResolveDigest 不等 **或** 重解析失败(grant 过期/撤销/缺失/region mismatch,resolve_invalid)→superseded)**/决策表 rule 1/2(denied)/hard budget 尽且 policy=fail(quota_exhausted) | 派生 authorship(architecture §6.1) | terminal | enterTerminal |
| T22 | waiting_input(in_execution, reason=approval) | 决策表 rule 5/6/7(architecture §6.1/§10.1;**approval 出口唯一 SSOT,T11b 不覆盖 approval**) | challenge/permit CAS | running 或 terminal(expired/denied) | allow/deny 事务对称(§10.1) |
| T23 | dispatching/running(Phase 1B legacy) | legacy `turn_completed` evidence | **guard:TaskRouteOwnership.deliveryOwner=legacy_adapter + ownerEpoch 匹配 + 唯一关联当前非终态 dispatch**(architecture §16) | terminal(unknown, legacy_evidence_only_completion) | 不经 reconciling;verification=not_applicable |
| T24 | running/cancelling/waiting_input(approval) | EffectAttempt executing 且 mediator crash/effect 事实不明(§10.1/§12 对账起点) | — | reconciling(effect_uncertain) | **enterEffectReconcile = enterReconcile(继承 reconcileDeadlineAt 冻结/risk 封存/event 写集——保证 T20 定时可达)+ effect 专属封存**(EffectAttempt/permit/WorkspaceEffectLease);出口 T19/T20,**+T18(Chunk 5 增补 v0.11.3,§10.14#19:仅对账确认 not_applied 且 T18 原 guard 全过——「仅 unknown 不自动重试」architecture §10.1 逐字,not_applied 非 unknown;§12.7 详)** |

### 5.3 CAS 赢家与 completion tombstone(封闭)

- **一切转移竞争**由 `(taskId, expectedStateRevision)` 条件 UPDATE 线性化;先 commit 赢;输方重读重判。
- **cancel vs complete**:先 commit 赢;晚到 complete → `late_result` evidence 不改终态;晚到 cancel → already-terminal receipt。
- **claim vs cancel**:cancel 先赢使 revision 前移 → claim CAS 失败 → offer 同事务撤销,返回同 ID tombstone(architecture §6.5)。
- **deadline vs permit-consume**:architecture §10.1 单一 CAS 赢家,不复述。
- **completion 重放与撤权**(architecture §6.4 的存储实现):`completion_token_tombstones{tokenHash PK, disposition ∈ {consumed, revoked}(互斥 CHECK), firstOperationDigest?(仅 consumed), receiptRef?(仅 consumed), revokedAt?/revokeCause?(write-once)/revokedAuthority?(∈{activated, never_activated})/reconcileRef?(仅 revoked;CHECK:revokeCause=delivery_superseded ⇒ revokedAuthority=never_activated), fenceTuple(taskId/dispatchId/leaseId/leaseEpoch/attempt/ownerTupleDigest;push 额外含 holderInstanceId/holderGeneration/adapterInstanceId/adapterGeneration/executorInstanceId/executorGeneration/correlationKey——architecture §6.2 完整 tuple), consumedAt?}`:
  - **consumed**:首次结单 = terminal + receipt + tombstone 单事务;重放同 token 同 digest → 取回旧 receipt;异 digest → conflict;
  - **revoked**(T8/T17/T24/T6b/beginStop 写入):**永不再结单**。**正交化(N6)**:tombstone 只承载 **token 事实**——`revokeCause ∈ {stop_won, reconcile_entry, delivery_superseded}`(**write-once 审计列**:首个撤权者写入,后继 reducer 不改写、不参与路由)与 `revokedAuthority ∈ {activated, never_activated}`(该 token 执行权曾否激活=撤权时 lease.status:active→activated / pending_ack→never_activated;交付轮换「撤旧铸新」同 never_activated)。**迟到 complete 的行为路由不读 revokeCause,由同 writer 事务内读取的 {revokedAuthority, tombstone.fenceTuple 与当前未决 stop/reconcile 目标 attempt 的匹配, 当前 Task phase} 三元决定**(轮 15 修:防跨 attempt 串线):
    - `revokedAuthority=never_activated` → **恒 fail-closed**(不论 phase、不论 fence 匹配):仅记 evidence,不结单、不进对账、不参与 stop_confirmed(执行权从未激活,防未合法启动的 shim 影响对账);
    - `activated` 且 **fenceTuple 精确匹配当前未决 stop/reconcile 目标 attempt**(= beginStop 所 fence / enterReconcile 所封存 risk record 引用的 `{dispatchId, leaseId, leaseEpoch, attempt}`;该匹配仅在 phase ∈ {cancelling, reconciling} 有定义——此二 phase 的 **commit-visible** 状态恒有唯一未决目标 attempt;T14 pre-dispatch 来源在同事务内直达 terminal,「无 attempt 的 cancelling」不可被并发观察):
      - phase=`cancelling` → 记 `late_result` evidence,并作为**该 attempt**「旧 turn 已结束」stop 证据参与 T15 判定(仍须无未决 effect;T16/T24 规则不变);
      - phase=`reconciling` → 作为 T19 对账证据输入(outcome 仍按 terminationIntent 强制,T19 规则不变);
    - `activated` 其余一切——**fenceTuple 不匹配当前目标的历史 attempt token(任意 phase,含 queued/running/cancelling/reconciling)**,以及 phase=`terminal` 的任何 token → **仅记 `late_result` evidence(带 tombstone 的 dispatchId/attempt 关联写入 task_events,供审计与后续对账参考),不参与 T15/T19、不触发任何转移**——历史 attempt 的迟到结果不得确认当前 attempt 的 stop、不得收掉当前 attempt 的对账(T18 重试后旧 tombstone 与新 attempt 并存是**正常态**,非不变量破坏)。**维护性例外(交叉引用,v0.12.12/轮 23·25 deferred P2;语义已由 v0.10.10 锁定)**:本分支(含 phase=terminal)的同 fence 迟到 complete 证据,若 exact-fence 匹配某 poisoned slot,同一证据摄取事务仍作 `releasePoisonedSlot`(§6.1 slots 行)与 §10.4 stop-confirmed/lastProbeDispatchId 清理的输入——「不触发转移」限定 Task phase/outcome,不限定维护性清理;
    任何分支都不返回 receipt、不 conflict、不视为首次消费。本正交化消除 v0.7.2 N6:cancelling→reconciling 的三条入口(T16 / cancelling→T17 / cancelling→T24)不再需要 enterReconcile 改写 beginStop 已写的 cause——revokeCause write-once,路由随 phase 推进自然切换,attempt 相关性由 fenceTuple 匹配承载;
  - fence tuple 任一不符 → reconciling(不得凭旧 ownerTuple 单独放行)——**适用域=token hash 命中 active(未 tombstone)completion authority 的结单尝试**(architecture §6.2);已 revoked token 不适用本条,恒走上方 revoked 路由:历史 token 的 fence mismatch **不得**把当前 Task 推入 reconciling。
- **pull claim 两阶段交付(防双执行;"无执行证据"不构成 takeover 依据)**:`claim_deliveries{claimRequestId PK, offerId, taskId, dispatchId, leaseId, deliveryRevision, state ∈ {delivered, delivery_acked, superseded}, requestDigest, ownerTupleDigest, deliveredStateRevision, activatedStateRevision?, activationReceiptDigest?, lastDeliveredAt, ackAt?}`(与 §6.1 表同构,单一 schema)。
  1. claim commit → receipt 下发,state=`delivered`;**客户端在 `claim_ack{claimRequestId, deliveryRevision}` 成功前禁止开始执行**(lease 处于 `pending_ack`,complete/renew 一律拒);
  2. broker 收 ACK → **封闭 CAS(同 writer 事务全过才转)**:{Task 仍 `leased` 且 revision 匹配、`terminationIntent IS NULL`、deadline/lease expiry 未到、该 lease 仍 `pending_ack` 未 revoked、owner/session/generation 全匹配} → `delivered→delivery_acked` + lease→active + **stateRevision+1**(authority 变化,architecture §6.2)+ 返回 activation receipt;任一不符 → `delivery_superseded`(**不复活**——防 T14/T17 撤权后迟到 ACK 把 lease 改回 active)。**beginStop/enterReconcile/retireGeneration/lease expiry 同事务把未 ACK 的 delivery 标 `superseded`**。同 revision+同 requestDigest 的 ACK 重放 → **仅当当前 Task/lease/delivery authority 仍全匹配**时幂等返回原 activation receipt(稳定字段=持久锚;`leaseExpiresAt` 取当前实时值,§7.3;防 ACK 响应丢失致零启动);authority 已撤(cancel/retire/expiry 已生效)→ `delivery_superseded`(4031),**不返回旧成功**(防 shim 迟到重放后首次暴露 payload;与 §6.1 表规则一致);旧 revision → `delivery_superseded`;
  3. 同 claimRequestId 重放:state=`delivered`(未 ACK)→ 撤旧铸新 completionToken(tombstone=revoked, revokeCause=`delivery_superseded`, revokedAuthority=never_activated)+`deliveryRevision+1` 重发;state=`delivery_acked` → 不轮换,返回 `claim_already_active`(delivery 已激活;caller 走 `await_result`)。
  - **实现义务(可信 adapter shim,非模型义务)**:pending receipt 阶段 payload/token 不暴露给模型;shim 自动幂等 ACK,成功取得新 stateRevision 后才把任务交给模型;T5/renew/complete/EffectContext(PEP)一律要求 `lease.status=active`。承诺口径 = **至多一个 delivery revision 获得执行权**(非 exactly-once start:ACK 后 shim crash 由 lease expiry/reconcile 恢复)。⚠architecture §8.1 的领取序「claim→执行」须补 ACK 步——列入 architecture 同步修订建议(不构成矛盾:§8.1 为概述,本节为其协议细化)。
  wire 报文随 §7;本节锁存储、状态机与判据(架构依据:未证停不得产生重叠执行,architecture §6.1)。

### 5.4 reconciliationReason 注册表(v1 封闭;architecture §6.1 开放枚举实例化)

| reason | 进入 | 授权清理(进入事务内) | 合法出口 |
|---|---|---|---|
| `dispatch_ack_missing` | T8 | lease revoke+token tombstone | T18/T19/T20 |
| `resume_apply_uncertain`(v0.9.6) | T17 扩展(applyDeadline 到;beginStop 遇 applying 时=intent abandoned+reason 随 enterReconcile 走 T16/T17 既有边,非独立 trigger) | 同 T17 副作用列;applying intent 置 abandoned 入对账输入 | T18/T19/T20(**T18 按其原 guard:证停+无 effect+retryClass——不设「输入证实未注入」额外判据;attempt-scoped 输入随旧 attempt abandoned,重试后 caller 经轮换 receipt 重供**,轮 24) |
| `lease_expired` / `owner_identity_retired`(+retirementReason)/ `executor_lost` | T17 | 同 T17 副作用列 | T18/T19/T20 |
| `cancel_uncertain` | T16 | beginStop 已执行 | T19/T20(尊重 cancelRequested) |
| `effect_uncertain` | T24 | permit/attempt/lease 状态封存 | T19/T20/**T18(v0.11.3 #19:仅聚合 not_applied 且完整 guard,§12.7)** |

### 5.5 verification 转移(正交字段,非 phase;§6.4 architecture 四支的触发)

| from | 触发 | to |
|---|---|---|
| —(enterTerminal 时判定) | outcome≠succeeded 或 effective mode=none | not_applicable |
| —(enterTerminal 时判定) | outcome=succeeded 且 mode≠none;verifier/spec ref 有效(无效→执行前 fail-closed,architecture §6.4) | pending |
| pending | predicate runner 完成 / manual verifier 动作(holder 侧,§7 章工具) | accepted / rejected(**rejected 不得降 not_applicable**) |

verification 转移由独立 CAS(`verificationRevision`)驱动,不动 phase/stateRevision;evidence 入 task_events。

### 5.6 定时器 owner 总表(janitor 域;单 janitor,writer 事务,anti-TOCTOU 类 3)

| 定时对象 | 时钟源 | 动作 |
|---|---|---|
| Task deadline(全 phase) | resolvedDeadlineAt | §5.1 deadline fence 路径 |
| ExecutionLease 过期 | lease.expiresAt | **按 lease.status 分流:`pending_ack`→T6b(执行权从未激活,不进 reconciling);`active`→T17** |
| ClaimOffer 过期 | offer.expiresAt | offer tombstone |
| dispatchAckDeadline | tasks.dispatchAckDeadlineAt | T8 |
| claim ackDeadline(pull 交付未确认) | claim_deliveries.lastDeliveredAt+ackTimeoutMs [default 30s] | T6b |
| resume applyDeadline(v0.9.6) | outbox(resume_intent).applyDeadlineAt | T17 扩展 trigger(reconciliationReason=resume_apply_uncertain,§7.4) |
| poisoned slot 补扫(v0.9.6) | runtime_execution_slots.state=poisoned_unresolved | releasePoisonedSlot(仅 exact-fence 证据,§6.1;无证据=保持) |
| wake_reeval(Chunk 6 增补 v0.12.3,§13.3 F8) | rs_.nextWakeEligibleAt / rs_.manualAcceptPendingSince / idle 静默达标 / human-first 解除 | 对有 pending queued 且无 live wake 的 rs_ 重评唤醒门(防合法 suspension 后永不醒) |
| governance_drift(Chunk 6 增补 v0.12.4-v0.12.6,§5.1 fence④) | room admin 更新标记的 **pre-dispatch Task(governanceReevalPending;from∈T21 集)** | 补跑 T21 superseded;**已 dispatch Task 不入本行**(grandfather 或走 beginStop/reconcile,§5.1) |
| circuit probe 卡死收口(Chunk 4 增补 v0.10.7,§10.14#12) | provider_circuits.probeDeadlineAt | CAS `{state=half_open, probeDispatchId=扫描值, probeDeadlineAt=扫描值}` → **transitionCircuitToOpen(probe_timeout)**(§10.4 reducer:probe 移 lastProbeDispatchId+新 cooldown)+**同事务对该 probe dispatch 发 interrupt/drain outbox(轮 38:旧 provider call 停止义务走 §5 既有收口,新 probe 由占用 guard 挡到其终局)**;stale timer=no-op。**probe 终局 CAS 不设 deadline fence——先到先赢**(终局事务与本 timer 互斥于同一 {state, probeDispatchId, probeDeadlineAt} 三元;deadline 已过而 janitor 未跑时到达的真实 result 照常收口,系合法证据非迟到覆盖) |
| queued defer 到期 | tasks.nextEligibleAt / retryNotBeforeAt | phase-preserving:queueReason→ready(reactivation owner=janitor,防永久卡 defer)。**provider_wait 任务的专属 guard(Chunk 4 增补 v0.10.8+轮 39 open 分支三分:reactivation 先同事务 reconcile circuit)**:读 waitingCircuitRef 桶当前态——closed→ready;**open ∧ now<cooldownUntilAt→重排 nextEligibleAt=cooldownUntilAt;open ∧ now≥cooldownUntilAt ∧(lastProbeDispatchId 空或 stop-confirmed)→ready(下一 dispatch 可抢 probe);open ∧ now≥cooldownUntilAt ∧ 旧 probe 未证停→同事务 circuit open 自环 CAS(expected `{state=open, version=读取值, cooldownUntilAt=扫描值, lastProbeDispatchId=扫描值}`,写 `{cooldownUntilAt=now+circuitCooldownMs, version+1}`——轮 40 P2:三元显式;**轮 41 P2/v0.12.12:expected 补 `lastProbeDispatchId=扫描值` 四元**——防并发 stop-confirmed 清理(§10.4,该清除不推 version)刚清 ref 后,本扫描按已失效读取仍判「未证停」多延一个 cooldown;失配=no-op 重读。原三元无双 probe/永久卡死风险,纯保守收紧)+重排至新 cooldown(轮 39:不写回过去时点,无热循环)**;half_open 且 probeDeadlineAt 已过→**先执行 probe 收口 CAS(上行)再按新 cooldown 重排**;half_open 未过→重排至 probeDeadlineAt——**任务不带着过期时钟变 ready,两 timer 无竞态窗** |
| reconcile 期限 | reconcile_started+预算 | T20 |
| ApprovalChallenge expiry | challenge.expiresAt | §10.1 expiry 出口(T22) |
| WaiterLease 过期 | waiter.expiresAt | 删除等待边 |
| session linger | **rs_.disconnectedAt**(断连时 CAS 写入;重连原子清空)——linger 判定 CAS `{connectivity, currentConnectionEpoch, disconnectedAt}` 三元,防扫描淘汰刚重连会话(§4.6) | retireGeneration(linger_expired) |
| signal_file_gc(Chunk 6 增补) | rs_.lifecycle=OFFLINE(tombstone) | 删除该 rs_ 的 signal-file(§13.1);无对应 live rs_ 的残留文件一并清 |
| worker drain/TTL/stuck-BUSY | worker_processes 各 deadline 列 | **不在本 janitor**:归 worker supervisor 域(architecture §9.2;域表=本文 §10.8——Chunk 4 落地交叉引用),两者互不越界 |

---

## 6. 任务面存储 schema 映射(§0-A.5;身份表见 §4.11) [NORMATIVE]

### 6.1 表清单(PK/唯一约束/关键列;SQLite 纪律=architecture §11)

| 表 | 主键 | 唯一/索引/关键列 |
|---|---|---|
| `tasks` | taskId | phase/outcome/unknownReason/verification/verificationRevision/stateRevision/queueReason/nextEligibleAt/**retryNotBeforeAt/dispatchAckDeadlineAt/reconcileDeadlineAt/effectMayHaveOccurred**/waitingReason/**waitingScope(pre_dispatch\|in_execution)**/reconciliationReason/**retirementReason**/**terminationIntent**/cancelRequested/**governanceReevalPending(Chunk 6 v0.12.5-v0.12.6:room admin 更新 governancePolicyEpoch 时**仅**对 pre-dispatch Task(T21 from 集)标记的待重评位;governance_drift janitor 索引,§5.6;轮 57 P1-11 域对齐)**/resolvedDeadlineAt/canonical*/effective 快照列族(§6.2 architecture)/**effective 快照列族增列(Chunk 4 落地,§10.11):retryClassBasis(JSON)/effectiveBudgetSnapshotRef(→benv_)**/**waitingCircuitRef(Chunk 4 增补 v0.10.7:T4d 写入/离态清,probe 唤醒索引——broker 着色)**/**waitingBudgetWorkItemRef(Chunk 5 增补 v0.11.5,§10.14#20:T9b 写入/离态清,grant 全量唤醒与全消费者终局判定的索引——broker 着色)**/**resolvedProvider/resolvedRegion/resolvedTargetAccountClass/governanceResolveDigest(Chunk 6 增补 v0.12.5-v0.12.8,§10.14#25b:D-6 冻结的目标厂商/地区/账户等级+来源版本锚(=AB-CANON-1("AgentBridge/GovernanceResolve/v1", {resolvedProvider,resolvedRegion,resolvedTargetAccountClass,endpointRegionRevision,activationGrantVersion});domain 入 §16.3);轮 59 P1-F drift fence——direct 取目标 endpoint.provider+endpoint.region(§4.1,轮 58 SSOT);dedicated/activation 取 endpoint.provider+activation_grant.region;fallback 取选中 dbind 对应 endpoint;三路同源写此,§5.1 fence 读此)**/**effectiveDataGovernance(Chunk 6 增补 v0.12.1-v0.12.2,§10.14#23:broker 着色 JSON,书挡① 从 room(§6.1 rooms 表;r63 P2-13:原「§6.5-gov」为无效锚)派生并冻结的数据治理快照,I-4/architecture §10.2 carrier)={dataClassification, accountClass(=envelope.accountClass.**verified ?? "unknown"**——轮 53 F2:declared 不升格 authority,封版 §4.2+architecture §10.2 逐字;declared 仅审计), providerRegionAllowlist:[{provider: string, region: string}](**空集=跨厂商派发 fail-closed,轮 53 F12**;canonical 顺序=(provider, region) 字典序), governancePolicyEpoch: int, roomGovernanceRef(→rooms.roomId)}**/**caller 列族(一列一字段,列名即 CallerRequest 字段名:targetSelector(JSON)/**payload 列组((payloadInlineContent XOR payloadRef)∧ payloadMediaType NOT NULL ∧ payloadSize NOT NULL——r64 N2/v0.12.14:mediaType/size 为两支公共非空列(claim 投影 inline 支同样返回二者,§7.3),XOR 仅约束正文载体二选一;T1 原子写入——r63 P1-5:inline 字节此前无持久载体,accept 后 crash 即丢)**/idempotencyKey/deadlineAt\|ttlMs(两列 XOR 非空,=§7.2 wire 字段名——v0.12.12/R12-P2a:旧记法「requestedDeadline\|ttl」与 §7.2 字段名不一致,统一为 wire 名;resolved 值恒另存 resolvedDeadlineAt)/requestedCostPolicy/requestedApprovalPolicy/requestedVerificationPolicy/requestedAcceptanceSpecRef/expectedDeliverable/dataClassification/onCallerLoss/requestedContext(JSON))**/**authctx 列族(同规则:authenticatedPrincipalId/originKind/originInstallationId/originEndpointId/originRuntimeSessionId/originTurnId/originAttestationRef/policyEpoch/originInvocationId/callerTaskId/callerDispatchId/lineageContinuationRef)**/createdAt/terminalAt。行级 CHECK=形状约束(§5.1);转移由 reducer+trigger 强制 |
| `task_results` | taskId | **inlineContent XOR artifactRef(CHECK)**/mediaType/size/resultDigest/evidenceRefs(JSON)/nextAction?(仅 terminal denied,architecture §6.2 Result schema 全字段) |
| `task_events` | (taskId, eventSequence) | append-only;kind 枚举含 execution_started/late_result/reconcile_started/legacy 证据族;eventSequence 与 stateRevision 分离(architecture §6.2) |
| `idempotency_keys` | scopeDigest(AB-CANON-1("AgentBridge/IdempotencyScope/v1", 五字段)) | → taskId;payloadDigest+**requestSemanticDigest(§7.2,Chunk 3 增补)**(同 key 任一 digest 异=conflict) |
| `claim_offers` | offerId | claimTokenHash 唯一;**offeredStateRevision**(T3 三方相等 guard);candidateOwner 四层+generation;expiresAt/consumedAt/revokedAt;每 (taskId, candidateOwner) 至多一 active |
| `execution_leases` | leaseId | completionTokenHash 唯一;**dispatchId**;(taskId) 至多一 active;**status ∈ {pending_ack(pull 交付未确认,§5.3), active, closed(正常结单收口), revoked}**;ownerTuple 四层+generation/leaseEpoch/attempt/expiresAt/revokedAt;push 扩展:completionHolder=broker_adapter/holderInstanceId/holderGeneration(architecture §6.2) |
| `runtime_execution_slots`(Chunk 3 增补 v0.9.2,§7.3;**occupancy 与 lease status 正交**) | (runtimeSessionRecordId, generation) | leaseId/dispatchId/taskId/heldAt/**state ∈ {held, poisoned_unresolved}(v0.9.5)**;T3/T4 事务内 insert,冲突→4013——**且 T3/T4 guard 检查同 runtimeSessionRecordId 的任意 generation 是否存在 poisoned slot(v0.9.6:session 级隔离;generation roll ≠ stop 证据,滚代不解锁)**;**poison 谓词(v0.9.6,与 outcome/转移编号无关)**:`terminal 时存在执行风险(旧 turn 未证停的 attempt——T20 全部 outcome(unknown/expired/cancelled)、D2 的 interrupt/drain 未 ack 等)且无 exact stop 证据 → poisoned_unresolved`;conclusive 收口(证停/正常结单/T6b never-activated/pre-dispatch)才释放;**释放唯一入口=`releasePoisonedSlot(slot, evidenceRef)` CAS reducer(v0.9.6)**:evidence 必须 **exact-fence 匹配 {rs_, generation, taskId, dispatchId, leaseId}**——合法证据封闭集={同 fence 迟到 complete(§5.3)、同 drain target 的 interrupt/drain ack、精确 {pidStartTime, launchNonce} 的 worker waitpid exit-observed(supervisor 先持久 exit 证据再调本 reducer)}——**「host-session-ended」类证据 v1 不设**(无可信 producer/schema,轮 24 删;引入=本文修订+证据 schema 先行);**disconnect/lease expiry/泛化 executor_lost/历史 attempt 证据/generation roll 均不得释放**;证据摄取事务直接调用+启动/janitor 补扫(§5.6 增行);跨代 scheduler eligibility(§4.4「terminal unknown 释放」)仅治理旧代 overlapRiskSet 记账,**不解除本表 session 级 poison**(同一物理 session 未证停);liveness 如实声明:同 rs_ 滚代不解锁,新 hostNativeSessionId(新 rs_)=新会话新槽 |
| `completion_token_tombstones` | tokenHash | **disposition ∈ {consumed, revoked} 互斥 CHECK**;consumed 列族(firstOperationDigest/receiptRef/consumedAt)/revoked 列族(revokedAt/**revokeCause(write-once 审计)/revokedAuthority ∈ {activated, never_activated}**/reconcileRef;CHECK:delivery_superseded ⇒ never_activated);fenceTuple 含 push 完整 tuple;**迟到 complete 路由=f(revokedAuthority, fenceTuple 匹配当前 stop/reconcile 目标 attempt, 当前 Task phase),不读 revokeCause;历史 attempt token 恒 evidence-only**(§5.3) |
| `claim_deliveries` | claimRequestId | offerId/taskId/**dispatchId/leaseId**/deliveryRevision/**state ∈ {delivered, delivery_acked, superseded}/requestDigest/ownerTupleDigest/ackAt/deliveredStateRevision/activatedStateRevision/activationReceiptDigest**(ACK 幂等重放的持久载体;**ACK-success 重放须重验当前 lease/Task authority,撤权后返回 4031 而非旧成功**——防 shim 迟到重放后首次暴露 payload)/lastDeliveredAt(§5.3 两阶段交付) |
| `completion_receipts` | completionOperationDigest | taskId 索引;outcome/resultDigest/respondedAt |
| `dispatch_attempts` | dispatchId | (taskId, attempt) 唯一;不可变基础列+resolvedContextBasis+push 扩展列(adapterInstanceId/adapterGeneration/executorInstanceId/executorGeneration/protocolCorrelation);correlationKey 部分唯一 per adapterInstanceId(send 前持久化);**providerCircuitRef(Chunk 4 增补 v0.10.8,§10.14#14:书挡② 写入的 circuit 桶 ref——书挡③/probe/恢复只按此更新,不重解析)**;**Chunk 5 增补 v0.11.2(§10.14#16):completionRequestId/completionExpectedStateRevision(write-once,§11.1)+UNIQUE(adapterInstanceId, rpcRequestId)(含终局行,§11.2)**;**lastSuspensionOrdinal(INTEGER NOT NULL DEFAULT 0,CHECK ≥0——r65 N4' 形状封闭;T9a/T10 再挂起收口因果 guard 的持久锚,§7.4;推进=受理事务内 CAS observedOrdinal==本列+1)** |
| `dispatch_attempt_events` | (dispatchId, seq) | append-only;kind=architecture §6.2 枚举 |
| `task_route_ownership` | taskId | deliveryOwner+ownerEpoch;首 dispatch 前 CAS 一次(T3/T4 事务内) |
| `waiter_leases` | waiterId(`wtr_`,r63 P2-11) | **全列=architecture §6.3:originInvocationId/callerTaskId?/calleeTaskId/connectionEpoch/expiresAt**;calleeTaskId 索引;**创建与环检测同 writer 事务**(insert 前沿活 WaiterLease 判 wait-for 成环 → `would_deadlock` 拒,不落库);boot 全删(§4.6);**cancel/expired 经 beginStop 即删,enterTerminal 仅幂等 backstop**(§5.1) |
| `suspension_action_tokens` | tokenHash | (taskId, action) 至多一 active;绑定列=architecture §6.3;**expiresAt/revokedAt/revokeReason**/consumedAt/rotatedFromHash;**仅 read-only `await_result` 轮换续用,mutating 动作 token 一次性消费不轮换**(architecture §6.3) |
| `artifacts` | artifactRef | mediaType/size/storagePath/refCount/lastRefAt(GC=refCount 0+宽限) |
| `artifact_uploads`(Chunk 3 增补 v0.9.2,§7.5;多对多 uploader authority) | (artifactRef, uploaderPrincipalId) | uploaderRsId/uploadedAt |
| `artifact_references`(Chunk 3 增补,§7.5) | **(artifactRef, taskId, role, presentationScopeRef)——scope 入主键(Chunk 5 v0.11.3,§10.14#18 修正:''=非 presentation 哨兵;同 Task 多 workItem 引同一 content-addressed artifact 不碰撞)** | role ∈ {payload, result, input, callback, **evidence**, presentation};addedByPrincipalId/addedAt;引用入口同事务验证既有 authority 后写入;**tagged CHECK:role=presentation ⇔ presentationScopeRef ≠ ''(=workItemRef)** |
| `suspension_submissions`(Chunk 3 增补,§7.4) | actionTokenHash | taskId/action/requestDigest/inlineContent XOR artifactRef(CHECK)/mediaType/size/receivedAt/**resultingStateRevision/submissionReceiptDigest(v0.9.2:重放锚全量持久)**;同 token 同 digest 重放→原 receipt |
| `outbox` | seq | kind ∈ {**dispatch_intent**, wake_signal, presentation, notification, **interrupt**, spawn_intent, shutdown_notice, **resume_intent(Chunk 3 增补 v0.9.2:supply_* 后 executor 取正文指针,§7.4;payload 仍零正文)**};state ∈ {pending, sent, **applying(r63 P1-3/v0.12.13:resume_intent 专属三段中态 sent→applying→acked(§7.4 v0.9.5 引入)——generic 封闭枚举此前漏列,按旧表建 CHECK 会使 begin_apply_submission 物理不可达)**, acked, **abandoned(+abandonReason)**, **wake_kind(Chunk 6 v0.12.7,轮 58 P1-3:wake_signal 行的 generic state 固定哨兵——其生命周期由 wakeState 承载,§13.4)**}(**pending→abandoned 与 sent→abandoned 均合法**);**kind×state tagged CHECK(r63):state=applying ⇒ kind=resume_intent;state=wake_kind ⇔ kind=wake_signal;kind ∉ {resume_intent, wake_signal} ⇒ state ∈ {pending, sent, acked, abandoned}**;**taskId/dispatchId/ownerEpoch/targetRef 列**(sender 重验依据);**operationKey 唯一**;与转移同事务写入;payload 零正文;**sender claim 时重验按 kind 分支(v0.9.3 正交化)**:`dispatch_intent` 仅 `{phase=dispatching + 精确 current task/dispatch/ownerEpoch 匹配}` 可 CAS `pending→sent`(原封版条件逐字保留,仅按 kind 显式化);`resume_intent` 仅 {phase=running + lease active + 精确 task/dispatch/ownerEpoch 匹配} 可 sent(失配/cancel/reconcile/terminal → abandoned,永不 retarget);其余 kind 按各自定义节(已 reconciling/terminal/stop 的 intent 由 T8/beginStop/enterReconcile/enterTerminal 置 abandoned,不外发);resume_intent 的 `targetRef=submissionRef`,operationKey=`resume:<submissionRef>`;**resume_intent 状态扩展(v0.9.5,仅该 kind):sent→applying→acked,专属列 applyingAt/applyDeadlineAt/ackedAt(v0.9.6;begin CAS 同事务写 deadline)**+同 (taskId, dispatchId) 至多一条 live(pending/sent/applying)部分唯一(§7.4);**spawn_intent 专属列(Chunk 4 增补 v0.10.2,照 resume_intent 先例):sentAt/spawnAckDeadlineAt(§10.8 事务 2 持久写;恢复对账时钟源)**;**wake_signal 专属列(Chunk 6 增补 v0.12.3-v0.12.5,§13.3):rs_/generation/brokerBootEpoch/signalRevision/snapshotBody/snapshotDigest/isCleanup/tatCharged/wakeState/applyingAt;wakeState 为该 kind 的 tagged 子状态(generic outbox.state 对 wake_signal 恒 dispatching-无关,由 wakeState 承载生命周期;§7 通则的 outbox.state 语义不适用本 kind——tagged ownership,轮 56 P1-1);**部分唯一 `(rs_, wakeState) WHERE kind='wake_signal' AND wakeState IN (pending,applying)`(轮 56 P1-1:每 rs_ 至多一 pending+一 applying,successor 不撞键——与 §13.3 reducer 一致)**;operationKey=`wake:<rs_>:<signalRevision>`(coalesce/rebase 铸新 signalRevision 时同事务更新 operationKey,轮 57 P2)** |
| `rooms`(Chunk 6 增补 v0.12.2-v0.12.3,§10.14#25:architecture §10.2 room 级治理 owner;**policy_control 资产,§12.9——writer 仅 admin plane**) | roomId(`room_<ULID>`,§1.3 通则;**v1 default room 由首次 broker 启动经 (installationId) 唯一约束 get-or-create seed——非确定性 ID,以唯一约束保证单例,轮 55**) | installationId 唯一(v1 单 room);**dataClassificationDefault∈{unspecified,restricted}/accountClassPolicy∈{allow_unknown,require_known} **[USER-DECISION→DS-2 默认充填,§15]**/providerRegionAllowlist:[{provider,region}](canonical (provider,region) 字典序;空=fail-closed)/governancePolicyEpoch(单调,admin 变更 +1,CAS)/updatedAt**——task effectiveDataGovernance=书挡① 从此派生+**最保守合并 caller 请求(caller 只能收紧;caller wire 仅提供 dataClassification(§7.2)→取 max(room default, requested);providerRegionAllowlist 无 caller wire 字段,恒取 room 值——轮 57 P2:v1 不提供 caller allowlist,交集措辞删)** |
| `approval_records`(Phase 1B deny-only) | approvalRecordId | **列:taskId?/authenticatedPrincipalId/decision ∈ {recorded_deny, recorded_note, recorded_not_protected}/operationDigest?/policyEpoch/**sourceChannel+sourceEventId+UNIQUE(authenticatedPrincipalId, originRuntimeSessionRecordId, sourceChannel, sourceEventId)(轮 48 #17 同步:四列物理键,channel↔decision tagged CHECK)**/evidenceRef/decidedAt/**protectedManifestDigest/hmacKeyId/hmacVerified/escalation 五列组(write-once)+tagged CHECK 全套(§11.3)**(仅记录卫生,不解锁 effect——architecture §16 交付边界);G-5 后由 §12 表族取代 |

- Phase 1B legacy 证据 = task_events kind=legacy_completion(字段=architecture §16),不建独立表。
- **§4.11 增列**(随本章一并生效):`runtime_sessions` 增 `disconnectedAt`(§5.6 linger 时钟)。

### 6.2 列 owner 着色(§6.2 architecture 禁填集的存储接线)

| 着色 | 写者 | 列族(tasks 及关联表) |
|---|---|---|
| `caller` | 调用方 wire(经校验) | **=§6.1 tasks 行 caller 列族逐字(单一 SSOT,本表不复抄——r63 P2-9/v0.12.13:旧摘抄漏 targetSelector/requestedContext 且 deadline 列名未随 v0.12.12 同步)**:targetSelector/payload 列组((payloadInlineContent XOR payloadRef)+payloadMediaType+payloadSize 公共非空,r64 N2)/idempotencyKey/deadlineAt\|ttlMs/requested* 全族/expectedDeliverable/dataClassification/onCallerLoss/requestedContext |
| `authctx` | 认证 adapter/broker 带外 | authenticatedPrincipalId/originKind/originInstallationId/originEndpointId/originRuntimeSessionId/originTurnId/originAttestationRef/policyEpoch/originInvocationId/callerTaskId/callerDispatchId/lineageContinuationRef |
| `broker` | broker 判定/派生 | phase/outcome/verification/全部 revision/effective* 快照/所有 token hash/lineage/budget/resultDigest/route ownership |

wire body 出现 `authctx`/`broker` 着色字段 → `forbidden_field` 整条拒;`resultDigest` 由 broker 计算或验证(caller 提交 result 内容,digest 归 broker)。

### 6.3 事务边界索引

| 写路径 | 事务定义 |
|---|---|
| accept(T1/T2) | 书挡①(architecture §6.6;quota_rejected 不生成 taskId) |
| dispatch(T3/T4) | **共用 dispatch-bookend reducer** = 书挡②(reserve 失败原子出口:nextEligibleAt 重排 / T9b waiting_input(budget) / terminal——不得回滚后仍 eligible 热循环,architecture §6.6) |
| complete(T6/T13) | §6.4 幂等 CAS + §5.3 tombstone(receipt+tombstone+terminal 原子) |
| suspension(T9/T11/T12) | architecture §6.3 receipt/token 轮换;approval 腿 §10.1 |
| terminal 全族 | **enterTerminal reducer** = 授权清理 + 书挡③ settlement(幂等 UsageEvent→held 释放→terminal receipt 原子,architecture §6.6) |
| reconcile 出入(T8/T16/T17/T24→T18/T19/T20) | 进入=授权清理同事务;出口=书挡②/③ 衔接 |
| janitor 各项(§5.6) | 独立 writer 事务,anti-TOCTOU 类 3 |

### 6.4 Phase 1B migration 冻结前置(如实声明)

本章交付后,冷读者可**起手**:Task reducer 骨架与转移表实现、任务面表结构草案、completion/claim/suspension 的 CAS 逻辑。**尚不能冻结**:SQLite migration 终版(等 §10 章 RootAdmissionContext/TaskLineage/最低 structural budget 列级 schema——书挡①/②/③ 的预算列引用它们,architecture §16)(任务面 wire 报文已随 §7 交付,v0.9.10;**§10 列级 schema 已随 v0.10 交付——本前置解除以 §10 封版为准,见 §10.13**)。本章不声称"可独立冻结 migration"。

---



## 7. MCP 工具 schema 三面(§0-A.3 + carry-in「Claim/Complete 专项 conformance schema」)

### 7.1 通则 [NORMATIVE]

- 本节定义 **wire 方法**(v3 socket,§2 framing;每请求 `params.auth` 按 §2.6)与 **shim 投影**(MCP 工具名)两层。**wire 方法名以本节为准**;architecture 散文名(`complete_task`/`preview_request` 等)为同义引用。MCP 工具名 = 方法名 `.`→`_`(`task.submit`→`task_submit`);`ask_claude`/`ask_codex` 糖保持原名。**wire-only 封闭集(恒不投影,轮 22 定)= {task.claim_ack, task.begin_apply_submission, task.fetch_submission, task.ack_submission}**——模型侧 `task_claim` 是 shim 复合操作(§7.3),resume 三方法是 shim 内部纪律(§7.4;模型可 ACK=输入可在 apply 前被丢弃);四方法同属 §1.3 未知字段 fail-closed 方法集。
- **shim 隐藏 ≠ 授权**:投影矩阵(§7.9)只是 UX 收窄;服务端 `authorize()`(§2.4 单一 authorizer)对每方法独立强制,未投影的方法被直接调用时按 §2.4/§4.9 拒(`capability_disabled`/`not_paired` 等)。**carve-out(Chunk 5 增补 v0.11.2)**:认证 hook 通道方法(`pep.check`,§11.3)不属本节 wire 方法族,不入下方矩阵与 §7.9 投影——其授权定义在 §11.3。
- **方法→authority 矩阵(封闭;§2.6-5「方法级授权」与 §2.6「方法专属 authority set」的静态输入)**:

| 方法 | 并发类 | capability/前置 | 对象 authority(同事务重验,§2.6) | 主要失败码 |
|---|---|---|---|---|
| task.submit(含 ask_* 糖展开) | submit 类 | bound + task_core_v1 | 书挡①(idempotency/lineage/quota) | 4013/4042/4044/4057/4058/D-6 族 |
| task.cancel | control 类 | bound | origin principal == authctx(或 admin plane) | 4053 |
| task.lookup_by_idempotency_key | control 类 | bound | authctx 强制作用域 | — |
| task.peek_pending | control 类 | bound + canStartTurn | resolved-target 过滤(只见己方) | — |
| task.preview_request | dispatch-slot 类 | bound + canStartTurn | **Task resolved target == 调用会话**(binding/bindingEpoch/rs_/generation) | 4053 |
| task.claim | dispatch-slot 类 | bound + canStartTurn | offer 有效 + **offer.candidateOwner == 调用会话(四层+generation)** + rs execution slot 空闲(§6.1 slots 表) | 4045/4053/4013/4030 |
| task.claim_ack(wire-only,不投影) | control 类(禁被槽阻塞) | 同 claim | §5.3 封闭 CAS + **slot 仍归本 lease** | 4031 |
| task.renew_lease / task.complete | control 类 | bound | lease/completionToken authority(**先按 token 解析归属**,§7.3) | 4046/4047/4048/4049 |
| task.await_result / supply_input / supply_callback | control 类 | bound + **suspension_v1(feature)** | 动作 token 绑定元组 | 4050/4041 |
| task.fetch_submission / task.begin_apply_submission / task.ack_submission **首次**(pull resume 三段;**wire-only 不投影**,§7.4) | control 类 | bound + suspension_v1 | 当前 dispatch executor + lease active + 状态 guard(fetch=join state:sent;begin=CAS sent→applying;首 ACK=CAS applying→acked) | 4053 |
| task.ack_submission **acked 重放**(§7.4 独立 guard,轮 25) | control 类 | bound + suspension_v1 | **仅 authenticated caller + 持久 owner tuple/receipt——不要求 current lease/phase**(终态后迟到重放仍得原响应) | 4053 |
| artifact.put / artifact.get | control 类 | bound(get:provisioned holder 例外,限工单引用携 workItemRef) | put=本人上传;get=引用 authority(§7.5) | 4054/4055/4056 |
| approval.peek_work / claim_approval / submit_* | control 类 | **feature=approval_holder_v1;capability=canPresentApproval(submit_approval 另需 canAttestHumanGesture);hard gate=G-5(§4.8:G-5 前全部 holder 方法 capability_disabled);前置=provisioned** | workItem/动作 token 绑定 | capability_disabled/4050 |
| status / pairing.claim / pairing.status | control 类 | —(unassigned 可用,§4.9) | — | — |

- 安全承重方法(submit/claim/claim_ack/complete/cancel/suspension 动作/**resume 三方法(begin_apply/fetch/ack_submission)**/holder 族)未知顶层字段 → `unknown_field` 拒(§1.3);body 出现 authctx/broker 着色字段 → `forbidden_field`(§6.2);**方法层形状违例**(XOR 违反/枚举外值/长度超限)→ `invalid_params`(4058;传输层 JSON 解析失败仍走 JSON-RPC -32700/-32600,不入 4xxx)。
- **inline 内容上限**:payload/result/input 的 `inlineContent` ≤ 64 KiB [default,可 policy 收紧](§1.3 string 默认上限的显式放宽);超限 → `payload_too_large`,改走 artifact 面(§7.5)。
- 客户端铸造 ID 增补:`creq_`(claimRequestId)、`cmpl_`(completionRequestId)——仅幂等/关联键,不构成 authority(§1.3 增补,轮 18)。

### 7.2 提交面 [NORMATIVE]

```text
task.submit {
  auth,
  request: {                                  # caller 列族(§6.2),全部 caller-authored
    targetSelector: {endpointId} | {runtimeSessionRecordId}
                  | {dedicatedPolicy: {targetClass: "claude_session"|"codex_worker",
                     mode: "require_pinned"|"activate_if_supported"|"soft_fallback",
                     profileId?, activationTimeoutMs?, fallbackChain?: []}},   # architecture §6.2/§6.3(D-6)
    requestedContext: RequestedContext,       # §9
    idempotencyKey: string(≤128),             # 必填;作用域=§6.1 IdempotencyScope
    deadlineAt: int XOR ttlMs: int,           # 二者并存→4058 拒;都缺→ttlMs=3600_000 [default,可 policy 收紧]
    payload: {inlineContent: string} XOR {payloadRef: "sha256:…"},   # + mediaType, size;
                                              # inline 支于 T1(durable accept)事务原子持久于
                                              #   tasks.payloadInlineContent(§6.1 payload 列组,
                                              #   r63 P1-5/v0.12.13——T1 commit 后 crash,claim 投影
                                              #   (§7.3)仍可重建正文,零丢失窗)
    expectedDeliverable: string(≤256),
    dataClassification: "unspecified"|"restricted",   # [USER-DECISION→DS-2] 细分词表;restricted→I-4 保守侧
    requestedVerificationPolicy: "none"|"predicate"|"manual",
    requestedAcceptanceSpecRef?: string,      # predicate/manual 时;v1 无有效 verifier registry → 书挡① fail-closed
                                              #   (architecture §6.2/§6.4),wire 形状先行
    requestedCostPolicy?: {maxCostMicros?, maxOutputTokens?, maxAttempts?, onBudgetExhausted?},  # 只能收紧;
                                              #   数值语义与默认值随 §10,本节只锁形状;
                                              #   maxAttempts=1 ⇒ effective retryClass 收紧至等效 forbidden(§8.3)
    requestedApprovalPolicy?: null,           # v1 仅接受缺席/null(非 null→4058);approval 行为语义=§12
                                              #   决策表接线,**v1 无 caller 词表——开放 caller 级 approval
                                              #   policy=新 protocol feature+本文修订(r63 P2-13:原
                                              #   「词表随 §12」已由 §12 交付证伪,§12 未设 caller 词表)**
    onCallerLoss: "detach"|"request_cancel"   # 缺席 default=detach [default,可 policy 收紧]
  },
  syncWaitMs?: int(0–300_000 [default cap])   # F16 同步窗;0=立即 SuspensionReceipt
}
→ result(tagged union,轮 20 修——两支字段集互斥封闭):
  {outcomeMode: "sync_result", snapshot: TaskSnapshot,       # 终态即答含 result(F16,原 invocation 存活窗内)
   resolvedDeadlineAt, effectiveOnCallerLoss}
| {outcomeMode: "suspension", suspension: SuspensionReceipt, # {taskId, stateRevision, reason, displayMetadata?,
   resolvedDeadlineAt, effectiveOnCallerLoss}                #  nextActions:[{action, token, expiresAt}]}
                                                             #  (architecture §6.3 逐字);snapshot 不出现
```

- **TaskSnapshot(统一可观察形状;submit/await/lookup 共用)[NORMATIVE]**:

```text
TaskSnapshot {
  taskId, stateRevision, phase, outcome?, unknownReason?,
  verification, verificationRevision,               # F15 闭环:caller 可观察 verification 全程
  resolvedTarget?: {fallbackUsed: bool, fallbackIndex?},   # architecture §6.3 soft_fallback 显式义务
  result?: {inlineContent XOR artifactRef, mediaType, size, resultDigest, evidenceRefs?, nextAction?,
            provenance?: {provider, requestModel, responseModel, executorSurface, provenanceDigest}}
            # provenance 为 Chunk 4 additive optional 字段(§10.10;broker-owned,仅 terminal 后出现)
}
# verification CAS(§5.5)提交后 broker 必须发 event.taskChanged(含 verificationRevision)——
#   白名单字段的发送义务在此锁定(仅入白名单不构成义务)
```

- **durable accept 前的失败 = typed error,不生成 taskId**(书挡①,architecture §6.6):`quota_rejected`(永久 structural 拒)/`quota_temporarily_unavailable`(暂态,retryAfterMs)/`idempotency_conflict`/D-6 目标解析族(typed names 与判据见下表)/**`data_governance_denied`(4064,§5.1 治理 fence)**/`would_deadlock`/`context_mode_unsupported` 等。
- **D-6 目标解析错误面(§16.2 4032-4040 的判据索引;语义=architecture §6.3 逐字)**:`no_pinned_target`(require_pinned 无 pin)/`pinned_target_unavailable`(exact bindingEpoch 有界 wake/dispatch 失败,不换目标)/`ambiguous_target`(目标不唯一)/`activation_unsupported`/`activation_not_authorized`(无 ActivationGrant)/`activation_timeout`/`activation_failed`/`billing_context_unresolved`/`no_eligible_fallback`。
- **幂等语义收紧**:`requestSemanticDigest = AB-CANON-1("AgentBridge/TaskRequest/v1", request 全字段构造值(§1.4 规则,缺席=null))`,与 payloadDigest 并存;**同 idempotencyKey 且任一 digest 不同(含仅 requestedContext/deadline 变化)→ 4044**,不静默重放旧 Task(architecture §6.2 冲突规则的覆盖闭合;architecture 同步修订建议已列)。**计算时点前移(轮 19 P0)**:digest 在 schema/auth 校验后、**任何 D-6 side-effecting activation/spawn/reservation 之前**计算并写入 `PreAcceptSubmitIntent` 的 idempotency binding(architecture §6.3);**join 谓词 = scope+payloadDigest+requestSemanticDigest 全等**,异值 → 4044 且零 activation side effect;Task accept 时同一 digest 原样转入 §6.1 idempotency 行(preaccept binding 存储细节随 §10)。
- `syncWaitMs>0` 时同事务建 WaiterLease(§6.1;成环→`would_deadlock` 拒,不建 Task——检测于 accept 事务内)。
- **ask_* 糖映射表 [NORMATIVE]**(shim 侧展开为 task.submit;broker 不识别糖):

| 糖 | targetSelector | 其它默认 |
|---|---|---|
| `ask_claude` | dedicatedPolicy{targetClass: claude_session, mode: **require_pinned**}(D-6:无 pin → 4032+remediation,不建 Task) | requestedContext=fresh;onCallerLoss=**detach**(accept 后响应丢失时经 lookup 恢复,不误杀;request_cancel 须显式);syncWaitMs=default cap;idempotencyKey=shim 铸 ULID |
| `ask_codex` | dedicatedPolicy{targetClass: codex_worker, mode: **activate_if_supported**}(仅 managed CodexWorker;billing 不明→4039) | 同上 |

  **shim 键持久化义务**:发送前持久化 `{invocationId → idempotencyKey}`(crash-safe);响应丢失后**必须**以该 key 走 `task.lookup_by_idempotency_key` 恢复,禁止换 key 盲重发(防重复任务)。`reply`/`get_messages` 属 legacy chat-plane(§1.5),不映射任务面。
- `task.cancel {auth, taskId, expectedStateRevision?}` → `{TaskSnapshot}`:置 cancelRequested;**转移按 §5 封闭边分流**(leased+pending_ack→T6b;reconciling→仅置 flag,§5.1;**已 cancelling→幂等返回当前快照,不重复 beginStop**;其余合法 from→T14);已终态→终态快照;授权=**该 Task 的 origin principal(authctx)或 admin plane**,其余(含 taskId 不存在)统一 `task_not_found`(不作在性区分)。
- `task.lookup_by_idempotency_key {auth, idempotencyKey, cursor?}` → `{matches: [TaskSnapshot + {canonicalOperationKind, awaitToken?, awaitTokenExpiresAt?}](≤16, createdAt 降序), cursor?: string(不透明续查游标;全序=(createdAt, taskId),快照语义)}`:作用域强制 `{originInstallationId, authenticatedPrincipalId}` = 调用方(authctx 派生,不可指定他人);`awaitToken` = §3.2-A SuspensionReceipt 动作 token 同族(action=await_result,绑 origin principal/session/stateRevision——architecture §6.3 授权恢复路径)。

### 7.3 执行面(pull;push 走 broker 进程内 reserve_push_dispatch,不经 wire——architecture §6.2) [NORMATIVE]

```text
task.peek_pending {auth}
→ {pending: [{taskId, stateRevision, enqueuedAt, resolvedDeadlineAt,
              expectedDeliverable, dataClassification, payloadSize, mediaType}](≤32), more: bool}
   # 仅本 rs_ 为已解析目标且 phase=queued(queueReason=ready)的任务;零 payload 正文、零 token
   #  (任务契约唯一真值在 broker,architecture §8.1;level-triggered 配套 §13 signal)
task.preview_request {auth, taskId}
→ {offer: {offerId, offeredStateRevision, expiresAt, claimToken("ct1.…" 明文,单次)},
   metadata: {同 peek 行 + originSurface, submittedAt; payloadPreview 恒 null(v1:正文仅经 claim 交付)}}
   # 铸 ClaimOffer(architecture §6.2);同 (taskId, candidateOwner) 至多一 active(§6.1)
   # 【route ACL,轮 18 P0】同事务重验:该 Task 的 resolved target == 调用会话(binding+bindingEpoch+
   #   rs_+generation)且 authorize(canStartTurn);不符或 taskId 不存在 → 统一 4053(不作在性区分)
task.claim {auth, offerId, claimToken, claimRequestId: "creq_<ulid>"(客户端铸,幂等键,§5.3),
            expectedStateRevision}
→ {granted: ClaimSuccessReceipt} | {tombstone: {offerId, reason: "cancelled"|"expired"|"superseded"}}
   # tombstone=architecture §6.5「取消/过期返回同 ID tombstone」的 wire 形状(响应而非 error)
ClaimSuccessReceipt {taskId, deliveredStateRevision, dispatchId, leaseId, leaseEpoch, attempt,
   leaseExpiresAt, deliveryRevision, ackDeadlineAt, resolvedContextBasis?,
   payload: {inlineContent XOR artifactRef, mediaType, size}(inline 支=读 tasks.payloadInlineContent(§6.1 payload 列组);ref 支=payloadRef 透传——r63 P1-5), completionToken: "cpt1.…"}
   # §5.2 T3 单事务;lease 建为 pending_ack;guard 增(轮 18):offer.candidateOwner == 调用会话
   #   (四层+generation)重验 + rs execution slot 空闲(见下)
task.claim_ack {auth, claimRequestId, deliveryRevision}          # wire-only,不投影给模型(§7.1)
→ {taskId, activatedStateRevision, activationReceiptDigest, leaseExpiresAt}
   # §5.3 封闭 CAS + slot 归属重验;错误:4031(superseded/旧 revision/撤权后迟到);
   #   同 {claimRequestId, deliveryRevision} 重放且 authority 完好 → 幂等原 receipt(§5.3-2);
   #   (4030 属 task.claim 的已激活重放面,非本方法)
task.renew_lease {auth, leaseId, leaseEpoch}
→ {taskId, dispatchId, leaseId, leaseEpoch, currentStateRevision, leaseExpiresAt, nextSuspensionOrdinal}
                      #   (r67 G1:回显 lease tuple——客户端 anti-rollback 合并的匹配键,§7.4)
                      # 要求 lease.status=active(pending_ack→4046);**不改 stateRevision**(architecture
                      #   §6.2——currentStateRevision 为只读披露(同一 authority snapshot 读出),非推进;
                      #   r66 F3:reconnect 后 shim 以其更新本地 expected revision,否则丢失响应期间的
                      #   revision 推进会使后续 complete 落 4046/reconciling);
                      #   nextSuspensionOrdinal=lastSuspensionOrdinal+1(r65 N4';恢复域=§7.4 收窄条)
task.complete {auth, taskId, completionToken, completionRequestId: "cmpl_<ulid>",
               expectedStateRevision, outcome: "succeeded"|"failed",
               result: {inlineContent XOR artifactRef, mediaType, size, evidenceRefs?: [](≤16)}}
→ CompletionReceipt {taskId, stateRevision, outcome, verification, completionOperationDigest}
```

- **rs execution slot(轮 18 P0+轮 19/24 修:occupancy 与 lease status 正交,session 级 poison)[NORMATIVE]**:durable `runtime_execution_slots` 表(§6.1;PK=(rs_, generation);state ∈ {held, poisoned_unresolved});T3/T4 guard=**当前 generation 无 held slot 且同 rs_ 任意 generation 无 poisoned_unresolved**(冲突 → `session_busy` 4013——architecture §6.3「单 RuntimeSession 单 in-flight」的持久化);**释放点封闭 = §5.1 reducer 3/4 的 conclusive 收口 + `releasePoisonedSlot`(poisoned 唯一出口,exact-fence 证据,§6.1)**——T17/beginStop revoke lease **不释放槽**(旧 attempt 未收口=未证停,不得重新 dispatch);`claim_ack` 封闭 CAS 增列:**slot 仍归本 lease**。
- **shim 复合投影(轮 18 P0:消除「模型只知旧 revision」自锁)[NORMATIVE]**:模型侧 MCP 工具 `task_claim` = shim 原子复合 `task.claim → task.claim_ack`,成功仅返回 **ActivatedClaimReceipt** `{taskId, stateRevision(=activatedStateRevision), dispatchId, leaseId, leaseEpoch, attempt, leaseExpiresAt, payload, completionToken, nextSuspensionOrdinal(=dispatch_attempts.lastSuspensionOrdinal+1——r65 N4'/v0.12.15:ordinal 恢复 carrier)}`;ACK 失败(4031)→ 工具返回该 typed error,payload/token 不暴露(§5.3 隔离义务的工具面收口)。后续 `task.complete` 的 `expectedStateRevision` = 激活后值。
- **activationReceiptDigest 编码锁定**:= `AB-CANON-1("AgentBridge/ActivationReceipt/v1", {claimRequestId, taskId, dispatchId, leaseId, leaseEpoch, deliveryRevision, activatedStateRevision})`(domain 入 §16.3;GV 随 conformance fixtures)。**重放确定性**:digest 只覆盖稳定字段;响应中 `leaseExpiresAt` = 当前 lease 实时值(**不参与 digest**,renew 后重放响应该字段可不同——如实声明);稳定字段的持久锚=claim_deliveries 的 activatedStateRevision/activationReceiptDigest 列(§6.1)。
- **resultDigest 编码锁定(信封级,防「同 digest 异信封」绕过 conflict)**:`resultDigest = AB-CANON-1("AgentBridge/ResultEnvelope/v1", {mediaType, size, contentDigest(内容字节 sha256 文本形), evidenceRefs(保序数组,缺席=[])})`;**completionOperationDigest** = `AB-CANON-1("AgentBridge/CompletionOperation/v1", {taskId, dispatchId, leaseId, leaseEpoch, stateRevision(=请求 expectedStateRevision), outcome, resultDigest})`(architecture §6.4 H(...) 实例化——「任何字段不同→conflict」经信封 digest 闭合;architecture 措辞同步建议已列)。两 domain 入 §16.3;**附录 GV 与 stdout 锚不变**。
- **complete 的 authority 解析次序(轮 18 P0+轮 19 修:consumed 分支不被 4047 吞)[NORMATIVE]**:①先按 `sha256(completionToken)` 解析 token 归属(active lease 或 tombstone);②`request.taskId ≠ 归属 taskId` → **4046 + 审计,任何 Task 零转移**(不得按请求 taskId 取 Task);③归属一致后**按 tombstone disposition 分支**:`consumed` → 同 completionOperationDigest 重放返回**原 receipt**、异 digest → **4048**(§5.3 重放规则,不受 4047 覆盖);`revoked` → **4047**(路由按 §5.3 三元,evidence 照记);④无 tombstone(active lease)→ pending_ack → 4046;deadline 越线 → 4049(+late_result,§5.1);同 Task fence tuple drift → 该 token 所属 Task 进 reconciling + 4046;`outcome` 只收 succeeded/failed(authorship,architecture §6.1)。
- push 面不出现在 wire:PushCompletionHandle 进程内(§3.2-B);worker 面的 MCP 调用是 broker→worker 方向(`codex()`/`codex-reply()`,architecture §9.2),不是本节 wire 方法。

### 7.4 挂起动作面(SuspensionReceipt caller 动作族;token 语义=architecture §6.3 逐字) [NORMATIVE]

```text
task.await_result {auth, taskId, actionToken, waitMs?: int(≤300_000 [default cap])}
→ 同 task.submit 的 tagged union 两支(sync_result×snapshot / suspension×receipt,字段集互斥)
   # read-only token 轮换续用;创建 WaiterLease(成环→would_deadlock);超时→轮换新 receipt;
   # 终态但 verification=pending 时可持轮换 token 继续 await(F15 闭环:等 verification 结算)
task.supply_input {auth, taskId, actionToken, input: {inlineContent XOR artifactRef, mediaType, size}}
→ {stateRevision, submissionReceiptDigest}     # §5.2 T11b;仅 reason=clarification
task.supply_callback {auth, taskId, actionToken, callback: {inlineContent XOR artifactRef, mediaType, size}}
→ {stateRevision, submissionReceiptDigest}     # §5.2 T12
```

- caller 动作族封闭 = 上述三个;`submit_approval`/`submit_budget_override` 永不出现在 caller receipt(architecture §6.3;§7.6)。token 校验=hash 命中+绑定元组(origin principal/session/stateRevision/action)+未过期未消费,失败统一 `action_token_invalid`。
- **正文 durable 承接(轮 18 P0+轮 19 补全)[NORMATIVE]**:supply_* 的单 writer 事务原子完成:①正文落 `suspension_submissions`(§6.1;含 **resultingStateRevision/submissionReceiptDigest** 重放锚列)②mutating token 消费(不轮换)③T11b/T12 转移④`resume_intent` outbox(kind 入 §6.1 封闭枚举;payload 零正文,仅 `{submissionRef=actionTokenHash, taskId, dispatchId}` 指针;sender=broker→executor 通知取正文;state 机同 outbox 通则,sent→acked/abandoned)。**digest 编码锁定**:`requestDigest = AB-CANON-1("AgentBridge/SuspensionSubmission/v1", {taskId, action, contentDigest(内容字节 sha256 文本形), mediaType, size})`;`submissionReceiptDigest = AB-CANON-1("AgentBridge/SubmissionReceipt/v1", {taskId, action, requestDigest, resultingStateRevision})`(两 domain 入 §16.3)。**重放解析优先级(先于 token 状态校验;不可变绑定仍恒验)**:①请求先过 token 的 **immutable binding 校验**(origin principal/session/task/action——绑定不符恒 4050,不因重放豁免);②按 actionTokenHash 查 submissions 行:命中且同 requestDigest → 原 `{resultingStateRevision, submissionReceiptDigest}`;命中且异 digest → 4050;③无行 → token 状态校验(active→执行四步;expired/consumed-无行→4050)。**正文投递(按 delivery owner 分支;轮 21 修=fetch 绑 live intent,防跨 attempt 取旧输入)**:push=进程内 adapter 直取 submission 行(注入 `codex-reply`);pull=wake 链(零正文)后 executor shim 调:
  - `task.fetch_submission {auth, taskId}`(**wire-only,不投影**;control 类)→ **同事务 join 该 task 当前 dispatch 的唯一 live `resume_intent`**(state=sent 且其 taskId/dispatchId/ownerEpoch == 当前 active lease 的对应值)→ `{submissionRef, dispatchId, leaseEpoch, action, inlineContent XOR artifactRef, mediaType, size}`;**无匹配 live intent(含 intent 已 abandoned/新 attempt 场景)→ 4053**——旧 attempt 的 submission 对新 attempt 不可达(重试后的 Task 以重新交付的 payload 起步,attempt-scoped 输入不跨代);fetch 幂等只读,可重复;
  - **apply 崩溃窗封闭(轮 22 修+轮 23 补全)**:receiver 侧三段状态 `sent→applying→acked`(resume_intent 专属扩展,§6.1 含 applyingAt/applyDeadlineAt/ackedAt 列)。**三方法 guard 拆分(轮 23)**:`task.fetch_submission` 仅 join state=**sent** 的 live intent;`task.begin_apply_submission {auth, submissionRef, dispatchId}`=CAS **sent→applying**+同事务重验当前 tuple+写 **applyingAt=transactionNow** 与 `applyDeadlineAt = min(transactionNow + resumeApplyTimeoutMs [default 60s,可 policy 调,有界正数], resolvedDeadlineAt, lease.expiresAt)`(响应回显 deadline;不随 renew 延期——apply 是短操作,超时=状态不明);`task.ack_submission {auth, submissionRef, dispatchId}`:首次=CAS **applying→acked**(写 ackedAt+**清 applyDeadlineAt**);**acked 重放=独立 guard(轮 24):仅验 authenticated caller + 持久 owner tuple/receipt,不要求 current lease/phase**(ACK 后 task 已 terminal 的迟到重放仍得原响应),同 tuple → 原稳定响应 `{submissionRef, state:"acked", ackedAt}`(真幂等)。**deadline 卫生**:ACK/T9a/T10 progress 收口/T13/T23 收口/abandon 均**清 applyDeadlineAt**;§5.6 timer 触发 CAS 必须重验 `{state=applying, applyDeadlineAt=扫描值, exact task/dispatch/owner/lease tuple}`(任一不符=stale timer,no-op——防 ACK 后旧 deadline 误撤健康 attempt)。**crash 于 applying**:下游注入不可证幂等(`codex-reply` 无 submission 幂等键,architecture §9.2)→ **禁止盲目重送**;janitor 按 `applyDeadlineAt`(§5.6 增行)触发 **T17 扩展 trigger,reconciliationReason=`resume_apply_uncertain`**(走普通 enterReconcile 对账——输入可能已注入,executor 状态不明;**不冒用 T24**,后者 guard 限 EffectAttempt);crash 于 sent(未 begin_apply)=重 fetch 安全。**push 面同 core**:进程内 adapter 注入 `codex-reply` 前后必须调用同一 begin/ack core reducer(进程内≠豁免三段状态)。
  - **live intent 唯一性(轮 22 修+轮 23 精化)**:同 (taskId, dispatchId) 至多一条 state ∈ {pending, sent, applying} 的 resume_intent(部分唯一约束)。**再挂起收口分状态(轮 23)**:T9a/T10 事务遇既有 live intent——`applying` → 置 acked(**同事务写 ackedAt=transactionNow+清 applyDeadlineAt**,与显式 ACK 同字段集;progress 证据:单 in-flight executor 到达下一挂起=已 begin_apply 的输入必已消费);`pending/sent` → 置 **abandoned**+审计(输入从未开始 apply,executor 却前进=异常信号;caller 经 await_result 轮换后重供)。**再挂起收口的因果 guard(r63 P2-7/v0.12.13,受审 additive 收紧——防旧挂起事件延迟副本错误收口未消费输入)**:T9a/T10 铸造事务执行上述收口(applying→acked / pending|sent→abandoned)前,须验挂起事件因果新于该 intent:事件携 **exact fence tuple(task/dispatch/ownerEpoch/lease)+ per-dispatch 单调 `suspensionOrdinal`(executor shim 义务:每次真实挂起 +1 随事件提交;broker persist 于 dispatch_attempts.lastSuspensionOrdinal(§6.1 增列))**;**ordinal 检查仅构成本段末尾唯一受理谓词 `accepted` 的一个只读合取(r67 G2/v0.12.17:不独立 CAS、不独立写 counter——「成功即写入」旧表述废除,counter 写入仅发生于 accepted=true 的统一事务;仍不用 `>` 受理,错误 shim 的极大 ordinal 不得污染高水位)**;重复/跳号/回退或 fence 失配 → 判迟到/重放/异常副本:仅审计(`suspicious_suspension_replay`——**落 `audit_log`(非 task_events),字段封闭 {fence, observedOrdinal, recordedOrdinal},不推进 Task eventSequence(r64 N8)**),**不铸新 SuspensionReceipt、不收口 live intent**(单 in-flight 下,live intent 存在时到达的「更旧 ordinal」挂起事件不可能是真实新挂起);`accepted=true`(唯一判据=本段末谓词,r67 G2)→ 正常铸造+按上述分状态收口。**counter 权威与恢复域(r64 N4+r66 F2/v0.12.16:恢复域收窄,消除与 §5.3「ACK 后 shim crash 由 lease expiry/reconcile 恢复」的分叉)**:ordinal 权威=broker 持久值 `dispatch_attempts.lastSuspensionOrdinal`;**本恢复条适用域=transport reconnect/connection takeover(§4.6,不滚 generation)且 shim 本地执行 authority(completionToken 内存副本、applying submission 状态、当前 expected revision 基线)仍保留**——仅计数与 revision 从 broker 取回:**wire carrier=ActivatedClaimReceipt.nextSuspensionOrdinal 或 task.renew_lease 响应(完整形状严格见 §7.3——七字段,含 `leaseId/leaseEpoch` 回显;r68 H1/v0.12.18:本处不再复抄字段表,消除五/七字段双 schema)**;**本地更新规则=anti-rollback 单调合并(r67 G1:§2.2 允许 control 类并发,响应可乱序——迟到旧 snapshot 不得回滚本地 authority)**:仅当响应回显的 `{taskId, dispatchId, leaseId, leaseEpoch}` 与本地当前 authority tuple 全等才应用;tuple 全等后**三可变量各自独立单调合并** `local = max(local, received)`(currentStateRevision/nextSuspensionOrdinal/leaseExpiresAt——**r68 H2:低分量只忽略自身,不得使同包更高分量丢失;「整包忽略」仅用于 tuple mismatch**;混合新旧分量的迟到响应因此恒取各分量高水位);lease expiry 经本通道**只延长不缩短**(本地预期而已,broker 侧 lease.expiresAt/status 恒权威,T17/§5.6 收口不受影响),撤权/缩短恒走 epoch/status 面;禁止自行从内存重起计数。**真实 shim 进程 crash(本地 authority 丢失)不在本恢复域**:恒走既有 §5.3(ACK 后 crash=lease expiry/reconcile)/T17 路径,**不得凭 ordinal 续用同 dispatch**(completionToken/applying ref 无持久恢复载体,本文不扩此域)。**受理谓词(单一原子,r66 F4——消除「先推进 counter 再审计 ref」的合法误读)**:`accepted = exactFence ∧ observedOrdinal == lastSuspensionOrdinal+1 ∧ (liveIntent IS NULL ∨ liveIntent.state ∈ {pending, sent} ∨ (liveIntent.state = applying ∧ consumedSubmissionRef == liveIntent.targetRef))`(liveIntent=按部分唯一约束查得的 **optional** live resume_intent 行——**缺席支显式为真(r67 G2:防 SQLite 三值逻辑下首次挂起(无 live intent)被 NULL 谓词误拒;实现须显式二值化,禁止裸 scalar/LEFT JOIN NULL 传播)**;consumedSubmissionRef=事件所携「已消费的 submissionRef」,首次挂起/无=null;与 ordinal 互补:前者证输入已消费,后者证事件顺序)——**仅 accepted 时同一事务推进 counter+铸 SuspensionReceipt+T9a/T10 转移+intent 收口;任一失败=仅写 audit,counter/task/outbox/token 全部不变**。**conclusive completion 收口**:同 attempt 的 T13/T23 结单=progress 证据,同事务把 applying 置 acked(**写 ackedAt=transactionNow+清 applyDeadlineAt——一切 applying→acked 路径(显式 ACK/T9a-T10/T13-T23)同一字段写集;CHECK 限域 resume_intent:`kind<>'resume_intent' OR state<>'acked' OR ackedAt IS NOT NULL`——不约束 dispatch_intent 等其它 kind 的 acked;物理 DDL 另要求 kind/state NOT NULL,轮 27/28**);其余 terminal 路径必经 beginStop/enterReconcile(abandoned 在彼处发生)——**enterTerminal 时不应存在 applying intent(不变量);若有=缺陷审计+置 abandoned,不触发任何新转移**(修「terminal 后触发对账」无边可走的矛盾)。
  crash 后恢复:submission 行在 → resume_intent 按状态重发/重取;行不在 → 事务未 commit,token 仍 active,caller 重试;beginStop/enterReconcile 把 pending/sent 置 abandoned、applying 置 abandoned 并携 `resume_apply_uncertain` 进对账输入集。

### 7.5 artifact 面 [NORMATIVE]

```text
artifact.put {auth, mediaType, size, contentBase64}   # 单帧;b64 后总帧 ≤ maxFrameBytes(§2.2)
→ {artifactRef: "sha256:…", size}                     # content-addressed;broker 重算 digest 为准
artifact.get {auth, artifactRef, workItemRef?}    # workItemRef=holder 取工单引用时必填(见下)
→ {mediaType, size, contentBase64}
```

- **digest 不是 capability(轮 18 P0+轮 19 修)[NORMATIVE]**:授权走显式记录,非「知道 digest 即可读」:
  - **多对多 uploader**:`artifact_uploads{artifactRef, uploaderPrincipalId, uploaderRsId, uploadedAt}`(PK=(artifactRef, uploaderPrincipalId)——content-addressed 去重下两 principal 各自上传同内容各得独立 authority,互不覆盖;取代单值 uploader 列);新表 `artifact_references{artifactRef, taskId, role ∈ {payload, result, input, callback, evidence, presentation}, **presentationScopeRef(Chunk 5 增补 v0.11.3:''=非 presentation;role=presentation ⇔ =workItemRef,§12.4)**, addedByPrincipalId, addedAt}`(**PK=(artifactRef, taskId, role, presentationScopeRef)**);
  - **引用入口**(task.submit 的 payloadRef / task.complete 的 result.artifactRef 与 **evidenceRefs 逐项**(定义=artifactRef 数组)/ supply_* 的 artifactRef):同事务验证 caller 对该 artifactRef 的**既有** authority = 本人有 upload 行,**或**该 ref 已附着于其参与的 Task(reference 行存在)——否则 `artifact_not_found`(与不存在同响应);验证过才写新 reference 行(+refCount;evidenceRefs 写 role=evidence);
  - `artifact.get {auth, artifactRef, workItemRef?}` 授权 = 有 upload 行,或存在 reference 行使调用方为该 Task 参与方(origin principal / 当前 executor);**holder 必须携 `workItemRef`**:重验该工单当前 claimed 归本 holder,且存在 reference 行 **exact join `{artifactRef, role=presentation, presentationScopeRef = request.workItemRef, taskId = 该工单关联 taskId}` 全等(轮 45 B6:scope 入授权判定——知道他工单 artifactRef 不构成读取权)**——否则 `artifact_not_found`。
- 尺寸面:decoded 内容 > `artifactMaxBytes [default 512 KiB,可 policy 调整;默认值有意低于单帧 base64 容量使 4054 可达]` → 4054;**超帧本身在 framing 层即 4004**(§2.2,先于本方法);分块上传 [UNSUPPORTED](v1;remediation=落盘工作区自取,应用层自行引用)。孤儿 artifact(refCount=0)按 §6.1 GC。

### 7.6 holder-only control 面(仅 surface=approval_system;§4.8 provisioned + §2.4 G-5 门) [NORMATIVE 形状;启用逐条目]

```text
approval.peek_work {auth, cursor?}                      # holder discovery(轮 18 P0 补;cursor=续查入参)
→ {workItems: [{workItemRef: "appr_…", kind, status, createdAt, expiresAt, presentationDigest}](≤32,
   createdAt 升序防饿死), cursor?: string(不透明续查;全序=(createdAt, workItemRef))}
   # 零 presentation 正文;配套 notification event.approvalWorkChanged{}(仅信号零内容,且只投递
   #   eligible holder=已 provisioned+G-5 过+当前 authorize(canPresentApproval) 通过的 approval_system
   #   连接——policy 已拒的 endpoint 不收信号;工单 pending/expired/cancelled 状态变化必发;
   #   §2.6 白名单增补,轮 25 已 CONFIRMED)
claim_approval {auth, workItemRef}
→ {workItem: {workItemRef, kind, expiresAt,
     presentation:                                       # 封闭 tagged union(per kind)
       effect_approval:    {operationHash, presentationDigest, canonicalContentRef}   # 全语义随 §12
     | budget_override:    {rootAdmissionId, dimension, currentCap, currentUsage,
                            proposedNewCap,              # 必填且 > currentCap;broker policy 派生(轮 20 修:保全
                            budgetRevision,              #   封版 T11a「token 绑 old/new budget」);budgetRevision=
                            budgetSnapshotRef, policyEpoch}  #   铸造时 BudgetAccount.version(轮 22 修:CAS fence 载体);
                                                         # (root, dimension) 至多一 active workItem(唯一约束)
     | manual_verification:{taskId, verificationRevision, effectiveAcceptanceSpecRef, resultDigest, resultRef}},
   actionToken}                                          # 一次性;绑 approval endpoint/generation/principal/
                                                         #   (opHash|rootAdmissionId+dimension+currentCap+proposedNewCap
                                                         #    +budgetRevision+policyEpoch|taskId+verificationRevision)
                                                         #   ——§3.2-A/封版 T11a 逐字兼容+revision fence(轮 22)
   # 幂等(响应丢失恢复):workItem 已被本 holder claim 且未 decide → 撤旧铸新 actionToken 重发
   #   (delivery rotation 同型);被他 holder claim/已 decide → typed error(claimed_elsewhere 并入 4050 场景)
submit_approval {auth, actionToken, decision: "allow"|"deny", attestation: HumanGestureAttestation}
→ ApprovalActionReceipt                                  # allow 腿语义随 §12;deny-only 期 allow→capability_disabled
submit_budget_override {auth, actionToken, decision: "grant"|"deny", newCap?: int}
→ ApprovalActionReceipt                                  # grant:newCap 必填且 **== token 所绑 proposedNewCap**
                                                         #   (否则 4058;需要不同增量=deny 后 broker 按 policy 重铸
                                                         #   新工单/新 proposedNewCap);**决策事务内 CAS:当前
                                                         #   {root, dimension} 的 currentCap/BudgetAccount.version(=token
                                                         #   所绑 budgetRevision)/policyEpoch == token 绑定值**
                                                         #   (并发 grant 已推进 → 本工单置 cancelled
                                                         #   +4050,broker 按新 cap 重铸——防 oldCap 失真的 revision 链);
                                                         #   过 CAS 才 BudgetOverrideGrant{root, dimension,
                                                         #   oldCap=currentCap, newCap, policyEpoch, revision} append
                                                         #   +同事务推进 BudgetAccount.version(v0.9.6)
                                                         #   + T11a;deny:newCap 必须缺席(否则 4058——防同一 deny
                                                         #   的 digest 分叉);
                                                         # deny→仅记 decision evidence,Task 保持 waiting_input(budget)
                                                         #   (出口仍=后续 grant/T21 deadline/T14 cancel——不新增边;
                                                         #    deny 后重开=broker 重铸新 workItem,旧 token 不复用)
submit_verification {auth, actionToken, verdict: "accepted"|"rejected", evidenceRef?}
→ ApprovalActionReceipt                                  # §5.5 manual 支;经 verificationRevision CAS,不动 phase
ApprovalActionReceipt {workItemRef, decisionDigest, outcome: "applied"|"already_decided", decidedAt}
   # decisionDigest = AB-CANON-1("AgentBridge/ApprovalDecision/v1",
   #   {workItemRef, kind, decision: string, newCap: int|null, evidenceRef: string|null})
   #   ——封闭 hash-input(§1.4:全字段必现,缺席=null);decision 取该 kind 的封闭动词
   #   (effect_approval: allow|deny;budget_override: grant|deny;manual_verification: accepted|rejected
   #    ——submit_verification 的 verdict 映射入本字段);不含签名/attestation(其本体入 §12 记录,
   #   不入幂等 digest);domain 入 §16.3
   # 幂等解析优先级(轮 21 修,先于 token 状态判定):①immutable binding 校验(恒验);②按 actionTokenHash
   #   查 decided 行:同 decisionDigest → 原 receipt;异 → outcome=already_decided 且 decisionDigest=
   #   **winner(原决策)的 digest**(architecture §10.1 逐字);③无 decided 行 → token 状态校验
   #   (仅未知/expired/rotated/他属 → 4050)——grant 已 commit 而响应丢失的重放恒得原 receipt,不落 4050
```

- **workItem 状态机(封闭)**:`pending → claimed → decided`;`pending|claimed → expired|cancelled`(expiry/任务终态撤销——**撤销语义按 kind 分派(Chunk 5 增补 v0.11.5,§10.14#21:effect=随其 Task 终态;manual_verification=Task terminal 后保留(§5.5 结算面);budget=root 级共享,全部等待任务终局才撤——§12.4 详)**);decided 行持久存 `{decisionDigest, receipt}`(重放锚);状态行=§12 表族(deny-only 期的记录面=§6.1 approval_records)。**presentation 的 artifact 引用**:workItem 铸造事务对 presentation 中的 artifactRef 类字段(`canonicalContentRef`/`resultRef`——`budgetSnapshotRef` 为预算实体引用非 artifact)写 role=presentation 的 reference 行(§7.5 get 授权依此)。
- **G-5 口径(对齐封版 §4.8,轮 19 修)**:**全部 holder 方法(含 peek_work/claim_approval/三 submit)在 G-5 未过时一律 `capability_disabled`**(§4.8:「claim_approval 等 holder 方法一律 capability_disabled」)——budget/verification 工单在 G-5 前**不会产生**(§6.6 guard:Approval Agent 能力不可用则不进 waiting_input(budget);manual verification 在 accept 时 fail-closed),口径自洽;本节 [NORMATIVE] 仅指 wire **形状**。
- 完整 challenge/attestation/presentation 内容 schema、验签与执行前 revalidation 集合=§12.4/§12.5/§12.6(已交付;r63 P2-13 回填,原「随 §12 占位」)——本节不重复;本节锁:**三类工单同走 peek_work→claim_approval 单一领取面**(token 铸造仅此入口,architecture §6.3/§10.1)、caller receipt 永不含 holder 动作、`submit_verification` token 入 §3.2-A holder 行(增补,轮 25 已 CONFIRMED)。

### 7.7 status [NORMATIVE]

`status {auth}` → `{broker: {brokerVersion, brokerBootEpoch, readiness}, self: {endpointId, endpointGeneration, runtimeSessionRecordId, generation, assignmentState, connectivity, lifecycle, effectiveCapabilities, deniedCapabilities, policyEpoch, attentionPolicy}, queue: {pendingCount}}`——只读、零 token/secret/正文;`queue.pendingCount` **作用域=self**(本 rs_ 为 resolved target 的 queued(ready) 计数;unassigned/revoked 会话恒 0——不泄露 workspace/全局负载);unassigned/revoked 会话可用(§4.9 allowlist)。

### 7.8 Claim/Complete 专项 conformance schema(carry-in,HANDOFF §J.3-b) [NORMATIVE]

- **载体(封闭 DSL;轮 18 重写为可机器执行)**:

```text
ConformanceSuite {suiteId: "claim_complete_v1", suiteVersion: int, cases: [ConformanceCase]}
ConformanceCase {
  caseId: string(套件内唯一;必含集见下),
  mode: "pull"|"push"|"any",
  setup: [SetupOp],          # 封闭 tagged union:
    # {op:"seedSession", ref}                          | {op:"seedTask", ref, submitParams}
    # | {op:"claim", taskRef, claimRef}(→pending_ack)  | {op:"ack", claimRef}(→active)
    # | {op:"cancel", taskRef}                         | {op:"advanceClock", byMs}
    # | {op:"expireLease", claimRef}                   | {op:"retireGeneration", sessionRef}
    # | {op:"runJanitor"}                              | {op:"reserveDispatch", taskRef}(push)
    # | {op:"resolveStopped", taskRef, attemptRef, evidence:"executor_stopped"}(对指定 attempt 走 T18 收口
    #    :证停+settleAttemptForRetry→queued)
    # | {op:"seedAttemptHistory", taskRef, priorAttempts: [{attemptRef,
    #    endState:"reconciled_retry"(T17→T18 已收口)|"revoked_unsettled"(T17 后未收口)}]}
    #    ——每项**输出可引用句柄**:{attemptRef → completionTokenRef, dispatchRef, leaseRef, fenceTuple,
    #      tombstoneDisposition}(steps 的 paramsTemplate 可引用,如 CC-12 的 tokenA)
    # | {op:"snapshotBaseline", ref}(捕获行/revision 基线,供 unchanged 断言)
    # | {op:"seedRetryPolicy", taskRef, retryClass:"safe"|"idempotent"|"forbidden"}
    #    (conformance 专用:注入 broker-owned effective retryClass 快照,消除对本机 manifest 的环境依赖;
    #     真实 manifest 解析路径另由 CC-19c 外的 §8 conformance 覆盖)
    # | {op:"faultInject", targetRef(setup 句柄:lease/delivery/worker/mediator 实例),
    #    kind:"drop_response"|"worker_eof"|"worker_timeout"|"authority_drift",
    #    at:"before_commit"|"after_commit"}(效果=对该实例注入指定故障;歧义实例=fixtures 缺陷)
  steps: [{ref, actor: "caller"|"executor"|"executor2"|"adapter"|"janitor",
           action: {method, params(可引用 setup/step ref 的模板变量)}}
          | {barrier: [stepRefs]}                      # 组内 action 并发 start(全部就绪才放行)
          | {commitOrder: [stepRefs]}],                # harness 经事务钩子强制所列 steps 的写事务按序 commit
  # step 执行语义(封闭):未入 barrier/commitOrder 的 steps 按数组序**串行同步**执行(前一响应返回才起下一);
  #   barrier 组内并发 start;**commitOrder 成员=全部 ready 后并发 start,仅 writer 事务 commit 按列表序**
  #   (harness 经事务钩子强制;start 并发是其定义的一部分,非未约束)
  expect: {                  # 合取:出现的断言全部必须成立
    response?: [{stepRef, typedCode?,
                 resultAssert?: {field, equals|equalsRefField|absent}}],   # absent=字段不得出现
    task?:     {taskRef, phase?, outcome?, unknownReason?, verification?},
    storage?:  [{table, whereRef, assert: {rowCount? , columnEquals?: {column, value},
                                           unchangedFromBaseline?: ref}}],
    events?:   {taskRef, kindIncludes?: [], kindExcludes?: []},
    trace?:    {workerCallCount?, happensBefore?: [[refA, refB]]}
  }
}
```

- **本节为语义层封闭定义**(元素集/断言类/必含 case);**可执行 JSON Schema(含 ref/模板替换文法)是 conformance fixtures 交付物的一部分,其元素集不得超出本节**——超出=fixtures 缺陷。
- **gate 绑定**:broker 持 allowlist `{suiteId, suiteVersion, suiteDigest, schemaId, schemaVersion, schemaDigest}`(policy_control 资产;**schema 三元一并 pin**——防同 suite 字节被不同 schema/ref 解释仍取得同 gate identity);suiteDigest = `AB-CANON-1("AgentBridge/ConformanceSuite/v1", suite)`;pass evidence = `{suiteDigest, schemaDigest, adapterBuildDigest, profileId, executedAt, resultsDigest}` 入 adapter conformance gate(architecture §15)。**非 allowlist 套件/删减套件不作数**(防空套件假绿)。
- **必含 case 集(封闭;每条=唯一可判定期望)**,pull adapter 适用 CC-01..21(除 push 专属);**push 适用 = CC-07/08/09/11/13b/18/20**(never_activated 族属 pull 两阶段交付,push 无 pending_ack——轮 19 修):
  - CC-01 未 ACK 的 claim 重放(同 claimRequestId 同 requestDigest)→ deliveryRevision+1;storage:旧 token tombstone{revoked, never_activated};
  - CC-01b 同 claimRequestId **异 requestDigest** → 4044;storage:零新 delivery/receipt/token;
  - CC-02 已 ACK 后的 task.claim 重放 → 4030;
  - CC-03 旧 deliveryRevision 的 ACK → 4031;
  - CC-04a beginStop 后迟到 ACK → 4031;storage:lease{revoked} 不复活;CC-04b retireGeneration 后迟到 ACK → 同;
  - CC-05 同 {claimRequestId, deliveryRevision} ACK 重放(authority 完好)→ response.resultAssert:activationReceiptDigest == 原值;
  - CC-06 authority 已撤后的 ACK 重放 → 4031;response 断言不含 payload 字段;
  - CC-07 同 completionOperationDigest 重放 → 原 receipt(resultAssert 相等);CC-08 同 token 异 digest → 4048;
  - CC-09 deadline 后 complete → response 4049;events.kindIncludes=[late_result];task 最终 {phase:terminal, outcome:expired}(中间态不断言);
  - CC-10 never_activated token complete → 4047;task:stateRevision 不变(storage 断言);events 含 evidence;
  - CC-11 activated+fence 匹配当前 reconcile 目标(setup 带 terminationIntent)→ 4047;task 出 reconciling→{terminal, outcome=按 intent};events.kindIncludes=[reconciled];
  - CC-12 历史 attempt token × 当前 cancelling(无其它 stop 证据)→ 4047;task 保持 {phase:cancelling}(**不触发 T15**——轮 15 攻击路径 1 回归钉);
  - CC-12b 历史 attempt token × 当前 reconciling → 4047;task 保持 {phase:reconciling}(**不作 T19 输入**——轮 15 攻击路径 2 回归钉);
  - CC-13a 跨 Task token 注入(request.taskId ≠ token 归属)→ 4046;storage:两 Task stateRevision 均不变;
  - CC-13b 同 Task authority drift(faultInject)→ token 所属 Task {phase:reconciling} + 4046;
  - CC-14a pending_ack 下 renew → 4046;CC-14b pending_ack 下 complete → 4046;
  - CC-15a ackDeadline 到(runJanitor;无 cancel/deadline)→ task {phase:queued};storage:delivery{superseded}+token{never_activated};
  - CC-15b pending_ack + cancel → task {terminal, cancelled};
  - CC-16a commitOrder=[cancel, claim] → claim 得 tombstone 响应(offerId 同,reason=cancelled);CC-16b commitOrder=[claim, cancel] → claim 成功后 cancel → T6b {terminal, cancelled};
  - CC-17 pending_ack + Task deadline → T6b 直达 {terminal, expired};
  - CC-18a(push)worker 合法 result(isError≠true)→ {terminal, succeeded}+receipt;CC-18b worker EOF → {phase:reconciling};CC-18c stale sender(start CAS 失败)→ trace.workerCallCount=0;
  - CC-19a 同 rs_ 对**另一 Task B** 的 claim(本 rs_ 首个 lease pending_ack/active)→ 4013(同 Task 重放另有 CC-01/02);CC-19b 首个 attempt 经 T17 revoke **未收口**(reconciling)时同 rs_ 对 Task B 再 claim → 4013(slot 不随 revoke 释放);CC-19c(setup 含 seedRetryPolicy(A, safe)——T18 可达性不依赖本机 manifest)resolveStopped(T18)后再 claim → 成功(slot 已释放);CC-19d 变体族(poison 谓词与 outcome 无关):d1=T17→T20 unknown、d2=T17→D3→T20 **expired**、d3=T20 **cancelled**(无 effect 但未证停)——三者后同 rs_ 对 B claim 均 **4013**;d4=poison 后 **generation roll(resume/clear/compact)**,新代对 B claim 仍 **4013**(session 级隔离);d5=历史 attempt 的迟到 complete(fence 不匹配 poison 锚)→ **不释放**,claim 仍 4013;d6=exact-fence 证停证据到达 → releasePoisonedSlot 后 claim 成功;d7=D2 直达 terminal(drain 未 ack)→ poisoned,claim 4013,drain ack 到达 → 释放;
  - CC-20a commitOrder=[complete, cancel] → {terminal, 真实 outcome},晚到 cancel 得终态快照;CC-20b commitOrder=[cancel, complete] → {terminal, cancelled}+events 含 late_result;
  - CC-21 activated+fence 匹配 × cancelling(无未决 effect)→ 4047;task {terminal, outcome=按 intent}(迟到 complete 作 stop 证据触发 T15——§5.3 路由正支)。

### 7.9 shim 投影矩阵 [NORMATIVE]

| 面 | claude-desktop/cli | codex-desktop/cli | worker(shim 面) | approval_system |
|---|---|---|---|---|
| 提交面(task.submit/cancel/lookup + ask_* 糖) | ✓(bound) | ✓(bound) | ✓(A→B→A callback;受 §10 lineage/预算闸) | ✗ |
| 执行面(peek/preview/claim(复合)/renew/complete;**wire-only 封闭集={claim_ack, begin_apply_submission, fetch_submission, ack_submission} 恒不投影**,§7.1) | ✓(hook_wake/pull 族) | ✓(manual_claim_current/armed_pull;P0A-6 门) | ✗(push 进程内,不经 wire) | ✗ |
| 挂起动作面 | ✓ | ✓ | ✓ | ✗ |
| artifact 面 | ✓ | ✓ | ✓ | **get 限工单引用**(role=presentation,§7.5);put ✗ |
| holder 面(§7.6,含 approval.peek_work) | ✗ | ✗ | ✗ | ✓(G-5/provision 门) |
| status/pairing.claim/pairing.status | ✓ | ✓ | —(进程内身份) | ✓ |

投影矩阵为 UX 层;每格授权由 authorize() 按 §2.4 capability→gate 映射独立判定(重申:矩阵不是授权源)。

---

## 8. retryClass tool-manifest(§0-A.7) [NORMATIVE]

### 8.1 位置、authorship 与信任类

- 文件:`$STATE_DIR/policy/retry-manifest.json`(0600);broker bundle 内置默认副本,首启动复制落位。
- authorship:随 broker 发布 + 本机 admin plane 编辑。**policy_control 资产**(architecture §10.1 传递闭包「retry/tool manifest」逐字命中):任何 origin 经任务 RPC 请求修改一律恒拒(§6.1 决策表 rule 1;`nextAction=open_admin_settings`),agent 不可写。
- **加载与原子安装(轮 18 修+轮 19 修:IO 失败也必须形成 fail-closed snapshot)**:任何加载结果(**含文件 missing/权限拒/EIO**)都以单 writer 事务安装持久 **ActiveRetryManifestSnapshot** `{snapshotId, loadStatus: "valid"|"invalid_fail_closed", loadFailure: null|"missing"|"unreadable"|"io_error"|"parse_error"|"schema_error", manifestVersion: int|null(invalid 时 null), effectiveDigest, sourceDigest: digest|null(无字节可读时 null), installedAt}`——valid 时 `effectiveDigest=manifestDigest`;invalid 时 `effectiveDigest = AB-CANON-1("AgentBridge/RetryManifestSnapshot/v1", {loadStatus, loadFailure, sourceDigest})`(**独立 domain**——不复用 RetryManifest 域,§1.4 单一封闭 hash-input 纪律;domain 入 §16.3),语义=空 manifest+defaultClass forbidden 全量生效并审计(**坏/缺 manifest 绝不 fail-open 保留旧 safe 策略**)。**任何 snapshot 切换(valid↔invalid、有效语义变化)同事务 `policyEpoch+1` + 通知**(§2.4);**active snapshot=单行指针(broker_state 或专列),非按 installedAt 推断**;持久 `maxAcceptedManifestVersion` high-water mark——**同 version+同 digest 且即当前 active=幂等 no-op**;同版本异 digest、版本 < high-water、或 **version==high-water 而当前 active 为 invalid**(持久 `highWaterDigest` 供同字节判定,但恢复路径统一=发布更高 version,分支封闭)→ **拒绝安装**(保留现 snapshot,审计;重启后依 high-water 仍拒 rollback);书挡① 引用当时 active snapshot(immutable)。**存储 owner(r63 P1-4/v0.12.13:此前无表/列承载,crash 后 active snapshot 与 rollback fence 不可恢复)**:独立表 `retry_manifest_snapshots`(append-only;PK=snapshotId(`rms_`,§1.3 注册);列=上述 snapshot 全字段+`body(JSON,valid 时 manifest 全文;invalid 时 null)`;§10.13 增行)+`broker_state` 增列 `{activeRetryManifestSnapshotRef(→rms_), maxAcceptedManifestVersion, highWaterDigest}`(单行表,安装事务同写——「单行指针」的列级落地);§8.3 `retryClassBasis.snapshotId` 值域=rms_。

### 8.2 格式(封闭 schema)

```text
RetryManifest {
  manifestVersion: int(单调递增),
  defaultClass: "forbidden",                  # v1 固定;其它值=schema 违例(fail-closed)
  entries: [{selector: {operationKind: "agent_turn", targetClass?: "claude_session"|"codex_worker"}
                     | {toolName: string, toolSchemaVersion?: string},
             retryClass: "safe"|"idempotent"|"forbidden", note?}](≤256),
             # selector.targetClass 匹配对象=RetryMatchContext.effectiveTargetClass(总函数,见下)
  updatedAt
}
manifestDigest = AB-CANON-1("AgentBridge/RetryManifest/v1",
                            {manifestVersion, defaultClass, entries(剥 note)})
```

- **RetryMatchContext(权威匹配输入;轮 18 P0 修)[NORMATIVE]**:匹配输入 = **broker-owned** `{canonicalOperationKind, effectiveTargetClass}`,书挡① 由 broker 从已验证的 targetSelector/操作类别派生(EffectivePolicySnapshot.canonicalOperationKind 同源);**v1 封闭枚举:`canonicalOperationKind = "agent_turn"`**(自然语言任务全归此类)。**effectiveTargetClass 总函数(轮 19 修:对三种 selector 全定义)**:dedicatedPolicy → 其 targetClass;`{endpointId}`/`{runtimeSessionRecordId}` → 按解析出的 endpoint.surface 映射(claude-* → claude_session;codex-*/worker → codex_worker);**无法归类 → 恒 defaultClass(forbidden)**——同一 resolved target 不因 selector 表达方式改变 retry class。**caller 任何字段(payload/expectedDeliverable/糖名)不参与匹配**——防伪装安全工具名放宽。`toolName` 类 selector 的匹配输入只能来自 **broker 验证的结构化 operation descriptor**(§12 EffectIntent 的 toolName/toolSchemaVersion);v1 无此来源,故 **v1 加载时 toolName 条目仅允许 `retryClass=forbidden`**(只可收紧;其它值=schema 违例)。
- **匹配算法(封闭伪码)**:`applicable = entries.filter(selector 与 RetryMatchContext 精确匹配——operationKind 相等且(targetClass 缺席或相等);toolName 类按 descriptor 相等)`;`resolvedClass = applicable 为空 ? defaultClass : max_conservative(applicable.retryClass)`(**跨全部命中项取格上最保守**,forbidden > idempotent > safe,不分优先级桶);**禁止通配/正则**;同 selector 重复条目=schema 违例。

### 8.3 解析与冻结

- **书挡①(durable accept)时**解析 effective `retryClass` 入 EffectivePolicySnapshot(architecture §6.2),同事务记 `retryClassBasis{snapshotId, loadStatus, manifestVersion|null, effectiveDigest, matchedSelectors: [], resolvedClass}`(多命中归约可审计;列归属=EffectivePolicySnapshot 关联存储,随 §10 表定稿);caller 收紧的 wire 载体=`requestedCostPolicy.maxAttempts=1`(⇒ effective retryClass 等效 forbidden,§7.2)——**不存在放宽方向的 wire 字段**。
- **冻结**:Task 存续期内 manifest 更新不改已冻结 snapshot(T18/T20 重试判定用冻结值——对账语义中途换类=不可审计);admin 止血路径 = admin plane cancel,非改类。
- legacy chat-plane(§1.5)无 Task 实体,不经 manifest。

---

## 9. requestedContext 与 contextDigest(§0-A.8)

### 9.1 tagged union 与 v1 支持矩阵 [NORMATIVE]

```text
RequestedContext = {mode: "fresh"}
                 | {mode: "current",                            # 形状 NORMATIVE;v1 语义 UNSUPPORTED(见下)
                    expectedRuntimeSessionRecordId: string|null,
                    expectedGeneration: int|null,
                    expectedBasis: {baseTurnId: string, contextDigest: "sha256:…"} | null}
                 | {mode: "checkpoint", checkpointId}          # [UNSUPPORTED v1]
                 | {mode: "providedBundle", bundleRef, digest} # [UNSUPPORTED v1]
```

| mode | v1 状态 |
|---|---|
| `fresh` | [NORMATIVE] 默认(DR-2:dedicated 默认;ask_* 糖恒 fresh);语义见 §9.2 |
| `current` | **wire 形状 [NORMATIVE](含 expectedBasis 保留形状——语法层可解析,前向兼容非空承诺);v1 语义 [UNSUPPORTED]**:task.submit 入口 → `context_mode_unsupported` 拒,不建 Task。**依据(轮 18 P0,保守解)**:architecture §6.2 的 `resolvedContextBasis.contextDigest` 为必填,而 v1 无可算 digest 的字节来源(§9.3)——伪造 digest/省略必填字段均违反上位;冲突规则(头部)下 spec 只能关此模式。**重开条件**=architecture 修订建议「resolvedContextBasis 改 tagged union:generation_only{runtimeSessionRecordId, generation, resolvedAt} / digest_bound{…, baseTurnId, contextDigest}」经用户 APPLY 后,本节按下方「generation_only 条件 profile」开放 |
| `checkpoint` / `providedBundle` | [UNSUPPORTED] → `context_mode_unsupported` 于 task.submit 入口拒,**不建 Task**(architecture §0-A.8 的「显式 unsupported」裁决;补子系统属后续修订+新 protocol feature) |

### 9.2 fresh 语义与 current 条件 profile

- **fresh [NORMATIVE]**:fresh 只声明「不携带 expected basis、不做 basis fence、caller 不注入既有上下文」。隔离保证按 **effectiveTargetClass**(§8.2 总函数,direct selector 亦有定义):`codex_worker` = 每 Task 新 thread(`codex()` 开新线程,architecture §9.2;memories 隔离=worker 启动义务 F14);`claude_session` = 投递到 pinned dedicated session 的**现有会话上下文如实存在**,fresh **不承诺清空**(如实声明;需要净会话=用户另 pin 新 session)。重试(T18)沿用同语义(worker 新 attempt=新 thread);`resolvedContextBasis` 在 fresh 下**缺席**(architecture §6.2 该字段本可选)。
- **current 条件 profile [USER-DECISION→DS-3](§15;PENDING——仅在上述 architecture 修订 APPLY 后生效,此前本段无效力)**:basis=generation_only;`expectedRuntimeSessionRecordId` 非 null 时 `expectedGeneration` 才可非 null(整数 generation 必须绑定明确 rs_,防「A(gen=5) 换 B(gen=5) 静默命中」);null/null = claim/dispatch CAS 冻结当时值;不等 → terminal `outcome=superseded`(claim wire 返回 tombstone 形状响应,不建 lease/token/不交付 payload);冻结后滚代由 §4.4 级联收口。开放同时须:新 protocol feature `context_current_v1` + 专门 context-basis 探测项(P0A-1/-9 只证 turn 边界,不证 digest 字节来源——见 §9.3)。
- **错误码优先级(轮 19 修)**:v1 按 mode 先判——`mode=current`(不论 expectedBasis)→ **4051**;**4052 仅保留给未来已开放 current profile 下的 expectedBasis 非 null**(届时 fail-closed 不静默忽略——防调用方误信 basis 已受强制)。

### 9.3 contextDigest 来源 [E2E-GATED→P0A-CB(§14.1;轮 52 P2-3 标签精确化)]

- 已核事实:broker 禁读宿主 transcript(architecture §1.2/F10;§4.2 transcriptPath 仅 watchPaths 推导)、宿主 `turn_id` 恒 null(§4.10 引用【代码】src/control-protocol.ts:46)。**P0A-1/-9 仅探测 turn 边界证明,不提供 context 字节、canonicalization 或 digest 生产者**——contextDigest 可行性需**独立** context-basis 探测项(算什么字节/谁算/caller 如何取得 expectedBasis,architecture §0-A.8 三问),登记入 §14 探测包与 §15 决策登记册。
- 任何未来开放(digest_bound profile)= 本文修订 + 新 protocol feature + 探测证据,**不走静默 policy 切换**;wire union 形状已预留。

---

## 10. 预算 / lineage / 生命周期实体(§0-A.10 全量 + carry-in「多-agent provenance hash」)

> 本章交付 architecture §6.6/§6.3(D-5/D-6)/§9.2/§8.2 所锁不变量的**列级 schema、状态机、事务接线与发布默认数值**。语义 SSOT 恒在 architecture;本章不重定义语义,只补齐存储与编码。对已封版 §1.3/§3.2/§5/§6/§7/§16 的接线均为**受审 additive wiring**(照 Chunk 3 增补先例,汇总于 §10.14,随本章一并复核)。**Phase 对齐**:§10.1–§10.5 + §10.11 的 structural 子集(lineage/三闸/root 聚合/queue-quota)随 Phase 1B Task Core 落地;API billing、activation、fan-out 等按 architecture §15/§16 各自 gate 后启用(逐条目标注)。

### 10.1 RootAdmissionContext 与 turn 边界键(root 铸造权) [NORMATIVE]

```text
RootAdmissionContext root_<ulid> {
  rootAdmissionId,
  rootKeyKind: "host_session"|"host_turn",   # v1 policy 固定 host_session(§4.10;
                                             #   host_turn=[E2E-GATED→P0A-9],gate 前禁用)
  rootKeyValue: string,                      # host_session → runtimeSessionRecordId(=HostSessionKey,§4.10)
                                             # host_turn   → HostTurnKey(见下;v1 不产生)
  originInstallationId, authenticatedPrincipalId,   # 铸造时快照(审计;账本键恒为 rootAdmissionId)
  policyEpoch, createdAt
}
```

- **铸造权**:仅 broker,时机=书挡①(§10.5)解析 lineage 时对当前 mode 的键**原子 get-or-create**(`(rootKeyKind, rootKeyValue)` 唯一约束 + 单 writer 串行化,并发首调恰得一行;architecture §6.6)。**bridge wake / async continuation / 任何 bridge-derived invocation 永不铸新 root**(缺有效 parent 关联即拒,§10.3);`originInvocationId/connectionEpoch/idempotencyKey/时间窗`均不得充当键成分。
- **HostSessionKey**(v1 唯一生效键)= `runtimeSessionRecordId`(§4.10 已锁,此处不重定义):跨 reconnect/resume/compact/滚代稳定;rs_ OFFLINE tombstone 后的新 rs_ = 新会话新 root(§4.10)。
- **HostTurnKey [E2E-GATED→P0A-9]**:= `AB-CANON-1("AgentBridge/HostTurnKey/v1", {runtimeSessionRecordId, turnEvidenceKind: "host_turn_id"|"prompt_epoch", turnEvidenceValue: string})` 文本形。**两支 producer 分立(轮 31 A4)**:`host_turn_id` → value=宿主可信 turnId(§4.10 `auth.hostTurnClaim` 经 `host_turn_boundary_v1` feature 提交,broker 按 adapter profile 判可信);`prompt_epoch` → **value=broker 铸造的单调 epoch**(可信 UserPromptSubmit/等价 first-party 事件仅**触发** broker 对该 rs_ 的 epoch get-or-increment;adapter 提交的 `hostTurnClaim{kind: prompt_epoch}.value` 是触发凭据,**不进入键**,仅入审计——architecture §6.6「broker 单调 epoch」逐字,自报计数不得充当 turn 边界)。**事件幂等锚与 exactly-once 事务(轮 32 A4+轮 33 机器化)**:epoch 推进以 first-party 事件的稳定标识 `eventRef` 为幂等键,**单 writer 事务内 get-or-increment 封闭**:①按 (rs_, kind, eventRef) 查 `host_turn_boundaries`——命中 → 返回既有 `epochValue`(原 epoch,不拆 turn、不重置 root 账);②未命中 → `epochValue = MAX(epochValue)+1(同 rs_ 同 kind;空=1)` 并 insert 行 `{eventRef, epochValue}`——查、增、写映射同一事务,无跳号窗、无「先推进后 crash 无法回查」分叉(epochValue 持久于行,无需独立 high-water 列)。约束:**kind=prompt_epoch ⇒ eventRef NOT NULL ∧ epochValue NOT NULL ∧ epochValue ≥ 1(tagged CHECK)**;UNIQUE(rs_, kind, eventRef)+**UNIQUE(rs_, kind, epochValue)** 双键。**映射生命周期(轮 34):`host_turn_boundaries` 行(含 epochValue 高位)保留至所属 rs_ 的 OFFLINE tombstone,禁 GC**——删最高行=MAX+1 复用旧 epoch、删旧映射=重送重铸 root,均违反 architecture §6.6「同一 turn 复用同一 root、不得重铸」,故行常驻即单调 high-water,无回退面。**producer 单支固定(轮 34)**:同一 rs_ 的 turn 边界 producer(host_turn_id XOR prompt_epoch)由 adapter profile 于 P0A-9 冻结时**二选一**并绑定 policyEpoch;同 rs_ 出现另一支证据 → 仅审计不铸键(防同一真实 turn 双证据生成两个 root)。**P0A-9 探测项同时须验证 eventRef 在同 rs_ 全生命周期(含宿主重启/reconnect)稳定且唯一——不满足 → 该 surface 的 per-turn root 保持 fail-closed(session scope/4043),不得以进程内 ID 充数**。探测通过前:policy 固定 session-scoped;`hostTurnClaim` 到达仅记审计,不参与键(4043 `host_turn_identity_unavailable` 保持 reserved,§16.2)。存储预留表 `host_turn_boundaries`(§10.13;v1 空表)。
- **生命周期**:RootAdmissionContext 无终态(账本聚合锚,不随 rs_ OFFLINE 关闭);retention 随审计策略,live 引用(TaskLineage/BudgetAccount)存在期间禁 GC。
- root 聚合账(task_count/attempt/token/money/wall-clock 累计)一律以 `rootAdmissionId` 为 `BudgetAccount{scopeKind=root}` 的 scopeId(§10.4);**不因新 connection/新 idempotencyKey/异步 callback/generation 滚动重置**。

### 10.2 TaskLineage 与三闸赋值(sibling/depth/hop/routeKey) [NORMATIVE]

```text
TaskLineage(Task 级不可变;broker 铸造;caller body 出现任何本表字段 → forbidden_field,§6.2):
  taskId(PK, = tasks.taskId),
  rootAdmissionId,                     # 必填;root 账真值
  rootTaskId: string|null,             # 仅当该 admission 确有对应 root Task;不作聚合键
  parentKind: "task"|"root_admission",
  parentTaskId: string|null,           # CHECK:parentKind=task ⇔ 非 null
  depth: int,                          # parentKind=root_admission → 1;task → parent.depth+1;retry 不增
                                       #   (轮 31 A1:RootAdmissionContext=树根 depth 0(非 Task);
                                       #    「root=0」的 root Task 形态 v1 不存在(rootTaskId 恒 null),
                                       #    siblings 恒 depth=1——不冒充 root、不链化,architecture §6.6 逐字)
  agentHopCount: int,                  # parentKind=root_admission → 1;task → parent.agentHopCount+1;retry 不增
  routeKey: "sha256:…",                # 见下
  lineageDigest: "sha256:…",           # = AB-CANON-1("AgentBridge/Lineage/v1", {taskId, rootAdmissionId,
                                       #   rootTaskId, parentKind, parentTaskId, depth, agentHopCount,
                                       #   routeKey, lineagePolicyEpoch})(§1.4 全字段,缺席=null)
  lineagePolicyEpoch: int
```

- **parent 解析(书挡① 内,封闭三分)**:①同步 child——authctx 携 `callerTaskId/callerDispatchId` 且该 dispatch 为**当前 active**(lease active、fence 全匹配):`parentKind=task`;②异步恢复——authctx 携 `lineageContinuationRef` 且经 §10.3 校验消费:`parentKind=task`(parent=capability 所绑 callerTaskId);③二者皆无且 origin 为 first-party host 事件:`parentKind=root_admission`(§10.1 get-or-create)。**bridge-derived invocation(executor turn 内/由 wake 链驱动)缺 ①② → 整单拒(4059 `continuation_required`,§16.2 增补)**,不得落到 ③ 转新 root(architecture §6.6)。
- **root 继承强制(轮 31 A3)**:`parentKind=task` 时 `child.rootAdmissionId` **必须等于** parent 的 `task_lineage.rootAdmissionId`(broker 同事务从 parent 行读取赋值;`rootTaskId` 同规则继承)——不存在任何「提交/推断 rootAdmissionId」路径,①②两分支均不例外;continuation 消费另有 §10.3 一致性重验。architecture §6.6「同步/异步 child 均继承」的机器化。
- **sibling 规则**:同一 root admission 下多个 ask 共同父=RootAdmissionContext(`parentKind=root_admission`),互为 siblings——不得链化(前一个 ask 不是后一个的 parent)、不得各铸新 root;各自独立消耗 root 聚合账与三闸计数。
- **retry 不增**:同 Task 新 DispatchAttempt(T18 后重试)不产生新 TaskLineage 行、不改 depth/hop(lineage 是 Task 级)。
- **routeKey** = `AB-CANON-1("AgentBridge/RouteKey/v1", {sourceClass, canonicalTarget, operationKind})`(轮 31 A2:canonical target 不降维到 class):`sourceClass` = origin endpoint surface 的封闭归约 `{claude-desktop, claude-cli}→claude_session / {codex-desktop, codex-cli}→codex_session / worker→codex_worker`;`canonicalTarget` = canonicalTargetPolicy 同源构造值(architecture §6.2:tagged union `{kind:"dedicated", dedicatedBindingId, bindingEpoch} | {kind:"direct_endpoint", endpointId} | {kind:"direct_session", runtimeSessionRecordId} | {kind:"fallback", dedicatedBindingId, bindingEpoch, fallbackIndex}`,§1.4 嵌套规则;**direct 两支=caller selector 原值(broker 仅验在性/授权后原样入构造)——轮 32 A2:不用运行期 resolved rs_,同 selector 恒同 key,endpoint 换 session 不改 routeKey、不破 idempotency join,也不可借反复 re-resolve 重置 route 计数**);`operationKind` = canonicalOperationKind(v1 恒 `agent_turn`)。**不含 payload/expectedDeliverable/糖名**(防伪装换 key)。**残余如实声明**:bindingEpoch 滚动会重置 branch 计数(re-pin 后同型边计数从零)——最末防线恒为 root 聚合账(architecture §6.6 自身设计),route 闸只治「同 binding 反复横跳」。
- **三闸(书挡① 同事务判定;违者 4042 `quota_rejected`,永久拒不生成 taskId)**:`depth ≤ maxDepth`;`agentHopCount ≤ maxAgentHops`;沿 parent 链上溯(含本 Task)同 `routeKey` 出现次数 ≤ `maxRouteOccurrencesPerBranch`。数值见 §10.12。
- **如实声明(hop/depth 关系)**:本节赋值规则下 v1 恒有 `agentHopCount = depth`(均自 1 起、同步 +1;每次 Task 派发都是一次 agent 间投递)。两字段仍独立持久化:architecture §6.6 锁定二者为独立实体字段、两闸独立配置(maxDepth/maxAgentHops 可不同值),且未来 same-surface 内部委派(不跨 agent 的 depth 增长)会使二者分叉——届时属本文修订,不是静默切换。

### 10.3 continuation capability(异步 lineage 恢复) [NORMATIVE 形状;v1 铸造入口 UNSUPPORTED]

```text
continuation_capabilities {
  tokenHash(PK;明文 kind=cn1.,§3.2-A 行),
  callerTaskId, rootAdmissionId,       # 绑定原 lineage(architecture §6.6)
  originPrincipalId, originInstallationId,
  mintedAt, expiresAt,
  consumedAt: int|null, consumedByTaskId: string|null,
  revokedAt: int|null
}
```

- **校验与消费(书挡① 同事务)**:hash 命中 + 未消费未撤销未过期 + `originPrincipalId/originInstallationId` == 提交方 authctx 同名字段 + 所绑 callerTaskId 的 TaskLineage 存在 + **`capability.rootAdmissionId == 该 callerTaskId 的 task_lineage.rootAdmissionId`(一致性重验,轮 31 A3——铸造绑定与 lineage 行漂移即拒,child 的 root 恒取 lineage 行,不取 capability 面值)** → 原子标记消费(单次)+ 以该 callerTaskId 为 parent 派生 lineage(depth/hop/root 继承照 §10.2 child 规则)。任一不符 → 4059(与「缺 continuation」同码,不泄露在性)。
- **铸造与交付入口 v1 [UNSUPPORTED]**:v1 无任何 wire/进程内路径铸造本 token(表 schema 先行,防 migration 再改)。后果=保守侧自洽:异步 bridge-derived 恢复一律 4059 拒;同步 child(active dispatch 关联)不受影响。开放铸造(如 completion receipt 携带)= 本文修订 + 复核「谁可持有/如何轮换/与 onCallerLoss 交互」,不走静默启用。
- `authctx.lineageContinuationRef` 是**带外 authctx 字段**(§6.2 着色):由认证 shim/adapter 层注入,模型工具面/caller body 出现 → `forbidden_field`。

### 10.4 预算实体(ledger 与 policy snapshot 分离) [NORMATIVE]

```text
EffectiveBudgetSnapshot benv_<ulid>(Task 级不可变;独立表,tasks.effectiveBudgetSnapshotRef 引用):
  {budgetEnvelopeId, policyEpoch, applicableQuotaRefs: [](BudgetAccount 引用,审计),
   rootCaps: {dimension → cap}(本 Task 适用的 root 聚合上限快照),
   taskAllocation: {maxAttempts, maxOutputTokens, maxCostMicros, maxContextTokens},
   retryPolicy: {backoffBaseMs, backoffCapMs},
   onBudgetExhausted: "fail"|"pause_for_human"|"defer_until_reset",
     # **effectiveExhaustionPolicy 规范全函数(轮 32 B2+轮 33/34/35 修:入参=本次判定实际耗尽的
     #   账户集合 exhaustedAccountRefs[],非 dimension 标量——同维可跨 scope/window 多账户)**:
     #   per-account 值 = (该账户 windowKey=""(无 reset)∧ onBudgetExhausted=defer_until_reset)
     #     ? fail
     #     : (onBudgetExhausted=pause_for_human ∧ **该账户非「grant 可精确 CAS 的账户」——即非
     #        {scopeKind=root, windowKey=""} 或 dimension ∉ override 正列(§10.4)**)? fail
     #       # 轮 35:§7.6 工单/token 只绑 {root, dimension} 且 grant 只 CAS 唯一 root 无窗行——
     #       #   principal/installation/task 级或有窗账户耗尽时 pause 无解(grant 抬 root 无用),
     #       #   归 fail 不产生永久等待;多 window 歧义消除:可 pause 的耗尽账户恒唯一
     #     : onBudgetExhausted。
     #   聚合(多账户同时耗尽):任一 fail → fail;否则任一 pause_for_human → pause_for_human;
     #   否则 defer_until_reset(nextEligibleAt = 各账户 reset 时点的最大值)。
     #   **defer 与 deadline 的关系(轮 35+轮 36)**:defer 的重排恒可写——nextEligibleAt=max(resetAt);
     #   若该值 ≥ resolvedDeadlineAt,重排后任务必然先撞 deadline fence(§5.1)到点收口 expired
     #   (nextEligibleAt>now,无热循环;不改判 fail——避免把「等不到 reset」伪报为 quota_exhausted)。
     #   载体=封版 T4c 的 guard 增补(v0.10.6,轮 36 裁决走受审 additive 路径而非口径澄清;§5.2 已改)。
     #   书挡①②③/T4c/T9b/T21 的 policy 判定一律取该函数值;**封版 T21 触发列所称「policy=fail」
     #   的 policy 语义在此接线为本函数输出——定义接线,封版边/guard 文本不动**(windowed 维度
     #   三词表全保留,architecture §6.6 相容)
   billingBindingRef: string|null, priceCatalogVersion: string|null, createdAt}
  # caller 的 requestedCostPolicy 只能收紧(§7.2);broker 从 installation policy 派生本快照;
  #   BudgetOverrideGrant 不覆写本快照(见下 grant 条);
  # **§7.6 presentation.budgetSnapshotRef 的定义(轮 31 B7)= 触发该 budget suspension 的 Task 的
  #   effectiveBudgetSnapshotRef(benv_)**——holder 看到的是「按哪份快照判的超限」,当前账面值
  #   已随 presentation 内联(currentCap/currentUsage/budgetRevision)

BudgetAccount ba_<ulid>(可变 ledger;§7.6 budgetRevision = 本表 version):
  {accountId,
   scopeKind: "root"|"task"|"principal"|"installation"|"room"|"endpoint"|"provider_account",
   scopeId: string,                    # scopeKind=root → rootAdmissionId;task → taskId;…
   dimension: 封闭枚举(见下), windowKey: string,   # 无窗账户 = ""(哨兵;规避 SQLite NULL 唯一语义);
                                       #   时间窗账户 = UTC 小时桶 "YYYYMMDDHH"(v1 唯一窗型);
                                       #   **resetAt 确定性推导(轮 36 P2)**:windowKey=""→无 resetAt;
                                       #   否则 resetAt=该小时桶的下一 UTC 整点(桶结束时刻)
   hardLimit: int, reserved: int, settled: int,   # 不变量:reserved ≥ 0 ∧ settled ≥ 0;
                                       #   reserve CAS guard:reserved+settled+amount ≤ hardLimit
   tat: int|null,                      # 仅 GCRA 维度(wake_signal)使用;其余恒 null;
                                       #   **null 语义(轮 31 B6)= 视作 tat=transactionNow(首次恒放行)**
   version: int}                       # 每次 mutation +1;§7.6 override 工单 fence 载体
  UNIQUE(scopeKind, scopeId, dimension, windowKey);get-or-create 原子(单 writer)

dimension(v1 封闭枚举;记账型别见右注):
  queue_slots / queue_bytes            # hold 型:书挡① reserve → ② release
  concurrency                          # **强制载体=§6.1 runtime_execution_slots(书挡② 的 concurrency
                                       #   reserve 即 slot insert;per-rs_ 语义已由该表 PK 承载)——
                                       #   不建 BudgetAccount 行(轮 31 B7:scopeKind 无 runtime_session,
                                       #   本枚举值仅作维度词表占位,禁止建账)**
  context_tokens / output_tokens       # hold 型:② 上界 reserve → ③ settle(actual|upper_bound)
  money_micros                         # hold 型:② worst-case reserve → ③ settle
  task_count / attempt_count           # 累计型:①/② settle-only(+1),terminal 不减(root 聚合防重铸)
  wall_clock_ms                        # 累计型:③ settle(attempt 起止时段);① 闸检查
  approval_prompt                      # 累计型+时间窗:challenge 铸造事务 settle(+1);§10.5
  activation_attempt / activation_compute_micros   # activation 事务记账(§10.7)
  wake_signal                          # GCRA/TAT 型:不走 reserve/settle,§10.5

BudgetReservation rsv_<ulid>:
  {reservationId, accountRef(→ba_), taskId: string|null, dispatchId: string|null,
   activationRef: string|null,         # CHECK:taskId/activationRef 至少一非空
   dimension, amount: int,
   state: "held"|"settled"|"released"|"expired",
   operationDigest: "sha256:…",        # = AB-CANON-1("AgentBridge/BudgetOperation/v1",
                                       #   {scopeKind, scopeId, dimension, windowKey,
                                       #    taskId, dispatchId, activationRef, challengeRef, bookend:
                                       #    "accept"|"dispatch"|"settlement"|"activation"|"approval",
                                       #    amount})(§1.4 全字段,缺席=null;challengeRef=approvalId,
                                       #   仅 bookend=approval——轮 31 B3 幂等锚);
                                       #   UNIQUE——书挡重放/恢复补跑的幂等锚
   transferredToTaskId: string|null,   # 轮 33 C5:obligation transfer 归属列(创建时字段与
                                       #   operationDigest 不可变不重算;收口归属见 §10.4 precedence)
   heldAt, settledAt: int|null, releasedAt: int|null}

UsageEvent(append-only;幂等结算的唯一载体):
  {usageEventId(seq PK), taskId: string|null, dispatchId: string|null,
   activationRef: string|null,         # CHECK:taskId/activationRef 至少一非空(activation 用量挂 root,§10.7)
   settlementKind: "attempt_settlement"|"activation_settlement",   # 轮 31 B3:幂等身份载体
   settlementConsumerRef: string|null, # 仅 activation_settlement(=consumerRef,§10.7)
     # **tagged-shape CHECK(轮 32 B3:防 NULL 绕过幂等键)**:
     #   attempt_settlement ⇒ dispatchId NOT NULL ∧ taskId NOT NULL ∧ settlementConsumerRef IS NULL;
     #   activation_settlement ⇒ activationRef NOT NULL ∧ settlementConsumerRef NOT NULL——
     #   两支各自的幂等唯一键列恒非空,partial UNIQUE 不可被 NULL 旁路
   rootAdmissionId,                    # 冗余列:root 聚合快查(与 lineage 一致性由书挡事务保证)
   providerRequestId: string|null, billingBindingRef: string|null,
   provider: string|null, requestModel: string|null, responseModel: string|null,
   costMicros: int, outputTokens: int|null, contextTokens: int|null, wallClockMs: int|null,
   usageQuality: "provider_actual"|"broker_measured"|"upper_bound",
   priceCatalogVersion: string|null,
   usageDigest: "sha256:…"}            # = AB-CANON-1("AgentBridge/UsageEvent/v1", 上列全字段构造值
                                       #   (usageEventId/usageDigest 自身除外;§1.4 缺席=null))
  # **幂等锚(轮 31 B3 重做)= 稳定 settlement identity,不是内容 hash**:
  #   部分唯一 (dispatchId, settlementKind) WHERE dispatchId 非空;
  #   部分唯一 (activationRef, settlementKind, settlementConsumerRef) WHERE activationRef 非空。
  #   恢复/重放命中既有行 → no-op 取回;**同 identity 异 usageDigest = 缺陷审计(usage_replay_divergence),
  #   仍取既有行不双记**(usageDigest 降级为内容完整性校验;upper_bound→provider_actual 的修正
  #   不是第二笔 settlement——须在首笔前到达,否则只入审计不改账)

BudgetOverrideGrant bov_<ulid>(append-only,root-wide;§7.6 submit_budget_override grant 腿写入):
  {grantId, rootAdmissionId, dimension, oldCap: int, newCap: int,
   policyEpoch, revision: int,         # UNIQUE(rootAdmissionId, dimension, revision) 单调递增
   decisionDigest,                     # §7.6 ApprovalDecision 锚(审计链)
   grantedAt}
  # 同事务(§7.6 已锁):CAS BudgetAccount{scopeKind=root, scopeId=rootAdmissionId, dimension,
  #   **windowKey=""(轮 35:grant 可 CAS 的对象=唯一 root 无窗账户——工单/token 绑 {root, dimension}
  #   即可唯一选中;有窗行不可 grant,effectiveExhaustionPolicy 已保证此类耗尽不产生 pause 工单)**}
  #   的 {hardLimit: oldCap→newCap, version+1};append 本行。**不覆写 EffectiveBudgetSnapshot、
  #   不放宽 structural 维度**——CHECK:dimension ∈ {money_micros, output_tokens, context_tokens,
  #   attempt_count}(architecture §6.6「可加的 money/token/attempt 上限」封闭正列——轮 31 B4:
  #   wall_clock_ms 不在上位正列,已删;depth/hop/route 三闸不在 BudgetAccount,天然不可 override;
  #   queue/task_count/wall_clock_ms 不可 override)

ProviderCircuit pc_<ulid>:
  {circuitId, provider, billingBindingKey, model,   # 分桶键 UNIQUE(provider, billingBindingKey, model);
                                       #   **billingBindingKey = COALESCE(billingBindingRef, '')(非空哨兵,
                                       #   r63 P1-6/v0.12.13:SQLite NULL 唯一语义下 nullable ref 使同
                                       #   provider/model 无绑定桶可插多行——失败计数分裂,open/half_open
                                       #   保护可被绕开(SQLite 实跑复现);windowKey/profileId '' 哨兵同型,
                                       #   lookup/写入恒经同一规范化函数;**r64 N3:billingBindingRef 本值
                                       #   =string(≥1 字符)|null,非 NULL 空串非法(CHECK)——防 '' 与 NULL
                                       #   经 COALESCE 误合桶,哨兵一一映射**)**;
                                       #   **model ≡ requestModel(轮 38:书挡② 时已知的请求模型——
                                       #   分桶身份冻结于 dispatch,responseModel 仅入 UsageEvent 审计,
                                       #   不参与选桶)**;书挡② 同事务把解析出的桶写入
                                       #   dispatch_attempts.providerCircuitRef(§6.1 增列,§10.14#14)
                                       #   ——书挡③/probe 终局/恢复补跑**只按该 ref 更新**,不重解析
   state: "closed"|"open"|"half_open",
   consecutiveFailures: int, openedAt: int|null, cooldownUntilAt: int|null,
   probeDispatchId: string|null,       # 轮 31 B5:half_open 独占探针 fence
   probeDeadlineAt: int|null,          # 轮 36:占 probe 时写 now+circuitCooldownMs——half_open 输家
                                       #   重排 nextEligibleAt=本值(未来时点,防按已过期 cooldown
                                       #   立即唤醒热循环);probe 终局事务清 probe 时一并清/重写
   lastProbeDispatchId: string|null,   # 轮 38:janitor 收口的 probe 移入此列(非清 NULL)——新 probe
                                       #   占用 guard 的载体(防旧卡死 probe 与新 probe 重叠执行)
   lastTransitionAt, version}
  # **exact-shape CHECK(轮 38/39 P2,三态互斥全写)**:state=half_open ⇔ (probeDispatchId NOT NULL
  #   ∧ probeDeadlineAt NOT NULL ∧ **cooldownUntilAt IS NULL**);state=closed ⇒ probe 两列 NULL ∧
  #   cooldownUntilAt NULL;state=open ⇒ cooldownUntilAt NOT NULL ∧ probe 两列 NULL
  #   (lastProbeDispatchId 不受 state 约束)
  # **transitionCircuitToOpen(reason, now) 单一 reducer(轮 38 P2:转 open 写集 SSOT)**:
  #   **lastProbeDispatchId = COALESCE(probeDispatchId, lastProbeDispatchId)(轮 39:二次 open——如
  #   budget_overrun 于 probeDispatchId=NULL 时——不得用 NULL 擦除未决保护 ref)**+probe 两列置 NULL
  #   +cooldownUntilAt=now+circuitCooldownMs+openedAt/lastTransitionAt=now+version+1;三入口
  #   (closed 连续失败阈值/probe 收口/budget_overrun)共用本 reducer,不各自写散。
  #   **lastProbeDispatchId 的清除**:仅当其 dispatch 达成 stop-confirmed(见下)时由同事务条件
  #   UPDATE 清 NULL——`SET lastProbeDispatchId=NULL WHERE circuitId=该 dispatch 的
  #   providerCircuitRef AND lastProbeDispatchId=该 dispatchId`(轮 40:CAS 形状显式)。
  # **stop-confirmed 判据(轮 39+轮 40 收口:「dispatch 已终局」≠「旧 provider call 已停」——§5.1
  #   允许 terminal 而 poisoned_unresolved 未释放)**:旧 probe stop-confirmed = **任何被
  #   releasePoisonedSlot(§6.1)接受的 exact-fence stop 证据**——含正常结单收口(conclusive)/
  #   T6b never-activated/exact-fence interrupt·drain ACK/同 fence 迟到 complete(**不论 Task 当前
  #   phase——terminal 后到达的同 fence 迟到 complete 亦为合法停止证据,§6.1 slots 行已允许其释放
  #   poisoned slot;§5.3 的「仅记 evidence 不触发转移」限定 Task phase/outcome,不限定本维护性
  #   清理**)/worker waitpid exit-observed;**terminal 但该执行的 slot 仍 poisoned_unresolved ⇒
  #   未证停**。**「迟到证据不追改 circuit」的精确范围(轮 40)**:不得改 providerOutcome/state/
  #   consecutiveFailures/cooldown;**允许**清理匹配同一 dispatch 的维护性 lastProbeDispatchId
  #   (防 bucket 永久自环)。releasePoisonedSlot 与本清除同一证据摄取事务执行。
  # **bucket identity/lifetime(轮 39;r64 N3:identity 键=规范化后 billingBindingKey,与 UNIQUE 一致)**:{provider, billingBindingKey, model} 三元**不可变**——凭据
  #   轮换/rebinding=新建 pc_ 行(旧行保留,历史 attempt 结果不入新桶);providerCircuitRef 为 FK,
  #   **被未终局 dispatch 引用的 pc_ 行禁删**;circuit 行轻量常驻(不 GC),无 dangling ref 面
  # 转移(书挡②占用/书挡③推进,均单 writer 事务,anti-TOCTOU 类 3):
  #   closed:**计数严格按 providerOutcome union 逐支(轮 36 P2 同步;与 half_open 同一 reducer):
  #     provider_success → 置 0;provider_failure/protocol_violation → +1;no_provider_evidence
  #     → 不变**;≥ circuitFailureThreshold → open(+cooldownUntilAt=now+circuitCooldownMs);
  #   open:书挡② 遇 cooldown 未到 → **circuit 专属出口 = T4d 边(轮 36:封版 §5.2 增补边,
  #     queueReason=provider_wait——不借 budget_wait 标签、禁 T9b(grant 关不了 circuit)、
  #     禁 T21(不伪报 quota_exhausted))**:nextEligibleAt=cooldownUntilAt;
  #     cooldownUntilAt ≥ resolvedDeadlineAt 时同一重排,由 deadline fence 到点收口 expired;
  #     cooldown 到 → 首个书挡② 事务 CAS {state: open→half_open, probeDispatchId=本 dispatchId,
  #     probeDeadlineAt=transactionNow+circuitCooldownMs, **cooldownUntilAt=NULL(轮 38:显式清——
  #     否则被 exact-shape CHECK 拒,probe 永不可建), version+1, lastTransitionAt**}
  #     (独占探针;**占用 guard(轮 38+轮 39 收紧):lastProbeDispatchId 为空,或其 dispatch 达成
  #     stop-confirmed(上方判据——terminal 而 slot poisoned_unresolved 未释放不算)——旧卡死 probe
  #     未证停前不开新 probe(保持 open,waiters 重排至新 cooldown 周期),half_open 独占性覆盖
  #     执行重叠而不止 fence 重叠**;**CAS 输家走 T4d 且 nextEligibleAt=probeDeadlineAt
  #     (轮 36:未来时点,不按已过期 cooldown 重排,无热循环)**);
  #   half_open:仅 probeDispatchId 匹配的 attempt 可 dispatch(其余照 open 分流);**probe 收口
  #     =封闭 providerOutcome tagged union(轮 32 B5+轮 33+轮 34:全出口穷尽+证据优先级)**——
  #     providerOutcome ∈ {
  #       provider_success:匹配当前 tuple 的合法协议 result(与 §6.4 architecture push 证据映射
  #         同源;**Task 业务 outcome=failed 但协议正常亦属此支**;与计费 usageQuality 正交),
  #       provider_failure:传输失败/超时/HTTP 5xx/429 类,
  #       protocol_violation:协议应答但确定 schema violation/malformed(architecture §6.4
  #         「确定 schema violation→提议 failed」——circuit 计 provider 侧失败),
  #       no_provider_evidence:未执行(T6b 零执行/cancelled/expired)或 T20 unknown/orphan };
  #     **因果时序与优先级(轮 35+轮 36:唯一线性化点=该 dispatch 的终局事务 commit)**:
  #     providerOutcome 是**终局事务(书挡③/T20)内对已收集证据集合的一次性判定**,判定结果
  #     write-once 持久于 execution_provenance.providerOutcome 列(§10.10;同事务写)——commit 后
  #     恒不改判(恢复重放经 UsageEvent/receipt 幂等锚取回原判);commit 前 crash=从未判定,恢复按
  #     届时可得证据判(result 证据丢失则按对账/no_evidence 路径,系首判非改判)。判定内规则:
  #     ①**完整合法 result 证据优先于其后到达的断流证据**(transport close/keep-alive EOF 仅审计,
  #       architecture §6.4:完整合法 result 即 outcome 证据);
  #     ②**broker 本地 stop(cancel/deadline/interrupt)诱发的断流/超时证据归 no_provider_evidence**
  #       (本地行为不得累计 provider failure);
  #     ③其余冲突证据(完整 result 形成前、非本地诱发)按 provider_failure > protocol_violation >
  #       provider_success 保守先判;**输掉终局 commit 的迟到证据(如终局后到达的 late result)仅审计,
  #       不追改 providerOutcome、不追改 circuit**;
  #     收口映射:provider_success → closed+清 probe;其余三支 → open+清 probe+新 cooldown。
  #     **circuit 更新的 state fence(轮 37:settlement 侧防旧 attempt 迟到覆盖)**:终局事务对
  #     circuit 的更新按当前 state 分派——closed:任何 attempt 的 providerOutcome 均计数(真实
  #     观测);half_open:仅 `{state=half_open, probeDispatchId=本 dispatchId, version}` CAS 全中
  #     才可转移,非匹配 settlement 仅审计;open:仅审计(成功证据不提前 close——只 probe 可 close)。
  #     **probe 提前成功的 waiter 唤醒(轮 37)**:half_open→closed 转移事务同时把同桶
  #     `queueReason=provider_wait` 的 queued 任务(经 tasks.waitingCircuitRef 索引,T4d 写入)
  #     nextEligibleAt 置 transactionNow+queueReason→ready——短 deadline 任务不必等到 expired;
  #     **consecutiveFailures 逐支规则(轮 35 P2)**:provider_success → 置 0;provider_failure/
  #     protocol_violation → +1;no_provider_evidence → 不变。全部在该 dispatch 的终局事务
  #     (书挡③/T20)内执行,probe 不会永久悬挂;
  #   **providerFailure 判定(封闭)**:adapter 报告的 provider 层证据——传输失败/超时/HTTP 5xx/
  #     配额拒绝(429 类);Task 业务 outcome=failed(模型正常应答内容不合格)不计入 circuit。
  #   budget_overrun(实际>hold)→ 记审计 + **transitionCircuitToOpen(budget_overrun)**(同一
  #     reducer,architecture §6.6),不倒写 quota_exhausted
```

- **money/token 全整数**(§1.3;非有限数整条拒)。
- **恢复补跑(轮 31 B3 成组化+轮 33 C5 ownership precedence 重写)**:启动恢复事务(§4.6)后 janitor 扫 `state=held` 的 reservation,**归组按优先序判定(封闭)**:①`transferredToTaskId` 非空 → 归该 Task 组(**仅 enterTerminal 收口;settleAttemptForRetry 与 activation reducer 均不得释放**);②否则 `activationRef` 非空 → activation 组(§10.7 结算);③否则按 `{taskId, dispatchId}` 组。每组经对应书挡③/结算 reducer 幂等重入整组收口——UsageEvent 幂等锚保证不双记,单条 reservation 不得独立 settle(与 §6.3「UsageEvent→held 释放→terminal receipt 原子」对齐);不可判终局者随 Task reconciling 路径收口(§5)。本优先序与 §10.7 transfer 划界为同一规则的两处表述,以本条为 SSOT。

### 10.5 三事务书挡的列级接线 + GCRA/TAT + approval_prompt [NORMATIVE]

- **书挡①(durable accept;T1 同事务;§6.3 表首行的展开)**——顺序封闭:
  1. parent 解析 + root get-or-create(§10.1/§10.2/§10.3);
  2. 三闸判定(depth/hop/route;违 → 4042);
  3. root 聚合累计检查:task_count/wall_clock_ms/rootCaps 各维(超 → 按 **effectiveExhaustionPolicy(exhaustedAccountRefs)(§10.4 规范函数;轮 35 P2:统一函数名,per-account 判定/聚合/无窗归 fail/不可 override 归 fail 均在函数内)**:fail→4042;defer→T2 落 queued(budget_wait,nextEligibleAt=max(resetAt));pause_for_human→须 holder 可用,否则按 T9b guard 降级——§5.2 T9b/architecture §6.6);
  4. reserve `queue_slots/queue_bytes`(principal/installation/room/root 四 scope 各一 hold;暂态失败→4057,结构失败→4042);
  5. settle `task_count+1`(root;操作锚=BudgetReservation(bookend=accept) 行,不经 UsageEvent);
  6. insert Task/idempotency/TaskLineage/EffectiveBudgetSnapshot + retryClassBasis(§8.3/§10.11)。
  任一步失败=整事务回滚,typed error 不生成 taskId(4042/4057/4044/4059/D-6 族)。
- **书挡②(dispatch;T3/T4 共用 reducer 的预算腿)**:**root 聚合复验(轮 31 B1+轮 32 修:重验对象=当前 `BudgetAccount{scopeKind=root}` 各维 `hardLimit/version`(含 BudgetOverrideGrant 叠加后的现值),不是 benv_.rootCaps 快照——grant 后重跑不得按旧 cap 误拒;benv_.rootCaps 仅作基线/审计 provenance。目的不变:accept 与 dispatch 间同 root sibling 可能已耗尽额度,最末防线不许有空窗)**→ per-task `maxAttempts` 检查(超限=T21 terminal quota_exhausted 路径)→ consume `attempt_count`(settle+1)→ release 书挡① queue hold → concurrency reserve(=§6.1 runtime_execution_slots insert,轮 31 B7)→ reserve `context_tokens/output_tokens` 上界 + `money_micros` worst-case(held;上界=pinned tokenizer + 输出硬 cap,无法界定 hidden context 时 API-billed adapter fail-closed——architecture §6.6)→ ProviderCircuit 检查(open 且 cooldown 未到 → **circuit 专属出口=恒 T4d 边(轮 37 修:§5.2 增补边,queueReason=provider_wait;禁 T9b/T21)——circuit 失败同样=书挡② 整事务回滚(attempt 不耗、queue hold 保留、slot 不占、token/cost hold 不留),T4d 为回滚后的替代写集**;half_open 探针 CAS 见 §10.4)。**预算类失败=整事务回滚(轮 31 B2:attempt 不消耗、queue hold 保留、slot 不占),同一 writer 事务按 effectiveExhaustionPolicy(exhaustedAccountRefs)(§10.4 规范函数,轮 35 P2:不再引 raw onBudgetExhausted)改写三出口之一(T4c 重排 / T9b waiting_input(budget) / T21 terminal——三出口只写 queueReason/nextEligibleAt/终态列,是回滚后的替代写集;§5.2 已锁)。「真正 dispatch 即消耗 attempt(crash 也算)」(architecture §6.6)= dispatch 事务 commit 成功才算消耗,commit 后 crash 仍算;回滚不算**。
- **书挡③(settlement;§5.1 reducer 3 enterTerminal 与 reducer 4 settleAttemptForRetry 的预算腿)**:幂等 insert UsageEvent(**幂等锚=(dispatchId, settlementKind) 部分唯一,轮 31 B3;T6b 无执行 attempt 按 0 用量记,usageQuality=broker_measured**)→ 该 `{taskId, dispatchId}` 关联 held reservation **全组在同一事务** settle(actual ≤ hold)/release(未用)→ 实际>hold → 记 `budget_overrun` 审计 + circuit open,**effect/outcome 不倒写**(已成功保持 succeeded,architecture §6.6)→ ProviderCircuit 推进 → root 聚合累计(wall_clock_ms settle)→ terminal receipt / `retryNotBeforeAt` / budget suspension(三选一,§5 已锁)。
- **GCRA/TAT(wake_signal 维;architecture §8.2)**:账户=`{scopeKind=endpoint, scopeId=目标 endpointId, dimension=wake_signal, windowKey=""}` 的 `tat` 列(null 视作 transactionNow,轮 31 B6);**推进与 wake outbox 写入同一事务**:`allowed = (tat - transactionNow) ≤ wakeBurstToleranceMs`;allowed → `tat' = max(transactionNow, tat) + wakeEmissionIntervalMs` + insert outbox(wake_signal);denied → 不写 outbox,任务保持 queued(queueReason=awaiting_wake,level-triggered 下一 tick 重验)。**burst 语义(轮 31 B6)**:同一时刻可连发次数 = `floor(τ/I)+1`(τ=tolerance, I=interval;§10.12 默认 τ=I ⇒ burst=2)。**禁 session-local counter**(跨 session 绕过,architecture §8.2)。
- **approval_prompt(architecture §10.1 approval-spam 闸)**:ApprovalChallenge 铸造事务(T9a approval 腿;§12 章承接)内 settle `approval_prompt+1`,账户二层:`{root, 小时窗}` 与 `{principal, 小时窗}`(双双通过才铸)。**幂等锚(轮 31 B3)**:该 settle 的 BudgetOperation 构造值以 `challengeRef=approvalId` 为锚(hash-input 见 §10.4——bookend="approval" + challengeRef;每 challenge 恰记一次,challenge 铸造事务重放/恢复补跑不双计)。超限 → 不铸 challenge,该 approval 请求按 architecture §6.1 决策表 rule 2 语义处理(人闸暂不可用 → terminal denied + `nextAction=create_user_origin_task`),审计记 `approval_prompt_quota_exhausted`。**不同 operationHash 不合并批准**(architecture §10.1;quota 是唯一聚合点)。
- **human-first 调度**(architecture §8.2):连续 agent-turn 上限+cooldown 的专用维度不入 v1 封闭枚举——v1 由 wake_signal GCRA + attentionPolicy(§2.5)承载,scheduler 级公平细则随 Console/调度交付(如实声明,防「已设计」误读)。

### 10.6 FanoutAllocation(join/escrow) [NORMATIVE 形状;v1 铸造入口 UNSUPPORTED]

```text
fanout_allocations fan_<ulid> {
  fanoutId, parentTaskId, rootAdmissionId, groupKey: string,
  childCeiling: int,                   # 一次事务全额 escrow(default all-or-none;不足=整组拒)
  escrowReservationRefs: [](→rsv_),
  joinPolicy: {withinGroup: "all_of"|"any_of",
               acrossGroups: "independent"|"sequential",
               outcomePrecedence: "first_terminal_failure_wins"|"all_settle"},
  state: "escrowed"|"released"|"cancelled",
  createdAt, releasedAt: int|null
}
```

- escrow 释放:**child terminal 或 cancel_confirmed 才释放对应份额**(architecture §6.6);全组收口 → state=released。
- **v1 无 batch-submit wire 载体**(§7.2 封版为单任务 submit;逐次 submit 的 child 不建 allocation 行,直接走 §10.5 书挡/root 聚合账):本表 schema 先行仅为 migration 冻结;铸造入口开放 = 未来 batch 提交面修订 + 新 protocol feature。joinPolicy 词表为 v1 最小封闭集(architecture §6.6「三字段——v3 推论非 Hatchet API」),扩词=本文修订。

### 10.7 D-6 activation 存储(ActivationGrant / ActivationAttempt / PreAcceptSubmitIntent) [NORMATIVE]

```text
ActivationGrant actg_<ulid>(C 类 sealed 授权记录,§3.2-C;policy_control 资产——
    architecture §10.1 传递闭包点名「ActivationGrant/billing-binding 存储」:任务 RPC 变更恒拒
    (rule 1,nextAction=open_admin_settings),铸造/撤销仅 admin plane):
  {grantId, principalId, targetClass: "claude_session"|"codex_worker", profileId: string|null,
   billingClass, accountClass, region: string(Chunk 6:跨厂商 dispatch 的 region 载体,与 provider
     共定 {provider, region};§5.1 fence), costLimits: {maxCostMicros, maxActivationsPerHour},
   dataPolicyDigest, memoryIsolationRequired: bool,   # codex_worker 恒 true(F14)
   expiresAt, revokedAt: int|null, policyEpoch, version, createdAt}

ActivationAttempt act_<ulid>:
  {activationId, grantRef(→actg_), targetClass, profileId: string|null,
   coalescingKeyDigest: "sha256:…",    # = AB-CANON-1("AgentBridge/ActivationCoalescingKey/v1",
                                       #   {installationId, targetClass, profileId, principalId,
                                       #    activationGrantRef, billingBindingRef, accountPolicyDigest,
                                       #    dataPolicyDigest, memoryIsolationDigest})(architecture §6.3
                                       #   coalescing key 逐字;§1.4 缺席=null)——防跨账户合并继承凭据/账单
   state: "spawn_pending"|"spawning"|"ready_unbound"|"succeeded"|"failed"|"expired"|"superseded",
   workerRef: string|null(→wkr_), startedAt, readyAt: int|null,
   deadlineAt,                         # = startedAt + activationTimeoutMs(有界;超时→failed,4037)
   consumerRefcount: int,              # = live PreAcceptSubmitIntent 数 + 已 accept 且未 terminal 的
                                       #   consumer Task 数;见 obligation transfer
   settledAt: int|null, failureReason: string|null}
  部分唯一:coalescingKeyDigest 至多一行 state ∈ {spawn_pending, spawning, ready_unbound}
    (coalesced join 的实现锚:同 key 并发 submit join 同一 attempt,不重复 spawn)

PreAcceptSubmitIntent pai_<ulid>(§7.2 preaccept binding 的存储 owner):
  {intentId, idempotencyScopeDigest, payloadDigest, requestSemanticDigest,   # §7.2 join 三元
   rootAdmissionId, parentKind, parentTaskId: string|null,                   # 轮 31 C1:lineage carrier——
   continuationTokenHash: string|null,                                       #   preaccept 事务解析(§10.2 三分
                                                                             #   +continuation 消费)并持久;
                                                                             #   Task accept 原样转入 TaskLineage,
                                                                             #   不重解析(防 crash 后 parent 状态
                                                                             #   漂移改判);architecture §6.3
                                                                             #   「原子建立…RootAdmission/
                                                                             #   continuation 绑定」的列级落地
   activationRef: string|null(→act_),
   reservationRefs: [](→rsv_;bookend=activation 的 hold),
   state: "pending"|"consumed"|"failed"|"expired",
   terminalTypedCode: int|null,        # 轮 33 C4:终局错误码(4036/4037/4038/4039 等);
                                       #   CHECK:state ∈ {failed, expired} ⇔ NOT NULL——
                                       #   tombstone 重放原 typed error 的持久载体
   consumedByTaskId: string|null, createdAt, deadlineAt, settledAt: int|null}
  唯一约束(轮 31 C4:含终态):idempotencyScopeDigest **全局唯一(含 failed/expired)**
    ——同 idempotencyKey 重放:pending → join(三 digest 全等,异值 4044 零 side effect,§7.2);
    consumed → 走 §6.1 任务幂等(Task 已在);**failed/expired → replay 该终局对应 typed error
    (4037/4038 等原值),不新 spawn**(architecture §6.3「不每次新 spawn」;新尝试=新 idempotencyKey)。
    **retention(轮 32 C4+轮 33 修)**:终局行瘦身为 idempotency tombstone(保留 scopeDigest/state/
    **terminalTypedCode 列**/三 digest,清 payload 级与 activation 引用)后**常驻**(与 §2.5.1
    RegistrationDecision「latest 常驻」同型)——不存在「GC 后同 key 重 spawn」路径;replay 的
    typed error 从 terminalTypedCode 列读取(可区分 timeout/spawn 失败/未授权);完整行 30d
    [default,可 policy 收紧] 后瘦身
```

- **side-effecting activation 前置原子事务**(architecture §6.3 逐字的存储接线;单 writer 事务):insert PreAcceptSubmitIntent + RootAdmission/continuation 绑定(§10.1/§10.3 的 parent 解析先行)+ idempotency binding(三 digest)+ activation 资源 reservation(`activation_attempt+1` settle(累计型,grant.costLimits.maxActivationsPerHour 小时窗检查)+ `activation_compute_micros` 上界 hold)+ ActivationAttempt(get-or-join by coalescingKeyDigest)+ spawn outbox(kind=spawn_intent,§6.1 枚举既有;operationKey=`spawn:<activationId>`)。
- **三处重验**(architecture §6.3:coalesced join / worker READY / Task accept):每处同事务重验 grant `{expiresAt, revokedAt, policyEpoch}` 与 billing/data policy digest、memory attestation(worker READY 时由 §9.2 启动义务产出)——任一变 → 该 attempt/intent `superseded`/`failed`(typed error;architecture §6.3「变则 typed superseded/unauthorized+reap」),**不静默沿用旧授权**。
- **obligation transfer(Task accept 原子腿;轮 31 C5 不动 digest)**:书挡① 的 accept 事务对携 intent 的提交原子执行:intent `pending→consumed(consumedByTaskId)` + 该 intent 的未用 hold(reservationRefs 中 state=held)经 **`transferredToTaskId` 独立列**表达 Task 归属(**行的创建时字段与 operationDigest 不可变不重算**——digest 的 hash-input 恒取创建时值,taskId 字段=创建时 null)+ refcount 转移经结算行(下条:intent 侧 release(accepted_transfer)+ Task 侧 acquire,同事务两行,净值不变)。**transfer 后收口归属(轮 32 C5+轮 34 修:两 reducer 集合分立,不共用)**:①activation 侧 janitor/结算 reducer 的作用域=`activationRef 非空 ∧ transferredToTaskId IS NULL` 的 hold——已 transfer 行**排除**,不得提前释放;②**enterTerminal** 的收口集合=「`{taskId, dispatchId}` 关联行 ∪ `transferredToTaskId = 本 taskId` 的行」(Task terminal 时 transferred hold 一并 settle/release,不存在无主 hold);③**settleAttemptForRetry** 的收口集合=**仅当前 attempt 的 `{taskId, dispatchId}` 关联行,不含 transferred 行**(T18 重试不得提前 release/settle Task 级 obligation——下一 attempt 不虚增额度、不提前计费);恢复补跑(§10.4 ownership precedence)与本条同义,以 §10.4 为 SSOT。**已 settled 的 activation 用量永不转移/二次 settle**(UsageEvent 行挂 `activationRef`+root,幂等锚=(activationRef, settlementKind, settlementConsumerRef),§10.4)。
- **结算幂等 key(§0-A.10「activation refcount 幂等结算 key」;轮 31 C2 重做)**:refcount 每次增减各对应一行 `activation_settlements{settlementDigest PK}`——`settlementDigest = AB-CANON-1("AgentBridge/ActivationSettlement/v1", {activationId, consumerRef(intentId 或 taskId), direction: "acquire"|"release"})`;**部分唯一 (activationId, consumerRef, direction)——每 consumer 至多一 acquire、一 release,方向对消,枚举细分不产生第二把幂等键**。审计列 `settlementKind`:acquire → `consumer_acquired`(PAI 创建/coalesced join 时写入);release → `accepted_transfer|failed_release|expired_release|terminal_release`(consumed intent 的 Task terminal 走 terminal_release;failed 与 expired 是同一 release 槽位的不同审计标注,**不可能双减**)。
- **refcount 与 reap**:consumerRefcount = 该 activationId 的 acquire 行数 − release 行数(增减仅经结算行,crash 重放安全);`refcount=0` 且无 accepted live Task → worker 才可进入 DRAINING/reap(§10.8;architecture §6.3「不无条件 reap 共用 worker」/§11 pendingActivations 谓词)。**activation 累计账不因 profile/policy/idempotencyKey 变化重置**(封串行 churn,architecture §6.6)。
- **ActivationAttempt 状态机(封闭表;轮 31 C7 补终结转移)**:`spawn_pending→spawning`(spawn_intent outbox sent CAS)/`spawning→ready_unbound`(worker READY + §10.7 三处重验之二过)/`spawn_pending|spawning→failed`(spawn 失败或 deadlineAt 到,4037/4038)/`ready_unbound→succeeded`(**首个** obligation transfer 成功=至少一 Task accept)/`ready_unbound→expired`(deadlineAt 到且 refcount=0 且无 pending intent)/任意非终态`→superseded`(grant 撤销/policy epoch 变——§10.7 三处重验命中)。succeeded 后 attempt 终局(refcount 经结算行继续记账,worker 生命周期归 §10.8);**pendingActivations(architecture §11 逐字)= 未消费 PAI(state=pending)+ state=ready_unbound 的 attempt**(轮 32 C7-P2:不冒称扩义;spawn_pending/spawning 阶段的 broker 退出义务由 worker_processes 未 REAPED 行(leasedAdapters)与 spawn_intent outbox 义务覆盖)——全部终态均退出谓词,不存在永久非零。
- 失败面(§16.2 既有码):activation timeout→4037;spawn/启动失败→4038;grant 缺失/撤销/policy 拒→4036;billing provenance 不明→4039;capability 不支持→4035。

### 10.8 WorkerProcess(§9.2 存储接线;supervisor 域) [NORMATIVE]

```text
worker_processes wkr_<ulid> {
  workerId, workerGeneration: int, brokerGeneration: int(=brokerBootEpoch 快照),
  supervisorPid: int, childPid: int|null, pidStartTime: string|null, launchNonce: string(UNIQUE),
  profileDigest, activationRef: string|null(→act_),
  runtimeSessionRecordId: string|null(→rs_;进程内注册于事务 B,§10.8/§4.1——STARTING 且未 CAS PID 时恒 null),
  state: "STARTING"|"READY_IDLE"|"BUSY"|"RECONCILE_TASK"|"DRAINING"|"TERM_SENT"|"KILL_SENT"|"REAPED",
  activeDispatchId: string|null, lastUsedAt,
  idleDeadlineAt: int|null, drainDeadlineAt: int|null,
  reapedAt: int|null, reapReason: string|null,
  memoryAttestationDigest: string|null   # F14 隔离证明(READY 前置;§9.2 启动义务)
}
部分唯一:(pidStartTime, childPid) 至多一行未 REAPED(PID 复用防护);
         activationRef 至多一行未 REAPED
```

- **spawn 两阶段接线**(durable intent → 外部 spawn → PID CAS;补 architecture §9.2 的崩溃窗;轮 31 C6 修):
  1. **事务 A(§10.7 activation 前置事务内)**:insert 本表行 `{state=STARTING, launchNonce, supervisorPid, childPid=null}` + spawn_intent outbox(pending)。**rs_ 不在此建**(身份四元组未齐);
  2. **进程外 spawn**(supervisor 执行):**sent 线性化点 = fork 之前** supervisor CAS outbox `pending→sent`,**同事务持久写 spawn_intent 专属列 `sentAt=transactionNow` 与 `spawnAckDeadlineAt=sentAt+spawnAckTimeoutMs`(轮 32 C6:outbox kind 专属列,照 resume_intent 先例——恢复对账从持久 deadline 读取,重启不重置窗,反复 crash 不产生永不收口的 STARTING)**;随后 fork,control-pipe/launchNonce 封口,spawn env 走 allowlist 剥离未租出 provider key(architecture §6.6/§9.2);
  3. **事务 B(PID CAS)**:supervisor 经 control-pipe 收到子进程自报 launchNonce 后,CAS `{workerId, state=STARTING, childPid IS NULL}` → 写 `childPid/pidStartTime` + **endpoint/worker rs_ 进程内创建**(§4.1「spawn 事务中直接创建」的精确时点=本事务——身份四元组 `{supervisorPid, childPid, pidStartTime, launchNonce}` 此刻才齐;§10.14#7 同步)+ **spawn_intent outbox `sent→acked` 并清 `spawnAckDeadlineAt`(轮 33 P2:spawn 义务收口,无永久 sent/过期时钟残留)**;spawn 失败 → `state=REAPED(reapReason=spawn_failed)`(无进程即无 waitpid 义务,无 rs_ 即无 phantom 身份)+ activation failed 结算(§10.7)+ **spawn_intent outbox → abandoned 并清 spawnAckDeadlineAt(轮 34 P2:失败腿同收口)**。
  **恢复对账(崩溃窗四格封闭)**:重启扫描 `state=STARTING` 行——`outbox=pending ∧ childPid=null` → 未 fork,outbox abandoned+REAPED(spawn_failed);**`outbox=sent ∧ childPid=null` → 不可判(可能已 fork)**:按 launchNonce 经 process table/control-pipe 扫描存活候选,找到自报 nonce 的进程 → 补事务 B;持久 `spawnAckDeadlineAt`(第 2 步写入)到仍未找到 → **先执行 process-group 清理并取得 exit/不存在证据,再 REAPED(spawn_failed)+outbox sent→abandoned+清 deadline(轮 34 P2)**(轮 32 C6:sent+null 意味着「可能已 fork」,REAPED 唯一入口纪律不许先标后杀);`childPid 非 null` → 正常按 waitpid/状态机续走。
- **状态机(封闭表;DB CHECK+reducer 强制,§5.1 同型纪律)**:`STARTING→READY_IDLE`(READY 前置=memory attestation+billing provenance 过,§10.7 三处重验之二)/`READY_IDLE→BUSY`/**`BUSY→READY_IDLE` guard(轮 31 C3;architecture §9.2 逐字)= 关联 task terminal **且** 无未决 MCP request/elicitation/write queue(判定来源=进程内 adapter 的 per-request 记账:pending MCP 调用数/未决 elicitation 数/写队列深度全零——`waiting_input/approval/callback` 期间恒 BUSY、不起 idle 计时)**/`BUSY→RECONCILE_TASK`(请求失败但子进程存活)/`RECONCILE_TASK→READY_IDLE`(**同 guard(轮 32 C3):对账完成 且 关联 task terminal 且 无未决 MCP request/elicitation/write queue——「才回 READY_IDLE」约束适用于所有回边,architecture §9.2**)/**`BUSY|RECONCILE_TASK→DRAINING`(仅 stuck-BUSY 收割路径——依据 architecture §9.2 BUSY 收割段「revoke/settle ExecutionLease → 走 DRAINING/REAP」;轮 31 C9:非新增边,系收割段的显式化,提请复核)**/`READY_IDLE→DRAINING`/`DRAINING→TERM_SENT→KILL_SENT`;**REAPED 的唯一入口 = waitpid exit-observed(任意 live 态)或 spawn_failed**——发 TERM/KILL 不算,已退出进程不得回 READY_IDLE(architecture §9.2 逐字)。unexpected exit → 关联 Task 进 reconciling(§5.2 T17,executor_lost)+ 本表 exit-observed→REAPED。
- **supervisor 定时器域表**(与 §5.6 janitor 互不越界——§5.6 已注明归属):

| 定时对象 | 时钟源 | 动作 |
|---|---|---|
| warm TTL | idleDeadlineAt(READY_IDLE 起算;waiting_* 期间恒 BUSY 不起算) | → DRAINING(`connections=0 && activeTasks=0` 时立即 drain 不等 TTL——另须 §11 architecture pendingActivations/refcount 归零) |
| drain 序列 | drainDeadlineAt | DRAINING(协议 shutdown/关 stdin)→ TERM_SENT(SIGTERM)→ KILL_SENT(SIGKILL);每级独立 timeout(§10.12) |
| stuck-BUSY 收割 | Task deadline/cancel/approval-expiry(§5 触发) | interrupt pending MCP → bounded drain → EffectIntent denied/cancelled 或 Task reconciling → revoke/settle ExecutionLease(worker-process 记录仅 waitpid→REAPED 后收口)→ DRAINING/REAP(architecture §9.2「无未决 MCP request 不得成为活死条件」) |
| 启动遗留扫描 | broker 启动恢复(§4.6 之后) | 按 {pidStartTime, childPid}+launchNonce 对账;无主进程 → process-group 清理+REAPED |

- worker 的 ExecutionLease/completionToken/PushCompletionHandle 语义在 §3.2-B/§5/§6/§11 章,此处不重复;`leasedAdapters` 退出谓词(architecture §11)= 本表未 REAPED 行数。

### 10.9 DedicatedBinding(D-6 pin 存储) [NORMATIVE]

```text
dedicated_bindings dbind_<ulid> {
  dedicatedBindingId, bindingEpoch: int,
  installationId, targetClass: "claude_session"|"codex_worker", profileId: string,
  pinnedEndpointId, pinnedRuntimeSessionRecordId: string|null,   # claude_session pin 到具体 rs_
  workspaceFingerprintDigest: string,  # 轮 31 C8:非空哨兵——""=安装级 pin(同 windowKey 手法,
                                       #   规避 SQLite NULL 唯一语义);profileId 同法,""=默认档
  pinnedByPrincipal, bindingAttestationRef: string|null,
  activationGrantRef: string|null, activationGrantVersion: int|null,   # 轮 59 P1-E:pin 时快照的 grant version(exact-compare 锚)
  # **治理解析总函数(轮 58-59 P1-11/E)**:resolvedRegion/resolvedTargetAccountClass=
  #   activationGrantRef 非空 ⇒ 取该 grant,须 (revokedAt IS NULL ∧ now<expiresAt ∧ grant.version==
  #     activationGrantVersion)(轮 59:status→revokedAt IS NULL;exact version=pin 时快照,grant 更新到新
  #     version=config 变更→dbind stale→4064 保守拒,须 admin re-pin),且 region==pinnedEndpoint.region
  #     (不等→4064);任一不满足 → 4064;
  #   activationGrantRef 空 ⇒ region=pinnedEndpoint.region,targetAccountClass=(pinnedRuntimeSessionRecordId
  #     非空 ? pinnedRuntimeSession.accountClass.verified??unknown : unknown);
  #   任一为 null/unknown 且 dataClassification=restricted → 4064
  status: "active"|"revoked", createdAt, revokedAt: int|null
}
部分唯一:(installationId, targetClass, profileId, workspaceFingerprintDigest) 至多一 active
  ——D-6「唯一 eligible pin」的判定基(哨兵列全非空,约束真实生效);铸造/撤销仅 admin plane /
  用户显式 CLI(pin 操作),任务 RPC 不可建(scheduler 只读)

fallback_allowlists(轮 31 C8:ordered allowlist 正规化——soft_fallback 的「用户预存有序表」载体):
  {allowlistId(PK), installationId, targetClass, profileId: string(""=默认),
   createdByPrincipal, status: "active"|"revoked", createdAt, revokedAt: int|null}
  部分唯一:(installationId, targetClass, profileId) 至多一 active
fallback_allowlist_entries:
  {allowlistId, ordinal: int, dedicatedBindingRef(→dbind_)}
  PK=(allowlistId, ordinal);**UNIQUE(allowlistId, dedicatedBindingRef)(轮 33 P2:同一目标不得
  多 ordinal 重复)**;**entry eligibility guard(轮 32 C8+轮 33 收紧;admin plane 写入时验,
  解析时同事务重验)**:被引 dbind_ 行必须 status=active 且 {installationId, targetClass,
  **profileId**} 与 allowlist 行全等,且 dbind_.workspaceFingerprintDigest ∈ {"", 当前 Task 的
  workspaceFingerprintDigest}(workspace 专属 pin 不得被其它 workspace 的 fallback 借用)——
  任一不符该 entry 按不可用跳过并审计;soft_fallback 解析按 ordinal 升序逐个有界尝试,结果显式
  fallbackUsed/fallbackIndex;**fallbackIndex ≡ fallback_allowlist_entries.ordinal(轮 34:锚定
  allowlist 全表序——caller 保序子集与 skipped entry 均不重新编号;同一 {dbind, epoch} 恒同
  index,routeKey(§10.2 canonicalTarget fallback 支)不可借子集选择改写)**(architecture §6.3);
  无 active allowlist=4040。
  **principal 维度如实声明(轮 33 C8)**:v1 allowlist 为 installation 级资产(admin plane 铸造
  =「用户预存」的 v1 定义;same-UID 单用户模型,architecture §10.4),createdByPrincipal 仅审计,
  解析不做 per-principal 隔离;multi-principal 隔离属 Phase 5 multi-room 修订,届时本表加
  principal 维并入唯一键——不冒称已支持
```

- **消歧(封版章交叉)**:architecture §6.2 `resolvedTarget{bindingId, bindingEpoch}` 与 §6.3 D-6 所称 binding = **本表 DedicatedBinding(dbind_)**,不是 §4.9 WorkspaceBinding(bind_,配对 ACL)——两实体正交:WorkspaceBinding 回答「谁和谁配了对」(授权),DedicatedBinding 回答「ask_* 的 dedicated 目标 pin 到哪」(路由)。resolvedTarget.bindingId 的值域=dbind_。
- **bindingEpoch fence**:D-6 解析(书挡① 前的有界决策树)冻结 `{dedicatedBindingId, bindingEpoch}` 入 resolvedTarget;resolve→dispatch 间 revoke/epoch 变 → Task terminal `superseded`(不静默改投,architecture §6.3);「binding 存在但 pinned 目标 offline ≠ 空 pin」——只对 exact bindingEpoch 有界 wake/dispatch,失败 4033,不落 activate/fallback。
- soft_fallback 的用户预存 ordered allowlist = `fallback_allowlists` + `fallback_allowlist_entries` 两表(见上;轮 31 C8 正规化,ordinal 全序可验证)。**caller `fallbackChain` 的语义(轮 32 C8 收窄)**:只允许为 active allowlist 的**保序子集**(逐项与 entries 的 dedicatedBindingRef 匹配且 ordinal 单调;出现 allowlist 外的 dbind_/乱序 → 4058)——caller 只能收窄不能扩表,「仅按用户预存 ordered allowlist」(architecture §6.3)恒成立;缺席=全 allowlist。无 active allowlist=4040。

### 10.10 ExecutionProvenance(carry-in「多-agent provenance / 伪独立共识 hash」,HANDOFF §J.3-b) [NORMATIVE]

```text
execution_provenance {
  dispatchId(PK;→dispatch_attempts,独立表零封版列改动),
  provider: string|null, requestModel: string|null, responseModel: string|null,
  executorSurface: enum(§2.3 六值), workerProfileDigest: string|null,
  providerOutcome: enum|null,          # 轮 36:§10.4 union 四值;write-once,终局事务(书挡③/T20)
                                       #   与 circuit 推进同事务写入——providerOutcome 判定的持久锚
  contextBasisDigest: string|null,     # resolvedContextBasis 存在时的 digest 引用;v1 fresh 恒 null
  provenanceDigest: "sha256:…"         # = AB-CANON-1("AgentBridge/ExecutionProvenance/v1",
                                       #   {provider, requestModel, responseModel, executorSurface,
                                       #    workerProfileDigest, contextBasisDigest})(§1.4 缺席=null)
}
```

- **broker-owned**:全列由 broker 从 UsageEvent(书挡③ settle 时的 provider/model 事实)、worker profile、dispatch 记录派生;**executor/caller 不可自报**(payload 声称的 provider/model 仅是文本,不入本表)。写入时点=书挡③ settlement 同事务(provider 事实此时才齐)。
- **用途(architecture §14「多 agent 伪独立共识」风险的机器化)**:caller 对多个「独立」执行结果做共识/投票时,同 `provenanceDigest`(同 provider+model+context 来源)的结果**不构成独立证据**,应降权——判定材料即本表。
- **wire 投影(additive,随本章复核)**:TaskSnapshot.result 增 optional `provenance: {provider, requestModel, responseModel, executorSurface, provenanceDigest}`(§7.2 封版形状的 additive optional 字段;仅 terminal 后出现;不含 digest 输入之外的新事实)。

### 10.11 retryClassBasis 与 effective 快照 storage owner(§8.3 接线) [NORMATIVE]

- `retryClassBasis{snapshotId, loadStatus, manifestVersion|null, effectiveDigest, matchedSelectors: [], resolvedClass}`(§8.3)**storage owner = tasks 行的 effective 快照列族**(broker 着色,§6.2;JSON 列 `retryClassBasis`)——Task 级不可变,书挡① 写入,manifest 更新不回写(§8.3 冻结语义)。
- **storage owner 注记(architecture §4 尾注要求「嵌入其它记录须注明」)**:`EffectivePolicySnapshot` 全族(含 retryClassBasis/canonicalOperationKind/effectiveTargetResolutionPolicy/resolvedTarget)= tasks 行 effective 列族,无独立表;`EffectiveBudgetSnapshot` = 独立表 benv_(§10.4;tasks.effectiveBudgetSnapshotRef 引用);`host_turn_boundaries` = 独立预留表(§10.1,v1 空);`PreAcceptSubmitIntent/BudgetOverrideGrant/ActivationGrant` = 独立表(§10.7/§10.4)。

### 10.12 发布默认数值总表 [NORMATIVE;全部 default,可 policy 收紧——Phase 0/运行数据仅校准数值,不改规范地位(§1.2)]

| 参数 | default | 依据/备注 |
|---|---|---|
| maxDepth | 4 | 三闸(§10.2);architecture §6.6「有限硬上界+默认从紧」 |
| maxAgentHops | 8 | 同上(v1 恒 depth,上限给独立余量;轮 32 P2 修正) |
| maxRouteOccurrencesPerBranch | 2 | 「容一次合法 A→B→A callback」逐字(architecture §6.6) |
| root taskAllocation(task_count/root) | 64 | root 聚合累计,不重置 |
| root money cap(money_micros/root) | 5_000_000(=5 USD) | billingClass=api 在其 conformance gate 前 hard-disabled(architecture §6.6),此值仅 gate 后生效 |
| root wall-clock cap | 21_600_000(6h) | 累计型 |
| queue_slots / queue_bytes(per principal) | 32 / 64 MiB | 书挡① |
| concurrency(per rs_) | 1 | 强制载体=§6.1 runtime_execution_slots(轮 31 B7:不建账本行,本行仅声明语义值) |
| maxAttempts(per task) | 3 | retryClass=forbidden 时等效 1(§8.3) |
| maxCostMicros / maxOutputTokens / maxContextTokens(per task) | 1_000_000(1 USD)/ 65_536 / 200_000 | taskAllocation(§10.4;轮 31 B7 补全——§7.2 所指「数值语义与默认值随 §10」) |
| backoffBaseMs / backoffCapMs | 5_000 / 300_000 | 持久 backoff(architecture §6.6) |
| wakeEmissionIntervalMs | 300_000(=12/h) | GCRA(architecture §8.2「每小时唤醒上限」) |
| wakeBurstToleranceMs | 300_000(τ=I ⇒ burst=floor(τ/I)+1=2) | 轮 31 B6 修正(旧值 600_000 实为 burst 3) |
| approval_prompt(root/h;principal/h) | 10;30 | §10.5 |
| circuitFailureThreshold / circuitCooldownMs | 3 / 60_000 | ProviderCircuit(§10.4;轮 31 B5 补定义) |
| activationTimeoutMs | 60_000 | D-6 有界 activation(architecture §6.3) |
| spawnAckTimeoutMs | 30_000 | spawn sent 后未获 nonce 自报的收口窗(§10.8;轮 31 C6) |
| maxActivationsPerHour(per grant) | 6 | §10.7 |
| worker warm TTL(idleDeadline) | 600_000(10min) | 「有限硬上界、默认从紧、禁无限」(architecture §9.2) |
| worker drain 各级 timeout(shutdown/TERM/KILL) | 5_000 / 5_000 / 5_000 | drain 序列(architecture §9.2) |
| continuation capability TTL | 24h | §10.3(v1 无铸造入口,值为 schema 预置) |

### 10.13 表清单增补(PK/唯一约束/索引;§6.1 任务面表与 §4.11 身份表之外) [NORMATIVE]

| 表 | 主键 | 唯一/索引/关键列 |
|---|---|---|
| `root_admissions` | rootAdmissionId | **UNIQUE(rootKeyKind, rootKeyValue)**(get-or-create 锚);originInstallationId/principalId/policyEpoch |
| `host_turn_boundaries` | hostTurnKeyDigest | runtimeSessionRecordId 索引;turnEvidenceKind/observedAt/**eventRef/epochValue+双唯一键 UNIQUE(rs_, kind, eventRef)、UNIQUE(rs_, kind, epochValue)+CHECK(kind=prompt_epoch ⇒ eventRef NOT NULL ∧ epochValue NOT NULL ∧ epochValue ≥ 1)(轮 32 A4+轮 33/35:get-or-increment 单事务,重送返原 epoch,无跳号;行保留至 rs_ OFFLINE tombstone 禁 GC)**;[E2E-GATED→P0A-9] v1 空表 |
| `task_lineage` | taskId | rootAdmissionId 索引(root 聚合快查);parentTaskId 索引(branch 上溯);CHECK parentKind=task ⇔ parentTaskId 非空;全列不可变 |
| `continuation_capabilities` | tokenHash | callerTaskId/rootAdmissionId 索引;consumedAt/revokedAt |
| `effective_budget_snapshots` | budgetEnvelopeId | 不可变;tasks.effectiveBudgetSnapshotRef → 本表 |
| `budget_accounts` | accountId | **UNIQUE(scopeKind, scopeId, dimension, windowKey)**;version(§7.6 fence);tat |
| `budget_reservations` | reservationId | **operationDigest UNIQUE**;(accountRef, state) 索引(janitor 补跑扫描);taskId/dispatchId/activationRef 索引;**transferredToTaskId(轮 31 C5:归属转移列,创建时字段与 digest 不可变)** |
| `usage_events` | usageEventId(seq) | **幂等锚(轮 31 B3)=(dispatchId, settlementKind) 部分唯一(dispatchId 非空)+(activationRef, settlementKind, settlementConsumerRef) 部分唯一(activationRef 非空)**;usageDigest=内容完整性(非幂等键);taskId/rootAdmissionId 索引;append-only |
| `budget_override_grants` | grantId | **UNIQUE(rootAdmissionId, dimension, revision)**;append-only;CHECK dimension ∈ §10.4 正列 |
| `provider_circuits` | circuitId | **UNIQUE(provider, billingBindingKey, model)(billingBindingKey=COALESCE(ref,'') 非空哨兵,r63 P1-6;三元不可变;凭据轮换=新建行,轮 39)**;state/cooldownUntilAt/**probeDispatchId/probeDeadlineAt/lastProbeDispatchId(独占探针+卡死收口+未决保护 ref,轮 31/36/37/38/39)**;**CHECK 三态互斥(与 §10.4 主文同):half_open ⇔ (probe 两列 NOT NULL ∧ cooldownUntilAt NULL);closed ⇒ probe 两列 NULL ∧ cooldownUntilAt NULL;open ⇒ cooldownUntilAt NOT NULL ∧ probe 两列 NULL**;行常驻不 GC(被未终局 dispatch 引用禁删) |
| `fanout_allocations` | fanoutId | parentTaskId 索引;v1 无铸造入口 |
| `activation_grants` | grantId | principalId/targetClass 索引;policy_control 资产(变更仅 admin plane);**region(Chunk 6 增补:跨厂商 dispatch 的 region 载体;与 endpoint.provider 共同定 {provider, region},§5.1 fence)列** |
| `activation_attempts` | activationId | **coalescingKeyDigest 部分唯一(state ∈ {spawn_pending, spawning, ready_unbound})**;grantRef/workerRef 索引;consumerRefcount |
| `activation_settlements` | settlementDigest | **部分唯一 (activationId, consumerRef, direction)**(轮 31 C2);settlementKind 审计列;append-only(refcount 幂等锚,§10.7) |
| `pre_accept_submit_intents` | intentId | **idempotencyScopeDigest UNIQUE(含终态;tombstone 常驻,轮 33 C4)**;**lineage carrier 列:rootAdmissionId/parentKind/parentTaskId/continuationTokenHash(轮 31 C1)**;**terminalTypedCode(state ∈ {failed, expired} ⇔ NOT NULL)**;activationRef 索引;consumedByTaskId |
| `worker_processes` | workerId | **launchNonce UNIQUE;(pidStartTime, childPid) 部分唯一(未 REAPED);activationRef 部分唯一(未 REAPED)**;state CHECK 封闭转移(§10.8);runtimeSessionRecordId |
| `dedicated_bindings` | dedicatedBindingId | **(installationId, targetClass, profileId, workspaceFingerprintDigest) 部分唯一(active;profileId/wsDigest 用 '' 哨兵非空,约束真实生效——轮 31 C8)**;bindingEpoch;pinnedEndpointId/pinnedRuntimeSessionRecordId;**activationGrantRef/activationGrantVersion(→actg_,nullable;Chunk 6 v0.12.6-v0.12.8,轮 57-59:dedicated/fallback region/accountClass 权威源+exact-version 锚;null 时取 pinnedEndpoint,§5.1 fence)** |
| `fallback_allowlists` | allowlistId(`fal_`,r63 P2-11) | **(installationId, targetClass, profileId) 部分唯一(active)**(轮 31 C8) |
| `fallback_allowlist_entries` | (allowlistId, ordinal) | **UNIQUE(allowlistId, dedicatedBindingRef)**;顺序全序可验证;fallbackIndex ≡ ordinal(轮 34) |
| `execution_provenance` | dispatchId | provenanceDigest 索引(共识降权查询);**providerOutcome(write-once,轮 36:circuit 判定持久锚)**;broker-owned |
| `retry_manifest_snapshots`(r63 P1-4/v0.12.13,§8.1 存储 owner) | snapshotId(`rms_`) | append-only;loadStatus/loadFailure/manifestVersion(nullable)/effectiveDigest/sourceDigest(nullable)/installedAt/body(JSON,invalid 时 null);active 指针+high-water 在 `broker_state`(§4.11)——非本表推断 |

- **事务边界索引增补(§6.3 表的延伸)**:书挡① 预算腿=§10.5-1..6;activation 前置事务=§10.7(spawn outbox 同事务);obligation transfer=书挡① accept 事务原子腿(§10.7);书挡③ 预算腿=§10.5;GCRA 推进=wake outbox 同事务;override grant=§7.6 决策事务(§10.4);worker 两阶段=§10.8 事务 A/B;supervisor 定时器=§10.8 域表(独立 writer 事务,anti-TOCTOU 类 3)。
- SQLite 纪律(WAL/单 writer/迁移)恒按 architecture §11;**migration 冻结前置解除**:§6.4 所待的「§10 列级 schema」即本章——本章封版后 Phase 1B migration 终版可冻结(书挡①②③ 预算列引用齐备)。

### 10.14 对已封版章节的 additive 接线记录(照 Chunk 3 先例,随本章复核)

1. **§1.3 ID 注册表增补(broker 铸造)**:`benv_`(EffectiveBudgetSnapshot)、`ba_`(BudgetAccount)、`rsv_`(BudgetReservation)、`bov_`(BudgetOverrideGrant)、`pc_`(ProviderCircuit)、`fan_`(FanoutAllocation)、`actg_`(ActivationGrant)、`act_`(ActivationAttempt)、`pai_`(PreAcceptSubmitIntent)、`dbind_`(DedicatedBinding)——`root_`/`wkr_`/`bind_` 已注册,零改义。**(r63 P2-11/v0.12.13 反向闭包补注册:`wtr_`(waiter_leases)/`caps_`(capability_snapshots)/`fal_`(fallback_allowlists)/`rms_`(retry_manifest_snapshots,r63 P1-4)——此前四表 PK 未注册前缀,§1.3 主注册表同步。)**
2. **§3.2-A continuation capability 行**:定义节占位 `§10(占位)` → `§10.3`;token kind 明确 `cn1.`;绑定元组=「原 callerTaskId/rootAdmissionId」不变(纯节号+kind 落地,零语义变化)。
3. **§16.2 错误码增补**:4059 `continuation_required`(§10.2/§10.3:bridge-derived invocation 缺有效 parent 关联/continuation 无效,统一不作在性区分)。
4. **§16.3 domain 增补**:`AgentBridge/HostTurnKey/v1`(§10.1)、`AgentBridge/RouteKey/v1`、`AgentBridge/Lineage/v1`(§10.2)、`AgentBridge/BudgetOperation/v1`、`AgentBridge/UsageEvent/v1`(§10.4)、`AgentBridge/ActivationCoalescingKey/v1`、`AgentBridge/ActivationSettlement/v1`(§10.7)、`AgentBridge/ExecutionProvenance/v1`(§10.10)。
5. **§7.2 TaskSnapshot**:result 增 optional `provenance`(§10.10;additive optional,不改既有字段语义)——**已落地于 §7.2 TaskSnapshot 定义**(轮 31 D5 修:此前仅记录未落地)。
6. **§6.1 tasks 表**:effective 快照列族增列 `retryClassBasis(JSON)/effectiveBudgetSnapshotRef`(§8.3 早已声明「随 §10 表定稿」,此为落地非新增)——**已落地于 §6.1 tasks 行**(轮 31 D6 修)。
7. **§4.1/§4.11**:worker rs_ 的进程内创建时点明确=**§10.8 事务 B**(轮 31 C6 修:身份四元组齐备时才建,事务 A 不建——§4.1「spawn 事务中直接创建」的精确化,消除 phantom rs_)。
8. **§6.1 outbox 表**:spawn_intent 增 kind 专属列 `sentAt/spawnAckDeadlineAt`(轮 32 C6;照 resume_intent 专属列先例,恢复对账的持久时钟源,不改其它 kind 语义)。
9. **§5.2 T4c guard 增补**(v0.10.6,轮 36 裁决授权):触发域扩至 `reset ≥ deadline`(副作用不变;重排后由 deadline fence 收口,防「defer×长 reset」无出口)。
10. **§5.2 新增 T4d 边 + T2 queueReason 枚举增 `provider_wait`**(v0.10.6,轮 36):provider circuit 专属 phase-preserving 重排——circuit 非预算,不复用 budget_wait 标签、不入 T9b/T21(architecture §6.6 三出口专属预算,§6.6「配套」条 circuit 为独立机制)。
11. **T4d 的 queueReason=provider_wait 为 broker 内部调度状态**(轮 37 修正:TaskSnapshot 无 queueReason 字段,本值不经 wire 投影——caller 可观察面不变,零 TaskSnapshot 改动;若未来要求 caller 可见,须作为独立 additive 增 optional 字段另审)。
12. **§5.6 定时器总表增 probe 卡死收口行**(v0.10.7,轮 37:probeDeadlineAt 到期 CAS 回 open——探针 dispatch 卡死不悬挂)。
13. **§6.1 tasks 表增列 `waitingCircuitRef`**(v0.10.7,轮 37:T4d 写入/离态清;probe 成功提前唤醒 provider_wait 任务的索引——broker 着色,零 wire 面)。
14. **§6.1 dispatch_attempts 表增列 `providerCircuitRef`**(v0.10.8,轮 38:书挡② 写入的 circuit 桶 ref,分桶身份冻结于 dispatch(model≡requestModel)——书挡③/probe 终局/恢复只按此 ref 更新;broker 着色,零 wire 面)。
15. **§5.6 queued defer 行增 provider_wait 专属 guard**(v0.10.8,轮 38:reactivation 先同事务 reconcile circuit——两 timer 无竞态窗;既有 ready 路径对非 provider_wait 任务零改动)。
16. **§6.1 dispatch_attempts 表增列 `completionRequestId/completionExpectedStateRevision` + UNIQUE(adapterInstanceId, rpcRequestId)**(Chunk 5 v0.11.2,轮 43:push 结单幂等锚+响应关联唯一键——broker 着色,零 wire 面;§11.1/§11.2)。
17. **§6.1 approval_records 表增列 `protectedManifestDigest/hmacKeyId/hmacVerified`+decision 三值枚举+`sourceChannel/sourceEventId` 四列物理唯一键+escalation 五列组(write-once)+tagged CHECK 全套**(Chunk 5 v0.11.2-v0.11.7,轮 43-48;§11.3——deny-only 记录卫生,零放行语义)。
18. **§7.5 artifact_references 表增列 `presentationScopeRef`+§7.1 通则加 pep.check carve-out 注**(Chunk 5 v0.11.2,轮 43;§12.4/§11.3——presentation 恢复锚与 hook 通道方法的授权归属声明)。
18b. **#18 补记(轮 45 P2)**:实际改动含 artifact_references **PK 扩为 (artifactRef, taskId, role, presentationScopeRef)**+`''` 哨兵+tagged CHECK(role=presentation ⇔ scopeRef ≠ '')+holder get 的 exact scope join(§7.5)。
19. **§5.2 T24 行出口增 T18**(Chunk 5 v0.11.3,轮 44 新证据:§12 三值 disposition 下对账确认 not_applied 且 T18 原 guard 全过→允许重排;architecture §10.1「仅 unknown 不自动重试」逐字——封版「仅 T19/T20」系 §12 交付前保守占位的 additive 放宽)。
20. **§6.1 tasks 表增列 `waitingBudgetWorkItemRef` + §5.2 T9b/T11a 行 set/clear 注**(Chunk 5 v0.11.5/v0.11.6,轮 46-47:budget grant 全量唤醒与全消费者终局的持久索引;broker 着色零 wire 面)。
21. **§7.6 workItem 状态机「任务终态撤销」句 per-kind 分派注**(Chunk 5 v0.11.5,轮 46:manual 保留/budget root 级——封版句精确化,不改边集)。
22. **§4.4 signal-file 切分句「以 generation 切文件」→「以 rs_ 切文件」**(Chunk 6 v0.12.1,轮 52:Chunk 0+1 占位的 additive 修正;§13 交付后以 per-rs_ 为准,文件内 generation 字段+代 CAS 承载滚代)。
23. **§6.1 tasks 表增列 `effectiveDataGovernance`**(Chunk 6 v0.12.1-v0.12.2,轮 52-53:{dataClassification, accountClass(verified??unknown), providerRegionAllowlist(entry shape), governancePolicyEpoch, roomGovernanceRef} broker 派生快照——I-4 跨厂商派发 carrier,architecture §10.2;broker 着色零 wire 面)。
24. **§2.4 capability 表 canInjectActiveConversation 的 evidence=专门 injection 探测(删 P0A-1/-6)+该 evidence 前按 surface 恒 false/unsupported**(Chunk 6 v0.12.2-v0.12.3,轮 53-54 F9:P0A-1 只证 wake、P0A-6 只证 nudge,均不证注入;architecture §7)。
25. **§6.1 增 `rooms` 表(policy_control,admin-only,room_<ULID>,唯一约束 seed)+ endpoint.provider/endpoint.region/endpoint.regionRevision/activation_grant.region/dedicated_bindings.activationGrantRef+activationGrantVersion 载体 + §5.1 数据治理 fence(eligibility 移 accept 前 D-6/T1;无 fresh/同厂商豁免)**(Chunk 6 v0.12.2-v0.12.8,轮 53-59 F11/F12/P0-2/P1-10-11:architecture §10.2 task+room 携带+三路 provider/region/accountClass 同源总函数;不新增边)。
25b. **§6.1 tasks 增 resolvedProvider/resolvedRegion/resolvedTargetAccountClass/governanceResolveDigest/governanceReevalPending 列(governanceResolveDigest=GovernanceResolve domain drift 锚)+ T21 触发增 `resolve_invalid`(治理重解析失败/digest 漂移)+ §5.6 governance_drift 行(限 pre-dispatch)+ T3/T4 guard **room epoch + GovernanceResolve digest/re-resolution 双 fence** + T1 治理原子重验**(Chunk 6 v0.12.4-v0.12.9,轮 55-60:消 TOCTOU+目标 accountClass 双侧+已 dispatch grandfather;不新增边)。
26. **§4.11 runtime_sessions 增 signalHighWater/nextWakeEligibleAt/manualAcceptPendingSince/manualAcceptEventId + `consumed_accept_events` append-only 表 + §6.1 outbox wake_signal 专属列(brokerBootEpoch/signalRevision/snapshotBody/snapshotDigest/isCleanup/tatCharged/wakeState/applyingAt)+ generic state 增 'wake_kind' 哨兵 + 部分唯一 (rs_, wakeState)+operationKey + §5.6 wake_reeval 行**(Chunk 6 v0.12.3-v0.12.7,轮 54-58 F4-F8:wake 状态机物理载体;SQLite 实跑 successor/rebase/EIO/收费/accept 幂等全闭环;broker 着色零 wire 面)。

---

## 11. push-completion wire + deny-only 审批记录(§0-A.9 push 部分;Phase 1B)

> push 路径的状态机(T4/T7/T13)、存储(§6.1 execution_leases push 扩展/completion_token_tombstones 完整 fenceTuple)、证据→outcome 映射(architecture §6.4-3)与 PushCompletionHandle 分类(§3.2-B)均已随封版章交付;本章补齐 §0-A.9 点名的剩余三件:**broker-internal holder auth 的接口契约、correlationKey 的生成/存储/唯一性编码、deny-only 审批记录面**。不与封版章重复,只做接线与缺口。

### 11.1 PushCompletionHandle:broker-internal holder auth [NORMATIVE]

```text
PushCompletionHandle(进程内不可序列化对象;§3.2-B 分类已锁「永不上 wire/DB/日志」):
  {completionTokenPlaintext,           # 明文仅存在于本对象;字段访问仅限 completePushDispatch 入口
   holderTuple: {holderInstanceId,     # = broker 进程实例标识(brokerBootEpoch 派生)
                 holderGeneration,     # = 该 adapter 实例的单调代(broker 内部)
                 adapterInstanceId, adapterGeneration,
                 executorInstanceId,   # ≡ workerId(wkr_;轮 43 P2:单值,注释与 §11.1 正文同步)
                 executorGeneration,
                 correlationKey},      # §11.2
   dispatchRef: {taskId, dispatchId, leaseId, leaseEpoch, attempt}}
```

- **构造时点(轮 42 A1)**:**T7 receiver start CAS commit 之后、发起 worker 协议调用之前**由 broker 进程内 adapter 构造——correlationKey 此刻已持久(§11.2,T7 同事务写),handle 全字段无 null/漂移窗。与 §5.2 T4 行「commit 后进程内构造物,非事务产物」相容:该行只排除事务内构造,不定精确时点;本条为其精确化(T4 后 adapter 持有的是 dispatch_intent outbox 领取权,handle 在 T7 才成形)。构造输入=T7 commit 后读回的 lease/dispatch 行+进程内明文 token(mint 时的内存副本,DB 只有 hash)。
- **holder auth(architecture §6.2「complete 时完整 tuple 任一不符一律 reconciling」的进程内接口;轮 42 A2 SSOT 显式)**:唯一消费入口=进程内 `completePushDispatch(handle, providerResult, completionRequestId)`——它调用与 wire `task.complete` **同一 core completion handler**(§7.3 authority 解析次序/§6.4 CAS/§5.3 tombstone 全套照走,「adapter 不因进程内而豁免校验」architecture §6.2 逐字);core 校验集在 wire 集之上增:**handle.holderTuple 与「lease 行 push 扩展列(holderInstanceId/holderGeneration)⋈ dispatch_attempts 行 push 扩展列(adapterInstanceId/adapterGeneration/executorInstanceId/executorGeneration/correlationKey)」的同事务 join(两表按 dispatchId 关联;fence 读取集=两行并集,单一 SSOT)全量相等**;任一不符 → 该 Task 进 reconciling(不得凭旧 ownerTuple 单独放行)。**executorInstanceId ≡ workerId(wkr_)**(轮 42 A2:统一 ID 空间——worker 进程实例标识;worker rs_ 是身份记录另有 runtimeSessionRecordId 列,不混用)。
- **幂等与 canonical 映射(轮 42 A3+轮 43 修)**:①`completionRequestId`(cmpl_)由 adapter 在**首次发起 worker 调用前**确定性铸造并随 correlationKey 同事务持久(dispatch_attempts 增列;同 dispatch 恒同值——crash 后重建 handle 仍复用);②completionOperationDigest 的 `stateRevision` 输入在 push 路径恒取 **dispatch_attempts.completionExpectedStateRevision——首次结单尝试前 write-once 持久(单 writer 事务:读当时 current stateRevision 写入本列,已有值则复用)**(轮 43 A3:锚定于结单时点而非 T4——必经 T7 的 revision 推进不再造成恒 stale;写入后至 CAS 间被并发事件推进 → completion CAS 失败进 reconciling,保守正确;crash 重放读本列,同 digest 取回原 receipt);③`providerResult → Result envelope` canonical 映射封闭(轮 43 A3+轮 44:succeeded 与 failed 两类全覆盖):**succeeded 类**(isError≠true)——content 数组**全部为 text block** → 各 block.text 按序以 `\n` 连接,`mediaType="text/plain"`;**含任何非 text block 或存在 structuredContent** → 整个 result(content+structuredContent)canonical JSON(JCS)序列化,`mediaType="application/json"`;**failed 类**(轮 44 A3+轮 45 消歧:恒 `application/json`,统一封套)——isError=true 的 result → `{evidenceKind:"is_error_result", body}`(body=其 content 按 succeeded 两分支规则编成的 text 字符串或 JSON 对象,**封套本身恒 JSON,无 text/plain 双解**);JSON-RPC error → `{evidenceKind:"jsonrpc_error", code, message, data(缺席=null,§1.4——轮 47 P2)}`;确定 schema violation → `{evidenceKind:"schema_violation", violationCode: "missing_field"|"type_mismatch"|"unknown_shape", pointer: JSON-Pointer|null, rawResponseDigest(原始字节 sha256 文本形)}`(轮 45-47 总函数化:**枚举响应的全部 {violationCode, pointer} 违例对**(missing_field 的 pointer=父容器 pointer + "/" + 按字典序首个缺失的 schema 期望键;其余=违例节点本身),**按 (codeRank(missing_field<type_mismatch<unknown_shape), pointer 的 RFC 6901 UTF-8 字节序) 全序排序取首对**——code 与 pointer 恒取自同一违例对,同响应恒同 envelope)——三支 canonical JSON,同证据恒同 envelope;`inlineContent ≤ 64KiB 否则落 artifact`,`size=UTF-8 字节数`,`evidenceRefs=[]`——跨 adapter 实现无分叉(architecture §6.4:succeeded/failed 均携 result)。
- **crash 语义(§3.2-B 已锁)**:broker crash → handle 消失,明文不重发、不由 hash 还原;恢复只走 Reconciler 对账(T8/T17 路径);无法对账 → T20 terminal unknown。**handle 不入 §4.6 启动恢复事务的任何补发面**。
- **证据→outcome 映射**:architecture §6.4-3 为 SSOT(合法 MCP result ∧ isError≠true → 提议 succeeded;isError=true/JSON-RPC error/确定 schema violation → 提议 failed;确认 interrupt/cancel → broker 派生 cancelled;EOF/崩溃/超时/generation 不符/无法唯一关联 → reconciling 不得猜)——本章不复述;providerOutcome(§10.4)在同一终局事务由同证据集判定。

### 11.2 correlationKey:生成/存储/唯一性 [NORMATIVE]

- **生成**:= `AB-CANON-1("AgentBridge/PushCorrelation/v1", {dispatchId, attempt, adapterInstanceId, transport: "codex_mcp_server_v1", rpcRequestId})` 文本形——broker 在**发起 worker 协议调用之前**(T7 receiver start CAS 同事务)生成并持久(architecture §6.2「send 前持久化」逐字;`rpcRequestId` 是 correlationKey 的 transport 构件、不单独作键——architecture §6.4 注)。
- **存储**:dispatch_attempts 行 push 扩展列(§6.1 已锁「correlationKey 部分唯一 per adapterInstanceId」);domain 入 §16.3(本章增补)。**T7 写入形态=对既有 dispatch 行的 CAS UPDATE(轮 42 P2-3:行由 T4 创建,非 INSERT);「冲突」=部分唯一索引违例使 T7 事务失败**(该 intent 丢弃不执行,§5.2 T7)。
- **响应关联(轮 42 A4+轮 43 修:消除终局复用 ABA)**:查找键 = **(adapterInstanceId, rpcRequestId) 全局唯一(含终局行;§6.1 protocolCorrelation 列族增唯一约束)——同一 adapterInstanceId 生命周期内 rpcRequestId 永不复用**(adapter 内存单调计数;adapter 重启=新 adapterInstanceId,天然新空间);响应到达按此二元唯一定位 dispatch/attempt——定位到**已终局行 → 按 §5.3 late_result 路由处理,不触其它行**(旧响应不可能命中新 dispatch,ABA 面=零);correlationKey 为**完整性锚**(定位后重算比对,不符=进 reconciling)。**无法唯一关联 → reconciling(不得猜)**(architecture §6.4-3 逐字)。

### 11.3 deny-only 审批记录面(Phase 1B 交付边界;architecture §16) [NORMATIVE]

- **交付边界(architecture §16 Phase 1B 逐字)**:两腿文本语义 + durable approval 记录结构 + approve.sh 迁移期 principal 改造 + **deny-only PEP stub**——「仅记录卫生,不解锁任何 effect」;Approval Agent/EffectPermit/EffectMediator 全部不在 1B(G-5 后原子启用,§12)。
- **deny-only PEP stub:wire 协议(轮 42 A5 机器化)**:方法 `pep.check`——**认证本地控制通道方法(§8.1 architecture 的 hook 通道;非模型工具面,不入 §7.1 方法→authority 矩阵/§7.9 投影,授权=已注册 Claude surface 会话的 auth+hook 通道身份)**。形状:`pep.check {auth, hostEventId, toolUseId, rawToolName, rawToolInput} → {decision: "deny"|"not_protected", recordRef: string|null(deny 时=appr_), protectedManifestDigest}`。**事务纪律**:**命中与未命中均落 approval_records 行**(轮 44 A5:消除「无记录」矛盾——deny=完整行;not_protected=轻量行 decision=recorded_not_protected),同一 writer 事务先落行、commit 后才响应(commit-before-response——crash 于响应前=记录已在,重送幂等取回)。**重放(轮 43 A5+轮 45 P0 修:按决策类分派,not_protected 加 policy fence)**:幂等锚=**(authenticatedPrincipalId, originRuntimeSessionRecordId, sourceChannel, sourceEventId) 四列物理复合 UNIQUE**(轮 48:与实体列一致——pep 行 sourceEventId=hostEventId;非编码单列,跨实现无拼接分歧);`not_protected` 同样落轻量记录行(decision=recorded_not_protected)。重放分派(轮 46 P0 终解:分类上下文含 protectedStateRevision/guardBuildDigest/file identity,任何字段比较都覆盖不全——not_protected 干脆不当重放锚):**recorded_deny → 原样重放**(deny 保守恒安全);**recorded_not_protected → 恒按当前状态重新分类**(当前 manifest/protectedStateRevision/guard build/fd-walk file identity 全量重跑 classifier):仍未保护 → 返回 not_protected(原行为审计锚不新建);**已变保护 → 按当前分类走正常 deny 流程(rule 1/2 分派+T13 腿),原 not_protected 行保留并 write-once 写入 escalation 列组 `{escalatedAt, escalatedDecision="deny", escalatedNextAction, escalationAuditSeq, escalatedProtectedManifestDigest(轮 48:首次 escalation 判定所依 manifest 快照——replay 返回本值)}`(轮 47 A5:durable replay outcome——同事务 append audit_log 行(kind=stale_not_protected_escalation)并回填 seq;commit-before-response 覆盖之)**;**escalation 后重送 → 直接 replay escalation 列组的 deny 结果(不重跑分类/不重触 T13——Task 已 terminal 不复活;不新建行不撞唯一键;审计不重复)**——重新分类恒幂等,陈旧「未保护」零放行面(architecture §10.1 policy_control 恒拒+§6.2 分类上下文逐字)。同复合键异 {toolUseId, rawToolName, inputDigest} → deny + 记 conflict 审计(不覆盖原行)。**记录域分离(轮 46 A5)**:approval_records 增 `sourceChannel: "pep"|"approve_sh"` 列并入唯一键——`recorded_note` 行来自 approve.sh 通道(第三键列=其自身 noteEventId),与 pep.check 域不交,pep.check 的重放分派不涉 note 行(note 无 wire 重放语义,仅审计)。transport 失败/超时=宿主 hook 按 fail-closed 处理(architecture §8.1)。**Phase 1B 的 Task 语义(轮 43 A5+轮 44:rule 1/2 first-match 分类先行)**:pep.check 命中受保护路径且能**唯一关联 active bridge Task**(经认证 session 的当前 active dispatch)→ 同一事务:approval_records 行 + **按 architecture §6.1 first-match 分类:policy_control 命中=rule 1(T13 denied, nextAction=`open_admin_settings`——恒拒不可洗白);其余受保护=rule 2(T13 denied, nextAction=`create_user_origin_task`)**+ interrupt/drain outbox(executor 收割),响应 deny;**无关联 bridge Task**(用户本人 host turn 的工具调用)→ 仅记录+deny(hook 层拒绝,无 Task 可转)。**§7.1 carve-out 显式**:`pep.check` 为认证 hook 通道方法,不入 §7.1 方法→authority 矩阵与 §7.9 投影(本节即其授权定义;§7.1 通则句同步加注——§10.14 记录)。
- **approval_records 写入接线**(§6.1 表列本章增补,§10.14 同步记录):每次 deny/note/not_protected 一行(轮 45 P2)——`{approvalRecordId(appr_), taskId?(有关联 Task 时), authenticatedPrincipalId(经认证通道的 principal,非自报), decision: **recorded_deny|recorded_note|recorded_not_protected(轮 44 A6:三值枚举与正文一致)**, operationDigest?(=AB-CANON-1("AgentBridge/ApprovalRecordDigest/v1", {rawToolName, toolUseId, hostEventId, rawInputDigest(原始字节 sha256 文本形)})——封闭 hash-input(轮 42 A6);审计近似,不承载授权), **protectedManifestDigest(判定所依快照,轮 42 A6)**, policyEpoch, **sourceChannel: "pep"|"approve_sh" + sourceEventId(NOT NULL;pep 行=hostEventId,approve_sh 行=noteEventId——单物理列,轮 47 A6)+ UNIQUE(authenticatedPrincipalId, originRuntimeSessionRecordId, sourceChannel, sourceEventId)+ tagged CHECK(sourceChannel=pep ⇔ decision ∈ {recorded_deny, recorded_not_protected};=approve_sh ⇔ decision=recorded_note)**, **hmacKeyId/hmacVerified(仅 recorded_note)**, evidenceRef?, decidedAt, **escalation 列组(write-once,轮 47-48:escalatedAt/escalatedDecision/escalatedNextAction/escalationAuditSeq/escalatedProtectedManifestDigest;CHECK:仅 recorded_not_protected 行可非空 ∧ all-or-none(五列同空或同非空)∧ escalatedDecision='deny')**}`。**tagged CHECK(轮 43 A6+轮 44 补)**:`recorded_deny|recorded_not_protected ⇒ protectedManifestDigest NOT NULL ∧ hmac 两列 NULL ∧ **operationDigest NOT NULL(轮 44:not_protected 亦须比较锚——conflict 判据可执行)**`;`recorded_note ⇒ hmacKeyId NOT NULL ∧ hmacVerified NOT NULL`。**rawInputDigest 取字节口径**:= 认证通道收到的 `rawToolInput` 的 **wire lexical bytes**(原样接收字节,不做 JCS/规范化——审计保真优先)。
- **approve.sh 迁移期 principal 改造(Phase 1 门禁 #10)**:迁移期 approve.sh 的每次调用必须产生一行 recorded_note(绑 principal+HMAC 校验记录),**其输出不进入任何 v3 放行判定**;agent 可调用的签发入口按 architecture §10.1 删除时间表处理。本条是记录格式义务,不是审批语义——审批语义恒 G-5 后 §12。
- **G-5 后取代**:G-5 过后本面由 §12 表族取代(§6.1 表行已注);approval_records 保留为历史审计,不迁移不删除。

### 11.4 legacy 完成映射的 wire 外形(Phase 1B;architecture §16) [NORMATIVE]

- 外部 shim 保持旧 shape(`outcome:"turn_completed"`)——**不反解为内部 succeeded**;内部一律 T23(terminal unknown, `legacy_evidence_only_completion`, verification=not_applicable)。evidence 记 `{legacyCompletionSignal, hostTurnId, capturedMessagesDigest, drainComplete}`(task_events kind=legacy_completion,§6.1 已锁)。
- 仅可更新匹配当前非终态 dispatch 的任务(T23 guard 已锁);已终态 → late_result。`deliveryOwner` CAS(task_route_ownership)上线于本阶段。
- legacy chat-plane(`ask_codex`/`reply`/`get_messages`)不经 Task 协议的部分照 §1.5,不在本节。

---

## 12. 人闸 / effect wire(§0-A.9 人闸·效果部分)

> **标签口径(轮 42 D1:遵守 §1.2「标签作用于条目不作用于整章」)**:本章各小节逐条目标注——表 schema 与实体定义=[NORMATIVE](migration 先行可建表);**放行链路(challenge 铸造/attestation 验签/permit 铸造·消费/mediator 执行)=[G5-GATED]**(构建 hard-disabled,architecture §15 G-5 单开关原子启用,禁止部分启用);**deny 侧(rule 1/2 判定、policy_control 恒拒、§12.9 清单)=[NORMATIVE 且 Phase 1B 即生效**(经 §11.3 deny-only stub;G-5 前后行为同为拒,gate 只解锁 allow 腿)**]**。各小节标注以此为准。

### 12.1 章级门禁与交付边界 [NORMATIVE]

- **G-5 组件集 SSOT = architecture §15 G-5**(Approval Agent+EffectPermit+EffectMediator+allow-capable PEP/classifier/authorizer+对应 adapter+执行前 fence/deadline 赢家+policy_control TCB inventory 完整性验收;同一 hard-disable 开关闭包)。本章为其 wire/存储规格;**G-5 未过时**:全部 holder 方法 `capability_disabled`(§4.8/§7.6 已锁)、PEP=deny-only stub(§11.3)、本章表可建(migration)但放行路径代码不得先于 G-5 接入。
- 决策表(rule 0-7)语义 SSOT=architecture §6.1;两腿+恒拒语义 SSOT=architecture §10.1。本章只编码,不重定义。

### 12.2 EffectContext(存储接线;architecture §6.2 字段已锁) [NORMATIVE]

- 表 `effect_contexts`:PK=effectContextId(`efc_`);列=architecture §6.2 EffectContext 逐字(taskId/dispatchId/attempt/originKind/originLineageDigest/目标四层身份+generation/hostTurnId|null/parentEffectContextId|null/subagentInvocationId|null/workspaceFingerprint/worktreeId/protectedStateRevision/policyEpoch/protectedManifestDigest/guardBuildDigest)+**effectiveOrigin(物化列,轮 42 B1)**。**建立时点**=claim/dispatch 事务(T3/T4 同事务;根 context),**subagent child=认证 PEP 通道的 subagent spawn 事件(broker 侧建行;轮 49 如实声明:该事件的 wire shape/幂等 eventId/expected-parent 绑定协议 v1 [UNSUPPORTED]——定义前 subagent 行不产生,子 agent 工具调用无 context 关联时按既有「未知 child lineage → 受保护写 fail-closed」兜底,零放行面;开放=本文修订)**,**或 §12.6 分类④ revalidation 事务(contextKind=revalidation child,轮 46 B3)**;`hostTurnId` 于 runtime_bound 事件后补写(仅此列可后写)。**UNIQUE(dispatchId, attempt)**(轮 42 P2-1:恢复重建不双行;subagent 子 context 经 parentEffectContextId 树挂同一 attempt 的根 context 下,PK 各异——UNIQUE 仅约束根 context:部分唯一 WHERE parentEffectContextId IS NULL)。
- **污点单调(轮 42 B1 总函数化)**:`effectiveOrigin` 于 **insert 时物化**(单 writer 事务从 parent 行读取派生:`parent.effectiveOrigin=agent_rpc ∨ 自身 originKind=agent_rpc ⇒ agent_rpc`;写入端不可指定——broker 派生列,伪造面=零)。**封闭构造规则(轮 43 B1 收紧)**:根 context(parentEffectContextId IS NULL)只能由 claim/dispatch 事务建立且 originKind=authctx 派生值;child context 必须 parent 非 null、**parent.{taskId, dispatchId, attempt} 与 child 全等(同 attempt 树——跨 attempt 指旧 clean root 即拒)**、深度 ≤ 16(超=拒);**`originLineageDigest` 恒继承 parent 行值(child 不可自供;根=authctx 派生)**;**`subagentInvocationId` 非空 ⇒ parentEffectContextId 非空 ∧ effectiveOrigin 恒=agent_rpc(轮 44 B1:subagent 无 user 血统,洗白面直接消灭)∧ **UNIQUE(taskId, dispatchId, attempt, subagentInvocationId) WHERE contextKind='subagent'(轮 49:部分唯一——真实 spawn 事件幂等唯一;revalidation child 继承非空 invocationId 不撞 parent 行)**;**非根 context 的 originKind 恒=parent.originKind 派生(轮 45 B1)**;**contextKind 列(轮 46 B1;轮 48 修:kind 由构造入口决定而非由 invocationId 反推——revalidation 可 exact-copy parent 的非空 invocationId,无 CHECK 自冲突)= "root"|"subagent"|"revalidation";构造入口封闭:root=claim/dispatch 事务;subagent=认证 PEP 通道的 spawn 事件;revalidation=§12.6 分类④事务。row-local CHECK=root ⇒ parent NULL ∧ invocationId NULL;subagent ⇒ parent NOT NULL ∧ invocationId NOT NULL;revalidation ⇒ parent NOT NULL(invocationId 继承 parent,可空可非空);**revalidation 与 supersededByIntentId 的跨表关联=分类④同事务 FK 引用+insert trigger 验证(轮 47)**——不满足任何 kind 构造规则的 insert 恒拒(=「未知 child lineage → fail-closed」的机器化,architecture §6.2)**;parent 引用在 insert 事务内验在性(**缺失/跨 task/跨 attempt/超深 → 该 insert 拒 → 受保护写 fail-closed**,architecture §6.2)——物化+插入时验证消除查询期遍历与 cycle 面(parent 先于 child 存在,无环可构造)。**下游一致性**:operationHash/challenge/presentation 中的 `originKind` 字段**取值恒为 effectiveOrigin**(污点派生后值;字段名保持 architecture 原名,取值语义在此精确化)。
- caller/payload 对本表零写入权(broker 着色;wire body 出现同名字段 → forbidden_field)。

### 12.3 EffectIntent 与 operationHash 字节级 canonical(解 §16.3 reserved)

> 逐条目标签(轮 43 D1):schema 块/hash-input 定义/幂等·重放规则 = **[NORMATIVE]**(migration 与 conformance 先行);「重算义务」条与状态机中 pending_approval→approved→executing_ref 的**放行向转移** = **[G5-GATED]**(denied/cancelled/superseded 向恒生效)。

```text
effect_intents efi_<ulid> {
  effectIntentId, effectContextId(→efc_), taskId, dispatchId, attempt, toolUseId,
  operationKind: "fs_create"|"fs_replace"|"fs_edit"|"fs_delete"|"fs_rename",   # v1 封闭;
                                       #   opaque shell/未知 MCP effect 走 unmediable_effect(§12.7)
  toolName: string, toolSchemaVersion: string,
  canonicalArgs: JSON,                 # 工具 canonical args 本体(hash 输入内联对象,轮 42 B2);
  canonicalArgsDigest: "sha256:…",     # = AB-CANON-1("AgentBridge/EffectArgs/v1", canonicalArgs)
                                       #   ——存储/审计便利与 §12.3 幂等锚,不入 operationHash
  targets: [TargetRef](≤16),           # broker fd-walk 归一化(§12.7);≥1
  operationHash: "sha256:…",           # 见下
  state: "planned"|"pending_approval"|"approved"|"denied"|"cancelled"|"superseded"|"executing_ref"
       | "settled",                    # 轮 43 C4:executing_ref 的唯一终局出口(settleEffectAttempt 写;
                                       #   live 唯一约束排除 settled)
  createdAt, decidedAt: int|null
}
# 幂等与重放(轮 42 B3+轮 43 修:判同=完整语义 digest;终态有 replay 锚):
#   effectSemanticDigest = AB-CANON-1("AgentBridge/EffectSemantic/v1",
#     {**effectContextId, effectiveOrigin(轮 44 B3:authority 维入判同——跨 context 同 toolUseId
#     不误 join)**, operationKind, toolName, toolSchemaVersion, canonicalArgs, targets})
#   (列持久;domain 入 §16.3)。
#   部分唯一 (**effectContextId**, taskId, dispatchId, attempt, toolUseId) WHERE state ∈ live
#   (planned/pending_approval/approved/executing_ref;轮 44:context 入键);同 toolUseId 重送:
#   - live 行在:同 effectSemanticDigest → 返回该行当前状态(幂等);异 → 4063+审计,原行不动;
#   - 行已终态(denied/cancelled/settled;终态行保留=replay tombstone):同 digest → replay 该终态
#     响应(settled→原 EffectReceipt(§12.7);denied/cancelled→原 typed 结果);异 digest →
#     视为新操作(targets/args 已变)= 新 toolUseId 义务——同 toolUseId 异 digest 恒 4063,
#     合法演进须换 toolUseId(宿主每次工具调用本就新 toolUseId,冲突=异常信号);
#   - superseded → 引导至 successor(supersededByIntentId 列;轮 44 B3+轮 45 补全:分类④事务原子执行
#     {old CAS →superseded + old.supersededByIntentId=新 id + successor insert(planned)
#     + **revalidation child EffectContext 建立(contextKind=revalidation;同 attempt、parent=原
#       context,快照当前 protectedStateRevision/policyEpoch/protectedManifestDigest/
#       guardBuildDigest(轮 46:operationHash 全部快照维);**其余全部 authority 字段(执行四层
#       身份/hostTurnId/originKind·originLineageDigest/workspaceFingerprint/worktreeId/
#       subagentInvocationId)逐列 exact-copy parent(轮 47 B3:唯一赋值规则,successor hash
#       无实现分叉)**——successor 不复用旧快照,无环)**
#     + **旧授权按当前状态分派收口(轮 46 B3):unused permit → revoked;pending 态 challenge/
#       workItem → cancelled;decided 行保持 replay tombstone 不改(封闭状态机无 decided→cancelled
#       边)——「旧 permit 不产生新 effect」先于分类**}——
#     单事务无「tombstone 无引导」窗,successor 唯一(write-once 列))
TargetRef {                            # hash-input 子构造(§1.4 全字段,缺席=null)
  lexicalPath, canonicalPath, rootId, parentFileId, targetFileId: string|null,
  preimageDigest: string|null,
  expectedPostimageDigest: string|null,   # create/replace/edit 必填;delete 等无 postimage 可 null
  linkCount: int|null,
  role: "source"|"destination"|"overwritten_victim"
}
operationHash = AB-CANON-1("AgentBridge/Effect/v1", EffectOperationHashInput{
  taskId, dispatchId, attempt, effectContextId, originKind, originLineageDigest,
  executorInstallationId, executorEndpointId, executorRuntimeSessionRecordId, executorGeneration,
  hostTurnId,                          # 缺席=null
  toolUseId, operationKind, toolName, toolSchemaVersion,
  canonicalArgs,                       # 内联 canonical 对象(轮 42 B2:architecture §6.2 输入=
                                       #   canonicalArgs 本体,非预 digest——上位字节忠实)
  targets,                             # TargetRef 数组,保序
  workspaceFingerprint,                # 内联 §4.3 三字段构造(同上:非预 digest)
  worktreeId, protectedStateRevision,
  policyEpoch, protectedManifestDigest, guardBuildDigest
})                                     # =architecture §6.2 输入清单的封闭 hash-input 化;
                                       #   originKind 取值=effectiveOrigin(§12.2);
                                       #   §16.3 reserved 行由本节解除(GV 随 conformance fixtures);
                                       #   PEP 重算,agent 只引用 opaque effectIntentId;
                                       #   拒 duplicate key/非有限数/未知字段(§1.4)
```

- **重算义务**:PEP 每次判定/每次 permit 消费前重算 operationHash(§12.6 fence);存储值仅为锚,**比较恒用重算值**。
- 状态机封闭:`planned→pending_approval`(challenge 铸造,§12.4)/`planned|pending_approval→denied`(rule 1/2/6/7)/`pending_approval→approved`(allow 决策)/`approved→executing_ref`(permit 消费,§12.6)/**`executing_ref→settled`(settleEffectAttempt,§12.7——轮 44 C4 补边)**/任意非终→`cancelled|superseded`(Task 收口/revision 漂移——漂移=新 intent 重走决策表,禁直接 reapprove,architecture §10.1)。

### 12.4 ApprovalChallenge 与 ApprovalPresentationLease

> 逐条目标签(轮 43 D1):表 schema/approval_work_items 定义/approvalRevision 规则 = **[NORMATIVE]**;铸造原子事务·presentation 生成·claim/decide 链路 = **[G5-GATED]**(G-5 前这些事务不可达——challenge 不产生)。

- 表 `approval_challenges`:PK=approvalId(`apch_`);列=architecture §10.1 ApprovalChallenge 逐字({approvalId, approvalRevision, taskId, dispatchId, attempt, effectIntentId, operationHash, presentationDigest, originKind, originLineageDigest, targetInstallationId, targetEndpointId, targetRuntimeSessionId, runtimeGeneration, presentingEndpointId|null, presentingGeneration|null, requiredAttestationScheme, schemeId, keyId, protectedStateRevision, policyEpoch, protectedManifestDigest, nonce, expiresAt, status})。
- **铸造原子事务**(architecture §10.1 逐字+轮 42 B4/B5/B6 补全,单 writer 事务七腿):insert challenge + **EffectIntent CAS planned→pending_approval(双记腿)** + Task CAS→waiting_input(approval)(T9a approval 腿)+ **insert approval_work_items 行(kind=effect_approval, sourceRef=approvalId——§7.6 领取面的存储 owner,见下)** + **presentation artifact 落库+role=presentation reference 行(§7.5 接线;canonicalContentRef 即此 artifact)** + presentation outbox + `approval_prompt` settle(§10.5,双层小时窗,超限→rule 2)。
- **approval_work_items(轮 42 B5+轮 43 列级补全:§7.6 三类工单的统一存储 owner)**:`{workItemRef(appr_) PK, kind: effect_approval|budget_override|manual_verification, sourceRef(effect→apch_;budget→root+dimension 工单锚;verification→taskId+verificationRevision), status: pending|claimed|decided|expired|cancelled(§7.6 状态机即本表), **expiresAt, presentationDigest, canonicalContentRef(→artifact;§7.6 claim 响应字段的持久源), claimedByEndpointId|null, claimedByGeneration|null, actionTokenHash|null(当前 active token;rotation 按 §7.6 幂等重发条), decisionDigest|null, **receiptBody|null(轮 45 改名:inline JSON 非 ref——§7.6 decided 行的 ApprovalActionReceipt 持久本体 {workItemRef, decisionDigest, outcome, decidedAt})**, createdAt, decidedAt|null}`;**UNIQUE(kind, sourceRef) 改部分唯一(status ∈ {pending, claimed}——轮 43:deny 后重铸新工单合法,§7.6 已锁)**。§7.6 wire 的 `workItemRef:"appr_…"` 指本表行;challenge 的自身 status 收窄为 `{pending, decided, expired, cancelled}`(**删 presented——claim 状态由 workItem.claimed 承载**);budget/verification 工单行的**铸造事务归属(轮 44 B5 封闭)**:budget_override 工单=T9b 转移**同一事务 get-or-create**(轮 45 B5:同 {root, dimension} 已有 active 工单 → join 不新建;**消费者持久载体(轮 46)=tasks 增列 `waitingBudgetWorkItemRef`(T9b 写入/离态清;§6.1 additive #20)**——grant 事务(§7.6/T11a)按该列索引唤醒该工单**全部**等待任务,全消费者终局判定同此);**presentationBody 列(轮 46 B5+轮 47 digest 绑定)**:workItem 行增 per-kind 封闭 JSON——budget={rootAdmissionId, dimension, currentCap, currentUsage, proposedNewCap, budgetRevision, budgetSnapshotRef, policyEpoch};manual={taskId, verificationRevision, effectiveAcceptanceSpecRef, resultDigest, resultRef}(§7.6 claim 响应字段的持久源;effect 类经 canonicalContentRef 不用本列)。**presentationDigest 统一定义(轮 47)= AB-CANON-1("AgentBridge/ApprovalPresentation/v1", ApprovalWorkPresentation{kind, body})——tagged union(effect 支 body=§12.4 canonical 构造值;budget/manual 支 body=presentationBody)**;insert 时计算、claim_approval 响应前**重算比对**(不符=缺陷审计+4050,防 body/digest 错配交付);manual_verification 工单=enterTerminal 判定 verification=pending(§5.5)的**同一事务** insert——状态与工单原子共存,无 phantom/无 holder 悬挂窗**工单撤销规则按 kind 拆分(轮 45 B5:§7.6「任务终态撤销 pending/claimed workItem」的精确化)**:effect_approval=随其 Task 终态撤销;manual_verification=Task terminal 后**保留**(它本就是终态后的 verification 结算面,§5.5);budget_override=root 级共享,仅该 {root, dimension} 全部等待任务终态才 cancelled。(G-5 前这些事务的工单腿不执行,§7.6 已锁「不产生」;**其 claim/token 语义同经本表+§7.6,无独立 PresentationLease——lease 仅 effect 类需要,budget/verification 的 presentation 内联工单行,如实声明**)。**appr_ 前缀共享声明(§1.3 注,轮 43)**:approval_records 与本表共用 appr_ 前缀、共享同一 broker 单 allocator 的 ULID 空间(单 writer 全局唯一,无 DB 级跨表约束需求——ULID 冲突概率工程零;审计侧按表区分)。
- 一次性消费=条件 UPDATE(同 decisionDigest 重放返旧 receipt/异决策 already_decided——§7.6 已锁)。**approvalRevision 推进规则(轮 42 P2-2)**:holder 撤销/滚代重铸 token、nonce 重发、scheme/key 变更 → `approvalRevision+1`+新 nonce;HGA 签名绑 approvalRevision(§12.5 claim),旧 revision 的 attestation 对新 presentation 恒拒。
- **ApprovalPresentationLease** `apl_<ulid>`:{leaseId, approvalId, holderEndpointId, holderGeneration, claimedAt, expiresAt, **state: active|released|revoked, releasedAt|null, revokedAt|null(轮 44 P2;exact-shape CHECK(轮 45):released ⇔ releasedAt NOT NULL;revoked ⇔ revokedAt NOT NULL;active ⇒ 两列 NULL)**}——claim_approval 铸 actionToken 时同建(每 approvalId 至多一 active;holder 撤销/滚代 → lease revoke+workItem 回 pending 重铸 token,§7.6 幂等重发条);retireEndpointGeneration 级联已含(§4.8)。
- **presentation 内容 schema(轮 42 B6 全量化)**(§7.6 effect_approval 支的 canonicalContentRef 所指):`{operationKind, toolName, toolSchemaVersion, canonicalArgs(全量本体), targets: [TargetRef 全字段投影(lexicalPath/canonicalPath/rootId/parentFileId/targetFileId/linkCount/preimageDigest/expectedPostimageDigest/role)], diffRef: string|null(fs_edit/fs_replace 时=unified diff artifact 引用——用户看得到实际写入内容), originKind(=effectiveOrigin), originLineageDigest, workspaceFingerprint(§4.3 全三字段), operationHash}` 的 canonical JSON artifact(铸造事务内落库+role=presentation reference,上条);该构造值=ApprovalWorkPresentation union 的 **effect 支 body**(轮 48 B5:最终 digest 唯一取 §12.4 统一公式 `AB-CANON-1("AgentBridge/ApprovalPresentation/v1", {kind:"effect_approval", body})`——不存在 raw-body 第二公式,challenge/HGA/workItem 三处同一 digest)——**呈现即所批**:UI 必须渲染 canonical 内容本体(含 diff),digest 防呈现替换(architecture §10.1「系统 UI 呈现 canonical 内容+digest」)。**引用持久与恢复(轮 43 B6)**:`canonicalContentRef` 持久于 workItem 行(§12.4 表列)与 challenge 关联;presentation/diff 的 artifact_references 行增 **presentationScopeRef 列(role=presentation 时=workItemRef——§7.5 表 additive,§10.14 记录)**,同 Task 多 presentation 崩溃后按 workItemRef 唯一恢复;diffRef 同 scope 挂载(holder 经 §7.5 get 携 workItemRef 取)。
- deny/expiry/cancel 与 allow **事务对称**(architecture §10.1 逐字:原子写 {EffectIntent outcome, Task 转态, token tombstone, resume 或 terminal/denial outbox});deadline 已到 → terminal expired 不回 running(rule 7/D2)。

### 12.5 HumanGestureAttestation(签名域;scheme 分层)

> 逐条目标签(轮 43 D1):schema/HumanGestureClaim hash-input = **[NORMATIVE]**;验签与消费链路 = **[G5-GATED]**。

```text
human_gesture_attestations hga_<ulid> {
  attestationId, approvalId, approvalRevision, schemeId, keyId(→enrollment_registry),
  decision: "allow"|"deny",
  signature: base64url,                # 签名消息 = AB-CANON-1raw("AgentBridge/HumanGesture/v1",
  signedAt                             #   HumanGestureClaim)
}
HumanGestureClaim {                    # hash-input(§1.4);=architecture §10.1 签名域逐字段
  approvalId, approvalRevision, operationHash, presentationDigest, principalId,
  targetInstallationId, targetEndpointId, targetRuntimeSessionId, runtimeGeneration,
  schemeId, nonce, expiresAt, decision
}
```

- 验签:公钥/算法取 enrollment_registry 行(keyKind=attestation_scheme,§4.8;`keyId→principalId` 绑定不接受自报);scheme 语义=architecture §10.1(user_presence_dialog_v1 软件档 same-UID 归 out-of-scope 逐字声明/secure_enclave_p256_biometry_v1 硬件档);broker 按 policy 选 requiredAttestationScheme,endpoint 能力不含 → fail-closed 禁静默降档。
- **attestation 永不回写 task origin**(architecture §10.1;origin 与 effect attestation 分离)。
- 禁:Web/Console 按钮、自动确认、accessibility 自动化(architecture §10.1);`submit_approval` 的 wire 载体=§7.6(attestation 为其参数)。

### 12.6 EffectPermit 与执行前 fence(五分类总出口)

> 逐条目标签(轮 43 D1):表 schema = **[NORMATIVE]**;allow 决策事务·消费 CAS·五分类出口 = **[G5-GATED]**(G-5 前 permit 不存在,本节链路不可达)。

```text
effect_permits efp_<ulid> {
  permitId, approvalId, effectIntentId, operationHash, attempt, toolUseId,
  state: "unused"|"executing"|"settled"|"revoked"|"expired",   # sealed(§3.2-C):记录+CAS 消费,
  attestationRef(→hga_), mintedAt, expiresAt,                  #   不可委托/转移/衰减
  expectedStateRevision: int,          # 轮 42 C1:allow 事务(T22 CAS 完成后)的 post-decision
                                       #   stateRevision 冻结入列——consume 时比较当前值==本列
                                       #   (持久 carrier,重启后非恒等比较)
  consumedAt: int|null, settledAt: int|null
}
```

- **allow 决策事务(轮 42 B4+轮 43 补全,十腿封闭)**:HGA insert(§12.5)+ permit insert(unused;expectedStateRevision=本事务 T22 CAS 后新值)+ EffectIntent CAS pending_approval→approved + workItem decided(decisionDigest 写入)+ challenge decided + **holder actionToken tombstone(consumed,§7.6)** + **ApprovalPresentationLease released** + **decision receipt 持久(§7.6 ApprovalActionReceipt 的 decided 行锚)** + Task T22 回 running + **resume outbox(executor 通知)**——单 writer 事务(architecture §10.1「allow 与 deny/expiry 决策事务对称:原子写 {EffectIntent outcome, Task 转态, token tombstone, resume 或 terminal/denial outbox}」逐字;deny 腿对称同集,EffectIntent→denied、Task 按 rule 6/7)。
- **消费 CAS(unused→executing)与重验同一 writer 事务且线性化**(architecture §10.1 fence 集逐字):Task 非终态/非 cancelling、current {dispatchId, attempt, leaseEpoch}、**当前 stateRevision == permit.expectedStateRevision(持久列,轮 42 C1)**、target runtime generation、permit 未过期未撤销、**opHash 由 PEP 重算无漂移**、transactionNow<resolvedDeadlineAt。同事务:**EffectIntent CAS approved→executing_ref(轮 42 B4)**+insert EffectAttempt(intent_committed)+WorkspaceEffectLease(§12.7)。
- **失败总出口(轮 42 C2+轮 43 顺序修正:known-stale 先于 expired——旧 attempt permit 同时 stale+expired 时不得走 rule 6/7 改当前 Task)**:
  ①**same-request 重放**(同 permit 已 executing/settled 且请求锚(effectIntentId+toolUseId)相同)→ join/replay 原 effect receipt(**载体=effect_attempts.receiptBody(轮 47:digest 不可逆仅作判同锚),§12.7**);事实不明才 reconciling;
  ②**known-stale dispatch/attempt/lease**(fence 元组指向非当前 attempt)→ tombstone 旧 permit(revoked),**旧 attempt 不改当前 Task**(architecture §10.1 逐字;不论该 permit 是否同时 expired);
  ③**permit expired/revoked**(fence 元组当前)→ approval-expiry/revoke 出口(rule 6/7);
  ④**revision/opHash/protected-state 漂移**(fence 元组当前但比较不等)→ 新 intent 重走决策表(禁直接 reapprove);
  ⑤**其余未分类 mismatch** → fail-closed,effect 不发生。
  五支按序互斥;每支恒满足「旧 permit 不产生新 effect」。
- **deadline/cancel 赢家**:architecture §10.1 单一 CAS 已锁(§5.2 D1/D2/T22/T24 为其转移表投影),不复述。

### 12.7 EffectAttempt / WorkspaceEffectLease / EffectMediator 接口

> 逐条目标签(轮 43 D1):表 schema/EffectReceipt hash-input/「executing EffectAttempt」词汇接线 = **[NORMATIVE]**;mediator 执行·settleEffectAttempt 的放行侧输入 = **[G5-GATED]**(对账/收口语义恒生效——崩溃恢复不受 gate 限制)。

```text
effect_attempts efa_<ulid> {
  attemptId, permitId, effectIntentId, operationHash,
  state: "intent_committed"|"executing"|"applied"|"not_applied"|"unknown",
  preimageVerifiedAt: int|null, postimageVerifiedAt: int|null,
  receiptBody: JSON|null,              # 轮 44 C2:canonical EffectReceipt 本体持久(重放返回原文,
                                       #   digest 不可逆不能当载体)
  receiptDigest: "sha256:…"|null,      # 轮 42 C2+轮 43/44 shape 封闭:settle 时写=
                                       #   AB-CANON-1("AgentBridge/EffectReceipt/v1", receiptBody=
                                       #   EffectReceipt{permitId, attemptId, disposition: "applied"|
                                       #     "not_applied"|"unknown", targetOutcomes: [{**targetOrdinal:
                                       #     int(=冻结 targets 下标,轮 48:绑定键——role 由 ordinal 从
                                       #     冻结 target 派生,receipt 不携 role)**, canonicalPath,
                                       #     postimageDigest: string|null, targetDisposition:
                                       #     "applied"|"not_applied"|"unknown"}](按 targetOrdinal 升序;
                                       #     轮 44:三值),
                                       #     settledAt})——same-request 重放返回 receiptBody(跨实现稳定)。
#   **聚合不变量(轮 45 C2)**:disposition=applied ⇔ ∀target=applied;not_applied ⇔ ∀target=
#     not_applied;其余一切组合(含任一 unknown/部分应用)⇒ disposition=unknown——#19 的 T18 重排
#     只可能吃到「全量未写」证据,部分已写恒走 unknown 不重排;
#   **全集绑定(轮 46-48)**:targetOutcomes 与冻结 EffectIntent.targets **长度相等且逐 targetOrdinal
#     对应(outcome.targetOrdinal=i ↔ targets[i];canonicalPath 须与 targets[i].canonicalPath 相等;
#     role 由 ordinal 从冻结 target 派生不入 receipt——合法 rename 的 destination/overwritten_victim
#     同 path 异 ordinal,天然不误伤)**;ordinal 缺项/重复/越界/path 失配 = receipt 非法 →
#     disposition 恒按 unknown 处理+缺陷审计;
#   exact-shape CHECK(轮 45-47):state ∈ {applied, not_applied, unknown} ⇔ receiptBody/
#     receiptDigest/settledAt 三者 NOT NULL(非终态 ⇒ 三者 NULL);receiptBody 的 disposition 必须==effect_attempts.state,{permitId,
#     attemptId, settledAt} 必须==行同名列(row/body 全绑定,轮 47-48);receiptDigest 读取方
#     恒重算校验——**mismatch=fail-closed:不作 replay 载体、不作 #19 输入,缺陷审计+按 unknown 处理**
  evidence: JSON(inode/pre/postimage 对账材料), startedAt, settledAt: int|null
}
workspace_effect_leases wel_<ulid> {
  leaseId, workspaceFingerprintDigest, worktreeId, effectAttemptRef,
  acquiredAt, releasedAt: int|null     # 同 workspace 至多一 active(部分唯一)——effect 串行化
}
```

- **EffectMediator 接口契约**(architecture §10.1 D-3 逐字,不复述细则,锁定接口面):输入=`{permitRef, EffectIntent.targets, operationKind}`;执行=登记 root fd 逐层 openat/fstatat no-follow → preimage 验证 → temp-file(O_CREAT|O_EXCL|O_NOFOLLOW)→ write → fsync(temp) → fd-relative atomic replace → fsync(dir)(跨目录 rename 双 parent);输出=postimage 验证+EffectAttempt settle。symlink 命中 protected 即 protected 且 v1 拒;hardlink st_nlink>1 保守拒;rename 三方绑定。**sandbox 只规划、commit 只经 mediator**(architecture §10.1「一个 commit 后端」)。
- **SQLite×文件系统非原子**(architecture §10.1):effect 前先 durable intent(EffectAttempt CAS intent_committed→executing 落库)→ 执行 → 崩溃后按 inode/pre/postimage 对账 applied/not-applied/unknown;unknown 不自动重试(T24/T20 路径,§5 已锁)。**「executing EffectAttempt」词汇接线(轮 42 C3)**:§5 转移表与 architecture 散文所称「executing EffectAttempt」的存储谓词 = `effect_attempts.state ∈ {intent_committed, executing}`——permit 已消费即效果可能发生(consume 与 FS 执行之间的 crash 窗同样是效果风险),保守侧纳入 T24/D1/§10.1 赢家判定;纯词汇精确化,不改封版行为(风险集只增不减)。
- **settleEffectAttempt(attemptId, disposition) 单一原子 reducer(轮 42 C4+轮 43 修)**:mediator 输出(或崩溃对账结论)恒经本 reducer 单 writer 事务收口——`{EffectAttempt CAS →applied|not_applied|unknown + **receiptBody+receiptDigest+settledAt 三者同事务写入(轮 45 C2)** + EffectPermit executing→settled + WorkspaceEffectLease release + **EffectIntent CAS executing_ref→settled(轮 43:显式终态,枚举已增——live 唯一释放)** + Task 衔接按当前 phase×disposition 走 §5 既有边(轮 44 C4 修:**running ∧ applied|not_applied=零转移仅 evidence append(executor turn 续行);running ∧ unknown=T24(effect 事实不明先入对账,不得续跑当没事);cancelling=「无未决 effect」条件的满足件——T15 仍需独立 stop_confirmed 证据,settlement 不证 executor 已停;reconciling=T19/T20/T18 对账输入(T24 所入;T18 支见 #19 guard)**;deadline drain=D1 收口等待项)}`;
- **T24 出口增补(轮 44 C4 新证据,受审 additive——§10.14#19;轮 45 guard 补全)**:§12 三值 disposition 模型下,对账**确认 not_applied** → **允许经 T18 重新排队**(architecture §10.1「仅 unknown 不自动重试」逐字——not_applied 非 unknown;封版 T24「出口仅 T19/T20」系 §12 交付前的保守占位,本条为其 additive 放宽,§5.2 T24 行与 §5.4 表已同步注)。**完整 guard(封闭合取,轮 45)**:①当前 phase/reason 精确=reconciling(effect_uncertain);②exact dispatch/attempt/fence 匹配封存 risk record;③该 EffectAttempt receiptBody 聚合合法且 disposition=not_applied(§12.7 聚合不变量——全量未写);④**本 attempt 无任何其它 applied/unknown/未 settle 的 EffectAttempt**;⑤exact stop proof(§5 stop-confirmed 词表);⑥frozen retryClass ∈ {safe, idempotent};⑦`!cancelRequested` ∧ `terminationIntent IS NULL`;⑧Task revision/deadline CAS 成立。任一不满足 → 保持 T19/T20 路径。**分体提交禁止**(attempt 先 applied 再 crash 不遗留 executing permit/active lease;恢复重入=幂等,receiptDigest 为锚)。
- **unmediable_effect**:opaque shell/脚本/未知 MCP effect 工具——能在隔离 overlay 产出完整 target/postimage plan → 人审+mediator;否则 typed `unmediable_effect`(§16.2 增补)fail-closed。

### 12.8 决策表接线与 protectedStateRevision 推进

> 逐条目标签(轮 44 D1):deny 侧接线(rule 0-3/6/7 映射、rule 1 恒拒先行、protectedStateRevision 推进、break-glass 零暴露)= **[NORMATIVE]**(Phase 1B 即生效);**rule 4/5 的 allow 链(challenge 铸造、permit 铸造+两步消费)= [G5-GATED]**。

- **决策表 rule 0-7 → 转移表投影**(语义 SSOT=architecture §6.1;编码=§5.2 既有边;轮 42 C5 修):rule 0=deadline fence/D1/D2;**rule 1/2 分语境**——pre-dispatch 判定(accept 时,如 requestedApprovalPolicy 非法)=T21;**运行期 PreToolUse 命中 = T13(broker 派生终态 denied——T13 触发列「broker 派生终态(authorship=architecture §6.1)」即此口子,from=running 可达;denied+nextAction 语义逐字:rule 1→open_admin_settings(仅 navigation 零 payload)/rule 2→create_user_origin_task)**——不扩 T21、不加新边;**运行期 rule 1/2 的同事务写集封闭(轮 43 C5)**:`{EffectIntent planned→denied + T13 enterTerminal(denied+nextAction)+ interrupt/drain outbox(executor 收割——worker BUSY 收割 §9.2/§10.8 承接)+ terminal outbox}`;rule 3=T16/T17/T24;rule 4=T9a(approval 腿,challenge 铸造 §12.4);**rule 5=T22 allow(allow 事务铸 permit,§12.4/§12.6)→ 执行点 PEP re-plan/re-hash 后才 consume(§12.6 两步纪律——铸造≠放行,消费前重算恒不可省)**;rule 6=T22 deny(EffectIntent denied,回 running);rule 7=T22/D2(terminal expired|denied)。**rule 1 的 policy_control 判定先于一切 challenge 铸造**(恒拒:不发 challenge、不铸 permit、不返回 create_user_origin_task)。
- **protectedStateRevision 推进(architecture §10.1 不变量的编码)**:单调整数,broker_state 级;**推进触发封闭枚举**:protected root 集合变更/protected_paths·manifest 内容变更(protectedManifestDigest 变)/policy-control 分类变化/成功的 protected commit 改变分类状态。推进=单 writer 事务 `revision+1`+审计;**执行前 revalidation 读当前值与 permit 快照比对——不等=漂移走 §12.6 分类④(轮 44 P2:引用修正)**(恒非恒等检查)。
- **break-glass**:architecture §10.1 已锁(marker 语义废除/admin action 带人闸+短 TTL+banner);wire 面零暴露,本文不再给任何 bypass 载体。

### 12.9 policy_control 精确路径清单(architecture §10.1「精确路径清单进 §0-A.9」) [NORMATIVE](轮 44 D1:清单扩条=policy 更新(审计);删条=architecture 修订——纯文字规则,非注册标签)

v1 清单(传递闭包锚点;实现以 canonical path prefix+文件 identity 双判;轮 42 C6 按 architecture §10.1 点名成员补全):
`$STATE_DIR/**`(broker DB/token/审计/policy/retry-manifest)/ Keychain `installationTokenSecret` 项 / enrollment 私钥存储+**attestation enrollment registry(enrollment_registry 表,§4.8——keyId→principal 绑定)** / **PEP·EffectMediator·classifier·authorizer 的 executable 与加载配置**(=broker 二进制内组件时为 broker bundle+其启动配置;独立进程时为各自 binary+config)/ `~/.claude/hooks/**`+`~/.claude/protected_paths.json`+`~/.claude/settings.json`(guard 脚本与 manifest;本机现实现路径)/ `~/claude-dotfiles/global/{hooks,protected_paths.json,settings.json,CLAUDE.md,AGENT_MODES.md}`(dual-write 镜像——manifest 的传递闭包含其恢复源)/ AgentBridge 插件 bundle 与 `.mcp.json` / Approval Agent executable+其 0600 配置(ProvisionBundle)/ launchd·service·discovery 配置 / `activation_grants`·`fallback_allowlists`·billing-binding 存储(§10.7/§10.9 表,经任务 RPC 恒拒)/ **retry/tool manifest 类**(`$STATE_DIR/policy/**` 全部 manifest,§8.1 已锁其一)/ break-glass 状态与审计配置(architecture §10.1 点名)。
**判定注**:清单是 classification 输入的锚,不是全集——「能改变 classification/canonicalization/permit validation 的输入」恒属闭包(architecture §10.1);新增条目=policy 更新(审计),删除条目=architecture 修订。

### 12.10 表清单与错误码增量 [NORMATIVE]

| 表 | 主键 | 唯一/关键列 |
|---|---|---|
| `effect_contexts` | effectContextId(efc_) | **(dispatchId, attempt) 部分唯一(根 context,轮 42 P2-1)**;**(taskId, dispatchId, attempt, subagentInvocationId) 部分唯一(contextKind='subagent',轮 50)**;effectiveOrigin(物化派生列);**contextKind 三值+分层约束(轮 47)**;hostTurnId 唯一可后写列 |
| `effect_intents` | effectIntentId(efi_) | operationHash 索引;**(effectContextId, taskId, dispatchId, attempt, toolUseId) 部分唯一(live,轮 42 B3+轮 44 context 入键)**;canonicalArgs/canonicalArgsDigest/**effectSemanticDigest/supersededByIntentId(轮 44)**;state 封闭 CHECK(**含 settled 终态**) |
| `approval_work_items`(轮 42 B5) | workItemRef(appr_) | kind/sourceRef/status CHECK(§7.6 状态机 owner);**(kind, sourceRef) 部分唯一(status ∈ {pending, claimed})**;expiresAt/presentationDigest/**presentationBody(per-kind union,轮 47)**/canonicalContentRef/claim 三列/decisionDigest/receiptBody |
| `approval_challenges` | approvalId(apch_) | effectIntentId 索引;**(effectIntentId) 至多一 active**;status 四值 CHECK(presented 删,轮 42 B5);approvalRevision/nonce/expiresAt |
| `approval_presentation_leases` | leaseId(apl_) | **approvalId 至多一 active**;holderEndpointId/holderGeneration;**state/releasedAt/revokedAt+exact-shape CHECK(轮 45)** |
| `human_gesture_attestations` | attestationId(hga_) | approvalId 索引;approvalRevision;keyId;append-only |
| `effect_permits` | permitId(efp_) | **approvalId 唯一**(一批一 permit);operationHash;**expectedStateRevision(轮 42 C1)**;state CHECK(sealed 语义) |
| `effect_attempts` | attemptId(efa_) | permitId 唯一;state 五值 CHECK;**receiptDigest(轮 42 C2 重放锚)**;evidence JSON |
| `workspace_effect_leases` | leaseId(wel_) | **(workspaceFingerprintDigest) 部分唯一(active)** |

- **§16.2 增量**:4060 `unmediable_effect`(§12.7;fail-closed,+remediation=隔离 overlay 产 plan)/4061 `approval_surface_unavailable`(architecture §10.1:Approval Agent 有界 activation 超时;retryable=true 退避)/4062 `approval_timeout`(challenge expiry 的 caller 可见形;false)/4063 `effect_intent_conflict`(§12.3:同 toolUseId 异 effectSemanticDigest 重送;false)。审批面子码(claimed_elsewhere 等)已并入 4050(§7.6),不新增。
- **§6.1 增列记录(轮 42-44;§10.14 #16/#17 同步;r63 P2-13:dispatch_attempts 与 approval_records 均属 §6.1,原标题误含 §4.11)**:dispatch_attempts 增 `completionRequestId/completionExpectedStateRevision`(§11.1;轮 44 A4:列名与主文一致)+`(adapterInstanceId, rpcRequestId)` **全局唯一(含终局行)**(§11.2);approval_records 增 `protectedManifestDigest/hmacKeyId/hmacVerified`+decision 三值枚举+sourceChannel/sourceEventId 四列物理唯一键+escalation 五列组(§11.3;轮 48 同步)。
- **§16.3 增量**:`AgentBridge/Effect/v1`(reserved 解除,§12.3)/`AgentBridge/EffectArgs/v1`/`AgentBridge/EffectSemantic/v1`(§12.3)/`AgentBridge/ApprovalPresentation/v1`(§12.4)/`AgentBridge/HumanGesture/v1`(§12.5)/`AgentBridge/EffectReceipt/v1`(§12.7;轮 43 P2 摘要同步)。
- **ID 前缀增补(§1.3)**:`efc_`/`efi_`/`apch_`/`apl_`/`hga_`/`efp_`/`efa_`/`wel_`(broker 铸造;`appr_` 已注册=approval_records/workItemRef 族)。
- ApprovalChallenge expiry 定时器=§5.6 既有行;WorkspaceEffectLease 无独立定时器(随 EffectAttempt settle 释放,崩溃恢复走 §12.7 对账)。

---

## 13. signal-file 格式(§0-A.6) [NORMATIVE 形状;wake 语义 E2E-GATED→P0A-1]

> signal-file 是唤醒链(architecture §8.1)的 level-triggered 提示载体:**永不携带正文与令牌**(architecture §8.1/§10.3 逐字——防注入+防 transcript 重放污染);任务契约唯一真值恒在 broker。本章定义文件路径/内容 schema/写入原子性/coalescing 语义的 wire 级形状;**具体唤醒行为(hook 事件↔文件变更↔asyncRewake)属 [E2E-GATED→P0A-1]**,探测冻结前不得当已证事实。

### 13.1 路径与 per-session 隔离 [NORMATIVE]

- 每 RuntimeSession 一个 signal-file:`$STATE_DIR/signals/<runtimeSessionRecordId>.json`(mode 0600;父目录属主=当前 UID,同 §2.1 socket 纪律)。**按 rs_ 切分,跨滚代稳定**(§4.10;§4.4 的「以 generation 切文件」占位已由本章 additive 修正为 per-rs_,§10.14#22):文件内容携 `generation` 字段,旧代写入被新代 CAS 丢弃(§13.4)——单一实现,无「监视不同路径/误删当前代」歧义。
- rs_ OFFLINE tombstone(§4.6 linger 到期)→ 对应 signal-file 由 janitor 删除(§5.6 增行:`signal_file_gc`,随 rs_ lifecycle=OFFLINE 触发)。
- watchPaths 推导:SessionStart hook 返回的该 session 专属绝对路径(architecture §8.1)= 本文件路径;broker 不读宿主 transcript(§4.2 transcriptPath 仅 watchPaths 推导用,broker 不读内容——I-4/F10 边界)。

### 13.2 内容 schema [NORMATIVE]

```text
SignalFile {                           # 整文件 = 单 JSON 对象(NDJSON 不适用;文件小、整体 rewrite)
  schemaVersion: 1,
  runtimeSessionRecordId, generation: int,   # 写入代;§13.4 CAS 依据
  brokerBootEpoch: int,                # 跨 broker 重启辨识陈旧文件
  pendingCount: int,                   # 该 rs_ 为 resolved target 且 phase=queued(ready) 的任务数
                                       #   (level-triggered「队列非空」提示;=§7.7 status.queue.pendingCount)
  pendingTaskIds: [string](≤64),       # 不透明 taskId 列表(截断上限;超出仅 pendingCount 反映真值)——
                                       #   **零 payload/零 token/零正文**(architecture §8.1);taskId 非 secret。
                                       #   **闭合约束(轮 52 P1-4)**:全部属该 rs_ 的 resolved-target
                                       #   queued(ready) Task、distinct、按 enqueuedAt 升序;
                                       #   len(pendingTaskIds)=min(pendingCount, 64)(轮 53 P2:长度关系
                                       #   精确;pendingCount=0 ⇒ 空列表)
  attentionHint: "interruptible"|"idle_only"|"manual_accept"|"do_not_disturb",   # =rs_.attentionPolicy 快照
  updatedAt: int, updateSequence: int  # 单调递增(每次 broker rewrite +1);**hook 侧比较键=(brokerBootEpoch, updateSequence) 字典序(轮 52 P2-1:文件丢失/损坏后 sequence 从 1 重启时,新 bootEpoch 使旧高水位 hook 不永久忽略)**
}
```

- **不出现的字段(硬约束,审计 conformance 项)**:任何 payload 正文/inlineContent/completionToken/sessionAuth/审批内容/操作参数——出现即 §14 探测判 fail(注入面)。
- FileChanged hook(asyncRewake:true)**读不透明 taskId(存在性即唤醒依据,architecture §8.1 逐字「只读 signal 中的不透明 taskId」)+ 比较键 `(brokerBootEpoch, updateSequence)`(轮 53 P2),不 claim、不领 lease、不解析 taskId 语义/不据其做授权**(exit 2 唤醒,不参与任务领取);领取一律走 §7.3 wire 协议。「不解析语义」= taskId 是唤醒触发的不透明句柄,不携含义(轮 52 P1-4:与 architecture 逐字一致,消除「不读 pendingTaskIds」误述)。

### 13.3 signal-file 是 wake outbox 的物化载体(唤醒门接线) [NORMATIVE]

- **两类 rewrite 分立(轮 53 F5)**:
  - **唤醒型 rewrite(0→nonzero,即 rs_ 从「无 pending」变「有 pending」)**:受 §10.5 唤醒门约束——broker 决定唤醒时(GCRA/TAT allowed ∧ attentionPolicy 允许((`interruptible`|`idle_only` 达最小静默)——`do_not_disturb`/`manual_accept` 恒不自动唤醒(轮 53 F6:manual_accept 须真人 accept 事实,无该事实不自动 wake))∧ human-first 未占先)→ 写唤醒;denied → 不写(任务留 queue,pull 面 §7.3 peek/§7.7 status 可取);
  - **清零型 rewrite(nonzero→0)**:**免受门控的 cleanup rewrite**(轮 53 F5:pendingCount=0+空列表落盘,防文件残留旧非空真值违反 §13.2 归属约束;hook 读空列表**不 exit 2 唤醒**——空信号无唤醒义务)。
- **其余 pendingCount 变化(nonzero→nonzero,如 2→1)不 rewrite**(防免费唤醒)——真值同步走 pull 面(§7.7/§7.3)。
- **wake_signal outbox 状态机(轮 54-55 F3-F8 完整化;kind='wake_signal' 专属列)**:`{rs_, generation, brokerBootEpoch, signalRevision, snapshotBody(轮 56 P1-3:仅 rewrite-稳定内容 {pendingCount, pendingTaskIds, attentionHint}——**不含 brokerBootEpoch/updateSequence/updatedAt**,后三者 sender 落盘时从 outbox 冻结的 bootEpoch/signalRevision+当前时间填,故 rebase 改 bootEpoch/revision 不动 snapshotBody/digest,冻结 digest 与文件不失真), snapshotDigest(=AB-CANON-1("AgentBridge/SignalFile/v1", snapshotBody);域入 §16.3), isCleanup: bool, tatCharged: bool(F7:本 wake 是否已消费 TAT 额度), wakeState: "pending"|"applying"|"acked"|"abandoned", applyingAt|null}`。**并发模型(轮 55 F5/F6)= 每 rs_ 至多一 pending + 至多一 applying:部分唯一 `(rs_, wakeState) WHERE kind='wake_signal' AND wakeState IN (pending, applying)`**(applying 行占位时仍可 insert 一条 pending successor,不撞键;acked/abandoned 不占)。`signalRevision`=`runtime_sessions.signalHighWater`(§4.11,§10.14#26)+1 并同事务推进(F5:不复用)。
- **wake reducer(轮 55 F5/F6/F7 封闭;所有分支单 writer 事务)**:
  - **positive(0→nonzero,须 GCRA/attention 门过)**:目标是「让该 rs_ 有一条已收费 pending」——(a) 无 live 行 → 推进 TAT + insert(pending, isCleanup=false, **tatCharged=true**, snapshotBody=真值);(b) 有 pending 行 → CAS 更新其 body/digest/revision/isCleanup=false;**若原 pending.tatCharged=false(即原是 cleanup)则本次推进 TAT 并置 tatCharged=true(F7:cleanup→positive 须新收费,消除免费 wake);原已 charged 则不重复收费**;(c) 只有 applying、无 pending → insert pending successor(推进 TAT+tatCharged=true);
  - **cleanup(nonzero→0,免门,F7 不推 TAT)**:(a) 有 pending → CAS 其 isCleanup=true+空 body(**保留 tatCharged 原值**——不退费);(b) 只有 applying → insert pending successor(isCleanup=true, tatCharged=false);(c) 无 live → insert(pending, isCleanup=true, tatCharged=false);
  - **sender(单 writer)**:claim pending→applying(记 applyingAt)→ 按 snapshotBody 落盘(§13.4,updateSequence=signalRevision)→ acked;**EIO/ENOSPC → applying→pending 退避;若此时已存在 pending successor → 当前 applying 行丢弃(successor 承接;successor.tatCharged 保留自身值,不 OR 继承前驱额度——轮 56 P1-1:防 cleanup successor 继承 positive charge 后再 cleanup→positive 免费 wake)——不撞「至多一 pending」约束(F5)**;
  - **cleanup 落盘的 hook 语义**:sender 写空列表 signal-file,hook 读 pendingTaskIds=[] 不 exit 2 唤醒(§13.2)。
- **跨介质顺序(F3:照 architecture §6.5 `commit intent → send → persist ack`)**:DB 原子写 reducer → commit 后 sender rewrite → acked;免费 wake 面消除(rewrite 恒晚于 commit,回滚则无行)。**崩溃恢复(F3 措辞统一,轮 55)**:wakeState=pending/applying 行由 sender 重跑(幂等,按 signalRevision;applying 视同 pending 重 claim);acked/abandoned 不重做。
- **broker 重启 rebase(F4+轮 56 P1-2)**:启动恢复(§4.6,brokerBootEpoch+1)后,live wake 行**按 rs_ 合并 rebase**——双 live(applying+pending)不各回 pending 撞键,而是合并为单条 pending(取 pending successor 的 body=最新意图,tatCharged=pending 行值;仅 applying 无 pending 则该 applying 单条回 pending):新 signalRevision+brokerBootEpoch=当前,复用合并后 snapshotBody 与 tatCharged(不二次收费),wakeState=pending;仅 rs_ lifecycle≠live 行 abandoned。
- **wake re-evaluation owner(F8)**:§5.6 `wake_reeval` 行——时钟源=`rs_.nextWakeEligibleAt`(GCRA denied 时同事务写=TAT 下一放行时点,轮 55)/`rs_.manualAcceptPendingSince`(manual_accept 一次性事实,持久 `{acceptEventId, acceptedAt}`——消费与建 wake 同事务清除,crash 不丢,轮 55);到点对有 pending queued 且无 live wake 的 rs_ 重评唤醒门(防永不醒)。
- **宿主侧 coalescing** [E2E-GATED→P0A-1]:多次文件变更是否被 FileChanged hook 合并=待测;broker 以 `(brokerBootEpoch, updateSequence)` 单调保证 level-triggered 幂等。

### 13.4 写入原子性与幂等收口 [NORMATIVE]

- 写路径:`<file>.tmp → fsync(tmp) → rename → fsync(dir)`(同 architecture §11「发现文件」纪律);rename 原子替换,读者永不见半写。
- **sender 写入门(轮 53 F4:按 outbox 冻结值,非文件比较)**:sender 执行 rewrite 前重验 DB `{rs_ lifecycle=live(非 OFFLINE)、outbox 冻结的 generation==rs_.currentGeneration、brokerBootEpoch==当前}`——任一不符 → outbox 行 abandoned+不写(旧代/OFFLINE 后迟到 wake 丢弃;OFFLINE GC 后因 lifecycle≠live 不重建 ghost signal)。写入的 `updateSequence`=outbox 冻结的 `signalRevision`(非「读文件+1」——幂等锚,轮 53 F4);文件内 `generation` 仅供 hook 辨识,不作 broker 判据。
- **outbox↔文件幂等锚**:outbox 行 `{signalRevision, snapshotDigest}` 即幂等锚;rename 后、**wakeState applying→acked 前** crash → 恢复重发同行(按 signalRevision 幂等覆盖);EIO/ENOSPC → **wakeState applying→pending 退避重试**(不静默丢 wake)。**tagged state ownership(轮 57 P1-2)**:wake_signal 行的 generic `outbox.state` 恒=固定哨兵 `'wake_kind'`(不参与 §7 outbox 通则的 pending/sent/acked 语义——那套治理 dispatch/resume kind);wake_signal 的生命周期**唯一**由 `wakeState` 承载(pending→applying→acked/abandoned),本章一切「恢复/重发/唯一键」均指 wakeState。
- broker 崩溃恢复(§4.6 启动恢复事务后):按 outbox pending 行重发(经上门);无对应 live rs_ 的残留文件删除(signal_file_gc,§5.6)。
- **写者唯一**:仅 broker 单 writer sender 写 signal-file(hook 只读);无并发写竞争。

---

## 14. Phase 0A 探测登记与 evidence schema(§0-A ③纸面准备包;NOT RUN) [全章 experimental probe envelope,非 wire 协议]

> **本章不定义运行时 wire 行为**,是 Phase 0A 平台探测(architecture §15)的**执行准备包**:探测项登记、每项的 evidence schema、pass/fail 判据、与本文 [E2E-GATED] 标注的回填映射。**所有探测 NOT RUN**(执行需实机双桌面+计费敏感+用户授权,§0 授权口径);本章交付=探测可复现的纸面规格,不含任何探测结论。探测通过前,依赖项按各自 [E2E-GATED] 条件 profile 处理,禁当已证事实。

### 14.1 探测项登记表(对齐 architecture §15 Phase 0A 九项 + 本文新增 context-basis 项)

| Probe | architecture §15 项(P0A-n 对齐其编号 1-9) | 本文 gate 标注回填目标 | evidence schema(§14.2) |
|---|---|---|---|
| P0A-1 | §15-1 SessionStart→watchPaths→FileChanged→asyncRewake 空闲唤醒(新建/resume/clear/compact 注册+generation;coalescing;sleep/强退恢复) | §2.4 canWakeIdle/inboundMode=hook_wake、§4.2 registrationSource 宿主映射、§4.9 claude_hook profile、§13.3 | WakeChainEvidence |
| P0A-2 | §15-2 Codex 插件安装→enable→新 task MCP 工具+hook 信任+升级(hash 变化)+marketplace cache | §9.1 Codex 插件分发(CodexWorker adapter gate 输入) | PluginLifecycleEvidence |
| P0A-3 | §15-3 Codex MCP shim 进程拓扑+thread 身份获取(失败→attach unsupported) | §4.9 codex_shim_thread_identity profile(unverified→verified) | ThreadIdentityEvidence |
| P0A-4 | §15-4 codex mcp-server 原始行为(recording stub,不接真实 policy) | §9(CodexWorker adapter gate 输入;非本文直接回填) | McpServerBehaviorEvidence |
| P0A-5 | §15-5 worker 线程 Desktop 可见性+codex://threads 导航+drain 后 resume+双客户端并发 | §9.2 CodexWorker 生命周期(adapter gate 输入) | WorkerVisibilityEvidence |
| P0A-6 | §15-6 Codex Stop/UserPromptSubmit systemMessage 视觉位置/持久性+followUpQueueMode 时机 | §9.3 manual_claim_current nudge 时机(§2.4 inboundMode=manual_claim_current gate——**仅 nudge UX,不回填 canInjectActiveConversation**;systemMessage 恒 UI 警示不进模型上下文,architecture F5/§1.2) | SystemMessageEvidence |
| P0A-7 | §15-7 `claude -p --resume <打开中桌面 session>` 是否被拒(隔离探测) | §4.6 resume 隔离前提(非本文直接回填) | ResumeIsolationEvidence |
| P0A-8 | §15-8 UDS proxy 先行探针(handshake/reconnect/stale-socket/rollback;0B 前置) | Phase 0B 迁移前置(architecture §16;非本文直接回填,但**跳过则 0B 不可执行**) | UdsProxyEvidence |
| P0A-9 | §15-9 HostTurnBoundary(turnId 证明/prompt_epoch) | §4.10 per-turn root 启用、§10.1 HostTurnKey/eventRef、4043 reserved→可达 | HostTurnBoundaryEvidence |
| **P0A-CB(本文新增,§0-A.8)** | (context-basis;architecture §15 未单列——本文显式登记) | §9.3 contextDigest 来源、§9.2 current profile 开放前置、§16.2 的 4052 `context_basis_unsupported` | ContextBasisEvidence |

- **P0A-CB 三问(architecture §0-A.8 逐字,本文机器化为探测项)**:①**算什么字节**——current 模式下 caller 期望的 context basis 是哪段确定性字节(宿主 transcript?prompt 历史?broker 无读 transcript API,§4.2/F10);②**谁算**——broker/adapter/宿主哪方产出 contextDigest(broker 禁读 transcript ⇒ 若须 broker 算则须宿主经认证通道提供字节);③**caller 如何取得 expectedBasis**——调用方在 submit 前从何处获得可提交的 `expectedBasis.contextDigest`。三问任一无解 → current 模式 v1 保持 [UNSUPPORTED](§9.1 已锁保守解),不静默开放。

### 14.2 evidence schema(封闭;探测执行时产出,本文只定形状) [NORMATIVE 形状]

```text
ProbeEvidence(所有探测项共壳) {
  probeId: string(§14.1 Probe 列),
  probeSchemaVersion: 1,
  status: "NOT_RUN"|"PASS"|"FAIL"|"INCONCLUSIVE",   # 本文交付时一律 NOT_RUN
  hostMatrix: {product, hostVersion, os, osVersion}, # 探测执行环境(architecture §15「固定 host 版本」)
  runbookVersion: string, profileVersion: string,    # 探测脚本+adapter profile 版本(F10:失效判据锚)
  executedAt: int|null,
  evidenceDigest: "sha256:…"|null,     # = AB-CANON-1("AgentBridge/ProbeEvidence/v1",
                                       #   {probeId, probeSchemaVersion, status, hostMatrix, runbookVersion,
                                       #    profileVersion, executedAt, detail, observedStateSequence,
                                       #    artifactRef, expectedStateSequence, timeoutMs, fallbackOnFail})
                                       #   ——轮 59 P1-A:observedStateSequence 亦入 digest
  detail: <per-probe schema 之一>|null,              # NOT_RUN ⇔ null(唯一合法空形状)
  artifactRef: "sha256:…"|null, expectedStateSequence: object|null, timeoutMs: int|null,
  observedStateSequence: object|null,                # 轮 58 P1-5:实字段(非注释)——从 artifactRef 事件流
                                       #   确定性抽取的观测状态序列(执行方义务:artifact→observed 抽取规则随
                                       #   runbook 固定,消费方可按同规则重抽验)
  fallbackOnFail: string|null                        # architecture §15 L664:host 固定/预期序列/超时/artifact/fallback
  # **passPredicate 公共强制项(轮 56-59)**:observedStateSequence==expectedStateSequence ∧ artifactRef≠null ∧ **消费方 MUST 从 artifactRef 按 runbook 抽取规则重抽 observed 并比对一致(非「可」)**
  #   ∧ timeoutMs>0 ∧ detail 的任何 *WindowMs/*Ms 均在 [0, timeoutMs]——再叠加各 probe 专属谓词;
  #   无关 artifact/超时/序列不符恒不 PASS(digest 覆盖全字段含 observedStateSequence,替换即失配)。
  # **exact-shape 增补(轮 59 P1-A)**:已运行态八者(executedAt/evidenceDigest/detail/artifactRef/
  #   observedStateSequence/expectedStateSequence/timeoutMs/fallbackOnFail)全 NOT NULL;NOT_RUN 全 NULL
}
# **exact-shape CHECK(轮 52-60,单一 SSOT)**:status ∈ {PASS, FAIL, INCONCLUSIVE}(=已运行)⇔
#   **八者(executedAt/evidenceDigest/detail/artifactRef/observedStateSequence/expectedStateSequence/
#   timeoutMs/fallbackOnFail)全 NOT NULL**;NOT_RUN ⇔ 八者全 NULL(轮 60 P1-2:删旧「七者」冲突 CHECK)。
#   **status=PASS ⇔ passPredicate(ProbeEvidence)=true(轮 60:入参为完整 ProbeEvidence,可读顶层
#   observed/expected/timeout;§14.3 逐项封闭布尔;PASS 不能与谓词脱钩)**;FAIL/INCONCLUSIVE=passPredicate≠true。
#   **消费门(轮 60 P1-3):只认 status=PASS ∧ digest 重算一致 ∧ profileVersion==当前 ∧ runbookVersion ∈
#   当前 approved runbook allowlist ∧ hostMatrix==当前冻结 host/OS matrix**(旧/降级 runbook 的自洽空
#   extractor 产 {observed={},expected={}} 不入门)。

WakeChainEvidence {                    # P0A-1(轮 52 P0-1:逐场景证据,非仅聚合计数)
  perSourceScenarios: [{               # 四场景各一行:session_start/resume/clear/compact
    hostHookEvent, hostHookSource,     # SessionStart source 原值
    mappedRegistrationSource,          # →§4.2 枚举(clear/compact 必须映 clear/compact 非 reconnect)
    rsBefore, generationBefore, rsAfter, generationAfter,   # 滚代前后(§4.4:resume/clear/compact 必 +1)
    registrationEventId, credentialRolled: bool, wakeDelivered: bool}],
  duplicateSessionStartBehavior: "new_generation"|"idempotent_replay"|"observed_double_roll",  # §2.5.1/§4.4
  coalescingObserved: {emittedSignals: int(≥2), observedRewakes: int(0≤observedRewakes≤emittedSignals)},   # 轮 60 P1-4:须实发≥2 连续信号才证 coalescing(零样本不 PASS)
  sleepRecoveryScenarios: [{kind:"sleep_wake"|"force_quit_relaunch", recovered: bool, recoveryWindowMs: int(≥0)}](恰 2,kind UNIQUE),
                                       # 两场景各一;0≤recoveryWindowMs≤timeoutMs;recovered 须 true(轮 58 P1-6)
  wakeLatencyMs: {p50: int(≥0), p95: int(p50≤p95≤timeoutMs)}
}
PluginLifecycleEvidence {              # P0A-2
  installEnableNewTaskVisible: bool, hookTrustAccepted: bool,
  upgradeHashChangeReTrust: bool, marketplaceCacheBehavior: string
}
ThreadIdentityEvidence {               # P0A-3
  topologyReachable: bool, threadIdObtainable: bool,
  identityStability: "stable"|"changes_on_resume"|"unavailable"   # §4.9 verified 前置
}
McpServerBehaviorEvidence {            # P0A-4(recording stub,不接真实 policy)
  elicitationShape: object|null, cancelObserved: bool,
  sessionNotFoundAfterCrash: bool, authSource: "subscription"|"api_key"|"unknown"
}
WorkerVisibilityEvidence {             # P0A-5
  desktopThreadVisible: bool, threadNavigationWorks: bool,
  resumeAfterDrain: "resumes"|"new_thread"|"unavailable", concurrentDualClient: string
}
SystemMessageEvidence {                # P0A-6(仅 nudge UX,不证注入能力)
  desktopVisualPosition: "visible_banner"|"visible_inline"|"not_visible", persistence: "persistent"|"not_persistent",
  followUpQueueMode: "queue"|"other",
  scenarios: [{startEvent: "stop"|"user_prompt_submit", hookFired: bool, timingMs: int, relativePhase: "before_next_turn"|"after"}](恰 2,startEvent UNIQUE),  # 轮 59 P1-C:Stop 与 UserPromptSubmit 各证一场景
  entersModelContext: bool             # 期望 false(architecture F5:systemMessage 不进模型上下文)
}
ResumeIsolationEvidence {              # P0A-7
  claudePResumeRejected: bool          # 期望 true(隔离:-p --resume 打开中桌面 session 应被拒)
}
UdsProxyEvidence {                     # P0A-8(0B 前置)
  handshakeOk: bool, reconnectOk: bool, staleSocketHandled: bool, rollbackOk: bool
}
HostTurnBoundaryEvidence =             # P0A-9(轮 54 F1:真 tagged union,各支验各自原始样本)
    {producerFrozen:"none"}            # 未冻结 producer → PASS 谓词恒 FAIL
  | {producerFrozen:"host_turn_id",    # 宿主可信 turnId 支(§10.1)
     trustedProducerChannel: bool,     # 经认证 first-party 通道
     sameTurnGroups: [{hostTurn, samples: [observedTurnId](≥2)}](≥1 组),  # 每组同一 host turn ≥2 次到达
     crossTurnSamples: [{hostTurn, observedTurnId}](≥2,hostTurn 两两异),   # ≥2 个不同 turn
     turnIdStableWithinTurn: bool,     # =∀组 samples 全等 ∧ 存在组 size≥2(派生;空/单例=false)
     turnIdUniqueAcrossTurn: bool}     # =crossTurnSamples 的 observedTurnId 两两异 ∧ size≥2(派生)
  | {producerFrozen:"prompt_epoch",    # broker 单调 epoch 支(§10.1)
     trustedProducerChannel: bool,
     sameTurnRestartGroups: [{hostTurn, samples: [{observedEventRef, phase:"pre_restart"|"post_restart"|"reconnect", assignedEpoch: int(≥1)}](≥2)}](≥1),
                                       # 同 host turn 跨重启+reconnect 多次到达——每次记原始 observedEventRef;
                                       # 稳定=同组内 assignedEpoch 恒等 ∧ observedEventRef 恒等(证同 turn 稳定,轮 58 P0-1)
     crossTurnSamples: [{observationOrdinal: int(≥0,组内 UNIQUE), hostTurn, observedEventRef, assignedEpoch: int(≥1)}](≥2,hostTurn 两两异,按 observationOrdinal 升序=实际观察序;轮 60 P1-1:ordinal 全序防并列重排),  # ≥2 不同 turn
     eventRefStableAcrossRestart: bool, # =∀组 samples 的 (assignedEpoch 全等 ∧ observedEventRef 全等)∧ 存在组同时含 pre_restart+post_restart 与 reconnect 相位(派生;空/单例/缺相位=false;轮 58 P0-1:含宿主重启与 reconnect)
     eventRefUniquePerTurn: bool,      # =crossTurnSamples 的 (hostTurn 异 ⇒ eventRef 异 ∧ assignedEpoch 异)∧ size≥2(派生)
     epochMonotonic: bool}              # =crossTurnSamples 按 observationOrdinal 升序时 assignedEpoch 严格递增(派生,轮 59 P1-NEW:不自报)
ContextBasisEvidence {                 # P0A-CB(轮 52 P1-7+轮 53 F8:tagged union,布尔由约束派生)
  resolution: {kind:"unsolved"}        # 三问任一无解——threeQuestionsAllAnswerable 派生 false
           | {kind:"solved",           # 三问全解;下列字段全非空,布尔派生 true
              byteSource: {kind:"prompt_history"|"other_named", locator: string},  # 问①(**禁 transcript:
                                       #   broker 无读 transcript API,§4.2/F10;transcript 源=unsolved**)
              byteEncoding: "utf8"|"utf16le"|"raw",
              canonicalization: "jcs_v1"|"none",               # 封闭枚举;**canonicalization=jcs_v1 ⇒ byteEncoding∈{utf8,utf16le}(轮 56:raw 非合法 JSON 不可 JCS——组合非法即 unsolved)**
              digestProducer: "adapter"|"host",                # 问②(禁 broker),
              producerTransport: "authenticated_control_channel"|"host_hook_v1",  # 封闭枚举(非 TBD)
              sampleBasisBytesB64: string(base64url), sampleDigest: "sha256:…",
              callerObtainProtocol: "host_provided_at_prompt_verified"|"none",
              obtainCarrier: {carrierEventRef: string, authChannel: "host_hook_v1"|"authenticated_control_channel", obtainedAtBeforeSubmit: bool, callerReceivedDigest: "sha256:…"}|null}
                                       # 问③(轮 59 P1-D:verified 须带 typed carrier evidence——caller 实收 basis
                                       #   的事件 ref/认证通道/submit 前时点/实收 digest;且 callerReceivedDigest 须
                                       #   ==从 artifactRef MUST 重抽的 caller 侧观测;"none"或 carrier=null ⇒ unsolved)
  # **normalization 封闭(轮 57 P1-9)**:raw=保留 decode 出的原字节(canonicalization 必=none);utf8/utf16le=
  #   按该编码解码为文本再 UTF-8 重编码;canonicalization=jcs_v1 时按 §1.4 JCS(含 duplicate-key/safe-int 收紧)
  #   序列化文本为 JSON;**任何解码/JSON-parse 失败 → resolution 视为 unsolved(不 solved)**;callerObtainProtocol
  #   ="none" 亦 unsolved。threeQuestionsAllAnswerable = (kind=="solved" ∧ callerObtainProtocol="host_provided_at_prompt_verified"
  #   ∧ obtainCarrier≠null ∧ obtainCarrier.obtainedAtBeforeSubmit=true ∧ obtainCarrier.callerReceivedDigest==sampleDigest
  #   ∧ (obtainCarrier 全 tuple 由 artifactRef MUST 重抽一致,轮 60 P1-5)∧
  #   AB-CANON-1("AgentBridge/ContextBasis/v1", {byteEncoding, canonicalization,
  #   normalizedBytesB64: base64url(上述规范化字节)})==sampleDigest)——封闭 JSON hash-input,跨实现同 digest;
  #   派生布尔非自报;domain 入 §16.3(§9.2/§9.3 前置)
}
```

### 14.3 pass/fail 判据与回填协议 [NORMATIVE]

- **每探测项 PASS 谓词(封闭布尔函数;非泛述)**:
  - P0A-1:四场景 mapping 全正确 ∧ 无 observed_double_roll ∧ credentialRolled 与滚代一致 ∧ 全场景 wakeDelivered ∧ coalescingObserved.observedRewakes≤emittedSignals ∧ **sleepRecoveryScenarios 含 kind=sleep_wake 与 kind=force_quit_relaunch 各一且 recovered=true(轮 56:两场景分别证)**;
  - P0A-2:installEnableNewTaskVisible ∧ hookTrustAccepted ∧ upgradeHashChangeReTrust ∧ **marketplaceCacheBehavior∈{"refresh_ok","cache_invalidated_ok"}(封闭允许集,非 presence check——轮 54)**;
  - P0A-3:topologyReachable ∧ threadIdObtainable ∧ identityStability="stable";
  - P0A-4:**authSource="subscription"**∧ elicitationShape≠null ∧ cancelObserved ∧ **sessionNotFoundAfterCrash=true(crash 后确证 Session-not-found,非仅记录——轮 54)**;
  - P0A-5:desktopThreadVisible ∧ threadNavigationWorks ∧ resumeAfterDrain∈{"resumes","new_thread"} ∧ **concurrentDualClient∈{"isolated_ok","serialized_ok"}(封闭允许集,"unsafe race" 不 PASS——轮 54)**;
  - P0A-6:**entersModelContext=false**(仅 nudge)∧ desktopVisualPosition∈{"visible_banner","visible_inline"} ∧ persistence="persistent" ∧ followUpQueueMode="queue" ∧ **两 scenarios(stop+user_prompt_submit)各:hookFired=true ∧ 0≤timingMs≤timeoutMs ∧ relativePhase="before_next_turn"**(轮 59 P1-C:两场景均达标);
  - P0A-7:claudePResumeRejected;
  - P0A-8:handshakeOk ∧ reconnectOk ∧ staleSocketHandled ∧ rollbackOk;
  - P0A-9(轮 54 F1:tagged union 各支验各自样本;不混支):
    - host_turn_id 支 ⇒ trustedProducerChannel ∧ **turnIdStableWithinTurn ∧ turnIdUniqueAcrossTurn**(由 same/crossTurnSamples 派生,证 turnId 本身同 turn 稳定+跨 turn 唯一);
    - prompt_epoch 支 ⇒ trustedProducerChannel ∧ eventRefStableAcrossRestart ∧ eventRefUniquePerTurn ∧ epochMonotonic(均由 sameTurnRestartGroups/crossTurnSamples 派生,空/单例=false;轮 59:monotonic 亦派生);
    - none 支 ⇒ FAIL(未冻结 producer 不可开放 per-turn root);
  - P0A-CB:threeQuestionsAllAnswerable(=①②③三组字段全非空 ∧ sampleBasisBytesB64→sampleDigest 复现)。
- **回填协议(探测 PASS 后;轮 52 P1-9:conjunct-eligible 非 auto-enable)**:探测 PASS 只令该 gate 的 **evidence 合取项**满足,**不自动启用能力、不移除其它 hard gate**。具体启用另需各条自身的完整合取:例如 current 模式开放 = P0A-CB PASS **∧** architecture resolvedContextBasis tagged-union 修订 APPLY(§9.1)**∧** 新 protocol feature `context_current_v1`(§9.2)**∧** 用户 DS-3 裁决(§15)——四者齐全才开放;per-turn root 启用 = P0A-9 PASS **∧** broker policy 切换(§4.10)。**wire 形状恒不变**(policy/feature 切换,非报文改动——**例外(轮 58 P1-8):context-basis carrier 是 context_current_v1 feature 新增的字段,属该 feature 的报文扩展,不违反「既有报文形状不变」:既有 v1 报文零改动,新字段仅在协商该 feature 后出现**)。**evidence 失效**:hostVersion/profileVersion 升级后旧 evidence 失效,须重探(architecture §15 固定 host 版本)。
- 探测 evidence 入 adapter conformance gate(architecture §15);本文对应条目在其完整合取满足后的修订中由 [E2E-GATED] 降 [NORMATIVE]+profileVersion 冻结。**探测 FAIL/INCONCLUSIVE**=不开放(INCONCLUSIVE 按 FAIL 保守),FAIL 回改本文与 architecture(§15「任一失败即改设计」)。
- **禁止**:未 PASS 前将 [E2E-GATED] 条目当已证事实编码(§1.2 标签义务)。

---

## 15. 决策登记册(decision register;全文 USER-DECISION 汇总)

> 本章汇总全文 [USER-DECISION→DS-n] 条目,供用户逐项裁决;每条给**选项+推荐+默认安全侧**(定案前实现按默认安全侧或不实现,§1.2)。**本章不替用户决策**——仅结构化输入材料。

| DS-n | 决策点 | 选项 | 默认安全侧(定案前) | 关联条 |
|---|---|---|---|---|
| **DS-1** | Windows 支持范围与时间点(architecture §18-Q3 全决策,非仅 transport) | (a) 传输:named pipe / loopback TCP(带鉴权);**且**须一并定:signal-file 路径语义(§13.1 STATE_DIR/路径分隔)、peercred 等价的 peer identity 机制、支持阶段 | Windows 全不在支持矩阵(§2.1;定案且实现前 Windows 恒 UNSUPPORTED) | §2.1/§13.1、architecture §18-Q3 |
| **DS-2** | 数据治理词表+carrier 粒度+room 治理默认(architecture §10.2:task/room 携 dataClassification+accountClass+provider/region allowlist) | dataClassification 二值/细分;room accountClassPolicy(allow_unknown/require_known)+providerRegionAllowlist 默认充填 | dataClassification 二值(restricted→I-4 全覆盖);accountClass=unknown 不处理公司数据;allowlist 缺省=空(跨厂商派发 fail-closed)——carrier 已由 effectiveDataGovernance(§6.1)承载 | §7.2/§6.1、architecture §10.2 |
| **DS-3(本文新增)** | context-basis 开放策略(仅 P0A-CB PASS ∧ architecture §9.1 修订 ∧ feature context_current_v1 三前置齐后) | 开放 generation_only / 开放 digest_bound / 保持 fresh-only | 保持 current v1 [UNSUPPORTED](§9.1) | §9.2、§9.3、§14.1 P0A-CB |


- **DS-n 与 [E2E-GATED] 的区别**:DS 是**产品/治理裁决**(用户拍板),E2E-GATED 是**平台事实未知**(探测决定)。二者可叠加:DS-3 的开放策略前提是 P0A-CB PASS(平台可行),再由用户选开放形态(产品决策)——两关都过才开放。
- 本登记册随后续工作(architecture §17 治理件、architecture §12 Console;r63 P2-13:本文无 §17,原锚歧义)增补;treated as living——新增 USER-DECISION 条目须回填本表并分配 DS-n。

---

## 16. typed error registry + canonical domain 注册表(横切)

### 16.1 error envelope [NORMATIVE]

JSON-RPC error object:**AgentBridge 应用层错误**的 `code` = 本注册表分配的稳定整数(4xxx 段);**JSON-RPC 传输/解析层标准码(-32700/-32600/-32601)不在此列**(方法层形状违例用 4058,§7.1);`message` 人类可读英文;程序化分支**只准依据** `error.data.typedCode`:

```text
{ typedCode: string, retryable: bool, remediation?: string, details?: object }
# details 禁止含 token 明文/任务正文
```

### 16.2 v1 错误码(§1-§12 范围;后续章节追加)

| int | typedCode | 场景 | retryable |
|---|---|---|---|
| 4000 | `protocol_version_unsupported` | §2.3 | false |
| 4001 | `handshake_required` | §2.3 | false |
| 4002 | `handshake_timeout` | §2.3 | false |
| 4003 | `handshake_violation` | §2.3 重复 hello/register | false |
| 4004 | `frame_too_large` | §2.2 | false |
| 4005 | `unknown_field` | §1.3 | false |
| 4006 | `forbidden_field` | §2.5.1(禁填集) | false |
| 4007 | `installation_proof_invalid` | §2.7 | false |
| 4008 | `surface_mismatch` | §2.7 | false |
| 4009 | `registration_conflict` | §2.5.1 同 ID 异 digest | false |
| 4010 | `auth_invalid` | §3.3(统一码;审计侧分子码) | false |
| 4011 | `generation_stale` | §3.3-1(tombstone 路径,公开例外) | false |
| 4012 | `connection_superseded` | §4.6 | false |
| 4013 | `session_busy` | §2.2 矩阵 | true(退避) |
| 4014 | `capability_disabled` | §2.4/§4.8/§4.10 | false |
| 4015 | `capability_not_allowed_for_surface` | §4.7 | false |
| 4016 | `workspace_fingerprint_mismatch` | §4.3 | false |
| 4017 | `resume_token_consumed` | §4.5 | false |
| 4018 | `not_paired` | §4.9 | false |
| 4019 | `invalid_registration_source` | §4.6 组合矩阵 | false |
| 4020 | `attached_adapter_unsupported` | §4.9(architecture §5) | false |
| 4021 | `pairing_code_invalid` | §4.9(过期/已消费/绑定不符统一) | false |
| 4022 | `endpoint_not_provisioned` | §4.8(approval_system/worker 通用注册) | false |
| 4023 | `broker_not_ready` | §2.3/§2.8 | true(retryAfterMs) |
| 4024 | `broker_draining` | §2.8 | true(retryAfterMs) |
| 4025 | `session_linger_expired` | §4.6(resume 迟到) | false |
| 4026 | `registration_event_superseded` | §2.5.1(旧事件重放,不碰现凭据) | false |
| 4027 | `endpoint_generation_stale` | §2.6-2 | false |
| 4028 | `bootstrap_capability_invalid` | §4.8 | false |
| 4029 | `storage_degraded` | architecture §11(SQLITE_FULL → read_only;commit 前绝不返回 durable acceptance) | true(退避) |
| 4030 | `claim_already_active` | §5.3(claim 重放但 delivery 已激活) | false |
| 4031 | `delivery_superseded` | §5.3(旧 revision ACK/撤权后迟到 ACK) | false |
| 4032 | `no_pinned_target` | §7.2(D-6 require_pinned;不建 Task,+remediation) | false |
| 4033 | `pinned_target_unavailable` | §7.2(exact bindingEpoch 有界 wake/dispatch 失败;不换目标) | true(退避) |
| 4034 | `ambiguous_target` | §7.2(目标不唯一拒绝路由,architecture §5) | false |
| 4035 | `activation_unsupported` | §7.2(D-6) | false |
| 4036 | `activation_not_authorized` | §7.2(无 ActivationGrant/policy 拒) | false |
| 4037 | `activation_timeout` | §7.2(有界 activation 超时) | true(退避) |
| 4038 | `activation_failed` | §7.2 | true(退避) |
| 4039 | `billing_context_unresolved` | §7.2(ask_codex activation 前 billing provenance 不明,D-6) | false |
| 4040 | `no_eligible_fallback` | §7.2(soft_fallback allowlist 用尽) | false |
| 4041 | `would_deadlock` | §7.2/§7.4(WaiterLease 成环,architecture §6.3) | false |
| 4042 | `quota_rejected` | §7.2(书挡① **永久 structural 拒**:depth/hop/hard-cap;不生成 taskId,architecture §6.6) | false |
| 4043 | `host_turn_identity_unavailable` | §4.10/§10(**reserved/conditional**:仅 per-turn root policy 启用后可达——现 fallback=HostSessionKey,architecture §6.6) | false |
| 4044 | `idempotency_conflict` | §6.1/§7.2(同 key 异 payloadDigest **或异 requestSemanticDigest**;含 preaccept join 拒) | false |
| 4045 | `offer_invalid` | §7.3(offer 过期/已消费/revoked/非本 owner 统一) | false |
| 4046 | `lease_invalid` | §7.3(renew 非 active lease/pending_ack 下 complete/跨 Task token 注入/同 Task active-authority drift→并进 reconciling;**revoked tombstone→4047;consumed tombstone 按 §5.3/§7.3 replay(原 receipt)或 4048**) | false |
| 4047 | `completion_token_revoked` | §5.3(**revoked** tombstone 恒 4047;consumed 按 §5.3/§7.3 replay(原 receipt)/conflict(4048),不受本码覆盖) | false |
| 4048 | `completion_conflict` | architecture §6.4/本文 §5.3+§7.3(同 token 异 completionOperationDigest) | false |
| 4049 | `completion_past_deadline` | §5.1(deadline 后 complete;late_result 已记,任务走 expired 路径) | false |
| 4050 | `action_token_invalid` | §7.4/§7.6(动作 token 过期/rotated/绑定不符/工单他属统一;**锚定重放四分支(v0.9.6)**:submission 锚+同 digest→原 receipt;submission 锚+**异 digest→仍 4050**;decided 锚+同 digest→原 receipt;decided 锚+异 digest→already_decided) | false |
| 4051 | `context_mode_unsupported` | §9.1(v1:current/checkpoint/providedBundle 三支) | false |
| 4052 | `context_basis_unsupported` | §9.2(**reserved**:仅未来已开放 current profile 下 expectedBasis 非 null;v1 current 恒 4051 先判) | false |
| 4053 | `task_not_found` | §7.2(不存在或无权,统一不作在性区分) | false |
| 4054 | `artifact_too_large` | §7.5(decoded 内容 > artifactMaxBytes policy;超帧本身=4004 先截) | false |
| 4055 | `artifact_not_found` | §7.5(不存在或无引用 authority,统一) | false |
| 4056 | `payload_too_large` | §7.1(inline 上限;改走 artifact 面) | false |
| 4057 | `quota_temporarily_unavailable` | §7.2(书挡① 暂态 reserve 失败:queue/window;+retryAfterMs) | true(退避) |
| 4058 | `invalid_params` | §7.1(方法层形状违例:XOR/枚举外/长度;传输层解析失败仍走 JSON-RPC 标准码) | false |
| 4059 | `continuation_required` | §10.2/§10.3(bridge-derived invocation 缺有效 parent 关联,或 continuation capability 无效/已消费/过期/绑定不符——统一不作在性区分) | false |
| 4060 | `unmediable_effect` | §12.7(opaque effect 无法产出完整 plan;+remediation) | false |
| 4061 | `approval_surface_unavailable` | §12/architecture §10.1(Approval Agent 有界 activation 超时) | true(退避) |
| 4062 | `approval_timeout` | §12.4(challenge expiry 的 caller 可见形) | false |
| 4063 | `effect_intent_conflict` | §12.3(同 toolUseId 异 effectSemanticDigest 重送;原行不动) | false |
| 4064 | `data_governance_denied` | §5.1(目标 provider/region ∉ room allowlist、无权威 region、或 caller/目标 accountClass 违规;书挡① 前不建 Task;+remediation) | false |

- **`generation_stale` 公开的泄露论证**:统一 `auth_invalid` 的目的在不向调用方泄露凭据失败层;但 generation 滚动必须驱动客户端自动 re-register(remediation 不同于普通 auth 失败的 reconnect)。泄露内容仅"会话已滚代"——在 UDS+peercred 的 wire 上,能观察到此码的只有 same-UID 进程(已属 architecture §10.4 out-of-scope)。故公开该码收益(确定性恢复流程)>风险,**其余 auth 子码保持不公开**。
- (architecture 任务面错误码已随 §7 章入表:4032-4041 出自 §6.3、4042/4043 出自 §6.6;§7-§9 增量 4044-4058。§12 审批面子码另随其章分配。)

### 16.3 AB-CANON-1 domain 注册表(随章节增补)

| domain | 用途 | 定义节 |
|---|---|---|
| `AgentBridge/HandshakeProof/v1` | 握手证明 MAC 输入 | §2.7 |
| `AgentBridge/Hello/v1` / `AgentBridge/HelloAck/v1` / `AgentBridge/RegisterBody/v1` | 握手 transcript digest | §2.7 |
| `AgentBridge/WorkspaceFingerprint/v1` | 工作区指纹 | §4.3 |
| `AgentBridge/LogicalSessionKey/v1` | 注册逻辑幂等键 hash(§2.5.1) | §2.5/§4.11 |
| `AgentBridge/EnrollmentPoP/v1` | approval enrollment 持有证明(Ed25519 消息) | §4.8 |
| `AgentBridge/IdempotencyScope/v1` | 任务幂等作用域 digest | §6.1 |
| `AgentBridge/CompletionOperation/v1` | completionOperationDigest(architecture §6.4 H(...) 实例化) | §7.3 |
| `AgentBridge/ResultEnvelope/v1` | resultDigest(信封级,防同内容异信封绕过 conflict) | §7.3 |
| `AgentBridge/ActivationReceipt/v1` | activationReceiptDigest(§5.3 幂等重放锚) | §7.3 |
| `AgentBridge/TaskRequest/v1` | requestSemanticDigest(幂等语义收紧) | §7.2 |
| `AgentBridge/RetryManifest/v1` | retry-manifest digest(valid manifest 本体) | §8.2 |
| `AgentBridge/RetryManifestSnapshot/v1` | invalid/fail-closed snapshot 合成 digest(独立封闭 hash-input) | §8.1 |
| `AgentBridge/SuspensionSubmission/v1` | supply_* requestDigest | §7.4 |
| `AgentBridge/SubmissionReceipt/v1` | submissionReceiptDigest(重放锚) | §7.4 |
| `AgentBridge/ApprovalDecision/v1` | decisionDigest(holder 决策幂等锚) | §7.6 |
| `AgentBridge/ConformanceSuite/v1` | conformance fixture 套件 digest(gate 证据+allowlist) | §7.8 |
| `AgentBridge/HostTurnKey/v1` | per-turn root 键([E2E-GATED→P0A-9];v1 不产生) | §10.1 |
| `AgentBridge/RouteKey/v1` | routeKey(三闸之 route recurrence) | §10.2 |
| `AgentBridge/Lineage/v1` | lineageDigest | §10.2 |
| `AgentBridge/BudgetOperation/v1` | BudgetReservation.operationDigest(书挡幂等锚) | §10.4 |
| `AgentBridge/UsageEvent/v1` | usageDigest(内容完整性校验;幂等锚=settlement identity 部分唯一,§10.4——轮 32 P2 消歧) | §10.4 |
| `AgentBridge/ActivationCoalescingKey/v1` | activation coalescing key(architecture §6.3) | §10.7 |
| `AgentBridge/ActivationSettlement/v1` | activation refcount 幂等结算 key | §10.7 |
| `AgentBridge/ExecutionProvenance/v1` | provenanceDigest(伪独立共识降权,carry-in) | §10.10 |
| `AgentBridge/PushCorrelation/v1` | correlationKey(push 响应唯一关联) | §11.2 |
| `AgentBridge/ApprovalRecordDigest/v1` | deny-only 记录的 operationDigest(审计近似,不承载授权) | §11.3 |
| `AgentBridge/Effect/v1` | operationHash(字节级 canonical schema 已交付,reserved 解除——**GV 随 conformance fixtures,G-5 前禁止实现放行路径**) | §12.3 |
| `AgentBridge/EffectArgs/v1` | canonicalArgsDigest | §12.3 |
| `AgentBridge/ApprovalPresentation/v1` | presentationDigest(呈现即所批) | §12.4 |
| `AgentBridge/HumanGesture/v1` | attestation 签名消息(域分隔 challenge) | §12.5 |
| `AgentBridge/EffectReceipt/v1` | effect 执行 receipt(same-request 重放锚) | §12.7 |
| `AgentBridge/EffectSemantic/v1` | effectSemanticDigest(intent 重放判同) | §12.3 |
| `AgentBridge/ProbeEvidence/v1` | Phase 0A 探测 evidenceDigest(复现锚) | §14.2 |
| `AgentBridge/SignalFile/v1` | signal-file snapshotDigest(wake outbox 冻结锚) | §13.3 |
| `AgentBridge/ContextBasis/v1` | context-basis 样例 digest(P0A-CB 复现) | §14.2 |
| `AgentBridge/GovernanceResolve/v1` | governanceResolveDigest(治理目标解析 drift fence) | §5.1/§6.1 |

---

## 附录 GV:AB-CANON-1 golden vectors(实算;生成脚本 `gen_golden_vectors.py` 随稿交付)

> 实现必须逐字节复现下列向量方可声称 AB-CANON-1 conformance。JCS 子集说明:向量停留在本规格约束的子集内(ASCII 键名、安全整数、常规字符串),`json.dumps(sort_keys, separators=(',',':'), ensure_ascii=False)` 级实现即可复现;full-JCS 边界向量(非 BMP 字符串/极值整数)随 conformance fixtures 交付。

| # | domain | 输入(JCS 后字节,UTF-8) | 结果 |
|---|---|---|---|
| GV-1 | `AgentBridge/WorkspaceFingerprint/v1` | `{"cwdCanonical":"/Users/test/project","vcsCommonDirCanonical":"/Users/test/project/.git","worktreeName":null}` | `sha256:674b43ebe34233340a7b2440f20567b62b0d131d59383b3932a239d5bccfa91b` |
| GV-2 | `AgentBridge/Hello/v1` | `{"clientNonce":"AAAAAAAAAAAAAAAAAAAAAA","hostVersion":"2.1.209","maxProtocolVersion":1,"minProtocolVersion":1,"pluginVersion":"0.1.0-test","protocolFeatures":["task_core_v1","wake_signal_v1"],"surface":"claude-cli"}` | `sha256:460c9536fb29dea60804444edf133d63e96d7f40fb2541d4dec3e7d6a3600456` |
| GV-3 | `AgentBridge/HelloAck/v1` | `{"brokerBootEpoch":1,"brokerVersion":"3.0.0-test","installationId":"inst_00000000000000000000000000","limits":{"heartbeatIntervalMs":30000,"maxFrameBytes":1048576,"maxInflightSubmits":4},"negotiatedProtocolFeatures":["task_core_v1","wake_signal_v1"],"protocolVersion":1,"serverNonce":"AQEBAQEBAQEBAQEBAQEBAQ"}`(serverNonce=canonical base64url(0x01×16)) | `sha256:1d7773898355951543de03d893996513b7a2e12a65a2788eedc62559c24d7f7e` |
| GV-4 | `AgentBridge/RegisterBody/v1` | (RegisterBodyHashInput 全字段构造值,完整 JCS 字节以脚本 stdout 为权威;含 GV-1 digest 文本形嵌套) | `sha256:61f3eb74280ff20ae58be94d1f24d7d9e87df23508e414df615eac4d2388fa53` |
| GV-5 | `AgentBridge/HandshakeProof/v1` | `{"clientHelloDigest":"<GV-2>","helloAckDigest":"<GV-3>","requestBodyDigest":"<GV-4>","requestKind":"register","resumeTokenHash":null}` | inner=`sha256:9c39b71b17c493cb92300ed5e9f3282f83d3cbe768a43eb823e17263ce0c83bc`;`mac`(secret=0x000102…1f,base64url 无填充)=`7JakG_0zMZOli3Y4Lirfn2ydeFtTikpUPf3SIv719Ag` |
| GV-6 | `AgentBridge/EnrollmentPoP/v1` | `{"bootstrapChallengeNonce":"AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI","declaredSchemes":["user_presence_dialog_v1"],…}`(nonce=canonical base64url(0x02×32),满足 §4.8 32B 约束;全输入见脚本) | `sha256:12a6e980e0149f91791aab65b5705b67325953f433010edc182fbe8de1252e6d`(Ed25519 签名本体按 RFC 8032 标准向量验;此为 AgentBridge 专有消息 digest) |
| GV-7 | `AgentBridge/RegisterBody/v1` | approval 注册全构造值(含 ApprovalBootstrapHashInput:bc=`bc1.`+base64url(0xAA×32)、PoP 签名 fixture=base64url(0xBB×64),均以 wire 字符串 UTF-8 字节做 sha256;完整 JCS 见脚本) | `sha256:76d3423b547e4186dcfa44796627f21bb0e759f756c85492da8de25d9d644328` |

- **脚本 stdout 完整锚**:`python3 gen_golden_vectors.py` 输出的 SHA-256 = `d80341b01106e82a084d1452fa9e8f5b7d96f2cdd982a19ed27e70e23988d511`(GV-4/7 的完整 JCS 输入字节以脚本输出为权威,表内长输入仅示意)。

## 修订记录

- **v0.12.18 终签追记(2026-07-16 会话 8;Codex r69 全路 APPROVE:Chunk 7 组装终审完成(CLOSED)——H1/H2 FIXED(混合分量/旧 epoch/B-then-A 三时序重放全过;本地 expiry 不复活撤权 lease 经 T17/§5.6 broker 权威确认);逆向反演 5 编辑精确重建 v0.12.17=零未声明改动;error 65 连续/domain 38=38/token 10=10/新增引用全有效;非阻断残留=仅 A-1..A-9 architecture 建议(待用户 APPLY,非 spec 残留)。本条+状态行同步为 r69 后唯一改动)**。
- **v0.12.18(2026-07-16 会话 8;Codex r68 极窄终签 REJECT(P0=0,P1×1+P2×1;G2 FIXED(SQLite 七场景全过:no-live/pending/sent/applying-match 受理,wrong-ref/ordinal-jump/fence-mismatch 全拒且零副作用);逆向反演 9 编辑精确重建 v0.12.16=零未声明改动)修入,待 r69 终签)**:H1(P1)§7.4 恢复条 carrier 字段表删复抄改严格引用 §7.3 七字段(含 leaseId/leaseEpoch 回显——原五字段复抄与 §7.3 双 schema,冷读按五字段 decoder 无法执行 tuple 全等 guard);H2(P2)anti-rollback 合并规则精确化:tuple 全等后三可变量**各自独立** max(低分量只忽略自身,不使同包更高分量丢失;「整包忽略」仅用于 tuple mismatch——消除混合新旧分量迟到响应下 component-max 与 whole-drop 的可用性分叉)。GV 锚不变。
- **v0.12.17(2026-07-16 会话 8;Codex r67 极窄终签 REJECT(P0=0,P1×3;F1(§2.6 五支)/F2(恢复域收窄)FIXED;逆向反演 7 编辑精确重建 v0.12.15=零未声明改动;SQLite 实跑复现 counter-first 语义污染与 NULL 谓词拒首次挂起)修入,待 r68 终签)**:G1(F3')renew_lease 响应回显 leaseId/leaseEpoch(anti-rollback 匹配键)+客户端单调合并规则(同 authority tuple 全等才应用;currentStateRevision/nextSuspensionOrdinal/leaseExpiresAt 恒 max(local, received),任一回退整包忽略;lease expiry 经本通道只延长不缩短——§2.2 control 并发下迟到旧 snapshot 不得回滚本地 authority);G2(F4')受理双规范消除(前置「受理判据=CAS…成功即写入」改「ordinal 检查仅构成唯一 accepted 谓词的只读合取,counter 写入仅发生于 accepted=true 统一事务」;「ordinal 新且 fence 全中→铸造」改「accepted=true→铸造」)+谓词三支显式二值化(liveIntent IS NULL ∨ state∈{pending,sent} ∨ (applying ∧ ref==targetRef)——缺席支显式为真,防 SQLite 三值逻辑误拒首次挂起;禁止裸 NULL 传播)。GV 锚不变。
- **v0.12.16(2026-07-16 会话 8;Codex r66 极窄差分 REJECT(P0=0,P1×2+非阻断 P2×1;N1'/N4' 主体确认过——Decision-only 密码链闭合(digest 覆盖 bc/PoP 语义经 §2.5.1/§4.8/§2.7 三处引文验证)+ordinal 计数器 SQLite 实跑(0→1 受理/跳 100 拒/重复拒/CHECK≥0);逆向反演 13 编辑精确重建 v0.12.14=零未声明改动)修入,待 r67 极窄终签)**:F1(§2.6-2 握手期 mutator 重验集改 branch-tagged 五支(common HandshakeProof/Decision-hit 禁读 token·bootstrap·PoP/miss-resume/miss-approval/普通 register)——原合集式表述与 §2.5.1 Decision-only 双规范,冷读按 §2.6 实现会复发 N1 分叉);F2(§7.4 恢复域收窄=transport reconnect/takeover 且本地 authority 保留;真实 shim 进程 crash 恒走 §5.3/T17,不得凭 ordinal 续用——消除与 §5.3「ACK 后 crash」的跨面分叉,completionToken/applying ref 无持久恢复载体不扩域);F3(task.renew_lease 响应改 authority snapshot {taskId, dispatchId, currentStateRevision, leaseExpiresAt, nextSuspensionOrdinal}——currentStateRevision 只读披露非推进;防 reconnect 后旧 revision complete 落 4046);F4(非阻断 P2:受理谓词单一原子化 accepted=exactFence ∧ ordinal==last+1 ∧ (state≠applying ∨ consumedSubmissionRef==targetRef);仅 accepted 同事务推进全部副作用,失败仅 audit 全不变)。GV 锚不变。
- **v0.12.15(2026-07-16 会话 8;Codex r65 窄差分 REJECT(P0=0,P1×2=N1'/N4';N2/N3/N5-N9 全 FIXED;逆向反演 14 编辑精确重建 v0.12.13 SHA=零未声明改动)修入,待 r66 极窄差分)**:N1'(§2.5.1)执行顺序物理重排为主体三段(①HandshakeProof→②Decision lookup(hit=redelivery,恒 Decision-only:不读/不消费/不重验 token·bootstrap 行与 PoP——bc/PoP 归属由 canonicalRequestDigest 承载(=HandshakeProof requestBodyDigest,覆盖 bootstrap 分支))→③miss 才 validate+consume)——原修法为后置注释,冷读实现仍按旧行序先消费 token;§4.8 redelivery 路径同步删 bc-row revalidation 双规范(consumedByRegistrationEventId 降审计;§4.11 两表列注同步);N4'(§7.4/§7.3/§6.1)suspensionOrdinal 恢复 carrier 实体化——ActivatedClaimReceipt 与 task.renew_lease 响应增 `nextSuspensionOrdinal`(=lastSuspensionOrdinal+1;原修法所称「恢复面」无实际 wire 载体);lastSuspensionOrdinal 形状封闭(NOT NULL DEFAULT 0 CHECK ≥0);受理判据改受理事务内 CAS `observedOrdinal==lastSuspensionOrdinal+1`(不用 `>`——错误 shim 极大 ordinal 不污染高水位;重复/跳号/回退仅审计)。GV 锚不变。
- **v0.12.14(2026-07-16 会话 8;Codex r64 差分复核 REJECT(P0=0,P1×4+P2×5;chat v3-apply-r64-final-diff;FIXED=P1-1/P1-3/P1-4/P2-8/P2-9/P2-10/P2-11 主体/P2-13;逆向反演 36 编辑精确重建 v0.12.12 SHA dec4be07…=零未声明改动)全量修入,待 r65 窄差分)**:N1(原 P1-2)§2.5.1 commitRegistration 执行顺序封闭(HandshakeProof→Decision lookup→token 消费三段;redelivery 不读/不消费 token 行;4007 统一失败不暴露 Decision 在性——消除与 §4.5 Decision-first 的双重规范+eventId oracle);N2(原 P1-5)payload 列组形状修正(mediaType/size 为两支公共非空列,XOR 仅约束正文载体;§6.1/§6.2 同步——inline claim 投影须返回二者);N3(原 P1-6)billingBindingRef 禁非 NULL 空串(CHECK ≥1 字符;防 ''/NULL 经 COALESCE 误合桶)+§10.4 bucket identity 句改 billingBindingKey(与 UNIQUE 一致);N4(原 P2-7 升 P1)suspensionOrdinal counter 权威=broker 持久值+shim 重连恢复协议(先取回 next ordinal 才可续用 dispatch;无法恢复走 T17)+第二因果锚 consumedSubmissionRef==live intent.targetRef;N5(原 P2-12)§4.9 4021 集删 evidence 不符(恒走 4020,消双码冲突);N6 §1.3 intent_/perm_ 标 reserved-unused(实体实际=efi_/efp_;防复用歧义);N7 4029 storage_degraded 接线 §2.8(post-readiness 降级→mutation 4029 retryable;4023 优先);N8 suspicious_suspension_replay 审计归属封闭(audit_log,字段 {fence, observedOrdinal, recordedOrdinal},不推进 eventSequence);N9 状态行行首版本残留修正(v0.12.12→现值)。GV 锚不变。
- **v0.12.13(2026-07-16 会话 8;Codex r63 全文对抗终审 REJECT(P0=0,P1×6+P2×7;chat v3-apply-r63-final-audit;SHA/GV/domain 38=38/error 连续/§10.14 主体落地/A-1..A-9 均独立 PASS 或 KEEP)全量修入,待 r64 差分复核)**:P1-1 D3 行 T20 分支恢复(v0.12.12 ③ 的「恒按既有 intent」抹掉 T20 unknown 分支——cancel intent 下无法证明无 effect 仍 unknown;§5.1 deadline blanket 同步 first-winner/T20 例外注);P1-2 §4.5 retention 判定顺序(Decision-first:同 event+同 digest+仍 latest 恒 redelivery 不依赖 consumed-token 行——修 v0.12.12 ⑤ 引入的 30d GC 与 §2.5.1 永久 redelivery 矛盾);P1-3 §6.1 outbox generic state 枚举补 `applying`+kind×state tagged CHECK(此前封闭枚举使 begin_apply_submission 物理不可达——Chunk 3 v0.9.5 引入三段态时未同步 §6.1);P1-4 ActiveRetryManifestSnapshot 存储 owner(新表 `retry_manifest_snapshots`(rms_)+broker_state 增 active 指针/maxAcceptedManifestVersion/highWaterDigest 三列+§10.13 增行——crash 后 rollback fence 可恢复);P1-5 inline payload 持久载体(tasks payload 列组 payloadInlineContent XOR payloadRef+mediaType+size,T1 原子写入;§7.2/§7.3 投影同步——修 accept 后 crash 丢正文);P1-6 ProviderCircuit 分桶键 billingBindingKey=COALESCE(ref,'') 非空哨兵(SQLite NULL 唯一语义可分裂失败计数绕开 circuit 保护,Codex SQLite 实跑复现;§10.13 同步)。P2-7 T9a/T10 再挂起收口因果 guard(suspensionOrdinal per-dispatch 单调+exact fence;dispatch_attempts 增 lastSuspensionOrdinal;拟作废项 (a) 被反例推翻改修入);P2-8 beginStop 收口 pending|sent dispatch_intent+T7 fence 失败同一幂等收口(拟作废项 (b) 被「永久 sent 悬空行」反例推翻);P2-9 §6.2 caller owner 行改 §6.1 逐字 SSOT(v0.12.12 ① 半完成残留);P2-10 §3.2 补 `sact1.`/`hact1.` 两 token kind;P2-11 §1.3 补 `wtr_`/`caps_`/`fal_`/`rms_` 四前缀注册+表行同步;P2-12 4021/4025 正文接线(§4.9 pairing.claim 失败统一出口/§4.5 OFFLINE tombstone 先于 auth_invalid);P2-13 五处引用残留(§6.5-gov→§6.1 rooms/approvalPolicy「词表随 §12」证伪改写/§7.6「§12 占位」回填/§15「§17」限定 architecture/§12.10 标题去 §4.11)。**r63 同轮确认**:v0.12.12 之 ②④ CONFIRM;拟作废 (c)(d)(e) CONFIRM;4 项 fixed 全确认;累计 additive(T4c×T4d×provider_wait/四 waiting 列正交/#16-#26 producer)闭合。GV 锚不变。
- **v0.12.12(2026-07-16 会话 8;Chunk 7a P2 回扫修复——ledger 两段 deferred P2 共 15 项判定(fixed×4/转 architecture 清单×1/拟作废×5/仍需×5),仍需 5 项修入,待 Codex r63 全文终审复核)**:①(R12-P2a)§6.1 tasks caller 列族 deadline 列名统一为 §7.2 wire 字段名 `deadlineAt\|ttlMs`(XOR;旧记法 requestedDeadline\|ttl 与「列名即 CallerRequest 字段名」自相矛盾);②(轮 23/25 deferred)§5.3 迟到 complete evidence-only 分支补 releasePoisonedSlot/§10.4 stop-confirmed 维护性例外交叉引用(语义 v0.10.10 已锁,纯反向引用);③(R13 deferred)§5.2 D3 行 first-winner 显式化(已有 cancel intent 不改写;**并修正原行「T19/T20 恒 expired」与 write-once+§5.4 cancel_uncertain「尊重 cancelRequested」的字面矛盾→「恒按既有 intent 定 outcome(无 intent 才 expired)」——请 r63 重点复核本处**);④(轮 41 P2)§5.6 open 自环 CAS expected 三元→四元(补 lastProbeDispatchId=扫描值;防 stop 证据清 ref 后旧扫描多延一 cooldown);⑤(轮 4-6 deferred)§4.5 已消费 resumeToken 记录 retention=30d default(与 PAI 同型)。**拟作废 5 项(判定待 r63 确认)**:T9a/T10 submissionRef 显式携带(单 in-flight 由 slots+live intent 唯一约束强制,因果闭合)/beginStop sent-unacked dispatch_intent 收口(T7 receiver fence+tombstone fence 双保险已覆盖)/GV-4·5·7 内联完整 JCS(脚本+stdout 锚=字节级权威,内联无验证增益)/客户端 pending-registration journal 通用化(普通 endpoint 无 bc 类跨请求绑定,crash 后走 reconnect+logicalSessionKey 幂等已闭合;Approval Agent 特例已覆盖 §4.8)/§10.4-§10.5 exhaustionPolicy 接线措辞合并(v0.10.5 已改引函数名单一 SSOT,残余括注为 provenance)。**已 fixed 确认 4 项**:SE 非导出措辞(§4.8)/worker spawn 两阶段(§10.8)/retire 枚举细化(§5.4 owner_identity_retired+retirementReason)/hostNativeSessionId 必填后无遗留引用(grep 复核)。GV 锚不变。
- **v0.12.11(2026-07-16 会话 8 交接审计;Codex blind-review handoff 抓出冷读残留)**:纯元数据/冷读修正,零行为语义——状态行尾部「组装终审待起草(章节映射见 §1.1)」改「§1-§16 全章封版完毕,Chunk 7 组装终审(无新章)待执行」(§1.1 无 Chunk 7 行,旧措辞误导);文件末尾「§10-§15 待后续 chunk」占位残留改为「全章封版」现况;**状态行前缀 provenance 澄清(「会话 7」→「主体会话 7 起草封版,v0.12.11=会话 8 交接审计」,消版本↔会话归属矛盾)**。共 4 处物理改动(标题版本号/状态行/本修订条/文件末尾),Codex 逆向重建确认可精确反推回 v0.12.10 的 ec3caca0…。GV 锚不变;不触任何封版正文/schema/error/domain/additive。
- **v0.12.10(2026-07-16 会话 7;Codex 轮 61 差分(P0=0 P1=0,六项 P1 全 FIXED;仅剩机械 P2 台账)修入,待轮 62 终签)**:#25 版本范围 v0.12.2-v0.12.8/轮 53-59;#25b 版本范围 v0.12.4-v0.12.9/轮 55-60+双 fence(room epoch + GovernanceResolve digest/re-resolution)+trigger 名统一 resolve_invalid;assignedEpoch int(≥1)(与生产 SSOT §4.10 一致)。GV 锚不变。
- **v0.12.9(2026-07-16 会话 7;Codex 轮 60 差分(P0=0;FIXED:P0A-6/grant version/Endpoint.region authority;剩 P1×6+P2×4)全量修入,待轮 61 复核)**:P1-1 prompt observationOrdinal ≥0+组内 UNIQUE(全序防并列重排);P1-2 Probe exact-shape 单一 SSOT(删旧七字段 CHECK,统一八字段+passPredicate(ProbeEvidence));P1-3 消费门绑 approved runbookVersion+冻结 hostMatrix(旧/降级 runbook 空 extractor 不入门);P1-4 WakeChain emittedSignals≥2(零样本不证 coalescing);P1-5 ContextBasis threeQuestionsAllAnswerable 消费 obtainCarrier(≠null ∧ obtainedAtBeforeSubmit ∧ callerReceivedDigest==sampleDigest ∧ artifact 重抽);P1-6 governance drift 入 T21 封闭触发集(room epoch 或 digest 不等 或 重解析失败 resolve_invalid→superseded;T3/T4「重解析成功且 digest 相等」)。P2:governanceResolveDigest domain=GovernanceResolve/v1(入 §16.3);§10.13 dbind activationGrantVersion;T1 fence②→③;#25/#25b 记录同步。GV 锚不变。
- **v0.12.8(2026-07-16 会话 7;Codex 轮 59 差分(P0=0;wake 路径全 APPROVE(SQLite 全通);剩 P1×7 精确收口)全量修入,待轮 60 复核)**:P1-NEW prompt epochMonotonic 派生(crossTurnSamples 加 observationOrdinal,按序严格递增,不自报);P1-A observedStateSequence 入 evidenceDigest+exact-shape 八者+artifact MUST 重抽;P1-B WakeChain 非负(0≤observedRewakes≤emitted;p50≤p95≤timeout);P1-C P0A-6 恰 2 scenarios(stop+user_prompt_submit)startEvent UNIQUE 各达标;P1-D ContextBasis obtainCarrier typed evidence(carrierEventRef/authChannel/submit 前/callerReceivedDigest==artifact 重抽);P1-E dbind.activationGrantVersion pin 快照(exact-compare;status→revokedAt IS NULL;grant 更新=config 变更→stale→4064 re-pin);P1-F Endpoint.regionRevision(admin CAS)+tasks.governanceResolveDigest(含 regionRevision/grantVersion)+T3/T4 fence 重验冻结 digest(region/grant drift 命中→T21 superseded)。P2:sampleBasisBytesB64 一致;T1 逐字 target accountClass。GV 锚不变。
- **v0.12.7(2026-07-16 会话 7;Codex 轮 58 差分(SQLite 实跑确认 wake reducer 核心闭环;P0×1+P1×6+P2)全量修入,待轮 59 复核)**:P0-1 prompt_epoch witness 补每次原始 observedEventRef(非仅组级)+相位含 pre_restart/post_restart/reconnect(§10.1「含宿主重启/reconnect」逐字);P1-3 §6.1 outbox generic state 增 'wake_kind' 哨兵(消 CHECK 拒 wake 行的物理不可满足);P1-5 observedStateSequence 入 per-probe 实字段+passPredicate 公共强制(observed==expected ∧ artifact ∧ timeout);P1-6 WakeChain 恰 2 场景+非负 CHECK(window/latency ≥0,recovered=true);P1-7 P0A-6 timing 起算事件+relativePhase=before_next_turn;P1-8 ContextBasis obtain 仅实证 host_provided_at_prompt_verified 才 solved(拟议方案=unsolved)+澄清 carrier=feature 新增字段非既有报文改动;P1-10 dbind.activationGrantRef 入 §10.9 主实体;P1-11 dedicated/fallback 治理解析总函数(null/non-null 两支+grant exact active/version+region 一致或保守拒)。P2:sampleBasisBytesB64 PASS 一致;task.submit error 面加 4064;tasks 摘要 direct region 改 endpoint.region SSOT;#25/#25b/#26 记录同步。GV 锚不变。
- **v0.12.6(2026-07-16 会话 7;Codex 轮 57 差分(逐字段+SQLite 实跑发现 v0.12.5 修订记录声称但主体缺失 4 处;P0×1+P1×13+P2×4)全量修入,待轮 58 复核)**:⚠**过程教训**:v0.12.1-v0.12.5 的批量 python 脚本在后置 assert 失败时静默丢弃**整个脚本**的已算替换(write 在末尾),致 4 处修法(prompt witness/EIO charge/snapshotBody/4064)只入修订记录未入主体——本轮改用逐条 Edit(原子)并核盘验证。落地:P0-F1 prompt_epoch sameTurnRestartGroups/crossTurnSamples 真入 §14.2 主体+PASS;EIO successor 自身 charge(不 OR);snapshotBody 仅 {pendingCount,pendingTaskIds,attentionHint};4064 data_governance_denied 入 §16.2+§5.1(不复用 4036/4040);wake_signal generic state=哨兵 'wake_kind'(tagged ownership,§13.4 恢复措辞统一 wakeState);consumed_accept_events append-only 表(manual accept 真幂等);ProbeEvidence observedStateSequence==expected+artifact+超时强制 PASS 项;WakeChain 恰 2 恢复场景 kind UNIQUE+window≤timeout;P0A-6 followUpQueueMode=queue+timingMs 达标;ContextBasis obtain 改「拟采机制」封闭枚举(v1 无 submit 前 carrier,随 context_current_v1 开放,DS-3)+normalization 封闭(raw/utf/jcs+解码失败=unsolved);endpoint.region+dbind.activationGrantRef+tasks resolvedTargetAccountClass 载体(三路同源);目标 accountClass 双侧重验(caller ∧ target≠unknown);governance_drift 扫描域限 pre-dispatch(已 dispatch grandfather/beginStop)。P2:operationKey coalesce/rebase 更新;nextWakeEligibleAt 清 NULL;rooms 删 caller allowlist 交集措辞;sampleBasisBytesB64 一致。GV 锚不变。
- **v0.12.5(2026-07-16 会话 7;Codex 轮 56 差分(FIXED:T1 TOCTOU/canInject/rooms 核心/domain;P0×1+P1×10+P2×4)全量修入,待轮 57 复核)**:核心=**物理 SSOT 同步**(前几轮修法写进叙述未落表)。**P0-F1**:P0A-9 prompt_epoch 支补真实 turn/restart 分组(sameTurnRestartGroups 含 pre+post/crossTurnSamples≥2 distinct;派生布尔空/单例=false)。P1:wake 三处 SSOT 统一(§6.1 outbox 唯一键改 (rs_, wakeState)+加 brokerBootEpoch/tatCharged/operationKey+tagged ownership;wakeState 承载生命周期,generic state 不适用本 kind);boot rebase 双 live 合并单 pending(不各回撞键);EIO successor 保留自身 charge(不 OR 继承);snapshotBody 重定义(仅 pendingCount/pendingTaskIds/attentionHint,不含 bootEpoch/updateSequence——rebase 不失真);runtime_sessions 补 nextWakeEligibleAt/manualAcceptEventId/consumed tombstone;ProbeEvidence artifact↔detail 绑定+expectedStateSequence 达标才 PASS+WakeChain 两恢复场景+P0A-6 persistence 枚举;ContextBasis obtain 去 suspension_receipt(绑 submit 前 wire 字段)+raw+jcs 组合非法;tasks 补 resolvedProvider/resolvedRegion/governanceReevalPending 列;T3/T4 guard 逐字入 room-epoch fence;typed error 4064 data_governance_denied(不复用 4036/4040)。P2:#25/#25b/#26 记录与实表同步;room seed 措辞;DS-2 room 标签。GV 锚不变。
- **v0.12.4(2026-07-16 会话 7;Codex 轮 55 差分(FIXED:F2/F4/F10/domain;P0×2+P1×11)全量修入,待轮 56 复核)**:**P0-F1**:P0A-9 witness 最小基数(host_turn_id 支 sameTurnGroups 每组≥2、crossTurnSamples≥2 distinct;prompt_epoch 支 pre/postRestartSamples——派生布尔空/单例=false,消真空 PASS);**P0-NEW**:T1 治理原子重验(读当前 room epoch→派生快照→按 D-6 冻结目标重验,消 D-6→T1 policy TOCTOU)。P1:wake reducer 重构(并发模型=每 rs_ 至多一 pending+一 applying,successor insert 不撞键;tatCharged 列——cleanup→positive 须新收费消免费 wake、positive 复用不重收;EIO applying→合并进 successor;nextWakeEligibleAt/manualAccept 一次性事实持久);ProbeEvidence 全字段入 digest+PASS 禁 null;ContextBasis 封闭 canonicalization/transport/obtain 枚举+封闭 JSON hash-input;canInject 直接 [UNSUPPORTED] v1;rooms room_<ULID>+唯一约束 seed(非确定性 ID)+accountClassPolicy 消费点;endpoint.provider/activation_grant.region 入主实体+resolvedTarget {resolvedProvider,resolvedRegion} 冻结(三路同源);T3/T4 room-epoch fence+admin 更新 governance_drift 补跑(双 producer);typed error 按 selector 分。P2:signalHighWater #26 引用;DS-4 移出 live 表;DS-2 room 标签;governance_drift/resolvedTarget snapshot additive #25b。GV 锚不变。
- **v0.12.3(2026-07-16 会话 7;Codex 轮 54 差分(FIXED:F2/F3/F10/P2×2+#24;P0×2+P1×多项)全量修入,待轮 55 复核)**:**P0-F1**:HostTurnBoundaryEvidence 改真 tagged union(host_turn_id 支验 turnId same-turn 稳定+cross-turn 唯一样本;prompt_epoch 支验 eventRef/epoch;none→FAIL);**P0-F2**:删 fresh/同厂商治理豁免——accountClass=unknown 禁令+provider/region allowlist 对一切 provider dispatch 适用,eligibility 移 accept 前(D-6/T1),accept 后仅 governancePolicyEpoch drift→T21。P1:wake outbox 状态机完整化(pending→applying→acked/abandoned,live 只占 pending/applying——首个 wake 不卡后续;snapshotBody 零正文持久(digest 不可逆);signalHighWater 防 revision 复用;重启 rebase 不丢 wake 不二次收费;cleanup 不推 TAT;coalesce join 不推 TAT;wake_reeval owner 防永不醒);ProbeEvidence NOT_RUN⇔detail=null+artifactRef/expectedSeq/timeout/fallback+PASS 谓词封闭结果枚举(marketplaceCache/authSource/concurrentDualClient/UI 均改允许集,坏结果不 PASS);ContextBasis 禁 broker/transcript 源+canonicalization 命名版本+domain+base64url 派生;canInject 按 surface false 直到专门 injection 探测;rooms 表补 room_ 前缀/确定性 seed/admin-only/字段 shape/最保守合并;endpoint.provider+activation_grant.region 载体+resolvedTarget 冻结;T21 增 governance drift 触发。P2:SignalFile/ContextBasis domain 登记;DS-1/DS-2/DS-3 源标签。GV 锚不变;§10.14 增 #26。
- **v0.12.2(2026-07-16 会话 7;Codex 轮 53 差分(FIXED 7;新 P0×2+P1×多项)全量修入,待轮 54 复核)**:**P0-F1**:P0A-9 PASS 改两 exact tagged predicate(host_turn_id 支需 turnIdValue≠null;prompt_epoch 支需 epochStability=monotonic;none→FAIL);**P0-F2**:accountClass 改 verified??unknown(declared 不升治理 authority)。P1:F3 跨介质禁「同事务」——DB 原子写 TAT+outbox(冻结 signalRevision/snapshotDigest),commit 后 sender rewrite,再 ack(§6.5 顺序);F4 outbox 冻结 {rs_/gen/bootEpoch/signalRevision/snapshotDigest}+幂等锚;F5 清零型 rewrite 免门(nonzero→0 cleanup,hook 空列表不唤醒);F6 per-rs_ live wake outbox 部分唯一 coalescing(与 burst=2 正交)+manual_accept 须真人 accept 不自动唤醒;F7 ProbeEvidence digest 绑 status/executedAt/profileVersion+PASS⇔passPredicate+INCONCLUSIVE 形状+PASS 谓词补 architecture 必测项(coalescing/sleep/cache/crash/drain/UI);F8 ContextBasisEvidence tagged union(solved/unsolved,布尔由 sample 重算派生);F9 §2.4 canInject 删 P0A-6(#24);F10 profileVersion 入共壳+digest+失效规则;F11 rooms 表(room 级治理 owner,#25);F12 providerRegionAllowlist entry shape+空集 fail-closed+§5.1 跨厂商派发 fence(T3/T4/T21 guard,#25)。P2:hook 比较键 (bootEpoch, updateSequence);pendingTaskIds 长度=min(count,64);DS-4 移出(NORMATIVE 校准非产品裁决)。GV 锚不变;§10.14 增 #24/#25。
- **v0.12.1(2026-07-16 会话 7;Codex 轮 52 REJECT(P0×2+P1×11+P2×3)全量修入,待轮 53 差分复核)**:**P0-1**(P0A-1 evidence 不足证明 registration/generation 映射)→ WakeChainEvidence 改逐场景 perSourceScenarios(四 source×滚代前后/eventId/wake result)+duplicateSessionStartBehavior;**P0-2**(P0A-9 eventRef 仅测 stable)→ HostTurnBoundaryEvidence 补 eventRefUniquePerTurn/trustedProducerChannel/producerFrozen(§10.1 全前置)。P1:①signal-file 身份统一 per-rs_(§4.4 additive 修正 #22,消除与 §13.1 矛盾);②**signal rewrite=wake outbox 物化,受 §10.5 GCRA/attentionPolicy/human-first 门**(pendingCount 单变不触发免费唤醒;删 signalCoalesceWindowMs——GCRA 即合并器)+outbox 幂等锚/EIO 退避;③代 CAS 改 DB 当前态 fence(lifecycle live+currentGeneration+bootEpoch,防 ghost signal);④hook 读契约对齐 architecture §8.1(读不透明 taskId 不解析语义)+pendingTaskIds 闭合约束;⑤§14.1 补全九项(P0A-2/-5/-7/-8+编号对齐,新增四 evidence schema);⑥ProbeEvidence exact-shape+逐项 PASS 谓词(封闭布尔,P0A-4 禁 api_key/P0A-9 六合取不误伤 OR);⑦ContextBasisEvidence 三问机器化(byteRange/canonicalization/sample 复现);⑧P0A-6 回填改 manual_claim_current nudge(不回填 canInjectActiveConversation;systemMessage 不进模型上下文);⑨回填=conjunct-eligible 非 auto-enable(current 四前置/per-turn root 两前置)+evidence 失效规则;⑩DS-1 补 Windows 全决策(signal/path/peer identity/阶段);⑪DS-2 补数据治理 carrier=§6.1 effectiveDataGovernance(#23)。P2:hook 比较键 (bootEpoch, updateSequence);4052 死引用改;DS-3/DS-4 标签+前置精确化。GV 锚不变;§16.3 增 ProbeEvidence domain。
- **v0.12(2026-07-16 会话 7;Chunk 6 初稿——§13/§14/§15 新增,待 Codex 红队 r52 起)**:新增 §13 signal-file 格式(§13.1 per-rs_ 路径隔离+OFFLINE GC/§13.2 内容 schema 零 payload·token+不出现字段硬约束/§13.3 coalescing broker 侧 NORMATIVE·宿主侧 E2E-GATED→P0A-1/§13.4 写入原子性+代 CAS+崩溃自愈)[NORMATIVE 形状;wake 语义 E2E-GATED]。新增 §14 Phase 0A 探测登记与 evidence schema(§14.1 探测项登记表 P0A-1/-2/-3/-4/-6/-9+新增 P0A-CB context-basis 三问/§14.2 ProbeEvidence 封闭共壳+六 per-probe detail schema/§14.3 pass/fail 判据+回填协议)[全章 NOT RUN 纸面准备包]。新增 §15 决策登记册(DS-1 Windows 传输/DS-2 dataClassification 词表/新增 DS-3 context-basis 开放策略/DS-4 coalescing 窗口;DS 与 E2E-GATED 区别:产品裁决 vs 平台事实,叠加须两关)。§5.6 增 signal_file_gc janitor 行。GV 锚不变。
- **v0.11.9(2026-07-16 会话 7;Codex 轮 50 差分(P1/原 P2 FIXED;唯一剩余=机械 P2)修入,待轮 51 终签)**:§12.10 effect_contexts 摘要行补 (taskId, dispatchId, attempt, subagentInvocationId) 部分唯一(contextKind='subagent')——冷实现按摘要建 schema 不漏 spawn 幂等约束。轮 50 逆向复核:反演 v0.11.8 六处替换精确重建 v0.11.7 SHA f31c4bd9…,零未声明改动。
- **v0.11.8(2026-07-16 会话 7;Codex 轮 49 差分(FIXED:A5/A6·#17/B5/C2·#19/row-body;additive #16-#21 全 CONFIRMED;唯一 P1+P2×1)修入,待轮 50 终签)**:subagent 唯一键改部分唯一 WHERE contextKind='subagent'(revalidation 继承非空 invocationId 不撞 parent 行,分类④事务不回滚);subagent spawn 事件 producer 协议 v1 如实标 [UNSUPPORTED](定义前 subagent 行不产生;未知 lineage fail-closed 兜底零放行面,开放=本文修订)。
- **v0.11.7(2026-07-16 会话 7;Codex 轮 48 差分(FIXED:A3/C2 载体/contextKind/row-body/#20/#21;剩 P1×5+P2×2)全量修入,待轮 49 复核)**:A5 escalation 列组补 escalatedProtectedManifestDigest(首次判定 manifest 快照,replay 返回本值)+CHECK all-or-none+decision='deny';A6/#17 四列物理键三处实际同步(§6.1 行/§11.3 前半锚句/#17 记录/§12.10 摘要——sourceChannel+sourceEventId+escalation 五列组);B3 contextKind 判定改构造入口决定(root/subagent/revalidation 三入口封闭;revalidation ⇒ parent NOT NULL,invocationId 继承 parent 可空可非空——exact-copy 与 CHECK 无自冲突);B5 effect 支 digest 公式唯一化(§12.4 构造值=union body,最终 digest 恒 {kind, body} 公式——challenge/HGA/workItem 三处同一);C2 targetOutcomes 增 targetOrdinal(绑定键;role 由 ordinal 从冻结 target 派生不入 receipt——rename 同 path 异 ordinal 天然不误伤)。P2:row/body 措辞(disposition==effect_attempts.state);§12.2 subagent producer 显式(认证 PEP 通道 spawn 事件)。
- **v0.11.6(2026-07-16 会话 7;Codex 轮 47 差分(P0=0 确认;FIXED:B1/C2 安全面/P2×1;#19 CONFIRMED;剩 P1×6+P2×6)全量修入,待轮 48 复核)**:A5 escalation durable outcome(approval_records 增 write-once escalation 列组 {escalatedAt/Decision/NextAction/AuditSeq};重送 replay 该列不重跑 T13/不撞键/审计不重复);A3 违例对全序规范化(枚举全部 {code, pointer} 对按 (codeRank, pointer UTF-8) 取首;missing_field pointer=父容器+字典序首缺失键);A6/#17 物理 schema 统一(sourceChannel+sourceEventId 单列 NOT NULL+四列 UNIQUE+channel↔decision tagged CHECK;§6.1/摘要/#17 三处同步);B3 revalidation child 其余 authority 字段逐列 exact-copy parent(唯一赋值规则);B5 presentationDigest 统一定义(ApprovalPresentation domain 输入扩 tagged union {kind, body};insert 计算+claim 重算比对);C2 §12.6 分类① 载体改 receiptBody。P2:contextKind 约束分层(row-local CHECK+跨表 FK/trigger)+摘要补列;row/body 全绑定(permitId/attemptId/settledAt)+digest mismatch fail-closed;全集绑定按 ordinal↔role(rename 同 path 不误伤);#20 落 T9b/T11a 行 set/clear 注;§10.14 正式编号 20/21;workItem 摘要补 presentationBody;jsonrpc data 缺席=null。
- **v0.11.5(2026-07-16 会话 7;Codex 轮 46 差分(FIXED:B6/C4/P2×4;#16/#18 CONFIRMED;P0 残留+P1×6)全量修入,待轮 47 复核)**:**P0 终解(A5)**:recorded_not_protected 不再充当重放锚——恒按当前状态重新分类(manifest/protectedStateRevision/guard build/fd-walk file identity 全量重跑;仍未保护→not_protected;已变保护→当前分类 deny 流程+stale_not_protected_escalation 审计行,原行保留)——任何字段比较集都覆盖不全分类上下文,重分类恒幂等且零陈旧放行面。A3 violationCode first-match 序+pointer=canonical 遍历序首违例点(总函数);A5 记录域分离(sourceChannel 列入唯一键,note=approve.sh 域与 pep 不交);A6 四物理列复合 UNIQUE 统一(删单列表述);B1 contextKind 三值 tagged CHECK(root/subagent/revalidation——未知构造 insert 恒拒);B3 revalidation 快照补 guardBuildDigest+§12.2 建立时点补分类④+旧授权按状态分派收口(decided 保持 tombstone);B5 tasks 增 waitingBudgetWorkItemRef(#20)+workItem presentationBody per-kind 封闭 JSON+§7.6 撤销句 per-kind 注(#21);C2 receipt 全集绑定(targets 长度+逐 ordinal canonicalPath 全等,否则恒 unknown)+CHECK 双向+row/body 一致+digest 重算义务。
- **v0.11.4(2026-07-16 会话 7;Codex 轮 45 差分(FIXED:A4/D1/#16/P2×5;P0×1+P1×9)全量修入,待轮 46 复核)**:**P0(A5)**:not_protected 重放加 policy fence——重放按决策类分派:deny/note 原样重放;recorded_not_protected 仅当当前 {policyEpoch, protectedManifestDigest} 与记录一致才重放,任一推进 → fail-closed deny+stale_not_protected 审计(陈旧「未保护」不得跨代充当放行)。A3 failed 封套消歧(is_error_result 统一 JSON 封套+schema_violation 封闭 violationCode/pointer);A6 幂等键三物理列复合 UNIQUE;B1 非根 context originKind 恒 parent 派生(双向闭合,user→user 假 child 不可构造);B3 分类④事务补 revalidation child context(快照当前 revision/policy/manifest,无 supersede 环)+旧授权同事务收口(permit revoke/challenge cancel/workItem cancelled);B5 budget 工单 get-or-create+grant 全量唤醒+撤销规则按 kind 拆分(effect=随 Task/manual=terminal 后保留/budget=root 级);B6 holder get exact scope join({ref, role, scopeRef=workItemRef, taskId} 全等);C2 聚合不变量(applied⇔∀applied;not_applied⇔∀not_applied;余=unknown)+reducer 写集补 receiptBody/settledAt+exact-shape CHECK;C4 #19 SSOT 三处同步(§5.4 表/§12.7 分派句)+完整 guard 八合取(phase 精确/exact fence/聚合 not_applied/无其它未收 attempt/stop proof/frozen retryClass/!cancel∧intent NULL/revision·deadline CAS)。P2:lease exact-shape CHECK+摘要/receiptBody 改名/#18 补记(PK 扩/哨兵/CHECK)/「每次 deny/note/not_protected 一行」。
- **v0.11.3(2026-07-16 会话 7;Codex 轮 44 差分(FIXED:B4/C5+P2×2;PARTIAL 11)全量修入,待轮 45 复核)**:A3 failed 类 envelope canonical 三支(isError result/jsonrpc_error/schema_violation 封闭构造);A4 §11 增列摘要同步(completionExpectedStateRevision+全局唯一含终局);A5 not_protected 矛盾句消除(命中/未命中均落行)+关联 Task 分支改 rule 1/2 first-match(policy_control→open_admin_settings 恒拒);A6 记录 decision 三值枚举同步+not_protected 亦须 operationDigest(conflict 判据可执行);B1 subagentInvocationId ⇒ effectiveOrigin 恒 agent_rpc(洗白面消灭)+UNIQUE(task, dispatch, attempt, invocation);B3 effectSemanticDigest 增 effectContextId/effectiveOrigin 维+唯一键 context 入键+supersededByIntentId 原子 successor 链;B5 budget/verification 工单铸造事务归属封闭(T9b/enterTerminal 同事务)+摘要部分唯一同步;B6 artifact_references PK 扩 scope(哨兵 '')+§7.5 实体定义实际增列+tagged CHECK;C2 receiptBody 本体持久(digest 不可逆)+targetDisposition 三值;C4 状态机补 executing_ref→settled+running×unknown→T24+cancelling 措辞(settlement≠stop 证据)+**T24 出口增 T18(not_applied 且 T18 guard 全过——受审 additive §10.14#19,architecture「仅 unknown 不自动重试」逐字)**;D1 §12.8 逐条目标签(rule 4/5 allow 链=G5-GATED)+§12.9 伪标签除;P2:4063 摘要/lease 三列/分类④引用/effect_intents 摘要/receiptRef 定义。
- **v0.11.2(2026-07-16 会话 7;Codex 轮 43 差分(FIXED 6/PARTIAL 12/NOT-FIXED 1;原 P2×5 全 FIXED)全量修入,待轮 44 复核)**:A3 revision 锚改 completionExpectedStateRevision(首次结单尝试前 write-once——T7 推进不再恒 stale)+envelope 映射全 block 型覆盖(非 text/structuredContent→JCS+application/json);A4 (adapterInstanceId, rpcRequestId) 改全局唯一含终局行(rpcRequestId 生命周期内不复用,迟到响应按 late_result 路由,ABA 面零);A5 Phase 1B Task 语义对齐 rule 2(能唯一关联 active Task→同事务 T13 denied+nextAction+interrupt outbox;无关联→仅记录)+幂等锚复合键(principal+rs_+hostEventId)+not_protected 落轻量记录+§7.1 carve-out 显式;A6 tagged CHECK+rawInputDigest=wire lexical bytes;B1 parent 链同 attempt 全等+originLineageDigest 继承+subagent 必有父;B3 effectSemanticDigest(新 domain)判同+终态 replay tombstone 分派;B4 allow 事务十腿封闭(补 token tombstone/lease released/decision receipt/resume outbox,deny 对称);B5 work_items 列级补全(expiresAt/presentationDigest/canonicalContentRef/claim 三列/decisionDigest/receiptRef)+(kind, sourceRef) 改 active 部分唯一+appr_ 共享前缀声明;B6 canonicalContentRef 持久于 workItem+artifact_references 增 presentationScopeRef;C2 first-match 顺序修正(known-stale 先于 expired)+EffectReceipt shape 封闭;C4 EffectIntent 增 settled 终态+reducer Task 衔接按 phase 分派(删 T22 误称);C5 运行期 rule 1/2 同事务写集封闭+rule 5 两步纪律显式;D1 §12.3-12.7 标题 blanket 撤除、逐条目标签化(schema=NORMATIVE/放行链=G5-GATED)。additive 实际落地:§6.1 dispatch_attempts(#16)/approval_records(#17)/§7.5+§7.1(#18);P2:L1799 注释/EffectReceipt 摘要同步。
- **v0.11.1(2026-07-16 会话 7;Codex 轮 42 REJECT(P0=0,P1×19+P2×5)全量修入,待轮 43 差分复核)**:路 A——A1 handle 构造时点=T7 CAS 后(与 T4 行「非事务产物」相容注);A2 holder fence SSOT=lease⋈dispatch_attempts 同事务 join+executorInstanceId≡workerId;A3 completionRequestId(cmpl_,首调前确定性铸+持久)+dispatchedStateRevision 稳定锚(digest 输入)+providerResult→envelope canonical 映射封闭;A4 响应查找键=(adapterInstanceId, rpcRequestId) live 部分唯一(correlationKey 降完整性锚);A5 pep.check wire 协议(hook 通道方法/commit-before-response/同 hostEventId 重放返原/异 payload deny+conflict 审计/Phase 1B 不触 Task 转移);A6 approval_records 补 protectedManifestDigest+hmacKeyId/hmacVerified+ApprovalRecordDigest hash-input 封闭。路 B——B1 EffectContext 总函数化(effectiveOrigin 物化列 insert 派生/根 context 部分唯一/child 同 task+深度 ≤16/下游 originKind 取值=effectiveOrigin);B2 operationHash 内联 canonicalArgs+workspaceFingerprint 本体(上位字节忠实,digest 列降审计);B3 effect_intents live 部分唯一四元+4063 conflict;B4 三事务双记腿显式(challenge=intent CAS+workItem+presentation artifact 七腿/allow=HGA+permit+intent+workItem+challenge+T22 六腿/consume=intent executing_ref);B5 approval_work_items 表(appr_ 统一领取面 owner,challenge.status 删 presented);B6 presentation 全量(canonicalArgs+targets 全字段+diffRef+workspaceFingerprint 三字段)。路 C/D——C1 permit.expectedStateRevision 持久列(=allow 事务 T22 后新值);C2 五分类改 first-match 顺序(重放→expired→stale→漂移→其余)+EffectReceipt domain+receiptDigest 列;C3「executing EffectAttempt」词汇接线={intent_committed, executing}(保守扩大,风险集只增);C4 settleEffectAttempt 单一原子 reducer(五对象成组收口,分体提交禁止);C5 rule 1/2 运行期改 T13 broker 派生 denied(T21 仅 pre-dispatch;不扩边);C6 清单补 PEP/mediator/classifier/authorizer executable+enrollment registry+manifest 类+break-glass;D1 章标签逐条目化(表=NORMATIVE/放行链=G5-GATED/deny 侧=Phase 1B 即生效)。P2:effect_contexts 根 context 部分唯一/approvalRevision 推进规则/correlationKey=UPDATE CAS/状态行版本/§16.2 标题范围。
- **v0.11(2026-07-16 会话 7;Chunk 5 初稿——§11+§12 新增,待 Codex 红队 r42 起)**:新增 §11 push-completion wire+deny-only 审批记录(§11.1 PushCompletionHandle 进程内 holder auth=同一 core completion handler+holderTuple 全量相等/§11.2 correlationKey 生成(AB-CANON-1 PushCorrelation domain)·send 前持久·同 adapter 实例唯一·无法唯一关联→reconciling/§11.3 deny-only 面(PEP stub 恒 deny 无放行分支+approval_records 写入接线(idempotencyKey=hostEventId)+approve.sh 迁移期 recorded_note 义务+G-5 后由 §12 取代)/§11.4 legacy 完成映射 wire 外形(T23 接线))。新增 §12 人闸/effect wire [G5-GATED](§12.1 门禁=G-5 SSOT/§12.2 EffectContext 存储+污点派生不存列/§12.3 EffectIntent+operationHash 字节级 hash-input(Effect/v1 reserved 解除)+TargetRef 子构造+状态机封闭/§12.4 ApprovalChallenge 铸造原子事务+PresentationLease+presentation 内容 schema(呈现即所批)/§12.5 HumanGestureAttestation 签名域(HumanGestureClaim hash-input)/§12.6 EffectPermit 消费 CAS+fence 五分类总出口/§12.7 EffectAttempt/WorkspaceEffectLease/EffectMediator 接口契约+unmediable_effect/§12.8 决策表 rule 0-7→转移表投影+protectedStateRevision 推进封闭枚举/§12.9 policy_control 精确路径清单/§12.10 表清单)。§1.3 增八 ID 前缀;§16.2 增 4060-4062;§16.3 增 PushCorrelation/ApprovalRecordDigest/Effect(解 reserved)/EffectArgs/ApprovalPresentation/HumanGesture 六 domain。
- **v0.10.10(2026-07-16 会话 7;Codex 轮 40 差分(FIXED:P1-1/3/4+P2×2;§10.14 全 15 组 CONFIRMED;唯一剩余 P1)修入,待轮 41 终签)**:stop-confirmed 判据收口=「任何被 releasePoisonedSlot(§6.1)接受的 exact-fence stop 证据」——含 terminal 后到达的同 fence 迟到 complete(§5.3「仅记 evidence 不触发转移」限定 Task phase/outcome,不限定维护性清理;§6.1 slots 行本就允许其释放 poisoned slot——三 SSOT 冲突消除);lastProbeDispatchId 清除 CAS 形状显式(条件 UPDATE circuitId+dispatchId 双匹配;与 releasePoisonedSlot 同一证据摄取事务);「迟到证据不追改 circuit」精确范围=不改 providerOutcome/state/counters/cooldown,允许清同 dispatch 维护性 lastProbeDispatchId(防 bucket 永久自环)。可选 P2:§5.6 open 自环 CAS 三元显式。
- **v0.10.9(2026-07-16 会话 7;Codex 轮 39 差分(FIXED:P1-a+SSOT;#14/#15 CONFIRMED;剩 P1×4+P2×2)全量修入,待轮 40 复核)**:①open 到期路径三分(§5.6 provider_wait guard:now<cooldown→重排;到期∧旧 probe 证停→ready;到期∧未证停→circuit open 自环 CAS 写新 cooldown+重排至新时点——不写回过去时点无热循环);②stop-confirmed 判据机器化(=§5 同款证据:conclusive 结单/T6b never-activated/exact-fence interrupt·drain ACK/迟到 complete 正支/waitpid exit-observed;**terminal 而 slot poisoned_unresolved 未释放 ≠ 已停**——新 probe 占用 guard 与 open→ready 分支同用);③transitionCircuitToOpen 的 lastProbeDispatchId=COALESCE(probeDispatchId, lastProbeDispatchId)(二次 open 不得 NULL 擦除未决保护 ref;清除仅经 stop-confirmed CAS);④bucket identity/lifetime(三元不可变、凭据轮换=新建 pc_ 行、providerCircuitRef FK+被未终局 dispatch 引用禁删、行常驻)。P2:主 CHECK 补 half_open ⇒ cooldownUntilAt NULL(三态互斥全写);§10.13 摘要同步(lastProbeDispatchId+三态 CHECK+禁删)。
- **v0.10.8(2026-07-16 会话 7;Codex 轮 38 差分(FIXED:P1-1/3/4+P2×3;#10/#12/#13 CONFIRMED;剩 circuit 生命周期 P1×4+P2×2)全量修入,待轮 39 复核)**:①open→half_open CAS 写集补全(显式 cooldownUntilAt=NULL+version+1+lastTransitionAt——不再被 exact-shape CHECK 拒);②两 timer 原子排序=§5.6 queued defer 行增 provider_wait 专属 guard(reactivation 先同事务 reconcile circuit:closed→ready/open→重排 cooldown/half_open 过期→先 probe 收口再按新 cooldown 重排/未过→重排 probeDeadlineAt——任务不带过期 probe 时钟变 ready;§10.14#15)+probe 终局 CAS 不设 deadline fence(先到先赢,与 janitor 互斥于同一三元);③probe timeout 收口旧 provider call(收口=transitionCircuitToOpen(probe_timeout)+probe 移 lastProbeDispatchId+同事务 interrupt/drain outbox;新 probe 占用 guard=lastProbeDispatchId 空或其 dispatch 已终局——独占性覆盖执行重叠);④分桶 owner 冻结(model≡requestModel,dispatch 时定;dispatch_attempts 增列 providerCircuitRef(§10.14#14),书挡③/probe/恢复只按 ref 更新不重解析)。P2:ProviderCircuit exact-shape CHECK(三态互斥写全)+transitionCircuitToOpen(reason, now) 单一 reducer(三入口共用;budget_overrun 行改引)。
- **v0.10.7(2026-07-16 会话 7;Codex 轮 37 差分(FIXED:B2-b/B5-a/closed 计数/resetAt;#9 CONFIRMED;剩 P1×4+P2×4)全量修入,待轮 38 复核)**:P1——§10.5 circuit 出口残留「恒 T4c」改 T4d+circuit 失败=书挡② 整事务回滚(T4d 行 trigger 同步注明替代写集纪律);probe 卡死收口=§5.6 增 timer 行(probeDeadlineAt 到期 fenced CAS 回 open+新 cooldown+清 probe,stale timer no-op;§10.14#12);probe 提前成功唤醒=half_open→closed 转移事务把同桶 provider_wait 任务(tasks.waitingCircuitRef 索引,T4d 写入/离态清;§6.1 增列,§10.14#13)nextEligibleAt 置 now+queueReason→ready;settlement 侧 state fence(closed=全计数/half_open=仅 probeDispatchId+version CAS 全中/open=仅审计——旧 attempt 迟到不覆盖 probe 状态)。P2——T4c 括注 >→≥;§5.1 phase-preserving 清单补 T4d;§10.13 provider_circuits 摘要补 probeDeadlineAt+state CHECK;#11 改写(provider_wait=broker 内部调度状态,不经 TaskSnapshot 投影,caller 可见需另审)。
- **v0.10.6(2026-07-16 会话 7;Codex 轮 36 差分(FIXED:B2-a+P2×2;裁决:两处 T4c 复用=扩张封版触发域,须走受审 additive;剩 P1×4+P2×2)全量修入,待轮 37 复核)**:B2-b 载体改封版 T4c guard 增补(触发域扩至 reset ≥ deadline,副作用不变,重排后 deadline fence 收口——§10.14#9);B5-b 新增 T4d 边(provider circuit 专属 phase-preserving 重排,queueReason=provider_wait(T2 枚举同步增补)——不复用 budget_wait、禁 T9b/T21;§10.14#10)+half_open 输家热循环修复(ProviderCircuit 增 probeDeadlineAt 列,输家 nextEligibleAt=该未来时点);B5-a 线性化点持久化(providerOutcome=终局事务内一次性判定,write-once 落 execution_provenance.providerOutcome 列与 circuit 推进同事务;commit 后恒不改判,迟到证据仅审计;commit 前 crash=首判非改判);P2×2:closed 计数摘要同步 union 逐支(与 half_open 同一 reducer);resetAt 确定性推导函数(windowKey 小时桶→下一 UTC 整点)。§10.4 defer 条改引 T4c 增补载体(不再称口径澄清)。
- **v0.10.5(2026-07-16 会话 7;Codex 轮 35 差分(FIXED:A4-1/A4-2/C5/C8/P2×3;§10.14 八组 additive 全 CONFIRMED;剩 B 路 P1×4+P2×3)全量修入,待轮 36 复核)**:B2-a pause 可 override 判定改「grant 可精确 CAS 的账户」谓词(非 {scopeKind=root, windowKey=""} 或 dimension ∉ 正列 → fail——principal/installation/task 级或有窗账户耗尽不产生解不了的等待;grant CAS 对象声明补 windowKey="",多 window 歧义消除);B2-b defer×deadline 出口封闭(重排恒可写 nextEligibleAt=max(resetAt);≥deadline 时由 deadline fence 到点收口 expired,不改判 fail 不伪报 quota_exhausted;T4c「reset<deadline」接线口径=reset 有限即可,记录复核);B5-a providerOutcome 因果时序(完整合法 result=成功线性化点,其后断流仅审计;broker 本地 stop 诱发的断流归 no_provider_evidence;冲突优先级限定于 result 形成前且非本地诱发)+consecutiveFailures 逐支规则(success→0/failure+violation→+1/no_evidence→不变);B5-b circuit open 专属出口=恒 T4c 重排(deferCause=provider_circuit_open;禁 T9b(grant 关不了 circuit)/禁 T21(不伪报 quota_exhausted);cooldown≥deadline 同重排由 fence 收口)。P2×3:§10.13 host_turn_boundaries CHECK 补全(epochValue NOT NULL ∧ ≥1+禁 GC 注)/书挡① 第 3 步与书挡② 改引 effectiveExhaustionPolicy 函数名(不再 raw onBudgetExhausted)/closed 计数逐支并入 union 处。
- **v0.10.4(2026-07-16 会话 7;Codex 轮 34 差分(FIXED:C4+P2×2;剩 P1×6+P2×4)全量修入,待轮 35 复核)**:A4-1 epoch 映射生命周期封闭(host_turn_boundaries 行保留至 rs_ OFFLINE tombstone 禁 GC——行常驻即单调 high-water,无 MAX 复用/重送重铸面)+A4-2 producer 单支固定(同 rs_ 的 turn 边界 producer 由 adapter profile 于 P0A-9 冻结二选一并绑 policyEpoch,另一支证据仅审计)+CHECK 补 epochValue NOT NULL ∧ ≥1;B2 effectiveExhaustionPolicy 改全函数(入参=exhaustedAccountRefs[] 非 dim 标量;per-account 判定+pause_for_human 对不可 override 维度(∉ grant 正列)归 fail——不得 T9b 永久等待;聚合:fail>pause>defer,defer 的 nextEligibleAt=各 reset 最大值);B5 providerOutcome 封闭四支 tagged union(success/provider_failure/protocol_violation(HTTP 200 malformed/确定 schema violation,architecture §6.4)/no_evidence)+冲突证据优先级(failure>violation>success>no_evidence)+closed 态计数同 union;C5 两 reducer 集合分立(enterTerminal=normal ∪ transferred;settleAttemptForRetry=仅当前 attempt normal 行——T18 不提前 release/settle Task obligation;§10.4 precedence=SSOT);C8 fallbackIndex ≡ entries.ordinal(allowlist 全表序锚定,caller 子集/skip 不重新编号,routeKey 不可借子集改写)。P2×4:BudgetReservation 主实体补 transferredToTaskId 列;§10.13 entries 摘要补 UNIQUE;spawn 失败腿/超时腿 outbox → abandoned+清 deadline;host_turn_boundaries CHECK 补全。
- **v0.10.3(2026-07-16 会话 7;Codex 轮 33 差分(FIXED:A2/B1/B3/C3/C6+P2×5;剩 P1×6+新 P2×2)全量修入,待轮 34 复核)**:A4 epoch exactly-once 机器化——get-or-increment 单事务封闭(查 eventRef→MAX(epochValue)+1→写映射;epochValue 持久列+双唯一键 UNIQUE(rs_, kind, eventRef)/UNIQUE(rs_, kind, epochValue)+CHECK prompt_epoch ⇒ eventRef NOT NULL;P0A-9 增 eventRef 稳定性/唯一域验证,不满足恒 fail-closed);B2 effectiveExhaustionPolicy 规范纯函数(dim 无 reset ∧ defer → fail,否则原值;scalar 保留,混合维度 rate exhaustion 仍走 T4c;封版 T21「policy=fail」语义接线为该函数值——纯定义接线零封版改动);B5 providerSuccess 改协议层证据(与 usageQuality 正交;业务 failed 但协议正常=providerSuccess;upper_bound 结算的真实成功不再被误 open);C4 PAI 增 terminalTypedCode 列(state ∈ {failed, expired} ⇔ NOT NULL;tombstone 瘦身保留集含该列;表行「retention 期内」措辞改「tombstone 常驻」);C5 恢复补跑 ownership precedence 重写(①transferredToTaskId 非空→Task 组仅 enterTerminal 收口 ②activationRef→activation 组 ③{taskId, dispatchId} 组;本条=SSOT);C8 entry eligibility guard 收紧(profileId 全等+workspace 兼容({"", 当前 workspace})+跳过并审计)+principal 维度如实声明(v1=installation 级资产,multi-principal 属 Phase 5 修订);新 P2×2:事务 B 收口 spawn outbox(sent→acked+清 deadline);entries 增 UNIQUE(allowlistId, dedicatedBindingRef)。
- **v0.10.2(2026-07-16 会话 7;Codex 轮 32 差分(零新 P0;FIXED 12/PARTIAL 11/NOT-FIXED 0)的 P1×11+P2×5 全量修入,待轮 33 复核)**:A2 canonicalTarget direct 支改 caller selector 原值二分(direct_endpoint{endpointId}/direct_session{runtimeSessionRecordId}——不用运行期 resolved rs_,同 selector 恒同 key);A4 broker epoch 增 first-party 事件幂等锚(host_turn_boundaries UNIQUE(rs_, kind, eventRef),重送返原 epoch);B1 书挡② root 重验对象改当前 BudgetAccount.hardLimit/version(grant 叠加现值,benv_.rootCaps 仅基线);B2 「defer_until_reset+无窗 hard cap」在 EffectiveBudgetSnapshot 派生时归一化为 fail(封版 T21 字面恒可命中,零封版改动);B3 UsageEvent tagged-shape CHECK(两支幂等键列恒非空,NULL 不可旁路);B5 probe 收口三支封闭(provider_success→closed/providerFailure→open/无 provider 证据终局→open,消除两句冲突);C3 RECONCILE_TASK→READY_IDLE 同 guard;C4 PAI 终局行瘦身为 idempotency tombstone 常驻(§2.5.1 同型,GC 不重开 spawn 路径);C5 transfer 后收口划界(activation reducer 排除已 transfer 行/书挡③ 集合含 transferredToTaskId=本 taskId);C6 spawn_intent 增持久列 sentAt/spawnAckDeadlineAt(outbox kind 专属列先例;§6.1 行同步=additive 第 8 组)+sent∧null 超时分支改「先 process-group 清理取证再 REAPED」;C8 caller fallbackChain=active allowlist 保序子集(否则 4058)+entries 写入/解析双验 {installationId, targetClass} 相等。P2:§10.12 hop 备注改「恒 depth」;v0.10.1 修订条 B6 误述更正;§16.3 UsageEvent 行消歧;头部状态行版本同步;pendingActivations 改 architecture §11 逐字(spawn 前段义务由 leasedAdapters/outbox 覆盖)。轮 32 另确认:C9 撤回(BUSY|RECONCILE_TASK→DRAINING 引据成立);A1/A3/B4/B6/B7/C1/C2/C7 核心/D5/D6/#7 FIXED;T18 不撞 UsageEvent 键(每 attempt 新 dispatchId);GV 锚不变。
- **v0.10.1(2026-07-16 会话 7;Codex 轮 31 REJECT(P0×7+P1 批+P2×2)全量修入,待轮 32 差分复核)**:路 A——A1 depth 赋值改 parentKind=root_admission→**1**(RootAdmissionContext=树根 depth 0 非 Task,siblings 不冒充 root;恒等式改 hop≡depth);A2 routeKey 的 canonicalTarget 升维=canonicalTargetPolicy 同源 tagged union(dedicated{dbind+epoch}/direct{endpoint,rs_}/fallback{dbind+epoch+index}),bindingEpoch 重置 branch 计数残余如实声明;A3 root 继承强制(child.rootAdmissionId 恒取 parent lineage 行+continuation 消费一致性重验);A4 HostTurnKey prompt_epoch 支改 broker 单调 epoch(自报值不入键)。路 B——B1 书挡② 增 root 聚合复验(accept→dispatch 空窗封闭);B2 reserve 失败=整事务回滚(attempt 不耗/queue hold 保留)+三出口=替代写集+「commit 才算消耗」+无窗 hard cap 的 defer 等效 fail;B3 幂等锚重做(UsageEvent 改 (dispatchId, settlementKind)+(activationRef, kind, consumerRef) 部分唯一,usageDigest 降级完整性;BudgetOperation 增 bookend=approval+challengeRef;恢复补跑成组经书挡③ reducer);B4 override 正列删 wall_clock_ms(architecture 逐字);B5 ProviderCircuit 补 probeDispatchId 独占探针 CAS+orphan probe 收口+providerFailure 判定封闭+成功清零+两参数入 §10.12;B6 tat null 视作 transactionNow;τ=300_000=I(burst=floor(τ/I)+1=2;轮 32 P2:本条原「null=now+tolerance」为误述,规范正文 §10.4/§10.5 为准);B7 concurrency 不建账本行(强制=slots 表)+taskAllocation 三默认值补全+budgetSnapshotRef=benv_ 定义。路 C——C1 PAI 增 lineage carrier 四列(preaccept 持久,accept 原样转入不重解析);C2 结算幂等键改 {activationId, consumerRef, direction} 部分唯一(acquire/release 对消,settlementKind 降审计);C3 BUSY→READY_IDLE guard(task terminal+无未决 MCP/elicitation/write queue,§9.2 逐字);C4 PAI idempotencyScopeDigest 全局唯一(含终态;failed/expired replay 原 typed error 不新 spawn);C5 obligation transfer 经 transferredToTaskId 独立列(创建时字段与 digest 不可变);C6 spawn sent 线性化点=fork 前 CAS+恢复四格封闭+spawnAckTimeoutMs+rs_ 创建移事务 B;C7 ActivationAttempt 状态机封闭表+终结转移(pendingActivations 可归零);C8 dbind 唯一键 '' 哨兵化+fallback_allowlists/entries 两表正规化;C9 BUSY|RECONCILE_TASK→DRAINING 保留但改「仅 stuck-BUSY 收割路径」+引据 §9.2 收割段(提请轮 32 复判)。路 D——D5 provenance 落地 §7.2 TaskSnapshot;D6 retryClassBasis/effectiveBudgetSnapshotRef 落地 §6.1 tasks 行;§10.14 #5/#6/#7 同步。§10.12/§10.13 全表同步。
- **v0.10(2026-07-16 会话 7;Chunk 4 初稿——§10 全章新增;轮 31 REJECT,由 v0.10.1 收口)**:新增 §10 预算/lineage/生命周期实体(§0-A.10 全量+carry-in provenance hash)——§10.1 RootAdmissionContext(rootKeyKind 二值/HostSessionKey=rs_ 引用 §4.10/HostTurnKey E2E-GATED→P0A-9/get-or-create 唯一锚/bridge-derived 永不铸新 root);§10.2 TaskLineage(parent 解析封闭三分/sibling 共同父=root_admission/depth=0 起 hop=1 起 retry 不增/routeKey 三元 AB-CANON-1/三闸→4042/hop≡depth+1 恒等式如实声明);§10.3 continuation capability(cn1.;schema+校验 NORMATIVE、v1 铸造入口 UNSUPPORTED=异步 bridge-derived 恢复恒 4059 保守侧);§10.4 预算实体(EffectiveBudgetSnapshot 独立表/BudgetAccount 四元唯一键+windowKey '' 哨兵+version=§7.6 budgetRevision/dimension 13 值封闭枚举分 hold·累计·GCRA 三型/BudgetReservation operationDigest 幂等锚/UsageEvent usageDigest 幂等结算锚/BudgetOverrideGrant 可 override 维度封闭正列/ProviderCircuit 三态+分桶);§10.5 书挡①②③列级接线+GCRA/TAT(wake 与 outbox 同事务)+approval_prompt 双层小时窗(尽→rule 2 denied);§10.6 FanoutAllocation(schema 先行,v1 无 batch wire=铸造 UNSUPPORTED);§10.7 activation(ActivationGrant=policy_control/ActivationAttempt coalescing 部分唯一/PreAcceptSubmitIntent pending 部分唯一/三处重验/obligation transfer 原子腿/activation_settlements 幂等结算表/refcount=0 才 reap);§10.8 WorkerProcess(spawn 两阶段事务 A/B+launchNonce 封口+崩溃窗对账/状态机封闭 REAPED 唯一入口=exit-observed 或 spawn_failed/supervisor 定时器域表);§10.9 DedicatedBinding(dbind_;与 WorkspaceBinding bind_ 消歧/唯一 pin 判定基/bindingEpoch fence);§10.10 ExecutionProvenance(broker-owned 独立表/伪独立共识降权/TaskSnapshot.result.provenance additive);§10.11 retryClassBasis storage owner=tasks effective 列族;§10.12 发布默认数值总表;§10.13 表清单+事务边界增补+migration 冻结前置解除;§10.14 封版章 additive 接线记录。封版章 additive 落地:§1.3 十个 ID 前缀/§3.2 continuation 行(§10.3+cn1.)/§16.2 标题范围+4059/§16.3 八 domain/§6.4 交叉引用/§5.6 worker 行交叉引用。
- **v0.9.10(2026-07-15 会话 6;Codex 轮 27 唯一 blocker 修入;轮 28 语义全过(附 DDL kind/state NOT NULL 补注)→轮 29 全路 APPROVE,Chunk 3 封版)**:CHECK 限域 resume_intent(`kind<>'resume_intent' OR state<>'acked' OR ackedAt IS NOT NULL`)——修轮 26 补丁误伤 dispatch_intent→acked(T7 合法路径)的表级约束。轮 27 已确认:T13/T23 收口本体/迟到 ACK 重放/三处元数据全 FIXED。**封版后追记(轮 30 交接审计;元数据/交叉引用+一处 additive producer 澄清,零行为语义变化)**:头部状态行同步封版叙述;§3.2 三个 token 行「§7(占位)」→实际节号(§7.3/§7.4);§6.4「wire 报文等 §7」→已交付;两处「提请复核」→轮 25 已 CONFIRMED;§7.4 begin 补 applyingAt=transactionNow producer(列已在 §6.1,补写入点)。
- **v0.9.9(2026-07-15 会话 6;Codex 轮 26 唯一残余修入;轮 27 复核=本体 FIXED,CHECK 限域由 v0.9.10 收口)**:T13/T23 隐式 applying→acked 收口补齐字段写集(ackedAt=transactionNow+清 applyDeadlineAt——与显式 ACK/T9a-T10 统一;CHECK state=acked ⇒ ackedAt 非空);头部状态行 additive 增补措辞与轮 25 全 CONFIRMED 同步(P2)。轮 26 已确认:ACK 重放 authority 拆行/T9a-T10 字段集/slots 记法/§4.4 交叉引用四处 FIXED。
- **v0.9.8(2026-07-15 会话 6;Codex 轮 25 窄 REJECT(唯一 blocker)修入;轮 26 复核=四处全 FIXED,唯一残余=T13/T23 ackedAt,由 v0.9.9 收口)**:①§7.1 矩阵 resume 行拆两行——fetch/begin/首次 ACK 保留「当前 executor+active lease」前缀;**acked 重放独立行=仅 authenticated caller+持久 owner tuple/receipt,不要求 current lease/phase**(消除与 §7.4 的唯一性冲突;终态后迟到重放得原响应);②P2 批:隐式 progress 收口(T9a/T10)明确同事务写 ackedAt+清 deadline(与显式 ACK 同字段集);§7.3 slots 记法改「PK=(rs_, generation);state ∈ {…}」;§4.4 scheduler eligibility 行补 session-poison guard 交叉引用(additive)。轮 25 已确认:session-poison 组全 FIXED(滚代/历史证据/D2 反例全阻断)+**全部封版章 additive 增补 CONFIRMED**(§1.3/§2.6/§3.2/§5.1/§5.2/§5.4/§5.6/§6.1 全列)。
- **v0.9.7(2026-07-15 会话 6;Codex 轮 24 窄 REJECT 修入;轮 25 复核=applying 组核心+session-poison 全 FIXED,唯一剩余=矩阵行冲突,由 v0.9.8 收口)**:①**applyDeadline 卫生**——公式锁定 `min(now+resumeApplyTimeoutMs [default 60s,有界正数], resolvedDeadlineAt, lease.expiresAt)`(begin 响应回显;不随 renew 延期);ACK/progress 收口/T13-T23 收口/abandon 均清 deadline;§5.6 timer CAS 重验 {state=applying, deadline=扫描值, exact tuple}(stale timer=no-op,防误撤健康 attempt);②**T18 判据回归原 guard**(证停+无 effect+retryClass;删「输入证实未注入」不可判定判据;attempt-scoped 输入随旧 attempt abandoned,重试后 caller 重供);beginStop 遇 applying=abandoned+随既有 T16/T17 边,非独立 trigger(§5.4 措辞收口);③**ACK 重放独立 guard**(仅验 authenticated caller+持久 owner tuple/receipt,不要求 current lease/phase——修与矩阵公共前缀的冲突);④**session-poison 三处同步**——T3/T4 guard 明文「当前 gen 无 held 且同 rs_ 任意 gen 无 poisoned」;§7.3 释放闭集补 releasePoisonedSlot+session 级描述;⑤「host-session-ended」证据 v1 删除(无可信 producer;引入=修订+schema 先行);CC-19d 增 d7(D2 变体)。
- **v0.9.6(2026-07-15 会话 6;Codex 轮 23 REJECT 修入;轮 24 复核=再挂起分状态/4050 四分支/fail-closed 枚举/BudgetAccount.version/poison 核心规则 FIXED,余由 v0.9.7 收口)**:①**applying 恢复路径可实现化**——outbox(resume_intent)增 applyingAt/applyDeadlineAt/ackedAt 列;§5.6 增 applyDeadline 定时器行;超时走 **T17 扩展 trigger + reconciliationReason=`resume_apply_uncertain`**(§5.4 注册;不冒用 T24——其 guard 限 EffectAttempt);三方法 guard 拆分(fetch=sent;begin=sent→applying;首 ACK=applying→acked;**ACK 重放按持久 tuple 解析 acked,不要求 live**);push 面必须调用同一 begin/ack core(进程内≠豁免);②**再挂起收口分状态**——applying→acked(progress 证据);pending/sent→abandoned+审计(未 begin 的输入不得冒认已消费);同 attempt T13/T23 结单=progress 证据原子收口 applying;enterTerminal 时存在 applying=不变量缺陷(审计+abandoned,不触发新转移——修 terminal 后无边可走的矛盾);③**poison 谓词 outcome 无关化**——`terminal 时执行风险未证停 → poisoned`(覆盖 T20 全 outcome:unknown/expired/cancelled+D2);**session 级隔离**:T3/T4 检查同 rs_ 任意 generation 的 poison(generation roll≠stop 证据,滚代不解锁;新 hostNativeSessionId=新 rs_ 新槽,liveness 如实声明);**释放唯一入口=releasePoisonedSlot(slot, evidenceRef) CAS reducer**:evidence exact-fence 匹配 {rs_, gen, taskId, dispatchId, leaseId},合法证据封闭集(同 fence 迟到 complete/同 target drain ack/精确 {pidStartTime, launchNonce} waitpid/verified host-session-ended);disconnect/expiry/泛化 executor_lost/历史证据/滚代均不释放;§5.6 增补扫行;CC-19d 扩为 d1-d6 变体族;④4050 行改锚定重放四分支(submission 异 digest 仍 4050——修 blanket 排除矛盾);⑤§1.3/§7.1 fail-closed 方法枚举补 resume 三方法;grant 事务同步推进 BudgetAccount.version(P2)。
- **v0.9.5(2026-07-15 会话 6;Codex 轮 22 REJECT 修入;轮 23 复核=双注入阻断/I1I2 阻断/budgetRevision FIXED/wire-only FIXED/同代 unknown 阻断,余由 v0.9.6 收口)**:①**apply 崩溃窗封闭**——resume_intent 状态扩展 sent→applying→acked(该 kind 专属;新增 `task.begin_apply_submission`:apply 前 CAS sent→applying+tuple 重验;`ack_submission` 接受 {applying, acked},acked 重放返回稳定响应=真幂等;**crash-in-applying 禁盲目重送**——`codex-reply` 无 submission 幂等键,janitor 按 applyDeadline 送 effect-uncertain 型对账);②**live intent 唯一约束**——同 (taskId, dispatchId) 至多一条 live(pending/sent/applying)部分唯一+T9a/T10 再挂起事务原子收口既有 live intent(置 acked,progress 证据:单 in-flight executor 到达下一挂起=上一输入已消费);③**budgetRevision fence 可实现化**——presentation/actionToken 元组/§3.2 行均补 budgetRevision(=铸造时 BudgetAccount.version),CAS 比较对象明确;④**T20 poisoned slot**——runtime_execution_slots 增 state{held, poisoned_unresolved}:T20 terminal unknown 且未证停→poisoned 不释放(terminal unknown≠证停;后到证停证据/waitpid→janitor 释放;retireGeneration=新代新槽,与 §4.4 跨代 eligibility 并存不冲突;同代 liveness=宿主滚代换槽,如实声明);新增 CC-19d(T17→T20 后同 rs_ claim 仍 4013);⑤**wire-only 封闭集**={claim_ack, begin_apply_submission, fetch_submission, ack_submission}(§7.1 通则+§7.9 矩阵同步;四方法入未知字段 fail-closed 集);⑥4050 行排除「consumed 且有 decided/submission 锚」(重放规则先行)。
- **v0.9.4(2026-07-15 会话 6;Codex 轮 21 窄 REJECT 修入;轮 22 复核=B-fetch-A 阻断/binding 前置/dispatch_intent 零改变/DSL/4046/manifest/cursor 全 FIXED,余由 v0.9.5 收口)**:①**fetch 绑 live intent(跨 attempt 旧输入注入收口)**——`task.fetch_submission` 改按 taskId 入参+同事务 join 当前 dispatch 的唯一 live resume_intent(state=sent 且 dispatch/ownerEpoch==当前 active lease;无匹配→4053,旧 attempt submission 对新 attempt 不可达);新增 `task.ack_submission`(fetch-apply-ack 纪律;fetch 幂等只读);两方法 wire-only 不投影;重放优先级补 immutable binding 恒验前置;dispatch_intent 分支恢复完整封版条件逐字(phase+精确 tuple);②**预算并发 CAS**——(root, dimension) 至多一 active workItem;submit grant 事务内 CAS 当前 currentCap/budgetRevision/policyEpoch==token 绑定值(并发推进→工单 cancelled+4050+按新 cap 重铸);proposedNewCap>currentCap 铸造约束;deny 时 newCap 必须缺席(防 digest 分叉);③**holder replay 优先级**——decided 行先于 token 状态判定(同 digest→原 receipt/异→already_decided+winner digest;仅未知/expired/rotated/他属→4050);peek_work 请求补 cursor 入参;④**DSL**——新增 seedRetryPolicy setup(CC-19c 的 T18 可达性去环境依赖);commitOrder 语义封闭(成员全 ready 并发 start,仅 commit 按序);⑤4046 表行 revoked/consumed 分流(残留「恒 4047」清除);manifest high-water 分支封闭(version==high-water 且 active invalid→拒,恢复=升版;persist highWaterDigest)。
- **v0.9.3(2026-07-15 会话 6;Codex 轮 20 REJECT(P0×3+P1 批)修入;轮 21 复核=死路/newCap/句柄/union/get 已 FIXED,余由 v0.9.4 收口)**:①**resume_intent 发送门正交化**——outbox sender guard 按 kind 分支(dispatch_intent 保持 dispatching;resume_intent 仅 running+active lease+精确 task/dispatch/ownerEpoch;失配→abandoned 永不 retarget;targetRef=submissionRef+operationKey=`resume:<ref>`),修「封版 guard 只许 dispatching 致 resume 永不可发」死路;重放解析优先级(submissions 行先于 token 校验);正文投递分支=push 进程内直取 / pull 新增 `task.fetch_submission`(matrix 入表;executor+active lease 授权);②**budget token 保全封版 T11a**——presentation 增必填 `proposedNewCap`(broker policy 派生,铸 token 前确定),token 绑 {root, dimension, currentCap, **proposedNewCap**, policyEpoch}(old/new 齐,T11a 逐字兼容),submit 的 newCap 必须==proposedNewCap(异值 4058;不同增量=deny 后重铸工单);ApprovalDecision hash-input 封闭化(decision 统一字段+kind 封闭动词映射+全字段 null 补位);already_decided 返回 winner digest;peek_work 补 cursor/(createdAt, workItemRef) 全序升序;eligible holder 补 authorize(canPresentApproval);③**DSL 句柄输出**——seedAttemptHistory 输出 {completionTokenRef/dispatchRef/leaseRef/fenceTuple/tombstoneDisposition} 可引用句柄(CC-12 tokenA 可构造)+endState 二值;resolveStopped 携 attemptRef+evidence;faultInject 携 targetRef+at 时点;step 执行语义封闭(默认串行同步/barrier 并发 start/commitOrder 事务钩子);allowlist+pass evidence 增 schema 三元 pin;CC-19 明确对另一 Task;④tagged result union(submit/await 两支字段集互斥,消除 snapshot 必现 vs 缺席矛盾);⑤表行修:4047 行 revoked 限定(不吞 consumed)/4052 行 reserved/4051 先判;⑥杂:T3 guard「未收口 attempt」措辞/§5.3 ACK 重放 leaseExpiresAt 实时值/artifact.get schema 补 workItemRef?/manifest same-version no-op+invalid 恢复须升版/lookup 与 peek 全序游标/presentation artifact 引用铸造时点(canonicalContentRef/resultRef=artifactRef;budgetSnapshotRef 非)/头部状态行版本同步。
- **v0.9.2(2026-07-15 会话 6;Codex 轮 19 REJECT(7 blocker)修入;轮 20 复核=1/6/7 FIXED、2/4 PARTIAL、3/5 NOT-FIXED,由 v0.9.3 收口)**:①**occupancy 正交化**——rs slot 改独立 `runtime_execution_slots` 表(PK=(rs_,gen)),释放点封闭=§5.1 reducer 3/4(enterTerminal/settleAttemptForRetry),T17/beginStop revoke 不释放(修「revoked 未收口即放槽」双 in-flight 洞;§5.1 增补释放点+CC-19a/b/c);②complete 解析次序按 disposition 分支(consumed→重放/4048 不被 4047 吞);③suspension_submissions 补 resultingStateRevision/submissionReceiptDigest 列+outbox 增 resume_intent kind+SuspensionSubmission/SubmissionReceipt 两 domain;④holder:G-5 口径对齐封版 §4.8(全部 holder 方法 G-5 前 capability_disabled;budget/verification 工单 G-5 前不产生,自洽)+budget presentation 补 currentUsage/suggestedCap/policyEpoch+submit grant 带 newCap(>currentCap,BudgetOverrideGrant 全绑定)+claim_approval 幂等重发(撤旧铸新)+workItem 状态机+decisionDigest 编码(ApprovalDecision domain)+approvalWorkChanged 仅投 eligible holder;⑤conformance DSL 补 resolveStopped/seedAttemptHistory/snapshotBaseline/absent/unchangedFromBaseline/faultInject target/commitOrder 语义+push 必测集修正(去 never_activated 族)+「可执行 JSON Schema 为 fixtures 交付物,元素集不得超出本节」;⑥manifest:loadFailure 枚举+sourceDigest nullable+独立 RetryManifestSnapshot domain+active 单行指针+maxAcceptedManifestVersion high-water(重启防 rollback);⑦requestSemanticDigest 前移至 preaccept(D-6 side-effect 前计算入 PreAcceptSubmitIntent binding;join=三元全等)。P1 批:effectiveTargetClass 总函数(direct selector 映射+无法归类恒 forbidden;§9 fresh 同引);T4 guard 逐字枚举+lease 初始 active(Chunk 2 增补);claim_ack 投影矩阵/4030 残留清除;activationReceiptDigest 稳定字段/leaseExpiresAt 实时值声明;artifact 多对多 uploads 表+evidenceRefs 入引用验证(role=evidence)+holder get 携 workItemRef;lookup cursor;cancel 已 cancelling 幂等;outcomeMode 闭合 union;4051/4052 优先级(mode 先判);§16.1 应用层限定;4044/4050/4051 行修;artifactMaxBytes default 512 KiB(4054 可达);verification CAS 必发 taskChanged。轮 19 不成立项:「§7.2 标题重复」未复现(全文仅一处)。
- **v0.9.1(2026-07-15 会话 6;Codex 轮 18 REJECT 全量修入;轮 19 复核=③⑧⑬ FIXED 余 PARTIAL,7 blocker 由 v0.9.2 收口)**:轮 18 三路红队 P0(去重 14 项)全修——①`task.claim_ack` 改 wire-only,模型侧 `task_claim`=shim 原子复合(claim→ACK→ActivatedClaimReceipt,激活后 revision 一次性交付,消除「模型只知旧 revision」自锁);②rs execution slot:每 {rs_, generation} 至多一条 pending_ack/active lease(部分唯一约束+T3 guard+claim_ack CAS 重验,冲突→4013——防同 rs_ 双激活);③preview/claim 增 Task 级 route ACL(resolved target==调用会话,候选外→4053);④complete 先按 token 解析归属,跨 Task 注入→4046 零转移(防 reconciling DoS);⑤supply_* 正文 durable 承接(suspension_submissions 表+同事务四步+幂等 receipt);⑥artifact「digest≠capability」(uploader 列+artifact_references 表+引用入口 authority 验证);⑦holder 面补 discovery(approval.peek_work+event.approvalWorkChanged)+封闭 presentation union+ApprovalActionReceipt 幂等+budget deny 语义(不新增边);⑧TaskSnapshot 统一可观察形状(verification/verificationRevision 闭环;event.taskChanged 增 verificationRevision);⑨方法→authority 矩阵(§7.1 封闭表);⑩conformance DSL 重写(封闭 setup/steps/合取 expect/barrier/commitOrder/trace+allowlist gate 绑定+CC 拆分至唯一期望+新增 CC-12b/16/19/20/21 竞态钉);⑪RetryMatchContext(broker-owned {agent_turn, targetClass};toolName 条目 v1 仅 forbidden 向);⑫ActiveRetryManifestSnapshot(invalid 也成 snapshot+任何切换 policyEpoch+1+版本回退拒);⑬current 语义 v1 UNSUPPORTED(architecture contextDigest 必填冲突的保守解;generation_only 条件 profile 预写待 architecture tagged-basis 修订 APPLY;fresh 语义逐 targetClass 定义);⑭requestSemanticDigest 幂等收紧(TaskRequest domain)。P1 批:ask_* onCallerLoss 默认改 detach+shim 键持久化义务;cancel 分流措辞;4030 归位;activationReceiptDigest/resultDigest(信封级)编码锁定;lookup awaitToken 定义+truncated;fallbackUsed 入 TaskSnapshot;4042 拆 4057;4058 invalid_params;4043 conditional;4046/4047 优先级;4054 重定义;status pendingCount=self 域;holder artifact get 限工单引用。**封版章 additive 增补(轮 18 证据,提请轮 19 复核)**:§1.3(creq_/cmpl_)、§2.6(taskChanged.verificationRevision+approvalWorkChanged)、§3.2(verification token)、§5.2 T3 guard(candidateOwner/route ACL/slot)、§6.1(execution_leases slot 约束/idempotency_keys semanticDigest/artifacts 列/artifact_references 表/suspension_submissions 表)。architecture 同步修订建议新增:resolvedContextBasis tagged union;幂等 digest 覆盖行为字段;completion「任何字段不同」=信封 canonical。
- **v0.9(2026-07-15 会话 6;Chunk 3 初稿;轮 18 REJECT,由 v0.9.1 收口)**:新增 §7 MCP 工具三面——§7.1 通则(wire 方法名权威/shim 投影≠授权/并发类归属延伸/inline 64KiB 上限);§7.2 提交面(task.submit 全 caller 列族 wire 形状+deadlineAt XOR ttlMs+syncWaitMs/WaiterLease 成环检测入 accept 事务+ask_* 糖映射表(D-6 不对称默认逐字)+task.cancel(origin principal 授权,统一 task_not_found)+task.lookup_by_idempotency_key(authctx 强制作用域+await token 重铸));§7.3 执行面(peek 零正文/preview=metadata+claimToken/claim→pending_ack receipt/claim_ack/renew(active 门)/complete+completionOperationDigest 编码锁定 AB-CANON-1("AgentBridge/CompletionOperation/v1")——GV 随 conformance fixtures,附录锚不变);§7.4 挂起动作面(三动作封闭);§7.5 artifact 面(单帧,分块 UNSUPPORTED);§7.6 holder 面(三类工单单一 claim_approval 领取;G5 门;submit_verification=§5.5 manual 支);§7.7 status;§7.8 Claim/Complete conformance 封闭清单 CC-01..18(含轮 15 P0 回归钉 CC-12);§7.9 投影矩阵。新增 §8 retryClass manifest(policy_control 归类恒拒/坏 manifest fail-closed=defaultClass forbidden/最保守匹配/书挡① 冻结+retryClassBasis)。新增 §9 requestedContext(fresh/current NORMATIVE+checkpoint/providedBundle UNSUPPORTED 入口拒;current v1=generation fence,expectedBasis 恒 null fail-closed;contextDigest 来源=E2E-GATED→P0A-1/-9)。§16.2 增 4032-4056(architecture §6.3 错误码全数入表);§16.3 增 CompletionOperation/RetryManifest/ConformanceSuite 三 domain。新增 [USER-DECISION→DS-2](dataClassification 细分词表)。
- **v0.8.1(2026-07-15 会话 6;Codex 轮 15 REJECT 修入,轮 16 差分确认 FIXED)**:轮 15 verdict=N1-N5 全 FIXED、N6 PARTIAL(真 P0=跨 attempt tombstone 串线:旧 attempt 经 T17→T18 收口重试后,其 `activated` tombstone 的迟到 complete 在新 attempt 恰处 cancelling/reconciling 时被二元路由误作当前 attempt 的 T15 stop 证据/T19 对账证据)。修法:**迟到 complete 路由升三元 f(revokedAuthority, fenceTuple 匹配当前未决 stop/reconcile 目标 attempt, 当前 phase)**——仅 fence 精确匹配 beginStop 所 fence/enterReconcile 所封存 risk record 的 `{dispatchId, leaseId, leaseEpoch, attempt}` 的 token 才可参与 T15/T19;历史 attempt token(任意 phase)恒 evidence-only(带 dispatchId 关联入 task_events),不触发任何转移;原「防御分支=不变量破坏」表述删除(T18 重试后旧 tombstone 与新 attempt 并存=正常态,消除审计假阳性——轮 15 P2-1)。「fence 不符→reconciling」显式限定适用域=未 tombstone 的 active completion 路径,revoked token 的 mismatch 不得推 Task 入 reconciling。同步:§6.1 表路由公式、T15 触发列(fence 匹配限定)、T17 副作用列;§4.4 overlapRiskSet 排除 pending_ack lease(走 T6b;轮 15 P2-2);v0.7.1 修订条「Chunk 7 承接」补「组装期」注(轮 15 P2-3)。architecture 同步修订建议(§6.2 补 verificationRevision/§6.5 acked 与 acknowledged 消歧/§6.2·§8.1 claim_ack)并入工作台账 Chunk 7 清单。**轮 16 差分确认:N6 P0 与 P2×3 全 FIXED(两攻击重放阻断+「同 tuple never_activated/activated 并存」新攻击失败);同轮追记修入:头部状态行版本同步、beginStop「不读本列」→「不读 revokeCause」指代明确化、「恒有唯一未决目标」收紧为 commit-visible 表述(T14 pre-dispatch 瞬态不可观察)。**
- **v0.8(2026-07-15 会话 6;N6 正交化修案;轮 15 复核=PARTIAL,残余 P0 由 v0.8.1 收口)**:completion tombstone 撤权语义正交化——`revokeReason` 单值拆为 **`revokeCause`(write-once 审计列:首个撤权者写入,后继 reducer 不改写,不参与路由)+ `revokedAuthority ∈ {activated, never_activated}`(token 事实:撤权时 lease.status=active→activated / pending_ack→never_activated;交付轮换撤旧铸新同 never_activated;CHECK delivery_superseded ⇒ never_activated)**;**迟到 complete 行为路由改为 f(revokedAuthority, 同事务当前 Task phase)**:never_activated 恒 fail-closed(不参与 stop_confirmed/对账);activated×cancelling→late_result+「旧 turn 已结束」stop 证据参与 T15(仍须无未决 effect);activated×reconciling→T19 对账证据输入(outcome 仍按 terminationIntent);activated×terminal→仅 late_result;其余 phase=防御 fail-closed+审计计数。消除 N6 三入口冲突(T16 / cancelling→T17 / cancelling→T24):enterReconcile 遇已有 revoked 行不改写,路由随 phase 推进自然切换。同步:§5.1 beginStop/enterReconcile 写入语义、T6b/T17 副作用列、§5.3 claim 重放行、§6.1 表列族、T15 触发列显式化「任一 stop 证据 **且** 无未决 effect」。
- **v0.7.2(2026-07-15;轮 14 交接审计修正)**:N1 残留(§6.3 事务索引 T7b 引用清除);N2 残留(settleAttemptForRetry 改 T18/T6b 共用;janitor lease 过期按 status 分流 pending_ack→T6b/active→T17);N3 残留(§5.3 claim_deliveries 概念 schema 与 §6.1 表统一:补 superseded/dispatchId/leaseId/deliveredStateRevision/activatedStateRevision/activationReceiptDigest)。**N1-N5 全部待下会话正式差分复核;新增 N6(封版前 blocker):completion tombstone 的 revokeReason 单值无法同时承载 stop_won(beginStop 写)与 reconcile_entry(enterReconcile 需)——覆盖三条入口:T16、cancelling→T17、cancelling→T24(enterEffectReconcile);须把 stop disposition 与 reconcile evidence 路由正交化**(轮 14/14b 审计抓出)。头部状态行同步。
- **v0.7.1(2026-07-15;⚠已修入但未经 Codex 复核,下会话首件=差分确认)**:Codex 轮 13 REJECT 的 N1-N5 修入——N1 删除 T7b(T7 改「start CAS 先于 worker 协议调用」,push result 统一 T13,无 dispatching 旁路);N2 新增 T6b(leased+pending_ack 的专属收口边:ackDeadline/retire/cancel/deadline;不进 reconciling、不受 forbidden 限制)+ §5.6 ackDeadline 定时器;N3 claim_deliveries 增 deliveredStateRevision/activatedStateRevision/activationReceiptDigest+ACK-success 重放重验当前 authority(撤权后 4031)+tombstone delivery_superseded fail-closed 分支;N4 T24 改 enterEffectReconcile(继承公共 reconcile 写集+effect 专属封存);N5 revision 总括句限定三分。Chunk 7(组装期,见工作台账「起草计划」)承接:architecture §6.2/§8.1 claim_ack 步同步、deadline 列名统一、beginStop 收口 sent-but-unacked intent、D3 与既有 cancel intent 的 first-winner 澄清。
- **v0.7(2026-07-15)**:Codex 轮 12 REJECT(真 P0×5+P1×3+P2×4)修入——claim_ack 封闭 CAS(Task leased+intent null+deadline/expiry+pending_ack+owner 全匹配;beginStop/enterReconcile/retireGeneration/expiry 同事务 supersede 未 ACK delivery;同 revision+digest 幂等重放原 activation receipt;shim 隔离义务=payload 不过模型先 ACK;承诺口径=至多一个 revision 获执行权;architecture §8.1 补 ACK 步列入同步修订建议);D3 reconciling deadline 自环(intent=expired,已知超时不落 unknown);T7 receiver-side start fence(CAS 成功前不得启动 executor);T16 guard 排除 executing effect(强制 T24);T19 intent 非 null 恒按 intent(cancel 亦不复活 succeeded);T14 pre-dispatch cancel 同事务直达 terminal;revision 三分(state/verification/eventSequence);claim_deliveries/outbox 表列补齐;waiter schema 措辞同步;mutating token 不轮换;4030 措辞+4031 delivery_superseded;标题版本同步 v0.7。
- **v0.6.1(2026-07-15)**:Codex 轮 11 REJECT(真 P0×3+P1×4)修入——claim 两阶段交付(delivered→delivery_acked→lease active;ACK 前禁执行、旧 revision ACK 必败,消除双执行竞态,废除「无执行证据即轮换」);terminationIntent write-once 跨对账保留(T18 guard=intent IS NULL;T19/T20 intent=expired → outcome 恒 expired,真实结果仅 evidence;enterReconcile 冻结 reconcileDeadlineAt);D1/D2 互斥分派(D2=approval-pending 且 permit absent|unused,T22 delegate;D2 走 enterTerminal+worker drain);T16 调 enterReconcile;enterTerminal 补 lease closed/attempt terminalize;beginStop 补 waiter 即删+dispatch_intent abandoned+intent 枚举去 denied;T3/T4 guard 取 max(nextEligibleAt, retryNotBeforeAt)+defer 到期 janitor reactivation;tombstone revoked 按 revokeReason 分流(stop_won→late_result/reconcile_entry→T19);lease status 四值;suspension token 补 expiry/revoke 列+轮换规则;sender 仅 dispatching 可 pending→sent;caller 列族补 targetSelector。
- **v0.6(2026-07-15)**:Chunk 2 按 Codex 轮 10 REJECT(P0-N1..N5+关键 P1×4)修入——deadline 封闭边 D1/D2(cancelling 承载 stop drain,outcome 按 terminationIntent;approval-pending 快速 expired 写集合);cleanup reducer 四分(beginStop 不释放 occupancy/enterReconcile 封存/enterTerminal 唯一 settlement/settleAttemptForRetry);phase-preserving mutation 类(T4c queued 自环 dispatch_deferred+eligibility guard 入 T3/T4);outbox 终结 CAS(T7/T7b→acked,T8→abandoned+sender 重验);tombstone disposition 双型(consumed/revoked 互斥,revoked 永不结单+push 完整 fence tuple);T18 settleAttemptForRetry+retryNotBeforeAt;T9a caller 动作族封闭/T9b holder 可用性 guard/T10 铸 supply_callback/T11a BudgetOverrideGrant;claim_deliveries(claimRequestId 幂等,响应丢失恢复判据);waiter_leases 全列+环检测同事务;tasks 补 4 个 deadline/风险列+caller/authctx 列族显式映射;approval_records 可实现字段;§6.4 措辞收敛(起手≠冻结);error 4030。
- **v0.5(2026-07-15)**:Chunk 2(§5/§6)按 Codex 轮 9 REJECT(P0×7+P1×7+P2×3)整体重写——全局 deadline fence(rule 0 机器化,complete 不得越过 deadline,late_result 保真);单一 taskReducer+BEFORE UPDATE trigger(承认行级 CHECK 管不了转移);统一 beginStop/enterTerminal 清理 reducer(waiter/offer/token/lease/challenge/permit/书挡③);T3 与 T4 共用 dispatch 书挡② reducer+offeredStateRevision 三方相等+route CAS 入 T3;T17 同事务撤 lease/token 转 evidence-only tombstone;T18 terminalize 旧 attempt+notBefore+不预耗 attempt;T7b 快速终态+T8 改 ackDeadline 判据;T9b/T11a waitingScope 拆 pre_dispatch/in_execution;T22 approval 出口唯一 SSOT;T23 legacy guard 显式;T24 effect_uncertain 入口;completion_token_tombstones 表+lease.dispatchId;task_results 表(XOR CHECK);outbox 补 dispatch_intent/interrupt+operationKey 唯一;verification 独立转移表(§5.5);janitor 域总表+linger 三元 CAS+disconnectedAt 列;§6.4 migration 冻结前置如实声明(等 §10)。
- **v0.4.3(2026-07-15)**:Codex 轮 7 定向确认(P1-N3 FIXED;剩两处字面矛盾)修入——§2.6 外部操作期改「1–6+方法专属集+对象 CAS,仅 bound-required 方法验 binding」,pairing.claim 专属集显式化(unassigned/bound/revoked 皆可,首配/重配入口不要求已有 binding),§4.9 授权行补 revoked;§4.8 开通判定分层:admission hard-fail(CAS/bootstrap 行/bc/PoP/allowlist)vs scheme evidence soft-deny(缺 attestation 行/硬件未验→仅裁能力 evidence_missing,不拒注册);版本史补 v0.4.2/v0.4.3。
- **v0.4.2(2026-07-15)**:Codex 轮 6 收敛(零新 P0;三精确 P1)修入——anti-TOCTOU 适用域拆三类(外部操作期 1–6 全套 / 握手期封闭前置集 / admin·内部封闭 authority 集,消除 first-register 无 Connection 的 literal 不可实现);enrollment join 谓词封闭(bootstrap 行/attestation 行精确匹配三条件,SE 强档硬件验证前恒 evidence_missing;registry 表补 keyKind/schemeId+条件唯一);approval `hostNativeSessionId` 改必填(消除 logicalSessionKey/hash-input 分叉);加 Approval Agent 发送前持久化义务(防 send-crash 自锁);ProvisionBundle 保留至 ack/superseded;Decision 表墓碑措辞同步。
- **v0.4.1(2026-07-15)**:Codex 轮 5 REJECT(P0-N1 TOCTOU + 关键 P1×6 + P2×4)窄修——§2.6 增 anti-TOCTOU 横切 MUST(全套 authority 校验与 mutation 同 writer 事务,连接层校验仅 fail-fast 非权威);EnrollmentRegistry 拆 bootstrap_identity(必 ed25519_v1)/attestation_scheme(per-scheme:软件 ed25519 vs SE p256 非导出;无真实 enrollment→evidence_missing)双类密钥;ApprovalBootstrapHashInput 封闭 schema(hash 输入锁定 wire 字符串 UTF-8 字节);ApprovalProvisionBundle 交付协议(admin 带外→Agent 0600 配置);resume_tokens 补 consumedAt/consumedByRegistrationEventId;worker 明确 broker 进程内注册(launchNonce 身份),外部 wire 恒拒;GV-3/6 nonce 改 canonical base64url(GV-6 满足 32B 约束)重算 + 新增 GV-7(approval 注册 digest)+ stdout 锚更新;Decision 不可变措辞(supersededAt 墓碑例外)、§3.4 补 redelivery 路径、retire effect 事务内只写 intent。
- **v0.4(2026-07-15)**:Codex 轮 4 REJECT(P0-A/B/C + P1×8 + P2×4)全量修入——**P0-A**:`commitRegistration` 统一原子事务(resume/bootstrap 消费→get-or-create(logicalSessionKeyHash 部分唯一)→Decision→generation CAS(内联 retire)→epoch+1→撤旧铸新→CredentialDelivery,单事务无 crash 窗口);**P0-B**:EnrollmentPoP 改签 provision 期持久 `bootstrapChallengeNonce`(不含握手 nonce)+ Ed25519 确定性签名 + EnrollmentRegistry(keyId→principal/publicKey/allowedSchemes)+ declaredSchemes==attestationSchemes 且 ⊆ allowlist + PoP/bc 以 sha256 文本形入 digest + redelivery 验 bc 归属不二次消费——ack-loss 重试自锁消除;**P0-C**:Decision 增 resultEndpointGeneration/provisionRevision/supersededAt,重放门加 endpoint 代/预置版本/lifecycle 检查,retireEndpointGeneration 内联 per-rs retireGeneration(endpoint_revoked)+ supersede 旧 Decision。P1:registerAck 增 deliveryRevision;assignment 出 Decision(按当前权威 binding 派生);WorkspaceBinding 唯一键统一到 surface 层;revoked 允许 pairing.claim(唯一恢复路径);capability 映射补 inboundMode 全值+声明性成员归类;§2.8 DRAINING 与 §2.3 同步;overlapRiskSet 按 risk object 判定+executing effect 走 §10.1 settle 赢家;lifecycle 封闭表(滚代不改 lifecycle,DRAINING 仅终局)。P2:标题/版本史升 v0.4;§16.3 移除失效 RegistrationEnvelope 域+登记 EnrollmentPoP/LogicalSessionKey;token 表 sa/bc/pairingCode 绑定元组同步;附录 GV 增 GV-6+stdout SHA-256 锚。
- **v0.3(2026-07-15)**:Codex 轮 3 REJECT(PARTIAL×6 + 新 P0×7)全量修入——注册重放改「决策/投递分离」(RegistrationDecision 不可变 + CredentialDelivery 可变 + canonicalRequestDigest 覆盖 requestKind/token hash + latest-event/generation 双门 + `registration_event_superseded`,旧事件不得击落新代);retire gate 精确化为 overlapRiskSet(waiting_* 不阻塞新代,防活性冻结)+ reconciliationReason=`owner_identity_retired`+retirementReason 封闭枚举 + approval 行同 CAS;endpointGeneration 入 sa 绑定与 §2.6 当前态检查 + retireEndpointGeneration 级联;ApprovalBootstrap wire 载体(含 enrollment PoP)+ worker/approval 统一 provisioned 注册 + `endpoint_not_provisioned`;SessionIdentityEvidence(broker-owned,claude hook profile=verified、codex shim=P0A-2/3 前恒 unverified)+ 自动恢复精确匹配 endpoint/epGen + sideA/B canonical ordering + revoked 语义;capability→gate 映射表 + 单一 authorize() 三处共用(含 scheduler/dispatch CAS 内重验)+ deniedCapabilities 原因优先级;嵌套 digest 文本形锁定 + hash-input ASCII 键名 + 附录 GV 实算 golden vectors;connection supersede 拆 DB 事务/网络 I/O(durable close-intent)+ 启动恢复事务(brokerBootEpoch/crash-close/WaiterLease 全删)+ requestKind×source 合法矩阵 + DRAINING 仅收 reconnect;Connection 不可变绑定快照列/broker_state/registration 两表/evidence 表/capability_snapshots 键修入 §4.11;generation_stale 可达性(revoke tombstone+reason);regev_ 客户端铸造归类;错误表拆行+补 4026-4029;RegistrationEvent retention/GC;pairing issue/claim 授权分离。
- **v0.2(2026-07-15)**:Codex 轮 2 REJECT 全量修入——P0-1 注册幂等(registrationEventId/重放/conflict)与滚代解耦+retireGeneration 级联矩阵(活跃 lease 立即 reconciling、新代对账前不派发);P0-2 connection supersede(currentConnectionEpoch 单调+epoch fence+全元组比对+sa 每 ack 轮换,消除"hash-only 回显明文"不可实现矛盾+跨 session 拼接);P0-3 approval_system 预置开通+bootstrapCapability(§4.8);P0-4 pairing/WorkspaceBinding ACL+Phase 1A 身份存储表(§4.9/§4.11);P0-5 protocol feature 与 effectiveCapabilities 两层分离+调用时权威+policyEpoch(§2.4);P0-6 方法并发矩阵(control 类不被 dispatch 槽阻塞);P0-7 HostSessionKey=rs_ 记录身份、显式禁 generation/epoch 入键(§4.10)。P1:HandshakeProof 绑完整 transcript+keyId 轮换;token 四类总表(补 pairing/bootstrap/PushCompletionHandle/continuation/holder/sealed 类)+completionToken replay 语义;标签双向去污染(registrationSource 宿主映射→E2E-GATED,§4.10 wire 形状→NORMATIVE,lingerMs→policy default);connectivity 正交字段化;error registry 整数码+generation_stale 泄露论证+补码;sessionAuth 续期 durable-commit 化;resumeToken expiry/单 active/代绑定;AB-CANON-1 字节级(raw 输出/hash-input 全字段显式/golden vectors 占位/Effect domain 改 reserved)。P2:installationId/brokerBootEpoch 更名;禁 batch+长度上限;标签逐条目化。
- v0.1(2026-07-15):Chunk 0+1 初稿(§1-§4+§16 骨架)。

*(§1-§16 全章已起草封版:Chunk 0-6 均 Codex 全路 APPROVE。剩 Chunk 7=组装终审,无新章。)*
