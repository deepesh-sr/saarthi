import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDev } from "saarthi";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const fixtureRoot = resolve(repoRoot, "examples/todo-app");

function outDir(name: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return resolve(tmpdir(), `saarthi-e2e-${name}-${unique}`);
}

describe("milestone 1 — capture one flow to JSON", () => {
  it("captures a truthful nested signup flow", () => {
    const result = runDev({
      entry: "server.js",
      root: fixtureRoot,
      outDir: outDir("signup"),
      fresh: true,
    });
    const { trace } = result;
    const byName = (name: string) => trace.spans.find((s) => s.name === name)!;

    expect(existsSync(result.file)).toBe(true);
    expect(trace.spans.map((s) => s.name)).toEqual(
      expect.arrayContaining([
        "handleSignup",
        "validate",
        "hashPassword",
        "createSession",
        "insert",
      ]),
    );

    const root = byName("handleSignup");
    expect(root.parentId).toBeNull();
    expect(trace.root).toBe(root.id);

    for (const child of ["validate", "hashPassword", "createSession", "insert"]) {
      expect(byName(child).parentId).toBe(root.id);
    }

    for (const span of trace.spans) {
      if (span.parentId === root.id) {
        expect(span.start).toBeGreaterThanOrEqual(root.start);
        expect(span.end!).toBeLessThanOrEqual(root.end!);
      }
    }

    expect(root.selfMs!).toBeLessThan(root.end! - root.start);
    expect(byName("hashPassword").file).toBe("lib/auth.js");

    for (const span of trace.spans) {
      expect(span.status).not.toBe("running");
      expect(span.end).not.toBeNull();
    }
  });

  it("marks failures and whether they were caught or propagated", () => {
    const result = runDev({
      entry: "server-fail.js",
      root: fixtureRoot,
      outDir: outDir("fail"),
      fresh: true,
    });
    const { trace } = result;
    const byName = (name: string) => trace.spans.find((s) => s.name === name)!;

    expect((globalThis as { __caught?: string }).__caught).toBe("kaboom");
    expect((globalThis as { __prop?: string }).__prop).toBe("prop");

    expect(byName("boom").status).toBe("failed");
    expect(byName("boom").error?.message).toBe("kaboom");
    expect(byName("boom").error?.caught).toBe(true);
    expect(byName("catches").status).toBe("done");

    expect(byName("boom2").status).toBe("failed");
    expect(byName("boom2").error?.caught).toBe(false);
    expect(byName("top").status).toBe("failed");
  });

  it("writes an OTel-shaped trace file", () => {
    const result = runDev({
      entry: "server.js",
      root: fixtureRoot,
      outDir: outDir("json"),
      fresh: true,
    });
    const parsed = JSON.parse(readFileSync(result.file, "utf8"));
    expect(parsed.traceId).toBeTruthy();
    expect(Array.isArray(parsed.spans)).toBe(true);
    expect(typeof parsed.totalMs).toBe("number");
    expect(parsed.root).toBeTruthy();
  });
});
