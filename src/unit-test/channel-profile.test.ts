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
  classifyChannel,
  isValidChannelProfile,
  type ChannelProfile,
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

// ── PR5 Task 5.1: classifyChannel 五态 (契约6) ───────────────────────────
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

function makeProfile(channelId: string, controlPort: number, stateDir: string): ChannelProfile {
  return {
    channelId,
    controlPort,
    codexAppPort: controlPort - 2,
    codexProxyPort: controlPort - 1,
    stateDir,
    codexHome: join(stateDir, "codex-home"),
  };
}

describe("classifyChannel 五态 (契约6)", () => {
  let root: string;
  const servers: Array<{ stop: (closeActiveConnections?: boolean) => void }> = [];
  const closers: Array<() => Promise<void>> = [];
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "abg-classify-")); });
  afterEach(async () => {
    for (const s of servers.splice(0)) { try { s.stop(true); } catch {} }
    for (const c of closers.splice(0)) { try { await c(); } catch {} }
    rmSync(root, { recursive: true, force: true });
  });

  function serveHealthz(port: number, body: unknown) {
    const srv = Bun.serve({ port, hostname: "127.0.0.1", fetch: () => Response.json(body as any) });
    servers.push(srv);
  }
  async function occupyPort(port: number) {
    const srv = createServer();
    await new Promise<void>((res, rej) => { srv.once("error", rej); srv.listen(port, "127.0.0.1", () => res()); });
    closers.push(() => new Promise<void>((res) => srv.close(() => res())));
  }
  function mkState(id: string): string {
    const d = join(root, id);
    mkdirSync(d, { recursive: true });
    return d;
  }

  test("running: healthz 可达 + channelId/controlPort 匹配 profile", async () => {
    const port = await getFreePort();
    const sd = mkState("A");
    serveHealthz(port, { channelId: "A", controlPort: port, pid: process.pid });
    expect(await classifyChannel(makeProfile("A", port, sd))).toBe("running");
  });

  test("stopped: 端口空 + 无 pidfile(profile 保留可复用)", async () => {
    const port = await getFreePort();
    const sd = mkState("B");
    expect(await classifyChannel(makeProfile("B", port, sd))).toBe("stopped");
  });

  test("stale-dead: 端口空 + pidfile 指向死进程", async () => {
    const port = await getFreePort();
    const sd = mkState("C");
    writeFileSync(join(sd, "daemon.pid"), "2147483646\n"); // 不可能存在的高 pid
    expect(await classifyChannel(makeProfile("C", port, sd))).toBe("stale-dead");
  });

  test("stale-dead: 端口空 + pidfile 指向活进程但非 daemon(OS 复用 pid)", async () => {
    const port = await getFreePort();
    const sd = mkState("C2");
    writeFileSync(join(sd, "daemon.pid"), `${process.pid}\n`); // 活,但本测试进程不是 daemon cmdline
    expect(await classifyChannel(makeProfile("C2", port, sd))).toBe("stale-dead");
  });

  test("blocked-port: healthz 可达但 channelId mismatch(别人占我 control 端口)", async () => {
    const port = await getFreePort();
    const sd = mkState("D");
    serveHealthz(port, { channelId: "WRONG", controlPort: port, pid: 1 });
    expect(await classifyChannel(makeProfile("D", port, sd))).toBe("blocked-port");
  });

  test("blocked-port: healthz 不通 + status.blockedPort 记录且该端口仍被占", async () => {
    const ctrl = await getFreePort();
    const blocked = await getFreePort();
    await occupyPort(blocked);
    const sd = mkState("E");
    writeFileSync(join(sd, "status.json"), JSON.stringify({ blockedPort: { port: blocked, role: "app", message: "occupied" } }));
    expect(await classifyChannel(makeProfile("E", ctrl, sd))).toBe("blocked-port");
  });

  test("blocked-port stale → 不再算(status 记了但端口已 free + 无 pidfile → stopped)", async () => {
    const ctrl = await getFreePort();
    const freed = await getFreePort(); // 未占用
    const sd = mkState("F");
    writeFileSync(join(sd, "status.json"), JSON.stringify({ blockedPort: { port: freed, role: "app", message: "stale" } }));
    expect(await classifyChannel(makeProfile("F", ctrl, sd))).toBe("stopped");
  });

  test("corrupt: profile 字段缺失/类型错", async () => {
    const sd = mkState("G");
    const bad = { channelId: "G", stateDir: sd } as unknown as ChannelProfile; // 缺端口
    expect(await classifyChannel(bad)).toBe("corrupt");
  });
});

// ── PR5: isValidChannelProfile (corrupt-entry guard, Codex R3 red-team #2) ──
describe("isValidChannelProfile (防 kill --all 用损坏 entry 污染 ambient env)", () => {
  test("完整 6 字段 → true", () => {
    expect(isValidChannelProfile({
      channelId: "A", controlPort: 4512, codexAppPort: 4510, codexProxyPort: 4511,
      stateDir: "/s/A", codexHome: "/h/A",
    })).toBe(true);
  });

  test("缺 stateDir / 缺端口 → false(否则 StateDirResolver(undefined) 会回退到 ambient env)", () => {
    expect(isValidChannelProfile({ channelId: "bad" } as unknown as ChannelProfile)).toBe(false);
    expect(isValidChannelProfile({
      channelId: "bad", controlPort: 4512, codexAppPort: 4510, codexProxyPort: 4511, codexHome: "/h",
    } as unknown as ChannelProfile)).toBe(false); // 缺 stateDir
  });
});
