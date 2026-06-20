# AgentBridge 多通道(独立 1:1)设计文档

- **状态**: 设计完成 + 双路审 artifact 修正 → 待实现
- **日期**: 2026-06-19
- **拓扑目标**: 多条**互相独立的 1:1 通道**(每条 = 一个独立 Claude↔Codex 配对,各自独立上下文,互不干扰)。**非** 1 Claude→N Codex 的 fan-out,**非** N:M 共享池。
- **方法**: Claude + Codex 双路独立分析 → 5 轮深度协作复审(全程 Codex 实测 + Claude 逐轮独立 spot-check)→ 双路收敛裁决"可进入实现" → 第 6 轮双路审本文档与 PoC 的 artifact 质量并修正。
- **本机事实快照**: codex-cli `0.141.0`;一条活通道实测 = `daemon.js`(LISTEN 4502 control + 4501 codex-proxy)+ `codex app-server --listen ws://127.0.0.1:4500`。

---

## 1. 背景与目标

当前 AgentBridge 同一时刻只能维持**一条** Claude Code ↔ Codex 协作通道。第二个 Claude 前端连接同一 daemon 会被拒绝。目标是支持**同时开多条互相独立的 1:1 通道**,用于并行推进多个不相关的项目/任务,通道间上下文(对话历史、Codex 记忆/会话)完全隔离。

### 非目标
- 不做单 Claude 对多 Codex 的任务分发(fan-out)。
- 不做多 Claude 竞争共享 Codex 池(N:M 路由)。
- 不改 daemon 内部的消息路由拓扑。

---

## 2. 根因分析:为什么只能单开

"只能单开"**不是 bug,而是所有实例默认落到同一组参数**(端口 `4500/4501/4502` + 同一 state 目录 + 同一 `~/.codex`),于是第二个 Claude 撞上第一个 daemon 的单 Claude 槽被拒。

daemon 内部的三个"单例"恰好是"一条通道 = 一个 Claude + 一个 Codex"的天然边界,**对 1:1 通道完全正确,不应改动**:

| 单例 | 位置 | 行为 |
|---|---|---|
| `attachedClaude` | `daemon.ts:68` | 单一 Claude 连接;第二个连接被 `attachClaude`(`daemon.ts:623-632`)以 close code `4001` 拒绝 ← **"只能单开"的直接原因** |
| `activeWaiter` | `daemon.ts:76` | 单一 `ask_codex` 等待者;并发请求返回 `busy`(`daemon.ts:437-451`) |
| `CodexAdapter.tuiWs` | `codex-adapter.ts:84` | 单一主 TUI 连接;daemon 自己 spawn `codex app-server`(`codex-adapter.ts:144`) |

**端口/目录其实已参数化,但未联动成整体**:`AGENTBRIDGE_CONTROL_PORT`(`daemon.ts:52` / `bridge.ts:18` 都读 env)、`CODEX_WS_PORT`/`CODEX_PROXY_PORT`(`daemon.ts:50-51`)、`AGENTBRIDGE_STATE_DIR`(`state-dir.ts:19`)。

> **精确的失败链(第 6 轮审核修正)**:`daemon-lifecycle.launch()`(`daemon-lifecycle.ts:221-231`)用 `{...process.env, AGENTBRIDGE_CONTROL_PORT, AGENTBRIDGE_STATE_DIR}` spawn daemon —— 它**会继承**父进程 env(PoC 正是靠这条继承链零代码起多通道),但**没有 profile-bound 的显式注入**。所以风险不是"传不进去",而是"不显式、易丢":从**不带 channel env 的进程**(LaunchAgent、裸 `claude`、或任何没 source PoC 的 shell)启动时,`CODEX_WS_PORT`/`CODEX_PROXY_PORT`/`CODEX_HOME` 会落默认值(4500/4501 + `~/.codex`)。

→ 只改 control port 而不**联动** state 目录 + Codex 端口 + CODEX_HOME,会导致:两 daemon 抢同一 state 目录(pid/lock/killed/status 互覆盖)+ 抢 4500/4501(`CodexAdapter.checkPorts()` `codex-adapter.ts:1235` 互杀对方的 app-server)。**因此多通道必须显式绑定整组 profile,不能依赖偶然的 env 继承。**

---

## 3. 架构决策

**结论:方案 A —— 每条 named 通道一个独立的 daemon 三元组(daemon 内部拓扑零改),外层做 channel profile 编排。**

| 候选 | 评价 |
|---|---|
| **A. 多 daemon 三元组 + channel profile** ✅ | 与"独立 1:1"语义完美契合;进程级强隔离;daemon 核心改动≈0;复用现有全部逻辑。代价:N 通道 = N daemon + N app-server,资源线性增长 |
| B. 单 daemon 多会话(单例→`Map<channelId>`) ❌ | daemon 核心全重构,高串台/并发 bug 风险(隔离保真度最差);app-server 仍每会话一进程(资源没省);对 1:1 是**过度工程** |
| C. 不改代码,OS 级 env 隔离 | 零代码,适合做 PoC 验证;但手动管端口/目录、无 registry/lock,非产品化 → 作为 A 的 PoC 退化版(见 §7 PoC) |
| D. 固定 N 通道 MVP | 小步快跑;但有硬上限、不通用 → 已被 A+registry 覆盖 |

**关键维度**(决定本设计的三个 task-specific 失败模式):① 隔离保真度 ② 配对确定性 ③ 生命周期可控性。

### Codex 多实例的现实约束(实测结论)
- 同机多个 `codex app-server --listen`(不同端口)**可行**;不同 `CODEX_HOME` 各自生成独立 `state/logs/goals/memories` sqlite。
- **`CODEX_HOME` 是唯一真隔离手段**;`--profile`(只 layer `$CODEX_HOME/<name>.config.toml`)、`-C/--cd` 都**不是**隔离手段。
- 临时 `CODEX_HOME` 起 app-server **不回写**共享 `~/.codex`(快照实测无变化)。
- **同一 `CODEX_HOME` 并发首启不安全**(两实例同时启动只有一个存活);顺序启动可共享 WAL。→ 每通道必须唯一 `CODEX_HOME`。
- 共享 `~/.codex` 能启动但语义串台(thread/logs/goals/memories/global-state 混在一起)。

---

## 4. 通道模型

| | `default`(legacy) | `named`(A/B/...) |
|---|---|---|
| 端口 | `4500/4501/4502`(不变) | stride `base=4500+i*10`,app=base / proxy=base+1 / control=base+2 |
| state 目录 | 现有默认目录(不变) | `<base>/channels/<id>/`(独立) |
| `CODEX_HOME` | 继承 `~/.codex`(**不隔离**,保老用户 resume/memory) | `<base>/codex-home/<id>/`(独立 sqlite/sessions/memories/goals) |
| 保活 | LaunchAgent `com.user.agentbridge` 注入 `IDLE_SHUTDOWN_MS=2147483647`(永不自杀,实测) | 无自动保活;idle 后进 `stopped`,按需重启(见契约 6) |
| 触发 | 裸 `claude` / 不带 `--channel` 的 `abg claude` | `abg claude --channel X` / `abg codex --channel X` |

> 向后兼容是硬要求:不带 `--channel` 时行为与今天 100% 一致;`default` 同时是天然回滚路径。

---

## 5. ChannelProfile / 目录布局

```
ChannelProfile = { channelId, controlPort, codexAppPort, codexProxyPort, stateDir, codexHome }
```

```
<base = 现 StateDirResolver 目录, 如 ~/Library/Application Support/AgentBridge>
  channels/
    registry.json          # { schemaVersion, channels: { <id>: ChannelProfile } }
    registry.lock          # O_CREAT|O_EXCL 锁(never fail-open)
    registry.json.bak      # 原子写前备份
    <id>/                  # per-channel state: daemon.pid / daemon.lock / killed / status.json / codex-tui.pid / log
  codex-home/
    <id>/                  # per-channel CODEX_HOME
      auth.json   -> symlink ~/.codex/auth.json      # 共享登录(实测 codex login 跟随 symlink 写目标,不断链)
      config.toml          # 生成(见契约 2),不可 symlink/copy 整份
      plugins/ .tmp/ -> symlink ~/.codex/*           # 共享插件缓存,免每通道重复 git fetch
      *.sqlite / sessions / memories / goals         # 各自独立
```

**端口分配机制**:`channel-profile.ts` 在 registry lock 内,用本地 TCP connect 探测端口空闲(实测安全:不 spawn codex、不碰 `CODEX_HOME`),分配后 `temp+rename` 原子写 registry。registry O_CREAT|O_EXCL 锁经 16 并发实测分配 16/16 唯一。(PoC 脚本不做探测,按 index 手算端口 —— 见 §7。)

---

## 6. 实现前必补契约(9 项,实现完成的验收基线)

> 这些是经第 4/5 轮 completeness 审核确定的"周到性"基线 —— v3 缺它们不可实现,补齐即 implementation-ready。第 6 轮 artifact 审核进一步收紧了契约 2 / 6 / 8 的措辞精度。

1. **[critical] Channel identity 不变量** — kill/attach/reconnect **前**必须校验目标活进程 `/healthz` 返回的 `{channelId, controlPort, pid}` 三者与目标 profile 全匹配,不符即拒。防损坏 state 目录导致 `kill B` 误杀 A。daemon 的 `/healthz`、`status.json`、log 前缀都必须含 `channelId`。

2. **[critical] config 结构化生成**(TOML AST 遍历,**禁止字符串替换**)— per-channel `config.toml` 从 root config 生成。规则(第 6 轮修正):
   - 实现须先 `rootCodexHome = realpath(CODEX_HOME ?? ~/.codex)`——**实际 config 写的是绝对路径** `/Users/ds/.codex`,不是字面 `~/.codex`,必须按 resolved 真实路径匹配。
   - 重写值为 `rootCodexHome` **后代路径**的字段:`CODEX_HOME`、`NODE_REPL_TRUSTED_CODE_PATHS`、以及 spot-check 发现的 `NODE_REPL_NODE_PATH`/`NODE_REPL_NODE_MODULE_DIRS`/`CODEX_CLI_PATH`(仅当指向 `rootCodexHome` 下)。
   - **明确的目录映射**(不可只写"对应目录"):`notify`(`config.toml:7`)→ `computer-use/` 子树;`marketplaces.*.source`(`:56`)→ `.tmp/bundled-marketplaces/`;`plugins/`、`.tmp/` → 同名子目录。先把这些目录 symlink 进 channel home,再把字段值重写为 channel 路径。**target 不存在时**:跳过该字段并 log warning,不 fail。
   - 非 `rootCodexHome` 下的路径(`/opt/homebrew`、`~/.cache/codex-runtimes/...`)**保留**。`[projects."..."]` `trust_level`(`:9-19`)**保留**(workspace 信任,非 Codex home 状态)。
   - 生成 config `0600`、**不新增 secret、绝不日志输出**(spot-check 实测当前 config 无 secret-like 字段,此为防御性规范)。

3. **[critical] 两通道零串台 E2E 测试** — 起 2 条真实/fake-protocol 完整通道,断言:各自 `/healthz` 的 `channelId` 正确;A 的 Claude 消息**只**到 A 的 Codex,B 同理。现有 `src/e2e-cli.test.ts` 是单 daemon 形状,需扩展。

4. **[critical] registry 健壮性** — v1 必须:`schemaVersion` 字段 + atomic write(temp+rename)+ `.bak` + 损坏时 **fail-closed** 带明确修复提示。(从 channel 目录完整 rebuild 可 follow-up。)

5. **[major] named 启动顺序契约** — `abg codex --channel X` 在 `abg claude --channel X` 之前运行时应 **fail**(不隐式 allocate),提示"先运行 `abg claude --channel X` 或 `abg channel create X`"。

6. **[major] stopped ≠ stale 生命周期** — `abg list` 五态:`running / stopped / stale-dead / blocked-port / corrupt`。named daemon idle-shutdown 后是 `stopped`(profile 保留可复用,**不被 gc**)。**named 不注入无限保活**:沿用现有默认 30s,无客户端后进 `stopped`、按需重启,避免多通道堆积高 RSS daemon;`default` 经 LaunchAgent 注入 `IDLE_SHUTDOWN_MS=2147483647` 永久保活(实测)。`abg gc` 只清 `stale-dead`/`corrupt`/missing;`blocked-port` 绝不自动 reclaim(需 `--force` 或新 index)。

7. **[major] auth refresh 并发策略** — auth.json 用 symlink 共享(优于复制:复制会让多份持旧 rotating refresh-token 分叉)。AgentBridge 侧 `auth.lock`(O_CREAT|O_EXCL)**只锁自己的 repair/promote 流程**:启动时检查 channel auth 若变成 regular file → 比 mtime → 必要时 lock 内 promote 到 shared 并重建 symlink。运行时 token refresh 交给 Codex 原子写(我们不承诺锁住 Codex 自身的并发 refresh);共享 auth 被破坏则 repair 或重新登录。警告/不鼓励在 named 通道内 `codex logout`(会删 symlink)。

8. **[major] checkPorts 改 channel-scoped** — 现有 `checkPorts()`(`codex-adapter.ts:1235`)只要命令行含 `codex app-server` 且占目标端口就 kill → 多通道下会**误杀邻居通道**。必改为(第 6 轮修正):只杀本 channel `status.json` 记录的 `codexAppServerPid`,且验证该 pid 仍存在 + 其 cmdline 为 `codex app-server`(最好再校 parent / start-time)。**注意:codex app-server 不暴露 daemon 的 `/healthz`(那是 control server 的端点),故不能用 health 判活,只能用"记录 pid + cmdline 校验"**。缺失/不符 → 标 `blocked-port`,不杀。

9. **[critical] channelId 语法/路径安全** — `parseChannelId` 只允许 `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`;禁 `/`、`..`、空白、控制字符;保留名 `default`/`all`/`list`/`status`/`gc`/`kill`/`create` 不可作 named id;所有路径只由 resolver `join`,绝不接受用户传入路径。

**文件权限汇总**:named 的 dirs/registry `0700`、生成 config `0600`、auth 源保持 `0600`、symlink target 校验。

---

## 7. 实现切分(5 PR,每步可独立验证)

| PR | 改动 | 测试 |
|---|---|---|
| **PR1 channel-profile 核心** | 新增 `channel-profile.ts`:`parseChannelId`(契约 9)、legacy default、`allocate`/`read`、registry lock(契约 4,never-fail-open)、atomic write、端口 TCP 探测、home setup(auth symlink + 生成 config[契约 2] + plugins/.tmp symlink) | 并发分配唯一性、非法/保留 id、default=legacy、端口冲突标记、config 路径重写正确且无 `rootCodexHome` 残留 |
| **PR2 CLI env + 配对** | `cli/claude.ts`/`cli/codex.ts`/`cli/kill.ts`:消费 `--channel`、resolve profile、注入 6 个 env(`AGENTBRIDGE_CHANNEL_ID`/`_CONTROL_PORT`/`CODEX_WS_PORT`/`CODEX_PROXY_PORT`/`_STATE_DIR`/`CODEX_HOME`)、codex 模式**禁 fallback** 默认 proxy(`cli/codex.ts:56-64`)、启动顺序契约(契约 5);新增 `abg list` | argv 剥离 `--channel`、env 正确透传给 shim、named 通道 codex 不 fallback、启动顺序 fail |
| **PR3 lifecycle/spawn 显式 env** | `DaemonLifecycleOptions` 接受 channel env/profile,`launch()`(`daemon-lifecycle.ts:221`)**显式写全套 env**(不再依赖继承);`CodexAdapter.start()` spawn codex 时显式传 env | fake daemon/app-server 收到 `CODEX_HOME`/`CODEX_WS_PORT`/`CODEX_PROXY_PORT`;从无 env 的父进程启动也能拿到 profile 值 |
| **PR4 可观测性 + identity** | `daemon.ts`/`bridge.ts` 计算 `channelId`,写入 ready/waiting 消息、`/healthz`、`status.json`、log 前缀;实现契约 1 identity 校验;checkPorts channel-scoped(契约 8,记录 `codexAppServerPid` 到 status.json) | healthz/status 含 channelId、裸 env 报 default、identity 不匹配拒绝、checkPorts 不跨通道杀 |
| **PR5 cleanup + gc** | `kill <id>` / `kill --all`(遍历 registry per-profile)/ `list --json` / `gc`(契约 6 五态) | 两个临时 state 目录:杀一个不碰另一个;stale-dead 清理;blocked-port 不自动 reclaim;两通道零串台 E2E(契约 3) |

---

## 8. Follow-up(不阻塞 v1)
- registry 从 channel 目录完整 rebuild(v1 只需 schemaVersion + fail-closed)。
- named 通道 LaunchAgent 保活(v1 named = foreground/session-scoped)。
- `abg-restart --channel`:该脚本已支持 `ABG_CONTROL_PORT`/`AGENTBRIDGE_STATE_DIR` env override,适配成本低;需处理"同目录两通道 tmux session name 撞车"+ 文档标注 default-only/channel 用法。
- 显式 `abg auth repair` 命令(v1 用 launch-time 自动修复即可)。
- richer `abg list` UI、首启缓存优化。
- 跨平台(Linux)、`lsof` 缺失 fail-closed、Codex/Bun 版本漂移 → 进 `doctor` + CI matrix。

---

## 9. 资源账(实测 RSS,上界粗估)
- daemon ~89MB、native app-server ~237MB、node wrapper ~49MB、bridge ~53MB。
- 每 named 通道(daemon + app-server)~385MB;含 Codex TUI ~628MB。
- N=3 ≈ 1.9GB,N=5 ≈ 3.1GB(RSS 含重复计算的共享页,为上界)。

---

## 10. 协作与验证记录(决策依据)

| 轮 | 焦点 | 产出 | Claude 独立 spot-check |
|---|---|---|---|
| 1 | 双路独立分析 | 收敛方案 A;`CODEX_HOME` 是唯一真隔离 | 读全 daemon/adapter/lifecycle 源码核实 5 单例点 |
| 2 | Builder+Critic 实测 | 修正 default=legacy / auth=symlink(非复制)/ registry never-fail-open;砍 unix socket | 无 `flock`;RSS 吻合;16 并发 O_EXCL 分配 16/16 唯一 |
| 3 | v2 终审 | 发现 config 绝对路径泄漏;5-PR 切分 | 读 `~/.codex/config.toml` 实证 ≥5 处绝对路径泄漏面 |
| 4 | completeness | 裁定"v3 不够周到"+ 8 盲区;实测 CODEX_HOME 隔离干净 / 同-home 首启竞态 | 实证 default 永不自杀(`IDLE_SHUTDOWN_MS=2147483647`)+ abg-restart 已 env-overridable |
| 5 | 终极确认 | **二元裁决:YES,可进入实现**;4 契约修正 + registry 上调 v1 + 第 9 点 grammar | 实证 config 无 secret + 补全契约 2 字段清单 |
| 6 | artifact 审核(本 doc + PoC) | doc 修正 §2 env 措辞忠实性偏差、契约 2 realpath/目录映射、契约 8 checkPorts predicate(app-server 无 /healthz)、契约 6 idle 定值、行号 1241→1235;PoC 修复 index/grammar 校验、ln 嵌套、zsh glob、source 污染、权限 | spot-check 坐实 PoC 三 bug(index 撞 default / ln 嵌套 / zsh no-match)+ 核对 doc file:line 全准 |

**最终裁决(双路一致)**:v4(= 上述架构 + 9 契约)**足够全面周到、可进入实现**;不再有阻塞实现的新设计维度,剩余为实现纪律与测试覆盖。本文档与 PoC 经第 6 轮双路 artifact 审核修正后,可作为可靠实现 spec。
