import { describe, expect, it } from "vitest";
import type { Span } from "@sarathi/core";
import { layoutWaterfall } from "./layout";

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

describe("layoutWaterfall", () => {
  it("positions boxes by start offset and duration, nested by depth", () => {
    const spans = [
      span({ id: "a", name: "outer", start: 0, end: 100 }),
      span({ id: "b", name: "inner", parentId: "a", start: 20, end: 60 }),
      span({ id: "c", name: "leaf", parentId: "b", start: 30, end: 40 }),
    ];
    const { boxes, lanes, totalMs } = layoutWaterfall(spans);

    const a = boxes.find((box) => box.id === "a")!;
    const b = boxes.find((box) => box.id === "b")!;
    const c = boxes.find((box) => box.id === "c")!;

    expect(totalMs).toBe(100);
    expect([a.lane, b.lane, c.lane]).toEqual([0, 1, 2]);
    expect(lanes).toBe(3);
    expect([a.x, a.width]).toEqual([0, 100]);
    expect([b.x, b.width]).toEqual([20, 40]);
    expect([c.x, c.width]).toEqual([30, 10]);

    expect(b.x).toBeGreaterThanOrEqual(a.x);
    expect(b.x + b.width).toBeLessThanOrEqual(a.x + a.width);
    expect(c.x + c.width).toBeLessThanOrEqual(b.x + b.width);
  });

  it("renders a running span up to the current total", () => {
    const spans = [
      span({ id: "a", name: "running", start: 10, end: null, status: "running", selfMs: null }),
    ];
    const { boxes, totalMs } = layoutWaterfall(spans, { totalMs: 50 });
    expect(totalMs).toBe(50);
    expect(boxes[0]!.x).toBe(10);
    expect(boxes[0]!.width).toBe(40);
  });

  it("treats a missing parent as a root lane (re-parented later)", () => {
    const spans = [span({ id: "child", name: "child", parentId: "missing" })];
    const { boxes } = layoutWaterfall(spans);
    expect(boxes[0]!.lane).toBe(0);
  });
});
