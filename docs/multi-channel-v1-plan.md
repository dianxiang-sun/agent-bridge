# AgentBridge 多通道 v1 实现计划(PR1–PR5 TDD)

> **For agentic workers:** 本计划由 `/goal docs/multi-channel-implementation-goal.md` 协议驱动执行,**不**走 subagent-driven auto-commit。Steps 用 checkbox(`- [ ]`)跟踪。
> **⚠️ Commit-step 覆盖(硬约束)**:本计划下**禁止任何 `git add/commit/push/branch` step**。writing-plans skill 默认的 "Step: Commit" 一律替换为 **Exit gate = 跑该 PR 测试 + `bun run typecheck` + `git diff` 只读 review + 更新 V1_PROGRESS.md + phase gate 暂停等用户**。commit/push/PR 由用户在审批后手动做。

**Goal:** 把 `docs/multi-channel-design.md`(SSOT)的方案 A —— 每条 named 通道一个独立 daemon 三元组(daemon 内部拓扑零改)—— 实现为可用功能,9 契约全落地、两通道零串台、`default` 零回归。

**Architecture:** 新增 `channel-profile.ts` 做外层 channel 编排(parse/allocate/registry/port-probe/home-setup);CLI 消费 `--channel` 解析 profile 并注入 6 个 env;`DaemonLifecycle.launch()` 与 `CodexAdapter.start()` spawn 时**显式**传完整 profile env(不靠 `...process.env` 继承);daemon 把 `channelId` 写进 healthz/status/log/消息并做 identity 校验;`checkPorts` 改 channel-scoped。`default` 通道走 legacy 路径(4500/4501/4502 + 现 state dir + 继承 `~/.codex`)完全不变。

**Tech Stack:** Bun runtime;TypeScript(`tsc --noEmit`);测试 `bun:test`(`bun test src`);Node fs/net;TOML round-trip(见 Global Constraints 决策点)。

## Global Constraints(每个 task 隐含包含)

- **运行时 Bun**,勿改本地 Bun 版本;提交前必过 `bun run typecheck && bun test src/`(项目 CLAUDE.md)。
- **禁止任何 git write**(add/commit/push/branch/checkout/merge/rebase/stash/tag/fetch/pull)在执行内发生;只读 `git status/diff/log/show`。仓库 push-gated。
- **PR1 写第一行实现代码前必须不在 `master`/`main`**(只读 `git rev-parse --abbrev-ref HEAD` 确认);否则 `BLOCKED:PR1-entry:need feature branch/worktree`,由用户/主会话建分支。
- **SSOT 只读**:实现中若发现与 `docs/multi-channel-design.md` 冲突 → 停,标 `BLOCKED`,不静默改架构。
- **Non-goals(碰到就停)**:不做 daemon 内 `Map<channelId>`;不做 fan-out/N:M;不做 unix socket;不做 named LaunchAgent 保活;不改 `default` legacy 语义。
- **端口 stride**:named `base = 4500 + i*10`(i≥1),app=base / proxy=base+1 / control=base+2。`default` 固定 4500/4501/4502 不分配。
- **文件权限**:named dirs/registry `0700`;生成 config `0600`;auth 源 `0600`;symlink target 校验。
- **`V1_PROGRESS.md`**:本地 gitignored ledger;每 PR done 带 `Done evidence:` 行(格式见 goal spec §4);更新仅 contextual Edit/MultiEdit + 唯一 L-id 锚。
- **TOML 决策(PR1 Task 1.7 前置)**:项目无 TOML 库(实测 `grep -rniE toml` 全空)。契约 2 要结构化 round-trip(禁字符串替换)。**默认采用候选 A = 加 `smol-toml` 依赖**(纯 TS、parse+stringify round-trip)。⚠️ 加 dep 需用户 APPLY;若用户改选 B(vendor 最小 TOML)/C(structured emitter 子集),**仅 Task 1.7 的 step 替换**,其余 task 不变。

---

## File Structure

**新增:**
- `src/channel-profile.ts` — channel 编排核心:`parseChannelId` / `ChannelProfile` / `defaultProfile` / `ChannelRegistry`(allocate/read/list/lock/atomic-write)/ TCP port probe / channel home setup(symlink + 生成 config)/ 状态分类。
- `src/channel-config.ts` — 契约 2 的 config.toml 结构化生成(从 root config 解析→重写 home 后代路径→保留 `[projects.*]`/非-home 路径)。拆出独立文件因其单一职责(TOML 变换)且测试面大。
- `src/cli/list.ts` — `abg list`(`--json` 五态)。
- `src/cli/channel.ts` — `abg channel create <id>`(显式分配,供契约 5 提示)。
- `src/cli/gc.ts` — `abg gc`。
- 测试:`src/unit-test/channel-profile.test.ts`、`src/unit-test/channel-config.test.ts`、`src/unit-test/channel-cli.test.ts`、`src/unit-test/channel-lifecycle-env.test.ts`、`src/unit-test/channel-identity.test.ts`、`src/unit-test/channel-e2e.test.ts`(零串台)。

**修改:**
- `src/cli/claude.ts` — 消费 `--channel`(allocate)、注入 6 env、剥离 `--channel`。
- `src/cli/codex.ts` — 消费 `--channel`(read-only,禁 allocate)、注入 6 env、named **禁 fallback** 默认 proxy(现 `:56-64`)、启动顺序契约 5。
- `src/cli/kill.ts` — `kill <id>` / `kill --all`、channel env。
- `src/cli.ts` — `--channel` 路由 + 新子命令注册。
- `src/daemon-lifecycle.ts` — `DaemonLifecycleOptions` 加 channel env;`launch()`(`:217-232`)显式写全套 env。
- `src/codex-adapter.ts` — `start()`(`:140-163`)spawn 显式传 env;`checkPorts()`(`:1235`)改 channel-scoped;暴露 `appServerPid`。
- `src/daemon.ts` — `channelId` 进 `currentStatus()`(`:837`)/`writeStatusFile()`(`:886`)/log/ready-waiting 消息(`:851-857`);identity 校验(契约 1)。
- `src/control-protocol.ts` — `DaemonStatus` 加 `channelId: string` + `controlPort: number` + `codexAppServerPid?: number`。

---

## Shared Interfaces(全 PR 共享,先锁定)

```ts
// src/channel-profile.ts
export interface ChannelProfile {
  channelId: string;     // "default" 或经 parseChannelId 校验的 named id
  controlPort: number;   // default:4502;named:base+2
  codexAppPort: number;  // default:4500;named:base
  codexProxyPort: number;// default:4501;named:base+1
  stateDir: string;      // default:StateDirResolver base;named:<base>/channels/<id>
  codexHome: string;     // default:process.env.CODEX_HOME ?? ~/.codex;named:<base>/codex-home/<id>
}

export const RESERVED_IDS = ["default", "all", "list", "status", "gc", "kill", "create"] as const;
export function parseChannelId(raw: string): string;               // 非法/保留 → throw Error
export function defaultProfile(): ChannelProfile;                   // legacy,不分配端口
export function channelsBaseDir(): string;                          // <StateDirResolver base>/channels
export function codexHomeBaseDir(): string;                         // <StateDirResolver base>/codex-home

export type ChannelState = "running" | "stopped" | "stale-dead" | "blocked-port" | "corrupt";

export class ChannelRegistry {
  constructor(baseDir?: string);                                   // 默认 StateDirResolver base
  read(channelId: string): ChannelProfile | null;
  list(): ChannelProfile[];
  allocate(channelId: string): ChannelProfile;                     // lock 内 probe+写;named 专用
  remove(channelId: string): void;                                 // gc/kill --all 用
}

// 6 个注入 env 的规范 key(PR2 注入 / PR3 消费)
export const CHANNEL_ENV_KEYS = {
  channelId: "AGENTBRIDGE_CHANNEL_ID",
  controlPort: "AGENTBRIDGE_CONTROL_PORT",
  codexAppPort: "CODEX_WS_PORT",
  codexProxyPort: "CODEX_PROXY_PORT",
  stateDir: "AGENTBRIDGE_STATE_DIR",
  codexHome: "CODEX_HOME",
} as const;
export function profileToEnv(p: ChannelProfile): Record<string, string>;  // 6 env
export function parseChannelFlag(argv: string[]): { channelId: string | null; rest: string[] };
```

```ts
// src/channel-config.ts
// 契约 2:结构化生成 per-channel config.toml(默认 smol-toml round-trip)
export function generateChannelConfig(rootConfigText: string, rootCodexHome: string, channelCodexHome: string): string;
```

---

# PR1 — `channel-profile.ts` 核心

> SSOT:design §5、§6 契约 2/4/9、§7 PR1。Done 判据:`bun test src/unit-test/channel-profile.test.ts src/unit-test/channel-config.test.ts` 全绿 + `bun run typecheck` clean。

### Task 1.1: `parseChannelId`(契约 9)

**Files:** Create `src/channel-profile.ts`;Test `src/unit-test/channel-profile.test.ts`
**Interfaces:** Produces `parseChannelId(raw): string`、`RESERVED_IDS`

- [ ] **Step 1: 写失败测试**
```ts
import { describe, expect, test } from "bun:test";
import { parseChannelId } from "../channel-profile";

describe("parseChannelId (契约9)", () => {
  test("接受合法 id", () => {
    for (const id of ["A", "proj-1", "a.b_c", "X".repeat(64)]) {
      expect(parseChannelId(id)).toBe(id);
    }
  });
  test("拒保留名", () => {
    for (const id of ["default", "all", "list", "status", "gc", "kill", "create"]) {
      expect(() => parseChannelId(id)).toThrow();
    }
  });
  test("拒路径遍历 / 非法字符 / 空 / 超长 / 首字符非字母数字", () => {
    for (const id of ["a/b", "..", "a..b", "../x", " a", "a b", "a\tb", "", "_lead", ".lead", "-lead", "X".repeat(65)]) {
      expect(() => parseChannelId(id)).toThrow();
    }
  });
});
```
- [ ] **Step 2: 跑确认 red** — `bun test src/unit-test/channel-profile.test.ts` → FAIL(`parseChannelId` 未定义)
- [ ] **Step 3: 最小实现**
```ts
export const RESERVED_IDS = ["default", "all", "list", "status", "gc", "kill", "create"] as const;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export function parseChannelId(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) throw new Error(`Invalid channel id: empty`);
  if ((RESERVED_IDS as readonly string[]).includes(raw)) throw new Error(`Reserved channel id: '${raw}'`);
  if (raw.includes("..") || raw.includes("/")) throw new Error(`Channel id contains path-traversal chars: '${raw}'`);
  if (!ID_RE.test(raw)) throw new Error(`Invalid channel id '${raw}': allow [A-Za-z0-9._-], first char alnum, ≤64`);
  return raw;
}
```
- [ ] **Step 4: 跑确认 green** — `bun test src/unit-test/channel-profile.test.ts` → PASS
- [ ] **Step 5: Exit micro-gate** — `bun run typecheck` clean(无 commit)

### Task 1.2: `defaultProfile` legacy + base dir helpers

**Files:** Modify `src/channel-profile.ts`;Test 同上
**Interfaces:** Consumes `StateDirResolver`(state-dir.ts)。Produces `defaultProfile()`、`channelsBaseDir()`、`codexHomeBaseDir()`

> ⚠️ base dir 必须取 **canonical default**(不受 per-channel `AGENTBRIDGE_STATE_DIR` override 影响),否则 named 的 `channels/` 会落进某条通道目录里。用 `new StateDirResolver(undefined)` 时它仍读 env override——故 helper 显式传 `platform` 默认路径,**不**读 `AGENTBRIDGE_STATE_DIR`。

- [ ] **Step 1: 写失败测试**
```ts
import { defaultProfile } from "../channel-profile";
import { homedir } from "node:os";
import { join } from "node:path";

test("defaultProfile = legacy 端口,不分配", () => {
  const p = defaultProfile();
  expect(p.channelId).toBe("default");
  expect(p.controlPort).toBe(4502);
  expect(p.codexAppPort).toBe(4500);
  expect(p.codexProxyPort).toBe(4501);
  expect(p.codexHome).toBe(process.env.CODEX_HOME ?? join(homedir(), ".codex"));
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `defaultProfile()` 返回固定端口 + `stateDir = new StateDirResolver().dir` + `codexHome = process.env.CODEX_HOME ?? join(homedir(),".codex")`;`channelsBaseDir()`/`codexHomeBaseDir()` 用**不读 env override** 的 canonical base(新增 `StateDirResolver` 静态 `canonicalBase()` 或在 helper 内复算 darwin/linux 路径)拼 `channels`/`codex-home`。
- [ ] **Step 4: 跑确认 green**
- [ ] **Step 5: micro-gate** typecheck

### Task 1.3: registry 原子写 + schemaVersion + .bak + 损坏 fail-closed(契约 4)

**Files:** Modify `src/channel-profile.ts`;Test 同上
**Interfaces:** Produces `ChannelRegistry`(先实现 `read`/`list` + 内部 `writeAtomic`)

- [ ] **Step 1: 写失败测试**(用 `mkdtempSync` 临时 base,模式同 `config-service.test.ts:7-49`)
```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChannelRegistry } from "../channel-profile";

describe("ChannelRegistry atomic + robustness (契约4)", () => {
  let base: string;
  beforeEach(() => { base = mkdtempSync(join(tmpdir(), "abg-reg-")); });
  afterEach(() => { rmSync(base, { recursive: true, force: true }); });

  test("read 不存在 → null;list → []", () => {
    const r = new ChannelRegistry(base);
    expect(r.read("X")).toBeNull();
    expect(r.list()).toEqual([]);
  });
  test("损坏 registry → fail-closed throw(不 fail-open 返回空)", () => {
    const dir = join(base, "channels"); writeFileSync(join(dir, "registry.json"), "{ broken", { flag: "w" });
    // 注:dir 需先建;实现里 read 解析失败必须 throw,带修复提示
    expect(() => new ChannelRegistry(base).read("X")).toThrow(/corrupt|repair/i);
  });
  test("写后有 schemaVersion + .bak", () => {
    const r = new ChannelRegistry(base);
    (r as any).writeAtomic({ schemaVersion: 1, channels: { A: { channelId: "A" } } });
    (r as any).writeAtomic({ schemaVersion: 1, channels: { A: { channelId: "A" }, B: { channelId: "B" } } });
    const reg = JSON.parse(readFileSync(join(base, "channels", "registry.json"), "utf-8"));
    expect(reg.schemaVersion).toBe(1);
    expect(existsSync(join(base, "channels", "registry.json.bak"))).toBe(true);
  });
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `read()`/`list()` 读 `<base>/channels/registry.json`:不存在→null/[];存在但 `JSON.parse` 失败→`throw new Error("registry.json corrupt — run 'abg gc' or repair: <path>")`(fail-closed)。`writeAtomic(obj)`:`ensureDir(0700)` → 若存在旧文件先 `copyFileSync(reg, reg+".bak")` → 写 `reg+".tmp"` → `renameSync(tmp, reg)`。schemaVersion 常量 `REGISTRY_SCHEMA_VERSION = 1`。
- [ ] **Step 4: 跑确认 green**
- [ ] **Step 5: micro-gate** typecheck

### Task 1.4: registry O_EXCL lock(never fail-open)+ 并发分配唯一

**Files:** Modify `src/channel-profile.ts`;Test 同上
**Interfaces:** 内部 `withLock<T>(fn): T`(O_CREAT|O_EXCL,**never fail-open**)

> ⚠️ 与 `daemon-lifecycle.ts:243-277` 的 lock 不同:那个在非-EEXIST 错误时 `return true`(fail-open,可接受因 daemon 单点);registry lock **绝不 fail-open**——拿不到锁就重试/抛错,绝不无锁继续写。

- [ ] **Step 1: 写失败测试**(并发 16,断言端口/index 唯一)
```ts
test("并发 16 allocate 唯一(契约4 never fail-open)", async () => {
  const r = new ChannelRegistry(base);
  const ids = Array.from({ length: 16 }, (_, i) => `c${i}`);
  const profiles = await Promise.all(ids.map((id) =>
    Promise.resolve().then(() => r.allocate(id))));
  const ctrlPorts = new Set(profiles.map((p) => p.controlPort));
  expect(ctrlPorts.size).toBe(16);                 // 无重复端口
  expect(new Set(profiles.map((p) => p.stateDir)).size).toBe(16);
});
```
- [ ] **Step 2: 跑确认 red**(`allocate` 尚未实现 → red;本 task 落 lock 骨架,Task 1.5 落 probe+分配)
- [ ] **Step 3: 最小实现** — `withLock`:循环 `openSync(lockFile, O_CREAT|O_EXCL|O_WRONLY)`;EEXIST → 检查 holder pid 活否(复用 `isProcessAlive`),死锁清理重试,活锁短 sleep 重试(有限次后 throw,**不**无锁继续);非-EEXIST → throw(never fail-open)。`finally` `unlinkSync(lockFile)`。
- [ ] **Step 4: 跑确认 green**(配合 Task 1.5 的 allocate 一并转 green;本 task 先让 lock 单元测试[直接测 withLock 串行化]过)
- [ ] **Step 5: micro-gate** typecheck

### Task 1.5: TCP 端口探测 + `allocate()` 整合

**Files:** Modify `src/channel-profile.ts`;Test 同上
**Interfaces:** Consumes `withLock`、`writeAtomic`、`read`。Produces `allocate(channelId): ChannelProfile`、内部 `isPortFree(port): Promise<boolean>`

- [ ] **Step 1: 写失败测试**
```ts
import { createServer } from "node:net";
test("allocate 跳过被占 index(TCP probe)", async () => {
  // 占住 index=1 的 app 端口 4510,断言 allocate 选更高 index
  const blocker = createServer().listen(4510, "127.0.0.1");
  await new Promise((res) => blocker.once("listening", res));
  try {
    const p = new ChannelRegistry(base).allocate("probe-test");
    expect(p.codexAppPort).not.toBe(4510);
    expect(p.codexAppPort % 10).toBe(0);            // base = 4500 + i*10
    expect(p.controlPort).toBe(p.codexAppPort + 2);
  } finally { blocker.close(); }
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `isPortFree(port)`:`net.connect({port,host:"127.0.0.1"})`;`connect` 事件→占用(false);`error` 且 `ECONNREFUSED`→空闲(true);`timeout`(200ms)→保守占用(false)。`allocate(id)` 在 `withLock` 内:从 `i=1` 递增算 `base=4500+i*10`,跳过 registry 已用 + 任一三元组端口非空闲者,得首个全空闲 index;构造 `ChannelProfile`(stateDir=`channelsBaseDir()/id`,codexHome=`codexHomeBaseDir()/id`);`writeAtomic` 入 registry;返回。
- [ ] **Step 4: 跑确认 green**(含 Task 1.4 并发唯一测试转 green)
- [ ] **Step 5: micro-gate** typecheck

### Task 1.6: channel home setup(dirs 0700 + auth/plugins/.tmp symlink)

**Files:** Modify `src/channel-profile.ts`;Test 同上
**Interfaces:** Produces `setupChannelHome(profile, rootCodexHome?): void`(symlink 部分;config 生成在 Task 1.7)

- [ ] **Step 1: 写失败测试**
```ts
import { lstatSync, mkdirSync, writeFileSync as wf, readlinkSync, statSync } from "node:fs";
test("home setup:目录 0700 + auth/plugins/.tmp symlink 指向 root", () => {
  const root = join(base, "fake-codex"); mkdirSync(root, { recursive: true });
  wf(join(root, "auth.json"), "{}"); mkdirSync(join(root, "plugins")); mkdirSync(join(root, ".tmp"));
  const r = new ChannelRegistry(base); const p = r.allocate("home-test");
  const { setupChannelHome } = require("../channel-profile");
  setupChannelHome(p, root);
  expect(statSync(p.codexHome).mode & 0o777).toBe(0o700);
  expect(lstatSync(join(p.codexHome, "auth.json")).isSymbolicLink()).toBe(true);
  expect(readlinkSync(join(p.codexHome, "auth.json"))).toBe(join(root, "auth.json"));
  expect(lstatSync(join(p.codexHome, "plugins")).isSymbolicLink()).toBe(true);
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `mkdirSync(codexHome,{recursive:true,mode:0o700})` + `chmodSync(...,0o700)`;对 `auth.json`/`plugins`/`.tmp`:root 侧存在才建 symlink(dest 不存在或已是 symlink 才动,真目录跳过+warn——逻辑同 PoC `_abg_mc_link`);用 `symlinkSync(rootTarget, channelTarget)`。
- [ ] **Step 4: 跑确认 green**
- [ ] **Step 5: micro-gate** typecheck

### Task 1.7: config.toml 结构化生成(契约 2) — ⚠️ TOML 决策 = 候选 A(smol-toml)

**Files:** Create `src/channel-config.ts`;Test `src/unit-test/channel-config.test.ts`
**Interfaces:** Produces `generateChannelConfig(rootConfigText, rootCodexHome, channelCodexHome): string`;`setupChannelHome` 调它写 `0600`
**⚠️ 决策契约:** 本 task 基于 TOML 候选 A(加 `smol-toml`)。若用户选 B/C,**仅本 task 的 step 替换**(其余 task 不变)。

- [ ] **Step 0(前置,需用户 APPLY):** 加依赖。提议 `bun add smol-toml`(改 package.json + bun.lock + 网络拉取 = 文件/网络 mutate → **需用户显式 APPLY 才执行**)。在 APPLY 前本 task BLOCKED。
- [ ] **Step 1: 写失败测试**
```ts
import { describe, expect, test } from "bun:test";
import { generateChannelConfig } from "../channel-config";

describe("generateChannelConfig (契约2)", () => {
  const ROOT = "/Users/ds/.codex";
  const CH = "/tmp/abg/codex-home/A";
  test("重写 home 后代路径 + 无 rootCodexHome 残留 + 保留 [projects.*] / 非-home 路径", () => {
    const src = [
      `notify = "${ROOT}/computer-use/notify.js"`,
      `[tools]`,
      `web_search = true`,
      `[[marketplaces]]`,
      `source = "${ROOT}/.tmp/bundled-marketplaces/x"`,
      `[shell_environment_policy]`,
      `NODE_REPL_TRUSTED_CODE_PATHS = "${ROOT}/plugins"`,
      `EXTERNAL = "/opt/homebrew/bin"`,
      `[projects."/Users/ds/work"]`,
      `trust_level = "trusted"`,
    ].join("\n");
    const out = generateChannelConfig(src, ROOT, CH);
    expect(out).not.toContain(ROOT);                 // 无 root 后代残留
    expect(out).toContain(`${CH}/computer-use/notify.js`);
    expect(out).toContain(`${CH}/.tmp/bundled-marketplaces/x`);
    expect(out).toContain(`${CH}/plugins`);
    expect(out).toContain("/opt/homebrew/bin");      // 非-home 保留
    expect(out).toContain(`[projects."/Users/ds/work"]`); // trust 保留
    expect(out).toContain(`trust_level = "trusted"`);
  });
  test("target 字段指向不存在路径 → 跳过该字段不 fail(此处仅验不抛)", () => {
    expect(() => generateChannelConfig(`foo = "x"`, ROOT, CH)).not.toThrow();
  });
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `import { parse, stringify } from "smol-toml"`;`const root = realpathSync(rootCodexHome)`;`const ast = parse(rootConfigText)`;递归遍历 string 值:若以 `root + sep` 开头 → 按映射重写(`notify`→`computer-use/` 子树、`marketplaces.*.source`→`.tmp/bundled-marketplaces/`、`NODE_REPL_*`/`CODEX_CLI_PATH` 等 home 后代 → 同相对子路径下的 channelCodexHome);非-home(`/opt/homebrew`、`~/.cache/...`)与 `[projects.*]` 不动;`stringify(ast)` 返回。写盘时 `0600`、不新增 secret、不日志输出。
- [ ] **Step 4: 跑确认 green**
- [ ] **Step 5: PR1 Exit gate** — `bun test src/unit-test/channel-profile.test.ts src/unit-test/channel-config.test.ts` 全绿 + `bun run typecheck` clean + `git diff --stat`(只读,确认仅预期文件)+ 更新 `V1_PROGRESS.md` L1.1 → done + `Done evidence:` 行 + **phase gate 暂停等用户**。

---

# PR2 — CLI channel/env 配对

> SSOT:design §7 PR2、契约 5。Done:`bun test src/unit-test/channel-cli.test.ts src/unit-test/cli.test.ts` 全绿 + typecheck clean + **default 零回归**。

### Task 2.1: `parseChannelFlag` argv 解析 + 剥离

**Files:** Modify `src/channel-profile.ts`;Test `src/unit-test/channel-cli.test.ts`
**Interfaces:** Produces `parseChannelFlag(argv): { channelId: string|null; rest: string[] }`

- [ ] **Step 1: 写失败测试**
```ts
import { parseChannelFlag } from "../channel-profile";
test("剥离 --channel,rest 不含它;无 --channel → null", () => {
  expect(parseChannelFlag(["--channel", "A", "--resume"])).toEqual({ channelId: "A", rest: ["--resume"] });
  expect(parseChannelFlag(["--channel=A", "x"])).toEqual({ channelId: "A", rest: ["x"] });
  expect(parseChannelFlag(["--resume"])).toEqual({ channelId: null, rest: ["--resume"] });
});
test("非法 channel id 抛错", () => {
  expect(() => parseChannelFlag(["--channel", "../x"])).toThrow();
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — 扫 argv 找 `--channel <v>` 或 `--channel=<v>`,`parseChannelId(v)` 校验,从 rest 删这两个 token,返回。
- [ ] **Step 4: 跑确认 green** / **Step 5:** micro-gate typecheck

### Task 2.2: `abg claude --channel`(allocate + 6 env 注入)

**Files:** Modify `src/cli/claude.ts`;Test `src/unit-test/channel-cli.test.ts`
**Interfaces:** Consumes `parseChannelFlag`、`ChannelRegistry.allocate`、`profileToEnv`、`setupChannelHome`

- [ ] **Step 1: 写失败测试**(导出一个纯函数 `resolveClaudeChannelEnv(args): {env, rest}` 便于单测,不 spawn 真 claude)
```ts
test("claude --channel A → 6 env + rest 剥离 --channel", () => {
  const base = mkdtempSync(join(tmpdir(), "abg-cl-"));
  const { resolveClaudeChannelEnv } = require("../cli/claude");
  const { env, rest } = resolveClaudeChannelEnv(["--channel", "A", "--resume"], base);
  expect(env.AGENTBRIDGE_CHANNEL_ID).toBe("A");
  expect(Number(env.AGENTBRIDGE_CONTROL_PORT)).toBe(Number(env.CODEX_WS_PORT) + 2);
  expect(env.CODEX_HOME).toContain("codex-home/A");
  expect(env.AGENTBRIDGE_STATE_DIR).toContain("channels/A");
  expect(rest).toEqual(["--resume"]);
  rmSync(base, { recursive: true, force: true });
});
test("裸 claude(无 --channel)→ 不注入 channel env(default 零回归)", () => {
  const { resolveClaudeChannelEnv } = require("../cli/claude");
  const { env, rest } = resolveClaudeChannelEnv(["--resume"]);
  expect(env.AGENTBRIDGE_CHANNEL_ID).toBeUndefined();
  expect(rest).toEqual(["--resume"]);
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `runClaude` 开头 `parseChannelFlag(args)`;有 channelId → `allocate` + `setupChannelHome` + `profileToEnv` 合并进 `spawn` 的 `env`,用 rest 作下游 args;无 → 原路径(env 不变)。抽 `resolveClaudeChannelEnv` 纯函数供测。
- [ ] **Step 4: 跑确认 green** / **Step 5:** micro-gate typecheck

### Task 2.3: `abg codex --channel`(read-only,禁 fallback,启动顺序契约 5)

**Files:** Modify `src/cli/codex.ts`;Test 同上
**Interfaces:** Consumes `parseChannelFlag`、`ChannelRegistry.read`、`profileToEnv`

- [ ] **Step 1: 写失败测试**
```ts
test("codex --channel <未创建> → 非零退出 + 可读提示(契约5,不隐式 allocate)", () => {
  const base = mkdtempSync(join(tmpdir(), "abg-cx-"));
  const { resolveCodexChannelEnv } = require("../cli/codex");
  expect(() => resolveCodexChannelEnv(["--channel", "ghost"], base))
    .toThrow(/先运行|abg claude --channel|channel create/i);
  rmSync(base, { recursive: true, force: true });
});
test("named codex 用 profile proxy 端口,不 fallback config 默认", () => {
  const base = mkdtempSync(join(tmpdir(), "abg-cx2-"));
  const { ChannelRegistry } = require("../channel-profile");
  const p = new ChannelRegistry(base).allocate("real");
  const { resolveCodexChannelEnv } = require("../cli/codex");
  const { env } = resolveCodexChannelEnv(["--channel", "real"], base);
  expect(Number(env.CODEX_PROXY_PORT)).toBe(p.codexProxyPort);
  rmSync(base, { recursive: true, force: true });
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `resolveCodexChannelEnv`:有 channelId → `read`(不 allocate);null → `throw new Error("Channel '<id>' 未创建。先运行: abg claude --channel <id>  或  abg channel create <id>")`;有 → `profileToEnv`。named 模式下 proxyUrl 直接用 `ws://127.0.0.1:${profile.codexProxyPort}`,**绕过** `cli/codex.ts:56-64` 的 config fallback(仅 default 保留 fallback)。
- [ ] **Step 4: 跑确认 green** / **Step 5:** micro-gate typecheck

### Task 2.4: `abg kill --channel` env 配对

**Files:** Modify `src/cli/kill.ts`;Test 同上
- [ ] **Step 1–4:** 写失败测试(`kill --channel A` → 用 A 的 stateDir/controlPort 构造 lifecycle)→ red → 实现(`parseChannelFlag` → read profile → 用 profile.stateDir 建 `StateDirResolver(profile.stateDir)` + controlPort)→ green。`kill <id>` 全功能在 PR5;此 task 仅 `--channel` env 配对。
- [ ] **Step 5:** micro-gate typecheck

### Task 2.5: `abg list`(基础 registry 枚举)+ cli.ts 路由

**Files:** Create `src/cli/list.ts`、`src/cli/channel.ts`;Modify `src/cli.ts`;Test 同上
- [ ] **Step 1–4:** 写失败测试(`buildChannelList(base)` 返回 registry 内通道 + 端口)→ red → 实现 `abg list` 读 registry 列 channelId/端口/stateDir(五态分类在 PR5,此处先 running/unknown 占位但**不**伪造状态,标 `state:"unknown"` 待 PR5);`abg channel create <id>` = allocate+setupHome;`cli.ts` 注册子命令 + `--channel` 路由 → green。
- [ ] **Step 5: PR2 Exit gate** — `bun test src/unit-test/channel-cli.test.ts src/unit-test/cli.test.ts` 全绿 + `bun run typecheck` + `git diff` 只读 review + **断言 default 零回归**(裸 claude/codex 测试仍绿)+ 更新 V1_PROGRESS L1.2 done + evidence + phase gate 暂停。

---

# PR3 — lifecycle/spawn 显式 env

> SSOT:design §2 失败链、§7 PR3。Done:`bun test src/unit-test/channel-lifecycle-env.test.ts` 全绿(含 clean-env 父进程)+ typecheck clean。

### Task 3.1: `DaemonLifecycleOptions` 加 channel env + `launch()` 显式写

**Files:** Modify `src/daemon-lifecycle.ts`;Test `src/unit-test/channel-lifecycle-env.test.ts`
**Interfaces:** Consumes `ChannelProfile`。`DaemonLifecycleOptions` 加 `channelEnv?: Record<string,string>`(6 env)

- [ ] **Step 1: 写失败测试**(复用 `e2e-cli.test.ts` 的 fake daemon 思路:写一个捕获 env 的 fake daemon 脚本到 temp,设 `AGENTBRIDGE_DAEMON_ENTRY` 指向它,**清空** channel env 的父进程下 launch,断言 fake daemon 收到的 env 文件含 profile 值)
```ts
test("clean-env 父进程 launch 仍显式注入 profile env(回归 design §2)", async () => {
  const base = mkdtempSync(join(tmpdir(), "abg-le-"));
  const envDump = join(base, "env.json");
  const fakeDaemon = join(base, "fake-daemon.ts");
  writeFileSync(fakeDaemon, `import{writeFileSync}from"node:fs";writeFileSync(${JSON.stringify(envDump)},JSON.stringify(process.env));`);
  // 关键:从不含 CODEX_HOME/CODEX_WS_PORT 的父 env 启动
  const lc = new DaemonLifecycle({
    stateDir: new StateDirResolver(join(base, "st")),
    controlPort: 4512,
    log: () => {},
    channelEnv: { AGENTBRIDGE_CHANNEL_ID: "A", CODEX_WS_PORT: "4510", CODEX_PROXY_PORT: "4511", CODEX_HOME: join(base, "ch-A") },
  } as any);
  (lc as any).launchForTest(fakeDaemon);   // 暴露测试入口,spawn 后等文件
  // ... 轮询 envDump 出现,读它
  const dumped = JSON.parse(readFileSync(envDump, "utf-8"));
  expect(dumped.AGENTBRIDGE_CHANNEL_ID).toBe("A");
  expect(dumped.CODEX_WS_PORT).toBe("4510");
  expect(dumped.CODEX_HOME).toBe(join(base, "ch-A"));
  rmSync(base, { recursive: true, force: true });
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `DaemonLifecycleOptions` 加 `channelEnv?`;`launch()`(`:221-231`)的 `env` 从 `{...process.env, CONTROL_PORT, STATE_DIR}` 改为 `{...process.env, AGENTBRIDGE_CONTROL_PORT, AGENTBRIDGE_STATE_DIR, ...(this.channelEnv ?? {})}`——channelEnv 显式覆盖,**不依赖**继承。暴露 `launchForTest(entry)` 仅测试用(或经 `AGENTBRIDGE_DAEMON_ENTRY`)。
- [ ] **Step 4: 跑确认 green** / **Step 5:** micro-gate typecheck

### Task 3.2: `CodexAdapter.start()` spawn 显式 env

**Files:** Modify `src/codex-adapter.ts`;Test 同上
**Interfaces:** `CodexAdapter` 构造或 `start()` 接受 `spawnEnv?: Record<string,string>`(至少 CODEX_HOME)

- [ ] **Step 1: 写失败测试**(注入一个 fake `codex` shim 到 PATH,捕获其 env;或重构 `start()` 抽 `buildSpawnEnv()` 纯函数单测)
```ts
test("start() spawn codex 显式带 CODEX_HOME + ports(不靠继承)", () => {
  const { CodexAdapter } = require("../codex-adapter");
  const a = new CodexAdapter(4510, 4511, "/tmp/x.log", { CODEX_HOME: "/tmp/ch-A" });
  const env = (a as any).buildSpawnEnv();        // 抽出的纯函数
  expect(env.CODEX_HOME).toBe("/tmp/ch-A");
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `CodexAdapter` 构造加可选 `spawnEnv`;`start()`(`:144`)的 `spawn("codex",[...],{stdio})` 改为 `{stdio, env: this.buildSpawnEnv()}`,`buildSpawnEnv()` 返回 `{...process.env, ...(this.spawnEnv ?? {})}`。daemon.ts 构造 `CodexAdapter` 时传 `{CODEX_HOME: process.env.CODEX_HOME}`(PR4 联动)。
- [ ] **Step 4: 跑确认 green** / **Step 5: PR3 Exit gate** — `bun test src/unit-test/channel-lifecycle-env.test.ts` 全绿 + typecheck + `git diff` 只读 + V1_PROGRESS L1.3 done + evidence + phase gate 暂停。

---

# PR4 — 可观测性 / identity / checkPorts

> SSOT:design §6 契约 1/8、§7 PR4。Done:`bun test src/unit-test/channel-identity.test.ts` 全绿 + typecheck clean。

### Task 4.1: daemon `channelId` + `/healthz` 返回 `{channelId, controlPort, pid}`

**Files:** Modify `src/daemon.ts`(`:837` currentStatus)、`src/control-protocol.ts`(DaemonStatus 类型);Test `src/unit-test/channel-identity.test.ts`
**Interfaces:** `DaemonStatus` 加 `channelId: string`、`controlPort: number`

- [ ] **Step 1: 写失败测试**(用 real daemon `launchDaemon()` 模式[`e2e-reconnect.test.ts:27`],设 `AGENTBRIDGE_CHANNEL_ID=A` 启动,fetch `/healthz`)
```ts
test("healthz 含 channelId + controlPort + pid(契约1)", async () => {
  // launchDaemon with env AGENTBRIDGE_CHANNEL_ID=A, AGENTBRIDGE_CONTROL_PORT=<free>
  const res = await fetch(`http://127.0.0.1:${port}/healthz`);
  const j = await res.json();
  expect(j.channelId).toBe("A");
  expect(j.controlPort).toBe(port);
  expect(typeof j.pid).toBe("number");
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — daemon.ts 顶部加 `const CHANNEL_ID = process.env.AGENTBRIDGE_CHANNEL_ID ?? "default";`;`currentStatus()`(`:837`)加 `channelId: CHANNEL_ID, controlPort: CONTROL_PORT`;`control-protocol.ts` 的 `DaemonStatus` 加这两字段。
- [ ] **Step 4: 跑确认 green** / **Step 5:** micro-gate typecheck

### Task 4.2: status.json + log 前缀 + ready/waiting 含 channelId

**Files:** Modify `src/daemon.ts`(`:886` writeStatusFile、`:851-857` 消息、log)、`src/bridge.ts`(ready 消息)
- [ ] **Step 1–4:** 写失败测试(读 status.json 断言 `channelId`;ready/waiting 文本含 `[A]`)→ red → 实现:`writeStatusFile()`(`:886`)加 `channelId: CHANNEL_ID`;`currentReadyMessage`/`currentWaitingMessage`(`:855/:851`)前缀 `[${CHANNEL_ID}]`(default 时省略以保零回归);daemon `log()` 前缀含 channelId → green。
- [ ] **Step 5:** micro-gate typecheck

### Task 4.3: identity 不变量校验(契约 1)

**Files:** Modify `src/channel-profile.ts`(校验 helper)、`src/cli/kill.ts`(kill 前校验);Test 同上
**Interfaces:** Produces `verifyChannelIdentity(profile): Promise<"ok"|"mismatch"|"down">`

- [ ] **Step 1: 写失败测试**
```ts
test("篡改 status channelId 后 kill 前校验拒绝(契约1)", async () => {
  // 起 fake control server 在 profile.controlPort,/healthz 返回 channelId="WRONG"
  const verdict = await verifyChannelIdentity(profile);
  expect(verdict).toBe("mismatch");
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `verifyChannelIdentity(profile)`:fetch `http://127.0.0.1:${profile.controlPort}/healthz`;不可达→`"down"`;`{channelId,controlPort,pid}` 与 profile 全匹配→`"ok"`;否则→`"mismatch"`。`kill`/attach/reconnect 路径在操作活进程前调它,`mismatch` 拒绝不杀。
- [ ] **Step 4: 跑确认 green** / **Step 5:** micro-gate typecheck

### Task 4.4: `checkPorts` 改 channel-scoped(契约 8)

**Files:** Modify `src/codex-adapter.ts`(`:1235` checkPorts、暴露 `appServerPid`)、`src/daemon.ts`(status 写 `codexAppServerPid`)
**Interfaces:** `CodexAdapter` 加 `get appServerPid(): number | undefined`;`checkPorts` 读 prior `codexAppServerPid`

- [ ] **Step 1: 写失败测试**(模拟邻居:端口被一个**非本 channel 记录**的 codex app-server 占 → checkPorts 不杀,标 blocked)
```ts
test("checkPorts 只杀本 channel 记录的 codexAppServerPid,不跨通道泛杀(契约8)", async () => {
  // status.json 记录 codexAppServerPid = <某 fake 进程 pid X>;另起占端口的进程 Y(cmdline 含 codex app-server)
  // 断言:checkPorts 不杀 Y(Y≠X),抛 blocked-port
  expect(checkResult).toMatch(/blocked-port|in use/i);
  // 断言 Y 仍活
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — `checkPorts()`(`:1235`)改:读本 channel `status.json.codexAppServerPid`;仅当占端口的 pid **等于**该记录值 **且** cmdline 含 `codex app-server` 才 kill;否则**不杀**,throw 带 `blocked-port` 语义(注:app-server 无 daemon `/healthz`,只能 pid+cmdline 校验)。`CodexAdapter` 暴露 `appServerPid = this.proc?.pid`;daemon `writeStatusFile()` 加 `codexAppServerPid: codex.appServerPid`(codex.start() 后)。
- [ ] **Step 4: 跑确认 green** / **Step 5: PR4 Exit gate** — `bun test src/unit-test/channel-identity.test.ts` 全绿 + typecheck + `git diff` 只读 + V1_PROGRESS L1.4 done + evidence + phase gate 暂停。

---

# PR5 — lifecycle/list/gc + 零串台 E2E

> SSOT:design §6 契约 3/6、§7 PR5。Done:**全量** `bun test src/` 全绿 + 两通道零串台 E2E 通过 + typecheck clean。

### Task 5.1: channel 五态分类

**Files:** Modify `src/channel-profile.ts`;Test `src/unit-test/channel-profile.test.ts`
**Interfaces:** Produces `classifyChannel(profile): Promise<ChannelState>`(running/stopped/stale-dead/blocked-port/corrupt)
- [ ] **Step 1–4:** 写失败测试(构造各态 fixture:healthz 通+identity ok→running;profile 在 registry 但无活进程+无 stale pid→stopped;pid 文件指向死进程→stale-dead;端口被外人占→blocked-port;registry 项缺字段→corrupt)→ red → 实现 `classifyChannel`(组合 `verifyChannelIdentity` + pid 活性 + 端口探测)→ green。
- [ ] **Step 5:** micro-gate typecheck

### Task 5.2: `kill <id>` / `kill --all`(per-profile,identity-gated)

**Files:** Modify `src/cli/kill.ts`;Test `src/unit-test/channel-cli.test.ts`
- [ ] **Step 1: 写失败测试**
```ts
test("kill A 不碰 B(两临时通道)", async () => {
  // allocate A、B;伪起各自 fake daemon;kill A;断言 B 的 status/pid 仍在、healthz 仍通
});
```
- [ ] **Step 2–4:** red → 实现 `kill <id>`:`read(id)` → `verifyChannelIdentity` ok 才 kill 该 profile 的 daemon+tui(用 profile.stateDir);`kill --all`:遍历 `list()` 逐 profile kill(各自 identity-gate)→ green。
- [ ] **Step 5:** micro-gate typecheck

### Task 5.3: `abg list --json` 五态

**Files:** Modify `src/cli/list.ts`;Test 同上
- [ ] **Step 1–4:** 写失败测试(`buildChannelList(base)` 对各态 fixture 返回正确 `state`)→ red → 接 `classifyChannel` 输出 `--json` → green。
- [ ] **Step 5:** micro-gate typecheck

### Task 5.4: `abg gc`(只清 stale-dead/corrupt/missing;blocked-port 不自动 reclaim)

**Files:** Create `src/cli/gc.ts`;Modify `src/channel-profile.ts`(`remove`);Test 同上
- [ ] **Step 1: 写失败测试**
```ts
test("gc 清 stale-dead/corrupt,保 blocked-port(契约6)", async () => {
  // 三通道:stale-dead → 被清;blocked-port → 保留(registry 仍在);running → 保留
});
```
- [ ] **Step 2–4:** red → 实现 `gc`:遍历 `list()`,`classifyChannel` ∈ {stale-dead,corrupt} 或目录 missing → `remove` + 清目录;`blocked-port`/`running`/`stopped` 保留 → green。
- [ ] **Step 5:** micro-gate typecheck

### Task 5.5: 两通道零串台 E2E(契约 3)

**Files:** Create `src/unit-test/channel-e2e.test.ts`(扩展 `e2e-cli.test.ts` 的 harness 思路)
**Interfaces:** Consumes 全链。断言:各自 `/healthz.channelId` 正确;A 的 Claude 消息**只**到 A 的 Codex。
- [ ] **Step 1: 写失败测试**
```ts
test("零串台:起 2 通道,各自 healthz channelId 正确 + A→A routing(契约3)", async () => {
  // 用 CliE2EHarness 思路起 2 套 fake daemon(channelId A、B,独立端口/stateDir);
  // 经 A 的 control port 发一条 claude→codex,断言只有 A 的 fake codex/daemon 收到;B 的 launch log 无此消息;
  // fetch A/B 各自 /healthz,断言 channelId 各为 A/B。
});
```
- [ ] **Step 2: 跑确认 red**
- [ ] **Step 3: 最小实现** — 扩展 harness 支持双通道(参数化 channelId/端口);路由断言读各自 fake daemon launch log + shim JSONL(`readShimCalls`/`readLaunches`)。必要时让 fake daemon echo 收到的消息到本通道日志。
- [ ] **Step 4: 跑确认 green**
- [ ] **Step 5: PR5 Exit gate(= Final Acceptance Gate)** — 见下。

---

## Final Acceptance Gate(声称 COMPLETE 前,逐条核对 spec §8)

- [ ] `bun run typecheck` clean
- [ ] **全量** `bun test src/` 全绿(含新增 6 个 channel-* 测试 + 原有 15 个无回归)
- [ ] 两通道零串台 E2E 通过(Task 5.5)
- [ ] `default` 回归:裸 `claude` 与无 `--channel` 的 `abg claude/codex/kill` 行为 = 今天(原 `e2e-cli.test.ts`/`cli.test.ts` 全绿 + 新增 default-path 断言)
- [ ] 9 契约逐条对照下表,标注覆盖测试
- [ ] `git diff` 只读 review(仅预期文件;**无任何 git write 发生**)
- [ ] V1_PROGRESS L1.5 done + `Done evidence:` + 收尾终态 `COMPLETE: PR1-PR5 all gates passed`(否则 `BLOCKED:<PR>:<reason>`)

## 契约 → 测试覆盖映射(9 项)

| 契约 | PR | 覆盖测试 |
|---|---|---|
| 1 channel identity 不变量 | PR4 | `channel-identity.test.ts`(healthz {channelId,controlPort,pid} + 篡改拒绝) |
| 2 config 结构化生成 | PR1 | `channel-config.test.ts`(无 root 残留 + [projects.*] 保留 + 非-home 保留) |
| 3 两通道零串台 E2E | PR5 | `channel-e2e.test.ts`(A→A routing + 各自 channelId) |
| 4 registry 健壮性 | PR1 | `channel-profile.test.ts`(schemaVersion+.bak+损坏 fail-closed+并发 16 唯一) |
| 5 named 启动顺序 | PR2 | `channel-cli.test.ts`(codex --channel 未创建 → fail) |
| 6 stopped≠stale 五态 | PR5 | `channel-profile.test.ts`(classify)+`channel-cli.test.ts`(gc 保 blocked-port) |
| 7 auth refresh 并发 | PR1 | `channel-profile.test.ts`(auth.json symlink;repair lock 为 follow-up,v1 launch-time) |
| 8 checkPorts channel-scoped | PR4 | `channel-identity.test.ts`(不跨通道泛杀 + blocked-port) |
| 9 channelId 语法/路径安全 | PR1 | `channel-profile.test.ts`(parseChannelId 非法/保留/遍历) |

> 契约 7 v1 仅做 auth.json symlink 共享 + launch-time repair(显式 `abg auth repair` 命令属 follow-up,design §8)。若实现中发现 v1 需更强 auth 锁 → 标 BLOCKED 问用户,不静默扩 scope。

## Self-Review(对照 spec,fresh eyes)

- **Spec 覆盖**:spec §6 PR1–PR5 每条 done 判据 → 上表 23 task 全覆盖;9 契约 → 映射表全覆盖;Non-goals(§2)已入 Global Constraints。
- **Placeholder 扫描**:无 "TBD/handle edge cases";每 task 有真 bun:test 代码 + 真 impl 指引 + 真 file:line。唯一显式 gated 项 = Task 1.7 step 0(加 dep 需 APPLY)+ PR1-entry 分支 BLOCKER。
- **类型一致**:`ChannelProfile`/`ChannelRegistry`/`profileToEnv`/`parseChannelFlag`/`verifyChannelIdentity`/`classifyChannel` 跨 PR 命名一致;6 env key 集中在 `CHANNEL_ENV_KEYS`。
- **已知风险**:① TOML 决策未定(Task 1.7);② Task 5.5 E2E 双通道 harness 是新写,fake daemon 需支持 channelId 参数化——若 routing 断言难以无真 codex 复现,降级为 fake-protocol 完整通道(spec 契约 3 允许 "真实/fake-protocol");③ checkPorts blocked-port 语义需与现有 `start()` 抛错路径协调,勿破坏 default 启动。
