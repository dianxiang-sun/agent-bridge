import { describe, expect, test } from "bun:test";
import { parse } from "smol-toml";
import { generateChannelConfig, withProjectTrust } from "../channel-config";

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

describe("withProjectTrust (codex project trust upsert)", () => {
  test("新目录 → 加 [projects.<dir>].trust_level=trusted,其他配置保留", () => {
    const out = withProjectTrust(`model = "gpt-5"\n`, "/Users/ds/proj/foo");
    const o: any = parse(out);
    expect(o.projects["/Users/ds/proj/foo"].trust_level).toBe("trusted");
    expect(o.model).toBe("gpt-5");
  });

  test("已有目录(untrusted) → upsert 成 trusted,不重复 table", () => {
    const src = [`[projects."/Users/ds/a"]`, `trust_level = "untrusted"`].join("\n");
    const out = withProjectTrust(src, "/Users/ds/a");
    const o: any = parse(out); // parse 成功即证明无 duplicate table(重复会抛)
    expect(o.projects["/Users/ds/a"].trust_level).toBe("trusted");
    expect(out.split(`projects."/Users/ds/a"`).length - 1).toBe(1); // 只出现一次
  });

  test("保留其他 [projects.*] 不动 + 幂等(重复调用结果不变)", () => {
    const src = [`[projects."/other"]`, `trust_level = "trusted"`].join("\n");
    const once = withProjectTrust(src, "/Users/ds/new");
    const twice = withProjectTrust(once, "/Users/ds/new");
    const o: any = parse(twice);
    expect(o.projects["/other"].trust_level).toBe("trusted");
    expect(o.projects["/Users/ds/new"].trust_level).toBe("trusted");
    expect(twice).toBe(once); // 幂等:第二次无变化
  });

  test("路径含空格/特殊字符 → 正确转义可 round-trip", () => {
    const dir = "/Users/ds/my proj";
    const out = withProjectTrust(``, dir);
    const o: any = parse(out); // 不抛 = smol-toml 转义正确
    expect(o.projects[dir].trust_level).toBe("trusted");
  });
});
