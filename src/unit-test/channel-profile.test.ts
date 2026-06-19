import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
  mkdirSync,
  statSync,
  lstatSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import { createServer } from "node:net";
import {
  parseChannelId,
  defaultProfile,
  channelsBaseDir,
  codexHomeBaseDir,
  ChannelRegistry,
  setupChannelHome,
} from "../channel-profile";

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

describe("defaultProfile + base dirs (legacy)", () => {
  test("defaultProfile = legacy 端口,不分配", () => {
    const p = defaultProfile();
    expect(p.channelId).toBe("default");
    expect(p.controlPort).toBe(4502);
    expect(p.codexAppPort).toBe(4500);
    expect(p.codexProxyPort).toBe(4501);
    expect(p.codexHome).toBe(process.env.CODEX_HOME ?? join(homedir(), ".codex"));
  });

  test("base dirs 锚定 canonical base,不受 AGENTBRIDGE_STATE_DIR 污染", () => {
    const orig = process.env.AGENTBRIDGE_STATE_DIR;
    process.env.AGENTBRIDGE_STATE_DIR = "/tmp/some-channel-dir/channels/X";
    try {
      expect(channelsBaseDir().endsWith("/channels")).toBe(true);
      expect(codexHomeBaseDir().endsWith("/codex-home")).toBe(true);
      expect(channelsBaseDir()).not.toContain("/tmp/some-channel-dir");
    } finally {
      if (orig === undefined) delete process.env.AGENTBRIDGE_STATE_DIR;
      else process.env.AGENTBRIDGE_STATE_DIR = orig;
    }
  });
});

describe("ChannelRegistry atomic + robustness (契约4)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-reg-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test("read 不存在 → null;list → []", () => {
    const r = new ChannelRegistry(root);
    expect(r.read("X")).toBeNull();
    expect(r.list()).toEqual([]);
  });

  test("损坏 registry → fail-closed throw(不静默返回空)", () => {
    const dir = join(root, "channels");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "registry.json"), "{ broken");
    expect(() => new ChannelRegistry(root).read("X")).toThrow(/corrupt|repair|fail-closed/i);
  });

  test("写后有 schemaVersion + .bak", () => {
    const r = new ChannelRegistry(root) as any;
    r.writeAtomic({ schemaVersion: 1, channels: { A: { channelId: "A" } } });
    r.writeAtomic({ schemaVersion: 1, channels: { A: { channelId: "A" }, B: { channelId: "B" } } });
    const reg = JSON.parse(readFileSync(join(root, "channels", "registry.json"), "utf-8"));
    expect(reg.schemaVersion).toBe(1);
    expect(existsSync(join(root, "channels", "registry.json.bak"))).toBe(true);
  });
});

describe("ChannelRegistry allocate (契约4 lock + TCP probe)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-alloc-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test("并发 16 allocate 唯一(never fail-open)", async () => {
    const r = new ChannelRegistry(root);
    const ids = Array.from({ length: 16 }, (_, i) => `c${i}`);
    const profiles = await Promise.all(ids.map((id) => r.allocate(id)));
    expect(new Set(profiles.map((p) => p.controlPort)).size).toBe(16);
    expect(new Set(profiles.map((p) => p.codexAppPort)).size).toBe(16);
    expect(new Set(profiles.map((p) => p.stateDir)).size).toBe(16);
    for (const p of profiles) {
      expect(p.codexProxyPort).toBe(p.codexAppPort + 1);
      expect(p.controlPort).toBe(p.codexAppPort + 2);
      expect(p.codexAppPort % 10).toBe(0);
    }
  });

  test("allocate 幂等:同 id 复用同 profile", async () => {
    const r = new ChannelRegistry(root);
    const a1 = await r.allocate("dup");
    const a2 = await r.allocate("dup");
    expect(a2).toEqual(a1);
  });

  test("allocate 跳过被占 index(TCP probe)", async () => {
    const blocker = createServer();
    await new Promise<void>((res) => blocker.listen(4510, "127.0.0.1", () => res()));
    try {
      const p = await new ChannelRegistry(root).allocate("probe-test");
      expect(p.codexAppPort).not.toBe(4510);
      expect(p.codexAppPort % 10).toBe(0);
      expect(p.controlPort).toBe(p.codexAppPort + 2);
    } finally {
      await new Promise<void>((res) => blocker.close(() => res()));
    }
  });

  test("allocate 拒非法/保留 id", async () => {
    const r = new ChannelRegistry(root);
    await expect(r.allocate("default")).rejects.toThrow();
    await expect(r.allocate("../x")).rejects.toThrow();
  });
});

describe("setupChannelHome (契约7 symlink + 权限)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-home-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test("dir 0700 + auth/plugins/.tmp symlink 指向 root", async () => {
    const codexRoot = join(root, "fake-codex");
    mkdirSync(codexRoot, { recursive: true });
    writeFileSync(join(codexRoot, "auth.json"), "{}");
    mkdirSync(join(codexRoot, "plugins"));
    mkdirSync(join(codexRoot, ".tmp"));

    const p = await new ChannelRegistry(root).allocate("home-test");
    setupChannelHome(p, codexRoot);

    expect(statSync(p.codexHome).mode & 0o777).toBe(0o700);
    expect(lstatSync(join(p.codexHome, "auth.json")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(p.codexHome, "auth.json"))).toBe(join(codexRoot, "auth.json"));
    expect(lstatSync(join(p.codexHome, "plugins")).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(p.codexHome, ".tmp")).isSymbolicLink()).toBe(true);
  });

  test("root 侧缺失的 target → 跳过不抛", async () => {
    const codexRoot = join(root, "empty-codex");
    mkdirSync(codexRoot, { recursive: true });
    const p = await new ChannelRegistry(root).allocate("home-empty");
    expect(() => setupChannelHome(p, codexRoot)).not.toThrow();
    expect(existsSync(join(p.codexHome, "auth.json"))).toBe(false);
  });

  test("有 root config.toml → 生成 channel config.toml(0600,无 root 残留,契约2 集成)", async () => {
    const codexRoot = join(root, "cfg-codex");
    mkdirSync(codexRoot, { recursive: true });
    const realRoot = realpathSync(codexRoot);
    writeFileSync(join(codexRoot, "config.toml"), `NODE_REPL_TRUSTED_CODE_PATHS = "${realRoot}/plugins"\n`);

    const p = await new ChannelRegistry(root).allocate("cfg-test");
    setupChannelHome(p, codexRoot);

    const chCfg = join(p.codexHome, "config.toml");
    expect(existsSync(chCfg)).toBe(true);
    expect(statSync(chCfg).mode & 0o777).toBe(0o600);
    const text = readFileSync(chCfg, "utf-8");
    expect(text).not.toContain(realRoot);
    expect(text).toContain(p.codexHome);
  });
});
