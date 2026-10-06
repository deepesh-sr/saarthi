import type { Span, SpanStatus } from "@saarthi/core";
import { computeDepth } from "./layout";

export interface FlowNode {
  id: string;
  name: string;
  status: SpanStatus;
  depth: number;
  totalMs: number;
  selfMs: number | null;
  file: string;
  line: number;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  status: SpanStatus;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  maxDepth: number;
}

export function buildFlowGraph(spans: Span[]): FlowGraph {
  const byId = new Map(spans.map((span) => [span.id, span]));

  const nodes: FlowNode[] = spans.map((span) => ({
    id: span.id,
    name: span.name,
    status: span.status,
    depth: computeDepth(byId, span),
    totalMs: round(Math.max((span.end ?? span.start) - span.start, 0)),
    selfMs: span.selfMs,
    file: span.file,
    line: span.line,
  }));

  const edges: FlowEdge[] = spans
    .filter((span) => span.parentId !== null && byId.has(span.parentId))
    .map((span) => ({
      id: `${span.parentId}->${span.id}`,
      from: span.parentId!,
      to: span.id,
      label: `${round(Math.max((span.end ?? span.start) - span.start, 0))}ms`,
      status: span.status,
    }));

  const maxDepth = nodes.reduce((max, node) => Math.max(max, node.depth), 0);
  return { nodes, edges, maxDepth };
}

function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}
