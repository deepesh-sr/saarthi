import { describe, expect, it } from "vitest";
import type { Span, SpanEvent } from "@sarathi/core";
import { applyEvent, createTraceState, spansInOrder } from "./reducer";

function span(partial: Partial<Span> & { id: string; name: string }): Span {
  return {
    parentId: null,
    file: "f.ts",
    line: 1,
    start: 0,
    end: null,
    selfMs: null,
    status: "running",
    calls: 1,
    error: null,
    blockedOn: null,
    ...partial,
  };
}

function enter(spanValue: Span): SpanEvent {
  return { type: "enter", span: spanValue };
}

describe("trace reducer", () => {
  it("re-parents a child that arrives before its parent", () => {
    let state = createTraceState("t");
    state = applyEvent(state, enter(span({ id: "child", name: "child", parentId: "parent" })));
    expect(state.orphanIds).toEqual(["child"]);

    state = applyEvent(state, enter(span({ id: "parent", name: "parent" })));
    expect(state.orphanIds).toEqual([]);
    expect(state.byId["child"]!.parentId).toBe("parent");
  });

  it("updates a span in place as events arrive (running -> done)", () => {
    let state = createTraceState("t");
    state = applyEvent(state, enter(span({ id: "a", name: "a" })));
    expect(state.byId["a"]!.status).toBe("running");

    state = applyEvent(state, {
      type: "exit",
      span: span({ id: "a", name: "a", end: 12, selfMs: 12, status: "done" }),
    });
    expect(state.byId["a"]!.status).toBe("done");
    expect(state.byId["a"]!.end).toBe(12);
    expect(state.order).toEqual(["a"]);
  });

  it("keeps arrival order", () => {
    let state = createTraceState("t");
    state = applyEvent(state, enter(span({ id: "b", name: "b" })));
    state = applyEvent(state, enter(span({ id: "a", name: "a" })));
    expect(spansInOrder(state).map((s) => s.id)).toEqual(["b", "a"]);
  });
});
