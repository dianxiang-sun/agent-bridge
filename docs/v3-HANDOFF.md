# AgentBridge v3 设计 arc — 会话交接(HANDOFF)

> **生成**:2026-07-14,Claude + Codex 协作会话收尾(经 Codex 交接复审后修订)。
> **用途**:让下一会话(或 compaction 后的自己)不重读原始超长对话即可无偏移接续。
> **真值锚点(SSOT)= `docs/v3-architecture.md`(DRAFT v0.10,2026-07-17 封版)**。本文是操作性快照;与设计文档冲突时以设计文档为准。
>
> ⚠**CURRENT LIVE ENTRYPOINT = §S.1**(2026-07-20 会话 15 收尾起;**批次 2(P0A-2 单项)执行包 r109→r118 十轮对抗封版 SEALED(修复引入回归 17 例全 Codex 抓回;CD14=best-effort M1 monitor+用户裁边界;用户已裁路径 A);剩:用户填 userApproval(机器锚=matrix cardSha256 d6ecffd8…)→实机执行(用户在场)**)。下会话激活唯一入口是 **§S**(→ 工作台账 `~/Desktop/agentbridge_v3_apply_2026-07/ledger.md` 的**激活入口 v14**;v13 及更早 SUPERSEDED);**§A–§R 的状态与行动段均为历史快照**(§R 为会话 12 时点,已被 §S supersede),下方旧「恢复顺序」均**勿据以起步/勿据以重开已定决策**。
> **恢复顺序(现行)**:直接读 §S(§S.1 激活 → §S.2 DONE → §S.3 状态 → §S.4 NOT-DONE → §S.5 教训;**§K.4 授权口径与历代教训继续有效**)。§I.3 证据台账、§I.6b 五仓 pinned SHA、§F/§G(除后段明示替换处)仍有效。
> ~~恢复顺序(§J 时点,SUPERSEDED by §K,勿执行):读 §J(§J.1→§J.5)~~
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

## J. 会话 3+4 收尾(2026-07-15)— D-4 裁决 + 定案轮 + v0.6 APPLY + v0.6→v0.9 全量终审 ⚠SUPERSEDED BY §K(2026-07-15 会话 5;§F/§G 与 §J.5 教训除明示替换处继续有效)

> **SSOT 声明**:docs/v3-HANDOFF.md 为本 arc 唯一操作性交接文件。**⚠本 §J 已 SUPERSEDED BY §K(唯一 live 段=§K,激活入口=§K.1),勿按本段行动**;§H、§I.1、文件顶部旧「恢复顺序」均 SUPERSEDED,勿执行。§I.3 **仅其证据引文/SHA 有效,其 D-1..D-6 OPEN/status 判断已被 §J+architecture supersede**;§I.6b 五仓 pinned SHA、§F/§G(除本 §J 明示替换处)继续有效。
> **precedence(按信息类型分)**:决策/设计=用户最新明确裁决 > docs/v3-architecture.md 设计 SSOT > 本 handoff 摘要;操作激活=§J > §I/§H/顶部旧恢复段;调研事实=docs/v3-survey-evidence.md pinned 证据(不覆盖设计裁决)。
> 写于 2026-07-15 · 一句话:D-4 用户终裁 + D-1/2/3/5/6+MCP Tasks 定案(Codex 4 轮盲审)→ v0.6 落稿 APPLY → 全量多维终审(6 维度 agent + Codex 3 轮差分)补修至 **v0.9,Codex 三路独立 APPROVE=架构正文层可定稿**。

### J.1 激活 ⚠SUPERSEDED BY §K.1(勿执行——历史;§H/§I.1/顶部旧恢复段同为历史)

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

---

## K. 会话 5 收尾(2026-07-15)—「正式 apply」阶段:§0-A wire 协议规格起草 ⚠SUPERSEDED BY §L(§K.4 授权口径与 §K.5 教训继续有效)

> **SSOT 声明(历史)**:本 §K 曾为 live 段;现行 live 段=§L。
> **分层 SSOT**:架构=`docs/v3-architecture.md`(DRAFT v0.9,fec2285);**协议规格=`docs/v3-protocol-spec.md`(DRAFT v0.7.2,本会话经用户 APPLY「落盘」写入,与 `docs/gen_golden_vectors.py` 一起未 commit)**;操作台账+激活入口=`~/Desktop/agentbridge_v3_apply_2026-07/ledger.md`(14+ 轮 Codex 台账/Chunk 7 待办+P2 追溯矩阵/下会话激活指令,唯一激活入口,此处不复制防漂移)。
> 写于 2026-07-15 · 一句话:范围裁决(双路收敛,正式执行仅②§0-A 规格)→ spec Chunk 0+1 八轮对抗至 Codex 全路 APPROVE 定稿 → Chunk 2 五轮对抗高收敛 → 用户 APPLY 落盘 → 轮 14/14b 交接审计补修至 **v0.7.2**(N1-N5 待正式复核;N6=tombstone 正交化为封版 blocker)。

### K.1 激活(下会话第一步)

读 `~/Desktop/agentbridge_v3_apply_2026-07/ledger.md` 的「下会话激活(入口)」段并按其执行(唯一入口)。

### K.2 本会话 DONE(带证据)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | 范围裁决(双路独立→收敛):正式执行={②§0-A 规格};①治理=备忘录级(未做)③E2E=纸面探测包并入④不启动;禁区口径=Codex 任质量审核关,repo 写入/Git 写仍只认用户本人 APPLY | ledger Phase B;Codex chat v3-apply-r1-scope | 双路收敛 |
| 2 | **spec Chunk 0+1 定稿(Codex 轮 8 全路 APPROVE)**:§1 规范体系(NORMATIVE/E2E-GATED/USER-DECISION/G5-GATED/UNSUPPORTED 标签)+AB-CANON-1;§2 UDS+NDJSON-JSONRPC framing/握手/HandshakeProof/protocol feature 与 effectiveCapabilities 两层+authorize() 单一授权面;§3 sessionAuth;§4 四层身份+commitRegistration(RegistrationDecision/CredentialDelivery 分离)+retireGeneration 与 retireEndpointGeneration 级联+pairing/WorkspaceBinding ACL+approval bootstrap(EnrollmentPoP 稳定 challenge+Ed25519+EnrollmentRegistry)+HostSessionKey;§16 error registry **轮 8 基线=4000-4029+既有 domain**(4030/4031 与 IdempotencyScope 域属 Chunk 2 增量,随其待封版);附录 GV **7 条实算 golden vectors**(双方脚本实跑逐字节一致,stdout 锚 d80341b0…) | docs/v3-protocol-spec.md v0.1→v0.4.3 修订记录;Codex chats v3-apply-r2..r8 | GOLD |
| 3 | spec Chunk 2 高收敛未封版:§5 转移表(T1-T24+D1-D3/CAS 赢家/completion tombstone 双型/claim 两阶段交付/cleanup reducer 四分/janitor 域表)+§6 任务面存储映射(表清单/列 owner 着色/事务边界索引);轮 9-13 五轮红队(逐轮 P0 计数:R9=7、R10=5、R11=3、R12=5、R13=N1-N5[N1=P0,N2-N5=关键 P1],非单调,勿读成收敛箭头);**N1-N5 修案已写入(v0.7.1),轮 14 审计抓出 N1-N3 残留已补(v0.7.2),全部待正式差分复核;N6(tombstone revokeReason 正交化)=封版前 blocker** | 同上 v0.5→v0.7.2;Codex chats v3-apply-r9..r14 | 高收敛 |
| 4 | Codex 协作 14+ 轮全程 artifact+行号;我方抽查有锚记录=轮 1-3(各 3/3),GV 双方实跑一致=轮 4/5/6/14(其余轮以行号引用+逐条独立复核为主);轮 13 附交接状态一句话+起点清单 | ledger Codex 台账 | GOLD |
| 5 | **用户 APPLY「落盘」(本 §K 写入时)**:spec+gen_golden_vectors.py+本 §K 写入 repo 工作树;workspace proposal 副本已标 SUPERSEDED | git status(2 untracked+本文件 modified) | 用户拍板 |

### K.3 NOT DONE / 下会话

1. **首件=Codex 正式差分复核 N1-N6**(chat 前缀 v3-apply-r15;修法定位=spec 修订记录 v0.7.1/v0.7.2 条;N6=tombstone revokeReason 正交化,须先设计后审)。**复核前必读**:spec §5.1-§6.3 全文+architecture §6.1-§6.6/§8.1/§10.1,并跑 `rg -n 'T7b|T6b|pending_ack|activationReceipt|superseded|enterEffectReconcile|settleAttemptForRetry' docs/v3-protocol-spec.md` 自查残留 → APPROVE 后 Chunk 2 封版。
2. Chunk 3-7:§7 MCP 工具 schema(三面)/§8 retryClass manifest/§9 requestedContext/§10 预算 lineage 生命周期实体(migration 冻结前置)/§11 push-completion wire/§12 人闸 effect wire(G5-GATED)/§13 signal-file/§14 Phase 0A 探测包/§15 决策登记册/组装+冷读者+Codex 全文终审。
3. ①治理(§18-Q1)决策备忘录(四态对比,供用户裁决;push/PR 须先处理 fork #4/#5/#6)。
4. architecture 同步修订建议清单(claim_ack 步入 §6.2/§8.1、cancelling 双义措辞等——ledger「Chunk 7 待办」段)——属 architecture 修订,须用户 APPLY。
5. **Git 写全部未做未授权**:新增两文件+本文件修改保持未 commit,直到用户明示。

### K.4 授权口径(本会话用户裁决记录)

- 「你和 codex 全量深度无限轮全自动执行,codex 替我作为人工审核」= Codex 任**质量审核关**;repo 写入/Git 写仍属用户本人 APPLY 禁区(ICSE27 注入教训:审批只认用户本人)。
- 「落盘」(2026-07-15)= 批准 spec/脚本/§K 写入 repo 工作树;**不含 commit/push**。
- 「下会话继续以同样的形式自动执行」+「做好准备不要让本会话的信息漏掉」= 同工作流(起草→Codex 红队→修复→收敛)继续,含对已落盘 spec 的直接编辑,以及**交接维护性写入**(本文件 live 段 §K/后继段与 ledger 的更新——信息不丢失义务的载体);Git 写仍须另批。此解释已在会话 5 尾报告用户,如有异议以用户下次指示为准。

### K.5 硬约束/坑/教训(本会话新增;§F/§J.5 继续有效)

1. **wire 规格收敛速度差异**:身份/握手层 8 轮;状态机层(转移表)5 轮未竟——转移表类首稿必须自带 deadline fence/清理 reducer/自环边/两阶段交付,否则红队轮次翻倍。
2. **GV 实算+stdout 锚**是打掉「字节级不可实现」类 finding 的唯一手段;向量输入自身必须过规格自检(nonce canonical/长度曾被 Codex 抓)。
3. **Codex 同轮多路独立复核**对规格类产出收敛极快(每轮 verdict 交集稳定),优于单路多轮。
4. 修复引入新洞的模式在 wire 层同样成立(v0.3 PoP 自锁=修 v0.2 时引入);每轮修复后必须差分复核,与 §J.5#2 同型。

## T. 会话 16 收尾(2026-07-20)— 批次 2 G6 修复 SEALED v5 RESEAL:执行日两环境 bug+一自引入回归全抓全修,四轮 Codex 审【最新 LIVE 段】

> **SSOT 声明**:本 §T 为唯一 live 段;§S 及更早段 SUPERSEDED(§F/§G 锁定决策、历代教训、§K.4 授权口径继续有效)。
> 分层 SSOT:spec v0.12.19/architecture v0.10/Phase 0A 准备包/批次 1 r94/提案 v0.5 r105 封版不变;**批次 2 工件全集=`~/Desktop/agentbridge_v3_apply_2026-07/batch2/`(card 现 SEALED v5,314b7e47)**(APPLY 非 git);操作台账+激活入口=ledger「下会话激活(入口;**v15**)」段(v14 及更早 SUPERSEDED)。
> 一句话:会话 15 执行日首跑 setup 连撞两个 macOS 环境 bug(G5 sudoers NOTAFTER 格式/G6 command-less pane 经 login-zsh path_helper 重排 PATH),会话 16 修 G6 时首版(v4 单串 `/bin/zsh -f`)又引入自身 fail-open(第18例:外层 `$SHELL -c` 读 ~/.zshenv 可注入伪 clean PATH 骗过存在性断言)→**v5 终修=七 pane 全多 argv direct-exec(消除外层 shell)+G6 三断言唯一整行**;经**四轮 Codex 独立审**(交接盲审 858s→r121 1207s 抓第18例→r122 1525s 生产 CONFIRMED 无第19例+抓测试网 3 假PASS→r123 619s 测试网修复 A-F CONFIRMED)达 **READY-FOR-RESEAL-V5**。剩:用户 SEALED v5 明示 reapproval→sudo setup 重跑(全 6 门 PASS 预期)→driver --arm 实机(用户在场)。

### T.1 激活(下会话第一步)

读 ledger「下会话激活(入口;**v15**)」段并原样实跑其 fail-closed 核验块(v15 修盲审 A 三缺陷:精确 pin card 314b7e47/setup/watchdog+两 manifest 逐行,非 PIN_ONLY_FALLBACK)。⚠会话 14 曾 fabricate 一次工具输出——**每个 SHA/状态必须真实命令观察 function_result**。首件视用户动作:①已给 SEALED v5 reapproval(原文含 APPROVED+`cardSha256=d6ecffd8…`)→按 card §4 setup 重跑+实机;②未给→呈 reapproval 请求(变更摘要=card:3 v5 事由段)。

### T.2 DONE(带证据;会话 16)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | 入口 v14 核验块原样实跑 ALL_CHECKS_PASS+healthz tuiConnected:true | function_result 真实观察 | GOLD |
| 2 | 交接盲审(858s):HANDOFF-NOT-READY,六项(card r120 虚写/§S 过期/G6 范围叙述错/激活门缺陷等)全处置 | Codex 消息链;chat=v3-apply-s15-handoff | GOLD |
| 3 | G5 修复独立 CONFIRMED(visudo 双向复现,抵充未执行的 r120) | 盲审 C 项 | GOLD |
| 4 | G6 v4 首修(六 command-less pane 显式 /bin/zsh -f)+t6 六形态;方向 Claude 独立分析=Codex 盲审 D 两路收敛 | grep 核盘+t6 ALL_PASS | GOLD |
| 5 | **r121(1207s)抓 v4 第18例 fail-open**(单串经外层 $SHELL -c 读 .zshenv 注入);Claude 独立真机复现 | Codex 消息+scratch 复现 | GOLD |
| 6 | **G6 v5 终修**:七 pane 多 argv direct-exec+G6 三断言唯一整行;三形态(new-session/window/compound `\;`)真机抗注入实测 | grep 核盘七 pane+实测输出 | GOLD |
| 7 | r122(1525s):生产 A-D/F/H CONFIRMED **无第19例**+抓测试网 3 假PASS(t6-2 target/t6-8 oracle/t3 未 source-bind) | Codex 消息链 | GOLD |
| 8 | 测试网修复:t6 首窗-n cli1+keyed-set 唯一/t6-8 精确 2 行/t3:21/42 多argv/source-bound unit_r122;mutant 自验全抓 | 实跑+mutant 输出 | GOLD |
| 9 | r123(619s):测试网修复 A-F CONFIRMED(mutant 抓+生产四件零改动)+card 一处行号必修 | Codex 消息链 | GOLD |
| 10 | card SEALED v5 RESEAL(314b7e47)+生产四件 v5 零改动(driver 3d766120/setup c8a3774e/watchdog 8bc32026/frozen 98cf6b02) | 现场 shasum 实算 | GOLD |

### T.3 状态

1. **SEALED v5 SHA 锚(会话16 现场实算)**:card=314b7e4791365cdddbc4d8f88f882401e9bbc67a841ef8fda3a5ca5c33dab874;driver=3d76612003a24f090b07bc678becb28e18ae43e6d338136ccaa0f086f58625f0;setup=c8a3774e65ad45f96ee08d3faadc8c311d941b24ad56060caf64676aee95706b;watchdog=8bc32026aba4089aa7e68c82b56ed3b65aac20a7d459433982f70668b3779f6b;frozen_manifest=98cf6b021db1bc204f332eefe8565071dcbb4dc994c227cc22d9a81d7bf70f38;billing/matrix/sidecar/p0a8_manifest 四件不变。
2. **approval 态**:§9 matrix/canonical steps 零改动→machine-pin d6ecffd8… 不变,driver 批准门 PASS(重跑核实);但 **SEALED v5 改了 pane 起动语义(driver/setup 行为),进 setup/探测窗口前须用户对 v5 明示 reapproval**(治理点=盲审 E.5:approval 只绑 §9 matrix 不绑核心工件本体;审批只认用户本人原文)。
3. **G6 修复语义(最终口径)**:command-less tmux pane=login zsh→/etc/zprofile path_helper 重排 PATH;修复=七 pane(hl/bl/cli/p0a8+subject+watchdog cap+G6 自检)全多 argv direct-exec(tmux execvp 不经外层 `$SHELL -c`,内层 zsh -f 跳 ~/.zshenv;/etc/zshenv 不存在+abprobe 无 zsh 启动文件=零注入);G6 三断言唯一整行(拒多行/后缀/substring)。副作用记账:direct-exec 亦跳 LANG=C.UTF-8/history 设置(pane LANG unset,实测 Python/codex 编码无回归)。
4. 两次执行日 setup 均 fail-closed 全回滚,系统干净;零探测零计费;OUT_DIR 收权保留=设计内。
5. REPO:本 §T+§S 标记=本会话工作树改动,commit 待用户批(不 push;push-gated);链 …→14c31b0→93514c3。
6. [UNVERIFIED-RUNTIME] 四组不变(hook argv/--json schema/hooks list wire/rollout 键名)+新:v5 多 argv pane 在 abprobe 真实账户 G6 门首过(t6 为 ds 侧同构证据,执行日 setup G6=真实首验)。

### T.4 NOT-DONE(承接)

| # | 待办 | 性质 |
|---|---|---|
| 1 | **用户 SEALED v5 明示 reapproval**(变更=card:3 v5 事由段;誊入 reapproval_v5.md;含 pane 起动语义变化) | 用户本人动作;不代填 |
| 2 | sudo setup_abprobe.sh 重跑(全 6 门 PASS 预期;NOTAFTER 新鲜 now+3h;先归档现 G6-fail setup_run.log) | 用户 sudo+在场 |
| 3 | driver --arm 实机探测窗口(card §4;device-auth/s5 s7 trust accept/P0A-8 四步;W1-W3;窗口内零 ask_codex) | 用户在场 |
| 4 | UNVERIFIED-RUNTIME 四组首跑对齐(不符=fail-closed abort) | 执行日 |
| 5 | 执行后:evidence 消费评审(人工+Codex,窗口外)+HANDOFF 执行段+ledger v16 | 执行日 |
| 6 | 本 §T commit(docs/v3-design,不 push)+r98 残余/DS-3/batch1 evidence 入 repo/push——沿 §R.4 待用户 | 待用户 |
| 7 | 可选(r123 非阻断 hygiene):unit_r122 mkdtemp 清理/绝对 import→__file__/t6:86 || true | 可选 |

### T.5 教训(本会话新增;历代继续有效)

1. **纸面十轮抓不到宿主环境语义 bug**(G5 sudoers NOTAFTER 格式/G6 login-pane path_helper):selfcheck/单测/对抗评审全程绿,真机 setup 两连抓;执行日 G 门=纸面验证体系外的真实防线,fail-closed 回滚让失败零代价。环境断言类修复必配「负对照」回归(t6-1:宿主语义变化使前提失效则必 FAIL)。
2. **修复本身会引入同类新洞**(v4 单串 `/bin/zsh -f` 修 G6 却开外层 $SHELL -c 的 .zshenv fail-open=第18例):独立确认轮(r121)专抓;修复方向要抠到「构造保证 vs 当前观察」(多 argv execvp 消除外层 shell=构造保证)。
3. **生产正确≠回归网闭合**(r122:生产 CONFIRMED 但 t6-2 target 误投/t6-8 oracle 太松/t3 未 source-bind):防复发网必须 source-bound(直调真实调用点+mutant 证能抓),名不副实的测试(t6-2 测成 new-window)靠 mutant 暴露。
4. **账实声称随代码演进漂移**(card「t3:19/40」加注释后→:21/42;「八形态全绿」在 t6 假PASS 时过度):F2 纪律=每个 verified 声称都要对现盘复核,行号/覆盖度声称尤其易漂。
5. approval 机器锚只绑 canonical steps 使文本/工装可修而 approval 存续——但行为语义变化时机器门 PASS≠授权有效,须回用户 reapproval。

---

## S. 会话 13-15 收尾(2026-07-19/20)— 批次 2(P0A-2 单项)执行包:r109→r118 十轮对抗封版 SEALED;待用户 userApproval+实机【SUPERSEDED BY §T(会话16 G6 修复 SEALED v5)】

> **SSOT 声明**:§S 已 SUPERSEDED BY §T(会话16;live=§T);§R 及更早段亦 SUPERSEDED(§F/§G 锁定决策、历代教训、§K.4 授权口径继续有效)。
> 分层 SSOT:spec v0.12.19/architecture v0.10/Phase 0A 准备包/批次 1 执行包 r94/提案 v0.5 r105 均封版不变(锚见 ledger);**批次 2 执行包工件全集=`~/Desktop/agentbridge_v3_apply_2026-07/batch2/`**(APPLY 非 git);操作台账+激活入口=ledger「下会话激活(入口;**v14**)」段(v13 及更早 SUPERSEDED)。
> 一句话:批次 2 P0A-2 执行包经 **r109→r118 十轮 Codex 对抗/确认**(修复引入回归共 **17 例**,每例 Codex 独立抓回+复现变回归用例),CD14 从「机器证明 billing-none」诚实降级为 **best-effort M1 monitor+用户裁边界**;**用户已裁路径 A(接受 best-effort+批 card+实机执行)**;会话 15 fresh session 完成 r116(抓第 17 例 CD18-shlex fail-open)→r117→r118 **READY-FOR-SEAL** 确认链并 **card 封版(SEALED)**。剩:用户填 userApproval(机器锚=matrix cardSha256)→实机执行(用户在场窗口;UNVERIFIED-RUNTIME 项首跑验)。

### S.1 激活(下会话第一步)

读 ledger「下会话激活(入口;v14)」段并原样实跑其 fail-closed 核验块。⚠会话 14 曾发生一次 fabricate 工具输出(收束时编造 SHA 写入声明,Read 证伪)——**每个 SHA/状态必须真实命令观察 function_result**,恢复第一动作永远是核验块实跑非信任交接值。首件视用户动作而定:①用户已填 card §1 userApproval(原文含 APPROVED+`cardSha256=d6ecffd8daad115a8b779ca176ef5d673d6cae2f6f24368587baa8bc7b5a5103`)→按 card §4 时序准备实机(用户在场:sudo setup/device-auth/trust accept/P0A-8 y/n);②未填→催办或按用户新指示。

### S.2 DONE(带证据;会话 13-15 合并)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | 批次 2 执行包起草(P0A-2 单项;工装九件+driver+插件 v1/v2+本地 marketplace) | batch2/ 工件全集+ledger 会话 13 台账 | GOLD |
| 2 | P0A-3 scope 收窄决策件(desktop_restart_resume 宿主锚不匹配移出) | p0a3_scope_decision.md(7487f789…);批 card 即批收窄 | GOLD |
| 3 | r109(REJECT 24)→r110(REJECT)结构修订+执行链闭合 | r109_disposition_matrix.md 逐条处置 | GOLD |
| 4 | r111→r115 五轮深度红队:威胁模型 M1/M2 重定位/HOOKS-002 精确 argv/pane_run 根因/T11 installed/CD17/CD20/CD18/CD19/T13/T12 全处置 | matrix r111-r115 段;16 例回归全 Codex 抓回 | GOLD |
| 5 | **CD14 威胁模型演进定案**:机器证明→best-effort M1 monitor+用户裁边界(Codex r115「诚实可呈用户裁」) | card §5 三层+残余边界;USER_DECISION_BRIEF | GOLD |
| 6 | **用户裁路径 A**(billing-none best-effort 强度+P0A-3 收窄+自动化形态+实机批准四项一体) | 会话 14 用户原文;BRIEF 决策 1-4 | GOLD |
| 7 | 会话 15 恢复核验:入口 v13 块原样实跑 ALL_CHECKS_PASS | HEAD=14c31b0/三 SHA/selfcheck/9 单测真实观察 | GOLD |
| 8 | **r116 窄确认:CD19/T13/T12/doc CONFIRMED+抓第 17 例 CD18-shlex fail-open**(单测网盲区:异常分支) | Codex 复现 FAIL_OPEN_EXCLUDED=True;Claude 亲核亲跑属实 | GOLD |
| 9 | 第 17 例修复:CD18-shlex→StepAbort(A8/CD2 纪律)+docstring RETIRED 注+同型排查(probe_anchor/:456 轮询/billing 无 shlex)+tests/unit_r116.py 四用例 | 全套 10 单测 ALL_PASS+selfcheck OK | GOLD |
| 10 | **r117(A/C/D CONFIRMED,file-history 真实 diff 仅两 hunk+AST 零引用)→:98 末句修正→r118 READY-FOR-SEAL(逆向 diff 证单行)** | r116-r118 消息链+matrix 补记段 | GOLD |
| 11 | **card 封版 SEALED**:§10 全件真实 SHA 冻结+frozen_manifest.txt(43 行)+p0a8_manifest_frozen.txt(五件与 ledger 会话 11/12 零漂移) | 封版态 card SHA=849e56049e4f961d13414ee79634742dc95821263733f5907befa0d7a6f68524 | GOLD |

### S.3 状态

1. **封版 SHA 锚(会话 15 现场实算)**:card(userApproval 占位态)=849e5604…8524;driver=19fd03fbbd1dc118e65f6224296ab0247fd7013873f4a0b6f2e111462595863c;billing_probe=78bc09c3…4205e(未动);matrix=f6522c35…a6e3;frozen_manifest=81bdd606…461a;p0a8_manifest=51954959…e831;sidecar matrix 文件=d6fad77b…c6d2(其内 cardSha256=d6ecffd8…=**driver P16 机器批准锚**)。
2. **userApproval 机制(防歧义,r117 前发现)**:driver :1201-1204 核 approval 文件含 `userApproval`+`APPROVED`+`cardSha256=<64hex>` 且**等于 matrix 的 d6ecffd8…**——非 card 文件本体 SHA(自引用不可行)。card 文件封版态 SHA 只作人类审计锚(记 ledger v14)。
3. **billingSurface:none 定位(用户已接受)**:planned billingSurface:none, best-effort monitored;残余边界=CD14-006 I/O false-negative/operator window 单层退化/P0A-8 覆盖外/CD18 两点快照竞态(card §5 逐条)。
4. **[UNVERIFIED-RUNTIME] 实机首跑验**(不符=fail-closed abort,可用性风险非安全):hook 展开 argv 布局+版本化路径结构/`--json` schema(marketplace `marketplaces`/plugin `installed`)/hooks list wire 字段/rollout schema 键名。
5. s8 已裁两层口径①:local 分发无 refresh 路径→机器派生 `unsupported_for_local`∉spec 允许集→P0A-2 判 FAIL 作 F6 真实发现(批 card 即批口径)。
6. REPO 会话 13-15 零代码改动;本 §S 为唯一 REPO 改动(commit 待用户批,不 push;push-gated)。
7. P0A-8 isolated 转正=批次 2 执行日附带段(card §7 附录 A1;计费面=批次 1 口径,CD14 覆盖外)。

### S.4 NOT-DONE(承接)

| # | 待办 | 性质 |
|---|---|---|
| 1 | 用户填 card §1 userApproval(原文含 APPROVED+cardSha256=d6ecffd8…) | **用户本人动作;审批不代填** |
| 2 | 本 §S commit(docs/v3-design 分支,不 push) | 待用户批 |
| 3 | 实机执行(card §4 时序:sudo setup/device-auth/trust accept 操作窗/P0A-8 四步 y/n+driver --arm 双闸) | 需用户正式批+在场窗口 |
| 4 | UNVERIFIED-RUNTIME 四组实机首跑对齐 | 执行日;不符=abort 非假 PASS |
| 5 | r98 建议残余(④FAIL/INCONCLUSIVE 分派机器化/⑤Phase 0B 产品行为/⑥env_snapshot 键封闭)+DS-3 定案+batch1 evidence 入 repo+push——均沿 §R.4 待用户 | 待用户 |
| 6 | 执行日后:evidence 消费评审(人工+Codex,W1 窗口外)+HANDOFF §T/ledger v15 收束 | 执行日 |

### S.5 教训(本 arc 新增;历代继续有效)

1. **修复引入回归 17 例**(r109→r118;T11/CD17/CD20/CD18×2/CD19 等):安全敏感执行包上「修复必差分复核+独立确认轮」不是仪式——r116 类封版前窄 scope 确认专抓单测网盲区(异常分支/边界),每轮都有真 finding。
2. **fabricate 事故与解法**(会话 14):超长 turn 末端连「算 SHA 写清单」类机械操作也会编造工具输出;解法=fresh session+入口 fail-closed 核验块原样实跑+「每个 SHA 真实命令观察」纪律,恢复永远不信交接值。
3. **解析失败回退=fail-open 温床**:`except ValueError: fallback` 模式在排除类判定里必然放行畸形输入;A8/CD2 纪律(采集/解析故障=硬 abort,绝不折叠成排除/absence)须覆盖**每一个** shlex/json/split 点——同型排查(全 except 分支扫描)是修复的一部分。
4. **差分确认的 artifact 标准**(r117/r118 树立):用 file-history 真实快照做 unified diff(非口述重建)+AST 引用检查+逆向 diff(还原旧句证 SHA 精确回滚)——「只改了 X」类声明从此要这种等级的证据。
5. 审批锚必须核 driver 实现非文档措辞:BRIEF 曾写「cardSha256=card 封版 SHA」,driver 实核 matrix cardSha256——封版前跑一遍 approval 解析代码(:1201-1204)避免执行日 rc=2。

---

## R. 会话 12 收尾(2026-07-18)— 批次 1(P0A-8)执行闭环:degraded FAIL(真实负观察)+r98 收敛+口径 A【SUPERSEDED BY §S】

> **SSOT 声明**:本 §R 为唯一 live 段;§Q 及更早段 SUPERSEDED(§F/§G 锁定决策、历代教训、§K.4 授权口径继续有效)。
> 分层 SSOT:架构/协议规格(**v0.12.19**)/Phase 0A 准备包/批次 1 执行包/**自动化执行形态提案 v0.5**锚均见 ledger v11 核验块(GV 锚 d80341b0… 不变);**批次 1 执行产物=`batch1/evidence/` 三件(repo 外)**;操作台账+激活入口=ledger「下会话激活(入口;**v11**)」段(v10 已 SUPERSEDED)。
> 一句话:会话 12 完成**四件**——①批次 1 run card 以 degraded 演练执行闭环(用户选路),**status=FAIL(harness 证 evidence 合法+非 PASS;FAIL 精确分派=card §3+driver+独立消费评审共同成立——真实负观察:codex TUI 0.144.5 对 remote transport 断线无重连逻辑,报错即终会话)**,validate 五门 ACCEPT+人工核+Codex r98(598s)三层收敛,**用户裁口径 A 两层**(degraded FAIL 即刻作 Phase 0B 设计输入 `phase_0b_blocked` 保守侧);②**DS-1/2 定案+DS-3 暂缓→spec v0.12.19**(commit 3b4c174,r99/r100);③**自动化执行形态提案 v0.5 五轮对抗封版**(r101-r104 REJECT 收敛→r105 APPROVE,见 R.3 #7);④P0A-8 isolated 转正**合并批次 2 执行日**(用户裁,非单独跑)。批次 2 起草基准与事实基座全备,留下会话。

### R.1 激活(下会话第一步)

读 ledger「下会话激活(入口;v11)」段并按其执行。⚠首件=**批次 2(P0A-2 条件式 T1+P0A-3 混合)执行包起草**——**按自动化执行形态提案 v0.5(封版基准,见 R.3 #7)起草**,交付含 setup/teardown/controller/watchdog/verify_sidecars/wrapper/pipe-pane 留档**七件**工装;同 r88-r94 工作流对抗→封版→用户批准 card(计费面 none~low(≤2 turns);批 card 即批自动化形态);P0A-8 isolated 转正复跑=批次 2 执行日附带项(判据附录显式重定义)。

### R.2 本会话 DONE(带证据)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | 入口 v9 核验 ALL_CHECKS_PASS 17/17+必读集全量 | 会话记录;exact HEAD 947acf15 | GOLD |
| 2 | 用户选 degraded 演练先行 | AskUserQuestion 选择 | GOLD |
| 3 | P0A-8 四步探测执行(W1-W3 窗口纪律;零计费零 abort) | forwarder 日志 62a05756…(580B)+daemon healthz threadId 轮换×2 | GOLD |
| 4 | **status=FAIL**(harness 证非 PASS;FAIL 分派=card §3+driver+消费评审;真实负观察)+validate exit 0 五门 ACCEPT | evidence f76c1050…json+artifact 955c0e98…jsonl(2864B) | GOLD |
| 5 | 消费评审三层:人工核(六件 SHA16 全等/身份↔隔离一致/日志锚)+**r98 Codex 同意 FAIL** | r98 消息(11 条,独立重算 relisten_gap=13.524s/117.9s 零重连) | GOLD |
| 6 | **用户裁登记口径 A(两层)** | AskUserQuestion 选择 | GOLD |
| 7 | 批次 2 事实基座(plugin 子命令/本地 marketplace/manifest+.mcp.json 格式/memories 全关) | 命令输出(ledger 会话 12 台账内联) | GOLD |
| 8 | 交接三件套(ledger 台账+入口 v10→v11 两轮/本 §R/memory)+r106 交接盲审修补 | 本次写入;r106 verdict NOT-READY→P0×1+P1 组修入 | GOLD |
| 9 | **DS-1/2 定案+DS-3 暂缓落 spec v0.12.19**(用户原文逐字录入) | commit 3b4c174;r99 差分+r100 终核 APPROVE | GOLD |
| 10 | **自动化执行形态提案 v0.5 五轮对抗封版** | SHA 65249178…;r101-r104 REJECT 收敛→r105 APPROVE | GOLD |
| 11 | P0A-8 isolated 转正合并批次 2 执行日+中转件三处备妥(/Users/Shared/) | 用户裁决;bare/kit/out+RUNSHEET(已归档) | GOLD |

### R.3 状态

1. **P0A-8:degraded FAIL 已登记为 Phase 0B 设计输入**(口径 A)——`phase_0b_blocked: keep ws://127.0.0.1 experimental compat path`(spec §14.3 fallbackOnFail 逐字);**Phase 0B UDS 迁移在现有 TUI 行为下不可执行**;设计含义=不移除 WS fallback、不假设 UDS 断线自愈。正式 Phase 0A evidence 待 isolated 复跑(**abprobe 现状=OS 用户已存在 uid=502,软件/profile 未搭——批次 2 setup 脚本自动完成,用户不手跑**;hostMatrix 冻结 codex-cli 0.144.5/macOS 26.5,宿主升级=作废重探)。
2. 批次 1 封版包(五件)不变;evidence 三件 repo 外(batch1/evidence/;是否入 repo 待用户)。
3. r98 五建议状态(r106 分层更新,提案 v0.5 已吸收部分):①TUI stderr/时间线自动留档+③reconnect 机器可判窗口=**已进 v0.5 设计基准**(§4.2/§4.3,待批次 2 card 实现);②provenance 版本锚=**部分进入**(pin adapter/daemon SHA 已进 §4.2,driver/forwarder/codex 完整 provenance 由 card 落地);④FAIL/INCONCLUSIVE 分派机器化=**仍 reopen 面**(v0.5 四象限防 ambiguity 写 false,但封版 validator 不分 FAIL/INCONCLUSIVE 的空档仍在);⑤Phase 0B 断线产品行为=**仍 architecture reopen 面**。⑥(r98 第三发现补承接)env_snapshot 额外键未显式封闭=harness reopen 清单项。④⑤⑥待用户裁,不即兴动。
4. **spec §15 DS 裁决(会话 12 后半更新)**:用户原文「DS-1 采默认定案,DS-2 采默认定案,DS-3 暂缓」→ spec v0.12.19(commit=3b4c174;Codex r99 差分+r100 极窄终核 APPROVE;零 wire 语义变化)。DS-1=Windows out-of-scope 恒 UNSUPPORTED(正式);DS-2=二值/unknown 禁公司数据/allowlist 空 fail-closed(正式);DS-3=维持 PENDING。
5. push——未授权(不变);本地 docs/v3-design 仍基于旧 master d29faace。
6. 消费门 allowlist——fail-closed 不变(FAIL evidence 本就不入消费门)。
7. **自动化执行形态提案封版(会话 12 后半;用户指令「尽可能自动化,避免我人工介入」)**:`~/Desktop/agentbridge_v3_apply_2026-07/automation/proposal_auto_execution.md` v0.5,SHA-256=65249178c579cd55c9168fb73c2460e0b17867c458bce19a0c6ae4a01e16b48f;五轮对抗(自审+r101 八门/r102 六门/r103 七项/r104 五处→r105 全路 APPROVE)。核心:三级矩阵(T1 tmux 全自动/T2 自动采集+人工终裁/T3)+四象限判据+原子时窗+sidecar 双门+root-owned controller+NOTAFTER 租约+watchdog+设备码凭据默认。**正式批准点=批次 2 card**(用户批 card 即批形态);正常路径人工点=两条 sudo+device-auth 一次+card 批准(**+批次 2 另含 P0A-3 Desktop 人工步骤**——三项是基础人工点非批次 2 全集)。残余接受清单=**提案 §7(r105 全路 APPROVE 时定格)**。

### R.4 NOT-DONE(承接;下会话据此不遗漏)

| # | 待办 | 性质 |
|---|---|---|
| 1 | 批次 2(P0A-2 条件式 T1+P0A-3 混合)执行包起草+对抗封版+card 批准 | 下会话首件;**按提案 v0.5 封版基准**;工件=card/探测插件 v1/v2/本地 marketplace 源/自省 shim/driver+**自动化工装七件**(setup/teardown/controller/watchdog/verify_sidecars/wrapper/pipe-pane 留档工装——提案 §8);**batch2 setup 硬门补:/Users/Shared/ab-probe-out 现 0777 须收权(evidence 完整性,r106)**;**hook 声明格式待调研**(bundled 无示例)+P0A-3「Desktop 重启」CLI 宿主表述辨析 |
| 2 | P0A-8 isolated 复跑转正 | **合并批次 2 执行日附带项**(用户裁决:边际价值低不单独跑;判据附录显式重定义+批准;abprobe 用户已存在 uid=502,setup 严格校验复用) |
| 3 | r98 建议残余 reopen 裁决(④分派机器化/⑤Phase 0B 产品行为/⑥env_snapshot 键封闭——①③已进 v0.5,②部分进入余项由 card 落地,见 R.3 #3) | 待用户 |
| 4 | DS-3 定案(DS-1/2 已定案,见 R.3 #4) | 待用户后续另行裁决;维持 PENDING,未裁前按默认 fail-closed(不绑定任何批次/探测时序——用户原文仅「暂缓」) |
| 5 | batch1 evidence 三件是否入 repo | 待用户 |
| 6 | push docs/v3-design | 禁区;待用户显式批 |
| 7 | FAIL 回改设计(§14.3:architecture §16 Phase 0B 条目按 fallback 处理)——封版件修订另行 APPLY | 依口径 A 设计输入;修订流程待启 |
| 8 | 「harness provenance 必需化」提案(r90 不采项 4,§Q 承接) | 待用户 |

### R.5 教训(本会话新增;历代继续有效)

1. 探测窗口与审核载体共用 daemon 时须显式窗口纪律(W1 零 ask_codex/W2 队列清零/W3 日常 TUI 暂退)——注入面=计费污染源,执行侧补足,不改封版设计。
2. 「validator ACCEPT」≠「业务 PASS」:封版全链只证 evidence 合法+「非 PASS」;FAIL/INCONCLUSIVE 精确分派=card §3+driver+人工评审共同责任(r98 内存改写复验实证)。
3. degraded 演练对宿主二进制固有行为类负观察有强设计输入效力;正式 gate 纪律不因此放宽——两层口径并存是正解。
4. 负观察佐证要多通道(healthz threadId/字节计数/日志时间线);operator note 单通道留证据等级缺口。

---

## Q. 会话 11 收尾(2026-07-18)— 批次 1(P0A-8)执行包七轮对抗封版【SUPERSEDED BY §R】

> **SSOT 声明**:本 §Q 为唯一 live 段;§P 及更早段 SUPERSEDED(§F/§G 锁定决策、历代教训、§K.4 授权口径继续有效)。⚠此声明为历史文本,现行 live=§R。
> 分层 SSOT:架构/协议规格/Phase 0A 准备包锚均不变(见 §P 引言;GV 锚 d80341b0… 全程不变);**批次 1 执行包=`~/Desktop/agentbridge_v3_apply_2026-07/batch1/` 五件(repo 外)——2026-07-18 会话 11 经 Codex 七轮(r88 REJECT P0×2 → r89/r90/r91/r92/r93 逐轮收窄 → r94 全路 APPROVE)封版**;五件当前 SHA-256(card/README=三锚链,其余三件=单锚)=ledger 会话 11 台账;操作台账+激活入口=ledger「下会话激活(入口;**v9**)」段(唯一入口;v8 已 SUPERSEDED)。
> 一句话:会话 11 完成一件——用户选定 (i) Phase 0A 实机探测后,批次 1(P0A-8 UDS proxy 探针,零计费)run card+隔离 profile 指引+forwarder+driver+README **五件**对抗封版;**run card 已获用户批准(原文入 card §1),实机探测未跑(零计费维持),隔离 profile 未搭建**;会话尾经 r95 交接盲审修补;ask_codex 载体本会话全程恢复可用。

### Q.1 激活(下会话第一步)

读 ledger「下会话激活(入口;v9)」段并按其执行。⚠**首件=执行已批准的批次 1 run card**(非再索批准):isolated 正式跑前置=用户搭 abprobe profile,或先做 degraded 演练(不得 PASS);用户亦可改选 DS-1/2/3(纯纸面)。

### Q.2 本会话 DONE(带证据)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | 三条路呈现+用户选 (i) | 会话记录;AskUserQuestion 选择 | GOLD |
| 2 | 批次 1 四工件起草+冒烟(自抓 status 分派缺陷当场修) | batch1/ 文件+scratchpad 冒烟输出 | GOLD |
| 3 | r88-r94 七轮对抗(全程 ask_codex 同步 RPC,零过滤杀) | 各轮 verdict+artifact 见 ledger 台账;我方 spot-check 复现 P0-1 | GOLD |
| 4 | **r94 全路 APPROVE 封版** | Codex 封版描述+四文件 SHA-256(三件逐字节一致;run card 三锚 d9c837ac→12276944→ead13d71) | GOLD |
| 5 | **run card 用户批准**(原文「批准 run card ,commit」逐字录入 card §1 userApproval) | card §1;状态行 APPROVED | GOLD |
| 6 | **commit=2ce3711**(HANDOFF §Q,+46/-5;工作树净;未 push) | `git show -s 2ce3711` | GOLD |
| 7 | 交接三件套(ledger 台账+入口 v9/本 §Q/memory)+r95 交接盲审修补 | 本次写入;r95 verdict NOT-READY→P1×4 修入 | GOLD |

### Q.3 状态

1. 批次 1 执行包——**封版且 run card 已获用户批准(2026-07-18,原文「批准 run card ,commit」逐字录入 card §1;批准后 card SHA 三锚 d9c837ac→12276944→ead13d71,ledger 会话 11 台账/尾声段)**;执行 OS 用户名冻结于 card `preconditionsChecked[8]`=abprobe;可按 card §2 执行(isolated 正式跑待 abprobe profile 搭建;degraded 演练可先行不得 PASS)。
2. 隔离 profile——未搭建(指引就绪:batch1/isolation_profile_setup.md;abprobe 用户+codex CLI 登录+合成仓库)。
3. P0A-8 实机探测——未跑;degraded 演练可先行(不得 PASS)。
4. spec §15 DS-1/2/3——仍待用户明确选择(不变)。
5. push——未授权(不变);本地 docs/v3-design 仍基于旧 master d29faace。
6. 消费门 allowlist——交付态 fail-closed(approved=[]、frozenHostMatrix=null;scripts/phase0a/README.md);解锁须用户在探测批次启动时显式改。

### Q.4 NOT-DONE(承接剩余风险/待办;下会话据此不遗漏)

| # | 待办 | 性质 |
|---|---|---|
| 1 | P0A-8 实机探测执行(isolated 前置 abprobe 未搭;degraded 未跑) | 下会话首件;须用户在场 |
| 2 | 批次 2-6 run card 起草(P0A-2/3→1/9/CB→4/5→6→7;runbook §11 批次序) | 依批次 1 结果 |
| 3 | DS-1/2/3 定案 | 待用户;不选=默认 fail-closed 安全 |
| 4 | batch1 五件是否入 repo | 待用户;现 repo 外 |
| 5 | push docs/v3-design | 禁区;待用户显式批 |
| 6 | Phase 1A 实现 | 门控于 Phase 0A 证据 |
| 7 | 「harness provenance 行必需化」提案(r90 不采项 4) | 待用户决定是否 reopen(改封版 scripts/phase0a/) |
| 8 | evidence 消费 allowlist 解锁 | 待用户探测批次启动时显式改 |

> **不采项区分(r90 五建议)**:采纳 1/3/5(expected-user 门/日志 fd 硬化/内容寻址副本);**不采项 2(driver 接管 forwarder 生命周期)=有意不采**(改 runbook §8.3 人工分步观察形态,非待办);**不采项 4(harness provenance 必需化)=待用户决定**(见上表 #7)。
> **P0A-8 已知残余(card §6,如实承接)**:①evidence 自由书写威胁模型——恶意执行者可整体伪造,纸面已加固至「诚实误操作难产生 no-probe PASS」,根本解=实机独立见证;②note secret 检测=defense-in-depth 非完备;③forwarder 实例锁仅约束合作实例,非合作 same-UID out-of-scope(architecture §10.4)。

### Q.5 教训(本会话新增;历代继续有效)

1. 优雅关闭是探针/桥类工具的确定性陷阱:断连场景必须 transport.abort(),掉线判据=进程退出+日志+无新增字节(kernel buffer 排空是对端本地伪影)。
2. 安全加固代码自身就是新攻击面:「修复引入新洞」本会话连环 4 例(锁 open 截断/16MiB 读中增长/publish symlink 覆写/清理假成功),每轮修复必须显式复核「修复引入面」。
3. sidecar 文件安全**分三层**(r95 P2-2 精化,勿泛化为「三件套缺一不可」):①共同基线=O_NOFOLLOW+fstat 形态验证(regular/euid/nlink);②可复用 lock=基线+O_NONBLOCK+flock(不用 O_EXCL);③immutable 内容副本=基线+随机 nonce O_EXCL 临时+link no-replace 原子发布。
4. 差分循环防无限收敛:验收基线显式化(纸面可修清零+不可解项如实定性=APPROVE)+「纸面可修 vs 定性分歧」分流,r91 起三轮零定性分歧后 r94 自然收敛。
5. 交接层也须盲审:r95 抓出批准状态 split-brain(改批准态时改漏 ledger 前言/HANDOFF 引言/memory 三处)——状态翻转类修改必须全指针同扫,否则冷启动会读到「待批准」而重复索批。

---

## P. 会话 10 收尾(2026-07-17)— Phase 0A 纸面准备包 v0.4 封版【SUPERSEDED BY §Q】

> **SSOT 声明**:本 §P 为唯一 live 段;§O 及更早段 SUPERSEDED(§F/§G 锁定决策、§J.5/§K.5/§L.4/§M.4/§N.4/§O.4 教训、**§K.4 授权口径**继续有效)。
> 分层 SSOT:架构=`docs/v3-architecture.md`(v0.10 封版,SHA d40fc07c…,不变);协议规格=`docs/v3-protocol-spec.md`(v0.12.18+companion,SHA de56247a…,不变;GV 锚 d80341b0… 全程不变);**Phase 0A 执行细则=`docs/phase0a-runbook.md`(DRAFT v0.4 封版,SHA16 4064e66c…)+harness=`scripts/phase0a/` 11 件(核心 validate.py SHA16 6fd0282f…;selftest 94 项全绿)——两者 2026-07-17 会话 10 经 Codex 四轮(r82b REJECT P0×6→r83 部分收割+3 新 finding→r84 REJECT 窄 P1×1→r85 全项 APPROVE)封版,已 commit=b13d526(23 文件入 docs/v3-design,未 push);仅本文件 §P 交接维护更新留 M 未 commit**;操作台账+激活入口=`~/Desktop/agentbridge_v3_apply_2026-07/ledger.md`(唯一激活入口;现行=「下会话激活(入口;v8)」段)。⚠**spec 头部历史防护(结转自 §O)**:spec 头部「未 commit/architecture v0.9=fec2285」为封版前历史元数据,操作事实以 b13d526/architecture v0.10/本 §P 为准。
> 一句话:会话 10 完成一件——Phase 0A 纸面准备包(runbook v0.4+harness)对抗封版;期间 r82b 结果自上会话中断处 rollout 收割、r83 已产出的部分结果无损收割(未判项由 r84 补判)、r85 完整终签无损收割;DS-1..3 按禁区跳过;实机探测未触(零计费)。

### P.1 激活(下会话第一步)

读 `~/Desktop/agentbridge_v3_apply_2026-07/ledger.md` 的「下会话激活(入口;**v8**)」段并按其执行(唯一入口;v7 已 SUPERSEDED)。⚠首件=待用户指示(纸面已尽,实机/DS/Phase 1A 均须用户输入)。

### P.2 本会话 DONE(带证据)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | r82b 结果收割(上会话中断的红队轮) | rollout 02-18-49-019f6c27…(多路,主协调路+子路);verdict REJECT P0×6+P1×5+P2×1;我方抽查 5/5 复现 | GOLD |
| 2 | v0.2 修入(12 findings)+selftest 84 项 | ledger 会话 10 台账;修复期自抓新洞 1 例(allowlist 缺键) | GOLD |
| 3 | r83 部分收割(载体被杀)→3 新 finding 复现 | rollout 019f6f88…两线程;bool/int 混淆+非对象 traceback+raw-source 无绑定,3/3 我方复现 | GOLD |
| 4 | v0.3 修入(strict_deep_equal/守卫/RAWSOURCE 门)93 项 | ledger;GV 锚不变 | GOLD |
| 5 | r84 完整差分(REJECT 窄:F1 宿主重启相位 P1+F2 字段漂移 P3) | codex task-mrosm6k1 result 全文;我方抽查 spec:2306/runbook:462/:120 属实 | GOLD |
| 6 | v0.4 修入(HOSTRESTART 门+host_instance 行+§1.7 修正)94 项 | ledger;observed/模板不变 | GOLD |
| 7 | **r85 全项 APPROVE:准备包封版** | rollout 019f6fb1…完整终签(载体挂死,核盘收割);F1×7+F2×2 全 FIXED+7 边界回归;我方抽查行号 4/4 | GOLD |
| 8 | 用户 APPLY commit=**b13d526**(23 文件=docs 2+scripts/phase0a 21,入 docs/v3-design;未 push) | `git show --stat b13d526`=23 files changed | GOLD |
| 9 | **运行时插曲**:default bridge「打不开」诊断(非本会话所致) | 只读诊断;根因=老连接今晨 01:45 掉线+新 claude 未重连;我方 git/mtime 自证零运行时改动;修复命令已给(用户会话后 `abg-restart ~` 自行执行);详 ledger「会话 10 运行时插曲」段 | GOLD |

### P.3 状态

1. Phase 0A 纸面准备包——**v0.4 封版且已 commit(b13d526)**;工作树仅本文件因会话10尾 §P 交接更新留 M 未 commit(commit 另批)。
2. Phase 0A 实机探测——未触;执行须用户在场+runbook §11 run card 逐项批准(计费敏感 P0A-4/5/6/7/CB)。
3. spec §15 DS-1/2/3——仍待用户明确选择(不变)。
4. push——未授权(不变);本地 docs/v3-design 仍基于旧 master d29faace(rebase=另一次 Git 写授权)。
5. 消费门 allowlist——交付态 fail-closed(approved=[]、matrix=null),解锁=用户探测批次启动时显式改。
6. **bridge 载体**——本会话 default 通道桥接层不通(ask_codex 未接入,Codex 协作全程走 codex 插件 rescue);**用户关本会话后在外部终端 `abg-restart ~` 重开 default 通道**(只动 default,git/文件不受影响);下会话=重开后新 claude,先探 ask_codex 是否恢复,恢复用之、否则续用 rescue。

### P.4 教训(本会话新增;历代教训继续有效)

1. **codex 载体三种异常均≠任务失败**:内容过滤杀(r83)/挂死 running 不传回(r85)/rescue 误发 resume 冲突——一律先核 `~/.codex/sessions/<date>/rollout-*.jsonl` 收割再决定重发;r82b 甚至整轮无损收割自上会话。
2. **OpenAI 内容过滤对「红队/攻击/对抗」措辞敏感**:r82/r83 两杀实证;r84 起全中性措辞(一致性核对/边界输入回归/符合性验证)通过——审计强度不降,只换词汇。
3. **Python == 混淆 bool/int 是 JSON 校验的确定性陷阱**(`{"ok":1}=={"ok":true}`):任何模板/深等/绑定比较必须类型级 strict_deep_equal(r83 P0,全 int artifact 实跑穿透模板门实证)。
4. **「转写 spec 到 runbook」的漂移会把语义收窄成可执行但错误的协议**(宿主重启→桩进程重启,r84 F1)——runbook 关键动词(谁被重启/谁在观察)须逐锚回核 spec 原文,与会话 9 教训 5 同族。
5. 修复引入新洞第 7 例(check_allowlist 缺键当 null)——由扩展后的 selftest 当场抓住:**负例套件跟着修复同轮扩,是抓自引入洞最便宜的一道网**。

---

## O. 会话 9 收尾(2026-07-17)— PR #4-#6 全合并 + architecture v0.10 封版【SUPERSEDED BY §P】

> **SSOT 声明**:本 §O 为唯一 live 段;§N 及更早段 SUPERSEDED(§F/§G 锁定决策、§J.5/§K.5/§L.4/§M.4/§N.4 教训、**§K.4 授权口径**继续有效)。
> 分层 SSOT:架构=`docs/v3-architecture.md`(**DRAFT v0.10,2026-07-17 封版:A-1..A-9 spec 反哺修订+§17 PR 合并事实+§18-Q1 裁决记录;Codex r75-r78 四轮差分,r78 全路 APPROVE;磁盘 SHA=d40fc07c80481fabd0fbfbd519f34fa94c634422b769f2dc6b1648477aa9e9b9**);协议规格=`docs/v3-protocol-spec.md`(v0.12.18+**A-9 零语义 companion**(§14.1 回链两处+维护性追记;Codex 逆向 patch 证明精确还原封版字节 9e3b750a…;磁盘 SHA=de56247a215e2186a876f72f39f427a7f6541b78846315344f597e65619815d9);GV 全程 d80341b0…;**三件已经用户批准 commit=fc8030a(docs/v3-design,2026-07-17;未 push,push 仍属禁区)**,本文件其后维护性更新(含本句)保持 modified 待下次批)。⚠**spec 头部历史防护(r80)**:spec 状态行的「未 commit/基线 v0.7.2 经用户 APPLY 落盘」与「architecture v0.9=fec2285」等为封版前历史元数据(封版字节不为此改动)——操作事实以 fc8030a、architecture v0.10(d40fc07c…)、本 §O 为准,勿据以重开 A-1..A-9 或误判 commit 状态;操作台账+激活入口=`~/Desktop/agentbridge_v3_apply_2026-07/ledger.md`(唯一激活入口;现行=「下会话激活(入口;v7)」段)。
> 一句话:会话 9 完成两件——①fork PR #4→#5→#6 全部 squash 合并(**master=8d1e96ee**;根因链=Actions 事件不投递(可证:GET 回显 enabled 不足为凭;有效 `PUT -F` 后下一次 reopened 恢复投递并创建 run——「UI 级禁用标志被清除」属强推断非直接观测,r79 修正)+测试跨平台路径 bug(Codex 容器实跑抓出);含 #5 被 GitHub 意外 close 的临时-ref 恢复、bundle 冲突的重生成解法、#6 delta 逐字节保真重放;Codex r71-r74 exact-OID 审计,全程留证);②architecture A-1..A-9 修订 v0.10 封版(r75 抓 5 组真实漂移→r76/r77 收窄→r78 全路 APPROVE)。c 件 DS-1..3 按禁区跳过;d 件 Phase 0A 纸面包=下会话首件。

### O.1 激活(下会话第一步)

读 `~/Desktop/agentbridge_v3_apply_2026-07/ledger.md` 的「下会话激活(入口;**v7**)」段并按其执行(唯一入口;v6 已 SUPERSEDED)。

### O.2 本会话 DONE(带证据)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | PR #4 CI 诊断修复+合并(9fd8596d patch→118533c2) | run 29512538844 success;chats v3-apply-r71/r72;ledger 会话 9 台账 | GOLD |
| 2 | PR #5 事故恢复+master 回并+合并(6514171→e207213e) | #5 delta 逐字节保真 28fc6e34…;chat r73 | GOLD |
| 3 | PR #6 delta 重放+合并(e09a9c5→8d1e96ee=master) | delta 保真 d3bda37f…;Linux 384/384;chat r74 | GOLD |
| 4 | architecture v0.10 封版(A-1..A-9+§17+§18-Q1) | r78 全路 APPROVE;SHA d40fc07c…;审计链 r75-r78 | GOLD |
| 5 | spec A-9 companion(零语义,可逆) | 逆向 patch 还原 9e3b750a… 实证;GV 不变 | GOLD |

### O.3 状态

1. fork PR #4/#5/#6——**全部 MERGED,fork 远端 PR head refs 已删,master=8d1e96ee,零 open PR**(本地仓的三条 PR head 分支(fix/bundle-sync-ci-gates、feat/lifecycle-hardening、feat/ops-hardening)与陈旧 remote-tracking refs 仍在,属会话前遗留,未授权不清理;本地 docs/v3-design 基于旧 master d29faace、不含 squash 链——rebase/replay 属另一次 Git 写授权)。
2. architecture v0.10——**封版且已 commit(fc8030a,用户 2026-07-17 批准;含 spec companion 与本文件 §O 版)**。
3. spec §15 DS-1/2/3——**仍待用户明确选择**(不变)。
4. Phase 0A——纸面准备包(runbook+harness)=下会话首件;实机/计费仍须 run card。
5. push——未授权(不变)。

### O.4 教训(本会话新增;历代教训继续有效)

1. **GitHub GET 回显不能证明事件投递**:fork 的 actions/permissions 回显 enabled=true 期间 synchronize/首次 reopened 均零 run;有效 `PUT -F enabled=true`(小写 `-f` 传字符串会 422)后下一次 reopened 才创建 run——判定以实际 run 创建为准,不信设置回显;「内部禁用标志被 PUT 清除」是操作性推断而非直接观测(r79 口径)。
2. **官方 retarget 保证不可依赖**:删除已合并 PR 的 head 分支时,依赖它的子 PR 被直接 close(实测 base_ref_deleted+closed,无 automatic_base_change 事件)——stacked 合并序=先显式 retarget 子 PR、后删父分支。
3. **macOS 预验≠CI**:跨平台路径(XDG vs Application Support)与 PID 1 进程回收差异必须容器实跑(--init);r71 Codex 容器抓出被本机预验掩盖的确定性红灯。
4. **生成物冲突恒重生成**:bundle 类冲突不手工 merge,从 merged source 按 canonical 命令重 build。
5. **转写 spec 状态机的最大漂移源=凭记忆概括**(intent 枚举/timer 因果/ack 层次);概括逐锚回核(r75 五组漂移全属此类)。

## N. 会话 8 收尾(2026-07-16)— Chunk 7 组装终审 CLOSED:spec arc 完成【SUPERSEDED BY §O】

> **SSOT 声明(历史,SUPERSEDED BY §O)**:~~本 §N 为唯一 live 段~~;§M 及更早段 SUPERSEDED(§F/§G 锁定决策、§J.5/§K.5/§L.4/§M.4 教训、**§K.4 授权口径**继续有效)。
> 分层 SSOT:架构=`docs/v3-architecture.md`(v0.9,fec2285,未动=4b401094…);**协议规格=`docs/v3-protocol-spec.md`(DRAFT v0.12.18;§1-§16 全章封版+Chunk 7 组装终审 CLOSED(Codex r69 全路 APPROVE);SHA 链=r69 审定字节 b7ed90c6… → 终签追记(状态行+修订记录,零行为语义)=当前磁盘 9e3b750acb0f12d2b13fe565601bc37a249bba3dad1eae1f735e638f7c2adcca;GV 全程 d80341b0…;**已 commit:三工件(spec/GV 脚本/本文件)经用户批准入 docs/v3-design=0b369f6(2026-07-16;未 push,push 仍属禁区)**,本文件其后维护性更新(含本句)保持 modified 待下次批)**;操作台账+激活入口=`~/Desktop/agentbridge_v3_apply_2026-07/ledger.md`(唯一激活入口;现行=「下会话激活(入口;v5,Chunk 7 CLOSED 后)」段)。
> 一句话:会话 8 完成 Chunk 7 全部四子项——P2 回扫 15 项处置(v0.12.12)→ Codex 全文对抗终审七轮(r63 全文红队 REJECT P1×6/P2×7 → r64-r68 五轮差分逐层收口 → r69 全路 APPROVE),v0.12.12→v0.12.18;冷读机械闭包(domain 38=38/error 4000-4064 连续/token 10=10/ID 前缀反向闭包);architecture 同步修订建议 A-1..A-9 定稿清单化;①治理备忘录(§18-Q1 四态)产出;全程零 Git 写。**spec arc 阶段边界已达:剩余全部为用户 APPLY/授权事项**(commit 三工件/A-1..A-9/PR #4-#6/Q1 裁决/DS-1..3/Phase 0A 授权——清单见 ledger v5 入口)。

### N.1 激活(下会话第一步)

读 `~/Desktop/agentbridge_v3_apply_2026-07/ledger.md` 的「下会话激活(入口;**v6**,用户全清单批准后)」段并按其执行(唯一入口;v5 已 SUPERSEDED——会话 8 尾声用户批准执行,授权口径与保守边界详 ledger「会话 8 尾声」段+其 r70 修正)。

### N.2 本会话 DONE(带证据)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | **Chunk 7 组装终审 CLOSED**(P2 回扫 15 项+冷读+七轮对抗 r63-r69 至全路 APPROVE;v0.12.12→v0.12.18) | spec 修订记录 v0.12.12..v0.12.18+终签追记;chats v3-apply-r63-final-audit..r69-final-seal4;ledger 会话 8 台账 | GOLD |
| 2 | 七轮全程:SHA 门禁+GV 双方实跑一致+**逆向反演每轮零未声明改动**(r64=36 编辑/r65=14/r66=13/r67=7/r68=9/r69=5;r67 起 Codex 从会话 jsonl Edit 日志无落盘反演) | 各轮 verdict artifact(stdout 摘录) | GOLD |
| 3 | architecture 同步修订建议 **A-1..A-9** 定稿(r63 逐锚 KEEP+A-1 补两锚;Chunk 4/5 反查无新增) | ledger 会话 8 台账 A-1..A-9 条 | GOLD |
| 4 | ①治理备忘录(§18-Q1 四态 A/B/C/D+三维度+推荐 D→C) | `~/Desktop/agentbridge_v3_apply_2026-07/proposal/governance_q1_memo.md` | 决策输入 |
| 5 | 会话内零 Git 写;**会话尾经用户批准 commit 三工件=0b369f6(docs/v3-design;未 push)** | git log -1 0b369f6 | 用户 APPLY |

### N.3 状态(会话 8 尾声用户批准后;r70 审计修正口径)

1. ✅commit v3 三工件至 docs/v3-design——**已完成(用户批准,0b369f6;未 push,push 仍属禁区)**。
2. architecture 修订 A-1..A-9——**已授权待执行**(会话 9;编辑+红队+落盘,commit 另提请)。
3. fork PR #4/#5/#6 合并——**已授权(绑定审时 head OID)但 #4 当前 mergeStateStatus=BLOCKED**(master required check `check` 在该分支零上报;会话 9 先诊断修复 CI 再按 #4→#5→#6 合并)。
4. §18-Q1 治理——**已裁决=D 为当前动作、C 为方向**(用户对已展示推荐说「我都同意」;r70 确认解释成立;记录随 A-1..A-9 批注入 architecture)。
5. spec §15 DS-1/2/3——**待用户明确选择**(r70 修正:此前清单未展示选项,「都同意」不构成定案;选项已在会话 8 最终汇报向用户展示,确认前按默认安全侧运行,不写定案标注)。
6. Phase 0A——**纸面准备(runbook/harness)已批**;实机/计费执行须具体 run card+费用报告再批。
7. push——未授权(不变)。
8. 旧 §J.3-b/§E backlog 承接口径不变(§M.3#4)。

### N.4 教训(本会话新增;§K.5/§L.4/§M.4 继续有效)

1. **P2 级修复同样引入 P1 级新洞**(v0.12.12 的 D3/retention 两例被 r63 抓回)——「非阻断修复」也必须走差分复核,不存在免审级别。
2. **注释式顺序修正无效**:可执行伪码的行序本身是规范,追加「执行顺序封闭」注释挡不住冷读按旧行序落码(r65 N1' 物理重排才收口)。
3. **泛称载体必须实体化**:「恢复面/恢复响应」类表述若无具体 wire 字段,等于没有(r65-r68 N4' 链:carrier→snapshot→anti-rollback→schema 统一,四轮才闭合)。
4. **SQLite 三值逻辑是谓词类规范的盲区**:optional join 下 NULL 传播使「缺席」既非真也非假——谓词必须显式二值化(r67 G2 首次挂起误拒)。
5. Codex 从会话 Edit 日志(jsonl)做**无落盘逆向反演**=对「未 commit 工作树」的零未声明改动证明手段,可作为 git 不可用时的差分权威。

## M. 会话 7 收尾(2026-07-16)— Chunk 4/5/6 封版:§1-§16 全章起草封版完毕【SUPERSEDED BY §N】

> **SSOT 声明(历史)**:本 §M 曾为唯一 live 段;现行 live 段=§N;§L 及更早段 SUPERSEDED(§F/§G 锁定决策、§J.5/§K.5/§L.4 教训、**§K.4 授权口径**继续有效)。
> 分层 SSOT:架构=`docs/v3-architecture.md`(DRAFT v0.9,fec2285,未动);**协议规格=`docs/v3-protocol-spec.md`(DRAFT v0.12.11;**§1-§16 全章起草封版**;SHA 链=Chunk 6 封版审定字节 8e8f0cf7…(轮 62)→ 状态行同步 ec3caca0… → **v0.12.11 冷读修正(会话 8 交接审计)=当前磁盘 1204b03beef29e053bd0a73ee71951c68879a273c4dd8b2b5449764ec7b3acfc**,三步均零行为语义;GV 全程 d80341b0…;与 gen_golden_vectors.py 一起仍未 commit)**;操作台账+激活入口=`~/Desktop/agentbridge_v3_apply_2026-07/ledger.md`(唯一激活入口)。
> 一句话:会话 7 完成 Chunk 4(§10,轮 31-41)/Chunk 5(§11+§12,轮 42-51)/Chunk 6(§13+§14+§15,轮 52-62)三块 Codex 全路 APPROVE 封版,共 32 轮对抗;§10.14 additive #1-#26 全 CONFIRMED;GV 锚全程不变 d80341b0…;全程零 Git 写。仅剩 Chunk 7=组装终审(无新章)。

### M.1 激活(下会话第一步)

读 `~/Desktop/agentbridge_v3_apply_2026-07/ledger.md` 的「下会话激活(入口;v4,Chunk 4/5/6 封版后)」段并按其执行(唯一入口)。

### M.2 本会话 DONE(带证据)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | **Chunk 4 封版**(§10 预算/lineage/生命周期实体全字段+索引;轮 31 初稿 P0×7→轮 41 全路 APPROVE;#1-#15 additive) | spec 修订记录 v0.10..v0.10.10;chats v3-apply-r31..r41;封版 SHA 911d7465… | GOLD |
| 2 | **Chunk 5 封版**(§11 push-completion wire+deny-only 审批记录/§12 人闸 effect wire G5-GATED;轮 42 初稿→轮 51 全路 APPROVE;#16-#21 additive;含一个 P0 stale-not-protected 类的彻底修复) | spec 修订记录 v0.11..v0.11.9;chats v3-apply-r42..r51;封版 SHA 01a5facc… | GOLD |
| 3 | **Chunk 6 封版**(§13 signal-file/§14 Phase 0A 探测包 NOT RUN/§15 决策登记册;轮 52 初稿→轮 62 全路 APPROVE;#22-#26 additive;wake 并发状态机经 Codex SQLite 实跑复验闭环) | spec 修订记录 v0.12..v0.12.10;chats v3-apply-r52..r62;封版 SHA 8e8f0cf7… | GOLD |
| 4 | §10.14 additive #1-#26 全 CONFIRMED;§16 error 4059-4064+新 domain 累计;三块封版章接线经各轮逐项复核 | ledger Chunk 4-6 台账+additive 全量段 | GOLD |
| 5 | Codex 红队全程 artifact+行号(关键轮多路并行);SHA/GV 按台账明确记录的轮次复核(GV 锚 d80341b0…全程不变;台账留痕 GV×4/SHA×7 处,非逐轮完整存档) | ledger 台账 | 记录(非全称 GOLD) |
| 6 | Codex SQLite `:memory:` 实跑复验 wake 并发状态机(轮 57-59 有记录:唯一键/boot rebase/EIO 收费/零样本真空 PASS) | chats r57-r59 | GOLD(该项有 chat 证据) |

### M.3 NOT DONE / 下会话

1. **Chunk 7 组装终审(无新章起草)**——四子项(来源已精确到位,防漏捞):
   - a. **P2 回扫**:ledger **两段**(勿只读其一):「## Chunk 7(组装期)P2 待办(轮 4-29 非阻断项集中)」+「### 轮 41 新增 Chunk 7 P2 待办」(2 条:§5.6 lastProbeDispatchId fence / §10.4-§10.5 冷读合并)。**Chunk 5(轮 51)/Chunk 6(轮 62)封版时 P2 全清=当前无已知遗留**(§10.14 记录内的「轮 45 P2」等是已修历史,非开放项);逐条标 fixed/仍需/作废。
   - b. **冷读者过**:全文 §1-§16,查跨章交叉引用一致、无悬空/未回填。
   - c. **Codex 全文对抗终审**(chat r63 起)。
   - d. **architecture 同步修订建议清单化**(仅列待用户 APPLY,禁改 v3-architecture.md):**旧 8 项已聚合于 ledger「Chunk 7(组装期)P2 待办」段 L296/L298/L299**(§6.2 verificationRevision/resolvedContextBasis tagged union/§6.5 acked 消歧/幂等 semantic digest/completion 信封 canonical/claim_ack 步等;原始来源 L127/L132)——r63 规范化编号即可。**⚠会话 7 Chunk 4-6 起草时未单独记录 architecture 建议**——r63 须从 spec 修订记录+§10.14 additive 反查是否有需同步点(候选:Chunk 6 context-basis carrier「随 context_current_v1 feature 新增」=architecture §0-A.8 carrier 设计缺口;确无则明标「Chunk 4-6 无新增」)。
2. ①治理(§18-Q1)备忘录(预算允许时;push/PR 须先处理 fork #4/#5/#6=Git 写禁区,仅出备忘录)。
3. **Git 写全部未做未授权**:两文件 untracked+本文件 modified,直到用户明示。
4. **旧 §J.3-b/§E backlog**(§18-Q2..Q6/onboarding/Phase 0B/Q7/D-4 注释义务/G1-G5 追溯矩阵/P0-0 重跑)——均 architecture/实现阶段任务,不在本 spec arc §0-A 范围,待 Phase 0/1 拾起(承接自 §L.3#6)。

### M.4 教训(本会话新增;§K.5/§L.4 继续有效)

1. ⚠**批量脚本改文档必核盘**:python 批量脚本在后置 assert 失败时整批不 write(回滚)——若未重跑就继续,修订记录会与主体分叉。Codex 轮 57 逐字段+SQLite 实跑抓出 v0.12.5 静默丢失 4 处修法。纠正=改逐条原子 Edit + 每轮修完 grep 核盘验证主体落地(非只信修订记录)。此为 F2「核盘」+§K.5#4「修复引入新洞」在文档批处理层的延伸。
2. **「纸面准备包」不等于轻审**:Chunk 6(signal-file/探测包/决策登记册)预判轻审,实为 11 轮——evidence schema 是发布闸 authority(错误 PASS 解锁真实能力/root 预算)、governance 是跨厂商核心、wake 是并发状态机,须与运行时同等严格。
3. **Codex SQLite `:memory:` 实跑**对并发状态机/唯一键/CHECK 约束的复验达到文本审读达不到的深度(wake reducer 多次实测复现唯一键冲突/免费 wake/零样本真空 PASS)——涉及物理 schema 的红队应主动要求 Codex 实跑。
4. **三块封版章 additive 累计 26 组全过**:每组按「禁区 reopen 条款」记录(P0 证据驱动)+差分轮逐项 CONFIRMED,证明「封版后仍可受审 additive 增补」的机制在跨 chunk 尺度成立。

## L. 会话 6 收尾(2026-07-15)— Chunk 2+3 封版【SUPERSEDED BY §M】

> **SSOT 声明**:~~本 §L 为唯一 live 段~~(已被 §M supersede);§K 及更早段 SUPERSEDED(§F/§G 锁定决策、§J.5 与 §K.5 教训、**§K.4 授权口径**继续有效)。
> 分层 SSOT:架构=`docs/v3-architecture.md`(DRAFT v0.9,fec2285,未动);**协议规格=`docs/v3-protocol-spec.md`(DRAFT v0.9.10;SHA 链=轮 29 审定 19fe1ecf…→状态行同步 a45dce5c…→轮 30 审计批 a34612d5…→轮 30b 措辞修正 2c8e2038…,差异=元数据/交叉引用+一处 additive producer 澄清(applyingAt),零行为语义变化;与 gen_golden_vectors.py 一起仍未 commit)**;操作台账+激活入口=`~/Desktop/agentbridge_v3_apply_2026-07/ledger.md`(唯一激活入口,此处不复制防漂移)。
> 一句话:轮 15-17 完成 Chunk 2 封版(N1-N5 全 FIXED+N6 正交化两轮收口)→ 轮 18-29 完成 Chunk 3(§7 工具三面/§8 retryClass/§9 requestedContext+§16 增量)十二轮对抗封版;封版章 additive 增补 8 组(轮 18-25 P0 证据驱动)经轮 25 逐项 CONFIRMED;GV 锚全程不变 d80341b0…;全程零 Git 写。

### L.1 激活(下会话第一步)

读 `~/Desktop/agentbridge_v3_apply_2026-07/ledger.md` 的「下会话激活(入口;v3,Chunk 2+3 封版后)」段并按其执行(唯一入口)。

### L.2 本会话 DONE(带证据)

| # | 事项 | 证据 | 等级 |
|---|---|---|---|
| 1 | **Chunk 2 封版**(轮 15 N1-N5 全 FIXED;N6 正交化 revokeCause/revokedAuthority+fence 三元路由 v0.8/v0.8.1;轮 16 攻击重放阻断;轮 17 全路 APPROVE) | spec 修订记录 v0.8..v0.8.1;chats v3-apply-r15..r17 | GOLD |
| 2 | **Chunk 3 封版**(轮 18 初稿 14 P0→轮 19-28 逐轮收窄→轮 29 全路 APPROVE):§7 三面+conformance CC-01..21/§8 manifest/§9 context+§16 增量 4032-4058+10 domain | spec 修订记录 v0.9..v0.9.10;chats v3-apply-r18..r29 | GOLD |
| 3 | 封版章 additive 增补 8 组(§1.3/§2.6/§3.2/§5.1/§5.2/§5.4/§5.6/§6.1)按禁区 reopen 条款记录并经轮 25 逐项 CONFIRMED | ledger 会话 6 台账;chat r25 | GOLD |
| 4 | Codex 15 轮全程 artifact+行号;我方逐轮抽查 SHA;轮 15/22 独立复推 P0;GV 双方逐轮实跑一致 | ledger 台账 | GOLD |
| 5 | architecture 同步修订建议累计 8 项入 ledger「Chunk 7 P2 待办」(待用户 APPLY) | ledger 该段 | 记录 |

### L.3 NOT DONE / 下会话

1. Chunk 4:§10 预算/lineage/生命周期实体(实体最小覆盖清单与闭集口径见 ledger 激活入口 v3 第 3 条;PreAcceptSubmitIntent 前置义务已在 §7.2 锚定;carry-in=多-agent provenance hash)。
2. Chunk 5:§11 **push-completion wire + deny-only 审批记录**(spec §1.1 逐字)/§12 人闸 effect wire(G5-GATED)。
3. Chunk 6:§13 signal-file/§14 Phase 0A 探测包(NOT RUN;**含独立 context-basis 探测项,spec §9.3 已锚**)/§15 决策登记册(已锚 DS-1/DS-2+context-basis slot)。
4. Chunk 7:组装+P2 回扫+冷读者+Codex 全文终审;①治理(§18-Q1)备忘录(预算允许时——与 ledger 口径一致)。
5. **Git 写全部未做未授权**:两文件 untracked+本文件 modified,直到用户明示。
6. **旧 §J.3-b/§E backlog 显式承接(deferred/out-of-current-scope,防静默消失)**:§18-Q2..Q6 开放问题、onboarding 文案、Phase 0B(wrapper 失效 flag)、Q7 MCP Tasks 持续跟踪、D-4 same-UID 代码注释义务、**G1-G5→字段/phase/gate 追溯矩阵(并行交付物,spec §1.1 明示不在 §0-A)**、**P0-0 兼容基线每迁移阶段重跑(architecture §15)**——均属 architecture/实现阶段任务,不在本 spec arc 的 §0-A 交付范围内,待 Phase 0/1 落地时逐项拾起(**清单文字来源=§J.3-b 历史段;该段状态叙述已 superseded,仅作 backlog 枚举出处**)。

### L.4 教训(本会话新增;§K.5 继续有效)

1. **「修复引入新洞」在 Chunk 3 共 4 个 finding、集中于 2 轮**(轮 19:slot 提前释放+4047 吞 consumed+submissions 缺重放锚;轮 27:CHECK 未限域)——每轮修复必须差分复核的纪律再证;增补封版章时尤其要把新约束对既有合法路径(如 T7)的误伤当第一反例。
2. **工具面章的收敛慢于状态机章**(12 轮 vs 9 轮):三面×授权×存储×崩溃恢复的笛卡尔积大;首稿应自带「方法→authority 矩阵+每方法幂等键+崩溃窗三段状态」,可省约 1/3 轮次。
3. Codex 多路并行分工(每路一个 checklist 组)+主审合并,单轮 350-1600s,比单路快且交集稳定。
