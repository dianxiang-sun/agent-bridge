import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseChannelFlag,
  resolveCodexChannel,
  resolveKillChannel,
  resolveKillScope,
} from "../cli/channel-args";
import { profileToEnv, ChannelRegistry } from "../channel-profile";
import { buildChannelList, buildChannelStatusList } from "../cli/list";
import { createChannel } from "../cli/channel";
import { runGc, shouldGc } from "../cli/gc";

describe("parseChannelFlag (剥离 --channel,不透传)", () => {
  test("--channel X 剥离,rest 不含它", () => {
    expect(parseChannelFlag(["--channel", "A", "--resume"])).toEqual({ channelId: "A", rest: ["--resume"] });
  });

  test("--channel=X 形式", () => {
    expect(parseChannelFlag(["--channel=A", "x"])).toEqual({ channelId: "A", rest: ["x"] });
  });

  test("无 --channel → null,rest 原样保留", () => {
    expect(parseChannelFlag(["--resume", "--model", "o3"])).toEqual({
      channelId: null,
      rest: ["--resume", "--model", "o3"],
    });
  });

  test("非法 / 保留 channel id 抛错", () => {
    expect(() => parseChannelFlag(["--channel", "../x"])).toThrow();
    expect(() => parseChannelFlag(["--channel", "default"])).toThrow();
  });

  test("--channel 缺值抛错", () => {
    expect(() => parseChannelFlag(["--channel"])).toThrow();
    expect(() => parseChannelFlag(["--channel", "--resume"])).toThrow();
  });

  test("重复 --channel 抛错", () => {
    expect(() => parseChannelFlag(["--channel", "A", "--channel", "B"])).toThrow();
  });
});

describe("profileToEnv (6 env)", () => {
  test("named profile → 6 env 齐全且为字符串", () => {
    const p = {
      channelId: "A",
      controlPort: 4512,
      codexAppPort: 4510,
      codexProxyPort: 4511,
      stateDir: "/s/A",
      codexHome: "/h/A",
    };
    expect(profileToEnv(p)).toEqual({
      AGENTBRIDGE_CHANNEL_ID: "A",
      AGENTBRIDGE_CONTROL_PORT: "4512",
      CODEX_WS_PORT: "4510",
      CODEX_PROXY_PORT: "4511",
      AGENTBRIDGE_STATE_DIR: "/s/A",
      CODEX_HOME: "/h/A",
    });
  });
});

describe("resolveCodexChannel (read-only,禁 fallback,契约5)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-rx-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test("未创建 channel → throw startup-order(不隐式 allocate)", () => {
    expect(() => resolveCodexChannel(["--channel", "ghost"], root)).toThrow(
      /does not exist|abg claude --channel|channel create/i,
    );
    expect(new ChannelRegistry(root).read("ghost")).toBeNull();
  });

  test("named → proxyUrl = profile.codexProxyPort(禁 config fallback)", async () => {
    const p = await new ChannelRegistry(root).allocate("real");
    const r = resolveCodexChannel(["--channel", "real", "--model", "o3"], root);
    expect(r.proxyUrl).toBe(`ws://127.0.0.1:${p.codexProxyPort}`);
    expect(r.env?.CODEX_PROXY_PORT).toBe(String(p.codexProxyPort));
    expect(r.nativeArgs).toEqual(["--model", "o3"]);
  });

  test("无 --channel → proxyUrl/env=null(走 default 原 fallback)", () => {
    const r = resolveCodexChannel(["--model", "o3"], root);
    expect(r.proxyUrl).toBeNull();
    expect(r.env).toBeNull();
    expect(r.nativeArgs).toEqual(["--model", "o3"]);
  });
});

describe("resolveKillChannel (read-only)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-rk-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test("未创建 channel → throw", () => {
    expect(() => resolveKillChannel(["--channel", "ghost"], root)).toThrow(/does not exist/i);
  });

  test("无 --channel → profile=null", () => {
    expect(resolveKillChannel([], root).profile).toBeNull();
  });
});

describe("abg list / channel create", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-lc-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test("buildChannelList 列出 registry 内通道", async () => {
    const reg = new ChannelRegistry(root);
    await reg.allocate("A");
    await reg.allocate("B");
    const list = buildChannelList(root);
    expect(list.map((c) => c.channelId).sort()).toEqual(["A", "B"]);
  });

  test("createChannel 创建 + 可被 read", async () => {
    const p = await createChannel("new1", root);
    expect(p.channelId).toBe("new1");
    expect(new ChannelRegistry(root).read("new1")?.channelId).toBe("new1");
  });

  test("buildChannelList(root, 'A') → 只列 A(Failure-1 回归:list 消费 --channel)", async () => {
    const reg = new ChannelRegistry(root);
    await reg.allocate("A");
    await reg.allocate("B");
    expect(buildChannelList(root, "A").map((c) => c.channelId)).toEqual(["A"]);
    expect(buildChannelList(root).map((c) => c.channelId).sort()).toEqual(["A", "B"]);
  });
});

// ── PR5 Task 5.2: resolveKillScope (context-aware kill 三形态) ────────────
describe("resolveKillScope (无参=当前通道 / <name>=指定 / --all=全部 named)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-ks-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  const namedEnv = (over: Record<string, string> = {}) => ({
    AGENTBRIDGE_CHANNEL_ID: "A",
    AGENTBRIDGE_CONTROL_PORT: "4512",
    CODEX_WS_PORT: "4510",
    CODEX_PROXY_PORT: "4511",
    AGENTBRIDGE_STATE_DIR: "/s/A",
    CODEX_HOME: "/h/A",
    ...over,
  });

  test("无参 + 完整 named env → 当前通道(env tuple 权威)", () => {
    const s = resolveKillScope([], namedEnv(), root);
    expect(s.mode).toBe("named");
    expect(s.mode === "named" && s.profile.channelId).toBe("A");
    expect(s.mode === "named" && s.profile.controlPort).toBe(4512);
    expect(s.mode === "named" && s.profile.stateDir).toBe("/s/A");
  });

  test("无参 + 无 CHANNEL_ID → default(零回归)", () => {
    const s = resolveKillScope([], { PATH: "/usr/bin" }, root);
    expect(s.mode).toBe("default");
  });

  test("无参 + CHANNEL_ID 但 6key 不全 → throw(不 fallback default,防杀错当前 bridge)", () => {
    expect(() => resolveKillScope([], { AGENTBRIDGE_CHANNEL_ID: "A", CODEX_HOME: "/h/A" }, root))
      .toThrow(/incomplete channel env/i);
  });

  test("无参 + CHANNEL_ID=default(完整 env)→ default", () => {
    const s = resolveKillScope([], namedEnv({ AGENTBRIDGE_CHANNEL_ID: "default" }), root);
    expect(s.mode).toBe("default");
  });

  test("positional <name>(registry 有)→ named from registry,显式赢 ambient env", async () => {
    const p = await new ChannelRegistry(root).allocate("B");
    const s = resolveKillScope(["B"], namedEnv(), root); // ambient=A,显式 kill B 必须→B
    expect(s.mode).toBe("named");
    expect(s.mode === "named" && s.profile.channelId).toBe("B");
    expect(s.mode === "named" && s.profile.controlPort).toBe(p.controlPort);
  });

  test("positional <name>(registry 无)→ throw does-not-exist", () => {
    expect(() => resolveKillScope(["ghost"], {}, root)).toThrow(/does not exist/i);
  });

  test("--all → 遍历 registry named(不含 default)", async () => {
    const reg = new ChannelRegistry(root);
    await reg.allocate("A");
    await reg.allocate("B");
    const s = resolveKillScope(["--all"], {}, root);
    expect(s.mode).toBe("all");
    expect(s.mode === "all" && s.profiles.map((p) => p.channelId).sort()).toEqual(["A", "B"]);
  });

  test("--all + name → throw 互斥", () => {
    expect(() => resolveKillScope(["--all", "A"], {}, root)).toThrow(/all|combined|exclusive|cannot/i);
  });

  test("positional 'default' → default(canonical,不被 named env 的 stateDir 污染)", () => {
    const s = resolveKillScope(["default"], namedEnv(), root);
    expect(s.mode).toBe("default");
    expect(s.mode === "default" && s.profile.channelId).toBe("default");
    expect(s.mode === "default" && s.profile.controlPort).toBe(4502);
    expect(s.mode === "default" && s.profile.stateDir).not.toBe("/s/A");
  });

  test("--channel <name> 兼容 → named from registry", async () => {
    await new ChannelRegistry(root).allocate("C");
    const s = resolveKillScope(["--channel", "C"], {}, root);
    expect(s.mode).toBe("named");
    expect(s.mode === "named" && s.profile.channelId).toBe("C");
  });

  test("positional 与 --channel 不同 → throw 冲突", () => {
    expect(() => resolveKillScope(["B", "--channel", "A"], {}, root)).toThrow(/conflict/i);
  });

  test("重复 --channel → throw(对齐 parseChannelFlag,Codex R3 red-team #3)", () => {
    expect(() => resolveKillScope(["--channel", "A", "--channel", "B"], {}, root)).toThrow(/once|more than/i);
  });
});

// ── PR5 Task 5.3: abg list 五态 (接 classifyChannel) ──────────────────────
describe("buildChannelStatusList (list --json 五态)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-ls5-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test("每通道带 state;allocate 但未起 daemon → stopped", async () => {
    await new ChannelRegistry(root).allocate("A");
    const list = await buildChannelStatusList(root);
    expect(list.map((c) => c.channelId)).toEqual(["A"]);
    expect(list[0].state).toBe("stopped");
    expect(list[0].controlPort).toBeGreaterThan(0); // profile 字段保留
  });

  test("--channel 过滤后仍带 state", async () => {
    const reg = new ChannelRegistry(root);
    await reg.allocate("A");
    await reg.allocate("B");
    const list = await buildChannelStatusList(root, "A");
    expect(list.map((c) => c.channelId)).toEqual(["A"]);
    expect(typeof list[0].state).toBe("string");
  });
});

// ── PR5 Task 5.4: gc + ChannelRegistry.remove (registry-only,数据安全) ────
describe("gc + remove (registry-only,绝不删 codexHome)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-gc-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test("shouldGc: stale-dead/corrupt 总清;blocked-port 仅 --force;running/stopped 保留", () => {
    expect(shouldGc("stale-dead", false)).toBe(true);
    expect(shouldGc("corrupt", false)).toBe(true);
    expect(shouldGc("blocked-port", false)).toBe(false);
    expect(shouldGc("blocked-port", true)).toBe(true);
    expect(shouldGc("running", true)).toBe(false);
    expect(shouldGc("stopped", true)).toBe(false);
  });

  test("ChannelRegistry.remove 删 entry 但保留 codexHome 数据(用户拍板:防数据丢失)", async () => {
    const reg = new ChannelRegistry(root);
    const p = await reg.allocate("A");
    mkdirSync(p.codexHome, { recursive: true });
    writeFileSync(join(p.codexHome, "sessions.sqlite"), "session data");
    await reg.remove("A");
    expect(reg.read("A")).toBeNull();
    expect(existsSync(join(p.codexHome, "sessions.sqlite"))).toBe(true);
  });

  test("runGc 清 stale-dead、保 stopped、且绝不删 codexHome", async () => {
    const reg = new ChannelRegistry(root);
    await reg.allocate("stop"); // stopped (allocate 未起 daemon)
    const dead = await reg.allocate("dead");
    mkdirSync(dead.stateDir, { recursive: true });
    writeFileSync(join(dead.stateDir, "daemon.pid"), "2147483646\n"); // → stale-dead
    mkdirSync(dead.codexHome, { recursive: true });
    writeFileSync(join(dead.codexHome, "data.sqlite"), "x");

    const result = await runGc([], root);
    expect(result.removed.map((r) => r.channelId)).toEqual(["dead"]);
    expect(reg.read("stop")).not.toBeNull();    // stopped 保留(profile 可复用)
    expect(reg.read("dead")).toBeNull();         // stale-dead 清掉 registry entry
    expect(existsSync(join(dead.codexHome, "data.sqlite"))).toBe(true); // 数据保留(registry-only)
  });
});
