# AgentBridge v3 架构设计(方案 B″)— 桌面双端接入 + 双向 RPC

<!-- 阅读顺序:先读本 §0(文档定位/决策记录/复审记录),再进 §1。§6 是协议规范意图的单一真源。 -->


> **状态**:DRAFT v0.12(2026-07-31)。**v0.11→v0.12:B1 旧链退场 cutover 设计冻结合入(用户 APPLY)**——B1-B4 设计对审弧(r1-r20)B1 面 9 题 CONVERGED+冻结稿窄差分 r1-r14(codex-r14-b1 ACCEPT)后合入:新增 §16.1 全节(cutover 状态机与验收骨架)+§18-Q9 置位+接线短引用 8 锚(spec 侧同批=v0.12.20:§17 全章+§5/§6/§12/§14/§16 差分);**SEC-7 保持 open**(§16.1(九)四组机器化验收全过才 close)。+2026-07-31 MCP 2026-07-28 事实注记批(6 处,注记级不升版号)。v0.10→v0.11 沿革见附录 B 轮 15。
> **状态(v0.10 历史)**:DRAFT v0.10(2026-07-17)。**v0.9→v0.10:协议规格(docs/v3-protocol-spec.md v0.12.18,§1-§16 封版)反哺的九项同步修订 A-1..A-9**(claim_ack 两阶段/cancelling 双义 terminationIntent/reconciliationReason 封闭注册表/三种 ack 消歧/verificationRevision 三分/resolvedContextBasis tagged union/requestSemanticDigest 双 digest 幂等/completion 信封 canonical/context-basis P0A-CB 探测项与 carrier 形态)+ §17 PR #4-#6 合并事实 + §18-Q1 裁决记录(D 为当前动作、C 为方向,2026-07-16 用户批)。九项均为**规格→架构的回写对齐**(spec 为细节 SSOT,本文锁不变量),不改 v0.9 已锁定决策。
> **状态(v0.9 历史)**:DRAFT v0.9(2026-07-15)。**架构正文层经全量多维终审收敛(6 并行维度 agent + Codex 3 轮差分复核,三路独立 APPROVE)**;剩余仅 §0-A 协议规格 / E2E-gated / apply-time 可降级项。⚠不标 REVIEWED(记取 v0.4 过早 REVIEWED 教训):§0-A 协议规格与 Phase 0A E2E 探测未做前,不进入实现。**六条载荷级决策 D-1..D-6 + MCP Tasks 处置全部定案**(D-4=用户终裁;余=定案轮 Claude+Codex 双路独立出案→4 轮红队盲审收敛,证据 docs/v3-survey-evidence.md)。**v0.6→v0.7→v0.8**:对 committed 字节做全量多维终审(6 并行维度 agent + Codex 独立全文对抗)+ 差分复核两轮,补修 v0.6 落稿遗漏与 v0.7 修复引入的新漂移——含 D-1 push 原语/证据映射(复发 v0.5 根因)+ completion generation fence、broker-owned effectiveVerificationSnapshot、protectedStateRevision 推进、rootAdmissionId 贯穿 root 账、activation ownership 转移、死进程收割、G-5 composite gate、编号/引用一致性。§0-B 转决策记录,裁决正文落 §5/§6/§8/§9.2/§10/DR-2/DR-8。v0.5 说明保留如下。
> **状态(v0.5 历史)**:DRAFT v0.5(2026-07-14)。**从 v0.4 "REVIEWED" 降级** —— 三路独立究极复审(补丁漂移 + 零背景冷读者实现测试 + Codex 攻击树)一致翻案:v0.4 被过早标 REVIEWED。评审链:v0.1 全文评审 → v0.2 定向终审 → v0.3 同范围复核 → v0.4 → **v0.5 究极复审**。
> **v0.5 复审根因(三路收敛)**:§6 协议在第 6-7 轮围绕 pull/claim/offer 模型重构,但**从未为 push 路径(§9.2 CodexWorker 默认流 + §16 Phase 1B legacy 映射)、§8.1/§9.3 表面签名、phase 转移表重新推导**——最默认的执行路径反而最缺规格。v0.5 已修掉可无歧义纠正的内部矛盾(见下方修订记录);**剩余为需决策而非改字的开放项,集中在 §0-B,未擅自发明解**。(v0.6:D-1..D-6 已全部定案,§0-B 转决策记录;本段为 v0.5 历史根因存档。)
> **文档定位(v0.5 澄清)**:本文是**架构+决策文档,不是 wire/protocol 实现规格**。§6 的字段/伪签名是**规范意图的单一真源**,§8/§9 只应引用不应复述(复述正是 v0.4 漂移之源)。控制协议 framing、注册请求/响应、sessionAuth 铸造、每 shim 的 MCP 工具 schema、phase 转移表、token 托管——属**后续协议规格**(§0-A 交付清单),本文只约束其必须满足的不变量。
> **skills 层归属(v0.11/2.18)**:协作大脑(规划器/契约原语/模式库/台账)属**独立设计文档**,不进 wire 规格;其 wire 接点为未来 B4 候选(§18-Q12),v0.11 无仲裁 wire。台账的存储/滚动策略在该文档内定义(防复刻 745KB ledger 膨胀)。
> **作者**:Claude + Codex 多轮设计协作(独立分析 → 收敛+双向红队 → 盲区狩猎 → 究极决策 → 文档评审 → 究极复审)。
> **取代关系**:修订并部分推翻 `docs/v2-architecture.md`(2026-03-22);v2 的 rooms/registry/adapter/policy 骨架保留,SQLite 时序、"pure router" 定位、MCP 工具面被推翻(DR-3)。
> **术语**:B″(ASCII 写作 B2)= durable Task broker 骨架 + 双侧插件分发 + dedicated-by-default + manual_claim_current + 分级 Codex worker。"Claude 桌面"全文指 **Claude Code Desktop**(非 Claude.ai 桌面聊天应用)。
> **证据标签**:【官方】= 官方文档原文;【本机快照】= 本机只读探测(2026-07-14;codex-cli 0.144.1 / Desktop 内嵌 0.144.2 / Claude Code 2.1.209);【代码】= 本仓库 file:line;【上游代码/issue@日期】= openai/codex 仓库;【E2E-gated】= 有文档依据但未实机验证,属待证设计前提而非已验证能力;【推断】。
> **纪律编号**:`O-1` = 用户审批纪律(propose-then-APPLY,批准只认用户本人);`E-1` = 证据纪律(README 不算证据,读实现)。与事实矩阵 `F#` 编号无关。

---

## 0. 文档定位、交付边界与决策记录(v0.5 新增,v0.6 定案)

### 0-A. 后续协议规格必须定义的项(本文有意不覆盖)

本文约束这些项的**不变量**,但不给 wire 级细节;实现前须由一份独立协议规格补齐。冷读者测试证明缺了它们无法起手编码:

1. **控制协议 framing + 注册握手**:传输 framing(JSON-RPC?)、注册**请求与响应** schema、能力/版本协商报文。当前 §4/§5 只有一句"UDS/loopback + token + 握手"。
2. **`sessionAuth` 原语**:铸造者、生命周期、与 §5 Connection fencing token 的关系。§6 每个 executor 调用都依赖它却未定义。
3. **每 shim 的 MCP 工具 schema**,分三面:(a) caller-visible 动作 `task.submit`(核心,ask_* 是糖)、`ask_claude`/`ask_codex`、`peek_pending`/`preview_request`/`claim`/`renew_lease`/`complete_task`、SuspensionReceipt caller 动作族(`await_result`/`supply_input`/`supply_callback`)、`lookup_by_idempotency_key`;(b) **holder-only control 动作**(仅投影给 `approval_system`/Approval Agent,模型 shim 不暴露):`claim_approval`/`submit_approval`/`submit_budget_override`;(c) 普通 task cancellation——参数与返回体。
4. **phase 转移表**:§6.1 只枚举 phase,未给转移触发与合法边(`leased→dispatching→running` 由何事件?`queued→leased`?cancel/complete 竞态谁赢?reconciling 出口 phase?)。DB CHECK 约束依赖它。
5. **存储 schema 映射**:§6 的实体(ClaimOffer/DispatchAttempt(+Event)/TaskRouteOwnership/WaiterLease/suspension 动作 token/completion receipt+tombstone/artifact blob)到 §4 表清单的映射(§4 清单已在 v0.5 补齐实体名,但列↔表归属仍待规格)。
6. **signal-file 格式**:每 session 一文件?多 pending taskId 表示?coalescing 语义(Phase 0A.1 要测的东西本身缺规格)。
7. **`retryClass` 的 tool-manifest**:格式、位置、authorship。
8. **contextMode=current 的 `contextDigest` 来源**:broker 不能读宿主 transcript(§1.2 禁改、无读 API),digest 算什么字节、谁算、caller 如何取得 expectedBasis——待定;`checkpoint`/`providedBundle` 两个 context 模式当前无子系统支撑,**v1 应显式标为 unsupported 或补子系统**。(v0.10/A-9 进展)三问已由协议规格机器化为**独立探测项 P0A-CB**(§15 **Phase 0A** 第 10 项——区别于 §15 Phase 1 门禁的第 10 条;evidence schema/pass 谓词=协议规格 §14);**carrier 形态已定**:caller 取得 expectedBasis 的 wire 载体是 `context_current_v1` protocol feature 的**新增字段**——仅在协商该 feature 后出现,既有 v1 报文零改动(不违"既有报文形状不变");v1 维持 current 语义 UNSUPPORTED(合取门见 §6.2 resolvedContextBasis 注)。
9. **人闸/效果/push-completion wire 细节(v0.6 新增)**:ApprovalChallenge/ApprovalPresentationLease/HumanGestureAttestation/`claim_approval`/EffectContext/EffectIntent/EffectPermit/EffectAttempt/WorkspaceEffectLease 完整字段与状态机、`operationHash` canonical schema、EffectMediator 接口、attestation scheme 协商与 `keyId→principal` enrollment、challenge/permit 的原子事务边界与执行前 revalidation 集合的编码;**push 路径 PushCompletionHandle 的 broker-internal holder auth、correlationKey 的生成/存储/唯一性、complete CAS 编码(§6.2/§6.4)**。
10. **预算/生命周期/身份 wire 细节(v0.6 新增)**:TaskLineage/RootAdmissionContext/HostTurnKey/HostSessionKey/BudgetAccount/BudgetReservation/UsageEvent/ProviderCircuit/FanoutAllocation/ActivationAttempt/WorkerProcess/DedicatedBinding 完整字段与索引;worker/activation 发布默认数值(TTL/drain 序列/depth/hop/route recurrence/timeout,Phase 0 校准);`approval_prompt` quota 维度;sibling `parentTaskId/depth/hop` 赋值;activation refcount 幂等结算 key。正文只锁不变量。⚠**HostTurnBoundary 身份来源**(宿主 turnId 证明 / UserPromptSubmit epoch)= E2E-gated 前提:现实现 `turn_id` 恒 null(control-protocol.ts:46、claude-adapter.ts:512),须 Phase 0A 探测。

### 0-B. 载荷级设计决策(v0.6 已全部定案;下表为历史问题陈述,裁决见表后记录)

以下是定案轮拍板的六条载荷级决策(表为历史问题陈述,其中 D-4 是用户产品/安全边界的选择):

| # | 决策 | 三路依据 | 谁定 |
|---|---|---|---|
| D-1 | **push 路径 token 生命周期**:§6.2 只在 pull 的 `claim()` 事务里铸 lease/completionToken;但**默认** Claude→Codex(§9.2 CodexWorker)与 **Phase 1B legacy 映射**是 push 形(broker 直接调 `codex()`)。谁持 completionToken、谁判 succeeded/failed、谁调 complete_task?(adapter 代 claim?还是内部合成 offer?)——最默认的路径当前无规格 | 冷读者 B1/B4、Codex | 设计(我+Codex 一轮) |
| D-2 | **人类审批路由**:worker elicitation→`waiting_input(reason=approval)`,SuspensionReceipt 的 `submit_approval` token 回到 caller,而 caller 是 `agent_rpc`——按 O-1 恰恰**无权批准**。谁把审批呈现给真人、在哪个 surface(Console 是 Phase 3、gate 却在 Phase 1)、什么构成人类 attestation(修 F13 所需)?**安全边界** | 冷读者 M10、Codex Tree1 | 设计+用户 |
| D-3 | **effect-bound origin 强制**:task-origin taint 必须到达 Claude 实际 PreToolUse/文件系统 effect;当前只有散文"untrusted 标签",无 effect mediation。且现有 approve.sh 会**回显 approve 命令**、HMAC 无 principal、存在 **agent 可创建的 bypass marker**——"审批不洗白"目前无机制强制 | Codex Tree1 BLOCKER | 设计+用户 |
| D-4 | **same-UID 信任边界**:v3 全部安全依赖 UDS/token/Keychain-0600;但现实现明确声明 same-UID 进程**不在防御范围**(daemon.ts:315-320)。同用户的另一进程能否冒充 endpoint/抢 task/伪造 completion?若在 scope 须独立 OS principal/sandbox 或 endpoint attestation;若不在须写入威胁模型 | Codex Tree2 BLOCKER | **用户产品决策** |
| D-5 | **budget/loop envelope**:loop budget、hop/depth、cost/context 预算目前只有声明,**无 carrier 字段**(CallerRequest/AuthenticatedSubmitContext 都不带 hop/root-lineage)、无原子 reserve/settle、无 provider usage 对账、无 circuit breaker。异步 A→B→A ping-pong 绕过同步 wait-for 图。**开 API 计费时是 BLOCKER** | 冷读者 M5、Codex Tree3 | 设计 |
| D-6 | **ask_claude 无 pinned dedicated session 时的行为**:dedicated 是默认(DR-2)但 §7 假设用户已 pin;首个新装用户第一次 ask_claude 就撞空——typed error?永久 queued?onboarding 提示?未定义 | 双冷读者 M11/M15 | 设计 |

**定案记录(v0.6,2026-07-14)**:

- **D-1 ✅**:push 由 broker 内部 `reserve_push_dispatch` 单事务合成 DispatchAttempt+ExecutionLease;明文 completionToken 封装为进程内不可序列化 PushCompletionHandle,永不出 broker;adapter 按协议证据表提议 succeeded/failed,余 broker 派生;legacy turn_completed→内部 unknown(unknownReason=legacy_evidence_only_completion)。→ §6.2/§6.4/§6.1/§16;worker 收割→§9.2/§11。
- **D-2 ✅**:审批 capability 路由到本地 Approval Agent(surface=approval_system,放行 gate 启用前不激活),不回 agent caller;attestation=enrollment 密钥签域分隔 challenge,分层 scheme(v1 最小档 user_presence_dialog_v1,升级档 Secure Enclave);一次性消费。→ §5/§10.1/§6.3/§12/§16。
- **D-3 ✅**:EffectContext 污点单调传播 + operationHash 域分隔 canonical + EffectMediator/deny-default sandbox 双后端 + 受保护路径决策表(放行腿在人闸设施全过 conformance 前 hard-disabled,O-1 零弱化);policy-control 资产恒拒不可洗白。→ §6.1/§6.2/§8.1/§10.1/§15。
- **D-4 ✅(用户终裁)**:same-UID(含被注入 agent 自 spawn 进程)显式 out-of-scope;机制=④混搭(日常 peercred+token 零交互,受保护 effect 过人闸);人闸理由=O-1 纪律,对 same-UID 阻力是副产品非安全承诺。→ §10.4。
- **D-5 ✅**:TaskLineage/RootAdmissionContext/预算账本由 broker 铸造(caller body 出现 lineage 字段即拒);三事务书挡(accept/dispatch/settlement);depth/hop/routeKey 三闸+root 聚合账(跨 reconnect 稳定);预算尽三出口(含 waiting_input(reason=budget))。→ §6.2/新 §6.6/§8.2。
- **D-6 ✅**:不对称默认——ask_claude=require_pinned(typed error+remediation,不建 Task)、ask_codex=activate_if_supported(仅 managed CodexWorker)、soft_fallback 永不默认永不静默;DedicatedBinding(bindingEpoch fence)+有界 activation。→ §6.2/§6.3/DR-2/§7/§8.1。
- **DR-8/§18-Q7 ✅**:§6 为 SSOT;MCP Tasks 降未来可选 Extensions Track edge adapter,"何时切换"改"何时新增"五门槛。→ DR-8/§6.1/§18-Q7/附录 A。

### 0-C. v0.5 已修的无歧义内部矛盾(纠错,非决策)

§8.1/§9.3 旧签名 → 改为引用 §6 规范;ClaimOffer 明确返回明文 claimToken(hash 仅存储侧);`resumeToken→§6.3` 断链修正;§4 表清单补 §6 实体;`quota_exhausted` 补 authorship;`contextMode`↔`requestedContext` 命名统一;`taskRevision(=stateRevision)` 别名清除;DR-7 工具名统一;Phase 1B 明确 legacy turn_completed 不进 verified。**轮 9(交接复审)追修 4 处确定性残留**:`result.nextAction` 进 Result schema;§8.2 澄清消息用 SuspensionReceipt(不用 `resumeAction`);§9.2 裂脑防护复用 ExecutionLease fence(删除未定义的 `fenceToken`);§9.3 受保护副作用仍走 §6.1 denied(不因 manual_claim 升级)〔v0.5 历史;v0.6 §9.3 改有序决策表,受保护路径放行腿 hard-disabled 前等效 denied〕。详见文末修订记录。

---

## 1. 目标与非目标

### 1.1 目标(用户需求映射)

| # | 需求 | v3 交付方式 |
|---|---|---|
| G1 | AgentBridge 在 Claude Code Desktop 生效,含新开 session | Claude 插件(现有)+ 多 attach(Phase 2 拆 singleton)+ SessionStart 自动注册 |
| G2 | 在 Codex 桌面端生效,含新 thread | **Codex 插件**(打包 MCP shim + skills + hooks),安装+启用后新 task 自动生效 |
| G3 | 反向通信:Codex 主动调用 Claude 并同步拿结果 | `ask_claude` 工具 + durable Task 协议(§6)+ Claude 侧 hook 唤醒(asyncRewake,E2E-gated) |
| G4 | 想到用户没想到的情况 | §10 安全、§13 invariant、§14 风险登记册(51 项) |
| G5 | 可接受完全重构 | 概念模型完全重构,交付 strangler 渐进迁移(§16);现有工作流兼容性由**基线门禁 P0-0 每阶段护航**(§15) |

### 1.2 正式不支持清单(AgentBridge 产品承诺,非厂商永久事实)

- **零点击将任务注入用户已打开的 Codex Desktop 线程**(idle-wake / active-turn steer)。原因:无公开 ingress(F3/F4)。上游缺口分两类:#17543/#18056 覆盖 notification-to-model,#21779 覆盖 Desktop 外部 API/导航契约。**任一落地只解锁候选 native adapter**,仍须通过 capability negotiation、审批授权与 §15 conformance,且受 I-5 政策门(capabilityAvailable ≠ policyAuthorized)。
- 附着任意未经注册的野生 Claude/Codex 会话。
- 静默启动计费敏感的 headless sidecar(Claude `-p`/SDK)。
- GUI 自动化(AppleScript/Accessibility/PTY 注入)作为任何生产链路。
- 修改两侧宿主的 session/transcript 磁盘文件。
- Desktop 对 worker 线程的 **live takeover**(worker 工作中被桌面接管):Desktop 仅作 viewer;drain 后能否 resume/open 由 E2E 决定,不承诺。

---

## 2. 已核实事实基础(Fact Matrix)

> 文档/API/本机静态 artifact 已双方交叉抽查;**标为 E2E-gated 的 runtime 行为仍是待证设计前提**;动态事实(配置、上游 issue 状态)受快照日期约束,实现时须复核(F14 即为本轮内漂移的实例)。

| # | 事实 | 依据 |
|---|---|---|
| F1 | Codex Desktop/CLI/IDE 共享 `~/.codex/config.toml`(含 `mcp_servers`);插件启用后在**新 task** 加载。安装、升级、直接改 MCP 配置三种场景的刷新/重启语义**分别**进 Phase 0 E2E,不合并承诺 | 【官方】learn.chatgpt.com/docs/extend/mcp、docs/plugins;【本机快照】config.toml `[mcp_servers.*]` 段 |
| F2 | `tui_app_server` feature 已移除(`codex features list` → `removed true`);`--remote <ADDR>` 仍在 CLI TUI;现 wrapper 仍传已移除标志(**发布前置修正**,见 §16 Phase 0B) | 【本机快照】双 binary 一致;【代码】src/cli/codex.ts:142-151 |
| F3 | Codex Desktop 自启 stdio app-server,无外部可 attach 的 listener;deep link:`codex://threads/<id>` 仅**导航已有 task**;`codex://new?prompt=` 仅**新 task 预填 composer**,不自动发送 | 【本机快照 2026-07-14】Desktop 内嵌 codex 0.144.2 进程 argv + `lsof`(stdio socketpair、无监听 socket;负面结论不作为未来版本保证);【官方】learn.chatgpt.com/docs/app/deep-links |
| F4 | Codex 侧 MCP `notifications/message` 仅映射到 tracing,不进模型对话;外部消息注入缺口的上游 issue 均 OPEN;2026-07-28 注:Logging 族 deprecated(SEP-2577)、`logging/setLevel` remove、`notifications/message` 仅对携 `_meta` logLevel 的请求可发(缺省 MUST NOT)——「注入缺口不进模型对话」被协议层钉死(强化非动摇);经 notifications/message 修复注入缺口的上游路径已被新规封死(issue 17543/18056 的 OPEN 更持久);证据锚 codex@4aa950d 在 Codex 迁移 2026-era 后须重核 | 【上游代码@4aa950d】routing:github.com/openai/codex/blob/4aa950d456c6c90174d3269d7eaab4a2823e5889/codex-rs/rmcp-client/src/elicitation_client_service.rs#L124-L135 → handler:…/logging_client_handler.rs#L96-L136;【上游 issue@2026-07-14】github.com/openai/codex/issues/17543、…/18056(用户提交,非官方承诺) |
| F5 | Codex hooks 已 stable(`features list`):SessionStart/UserPromptSubmit/Stop 等,无 FileChanged/asyncRewake 等价物;async command hook parsed-but-skipped;`systemMessage` 仅 UI 警示不进模型上下文;hook 信任按定义 hash 逐个 review,升级后需重新信任 | 【官方】learn.chatgpt.com/docs/hooks;【本机快照】`hooks stable true` |
| F6 | Codex 插件体系:`codex plugin add/list/marketplace/remove`;plugin.json 可打包 `.mcp.json` + `skills/` + `hooks/`;Desktop 与 CLI 共享安装/启用状态(本机 13 插件两套 binary 一致);已打开 task 不热加载;无 monitor/daemon 字段;marketplace refresh ≠ 已装 cache 必然升级;**local 源无 marketplace refresh 路径(P0A-2 实证,v0.11/1.2b:run6 s8 实测 `unsupported_for_local`、不属 PASS 允许集;source 级定位=`marketplace_upgrade.rs` 的 `source_type!="git" → Ok(None)`)** | 【官方】docs/build-plugins、docs/plugins;【本机快照】plugin list --json、config.toml `[plugins.*]` 段;【P0A-2 run6】runcard s8 两层口径 |
| F7 | `codex mcp-server`(**已文档化、CLI 未标 experimental**;不构成长期稳定性保证):`codex(prompt,…)→{threadId,content}`、`codex-reply(threadId,prompt)`;进程重启不从磁盘续 thread(#12596 CLOSED/NOT-PLANNED);MCP cancelled → `Op::Interrupt`;审批经 MCP elicitation 转发 | 【官方】docs/mcp-server;【本机快照】stdio handshake;【上游代码@main】message_processor.rs:523-568、outgoing_message.rs:99-125 |
| F8 | Codex app-server(experimental):`thread/start`+`resume`、`turn/start`+`steer`+`interrupt`、typed 事件流;`turn/steer` 仅限 in-flight turn;WebSocket 标 unsupported,同机建议 Unix socket/stdio | 【官方】docs/app-server |
| F9 | Claude Code Desktop 与 CLI 共享插件/MCP/hooks/settings;**本地 Git 仓库中的** Desktop session 各用独立 worktree;`--print`/Agent SDK/agent teams 桌面不可用;插件 Monitor **仅 interactive CLI**("run only in interactive CLI sessions") | 【官方】code.claude.com/docs/en/desktop、plugins-reference#monitors |
| F10 | Claude hooks:`SessionStart` 可返回 `watchPaths`;`FileChanged` + `asyncRewake:true` 后台 hook exit 2 时 "wakes the session if idle";`SessionStart` 在 resume/clear/compact 也触发;**`additionalContext` 会存入 transcript 并在 resume 重放**(官方明确的仅此项;asyncRewake reminder 在 Desktop 的持久化/重放语义【E2E-gated】) | 【官方】code.claude.com/docs/en/hooks;桌面实机行为【E2E-gated】 |
| F11 | Claude Channels 要求 CLI 每 session 显式 `--channels`;当前 Desktop 文档无等价控制面 → v3 将 Desktop Channels 判 unsupported(直至 E2E 或上游文档出现);通知无 delivery ack,未启用时静默丢弃 | 【官方+推断】docs/channels、channels-reference |
| F12 | 计费:Agent SDK/`claude -p` 独立计费改动已官方暂停,OAuth 下仍走订阅额度;`ANTHROPIC_API_KEY` 存在时优先于订阅登录、按量计费 | 【官方】support.claude.com articles 15036540、11145838、12304248(accessed 2026-07-14) |
| F13 | 现有审批链 HMAC 签名 payload 仅含 path+diff hash+nonce+TTL,**无批准者身份(principal)字段** | 【本机快照】approve.sh:47-51、block_manuscript_edits.py:269-285、approval_hmac.py:208-220,293-315 |
| F14 | **易变事实**:本机 Codex memories 配置一日内漂移(2026-07-14 新加坡时间 17:25 不可变快照三项均 true;17:41 配置变更后读得三项均 false,`stat` mtime 17:41:18)。Codex 支持跨任务 memory 抽取 → **worker 不得继承或假定宿主配置**:启动时强制验证 `generate_memories=false && use_memories=false`,无法证明时使用隔离 `CODEX_HOME`(接受 viewer 能力降级) | 【本机不可变快照】~/.codex/sessions/2026/07/14/rollout-2026-07-14T16-26-34-019f5fbc-2812-7792-a466-01e8187c5f00.jsonl:622(17:25:47,三项 true);【本机快照】config.toml:25,121-122 + stat mtime 17:41:18;【官方】docs/customization/memories |
| F15 | 现 daemon:单 Claude attach 槽(拒第二个);idle 判定只看连接数不看未完成任务;ask_codex waiter 以 `turn_completed` 为 terminal outcome,**无 complete_task/验收层**;启动锁 fail-open;spawn 用 `cwd: process.cwd()`;uncaught exception 只记日志不退出 | 【代码】daemon.ts:678-687、759-774、599-603、1097-1102;daemon-lifecycle.ts:303-323、334-367 |
| F16 | 同步 `ask_claude` 的回答作为 MCP tool result 回到发起调用的 Codex turn——反向通信"结果进当前对话"在**原调用仍存活且同步终结**时天然成立(见 §6.3 存活性条件) | 【协议推论+E2E-gated】双桌面往返 E2E 为发布门禁 |

---

## 3. 关键设计决策记录(DR)

### DR-1:总体方案选 B″(决策卡终局)

| 候选 | 裁决 | 一句话理由 |
|---|---|---|
| A 渐进最小改 | 拒(仅作 PoC 思路) | singleton/无持久化不解决,多 session 即塌 |
| B 纯骨架重构 | 采纳为骨架 | 但骨架不自动创造宿主没有的 ingress |
| C 对称全 headless | 拒;仅 Codex 侧 worker 被采纳 | "最可控的发动机、最差的产品语义";Claude sidecar 计费/审批/上下文三重代价 |
| D 收窄不做 | 拒;其"诚实标注 unsupported"精神被吸收 | 放弃 G2 |
| **B″** | **采纳(双方一致)** | 平台约束下 Pareto 最优:支配 A/D,取 C 之长不付其代价 |

**Pareto 论证**:在当前可实现集合内,没有方案能在不牺牲安全、产品语义或支持面的前提下补上"零点击当前线程 push";B″ 拿到其余全部能力,对缺口诚实标注并预留 adapter 位。
**Tie-break 原则**:先选稳定、最小、可证明的接口;缺能力时显式升级,绝不用隐式 fallback 冒充覆盖。

### DR-2:RPC 目标默认 dedicated,`contextMode=current` 是显式例外

双侧对称:`ask_claude`/`ask_codex` 默认打到专用会话/worker,不注入用户正在用的对话。理由见 §14「会话资源」风险组(context 污染、compaction 抹契约、角色残留、额度消耗)。"注入当前线程"被裁决为**低频、高价值、非默认**需求(非幻影;多数场景把结果需求误写成机制需求;真正不可替代的只有 active-turn 实时打断,当前无解)。(D-6 定案补充:dedicated 默认≠两侧都要求现成 pin——`ask_claude=require_pinned`、`ask_codex=activate_if_supported`(managed worker)、`soft_fallback` 永不默认;详 §6.3。)(v0.11/2.8)**re-pin 继承(opt-in)**:「新 session 自动继承本 workspace 上一个 pin」列为 opt-in 能力——自动继承=**新增第三条 pin 铸造路径**(现行铸造/撤销仅 admin plane/用户显式 CLI,协议规格 §10.9 封版;行为变更已过提案盲审);**继承发生时必须显式回显(typed detail),不得静默**(与「不静默改投」原则对齐);列入 G-1 冷启动用例。

### DR-3:对 v2 文档的修订

1. SQLite 从 v2 Phase 4 **前移到 Phase 1**(v2-architecture.md:628-636 推翻):无 task journal/幂等/lease 之前不得开反向 RPC。
2. "pure message router" 更名升级为 **fail-closed task broker**:ACL、lease、loop budget、审批边界、幂等、审计是 broker 强制执行,不是 policy 建议。
3. v2 §7 MCP 工具表(只有 reply/rooms 族)是功能回退,推翻;v3 以 Task 协议为核心(§6)。
4. `message`(聊天面)与 `task`(执行面)分离;v2 envelope 的 ack 只是传输确认。
5. v2 的 rooms/registry/身份-会话分离/heartbeat/adapter 独立性/Codex 串行背压判断**保留**。

### DR-4:Codex 执行面分级 —— v1 用 `codex mcp-server`,按需升级 app-server

| 维度 | mcp-server(v1 默认) | app-server(升级) |
|---|---|---|
| 成熟度 | 已文档化、未标 experimental | experimental |
| 集成成本 | 两个工具,最小 | 完整 JSON-RPC client |
| 磁盘续接/fork/list | 否(#12596 not-planned) | `thread/resume` 支持 |
| steer/interrupt | MCP cancelled → 中断当前调用 | `turn/steer`、`turn/interrupt` |
| 事件流/图片 | 自定义 codex/event;text-only | typed 事件流;支持图片 |

升级触发:需要 crash 后续接、active-turn 打断、富事件或图片。两者都不是 Desktop 私有 app-server 的 attach 面。worker 进程对 broker 是**有状态 lease**(重启即线程失联,按 F7 语义处理)。不把 mcp-server 直接暴露给 Claude 绕过 broker(否则 task/principal/审计全失效)。

### DR-5:Claude→Codex 执行面与交付阶梯(第 1 级并非当前线程)

1. **dedicated worker**(默认,零人工;§9.2);
2. **manual_claim_current**(人一句话在当前线程领取;§9.3);
3. **armed_pull 结对模式**(实验性,用户显式武装;`inboundMode=armed_pull`、`canWakeIdle=false`、带 lease/expiry);
4. **OS 通知 + deep link**:有可定位 thread 时 `codex://threads/<id>` **导航** + 可复制的 prepared prompt;无可定位 thread 时退化为 `codex://new?prompt=` **新任务预填**(不属于当前线程 attach,不自动发送)。本级恒返回 `waiting_input(reason=wake)`,不冒充已投递;
5. 未来官方 ingress 的 native attached adapter(默认 disabled,过 I-5 政策门 + §15 conformance)。

### DR-6:broker 生命周期 = client-triggered 启动 + **obligation-owned 存活**;v1 保证 durability,不保证 autonomous liveness

推翻"client-owned lifetime"。**正常运行时**退出谓词:`connections=0 && activeTasks=0 && leasedAdapters=0 && pendingCallbacks=0 && pendingActivations=0 && maintenance=idle && writerQueue=empty`,再进入带抖动的 idle grace——有未完成义务不退出(I-2)。**未消费的 `PreAcceptSubmitIntent` 继续计入退出 obligation**(或 ActivationAttempt 保 `ready_unbound` 非终态直至所有 joiner accept/fail),防 activation 中断连时 broker 以 activeTasks=0 误退(v0.6 D-6)。
**边界声明**:退出谓词只防正常退出,不防崩溃/重启。v1 承诺:状态 durable,broker 崩溃或 OS 重启后、无前台 client 期间的任务**等待下一个 client 拉起后恢复**;"无 client 时按 deadline 自动恢复执行"不在 v1 承诺内(若要承诺,service/socket/timer activation 是发布前置项,§18-Q2)。
配套:fail-closed 选主锁 + UDS bind 终极 fence、三级停机语义(`disconnect-self / drain-and-restart / force-stop-installation`)、broker cwd 固定 state dir、crash-only(fatal 异常停 accept 并非零退出)、readiness = liveness+storageReady+writerAlive+migrationReady。

### DR-7:分发载体 = 双侧插件

- Claude 侧:现有 `plugins/agentbridge`,补 `FileChanged` 唤醒 hook 与 `preview_request`/`claim`/`complete_task` 工具。
- Codex 侧:新建 `agentbridge-codex-plugin/`(`.codex-plugin/plugin.json` + `.mcp.json`(STDIO shim)+ `skills/` + `hooks/`),经 personal/team marketplace 分发。
- 已知限制(F5/F6):hooks 需用户逐 hash 信任且升级后重新信任;已打开 task 不热加载;marketplace refresh ≠ cache 升级、**local 源无 marketplace refresh 路径(P0A-2 实证,v0.11)**——全部进 §15 门禁;local 源升级交付流程见 §16(v0.11/1.2c)。"新 session 自动生效"的准确表述:**当前 hook 版本已获信任后,新 task/session 自动生效**。

### DR-8:§6 为任务协议 SSOT;MCP Tasks 仅作可选 Extensions Track adapter(v0.6 改题)

2025-11-25 experimental Tasks utility 为 receiver-owned task、终态重放、cancel 后 late result、TTL、"通知非真相源"与 ACL 提供了有价值语义先例。新证据(矩阵 §1.1,typescript-sdk@e81758caed29):TS SDK v2 已删除旧 experimental core runtime(TaskManager/TaskStore/experimental.tasks.*)并明确迁 Extensions Track;2026-07-28 spec 已正式发布,Tasks 升格为官方扩展 `io.modelcontextprotocol/tasks`(SEP-2663;poll 型 `tasks/get`+新 `tasks/update`),extension schema 仍 draft-only、无 tagged revision。此变化**不等于 MCP Tasks 整体取消或废弃**(2026-07-31 亲核官方 changelog:实为升格官方扩展,非撤销;原 AMBER 关闭,DR-8 本裁决被证实)。v3 裁决:AgentBridge canonical task model/字段/三正交状态/lease/attempt/reconciling/SuspensionReceipt **永久以 §6 为 SSOT**,不承诺与 MCP Tasks core/draft wire shape 同构。未来可新增**可选 Extensions Track edge adapter**,不得替代 §6:启用须协商精确 extension identifier+revision/schema digest,并过映射/重放/取消/TTL/ACL/downgrade conformance;extension 缺失或 revision 不匹配只关该 capability(typed unsupported/not-in-era),不影响基础 wire。`queued/leased/dispatching/reconciling` 不得为外部五态 projection 压平后当内部存储真值;无法无损映射时该 adapter 拒绝对应 taskSupport 类别。

---

## 4. 总体架构

```text
 Claude Desktop │ Claude CLI │ Codex Desktop │ Codex CLI      (宿主,月度自更新)
      │              │              │             │
 ┌────▼──────────────▼──┐    ┌──────▼─────────────▼──┐
 │ Claude 插件           │    │ Codex 插件             │       (分发单元)
 │ MCP shim + hooks      │    │ MCP shim + skills+hooks│
 └────┬──────────────────┘    └──────┬────────────────┘
      │  控制协议(UDS/loopback + token + 版本/能力握手)
 ┌────▼───────────────────────────────▼────────────────┐
 │            AgentBridge Broker(durable, fail-closed) │
 │  SQLite WAL:installations/endpoints/runtime_sessions │
 │   /connections/rooms/memberships/tasks/task_events    │
 │   /outbox/idempotency_keys/approvals/leases +          │
 │   §6 实体:claim_offers/execution_leases/dispatch_      │
 │   attempts(+events)/task_route_ownership/waiter_       │
 │   leases/action_tokens/completion_receipts/artifacts   │
 │   (列↔表归属待 §0-A.5 协议规格)                        │
 │  强制执行:ACL·lease·fencing·loop budget·wait-for 图   │
 │   ·origin/principal·预算·审计;Console/Inbox API       │
 └──┬──────────┬──────────────┬───────────────┬─────────┘
    │          │              │               │
 Claude     Claude        CodexWorker      LegacyCodexTuiProxy
 Attached   Sidecar       (mcp-server→     (现有链路,迁移期)
 (wake链)   (默认关)       app-server)
```

**v0.6 新增实体**(列↔表归属与完整字段见 §0-A.9/.10):`approval_challenges`/`approval_presentation_leases`/`human_gesture_attestations`/`effect_contexts`/`effect_intents`/`effect_permits`/`effect_attempts`/`workspace_effect_leases`/`task_lineage`/`root_admissions`/`host_turn_boundaries`/`budget_accounts`/`budget_reservations`/`usage_events`/`provider_circuits`/`fanout_allocations`/`worker_processes`/`dedicated_bindings`/`activation_grants`/`activation_attempts`/`pre_accept_submit_intents`/`effective_budget_snapshots`/`budget_override_grants`(后四者若嵌入其它记录而非独立表,须在 §0-A.10 注明 storage owner)。

adapter 拥有 runtime 细节与背压;broker 拥有任务状态与政策;插件拥有分发与宿主内注册;Console 拥有人的可见性(横切工作流 C,§12)。

---

## 5. 身份与生命周期

四层身份(取代 tmux/启动包装推断;tmux marker 保持现状 = 仅 bare `abg kill` 的 UX hint,src/cli/kill.ts:9-15):

```text
Installation(本机安装,Keychain/0600)
  └ Endpoint(surface:claude-desktop / claude-cli / codex-desktop / codex-cli / worker / approval_system)
      └ RuntimeSession(宿主真实 session/thread id + generation;SessionStart 注册,resume/clear/compact 滚动 generation 并 rebind)
          └ Connection(每 socket,fencing token,旧 generation 迟到包一律拒)
```

正交属性:`workspaceFingerprint`(cwd/repo/worktree,只做匹配与授权)、`roomId`(通信授权范围)。

注册 envelope:`surface, hostVersion, runtimeSessionId, generation, workspaceFingerprint, capabilities, billingClass, accountClass, approvalMode, resumeToken`。
capabilities(wire 统一 camelCase):

```text
canStartTurn / canInjectActiveConversation / canReturnSynchronousResult
canWakeIdle / supportsCancellation / requiresForeground
inboundMode ∈ {channel, hook_wake, manual_claim_current, armed_pull, pull, headless, none}
billingClass ∈ {subscription, api, unknown}
accountClass ∈ {consumer, business, unknown}
canPresentApproval / canAttestHumanGesture                                    # v0.6 D-2
attestationSchemes[] ∈ {user_presence_dialog_v1, secure_enclave_p256_biometry_v1}
```

**配对规则**:新 session 自动注册 ≠ 自动配对。默认 unassigned;仅"保存过且唯一匹配"的 workspace binding 自动恢复;否则一次性 pairing code。**pairing code 只能绑定已由宿主可信注册的 session handle;拿不到可信 thread/session ID 的 surface,其 attached adapter 判 unsupported**,不得凭空造身份。目标不唯一时拒绝路由。

**审批 endpoint 与 dedicated/activation 身份(v0.6)**:`approval_system` endpoint 经 peercred+installation token+endpoint generation 认证;broker 选定的 `requiredAttestationScheme`+`schemeId`+`keyId` 进入 ApprovalChallenge、签名域与 permit 校验,endpoint 不支持指定 scheme 即 typed fail-closed(禁静默降档,§10.1)。`DedicatedBinding{bindingEpoch, pinnedByPrincipal, bindingAttestationRef}` 与 `ActivationGrant`、`RootAdmissionContext` 亦在此层建立(§6.2/§6.3/§6.6)。

生命周期:`DISCOVERED → ATTACHED → READY ⇄ BUSY → DRAINING → OFFLINE`,lease+heartbeat,resume 沿 v2 §5.2 语义;cutover fence armed 时,无 coverage 的新注册停在 ATTACHED,存量滚代 session 置正交 `cutoverEligibility`(§16.1(四))。

---

## 6. 任务协议(Task,核心新增)

### 6.1 状态模型:三个正交字段(取代单一状态枚举)

```text
phase = submitted | queued | leased | dispatching | running
      | waiting_input(reason: approval|clarification|wake|budget)
      | waiting_callback | cancelling | reconciling | terminal

outcome(仅 terminal;非终态恒为 null)= succeeded | failed | denied | cancelled
      | expired | quota_exhausted | superseded | unknown
      # authorship:executor(或代表其的 broker 进程内 adapter,§6.2 reserve_push_dispatch)只提交 {succeeded, failed};
      #   其余全部 broker 派生——denied/cancelled/superseded 见 §6.1/§6.5;
      #   quota_exhausted 仅由 §6.6 的已知 hard budget exhaustion(structural hop/depth/route recurrence
      #   与 task allocation/money/token/attempt cap)且 policy=fail 时派生;
      #   expired 由 resolvedDeadlineAt/root deadline 到期派生(≠quota_exhausted);
      #   unknown 恒由 broker 派生且必带 unknownReason(reconciliation_unresolved 经 reconciling /
      #   legacy_evidence_only_completion 为 §16 Phase 1B 专用、不经 reconciling);
      #   存储结算失败≠预算耗尽:不派生 quota_exhausted(§6.6:实际 overrun 时 effect 保持 succeeded)

unknownReason(仅 outcome=unknown 时非 null)= reconciliation_unresolved | legacy_evidence_only_completion

verification = not_applicable | pending | accepted | rejected
```

- `host_turn_completed`、`executor_reported`、`runtime_bound`、`late_result`、`completion_receipt` 等是 **evidence event**(记入 task_events),不是状态;终态不可复活,后续工作另建 Task(`parentTaskId`)。
- **reconciling**:dispatch 后未记账即崩溃、或 lease 过期且无法证明旧 turn 已停止时进入——`outcome=null` + `reconciliationReason ∈ {dispatch_ack_missing, resume_apply_uncertain, lease_expired, owner_identity_retired, executor_lost, cancel_uncertain, effect_uncertain}`(v0.10/A-3:v1 **封闭注册表**——成员集合由本文与协议规格 §5.4 共同锁定,增项须同一修订同步两处;各 reason 的进入边/授权清理/合法出口以 §5.4 为 SSOT;不得散落自由字符串);对账成功回正常路径;**无法对账才 terminal + outcome=unknown(unknownReason=reconciliation_unresolved)**,非幂等写任务不得自动重试。unknown 的**唯一非 reconciling 派生路径**是 §16 Phase 1B legacy(unknownReason=legacy_evidence_only_completion),直接 terminal、不经 reconciling。
- **受保护路径(O-1)有序决策表(按序求值,先命中先定;机制见 §10.1)**:
  0. cancel/terminal/deadline 全局转态优先:本表仅适用 live、non-cancelling、`transactionNow < resolvedDeadlineAt` 的 Task;effect 可能已发生/dispatch 事实不明时 reconciling 先于 rule 1/2。
  1. policy-control 资产 → terminal denied + `nextAction=open_admin_settings`(恒拒,不铸 permit,换 user-origin task 亦拒;§10.1)。
  2. 缺 PEP(Policy Enforcement Point,broker 侧策略执行点)/ 人闸不可用 / conformance 未过(含放行腿 hard-disabled 期) → terminal denied + `nextAction=create_user_origin_task`。
  3. executor 已丢失 / dispatch 事实不明 → reconciling。
  4. healthy + 尚未决定(含收到自报/伪造 attestation:不铸 permit,视为尚未决定) → waiting_input(approval)。
  5. 真人批准精确 operationHash → 该次 effect 放行(sealed EffectPermit);origin 不变(agent_rpc 恒 agent_rpc,人批 N 次不升级);task 按其余工作续行(无则按 executor 终态)。
  6. 真人拒绝 / approval expiry,Task deadline 未到且 executor 存活可续 → EffectIntent denied,task 回 running。
  7. 真人拒绝 / expiry,但 Task deadline 已到 或 executor 不可续 → terminal(deadline 到=expired,否则 denied)。
  条 5/6 的放行/续行在人闸设施(§10.1)全过 conformance 前 hard-disabled——落条 2。
- 取消:`cancelling`(cancel_requested)→ terminal `cancelled`(cancel_confirmed);终态后到达的执行结果记 `late_result` evidence,不改终态、不自动重放。(v0.10/A-2)`cancelling` 为**双义 phase**:用户 cancel 与 broker deadline 有序停机共用同一 stop drain,语义由 **write-once `terminationIntent ∈ {cancel, expired}`**(封闭二值)承载——首个 stop CAS 赢、跨对账保留、后到 intent 不覆写先到;二者共用同一收口边,terminal outcome 按 intent 分流(cancel→cancelled,expired→expired)。**不入本 phase 的路径**:retireGeneration/owner-loss 不进 cancelling——pending_ack lease 按 T6b 未激活收口,存在 active/未证停执行风险时才按 T17 进 reconciling(reconciliationReason=owner_identity_retired),分派以协议规格 §5.2 为 SSOT;policy deny 由决策表直接 terminal denied、不经 cancelling(枚举/write-once/转移边 SSOT=协议规格 §5.1/§5.2)。
- MCP edge adapter 可将 `waiting_input` 投影为目标 extension 的 `input_required`;2026-07-28 后该名义分属两层——core MRTR 的 `resultType:"input_required"`(SEP-2322)与 Tasks 扩展的 `tasks/update` 输入通道;此为 adapter mapping(DR-8),非 AgentBridge wire 命名兼容承诺。(approval 腿不可无损投影——MRTR 无 token 授权层,投给 caller=审批权交回 agent caller;至多投为只读等待态,Q7 门槛③输入)

### 6.2 字段与令牌分层(谁填、谁签发、何时可知)

```text
CallerRequest(调用方填;request body 中出现任何 origin 类字段 = 直接拒绝):
  targetSelector(endpoint | runtimeSession |
    dedicatedPolicy:DedicatedTargetPolicy{targetClass: claude_session|codex_worker,
      mode: require_pinned|activate_if_supported|soft_fallback, profileId?,
      activationTimeoutMs?, fallbackChain?[]}),
  requestedContext(tagged union:fresh
    | current{expectedGeneration, expectedBasis?}
    | checkpoint{checkpointId} | providedBundle{bundleRef, digest}),
    # 全文简称 contextMode=current 等价于 requestedContext=current;
    # checkpoint/providedBundle 两模式在 v1 无子系统支撑,须显式 unsupported 或补规格(§0-A.8)
  idempotencyKey, deadline xor ttl, requestedCostPolicy, requestedApprovalPolicy,
  payload | payloadRef(content-addressed,broker 验证), expectedDeliverable,
  dataClassification, requestedVerificationPolicy(none|predicate|manual) + requestedAcceptanceSpec?,
  onCallerLoss(detach | request_cancel)

AuthenticatedSubmitContext(认证 adapter/broker 带外写入,不在 request body):
  authenticatedPrincipalId, originKind, originInstallationId, originEndpointId,
  originRuntimeSessionId, originTurnId, originAttestationRef?, policyEpoch,
  originInvocationId?, callerTaskId?, callerDispatchId?, lineageContinuationRef?
  # lineage 与 origin 同规则:body 出现任何 TaskLineage 字段(rootAdmissionId/rootTaskId/parentKind/parentTaskId/depth/hop/lineageDigest 等)即拒;
  #   TaskLineage/RootAdmissionContext 由 broker 铸造(§6.6);effect 审批 attestation 挂
  #   ApprovalChallenge/EffectPermit(§10.1),永不回写 origin

EffectivePolicySnapshot(broker 判定后写入;调用方不能自称写操作可重试):
  effectiveApprovalPolicy, dataDecision,
  effectiveVerificationSnapshot{mode(none|predicate|manual), effectiveAcceptanceSpecRef?,
    predicateProfileRef?, manualVerifierPolicyRef?, policyEpoch, digest},  # broker-owned;
    # requested* 只能收紧不能放宽;policy 升 predicate/manual 却无有效 verifier/spec ref → fail-closed
  effectiveBudgetSnapshotRef,        # 预算取 §6.6 EffectiveBudgetSnapshot(不再在此内联 cost budget)
  retryClass(safe|idempotent|forbidden;broker/tool manifest 判定),
  resolvedDeadlineAt, effectiveOnCallerLoss,
  canonicalOperationKind, canonicalTargetPolicy,     # idempotency scope 的 canonical 值
  effectiveTargetResolutionPolicy,                   # v0.6 D-6
  resolvedTarget{bindingId?, bindingEpoch?, adapterInstanceId?, activationId?, fallbackUsed,
    fallbackIndex?, resolvedAt}
    # 参加 canonicalTargetPolicy 与 idempotency digest 的**仅** bindingId+bindingEpoch 或显式
    # fallback 选择;resolvedAt/activationId/adapterInstanceId 仅入审计与 fence,不入 digest(防 false conflict)

TaskRouteOwnership(Task 级,首次 dispatch 前 CAS 一次,生命周期内不可切换):
  taskId, deliveryOwner ∈ {legacy_adapter, v3_broker}, ownerEpoch
  # owner 迁移 = 终结旧 Task 另建新 Task;各 DispatchAttempt 只引用 ownerEpoch

ClaimOffer(preview_request 时 broker 签发;claimToken 绑定 offer,非 lease):
  offerId, taskId, stateRevision, expiresAt, claimTokenHash,
  candidateOwner{installationId, endpointId, runtimeSessionId, generation}
  # preview_request 的响应把明文 claimToken 一次性回给调用方(broker 侧只存 claimTokenHash);
  # 调用方随后用明文 claimToken 调 claim,broker 比对 hash

claim(offerId, claimToken, sessionAuth, expectedStateRevision)——**单事务**:
  validate+consume ClaimOffer → CAS task phase/stateRevision → revoke sibling offers
  → create DispatchAttempt → create ExecutionLease(status=pending_ack)→ mint completionTokenHash
  → phase=leased → stateRevision++
  返回 ClaimSuccessReceipt:
    taskId, stateRevision, dispatchId, leaseId, leaseEpoch, attempt,
    leaseExpiresAt, resolvedContextBasis?, payload, completionToken
  # (v0.10/A-1)pull claim 为**两阶段交付**:claim commit 后 lease 处于 pending_ack,
  #   客户端 claim_ack 成功前禁止开始执行(complete/renew 一律拒);broker 仅按协议规格
  #   §5.3 及 §7.3 的完整封闭 CAS 激活(lease→active + stateRevision++),任一条件不符 →
  #   delivery superseded,不复活;claim ackDeadline 到**或** pending_ack lease 过期
  #   (两个独立 timer,§5.6)→ 按 T6b 未激活路径收口(执行权从未激活,不进 reconciling)。
  #   承诺口径=至多一个 delivery revision 获得执行权(非 exactly-once start)。
  #   存储/状态机/重放判据=协议规格 §5.2(T6b)/§5.3/§5.6/§7.3(SSOT),本文只锁不变量:
  #   未 ACK 不产生执行权。

ExecutionLease:
  leaseId, ownerTuple(同 candidateOwner 四层), leaseEpoch, attempt,
  status(封闭枚举以协议规格 §6.1 为 SSOT;v0.10/A-1 本文仅锁两个初建态:pull 初建=pending_ack、
    push 初建=active;claim/ACK 转移语义见其 §5.3), expiresAt, completionTokenHash
  # renew_lease(leaseId, leaseEpoch, sessionAuth) 不改 stateRevision;
  # (v0.10/A-1)过期按 lease.status 分流:**active** 过期先进 reconciling,未证明旧 turn
  #   已停止不得重新 dispatch(retryClass=forbidden 恒禁);**pending_ack** 过期走 T6b
  #   未激活收口(执行权从未激活,不进 reconciling)——协议规格 §5.6 定时器表

reserve_push_dispatch(taskId, adapterInstanceId, expectedStateRevision)——push 路径(§9.2 默认 CodexWorker
  + §16 Phase 1B legacy)的 broker 内部对等物,不伪造外部 ClaimOffer;**单事务**:
  validate task/route/deadline → CAS TaskRouteOwnership(首次 dispatch)
  → reserve attempt/concurrency/context/cost(§6.6)→ create DispatchAttempt → create ExecutionLease
  → mint completionTokenHash → append intent_committed(§6.5)→ queued→dispatching → stateRevision++
  # 事务后仅向 broker 进程内 adapter 交付不可序列化的 PushCompletionHandle(内含明文 completionToken);
  #   明文不写 DB/日志/worker stdin/MCP payload,executor 子进程全程不知晓;broker crash 后明文不重发、
  #   不从 hash 还原,恢复只走 Reconciler 对账(§6.1/§6.5),无法对账 terminal+unknown
  # ExecutionLease 增 completionHolder=broker_adapter + holderInstanceId/holderGeneration;
  #   DispatchAttempt 增 adapterInstanceId/adapterGeneration/executorInstanceId/executorGeneration/
  #   protocolCorrelation{transport, rpcRequestId?, hostTurnId?}
  # complete/renew 仍走同一 §6.2/§6.4 fence,adapter 不因进程内而豁免校验

DispatchAttempt(基础记录不可变;retry/reconciliation = 新 attempt):
  dispatchId, attempt, adapter, executorInstanceId, routeEpoch, ownerEpoch(引用),
  resolvedContextBasis?(v0.10/A-6:tagged union,取代旧"contextDigest 必填"单形):
      generation_only{runtimeSessionRecordId, generation, resolvedAt}
    | digest_bound{runtimeSessionRecordId, generation, baseTurnId, contextDigest, resolvedAt}
      # contextMode=current 在 claim/dispatch CAS 时冻结(pull=claim(协议规格 §5.2/T3),
      #   push=reserve_push_dispatch(§5.2/T4);两腿共同点=书挡② reserve 及
      #   DispatchAttempt/ExecutionLease 初建事务——pull 此时 lease 仍 pending_ack,
      #   执行权须后续 claim_ack 激活);
      #   fresh 下缺席(本字段本可选);
      # expected basis 已过期 → terminal + outcome=superseded,不得静默用新上下文;
      # v1:current 模式语义 UNSUPPORTED(digest 字节来源三问未解,§0-A.8/P0A-CB);
      #   **current 任一支仍为 E2E-gated**(generation_only 亦不例外)——开放合取=
      #   P0A-CB PASS ∧ 本修订 ∧ 新 protocol feature context_current_v1 ∧ 用户 DS-3
      #   裁决(协议规格 §9.1-§9.3/§14.3/§15)
DispatchAttemptEvent[](append-only,承载 outbox 边界与后补信息):
  intent_committed | sent | runtime_bound(hostRuntimeSessionId/hostTurnId 在此补写)
  | acknowledged | reconcile_started | reconciled     # 各带 dispatchId+时间+证据

Result:
  resultDigest, mediaType, size, inlineContent xor artifactRef, evidenceRefs[],
  nextAction?          # 仅 terminal denied 用,如 create_user_origin_task(§6.1 受保护路径)
```

- **版本号拆分(v0.10/A-5:二分升三分)**:`stateRevision` 仅在 authority/phase/lease 状态变化时递增(offer/suspension/completion 的 CAS 基准);`eventSequence` 每个 evidence event 递增;`verificationRevision` 驱动 verification 正交转移(§6.4 四支中 enterTerminal 判定 not_applicable/pending 之后的 pending→accepted/rejected CAS 基准),不动 phase/stateRevision(协议规格 §5.5)。三者不混用。
- **idempotency 作用域**:`originInstallationId + authenticatedPrincipalId + canonicalOperationKind + canonicalTargetPolicy + idempotencyKey`(全部 broker 生成/认证的 canonical 值);payload digest 由 broker 对 canonical payload 计算;同 key 不同 digest = conflict 拒绝。(v0.10/A-7)幂等判定升级为**双 digest**:`payloadDigest` + `requestSemanticDigest`(对 request 全字段构造值计算,覆盖 requestedContext/deadline/policy 等**行为字段**——防"同 payload 异行为"静默命中旧 Task);同 key 任一 digest 不同=conflict;digest 在任何 side-effecting activation 之前计算并绑定(canonical 编码与计算时点=协议规格 §7.2,SSOT)。
- **EffectContext 与 operationHash(v0.6 D-3;完整 canonical schema 见 §0-A.9)**:

```text
EffectContext(broker-owned,claim/dispatch 事务建立,runtime_bound 后绑 hostTurnId;payload 无权填写):
  effectContextId, taskId, dispatchId, attempt, originKind, originLineageDigest,
  目标四层身份+generation, hostTurnId, parentEffectContextId?, subagentInvocationId?,
  workspaceFingerprint, worktreeId, protectedStateRevision, policyEpoch,
  protectedManifestDigest, guardBuildDigest
  # 污点单调:自身或任一祖先 origin=agent_rpc ⇒ effectiveOrigin=agent_rpc;EffectPermit 只授权单次
  #   effect、不改 lineage;未知 child lineage → 受保护写 fail-closed
operationHash = SHA-256("AgentBridge/Effect/v1\0" || typed deterministic 编码({taskId, dispatchId,
  attempt, effectContextId, originKind, originLineageDigest, 执行四层+hostTurnId+toolUseId,
  operationKind/toolName/toolSchemaVersion/canonicalArgs, targets[]{lexicalPath, canonicalPath,
  rootId, parentFileId, targetFileId?, preimageDigest?, expectedPostimageDigest(create/replace/edit
  必填,delete 等无 postimage 可空), linkCount?, role∈{source|destination|overwritten_victim}},
  workspaceFingerprint/worktreeId/protectedStateRevision, policyEpoch/protectedManifestDigest/
  guardBuildDigest}))
  # PEP 重算,agent 只引用 opaque effectIntentId;拒 duplicate key/非有限数/未知字段;路径由 broker
  #   fd-walk 归一化为 TargetRef;完整 canonical schema 见 §0-A.9
```
- 令牌只存 hash、各绑其层与 owner 四层身份:claimToken→offer+candidateOwner;completionToken→`{taskId, dispatchId, leaseId, leaseEpoch, attempt, ownerTuple, operation=complete}`;**push 路径的 PushCompletionHandle 额外绑 `{holderInstanceId, holderGeneration, adapterInstanceId, adapterGeneration, executorInstanceId, executorGeneration, correlationKey}`(correlationKey 在 send 前持久化);complete 时完整 tuple 任一不符一律 reconciling,不得凭旧 ownerTuple 单独放行;push holder 的 broker-internal auth 与 correlationKey 唯一性见 §0-A.9**;SuspensionReceipt 的 per-action token→§6.3(此为**挂起动作 token**,与 §5 注册 envelope 里用于会话重绑的 `resumeToken` 是**两个不同 token**,勿混名)。complete/renew 同时验证当前 sessionAuth(sessionAuth 定义见 §0-A.2,待协议规格)。
- dedicated 任务提交时无目标 session,由 broker 解析;host thread id(如 `codex mcp-server` 首次 `codex()` 返回)经 `runtime_bound` event 补写,不得伪造为 lease 时必有。

### 6.3 同步语义、WaiterLease 与死锁防护(invariant I-1)

- **WaiterLease(与 Task phase 分离)**:`waiterId, originInvocationId, callerTaskId?, calleeTaskId, connectionEpoch, expiresAt`。wait-for 图的边来自**活的 WaiterLease**(与创建同事务持久化);terminal/suspension/timeout/cancel/disconnect 时**原子删除**。**broker 重启后所有 WaiterLease 一律失效**(不做 reattach 协议),调用方经授权的 `lookup_by_idempotency_key`/`await_result` 新建 waiter——绝不从 `waiting_input/waiting_callback` 推导等待边(防 ghost deadlock edge)。新增边成环 → 立即 `would_deadlock`。
- **结果路由与 suspension**:原 MCP tool invocation 仍存活且任务同步终结 → 结果直接回原调用(F16);进入 waiting_* 或 caller 到达自设 `syncWaitUntil` → 返回 **SuspensionReceipt**`{taskId, stateRevision, reason, displayMetadata?{surface, sessionTitle, questionSummary}, nextActions:[{action, token, expiresAt}]}`——**每个动作独立 capability token**(只存 hash,绑定 origin principal/session/stateRevision/该 action);`displayMetadata` 仅供 UI 展示、无授权效力;非终态响应轮换并返回新 token;mutating action 一次性,read-only `await_result` 轮换续用。**caller-visible 动作仅限**:`await_result / supply_input / supply_callback`——**无通用 `resume_task(taskId)`**;`submit_approval`/`submit_budget_override` 是 **holder-only control action(不在 caller union)**:`submit_approval` 仅经 `claim_approval` 投影给已注册 `approval_system` endpoint(§10.1),**agent caller receipt 永不含它**(reason=approval 时 caller 只拿 `await_result`);budget suspension 的 `submit_budget_override` 同为 holder-specific(仅 Approval Agent claim,一次性、绑 root+old/new budget+policyEpoch);`waiting_input(reason=budget)` receipt 只含 `await_result`,取消走既有 task cancellation API(非 SuspensionReceipt action);Claude/Codex shim 模型工具面不暴露 `submit_*`。`Reply to <task-id>` 只是 UI selector(taskId 非 secret),shim 必须取出并提交对应 `supply_input` 动作 token,**broker 永不接受仅凭 taskId 的输入**。transport 层 caller 消失(MCP cancel/断连/硬超时)收不到 receipt → 按 `effectiveOnCallerLoss` 处理,并提供授权的 `lookup_by_idempotency_key` 恢复路径。**caller wait timeout ≠ Task deadline**。
- **禁止嵌套同步回调**:执行中需反问对方 → `waiting_callback`,先解开外层 waiter,由发起方另起新 RPC。
- **busy / would_deadlock 语义**:Task 尚未 durable accepted = typed submit error(不生成 taskId);已 accepted 后目标忙 = `phase=queued + queueReason=target_busy`。不存在状态模型外的裸 busy outcome。
- **目标解析(D-6)**:在 Task durable acceptance **之前**执行有界决策树——唯一 eligible pin → 绑精确 `bindingEpoch`(resolve→dispatch 间 revoke → superseded,不静默改投);binding 存在但 offline ≠ 空 pin,只对 exact `bindingEpoch` 有界 wake/dispatch,失败 typed `pinned_target_unavailable`,不落入 activate/fallback 换目标;无 pin+`require_pinned` → typed submit error(不建 Task);无 pin+`activate_if_supported` → capability+用户预授 `ActivationGrant{principal,billingClass,accountClass,cost/data limits,expiry}`+policy 全过 → 有界 `ActivationAttempt`,ready 后才建 Task;`soft_fallback` → 仅按用户预存 ordered allowlist,结果显式 `fallbackUsed`。coalescing key=`{installationId,targetClass,profileId,principal,activationGrantRef,billingBindingRef,account/data policy digest,memory-isolation digest}`(防跨账户合并继承凭据/账单);coalesced join / worker READY / Task accept 三处重验 grant expiry/revocation、billing/data policy epoch、memory attestation,变则 typed superseded/unauthorized+reap。typed error:`no_pinned_target/pinned_target_unavailable/ambiguous_target/activation_unsupported/activation_not_authorized/activation_timeout/activation_failed/billing_context_unresolved/no_eligible_fallback`(+remediation)。activation 失败不产生 Task `failed`(未 durable accepted)。**默认不对称**:`ask_claude=require_pinned`(不得因发现 API key/CLI binary 静默启动 sidecar);`ask_codex=activate_if_supported`(仅 managed CodexWorker,activation 前证 memories 隔离(F14)+billing provenance,不明→`billing_context_unresolved`);`soft_fallback` 两侧永不默认永不静默(Claude 侧不得把任意当前 session 当默认 fallback;Codex 侧显式 fallback 到 manual_claim_current 恒返回 `waiting_input(reason=wake)`、不冒充已执行)。**side-effecting activation(spawn worker)前必须原子建立 `PreAcceptSubmitIntent` + RootAdmission/continuation 绑定 + idempotency binding + activation 资源 reservation + `ActivationAttempt` + spawn outbox;同 idempotencyKey retry join/replay 同一 intent、不每次新 spawn;Task acceptance 原子把该 intent 的 consumer ref、worker live obligation 与未用 hold 转为 Task obligation(已 settled 的 activation usage 永不转移/二次 settle);acceptance 失败/timeout 只 settle 实际用量、释放未用 hold,worker 仅在最后一个 consumer 归零(refcount=0)后才 reap——不无条件 reap 共用 worker(§9.2)**(字段/refcount 进 §0-A.10)。
- 单 RuntimeSession 单 in-flight;锁纪律:跨同步 RPC 不得持有可竞争资源;锁序 `session turn → workspace lease → external tool`。

### 6.4 完成与验收(防"协议完成≠任务完成",F15)

1. `host_turn_completed`:宿主 turn 结束,**仅 evidence**;
2. `complete_task(taskId, completionToken, completionRequestId, expectedStateRevision, outcome, result)`:executor 只允许提交 `outcome ∈ {succeeded, failed}`(denied/cancelled/expired/superseded/unknown 由 broker 状态机派生);`result = {inlineContent xor artifactRef, mediaType, size, resultDigest, evidenceRefs[]}`,resultDigest 由 broker 计算或验证。幂等基准 = `completionOperationDigest = H(taskId, dispatchId, leaseId, leaseEpoch, stateRevision, outcome, resultDigest)`:首次请求**原子**落 terminal result + completion receipt + token tombstone;完全相同 operation digest 的重放仅取回旧 receipt(容忍"已提交、响应丢失"),任何字段不同 → conflict;(v0.10/A-8)"任何字段不同→conflict"经**信封级 canonical 编码闭合**——`resultDigest` 对结果信封 `{mediaType, size, contentDigest, evidenceRefs}` 的 canonical 编码计算(防"同内容 digest、异信封元数据"绕过 conflict),`completionOperationDigest` 同样走域分隔 canonical 编码(两 domain 与字节级定义=协议规格 §7.3,SSOT);
3. **push 证据→outcome 映射(D-1;§6.2 `reserve_push_dispatch` 配套)**:push 路径 executor 不调 wire `complete_task`,由持 `PushCompletionHandle` 的 broker 进程内 adapter 按已关联协议终态调同一 core handler 提议 outcome:匹配当前完整 tuple `{holderInstanceId, holderGeneration, adapterInstanceId, adapterGeneration, executorInstanceId, executorGeneration, correlationKey}`(与 §6.2 PushCompletionHandle 同,`rpcRequestId` 仅为 correlationKey 的 transport 构件、不单独作键)的合法 MCP result 且 `isError≠true` → 提议 `succeeded`;匹配请求的 `isError=true`/JSON-RPC error/确定 schema violation → 提议 `failed`;已确认 interrupt/cancel → broker 派生 `cancelled`(adapter 不得提交);EOF/崩溃/超时/任一 generation 不符/无法唯一关联 → 进 `reconciling`,不得猜;**Phase 1B legacy `turn_completed` 不适用本 success 映射(它非"合法 MCP result",按 §16 落 unknown)**;executor 文本自称"成功/已批准"仅是 payload,不参与裁决。adapter 只判协议调用是否明确正常返回,业务交付正确性仍归 verification;broker core 最终校验 fence/state 并按本节 receipt/tombstone 结单。
4. verification:仅 `outcome=succeeded && effectiveVerificationSnapshot.mode≠none` 进入 `pending`,按 **broker-owned** `effectiveAcceptanceSpecRef`/`predicateProfileRef`/`manualVerifierPolicyRef`(§6.2)评估——**四支**:`outcome≠succeeded` 或 effective `mode=none` → `not_applicable`;required 检查通过 → `accepted`;**predicate 失败 / 人工拒绝 → `rejected`**(不得降成 not_applicable,防削弱 F15);verifier/spec ref 无效或不可用 → 执行前 fail-closed(不进 accepted/not_applicable)。**caller 只提供 `requestedVerificationPolicy`+`requestedAcceptanceSpec`,只能收紧;broker 从安装 policy 派生 effective 快照——policy 升 `predicate/manual` 却无有效 verifier/spec ref 时 fail-closed**(防 caller 请求 `none` 绕过,亦防 caller 提交恒真 predicate)。
5. **(v0.11/2.5)评审形态发起面默认 predicate**:评审类发起面(skills 层评审糖)默认携带 `requestedVerificationPolicy=predicate` + `requestedAcceptanceSpecRef`=内置评审 profile(方向=收紧,合本节 requested* 只能收紧纪律);broker 据 policy 映射 effective `predicateProfileRef`,profile 语义=「`evidenceRefs` 非空且全部可解引用」;「默认」限定为**发起面默认**而非 broker 无条件默认(对 ceremonial verdict 威胁已足——分类声明方是可信 caller 而非被验方)。broker-owned 任务分类维度列为替代候选(若将来需无条件默认,作为新决策走新 schema 面,**不得**扩开 canonicalOperationKind 封闭枚举——波及 routeKey/RetryManifest selector/idempotency scope,blast radius 不成比例)。**适用边界**:仅 v3-native 任务;Phase 1B legacy 路径(terminal unknown、verification=not_applicable)结构性豁免——共存期评审任务应走 v3 路径(使用文档指引)。
Transport ack、hook 输出、通知送达都不构成任何一层。

### 6.5 投递可靠性(transactional outbox)

`commit dispatch intent → send → persist ack`;边界崩溃 → `reconciling`(§6.1),按 runtime 侧 `turnId/threadId` 对账。唤醒信号(文件/通知/nudge)一律 level-triggered"队列非空"提示;领取协议:`peek_pending → preview_request(精确 taskId) → ClaimOffer → claim(CAS) → ExecutionLease(pending_ack) → claim_ack(→active,§6.2/A-1)`;取消/过期返回同 ID tombstone;禁止 pop-head。**`get_messages` 保持 chat-plane 兼容,不承载 Task RPC。**
(v0.10/A-4)**"ack" 消歧(三个不同事实,互不派生)**:①outbox 的 `acked` = **receiver 侧 start fence 已提交**(start CAS:outbox intent 消费+推进,发生在实际调用 worker **之前**——它证明 intent 已消费,不证明 worker 收到);②`DispatchAttemptEvent.acknowledged` = **worker 已接受协议调用**的 evidence(在 start CAS 之后、由实际调用结果追加——start CAS 后、worker call 前崩溃时只有①没有②,恢复端不得凭①虚构投递);③`claim_ack` = **pull 交付激活**(执行权 pending_ack→active 的封闭 CAS,§6.2/A-1;仅 pull 路径存在)。completion 侧无 "ack"——结单须 completionToken **加** §6.4 全量 fence/CAS(token 单独不放行)。层次细节 SSOT=协议规格 §5.2(T7)/§5.3/§7.3;事务边界索引另见其 §6.3。

### 6.6 Budget / Loop / Root envelope(D-5 定案)

- **RootAdmissionContext(root 铸造权,broker 铸造,跨 reconnect 稳定)**:root 只能由 broker 依 authenticated first-party HostTurnBoundary 铸造。合法边界=①宿主证明的 turn ID,或 ②可信 UserPromptSubmit/等价 first-party 事件触发的 broker 单调 epoch。`originInvocationId/connectionEpoch/idempotencyKey`/时间窗**均不得**充当 turn 边界;bridge wake/async continuation **永不铸新 root**(因果 taint 只由 broker 注入)。无法证明边界的 surface → typed `host_turn_identity_unavailable`,或采用绑定稳定已认证 origin HostSessionKey(跨 reconnect/resume/compact 不重置、模式由 broker policy 定)的保守 session-scoped root——**绝不 per-invocation root**。当前 mode 的键(per-turn 用 HostTurnKey,fallback 用 HostSessionKey)并发首调必须原子 get-or-create 唯一 RootAdmissionContext。root 账按 `rootAdmissionId` 汇总(不假设 synthetic root 建 Task;同 turn 多 ask 以该 admission 为共同父、各耗独立 task allocation/agent hop,`rootTaskId` 仅当 admission 确有对应 root Task 时等价)。同一 host turn 的调用即使经新 connection/invocation/epoch 到达,复用同一 root、累加 depth/hop/route/cost,不得重铸;**任何 bridge-derived invocation 缺有效 continuation 均拒(不论 parent 是否仍 active)**,不得因 parent 终结转新 root。⚠身份来源=E2E-gated(现 `turn_id` 恒 null,§0-A.10),Phase 0A gate 通过前不启用 per-turn root。
- **TaskLineage(broker 铸造,Task 级不可变)**:`taskId, rootAdmissionId`(必填,root 账真值,指向 RootAdmissionContext), `rootTaskId?`(仅当该 admission 确有对应 root Task 时非空,不作聚合键), `parentKind∈{task, root_admission}, parentTaskId?, depth`(root=0,child=parent+1,retry 不增), `agentHopCount`(retry 不增), `routeKey`=H(authenticated source class, canonical target, operationKind)(不含 payload), `lineageDigest, lineagePolicyEpoch`。同步/异步 child 均继承;异步恢复须持 broker 签发、绑原 `callerTaskId/rootAdmissionId` 的 continuation capability。同一 host turn 多个 ask 共享同一 `rootAdmissionId`、互为 siblings(共同父=RootAdmissionContext via `parentKind=root_admission`,不都冒充 depth=0、不按到达顺序链化耗尽 maxDepth,各耗独立 task allocation/agent hop;不得伪装成 parentTaskId;赋值字段 §0-A.10)。root 聚合账(§下条)、BudgetAccount root scope、caller body 禁填集合(§6.2)均以 `rootAdmissionId` 为键。
- **预算实体(可变 ledger 与 policy snapshot 分离)**:`EffectiveBudgetSnapshot`(Task 级不可变,取代 `EffectivePolicySnapshot.effectiveCostBudget`:`budgetEnvelopeId, policyEpoch, applicableQuotaRefs[], rootCaps, taskAllocation, retryPolicy, onBudgetExhausted, billingBindingRef?, priceCatalogVersion?`);`BudgetAccount{accountId, scopeKind∈{root,task,principal,installation,room,endpoint,provider_account}, scopeId, dimension, windowKey?, hardLimit, reserved, settled, tat?, version}`、`BudgetReservation{reservationId, accountRef, taskId, dispatchId?, dimension, amount, state∈{held,settled,released,expired}, operationDigest}`、`UsageEvent{taskId, dispatchId, providerRequestId?, billingBindingRef, provider, requestModel, responseModel, costMicros, priceCatalogVersion, usageQuality∈{provider_actual,broker_measured,upper_bound}, usageDigest}`、`ProviderCircuit{closed|open|half_open}`。money/token 全整数,禁浮点/NaN/Inf。完整列/索引 §0-A.10。
- **三事务书挡**:①durable accept=derive lineage/policy→查 depth/hop/route recurrence→reserve principal/installation/room/root 的 queue+bytes→insert Task/idempotency/lineage(失败=typed `quota_rejected`,不生成 taskId);②dispatch=CAS task→consume attempt→release queue hold→reserve concurrency+context/output token 上界+worst-case cost→create DispatchAttempt/ExecutionLease→outbox intent(任一 reserve 失败即同事务原子写明确出口:`nextEligibleAt` 重排/`waiting_input(budget)`/terminal,回滚后 Task 不得仍 eligible 而热循环);③settlement=幂等 insert UsageEvent→held→settled+释放未用/并发→update circuit→原子写 terminal receipt OR retry notBefore OR budget suspension。禁异步批量 spend;无 actual 按上界结算标 `upper_bound`;实际超 hold → 记 `budget_overrun`+开 circuit,已成功 effect 保持 succeeded、**不倒写 quota_exhausted**(存储结算失败≠预算耗尽)。
- **Loop 三闸(异步 A→B→A;同步环归 I-1)**:`depth≤maxDepth`、`agentHopCount≤maxAgentHops`、沿祖先 branch `routeKey` 出现≤`maxRouteOccurrencesPerBranch`(容一次合法 A→B→A callback)。数值=发布默认、Phase 0 校准、进 §0-A;正文约束有限硬上界+默认从紧+禁无限。最末防线=root 聚合账(全 descendants 共享 `rootAdmissionId` 的 task-count/attempt/token/money/wall-clock 累计;BudgetAccount root scope 的 `scopeId=rootAdmissionId`;不因新 session/新 key/异步 callback 重置)。**activation:spawn outbox 被 claim 或 child 启动后,`activationAttempt/activationCompute` 必 settle 进 RootAdmissionContext 的 root-wide 累计账,不因 Task 未 accepted 退款、仅释放未用 hold;profile/policy/idempotencyKey 变化不重置该累计**(封串行 churn)。
- **预算尽出口**:`onBudgetExhausted∈{fail, pause_for_human, defer_until_reset}`——已知 hard budget exhaustion(hop/depth/root budget cap)且 policy=fail → terminal `quota_exhausted`(child 未 accepted 则 typed submit error);`resolvedDeadlineAt`/root deadline 到期 → terminal **expired**(≠quota_exhausted);短期 rate/并发 reset<deadline → queued+`queueReason=budget_wait`+`nextEligibleAt`;可加的 money/token/attempt 上限且 policy=pause_for_human → `waiting_input(reason=budget)`(仅 Approval Agent 持 `submit_budget_override`,一次性、显式 opt-in、带 expiry;Approval Agent/capability 未启用时**不进 `waiting_input(budget)`**,按 policy 当场 fail 或已知 reset<deadline 时 queued,不产生未定义第四出口)。budget override = append-only root-wide `BudgetOverrideGrant`(revision),不覆写 `EffectiveBudgetSnapshot`、不放宽 depth/hop/route structural cap 与 billing/data policy。reconciling 只表事实不确定,已知预算不足不塞入。
- **配套**:attention/wake=持久 GCRA/TAT(推进 TAT 与 wake outbox 同事务,§8.2);fan-out=一次事务 escrow child ceiling(默认 all-or-none;child terminal/cancel_confirmed 才释放;`joinPolicy={withinGroup,acrossGroups,outcomePrecedence}` 三字段——v3 推论非 Hatchet API);provider circuit 按 provider+credential+model 分桶;worker spawn env 改 allowlist 剥离未显式租出的 provider key(现整包传 process.env 为反例,src/codex-adapter.ts:204-206);retry=maxAttempts+root deadline 优先+持久 backoff 三正交,真正 dispatch 即消耗 attempt(crash 也算),retryClass=forbidden 恒禁;context-token=pinned tokenizer+输出硬 cap 算上界,无法界定 hidden context 时 API-billed adapter fail-closed;`approval_prompt` 独立 quota 维度(§10.1 approval spam);**billingClass=api 在 reservation/settlement/usage/circuit/credential-scrub conformance 全过前 hard-disabled**。
- **(v0.11/2.12(iii))预算默认值「可放宽」配置项**:现行为单向收紧惯例([可 policy 收紧] 类、requested* 收紧);新增管理面放宽配置属行为变更(已过提案盲审)——放宽仅经 admin 控制面显式配置,不经任务流,边界=不放宽 depth/hop/route structural cap 与 billing/data policy(同 BudgetOverrideGrant 纪律)。

### 6.7 挂起保留、睡眠时钟与展期(v0.11/2.6)

**前提约束:执行 deadline(`resolvedDeadlineAt`)是全链路授权地平线**——mutator fence、completion CAS、EffectPermit 消费皆以其为绝对上界,本节一切机制**不得反向延长它**(运行期改写已冻结的 resolvedDeadlineAt = 静默延长执行授权,恒禁;「waiting_* 进入时自动展期」已否决)。三拆:

- **(i) submit 默认值上调**:隔夜回批场景 profile 的默认 `ttlMs` 上调(spec 侧 [default,可 policy 收紧] 字段;caller 自 T1 起即见真实 `resolvedDeadlineAt`,无运行期改写)。
- **(ii) 独立「挂起保留/通知钟」**(仿 reconcileDeadlineAt/applyDeadlineAt 独立钟先例):恒 ≤ `resolvedDeadlineAt`,只驱动通知档位与 janitor 提醒节奏;系统睡眠感知(醒后宽限重排)**仅作用于此钟与通知**,不复活已过 fence 的任务;「临过期」档随 §12 通知三档,通知载体随 Q5(分工在此声明);并联动 Q2(无 client 时不承诺自动收口,DR-6)宜尽早裁决。janitor owner 行随 spec §5.6 修订落表。
- **(iii) 真展期=显式动作,条件-待裁决(不入 v0.11)**:仿 BudgetOverrideGrant 形态——holder-only 一次性 token、append-only grant、回显新 `resolvedDeadlineAt`;caller 侧是否可持须与 holder-only 纪律一并裁决,**不得默认引向 caller 自行展期**;采纳即触碰 phase-preserving mutation 封闭类,「状态机零改」失效,须单独过盲审后方可入 spec。探测扩展见 §15 Phase 0A(平台切片)。

---

## 7. 终局姿态表(8 象限)

| 方向/目标面 | 模式 | v1 机制 | 显式升级 | 关键 E2E 门禁 | 明确不支持 |
|---|---|---|---|---|---|
| Claude→Codex CLI | attached | AgentBridge 管理启动的 CLI pair(legacy adapter;Phase 0B 移除 tui_app_server 标志,同机迁 `--remote unix://<socket>`;暂留 ws://127.0.0.1 者标 experimental 兼容路径,非稳定终局) | app-server 富 adapter | busy/cancel/reconnect、旧 ask_codex 回归 | 附着野生 CLI |
| Claude→Codex CLI | dedicated | `codex mcp-server` worker | app-server 持久 worker | crash 后 Session-not-found 处置、审批 fail-closed | 宣称 MCP thread 跨进程可恢复 |
| Claude→Codex Desktop | attached | 非默认;manual_claim_current(§9.3) | armed_pull;未来 native adapter | hook trust、warning UI、CAS claim、origin | **零点击 idle-wake / active-turn steer / live takeover** |
| Claude→Codex Desktop | dedicated | mcp-server worker,结果同步回 Claude | app-server worker;viewer 仅导航 | worker 线程桌面可见性、deep link、计费来源 | 未经 E2E 承诺桌面可续接 worker 线程 |
| Codex→Claude CLI | attached | 显式 `contextMode=current` 的注册 session;FileChanged/asyncRewake | Channels(CLI);Monitor 仅 wake-hint | exact-session 唤醒、compaction、hook 失败语义 | 注入未注册 session |
| Codex→Claude CLI | dedicated | 用户创建并 pin 的 Bridge Claude session | 明示计费后 sidecar(`claude -p`/SDK) | restart/rebind、quota、complete | 静默启动计费 sidecar |
| Codex→Claude Desktop | attached | 显式 current;SessionStart 注册 + asyncRewake 唤醒 | 未来 native API | 桌面新 session 自动注册、idle 唤醒、guard hooks | 身份不明 session 注入 |
| Codex→Claude Desktop | dedicated(默认) | 用户一次性创建并 pin 的专用桌面 session | 明示计费后 headless sidecar | 桌面 reload/sleep、dedicated 角色恢复 | broker 静默改走 headless API |

所有象限:结果按 §6.3 存活性规则回到发起方;worker/dedicated 线程只是可查看的工作现场。默认目标解析(D-6):`ask_claude=require_pinned`;`ask_codex=activate_if_supported`(managed CodexWorker);`soft_fallback` 永不默认(§6.3)。

---

## 8. Claude 侧接入规格

### 8.1 唤醒链(反向 RPC 主链路,E2E-gated)

```text
SessionStart hook:幂等注册 {session_id, cwd, generation, transcript_path},
                 返回该 session 专属绝对 watchPaths(resume/clear/compact 滚 generation)
ask_claude 到达:broker 持久化 task → 原子更新该 session 的 signal 文件
FileChanged hook(asyncRewake:true):不读 payload、不 claim、不领 lease——
                 只读 signal 中的不透明 taskId,exit 2 唤醒
Claude 走 §6.5 领取协议(架构不变量见 §6.2/§6.4/§6.5;wire/shim 形状以协议规格 §7.3 为 SSOT,
  不在此复述以防漂移——claim_ack 为 wire-only,shim 原子复合 claim→claim_ack,ACK 成功后才向模型
  暴露 receipt/payload):
  peek_pending → preview_request(→ ClaimOffer{offerId,…}) → claim(offerId,…)(CAS,→ ClaimSuccessReceipt)
  → claim_ack(交付激活,§6.2/A-1:ACK 成功前不得开始执行)
  → 执行 → complete_task(§6.4 结构化 result + completionRequestId + expectedStateRevision)
Stop hook:仅做 dangling-request 诊断;绝不把 last_assistant_message 当结果
```

约束:**wake/SessionStart/FileChanged hook 与 signal 文件**永不携带正文与令牌(防注入 + 防 transcript 重放污染);任务契约唯一真值在 broker;**compact 后由 PostCompact 更新 broker/generation,模型上下文只能由随后的 `SessionStart(source:"compact")` 返回的 `additionalContext` 重新注入**(F10 边界);completion 必须带 completionToken(防冒名结单);单 session 单 in-flight。**PreToolUse PEP(v0.6 D-3)经认证本地控制通道**提交 `{hostEventId, toolUseId, rawToolName, rawToolInput}` 给 broker(broker 按认证 endpoint/session/turn 查 EffectContext §6.2 判定),**绝不落 signal/transcript**;hook/request body 中的 origin/principal/approval/operationHash 字段一律忽略或拒绝;找不到唯一 context 时受保护 effect fail-closed。`ask_claude` 无 pinned dedicated session → 立即 typed `no_pinned_target` + remediation(§6.3),不建 Task、不静默降级。
辅助通道:CLI 下 Monitor 可作 wake-hint(固定格式 `task-ready:<id>`,无正文);Channels 留作 CLI 增强,Desktop 判 unsupported(F11)。

### 8.2 注意力与公平(invariant I-3 配套)

per-session attention policy:`interruptible | idle_only(默认) | manual_accept | do_not_disturb`;"idle" 需最小静默时长,不能仅"无 active turn";human-first 调度:人的 pending prompt 永远先于新 agent 任务;连续 agent-turn 上限 + cooldown;attached 会话每小时唤醒上限(持久 GCRA/TAT 计数,§6.6,不用 session-local counter,防跨 session 绕过)。`waiting_input(reason=clarification)` 立即解除对端 waiter 并返回 SuspensionReceipt(§6.3;`displayMetadata` 展示 + `nextActions[].token` 才是授权)跨 App 接力;RPC 澄清必须经对应 `supply_input` 动作 token 提交(`Reply to <task-id>` 仅 UI selector,不产生授权),普通 prompt 永不自动绑定。

---

## 9. Codex 侧接入规格

### 9.1 Codex 插件(分发)

```text
agentbridge-codex-plugin/
  .codex-plugin/plugin.json    # skills/mcpServers/hooks 声明
  .mcp.json                    # STDIO shim → broker(读 0600 token 文件,不依赖 shell env)
  skills/                      # $agentbridge:ask-claude / claim-current / status / doctor
  hooks/hooks.json             # SessionStart 注册;Stop/UserPromptSubmit 元数据 nudge
```

契约:安装+enable 后**新 task** 自动生效;hooks 按 hash 信任(升级后重信任,进升级 E2E);MCP shim 的进程拓扑与 thread 身份获取是 Phase 0 P0 项——拿不到可信 thread ID 时按 §5 判 attached unsupported。**(v0.11/2.16)hook 面积稳定性约束**:逻辑下沉 MCP shim,hook 只留稳定薄壳——降低逐 hash 重信任频率(F5/F6 摩擦面)。

### 9.2 CodexWorker(Claude→Codex 默认执行面)

v1 = `codex mcp-server` 子进程(**有状态 lease**):`codex()` 开线程、`codex-reply()` 续线程、MCP cancelled 中断当前调用;审批 elicitation 到达 broker 时**永不代批**,转 `waiting_input(reason=approval)`。**不论宿主当前配置为何**,worker 启动时强制验证 memories 全关(F14),无法证明用隔离 `CODEX_HOME`。`executionSurface=codex_worker`,`desktopViewer ∈ {verified, unavailable, unknown}`;Desktop 仅 viewer,live takeover 不支持(§1.2),drain 后 resume 由 E2E 决定。升级 app-server 条件见 DR-4;裂脑防护复用 §6.2 的**完整 ExecutionLease + PushCompletionHandle fence**(不引入单独的 `fenceToken`),按 threadId 排他。

**Worker 生命周期与收割(v0.6 D-1;防僵尸;DR-6 配套)**:每 worker 持久记录 `{workerId, workerGeneration, brokerGeneration, supervisorPid, childPid, pidStartTime, launchNonce, profileDigest, state, activeDispatchId?, lastUsedAt, idleDeadlineAt, drainDeadlineAt, reapedAt}`;状态机 `STARTING→READY_IDLE⇄BUSY`;`BUSY` 中请求失败但**子进程仍存活**→`RECONCILE_TASK`(旁路态,对账后回 READY_IDLE);**子进程 unexpected exit(waitpid 可观察)→ 关联 Task 进 reconciling + worker 只能 exit-observed→REAPED,不得回 READY_IDLE**(已退出进程无法复用,须新建 worker/新 generation);`READY_IDLE→DRAINING→TERM_SENT→KILL_SENT→REAPED`。纪律:单 worker 单 in-flight,`waiting_input/approval/callback` 期间恒 BUSY、不起 idle 计时;task terminal 且无未决 MCP request/elicitation/write queue 才回 READY_IDLE;warm TTL 须有限硬上界、默认从紧(数值进 §0-A.10,Phase 0 校准,禁无限);`connections=0 && activeTasks=0` 时 idle worker 立即 drain、不等 TTL;drain 序列=协议 shutdown/关 stdin→SIGTERM→SIGKILL,必须观察 exit/waitpid 才标 REAPED;spawn→record 崩溃窗口由 supervisor control-pipe/launchNonce 封口,broker EOF 时清理整个 process group(进程卫生保证,非 same-UID 安全承诺,§10.4);broker 启动按 PID start-time+launchNonce 扫描遗留。reap 丢失 mcp-server 内存 thread(F7),之后新建 worker/thread,不假装 resume。**BUSY 收割(防 stuck-BUSY 阻塞 DR-6)**:worker 因 elicitation/approval 永不返回滞留 BUSY 时,Task deadline/cancel/approval-expiry 触发 janitor:interrupt pending MCP → bounded drain → 按 effect 是否可能已发生定 EffectIntent denied/cancelled 或 Task reconciling → revoke/settle **ExecutionLease**(worker-process lease 仅 waitpid→REAPED 后释放)→ 走 DRAINING/REAP;"无未决 MCP request"不得成为永不满足的活死条件。`PreAcceptSubmitIntent` 失败只释放其 obligation,存在其它 live consumer/accepted Task 时不无条件 reap 共用 worker(refcount §0-A.10)。

**工作区策略(v0.11/2.1)**:worker spawn 增加 workspace provisioning 决策——git 仓库默认**隔离 worktree**,merge-back 语义显式(worktree 分支适用:diff 交付,禁静默合并);非 git 场景**原地编辑 + workspace lease 串行化**,变更须交付 diff 报告(禁静默改动)。lease 只提供互斥、**不提供隔离与回滚**——「临时 mirror/overlay vs 限定只读规划」列为待评估候选,G-3 gate 前裁决;「非受保护路径并发写」列入 G-3 gate 验收项。(spawn 两阶段现行仅涉 PID CAS/launchNonce/env allowlist,无 workspace 条款——纯增补。)

**凭据策略(v0.11/2.9)**:worker profile 默认剥离 git push 凭据/禁 push(现整包传 process.env 为反例,§6.6 allowlist 同源);`vcs_push` 列为 EffectIntent.operationKind v2 候选(区别于 Task 侧 canonicalOperationKind;v1 封闭集 `fs_*` 不动)。

### 9.3 manual_claim_current(当前线程人工领取,阶梯第 2 级)

```text
SessionStart:注册 session_id + cwd + generation
Stop:任务在本 turn 期间到达 → turn 尾发一次 metadata-only systemMessage;
     绝不 decision:block(其 continuation 伪装 user prompt = origin 洗白,禁用)
UserPromptSubmit:补查 idle 期间到达的任务;只 peek、内部超时 ≤100ms、永不阻断用户 prompt
用户说"预览 AB-42" → §6.5 领取协议(preview_request→ClaimOffer→claim CAS→claim_ack 激活;架构不变量
     见 §6.2,wire/shim 形状以协议规格 §7.3 为 SSOT)→ 正文以 untrusted
     外部内容标记经 MCP tool result 返回(不进 developer context)→ 分析可继续;
     非受保护副作用(一般写/网络)需第二次确认;受保护路径走 §6.1 有序决策表(manual_claim 不改 origin;
     agent_rpc 恒 agent_rpc)。非-policy-control 资产:放行腿未启用时等效 terminal denied + 另建 user-origin
     task。policy-control 资产:恒拒、nextAction=open_admin_settings,换 user-origin task 亦拒,不可洗白
```

边界:用户不输入则 nudge 不触发(eventual、human-mediated,非同步 RPC);`systemMessage` 桌面视觉位置/持久性、`followUpQueueMode="queue"` 下的 hook 时机均待 E2E。

---

## 10. 安全、审批与数据治理

### 10.1 Origin 与审批(O-1 纪律的机器化;上线 blocker)

Origin 不是一个可伪造字符串,是一组**由已认证 adapter/broker 带外写入、payload 无权覆盖**的字段:

```text
originKind ∈ {user, agent_rpc}
authenticatedPrincipalId, originInstallationId, originEndpointId,
originRuntimeSessionId, originTurnId, originAttestationRef?, policyEpoch
```

- 缺少宿主可验证的真人 attestation 时,一律归 `agent_rpc`;委托只能衰减权限(capability attenuation),**永不原地升级为 user**。
- Codex 转述"用户同意/APPLY"、Stop continuation、hook context、sidecar prompt 一律不构成审批。
- **受保护 effect 两腿与启用顺序(§6.1;O-1 零弱化)**:腿 1=waiting_input(approval)→真人批精确 operationHash→一次性 sealed EffectPermit(绑 `{approvalId, operationHash, attempt, toolUseId}`,不可委托/转移/衰减)→仅该次 effect 经 EffectMediator 放行;腿 2=terminal denied+nextAction。放行(腿 1)在 **§15 G-5 完整组件集**(单一 SSOT,组件清单见 §15 G-5)conformance 全过前 hard-disabled(单开关原子启用);**Phase 1B 仅交付两腿文本语义 + principal-bound 审批记录 + approve.sh 迁移期 principal 改造(仅记录卫生,不解锁任何 effect)+ deny-only PEP stub**,无"弹窗后裸放行"中间态。
- **policy-control 资产恒拒(比稿件更严,不可洗白)**:`policy_control` 类 = 对 enforcement TCB 及其所有 code/config/metadata 输入的**传递闭包**——含但不限于:guard 脚本/hook 与插件 manifest/protected manifest/broker DB 与 token/审批密钥与状态/break-glass 状态/审计配置、**PEP/EffectMediator/Approval Agent/authorizer 的 executable 与加载配置、attestation enrollment 注册表(`keyId→principal`)、ActivationGrant/billing-binding 存储、retry/tool manifest、service/discovery/launch 配置**,以及任何能改变 classification/canonicalization/permit validation 的输入(精确路径清单进 §0-A.9)。**任何 origin(含新建 user-origin task)对其变更一律恒拒:不发 ApprovalChallenge、不铸 EffectPermit、不返回 `create_user_origin_task`,只返回 `nextAction=open_admin_settings`**。`open_admin_settings` **仅 navigation**(不携带 EffectIntent/operationHash/diff/token/预填 mutation);变更只能由用户离开任务流、经独立本地 admin 控制面由 admin principal 发起并过其自身人闸。bypass marker(`.manuscript_guard_disabled`)语义废除:break-glass 改带人闸/短 TTL/持续 banner+审计的 admin action,任务 RPC 不暴露,迁移期 marker 即使存在也被新 guard 忽略。删除 agent 可调用的 approve.sh 签发入口;submit token 不进 transcript,文本"用户已批准/APPLY"无效;无 session-wide approval,v1 仅 exact-effect approve。旧审批链整链退场的运维协议=§16.1(§18-Q9 已冻结)。
- **审批呈现 surface**:Phase 1 之后由随 broker 交付的本地 Approval Agent(surface=approval_system)承担,**放行 gate 启用前不激活**;Console(§12)只读/deep-link/唤起本机 Approval Agent,永无批准权、不提供裸 /approve。
- **ApprovalChallenge(原子事务)**:`{approvalId, approvalRevision, taskId, dispatchId, attempt, effectIntentId, operationHash, presentationDigest, originKind, originLineageDigest, targetInstallationId, targetEndpointId, targetRuntimeSessionId, runtimeGeneration, presentingEndpointId, presentingGeneration, requiredAttestationScheme, schemeId, keyId, protectedStateRevision, policyEpoch, protectedManifestDigest, nonce, expiresAt, status}`。**建立 challenge + Task CAS 到 waiting_input(approval) + presentation outbox 单事务**;一次性消费(条件 UPDATE;同 decisionDigest 重放返旧 receipt,异决策 AlreadyDecided)。**allow 与 deny/expiry 决策事务对称**:两者都原子写 `{EffectIntent outcome, Task 转态, token tombstone, resume 或 terminal/denial outbox}`;deny/expiry 后 Task deadline 已到 → terminal expired(不回 running,走 terminal/completion outbox)。cancel/terminal 原子撤销**尚 pending/unused** 的 challenge/permit;已 executing 的 permit 按 §10.1 cancel/deadline 赢家(consume 先赢不撤销、走 cancelling+settle/reconcile)。`submit_approval` token 经 `claim_approval` 才铸,绑 approval endpoint/generation/principal/operationHash/schemeId,只存 hash,不进通知/transcript/URL/日志;完整 schema 与执行前 revalidation 集合 §0-A.9。
- **attestation 与 scheme 分层(修 F13)**:`HumanGestureAttestation` = enrollment 密钥对域分隔 challenge(`approvalId‖approvalRevision‖operationHash‖presentationDigest‖principalId‖目标 installation/endpoint/session/generation‖schemeId‖nonce‖expiresAt‖decision`)签名;`keyId→principalId` 由 enrollment 绑定、不接受自报;证明"该安装登记 principal 对应 key 经一次系统 user-presence gate 使用",不宣称识别自然人(共享 OS 账号判 unsupported 或另加账号级登录)。scheme 分层:v1 最小档 `user_presence_dialog_v1`(系统级前台弹窗呈现 canonical 内容+presentationDigest、明确人类点击、软件 enrollment key 签名——**抗 same-UID 伪造能力为零,落在 §10.4 out-of-scope,须逐字声明**);升级档 `secure_enclave_p256_biometry_v1`(Touch ID 硬件强制、不可导出私钥)。broker 按 policy 选 `requiredAttestationScheme`,endpoint capabilities 不含即 fail-closed(禁静默降档)。禁 Web/Console 按钮、自动确认、accessibility 自动化替代系统弹窗;approval spam 受 §6.6 `approval_prompt` quota,不同 operationHash 不合并一次批准。Approval Agent 不可用 → 有界 activation,超时 `approval_surface_unavailable`/`approval_timeout`,绝不永久 pending;审批挂起中 executor 丢失 → challenge cancelled、迟到批准拒绝。
- **origin 与 effect attestation 分离**:AuthenticatedSubmitContext 的 `originAttestationRef` 只描述任务发起时刻;effect 审批的 attestation 挂 ApprovalChallenge/EffectPermit,**永不回写 task origin**。
- **EffectMediator 与路径归一化(D-3 验收边界,§15 逐项 gate)**:受保护写只允许两后端——①EffectMediator 结构化 create/replace/edit/delete/rename:从登记 root fd 逐层 openat/fstatat no-follow(lexical/resolved path+`{dev,ino}` 双记录,`resolve(strict=False)` 非 authority);symlink 任一层命中 protected 即 protected 且 v1 mutation 默认拒;hardlink 以 `{dev,ino}` 查 protected index,`st_nlink>1` 保守拒(人工 break-link 重规划);rename 同时绑 source/destination/被覆盖 victim 三方 preimage/file-id;temp-file 仅 mediator 在 target parent fd 内 `O_CREAT|O_EXCL|O_NOFOLLOW` 创建→write→**fsync(temp fd)**→fd-relative atomic replace→fsync(dir)(跨目录 rename fsync 两 parent);②通过 conformance 的 deny-default sandbox(protected/`policy_control` roots 恒只读)。**准确说是"一个 commit 后端(EffectMediator)+ 一条只读规划/隔离路径(sandbox)"——sandbox 只规划,真正 commit 只由 EffectMediator 执行**(§0-B/D-3 摘要"双后端"措辞同此义)。批准后裸放行 Edit/Write/Bash 不合格;opaque shell/脚本/未知 MCP effect 工具:能在隔离 overlay 先产完整 target/postimage plan 则走人审+mediator,否则 `unmediable_effect` fail-closed。事务链:EffectIntent→ApprovalChallenge→human allow→EffectPermit(sealed)→PEP re-plan/re-hash→CAS 消费 permit(unused→executing)+EffectAttempt(intent_committed)+WorkspaceEffectLease→fd-relative effect→verify postimage→settled;SQLite 与文件系统不能原子提交→effect 前先 durable intent,崩溃后按 inode/pre/postimage 对账 applied/not-applied/unknown,unknown 不自动重试。
- **protectedStateRevision 推进规则(D-3;防恒等 fence)**:`protectedStateRevision` 按定义域单调推进——protected root 集合 / protected_paths / manifest 变更、policy-control 分类变化、或成功的 protected commit 影响分类状态时递增;批准后、执行前若 revision 已推进则旧 permit stale + 重批(§10.1 fence)。精确 granularity/触发/CAS 编码进 §0-A.9,但"必须有推进规则、执行前 revalidation 非恒等检查"属正文不变量。
- **执行前 fence + 失败总出口**:EffectPermit 的 CAS(unused→executing)必须与下列重验**同事务且线性化**:Task 非终态/非cancelling、current `{dispatchId,attempt,leaseEpoch}`、`expectedStateRevision`、target runtime generation、permit 未过期/未撤销、opHash 由 PEP 重算无漂移、`transactionNow<resolvedDeadlineAt`。任一不符按类分流(先保证旧 permit 不产生新 effect):①stateRevision/opHash/protected-state 漂移 → 重读 durable state、建**新** intent/hash、重跑完整 §6.1 有序决策表(仅仍 eligible 才新建 challenge,**禁直接 reapprove**——manifest 漂移把目标升级 policy-control 时重跑会命中 rule 1 恒拒);②known-stale dispatch/attempt/lease → tombstone 旧 permit,旧 attempt 不改当前 Task;③permit expired/revoked → 走 approval-expiry/revoke 出口;④same request permit 已 executing/settled 重放 → join/replay 原 receipt,事实不明才 reconciling;⑤其余未分类 mismatch → fail-closed、effect 不发生。字段列/枚举/SQL CAS/receipt schema 进 §0-A.9,结果分类与 fence 集合属正文不变量。
- **deadline 赢家(平行 cancel 赢家)**:deadline 与 permit-consume 竞态由单一 CAS 线性化,成功 permit-consume CAS = "effect 是否允许开始"的 deadline 线性化点:deadline CAS 先赢且 permit 尚 unused → revoke、无 effect、terminal expired;permit-consume CAS 先赢(EffectAttempt 已 executing) → **不撤销 executing permit、不立即 terminal**,进非终态 drain 等 EffectAttempt settle,事实不明→reconciling,之后才 terminal expired 并保留真实 outcome/记 effectMayHaveOccurred。cancel-after-approve 同理:cancel 先赢→revoke/无 effect;consume 先赢→Task 进 cancelling,等 settle/reconcile 报 effectMayHaveOccurred,不立即伪装 cancelled。
- app-server 的 `turn/start` 输入与 mcp-server 的 `codex/codex-reply` prompt 在模型历史里呈现为 user 角色 ≠ 真人授权;worker 永久按 agent_rpc 权限运行。
- 不安装任何自动 allow `PermissionRequest` 的 hook;`bypassPermissions/dontAsk` 下强制 preview_only。
- **(v0.11/2.4)deny-only 期与用户本人 APPLY 工作流裁决**:
  - **(i) deny 面零弱化,两支均否决**。fall-through 到既有 HMAC 审批链支否决:旧链输出不得进入任何 v3 放行判定;bypass marker 语义已废除(本节上文),fall-through 会将其复活为受保护路径写入的决定性通路;「用户本人 host turn」限定**无机器可验证锚点**(HostTurnBoundary `turn_id` 现恒 null,§15-9)。**host-turn 观察模式(仅记录不 deny)支同样否决**,四条理由:①policy_control 豁口——观察放行一次写入即卸除 guard 体系自保护,与本节「任何 origin 恒拒」冲突;②origin 误判 fail-open——broker 重启对账窗内排除法会把仍在续行的 bridge-origin 工具调用判为 host turn,把「找不到唯一 context 时 fail-closed」反转;③G-5 split-brain——旧 hook 链在独立 config-APPLY 轨道,「原子切换」跨不了两个治理域,且 gate 只解锁 allow 腿,deny 侧翻转不得挂 G-5 开关;④wire 无表达值——`pep.check` decision 封闭 `{deny, not_protected}`,「受保护但放行」无合法编码。根因:合法 observe 面在正向人类锚点过门前为**空集**,按排除法圈定的面反而**过宽**。
  - **(ii) SEC-3 处置=deny 面不动 + 接续动线(缓解,不是解)**:host turn 命中受保护路径维持 deny,deny 响应携接续动作——非 policy_control → `create_user_origin_task`;policy_control → `open_admin_settings`(仅 navigation,本节语义不动)。载体=`pep.check` 响应 additive 字段 `nextAction`(rule 1/2 分类只有 broker classifier 知道,hook 本地固定文案不可行);**持久化=`deniedNextAction` 列恒写 + 四类 semantic-deny 投影**(direct / escalated(既有 escalation 列组)/ legacy 行 tagged profile(NULL=合法缺席、零回填、分代 CHECK)/ conflict deny 恒无 nextAction——异常信号非记录重放);**兼容面=请求侧自报位 `supportsNextAction`,定性=coordinated breaking upgrade**(hook 通道无 helloAck,canonical 协商载体不可用,本位为受控替代;自报位不入幂等锚/operationDigest/conflict 元组;`pep.check_v2`/hook-channel feature carrier 均否决——同构偏斜窗/单方法握手过度工程)。**放行白名单总谓词(冻结不变量)**:宿主 hook 对 `pep.check` 的**唯一放行条件**=完整验形的成功结果且 `decision=not_protected`;**其余一切**(typed error/超时/transport 失败/成功信封但验形失败或未知 decision 值)**恒 block**。偏斜窗可用性=**一次性去位降级重试**(仅剥自报位、第二请求逐字节全等、至多一次;审计=hook 侧 best-effort 诊断义务、非安全承载;`-32601` 与 `unknown_field` 在 doctor/审计区分;`retryable=false` 的 method-local re-probe 例外条随 spec 登记);升级次序 broker-先于-hook + doctor 检查项=**可用性保障**(doctor 是瞬时诊断非 runtime fence;broker 回滚/重选主窗内行为=恒 block,零放行面)。本请求位扩写 PEP 提交元组一位(additive;不属本节明禁的自报类——只影响信息型回执,不参与授权判定)。**1B 效力如实声明**:接续动线不解冻写入(放行腿整体 G5-GATED,新建 user-origin task 命中同一受保护路径仍 terminal denied;policy_control 恒拒不可洗白)——交付的是可见性与交接 + 审计锚 + G-5 后即时生效的动线;窗口期用户 APPLY 的实际通路=用户自有链路 / admin 控制面独立重建。**G-5 enable 前置开放项(F4)**:G-5 后 approval_records 退为历史审计,`deniedNextAction` 持久/重放义务的后继实体选型(保留专用 host-turn PEP record vs 新增效果记录族 host-turn 实体)必须在 G-5 enable 前裁决(gate 远期 G-5,不 gate 1B 交付)。
  - **(iii) 观察模式=条件候选(不入 v0.11)**:前置=§15-9 HostTurnBoundary `host_turn_id` 支 PASS;过门后可重开三值 origin 设计(`unknown` 恒 deny;observe 仅 `positively_attested_human` 且非 policy_control),届时须一并交付 wire 扩展与跨域 cutover 协议。旧审批链整链退场的运维协议=§16.1(§18-Q9 已冻结)。
  - **(v0.11/2.12(i))授权面板=G-5 伴生交付**:ActivationGrant/DedicatedBinding/enrollment 的列表/撤销/到期管理面随 G-5 交付,不延至 Console 阶段。**(2.12(ii))恒拒清单维持恒拒不弱化**:agent 产出仅为**不可信只读说明/注记**——不携带 diff、不进 admin 提交动线、不预填任何 mutation;用户离开任务流后在 admin 控制面独立重建变更并过其自身人闸(「agent 起草 diff → admin 面人闸提交」受控通道表述**废除**——与 `open_admin_settings` 仅 navigation 不变量正面冲突)。

### 10.2 跨厂商数据治理(invariant I-4)

任务/room 携带 `dataClassification + accountClass + provider/region allowlist`;受保护内容(protected_paths 命中)默认拒绝跨厂商派发。载荷三副本(broker DB、两侧厂商云)各带 lineage id + retention class + tombstone;"本地删除"不得宣称远端已删;legal hold 独立可审计;`accountClass=unknown` 不得处理公司数据。

**来源登记表(Source Registry,accessed 2026-07-14;上线前须复核版本与账户/地区适用范围)**:

| 主题 | 来源 |
|---|---|
| OpenAI 外部集成按外部 provider 条款处理 | help.openai.com/en/articles/9903489-eu-data-residency |
| OpenAI 自动化/凭据/限流约束 | openai.com/policies/terms-of-use、/policies/service-terms |
| Anthropic consumer/商业数据角色 | support.claude.com/en/articles/9267385 |
| Anthropic 保留周期(consumer/Enterprise) | privacy.claude.com articles 10023548、10440198 |

ToS 边界(订阅额度被另一家 agent 无人值守驱动)标 **[待法务确认]**:仅用官方接口、不共享凭据、不绕过限流,发布前取得确认。本节在登记表复核前属**政策快照,不得视为长期产品保证**。

### 10.3 防注入

envelope(结构化元数据,本地生成)与 payload(不可信外部内容)严格分离;wake/nudge 仅含不透明 id;payload 以 untrusted 标记经工具结果进入;sender 鉴权;通知发送者永远不获得权限中继。

### 10.4 same-UID 信任边界(D-4 终裁,2026-07-14 用户拍板)

- **威胁模型声明(显式,不许沉默)**:同一 OS 用户下的其它本地进程——**包括被注入的 agent 自己 spawn 的进程**——明确 **out-of-scope**。本声明须同时出现在 PEP/鉴权代码注释与本节(ssh-agent.c:1980-1990、dbus-connection.c:5338-5347 范式)。UDS 0600、peercred、token 文件、Keychain、WorkspaceEffectLease 对 same-UID 攻击者的任何阻力均为副产品,**不构成安全承诺**;DoS 全档不防。
- **机制档(④混搭)**:日常零交互——peercred 拒其它 UID+读写分档+对端 PID 入审计;crypto/rand token 0600+ConstantTimeCompare。受保护 effect 每次过人闸(§10.1 两腿)。**人闸理由是 O-1 审批纪律(D-2/D-3),非 same-UID 防御**;可审批的**非-policy-control** protected effect 每次过人闸(policy-control 恒拒)。
- **证据边界(如实记录)**:共享 runtime(Node/Electron)下可执行文件哈希证不了"是 AgentBridge shim"的 code identity(SPIRE 实证,矩阵 §1.13;Bun 未核);attestation 弱档 `user_presence_dialog_v1` 的软件 enrollment key 可被 same-UID 进程读取——该残余风险恰落在本节 out-of-scope 边界内,须逐字声明。
- **(v0.11/2.15)文档化升格**:本节 same-UID 抗性为零的声明升格为**用户可见文档**(安装/首次配置时呈现,不只埋在架构文与代码注释);Secure Enclave 档(`secure_enclave_p256_biometry_v1`)升级与手稿类资产绑定,列评估项。

---

## 11. Broker 生命周期与存储规范

- **选主**:O_EXCL 锁 fail-closed(修 F15 fail-open)+ 固定 UDS bind 终极 fence;选主记录含 installation id + PID start-time + boot id;仅持锁者可清 stale socket。验收:100 并发冷启动注入 EACCES/EIO,恰一个 winner 或全部失败。
- **发现文件**:`status.tmp → fsync(file) → rename → fsync(dir)`;仅作 hint,socket probe + 身份验证才是真值;parse 失败进 recovery,不 unlink/不 spawn。
- **退出谓词**:DR-6;ghost client 用带期限 lease;断连 debounce + 最短驻留;DRAINING 期间接受 reconnect,新候选见 live drain generation 只等待。
- **SQLite**:WAL;单 writer actor(不在 IPC 事件循环内,有界 busy deadline——防 SQLITE_BUSY/长维护冻结全体 client);`PRAGMA user_version` + migration journal + `min_reader/min_writer`(旧 binary 遇未来 schema 拒启,绝不重建空库);expand/contract 迁移 + 迁移前 online backup;备份仅 Online Backup API / `VACUUM INTO`;监控 WAL bytes / oldest reader age;`SQLITE_FULL` → `storage_degraded/read_only`,commit 前绝不返回 durable acceptance。
- **State dir**:live DB 固定本机 Application Support/XDG;检测并拒绝 network/同步文件系统;`AGENTBRIDGE_STATE_DIR` override 过同一检测。
- **崩溃语义**:crash-only;fatal 异常停 accept、写 crash marker、非零退出(修 F15 的假健康)。
- **leasedAdapters 定义(DR-6 退出谓词项;v0.6 D-1)**:= 所有尚未 REAPED 的 supervised worker-process lease 数(STARTING/…/KILL_SENT 全算);发 TERM/KILL 不算归零,观察 waitpid 才算;broker 正常退出前必须归零。attached endpoint/Approval Agent 等非 worker adapter 各有独立 drain 语义,不计入本谓词。
- **pendingActivations 定义(DR-6 退出谓词项;v0.6 D-6)**:= 未消费的 `PreAcceptSubmitIntent` + 处于 `ready_unbound` 非终态的 `ActivationAttempt` 之和;全部 joiner accept/fail 或 intent settle 释放后归零。READY_IDLE 立即 drain 亦须 `pendingActivations`/PreAccept obligation/consumer refcount 归零。
- **审计日志**:broker 单写、进程锁轮转、序号文件名;debug log 可 best-effort,audit log 不得吞错误。**(v0.11/2.10 起 DB 行为审计 SSOT,轮转/导出文件为派生物,不承载序号真值。)**
- **retention 分层(v0.11/2.10)**:①**证据/日志面**(`task_events`/`audit_log` 两表)=默认保留期+归档导出(**archive-commit-then-delete** 次序);②**authority/tombstone 面**(tasks 终态行 authority 锚、completion token tombstones、latest RegistrationDecision、host_turn_boundaries 等 live 引用行)=沿用「latest 常驻 / ≥lingerMs / 禁 GC」惯例,**显式豁免默认 TTL(不变量,恒不触)**;**B1 增员(v0.12)**:cutover 状态/policy/trust revision/fence/coverage snapshot+source-event obligation 明细/snapshot member/adapter gate receipt/transition receipt/admin 授权与事实 receipt/effect closure/hook load proof profile 行=authority 面,显式豁免默认 TTL;hook coverage evidence 被上述行 live 引用者按 live-reference safe-delete 豁免(引用边=snapshot member `coverageEvidenceRef`),未被引用者按 evidence 面;**abort attempt(`cutover_abort_attempts`)行同为 authority 面恒 durable(pending abort 的唯一恢复载体——窄审 r3 补员);legacy partition freeze receipt(`effect_intent_legacy_freeze_receipts`)与 resolution winner registry(`effect_attempt_resolutions`)行同为 authority 面恒 durable(boundary/winner 判定的唯一载体——窄审 r8 补员);resolution conflict audit(`effect_resolution_conflict_audits`)行=audit 面 append-only(逐次冲突审计、非判定载体,无 authority 豁免需求——r10-b1 修③ 补员)**(§16.1;spec §17 表族逐表标注);③**`usage_events` 归 settlement 豁免面**——它是幂等结算的唯一载体(幂等锚=(dispatchId, settlementKind)/(activationRef, settlementKind, settlementConsumerRef) 部分唯一),按 TTL 删行=拆结算幂等锚、recovery/replay 可重复结算,**恒不入默认 TTL**;其压缩/归档须 settlement-aware 安全删除谓词,留后续定向裁决。**清理 owner**=janitor 域新增 `evidence_retention_gc` 行(additive;spec §5.6 随 spec 修订落表)。**冻结不变量**:时间锚=`task_events` 增**不可变逐行 `recordedAt`**(到龄=行自身超期;父 task `terminalAt` 仅作「已终态」资格门——非终态任务事件恒不清,TTL 后追加的 late_result/verification evidence 以自身时钟起算完整保留期)+ `audit_log` 增 additive `recordedAt`;**per-task `eventSequence` 高水位**存 tasks 行 additive `eventSequenceHighWater` 列(event append 同事务单调推进、不动 stateRevision;迁移=新 Task 初值 0 / 旧 Task 回填 `MAX(task_events.eventSequence)` / `min_writer` floor 后复核并落 migration-complete 标志,标志前 append 沿现行按既有行派生口径、GC 不依赖高水位);`audit_log` **废除纯表级 TTL、改 live-reference safe-delete**(到龄 ∧ 不被任何持久引用列指向才可删;已知成员=approval_records.escalationAuditSeq,封闭清单随 spec 枚举)+ **`seq` 永不复用**(最高行归档删除后新写入不得复用旧 seq;durable 高水位 carrier 必备,实现留 spec);两枚 `recordedAt` 列 nullable expand、**存量 NULL 行恒不删**(fail-safe)、GC activation fence=writer floor 生效后启用且仅扫非 NULL 行;append-only 纪律=禁改写、不禁到龄删除(显式登记的 retention 例外)。保留期数值/批大小/归档格式留 spec 期。caller-terminal 通知集(第三类)随 §18-Q10(B2)裁决,v0.11 不交付。
- **卸载与 purge(v0.11/2.17)**:新增卸载流程=默认「删代码不删数据」+ 显式 purge 命令。**purge 目标集=安装期落盘的 AgentBridge-owned provenance manifest**(仅含 `$STATE_DIR/**`、Keychain `installationTokenSecret` 项、enrollment 密钥、插件 bundle、Approval Agent 及其配置、launchd/service 条目等 AgentBridge 创建物);共享文件(宿主 settings/.mcp.json/hooks 目录中 AgentBridge 注入的条目)仅做**精确反向补丁**(删条目不删文件);用户自有资产恒不在 purge 集。⚠**不得复用 policy_control 资产清单作 purge 清单**——该清单语义是 classification 输入锚/保护集非所有权清单,按字面 purge 将删除用户 guard 体系及其恢复源,不可恢复。purge 默认 dry-run 输出完整清单,实删需显式确认。

---

## 12. 可观测性与 Console(横切工作流 C;premortem #1 对策)

从 Phase 3 起与主线并行交付,并作为 legacy 移除的发布门禁(不等待 Phase 5):

- **统一 Inbox/Console**:pending/waiting/running 任务、wait-for 图可视化("谁在等谁")、发起线程回填、一键 deep link 跳目标 surface、per-capability 健康(不是单个绿灯)、usage 归因、审计时间线。Console 只读+deep-link/唤起本机 Approval Agent,**自身永无批准权**(不提供裸 /approve);legacy unknown(§6.1 unknownReason)单独分桶展示,不计入 dispatch 不确定性。
- 通知三档:需要操作 / 最终完成 / 不可恢复失败;进度收进 activity log;同任务通知原位更新。
- 度量内建:跨 agent 调用完成率/时延/额度成本(premortem #3 的数据基础)。
- **doctor 行为规格(v0.11/2.11(ii))**:检查矩阵=daemon 可达/DB 可读/配对有效/hook 已信任/schema 版本匹配/**broker-hook 版本偏斜**(§10.1 自报位启用前置检查),每项标注**自动修复 vs 仅报告**,双侧插件各一份;doctor=瞬时诊断,**不承担 runtime fence 语义**(§10.1 白名单谓词承担安全面)。

---

## 13. 五条不可妥协 Invariant

- **I-1** 全局 wait-for 图(等待边持久化),同步环 = 立即 `would_deadlock`;嵌套回调必须 `waiting_callback` unwind。
- **I-2** broker = client-triggered 启动 + obligation-owned 存活;有未完成义务不正常退出(崩溃恢复边界见 DR-6)。
- **I-3** RPC 默认隔离:dedicated session、memory 全关校验、context/quota 预留;`contextMode=current` 是显式例外且受 attention policy 约束。
- **I-4** 每次跨厂商派发过数据分级/账户等级/retention 判定;受保护路径 fail-closed。
- **I-5** 发布门含真双桌面 conformance;新 capability 出现 ≠ 政策授权,任何新 transport 默认 disabled。

---

## 14. 风险登记册(四轮合并 51 项压缩;★=Top5)

**同步语义**:★双向同步死锁(I-1)| 跨 RPC 持锁全绿假死 | 单飞槽回调饥饿(waiting_callback)| 协议完成≠任务完成(§6.4)。
**注意力/UX**:agent 流量饿死真人 | 唤醒劫持输入中的用户 | waiting_input 落错 App | 用户普通回复误绑 RPC | 通知疲劳。
**会话资源**:★context/额度/memory 污染(I-3;memory 配置易变见 F14)| compaction 抹契约(broker SSOT + SessionStart(compact) 注水)| quota 假死(`quota_exhausted`)| 临时角色残留 | 上下文语义漂移(contextBasis/superseded)。
**数据治理**:★跨厂商 residency/账户级降级(I-4)| 删除/legal hold 三副本分叉 | Codex memories 渗透(F14)| ToS[待法务]| 双模型接力的许可/indemnity 链断裂(artifact 带 provider/model/source hash)。
**审批安全**:审批洗白(§10.1 blocker)| confused deputy | completion 冒名(completionToken)| Stop decision:block 洗白(禁用)| 恶意项目配置越权(broker 独立 ACL)。
**Broker/存储**:★durable 队列 vs client-owned 生命周期(I-2)| 双 broker 选主 | torn discovery write | ghost client | 任一 client 全局 stop | cwd 污染 | fatal 后假健康 | schema 回滚 | WAL 备份/checkpoint 饥饿 | SQLITE_BUSY/长维护阻塞 IPC 事件循环 | 磁盘满双失声 | 同步盘 state dir | 短命 broker 维护饥饿。
**投递可靠性**:静默丢消息(level-triggered + complete)| 重复副作用(reconciling→unknownReason=reconciliation_unresolved,写任务禁自动重试)| 误路由/ABA(fencing)| 队列 DoS | 结果过大(artifact 化)。
**演化/工程**:★mock 绿真机红(conformance lab)| 真模型不当 transport oracle | E2E 污染真环境 | `ask_X` O(N²) 腐化(核心 `task.submit`,ask_* 是糖)| fan-out 部分成功(joinPolicy 显式)| 多 agent 伪独立共识(provider/model/context hash 降权)| 半升级(握手降级只禁反向 RPC)| Windows 支持矩阵待定义 | 循环风暴(hop/depth/预算,§6.6)| warm-worker 泄漏与 reap 观察缺失 | stuck-BUSY 阻塞退出(§9.2)| worker result 已回而 commit 丢失→unknownReason=reconciliation_unresolved | 弹窗疲劳误批(approval_prompt quota+不同 opHash 不合并)| policy-control 洗白(恒拒,§10.1)。

Premortem(6 个月失败因;概率为设计推断非实测):注意力成本超收益 ~40% → §12;宿主升级半工作 ~35% → per-capability 健康 + conformance;协作不划算 ~25% → 任务分级/预算/度量。对策全部前置进 v1 范围。

---

## 15. 验证计划与发布门禁

### P0-0 兼容基线(先冻结,**每个迁移阶段合并前重跑**)

`ask_codex`/`reply`/`get_messages`、abg-tmux、named-channel create/list/kill、Claude 重连、Codex `--remote` attach。任何兼容 shim 的删除必须另立门禁。

### Phase 0A:纯平台可行性探测(不依赖新 broker;任一失败即改设计)

1. Claude Code Desktop:`SessionStart→watchPaths→FileChanged→asyncRewake` 空闲唤醒(新建/resume/clear/compact 注册与 generation;连续信号 coalescing;sleep/强退恢复)。**(v0.11 扩展,平台切片)**:增 OS 睡眠期间任意平台进程(stub/现有 v2 daemon)的定时器/时钟行为、醒后文件变更事件送达(并入既有 sleep/强退恢复与 coalescing 场景)。**降级决策卡(v0.11/2.3;随探测包冻结,FAIL 按卡走、不重开设计)**:Desktop asyncRewake 实证 FAIL 时三分支——(a) CLI-pinned 降级;(b) OS 通知+人工领取为方向 2 默认;(c) 明示计费 sidecar(Q4 opt-in UX)。
2. Codex 插件:安装→enable→新 task 出现 MCP 工具;hook 信任 UX;升级(hash 变化)后行为;marketplace refresh→cache 语义。
3. Codex MCP shim 进程拓扑与 thread 身份获取;失败 → 显式 `attach(pairingCode)`——**仅当另一可信宿主通道已注册该 session handle 时可配对**,否则该 surface 的 attached adapter 直接判 unsupported。
4. `codex mcp-server` 原始行为探测(**recording stub 记录事件流,不接真实 policy**):elicitation 事件形状、cancel、crash 后 Session-not-found、认证/额度来源(禁静默 API-key)。真实 broker fail-closed 归 §15 G-2/CodexWorker conformance gate(非 Phase 1 门禁)。**(v0.11 扩展)**:增 `sandboxAttestationDigest` 可取证性评估(attest 内容与获取路径,对称 F14 memory 侧实证;结论供 §18-Q11(B3)设计对审,**不自动启用任何能力**)。
5. worker 线程 Desktop 列表可见性;`codex://threads/<id>` 导航;drain 后 resume 行为;双客户端并发同 thread。
6. Codex 侧 Stop/UserPromptSubmit `systemMessage` 桌面视觉位置/持久性;`followUpQueueMode="queue"` 下 hook 时机。
7. `claude -p --resume <打开中的桌面 session>` 是否被拒(隔离环境探测,不碰真实会话)。
8. **UDS proxy 先行探针**(0B 前置):现 proxy 为 TCP WebSocket(src/codex-adapter.ts:472-505),`--remote unix://` 的 handshake/reconnect/stale-socket/rollback 全链路探针通过后,0B 迁移才可执行——CLI parser 接受 `unix://PATH` ≠ 链路可用。
9. **HostTurnBoundary 探测(v0.6 D-5;per-turn root 前置)**:宿主是否暴露可信 turn 边界(turnId 证明 / UserPromptSubmit epoch);现 `turn_id` 恒 null(control-protocol.ts:46、claude-adapter.ts:512),per-turn root 在此 gate 通过前不启用,退化为保守 session-scoped root(§6.6)。
10. **(v0.10/A-9 新增)context-basis 探测(P0A-CB;contextMode=current 前置)**:§0-A.8 三问——①current 的 context basis 算**什么字节**(broker 禁读 transcript);②**谁算** contextDigest(broker/adapter/宿主);③caller **如何取得** expectedBasis。三问任一无解 → current 语义保持 v1 UNSUPPORTED。探测登记/evidence schema/pass 谓词=协议规格 §14.1-§14.3(P0A-CB 行);PASS 仅是开放合取的一项,不自动启用(另需 §6.2 A-6 修订+feature `context_current_v1`+用户 DS-3 裁决)。
11. **(v0.11 新增候选,平台切片)P0A-1b**:caller 侧 signal-file 变更经 **stub writer** 能否唤醒 idle caller(仿 P0A-4 recording stub 先例),含重复唤醒观察。范围=Claude caller 链(Codex 侧无 FileChanged/asyncRewake 等价物,F5;其唤醒载体属 §18-Q10 开放面);结论供 §18-Q10(B2)设计对审,不自动启用任何能力。
12. **P0A-2b:hook trust/loader 状态可取证性**——保持纯平台探测:逐 host/profile/version 记录 exact trusted digest、per-session load boundary 是否可由宿主所有的证据证明、证据 producer/freshness/拒绝面;PASS/FAIL/UNMEASURABLE 只供 B1-Q1(§16.1(三))选择预先封闭分支,不自动启用 cutover;evidence schema=spec §14。

**(v0.11)移出 Phase 0A**:broker deadline/lease 睡眠反应、挂起保留/通知钟(§6.7)、janitor 宽限重排——依赖新 broker 构件,违反本节「不依赖新 broker」定义 → 改登记为 Phase 1B Task Core 验证项/adapter conformance gate 用例。

### Phase 1 门禁(Identity Kernel + Task Core 落地后执行)

10. 审批 principal 绑定改造(approve.sh/hook 记录格式)——反向 RPC 上线 blocker;审批 `keyId→principal` enrollment 随 Identity Kernel(v0.6 D-2)。
11. SQLite 故障注入矩阵:并发冷启动选主、迁移各阶段 SIGKILL、SQLITE_BUSY/FULL、长读事务 WAL、双 cwd 启动、restore 后 integrity+语义查询。
12. Identity Kernel 对抗验收:adapter 冒名、origin 注入、unassigned/歧义配对拒绝、错 workspace、stale generation、capability 降级握手。

> 注:`codex mcp-server` × 真实 broker policy(elicitation→fail-closed、审批转 waiting_input(reason=approval))**属 CodexWorker 的 adapter conformance gate**(见下),不在 Phase 1 门禁——Phase 1B 只做 legacy ask_codex 映射,不含 CodexWorker adapter。

### 各 Adapter Conformance Gate(替代单一 Gate;每个 adapter 独立过门)

**通用矩阵(所有 adapter 必过)**:
- crash-point:broker 在 intent/send/ack/complete/result 各边界 SIGKILL 重启 → reconciling 语义正确、无重复副作用、`outcome=unknown` 不自动重试;
- stale lease/fence:过期 lease 的 completion 被拒;
- idempotency replay + 同 key 异 digest conflict;
- **审批拒绝矩阵**:payload 冒充"用户已批准/APPLY"、旧 token、跨 task/session/generation replay、opHash 替换、nonce/expiry 过期、**denied 旧 task 不可 resume** + D-3 攻击面:symlink/hardlink/rename/temp-file 归一化绕过、间接 shell 写、批准↔effect TOCTOU、self-approve、subagent permit 转移、bypass-marker 存在时仍拒、policy-control 恒拒;
- suspension receipt 授权(§6.3 `nextActions[].token` 错绑拒绝)与 caller-loss(onCallerLoss 两分支);
- 同步非 happy path:caller timeout、await_result、waiting_callback unwind、would_deadlock 拒绝、cancel/complete race。

**golden smoke(各 gate 的子集)**:
- G-1(wake gate):clean-profile 首个 `ask_claude` 无 pin 时先验 `no_pinned_target`+remediation(D-6,不建 Task);创建/pin dedicated Claude session 后:Codex Desktop 新 task → `ask_claude` → Claude Desktop 唤醒/claim/complete → 同一存活工具调用收到结果——含 **clean-profile 全链集成**:安装→信任→新 session/resume/compact→升级后重信任。
- G-5(protectedEffectWrite gate,放行腿总闸;**本行为完整组件集单一 SSOT**):Approval Agent + EffectPermit + EffectMediator + **allow-capable PEP/classifier/authorizer(re-plan/re-hash 路径)** + **对应 adapter** + 执行前 fence/deadline 赢家 + **policy_control TCB inventory 完整性验收** 的联合 conformance;上述组件全部纳入**同一 hard-disable 开关闭包**(Phase 1B 只交付 deny-only PEP stub,allow-capable 组件不得先于 G-5 接入),全过前受保护写放行腿 hard-disabled(单开关原子启用);protectedEffectWrite 有独立 canary/rollback cohort。§10.1/§16 只引用本组件集,不复述。用例=两腿决策表逐支(G-4)+ fence 总出口五分类 + protectedStateRevision 推进→旧 permit stale + policy-control 恒拒。B1 增外部 enable 前置 `cutoverPhase=stood_down`(§16.1(九))。
- G-2(CodexWorker gate):**由 Claude Code Desktop 的 MCP 调用发起** → Codex worker → terminal result 回到原 Desktop invocation(含 cancel 与 crash 分支;CLI 通过不算过门)。**CodexWorker 专项**:`codex mcp-server` × 真实 broker policy(elicitation→fail-closed、审批转 waiting_input(reason=approval)、broker 永不代批)。
- G-3:2 Claude + 2 Codex 并发,无串线、无 ABA。
- G-4(对抗,引 §6.1 决策表逐条):自报/伪造 attestation→无 permit(rule 4);真人批 exact opHash→仅该次消费放行 origin 仍 agent_rpc(rule 5);真人拒/expiry→EffectIntent denied executor 活则 running(rule 6);缺 PEP/conformance→terminal denied+nextAction(rule 2);policy-control→open_admin_settings 恒拒换 user-origin 亦拒(rule 1);executor 丢失→reconciling(rule 3);deadline 命中按 §10.1 deadline 赢家;cancel-after-approve 按 §10.1 cancel 赢家(consume 先赢→cancelling+settle/reconcile,不立即撤销 executing permit)。放行腿 hard-disabled 期全落 rule 2/reconciling。
manual_claim_current、armed_pull、multi-room **各有独立 gate**,不搭 worker/wake 的车;其 pass/fail 用例随实现 PR 补齐,**用例落地前对应 gate 保持不可通过(fail-closed)**。

**v0.6 补齐 gate**:D-5(accept/dispatch/settle crash、ping-pong、fan-out escrow、ambient key scrub、API billing enable、root 聚合防重铸/防退款 churn);D-6(offline/ambiguous/revoke/activation crash/cross-billing coalescing);MCP Extensions downgrade;Phase 1B deny-only stub;unknownReason 双路径;stuck-BUSY/cancel-race/deadline-consume 赢家。

全部在隔离 OS profile + 合成仓库运行;固定 host 版本、预期状态序列、超时、证据 artifact、失败 fallback。

---

## 16. 迁移路线(strangler;每阶段过 P0-0 基线)

- **Phase 0A**:平台探测(§15)。
- **Phase 0B(发布前置修正)**:legacy CLI wrapper 移除已失效的 `--enable tui_app_server`;UDS 探针(§15-8)通过后同机迁 `--remote unix://<socket>`(暂留 ws://127.0.0.1 标 experimental 兼容路径,非稳定终局)。
- **Phase 1A(Identity Kernel,先于 Task Core)**:四层身份 + 认证 adapter + fencing + capability/版本握手 + **最小 one-pair/workspace binding ACL**——origin/token/审批全部依赖这些实体,必须先行。
- **Phase 1B(Task Core)**:SQLite + Task/lease/token/审批 principal 改造;现 `ask_codex` 映射进 Task 协议——外部返回形状兼容,内部记 `legacyCompletionSignal=turn_completed` evidence。**legacy 完成语义(D-1 已定)**:turn_completed 仅是 evidence;内部一律 terminal + outcome=unknown(`unknownReason=legacy_evidence_only_completion`,不经 reconciling)+ `verification=not_applicable`(**不进 pending、更不进 accepted**——不重蹈 F15);仅明确匹配当前 dispatch 的协议错误可内部 failed;外部 shim 保持旧 shape(`outcome:"turn_completed"`)但不反解为内部 succeeded;evidence 记 `{legacyCompletionSignal, hostTurnId, capturedMessagesDigest, drainComplete}`;仅可更新匹配当前非终态 dispatch 的任务,已 cancelled/expired/terminal 只记 late_result;`deliveryOwner` CAS 上线。**交付边界**:仅两腿文本+durable approval 记录结构+approve.sh principal 改造+deny-only PEP stub(Approval Agent/EffectPermit/EffectMediator 不在 1B,后置到 protectedEffectWrite composite gate G-5(§15/§16)全过后原子启用)。**注**:本阶段只做 legacy ask_codex 映射,不含 CodexWorker adapter(它在 Phase 3 hard-disable 构建);故 §15 的"mcp-server × 真实 broker policy"实际归属 §15 G-2/CodexWorker conformance gate,不属 Phase 1B。
- **Phase 2**:multi-attach 扩容(拆 singleton attach 槽与全局 activeWaiter)。
- **Phase 3**:双侧插件 **shadow 模式**出货(注册、nudge、Console 可见,**禁止执行**);各 adapter 以 **hard-disable 开关**同时构建(可测不可用);Console 工作流 C 启动。
- **各 adapter:conformance gate → canary enable**(分批:CodexWorker → Claude 唤醒链 → manual_claim_current → armed_pull;独立灰度与回滚开关)。
- **protectedEffectWrite 放行腿(§10.1 两腿之腿 1)= 独立 composite gate G-5**(完整组件集以 §15 G-5 为单一 SSOT,不在此复述;一并 hard-disabled 构建,过 G-5 conformance 后**单开关原子启用**;与上述 adapter canary enable 解耦)。RootAdmission/TaskLineage/最低 structural budget(§6.6)随 Phase 1B Task Core 落地;API billing 仍在其 conformance 全过前 hard-disabled。enable 另有 B1 外部前置 `cutoverPhase=stood_down`(§16.1(九))。
- **local(非 git marketplace)源升级交付流程(v0.11/1.2c;Phase 3 插件出货前置)**:初始分发仍经 personal/team marketplace(DR-7 分发载体句不动;被 P0A-2 否定的仅「local 源的 marketplace upgrade/refresh」子路径——F6 已升格实证)。**已实证升级序列**:同名 `codex plugin add` **原子替换**(不先 remove)→ 新 task 生效 → **re-trust**(hooks/list 同 key `pre=modified` → accept → trusted)。作用域=evidence 绑定面:hostMatrix{codex-cli 0.145.0、macOS 26.5(observed)}+ 默认 profile;**OS 无关性为推断非实证**;宿主/profile 升级后经 evidence 失效闭环触发重验。**回滚机制为待探测占位**——v0.11 只写「须有回滚路径」义务,具体机制随探测项裁定,**不写死 `remove→add`**(该序列未实证:re-add 保同 key 得 modified 态有实证,remove 后重装无实证;采纳前须入探测登记)。git-backed marketplace 源升级行为未探测,采用须另立探测项。变更授权=P0A-2 FAIL 回改义务。
- **多项目 interim 隔离(v0.11/2.7;Phase 5 前窗口期)**:①v1 点亮 `workspaceFingerprint` 作为预算/quota/台账的**软隔离维度**;②channel→room 迁移用户剧本(现役 4 个 named channel);③窗口期显式声明「回路闸/预算仅 per-daemon 闭合」;④调度最小保证=**per-room FIFO + 老化提升**(改写 spec「scheduler 级公平细则随 Console/调度交付」的如实声明句,行为变更已过提案盲审)。
- **Phase 5**:multi-room/多 pair UX/配对策略;named channel"每通道一套 daemon"收敛为单 broker 多 room(窗口期并存)。
- **Legacy 退役**:旧审批链按 §16.1 cutover 状态机退场(SEC-7 gate);Console+度量达标后,legacy 路径降 shim,另立门禁后移除。

### 16.1 旧链退场 cutover 状态机与验收(§18-Q9 冻结骨架;B1)

**(一)状态与 policy 实体** [B1-Q5][G-2][G-3]

- `LegacyCutoverStateV1={installationId, cutoverEpoch, phase: dual_gate|v3_verified|legacy_note_only|stood_down, fenceRevision, requiredHookSetDigest, acceptedHookSetDigest, targetHookSetDigest, requiredAdapterGateSetDigest, transitionRevision, emergencyHold, updatedAtBroker}`。每次边由 broker 单 writer CAS。[B1-Q5](expectedTransitionRevision 为共识 receipt 字段;first-winner/陈旧赢家 typed conflict 系 CAS+expected revision 的引申语义,非 B1 共识逐字——spec 期细化,窄审确认)
- `emergencyHold=null|{reason: "normal_rollback"|"emergency_revocation", adminActionReceiptRef, heldAtBroker, revokeTrustRevisionRef?}`;tagged CHECK:normal_rollback ⇒ revokeTrustRevisionRef 恒 null;emergency_revocation ⇒ 必指向触发 revoke 原子事务的 exact `HookTrustRevisionV1`;receipt 与 transition receipt 同 reason;机制同一,reason 只改审计/必需引用。[G-2]
- `CutoverEpochPolicyV1`=accepted/target/requiredHookSetDigest/requiredAdapterGateSetDigest 与 policy revision 的唯一 SSOT(演进只 append successor revision);`LegacyCutoverStateV1` 增 `epochPolicyRef`,其四 digest 字段仅判定时点只读 snapshot/cache、禁独立 setter;`CutoverTransitionReceiptV1` 持 `epochPolicyRef`+`evaluatedPolicySnapshotDigest`;broker 在 transition CAS 内重算并要求 state snapshot=receipt snapshot=exact referenced policy row;任一不等或悬空 ref=invariant breach、hold+fail-closed。[G-3] policy 行字段=B1-Q4a 固定 `{cutoverEpoch,acceptedHookSetDigest,targetHookSetDigest,hookConfigDigest,fenceRevision}` 与 G-3 SSOT 四 digest 之并集(增 `requiredHookSetDigest`/`requiredAdapterGateSetDigest`/`policyRevision`;并集非缩写,两源 qid 并标)。[B1-Q4a][G-3]

**(二)hook trust 与 rollout** [B1-Q4a]

- `HookTrustRevisionV1` 至少含 `{trustRevision,digest,status:staged|active|revoked,activatedAt?,revokedAt?,reason,adminReceiptRef}`;`staged` 永不满足 coverage,`revoked` 通过 join 立即使所有旧 evidence stale(append-only 分量=同题 statement,codex-r3:137)。
- overlap 期 `accepted` 可含 old+new,但新注册只准 target;存量 old session 要么取得 target coverage,要么 drain。推进 epoch/phase 的事务必须证明 inventory 全体满足 `observedHookSetDigest ∈ target`,不能只满足 `accepted`。rollout 失败不覆写旧 revision/ack;创建后继 policy revision,旧 active digest 在显式 revoke 前继续有效。每 session 的 evidence 记录 observed actual digest,不继承 cohort/canary 结论;doctor 只呈现偏斜,不充当 runtime fence。

**(三)coverage 绑定与 loadProof** [B1-Q1][D-1][P0A-2b]

- 冻结 `HookCoverageBindingV1` 与下列 tagged load proof;所有字段进入 coverage evidence 的 canonical digest,任何 ref 跨 installation/session generation、任何 trust revision/digest/epoch 不符都使 coverage=false。最小字段:[B1-Q1]
  - `installationId`:拒绝跨安装 replay;由 broker authctx/持久行派生,caller 不可填。
  - `cutoverEpoch`:exact equality 绑定当前 cutover 判定;旧 epoch evidence 不复用。
  - `runtimeSessionRecordId + runtimeSessionGeneration`:分别绑定 durable session 行与 resume/clear/compact 后的当前代;不能只绑 endpoint generation。
  - `endpointId + endpointGeneration`:绑定已认证宿主 endpoint 及其当前代,挡 endpoint revoke/re-enroll 后重放。
  - `sessionIdentityEvidenceRef`:必须指向 broker-owned 且 `status=verified` 的当前 session identity evidence;它只证 session handle,不单独证 hook coverage。
  - `requiredHookSetDigest`:cutover epoch 固定的目标 PEP hook 集合 digest;不是可变“当前配置”查询。
  - `observedHookSetDigest + hookConfigDigest`:分别绑定宿主实际信任/加载的 executable 集与使其在正确事件上生效的 hook 配置;验证要求与 epoch policy 精确相等。
  - `hostTrustRevision`:宿主 trust store 的单调 revision/receipt;revision 变化使旧 evidence stale,不能靠 observed digest 恰好相同继续沿用。
  - `loadProof`:封闭 tagged union:`direct{hostLoaderEvidenceRef, loadBoundaryId}`,或 `new_session_after_trust{sessionStartEvidenceRef, trustedRevisionRef}`。第二支仅在 P0A-2b 已证明“该 host/profile 的新 session 在该 trust revision 后必加载 exact hook set”时合法;不得用自报 bool 代替 refs。(本句=codex-r3:118 共识原文的支标签简记;**exact 字节形唯一 SSOT=spec §16.3 冻结的 `{kind:…}` tagged object**——两纪律冲突消歧:共识逐字保留于此,canonical bytes 以 §16.3 为准;窄审 r3 修复④之 B 路径,architecture 侧不改共识原文)
  - `challengeNonce + receivedAtBroker + validatedAtBroker + freshUntilBroker(+observedAtHost 仅审计)`:nonce 由 broker 一次性铸造并绑同 session/epoch(codex-r3:119 前半逐字);freshness 判定字段族=D-1 收敛形,**取代** r3:119 的 `observedAt/freshUntil` 判定字段——旧两字段不再是 binding 字段、不落判定列;`observedAtHost` 仅审计、不入比较,hash-input 中可空字段显式 null。[B1-Q1][D-1 取代][窄审 r1 修复 D2-1]
- **freshness 恒 broker 时钟**:broker 在验证事务记录 `receivedAtBroker`/`validatedAtBroker`,按 epoch-pinned TTL 得 `freshUntilBroker`;每次 coverage 判断以当前 broker transaction time 比较。宿主 `observedAtHost` 仅为审计字段,不参与 freshness 算术(未认证宿主 wall clock 不入判定;P0A-2b 若证明并版本化经认证单调时钟通道方可重开)。[D-1]
- `coverageVerified(session, epoch)` 还必须在一个持久判定中 join:当前 trust entry 未 revoked、当前 fence revision 等于 evidence 所见 revision、所有 refs 同 installation 且未撤销。hook 自算 digest、`pep.check` 字段或独立 challenge-response 仍只作诊断。[B1-Q1]
- **P0A-2b 条件式参数(非 TBD、非外部 OPEN)**:spec §14 在既有 ProbeEvidence envelope 下派生 `HookLoadProofProfileV1={hostMatrixRef, profileVersion, probeContractDigest, allowedLoadProofKinds[], probeEvidenceDigest}`,其中 `allowedLoadProofKinds` 是按字典序的封闭子集 `direct|new_session_after_trust`,仅对应 branch PASS 才入集,FAIL/UNMEASURABLE 均不入集。`loadProof` tagged union 字节形状恒定;runtime 仅在 exact host/profile/current evidence 下允许 tag∈allowed set,空集或 evidence stale 即 `coverageVerified=false`、相关 cutover 边 fail-closed;host/profile/probe contract 变化只能 append successor profile revision 并重探,不改 schema、authority 或失败方向;PASS 也不自动 enable cutover。两支均不可证的 host,其 cutover 恒停在 legacy_note_only 之前。[FREEZE-SLICE/B1/P0A-2b=codex-r17:40+claude-r18:20][B1-Q1 open_objection 收敛]

**(四)fence、inventory 与 drain** [B1-Q3][D-2]

- `CutoverCoverageSnapshotV1={installationId, cutoverEpoch, fenceRevision, requiredHookSetDigest, inventoryRevision, memberSetDigest, createdAt}`。成员集包含所有 lifecycle≠OFFLINE 的 runtime session 当前代,以及仍在 overlap-risk set 的旧代;disconnected 不等于已 drain。
- 建 snapshot 的同一 writer 事务先把 `cutoverFence{epoch,revision,requiredHookSetDigest,mode=armed}` 持久化,再枚举 member set;事务提交后才开始逐 session drain,避免 snapshot 后新注册穿越。
- `drainComplete(rs_,epoch)` 仅当:①该 session/旧代已不可再 claim/dispatch/接受 protected effect;②其 active Task/ExecutionLease/claim/pending callback 等 session-scoped obligation 清零;③已发 EffectPermit/EffectAttempt 达 `not_protected/no-effect` 或真实 settled;④没有 `unknown/reconciling`。进程退出、超时、发 TERM/KILL 均不单独满足③④。
- timeout 的合法出口只有:继续 blocked、admin force-stop 后按 B1-Q2b 对账、或 rollback cutover;禁止 timeout→drained。
- **pre-fence obligation 持久载体(窄审 r1 修复 D2-3)**:cutover arm 事务按 `{cutoverEpoch,fenceRevision}` 冻结所有 pre-fence/in-flight source-event obligation(codex-r5:71 逐字)——落**逐条持久明细行**(exact `(authenticatedPrincipalId, originRuntimeSessionRecordId, sourceChannel, sourceEventId)`),与 fence/snapshot 同一 writer 事务枚举写入;每条 obligation 的终局=恰一 closure/fact 映射(`closed_no_effect`|`reconciled_settled`|`aborted_no_effect`,或经(六)三分支处置);obligation 集全量终局进入 `drainClosureDigest` 与 `v3_verified→legacy_note_only` 判定——INSERT…SELECT 的输入自此封闭,屏障不漏既有 source event。枚举输入封闭映射(窄审 r2 修复①,r3 修正 carrier 基数):(a) `approval_records`(pep 通道)行四元组逐列同名直取(命中与未命中均有行,pep 事件全可枚举),取尚无 closure/终局者;(b) live EffectIntent/EffectPermit/EffectAttempt——**per-event carrier=`effect_intents` 增持久四元组列**(认证 pep/intent 创建事务 exact-copy;EffectContext 在 claim/dispatch 期建立、一 context 挂多 intent,非 per-event carrier 不承载;Permit/Attempt 经 intentRef join;§12.3/§12.10/§12.2 实际 additive delta+四元组入 effectSemanticDigest replay 判同=spec 差分 H(窄审 r4 修复①②);列级=spec §17.1+差分 H)。armed 期增量 writer **两分支**:not_protected→obligation insert+closure+`resolvedByRef` 同事务 resolve;deny/protected(或已有 live effect)→仅 obligation insert 保持 unresolved(不为 protected 伪造 closure);resolvedByRef=NULL→ref 单向 CAS(same-ref replay no-op;different-ref=invariant conflict+审计)。[B1-Q2a][E-1]
- **cutoverEligibility 解除 owner(窄审 r1 修复 D2-6;r2 收口)**:单 writer 重算 reducer,CAS 比较 `{cutoverEpoch, fenceRevision}` 现值(不新增第二真值位)——**两支分立(窄审 r4 修复③:superseded 支不 adoption)**:(a) coverage 成立支——目标 session 对 exact current fence 的 `coverageVerified` 变真时**清旗=SET NULL(唯一编码)**,同事务把本次判定实际消费的所选 coverage evidence 回填 **active inventoryRevision**(=每 (installationId, cutoverEpoch, fenceRevision) 的最大 inventoryRevision,append-only 唯一选择规则)的 snapshot member `coverageEvidenceRef`(NULL→ref write-once CAS,binding 含 {cutoverEpoch, fenceRevision, inventoryRevision} 三元;adoption owner 之一,另一=**仅 C2** transition CAS——C1/C3/C4/C5 的 guard 不消费 per-member coverage,不回填;审计链冻结时点=transition receipt commit——窄审 r2 修复③+r3 收窄),并重评受影响 queued tasks;(b) fence superseded 支——exact current fence 已 superseded(rollback/新 epoch 收口)时仅清旗 SET NULL+重评 queued tasks,**不写 `coverageEvidenceRef`**(本支不消费 coverageVerified、可无 selected evidence,不得向 write-once ref 回填);stale fence 事件不得清新 epoch 的旗。[B1-Q3][D-2]
- 接线点:`SessionStart` 新注册、resume/clear/compact 的 generation roll、connection rebind、ATTACHED→READY、Task claim/dispatch 前 eligibility 均读取同一 fence revision 并调用同一 `coverageVerified`。无 coverage 的新注册停在 ATTACHED;既有 READY session 滚代后保持 canonical lifecycle,但置正交 `cutoverEligibility=blocked_drain_required`,不得借非法 READY→DRAINING 边绕过现有 lifecycle。
- **不对称理由(收敛文本显式)**:新注册尚无旧代 in-flight obligation,直接挡 `ATTACHED→READY` 可 fail-closed 且不制造孤儿义务;存量 session 可能持 lease/claim/callback/effect obligation,滚代不改变 canonical lifecycle,强造回边会落入非法或死端状态。两者必须调用同一 `coverageVerified(session,epoch,fenceRevision)`,只是该谓词在 pre-READY edge 与既有 generation 上的两个投影。[D-2]

**(五)effect closure:`not_protected` 结清** [B1-Q2a][E-1]

- `recorded_not_protected` 是 exact source event 的已知 no-effect closure,不是 Task terminal outcome。冻结 `CutoverEffectClosureV1={installationId,cutoverEpoch,fenceRevision,runtimeSessionRecordId,runtimeSessionGeneration,sourceChannel,sourceEventId,approvalRecordRef,decision:"closed_no_effect",protectedManifestDigest,policyEpoch,decidedAtBroker}`。
- 充要条件:`approvalRecordRef` 指向已 durable commit 的 `recorded_not_protected`;其 `(authenticatedPrincipalId, originRuntimeSessionRecordId, sourceChannel, sourceEventId)` 与 snapshot obligation 精确相等;同 event 不存在 `EffectAttempt`/`EffectPermit`;manifest/policy 字段描述作出该次分类时的快照。caller 自报、hook 返回文本或传输成功均不结清。durable 行已 commit 且 exact correlation 唯一时,转移屏障立即结清对应 obligation,不等待 hook 响应、outbox ACK、Task 终态或时间窗。
- 原行以后因当前 manifest 改变而 escalation 为 deny,不改写原 event 的历史 no-effect 事实;同一工具动作若以新 sourceEventId 重提,必须按新 policy 重新分类,不能复用旧 closure。缺 durable row、correlation 不唯一、字段冲突、跨 installation/session generation,或观察到 permit/attempt 时,不判 `not_protected`;转(六)对账,timeout 不产生 closure。
- **closure materialization 由 cutover 单 writer 所有,无缝两段**:arm 事务先持久 fence/snapshot,再以 snapshot obligation join 既存 `recorded_not_protected` 行执行 `INSERT … SELECT` 回填同 epoch 的 closure,同一事务提交后 armed 才可见;此后 armed 期间 `pep.check` 在写 approval row 的同一事务 piggyback 写增量 closure。`UNIQUE(cutoverEpoch,fenceRevision,runtimeSessionRecordId,runtimeSessionGeneration,sourceChannel,sourceEventId)` 使两路重放幂等;janitor 只修复检测到的 invariant breach,不作为正常 owner。[E-1]

**(六)effect closure:`unknown` 出口三分支** [B1-Q2b][E-2]

- 分离“effect 事实”与“本次 cutover 尝试”两个状态面。unknown/reconciling obligation 只有三种 operator 路径:以决定性证据对账、带 stop/no-effect 证明的显式 abort、或回滚本次 cutover;前两支只有真正得到 settled/not-applied 事实才关闭 effect,第三支只能结束 cutover attempt,绝不把底层 unknown 改写成 settled。
  1. **对账**:operator 动作 `reconcile_effect`。决定性 postimage/provider receipt/mediator evidence 产生 `ReconciliationClosureReceiptV1={obligationRef,effectDisposition:"applied_settled"|"not_applied",evidenceRefs[],closedAtBroker}`,并把 effect fact 置 `reconciled_settled` 或 `closed_no_effect`;只有这两值满足转移屏障。证据仍不充分则保持 `reconciling`,不得重复执行非幂等 effect。
  2. **显式 abort**:operator 动作 `abort_effect` 先撤销尚未消费的 authority,再取得 exact execution 已停止且未开始/已证明 not-applied 的 evidence,写 `AbortClosureReceiptV1`,终局为 `aborted_no_effect`。仅发送 cancel/KILL、收到 transport ACK 或等到 timeout 都返回 `abort_pending_reconciliation`,不终局、不放屏障。
  3. **cutover rollback**:admin 动作 `rollback_cutover` 写 `CutoverAttemptReceiptV1{outcome:"rolled_back_unresolved_effect",cutoverEpoch,unresolvedObligationRefs[],rollbackPolicyRef,closedAtBroker}`,递增 cutover epoch/fence revision,并恢复该阶段允许的安全 gate/hold。底层 effect fact 保持 `reconciling`(最终无法对账时可按 canonical Task 规则成为 `unknown`);后续 cutover 必须用新 epoch 重新纳入该 obligation,不能把 rollback receipt 当 effect closure。`stood_down` 无 legacy rollback 边。
- 不新增 Task outcome:Task 仍使用现有 `quota_exhausted/unknown/...` 与 T19/T20;`rolled_back_unresolved_effect` 只是 cutover-attempt outcome。timeout 只触发 `operator_action_required`,永不映射为 settled/drained。
- **授权/事实双层**:三个 operator 动作先消费 `AdminOperatorActionReceiptV1{kind:reconcile_effect|abort_effect|rollback_cutover,...}`(完整适用 AdminReceiptDisciplineV1:有限 expiry、可撤销、依赖漂移在消费前失效、admin/control plane only);`ReconciliationClosureReceiptV1`/`AbortClosureReceiptV1`/`CutoverAttemptReceiptV1` 是动作执行后的不可变事实 receipt,均持 `adminActionReceiptRef`,但事实本身不因授权 receipt 事后 expiry/revoke/policy drift 而失效(expiry/revocation 只限制未来 authority 消费,不能使历史事实可逆)。[E-2]

**(七)transition receipt 与前进边** [B1-Q5][B1-Q6/F-1]

- `CutoverTransitionReceiptV1={installationId, cutoverEpoch, fromPhase, toPhase, expectedTransitionRevision, fenceRevision, requiredHookSetDigest, observedInventoryDigest, drainClosureDigest, requiredAdapterGateSetDigest, adapterGateReceiptRefs[], legacyConfigDigest, adminActionReceiptRef?, decidedAtBroker}`(保留 ack 三元组 {cutoverEpoch, v3 hook digest set, legacy config digest},仅增 F-1 gate 证据)。[B1-Q5]
- 三前进边:`dual_gate→v3_verified` 须两 F-1 member receipts exact+deny-path/canary 合格;`v3_verified→legacy_note_only` 须全 inventory target coverage+effect/drain closure;`legacy_note_only→stood_down` 须观察窗/recorded-note 义务。G-5(gate)只以 `cutoverPhase=stood_down` 为外部 enable 前置,不由 transition 自行开启。[B1-Q5]
- canary cohort 不代替全量覆盖;`v3_verified→legacy_note_only` 仍只由 B1 全 inventory target coverage + effect/drain barrier 决定。Phase 3 shadow 可与 `dual_gate` 并存;shadow 明确禁止执行,不能满足 `dual_gate→v3_verified` 边。[B1-Q6]
- **receipt 完整物理形(G-2/G-3 载体;窄审 r1 修复 D2-2)**:receipt 在基础 14 字段(清单 r9:21 canonical 历史计数,不删不改)之上增 `rollbackReason?: "normal_rollback"|"emergency_revocation"`——tagged CHECK:两回退边(v3_verified|legacy_note_only→dual_gate)非空且=`emergencyHold.reason`=所消费 `AdminOperatorActionReceiptV1.reason`(G-2「receipt 与 transition receipt 同 reason」的字段载体);三前进边恒 null——及 G-3 的 `epochPolicyRef`+`evaluatedPolicySnapshotDigest`(见(一));完整物理 schema=14+3 字段,receipt digest 域见 spec §16.3。[G-2][G-3]

**(八)rollback、emergency revocation 与 admin receipt 纪律** [B1-Q5][B1-Q4b][D-3]

- rollback 分面:`v3_verified|legacy_note_only→dual_gate` 先持久 hold、恢复 exact legacy config/issuer 完整性并验证成功后才 CAS;失败保持 hold+v3 deny;`stood_down` 无 legacy 回边。四类 admin action(EmergencyRollback|reconcile_effect|abort_effect|rollback_cutover)先消费有限 expiry、可撤销、依赖漂移即失效的 `AdminOperatorActionReceiptV1`;事实 receipt 只引用授权 receipt,不继承其事后 expiry/revoke(E-2 双层)。[B1-Q5]
- **emergency revocation**:revoke 事务原子完成 `{digest→revoked, trustRevision++, cutoverEpoch/fenceRevision++, emergencyHold=armed}`,关闭新 admission/dispatch;coverage 验证每次 join trust revision,因此无需等异步逐行打 stale 标记。在 `dual_gate`/`v3_verified` 发现 revoke:收敛为 admission closed + legacy gate 保持/恢复有效 + v3 deny-only,drain 引用坏 digest 的 sessions;验证完成后状态才可记 `dual_gate`。在 `legacy_note_only`:接受 `EmergencyRollbackReceiptV1={adminPrincipal,cutoverEpoch,revokedDigest,expectedLegacyConfigDigest,reason,issuedAt}` 后,先在 hold 中恢复旧链,再以宿主/TCB evidence 验 exact legacy config、issuer/key、hook 加载与 protected inventory;全部成立后 CAS `legacy_note_only→dual_gate` 并重开 admission。任一失败保持原 durable phase + `emergencyHold`,对外姿态为 deny-only/停止接纳,绝不谎标 dual_gate。在 `stood_down`:无任何回 legacy 的边;坏 digest 只允许 v3 deny-only、关闭 admission、分发新 trust revision、drain 后新建 session。若 G-5 allow 腿已启用,先以其单一 hard-disable 收敛 deny-only。crash 于“恢复旧链”和“状态 CAS”之间时,持久 `emergencyHold` 使重启后仍关闭 admission;只有验证 receipt 与 CAS 均完成才解除 hold。[B1-Q4b]
- **epoch-changing writer 与 G-3 合成(窄审 r1 修复 D2-5)**:一切递增 `cutoverEpoch/fenceRevision` 的 writer(emergency revoke 原子四元组事务、(六)3 的 `rollback_cutover`)必须在**同一 writer 事务**内 append successor `CutoverEpochPolicyV1` revision 行、更新 `LegacyCutoverStateV1.epochPolicyRef` 与四 digest snapshot、写新 fence 行并执行必要 obligation carry-forward;四元组为该事务不可删的共识子集;不得留下 state 指向旧 policy 行的中间态——G-3 漂移=invariant breach,非合法 hold 状态。[G-3][B1-Q4b][B1-Q2b]
- **AdminReceiptDisciplineV1(B1/B3 共用 envelope,六条)**:①由认证 admin principal 经 admin/control plane 铸造,Task/model RPC 不得代交;②绑定 installation、receipt kind、exact scope digest、policy/config/依赖 digest 与 revision;③含 reason、issuedAtBroker、有限 `expiresAtBroker`、revocation state/ref、nonce/revision;④append-only 审计并产 durable receipt digest;⑤scope 或任一依赖 revision/digest 漂移即失效,禁止宽化匹配;⑥验证失败恒 fail-closed。B1 的 `EmergencyRollbackReceiptV1` 另绑 cutoverEpoch/revokedDigest/expectedLegacyConfigDigest;payload tagged 分立,B3 后续只增自身 payload,B3 未收敛不反向阻塞 B1(D-3 的 B3 侧绑定(subject/assurance transition/required floor)与跨面清单一致性检查随 B3 rollup 承接,B1 不展开——如实登记)。[D-3][FREEZE-SLICE/B1]

**(九)adapter ordering 与 SEC-7 验收包** [B1-Q6/F-1][B1-Q7/G-4]

- `RetirementOrderingRegistrationV1`:`phase3AdapterRollout` 与 `legacyCutover` 为平行状态机(§16 Phase 3 梯=adapter 交付/能力发布,锚 731-733),禁止 phase-to-phase 镜像或“任一 adapter enabled⇒v3_verified”;两者只以单向 evidence join 接线,cutover phase 不反向改写 adapter gate,非 B1 adapter 的 canary 也不得推导 legacy 退场。[B1-Q6]
- `RequiredAdapterGateSetV1.members` 的 v1 exact 集合按字典序封闭为 `["claude_clean_profile_wake_gate_v1","claude_pep_deny_path_gate_v1"]`:前者须覆盖 G-1 的安装→信任→新 session/resume/compact→ask→唤醒/claim/complete→同一调用得结果,以及升级→重新信任→新 session→再成功;后者须覆盖 exact hook digest/load proof、认证 pep.check、完整验形且仅 not_protected 放行、其它结果 fail-closed、durable approval record/replay 与 deny-path conformance。`requiredAdapterGateSetDigest=AB-CANON-1("AgentBridge/RequiredAdapterGateSet/v1",{members:["claude_clean_profile_wake_gate_v1","claude_pep_deny_path_gate_v1"]})`;每个 member 恰有一个绑 `{cutoverEpoch,hookTrustRevision,gateProfileId,conformanceSuiteDigest,canaryCohortDigest}` 的 receipt ref。改变成员、语义或 gate profile 必须新 revision/domain input,不能静默扩集。两 gate 使用的 trust revision/target hook set 须与本节(二)(三)相同;G-1 的通用 clean-profile 证据不得被重复解释成 PEP deny 证据。[F-1]
- G-5 外部 enable 前置:顺序=相关 adapter canary 已证 → B1 全量 cutover/stand-down → G-5 allow 单开关可启;G-5 或 adapter 在 stood_down 后回归失败时,只能 hard-disable + admission closed/v3 deny-only,不复活 legacy issuer。[B1-Q6]
- **SEC-7 四组机器化验收(全过才 close)**:[B1-Q7]
  ①用户面:stood_down 后 legacy HMAC/approve.sh issuer 与旧交互入口无 authority、无第二 prompt/第二放行判定;历史 recorded_note 只读保留,G-5 未开时仍可仅有 v3 deny,不得为消除双闸而提前 allow。
  ②审计面:每 epoch 的 transitionRevision、hook/adapter/legacy config digest、fence、inventory、drain/effect closure 与四类 admin 授权/事实 receipt 链无缺口,unknown/reconciling 不被伪装为 drained。
  ③doctor:展示 phase/epoch/emergencyHold、accepted/target/observed coverage、两个 F-1 member 状态、stale/uncovered generations、drain obligations、reconciling、G-5 hard-disable 与明确 remediation;doctor 不是 fence。
  ④演练:覆盖 v3_verified 正常 rollback、legacy_note_only emergencyHold 后成功/失败/恢复事务 crash、stood_down 后无 legacy rollback 只 hard-disable,以及 B1-Q2b reconcile_effect、abort_effect(pending 与闭合两支)、rollback_cutover(新 epoch 重纳 unknown)三分支;每个负例须证明无 effect 被误放、无旧 session 越 fence。
  验收包另登记 `AgentBridge/RequiredAdapterGateSet/v1` domain、fixture/GV 与逐 member mutation/cross-domain 负例。**SEC-7 实际 close 只在 B1 dependency-closed 冻结稿经用户 APPLY 合入、§18-Q9 行更新、四组 gate 全过时执行(清单 r9:28 逐字);四组验收=该修订的 gate,对审 artifact 不构成 repo 写入授权,对审双方只交付验收包与 gate 判定。**[G-4]

**(十)错误折叠防范** [B1-Q5③]

- 四态=含 rollback 边的有向图非线性链;两 gate 证据不互代;AdminReceiptDiscipline envelope 共用但 B3 未收敛不反向阻塞 B1;doctor/自报/canary 不代替 transition receipt 全量谓词。

---

## 17. 治理

`origin=raysonmeng/agent-bridge`(上游),本机经 `myfork=dianxiang-sun/agent-bridge` 开发。**(v0.10 更新)fork 的 PR #4/#5/#6(stacked:bundle 同步+CI 门禁 / lifecycle / ops-hardening)已于 2026-07-16/17 全部 squash 合入 fork master**(squash commits:#4=118533c2 / #5=e207213e / #6=8d1e96ee;#4 的 code delta 含跨平台测试路径修复,合并链另完成 repo-level fork Actions 启用(仓库设置,非 commit 内容),#5 为 master 回并+bundle 重生成,#6 为 delta 逐字节保真重放——全程经 Codex r71-r74 exact-OID 审计,证据=arc ledger 会话 9 台账)【本机快照 `gh pr view --repo dianxiang-sun/agent-bridge` 2026-07-17;注意:多 remote 下不带 `--repo` 会解析到上游同号 PR,评审轮 5 曾因此误报"已合并"】。v3 量级的治理路线(上游 RFC vs fork 演进)见 §18-Q1——**已裁决:D 为当前动作、C 为方向**(2026-07-16 用户批)。

## 18. 开放问题

> **v0.6 起**:D-1..D-6 已全部定案(§0-B 决策记录;正文见 §6/§8-§10)。**后续协议规格**交付项见 §0-A(含新增 §0-A.9/.10)。以下 Q 为产品/治理级问题。

- Q1:上游 RFC vs 分叉(§17)。**✅已裁决(2026-07-16 用户批;v0.10 记录)**:采纳治理备忘录四态对比(A=上游单体 RFC / B=长期 fork / C=实现先行+分层上游化 / D=defer:只做共同前置)的推荐——**D 为当前动作、C 为方向性预设**:本阶段仅执行三件共同前置(①合 #4/#5/#6 ✅2026-07-17 完成;②APPLY architecture 修订 A-1..A-9=本 v0.10;③commit v3 工件 ✅0b369f6);**Q1 本体推迟至 Phase 0A 探测证据落地后按 C(拆小件按依赖序逐个上游)重估**——理由:四态中唯 D 的成本在所有未来分支下不沉没,C 是 A/B 的凸组合保留全部退路。备忘录原文=arc workspace `proposal/governance_q1_memo.md`。(历史进展 2026-07-14/15:三文档 commit 于本地分支 docs/v3-design;v0.6 定案落稿后经全量多维终审补修为 v0.7。)
- Q2:是否承诺 broker 崩溃/OS 重启后、无前台 client 时按 deadline 自动恢复(决定 service/socket/timer activation 是否发布前置,DR-6)。
- Q3:Windows 支持范围与时间点(UDS/信号/路径语义;两侧桌面均有 Windows 版)。
- Q4:Claude sidecar 的 opt-in UX 与预算参数默认值。
- Q5:Console 形态(本地 Web UI vs TUI vs 两者)。
- Q6:ToS 法务确认路径(§10.2)。
- Q7:**何时新增(而非切换为)MCP Tasks Extensions Track adapter**(DR-8)。门槛:①extension revision/schema 可 pin;(2026-07-31 注:机制就位——extension identifier 已正式、capabilities.extensions 协商字段已定义;但 ext-tasks schema 仍 draft-only、无 tagged revision,门槛①未满足)②至少一侧宿主能协商精确 extension;③§6 三正交状态/terminal replay/cancel-late/TTL/ACL/SuspensionReceipt 的 mapping gap 书面化;④缺能力/跨版本 downgrade fail-closed;⑤独立 adapter conformance 通过。未满足保持 disabled,§6 永久内部 SSOT;不做全局 big-bang switch。
- Q8(v0.11/2.13):**新 provider 接入最小修订集**——接入第三家 agent 需动的注册表清单:surface 枚举 / billingClass / Source Registry(§10.2)/ adapter gate 模板 / `RetryMatchContext.effectiveTargetClass` 封闭映射+selector targetClass 枚举(不扩则新 surface 的 retry class 静默钉死 forbidden)/ RouteKey `sourceClass` 封闭归约(不扩则回路闸输入之一构造未定义)。后两项在预算/路由面,**不触 §6 状态机**(验证目标:不动 §6 即可接入)。另:**broker 交付单元归属列为决策候选 DR-9**(v0.11/2.11(i))——插件携带 vs 独立安装物 + 版本偏斜矩阵 + DB 拒启 typed remediation。
- Q9(B1):**✅设计已冻结(B1-B4 设计对审弧 r1-r20,B1 面 9 题全部 CONVERGED;2026-07-29)**——旧审批链退场运维的 canonical 骨架见 §16.1(cutover 状态机与 policy SSOT/coverage-trust-loadProof/fence-inventory-drain/effect closure/transition 与 admin receipt/rollback-emergencyHold/adapter ordering/SEC-7 验收包);协议细节见 spec §17。**SEC-7 仍为实施 gate:实际 close 只在 B1 dependency-closed 冻结稿经用户 APPLY 合入、本行(§18-Q9)更新、且 §16.1(九)SEC-7 验收包四组机器化验收全部通过时执行**——设计收敛置位不冒充 gate 已过;验收失败修差分/证据后重新 APPLY,不放宽判据。
- Q10(v0.11 降级,B2):**caller 完成唤醒与通知管道**——第三类 rewrite、回显式 ACK/cursor、重投 owner、枚举恢复面(`task.list_by_origin` 候选)、liveness ceiling、物理载体级 wake 计费(class-aware 计费已被复审驳倒)。UX-1 保持 open;P0A-1b 结论供其对审;设计笔记=proposal 2.2+2.10 第三类快照。
- Q11(v0.11 降级,B3):**worker attestation 全套**——trusted producer、expected/observed 比较谓词、assurance 分级、execution boundary/freshness、attestation domains 与迁移。SEC-1 保持 open;P0A-4/-5 可取证性评估结论供其对审;设计笔记=proposal 2.14 快照。
- Q12(v0.11 降级,B4):**仲裁 ArbitrationContext 协议**——争议成立谓词、consent authority、immutable round、两键幂等、资源闸、DR-6 obligation 扩展。FM-2 保持 open;设计笔记=proposal 2.19 快照。**B1-B4 流程=设计对审先行**(open-question 清单协商收敛后再冻结过窄差分,不再冻结先于共识)。

---

## 附录 A:下一阶段调研关键词(同类项目找灵感用)

**协议与规范(优先对照)**:
- **MCP Tasks**(historical 语义参照:terminal replay/cancel-late/TTL/ACL):旧 experimental core runtime 已从 SDK 删除;2026-07-28 正式发布为官方扩展 `io.modelcontextprotocol/tasks`(schema 仍 draft、无 tagged revision,按 §18-Q7 五门槛评估,DR-8),勿绑 wire shape。
- **A2A(Agent2Agent)task lifecycle**(a2a-protocol.org "life of a task"):跨 agent 任务状态机与 artifact 交换。
- `agent communication protocol ACP`、`MCP sampling`(2026-07-28 已 deprecated,SEP-2577;官方迁移建议=直接集成 LLM provider API)、`agent mesh`、`AGNTCY`。

**同类桥/编排项目**:`claude codex bridge`、`agent interop bridge`、`multi-agent CLI collaboration`、`claude-squad`、`claude-flow`、`tmux orchestrator claude`、`happy coder claude remote`、`omnara`、`vibe-kanban`、`codex mcp server wrapper`、`codex app-server client`、`codex sdk orchestration`。

**Durable execution / 投递语义**(措辞按实际保证):`durable execution engine`(Temporal/Restate/Inngest)、`transactional outbox`、`task lease fencing token`、**`at-least-once delivery` + `idempotent / effectively-once effects` + `uncertain outcome`**、`saga / workflow versioning`。

**本地 daemon 与激活**:`local daemon socket activation`、`launchd socket activation` / `systemd socket activation`、`single-instance election unix socket`、`SQLite WAL multi-client daemon`、`crash-only software`。

**授权与审批**:`object capability model`、`macaroons attenuation`、`principal attestation`、`policy engine Cedar OPA`、`human-in-the-loop agent approval`、`confused deputy LLM agents`。

**测试与合规工程**:`closed-source host conformance testing`、`record/replay fault injection`、`N-agent DAG fan-out join backpressure`、`data lineage retention tombstone`。

调研纪律(E-1):README 不算证据,读实现;每个候选记录对 §6/§8/§9/§11 的可借鉴点或反例。

## 附录 B:设计过程记录

- 轮 1(独立分析):双方各自出方案;Codex 本机探测确认 `tui_app_server` 已移除,确立全局 MCP 为桌面接入面。
- 轮 2(收敛+双向红队):Claude 指出 Claude→Codex 桌面入站缺口;Codex 推翻 Monitor-for-Desktop(官方 CLI-only);发现审批 principal blocker;定 B′。
- 轮 3(盲区狩猎):双路独立清单对撞,15/17 收敛;新增死锁/注意力/资源/数据治理/broker 生命周期/测试六大类;定五 invariant。
- 轮 4(究极决策):steelman"幻影需求"(修正为低频真实非默认);核实 Codex 插件体系与 `codex mcp-server`;定 manual_claim_current;收敛 B″。
- 轮 5(文档评审):Codex 全文只读评审(SHA-256 锚定),抓出 memories 事实漂移(同日两次快照相反,不可变 session 快照 + mtime 证据)、状态机语义冲突、令牌来源缺失、迁移依赖倒置、PR 治理过期等 → v0.2。
- 轮 6(定向终审):复核 §6/§15/§16 + F4/F10/F14,再抓 4 BLOCKER(outcome 非终态矛盾、origin 提交者可填、Identity Kernel 晚于 Task Core、单一 Gate 不足)+ ClaimOffer/ExecutionLease/WaiterLease/SuspensionReceipt 分层 → v0.3。
- 轮 7(同范围复核):§6.1 与 §15/§16 依赖图 PASS;余 2 BLOCKER + 字段闭合 → v0.4;Codex 一度签署"修复后可直接 REVIEWED"。
- 轮 8(究极复审,**三路独立换透镜**):①我做补丁漂移检查;②一个零对话背景的冷读者 agent 把文档当实现规格逐节试建;③Codex 做全系统攻击树 + 七轮共识可追溯性审计。三路**独立收敛于同一根因**:§6 在轮 6-7 围绕 pull/claim/offer 重构,§8.1/§9.3/§9.2/DR-7 表面签名与 push 默认路径从未同步 → v0.4 "REVIEWED" **翻案降级为 DRAFT v0.5**。冷读者额外抓 push-path 无 token 生命周期、phase 无转移表、人类审批无 surface;Codex 攻击树抓 effect-bound 强制缺失、same-UID 边界未决、budget envelope 无 carrier。可无歧义纠正项已在 v0.5 修(§0-C);需决策项列入 §0-B(D-1..D-6)。教训:窄修多轮后必须做**跨节漂移检查 + 零背景冷读者测试**,单纯"§6 内部自洽"审查会对表面章节的陈旧签名失明。
- 轮 9(交接复审):Codex 盲审交接文档,抓假 PASS/回源断链/joinPolicy 汇总矛盾等 15 条,逐条修 → 交接 v2。
- 轮 10(定案轮,2026-07-14/15):D-4 用户终裁(same-UID out-of-scope+④混搭);D-1/2/3/5/6+MCP Tasks 由 Codex 独立出案(chat v3-finalize-r1)+Claude 独立成案对撞,再经 4 轮红队盲审(chat v3-finalize-r2-review,架构 P0 12→8→4→2→0)收敛;Claude 抽验 Codex 引用 6/6 过。v0.5→v0.6。
- 轮 11(committed 字节终审,2026-07-15):对已落盘 v0.6 做全量多维终审(6 并行维度 agent:落锚保真/交叉引用/跨节漂移/安全不变量对抗/冷读者完整性/术语一致 + Codex 独立全文对抗)。三路独立收敛抓出 D-1 push 机制落稿遗漏(复发 v0.5 根因);安全不变量七大攻击面(policy-control 洗白/root 重铸/deadline 竞态/effect fence/activation churn/attestation 降档/审批洗白)经对抗未发现可利用绕过。补修 P0×3(D-1 补 §6.2/§6.4、effectiveVerification、protectedStateRevision 推进)+ 一批一致性项。v0.6→v0.7。
- 轮 12(v0.7 差分复核,2026-07-15):Codex 差分复核 v0.7 抓出 2 处 v0.7 修复引入的新漂移(rootAdmissionId 半贯穿、死 worker 回 READY_IDLE)+ verification acceptanceSpec carrier 缺口 + D-1 generation fence 未消费 + G-5 漏 allow-capable PEP。全部补修:rootAdmissionId 贯穿 TaskLineage/continuation/BudgetAccount/禁填集;broker-owned effectiveVerificationSnapshot;push completion 绑完整 generation tuple;死进程只 exit-observed→REAPED;G-5 纳入 allow-capable PEP+TCB inventory。v0.7→v0.8。
- 轮 13(v0.8→v0.9 收敛,2026-07-15):Codex 差分复核 v0.8/v0.9 逐项收口——verification 四支路由(rejected 不得降 not_applicable)、D-1 evidence 七元 tuple 与 §6.2 完全一致+§9.2 引完整 fence、G-5 单一 SSOT(补 adapter,§10.1/§16 纯引用)。**Codex 三路独立 APPROVE:架构正文层可定稿,v0.9 收敛**;剩余仅 §0-A 协议规格/E2E-gated/apply-time 可降级项。v0.8→v0.9。
- 轮 14(v0.9→v0.10,2026-07-17):协议规格起草期(spec v0.1→v0.12.18,Chunk 0-7 全封版)累积的 architecture 同步修订建议 **A-1..A-9** 经用户批准(2026-07-16)修入——来源=spec 轮 14/15/18 各批+r63 逐锚复核 KEEP;九项均为规格→架构回写对齐(spec=细节 SSOT,本文锁不变量),不重开 v0.9 锁定决策。同批:§17 更新 PR #4-#6 合并事实(2026-07-16/17,Codex r71-r74 审计链)、§18-Q1 裁决记录(D 为当前动作、C 为方向)。修订经 Codex 差分红队(chat v3-apply-r75 起)。
- 轮 15(v0.10→v0.11,2026-07-28):v3 修订提案(项目复盘+功能愿景四镜头复审 43 条发现全量分流)经 **r1-r12 十二轮评审**(Codex 盲审 2 轮全量+窄差分循环;r3-r6 四连 REJECT 触发预设止损判据、经用户裁决转**拆分落地**路线;r7-r11 拆分闭包五轮收口)获 **ACCEPT**(verdict 绑定 r11 SHA `f60666c0…`)。稳定集落盘为本 v0.11;四面(B1 旧链退场/B2 通知管道/B3 attestation/B4 仲裁)降级为 v0.12 定向提案并登记 §18-Q9..Q12,流程改「设计对审先行」。proposal=repo 外 `agentbridge_v3_apply_2026-07/proposal/v3-revision-proposal-2026-07.md`(r12 定稿 SHA `351e4667…`,内含四面完整设计笔记快照与逐轮修订记录)。
- 轮 16(v0.11→v0.12,2026-07-31):**B1 冻结稿 APPLY**——对审弧 r1-r20(B1 面 9 题 CONVERGED)+冻结稿窄差分 r1-r14(REJECT 收窄循环:coverage 时钟族/obligation 载体/operator 事务合成/resolution winner registry/rollback 与 emergency revoke 交错终局/exact-pair carrier;codex-r14-b1 ACCEPT)经用户 APPLY 合入 §16.1+§18-Q9+8 接线锚;SEC-7 四组机器化 gate 保持 open;spec 同批 v0.12.20。
- 全程:双方关键 artifact 互相抽查;Codex 全程只读、无 git 写操作。
