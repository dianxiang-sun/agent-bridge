import { describe, expect, test } from "bun:test";
import { detectTmuxKillContext, type TmuxExec } from "../cli/tmux-context";

const fakeExec = (out: string, throws = false): TmuxExec => () => {
  if (throws) throw new Error("tmux: command not found");
  return out;
};

describe("detectTmuxKillContext (marker triplet, NOT session name)", () => {
  test("无 $TMUX → outside-tmux (不调用 tmux)", () => {
    let called = false;
    const ctx = detectTmuxKillContext({}, () => { called = true; return ""; });
    expect(ctx).toEqual({ kind: "outside-tmux" });
    expect(called).toBe(false);
  });

  test("managed named session → managed-tmux + channelId", () => {
    const ctx = detectTmuxKillContext({ TMUX: "/tmp/sock,123,0" }, fakeExec("ICSE2027\t1\tnamed\tICSE2027"));
    expect(ctx).toEqual({ kind: "managed-tmux", sessionName: "ICSE2027", sessionKind: "named", channelId: "ICSE2027" });
  });

  test("managed default session → managed-tmux default", () => {
    const ctx = detectTmuxKillContext({ TMUX: "x" }, fakeExec("ds\t1\tdefault\tdefault"));
    expect(ctx).toEqual({ kind: "managed-tmux", sessionName: "ds", sessionKind: "default", channelId: "default" });
  });

  test("unmarked session (空 marker 三元组) → unmarked-tmux (空串=未标)", () => {
    const ctx = detectTmuxKillContext({ TMUX: "x" }, fakeExec("ICSE27\t\t\t"));
    expect(ctx).toEqual({ kind: "unmarked-tmux", sessionName: "ICSE27" });
  });

  test("managed=1 但缺 kind/id → unmarked (不完整 marker 不可信)", () => {
    expect(detectTmuxKillContext({ TMUX: "x" }, fakeExec("s\t1\t\tICSE27")).kind).toBe("unmarked-tmux"); // 缺 kind
    expect(detectTmuxKillContext({ TMUX: "x" }, fakeExec("s\t1\tnamed\t")).kind).toBe("unmarked-tmux");   // 缺 id
  });

  test("managed!=1 (例如旧 session 误置) → unmarked", () => {
    expect(detectTmuxKillContext({ TMUX: "x" }, fakeExec("s\t0\tnamed\tICSE27")).kind).toBe("unmarked-tmux");
  });

  test("tmux 查询抛错(未装/失败)但在 $TMUX 内 → unmarked (destructive 必拒,不猜)", () => {
    const ctx = detectTmuxKillContext({ TMUX: "x" }, fakeExec("", true));
    expect(ctx.kind).toBe("unmarked-tmux");
  });

  test("trailing newline 被裁剪", () => {
    const ctx = detectTmuxKillContext({ TMUX: "x" }, fakeExec("ds\t1\tdefault\tdefault\n"));
    expect(ctx).toEqual({ kind: "managed-tmux", sessionName: "ds", sessionKind: "default", channelId: "default" });
  });
});
