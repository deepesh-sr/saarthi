import { describe, expect, it } from "vitest";
import type { Span } from "@saarthi/core";
import { buildFlowGraph } from "./flow";

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
  span({ id: "root", name: "handleSignup", start: 0, end: 100, selfMs: 1 }),
  span({ id: "a", name: "validate", parentId: "root", start: 5, end: 8, selfMs: 3 }),
  span({ id: "b", name: "hashPassword", parentId: "root", start: 10, end: 70, selfMs: 60 }),
  span({ id: "c", name: "helper", parentId: "b", start: 20, end: 30, selfMs: 10 }),
  span({
    id: "d",
    name: "boom",
    parentId: "root",
    start: 75,
    end: 80,
    selfMs: 5,
    status: "failed",
    error: { name: "Error", message: "x", caught: false },
  }),
];

describe("buildFlowGraph", () => {
  it("produces one node per span with depth", () => {
    const graph = buildFlowGraph(spans);
    expect(graph.nodes).toHaveLength(spans.length);
    expect(graph.nodes.find((n) => n.id === "root")!.depth).toBe(0);
    expect(graph.nodes.find((n) => n.id === "b")!.depth).toBe(1);
    expect(graph.nodes.find((n) => n.id === "c")!.depth).toBe(2);
    expect(graph.maxDepth).toBe(2);
  });

  it("edges match the parent-child topology exactly (no extras, no missing)", () => {
    const graph = buildFlowGraph(spans);
    const children = spans.filter((s) => s.parentId !== null);
    expect(graph.edges).toHaveLength(children.length);

    for (const child of children) {
      const edge = graph.edges.find((e) => e.to === child.id)!;
      expect(edge.from).toBe(child.parentId);
    }
    for (const edge of graph.edges) {
      const child = spans.find((s) => s.id === edge.to)!;
      expect(child.parentId).toBe(edge.from);
    }
  });

  it("labels edges with the child duration and status", () => {
    const graph = buildFlowGraph(spans);
    const edgeToHash = graph.edges.find((e) => e.to === "b")!;
    expect(edgeToHash.label).toBe("60ms");
    expect(edgeToHash.status).toBe("done");

    const edgeToBoom = graph.edges.find((e) => e.to === "d")!;
    expect(edgeToBoom.label).toBe("5ms");
    expect(edgeToBoom.status).toBe("failed");
  });

  it("ignores a dangling parent reference (kept as a root node)", () => {
    const graph = buildFlowGraph([span({ id: "x", name: "orphan", parentId: "missing" })]);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });
});
