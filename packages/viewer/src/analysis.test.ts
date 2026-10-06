import { describe, expect, it } from "vitest";
import type { Span } from "@saarthi/core";
import {
  buildSidebarRows,
  computeBottleneck,
  filterRows,
  sortRows,
} from "./analysis";

function span(partial: Partial<Span> & { id: string; name: string }): Span {
  return {
    parentId: null,
    file: "f.ts",
    line: 1,
    start: 0,
    end: 10,
    selfMs: 10,
    status: "done",
    calls: 1,
    error: null,
    blockedOn: null,
    ...partial,
  };
}

const spans: Span[] = [
  span({ id: "root", name: "handleSignup", start: 0, end: 100, selfMs: 0.5 }),
  span({ id: "hash", name: "hashPassword", parentId: "root", start: 10, end: 60, selfMs: 40 }),
  span({ id: "validate", name: "validate", parentId: "root", start: 1, end: 3, selfMs: 2 }),
  span({
    id: "boom",
    name: "boom",
    parentId: "root",
    start: 70,
    end: 72,
    selfMs: 2,
    status: "failed",
    error: { name: "Error", message: "x", caught: false },
  }),
];

describe("sidebar rows", () => {
  it("computes total, self, depth and file:line per span", () => {
    const rows = buildSidebarRows(spans);
    const hash = rows.find((r) => r.id === "hash")!;
    expect(hash.totalMs).toBe(50);
    expect(hash.selfMs).toBe(40);
    expect(hash.depth).toBe(1);
    expect(hash.file).toBe("f.ts");
    expect(rows.find((r) => r.id === "root")!.depth).toBe(0);
  });

  it("sorts by self-time so the lagging leaf outranks the wrapper", () => {
    const bySelf = sortRows(buildSidebarRows(spans), "self");
    expect(bySelf[0]!.name).toBe("hashPassword");
    expect(bySelf[0]!.name).not.toBe("handleSignup");
  });

  it("sorts by total time so the wrapper ranks first", () => {
    const byTotal = sortRows(buildSidebarRows(spans), "total");
    expect(byTotal[0]!.name).toBe("handleSignup");
  });

  it("filters by status, slowness, and search", () => {
    const rows = buildSidebarRows(spans);
    expect(filterRows(rows, { mode: "failed" }).map((r) => r.name)).toEqual(["boom"]);
    expect(filterRows(rows, { mode: "slow" }).map((r) => r.name)).toEqual(["hashPassword"]);
    expect(filterRows(rows, { query: "hash" }).map((r) => r.name)).toEqual(["hashPassword"]);
    expect(filterRows(rows, { mode: "all", query: "sign" }).map((r) => r.name)).toEqual([
      "handleSignup",
    ]);
  });

  it("names the bottleneck by self-time with a matching percentage", () => {
    const bottleneck = computeBottleneck(spans, 100);
    expect(bottleneck).not.toBeNull();
    expect(bottleneck!.name).toBe("hashPassword");
    expect(bottleneck!.percent).toBe(40);
    expect(bottleneck!.percent).toBe(
      Math.round((bottleneck!.selfMs / bottleneck!.totalMs) * 100),
    );
  });

  it("returns no bottleneck when nothing has self-time", () => {
    expect(computeBottleneck([], 0)).toBeNull();
  });
});
