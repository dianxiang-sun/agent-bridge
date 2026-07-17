# Phase 0A 探测 runbook(纸面准备包;全部 NOT_RUN)

- **runbookVersion**: `phase0a-runbook/v1`(evidence 的 `runbookVersion` 字段逐字填本值;§0.6)
- **状态**: DRAFT v0.4 — 纸面准备包,**未执行任何探测**;本文档不含任何探测结论。(`runbookVersion` 字符串在首次批准前恒为 `phase0a-runbook/v1`;DRAFT 迭代不消耗版本号,§0.6 的「修订=改版本号」自首次进入 allowlist 起生效。)
- **规范地位**: 本文档**不是 wire 规范**。探测项登记/evidence schema/pass 谓词/消费门的 SSOT=`v3-protocol-spec.md` §14(下称 spec);探测项清单来源=`v3-architecture.md` §15 Phase 0A 十项(下称 architecture)。本文档只细化「怎么执行、怎么采证」,与 spec §14 冲突时以 spec 为准。
- **配套 harness**: `scripts/phase0a/`(evidence 校验器+NOT_RUN 生成器+fixtures;见 §0.5)。

> ⚠ **安全边界与授权(必读)**:Phase 0A 全部探测需**实机双桌面 GUI 观察+用户在场配合**,其中 P0A-4/P0A-5/P0A-6/P0A-7/P0A-CB 为**计费敏感项**(§11 汇总)——执行前须按 §11 run card 逐项报告并获用户批准,**不因任何既往会话授权自动执行**。纸面阶段(本交付)只组装/校验 NOT_RUN evidence 与谓词逻辑:不调 Desktop、不跑 `claude -p`、不连真实 MCP、不触任何计费探测。

---

## 0. 通用规程

### 0.1 授权与执行纪律

- 每个探测项执行前:填 §11 run card → 用户批准 → 执行 → evidence 经 harness 校验后登记。
- **status 由 harness 判,不由人手写**:执行者只产出 artifact+detail 原始字段;`status=PASS ⇔ passPredicate=true`(spec §14.2 exact-shape CHECK 第三条),由 `scripts/phase0a/validate.py` 计算核验;人工直填 PASS 的 evidence 一律拒收。
- 探测**任一失败即改设计**(architecture §15 首行);各项 fallback 见每项「失败 fallback」小节,均为 architecture/spec 已锚定的保守侧,**不在探测现场即兴改设计**。
- 探测结论**只回填 evidence,不自动启用能力**(spec §14.3 回填协议:conjunct-eligible 非 auto-enable)。

### 0.2 环境冻结与 hostMatrix 采集

- `hostMatrix = {product, hostVersion, os, osVersion}`(spec §14.2)。采集命令(macOS):
  - `os`/`osVersion`:`sw_vers -productName` / `sw_vers -productVersion`
  - Claude 侧:`product="claude-code-desktop"`(或 `"claude-code-cli"`),`hostVersion` = Desktop「About」版本号(CLI 用 `claude --version`)
  - Codex 侧:`product="codex-desktop"`(或 `"codex-cli"`),`hostVersion` = Desktop「About」版本号(CLI 用 `codex --version`)
- **同批探测全程冻结同一 hostMatrix**(architecture §15 末行「固定 host 版本」);执行期间宿主自动升级 → 该批 evidence 全部作废重跑(spec §14.3 evidence 失效条)。
- 一个探测项涉及双宿主时(如 P0A-CB),`hostMatrix.product` 填**被探测行为所属宿主**;另一侧宿主版本记入 artifact 首行 `env_snapshot` 事件(§0.4)。

### 0.3 隔离 OS profile 与合成仓库

- 全部探测在**隔离 OS 用户 profile+合成仓库**运行(architecture §15 末行),不碰真实用户配置/真实项目:
  - 新建 macOS 标准用户(如 `abprobe`),在其 HOME 下登录两宿主(订阅账号;P0A-4 见 authSource 纪律)。
  - 合成仓库:`git init` 一个最小仓库(README+一个源文件),探测所需 hook/插件只装在该 profile。
- **隔离要求是 architecture §15 硬要求,本 runbook 无权放宽**:正式 evidence 必须在隔离 profile 下采集(artifact `env_snapshot` 记 `isolation:"isolated_profile"`)。隔离 profile 暂不可行时(如 Desktop 授权绑定主用户),只能做**演练跑**:主用户下专用测试目录+探测专用插件/hook 命名空间,`env_snapshot` 记 `isolation:"degraded_shared_profile"`——此类 run 的 evidence **不得记 PASS**(harness 强制:PASS ⇒ isolation=isolated_profile,validate.py ISOLATION 门),只用于流程排练;放宽此要求须先修订 architecture §15(封版件,另行 APPLY)与本 runbook 版本。
- Codex worker 类探测(P0A-4/5)启动前强制核验 memories 全关:读 `~/.codex/config.toml` 确认 `generate_memories=false && use_memories=false`,无法证明用隔离 `CODEX_HOME`(architecture F14/§9.2)。

### 0.4 artifact 采集通则

- 每个探测项产出**一个 JSONL 事件流 artifact**:每行一个 JSON 对象
  `{"seq": int, "atMs": int, "kind": string, "data": object}`
  - `seq`:采集器铸造,从 1 起严格 +1(单调,不回绕);`atMs`:整数毫秒 UTC epoch(spec §1.3)。
  - 首行恒为 `kind="env_snapshot"`,`data` 至少含 `{hostMatrix, runbookVersion, profileVersion, isolation}`;`isolation` 取封闭枚举 `{"isolated_profile", "degraded_shared_profile"}`(§0.3)。**harness 交叉绑定**:`env_snapshot` 的 `hostMatrix/runbookVersion/profileVersion` 必须与 evidence 顶层同名字段深等(validate.py ENV 门)——artifact 不得声称与 evidence 不同的环境/版本。
  - 采集期间只追加,不回改;探测结束后文件即冻结。
- **artifactRef** = `"sha256:" + SHA-256(artifact 文件字节)`(spec §1.3 digest 文本形);artifact 文件以内容寻址存放:`<evidence 目录>/artifacts/<64hex>.jsonl`。
- artifact **零 secret**:不得含 token/凭据/审批内容/用户真实数据(spec §13.2「不出现的字段」同型纪律);hook payload 全文入 artifact 前须过滤上述字段。

### 0.5 evidence 组装与判定流程(harness 接线)

1. 探测执行 → artifact JSONL 冻结 → 计算 `artifactRef`。
2. 按各项「evidence 字段采集法」填 `detail` 与顶层字段(`executedAt`/`timeoutMs`/`expectedStateSequence`/`fallbackOnFail`——后两者**逐字取本 runbook 各项模板**;`expectedStateSequence` 必须是 `expected_templates.json` 中该项某一注册变体的逐字拷贝,validate.py TEMPLATE 门强制,自造/空 expected 一律拒收)。
3. `observedStateSequence` = 按各项「抽取规则」(§0.7 统一形式)从 artifact **确定性抽取**;抽取由 `scripts/phase0a/extract.py` 执行,人工不得手编。
4. `evidenceDigest` = `AB-CANON-1("AgentBridge/ProbeEvidence/v1", <13 字段 hash-input>)`(spec §14.2;hash-input 字段全出现、缺席=null,spec §1.4)。
5. `scripts/phase0a/validate.py <evidence.json> --artifact-dir <dir>`:exact-shape 三条 → digest 重算 → artifact 重抽比对 → passPredicate → 得 status;任何一步失败=evidence 拒收(fail-closed)。
6. 消费(回填 gate 输入)另跑 `--consume`:`status=PASS ∧ digest 一致 ∧ profileVersion==当前 ∧ runbookVersion ∈ approved allowlist ∧ hostMatrix==冻结矩阵`(spec §14.2 消费门)。

### 0.6 版本与消费门配置

- `runbookVersion`:本文档头部值;修订本文档=改版本号(旧 evidence 按 spec §14.3 失效重探)。
- `profileVersion`:adapter profile 版本。**当前无冻结 profile**,纸面阶段一律填 `"adapter-profile/v0-unfrozen"`;P0A-1/P0A-3 PASS 后按 spec §4.9 冻结正式 profileVersion。
- 消费门配置=`scripts/phase0a/allowlist.json`:`approvedRunbookVersions`(初始 **[]**=空,任何 PASS 不入门)、`currentProfileVersion`、`frozenHostMatrix`(初始 **null**=未冻结,消费门恒拒)。三者由用户在探测批次启动时显式定,fail-closed 起步。

### 0.7 observed 抽取规则统一形式

- 每项给一张 `(kind 允许集, 每 kind 保留字段表)`(附录 A 汇总;`extract.py` 与附录 A 同表,代码注释回链)。
- 抽取 = artifact 逐行 → 取 `kind ∈ 允许集` 的行 → 按 `seq` 升序 → 每行投影为 `{"kind": kind} ∪ data 中保留字段` → `observedStateSequence = {"events": [<投影行…>]}`。
- **保留字段只含枚举/布尔/小整数常量**(可预期值);延迟/时间戳等数值与宿主原值(hook source 原文等不可预知值)不入 observed(入 `detail`)——保证 `expectedStateSequence` 可在本 runbook 预先写死、`observed==expected` 可判等(spec §14.2 公共强制项)。
- **保留字**:投影行的 `kind` 键被 event tag 占用,data 保留字段禁止再叫 `kind`(P0A-1 用 `scenarioKind`、P0A-CB 用 `sourceKind`/`resolutionKind`)。
- `expectedStateSequence` 同形状,取各项模板**逐字**;场景重复次数以模板为准(执行次数偏离模板=observed≠expected=不 PASS,按 INCONCLUSIVE 处理重跑)。

---

## 1. P0A-1:Claude 唤醒链(SessionStart→watchPaths→FileChanged→asyncRewake)

### 1.1 目的与回填目标

宿主平台事实:SessionStart 四来源(新建/resume/clear/compact)的 hook 触发与 source 值、watchPaths 注册、FileChanged+asyncRewake 空闲唤醒、连续信号 coalescing、sleep/强退恢复(architecture §15-1;事实基线 F10)。回填:spec §2.4 `canWakeIdle`/`inboundMode=hook_wake`、§4.2 registrationSource 宿主映射、§4.9 `claude_hook_session_start_v1` profile 冻结、§13.3 宿主侧 coalescing 标注。evidence=`WakeChainEvidence`。

### 1.2 前置

- 隔离 profile+合成仓库(§0.3);Claude Code Desktop 固定版本(§0.2)。
- **探测桩插件**(probe stub;不依赖新 broker——Phase 0A 全部探测如此,architecture §15):
  - `SessionStart` hook:把事件 payload(source/session_id 等,滤 secret)追加进 artifact;按 spec §4.4 滚动判定表**演算**本地 registry(`registry.json`:rs 记录+generation),记 `registration_decision` 事件;返回该 session 专属绝对 `watchPaths`=桩信号文件路径(F10:SessionStart 可返回 watchPaths)。
  - `FileChanged` hook(`asyncRewake:true`):读桩信号文件(形状照 spec §13.2,**零正文零 token**),追加 `file_changed_hook` 事件,exit 2(F10:唤醒 idle session)。
  - 桩「broker 写者」脚本:按 spec §13.4 原子写(tmp→fsync→rename)改桩信号文件。
- 唤醒确认载体:唤醒后 session 的下一个可观察 hook 事件(见 1.4 观察点③;若该载体本身不存在,即为本探测的负结论之一)。

### 1.3 逐步操作

1. 场景 A(session_start):Desktop 新建会话 → 观察 SessionStart hook 触发与 source 值 → 桩演算 generation(新建 rs,generation=1)。
2. 场景 B(resume):关闭并 resume 同一会话 → 观察 source → 演算(+1)。
3. 场景 C(clear):会话内执行 clear → 观察 source → 演算(+1)。
4. 场景 D(compact):制造长上下文触发 compact(或手动 compact)→ 观察 source → 演算(+1)。
5. 每场景注册后:桩写者更新信号文件(pendingCount 0→1,模拟唤醒型 rewrite)→ 等待 FileChanged hook 触发与 session 唤醒 → 记录 wakeDelivered 与延迟。
6. 重复 SessionStart:同一 live 会话触发第二次 SessionStart(如重复 resume 到同一会话),观察是「幂等重放/滚代/双滚」(spec §2.5.1/§4.4)。
7. coalescing:session idle 时桩写者**连续快速 rewrite ≥2 次**(间隔 <1s)→ 记 emittedSignals 与实际 rewake 次数(spec §14.2:零样本不 PASS)。
8. sleep/wake:系统 sleep ≥2min → 唤醒 → 桩写者 rewrite → 观察恢复唤醒与窗口。
9. force-quit/relaunch:强退 Desktop → 重启 → 观察 SessionStart(source?)→ 桩写者 rewrite → 观察唤醒。
10. 延迟统计:对 5-9 中全部成功唤醒样本算 p50/p95。

### 1.4 观察点

① 每场景 hook payload 的 `source` 原值与出现时机;② 桩演算的 mappedRegistrationSource 是否与 spec §4.2 枚举一一对应(**clear/compact 必须映 clear/compact 非 reconnect**);③ 唤醒的可观察判据:idle session 在 FileChanged exit 2 后是否产生新活动(下一 hook 事件/UI 转活动态)——**该判据本身属探测结论,记入 detail 与 artifact**;④ 重复 SessionStart 行为归类(`new_generation`/`idempotent_replay`/`observed_double_roll`);⑤ sleep/强退后 hook 链是否完整恢复。

### 1.5 evidence 字段采集法(WakeChainEvidence,spec §14.2)

- `perSourceScenarios[]`(恰 4 行,场景 A-D 各一):`hostHookEvent`/`hostHookSource`=hook payload 原值;`mappedRegistrationSource`=桩演算值;`rsBefore/generationBefore/rsAfter/generationAfter`=桩 registry 快照;`registrationEventId`=桩铸造(`regev_` ULID);`credentialRolled`=桩演算(滚代⇒true);`wakeDelivered`=观察点③。
- **raw source 纪律(harness 强制面+人工评审面)**:①场景行的 `session_start_hook` artifact 行 `data.source` 记 hook 原值;validate.py RAWSOURCE 门把 `detail[*].hostHookSource` 与 artifact 场景行原值**逐行绑定**(detail 不得错报/互换 hash 锚定的 artifact 记录);②四行 `hostHookSource` 两两异、`hostHookEvent` 四行同一(谓词强制——关系可判,值不可预知);③**raw source↔mapped 的对应真值是本探测的输出而非输入**(§4.9 profile 冻结即由本 evidence 建立)——消费评审时人工核对 detail 原值与 mapping 决策(观察点①②),harness 无法替代此步。
- `duplicateSessionStartBehavior`=步骤 6 归类。
- `coalescingObserved`={emittedSignals(≥2), observedRewakes}=步骤 7 计数。
- `sleepRecoveryScenarios[]`(恰 2,kind UNIQUE):步骤 8/9 各一行,`recovered`=唤醒链恢复与否,`recoveryWindowMs`=从 rewrite 到唤醒观察的毫秒数。
- `wakeLatencyMs`={p50,p95}=步骤 10。

### 1.6 抽取规则(附录 A 表 1)

kind 允许集与保留字段:`session_start_hook{}`(hook source 原值不可预知,入 detail 不入 observed)、`registration_decision{mappedRegistrationSource, generationDelta, credentialRolled}`(generationDelta=after−before ∈{0,1})、`signal_write{}`、`file_changed_hook{}`、`wake_observed{}`、`duplicate_session_start{behavior}`(步骤 6 的重复 SessionStart 由桩记本事件,不另记 registration_decision)、`coalescing_run{}`、`recovery_scenario{scenarioKind, recovered}`。

### 1.7 expected 模板 / timeoutMs / fallbackOnFail

- `expectedStateSequence`:四场景各(`session_start_hook{}`(source 原值入 detail 不入 observed,§1.6)→`registration_decision{mappedRegistrationSource=<对应>, generationDelta=<0|1>, credentialRolled=<同>}`→`signal_write`→`file_changed_hook`→`wake_observed`)顺连;后接 `duplicate_session_start{behavior}`(**两合法值各有注册变体:`P0A-1.a`=idempotent_replay(安全侧)/`P0A-1.b`=new_generation——执行前按 run card 选定一份;实测落在另一已注册变体=更正 run card 选择后重跑,仅未注册组合才修订模板+版本号(§0.6)**)、`coalescing_run`、`recovery_scenario{scenarioKind:"sleep_wake",recovered:true}`、`recovery_scenario{scenarioKind:"force_quit_relaunch",recovered:true}`。精确 JSON 见附录 B 表 1。
- `timeoutMs`: 120000 [default](单次唤醒观察窗;全部 *WindowMs/*Ms ≤ 此值)。
- `fallbackOnFail`: `"wake_chain_unavailable: hook_wake/canWakeIdle not granted; dispatch candidates pull-face only (spec §2.4 降级语义, architecture §6.3 pinned_target_unavailable)"`。

### 1.8 回滚

删除探测桩插件与 hook 配置、桩信号文件与 registry;隔离 profile 整体丢弃(§0.3)。无宿主全局状态残留(hook 只装在隔离 profile)。

### 1.9 计费

零模型调用设计:唤醒观察不要求模型产生回复(hook 层观察);若唤醒判据依赖模型 turn(观察点③负结论),升级为计费敏感,回到 run card 重批。

---

## 2. P0A-2:Codex 插件生命周期

### 2.1 目的与回填目标

插件安装→enable→**新 task** MCP 工具可见、hook hash 信任 UX、升级(hash 变化)后重信任、marketplace refresh 与已装 cache 语义(architecture §15-2;F5/F6)。回填:architecture §9.1 Codex 插件分发(CodexWorker adapter gate 输入)。evidence=`PluginLifecycleEvidence`。

### 2.2 前置

隔离 profile(§0.3);最小探测插件两个版本(v1/v2,仅含:一个 stdio MCP stub(echo 工具)+一个 SessionStart hook(追加 artifact));本地 marketplace 源(F6:`codex plugin add/list/marketplace/remove`)。

### 2.3 逐步操作

1. `codex plugin add <探测插件 v1>` → enable → 记录安装/启用输出。
2. 开**新 task** → 核验 MCP echo 工具可见可调(F1/F6:已打开 task 不热加载——同时在旧 task 验证**不可见**,双向记录)。
3. 观察 hook 信任 UX:首次触发 hook 时的信任提示(F5:按定义 hash 逐个 review)→ 接受 → 记录。
4. 升级到 v2(hook 内容变→hash 变)→ 观察是否要求重新信任(F5)→ 记录。
5. marketplace refresh → 观察已装插件 cache 是否随 refresh 失效/升级(F6:refresh ≠ 已装 cache 必然升级)→ 归类 `marketplaceCacheBehavior`。

### 2.4 观察点

① 新 task 工具可见性(与旧 task 不热加载对照);② 信任提示的粒度(per-hook hash?);③ 升级后首次触发是否强制重信任;④ refresh 后 `codex plugin list` 的版本/hash 变化。

### 2.5 evidence 字段采集法

`installEnableNewTaskVisible`=步骤 2 新 task 可见;`hookTrustAccepted`=步骤 3;`upgradeHashChangeReTrust`=步骤 4;`marketplaceCacheBehavior`=步骤 5 归类,PASS 允许集={`refresh_ok`,`cache_invalidated_ok`}(spec §14.3),其余观察值原样记录(如 `stale_cache_requires_manual`)→不 PASS。

### 2.6 抽取规则(附录 A 表 2)

`plugin_install{ok}`、`plugin_enable{ok}`、`new_task_tool_probe{toolVisible}`、`old_task_tool_probe{toolVisible}`、`hook_trust_prompt{accepted}`、`plugin_upgrade{hashChanged}`、`retrust_prompt{required, accepted}`、`marketplace_refresh{behavior}`。

### 2.7 expected 模板 / timeoutMs / fallbackOnFail

- expected:`plugin_install{ok:true}`→`plugin_enable{ok:true}`→`old_task_tool_probe{toolVisible:false}`→`new_task_tool_probe{toolVisible:true}`→`hook_trust_prompt{accepted:true}`→`plugin_upgrade{hashChanged:true}`→`retrust_prompt{required:true,accepted:true}`→`marketplace_refresh{behavior:"refresh_ok"}`(附录 B 表 2)。
- `timeoutMs`: 300000 [default]。
- `fallbackOnFail`: `"plugin_distribution_unavailable: manual .codex/config.toml mcp_servers entry + manual hook install; CodexWorker adapter gate blocked (architecture §9.1)"`。

### 2.8 回滚

`codex plugin remove` 探测插件;删除本地 marketplace 源;核验 `~/.codex/config.toml` 无残留段。

### 2.9 计费

零模型调用(echo 工具核验可见性即可,不发真实 prompt;若「新 task」创建本身强制起 turn,则记一次最小 turn 消耗,列入 run card)。

---

## 3. P0A-3:Codex MCP shim 进程拓扑与 thread 身份

### 3.1 目的与回填目标

MCP shim 的进程拓扑(谁 spawn、生命周期、每 task/全局?)与**可信 thread 身份**获取;失败→attach unsupported(architecture §15-3;F7)。回填:spec §4.9 `codex_shim_thread_identity_v1` profile(unverified→verified)。evidence=`ThreadIdentityEvidence`。

### 3.2 前置

P0A-2 的探测插件(其 MCP stub 即本项探测桩,升级为「自省 shim」:启动时把自身 `pid/ppid/argv/cwd/env 白名单键`(滤 secret)与 MCP `initialize` 参数全文(滤 secret)追加 artifact)。

### 3.3 逐步操作

1. 新 task 触发 shim 加载 → artifact 记进程拓扑(ppid 归属:Desktop 主进程?per-task?)。
2. 在 task 内调用 shim 工具 → 检查该调用上下文中是否可获得**宿主 thread 身份**(候选来源逐一探查并记录:MCP initialize 参数、env、工具调用 metadata——**候选集开放,发现即记录,不预设存在**)。
3. 同一 thread 第二次调用 → 身份值是否稳定。
4. Desktop 重启+resume 同 thread → 身份是否不变(`identityStability`)。
5. 若 1-4 拿不到任何身份:记 `threadIdObtainable=false`,并验证显式 `attach(pairingCode)` 路径的前提(architecture §15-3:仅当另一可信宿主通道已注册该 session handle 时可配对)是否可满足——仅记录,不实现。

### 3.4 观察点

① shim 进程与 task 的对应关系(1:1/1:N);② drain/task 关闭时 shim 是否被回收;③ 身份来源的**可信性**(宿主注入 vs 自报——自报值不算 verified,spec §4.9);④ resume 前后身份连续性。

### 3.5 evidence 字段采集法

`topologyReachable`=步骤 1 成功记录拓扑;`threadIdObtainable`=步骤 2(任一**宿主注入**来源可得);`identityStability`=步骤 3/4 归类(`stable`/`changes_on_resume`/`unavailable`)。

### 3.6 抽取规则(附录 A 表 3)

`shim_spawn{reachable}`、`identity_probe{obtained, hostInjected}`、`stability_check{phase, stable}`(phase∈{`same_thread_recall`,`desktop_restart_resume`})。

### 3.7 expected 模板 / timeoutMs / fallbackOnFail

- expected:`shim_spawn{reachable:true}`→`identity_probe{obtained:true,hostInjected:true}`→`stability_check{phase:"same_thread_recall",stable:true}`→`stability_check{phase:"desktop_restart_resume",stable:true}`(附录 B 表 3)。
- `timeoutMs`: 300000 [default]。
- `fallbackOnFail`: `"attached_adapter_unsupported: explicit attach(pairingCode) only when another trusted host channel already registered the session handle, else surface stays unsupported (architecture §15-3, spec §4.9 unverified)"`。

### 3.8 回滚

同 P0A-2(shim 即插件组件)。

### 3.9 计费

步骤 2-4 的工具调用发生在真实 task 内,可能伴随模型 turn——**低额计费**,列入 run card(与 P0A-2 合并批次可复用同一 task)。

---

## 4. P0A-4:`codex mcp-server` 原始行为(recording stub)⚠计费敏感

### 4.1 目的与回填目标

`codex mcp-server` 的 elicitation 事件形状、cancel 行为、crash 后 Session-not-found、认证/额度来源(**禁静默 API-key**)(architecture §15-4;F7)。**recording stub 记录事件流,不接真实 policy**(fail-closed 归 G-2 gate,非本项)。回填:architecture §9(CodexWorker adapter gate 输入)。evidence=`McpServerBehaviorEvidence`。

### 4.2 前置

- **authSource 纪律(先于一切)**:核验本机 Codex 认证走订阅——检查 `~/.codex/config.toml` 与进程 env **无 API-key 配置**(发现即中止,标 `authSource="api_key"` 判 FAIL——spec §14.3:PASS 要求 `authSource="subscription"`);无法判定=`"unknown"`(亦不 PASS)。
- recording stub:以 stdio 起 `codex mcp-server` 子进程、转录**全部** JSON-RPC 双向帧(滤 secret)进 artifact 的驱动脚本;隔离 `CODEX_HOME`(F14)。

### 4.3 逐步操作

1. 启动 recording stub → MCP handshake → 记帧。
2. `codex(prompt=<最小固定 prompt>)` → 得 `{threadId, content}`(F7)→ 记帧。
3. 构造一个会触发审批的操作请求(如受限命令)→ 观察 **elicitation 事件的完整形状**(F7:审批经 MCP elicitation 转发)→ 记帧 → stub **不响应或显式拒绝**(recording 不代批)。
4. 发 MCP cancelled → 观察 `Op::Interrupt` 对应行为(F7)→ 记帧。
5. kill -9 mcp-server 子进程 → 重启 → `codex-reply(threadId=旧值)` → 期望 Session-not-found(F7:进程重启不从磁盘续 thread)→ 记帧。
6. 全程结束后二次核验 authSource(用量出现在订阅账户侧;config/env 复查)。

### 4.4 观察点

① elicitation 帧的 method/params 完整 schema;② cancel 后 turn 终结形态;③ crash-restart 后旧 threadId 的错误码/错误形状;④ 认证来源三查(config/env/账户用量页)。

### 4.5 evidence 字段采集法

`elicitationShape`=步骤 3 帧的 schema 摘要(method+params 字段名树,**非全文**);`cancelObserved`=步骤 4;`sessionNotFoundAfterCrash`=步骤 5;`authSource`=步骤 6 三查归类。

### 4.6 抽取规则(附录 A 表 4)

`mcp_handshake{ok}`、`thread_started{}`、`elicitation_captured{shapeCaptured}`、`cancel_probe{cancelObserved}`、`crash_restart_probe{sessionNotFound}`、`auth_check{authSource}`。

### 4.7 expected 模板 / timeoutMs / fallbackOnFail

- expected:`mcp_handshake{ok:true}`→`thread_started`→`elicitation_captured{shapeCaptured:true}`→`cancel_probe{cancelObserved:true}`→`crash_restart_probe{sessionNotFound:true}`→`auth_check{authSource:"subscription"}`(附录 B 表 4)。
- `timeoutMs`: 600000 [default](含 crash-restart 链)。
- `fallbackOnFail`: `"codex_worker_mcp_server_unfit: re-evaluate DR-4 executor ladder (app-server per DR-4 conditions); CodexWorker adapter gate blocked until resolved (architecture §9.2/DR-4)"`。

### 4.8 回滚

kill 全部 mcp-server 子进程(waitpid 确认);删隔离 `CODEX_HOME`。

### 4.9 计费

**计费敏感**:步骤 2/3 消耗订阅额度(≥2 真实 turn)。run card 必批;authSource≠subscription 立即中止。

---

## 5. P0A-5:worker 线程 Desktop 可见性 ⚠计费敏感

### 5.1 目的与回填目标

mcp-server 起的 worker 线程在 Desktop 的列表可见性、`codex://threads/<id>` 导航、drain 后 resume、双客户端并发同 thread(architecture §15-5;F3/F7)。回填:architecture §9.2 CodexWorker 生命周期(`desktopViewer` 判定)。evidence=`WorkerVisibilityEvidence`。

### 5.2 前置

P0A-4 的 recording stub 与其产出的活 threadId(**与 P0A-4 同批执行复用 thread,零增量计费**);Codex Desktop 同机同账号在场。

### 5.3 逐步操作

1. P0A-4 步骤 2 的 thread 存活期间:Desktop 线程列表查该 threadId 是否出现(`desktopThreadVisible`)。
2. 浏览器/终端打开 `codex://threads/<threadId>` → Desktop 是否导航到该 thread(F3:deep link 仅导航已有 task)。
3. drain(关闭 mcp-server 进程,协议 shutdown 序,architecture §9.2)→ Desktop 再打开该 thread → 观察 `resumeAfterDrain`(`resumes`/`new_thread`/`unavailable`)。
4. 双客户端并发:mcp-server 持 thread 活跃期间,Desktop 同时打开同 thread 并输入 → 归类 `concurrentDualClient`(观察值开放记录;PASS 允许集={`isolated_ok`,`serialized_ok`},spec §14.3)。

### 5.4 观察点

① 列表刷新时延(worker 线程多久出现);② deep link 从外部进程触发的行为;③ drain 后 thread 的 Desktop 侧状态标记;④ 并发输入是否产生交错/串线(unsafe race → 不 PASS)。

### 5.5 evidence 字段采集法

四字段逐一=步骤 1-4 归类;`concurrentDualClient` 记录原始观察串。

### 5.6 抽取规则(附录 A 表 5)

`visibility_check{visible}`、`navigation_check{works}`、`drain_resume_check{behavior}`、`dual_client_check{behavior}`。

### 5.7 expected 模板 / timeoutMs / fallbackOnFail

- expected:`visibility_check{visible:true}`→`navigation_check{works:true}`→`drain_resume_check{behavior:"resumes"}`(**安全侧期望;`new_thread` 亦 PASS**——偏离模板时按 §0.7 INCONCLUSIVE 修订模板重跑,或直接以 `new_thread` 版模板执行)→`dual_client_check{behavior:"isolated_ok"}`(同前,`serialized_ok` 亦 PASS)(附录 B 表 5)。
- `timeoutMs`: 600000 [default]。
- `fallbackOnFail`: `"desktopViewer=unavailable: worker runs headless-only, viewer capability degraded (architecture §9.2 desktopViewer enum)"`。

### 5.8 回滚

同 P0A-4;Desktop 侧探测 thread 留存无害(合成内容),可手动删除。

### 5.9 计费

与 P0A-4 合并批次=零增量;单独执行则需新起 thread(1 turn),run card 必批。

---

## 6. P0A-6:Codex systemMessage nudge ⚠计费敏感(低额)

### 6.1 目的与回填目标

Stop/UserPromptSubmit hook `systemMessage` 的桌面视觉位置/持久性、`followUpQueueMode="queue"` 下 hook 时机(architecture §15-6;F5:systemMessage 仅 UI 警示不进模型上下文)。回填:architecture §9.3 manual_claim_current nudge 时机;spec §2.4 `inboundMode=manual_claim_current` gate。**仅 nudge UX,不回填 canInjectActiveConversation**(spec §14.1)。evidence=`SystemMessageEvidence`。

### 6.2 前置

探测插件 v3:Stop hook 与 UserPromptSubmit hook 各返回一条固定文案 metadata-only `systemMessage`(`task-ready:<合成id>` 形,architecture §8.1 辅助通道纪律——零正文零 token);`followUpQueueMode="queue"` 配置(F5 hooks stable)。

### 6.3 逐步操作

1. Desktop task 内发一个最小 prompt → turn 结束触发 Stop hook → 记 `hookFired/timingMs`,截图记视觉位置。
2. 观察该 systemMessage 的持久性(切走再切回是否还在)。
3. 队列一条 follow-up(`followUpQueueMode="queue"`)→ 发第二个 prompt 触发 UserPromptSubmit hook → 记时机与 `relativePhase`(before_next_turn/after)。
4. `entersModelContext` 验证:后续 turn 让模型复述「你在本对话看到的系统提示」+导出/查看该 task 的上下文视图(若宿主提供)→ 期望**模型不可见**(F5)。**双证据缺一即 `entersModelContext` 按 true 记(保守侧,判 FAIL)**。

### 6.4 观察点

① systemMessage 渲染位置(banner/inline/不可见);② 跨 UI 切换持久性;③ 两 hook 的 timing 相对下一 turn 的相位;④ 模型上下文不可见性的双证据。

### 6.5 evidence 字段采集法

`desktopVisualPosition`/`persistence`=步骤 1/2;`followUpQueueMode`=配置回读;`scenarios[]`(恰 2,startEvent UNIQUE)=步骤 1/3 各一行;`entersModelContext`=步骤 4(期望 false)。

### 6.6 抽取规则(附录 A 表 6)

`nudge_scenario{startEvent, hookFired, relativePhase}`、`visual_check{position, persistence}`、`queue_mode_check{mode}`、`model_context_check{entersModelContext}`。

### 6.7 expected 模板 / timeoutMs / fallbackOnFail

- expected:`nudge_scenario{startEvent:"stop",hookFired:true,relativePhase:"before_next_turn"}`→`visual_check{position:"visible_banner",persistence:"persistent"}`(**`visible_inline` 亦 PASS**,同 §5.7 处理)→`queue_mode_check{mode:"queue"}`→`nudge_scenario{startEvent:"user_prompt_submit",hookFired:true,relativePhase:"before_next_turn"}`→`model_context_check{entersModelContext:false}`(附录 B 表 6)。
- `timeoutMs`: 300000 [default]。
- `fallbackOnFail`: `"manual_claim_nudge_degraded: no reliable nudge surface; manual_claim_current relies on user-initiated peek only (architecture §9.3 边界)"`。

### 6.8 回滚

移除探测插件 v3 hook;删除探测 task。

### 6.9 计费

2-3 个最小 turn(步骤 1/3/4),低额;run card 汇总批。

---

## 7. P0A-7:`claude -p --resume` 隔离 ⚠计费敏感(单次)

### 7.1 目的与回填目标

`claude -p --resume <打开中的桌面 session>` 是否被拒(architecture §15-7;隔离环境,不碰真实会话)。回填:spec §4.6 resume 隔离前提(非直接回填条目,负结论=设计回改)。evidence=`ResumeIsolationEvidence`。

### 7.2 前置

隔离 profile;Desktop 打开一个合成会话并保持前台打开;取其 session id(F9:本地 Git 仓库中的 Desktop session 各用独立 worktree——从会话界面/项目目录侧观察取得,取法记入 artifact)。

### 7.3 逐步操作

1. Desktop 会话保持打开。
2. 终端:`claude -p --resume <session_id> "reply with the single word ok"` → 记录 exit code+stdout/stderr 全文(滤 secret)。
3. 归类:被拒(明确错误)=`claudePResumeRejected:true`;成功产出回复或静默 fork=false。
4. Desktop 侧核验:原会话是否被此操作污染(新增 turn?)——记入 artifact(污染=隔离破坏的加重证据)。

### 7.4 观察点

拒绝错误的精确文案/exit code(回填时可作为判据锚);未拒时是否 fork 新会话还是写入原会话。

### 7.5 evidence 字段采集法

`claudePResumeRejected`=步骤 3(期望 true)。

### 7.6 抽取规则(附录 A 表 7)

`resume_attempt{rejected}`、`desktop_pollution_check{polluted}`。

### 7.7 expected 模板 / timeoutMs / fallbackOnFail

- expected:`resume_attempt{rejected:true}`→`desktop_pollution_check{polluted:false}`(附录 B 表 7)。
- `timeoutMs`: 120000 [default]。
- `fallbackOnFail`: `"resume_isolation_broken: design change required — v3 resume path must add own guard against concurrent desktop-open session takeover (spec §4.6 回改)"`。

### 7.8 回滚

删除合成会话;无其它状态。

### 7.9 计费

**若未被拒**,该 `claude -p` 调用消耗一次订阅额度(F12:OAuth 下走订阅;执行前核验无 `ANTHROPIC_API_KEY`,防按量计费)。单次、最小 prompt;run card 必批。

---

## 8. P0A-8:UDS proxy 先行探针(0B 前置;零计费)

### 8.1 目的与回填目标

现 proxy 为 TCP WebSocket(F2;【代码】src/codex-adapter.ts:472-505);`codex --remote unix://PATH` 的 handshake/reconnect/stale-socket/rollback 全链路(architecture §15-8:CLI parser 接受 ≠ 链路可用)。回填:Phase 0B 迁移前置(architecture §16;**跳过则 0B 不可执行**)。evidence=`UdsProxyEvidence`。

### 8.2 前置

本机 agent-bridge daemon(legacy 通道,P0-0 基线内工具);`codex` CLI 固定版本;探针脚本:在 UDS 路径上起最小 socket server 转发到 daemon(或 daemon 直接监听 UDS——按当时实现能力,探针形态记入 artifact)。**零模型调用**:探针只验传输层(handshake 帧/重连/坏 socket 文件/回退),不发 prompt。

### 8.3 逐步操作

1. handshake:`codex --remote unix://<path>` → 观察连接建立与协议 handshake 帧完成(`handshakeOk`)。
2. reconnect:kill 服务端 socket → 重启 → 客户端重连行为(`reconnectOk`)。
3. stale-socket:留下无进程监听的 socket 文件 → 客户端行为(明确错误/清理=`staleSocketHandled:true`;挂死=false)。
4. rollback:切回 `ws://127.0.0.1` 配置 → 链路恢复(`rollbackOk`)。

### 8.4 观察点

① handshake 是否与 ws:// 行为等价;② 重连的退避与恢复窗口;③ stale socket 的错误形态;④ 回退无残留。

### 8.5 evidence 字段采集法

四布尔=步骤 1-4。

### 8.6 抽取规则(附录 A 表 8)

`uds_handshake{ok}`、`uds_reconnect{ok}`、`stale_socket_probe{handled}`、`rollback_probe{ok}`。

### 8.7 expected 模板 / timeoutMs / fallbackOnFail

- expected:`uds_handshake{ok:true}`→`uds_reconnect{ok:true}`→`stale_socket_probe{handled:true}`→`rollback_probe{ok:true}`(附录 B 表 8)。
- `timeoutMs`: 300000 [default]。
- `fallbackOnFail`: `"phase_0b_blocked: keep ws://127.0.0.1 experimental compat path; UDS migration not executable (architecture §16 Phase 0B)"`。

### 8.8 回滚

删探针 socket/脚本;daemon 配置回 ws://(步骤 4 已验证)。

---

## 9. P0A-9:HostTurnBoundary(turnId 证明/prompt_epoch)

### 9.1 目的与回填目标

宿主是否暴露**可信 turn 边界**(architecture §15-9;现 `turn_id` 恒 null——【代码】control-protocol.ts:46、claude-adapter.ts:512)。回填:spec §4.10 per-turn root 启用、§10.1 HostTurnKey/eventRef、4043 reserved→可达。evidence=`HostTurnBoundaryEvidence`(tagged union,spec §14.2)。

### 9.2 前置

- **producer 候选冻结先行**:执行前先在当时宿主版本上排查候选 producer 并**书面冻结一支**再采样(union 判支字段 `producerFrozen`):
  - `host_turn_id` 支:宿主 hook/事件 payload 中存在宿主铸造的 turn 标识(当前无,F/代码锚;若新版本出现则走此支);
  - `prompt_epoch` 支:以 UserPromptSubmit 事件为 turn 边界信号、桩(模拟 broker)铸造单调 epoch(spec §10.1);
  - 两支皆不可成立 → `{producerFrozen:"none"}` → 谓词恒 FAIL(per-turn root 不启用,保守正确)。
- 探测桩:hook(UserPromptSubmit/Stop)+本地 epoch 记账脚本(持久化文件模拟 broker 单调性)。**相位定义(spec §14.2 轮 58 P0-1:含宿主重启与 reconnect)**:`pre_restart`/`post_restart` = **宿主(Desktop/CLI host)实例重启**前/后的同 turn 观测(强退/重启宿主,经 resume 回到同一 rs_)——**桩进程自身重启不构成相位**(那只是采集器健壮性);`reconnect` = 不重启宿主、断开重建桩↔宿主观测通道后的到达。

### 9.3 逐步操作(按 §9.2 冻结的支执行;三支各自协议如下)

**prompt_epoch 支**(spec §14.2 HostTurnBoundaryEvidence 第三支):

1. 同 turn 组:一个 host turn 内让桩多次收到事件(hook 多触发点/同 turn 重放渠道——可行渠道本身是观察点)→ 每次记一条 sample `{observedEventRef, phase, assignedEpoch}`;组内相位各覆盖(§9.2 定义:`pre_restart`=宿主重启前/`post_restart`=**强退或重启宿主实例、resume 回同一 rs_ 后**/`reconnect`=不重启宿主重建观测通道;spec §14.2:缺相位=派生 false)。**宿主重启证明**:每个样本临采集时向 artifact 记一行 `host_instance{instanceId}`(宿主实例标识,如 PID+进程启动时间组合;**不在抽取允许集,不入 observed/模板**)——`producerFrozen=prompt_epoch` 的 **PASS** evidence 必须含 ≥2 个两两不同 `instanceId` 的 `host_instance` 行(validate.py **HOSTRESTART 门**),证明采集实际跨宿主实例;无法证明宿主重启或无法保持同一 rs_ → 相位覆盖不成立、派生值 false(evidence 落 FAIL/INCONCLUSIVE)。每组完成后 artifact 记一行 `same_turn_group_done{phasesCovered}`(§9.6 canonical 串)。
2. 跨 turn 样本:≥2 个不同 host turn,每样本记 `{observationOrdinal(实际观察序,组内 UNIQUE), hostTurn, observedEventRef, assignedEpoch}` 入 detail,artifact 各记一行 `cross_turn_sample{}`。
3. 派生布尔由 harness 从样本算(`eventRefStableAcrossRestart`/`eventRefUniquePerTurn`/`epochMonotonic`——**不自报**,spec §14.2);算毕 artifact 记 `derivation_done{}`。

**host_turn_id 支**(spec §14.2 第二支;字段集不同,非「结构同型」——样本是宿主铸造 turnId 的原值观测):

1. 同 turn 组:一个 host turn 内捕获**≥2 次**宿主事件到达,每次记 payload 中宿主铸造的 turn 标识原值 → 组 sample = `[observedTurnId, …]`(字符串数组,≥2);组 `{hostTurn, samples}` 入 detail(≥1 组);每组完成后 artifact 记一行 `same_turn_group_done{phasesCovered:"n/a"}`(此支无重启相位维度;稳定性=同组 samples 全等)。
2. 跨 turn 样本:≥2 个不同 host turn,每 turn 记一条 `{hostTurn, observedTurnId}` 入 detail(hostTurn 两两异),artifact 各记一行 `cross_turn_sample{}`。
3. 派生布尔由 harness 算:`turnIdStableWithinTurn`(=∀组 samples 全等 ∧ 存在组 size≥2)/`turnIdUniqueAcrossTurn`(=crossTurnSamples 的 observedTurnId 两两异 ∧ size≥2)——**不自报**;`trustedProducerChannel` 记录该 turnId 是否经认证 first-party 通道到达。artifact 记 `derivation_done{}`。

**none 支**:两候选支书面排查均不成立 → detail=`{producerFrozen:"none"}`,artifact 仅记 `producer_frozen{producer:"none"}`(expected 模板 P0A-9.c);谓词恒 FAIL(per-turn root 不启用,保守正确)。

### 9.4 观察点

① 同 turn 多次到达的可行渠道与其可信性(trustedProducerChannel:经认证 first-party 通道?);② 重启后 eventRef 恒等性;③ 跨 turn 唯一性;④ epoch 单调性。

### 9.5 evidence 字段采集法

按 union 支逐字段(spec §14.2 HostTurnBoundaryEvidence);样本数组原样入 detail;派生布尔 harness 算。

### 9.6 抽取规则(附录 A 表 9)

`producer_frozen{producer}`、`same_turn_group_done{phasesCovered}`(phasesCovered=组内相位**去重后按枚举序 `pre_restart < post_restart < reconnect` 以 `+` 连接**的 canonical 串,如 `"pre_restart+post_restart+reconnect"`;host_turn_id 支恒 `"n/a"`;harness 从 detail 组样本重derive 并与 observed 比对)、`cross_turn_sample{}`(每样本一行,只记发生;行数须等于 detail crossTurnSamples 条数)、`derivation_done{}`。**注**:`host_instance{instanceId}` 行(§9.3)仅供 HOSTRESTART 门读取,不在本允许集——不入 observed。

### 9.7 expected 模板 / timeoutMs / fallbackOnFail

- expected(prompt_epoch 支=模板 `P0A-9.a`):`producer_frozen{producer:"prompt_epoch"}`→`same_turn_group_done{phasesCovered:"pre_restart+post_restart+reconnect"}`→`cross_turn_sample{}`×2→`derivation_done{}`;host_turn_id 支=模板 `P0A-9.b`(`phasesCovered:"n/a"`);none 支=模板 `P0A-9.c`(仅 `producer_frozen{producer:"none"}`,谓词恒 FAIL——用于如实登记「两支皆不成立」的 run)。
- `timeoutMs`: 300000 [default]。
- `fallbackOnFail`: `"per_turn_root_disabled: stay conservative session-scoped root (architecture §6.6/§15-9; spec §4.10)"`。

### 9.8 回滚

删桩 hook 与 epoch 记账文件。

### 9.9 计费

需真实 turn 产生边界事件(≥2 turn),低额;可与 P0A-1/P0A-6 批次搭车;run card 汇总批。

---

## 10. P0A-CB:context-basis 三问(contextMode=current 前置)

### 10.1 目的与回填目标

spec §14.1 P0A-CB 三问逐字:①current 的 context basis 算**什么字节**(**禁 transcript**:broker 无读 transcript API,spec §4.2/F10);②**谁算** contextDigest(禁 broker);③caller **如何取得** expectedBasis。三问任一无解 → current v1 保持 [UNSUPPORTED](spec §9.1 保守解)。回填:spec §9.3 contextDigest 来源、§9.2 current profile 开放前置、4052。evidence=`ContextBasisEvidence`。**PASS 仅是开放合取一项**(另需 architecture §6.2 A-6 修订 APPLY+feature `context_current_v1`+用户 DS-3 裁决,spec §14.3)。

### 10.2 前置

P0A-1 的探测桩(hook 通道);候选 byteSource 排查表(**candidate 枚举开放,transcript 源恒 unsolved**):`prompt_history`(hook 可见的 prompt 原文?载体与完整性待查)/`other_named`(发现即命名记录)。

### 10.3 逐步操作

1. 问①:枚举当时宿主 hook/API 面上可确定性获得的「上下文字节」候选;对每候选记 `{kind, locator, 完整性判断依据}`;无候选或仅 transcript → `resolution={kind:"unsolved"}`,结束。
2. 问②:对选中候选,确定 digest 生产方(adapter/host;**禁 broker**)与传输通道(`authenticated_control_channel`/`host_hook_v1`)。
3. 问③:验证 caller 在 submit 前取得 expectedBasis 的实际路径(`host_provided_at_prompt_verified`;须 typed carrier evidence:carrierEventRef/authChannel/obtainedAtBeforeSubmit/callerReceivedDigest,spec §14.2)。
4. 采样:固定一段 basis 字节 → 按 normalization 封闭规则(spec §14.2:raw/utf8/utf16le×jcs_v1/none)算 `sampleDigest`=`AB-CANON-1("AgentBridge/ContextBasis/v1", {byteEncoding, canonicalization, normalizedBytesB64})` → caller 侧实收 digest 比对。
5. `threeQuestionsAllAnswerable` 由 harness 按 spec §14.2 封闭合取派生(**不自报**)。

### 10.4 观察点

① 候选字节源的确定性(同 prompt 重放是否同字节);② 生产方通道可信性;③ caller 获取时点(必须 submit 前);④ digest 跨实现复现。

### 10.5 evidence 字段采集法

`resolution` union 按 spec §14.2 逐字段;`sampleBasisBytesB64` 用**合成 prompt**(零用户真实数据,§0.4)。

### 10.6 抽取规则(附录 A 表 10)

`byte_source_probe{found, sourceKind}`、`digest_producer_probe{producer, transport}`、`caller_obtain_probe{protocol, beforeSubmit}`、`digest_replay_check{match}`、`resolution_done{resolutionKind}`。另:artifact 须含**恰一行** `kind="carrier_tuple"`,`data`=obtainCarrier 四字段逐字(`carrierEventRef/authChannel/obtainedAtBeforeSubmit/callerReceivedDigest`)——**不入 observed**(含不可预知值),由 harness 单独重抽并与 `detail.resolution.obtainCarrier` 全 tuple 比对(spec §14.2 轮 60 P1-5)。

### 10.7 expected 模板 / timeoutMs / fallbackOnFail

- expected(solved 期望):`byte_source_probe{found:true,sourceKind:"prompt_history"}`→`digest_producer_probe{producer:"host",transport:"host_hook_v1"}`(**`adapter`/`authenticated_control_channel` 组合亦 PASS**,同 §5.7 处理)→`caller_obtain_probe{protocol:"host_provided_at_prompt_verified",beforeSubmit:true}`→`digest_replay_check{match:true}`→`resolution_done{resolutionKind:"solved"}`(附录 B 表 10)。**模板覆盖为有意收窄**:spec §14.2 允许的 `byteSource.kind="other_named"` 及其余 producer×transport 合法组合**不在本版模板内**(templated=准备接受的组合;真实探测落在未模板组合 → observed≠expected=INCONCLUSIVE,按 §0.6 修订模板+版本号后重跑,不现场即兴放行)。
- `timeoutMs`: 300000 [default]。
- `fallbackOnFail`: `"current_stays_unsupported: contextMode=current v1 remains [UNSUPPORTED] (spec §9.1 保守解; 4052 context_basis_unsupported)"`。

### 10.8 回滚

同 P0A-1 桩回滚。

### 10.9 计费

需少量真实 prompt(采样+重放),低额;可与 P0A-1 批次搭车;run card 汇总批。

---

## 11. run card 模板与计费敏感项汇总

```text
RunCard {
  probeId, runbookVersion, hostMatrix(计划),
  billingSurface: "none"|"low_turns(<=N)"|"explicit",   # 预计计费面(见下表)
  authSourceRequired: "subscription",                    # P0A-4 硬性;其余项亦禁 API-key env
  preconditionsChecked: [string],                        # §0.2/§0.3+各项前置逐条
  abortConditions: [string],                             # 中止条件(authSource≠subscription/宿主升级/隔离破坏)
  userApproval: <用户批准记录:会话内原文引用>            # 审批只认用户本人
}
```

| 项 | 计费面 | 说明 |
|---|---|---|
| P0A-1 | none(设计上) | 唤醒判据若需模型 turn 则升级重批(§1.9) |
| P0A-2 | none~1 turn | 新 task 创建若强制起 turn(§2.9) |
| P0A-3 | low(≤2 turns) | 与 P0A-2 合并批次(§3.9) |
| **P0A-4** | **≥2 turns,explicit** | run card 必批;authSource 三查(§4.9) |
| **P0A-5** | 与 P0A-4 合并=0 增量 | 单独执行 1 turn(§5.9) |
| **P0A-6** | low(2-3 turns) | (§6.9) |
| **P0A-7** | 单次(仅未拒时消耗) | 执行前核无 ANTHROPIC_API_KEY(§7.9) |
| P0A-8 | none | 纯传输层(§8.2) |
| P0A-9 | low(≥2 turns) | 可搭车(§9.9) |
| P0A-CB | low | 可搭车(§10.9) |

推荐批次(减总计费):批次 1={P0A-8}(零费)→ 批次 2={P0A-2,P0A-3}→ 批次 3={P0A-1,P0A-9,P0A-CB}(Claude 侧搭车)→ 批次 4={P0A-4,P0A-5}(Codex 计费批)→ 批次 5={P0A-6}→ 批次 6={P0A-7}。每批一张 run card。

---

## 附录 A:observed 抽取规则汇总表(extract.py 同表;§0.7 统一形式)

| 表 | probe | kind → 保留字段 |
|---|---|---|
| 1 | P0A-1 | `session_start_hook{}` `registration_decision{mappedRegistrationSource,generationDelta,credentialRolled}` `signal_write{}` `file_changed_hook{}` `wake_observed{}` `duplicate_session_start{behavior}` `coalescing_run{}` `recovery_scenario{scenarioKind,recovered}` |
| 2 | P0A-2 | `plugin_install{ok}` `plugin_enable{ok}` `old_task_tool_probe{toolVisible}` `new_task_tool_probe{toolVisible}` `hook_trust_prompt{accepted}` `plugin_upgrade{hashChanged}` `retrust_prompt{required,accepted}` `marketplace_refresh{behavior}` |
| 3 | P0A-3 | `shim_spawn{reachable}` `identity_probe{obtained,hostInjected}` `stability_check{phase,stable}` |
| 4 | P0A-4 | `mcp_handshake{ok}` `thread_started{}` `elicitation_captured{shapeCaptured}` `cancel_probe{cancelObserved}` `crash_restart_probe{sessionNotFound}` `auth_check{authSource}` |
| 5 | P0A-5 | `visibility_check{visible}` `navigation_check{works}` `drain_resume_check{behavior}` `dual_client_check{behavior}` |
| 6 | P0A-6 | `nudge_scenario{startEvent,hookFired,relativePhase}` `visual_check{position,persistence}` `queue_mode_check{mode}` `model_context_check{entersModelContext}` |
| 7 | P0A-7 | `resume_attempt{rejected}` `desktop_pollution_check{polluted}` |
| 8 | P0A-8 | `uds_handshake{ok}` `uds_reconnect{ok}` `stale_socket_probe{handled}` `rollback_probe{ok}` |
| 9 | P0A-9 | `producer_frozen{producer}` `same_turn_group_done{phasesCovered}` `cross_turn_sample{}` `derivation_done{}` |
| 10 | P0A-CB | `byte_source_probe{found,sourceKind}` `digest_producer_probe{producer,transport}` `caller_obtain_probe{protocol,beforeSubmit}` `digest_replay_check{match}` `resolution_done{resolutionKind}`(+`carrier_tuple` 专项行,不入 observed——§10.6) |

- 不在允许集的 kind(含 `env_snapshot`)一律不入 observed;保留字段缺失/类型不符=抽取失败(整条 evidence 拒收,fail-closed)。

## 附录 B:expectedStateSequence 精确模板

模板 JSON 单一 SSOT=`scripts/phase0a/expected_templates.json`(逐字复制入 evidence 的 `expectedStateSequence`;本附录不重复内联,防双源漂移)。每项模板 = `{"events":[…]}`,events 逐行对应各项 §x.7 描述;多合法值字段(§5.7/§6.7/§10.7 注明「亦 PASS」者)在模板文件中以**每合法组合一份变体模板**表达(`P0A-5.a`/`P0A-5.b` …),执行前按 run card 选定一份、evidence 里逐字用该份——**expected==observed 判等恒为严格深等,不引入通配**。

## 修订记录

- v0.1(2026-07-17):初稿(P0A-1..9+P0A-CB 全十项:前置/逐步/观察点/字段采集法/抽取规则/expected 模板/回滚/计费;通用规程 §0;run card §11;附录 A/B)。NOT_RUN 纸面,零探测结论。
- v0.4(2026-07-17;Codex 差分复核 r84(全程完成,REJECT P1×1+P3×1)修入):①**F1(P1)P0A-9 相位语义**——`pre_restart`/`post_restart` 明确=**宿主实例重启**前后(spec §14.2 轮 58「含宿主重启与 reconnect」;此前 §9.2/§9.3 写「桩进程重启」系单方收窄,**并更正 v0.2⑤「三支完整采集协议」过度声明——prompt_epoch 支当时未含宿主重启**);新增 `host_instance{instanceId}` artifact 证明行+validate.py HOSTRESTART 门(prompt_epoch PASS ⇒ ≥2 两两异 instanceId;不入抽取集,observed/模板不变);②**F2(P3)§1.7 字段名漂移**——`mapped=`→`mappedRegistrationSource=`、`recovery_scenario{kind:}`→`{scenarioKind:}`、duplicate 行为改述(P0A-1.b 已注册,实测 new_generation=更正 run card 选择重跑,非「修订模板」)。r84 其余判定:A1-A3 FIXED、B6-B8/B10-B12 FIXED、raw-source 双侧一致互换=纸面不可判定(定性,非 finding)。
- v0.3(2026-07-17;Codex 差分复核 r83 新 finding 修入——r83 载体被内容过滤终止,部分结果自 rollout 收割):①**JSON 类型级深等**(新 P0:Python == 混淆 bool/int,`{"ok":1}=={"ok":true}`)——strict_deep_equal 接入模板绑定/observed==expected/重抽比对/env/carrier/冻结矩阵全部比较点;②顶层非对象 evidence(`[]`/`null`/标量)不再裸 traceback(新 P1,报文渲染守卫);③P0A-1 raw source:RAWSOURCE 门(detail↔artifact 场景行逐行绑定)+两两异/hook 事件名同一关系约束+§1.5 纪律条(raw↔mapped 真值=探测输出,消费评审人工核)。
- v0.2(2026-07-17;Codex 红队 r82b REJECT(P0×6+P1×5+P2×1)全量修入):①§0.3 隔离要求撤销单方放宽——degraded_shared_profile 只可演练、evidence 不得 PASS(harness ISOLATION 门);②§0.4 isolation 封闭枚举+env_snapshot↔evidence 顶层交叉绑定(ENV 门);③§0.5 expectedStateSequence 模板绑定强制(TEMPLATE 门,自造/空 expected 不入门);④§1.7 修正与 §1.6 的 source 矛盾(session_start_hook{} 无保留字段);⑤§9.3 三支(prompt_epoch/host_turn_id/none)各自完整采集协议——host_turn_id 支非「结构同型」,none 支落模板 P0A-9.c;§9.6 phasesCovered canonical 枚举序;⑥§10.7 P0A-CB 模板覆盖=有意收窄声明(未模板组合=INCONCLUSIVE→修订模板重跑)+字段名对齐(sourceKind/resolutionKind);⑦配套 harness 同步:严格 CLI/重复 key 拒收/严格 base64url/allowlist 封闭 schema/P0A-1 身份关系(fresh: gen 0→1+rsBefore=''; rolling: 同 rs_+gen+1,spec §4.4)/全十项 detail↔observed(artifact 锚定)绑定/异常结构化归一/selftest 十项全链正例+CLI subprocess 负测。
