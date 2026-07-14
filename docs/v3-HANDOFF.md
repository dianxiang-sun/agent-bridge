# AgentBridge v3 设计 arc — 会话交接(HANDOFF)

> **生成**:2026-07-14,Claude + Codex 协作会话收尾(经 Codex 交接复审后修订)。
> **用途**:让下一会话(或 compaction 后的自己)不重读原始超长对话即可无偏移接续。
> **真值锚点(SSOT)= `docs/v3-architecture.md`(DRAFT v0.9,2026-07-15)**。本文是操作性快照;与设计文档冲突时以设计文档为准。
>
> ⚠**CURRENT LIVE ENTRYPOINT = §J.1**(2026-07-15)。下会话激活唯一入口是 **§J**;**§A/§B/§C/§D/§E/§H/§I 的状态与行动段均为 v0.5 时点历史快照**(其中 D-1..D-6"待决"、attention/verification"未机制化"、工作分支"feat/ops-hardening"等均已被 §J.2/§J.3 + architecture 推翻),以及下方旧「恢复顺序」均**勿据以起步/勿据以重开已定决策**。
> **恢复顺序(现行)**:直接读 §J(§J.1 激活 → §J.2 DONE → §J.3 待办 → §J.4 正式 apply 候选 → §J.5 教训),§J 会指引读设计文档哪些节。§I.3 证据台账、§I.6b 五仓 pinned SHA、§F/§G 仍有效。
> ~~旧恢复顺序(SUPERSEDED by §J.1,勿执行):①跑 §B 核验 ②读 §0 ③读 §B→§E→§F→§G ④读附录 A+§6/§8/§9/§11 ⑤§D→§I.1~~

---

## A. 这个 arc 是什么(一句话定位)⚠状态部分为历史(v0.5 时点);当前=DRAFT v0.9 committed,以 §J 为准

用户需求:让 AgentBridge 插件在 **Claude Code Desktop + OpenAI Codex 桌面 App** 都生效(含新开 session 自动生效),并新增**反向通信**(Codex 主动调用 Claude,`ask_claude`,同步拿结果);用户明确"可接受完全重构",要我们替他想到没想到的情况。经 Claude+Codex 多轮协作,产出方案 **B″** 的架构设计文档,现为 **DRAFT v0.9**(committed docs/v3-design 分支,未 push;⚠原文"v0.5 untracked"是历史,当前态与激活见 §J)。

---

## B. 状态锚 + 核验命令(接续前必跑)⚠SUPERSEDED BY §J.1(历史快照:下方 SHA/branch/HEAD/untracked 均为 v0.5 时点,勿据以核验;现行核验见 §J.1)

```text
架构文档 SHA-256 = 4631dad33d80c40d3d53cbbd34d53804064e2cf20c9006c52d6c5202e11bf2fd   # ⚠v0.5 历史,现 v0.9=4b4010942f…
架构文档行数     = 610(会随修订变;以 SHA 为准)
branch = feat/ops-hardening    HEAD = af46a4238e7d4f2296545025a58782791910681a
唯一 untracked(dirty)项:
  ?? docs/v3-architecture.md
  ?? docs/v3-HANDOFF.md
  ?? docs/v3-survey-evidence.md   # 附录A调研证据矩阵,2026-07-14 经用户 APPLY 写入(SHA 现场重算即可)
```

**⚠ 三份 v3 文档(v3-architecture.md / v3-HANDOFF.md / v3-survey-evidence.md)均未纳入 Git。禁止 `git clean` / `git checkout -- .` / `git stash -u` 等可能删除 untracked 文件的动作,等待用户 APPLY。** 本文自身 SHA 会随修订变,接续时现场重算即可。

核验命令(只读):
```bash
cd /Users/ds/code/agent-bridge
shasum -a 256 docs/v3-architecture.md          # 比对上面的 arch SHA
git status --short --branch
for n in 4 5 6; do gh pr view $n --repo dianxiang-sun/agent-bridge \
  --json number,state,baseRefName -q '"#"+(.number|tostring)+" "+.state+" base="+.baseRefName'; done
```

| 物件 | 路径 | 状态 |
|---|---|---|
| v3 架构设计文档 | `docs/v3-architecture.md` | **DRAFT v0.5**,untracked 未 commit |
| 本交接文档 | `docs/v3-HANDOFF.md` | untracked |
| arc 记忆 | `~/.claude/projects/-Users-ds/memory/agentbridge-v3-design-arc.md`(+ MEMORY.md 索引行) | 已全量更新为 DRAFT v0.5 / 9 轮(含 frontmatter) |
| 前身设计文档 | `docs/v2-architecture.md` | 既有;v3 保留其 rooms/registry/adapter/policy 骨架,推翻 SQLite 时序/pure-router 定位/MCP 工具面 |

**本 v3 设计 arc 未新建任何 commit/push/PR;整段协作 Codex 全程只读。**

---

## C. 本会话做完了什么(DONE)⚠v0.5 时点历史(会话 1 的 DONE;本 arc 全程 DONE 见 §J.2)

1. **调研现状架构**:通读 agent-bridge 代码 + `docs/v2-architecture.md`。现状 = **单 Claude attach 槽 + AgentBridge 管理的单 Codex TUI/app-server proxy(MITM 模型)**;执行 RPC 以 Claude→Codex `ask_codex` 为主,Codex→Claude 只有 message-plane/pull/可选通知,**无同步 `ask_claude`**。
2. **核实两侧桌面端扩展点事实**(本机探测 + 官方文档):16 条事实矩阵(设计文档 §2)。核心:`tui_app_server` 已 removed;**截至 2026-07-14 Codex 桌面无公开支持的既有 thread ingress**(→ 零点击注入当前线程,AgentBridge v1 官宣不支持,**这是快照非厂商永久事实**);Claude 侧唤醒 = `FileChanged+asyncRewake`(**E2E-gated,未实机验证**);同步 `ask_claude` 结果**仅当原 MCP invocation 仍存活且任务同步终结时**回原 Codex turn,否则走 SuspensionReceipt/授权恢复路径(双桌面往返仍 E2E-gated)。
3. **9 轮 Claude+Codex 协作设计**(过程见设计文档附录 B):独立分析→收敛+双向红队(定 B′)→盲区狩猎(双路独立清单对撞)→究极决策(定 B″)→起草→3 轮文档评审(v0.1→v0.4)→**究极复审三路翻案降级 v0.5**→交接复审。
4. **产出方案 B″ 设计文档**(结构见其目录):§0 定位/开放决策、§2 事实矩阵、§3 决策记录(DR)、§6 任务协议、§7 8 象限姿态表、§10 安全治理、§11 broker/SQLite、§13 五 invariant、§14 风险登记册、§15/§16 门禁与迁移、附录 A 调研关键词。
5. **v0.5 修订 + 轮 9 追修**:把可无歧义纠正的内部矛盾修掉(§0-C),需决策项列入 §0-B;轮 9 又追修 4 处确定性残留(result.nextAction/resumeAction/fenceToken/manual-claim 副作用措辞)。
6. **本交接文档**。

---

## D. 下一步(用户已选:选项 2)——下会话主任务 ⚠SUPERSEDED BY §J.2/§J.3(v0.5 历史:此"下一步"=调研任务,早已完成;当前下一步见 §J.4)

**同类仓库源码级调研找灵感**,按设计文档 **附录 A** 关键词分类,目的:(a) 给方向找灵感;(b) 用别人怎么解来对照 §0-B 的 D-1..D-6 与 §E 的 Round-8 backlog。

> **✅ 本任务已完成(2026-07-14):Claude 25 仓 + Codex 扩展轮 5 仓,交付 docs/v3-survey-evidence.md;
> 头号发现=MCP Tasks 被 SEP-2663 撤出核心(冲击 DR-8/§18-Q7,待定案轮处理)。下一里程碑见本节末段。**

- **必读优先(已确认存在的规范)**:MCP Tasks(modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks,experimental,与 §6 直接同构)+ A2A(Agent2Agent)task lifecycle。
- **候选搜索词(附录 A;存在性/canonical repo/活跃度/可比性均待核,勿预设为已验证同类仓库)**:claude-squad、claude-flow、tmux orchestrator、happy coder、omnara、vibe-kanban、codex mcp server wrapper/app-server client;Temporal/Restate/Inngest、transactional outbox、lease fencing token、effectively-once effects、saga/workflow versioning;socket activation、single-instance election、SQLite WAL multi-client、crash-only;object capability、macaroons、principal attestation、Cedar/OPA、confused deputy;closed-host conformance、record/replay fault injection、N-agent DAG fan-out/join、data lineage/retention。

**调研交付格式(每个候选仓库至少记录)**:canonical URL、固定 commit/date/license/活跃度、实现路径与 file:line、机制概述、对 D-1..D-6 + Round-8 backlog 的可参考解法映射、对 §6/§8/§9/§11 的 **adopt / avoid**、证据强度、未知项。**先广筛,再对少量高价值候选深读源码**。
**停止条件**:覆盖附录 A 各类别至少各 1-2 个高信号候选,且 D-1..D-6 每条都有"别人怎么解/无人解"的映射。
**硬约束**:E-1(README 不算证据,读实现);WebSearch 摘要对存在性/事实不可靠,用索引+源码核;**调研阶段不修改 B″、不填入开放决策、不替用户拍板、不编辑设计文档、不做任何 Git 写操作**。

**调研之后的下一个里程碑(不是本次)**:就 D-1/D-2/D-3/D-5/D-6 开一轮聚焦设计定案(我+Codex);**D-4 same-UID 信任边界须先取得用户裁决**(本轮调研按 in-scope / out-of-scope 两分支采证,不为此停工)。

---

## E. 还没做/待办(NOT DONE)⚠SUPERSEDED BY §J.3(v0.5 时点 backlog:此处 D-1..D-6"待决"、attention/fan-out/verification"未机制化"、Q7"开放"均已被 §J.3/architecture 推翻;当前待办对账见 §J.3-b。仅作 backlog 来源留存,勿据以重开已定决策)

### E-1. 载荷级开放设计决策(设计文档 §0-B,D-1..D-6)——需决策,v0.5 未擅自发明解

- **D-1** push 路径(默认 CodexWorker + Phase 1B legacy)的 token 生命周期:谁持 completionToken、谁判 succeeded/failed、谁调 complete_task(§6.2 只在 pull 的 claim 事务里铸 token)。【设计】
- **D-2** 人类审批路由:worker elicitation 的 submit_approval token 回到无权批准的 agent_rpc caller;人类在哪个 surface 批准、什么算 attestation。【设计+用户,安全边界】
- **D-3** effect-bound origin 强制。**验收边界(轮 8 攻击树,须一并封住)**:protected_paths 的 realpath/symlink/hardlink/rename/temp-file/间接 shell 写归一化;operationHash 绑定 canonical tool args + 目标 + preimage/worktree/generation;审批签发↔实际 effect 的 TOCTOU;guard/manifest/approval-secret/bypass-marker 本身也是 protected asset;self-approve 与 subagent delegation 对抗门禁。【设计+用户,关系稿件保护纪律】
- **D-4** same-UID 信任边界:防不防同用户的其它本地进程(现实现 daemon.ts:315-320 明确 same-UID 不在防御范围)。【**用户产品决策,优先**】
- **D-5** budget/loop envelope。**验收边界**:per-principal/installation/room 的 queue/bytes/concurrency/wake quota;retry maxAttempts+backoff+root 累积预算;fan-out child budget 分割与 join/cancel;attention 每小时上限的持久滑窗计数(防跨 session 绕过);context-token reserve/settle;provider quota 熔断 + ambient API-key 防误计费。开 API 计费时是 BLOCKER。【设计】
- **D-6** ask_claude 无 pinned dedicated session 时的行为(首个新装用户就撞)。【设计】

### E-2. Round-8 残余 backlog(轮 8 三路复审报出、尚**未机制化**——⚠ 别因风险表提过就当已设计)

- **attention 上限**:仅设计文档 §8.2 散文,无 policy 字段/默认值/持久 counter/gate。
- **fan-out `joinPolicy`**:仅风险表与调研词出现,任务协议无 fan-out API。
- **多 agent 伪独立共识**:仅风险短语,无 Result/ExecutionProvenance 字段(provider/model/context hash 降权)。
- **半升级协商**:仅"只禁反向 RPC"一句,无 min/max protocol、capability downgrade 规则、N±1 gate。
- **usage 归因**:仅 Console 承诺,无 UsageEvent/单位/置信度/root-child 归因。
- **`effectiveVerificationPolicy` 缺失**:CallerRequest 能请求 `verificationPolicy=none`,但 EffectivePolicySnapshot 无派生的有效值,§6.4 直接依据 request-side 字段——应由 broker 派生。
- **Claim/Complete conformance 缺口**:§15 门禁未明确覆盖 sibling ClaimOffer 竞态 / offer 单次消费 / ClaimSuccessReceipt 原子返回 / stateRevision↔eventSequence 分离 / 相同 completionOperationDigest 重放 + 异 digest conflict。
- **Day-one/Quickstart 未设计**(轮 8 Reader-Test 结论):安装、enable、hook trust/retrust、创建/pin dedicated session、pairing/unassigned、doctor/status 成功标准、首次 ask 的正常/suspension/denial UX、adapter gate 失败 fallback、disable/uninstall/rollback、计费与数据提示。**⚠ Phase 0 E2E ≠ 用户 onboarding 已设计**。
- **Windows**:仍是 §18-Q3,未明确 v1 macOS-only 或形成平台 primitives/gate。
- **需求 G1-G5 → 字段/phase/gate/fallback 追溯矩阵缺失**;注意需求 `G1..G5`(§1.1)与 smoke gate `G-1..G-4`(§15)易混,是两套编号。

### E-3. 后续协议规格交付项(设计文档 §0-A,本文档有意不覆盖)

控制协议 framing+注册请求/响应握手、sessionAuth 原语、每 shim 的 MCP 工具 schema、phase 转移表、存储 schema 列↔表映射、signal-file 格式、retryClass tool-manifest、contextMode=current 的 contextDigest 来源(+checkpoint/providedBundle 两模式 v1 须显式 unsupported 或补子系统)。

### E-4. 治理与实现

- commit / 开 PR 决策未定(§18-Q1:上游 RFC vs fork 演进)。
- **PR 依赖**:进入 **v3 实现前**(非只读调研前)须先处理 fork 的 stacked PR,顺序 **#4(base master)→ #5(base fix/bundle-sync-ci-gates)→ #6(base feat/lifecycle-hardening)**;截至 2026-07-14 三者均 OPEN(**动态状态,须带 `--repo dianxiang-sun/agent-bridge` 重查**);当前工作分支 `feat/ops-hardening` 正是 #6 的 head。**未获用户明确授权不得 merge/rebase/commit/push**。
- **§15 完整 Phase 0A E2E / gate suite + P0-0 兼容基线尚未执行**(事实矩阵里的静态与局部本机探针——plugin list、lsof、mcp-server stdio handshake 等——**不构成 gate pass**)。
- 其余开放问题 §18-Q2..Q7(broker 自动恢复承诺、Windows 范围、sidecar 计费 UX、Console 形态、ToS 法务、MCP Tasks 切换时机)。

---

## F. 硬约束、坑与教训(别重复踩)

1. **gh 多 remote 解析错仓**:`gh pr view N` 不带 `--repo` 会解析到**上游 raysonmeng 同号 PR**。查 fork PR 必须 `--repo dianxiang-sun/agent-bridge`。**本会话 Codex 曾据此误报"PR 已合并",被抽查纠回**——fork #4/#5/#6 仍 OPEN。
2. **本机 Codex `memories` 配置日内漂移**:2026-07-14 17:25 不可变 session 快照三项均 true,17:41 文件变更后均 false(mtime 证据;当前仍 false)。涉 memories 判断**当场重读**。
3. **多轮窄修的失明(方法论教训)**:v0.4→v0.5 翻案根因=§6 改三轮、§8.1/§9.2/§9.3/DR-7 表面签名与 push 路径没跟上。**多轮窄修后必做①跨节漂移检查②零背景冷读者实现测试**;"§6 内部自洽"审查对表面章节陈旧签名失明。且**交接文档本身也需复审**——本文初稿曾过度承诺"已修完所有矛盾"、漏 Round-8 backlog、§H 空白,被 Codex 交接复审抓回。
4. **审批不洗白是纪律核心**(对应用户 O-1/稿件保护;⚠2026-07-15 v0.9 更新,tombstone 旧 deny-only):反向 RPC 让 Codex 能驱动 Claude。协议把 agent 发起 task 标 `agent_rpc`、**永不升级 user**;Codex 转述"用户同意"/文本自称批准永不算审批。**受保护写现为两腿(v0.6 定案,推翻旧"一律 terminal denied")**:非-policy-control 受保护写(如稿件)可经 Approval Agent+exact operationHash 人闸每次精确一批(放行腿在 §15 G-5 全过前 hard-disabled,期间等效 denied);**policy-control 资产恒拒不可洗白**(只 open_admin_settings navigation-only,换 user-origin 亦拒)。权威=architecture §6.1 决策表 rule 1-7 / §10.1 / §J.2#2。**现有 approve.sh 无 principal 字段 + 回显审批命令 + agent 可创建 bypass marker = D-3 上线 blocker(v3 删该签发入口+废 bypass marker)**。
5. **Codex bridge busy/异常 ≠ 任务失败**:本会话 ask_codex 曾连续返回 busy,实际 Codex 已接住任务在执行(get_messages 抽到实时状态流)。busy 时先 get_messages 核盘,别盲目重发。
6. **"注入用户已打开的 Codex 桌面线程" = 截至 2026-07-14 平台不支持**(非设计缺陷,也非厂商永久事实):无公开 ingress(上游 #17543/#18056/#21779 均 OPEN,须重查)。别当 bug 反复挑。
7. **文档定位**:v3 是架构+决策文档,不是 wire 协议规格。§6 是规范意图单一真源,§8/§9 只引用不复述(复述=漂移源)。

---

## G. 已锁定不要 re-litigate 的决策(除非新证据显式推翻)

> 锁定 = 不凭偏好重议;但若 Phase 0 E2E、上游源码或实现证据**直接推翻前提**,记录证据并显式提请 reopen(尤其 `codex mcp-server`、`FileChanged+asyncRewake` 仍有门禁,不能让"锁定"覆盖可证伪性)。

- 总体方案 = **B″**(durable Task broker + 双侧插件分发 + dedicated-by-default + manual_claim_current + 分级 Codex worker)。A/C/D 已否;C 的对称双 headless 已否(仅取 Codex 侧 worker)。
- Codex 桌面接入 = **全局 MCP / Codex 插件体系**(非 `--remote` proxy 移植)。
- Codex 执行面分级 = v1 用 `codex mcp-server`,按需升级 app-server。
- Claude 侧反向唤醒 = `FileChanged + asyncRewake`(E2E-gated);Monitor 仅 CLI wake-hint;Channels 桌面判 unsupported。
- 迁移 = strangler,现有 CLI 工作流全程不断(P0-0 兼容基线每阶段护航)。
- broker 生命周期 = client-triggered 启动 + obligation-owned 存活。**边界**:v1 保证 durability,**不保证 autonomous liveness**——崩溃/OS 重启且无前台 client 时,任务等下一个 client 拉起后恢复(别把 LaunchAgent/socket activation 当既定承诺)。
- 5 条 invariant(I-1..I-5)、四层身份、SQLite 前置——保留。

---

## H. 下会话激活指令 ⚠SUPERSEDED BY §J.1(勿执行——历史)

> 原 §H 激活指令针对"附录 A 同类仓调研"任务,该任务已于 2026-07-14 完成(Claude 25 仓 + Codex 5 仓,证据入 docs/v3-survey-evidence.md)。**下会话激活见 §J.1(§I.1 亦已 SUPERSEDED)。**

---

## I. 会话 2 收尾(2026-07-14 晚)— 附录 A 调研会话增量 ⚠行动/状态段 SUPERSEDED BY §J(§I.3 证据台账/§I.6b 五仓 pinned SHA 仍有效)

> ⚠**§I.1 激活指令已 SUPERSEDED BY §J.1(2026-07-15),勿执行**;下会话唯一入口=§J.1。本 §I 仅 §I.3(证据台账)、§I.6b(五仓回源锚点)作为历史证据继续有效。
> SSOT 声明(历史):docs/v3-HANDOFF.md 为本 arc 唯一操作性交接文件(与设计文档冲突以 docs/v3-architecture.md 为准)。
> 写于 2026-07-14 · 本会话一句话:附录 A 同类仓源码级调研完成(Claude 25 仓 + Codex 独立扩展轮 5 仓=30 仓),证据矩阵落盘并经用户 APPLY 入仓;交接经 Codex 盲审 APPROVE-WITH-FIXES 已修。 · 自审:见 §I.A(激活唯一性/memory 同步等前置项在 APPLY 后转 PASS)

### I.1 激活 ⚠SUPERSEDED BY §J.1(勿执行——历史,下会话入口见 §J.1)

```
只读接续 /Users/ds/code/agent-bridge 的 AgentBridge v3 arc(未经用户本人 APPLY 不编辑文件、不做任何 Git 写操作):
1. 核验(全只读):
   cd /Users/ds/code/agent-bridge
   shasum -a 256 docs/v3-architecture.md docs/v3-survey-evidence.md   # 期望 arch=4631dad3…bf2fd(610行) 矩阵=待APPLY后重算
   git status --short --branch; git rev-parse HEAD                     # 期望 分支 feat/ops-hardening / HEAD af46a423
   # untracked 应含 v3-architecture.md、v3-HANDOFF.md、v3-survey-evidence.md 三个设计/调研文档;
   #   若还有别的 untracked/数目不符:先逐文件核 existence+hash+status、查因、问用户,勿预判"丢失/多余"、勿删。
   for n in 4 5 6; do gh pr view $n --repo dianxiang-sun/agent-bridge \
     --json number,state,baseRefName,headRefName \
     -q '"#\(.number) \(.state) base=\(.baseRefName) head=\(.headRefName)"'; done   # 动态,验 stacked #4→#5→#6
   本 handoff(docs/v3-HANDOFF.md)自身 SHA 会随修订变,现场重算即可,无固定期望值。
2. 读(按序):v3-architecture.md §0 全节 + DR-8 + §5/§6/§8/§9/§10/§11/§15/§18(Q1/Q7)
   → 本文件 §I(本段)+ §E/§F/§G
   → docs/v3-survey-evidence.md:必读 §1.13(Codex 扩展轮 5 仓,承载 D 映射增量)+ §2/§3(D-1..D-6 与 backlog 映射)
     ⚠§2/§3 汇总表尚未完全吸收 §1.13 的扩展轮结论(joinPolicy/crash-window/bounded-activation 等),别只读汇总表跳过 §1.13。
3. 然后按序两件事:
   a) D-4 裁决(用户在场,第一件事):用决策卡(≥3 候选)呈四档=①诚实不防(ssh-agent 式显式声明)
      ②peercred(仅排除其它 UID,不防同 UID)③token+文件权限(不隔离同 UID 内进程)
      ④关键审批过人(系统弹窗/Touch ID,只护被 gate 的 effect)+混搭。
      ⚠先裁决"same-UID 是否 in-scope",再对每档列 control/实际保障/残余风险/UX(四档没有哪档单独完整防住抢 task+伪 complete+DoS)。
      前提两条(须向用户点明其证据边界):
        · SPIRE 实证 macOS/Node·Electron 共享 runtime 下,可执行文件哈希证不了"是 AgentBridge shim"的 code identity
          (PID/process identity 本身可得;Bun 未核) —— 矩阵 §1.5/§1.13。
        · "最现实攻击者=被注入 agent 自己 spawn 的进程" 是 threat hypothesis,须请用户确认是否纳入威胁模型。
      证据=矩阵 §2 D-4 行 + §1.5(Tailscale/OpenSSH/Secretive)+ §1.13(SPIRE/D-Bus)。写入 v3-architecture.md 须 APPLY。
   b) 拿到 D-4 后:与 Codex 开 D-1/D-2/D-3/D-5/D-6 聚焦定案轮,议程必含 DR-8/§18-Q7 的 MCP Tasks 处置
      (证据=矩阵 §1.1;定性见 §I.3 第 5 行,勿裸写"Tasks 被取消")。产出=v3-architecture.md 修订 diff 提案,逐项等 APPLY。
禁区:未经用户本人 APPLY 不改任何 repo 文件/不 commit/push/merge;不凭偏好重议 §G 锁定决策;调研结论以矩阵为准
   不重做(要补仓另说);不替用户填 D-4;三个设计/调研文档保持 untracked 直到用户决定 commit(§18-Q1 未决)。
```

陈旧假设点名(恢复时重查,勿当既成事实):
- PR #4/#5/#6 状态、上游 issue #17543/#18056/#21779、Codex memories 配置(F14)均动态。
- **五仓的上游 HEAD 会前移**(Codex 已观测 Hatchet HEAD 从 d2560099 → 0dd175ca);回源**必须用 §I.6b 的历史 full SHA**,不能靠 `ls-remote HEAD` 相等。
- scratchpad 25 仓克隆与 Codex /tmp 五仓快照:收尾时存在,但**易失、非权威、下会话不保证存在**;若不存在,按 §I.6b full SHA + tarball SHA-256 重取。
- memory `agentbridge-v3-survey-evidence.md` 副本 = 矩阵的持久备份,内容以 repo 矩阵为准;矩阵的 Codex 修正 APPLY 后该副本需重新同步(见 §I.A memory 项)。

授权边界:$0(零预算);只读 + 浅克隆到 scratchpad 可自主;写 repo 文件 / commit / push / merge 一律逐项等用户本人 APPLY。

### I.2 当前 verdict 与状态(BLUF)

一句话:调研阶段闭环(停止条件全满足),arc 站在"证据齐备、等两个决策"——下一步赌 D-4 用户拍板 + D-1/2/3/5/6 定案轮把 v0.5 推向可写协议规格的 v0.6。

| 事项 | verdict | 证据等级 | 出处 |
|---|---|---|---|
| 附录 A 调研(Claude 25 仓,12 agent) | ✅DONE,引文抽查 12/12 过 | GOLD(亲核) | 矩阵 §4 |
| Codex 扩展轮(5 仓) | ✅DONE,我方 spot-check 4/4 + tarball 1/1 过 | GOLD(亲核) | 矩阵 §4 条目 13;§I.3 行 7 |
| 停止条件(附录 A 各类别≥1-2 + D 全映射) | ✅满足 | GOLD | 矩阵 §5 |
| MCP Tasks 旧 experimental runtime 从 core 删除+迁 Extensions Track | 提请 DR-8/§18-Q7 reopen,定案轮处置 | GOLD(SDK CHANGELOG 亲核) | §I.3 行 5;矩阵 §1.1 |
| D-4 same-UID 裁决 | ⏳PENDING 用户(四档框架已备,用户明示下会话拍) | — | §I.4 |
| D-1/2/3/5/6 定案轮 | ⏳未开始 = 下会话主任务 b | — | §D 末段 |
| 矩阵入仓 docs/v3-survey-evidence.md | ✅APPLY 完成,untracked | GOLD | §I.6a |
| §B/§D/§I 更新 + 矩阵补丁 | ✅APPLY 完成(§H tombstone + 恢复顺序 supersede + §B"三份" + §I 追加;矩阵 §0 补五仓/§4 方法/§3 joinPolicy/§6 锚点) | GOLD | §I.A |

### I.3 证据台账(仅本会话新增承重项;调研级证据全量在 docs/v3-survey-evidence.md)

| # | 声称 | 出处+复核指针 | 等级 | verified_at |
|---|---|---|---|---|
| 1 | 矩阵文件 APPLY 后 SHA-256=d6f5860789…399f(299 行;五仓 pinning 补丁已并入)。**本值为时点快照,若矩阵再改现场重算** | `shasum -a 256 docs/v3-survey-evidence.md` | GOLD(时点值) | 2026-07-14 |
| 2 | arch 文档本会话零改动(SHA 仍 4631dad3…bf2fd/610 行) | 开工+收尾两次 shasum + Codex 独立复核 | GOLD | 2026-07-14 |
| 3 | 工作树含三个设计/调研 untracked,HEAD af46a423 未动,零 commit/push(终态;全过程无写另有开工记录+操作禁令背书) | `git status --short --branch` + Codex 独立复核 | GOLD | 2026-07-14 |
| 4 | PR stacked:#4 base=master head=fix/bundle-sync-ci-gates;#5 base=fix/bundle-sync-ci-gates head=feat/lifecycle-hardening;#6 base=feat/lifecycle-hardening head=feat/ops-hardening;均 OPEN | `gh pr view --json …baseRefName,headRefName`(我+Codex) | GOLD(动态,恢复重查) | 2026-07-14 |
| 5 | **MCP Tasks:SDK v2 删除旧 experimental core runtime(TaskManager/experimental.tasks.*)并迁 Extensions Track=GOLD**;2026-07-28 draft schema 展示 `extensions` map 方向=**预发布 draft 快照**(CHANGELOG:252-255 明称 latest draft);SEP-2663 撤销**动机**未读=AMBER。**勿写成"Tasks 整体取消/废弃"** | typescript-sdk@e81758caed29 packages/server/CHANGELOG.md:262-263,252-255、wire/codec.ts:25-31、spec.types.2026-07-28.ts:840-851(我+Codex 各抽) | GOLD/AMBER 混 | 2026-07-14 |
| 6 | Codex 五仓 pinned full SHA + tarball SHA-256(见 §I.6b),我方独立核 dbus tarball SHA-256 逐字符吻合 + 4 处 file:line 抽查过 | §I.6b 表 + `shasum -a 256 /private/tmp/agentbridge-dbus-RBstK6/dbus.tar.gz` | GOLD | 2026-07-14 |
| 7 | 双路独立收敛:**D-1=broker 内部合成 claim/lease;broker 进程内 adapter 持 completion capability 并按协议 return/error 判 terminal;broker core 校验 fence/state**(非"broker 自行判业务成败") | 矩阵 §1.13 收敛段 + §2 D-1 行 | `[design-stage]`(调研级方向,D-1 仍 OPEN,未填决策) | — |
| 8 | D-6=typed policy 三分支 `require_pinned/activate_if_supported/soft_fallback`+D-Bus 有界 activation 树;joinPolicy=三字段 `{withinGroup,acrossGroups,outcomePrecedence}`(Hatchet 反例:业界非全留应用层) | 矩阵 §1.13 | `[design-stage]`(INFERRED,v3 推论非现成 API) | — |

#### I.3.x 本会话否决/废弃声称(防误导下会话;Codex 盲审补全守栏)

- ~~"唯一 untracked:两个"~~(§B 旧锚 + §H "两份 v3 文档"句)→ 实为三个;下会话见两个=丢文件、见四个=多余产物,均须停下核查(勿预判)。
- ~~"MCP Tasks 已取消/废弃/不存在"~~ → 否;仅旧 experimental **core runtime** 删除并迁 Extensions Track,未来 draft 与撤销动机仍需复核(§I.3 行 5)。
- ~~"SPIRE 解决了 macOS Node shim 身份"~~ → 否;只得 PID/liveness 缓解 + 共享 runtime 下的 executable selector,证不了 shim code identity;Bun 未核。
- ~~"DBOS dequeue 是 v3 claim / 普通 step 也 OAOO"~~ → 否;无 lease/token/fence;OAOO 仅覆盖同 application-DB session,普通 step 有 effect→record crash window。
- ~~"Hatchet 有通用 joinPolicy / pinned session / receipt ack"~~ → 否;只有 action-group algebra(组内 OR/组间 AND/固定 precedence)、worker-ID affinity;receipt ACK 仍 TODO,optional retry_count 会回填当前值(=v3 attempt 必填的反例)。
- ~~"Turmoil 默认 deterministic / 可直接测 UDS+native SQLite"~~ → 否;须显式固定 seed+epoch+host 顺序;UDS shim 仅 TODO;Rust FS shim 拦不了 Node/原生 SQLite syscall,真实 SIGKILL+SQLite gate 不可替代。
- ~~"D-Bus activation 可作 durable broker"~~ → 否;其 pending activation 是内存 hash/list;边界准确表述="server UID 的所有进程 + root 均被接受"(dbus-connection.c:5345-5347),非"除 root 外同 UID 全信"。
- ~~"toxiproxy -seed 有效 / Turmoil 示例方法存在"~~ → 均为负面结论,**仅锚定各自 pinned SHA**,上游可能已修。
- Codex 报告 "Current consensus"、我口头"倾向混搭第三种" = 调研级建议/个人倾向,**D-1..D-6 全部仍 OPEN,未填任何决策**;D-4 决策卡下会话完整重呈。

### I.4 Open questions / 下步选项

1. **D-4(用户拍板,下会话第一件事)**:四档见 §I.1-3a;关键=先定 same-UID in-scope 与否,再逐档评 control/残余风险/UX。前提两条须向用户点明证据边界(§I.1)。会话 2 我口头倾向"④混搭",已声明仅供参考、非推荐案。
2. 定案轮范围:D-1/D-2/D-3/D-5/D-6 + DR-8/§18-Q7(MCP Tasks)一并处置。
3. **§18-Q1(commit / 上游 RFC vs fork)仍未决**——三个 untracked 文档持续裸奔,下会话宜尽早向用户提一次(commit or 继续 untracked)。
4. ACP/AGNTCY 存在性双方均未核(矩阵 §5 诚实缺口)——定案轮若需再补,不自动展开。

### I.5 Codex 协作状态

- 扩展轮:chat_id=`v3-survey-ext-r1`,turn_completed,26 消息,≈21.5 分钟;Codex 受 `.git` 写禁令改用 commits API + 精确 SHA tarball + `git ls-remote HEAD` 复核(如实申报);内部 critic 两轮自审收窄多处(join 范围/ack 措辞/SPIRE 活性/DBOS dequeue/Turmoil 可重放)。
- 收尾盲审:chat_id=`v3-handoff-s2-review`,verdict=**APPROVE-WITH-FIXES**(独立复算 SHA/PR/五仓 pin+tarball 全过;发现假 PASS×3、五仓回源断链、joinPolicy 汇总矛盾等 15 条,本 §I v2 已逐条修)。
- 无单轨欠账;busy/timeout 未发生。

### I.6 工区与工件

#### I.6a 持久工件

| 路径 | 是什么 | 重跑命令 | 需授权? | 状态 |
|---|---|---|---|---|
| docs/v3-survey-evidence.md | 调研证据矩阵(本会话主交付,30 仓;含五仓 pinning §6) | `shasum -a 256 docs/v3-survey-evidence.md` → d6f58607… | 改:APPLY | green(APPLY 完成) |
| docs/v3-architecture.md | 设计 SSOT v0.5(本会话零改动) | `shasum -a 256 …` → 4631dad3… | 改:APPLY | green |
| docs/v3-HANDOFF.md | 本文件(§B/§D/§H tombstone/§I 全部 APPLY) | `shasum` 现场重算 | 改:APPLY | green(APPLY 完成) |
| memory/agentbridge-v3-survey-evidence.md | 矩阵持久副本(已从 APPLY 后矩阵重新同步,306 行含 frontmatter) | `wc -l` | 否(memory 可直接改) | green |
| memory/agentbridge-v3-design-arc.md | arc 记忆(frontmatter+正文已更新至会话 2 终态) | 读取即可 | 否 | green |
| memory/MEMORY.md | 索引(design-arc+survey 两行已更新至 30 仓) | 读取即可 | 否 | green |

last-validation:2026-07-14 收尾 `git status + shasum×3 + gh pr view×3`(我)+ Codex 独立复算(SHA/行数/HEAD/PR/五仓 pin+tarball)全绿。

#### I.6b Codex 扩展轮五仓回源锚点(持久化,防易失 artifact 断链)

| 仓 | canonical | full SHA(40) | commit date | tarball SHA-256 | license |
|---|---|---|---|---|---|
| spiffe/spire | github.com/spiffe/spire | 0f66c130b80f88a4d32247817037d187c7ee3f7c | 2026-07-09 | f8aeb96d22219ec70cce02b003512693892a7dd4173a71842cade91395ffc67d | Apache-2.0 |
| dbos-inc/dbos-transact-py | github.com/dbos-inc/dbos-transact-py | e9e351574b9a01aad62ead31bddb629fe1eb3e9c | 2026-07-13 | 42d45a4cc0800123503b2b6d11afe8c9a9e4bc94c40333bae2aa1743942afd82 | MIT |
| hatchet-dev/hatchet | github.com/hatchet-dev/hatchet | d25600995a8a14deab4b929ec99b6d51c3c7d362 | 2026-07-14 | e15ef6fb9ec67bddc022a08108867c51155caac854c8bdad303b48347105aeee | MIT |
| tokio-rs/turmoil | github.com/tokio-rs/turmoil | 481407d3bea1498e2f8259280b41986f392272fa | 2026-05-27 | cadec12993f1b6d2839a693bbd80181c6b467187892f82468c80fbfa0a807947 | MIT |
| dbus/dbus | gitlab.freedesktop.org/dbus/dbus | f64ae3cafdcf31606401171bb0e8fe3fccc761c2 | 2026-07-01 | d6176e52938315cd05843d00953077eaa535306f3b2346cb71ac3e8a375c91e7 | AFL-2.1 / GPL-2.0-or-later |

回源法(Codex 无 git 写权限时通用):commits API 取 full SHA → 下载该 SHA 的 tarball → `shasum -a 256` 比对上表 → 解包读实现。⚠上游 HEAD 会前移(Hatchet 已移),必须用上表 full SHA 不用 HEAD。

### I.A 自审记录

- [x] 时态漂移:逐"已完成"核证;新增守栏(§I.3.x)把设计推论与实证分开;0 条虚报 → PASS
- [x] 数字回源:25/12/5/4/1、277、SHA×3、五仓 full SHA+tarball(Codex 复算+我核 dbus)、12/12+4/4 全回原始输出 → PASS
- [x] 未持久化扫描:D-4 四档+残余风险、五仓 full SHA+tarball SHA-256、Codex 守栏、用户"不拍板"决定均已入 §I → PASS
- [x] 工件重跑:§I.6a 命令收尾已跑;dbus tarball SHA-256 独立重算吻合;易失项如实标注 → PASS
- [x] 台账同步:无 KILL/PARK(非 scout arc);memory design-arc frontmatter+正文、MEMORY.md 两行已同步;survey 副本待矩阵补丁 APPLY 后重同步(已在 §I.6a 标注)→ PASS(带一显式欠账)
- [x] canonical 锁:非投稿 arc;repo 锚=HEAD af46a423 + remote origin=raysonmeng/agent-bridge、myfork=dianxiang-sun/agent-bridge(防 gh 解析错仓)+ 三文件 SHA + 五仓 full SHA 已录 → PASS(改自原 N/A,Codex 建议采纳)
- [x] 激活唯一性+终局完整性:本 §I 为完整段;§H tombstone + 顶部恢复顺序第 5 步 supersede + §B"两份→三份" 已随 §I 同一次 APPLY 落地(2026-07-14)→ **PASS(APPLY 后转正)**
- [x] 激活段盲测(重大:终局收尾段+含 AMBER 承重+用户点名):零上下文 agent 只读 §I.1 复述状态/下一步/禁区 → PASS(裁决 PASS,5 个小断点:handoff SHA 无期望值/草稿态 §E-G 指代/F 编号歧义;v2 已改中性"决策卡"、点名"docs/v3-HANDOFF.md 现场重算无固定期望"、必读清单补 §18)
- [x] 教训回写:两条可复用规则已入 arc memory(Codex 无 git 写→API+tarball 等价 pinning;交接必持久化协作方易失 artifact 的回源锚点);无新 skill 级教训 → 写了
- [x] Codex 盲审:chat_id=v3-handoff-s2-review,APPROVE-WITH-FIXES,15 条已逐条处置(P0×3/P1×8/P2×4);裁决与我方独立核验一致 → PASS

---

## 附:本会话对话脉络(便于回溯,非行动依据)

需求澄清 → brainstorming → 现状调研 → 轮1 独立分析(确立全局 MCP)→ 轮2 收敛+红队(定 B′,发现审批 principal blocker)→ 轮3 盲区狩猎(双路清单对撞,定 5 invariant)→ 轮4 究极决策(steelman 幻影需求→修正低频真实,核实 Codex 插件+mcp-server,定 manual_claim_current,签 B″)→ 用户问"新增什么功能" → 用户问"B 缺口/C 为何最全/有无最优解"(答 Pareto,B″)→ 用户要整合文档 → v0.1 → 轮5 全文评审 → v0.2 → 轮6 定向终审 → v0.3 → 轮7 同范围复核 → v0.4(一度 REVIEWED)→ 用户要究极复审 → 轮8 三路复审翻案 → v0.5(DRAFT)→ 用户选"下会话继续"+ 要交接 → 轮9 交接复审 → 本文。

## J. 会话 3+4 收尾(2026-07-15)— D-4 裁决 + 定案轮 + v0.6 APPLY + v0.6→v0.9 全量终审【最新 LIVE 段】

> **SSOT 声明**:docs/v3-HANDOFF.md 为本 arc 唯一操作性交接文件。**本 §J 是唯一 live 段,下会话激活唯一入口=§J.1**;§H、§I.1、文件顶部旧「恢复顺序」均 SUPERSEDED,勿执行。§I.3 **仅其证据引文/SHA 有效,其 D-1..D-6 OPEN/status 判断已被 §J+architecture supersede**;§I.6b 五仓 pinned SHA、§F/§G(除本 §J 明示替换处)继续有效。
> **precedence(按信息类型分)**:决策/设计=用户最新明确裁决 > docs/v3-architecture.md 设计 SSOT > 本 handoff 摘要;操作激活=§J > §I/§H/顶部旧恢复段;调研事实=docs/v3-survey-evidence.md pinned 证据(不覆盖设计裁决)。
> 写于 2026-07-15 · 一句话:D-4 用户终裁 + D-1/2/3/5/6+MCP Tasks 定案(Codex 4 轮盲审)→ v0.6 落稿 APPLY → 全量多维终审(6 维度 agent + Codex 3 轮差分)补修至 **v0.9,Codex 三路独立 APPROVE=架构正文层可定稿**。

### J.1 激活(下会话第一步;§H/§I.1/顶部旧恢复段勿执行)

```
接续 /Users/ds/code/agent-bridge 的 AgentBridge v3 arc。设计已定稿到 DRAFT v0.9(架构正文层,Codex 三路 APPROVE),
下会话=「正式 apply」阶段。未经用户本人 APPLY 不编辑 repo 文件、不做任何 Git 写(push/PR/merge/commit)。

1. 核验(全只读;⚠本 handoff 落盘后 repo HEAD 会前移,故 architecture 基线用「最后修改它的 commit」核,不锁 HEAD):
   cd /Users/ds/code/agent-bridge
   git status --short --branch                                  # 期望 分支 docs/v3-design、工作树 clean
   git merge-base --is-ancestor fec2285 HEAD && echo ok         # 期望 ok(fec2285=architecture v0.9 终态基线,是 HEAD 祖先)
   git log -1 --format=%h -- docs/v3-architecture.md            # 期望 fec2285(architecture 最后修改 commit)
   shasum -a 256 docs/v3-architecture.md                        # 期望 4b4010942f20149e3d976946df953aac5811525e3ecc3d9027f934ae1003b5bc
   shasum -a 256 docs/v3-survey-evidence.md                     # 期望 d6f58607898d3a33919b83d4700ef1fb41ca213db8677d34c4c2384385ac399f(未动)
   wc -l docs/v3-architecture.md docs/v3-survey-evidence.md     # 期望 735 / 299
   sed -n '6p' docs/v3-architecture.md                          # 期望 状态行含「DRAFT v0.9(2026-07-15)」
   # docs/v3-HANDOFF.md 自身 SHA 随修订变,现场重算无固定期望值。
   for n in 4 5 6; do gh pr view $n --repo dianxiang-sun/agent-bridge \
     --json number,state,baseRefName,headRefName -q '"#\(.number) \(.state) base=\(.baseRefName) head=\(.headRefName)"'; done
   # 期望(动态,state/base/head 任一不符都停查因、勿预判):
   #   #4 OPEN base=master head=fix/bundle-sync-ci-gates
   #   #5 OPEN base=fix/bundle-sync-ci-gates head=feat/lifecycle-hardening
   #   #6 OPEN base=feat/lifecycle-hardening head=feat/ops-hardening

2. 读(按序):
   docs/v3-architecture.md:头部状态行 + §0-A 全节(交付清单,尤其 .8/.9/.10)+ **§0-B 决策记录并逐条跟读每个「→」落点**(D-1..D-6+MCP Tasks 的正文落点权威在此,勿另维护节号清单)
     + §6 全 + §10 全节(§10.1 两腿/§10.4 same-UID)+ §15 + §16 + **§18 全节(Q1..Q7)**;
   → 本文件 §J(本段)+ §F(硬约束/坑;⚠§F.4 已按 §J.5 更新为两腿语义)+ §G(锁定决策)。
   ⚠§0-A 交付范围 = architecture §0-A.1–.10(逐字为准)+ §J.3-b 的 carry-in wire 项;G1-G5 追溯矩阵是并行文档、不在 §0-A。J.3 仅摘要。

3. 「正式 apply」范围先向用户确认(§J.4 四候选,互不排斥可组合;不替用户选)。取得裁决后,对应产出仍逐项 propose→等 APPLY。

禁区:未经用户本人 APPLY 不改 repo 文件/不 commit/push/merge;不凭偏好重议 §G 锁定决策与 v0.9 定案;
  三文档保持 docs/v3-design 分支未 push 直到 §18-Q1 用户决;不把「正式 apply」自行窄化成某一条就动手。
陈旧假设点名(恢复重查):PR #4/5/6 状态、上游 issue #17543/#18056/#21779、五仓上游 HEAD(回源用 §I.6b full SHA)、Codex memories 配置(F14)均动态。
```

### J.2 本会话做完了什么(DONE,带证据)

| # | 事项 | 证据/锚点 | 等级 |
|---|---|---|---|
| 1 | **D-4 用户终裁**:same-UID(含被注入 agent 自 spawn 进程)显式 out-of-scope + ④混搭(peercred+token 零交互、受保护 effect 过人闸)+ 口径(人闸=O-1 纪律,对 same-UID 阻力副产品非安全承诺)。**裁决+威胁模型正文 DONE;⚠"须同时进 PEP/鉴权代码注释"(architecture §10.4)随实现 NOT DONE→见 J.3** | architecture §10.4 + §0-B D-4 | 用户拍板 |
| 2 | **用户追加裁决(受保护写两腿)**:非-policy-control 受保护写(如稿件)可经 Approval Agent+exact operationHash 人闸每次精确一批(放行腿 G-5 全过前 hard-disabled);policy-control 资产恒拒不可洗白(只 open_admin_settings navigation-only,换 user-origin 亦拒);agent_rpc origin 永不升级 user,文本自称批准无效 | architecture §6.1 决策表 rule 1-7/§10.1/§9.3/§15 G-4 | 用户拍板 |
| 3 | **D-1/2/3/5/6 + MCP Tasks(DR-8/Q7)定案轮**:Codex 独立出案(chat v3-finalize-r1)+ Claude 独立成案对撞,rebuttal R1-R4 收敛。**权威落点见 architecture §0-B 每条「→」;memory 仅会话背景** | architecture §0-B + §6/§10 | 双路收敛 |
| 4 | **三文档 commit 到本地分支** docs/v3-design(基于 master,**未 push**;仓在 push_gated_roots) | commit 7b96b98(v0.5 初提)→…→fec2285(v0.9) | GOLD |
| 5 | **v0.6 落稿 APPLY**:45 处编辑合并 4 层 delta 逐条落入 architecture.md | commit 0597bc0(+142/-42,610→710 行) | GOLD |
| 6 | **v0.6→v0.9 全量多维终审**:6 并行只读维度 agent(落锚保真/交叉引用/跨节漂移/安全不变量对抗/冷读者完整性/术语一致)+ Codex 独立全文对抗 + 3 轮差分复核。**逐版修复清单权威在 architecture 附录 B 轮 11–13 + 各 commit message**(不在此复制) | commit 3ab6ca3/848dac2/851809f·3cf420e·fec2285;architecture 附录 B:732-734 | GOLD |
| 7 | **终审头号 catch**:v0.6 落稿漏应用 v0.6-final 已批准的 D-1 §6.2/§6.4 两块→复发 v0.5 翻案根因,三路独立收敛抓出;v0.7 补回 | architecture §6.2/§6.4;附录 B 轮 11 | GOLD |
| 8 | **Codex 三路独立 APPROVE**:架构正文层可定稿(v0.9);安全不变量七大攻击面对抗未发现可利用绕过 | architecture 状态行 + 附录 B 轮 13 | GOLD |
| 9 | **memory 已真同步至 v0.9**:agentbridge-v3-design-arc frontmatter+首段墓碑+末段、MEMORY.md 索引均更新 | ~/.claude/projects/-Users-ds/memory/ | GOLD |

### J.3 还没做/待办(NOT DONE)

**J.3-a 下会话首选候选(见 J.4):** §18-Q1 治理 / §0-A 协议规格 / Phase 0A E2E / Phase 1A-1B 实现。

**J.3-b 旧 §E backlog 对账(防隐式丢项):**
- **已被 v0.6–v0.9 机制化(不再 open)**:attention 上限(§8.2 GCRA/TAT)、fan-out joinPolicy(§6.6)、effectiveVerificationSnapshot(§6.4/§6.2;broker-owned)、usage 归因(§6.6 TaskLineage/UsageEvent/usageQuality,wire 细节留 §0-A.10)、Claim/Complete 部分语义(§6.2/§6.4)。
- **wire 细节作为 §J.3-b carry-in 补充纳入未来协议规格(部分已在 §0-A.1–.10、provenance/追溯类未显式列入,须补)**:多-agent provenance/伪独立共识 hash 字段、Claim/Complete 专项 conformance schema、半升级/capability downgrade wire。**⚠需求 G1-G5→字段/phase/gate 追溯矩阵不是 wire schema,是并行文档交付物(不在 §0-A.1–.10)**。
- **仍开放(下会话可拾)**:§18-**Q2..Q6**(broker 自动恢复承诺/Windows 范围/sidecar 计费 UX/Console 形态/ToS 法务)、Day-one/Quickstart onboarding 设计、**Phase 0B 发布前置修正**(移除失效 `--enable tui_app_server`+UDS 探针后迁移,architecture §16)。**Q7**(MCP Tasks)处置规则已定(§18-Q7 五门槛),但「何时满足门槛并新增 Extensions Track adapter」是持续跟踪项、非已关闭。

**J.3-c 实现相关(须 §0-A 规格 + Phase 0A 过后):**
- Phase 1A Identity Kernel → Phase 1B Task Core。
- **D-4 代码注释义务**:same-UID out-of-scope 声明须进 PEP/broker/adapter 鉴权代码注释;peercred/token 不得描述成 same-UID security guarantee(architecture §10.4)。
- P0-0 兼容基线(ask_codex/reply/get_messages/abg-tmux/named-channel)每迁移阶段重跑。

### J.4 「正式 apply」四候选(下会话首件=向用户确认走哪条/组合;不替用户选)

| 候选 | 内容 | 前置 | 谁决 |
|---|---|---|---|
| ① 治理(§18-Q1) | 四态之一:push docs/v3-design / 开 PR / 上游 RFC / 继续 local | push 或 PR 须先按 #4→#5→#6 处理 stacked fork PR(architecture §17) | 用户 |
| ② §0-A 规格 | 把架构不变量细化为 wire 级协议规格(实现真正前置) | 无(可即起) | 设计+用户 |
| ③ Phase 0A E2E | §15 九项平台探测(尤其 HostTurnBoundary 身份来源=现 turn_id 恒 null) | 需实机/双桌面(涉计费/环境) | 用户授权 |
| ④ Phase 1A/1B 实现 | Identity Kernel + Task Core | ②③完成,**且用户授权并按 #4→#5→#6 处理 stacked PR 后**(architecture §17) | 用户 APPLY;实现方执行 |

推荐顺序(供参考非替决):②与③可并行起手(规格+探测互校),①随时可决,④压后。

### J.5 硬约束/坑/教训(本会话新增;§F 除此明示替换处继续有效)

1. **⚠大批量 Edit APPLY 后必须对 committed 字节重审**(本会话头号教训):v0.6 我把 45 处编辑合并落盘时漏掉 v0.6-final 已批准的 D-1 §6.2/§6.4 两块,**propose 对了≠apply 全了**;落稿后除残留扫,还须核「§0-B 声称落到某节的机制,该节正文是否真有」。
2. **修复会引入新漂移**:v0.7 修复引入 2 处新洞(rootAdmissionId 半贯穿、死 worker 回 READY_IDLE);每轮补修后必须再差分复核。
3. **单一 SSOT 本体必须完整,消费者只能纯引用**:最终收敛最后一项=§15 G-5 SSOT 本体漏 adapter、而 §10.1/§16 消费者复述清单致漂移。声称"单一 SSOT"时权威本体须含完整集合,新增成员时同时核「SSOT 本体 + 所有消费者均无副本」。
4. **gh 多 remote 解析错仓**:查 fork PR 必带 `--repo dianxiang-sun/agent-bridge`。
5. **不标 REVIEWED**:记取 v0.4 过早 REVIEWED 翻案;v0.9=「架构正文层收敛/APPROVE」,§0-A+Phase 0A E2E 未做前不进实现。
6. **Codex 引用须抽查**:本会话抽查 turn_id 实为 control-protocol.ts:46/claude-adapter.ts:512(文档原写 :45/:509,已改);每轮≥1 抽查。
7. **repo push_gated**:docs/v3-design 未 push 是有意(仓在 push_gated_roots),push 须用户 APPLY。
8. **§F.4 已更新(tombstone 旧 deny-only)**:旧文"所有受保护写→terminal denied"是 v0.6 前语义,已被两腿裁决推翻;当前=非-policy-control 可经 G-5 后 exact-effect 人闸放行、policy-control 恒拒(见 J.2#2 / architecture §6.1 决策表 §10.1)。保留的教训=agent_rpc origin 永不升级、文本自称批准无效。

### J.6 Codex 协作状态

- 定案轮:chat `v3-finalize-r1`(D-1/2/3/5/6+MCP Tasks 独立出案 + rebuttal R1-R4)。
- proposal 盲审:chat `v3-finalize-r2-review`(v1→v2.3,4 轮 REJECT→收敛,架构 P0 12→8→4→2→0)。
- committed 终审:chat `v3-final-audit-committed`(v0.6 全文对抗 + v0.7/v0.8/v0.9 三轮差分 → 三路独立 APPROVE)。
- 交接复审:chat `v3-handoff-J-review`(本 §J 落盘前复审,抓 future-HEAD/激活唯一性/memory 假 green/§F.4 冲突/§E backlog 漏项等,已逐条修)。

### J.7 工件

| 路径 | 是什么 | 状态 |
|---|---|---|
| docs/v3-architecture.md | 设计 SSOT,DRAFT v0.9(SHA 4b4010942f…,735 行) | green(commit fec2285) |
| docs/v3-survey-evidence.md | 调研证据矩阵 30 仓(SHA d6f58607…,未动)。⚠其正文 :5-6 仍写"untracked/v0.5",是生成时历史元数据,当前状态以本 §J/architecture 为准 | green |
| docs/v3-HANDOFF.md | 本文件(含本 §J live 段) | green(落盘完成) |
| memory agentbridge-v3-design-arc.md / MEMORY.md | arc 记忆(已真同步 v0.9) | green |
| Claude 临时(/private/tmp/.../scratchpad/,易失非权威):v0.6-final.md、v0.6-diff-proposal.md、v0.6-diff-proposal-v2.md、v0.6-diff-proposal-v2.1-delta.md、-v2.2-delta.md、-v2.3-delta.md、handoff-J-final.md | 定案轮提案史 + 本 §J 草稿 | 易失,下会话不保证存在;权威=repo commits + docs 正文 |
