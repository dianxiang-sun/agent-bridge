# AgentBridge 多通道实现 — Goal Spec(供 `/goal` 驱动)

> 本文件是**可执行 goal spec**,由 `/goal <此文件路径>` 驱动下会话分阶段实现。
> 架构权威(SSOT)是 `docs/multi-channel-design.md`;本文件只管"怎么分阶段做完并验证",不重复架构论证。
> 运行时进度写入 `V1_PROGRESS.md`(ledger,复用 Work Progress Protocol,本地不提交 git)。

## 0. 元信息(命令必须读取的字段)
- `objective`: 见 §1
- `terminal_states`: 见 §1(成功/失败二选一,不得伪造)
- `ssot_paths`: `/Users/ds/code/agent-bridge/docs/multi-channel-design.md`(架构), `/Users/ds/Desktop/abg-mc-poc.sh`(验证锚,只证进程级分离)
- `ledger_path`: `V1_PROGRESS.md`(项目 CLAUDE.md:27-30 指定;本地不提交)
- `constraints`: 见 §2 §3
- `phases`: 见 §6(PR1→PR5)
- `stop_rules`: 见 §7
- 前置状态(本会话已完成):设计 5 轮收敛 + 第 6 轮 artifact 审核 = **PASS**;PoC 已实跑坐实;**可进入实现**。

## 1. Objective / 可衡量终态

**目标**:把 `docs/multi-channel-design.md` 的方案 A(每条 named 通道一个独立 daemon 三元组)实现为可用功能,分 PR1–PR5,每阶段 TDD + gate 验证。

**成功终态(全部满足才算 COMPLETE)**:
1. PR1–PR5 全部完成且各自 exit gate 通过(§6)。
2. 9 项必补契约(design doc §6)全部落地,有测试佐证。
3. 两通道零串台 E2E 通过(design doc 契约 3)。
4. `default` 通道行为零回归(裸 `claude`/`abg claude` 无参 = 今天的行为)。
5. `bun run typecheck && bun test src/` 全绿。

**失败终态**:任一 gate 阻塞时,停在 `BLOCKED:<phase>:<具体原因>`,**不得伪造完成、不得静默跳过**。

**唯一允许的两个收尾**:`COMPLETE: PR1-PR5 all gates passed` 或 `BLOCKED:<phase>:<reason>`。

## 2. Non-goals / 架构护栏(碰到就停,不要自作主张做)
- ❌ 不做 daemon 内 `Map<channelId>`(daemon 内部拓扑零改)。
- ❌ 不做 1→N fan-out / N:M 共享池。
- ❌ 不做 unix socket(TCP stride `4500+i*10`)。
- ❌ 不做 named 通道 LaunchAgent 保活(v1 = foreground/session-scoped;follow-up)。
- ❌ 不改 `default` legacy 语义(端口 4500/4501/4502 + 现有 state dir + 继承 `~/.codex`)。
- ⚠️ 若实现中发现与 design doc 冲突 → **停下标 BLOCKED**,不静默改架构(SSOT 只读)。

## 3. 环境 / Git 约束
- 仓库 `/Users/ds/code/agent-bridge` 是 **push-gated**(全局 CLAUDE.md manifest)。
- **禁止任何 git write**(`add`/`commit`/`push`/`branch`/`checkout`/`merge`)在 `/goal` 执行内发生;只允许只读 `git status/diff/log/show`。commit/push/PR/分支由主会话在用户 APPLY 后进行。
- 项目规则(agent-bridge/CLAUDE.md):永远不直接推 master;改动走 feature 分支 + PR + 交叉 review;运行时 Bun;提交前必过 `bun run typecheck && bun test src/`。
- `V1_PROGRESS.md` 本地不提交 git。

## 4. Ledger 协议(复用全局 Work Progress Protocol)
- 文件:`V1_PROGRESS.md`。状态机:`pending / in_progress / done / blocked`。
- `Done evidence:` 行强制,本项目(Bun)采用:
  - `Done evidence: bun test src/<file>.test.ts passed (<N> tests)`
  - `Done evidence: bun run typecheck clean`
  - `Done evidence: codex round <N> chat_id=<id> verdict=PASS`
  - `Done evidence: <PoC/healthz 实测输出摘要>`
- 并发模型:`V1_PROGRESS.md` 仅用**contextual Edit/MultiEdit 且 old_string 含唯一 L-id 锚**;禁 `Write` 全覆盖、禁 bash 原位改。
- 文件不存在时:`/goal` 提议初始内容并请求一次 APPLY;创建后所有更新走 Edit/MultiEdit。
- `in_progress→done` 带 evidence 可在 pre-auth 下自动;无 evidence 仍 propose-then-APPLY;任何 `→blocked` 总是 APPLY(并停)。

## 5. Phase Protocol(每个 PR 阶段都必须走完)
1. **Entry gate**:声明本阶段 objective + 读相关 SSOT 段 + 确认前置 PR 已 done。
2. **Red test first**:先写**会失败**的测试(契约/行为),跑一次确认 red。
3. **Minimal implementation**:只实现让该测试转 green 的最小改动,遵循现有代码风格。
4. **Exit gate**:跑该 PR 的测试 + `bun run typecheck`;全绿才算过。
5. **Evidence block**(防幻觉,见 §7)+ 更新 `V1_PROGRESS.md`。
6. **Rollback/Stop rule**:gate 失败且无法在合理范围修复 → 标 `BLOCKED:<PR>:<reason>` 停,等用户。
7. 阶段间**暂停**汇报(phase gate),不一口气闷到底(除非用户 pre-auth "走到 next gate")。

## 6. PR1–PR5(可衡量终态 + 精确检查 + 约束)

> 改动清单细节见 design doc §7;此处给每阶段的 done 判据 + exact checks。

### PR1 — `channel-profile.ts` 核心
- **终态**:实现 `parseChannelId`、legacy `default` profile、`allocate`/`read`、registry O_EXCL lock(never fail-open)、atomic write(temp+rename)+ `schemaVersion` + `.bak`、本地 TCP 端口探测、per-channel 目录/CODEX_HOME/auth-symlink/生成 config/plugins-symlink setup。
- **检查**(`src/channel-profile.test.ts` 新增,先 red):非法/保留 id 拒绝(契约 9)、`default` 不分配端口=legacy、并发 16/30 分配唯一、registry 损坏 fail-closed、目录权限 0700/config 0600、**config TOML 重写后无 `realpath(rootCodexHome)` 后代残留**(契约 2)、`[projects.*]` 保留。
- **约束**:不用系统 `flock`;allocation 内不 spawn Codex/不做网络初始化(只本地 TCP probe + 文件写);config 必须结构化 TOML 遍历,**禁字符串替换**。

### PR2 — CLI channel/env 配对
- **终态**:`abg claude/codex/kill/list` 消费 `--channel`,resolve profile,注入 6 个 env(`AGENTBRIDGE_CHANNEL_ID`/`_CONTROL_PORT`/`CODEX_WS_PORT`/`CODEX_PROXY_PORT`/`_STATE_DIR`/`CODEX_HOME`);named `codex` **禁 fallback** 默认 proxy;未创建 channel 时可读报错(契约 5)。
- **检查**:CLI/shim 测试断言 env 注入、argv 剥离 `--channel`、`abg codex --channel <未创建>` 非零退出且提示、裸 `claude`/无 `--channel` 行为与今天完全一致。
- **约束**:不改老用户路径;`--channel` 不得透传给下游 `claude`/`codex` 原生命令。

### PR3 — lifecycle/spawn 显式 env
- **终态**:`DaemonLifecycle.launch()`(`daemon-lifecycle.ts:221`)与 `CodexAdapter.start()`(`codex-adapter.ts:144`)spawn 时**显式传完整 profile env**,不依赖 `...process.env` 继承。
- **检查**:fake daemon/app-server 捕获 `CODEX_HOME`/`CODEX_WS_PORT`/`CODEX_PROXY_PORT`/`AGENTBRIDGE_STATE_DIR`/`AGENTBRIDGE_CHANNEL_ID`;**从 clean-env 父进程**启动仍拿到正确 profile 值(回归 design doc §2 的"靠继承会丢"问题)。
- **约束**:单测不启动真实 Codex;不改 app-server 协议。

### PR4 — 可观测性 / identity / checkPorts
- **终态**:`/healthz`、`status.json`、log 前缀、bridge ready/waiting 消息都含 `channelId`;kill/attach/reconnect 前校验活进程 `{channelId, controlPort, pid}` 全匹配(契约 1);`checkPorts` 改 channel-scoped。
- **检查**:healthz JSON 含 channelId 断言;篡改 status 后操作被拒;端口被外部/邻居占用 → 标 `blocked-port` 且**不 kill**。
- **约束**:**绝不再按 cmdline 泛杀 `codex app-server`**(现 `codex-adapter.ts:1235`);只杀本 channel `status.json` 记录的 `codexAppServerPid` 且 cmdline 校验;**app-server 无 daemon `/healthz`,不能用 health 判活**(契约 8)。

### PR5 — lifecycle/list/gc + 零串台 E2E
- **终态**:`kill <id>` / `kill --all`(遍历 registry per-profile)/ `list --json`(五态 running/stopped/stale-dead/blocked-port/corrupt)/ `gc` 完成;两通道零串台 E2E 通过。
- **检查**:两个临时通道——kill A 不碰 B;`stale-dead` 可 gc、`blocked-port` 不自动 reclaim;**零串台 E2E**:起 2 通道,断言各自 healthz channelId 正确 + A 的 Claude 消息只到 A 的 Codex(契约 3)。
- **约束**:named idle 30s → `stopped`(profile 保留,不 gc);named LaunchAgent、`abg-restart --channel` 属 follow-up。

## 7. 防幻觉规则(硬约束)
- 每阶段 exit 必须输出固定 **Evidence Block**:
  - `Changed files:` / `Tests added first (red→green):` / `Commands run:` / `Key pass output:` / `What was NOT verified:` / `Residual risk / next phase:`
- 不允许"看起来应该可以/应该没问题"作为 PASS。
- 每个 phase **先落一个失败测试再实现**;声称该 PR done 前必跑其测试;PR5 前跑**全量** `bun test src/` + 两通道 E2E。
- 命令无法运行 → 说明原因 + 替代验证,**禁 silent skip**;无法验证的结论标 `NOT VERIFIED`。
- 收尾只允许 §1 的两个终态。

## 8. Final Acceptance Gate(声称 COMPLETE 前)
- [ ] `bun run typecheck` clean
- [ ] `bun test src/` 全绿(含新增 channel-profile / cli / lifecycle / identity / e2e 测试)
- [ ] 两通道零串台 E2E 通过
- [ ] `default` 回归:裸 `claude` 与无 `--channel` 的 `abg claude/codex` 行为 = 今天
- [ ] 9 契约逐条对照 design doc §6,标注每条由哪个测试覆盖
- [ ] `git diff` 范围 review(仅预期文件;无 git write 发生)

## 9. 防信息丢失清单(本会话成果,下会话不得遗忘)
- **设计已 PASS**:`docs/multi-channel-design.md` 经 5 轮 + 第 6 轮 artifact 审核,双路裁决可实现(§10 协作记录)。
- **PoC 已坐实**:`/Users/ds/Desktop/abg-mc-poc.sh` 实跑证明一条 named 通道三元组能与 default 并存、端口/state/CODEX_HOME 三层隔离、清理干净;**但只证进程级分离,不证完整 config 隔离**(PoC copy config,未重写 → codex 提示项目未 trust——**本会话 PoC 首次实跑日志实测**:`Project-local config... disabled until the project is trusted... /Users/ds/.codex`;这正是 PR1 契约 2 要解决的)。
- **拓扑**:多条独立 1:1 daemon 三元组;非 fan-out/N:M。
- **default = legacy**:`4500/4501/4502` + 现有 state dir + 继承 `~/.codex`;LaunchAgent `com.user.agentbridge` 注入 `IDLE_SHUTDOWN_MS=2147483647` 只保活 default。
- **named**:stride `4500+i*10`(app/proxy/control = base/+1/+2);独立 stateDir + 独立 `CODEX_HOME`;auth.json/plugins/.tmp 用 symlink 共享。
- **`CODEX_HOME` 是唯一真隔离手段**;`--profile`/`-C` 不是。
- **同一 `CODEX_HOME` 并发首启不安全**(实测);故每通道唯一 home。
- **config 重写规则**(契约 2):`realpath(rootCodexHome)` 后代路径才重写;`notify→computer-use/`、`marketplace→.tmp/bundled-marketplaces/`;保留 `/opt/homebrew`、`~/.cache/codex-runtimes`、`[projects.*]` trust;生成 config 0600 不新增 secret 不日志。
- **auth**:login 跟随 symlink 写目标、logout 删 symlink;AgentBridge 只用 `auth.lock` 锁自己的 repair/promote,不锁 Codex runtime refresh。
- **无系统 `flock`**;registry 用 O_CREAT|O_EXCL,never fail-open。
- **现 `checkPorts`(codex-adapter.ts:1235)按 cmdline 泛杀**,必改 channel-scoped pid。
- **本机 RSS 量级**:daemon ~89MB、native app-server ~237MB、wrapper ~49MB、bridge ~53MB(N=3≈1.9GB)。
- **git write 禁止**;`agent-bridge` push-gated;commit/push/PR 交主会话 + 用户 APPLY。
- **abg-restart** 已支持 `ABG_CONTROL_PORT`/`AGENTBRIDGE_STATE_DIR` env override(channel-aware 适配成本低,follow-up)。

## 10. Phase 0(下会话首动作,gate 前不写实现代码)
1. 读本 spec + SSOT(`/Users/ds/code/agent-bridge/docs/multi-channel-design.md`)+ 项目/全局 `CLAUDE.md`。
2. **Branch/worktree 安全 gate**(动任何 Edit 前必做):只读 `git rev-parse --abbrev-ref HEAD` + `git status`,确认**不在 `master`/`main`**(项目规则:改动走 feature/fix 分支 + PR)。若在 master/main → 标 `BLOCKED:Phase0:need feature branch/worktree`,交主会话/用户准备分支后再续;`/goal` 自身**禁止** git write(建分支也由用户/主会话做)。
3. 初始化或读取 `V1_PROGRESS.md`(不存在则 propose 初始 L1.1–L1.5 = PR1–PR5 骨架,请求一次 APPLY)。
4. 调 **`superpowers:writing-plans` skill**(注意:是 skill,**不是** `/writing-plans` 命令),产出 PR1–PR5 的逐步 TDD 实现计划(每步:red test → minimal impl → exit gate),对照 §6。⚠️ 该 skill 默认含 `Step: Commit` / "frequent commits" 模板——**本 goal 下一律禁止生成任何 `git add/commit/push/branch` step**,把每个 commit step 替换为「phase gate + 跑测试 + `git diff` 只读 review」。
5. **停在 Phase 0 gate**:把 writing plan 呈现给用户审,获批后再进 PR1。期间**不做 git write、不写实现代码**。
