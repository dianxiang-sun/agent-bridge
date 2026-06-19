import { describe, expect, test } from "bun:test";
import { parse } from "smol-toml";
import { generateChannelConfig } from "../channel-config";

describe("generateChannelConfig (契约2)", () => {
  const ROOT = "/Users/ds/.codex";
  const CH = "/tmp/abg/codex-home/A";

  test("重写 home 后代 + 无 root 残留 + 保留 [projects.*] / 非-home", () => {
    const src = [
      `notify = "${ROOT}/computer-use/notify.js"`,
      ``,
      `[[marketplaces]]`,
      `source = "${ROOT}/.tmp/bundled-marketplaces/x"`,
      ``,
      `[shell_environment_policy]`,
      `NODE_REPL_TRUSTED_CODE_PATHS = "${ROOT}/plugins"`,
      `EXTERNAL = "/opt/homebrew/bin"`,
      ``,
      `[projects."/Users/ds/work"]`,
      `trust_level = "trusted"`,
    ].join("\n");

    const out = generateChannelConfig(src, ROOT, CH);
    // format-independent:重写后整份文本不得再含 root home 路径
    expect(out).not.toContain(ROOT);

    const o: any = parse(out);
    expect(o.notify).toBe(`${CH}/computer-use/notify.js`);
    expect(o.marketplaces[0].source).toBe(`${CH}/.tmp/bundled-marketplaces/x`);
    expect(o.shell_environment_policy.NODE_REPL_TRUSTED_CODE_PATHS).toBe(`${CH}/plugins`);
    expect(o.shell_environment_policy.EXTERNAL).toBe("/opt/homebrew/bin"); // 非-home 保留
    expect(o.projects["/Users/ds/work"].trust_level).toBe("trusted"); // trust 保留
  });

  test("无 home 路径 → 原样保留非-home,不抛", () => {
    const out = generateChannelConfig(`foo = "/opt/x"\n`, ROOT, CH);
    expect((parse(out) as any).foo).toBe("/opt/x");
  });

  test("rootCodexHome 精确匹配(非后代)也重写", () => {
    const out = generateChannelConfig(`CODEX_HOME = "${ROOT}"\n`, ROOT, CH);
    expect((parse(out) as any).CODEX_HOME).toBe(CH);
  });
});
