import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendLogRotated } from "../log-rotation";

describe("appendLogRotated", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "abg-logrot-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test("appends to a fresh file (no rotation needed)", () => {
    const f = join(dir, "a.log");
    appendLogRotated(f, "hello\n", 100);
    appendLogRotated(f, "world\n", 100);
    expect(readFileSync(f, "utf-8")).toBe("hello\nworld\n");
    expect(existsSync(`${f}.1`)).toBe(false);
  });

  test("rotates to <file>.1 when the cap would be exceeded", () => {
    const f = join(dir, "a.log");
    writeFileSync(f, "x".repeat(90));
    appendLogRotated(f, "y".repeat(20), 100); // 90+20 > 100 → rotate first
    expect(readFileSync(`${f}.1`, "utf-8")).toBe("x".repeat(90));
    expect(readFileSync(f, "utf-8")).toBe("y".repeat(20));
  });

  test("a second rotation replaces the previous backup (bounded footprint)", () => {
    const f = join(dir, "a.log");
    writeFileSync(f, "first".padEnd(90, "!"));
    appendLogRotated(f, "z".repeat(20), 100);
    writeFileSync(f, "second".padEnd(90, "!"));
    appendLogRotated(f, "w".repeat(20), 100);
    expect(readFileSync(`${f}.1`, "utf-8")).toBe("second".padEnd(90, "!"));
    expect(readFileSync(f, "utf-8")).toBe("w".repeat(20));
    expect(existsSync(`${f}.2`)).toBe(false);
  });

  test("never throws on an unwritable path (best-effort contract)", () => {
    expect(() => appendLogRotated(join(dir, "no", "such", "dir", "a.log"), "x\n")).not.toThrow();
  });
});
