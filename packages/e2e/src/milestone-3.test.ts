import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDev } from "saarthi";
import {
  buildSidebarRows,
  computeBottleneck,
  filterRows,
  sortRows,
} from "@saarthi/viewer";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const fixtureRoot = resolve(repoRoot, "examples/todo-app");

function outDir(name: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return resolve(tmpdir(), `saarthi-e2e-${name}-${unique}`);
}

describe("milestone 3 — timing sidebar analysis on real traces", () => {
  it("ranks the lagging leaf, not the wrapper, by self-time", () => {
    const { trace } = runDev({
      entry: "server.js",
      root: fixtureRoot,
      outDir: outDir("m3-self"),
      fresh: true,
    });

    const bySelf = sortRows(buildSidebarRows(trace.spans), "self");
    expect(bySelf[0]!.name).toBe("hashPassword");

    const wrapper = bySelf.find((row) => row.name === "handleSignup")!;
    expect(wrapper.selfMs!).toBeLessThan(bySelf[0]!.selfMs!);
  });

  it("computes a bottleneck whose percentage matches selfMs / totalMs", () => {
    const { trace } = runDev({
      entry: "server.js",
      root: fixtureRoot,
      outDir: outDir("m3-bottleneck"),
      fresh: true,
    });

    const bottleneck = computeBottleneck(trace.spans, trace.totalMs);
    expect(bottleneck).not.toBeNull();
    expect(bottleneck!.name).toBe("hashPassword");
    expect(bottleneck!.percent).toBe(
      Math.round((bottleneck!.selfMs / bottleneck!.totalMs) * 100),
    );
    expect(bottleneck!.percent).toBeGreaterThan(50);
  });

  it("sorts by total time to surface the entry point first", () => {
    const { trace } = runDev({
      entry: "server.js",
      root: fixtureRoot,
      outDir: outDir("m3-total"),
      fresh: true,
    });

    const byTotal = sortRows(buildSidebarRows(trace.spans), "total");
    expect(byTotal[0]!.name).toBe("handleSignup");
  });

  it("filters failed and searched spans on a real failure trace", () => {
    const { trace } = runDev({
      entry: "server-fail.js",
      root: fixtureRoot,
      outDir: outDir("m3-fail"),
      fresh: true,
    });

    const rows = buildSidebarRows(trace.spans);
    expect(
      filterRows(rows, { mode: "failed" })
        .map((row) => row.name)
        .sort(),
    ).toEqual(["boom", "boom2", "top"]);
    expect(
      filterRows(rows, { query: "boom" })
        .map((row) => row.name)
        .sort(),
    ).toEqual(["boom", "boom2"]);
    expect(filterRows(rows, { mode: "all", query: "top" }).map((row) => row.name)).toEqual([
      "top",
    ]);
  });
});
