/**
 * 契约 2:per-channel config.toml 的结构化生成(TOML AST 遍历,禁止字符串替换)。
 *
 * 从 root config 解析出 AST,把任何指向 rootCodexHome(精确或后代)的路径值重写到
 * channelCodexHome 下;非-home 路径(/opt/homebrew、~/.cache/...)与 [projects.*] trust
 * 表(键为 workspace 路径,非 codex-home 状态)原样保留。调用方负责 realpath(rootCodexHome)
 * 后再传入,使前缀匹配对齐 config 里的绝对路径。
 */
import { parse, stringify } from "smol-toml";
import { sep } from "node:path";

export function generateChannelConfig(
  rootConfigText: string,
  rootCodexHome: string,
  channelCodexHome: string,
): string {
  const ast = parse(rootConfigText);
  const rootPrefix = rootCodexHome.endsWith(sep) ? rootCodexHome : rootCodexHome + sep;
  rewriteNode(ast, rootCodexHome, rootPrefix, channelCodexHome);
  return stringify(ast as any);
}

/** Recursively rewrite root-codex-home descendant string values in place. Table KEYS are
 * never rewritten (so [projects."..."] workspace paths are preserved). */
function rewriteNode(node: unknown, root: string, rootPrefix: string, channelHome: string): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === "string") node[i] = rewriteValue(v, root, rootPrefix, channelHome);
      else if (v && typeof v === "object") rewriteNode(v, root, rootPrefix, channelHome);
    }
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (typeof v === "string") obj[key] = rewriteValue(v, root, rootPrefix, channelHome);
      else if (v && typeof v === "object") rewriteNode(v, root, rootPrefix, channelHome);
    }
  }
}

function rewriteValue(value: string, root: string, rootPrefix: string, channelHome: string): string {
  if (value === root) return channelHome; // exact CODEX_HOME match
  if (value.startsWith(rootPrefix)) {
    return channelHome + sep + value.slice(rootPrefix.length);
  }
  return value; // non-home path or unrelated string — preserve
}
