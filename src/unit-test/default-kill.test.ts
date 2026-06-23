import { describe, expect, test } from "bun:test";
import { decideDefaultDaemonKill } from "../cli/kill";

describe("decideDefaultDaemonKill (Mechanism C: default 身份门 + wedged 兜底)", () => {
  test("无 pid → proceed(交给 lifecycle 清理 stale)", () => {
    expect(decideDefaultDaemonKill(null, false, null, 4502, false)).toEqual({ action: "proceed" });
  });

  test("pid 存在但不 alive → proceed", () => {
    expect(decideDefaultDaemonKill(123, false, null, 4502, false)).toEqual({ action: "proceed" });
  });

  test("healthz 报 default + pid/port 匹配 → proceed", () => {
    expect(decideDefaultDaemonKill(123, true, { channelId: "default", controlPort: 4502, pid: 123 }, 4502, false))
      .toEqual({ action: "proceed" });
  });

  test("⚠healthz 报 channelId!=default(其实是 named daemon) → refuse(堵'以 default 之名杀 named')", () => {
    expect(decideDefaultDaemonKill(123, true, { channelId: "ICSE2027", controlPort: 4522, pid: 123 }, 4502, false).action)
      .toBe("refuse");
  });

  test("healthz pid 不匹配 → refuse", () => {
    expect(decideDefaultDaemonKill(123, true, { channelId: "default", controlPort: 4502, pid: 999 }, 4502, false).action)
      .toBe("refuse");
  });

  test("healthz controlPort 不匹配 → refuse", () => {
    expect(decideDefaultDaemonKill(123, true, { channelId: "default", controlPort: 9999, pid: 123 }, 4502, false).action)
      .toBe("refuse");
  });

  test("healthz 不可达(wedged daemon) + pid 未被 named 记录 → proceed(仍能杀卡死 default,去 regression)", () => {
    expect(decideDefaultDaemonKill(123, true, null, 4502, false)).toEqual({ action: "proceed" });
  });

  test("⚠healthz 不可达 + pid 被某 named 记录 → refuse(不把 named pid 当 default 杀)", () => {
    expect(decideDefaultDaemonKill(123, true, null, 4502, true).action).toBe("refuse");
  });
});
