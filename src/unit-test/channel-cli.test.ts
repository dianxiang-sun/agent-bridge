import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseChannelFlag,
  resolveCodexChannel,
  resolveKillChannel,
} from "../cli/channel-args";
import { profileToEnv, ChannelRegistry } from "../channel-profile";
import { buildChannelList } from "../cli/list";
import { createChannel } from "../cli/channel";

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
