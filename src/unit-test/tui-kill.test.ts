import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateDirResolver } from "../state-dir";
import { decideTuiKill, readTuiRecord, type TuiRecord } from "../cli/kill";

const profile = { channelId: "ICSE2027", controlPort: 4522, codexProxyPort: 4521 };
const alive = { alive: true, cmdMatches: true };

describe("decideTuiKill (Mechanism D: TUI 授权,不依赖 daemon 存活)", () => {
  test("none → skip", () => {
    expect(decideTuiKill({ kind: "none" }, profile, false, { alive: false, cmdMatches: false }).action).toBe("skip");
  });

  test("进程已死 → skip(清理 stale)", () => {
    const r: TuiRecord = { kind: "meta", pid: 1, channelId: "ICSE2027", controlPort: 4522, proxyUrl: "ws://127.0.0.1:4521" };
    expect(decideTuiKill(r, profile, false, { alive: false, cmdMatches: false }).action).toBe("skip");
  });

  test("cmdline/--remote 不匹配 → refuse(活进程但不是本通道 TUI)", () => {
    const r: TuiRecord = { kind: "meta", pid: 1, channelId: "ICSE2027", controlPort: 4522, proxyUrl: "ws://127.0.0.1:4521" };
    expect(decideTuiKill(r, profile, false, { alive: true, cmdMatches: false }).action).toBe("refuse");
  });

  test("meta 完全匹配 → kill(daemon 死活无关,孤儿 TUI 也能清 — 去 regression)", () => {
    const r: TuiRecord = { kind: "meta", pid: 99, channelId: "ICSE2027", controlPort: 4522, proxyUrl: "ws://127.0.0.1:4521" };
    expect(decideTuiKill(r, profile, false, alive)).toEqual({ action: "kill", pid: 99 });
  });

  test("⚠核心: kill ICSE2027 但 record 是别通道 → refuse(堵 Mechanism D 串台)", () => {
    const r: TuiRecord = { kind: "meta", pid: 99, channelId: "ICSE27", controlPort: 4512, proxyUrl: "ws://127.0.0.1:4511" };
    expect(decideTuiKill(r, profile, false, alive).action).toBe("refuse");
  });

  test("meta controlPort 不同 → refuse", () => {
    const r: TuiRecord = { kind: "meta", pid: 99, channelId: "ICSE2027", controlPort: 9999, proxyUrl: "ws://127.0.0.1:4521" };
    expect(decideTuiKill(r, profile, false, alive).action).toBe("refuse");
  });

  test("meta proxyUrl 不同 → refuse", () => {
    const r: TuiRecord = { kind: "meta", pid: 99, channelId: "ICSE2027", controlPort: 4522, proxyUrl: "ws://127.0.0.1:9999" };
    expect(decideTuiKill(r, profile, false, alive).action).toBe("refuse");
  });

  test("meta 无 proxyUrl(旧记录)其余匹配 → kill(向后兼容)", () => {
    const r: TuiRecord = { kind: "meta", pid: 99, channelId: "ICSE2027", controlPort: 4522 };
    expect(decideTuiKill(r, profile, false, alive)).toEqual({ action: "kill", pid: 99 });
  });

  test("legacy 裸 pid + named → refuse(无身份不敢杀 named)", () => {
    expect(decideTuiKill({ kind: "legacy", pid: 99 }, profile, false, alive).action).toBe("refuse");
  });

  test("legacy 裸 pid + default → kill(向后兼容)", () => {
    const def = { channelId: "default", controlPort: 4502, codexProxyPort: 4501 };
    expect(decideTuiKill({ kind: "legacy", pid: 99 }, def, true, alive)).toEqual({ action: "kill", pid: 99 });
  });

  test("⚠Codex#2: default meta proxyUrl 非 canonical(4601) + channelId/controlPort 匹配 → kill(default proxy 来自 status/config)", () => {
    const def = { channelId: "default", controlPort: 4502, codexProxyPort: 4501 };
    const r: TuiRecord = { kind: "meta", pid: 99, channelId: "default", controlPort: 4502, proxyUrl: "ws://127.0.0.1:4601" };
    expect(decideTuiKill(r, def, true, alive)).toEqual({ action: "kill", pid: 99 });
  });

  test("named meta proxyUrl 与 profile 不符 → 仍 refuse(named 严格,身份边界)", () => {
    const r: TuiRecord = { kind: "meta", pid: 99, channelId: "ICSE2027", controlPort: 4522, proxyUrl: "ws://127.0.0.1:4601" };
    expect(decideTuiKill(r, profile, false, alive).action).toBe("refuse");
  });
});

describe("readTuiRecord (meta 优先,legacy fallback)", () => {
  let dir: string;
  let sd: StateDirResolver;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "abg-tui-")); sd = new StateDirResolver(dir); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test("codex-tui.json 存在 → meta", () => {
    writeFileSync(sd.tuiMetaFile, JSON.stringify({ pid: 7, channelId: "A", controlPort: 4512, proxyUrl: "ws://127.0.0.1:4511" }));
    expect(readTuiRecord(sd)).toEqual({ kind: "meta", pid: 7, channelId: "A", controlPort: 4512, proxyUrl: "ws://127.0.0.1:4511" });
  });

  test("只有 codex-tui.pid(裸) → legacy", () => {
    writeFileSync(sd.tuiPidFile, "12345\n");
    expect(readTuiRecord(sd)).toEqual({ kind: "legacy", pid: 12345 });
  });

  test("都无 → none", () => {
    expect(readTuiRecord(sd)).toEqual({ kind: "none" });
  });

  test("坏 json + 有裸 pid → fallback legacy", () => {
    writeFileSync(sd.tuiMetaFile, "{not json");
    writeFileSync(sd.tuiPidFile, "777\n");
    expect(readTuiRecord(sd)).toEqual({ kind: "legacy", pid: 777 });
  });

  test("meta 缺 channelId + 有裸 pid → fallback legacy", () => {
    writeFileSync(sd.tuiMetaFile, JSON.stringify({ pid: 7, controlPort: 4512 }));
    writeFileSync(sd.tuiPidFile, "777\n");
    expect(readTuiRecord(sd)).toEqual({ kind: "legacy", pid: 777 });
  });

  test("meta pid 非正整数(0/负/小数) → 不认 meta(Codex#3)", () => {
    for (const bad of [0, -1, 1.5]) {
      writeFileSync(sd.tuiMetaFile, JSON.stringify({ pid: bad, channelId: "A", controlPort: 4512 }));
      expect(readTuiRecord(sd).kind).toBe("none"); // 无 legacy pid 文件 → none
    }
  });

  test("legacy pid '123abc' → none(Number 而非 parseInt,拒绝杂质)", () => {
    writeFileSync(sd.tuiPidFile, "123abc\n");
    expect(readTuiRecord(sd)).toEqual({ kind: "none" });
  });

  test("meta controlPort 非正整数 → 不认 meta", () => {
    writeFileSync(sd.tuiMetaFile, JSON.stringify({ pid: 7, channelId: "A", controlPort: 0 }));
    expect(readTuiRecord(sd).kind).toBe("none");
  });
});
