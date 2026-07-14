# AgentBridge v3 同类仓库源码级调研 — 证据矩阵

> 生成:2026-07-14 19:53 +08(快照日)。调研纪律 E-1:README 不算证据;证据分级 STRONG-impl(读到实现代码)/ STRONG-spec(规范正文/schema)/ WEAK-doc(仅文档)/ INFERRED(推断,显式标注)。
> 所有 file:line 均锚定下表 pinned commit。**Claude 25 仓**=浅克隆于 scratchpad + `git rev-parse HEAD` 核对;**Codex 扩展轮 5 仓**(§1.13/§6)=受 `.git` 写禁令改用 commits API + 精确 SHA tarball + `git ls-remote HEAD` 复核(等价 pinning)。
> 本文件为调研工作产物,经用户 APPLY(2026-07-14)写入 docs/;与两份 v3 设计文档同样保持 **untracked 未 commit**。产出方式:Claude 25 仓(12 只读 agent,引文抽查 12/12 过)+ Codex 独立扩展轮 5 仓(spot-check 4/4 过);调研过程零仓库写、零 Git 写。
> 对照对象:`/Users/ds/code/agent-bridge/docs/v3-architecture.md`(DRAFT v0.5,SHA-256 4631dad3…bf2fd)§0-B D-1..D-6 + `docs/v3-HANDOFF.md` §E-2 Round-8 backlog。

## 0. 仓库清单(canonical / pinned commit / 活跃度 / license)

| 仓库 | pinned HEAD | commit 日期 | ★ | last push | license | 类别(附录 A) |
|---|---|---|---|---|---|---|
| modelcontextprotocol/modelcontextprotocol | cf85cc74a170 | 2026-07-14 | 8588 | 2026-07-14 | NOASSERTION | 协议规范 |
| modelcontextprotocol/typescript-sdk | e81758caed29 | 2026-07-13 | 12846 | 2026-07-14 | NOASSERTION | 协议规范(官方实现) |
| a2aproject/A2A | 02441d88673b | 2026-07-14 | 24778 | 2026-07-14 | Apache-2.0 | 协议规范 |
| a2aproject/a2a-python | 723880e67931 | 2026-07-13 | 2025 | 2026-07-13 | Apache-2.0 | 协议规范(官方实现) |
| temporalio/temporal | 5e2a0eaabbd4 | 2026-07-14 | 21632 | 2026-07-14 | MIT | durable execution |
| inngest/inngest | cfb6badf0d52 | 2026-07-13 | 5604 | 2026-07-14 | NOASSERTION(Server Side Public License 类) | durable execution(push 形) |
| restatedev/restate | c024d4c5364c | 2026-07-13 | 4162 | 2026-07-13 | NOASSERTION(BSL 类) | durable execution |
| riverqueue/river | 5f1913acdd96 | 2026-07-13 | 5444 | 2026-07-13 | MPL-2.0 | 任务队列(claim/lease) |
| benbjohnson/litestream | c96c0f42a51b | 2026-07-08 | 13925 | 2026-07-10 | Apache-2.0 | SQLite WAL 纪律 |
| tailscale/tailscale | 236564af757e | 2026-07-14 | 33955 | 2026-07-14 | BSD-3-Clause | 本地 daemon/same-UID |
| openssh/openssh-portable | cadefc724fe0 | 2026-07-12 | 3899 | 2026-07-12 | NOASSERTION(BSD 类) | same-UID out-of-scope 实证 |
| maxgoedjen/secretive | b00328674542 | 2026-07-02 | 8664 | 2026-07-02 | MIT | same-UID in-scope 实证 |
| humanlayer/humanlayer | 99abe673498c | 2026-06-18 | 11112 | 2026-06-19 | NOASSERTION | 人类审批路由 |
| omnara-ai/omnara | 500a82ad85ba | 2025-12-27 | 2649 | 2026-01-19 | Apache-2.0 | 远程问答/审批(低活跃⚠) |
| eclipse-biscuit/biscuit-rust | 58a39757edfb | 2026-07-13 | 242 | 2026-07-13 | (Apache-2.0,gh 未标) | capability 衰减 |
| cedar-policy/cedar | 643095f4b43e | 2026-07-13 | 1602 | 2026-07-13 | Apache-2.0 | policy engine |
| smtg-ai/claude-squad | 5a604f76fc94 | 2026-06-17 | 8112 | 2026-06-17 | AGPL-3.0 | 同类桥/编排 |
| BloopAI/vibe-kanban | 4deb7eca8f38 | 2026-04-24 | 27371 | 2026-04-24 | Apache-2.0 | 同类桥/编排 |
| slopus/happy | 3f161de70541 | 2026-07-11 | 22627 | 2026-07-11 | MIT | 同类桥/编排(客户端仓) |
| ruvnet/ruflo(原 claude-flow,已改名) | 8161a088c8e8 | 2026-07-14 | 64377 | 2026-07-14 | MIT | 同类桥/编排(核真) |
| Jedward23/Tmux-Orchestrator | 7193530291e5 | 2025-07-14 | 1798 | 2025-07-14(≈1 年未动) | 无 license | 同类桥/编排(反面教材) |
| openai/codex | 5bed6447998c | 2026-07-14 | 97949 | 2026-07-14 | Apache-2.0 | 宿主事实/审批原语/沙箱 |
| BerriAI/litellm | b200d664eec1 | 2026-07-13 | 53548 | 2026-07-14 | NOASSERTION | budget/usage 归因 |
| open-telemetry/semantic-conventions | 9e2eb2fd3016 | 2026-07-14 | 612 | 2026-07-14 | Apache-2.0 | usage/provenance 词汇 |
| Shopify/toxiproxy | 7c01129a8c23 | 2026-06-29 | 12152 | 2026-07-13 | MIT | 故障注入/conformance |

**Codex 独立扩展轮五仓(2026-07-14 同日;方法=commits API + 精确 SHA tarball + `git ls-remote HEAD` 复核,非浅克隆 git rev-parse;full SHA + tarball SHA-256 见 §6)**:

| 仓库 | pinned HEAD | commit 日期 | license | 类别 |
|---|---|---|---|---|
| spiffe/spire | 0f66c130b80f | 2026-07-09 | Apache-2.0 | D-4 in-scope/attestation |
| dbos-inc/dbos-transact-py | e9e351574b9a | 2026-07-13 | MIT | 嵌入式 durable execution |
| hatchet-dev/hatchet | d25600995a8a | 2026-07-14 | MIT | DAG join/调度 |
| tokio-rs/turmoil | 481407d3bea1 | 2026-05-27 | MIT | 确定性故障模拟 |
| dbus/dbus(GitLab canonical) | f64ae3cafdcf | 2026-07-01 | AFL-2.1/GPL-2.0-or-later | D-4 out-of-scope/activation |

覆盖缺口(有意未深读,诚实标注):ACP/AGNTCY/agent-mesh(附录 A 提及,存在性与可比性未核);MCP sampling 之外的 `MCP Apps`;happy-cli/happy-server(链路主体仓,未克隆);data lineage/retention tombstone 类无高信号同类仓;Jepsen/Antithesis 级故障注入(超出本轮体量)。

## 1. 各仓证据(agent 回报后填充,主会话抽查核验)

### 1.1 MCP 规范 + 官方 TS SDK(抽查✓:tasks.mdx:398-399/456-458、codec.ts:25-31、server/CHANGELOG.md:262-263 逐字吻合)

**⚠ 头号发现(冲击 DR-8/§18-Q7 前提)**:MCP Tasks(2025-11-25,experimental)已被 **SEP-2663 从核心规范撤出**——TS SDK v2 物理删除全部 tasks runtime(TaskManager/TaskStore,"Tasks are now Extensions Track",server/CHANGELOG.md:262-263 [STRONG-impl];2026-07-28 revision 中 tasks 降为 `capabilities.extensions` 下的 `"io.modelcontextprotocol/tasks"` 扩展键,spec.types.2026-07-28.ts:842-849)。v3 文档 DR-8"wire 层尽量对齐 MCP Tasks"与 §18-Q7"何时切换为 MCP Tasks"的对齐目标本体在剧烈漂移。**这不是本轮调研擅自重议锁定决策——DR-8 不在 §G 锁定清单,且属"新证据直接推翻前提"应显式提请的类别。**

MCP Tasks 规范本身(tasks.mdx@cf85cc74a170,全部 STRONG-spec):
- 任务 = receiver 持有的状态机,taskId receiver 铸造(:398-399);两阶段响应:立即回 CreateTaskResult,真结果只经 `tasks/result`(:126);`tasks/result` 非终态阻塞、终态**原样重放**(含原错误)可重复读(:464-466)→ v3 completion receipt 重放语义的规范先例。
- 5 态扁平状态机(working/input_required/completed/failed/cancelled,:403-407),无 queued/leased/attempt——承载不了 v3 的多 executor 竞争。
- cancel:终态 cancel MUST 拒;cancelled 后执行完成也不改终态(:494-496)= v3 late_result 同构。
- TTL:receiver MAY 覆盖请求值、MUST 回报实际值、过期 MAY 删(:456-458);过期后查询返 -32602 合规(:818-821)→ v3 receipt 保留期须 ≥ caller 最大重试窗口。
- 能力协商三层:capabilities.tasks 按请求类别 exhaustive 枚举(:95-101)+ tool 级 `execution.taskSupport ∈ {required|optional|forbidden}` 双向 -32601 硬闩(:113-117)+ 未声明能力时 MUST 按普通请求处理并忽略 task 附加(:392)。
- 通知不可依赖:MUST NOT rely on `notifications/tasks/status`,SHOULD continue to poll(:303/478)= v3 level-triggered 唤醒同构。
- 访问控制:有授权上下文时 MUST 绑任务到上下文(:872)、跨上下文 get/result/cancel MUST 拒(:878)、无法识别 requestor 时 SHOULD NOT 声明 tasks.list + MUST 高熵 taskId(:875-876)。
- human-in-the-loop:sampling 仅 **SHOULD** 有人在环(sampling.mdx:25-26)——v3 硬审批不能引 MCP 为依据;elicitation 较硬:accept="explicitly approved and submitted with data"(elicitation.mdx:550-555)、身份 MUST NOT 只绑 session id(:578-582)、URL 模式 MUST 展示完整 URL+显式同意(:726-728)。
- 版本协商:client 送最新,server 不支持则回自己的版本,client 不认则 SHOULD disconnect(lifecycle.mdx:167-175)+ HTTP 后续请求 MUST 带版本头。

TS SDK(e81758caed29,STRONG-impl):
- **wire-era 物理注册表**(半升级最强参照):删除=注册表除名,era 不符的入站方法"-32601 by absence"(连已注册 handler 也挡),出站本地典型化失败不上 wire(core-internal/src/wire/codec.ts:25-31);era 由协商版本纯函数决定(:16-23);`not-in-era`(-32601)与 `invalid`(-32602)显式分离(:101-113)。
- tasks 替代 = MRTR + `requestState`:opaque server 态、byte-exact 回显、**返回即攻击者可控输入,MUST HMAC/AEAD 且验证失败 MUST 拒,SDK 不代劳**(shared/inputRequired.ts:40-45,56-60)——v3 §6.3 动作 token 纪律的镜像印证。
- 客户端自动补全环:fresh request id、maxRounds=10、requestState-only 腿 250ms pacing 防空转(inputRequiredDriver.ts:4-10,36,42);跨代 shim:同一 handler 两 era 复用,shim 腿超时 600s"human-paced"(legacyInputRequiredShim.ts:1-18,48-52)。

映射:D-1=receiver 独占成败判定、无 complete RPC,broker 自持 completionToken 观察终态后自己记账(方向:completionToken 不交给 codex worker);D-2=审批 surface 回**任务发起方**;attestation 语义三分且 accept 要求显式提交;D-6=MCP 无解(请求绑发起连接),可借鉴"无法识别 requestor 时收窄可见面";半升级=版本协商+能力矩阵+era 物理注册表三层;claim/complete=无 claim(单 receiver 无竞争),但重放/TTL/requestState 纪律可抄。
Adopt:taskSupport 三值声明;requestState 完整纪律;通知仅加速轮询为真相源;终态原样重放。Avoid:**勿绑 MCP Tasks wire 形状(撤销中)**;勿用 5 态扁平机作基底;勿引 sampling SHOULD 级人审为依据;阻塞式 tasks/result 与 SuspensionReceipt 冲突(MCP 自己也改成 MRTR 腿)。
未知项:SEP-2663 完整动机文本未读(撤销事实有证,动机是 INFERRED);v1 TaskStore 实现不可考(depth=1 无历史);2026-07-28 tasks extension 正文未随克隆。

### 1.2 Toxiproxy(抽查✓:proxy.go:112 tcp 硬编码、server.go:70 seed 丢弃、unix grep 仅 UnixNano 命中)

- toxic 家族与形态(全 STRONG-impl):latency(latency.go:30)/timeout=黑洞(timeout.go:13,28)/reset_peer(reset_peer.go:21 + link.go:96,102 SetLinger(0))/slicer 递归分片(slicer.go:31-51)/limit_data N 字节截断(limit_data.go:14)/bandwidth/slow_close/packet_loss/noop。
- 架构:每 TCP 连接两条**单向** ToxicLink(proxy.go:221-222),channel 流水线 + InterruptToxic 热插拔(link.go:171-278);测试内 client toggle 模式:AddToxic→驱动→defer RemoveToxic(_examples/tests/db_test.go:100-103)。
- **UDS 不支持(STRONG 负面)**:net.Listen/Dial 硬编码 "tcp"(proxy.go:112,206);全仓 grep "unix" 唯一命中 UnixNano;reset_peer 依赖 *net.TCPConn 断言。
- **不可重放(STRONG 负面)**:`-seed` flag 在此 commit 失效(cmd/server/server.go:70 `rand.New(...)` 返回值丢弃),toxics 用全局 rand+墙钟,无虚拟时钟。
映射 §15:adopt=①双向单链设计(单测上行 ack 丢 vs 下行 complete 丢)②HTTP 控制面+测试内 toggle 模式③limit_data 式确定性字节截断打 intent/send/ack/complete 帧边界;avoid=概率型 toxic 做 gate 判据(不可重放);UDS 缺口推荐**自建 minimal UDS 故障代理**(link.go 形态 <300 行可照抄;socat 桥会破坏 peer credential,伤 D-4 依赖)。crash-point SIGKILL/SQLITE_BUSY 矩阵仍需自建 harness,线路代理够不着。
未知项:上游是否已修 seed bug(只查 pinned SHA);UDS fork 行为未实测。

### 1.3 Temporal(抽查✓:activity_util.go:63-73 attempt fence、retry.go:96-111 时间预算优先、consts/const.go:44-47 逐字吻合)

- **task token(D-1)**[STRONG-impl]:token=明文 proto 定位符 `{namespace_id, workflow_id, run_id, scheduled_event_id, attempt, started_event_id, version…}`(proto/internal/…/token/v1/message.proto:38-51,common/tasktoken/token.go:9-59),**无密码学 secret**;matching 在 poll 响应铸(matching_engine.go:3122-3133)但字段真值源=history mutable state;完成验证=broker 侧状态比对(activity:attempt 不匹配→NotFound,activity_util.go:63-73;workflow task:StartedEventId/StartedTime/Attempt/Version 5 元组,respondworkflowtaskcompleted/api.go:202-211)。
- **claim 单次消费**[STRONG-impl]:matching 队列 at-least-once 不做互斥;真 CAS 在 history RecordTaskStarted(StartedEventId 非空→TaskAlreadyStarted;同 requestID 重试幂等返正响应,recordactivitytaskstarted/api.go:150-170);matching 收 TaskAlreadyStarted 即丢弃不重派(matching_engine.go:803-805)。
- **reconciling 替代方案**[STRONG-impl]:超时重派=attempt++(mutable_state_impl.go:6841-6843)+ ai.Stamp 第二道 fence(api.go:178-183)——旧 token 因 attempt 不匹配自然失效,**不需要"证明旧执行已停"**,单调计数器足够。
- **完成幂等**[STRONG-impl]:完成即删 ActivityInfo,重复 complete→NotFound 错误("could be duplicate",consts/const.go:44-47),**无 receipt 重放**——比 v3 的 digest-receipt 弱,幂等负担推给 SDK。
- **retry 预算(D-5)**[STRONG-impl]:三层正交=maxAttempts+expirationTime(墙钟优先裁决,retry.go:96-111)+backoff(默认 Initial=1s/coef=2.0/MaxInterval=100×/MaximumAttempts=0 无限靠时间兜底,retry_policy.go:32-37,59-84);blobSize 2MB error/512KB warn、historySize 50MB/10MB 双阈值(dynamicconfig/constants.go:361-370,405-413)。
- **限流(attention 参照)**[STRONG-impl]:x/time/rate token bucket+multi/priority/map(per-namespace)组合器(quotas/rate_limiter_impl.go:8,26-31;frontend.namespaceRPS=2400,constants.go:710-713)。
- **worker versioning(半升级)**[STRONG-impl]:(current, ramping, ramp%) 路由;per-workflowID 确定性哈希 ramp(worker_versioning.go:821-832,914-920);PINNED vs AUTO_UPGRADE;错版完成拒(api.go:241);新版本必须覆盖全部 task queue 才可 ramp(util.go:100)。
- **fan-out**[STRONG-impl]:服务端只有 parent-close-policy(ABANDON/TERMINATE/REQUEST_CANCEL,经 transfer task 异步执行,transfer_queue_active_task_executor.go:1905-1974);join 语义留给应用层——joinPolicy 建议限定为"取消/放弃传播策略"。
- **transactional outbox**[STRONG-impl]:mutable state 与 transfer/timer task 同事务写(sql/execution_util.go:23-94,547-571)+ 外层 shard rangeID fencing(execution.go:40-58)防脑裂双写。
Adopt:①attempt/leaseEpoch 单调 fencing 替代等待证明(v3 reconciling 可简化);②outbox 外层加 broker generation 检查;③时间预算优先于次数+warn/error 双阈值;④digest-receipt 分工保留(比 Temporal 强)。Avoid:①完成即删+NotFound(语义含混);②明文可伪造 token(same-UID 下不可接受);③matcher 层不互斥全靠下游吸收(浪费整段执行,保持 claim 时 CAS)。
未知项:Cassandra 路径 outbox 未读(INFERRED 同构);Temporal 纯 pull,D-1 push 分支无参照;matching.rps 与 attention 的映射是间接类比。

### 1.4 A2A spec + a2a-python(抽查✓:a2a.proto:187-208 枚举、life-of-a-task.md:83-96、task_manager.py:211 CopyFrom 吻合)

Spec(02441d88673b,STRONG-spec):
- TaskState **单枚举 8 态**混装 phase/outcome/interrupted(靠注释背语义,a2a.proto:187-208)——v3 三正交轴优于此。
- **终态不可复活**:cannot restart,同 contextId 新建任务 + reference_task_ids(life-of-a-task.md:83-96,proto:276)——与 v3 parentTaskId 逐字同构,可引作外部佐证;终态后消息/订阅/取消全拒(specification.md:175,305,556)。
- Message vs Task 分离:"Messages MUST NOT be considered a reliable delivery mechanism"(:762),结果必须走 Artifact(:758)。
- blocking 等到终态**或中断态**返回(:446-448);**两种中断态**:input-required(轮次结束,caller 带 taskId 发新消息续)vs auth-required(执行体保持活跃、凭证 out-of-band 注入、可沿调用链上传,:630-633,1919-1945)→ D-2 直接样板。
- resubscribe 首事件 MUST 完整 Task 快照(:311)防 Get/Subscribe 间隙;push notification:config 存活到终态(:335)、per-config 单用途 token+轮换(:3103-3132)、at-least-once+退避。
- 版本协商(半升级最强项):每请求 `A2A-Version` 头、空值=0.3、同 endpoint 多版本并存、AgentCard.supported_interfaces 有序首选(:706-745,proto:344-370);协商失败 fail-fast 不静默降级(:745)。
- **负面证据**:Artifact 无 provenance(grep provenance/model 0 命中);无 claim/lease/join 原语(grep 仅 "claimed provider" JWS 命中);fan-out 依赖图明确甩给客户端(life-of-a-task.md:98-110);taskId 只准 server 生成(:615)。
SDK(a2a-python 723880e67931,STRONG-impl):
- TaskStore 全接口 owner-scoped(task_store.py:13-33;DB 查询绑 owner,database_task_store.py:191-197)→ same-UID/D-4 的参考形态。
- **写路径裸奔**:save=merge upsert 无 CAS(database_task_store.py:177)、状态更新 CopyFrom 不校验非法转移(task_manager.py:211);终态防护散在请求层/生产者 latch/消费者三处——反向坐实 v3 store 级 CAS 必要性。
- resubscribe 绑死进程内活队列(队列不在→TaskNotFoundError,default_request_handler.py:597-617)——v3 应做 store 级快照+重放。
- push sender 无重试、token 明文自定义头、spec 的 AuthenticationInfo 字段悬空未实现(base_push_notification_sender.go…py:62-105,grep authentication 0 命中)——**spec 写了 MUST 生态未必实现**的实证。
- 客户端断流不丢状态:CancelledError 时后台 consume_all 继续落库(:446-453)。
映射:D-1=token 绑 config、config 绑任务终态(可采);D-2=双中断态拆分(v3 waiting_input 建议拆 sub-kind);D-6=A2A 无 session 概念,协商失败 fail-fast 不隐式挑目标(启示:无 pinned 宁可 typed error);joinPolicy=无解;provenance=无解(v3 应做一等字段勿塞 metadata);半升级=可直接抄 channel 级协商模型;claim/complete=无(单 owner 无竞争,反向佐证)。
Adopt:终态不可复活引证;resubscribe 快照优先;双中断态;每请求版本头。Avoid:单枚举混装;store 层无转移校验;队列存活型 resubscribe;关键信息走流式消息。
未知项:v2 队列架构(default_request_handler_v2.py 等)未读;spec 3610 行未逐行(状态转移表可能藏于未读 binding 节,INFERRED 无显式表);tck 合规套件未读。

### 1.5 Tailscale + OpenSSH + Secretive(D-4 两分支;抽查✓:ssh-agent.c:1980-1990、ipnauth.go:191-194、SigningRequestTracer.swift:46-52 逐字吻合)

**D-4 in-scope 三档实证(防到什么粒度)**:
1. **人类 per-request attestation(最强档)**[STRONG-impl] secretive:LOCAL_PEERPID 取对端 pid(FileHandleProtocols.swift:5-8)→ 沿 parentPID 上溯 provenance 链+每进程 SecCodeCreateWithPID+SecCodeCheckValidity(SigningRequestTracer.swift:15-22,46-52)→ 每次签名由 Secure Enclave/Keychain 硬件层强制 Touch ID(SecureEnclaveStore.swift:113-127,.userPresence/.biometryCurrentSet),弹窗带调用方 app 名(:40-49)。**注意**:code-sign 校验结果 validSignature/intact 仅信息性展示、无消费点强制(NEG,grep 全 Sources 无 gate)——机器判真伪降级为给人看,真正 gate=人+硬件。另:XPC setCodeSigningRequirement 一行钉 team(XPCServiceDelegate.swift:15)。
2. **凭证占有+文件权限分级(中档)**[STRONG-impl] tailscale macOS sameuserproof:localhost TCP+crypto/rand token(safesocket_darwin.go:31,172-197);macsys 变体 token 文件 0640 root:admin(:237-239,264 Fchown admin 组)→ 同 UID 非 admin 进程拿不到;daemon 侧 BasicAuth+ConstantTimeCompare(localapi.go:259-270)。App Store 变体 0666+lsof 发现(:250-251,312-318)=弱形态。
3. **peercred 分级(弱但零交互)**[STRONG-impl] tailscale unix:root→rw、**同 daemon UID→rw**(ipnauth.go:191-194)、operator→rw、darwin admin→rw、其余用户→read-only(:166-208);不区分同 UID 内进程。
**D-4 out-of-scope 范式**[STRONG-impl] ssh-agent.c:1980-1990:getpeereid 仅拒其它 UID,root/同 UID 全信,同 UID 内无任何区分(NEG:全文 peer 只用 euid/egid,无 exe path/code-sign/PID);边界由 socket 0600+mkdtemp 私有目录表达(:2458-2477)——**"不设防"是显式代码+文档立场,非沉默**。缓解=per-key opt-in:ssh-add -c confirm 由 agent 自己弹 SSH_ASKPASS、默认拒(:924,586-601;readpass.c:197-)+destination constraints(:915-923)。
**§11**:tailscale=先 dial 探活→活着报 already in use(darwin 附 launchd 提示)→死 socket 才 unlink,注释自认 TOCTOU 竞态 "beyond the scope"(unixsocket.go:24-43);openssh=不做单实例+socket_is_stale 探活+1h 时效清理(misc-agent.c:226-264);secretive=**反例**:bind 前无条件 removeItem 互踢活实例(SocketController.swift:31-37)。v3 单实例最接近 tailscale 形态,但需 pidfile/flock 闭合竞态(v3 §11 O_EXCL 锁已是更强设计)。
**Windows(backlog)**[STRONG-impl] tailscale 全套:SDDL `O:BAG:BAD:PAI(A;OICI;GWGR;;;BU)(A;OICI;GWGR;;;SY)`(pipe_windows.go:31)、客户端 Identification-level 拨管(:20-26)、服务端 ImpersonateNamedPipeClient 提 token(:170-198)、跨用户 last-user-wins+SYSTEM 例外(ipnserver/server.go:255-287)。
Adopt:token 文件+组权限分级+ConstantTimeCompare;peercred 读写分档;先 dial 后删;LOCAL_PEERPID→provenance 链→UI 显示调用方;敏感操作 agent 侧自弹确认默认拒;Windows SDDL+impersonation 全套。Avoid:无条件 unlink;"算了不 gate"的 code-sign 检查(采则必须 gate 或明写仅展示);0666 token+lsof 解析;若选 out-of-scope 须像 ssh-agent 显式写成代码+文档。
未知项:tailscale Windows 权限模型改造(corp#18342 私有仓);peercred 库内部未读;secretive witness 否决钩子是否真 throw(INFERRED 主 gate 在 Keychain 层)。

### 1.6 LiteLLM + OTel semconv(D-5/usage 归因;抽查✓:schema.prisma:12-20、auth_checks.py:3538-3541 isfinite、gen-ai.md:64/203/205 吻合)

LiteLLM(b200d664eec1,STRONG-impl):
- **预算 carrier**:独立 LiteLLM_BudgetTable{max_budget/soft_budget/max_parallel_requests/tpm_limit/rpm_limit/model_max_budget(Json)/budget_duration/budget_reset_at}(schema.prisma:12-35)被 org/project/key/end_user/tag/membership 多实体外键共享 + 热路径实体(key/team/user)内联复制双轨(:420-431,127-140,244-257)。
- **强制点=admission(pre-call)硬闸 + settle(post-call)异步批量落账**:auth 阶段 budget_checks(user_api_key_auth.py:1821-1841;common_checks 调用点 auth_checks.py:670-707);超限抛 BudgetExceededError;读数 Redis-first 跨 pod 计数器+DB reseed fallback(proxy_server.py:2061-2098);批量落账 update_spend interval job。防 NaN 绕过:math.isfinite 否则视为无限制(auth_checks.py:3538-3541,引 GHSA-2rv4-xv66-fpjg)。软降级:超预算按百分比 throttle 而非拒(:3464-3476)。
- **周期重置**:每实体 budget_reset_at 时间戳+interval 扫描 job(reset_budget_job.py:746-762;@@index(budget_reset_at),schema.prisma:459)——非 cron 表达式。
- **loop envelope 直接对标物**:max_iterations_limiter(per-session LLM 调用次数上限,Redis Lua INCR+TTL,429)+ max_budget_per_session_limiter(per-session 美元桶,INCRBYFLOAT+TTL 3600s)。并发/rpm/tpm=Redis Lua 原子 fixed-window,descriptor 按 api_key/user/team/end_user/model/agent/agent-session 展开(parallel_request_limiter_v3.py:110-140,1571-1601)。provider 熔断近似=router cooldown(allowed_fails+cooldown_time)。
- **SpendLogs schema(UsageEvent 可抄)**:request_id/call_type/api_key(hashed)/spend/tokens 三列/start|end|completionStartTime/model+model_id+model_group/custom_llm_provider/api_base/user/team/org/end_user/session_id/status/cache_hit/request_tags/agent_id/mcp_namespaced_tool_name(schema.prisma:590-629)+ SpendLogsMetadata 含 attempted_retries/max_retries、cost_breakdown(input/output/margin/discount)、usage_object 原始回执(_types.py:3194-3226)+六张日聚合表(:717-902)。
- **父子归因=无(NEG)**:grep parent_request/root_request/parent_id/sub_call 于 spend_tracking+_types.py 0 命中;只有扁平 session/trace_id——**root-child rollup 无人解,v3 须自建**。
OTel semconv(9e2eb2fd3016):
- **⚠ gen-ai 约定已整体迁出**本仓到 semantic-conventions-genai 新仓(docs/gen-ai/README.md:5-11 "no longer maintained here"),本仓 registry 表全标 Deprecated-Moved——词汇仍有效,SSOT 应 pin 新仓。
- usage 词汇[STRONG-spec]:gen_ai.usage.input_tokens/output_tokens(int)+cache_creation/cache_read/reasoning 子桶("SHOULD be included in" 总数的重叠子桶语义,gen-ai.md:62-66,203-207);**gen_ai.request.model vs gen_ai.response.model 分离**(请求别名 vs 实际执行版本,:39,49)+gen_ai.provider.name 枚举 discriminator(:34,114-129,245-263)+gen_ai.response.id/finish_reasons/request.seed+gen_ai.agent.id/conversation.id(:19,22)→ 伪独立共识 provenance 词汇现成。**成本/货币属性=无(NEG,grep cost 0 命中)**;context-hash 属性=无,需自造。
Adopt:双段式 enforcement;BudgetTable+reset_at 扫描;per-session iterations/dollar Lua 计数器;isfinite 防绕;attempted_retries 进 usage 元数据;OTel usage 命名+子桶语义+request/response.model 分离+provider 枚举。Avoid:root-child 归因缺位(必须自建);预算字段 5+ 表内联复制致 schema 漂移;异步批量落账崩溃窗口漏账;pin 本仓当 gen-ai SSOT。
未知项:semantic-conventions-genai 新仓增量未查;update_spend 批写失败最终一致细节;fan-out 子预算分割 litellm 无对应物(INFERRED-弱)。

### 1.7 River + Restate + Litestream(抽查✓:river_job.sql:213-222 claim SQL、job_completer.go:30-32、restate mod.rs:1344-1353、litestream db.go:47-53 吻合)

River(5f1913acdd96,STRONG-impl):
- **单语句 claim**:FOR UPDATE SKIP LOCKED+state→running+attempt+1+attempted_by 审计数组一条 SQL 完成(riverpgxv5 river_job.sql:200-237);SQLite 驱动版=单 UPDATE…RETURNING 靠单 writer 串行(riversqlite river_job.sql:139-164,INFERRED);无租约表——state='running' 即租约;**attempt 在 claim 时消耗**(crash 也计入预算)。
- **条件完成写**:一切完成写=JobSetStateIfRunning,SQL 里 CASE WHEN state='running'(river_job.sql:619+,640-642)——state 被 rescuer/cancel 翻走后迟到完成自动 no-op = v3 CAS phase 的 SQL 等价物。
- **completer=内存批量(AVOID)**:待完成集是内存 map,50ms tick/100 条/250ms 兜底刷,crash 丢完成记录→job 重跑(job_completer.go:256-347,INFERRED at-least-once)——v3 complete_task 必须同步落盘。
- **rescuer(reconciling 反例)**:纯时间阈值(默认 1h)不证明旧执行已死即重派(job_rescuer.go:28,280-286);裁决分支:cancel_attempted_at→cancelled/kind 未注册→discard/attempt<max→retry/否则 discard(:233-330)。**cancel_attempted_at 元数据值得抄**(收尸为 cancelled 而非重试)。
- unique jobs:sha256 组合 key+ByState 作用域,冲突返旧行+unique_skipped_as_duplicate 标志不报错(insert_opts.go:102-230;river_job.sql:314-320)= 幂等 insert 返旧 receipt 形态。cancel:非 running 直接 cancelled;running 只写 metadata+pg_notify 让执行方自己取消(river_job.sql:40-81)。
Restate(c024d4c5364c,STRONG-impl):
- journal 重放+**pinned deployment**(重试钉住首次执行的代码版本,invocation_task/mod.rs:465-502)。
- idempotency:invocation_id 由 key 确定性派生;重复请求三分支——Free→执行/in-flight→**新请求 sink 挂到既有 invocation(latch 模式)**/Completed→返存储的 response_result(state_machine/mod.rs:1272-1359)= v3 返旧 receipt 同构;无异 digest conflict 概念(v3 更强,保留)。
- **completion_retention 与 journal_retention 分离**且 journal≤completion(invocation_target.rs:91-112)——大 payload 短保留、小 receipt 长保留,直接支撑"结果过大 artifact 化"backlog。
- retry:max_attempts 缺省无限+**on_max_attempts ∈ {Pause, Kill}**(retries.rs:68-123;invocation.rs:151-222)——Pause=停住等人裁决,可作 v3 reconciling 第三出口。
Litestream(c96c0f42a51b,STRONG-impl):
- 三层 checkpoint:MinCheckpointPageN(~1k 页 PASSIVE)/CheckpointInterval(时间 PASSIVE)/TruncatePageN(~500MB TRUNCATE 阻塞应急上限);**RESTART 模式因 #724 无限阻塞写被永久移除**(db.go:47-62);PASSIVE 撞 BUSY=正常跳过(:1309-1312);wal_autocheckpoint(0) 全权自管(:988-989);敌人=长读事务阻塞 checkpoint→WAL 无界(:120-128)→ 应列入 v3 §11 监控告警原因清单。
Adopt:单语句 claim+IfRunning 条件写;cancel_attempted_at;unique 冲突返旧行;journal/completion 双保留期;on_max_attempts=Pause;pinned deployment;三层 checkpoint+BUSY 正常。Avoid:内存批量 completer;task-id 完全由 idempotency key 派生;RESTART checkpoint;锁表提升写锁 hack(v3 单 writer 直接 BEGIN IMMEDIATE)。
未知项:riversqlite 多进程附加互斥未深查;restate completion 落库 commit 批次路径未逐行;litestream restore/LTX 未读。

### 1.8 openai/codex(抽查✓:thread_manager.rs:1147-1153、exec_approval.rs:128-135 fallback Denied 逐字吻合)

(路径相对 codex-rs/;5bed6447998c,全 STRONG-impl)
- **mcp-server 工具面(DR-4 核证成立)**:工具仅 codex/codex-reply(message_processor.rs:326-356);codex 参数含 approval_policy/sandbox/config 覆盖(codex_tool_config.rs:25-63);thread 存内存 RwLock map,**get_thread miss 即 ThreadNotFound、不从 rollout 恢复**(core/src/thread_manager.rs:1147-1153;core 有 read_stored_thread 持久层但 mcp-server 未接,NEG:grep resume 仅一条注释)→ 重启后 codex-reply 返回 **isError result 文本 "Session not found…" 而非 JSON-RPC error**(message_processor.rs:464-476)——§9 需文本/字段双判。cancelled→Op::Interrupt(:523-568;map miss 仅 warn 静默,:534-536)。
- **审批 elicitation(D-2)**:payload=ExecApproval{message,threadId,codex_mcp_tool_call_id,codex_event_id,codex_call_id,codex_command,codex_cwd,codex_parsed_cmd}(exec_approval.rs:20-39)/Patch 版含 codex_reason/grant_root/changes(patch_approval.rs:21-36);**无任何 principal/身份字段**(NEG:grep principal|approver|approved_by|user_id 零命中)——宿主只给"批了什么"拿不到"谁批的"。响应反序列化失败→**保守 fallback Denied**(exec_approval.rs:128-135)。ReviewDecision 含 approved/approved_for_session(session 内存 cache)/approved_execpolicy_amendment(**持久化写 execpolicy 规则文件,跨 session**,core/src/exec_policy.rs:376-394)/denied(default)/timed_out/abort(protocol.rs:4045-4078)。**mcp-server 转发有损**:reason/available_decisions/amendment 提案全部丢弃(codex_tool_runner.rs:219-251)——富审批要走 app-server 或自补。
- **沙箱=effect-bound 强制(D-3 最强同类)**:seatbelt (deny default) 起底(seatbelt_base_policy.sbpl:9);writable_roots 编成 subpath allow + require-not 排除(literal+subpath 双排除)(seatbelt.rs:366-390,659-677);顶层 .git(含 worktree gitdir 解析)/.agents/.codex 预保护为 read-only subpath(permissions.rs:1593-1630);Linux legacy landlock **丢弃 read_only_subpaths**(只能加白无法挖洞,landlock.rs:78-83)→ .git 保护弱于 macOS。
- **escalation 抗 TOCTOU 范式(D-3 关键)**:沙箱失败→仅 untrusted/granular 才问人(Never/OnRequest 直接把失败还给模型不升权,sandboxing.rs:351-358)→ 重跑前**强制新审批+新 run id `{call_id}:retry`**(审批绑定 attempt 而非命令文本,orchestrator.rs:396-420)→ 有 denied-reads 的策略**永不**无沙箱重跑(sandboxing.rs:279-284)——审批与 effect 上限正交。
- 杂项核证:tui_app_server Stage::Removed(features/src/lib.rs:1316-1320);memories 键 generate_memories/use_memories 默认双 true(config/src/types.rs:285-338)——F2/F14 印证。
Adopt:①elicitation 关联字段形状+broker 补 principal;②反序列化失败 fallback Denied;③retry=新审批+attempt 级绑定;④root+carve-out 三级词汇表达 effect 边界。Avoid:①依赖 codex-reply 跨进程续 thread;②把 mcp-server elicitation 当完整审批面;③静默 map-miss;④ApprovedForSession 无 TTL 无落盘审计(broker 侧 always 需作用域声明+审计)。
未知项:bwrap 后端是否补 landlock .git 缺口;GranularApprovalConfig 消费点;execpolicy 落盘路径。

### 1.9 Biscuit + Cedar(D-3;抽查✓:crypto/mod.rs:7-10、partial_response.rs:121-127、Approval… 均吻合)

biscuit-rust(58a39757edfb,STRONG-impl):
- 离线衰减=Ed25519 签名链+next-key 交棒:每块签名覆盖 payload+next_key+PREVSIG(域分隔标签 `\0PREVSIG\0`,crypto/mod.rs:673-701);token 只携带末块 next 私钥(proof),下游无法截断链恢复宽权限(format/mod.rs:399-404,490-499);sealed=签终结签名后丢弃秘钥、不能再 append(:517-537)。
- check=块内嵌 datalog 操作级约束(operation/resource_prefix/expiration,token/builder/block.rs:315-368);**ambient facts(operation/time)由验证方注入**,非请求方自称(builder/authorizer.rs:255-259);合成:allow 命中但 errors 非空仍 Unauthorized、无 policy 命中默认拒(authorizer.rs:627-640)。
- **origin 污点模型现成**:每 fact 带 Origin{block_id 集},规则按 TrustedOrigins 超集过滤(datalog/origin.rs:14-16,98-139)——user/agent_rpc 当块号即可复用。
- 第三方 block 签 previous_signature=授权绑定具体 token 实例(third_party.rs:33-40,113-118)= operationHash 思路的密码学同构。revocation id=每块签名字节、唯一(token/mod.rs:200-212);**一次性消费/nonce=库外**(NEG:grep nonce|one.time|single.use 仅符号表命中)——必须 broker 内建消费表。
cedar(643095f4b43e,STRONG-impl):
- forbid 覆盖 permit+默认 deny 的五臂合成(partial_response.rs:121-139);**策略求值错误=当该策略不存在(Skip)**——对 forbid 是危险方向,v3 deny 规则求值错误应整体 fail-closed(authorizer.rs:56-61)。
- PDP 纯函数零 I/O,entity/context 全由 PEP 构造(authorizer.rs:76);schema 闸门 typecheck context/principal 类型(request.rs:174-192;coreschema.rs:170-260);**绕过口 Request::new_unchecked 勿暴露给 RPC 边界**(request.rs:221-233);context 来源真实性引擎不管(NEG:grep attest|authoritative|provenance 零命中)——"不能自称 origin"由 broker(PEP)保证。
映射:operationHash=精确绑定,Biscuit check=谓词绑定,可叠加(内层 operationHash 精确锁+外层谓词衰减);审批 token 不需再委托则直接 sealed;effectivePolicy=两家一致答案"可信输入由 PDP 宿主注入";嵌 Cedar vs 手写:v3 策略四元且条数少→手写合成 15 行+表驱动即可,用户可扩展策略时再考虑 Cedar。
Adopt:域分隔标签构造 operationHash preimage+版本号签进去;PREVSIG 模式让审批 generation 成链;TrustedOrigins 超集语义;拒绝时给"哪条约束没过"清单(FailedCheck/policy id)。Avoid:一次性消费推给应用层无存储约定;Skip 错误策略;new_unchecked 后门;seal 的 v0 遗留拼接。
未知项:Biscuit 规范文本在别仓未读;cedar-spec 形式化模型未读;symcc 静态审计可作后续调研点。

### 1.10 HumanLayer + Omnara(D-2;抽查✓:store.go:237-248、sqlite.go:2879-2889 条件 UPDATE、notification_utils.py:48-55 吻合)

humanlayer(99abe673498c,STRONG-impl;现形态=CodeLayer 本地 daemon hld+桌面 WUI,给 Claude Code 做审批中枢,D-2 最直接同类):
- Approval 模型 {ID,RunID,SessionID,ToolUseID,Status,CreatedAt,RespondedAt,ToolName,ToolInput,Comment}(store.go:237-248)——**无 approver/principal 字段**(NEG:handlers 无身份传递)。一次性=先读拒 AlreadyDecided+条件 UPDATE WHERE status=pending 双保险(sqlite.go:2879-2889)。
- 拦截点:daemon 启动 session 时强制注入 MCP server+设 PermissionPromptTool=mcp__codelayer__request_permission(session/manager.go:203-259);批准回传=REST decide→store 更新→eventBus 事件→阻塞中的 MCP handler 唤醒→{behavior:allow|deny} 回 Claude Code(approval/manager.go:150-183;mcp/server.go:223-257);stdio 变体 1s 轮询(avoid,用事件版)。
- 拒绝必须带 comment、批准不必(approvals.go:152)——deny 理由回传给 agent 是可执行反馈;**无超时**(注释掉了,mcp/server.go:195-198)→ 审批可永久 pending(D-6 反面教材);**本地 REST 无认证**(middleware 仅 request-id+gzip)→"任何本机进程可批"——v3 的"转述不算审批"红线在这套里守不住;**批准不校验 input 漂移**(updatedInput 直接回显请求方所给,mcp/server.go:151-152)——无 operationHash 绑定实证。
- 通知=焦点感知三分路(blurred→OS 通知/正看该 session→抑制/否则 in-app toast)+approval 通知 sticky+按 approvalId 稳定去重+resolve 撤回(NotificationService.tsx:232-265,485-492)——"上下文抑制+去重"型,无频率限流。旧 SDK contact channel(slack/email)已不在活代码(NEG:grep 仅 types 残留)。
omnara(500a82ad85ba,STRONG-impl;⚠2025-12-27 后未更新,低活跃):
- 提问=PATCH request-input 置 requires_user_input+AWAITING_INPUT+通知(routers.py:489-551);等答=SDK 长轮询(默认 1440 分钟!);注回=**PTY 键击注入**+权限 prompt=**终端刮屏正则**(claude_wrapper_v3.py:940-984,1236-1273)——脆弱,v3 有结构化 RPC 不可学;但 **unmatched 回答→默认选最大编号选项(通常=No,fail-safe deny)**值得抄(:1240-1254)。
- **attestation 比 humanlayer 强**:每答案落库带 sender_user_id+WRITE access 门+RS256 JWT principal(backend/db/queries.py:1014-1030;auth.py:40-47);但审批本体=非结构化文本消息,服务端不知道它是审批、不绑操作。
- 通知防疲劳=**类型分级**:问题类按用户偏好(push 默认开)、进度 step 默认全关(notification_utils.py:48-63)+token 去重;无频率节流(NEG:grep throttl|rate.limit|cooldown 无通知类命中)。D-6 部分有解:push 未配置→静默降级 pull 模式、不阻塞 agent(notifications.py:41-55)。onboarding 好:裸跑→开浏览器→state 校验回传 key(cli.py:309-336)。
**横向**:两仓互补——humanlayer 有拦截点+一次性消费+回传管线但无身份;omnara 有身份绑定+通知分级+onboarding 但审批非结构化。**v3 D-2 空位(approval token 绑 principal+task+operationHash、转述不算审批)两家都没做到=差异化实证。**
Adopt:条件 UPDATE+AlreadyDecided;permission-prompt-tool 拦截点+per-session env 注入;焦点感知抑制+approvalId 去重撤回;deny-must-comment;sender_user_id+WRITE 门+JWT 三件套;通知类型分级;stale 游标防重复消费;unmatched→最保守选项;浏览器 state-handshake onboarding。Avoid:审批记录无 approver;无超时僵尸 pending;本地 REST 无认证;不校验 operationHash/input 漂移;刮屏审批;问题无过期;明文存 JWT。
未知项:hld JSON-RPC 老协议行为(INFERRED 与 REST 等价);omnara mobile 渲染未核。

### 1.11 同类桥/编排五仓(抽查✓:daemon.go:51-52 TapEnter、claude.rs:168 stdio、PermissionResponse 接口、send-claude-message.sh:17-23 吻合)

**claude-squad**(5a604f76fc94):实例=tmux+worktree,身份=Title 字符串(碰撞即混,storage.go:107,132);**AutoYes 反面教材**:daemon 轮询 pane 文本串匹配 "No, and tell Claude…" 即盲按回车(daemon.go:51-52;tmux.go:243-246);**trust prompt 无条件自动按掉不受 AutoYes 门控**(tmux.go:157-180)。无队列/lease/验收/预算(NEG grep 全仓)。D-1..D-6 全无解。
**vibe-kanban**(4deb7eca8f38):Task→Workspace(attempt)→Session→ExecutionProcess 模型(SQLite);完成判定=exit code==0 才 auto-commit(container.rs:529-558)——exit-code=验收(avoid);**D-2 部分解(族内最完整结构化审批)**:`--permission-prompt-tool=stdio` 外化 CC 权限提问(claude.rs:168)→ ApprovalRequest{id,tool_name,execution_process_id,timeout_at=10h}→WS 推送→POST respond;但**审批状态纯内存 DashMap 重启即丢、respond 无 caller 身份、且有 NoopExecutorApprovalService 一律返回 Approved(洗白后门现成样本,approvals.rs:56-90)**。`--resume-session-at` 截断式 fork 恢复、QueueStatus 排队 follow-up、run_reason(SetupScript/CodingAgent/DevServer)= effect 分类雏形可借鉴。无预算(NEG)。
**happy**(3f161de70541;monorepo 实含 cli/server/app 全链路):**远程人批链路完整+E2E 加密**:CC canCallTool→pending+push→手机 sessionRPC→PermissionResponse resolve(permissionHandler.ts:367-407);但 **PermissionResponse 无 approver/deviceId 字段**(:15-23,NEG)——身份粒度=账号(能解 dataKey 的任何设备都能批),**手机可直接授 bypassPermissions 无二次确认**(PermissionFooter.tsx:166,181);(accountId,tag) 幂等 session 归属+seq+localId 去重+审批历史随 agentState 版本号同步全端(adopt);UsageReport 表=per-session usage 归因参照;通知无节流(NEG,仅重试退避)。
**ruflo(原 claude-flow)**(8161a088c8e8):**营销>>实现核真坐实**:v3/src SwarmCoordinator 479 行,spawnAgent=内存对象,**无任何 child_process/spawn 调用(NEG grep 0 命中)**——"swarm"不启动真实进程;attention-coordinator 文件头自带审计承认 "speedup unverified";lease/审批/预算全无。价值=反面教材:术语通胀污染检索。证据强度:中(40 万行未全读,调度真实性高置信)。
**Tmux-Orchestrator**(7193530291e5,1 年未动):全部机制=tmux send-keys 盲注入+sleep(send-claude-message.sh:17-23;schedule_with_note.sh:24 nohup sleep,含作者机器硬编码路径)——无身份/确认/回执的反面教材核心。
**族内横向结论**:该产品族解决"多 agent 摆放"(worktree 隔离=族内共识;happy 的跨端状态同步=工程上限);**集体缺失恰好覆盖 v3 全部开放决策:D-1 push token 无人做、D-2 无 attestation/durable 记录、D-3 无 origin 染毒、D-4 无人意识到、D-5 预算为零、完成验收=exit code 或没有**。可直接借鉴仅三件:stdio 权限桥、happy 归属模型、run_reason 分类。

### 1.12 Inngest(抽查✓:httpdriver.go:298-303 ErrNotSDK、checkpoint/types.go:50-52 GenerationID、runner.go:392-402 吻合)

(cfb6badf0d52,STRONG-impl;纯 push 执行引擎=D-1 最直接参照)
- **push 且 broker 全权裁决**:executor HTTP POST 到 SDK(httpdriver.go:147-172,MaxFunctionTimeout=2h);状态码即裁决:206=generator opcodes、非 2xx=SetError、**2xx 但缺 SDK 标头→ErrNotSDK 判失败**(防"碰巧 200 的非 worker"误判成功,:298-303);worker 无完成凭证(NEG:grep completiontoken/complete_task/claim 零命中),仅能经响应头建议(x-inngest-no-retry/retry-after,headers.go:104,110);**async checkpoint 路径的 fencing 等价物=GenerationID**:SDK 回报须 echo 派发代际,不符→ErrStaleDispatch(checkpoint/types.go:50-52;checkpoint.go:737-742)——"代际号只防陈旧不授权完成"。
- retry 预算:per-step maxAttempts 默认 4/硬顶 20(consts.go:10;function_step.go:26)+查表 backoff 封顶 2h;超限永久 Dequeue。
- **flow control 三件套语义分明(D-5/attention)**:ratelimit=GCRA-in-Lua 入口丢弃(**持久滑窗=Redis TAT 键+TTL**,ratelimit.lua:128,151-165)/throttle=GCRA 超限 item 滞留 backlog ZSET 不丢(backlogRefill.lua:14-20)/concurrency=account/function/custom-key 分层闸+新版 capacity-lease(constraintapi/lua/acquire.lua);debounce 独立队列项;priority=从排序时间戳减 priorityFactor(item.go:231-233)。attention 小时上限适合 throttle 语义,GCRA+TAT 直接可抄。
- 幂等:key 派生链(显式>runID>event ID>batch ID)+state/queue 双层 exists(executor.go:591-614;redis_state.go:382-391);rate-limit 决策本身幂等化防重试双扣(executor.go:975)。
- **fan-out/join 免 join 表**:并行步=独立 queue item;join=pending 计数+coalesced 幂等 continuation job(JobID 含 coalesceKey,executor.go:5739-5741,3822-3826);部分失败不自动取消兄弟步。
- **invoke 无深度/hop 防护(重要负面证据)**:grep recursion/max.depth/hop 于 execution/ 全部零命中,A→B→A 可无限互调只靠配额减速(NEG)——**v3 双 agent 互驱必须自建 hop 计数/祖先链,业界 push 引擎也没做**。
- waitForEvent:pause=一等持久对象+独立超时队列项;**pause 写失败即永挂**("hang forever" 注释,executor.go:5095-5099)——waiting_callback 登记须与触发 job 同事务或有 janitor。
- **D-6 参照**:invoke 不存在的函数=同步 typed error 经正常 completion 通道回 caller(runner.go:392-437),不静默排队、不新增错误旁路。
Adopt:①push 路径 broker-judged+completionToken 退化为内部 GenerationID fencing 不发给 worker;②响应必须带协议标头自证身份;③throttle 与 ratelimit 分语义;④幂等 continuation join。Avoid:①无 hop 防护;②成败裁决散在四层(NoRetry 三处被改写)应收敛单点;③pause 写失败永挂。
未知项:connect(WS worker)响应真伪校验未深读;constraintapi 与旧闸灰度关系;云端 checkpoint 鉴权强度。

### 1.13 Codex 独立扩展轮:SPIRE / DBOS / Hatchet / Turmoil / D-Bus(我方 spot-check 4/4 通过:uds_linux.go:9-21、_core.py:1890-1907、dbus-connection.c:5338-5347、matches.sql:83+ 逐字吻合)

方法注记:Codex 受 `.git` 写禁令约束未 clone,改用 commits API 锁 HEAD+精确 SHA tarball+`git ls-remote HEAD` 复核+tarball SHA-256 记录(等价 pinning,五仓 SHA-256 均在 Codex artifact 中);含两轮内部 critic 自审,主动收窄数条过度断言(Hatchet join 范围、ack 措辞、SPIRE macOS 活性定性)。

- **spiffe/spire**(0f66c130,2026-07-09,Apache-2.0):**D-4 in-scope 四级证据链**=内核 peer(SO_PEERCRED,pkg/common/peertracker/uds_linux.go:9-21)→PID 生命周期防复用(/proc fd+starttime 使用时复核,tracker_linux.go:55-168)→可执行映像 selector(path/sha256 opt-in,unix_posix.go:179-200)→策略子集匹配(lru_cache.go:1031-1053)。**macOS 仅 LOCAL_PEERPID+异步 kqueue+250ms 检查=PID-reuse 缓解、非无竞态绑定;Node/Electron 场景 exe 哈希只证明共享解释器≠shim 代码身份(v3 硬缺口,须 native launcher/code-sign 补)**。Windows named-pipe→SID/group/path selector 单列。selector-keyed 稳定哈希 rate limit(ratelimit.go:45-92)可作 attention 计数 key。D-2 启示:字段拆 `presentedByEndpointAttestationRef` vs `humanGestureAttestation`。avoid:endpoints_posix.go:13-33 chmod 0777 默认;optional-attestor 并集的部分成功语义。
- **dbos-inc/dbos-transact-py**(e9e35157,2026-07-13,MIT):**嵌入式 durable execution=v3 架构最近表亲**(库内进程+默认 SQLite,_dbos.py:538-598;_dbos_config.py:443-447)。queue claim=事务内 FOR UPDATE+状态谓词更新(**无 lease/token/fence/heartbeat**,_sys_db.py:3921-4005);**同 app-DB transaction=effect+checkpoint 同事务 OAOO 正例 vs 普通 step=先 effect 后记账 crash window 反例**(_core.py:1585-1657 vs 1890-1907);重复 workflow ID 不验 input digest(tests 实证允许异输入,反向佐证 v3 digest+conflict 设计);terminal UPDATE 只 fence CANCELLED 无 revision/digest/receipt;wait_first=持久化 join 但 first-terminal 硬编码(joinPolicy 须显式化的佐证);**child timeout 覆盖父 deadline(v3 应取 min,avoid)**;版本亲和 dequeue(app_version 匹配+versionless 仅 latest 领)=半升级路由参照;SQLite 纪律=BEGIN IMMEDIATE+busy 30s+FK+migration 单行,**无 WAL/无单 writer actor(负检索证实,勿照搬)**。
- **hatchet-dev/hatchet**(d2560099,2026-07-14,MIT):**join algebra=扩展轮最大新增**——同 action 内"组内 OR、组间 AND"(sqlcv1/matches.sql:83-108),跨 action 裁决优先级 `SKIP>CANCEL>CREATE>QUEUE>CREATE_MATCH`;默认 DAG=每 parent-complete 独立 group+fail/cancel 共享 group=all-success/any-failure(trigger.go:1045-1079,1750-1843)→ v3 joinPolicy 可持久化为 `{withinGroup, acrossGroups, outcomePrecedence}` 三字段。**assignment receipt ack 未实现**(proto 有 ACKNOWLEDGED 占位、服务端 TODO、Python SDK 以提前 STARTED 顶替,subscribed_worker_v1.go:46-54)=把完成建在未实现回执上的风险实证;completion 无 digest/token(scoped 负检索);**retry_count optional、缺失回填 DB 当前值=代际关联丢失漏洞(v3:attempt 必填、缺失即拒,勿回填)**;rate limit reserve/ack/nack 形态可借鉴但 ack 后先入内存 unflushed 再异步落库=**commit→ack、ack→flush 双丢记账窗口(D-5:计费预算必须与 assignment/outbox 同事务)**;HARD/SOFT sticky=worker-ID affinity 非 pinned session(HARD 空 ID 时任意 worker;每注册新 UUID);半升级=semver 探测+精确 UNIMPLEMENTED 单调降级(窄 fallback,非 capability 协商)。
- **tokio-rs/turmoil**(481407d3,2026-05-27,MIT):确定性模拟补 toxiproxy 不可重放缺口,但**默认不可重放**——seed 默认 from_os_rng、epoch 默认 now(),复现须显式固定 seed/epoch/host 注册顺序(builder.rs:191-215;config.rs:95-106);hold/release、单向 partition、crash/bounce+未 sync 写丢失(sim.rs:156-288,385-527);**turmoil-fs 可注入 ENOSPC/EIO/corruption/short read/torn write**(turmoil-fs/lib.rs:555-681,1287-1325)→ §11/§15 故障矩阵直接可用;**UDS shim 仅 TODO、barriers 标 unstable 且文档示例方法不存在**(负面);Rust FS shim 截不了 Node/原生 SQLite 的 syscall——**真实 SIGKILL+SQLite 故障 gate 仍不可替代**。Codex 实跑 cargo test 3 项通过(hold_and_release/data_loss_without_sync/disk_capacity_enospc)=动态验证 artifact。
- **dbus/dbus**(f64ae3ca,2026-07-01,AFL-2.1/GPL-2.0 双许可;**canonical=GitLab freedesktop,GitHub d-bus/dbus 是停在 2020 的 placeholder**):**D-4 out-of-scope 分支最精确表述**="除 root 外,同 UID 内所有进程均可信"且为显式代码(默认 allow 谓词=same-UID+root,dbus/dbus-connection.c:5338-5347)+session.conf.in 显式姿态(EXTERNAL 认证后任意 send/own);内核凭据分层 SO_PEERCRED→SO_PEERSEC(LSM 标签)→SO_PEERPIDFD(pin 进程对象仍非 code hash)(dbus-sysdeps-unix.c:2074-2356);**D-6 有界 activation 决策树=扩展轮第二大新增**:owner 存在→发送;有 .service 声明→有界排队(pending 硬上限+per-activation timeout+同目标合并+成功重放 pending/失败 typed error);无声明/禁自启→立即 ServiceUnknown/NameHasNoOwner;执行中断连→合成 NoReply——**绝不无界排队**(bus/dispatch.c:420-474;bus/activation.c:1684-2044;bus/connection.c:1768-1905);**daemon 强制重写 sender=「origin 字段只能由 broker 写」的现成先例**(bus/dispatch.c:356-377);认证后把 default→groups→UID→console→mandatory 展平成 per-client policy=effectivePolicy 派生先例(bus/policy.c:280-373);NEGOTIATE_UNIX_FD 失败仅关该能力、基础连接继续=单能力降级模板(dbus-auth.c:1934-2194);Windows peer PID→SID 独立分支(dbus-sysdeps-win.c:2214-2233)。avoid:「最后匹配规则胜出」的顺序敏感;纯内存 pending hash/list 承担 durable 义务。

**扩展轮双路收敛(调研级建议,非填决策)**:D-1 双路一致=broker 内部合成 claim/lease、completion capability 由 adapter(broker 进程侧)持有、adapter 判协议级成败;D-4 维持两分支不裁决(SPIRE=in-scope 证据链,D-Bus=out-of-scope 诚实边界);D-5 增"reservation/settle 与 assignment/outbox 同事务"硬教训;D-6 收敛为 typed policy 三分支 `require_pinned | activate_if_supported | soft_fallback` + D-Bus 式有界等待树;joinPolicy 落为三字段持久化模型;attempt/generation 必填不回填。

## 2. D-1..D-6 映射汇总(别人怎么解/无人解)

| 决策 | 有解的仓 & 形态 | 无人解/反面 | 对 v3 的方向性启示(不替用户拍板) |
|---|---|---|---|
| **D-1 push 路径 token 生命周期** | **Inngest(最直接)**:push=broker 全权裁决,worker 无完成凭证,响应通道即完成通道,worker 仅有"建议权"(no-retry 头);回报型路径用 GenerationID fencing(echo 代际,防 stale 不授权)。**MCP Tasks**:receiver 独占成败判定、无 complete RPC,requestor 只 poll。**Temporal**:token=明文 fencing 元组(attempt/version),判成败=broker 状态比对非 token 校验。**River**:executor push 完成+条件写+rescuer 兜底。**A2A**:push-config 绑任务终态、per-config 单用途 token | 同类桥族全体无人做 | 三家大系统共同点:**"谁判成败"始终是 broker,completionToken 不是交给 push worker 的秘密而是 broker 内部 fencing**。v3 push 路径可采"内部合成 DispatchAttempt+lease,completionToken 由 adapter(broker 进程内)持有,worker 响应经协议标头自证+代际 echo" |
| **D-2 人类审批路由** | **HumanLayer**:拦截点(permission-prompt-tool)+一次性消费(条件 UPDATE+AlreadyDecided)+事件回传管线,但无 approver 身份。**Omnara**:sender_user_id+WRITE 门+JWT(有身份),但审批=非结构化文本不绑操作。**happy**:E2E 远程批,无 approver 字段+可远程授 bypassPermissions。**vibe-kanban**:结构化 approval+timeout+deny-reason,但内存态+Noop 后门。**codex 宿主**:elicitation 有完整操作上下文(command/cwd/diff/call_id)**无 principal 字段**(实证);失败 fallback Denied。**MCP spec**:审批路由回任务发起方 surface;elicitation accept=显式提交;身份 MUST NOT 只绑 session;sampling 人审仅 SHOULD。**secretive**:per-request 硬件 attestation(Touch ID)+UI 显示调用方 | **"approval token 绑 principal+task+operationHash"全行业无人做**(humanlayer 连 approver 都不记;happy/omnara 记人不绑操作)| v3 的 D-2 空位是真差异化;可组装:codex elicitation 字段形状+broker 补 principal+omnara 三件套 attestation+humanlayer 一次性消费+secretive 式"UI 呈现调用方+人过硬件闸"+MCP"回发起方 surface"路由原则 |
| **D-3 effect-bound origin 强制** | **codex 沙箱(最强同类)**:OS 层 deny-default+writable-root+carve-out;**escalation=新审批+新 run id(attempt 级绑定,抗 TOCTOU 现成范式)**;denied-reads 永不无沙箱重跑(审批与 effect 上限正交)。**Biscuit**:origin 污点=fact 带块号集+TrustedOrigins 超集过滤(现成模型);第三方 block 签 previous_signature=授权绑实例的密码学同构;域分隔标签+版本号签进 preimage。**Cedar**:可信输入由 PEP 注入;forbid 覆盖 permit 默认 deny | Skip 错误策略(Cedar)对 forbid 危险;landlock 丢 read_only_subpaths;审批不校验 input 漂移(humanlayer);一次性消费无人内建 | operationHash=精确绑定与 Biscuit 谓词绑定可叠加;审批绑 attempt 而非命令文本;nonce 消费表必须 broker 内建;deny 规则求值错误整体 fail-closed |
| **D-4 same-UID 信任边界**(两分支采证,不裁决) | **in-scope 三档**:①secretive:LOCAL_PEERPID→provenance 链→per-request Touch ID(人+硬件,最强);②tailscale macsys:token 文件 0640 root:admin 组权限分级+ConstantTimeCompare;③tailscale unix:peercred 读写分档(同 UID=rw、他人=RO)。附:XPC setCodeSigningRequirement 一行钉 team(仅适用自签双方) | **out-of-scope 范式**:ssh-agent getpeereid 仅拒他 UID、同 UID 全信——**边界是显式代码+文档立场非沉默**;缓解=per-key opt-in confirm(agent 自弹 UI 默认拒)。tailscale 把 same-UID=rw 写死也是显式声明。同类桥族无人意识到该问题 | 两分支都有可抄的工程形态;若 out-of-scope 须像 ssh-agent 显式写进代码+威胁模型;若 in-scope 有零交互(peercred/组权限)到人在环(attestation)的连续谱 |
| **D-5 budget/loop envelope** | **LiteLLM(carrier 字段最全)**:BudgetTable{max/soft_budget,tpm/rpm,duration,reset_at}+admission 硬闸+settle 异步结算+per-session iterations/dollar Lua 计数器+isfinite 防绕。**Temporal**:maxAttempts+expirationTime(时间优先)+backoff 三层正交+blob/history 双阈值。**Inngest**:per-step attempts+GCRA 三件套(丢弃/滞留/并发分层)。**Restate**:on_max_attempts=Pause(第三出口=等人) | **hop/depth/循环防护全行业空白(Inngest 实证零命中)**;fan-out 子预算分割无人做;root-child 成本归因无人做(LiteLLM 仅扁平 session)| 预算 carrier/强制点/重置全有得抄;**loop envelope 的 hop 计数/祖先链必须自建**——这正是 v3 双 agent 互驱的第一级风险,业界无先例 |
| **D-6 ask_claude 空 pin 行为** | **Inngest**:目标不存在=typed error 经正常 completion 通道立即回(不静默排队);**A2A**:协商失败 fail-fast 不隐式挑目标(spec 明言防 silently losing functionality);**MCP**:无法识别 requestor 时收窄可见面;**Omnara**:push 未配置→静默降级 pull、不阻塞 agent;**humanlayer 反面**:无 UI 时审批无限挂起 | — | 三个可组合分支:typed error(立即失败)/fail-fast 拒绝(不隐式挑)/降级 pull+onboarding 提示(omnara 的浏览器 state-handshake 是 day-one 样板);唯一反面=无限挂起 |

## 3. Round-8 backlog 映射汇总

| backlog 项 | 证据与形态 |
|---|---|
| attention 每小时上限(持久滑窗) | **Inngest GCRA+Redis TAT 键+TTL=持久滑窗现成实现**(ratelimit.lua:128,151-165);throttle(滞留)vs ratelimit(丢弃)语义分开,attention 适合 throttle;Temporal token bucket+per-key map limiter;LiteLLM Lua fixed-window+per-entity descriptor。SQLite 等价物需自写,算法可直抄 GCRA |
| fan-out joinPolicy | Temporal:服务端只做 parent-close 传播(ABANDON/TERMINATE/CANCEL),join 留应用层;Inngest:pending 计数+coalesced 幂等 continuation job 免 join 表;A2A:明确甩给客户端;**Hatchet=明确反例(§1.13):有组内 OR/组间 AND/固定 outcome precedence 的 action-group algebra**。**结论:多数引擎把结果聚合留给应用层,但 Hatchet 证明服务端可承载 join 语义;v3 宜落为显式三字段 `{withinGroup, acrossGroups, outcomePrecedence}`(design-stage 推论,非现成通用 API)** |
| 多 agent 伪独立共识(provenance) | **词汇现成**:OTel gen_ai.request.model vs response.model 分离+provider.name 枚举+response.id/seed+agent.id/conversation.id(注意 SSOT 已迁 semantic-conventions-genai 新仓);**A2A Artifact 无 provenance(负面实证)**;context-hash 属性无人定义需自造;共识降权机制全行业无人做 |
| 半升级协商 | **MCP 三层**:版本协商(不认则断连)+能力矩阵(exhaustive+tool 级 required/optional/forbidden 双向 -32601)+SDK wire-era 物理注册表(-32601 by absence,出站本地典型化死);**A2A**:每请求版本头+同 endpoint 多版本并存+有序 interface 首选;**Temporal**:build-id ramp 按 workflowID 确定性哈希+PINNED/AUTO_UPGRADE+新版本必须全 queue 覆盖才 ramp。三家可组合成 v3 的 min/max+N±1 方案 |
| usage 归因 | LiteLLM SpendLogs 列集+SpendLogsMetadata(attempted_retries/cost_breakdown/usage_object)+六张日聚合表;OTel usage 命名+子桶包含语义;**root-child rollup 全行业无人做(LiteLLM 负面实证)**——v3 root_task_id/parentTaskId 归因须自建 |
| effectiveVerificationPolicy | Cedar/Biscuit 一致答案:**可信输入由 PDP 宿主(broker)注入,请求方只能声明请求**;Temporal:server 侧 EnsureDefaults 补全 retry policy=请求可缺省、broker 派生生效值的先例 |
| Claim/Complete conformance 缺口 | River:单语句 claim(CAS+attempt+审计一体)+IfRunning 条件完成写+unique 冲突返旧行;Temporal:同 requestID 幂等 start+attempt fencing+**完成即删的反例**;Restate:Completed 返旧 result(returning-receipt 同构);MCP:终态 tasks/result 原样重放+TTL 过期可否认(receipt 保留期≥重试窗口);sibling offer 竞态=River SKIP LOCKED/Temporal TaskAlreadyStarted 两种形态 |
| Day-one/Quickstart | Omnara 浏览器 state-handshake onboarding(裸跑→开浏览器→回传 key)是唯一正面样板;humanlayer 无 onboarding+无超时=反面;**"安装→信任→升级重信任"链全行业无对应物(Codex hooks hash 信任是 v3 独有约束)** |
| Windows | tailscale 全套:SDDL(BU+SY)+Identification-level 拨管+ImpersonateNamedPipeClient 提 token+last-user-wins+SYSTEM 例外;openssh 无 Windows agent 实现 |
| G1-G5 追溯矩阵 | 无人解(所有仓均无需求→字段追溯工件);属文档工程,自建 |

## 4. 抽查记录(anti-hallucination spot-check,主会话亲自 grep/sed)

每 agent ≥1 条引文核验,12/12 通过,零偏差;Codex 扩展轮另 4/4 通过(13 号条目):
1. MCP:tasks.mdx:398-399/456-458、codec.ts:25-31、server/CHANGELOG.md:262-263 ✓
2. A2A:a2a.proto:187-208、life-of-a-task.md:83-96、task_manager.py:211 ✓
3. Temporal:activity_util.go:63-73、retry.go:96-111、consts/const.go:44-47 ✓
4. Inngest:httpdriver.go:298-303、checkpoint/types.go:50-52、runner.go:392-402 ✓
5. River/Restate/Litestream:river_job.sql:213-222、job_completer.go:30-32、state_machine/mod.rs:1344-1353、db.go:47-53 ✓
6. Tailscale/OpenSSH/Secretive:ssh-agent.c:1980-1990、ipnauth.go:191-194、SigningRequestTracer.swift:46-52 ✓
7. HumanLayer/Omnara:store.go:237-248、sqlite.go:2879-2889、notification_utils.py:48-55 ✓
8. 同类桥五仓:daemon.go:49-53、claude.rs:166-170、permissionHandler.ts:15-23、send-claude-message.sh:17-23 ✓
9. codex-rs:thread_manager.rs:1147-1153、exec_approval.rs:128-135 ✓
10. Biscuit/Cedar:crypto/mod.rs:7-10、partial_response.rs:121-127 ✓
11. LiteLLM/OTel:schema.prisma:12-20、auth_checks.py:3538-3541、gen-ai.md:64,203,205 ✓
12. Toxiproxy:proxy.go:110-114、cmd/server/server.go:70、grep unix 全仓 ✓
13. Codex 扩展轮(SPIRE/DBOS/Hatchet/Turmoil/D-Bus):uds_linux.go:9-21 SO_PEERCRED、_core.py:1890-1907 先 effect 后记账、dbus-connection.c:5338-5347 same-UID 默认谓词、matches.sql:83+ or_group 聚合 ✓(磁盘工件在 Codex 的 /tmp 快照目录,五仓 tarball SHA-256 见其 artifact)

## 5. 停止条件核对(handoff §D)

- 附录 A 各类别 ≥1-2 高信号候选:协议规范✓(MCP/A2A)| 同类桥✓(5 仓)| durable execution✓(Temporal/Inngest/Restate/River)| 本地 daemon✓(tailscale/openssh/secretive+litestream)| 授权审批✓(Biscuit/Cedar/HumanLayer/Omnara/codex)| 测试合规✓(Toxiproxy+Temporal fencing 矩阵)——**全部满足**。
- D-1..D-6 每条均有"别人怎么解/无人解"映射(§2 表)——**满足**。
- 有意未深读(诚实缺口):ACP/AGNTCY/agent-mesh(Codex 扩展轮也未做,存在性仍未核)、MCP Apps、happy-cli 深层、semantic-conventions-genai 新仓、cedar-spec 形式化、Jepsen 级故障注入、data lineage/retention tombstone 类(无高信号同类仓)。
- **Codex 独立扩展轮(2026-07-14 同日)补齐**:SPIRE(D-4 in-scope 链+Windows principal)、DBOS(嵌入式 SQLite durable execution 表亲)、Hatchet(join algebra/attempt 回填漏洞/预算记账窗口)、Turmoil(确定性故障模拟+turmoil-fs)、D-Bus(D-4 out-of-scope 显式边界+D-6 有界 activation 树+sender 重写先例)。双路(Claude 25 仓 ∥ Codex 5 仓)在 D-1"broker 全权裁决/completionToken 不出 broker"上独立收敛。

## 6. Codex 扩展轮五仓回源锚点(full SHA + tarball SHA-256)

⚠上游 HEAD 会前移(Hatchet 已 d2560099→0dd175ca);回源必须用下表 full SHA,不能靠 `ls-remote HEAD`。回源法:commits API 取 full SHA → 下载该 SHA tarball → `shasum -a 256` 比对 → 解包读实现。我方独立核 dbus tarball SHA-256 逐字符吻合 + 4 处 file:line 抽查过。

| 仓 | canonical | full SHA(40) | date | tarball SHA-256 | license |
|---|---|---|---|---|---|
| spiffe/spire | github.com/spiffe/spire | 0f66c130b80f88a4d32247817037d187c7ee3f7c | 2026-07-09 | f8aeb96d22219ec70cce02b003512693892a7dd4173a71842cade91395ffc67d | Apache-2.0 |
| dbos-inc/dbos-transact-py | github.com/dbos-inc/dbos-transact-py | e9e351574b9a01aad62ead31bddb629fe1eb3e9c | 2026-07-13 | 42d45a4cc0800123503b2b6d11afe8c9a9e4bc94c40333bae2aa1743942afd82 | MIT |
| hatchet-dev/hatchet | github.com/hatchet-dev/hatchet | d25600995a8a14deab4b929ec99b6d51c3c7d362 | 2026-07-14 | e15ef6fb9ec67bddc022a08108867c51155caac854c8bdad303b48347105aeee | MIT |
| tokio-rs/turmoil | github.com/tokio-rs/turmoil | 481407d3bea1498e2f8259280b41986f392272fa | 2026-05-27 | cadec12993f1b6d2839a693bbd80181c6b467187892f82468c80fbfa0a807947 | MIT |
| dbus/dbus | gitlab.freedesktop.org/dbus/dbus | f64ae3cafdcf31606401171bb0e8fe3fccc761c2 | 2026-07-01 | d6176e52938315cd05843d00953077eaa535306f3b2346cb71ac3e8a375c91e7 | AFL-2.1 / GPL-2.0-or-later |
